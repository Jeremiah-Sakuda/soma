import { automaticModelContext } from './automatic-context';
import { createHash, randomBytes } from 'node:crypto';
import type { WorkspaceState, SourceRef, AgentRun } from '../domain/types';
import { assertVerifiedAccount, assertAccountWorkspaceGeneration, type VerifiedAccount } from './account';
import { readAccountWorkspace, updateAccountWorkspace } from './account-store';
import { getServerFirestore } from './firebase-config';
import { prepareWithSpark, PreparationError, SPARK_ENGINE_VERSION } from './meta';
import { inferenceEnabled, InferenceBudgetError } from './budget';
import { WorkspaceConflictError, WorkspaceStoreError } from './store';
import { investigateWithSpark, publishInvestigation, InvestigationError, ENGINE_VERSION, type InvestigationResult } from './investigator';
import { MODEL_VERSION } from '../domain/lessons';
import { META_MODEL } from './meta-client';
import { runAuditedPublication } from './audited-publication';
import { retryableExecutionFailure, type ExecutionFailure } from './execution-failure';

export type PreparationIntent = 'prepare-lesson' | 'investigate-change';
export type PreparationJob = {
  intent?: PreparationIntent;
  engineVersion?: string; runtimeModel?: string;
  id: string; ownerId: string; workspaceId: string; courseId: string; topic: string; sourceRefs: SourceRef[];
  status: 'queued' | 'generating' | 'checking' | 'ready' | 'failed' | 'stale';
  createdAt: string; updatedAt: string; attempts: number; contextRevision: number;
  leaseId?: string; leaseUntil?: number; nextAttemptAt?: number; lessonId?: string; notice?: string; failureRun?: AgentRun; failure?: ExecutionFailure;
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;

function refs(account: VerifiedAccount) {
  assertVerifiedAccount(account);
  return getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
}

export function preparationJobId(workspace: WorkspaceState, courseId: string, sourceRefs: SourceRef[], topic: string, contextRevision = workspace.revision, intent: PreparationIntent = 'prepare-lesson'): string {
  return digest(JSON.stringify({ workspaceId: workspace.id, courseId, sourceRefs: [...sourceRefs].sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.version - b.version), topic, contextRevision, modelVersion: MODEL_VERSION, engineVersion: intent === 'investigate-change' ? ENGINE_VERSION : SPARK_ENGINE_VERSION, ...(intent === 'investigate-change' ? { intent, runtimeModel: META_MODEL } : {}) }));
}

export function jobSourcesCurrent(workspace: WorkspaceState, job: Pick<PreparationJob, 'workspaceId' | 'courseId' | 'sourceRefs'>): boolean {
  return workspace.id === job.workspaceId && workspace.courses.some(course => course.id === job.courseId) && job.sourceRefs.length > 0 && job.sourceRefs.every(ref => workspace.sources.some(source => source.id === ref.sourceId && source.version === ref.version && source.status === 'current' && source.courseId === job.courseId) && !workspace.sources.some(source => source.id === ref.sourceId && source.version > ref.version));
}

export function mayClaimJob(job: PreparationJob, now = Date.now()): boolean {
  return job.attempts < MAX_ATTEMPTS && (job.nextAttemptAt ?? 0) <= now && ((job.status === 'queued' && (job.leaseUntil ?? 0) <= now) || ((job.status === 'generating' || job.status === 'checking') && (job.leaseUntil ?? 0) <= now));
}

/** Only obsolete queued work without an active lease can release an admission slot. */
export function staleQueuedPreparation(workspace: WorkspaceState, job: PreparationJob, ownerId: string, now = Date.now()): boolean {
  return job.ownerId === ownerId && job.workspaceId === workspace.id && job.status === 'queued' && (job.leaseUntil ?? 0) <= now && !jobSourcesCurrent(workspace, { workspaceId: job.workspaceId, courseId: job.courseId, sourceRefs: job.sourceRefs });
}

/** Retire stale sources even while valid older work is paused by the model allowance. */
export function nextPreparationCandidate(workspace: WorkspaceState, jobs: PreparationJob[], ownerId: string, now = Date.now()): PreparationJob | undefined {
  return jobs.filter(job => job.ownerId === ownerId && job.workspaceId === workspace.id && (staleQueuedPreparation(workspace, job, ownerId, now) || mayClaimJob(job, now) || ((job.status === 'generating' || job.status === 'checking') && (job.leaseUntil ?? 0) <= now)))
    .sort((a, b) => Number(staleQueuedPreparation(workspace, b, ownerId, now)) - Number(staleQueuedPreparation(workspace, a, ownerId, now)) || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))[0];
}

export async function enqueuePreparation(account: VerifiedAccount, workspace: WorkspaceState, courseId: string, sourceRefs: SourceRef[], topic: string, contextRevision = workspace.revision, intent: PreparationIntent = 'prepare-lesson'): Promise<PreparationJob> {
  const root = refs(account);
  assertAccountWorkspaceGeneration(account, workspace.id);
  if (!['prepare-lesson', 'investigate-change'].includes(intent)) throw new WorkspaceStoreError('Unsupported preparation intent.', 422, 'job_intent');
  if (topic.length > 300 || !jobSourcesCurrent(workspace, { workspaceId: workspace.id, courseId, sourceRefs })) throw new WorkspaceStoreError('Preparation requires current sources in this course.', 422, 'job_source_scope');
  const id = preparationJobId(workspace, courseId, sourceRefs, topic, contextRevision, intent);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== workspace.id || metadata.get('revision') !== workspace.revision || metadata.get('deleted')) throw new WorkspaceConflictError();
    const previous = await transaction.get(root.collection('jobs').doc(id));
    if (previous.exists) {
      if (previous.get('ownerId') !== account.uid || previous.get('workspaceId') !== workspace.id) throw new WorkspaceStoreError('Preparation ownership could not be verified.', 403, 'job_owner_mismatch');
      return previous.data() as PreparationJob;
    }
    // Read the complete active set: limiting to five before retiring stale work can hide retained jobs.
    const active = await transaction.get(root.collection('jobs').where('status', 'in', ['queued', 'generating', 'checking']));
    const nowMs = Date.now();
    const retired = active.docs.filter(document => staleQueuedPreparation(workspace, document.data() as PreparationJob, account.uid, nowMs));
    if (active.size - retired.length >= 5) throw new WorkspaceStoreError('Five preparations are already waiting. Finish one before adding another.', 429, 'job_capacity');
    const now = new Date(nowMs).toISOString();
    for (const document of retired) transaction.update(document.ref, { status: 'stale', leaseId: '', leaseUntil: 0, updatedAt: now, notice: 'Supporting sources changed. Import the current material to prepare a new version.' });
    const job: PreparationJob = { id, intent, engineVersion: intent === 'investigate-change' ? ENGINE_VERSION : SPARK_ENGINE_VERSION, runtimeModel: META_MODEL, ownerId: account.uid, workspaceId: workspace.id, courseId, topic, sourceRefs, status: 'queued', createdAt: now, updatedAt: now, attempts: 0, contextRevision };
    transaction.create(root.collection('jobs').doc(id), job);
    return job;
  });
}

export async function listPreparationJobs(account: VerifiedAccount): Promise<Omit<PreparationJob, 'ownerId' | 'leaseId'>[]> {
  const root = refs(account);
  const metadata = await root.get();
  if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('deleted')) return [];
  assertAccountWorkspaceGeneration(account, metadata.get('workspaceId'));
  const snapshot = await root.collection('jobs').orderBy('createdAt', 'desc').limit(50).get();
  return snapshot.docs.filter(document => document.get('ownerId') === account.uid && document.get('workspaceId') === metadata.get('workspaceId')).map(document => {
    const { ownerId: _owner, leaseId: _lease, ...job } = document.data() as PreparationJob;
    return job;
  });
}

/** Scheduler selection covers the active queue, including interrupted leases. */
export async function listNextPreparationJob(account: VerifiedAccount): Promise<{ id: string } | null> {
  const root = refs(account), workspace = await readAccountWorkspace(account);
  if (!workspace) return null;
  assertAccountWorkspaceGeneration(account, workspace.id);
  const snapshot = await root.collection('jobs').where('status', 'in', ['queued', 'generating', 'checking']).get();
  const next = nextPreparationCandidate(workspace, snapshot.docs.map(document => document.data() as PreparationJob), account.uid);
  return next ? { id: next.id } : null;
}

export function automaticPreparationSources(workspace: WorkspaceState) {
  const latest = new Map<string, number>();
  for (const source of workspace.sources) latest.set(source.id, Math.max(latest.get(source.id) ?? 0, source.version));
  return workspace.sources.filter(source => source.status === 'current' && latest.get(source.id) === source.version && source.courseId && workspace.courses.some(course => course.id === source.courseId) && source.provenance?.automaticPreparation === true);
}

/** Bounded recovery for consented source persistence followed by an interrupted enqueue. */
export async function reconcilePreparationOutbox(account: VerifiedAccount, workspace: WorkspaceState, cursor = ''): Promise<{ cursor: string; queued: boolean }> {
  const root = refs(account);
  assertAccountWorkspaceGeneration(account, workspace.id);
  const sources = automaticPreparationSources(workspace);
  const key = (source: typeof sources[number]) => `${source.id}:${source.version}`;
  const page = sources.sort((a, b) => key(a).localeCompare(key(b))).filter(source => !cursor || key(source).localeCompare(cursor) > 0).slice(0, 20);
  if (!page.length) return { cursor: '', queued: false };
  const missing: typeof sources = [];
  const lookups = await Promise.all(page.map(source => root.collection('jobs').where('sourceRefs', 'array-contains', { sourceId: source.id, version: source.version }).get()));
  for (const [index, source] of page.entries()) {
    const covered = lookups[index].docs.some(document => document.get('ownerId') === account.uid && document.get('workspaceId') === workspace.id && document.get('courseId') === source.courseId && document.get('status') !== 'stale' && (document.get('intent') !== 'investigate-change' || (document.get('engineVersion') === ENGINE_VERSION && document.get('runtimeModel') === META_MODEL)));
    if (!covered && (!missing.length || missing[0].courseId === source.courseId)) missing.push(source);
  }
  if (missing.length) {
    try {
      await enqueuePreparation(account, workspace, missing[0].courseId!, missing.map(source => ({ sourceId: source.id, version: source.version })), 'Investigate the updated course material and its consequence for the next study activity.', workspace.revision, 'investigate-change');
    } catch (error) {
      if ((error as { code?: string }).code === 'job_capacity') return { cursor, queued: false };
      throw error;
    }
  }
  // Rescan a page with several uncovered courses on the next tick; existing refs deduplicate it.
  return { cursor: missing.length ? cursor : key(page.at(-1)!), queued: missing.length > 0 };
}

export async function claimPreparationJob(account: VerifiedAccount, workspace: WorkspaceState, id: string): Promise<PreparationJob | null> {
  const root = refs(account);
  assertAccountWorkspaceGeneration(account, workspace.id);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    const document = await transaction.get(root.collection('jobs').doc(id));
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== workspace.id || metadata.get('revision') !== workspace.revision) throw new WorkspaceConflictError();
    if (!document.exists) throw new WorkspaceStoreError('Preparation could not be found.', 404, 'job_missing');
    const job = document.data() as PreparationJob;
    if (job.ownerId !== account.uid || job.workspaceId !== workspace.id) throw new WorkspaceStoreError('Preparation does not belong to this workspace.', 403, 'job_owner_mismatch');
    if ((job.status === 'queued' || job.status === 'generating' || job.status === 'checking') && (job.leaseUntil ?? 0) > Date.now()) return null;
    if (!jobSourcesCurrent(workspace, job)) {
      transaction.update(document.ref, { status: 'stale', leaseId: '', leaseUntil: 0, updatedAt: new Date().toISOString(), notice: 'Supporting sources changed. Import the current material to prepare a new version.' });
      return null;
    }
    if (!mayClaimJob(job)) {
      if ((job.status === 'generating' || job.status === 'checking') && (job.leaseUntil ?? 0) <= Date.now() && job.attempts >= MAX_ATTEMPTS) transaction.update(document.ref, { status: 'failed', notice: 'Preparation exhausted its restart attempts.', updatedAt: new Date().toISOString() });
      return null;
    }
    const claimed: PreparationJob = { ...job, status: 'generating', attempts: job.attempts + 1, contextRevision: workspace.revision, leaseId: randomBytes(24).toString('hex'), leaseUntil: Date.now() + LEASE_MS, updatedAt: new Date().toISOString() };
    transaction.set(document.ref, claimed);
    return claimed;
  });
}

/** Only the unchanged owner lease can refund a preflight claim; provider failures never qualify. */
export function budgetBlockedJobPatch(current: PreparationJob | undefined, claimed: PreparationJob, error: unknown, now = new Date().toISOString()): Partial<PreparationJob> | null {
  if (!(error instanceof InferenceBudgetError) || !current || !claimed.leaseId || current.id !== claimed.id || current.ownerId !== claimed.ownerId || current.workspaceId !== claimed.workspaceId || current.leaseId !== claimed.leaseId || current.status !== 'generating' || current.attempts !== claimed.attempts) return null;
  const reason = error.reason === 'daily' ? 'The daily workspace allowance is used. Try after the next UTC day.' : error.reason === 'global' ? 'The application allowance is used. Waiting for budget availability.' : 'Live inference needs configured allocation and application budgets.';
  return { status: 'queued', attempts: Math.max(0, claimed.attempts - 1), leaseId: '', leaseUntil: 0, updatedAt: now, notice: `${reason} This job remains queued; no Meta request was made for this attempt.` };
}

async function requeueBudgetBlockedJob(account: VerifiedAccount, job: PreparationJob, error: InferenceBudgetError): Promise<void> {
  const root = refs(account);
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    const document = await transaction.get(root.collection('jobs').doc(job.id));
    if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('deleted') || metadata.get('workspaceId') !== job.workspaceId) return;
    const patch = budgetBlockedJobPatch(document.exists ? document.data() as PreparationJob : undefined, job, error);
    if (patch) transaction.update(document.ref, patch);
  });
}

/** Retry only typed provider transport failures, never model validation or unknown errors. */
export function preparationFailurePatch(job: PreparationJob, error: unknown, now = Date.now()): Partial<PreparationJob> {
  const stale = error instanceof WorkspaceConflictError;
  const failureRun = error instanceof PreparationError || error instanceof InvestigationError ? error.run : undefined;
  const transient = (error instanceof InvestigationError || error instanceof PreparationError) && retryableExecutionFailure(error.failure);
  const retry = !stale && transient && job.attempts < MAX_ATTEMPTS;
  return { status: stale ? 'stale' : retry ? 'queued' : 'failed', leaseId: '', leaseUntil: 0,
    nextAttemptAt: retry ? now + Math.min(300_000, 30_000 * 2 ** Math.max(0, job.attempts - 1)) : 0,
    updatedAt: new Date(now).toISOString(), ...(failureRun ? { failureRun } : {}), ...((error instanceof PreparationError || error instanceof InvestigationError) && error.failure ? {failure:error.failure} : {}),
    notice: stale ? 'Context changed during preparation. No obsolete result was published.'
      : retry ? 'Preparation paused after a temporary provider interruption and will retry automatically within its existing attempt and spending limits.'
      : job.intent === 'investigate-change' ? 'The source investigation did not publish a validated decision. Your imported material is still available.'
      : 'Preparation could not publish a validated lesson preview. Your imported material is still available.' };
}

async function fail(account: VerifiedAccount, job: PreparationJob, error: unknown): Promise<void> {
  const root = refs(account);
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    const document = await transaction.get(root.collection('jobs').doc(job.id));
    if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('deleted') || metadata.get('workspaceId') !== job.workspaceId || !document.exists || document.get('ownerId') !== account.uid || document.get('leaseId') !== job.leaseId) return;
    transaction.update(document.ref, preparationFailurePatch(job, error));
  });
}

export type PreparationOutcome = { intent: 'prepare-lesson'; result: Awaited<ReturnType<typeof prepareWithSpark>> } | { intent: 'investigate-change'; result: InvestigationResult };

/** Domain publication is shared by the worker and tests; persistence adds revision and lease CAS. */
export function publishPreparationOutcome(state: WorkspaceState, job: PreparationJob, outcome: PreparationOutcome): WorkspaceState {
  if (!jobSourcesCurrent(state, job) || (job.intent ?? 'prepare-lesson') !== outcome.intent) throw new WorkspaceConflictError();
  const checkSources = (courseId: string, sourceRefs: SourceRef[]) => {
    if (courseId !== job.courseId || !sourceRefs.length || !jobSourcesCurrent(state, { workspaceId: job.workspaceId, courseId, sourceRefs })) throw new WorkspaceConflictError();
  };
  if (outcome.intent === 'investigate-change') {
    const result = outcome.result;
    if (result.record.workspaceId !== state.id) throw new WorkspaceConflictError();
    checkSources(result.record.courseId, result.record.sourceRefs);
    if (result.selectedLessonId) {
      const selected = result.lesson?.id === result.selectedLessonId ? result.lesson : state.lessons.find(lesson => lesson.id === result.selectedLessonId && lesson.state === 'ready');
      if (!selected) throw new WorkspaceConflictError();
      checkSources(selected.courseId, selected.sourceIds.map(sourceId => ({ sourceId, version: selected.sourceVersions[sourceId] })));
    }
    if (result.lesson) checkSources(result.lesson.courseId, result.lesson.sourceIds.map(sourceId => ({ sourceId, version: result.lesson!.sourceVersions[sourceId] })));
    return publishInvestigation(state, result);
  }
  const prepared = outcome.result;
  checkSources(prepared.lesson.courseId, prepared.lesson.sourceIds.map(sourceId => ({ sourceId, version: prepared.lesson.sourceVersions[sourceId] })));
  if (!state.lessons.some(lesson => lesson.id === prepared.lesson.id)) state.lessons.unshift(prepared.lesson);
  state.runs.unshift(prepared.run);
  return state;
}

/** Every returned value is Firestore-safe, including a decision that does not create a lesson. */
export function preparationReadyPatch(outcome: PreparationOutcome, now = new Date().toISOString()): Partial<PreparationJob> {
  const lessonId = outcome.intent === 'prepare-lesson' ? outcome.result.lesson.id : outcome.result.selectedLessonId;
  return { status: 'ready', ...(lessonId ? { lessonId } : {}), leaseUntil: 0, updatedAt: now,
    notice: outcome.intent === 'prepare-lesson' ? 'A validated lesson preview is ready.' : lessonId ? 'Investigation saved and its selected activity is ready.' : 'Investigation decision saved; no new lesson was needed or published.' };
}

/** Explicit worker invocation. Durable queue/leases exist; scheduling is a separate deployment capability. */
export async function runPreparationJob(account: VerifiedAccount, id: string): Promise<WorkspaceState | null> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new WorkspaceStoreError('Invalid preparation ID.', 400, 'invalid_job');
  const workspace = await readAccountWorkspace(account);
  if (!workspace) throw new WorkspaceStoreError('Private workspace is unavailable.', 404, 'workspace_missing');
  const job = await claimPreparationJob(account, workspace, id);
  if (!job) return null;
  const execution = await runAuditedPublication({ confirmation: 'require', access: { kind: 'account', account }, before: workspace, metadata: { kind: job.intent === 'investigate-change' ? 'investigation' : 'lesson-preparation', trigger: 'source-change', mode: 'live', courseId: job.courseId, model: META_MODEL, engineVersion: job.intent === 'investigate-change' ? ENGINE_VERSION : SPARK_ENGINE_VERSION, promptVersion: job.intent === 'investigate-change' ? ENGINE_VERSION : SPARK_ENGINE_VERSION },
    execute: async audit => {
      if (!inferenceEnabled()) throw new InferenceBudgetError('configured');
      const modelContext = automaticModelContext(workspace);
      if (!jobSourcesCurrent(modelContext, job)) throw new WorkspaceStoreError('Select these current source versions again before automatic preparation.', 422, 'automatic_source_consent');
      const outcome: PreparationOutcome = job.intent === 'investigate-change'
        ? { intent: 'investigate-change', result: await investigateWithSpark(modelContext, { courseId: job.courseId, goal: job.topic, initialSourceIds: [...new Set(job.sourceRefs.map(ref => ref.sourceId))].slice(0, 8) }, { automatic: true, audit }) }
        : { intent: 'prepare-lesson', result: await prepareWithSpark(modelContext, job.courseId, job.topic, { sourceRefs: job.sourceRefs, trigger: 'source-change', audit }) };
      return outcome.intent === 'prepare-lesson' ? { kind: 'lesson' as const, result: outcome.result } : { kind: 'investigation' as const, result: outcome.result };
    },
    publish: async prepared => {
      const outcome: PreparationOutcome = prepared.kind === 'lesson' ? { intent: 'prepare-lesson', result: prepared.result } : { intent: 'investigate-change', result: prepared.result };
      const root = refs(account);
      await root.firestore.runTransaction(async transaction => {
        const document = await transaction.get(root.collection('jobs').doc(job.id));
        if (!document.exists || document.get('ownerId') !== account.uid || document.get('workspaceId') !== workspace.id || document.get('leaseId') !== job.leaseId || document.get('leaseUntil') <= Date.now()) throw new WorkspaceConflictError();
        transaction.update(document.ref, { status: 'checking', updatedAt: new Date().toISOString() });
      });
      const published = await updateAccountWorkspace(account, state => publishPreparationOutcome(state, job, outcome), job.contextRevision, async (transaction, accountRoot) => {
        const document = await transaction.get(accountRoot.collection('jobs').doc(job.id));
        if (!document.exists || document.get('ownerId') !== account.uid || document.get('workspaceId') !== workspace.id || document.get('leaseId') !== job.leaseId || document.get('leaseUntil') <= Date.now() || document.get('status') !== 'checking') throw new WorkspaceConflictError();
        transaction.update(document.ref, preparationReadyPatch(outcome));
      });
      return published;
    },
    onFailure: async error => {
      if (error instanceof InferenceBudgetError) await requeueBudgetBlockedJob(account, job, error);
      else await fail(account, job, error);
    },
  });
  return execution.workspace;
}
