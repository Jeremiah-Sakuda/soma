import { createHash, randomBytes } from 'node:crypto';
import type { WorkspaceState, SourceRef, AgentRun } from '../domain/types';
import { assertVerifiedAccount, type VerifiedAccount } from './account';
import { readAccountWorkspace, updateAccountWorkspace } from './account-store';
import { getServerFirestore } from './firebase-config';
import { prepareWithSpark, PreparationError, SPARK_ENGINE_VERSION } from './meta';
import { inferenceEnabled, InferenceBudgetError } from './budget';
import { WorkspaceConflictError, WorkspaceStoreError } from './store';
import { investigateWithSpark, publishInvestigation, InvestigationError, type InvestigationResult } from './investigator';
import { MODEL_VERSION } from '../domain/lessons';

export type PreparationIntent = 'prepare-lesson' | 'investigate-change';
export type PreparationJob = {
  intent?: PreparationIntent;
  id: string; ownerId: string; workspaceId: string; courseId: string; topic: string; sourceRefs: SourceRef[];
  status: 'queued' | 'generating' | 'checking' | 'ready' | 'failed' | 'stale';
  createdAt: string; updatedAt: string; attempts: number; contextRevision: number;
  leaseId?: string; leaseUntil?: number; lessonId?: string; notice?: string; failureRun?: AgentRun;
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;

function refs(account: VerifiedAccount) {
  assertVerifiedAccount(account);
  return getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
}

export function preparationJobId(workspace: WorkspaceState, courseId: string, sourceRefs: SourceRef[], topic: string, contextRevision = workspace.revision, intent: PreparationIntent = 'prepare-lesson'): string {
  return digest(JSON.stringify({ workspaceId: workspace.id, courseId, sourceRefs: [...sourceRefs].sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.version - b.version), topic, contextRevision, modelVersion: MODEL_VERSION, engineVersion: SPARK_ENGINE_VERSION, ...(intent === 'investigate-change' ? { intent } : {}) }));
}

export function jobSourcesCurrent(workspace: WorkspaceState, job: Pick<PreparationJob, 'workspaceId' | 'courseId' | 'sourceRefs'>): boolean {
  return workspace.id === job.workspaceId && workspace.courses.some(course => course.id === job.courseId) && job.sourceRefs.length > 0 && job.sourceRefs.every(ref => workspace.sources.some(source => source.id === ref.sourceId && source.version === ref.version && source.status === 'current' && source.courseId === job.courseId) && !workspace.sources.some(source => source.id === ref.sourceId && source.version > ref.version));
}

export function mayClaimJob(job: PreparationJob, now = Date.now()): boolean {
  return job.attempts < MAX_ATTEMPTS && (job.status === 'queued' || ((job.status === 'generating' || job.status === 'checking') && (job.leaseUntil ?? 0) <= now));
}

export async function enqueuePreparation(account: VerifiedAccount, workspace: WorkspaceState, courseId: string, sourceRefs: SourceRef[], topic: string, contextRevision = workspace.revision, intent: PreparationIntent = 'prepare-lesson'): Promise<PreparationJob> {
  const root = refs(account);
  if (!['prepare-lesson', 'investigate-change'].includes(intent)) throw new WorkspaceStoreError('Unsupported preparation intent.', 422, 'job_intent');
  if (topic.length > 300 || !jobSourcesCurrent(workspace, { workspaceId: workspace.id, courseId, sourceRefs })) throw new WorkspaceStoreError('Preparation requires current sources in this course.', 422, 'job_source_scope');
  const id = preparationJobId(workspace, courseId, sourceRefs, topic, contextRevision, intent);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== workspace.id || metadata.get('deleted')) throw new WorkspaceConflictError();
    const previous = await transaction.get(root.collection('jobs').doc(id));
    if (previous.exists) {
      if (previous.get('ownerId') !== account.uid || previous.get('workspaceId') !== workspace.id) throw new WorkspaceStoreError('Preparation ownership could not be verified.', 403, 'job_owner_mismatch');
      return previous.data() as PreparationJob;
    }
    const active = await transaction.get(root.collection('jobs').where('status', 'in', ['queued', 'generating', 'checking']).limit(5));
    if (active.size >= 5) throw new WorkspaceStoreError('Five preparations are already waiting. Finish one before adding another.', 429, 'job_capacity');
    const now = new Date().toISOString();
    const job: PreparationJob = { id, intent, ownerId: account.uid, workspaceId: workspace.id, courseId, topic, sourceRefs, status: 'queued', createdAt: now, updatedAt: now, attempts: 0, contextRevision };
    transaction.create(root.collection('jobs').doc(id), job);
    return job;
  });
}

export async function listPreparationJobs(account: VerifiedAccount): Promise<Omit<PreparationJob, 'ownerId' | 'leaseId'>[]> {
  const root = refs(account);
  const metadata = await root.get();
  if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('deleted')) return [];
  const snapshot = await root.collection('jobs').orderBy('createdAt', 'desc').limit(50).get();
  return snapshot.docs.filter(document => document.get('ownerId') === account.uid && document.get('workspaceId') === metadata.get('workspaceId')).map(document => {
    const { ownerId: _owner, leaseId: _lease, ...job } = document.data() as PreparationJob;
    return job;
  });
}

export async function claimPreparationJob(account: VerifiedAccount, workspace: WorkspaceState, id: string): Promise<PreparationJob | null> {
  const root = refs(account);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    const document = await transaction.get(root.collection('jobs').doc(id));
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== workspace.id) throw new WorkspaceConflictError();
    if (!document.exists) throw new WorkspaceStoreError('Preparation could not be found.', 404, 'job_missing');
    const job = document.data() as PreparationJob;
    if (job.ownerId !== account.uid || job.workspaceId !== workspace.id) throw new WorkspaceStoreError('Preparation does not belong to this workspace.', 403, 'job_owner_mismatch');
    if (!jobSourcesCurrent(workspace, job)) {
      transaction.update(document.ref, { status: 'stale', updatedAt: new Date().toISOString(), notice: 'Supporting sources changed. Import the current material to prepare a new version.' });
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

async function fail(account: VerifiedAccount, job: PreparationJob, stale: boolean, failureRun?: AgentRun): Promise<void> {
  const root = refs(account);
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    const document = await transaction.get(root.collection('jobs').doc(job.id));
    if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('deleted') || metadata.get('workspaceId') !== job.workspaceId || !document.exists || document.get('ownerId') !== account.uid || document.get('leaseId') !== job.leaseId) return;
    transaction.update(document.ref, { status: stale ? 'stale' : 'failed', updatedAt: new Date().toISOString(), leaseUntil: 0, ...(failureRun ? { failureRun } : {}), notice: stale ? 'Context changed during preparation. No obsolete result was published.' : job.intent === 'investigate-change' ? 'The source investigation did not publish a validated decision. Your imported material is still available.' : 'Preparation could not publish a validated lesson preview. Your imported material is still available.' });
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
  if (!inferenceEnabled()) throw new WorkspaceStoreError('Live preparation is not enabled within the configured budget.', 503, 'inference_unavailable');
  const workspace = await readAccountWorkspace(account);
  if (!workspace) throw new WorkspaceStoreError('Private workspace is unavailable.', 404, 'workspace_missing');
  const job = await claimPreparationJob(account, workspace, id);
  if (!job) return null;
  try {
    const outcome: PreparationOutcome = job.intent === 'investigate-change'
      ? { intent: 'investigate-change', result: await investigateWithSpark(workspace, { courseId: job.courseId, goal: job.topic, initialSourceIds: [...new Set(job.sourceRefs.map(ref => ref.sourceId))].slice(0, 8) }) }
      : { intent: 'prepare-lesson', result: await prepareWithSpark(workspace, job.courseId, job.topic, { sourceRefs: job.sourceRefs, trigger: 'source-change' }) };
    const root = refs(account);
    await root.firestore.runTransaction(async transaction => {
      const document = await transaction.get(root.collection('jobs').doc(job.id));
      if (!document.exists || document.get('ownerId') !== account.uid || document.get('workspaceId') !== workspace.id || document.get('leaseId') !== job.leaseId || document.get('leaseUntil') <= Date.now()) throw new WorkspaceConflictError();
      transaction.update(document.ref, { status: 'checking', updatedAt: new Date().toISOString() });
    });
    return await updateAccountWorkspace(account, state => publishPreparationOutcome(state, job, outcome), job.contextRevision, async (transaction, accountRoot) => {
      const document = await transaction.get(accountRoot.collection('jobs').doc(job.id));
      if (!document.exists || document.get('ownerId') !== account.uid || document.get('workspaceId') !== workspace.id || document.get('leaseId') !== job.leaseId || document.get('leaseUntil') <= Date.now() || document.get('status') !== 'checking') throw new WorkspaceConflictError();
      transaction.update(document.ref, preparationReadyPatch(outcome));
    });
  } catch (error) {
    if (error instanceof InferenceBudgetError) await requeueBudgetBlockedJob(account, job, error);
    else await fail(account, job, error instanceof WorkspaceConflictError, error instanceof PreparationError || error instanceof InvestigationError ? error.run : undefined);
    throw error;
  }
}
