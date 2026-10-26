import { createHash, randomBytes } from 'node:crypto';
import type { WorkspaceState, SourceRef } from '../domain/types';
import { assertVerifiedAccount, type VerifiedAccount } from './account';
import { readAccountWorkspace, updateAccountWorkspace } from './account-store';
import { getServerFirestore } from './firebase-config';
import { prepareWithSpark } from './meta';
import { inferenceEnabled } from './budget';
import { WorkspaceConflictError, WorkspaceStoreError } from './store';
import { MODEL_VERSION } from '../domain/lessons';

export type PreparationJob = {
  id: string; ownerId: string; workspaceId: string; courseId: string; topic: string; sourceRefs: SourceRef[];
  status: 'queued' | 'generating' | 'checking' | 'ready' | 'failed' | 'stale';
  createdAt: string; updatedAt: string; attempts: number; contextRevision: number;
  leaseId?: string; leaseUntil?: number; lessonId?: string; notice?: string;
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const LEASE_MS = 120_000;
const MAX_ATTEMPTS = 3;

function refs(account: VerifiedAccount) {
  assertVerifiedAccount(account);
  return getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
}

export function preparationJobId(workspace: WorkspaceState, courseId: string, sourceRefs: SourceRef[], topic: string, contextRevision = workspace.revision): string {
  return digest(JSON.stringify({ workspaceId: workspace.id, courseId, sourceRefs: [...sourceRefs].sort((a, b) => a.sourceId.localeCompare(b.sourceId) || a.version - b.version), topic, contextRevision, modelVersion: MODEL_VERSION }));
}

export function jobSourcesCurrent(workspace: WorkspaceState, job: Pick<PreparationJob, 'workspaceId' | 'courseId' | 'sourceRefs'>): boolean {
  return workspace.id === job.workspaceId && workspace.courses.some(course => course.id === job.courseId) && job.sourceRefs.length > 0 && job.sourceRefs.every(ref => workspace.sources.some(source => source.id === ref.sourceId && source.version === ref.version && source.status === 'current' && source.courseId === job.courseId));
}

export function mayClaimJob(job: PreparationJob, now = Date.now()): boolean {
  return job.attempts < MAX_ATTEMPTS && (job.status === 'queued' || ((job.status === 'generating' || job.status === 'checking') && (job.leaseUntil ?? 0) <= now));
}

export async function enqueuePreparation(account: VerifiedAccount, workspace: WorkspaceState, courseId: string, sourceRefs: SourceRef[], topic: string, contextRevision = workspace.revision): Promise<PreparationJob> {
  const root = refs(account);
  if (topic.length > 300 || !jobSourcesCurrent(workspace, { workspaceId: workspace.id, courseId, sourceRefs })) throw new WorkspaceStoreError('Preparation requires current sources in this course.', 422, 'job_source_scope');
  const id = preparationJobId(workspace, courseId, sourceRefs, topic, contextRevision);
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
    const job: PreparationJob = { id, ownerId: account.uid, workspaceId: workspace.id, courseId, topic, sourceRefs, status: 'queued', createdAt: now, updatedAt: now, attempts: 0, contextRevision };
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

async function fail(account: VerifiedAccount, job: PreparationJob, stale: boolean): Promise<void> {
  const root = refs(account);
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    const document = await transaction.get(root.collection('jobs').doc(job.id));
    if (!metadata.exists || metadata.get('ownerId') !== account.uid || metadata.get('deleted') || metadata.get('workspaceId') !== job.workspaceId || !document.exists || document.get('ownerId') !== account.uid || document.get('leaseId') !== job.leaseId) return;
    transaction.update(document.ref, { status: stale ? 'stale' : 'failed', updatedAt: new Date().toISOString(), leaseUntil: 0, notice: stale ? 'Context changed during preparation. No obsolete lesson was published.' : 'Preparation could not publish a checked lesson. Your imported material is still available.' });
  });
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
    const prepared = await prepareWithSpark(workspace, job.courseId, job.topic);
    const root = refs(account);
    await root.firestore.runTransaction(async transaction => {
      const document = await transaction.get(root.collection('jobs').doc(job.id));
      if (!document.exists || document.get('ownerId') !== account.uid || document.get('workspaceId') !== workspace.id || document.get('leaseId') !== job.leaseId || document.get('leaseUntil') <= Date.now()) throw new WorkspaceConflictError();
      transaction.update(document.ref, { status: 'checking', updatedAt: new Date().toISOString() });
    });
    return await updateAccountWorkspace(account, state => {
      if (!jobSourcesCurrent(state, job)) throw new WorkspaceConflictError();
      for (const [sourceId, version] of Object.entries(prepared.lesson.sourceVersions)) {
        if (!state.sources.some(source => source.id === sourceId && source.version === version && source.courseId === job.courseId && source.status === 'current')) throw new WorkspaceConflictError();
      }
      state.lessons.unshift(prepared.lesson);
      state.runs.unshift(prepared.run);
      return state;
    }, job.contextRevision, async (transaction, accountRoot) => {
      const document = await transaction.get(accountRoot.collection('jobs').doc(job.id));
      if (!document.exists || document.get('ownerId') !== account.uid || document.get('workspaceId') !== workspace.id || document.get('leaseId') !== job.leaseId || document.get('leaseUntil') <= Date.now() || document.get('status') !== 'checking') throw new WorkspaceConflictError();
      transaction.update(document.ref, { status: 'ready', lessonId: prepared.lesson.id, leaseUntil: 0, updatedAt: new Date().toISOString() });
    });
  } catch (error) {
    await fail(account, job, error instanceof WorkspaceConflictError);
    throw error;
  }
}
