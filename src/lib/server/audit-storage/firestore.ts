import { createHash } from 'node:crypto';
import { FieldPath, type DocumentReference } from 'firebase-admin/firestore';
import type { AuditRun } from '../../domain/audit';
import type { WorkspaceState } from '../../domain/types';
import { assertVerifiedAccount, assertAccountWorkspaceGeneration, revalidateWorkerAccount } from '../account';
import { getServerFirestore } from '../firebase-config';
import { WorkspaceNotFoundError } from '../store';
import type { WorkspaceAccess } from '../workspace-access';
import { AUDIT_LIMITS, AuditStoreError, type AuditStorage } from './contract';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function rootFor(access: WorkspaceAccess): DocumentReference {
  if (access.kind === 'account') { assertVerifiedAccount(access.account); return getServerFirestore().collection('somaAccounts').doc(hash(access.account.uid)); }
  if (!/^[a-f0-9]{64}$/.test(access.token)) throw new WorkspaceNotFoundError();
  return getServerFirestore().collection('somaDemoSessions').doc(hash(access.token));
}
function authorize(access: WorkspaceAccess, data: Record<string, unknown> | undefined, workspaceId: string) {
  if (!data) throw new WorkspaceNotFoundError();
  if (access.kind === 'account') {
    assertVerifiedAccount(access.account); assertAccountWorkspaceGeneration(access.account, workspaceId);
    if (data.deleted || data.ownerId !== access.account.uid || data.workspaceId !== workspaceId) throw new AuditStoreError('Workspace generation is no longer active.', 409, 'audit_generation_changed');
  } else {
    const workspace = data.workspace as WorkspaceState | undefined;
    if (!workspace || workspace.id !== workspaceId || Date.parse(workspace.expiresAt) <= Date.now()) throw new WorkspaceNotFoundError();
  }
}

export const firestoreAuditStorage: AuditStorage = {
  async create(access, state, run) {
    if (access.kind === 'account') await revalidateWorkerAccount(access.account);
    const root = rootFor(access), ref = root.collection('auditRuns').doc(run.id);
    await root.firestore.runTransaction(async transaction => {
      const owner = await transaction.get(root); authorize(access, owner.data(), state.id);
      const quotaRef = root.collection('auditMetadata').doc('quota'), quota = await transaction.get(quotaRef);
      const count = Number(quota.get('count') ?? 0);
      if (count >= AUDIT_LIMITS.runs) throw new AuditStoreError('Audit journal capacity reached.', 429, 'audit_capacity');
      const expiry = access.kind === 'demo' ? { expiresAt: new Date(state.expiresAt) } : {};
      transaction.create(ref, { workspaceId: state.id, run, ...expiry });
      transaction.set(quotaRef, { workspaceId: state.id, count: count + 1, ...expiry });
    }, { maxAttempts: 2 });
  },
  async mutate(access, workspaceId, id, change) {
    if (access.kind === 'account') await revalidateWorkerAccount(access.account);
    const root = rootFor(access), ref = root.collection('auditRuns').doc(id);
    return root.firestore.runTransaction(async transaction => {
      const owner = await transaction.get(root), document = await transaction.get(ref);
      authorize(access, owner.data(), workspaceId);
      const run = document.data()?.run as AuditRun | undefined;
      if (!run || run.workspaceId !== workspaceId) throw new AuditStoreError('Audit run was not found.', 404, 'audit_not_found');
      const next = change(run);
      transaction.update(ref, { workspaceId, run: next.run });
      return next.result;
    }, { maxAttempts: 2 });
  },
  async read(access, workspaceId, { runId, after }) {
    const root = rootFor(access);
    return root.firestore.runTransaction(async transaction => {
      const owner = await transaction.get(root); authorize(access, owner.data(), workspaceId);
      if (runId) { const doc = await transaction.get(root.collection('auditRuns').doc(runId)); return doc.exists ? [doc.get('run') as AuditRun] : []; }
      let query = root.collection('auditRuns').orderBy('run.startedAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
      if (after) query = query.startAfter(after[0], after[1]);
      const docs = await transaction.get(query.limit(AUDIT_LIMITS.page + 1));
      return docs.docs.map(doc => doc.get('run') as AuditRun);
    }, { readOnly: true });
  },
  /** Existing collection-group expiresAt indexes are required; no paid TTL. */
  async purgeExpiredDemos(limit) {
    const db = getServerFirestore(), now = Date.now();
    const groups = await Promise.all(['auditRuns', 'auditMetadata'].map(group => db.collectionGroup(group).where('expiresAt', '<=', new Date(now)).limit(limit).get()));
    let deleted = 0;
    for (const snapshot of groups.flatMap(group => group.docs)) {
      const parent = snapshot.ref.parent.parent;
      if (!parent || parent.parent.id !== 'somaDemoSessions') continue;
      const removed = await db.runTransaction(async transaction => {
        const [owner, current] = await Promise.all([transaction.get(parent), transaction.get(snapshot.ref)]);
        const expiry = current.get('expiresAt') as { toMillis?: () => number } | undefined;
        if (!current.exists || !expiry?.toMillis || expiry.toMillis() > now) return false;
        const workspace = owner.get('workspace') as WorkspaceState | undefined;
        if (owner.exists && (!workspace || Date.parse(workspace.expiresAt) > now)) return false;
        transaction.delete(snapshot.ref);
        if (owner.exists) transaction.delete(parent);
        return true;
      }, { maxAttempts: 2 });
      if (removed) deleted++;
    }
    return deleted;
  },
};
