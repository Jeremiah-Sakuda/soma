import { createHash, randomUUID } from 'node:crypto';
import { FieldPath, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import type { AgentRun, WorkspaceAction, WorkspaceState } from '../domain/types';
import { applyAction } from '../domain/learning';
import { MODEL_VERSION } from '../domain/lessons';
import { assertVerifiedAccount, assertAccountWorkspaceGeneration, revalidateWorkerAccount, type VerifiedAccount } from './account';
import { readAccountWorkspace, updateAccountWorkspace } from './account-store';
import { getServerFirestore } from './firebase-config';
import { InferenceBudgetError } from './budget';
import { ENGINE_VERSION, investigateWithSpark, publishInvestigation, InvestigationError, type InvestigationResult } from './investigator';
import { META_MODEL } from './meta-client';
import { WorkspaceConflictError, WorkspaceStoreError } from './store';

export type AdaptationJob = {
  id: string; ownerId: string; workspaceId: string; attemptId: string; lessonId: string; courseId: string; investigationId: string;
  attemptFingerprint: string; sourceFingerprint: string; planFingerprint: string; engineVersion: string;
  status: 'queued' | 'running' | 'ready' | 'failed' | 'stale'; attempts: number;
  createdAt: string; updatedAt: string; nextAttemptAt: number; contextRevision: number;
  leaseId?: string; leaseUntil?: number; failureRun?: AgentRun; notice?: string; selectedLessonId?: string;
};
export type AdaptationSummary = Pick<AdaptationJob, 'id' | 'attemptId' | 'lessonId' | 'status' | 'createdAt' | 'updatedAt' | 'notice' | 'selectedLessonId'>;
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const accountHash = (uid: string) => createHash('sha256').update(uid).digest('hex');
const VERSION = () => `${ENGINE_VERSION}:${META_MODEL}:${MODEL_VERSION}`;
const LEASE_MS = 120_000, MAX_ATTEMPTS = 3;
function rootFor(account: VerifiedAccount) { assertVerifiedAccount(account); return getServerFirestore().collection('somaAccounts').doc(accountHash(account.uid)); }
function sourcesFingerprint(state: WorkspaceState, courseId: string) {
  return hash(state.sources.filter(source => source.courseId === courseId && source.status === 'current').map(source => [source.id, source.version, source.context ?? null, source.relatedSourceIds ?? []]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
}
export function adaptationForAttempt(state: WorkspaceState, ownerId: string, attemptId: string, now = new Date().toISOString()): AdaptationJob | null {
  const attempt = state.attempts.find(item => item.id === attemptId);
  const lesson = state.lessons.find(item => item.id === attempt?.lessonId);
  const investigation = state.investigations?.find(item => item.id === lesson?.diagnosticInvestigationId && item.workspaceId === state.id && item.courseId === lesson.courseId && item.diagnosticLessonId === lesson.id && item.diagnosticPlan);
  if (state.mode !== 'account' || !attempt || attempt.correct !== null || !lesson || attempt.lessonVersion !== lesson.version || !investigation) return null;
  const attemptFingerprint = hash(attempt), engineVersion = VERSION();
  return { id: hash({ workspaceId: state.id, attemptId, attemptFingerprint, engineVersion }), ownerId, workspaceId: state.id, attemptId, lessonId: lesson.id, courseId: lesson.courseId, investigationId: investigation.id,
    attemptFingerprint, sourceFingerprint: sourcesFingerprint(state, lesson.courseId), planFingerprint: hash(investigation.diagnosticPlan), engineVersion,
    status: 'queued', attempts: 0, createdAt: now, updatedAt: now, nextAttemptAt: 0, contextRevision: state.revision,
    notice: 'Response saved. Soma will reconsider the evidence automatically; you can keep studying.' };
}
export function adaptationContextCurrent(state: WorkspaceState, job: AdaptationJob): boolean {
  const current = adaptationForAttempt(state, job.ownerId, job.attemptId);
  const lesson = state.lessons.find(item => item.id === job.lessonId);
  return !!current && state.id === job.workspaceId && current.id === job.id && current.engineVersion === job.engineVersion && current.planFingerprint === job.planFingerprint && current.sourceFingerprint === job.sourceFingerprint
    && state.attempts.filter(item => item.lessonId === job.lessonId).at(-1)?.id === job.attemptId && lesson?.state === 'ready'
    && lesson.sourceIds.every(id => state.sources.some(source => source.id === id && source.courseId === job.courseId && source.version === lesson.sourceVersions[id] && source.status === 'current'));
}
async function writeQueuedJob(transaction: Transaction, root: DocumentReference, job: AdaptationJob) {
  const reference = root.collection('adaptationJobs').doc(job.id), existing = await transaction.get(reference);
  if (existing.exists) {
    if (existing.get('ownerId') !== job.ownerId || existing.get('workspaceId') !== job.workspaceId || existing.get('attemptFingerprint') !== job.attemptFingerprint) throw new WorkspaceConflictError();
    return;
  }
  transaction.create(reference, job);
}
/** The attempt and its outbox entry commit together. A crash cannot save one without the other. */
export async function saveActionWithAdaptation(account: VerifiedAccount, action: WorkspaceAction, expectedRevision?: number): Promise<WorkspaceState> {
  let job: AdaptationJob | null = null;
  return updateAccountWorkspace(account, state => {
    const saved = applyAction(state, action);
    if (action.type === 'attempt') job = adaptationForAttempt(saved, account.uid, saved.attempts.at(-1)!.id);
    return saved;
  }, expectedRevision, async (transaction, root) => { if (job) await writeQueuedJob(transaction, root, job); });
}
/** Repair/retry entry for a saved observation; caller-supplied workspace content is never trusted. */
export async function enqueueAdaptation(account: VerifiedAccount, attemptId: string): Promise<AdaptationJob> {
  const state = await readAccountWorkspace(account);
  const job = state && adaptationForAttempt(state, account.uid, attemptId);
  if (!state || !job || !adaptationContextCurrent(state, job)) throw new WorkspaceStoreError('Use the latest saved diagnostic response with current sources.', 422, 'adaptation_context');
  const root = rootFor(account);
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== state.id || metadata.get('revision') !== state.revision) throw new WorkspaceConflictError();
    await writeQueuedJob(transaction, root, job);
  });
  return job;
}
function summary(job: AdaptationJob): AdaptationSummary { const { id, attemptId, lessonId, status, createdAt, updatedAt, notice, selectedLessonId } = job; return { id, attemptId, lessonId, status, createdAt, updatedAt, ...(notice ? { notice } : {}), ...(selectedLessonId ? { selectedLessonId } : {}) }; }
export async function listAdaptationJobs(account: VerifiedAccount): Promise<AdaptationSummary[]> {
  const root = rootFor(account), metadata = await root.get();
  if (!metadata.exists || metadata.get('deleted')) return [];
  if (metadata.get('ownerId') !== account.uid) throw new WorkspaceConflictError();
  assertAccountWorkspaceGeneration(account, metadata.get('workspaceId'));
  const snapshot = await root.collection('adaptationJobs').orderBy('createdAt', 'desc').limit(30).get();
  return snapshot.docs.filter(doc => doc.get('ownerId') === account.uid && doc.get('workspaceId') === metadata.get('workspaceId')).map(doc => summary(doc.data() as AdaptationJob));
}
export function adaptationClaimable(job: AdaptationJob, now = Date.now()): boolean {
  return job.attempts < MAX_ATTEMPTS && job.nextAttemptAt <= now && (job.status === 'queued' || (job.status === 'running' && (job.leaseUntil ?? 0) <= now));
}
export async function listNextAdaptationJob(account: VerifiedAccount): Promise<{ id: string } | null> {
  const root = rootFor(account), metadata = await root.get();
  if (!metadata.exists || metadata.get('deleted')) return null;
  if (metadata.get('ownerId') !== account.uid) throw new WorkspaceConflictError();
  assertAccountWorkspaceGeneration(account, metadata.get('workspaceId'));
  // Page across active work; deferred or exhausted jobs must not hide an eligible job.
  let cursor: string | undefined;
  for (;;) {
    let query=root.collection('adaptationJobs').where('status','in',['queued','running']).orderBy(FieldPath.documentId()).limit(100);
    if(cursor)query=query.startAfter(cursor);
    const snapshot=await query.get();
    for(const document of snapshot.docs){
      const job=document.data() as AdaptationJob;
      if(job.ownerId!==account.uid||job.workspaceId!==metadata.get('workspaceId'))continue;
      if(adaptationClaimable(job)||(job.status==='running'&&(job.leaseUntil??0)<=Date.now()&&job.attempts>=MAX_ATTEMPTS))return {id:job.id};
    }
    if(snapshot.size<100)return null;
    cursor=snapshot.docs.at(-1)!.id;
  }
}
export async function claimAdaptationJob(account: VerifiedAccount, state: WorkspaceState, id: string): Promise<AdaptationJob | null> {
  if (!/^[a-f0-9]{64}$/.test(id)) throw new WorkspaceStoreError('Invalid adaptation ID.', 400, 'adaptation_id');
  const root = rootFor(account);
  assertAccountWorkspaceGeneration(account,state.id);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root), reference = root.collection('adaptationJobs').doc(id), document = await transaction.get(reference);
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== state.id || metadata.get('revision') !== state.revision) throw new WorkspaceConflictError();
    if (!document.exists) throw new WorkspaceStoreError('Adaptation was not found.', 404, 'adaptation_missing');
    const job = document.data() as AdaptationJob;
    if (job.ownerId !== account.uid || job.workspaceId !== state.id) throw new WorkspaceStoreError('Adaptation does not belong to this workspace.', 403, 'adaptation_owner');
    if (!adaptationContextCurrent(state, job)) { transaction.update(reference, { status: 'stale', notice: 'A newer response or source changed this context. The old follow-up will not replace your current work.', updatedAt: new Date().toISOString() }); return null; }
    if (!adaptationClaimable(job)) { if(job.status==='running'&&(job.leaseUntil??0)<=Date.now()&&job.attempts>=MAX_ATTEMPTS)transaction.update(reference,{status:'failed',leaseUntil:0,updatedAt:new Date().toISOString(),notice:'Follow-up exhausted its bounded recovery attempts. Your original response remains saved.'}); return null; }
    const claimed: AdaptationJob = { ...job, status: 'running', attempts: job.attempts + 1, contextRevision: state.revision, leaseId: randomUUID(), leaseUntil: Date.now() + LEASE_MS, updatedAt: new Date().toISOString() };
    transaction.set(reference, claimed); return claimed;
  });
}
export function publishAdaptation(state: WorkspaceState, job: AdaptationJob, result: InvestigationResult): WorkspaceState {
  if (!adaptationContextCurrent(state, job) || result.record.workspaceId !== job.workspaceId || result.record.courseId !== job.courseId || result.record.supersedesId !== job.investigationId || !result.record.attemptIds?.includes(job.attemptId)) throw new WorkspaceConflictError();
  return publishInvestigation(state, result);
}
async function finishJob(account: VerifiedAccount, job: AdaptationJob, patch: Partial<AdaptationJob>) {
  await revalidateWorkerAccount(account);assertAccountWorkspaceGeneration(account,job.workspaceId);
  const root = rootFor(account);
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root), reference = root.collection('adaptationJobs').doc(job.id), current = await transaction.get(reference);
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== job.workspaceId || !current.exists || current.get('ownerId') !== account.uid || current.get('workspaceId') !== job.workspaceId || current.get('leaseId') !== job.leaseId) return;
    transaction.update(reference, { ...patch, updatedAt: new Date().toISOString(), leaseUntil: 0 });
  });
}
export async function retryAdaptationJob(account: VerifiedAccount, id: string) {
  const state = await readAccountWorkspace(account); if (!state) throw new WorkspaceConflictError();
  const root = rootFor(account);assertAccountWorkspaceGeneration(account,state.id);
  if (!/^[a-f0-9]{64}$/.test(id)) throw new WorkspaceStoreError('Invalid adaptation ID.', 400, 'adaptation_id');
  await root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root), reference = root.collection('adaptationJobs').doc(id), document = await transaction.get(reference);
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid || metadata.get('workspaceId') !== state.id || metadata.get('revision') !== state.revision || !document.exists) throw new WorkspaceConflictError();
    const job = document.data() as AdaptationJob;
    if (job.ownerId !== account.uid || job.workspaceId !== state.id || !adaptationContextCurrent(state, job)) throw new WorkspaceConflictError();
    if (job.status !== 'failed' || job.attempts >= MAX_ATTEMPTS) throw new WorkspaceStoreError('This follow-up cannot be retried now.', 409, 'adaptation_retry');
    transaction.update(reference, { status: 'queued', nextAttemptAt: 0, updatedAt: new Date().toISOString(), notice: 'Follow-up queued again. Your original response is unchanged.' });
  });
}
export function adaptationFailurePatch(current: WorkspaceState | null, job: AdaptationJob, error: unknown, now=Date.now()): Partial<AdaptationJob> {
  const valid=current&&adaptationContextCurrent(current,job);
  const transient=error instanceof WorkspaceConflictError||(error instanceof InvestigationError?/\((network|timeout|http)\)/.test(error.run.effect):[429,500,502,503,504].includes(Number((error as {status?:number})?.status)));
  const retry=valid&&transient&&job.attempts<MAX_ATTEMPTS;
  return {status:!valid?'stale':retry?'queued':'failed',nextAttemptAt:retry?now+Math.min(300_000,30_000*2**(job.attempts-1)):0,...(error instanceof InvestigationError?{failureRun:error.run}:{}),notice:!valid?'A newer response, changed source or deleted workspace invalidated this follow-up. No old result replaced current work.':retry?'Follow-up paused after a temporary interruption and will retry automatically. Your response is saved.':'The follow-up stopped at its bounded model, validation or recovery limit. Your response and current activities are preserved.'};
}
export async function runAdaptationJob(account: VerifiedAccount, id: string): Promise<WorkspaceState | null> {
  const state = await readAccountWorkspace(account); if (!state) throw new WorkspaceConflictError();
  const job = await claimAdaptationJob(account, state, id); if (!job) return null;
  try {
    const result = await investigateWithSpark(state, { courseId: job.courseId, previousInvestigationId: job.investigationId, attemptId: job.attemptId, goal: 'Reconsider the provisional explanations against this actual saved response and its assistance. Choose a supported next activity when useful; keep uncertainty and preserve the original observation.' }, { automatic: true });
    return await updateAccountWorkspace(account, current => publishAdaptation(current, job, result), job.contextRevision, async (transaction, root) => {
      const reference = root.collection('adaptationJobs').doc(job.id), current = await transaction.get(reference);
      if (!current.exists || current.get('ownerId') !== account.uid || current.get('workspaceId') !== job.workspaceId || current.get('leaseId') !== job.leaseId || current.get('status') !== 'running' || current.get('leaseUntil') <= Date.now()) throw new WorkspaceConflictError();
      transaction.update(reference, { status: 'ready', leaseUntil: 0, updatedAt: new Date().toISOString(), ...(result.selectedLessonId ? { selectedLessonId: result.selectedLessonId } : {}), notice: result.selectedLessonId ? 'Soma reconsidered your response. A supported next activity is ready.' : 'Soma reconsidered your response and saved its decision. Your current activities remain available.' });
    });
  } catch (error) {
    if (error instanceof InferenceBudgetError) await finishJob(account, job, { status: 'queued', attempts: Math.max(0, job.attempts - 1), nextAttemptAt: Date.now() + 5 * 60_000, notice: 'Your response is saved. Follow-up is waiting for the configured model allowance; no new model call was made.' });
    else {
      const current = await readAccountWorkspace(account).catch(()=>null);
      await finishJob(account,job,adaptationFailurePatch(current,job,error));
    }
    throw error;
  }
}
