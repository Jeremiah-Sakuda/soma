import { reconcileLearningGraph } from '../domain/learning-graph';
import { createHash, randomUUID } from 'node:crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import type { WorkspaceState } from '../domain/types';
import { seedEmptyAccountWorkspace } from '../domain/seed';
import { assertVerifiedAccount, assertAccountWorkspaceGeneration, revalidateWorkerAccount, type VerifiedAccount } from './account';
import { getServerFirestore } from './firebase-config';
import { getPersistenceMode, WorkspaceConflictError, WorkspaceStoreError } from './store';

import { compareRecordOrder, retainRecordOrder, type RecordOrder } from './record-order';

type RecordValue = { key: string; order: RecordOrder; value: unknown };
export type AccountRecords = { summary: Record<string, unknown>; groups: Record<string, { kind: 'array' | 'map'; records: Record<string, RecordValue> }> };
type Metadata = { ownerId: string; workspaceId: string; revision: number; summary: Record<string, unknown>; groups: Record<string, 'array' | 'map'>; deleted?: boolean; deletionComplete?: boolean };
// Preserve the persisted rank snapshot separately from the public workspace payload.
const snapshots = new WeakMap<WorkspaceState, AccountRecords>();
const mapGroups = new Set(['assistance', 'savedInputs', 'predictionStates']);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');

/** Each source version, attempt, lesson, interpretation and commitment is a record. */
export function encodeAccountRecords(workspace: WorkspaceState, previous = snapshots.get(workspace)): AccountRecords {
  if (workspace.mode !== 'account') throw new WorkspaceStoreError('Account storage requires an account workspace.', 422, 'account_workspace_required');
  const normalized = JSON.parse(JSON.stringify(workspace)) as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  const groups: AccountRecords['groups'] = {};
  for (const [group, value] of Object.entries(normalized)) {
    const kind = Array.isArray(value) ? 'array' : mapGroups.has(group) && value ? 'map' : null;
    if (!kind) { summary[group] = value; continue; }
    const records: Record<string, RecordValue> = {};
    const entries = kind === 'array' ? (value as unknown[]).map((item, index) => [String(index), item] as const) : Object.entries(value as Record<string, unknown>);
    entries.forEach(([key, item], order) => {
      const withId = item as { id?: string; version?: number } | null;
      // Versions remain distinct. Items without IDs (review history) retain ordered entries.
      const identity = kind === 'array' && withId?.id ? `${withId.id}:${withId.version ?? ''}` : key;
      const recordId = digest(identity);
      if (records[recordId]) throw new WorkspaceStoreError('Duplicate record identity in workspace.', 422, 'duplicate_record');
      if (Buffer.byteLength(JSON.stringify(item), 'utf8') > 256 * 1024) throw new WorkspaceStoreError('An imported record exceeds the storage limit.', 413, 'record_capacity');
      records[recordId] = { key: kind === 'array' ? previous?.groups[group]?.records[recordId]?.key ?? identity : key, order, value: item };
    });
    if (previous?.groups[group]?.kind === kind) retainRecordOrder(records, previous.groups[group].records);
    groups[group] = { kind, records };
  }
  if (Buffer.byteLength(JSON.stringify(summary), 'utf8') > 128 * 1024) throw new WorkspaceStoreError('Workspace metadata capacity reached.', 413, 'workspace_capacity');
  return { summary, groups };
}

export function decodeAccountRecords(encoded: AccountRecords): WorkspaceState {
  const state: Record<string, unknown> = { ...encoded.summary };
  for (const [group, { kind, records }] of Object.entries(encoded.groups)) {
    const ordered = Object.values(records).sort((a, b) => compareRecordOrder(a.order,b.order));
    state[group] = kind === 'array' ? ordered.map(record => record.value) : Object.fromEntries(ordered.map(record => [record.key, record.value]));
  }
  const workspace = state as WorkspaceState;
  snapshots.set(workspace, encoded);
  return workspace;
}

function accountRef(account: VerifiedAccount) {
  assertVerifiedAccount(account);
  if (getPersistenceMode() !== 'firestore') throw new WorkspaceStoreError('Private workspaces require managed Firestore storage.', 503, 'account_storage_unavailable');
  return getServerFirestore().collection('somaAccounts').doc(digest(account.uid));
}

function assertOwner(data: Metadata, account: VerifiedAccount): void {
  if (data.ownerId !== account.uid) throw new WorkspaceStoreError('Workspace ownership could not be verified.', 403, 'owner_mismatch');
  assertAccountWorkspaceGeneration(account, data.workspaceId);
}

async function readRecords(transaction: Transaction, ref: DocumentReference, data: Metadata): Promise<AccountRecords> {
  const encoded: AccountRecords = { summary: data.summary, groups: {} };
  for (const [group, kind] of Object.entries(data.groups)) {
    if (!/^[a-zA-Z]+$/.test(group) || !['array', 'map'].includes(kind)) throw new Error('Invalid record group.');
    const snapshot = await transaction.get(ref.collection(group));
    const records: Record<string, RecordValue> = {};
    for (const document of snapshot.docs) {
      if (document.get('ownerId') !== data.ownerId || document.get('workspaceId') !== data.workspaceId) throw new Error('Record ownership mismatch.');
      records[document.id] = { key: document.get('key'), order: document.get('order'), value: document.get('value') };
    }
    encoded.groups[group] = { kind, records };
  }
  return encoded;
}

export function accountRecordChanges(before: AccountRecords, after: AccountRecords): { group: string; id: string; record: RecordValue | null }[] {
  const changes: { group: string; id: string; record: RecordValue | null }[] = [];
  for (const group of new Set([...Object.keys(before.groups), ...Object.keys(after.groups)])) {
    const old = before.groups[group]?.records ?? {};
    const next = after.groups[group]?.records ?? {};
    for (const id of new Set([...Object.keys(old), ...Object.keys(next)])) {
      if (JSON.stringify(old[id]) !== JSON.stringify(next[id])) changes.push({ group, id, record: next[id] ?? null });
    }
  }
  if (changes.length > 450) throw new WorkspaceStoreError('This change is too large for one atomic update. Import a smaller batch.', 413, 'transaction_capacity');
  return changes;
}

function writeRecords(transaction: Transaction, ref: DocumentReference, account: VerifiedAccount, workspace: WorkspaceState, before: AccountRecords): void {
  const after = encodeAccountRecords(workspace, before);
  for (const change of accountRecordChanges(before, after)) {
    const recordRef = ref.collection(change.group).doc(change.id);
    if (change.record) transaction.set(recordRef, { ...change.record, ownerId: account.uid, workspaceId: workspace.id });
    else transaction.delete(recordRef);
  }
  transaction.set(ref, { ownerId: account.uid, workspaceId: workspace.id, revision: workspace.revision, summary: after.summary, groups: Object.fromEntries(Object.entries(after.groups).map(([group, value]) => [group, value.kind])), updatedAt: new Date() });
}

export async function readAccountWorkspace(account: VerifiedAccount): Promise<WorkspaceState | null> {
  const ref = accountRef(account);
  return ref.firestore.runTransaction(async transaction => {
    const document = await transaction.get(ref);
    if (!document.exists) return null;
    const data = document.data() as Metadata;
    assertOwner(data, account);
    if (data.deleted) return null;
    return decodeAccountRecords(await readRecords(transaction, ref, data));
  }, { readOnly: true });
}

export async function readOrCreateAccountWorkspace(account: VerifiedAccount): Promise<WorkspaceState> {
  const ref = accountRef(account);
  return ref.firestore.runTransaction(async transaction => {
    const document = await transaction.get(ref);
    if (document.exists) {
      const data = document.data() as Metadata;
      assertOwner(data, account);
      if (!data.deleted) return decodeAccountRecords(await readRecords(transaction, ref, data));
      if (!data.deletionComplete) throw new WorkspaceStoreError('Workspace deletion is still in progress.', 409, 'deletion_pending');
    }
    // Scheduled capabilities may only act on their existing generation.
    assertAccountWorkspaceGeneration(account, '');
    const workspace = seedEmptyAccountWorkspace(randomUUID(), new Date());
    writeRecords(transaction, ref, account, workspace, { summary: {}, groups: {} });
    return workspace;
  });
}

export async function updateAccountWorkspace(account: VerifiedAccount, mutator: (workspace: WorkspaceState) => WorkspaceState | Promise<WorkspaceState>, expectedRevision?: number, commitGuard?: (transaction: Transaction, accountRef: DocumentReference) => Promise<void>): Promise<WorkspaceState> {
  const ref = accountRef(account);
  const current = await readAccountWorkspace(account);
  if (!current) throw new WorkspaceStoreError('Create a private workspace before saving changes.', 404, 'workspace_missing');
  if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new WorkspaceConflictError();
  const next = reconcileLearningGraph(current, await mutator(structuredClone(current)));
  if (next.id !== current.id || next.mode !== current.mode || next.createdAt !== current.createdAt || next.expiresAt !== current.expiresAt) throw new WorkspaceStoreError('Workspace identity cannot be changed by an action.', 422, 'immutable_workspace');
  next.revision = current.revision + 1;
  const before = snapshots.get(current)!;
  accountRecordChanges(before, encodeAccountRecords(next, before));
  await revalidateWorkerAccount(account);
  await ref.firestore.runTransaction(async transaction => {
    const document = await transaction.get(ref);
    if (!document.exists) throw new WorkspaceConflictError();
    const data = document.data() as Metadata;
    assertOwner(data, account);
    if (data.deleted || data.workspaceId !== current.id || data.revision !== current.revision) throw new WorkspaceConflictError();
    if (commitGuard) await commitGuard(transaction, ref);
    writeRecords(transaction, ref, account, next, before);
  });
  return next;
}

export async function deleteAccountWorkspace(account: VerifiedAccount, cleanup?: (workspaceId: string) => Promise<void>): Promise<void> {
  const ref = accountRef(account);
  // Every deletion batch checks this generation. Retries can resume safely;
  // an old request cannot erase a subsequently recreated account workspace.
  const generation = await ref.firestore.runTransaction(async transaction => {
    const document = await transaction.get(ref);
    if (!document.exists) return null;
    const data = document.data() as Metadata;
    assertOwner(data, account);
    if (data.deleted && data.deletionComplete) return null;
    const connections = await transaction.get(ref.collection('connections'));
    // Freeze before remote cleanup. Never erase references while an operation still
    // holds a lease, including an interrupted lease that must first be recovered.
    if (connections.docs.some(connection => connection.get('leaseId'))) throw new WorkspaceStoreError('Finish or disconnect the active source connection, then retry deletion.', 409, 'connection_busy');
    if (!cleanup && connections.docs.some(connection => connection.get('status') !== 'disconnected')) throw new WorkspaceStoreError('Connected sources must be cleaned up before deletion.', 409, 'source_cleanup_required');
    if (!data.deleted) transaction.update(ref, { deleted: true, revision: data.revision + 1 });
    return data.workspaceId;
  });
  if (!generation) return;
  // A failed remote deletion leaves the tombstone and encrypted cleanup references
  // intact. Normal connections, publication and recreation remain blocked on retry.
  if (cleanup) await cleanup(generation);
  for (const group of await ref.listCollections()) {
    let remaining = true;
    while (remaining) {
      remaining = await ref.firestore.runTransaction(async transaction => {
        const root = await transaction.get(ref);
        const data = root.data() as Metadata | undefined;
        if (!data || data.workspaceId !== generation || !data.deleted || data.deletionComplete) return false;
        assertOwner(data, account);
        const batch = await transaction.get(group.limit(400));
        for (const document of batch.docs) transaction.delete(document.ref);
        return batch.size === 400;
      });
    }
  }
  await ref.firestore.runTransaction(async transaction => {
    const document = await transaction.get(ref);
    const data = document.data() as Metadata | undefined;
    if (data && data.workspaceId === generation && data.deleted && !data.deletionComplete) {
      assertOwner(data, account);
      transaction.set(ref, { ownerId: account.uid, workspaceId: randomUUID(), revision: data.revision, deleted: true, deletionComplete: true, summary: {}, groups: {} });
    }
  });
}
