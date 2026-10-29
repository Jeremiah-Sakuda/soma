import { createHash, randomBytes } from 'node:crypto';
import { CredentialCipher, CredentialCryptoError, credentialBinding } from '../credential-crypto';
import type { DocumentReference, Transaction } from 'firebase-admin/firestore';
import { assertVerifiedAccount, assertAccountWorkspaceGeneration, type VerifiedAccount } from '../account';
import { getServerFirestore } from '../firebase-config';
import { WorkspaceStoreError } from '../store';

export type ConnectionStatus = 'connected' | 'login-required' | 'connecting' | 'current' | 'stale' | 'error' | 'disconnected';
export type Connection<Secret = Record<string, unknown>, Configuration = Record<string, unknown>> = {
  id: string; provider: string; workspaceId: string; version: number; status: ConnectionStatus;
  configuration: Configuration; secret: Secret; lastSuccessAt?: string; lastAttemptAt?: string; notice?: string;
};
export type PublicConnection = Omit<Connection, 'secret'>;
type Stored = Omit<Connection, 'secret'> & { ownerId: string; encryptedSecret: string; leaseId?: string; leaseUntil?: number; leasePurpose?: string };
type ConnectionInput<S, C> = Omit<Connection<S, C>, 'id' | 'workspaceId' | 'version'>;
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const binding = credentialBinding;
function cryptoFailure(error: unknown): WorkspaceStoreError {
  if (error instanceof CredentialCryptoError && error.code === 'configuration') return new WorkspaceStoreError('Source connections are not configured.', 503, 'connector_configuration');
  if (error instanceof CredentialCryptoError && error.code === 'capacity') return new WorkspaceStoreError('Connection state is too large.', 413, 'connection_capacity');
  return new WorkspaceStoreError('Saved source authorization could not be opened. Reconnect this source.', 503, 'connection_unavailable');
}
export function encryptConnectionSecret(value: unknown, context: string): string {
  try { return new CredentialCipher().encrypt(value, context); } catch (error) { throw cryptoFailure(error); }
}
export function decryptConnectionSecret<T>(encrypted: string, context: string): T {
  try { return new CredentialCipher().decrypt<T>(encrypted, context); } catch (error) { throw cryptoFailure(error); }
}

function rootRef(account: VerifiedAccount) {
  assertVerifiedAccount(account);
  return getServerFirestore().collection('somaAccounts').doc(hash(account.uid));
}
function checkId(id: string) {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) throw new WorkspaceStoreError('Invalid connection ID.', 400, 'connection_id');
}
function checkRoot(data: Record<string, unknown> | undefined, account: VerifiedAccount, workspaceId?: string): string {
  if (!data || data.deleted || data.ownerId !== account.uid || (workspaceId && data.workspaceId !== workspaceId)) throw new WorkspaceStoreError('This workspace is no longer available.', 409, 'workspace_changed');
  assertAccountWorkspaceGeneration(account, data.workspaceId as string);
  return data.workspaceId as string;
}
function publicConnection(record: Stored): PublicConnection {
  return {id:record.id,provider:record.provider,workspaceId:record.workspaceId,version:record.version,status:record.status,configuration:record.configuration,
    ...(record.lastSuccessAt ? {lastSuccessAt:record.lastSuccessAt}:{}), ...(record.lastAttemptAt ? {lastAttemptAt:record.lastAttemptAt}:{}), ...(record.notice ? {notice:record.notice}:{})};
}
function hydrate<S, C>(record: Stored, account: VerifiedAccount): Connection<S, C> {
  if (record.ownerId !== account.uid) throw new WorkspaceStoreError('Source ownership could not be verified.', 403, 'connection_owner');
  return { ...publicConnection(record), configuration: record.configuration as C, secret: decryptConnectionSecret<S>(record.encryptedSecret, binding(account.uid, record.workspaceId, record.id)) };
}

export async function readConnection<S = Record<string, unknown>, C = Record<string, unknown>>(account: VerifiedAccount, id: string): Promise<Connection<S, C> | null> {
  checkId(id); const root = rootRef(account);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root); const workspaceId = checkRoot(metadata.data(), account);
    const document = await transaction.get(root.collection('connections').doc(id));
    if (!document.exists) return null;
    const record = document.data() as Stored;
    if (record.workspaceId !== workspaceId) throw new WorkspaceStoreError('Saved source belongs to an older workspace.', 409, 'workspace_changed');
    return hydrate<S, C>(record, account);
  }, { readOnly: true });
}

/** Private cleanup path, available only after the account generation was frozen. */
export async function connectionsForDeletion(account: VerifiedAccount, workspaceId: string): Promise<Connection[]> {
  const root = rootRef(account);
  return root.firestore.runTransaction(async transaction => {
    const metadata = (await transaction.get(root)).data();
    if (!metadata || metadata.ownerId !== account.uid || metadata.workspaceId !== workspaceId || !metadata.deleted || metadata.deletionComplete) throw new WorkspaceStoreError('Workspace deletion context changed.', 409, 'workspace_changed');
    assertAccountWorkspaceGeneration(account, workspaceId);
    const documents = await transaction.get(root.collection('connections'));
    return documents.docs.map(document => {
      const record = document.data() as Stored;
      if (record.workspaceId !== workspaceId || record.ownerId !== account.uid || record.leaseId) throw new WorkspaceStoreError('Source cleanup is not ready.', 409, 'connection_changed');
      // Google tokens need no remote browser deletion; do not decrypt them here.
      return ['blackboard','gradescope','piazza'].includes(record.provider) && record.id === `browser-${record.provider}` && record.status !== 'disconnected' ? hydrate(record, account) : null;
    }).filter((record): record is Connection => record !== null);
  }, {readOnly:true});
}

export async function listConnections(account: VerifiedAccount): Promise<PublicConnection[]> {
  const root = rootRef(account);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root); const workspaceId = checkRoot(metadata.data(), account);
    const documents = await transaction.get(root.collection('connections'));
    return documents.docs.filter(document => document.get('ownerId') === account.uid && document.get('workspaceId') === workspaceId).map(document => {
      return publicConnection(document.data() as Stored);
    });
  }, { readOnly: true });
}

export async function saveConnection<S, C>(account: VerifiedAccount, workspaceId: string, id: string, input: ConnectionInput<S, C>, expectedVersion?: number): Promise<Connection<S, C>> {
  checkId(id); const root = rootRef(account);
  const encryptedSecret = encryptConnectionSecret(input.secret, binding(account.uid, workspaceId, id));
  return root.firestore.runTransaction(async transaction => {
    checkRoot((await transaction.get(root)).data(), account, workspaceId);
    const ref = root.collection('connections').doc(id); const current = await transaction.get(ref);
    if (current.exists && (current.get('ownerId') !== account.uid || current.get('workspaceId') !== workspaceId)) throw new WorkspaceStoreError('Source ownership changed.', 409, 'connection_changed');
    if (current.exists && current.get('leaseId')) throw new WorkspaceStoreError('This source is in use. Finish or disconnect it before changing authorization.', 409, 'connection_busy');
    const version = current.exists ? current.get('version') as number : 0;
    if (expectedVersion !== undefined && version !== expectedVersion) throw new WorkspaceStoreError('Source settings changed. Try again.', 409, 'connection_changed');
    const { secret: _secret, ...safe } = input;
    const record = JSON.parse(JSON.stringify({ ...safe, id, workspaceId, ownerId: account.uid, version: version + 1, encryptedSecret }));
    transaction.set(ref, record);
    return hydrate<S, C>(record, account);
  });
}

/** Disconnect removes credentials and invalidates callbacks/leases; metadata tombstone prevents races. */
export async function deleteConnection(account: VerifiedAccount, id: string): Promise<void> {
  checkId(id); const root = rootRef(account);
  await root.firestore.runTransaction(async transaction => {
    const workspaceId = checkRoot((await transaction.get(root)).data(), account);
    const ref = root.collection('connections').doc(id); const previous = await transaction.get(ref);
    transaction.set(ref, { id, provider: previous.get('provider') || id, workspaceId, ownerId: account.uid, version: Number(previous.get('version') || 0) + 1, status: 'disconnected', configuration: {}, encryptedSecret: encryptConnectionSecret({}, binding(account.uid, workspaceId, id)), notice: 'Disconnected. Saved authorization was removed.' });
  });
}

export async function acquireConnectionLease<S = Record<string, unknown>, C = Record<string, unknown>>(account: VerifiedAccount, id: string, purpose: string, ttlMs = 120_000, options: {recoverExpired?: boolean} = {}): Promise<{ connection: Connection<S, C>; leaseId: string }> {
  checkId(id); const root = rootRef(account);
  if (ttlMs < 1000 || ttlMs > 10 * 60_000) throw new Error('Invalid connection lease duration.');
  return root.firestore.runTransaction(async transaction => {
    const workspaceId = checkRoot((await transaction.get(root)).data(), account);
    const ref = root.collection('connections').doc(id); const document = await transaction.get(ref);
    if (!document.exists || document.get('workspaceId') !== workspaceId || document.get('ownerId') !== account.uid || document.get('status') === 'disconnected') throw new WorkspaceStoreError('Connect this source first.', 409, 'connection_missing');
    if (Number(document.get('leaseUntil') || 0) > Date.now() || (options.recoverExpired === false && document.get('leaseId'))) throw new WorkspaceStoreError('This source is already in use. Try again shortly.', 409, 'connection_busy');
    const leaseId = randomBytes(24).toString('hex');
    transaction.update(ref, { leaseId, leaseUntil: Date.now() + ttlMs, leasePurpose: purpose, lastAttemptAt: new Date().toISOString() });
    return { connection: hydrate<S, C>(document.data() as Stored, account), leaseId };
  });
}

export async function releaseConnectionLease<S, C>(account: VerifiedAccount, id: string, leaseId: string, patch: Partial<ConnectionInput<S, C>> = {}): Promise<boolean> {
  checkId(id); const root = rootRef(account);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid) return false;
    assertAccountWorkspaceGeneration(account, metadata.get('workspaceId'));
    const ref = root.collection('connections').doc(id); const document = await transaction.get(ref);
    if (!document.exists || document.get('workspaceId') !== metadata.get('workspaceId') || document.get('ownerId') !== account.uid || document.get('leaseId') !== leaseId) return false;
    const { secret, ...safe } = patch;
    const update = { ...safe, ...(secret !== undefined ? { encryptedSecret: encryptConnectionSecret(secret, binding(account.uid, document.get('workspaceId'), id)) } : {}), leaseId: '', leaseUntil: 0, leasePurpose: '' };
    transaction.update(ref, JSON.parse(JSON.stringify(update)));
    return true;
  });
}

/** Persist newly allocated remote resources before further network calls, retaining the lease. */
export async function checkpointConnectionLease<S, C>(account: VerifiedAccount, id: string, leaseId: string, patch: Partial<ConnectionInput<S, C>>): Promise<boolean> {
  checkId(id); const root = rootRef(account);
  return root.firestore.runTransaction(async transaction => {
    const metadata = await transaction.get(root);
    if (!metadata.exists || metadata.get('deleted') || metadata.get('ownerId') !== account.uid) return false;
    assertAccountWorkspaceGeneration(account, metadata.get('workspaceId'));
    const ref = root.collection('connections').doc(id); const document = await transaction.get(ref);
    if (!document.exists || document.get('workspaceId') !== metadata.get('workspaceId') || document.get('ownerId') !== account.uid || document.get('leaseId') !== leaseId || document.get('leaseUntil') <= Date.now()) return false;
    const { secret, ...safe } = patch;
    const update = { ...safe, ...(secret !== undefined ? { encryptedSecret: encryptConnectionSecret(secret, binding(account.uid, document.get('workspaceId'), id)) } : {}) };
    transaction.update(ref, JSON.parse(JSON.stringify(update)));
    return true;
  });
}

export function connectionPublicationGuard(account: VerifiedAccount, id: string, leaseId: string) {
  assertVerifiedAccount(account); checkId(id);
  return async (transaction: Transaction, root: DocumentReference): Promise<void> => {
    if (root.id !== hash(account.uid)) throw new WorkspaceStoreError('Wrong connection owner.', 403, 'connection_owner');
    const record = await transaction.get(root.collection('connections').doc(id));
    if (!record.exists || record.get('ownerId') !== account.uid || record.get('leaseId') !== leaseId || record.get('leaseUntil') <= Date.now() || record.get('status') === 'disconnected') throw new WorkspaceStoreError('Source authorization changed during collection. Refresh again.', 409, 'connection_changed');
  };
}

export function connectionStateValid(record: { ownerId: string; workspaceId: string; expiresAt: number }, ownerId: string, workspaceId: string, now = Date.now()): boolean {
  return record.ownerId === ownerId && record.workspaceId === workspaceId && Number.isFinite(record.expiresAt) && record.expiresAt > now;
}

export async function createConnectionState<T>(account: VerifiedAccount, workspaceId: string, payload: T): Promise<string> {
  const root = rootRef(account); const state = randomBytes(32).toString('base64url'); const id = hash(state);
  const encrypted = encryptConnectionSecret(payload, binding(account.uid, workspaceId, `state-${id}`));
  await root.firestore.runTransaction(async transaction => {
    checkRoot((await transaction.get(root)).data(), account, workspaceId);
    const active = await transaction.get(root.collection('connectionStates').where('expiresAt', '>', Date.now()).limit(5));
    const expired = await transaction.get(root.collection('connectionStates').where('expiresAt', '<=', Date.now()).limit(20));
    if (active.size >= 5) throw new WorkspaceStoreError('Several authorization windows are already open. Finish one or wait ten minutes.', 429, 'oauth_state_capacity');
    for (const document of expired.docs) transaction.delete(document.ref);
    transaction.create(root.collection('connectionStates').doc(id), { ownerId: account.uid, workspaceId, expiresAt: Date.now() + 10 * 60_000, encrypted });
  });
  return state;
}

export async function consumeConnectionState<T>(account: VerifiedAccount, state: string): Promise<T> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(state)) throw new WorkspaceStoreError('Invalid authorization state. Connect again.', 400, 'oauth_state');
  const root = rootRef(account); const id = hash(state);
  const result = await root.firestore.runTransaction(async transaction => {
    const workspaceId = checkRoot((await transaction.get(root)).data(), account);
    const ref = root.collection('connectionStates').doc(id); const document = await transaction.get(ref);
    if (!document.exists) return null;
    const data = document.data() as { ownerId: string; workspaceId: string; expiresAt: number; encrypted: string };
    if (!connectionStateValid(data, account.uid, workspaceId)) { if (data.ownerId === account.uid) transaction.delete(ref); return null; }
    transaction.delete(ref);
    return decryptConnectionSecret<T>(data.encrypted, binding(account.uid, workspaceId, `state-${id}`));
  });
  if (result === null) throw new WorkspaceStoreError('Authorization expired or was already used. Connect again.', 400, 'oauth_state');
  return result;
}
