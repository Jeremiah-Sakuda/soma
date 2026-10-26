import { createHash, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { FieldPath, type DocumentReference } from 'firebase-admin/firestore';
import { auditEventInputSchema, auditRunMetadataSchema, auditFinishSchema, auditRunView, type AuditRun, type AuditRunMetadata, type AuditEventInput, type AuditFinish, type AuditRunView } from '../domain/audit';
import type { WorkspaceState } from '../domain/types';
import { assertVerifiedAccount, assertAccountWorkspaceGeneration, revalidateWorkerAccount } from './account';
import { getServerFirestore } from './firebase-config';
import { getPersistenceMode, WorkspaceStoreError, WorkspaceNotFoundError } from './store';
import { readWorkspaceByAccess, type WorkspaceAccess } from './workspace-access';

export type AuditWriter = { id: string; append(event: AuditEventInput): Promise<void>; finish(patch: AuditFinish): Promise<void> };
export class AuditStoreError extends WorkspaceStoreError {}
const MAX_EVENTS = 100, MAX_RUN_BYTES = 128 * 1024, MAX_RUNS = 5000;
const databases = new Map<string, DatabaseSync>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function localDatabase() {
  const path = resolve(/* turbopackIgnore: true */ process.env.SOMA_LOCAL_DATABASE_PATH || '.local/soma-demo.sqlite');
  let db = databases.get(path);
  if (!db) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 }); db = new DatabaseSync(path); chmodSync(path, 0o600);
    db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS audit_runs (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, workspace_id TEXT NOT NULL, started_at TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS audit_owner ON audit_runs(token_hash, started_at);');
    databases.set(path, db);
  }
  // Expiry and deletion never leave local synthetic audit payloads behind.
  db.prepare('DELETE FROM audit_runs WHERE NOT EXISTS (SELECT 1 FROM demo_sessions WHERE demo_sessions.token_hash=audit_runs.token_hash AND demo_sessions.expires_at>?)').run(Date.now());
  return db;
}
export function closeLocalAuditStore() { for (const db of databases.values()) db.close(); databases.clear(); }
function managedRoot(access: WorkspaceAccess): DocumentReference {
  if (access.kind === 'account') { assertVerifiedAccount(access.account); return getServerFirestore().collection('somaAccounts').doc(hash(access.account.uid)); }
  if (!/^[a-f0-9]{64}$/.test(access.token)) throw new WorkspaceNotFoundError();
  return getServerFirestore().collection('somaDemoSessions').doc(hash(access.token));
}
function checkRoot(access: WorkspaceAccess, data: Record<string, unknown> | undefined, workspaceId: string) {
  if (!data) throw new WorkspaceNotFoundError();
  if (access.kind === 'account') {
    assertVerifiedAccount(access.account); assertAccountWorkspaceGeneration(access.account, workspaceId);
    if (data.deleted || data.ownerId !== access.account.uid || data.workspaceId !== workspaceId) throw new AuditStoreError('Workspace generation is no longer active.', 409, 'audit_generation_changed');
  } else {
    const workspace = data.workspace as WorkspaceState | undefined;
    if (!workspace || workspace.id !== workspaceId || Date.parse(workspace.expiresAt) <= Date.now()) throw new WorkspaceNotFoundError();
  }
}
function checkLocal(db: DatabaseSync, token: string, workspaceId: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new WorkspaceNotFoundError();
  const row = db.prepare('SELECT workspace_id, expires_at FROM demo_sessions WHERE token_hash=?').get(hash(token));
  if (!row || row.workspace_id !== workspaceId || Number(row.expires_at) <= Date.now()) throw new WorkspaceNotFoundError();
}
async function mutate(access: WorkspaceAccess, workspaceId: string, id: string, change: (run: AuditRun) => AuditRun): Promise<void> {
  if (access.kind === 'account') await revalidateWorkerAccount(access.account);
  if (getPersistenceMode() === 'firestore') {
    const root = managedRoot(access), ref = root.collection('auditRuns').doc(id);
    await root.firestore.runTransaction(async transaction => {
      const owner = await transaction.get(root), document = await transaction.get(ref);
      checkRoot(access, owner.data(), workspaceId);
      const run = document.data()?.run as AuditRun | undefined;
      if (!run || run.workspaceId !== workspaceId) throw new AuditStoreError('Audit run was not found.', 404, 'audit_not_found');
      transaction.update(ref, { workspaceId, run: change(run) });
    }, { maxAttempts: 2 });
  } else {
    if (access.kind !== 'demo') throw new AuditStoreError('Private audit storage requires Firestore.', 503, 'audit_storage_unavailable');
    const db = localDatabase(); db.exec('BEGIN IMMEDIATE');
    try {
      checkLocal(db, access.token, workspaceId);
      const row = db.prepare('SELECT payload FROM audit_runs WHERE id=? AND token_hash=? AND workspace_id=?').get(id, hash(access.token), workspaceId);
      if (!row) throw new AuditStoreError('Audit run was not found.', 404, 'audit_not_found');
      db.prepare('UPDATE audit_runs SET payload=? WHERE id=?').run(JSON.stringify(change(JSON.parse(String(row.payload)))), id); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
async function createAuditRunInternal(access: WorkspaceAccess, state: WorkspaceState, metadata: AuditRunMetadata): Promise<AuditWriter> {
  const parsed = auditRunMetadataSchema.safeParse(metadata);
  if (!parsed.success || (parsed.data.courseId && !state.courses.some(course => course.id === parsed.data.courseId))) throw new AuditStoreError('Invalid audit metadata.', 422, 'invalid_audit_metadata');
  const now = new Date().toISOString();
  const run: AuditRun = { ...parsed.data, id: randomUUID(), workspaceId: state.id, contextRevision: state.revision,
    sourceRefs: state.sources.filter(source => !parsed.data.courseId || source.courseId === parsed.data.courseId).slice(0, 200).map(source => ({ sourceId: source.id, version: source.version })),
    ...(state.sources.filter(source => !parsed.data.courseId || source.courseId === parsed.data.courseId).length > 200 ? { sourceRefsTruncated: true } : {}),
    status: 'running', startedAt: now, updatedAt: now, journalRevision: 0, events: [] };
  const refs = new Set(state.sources.map(source => `${source.id}:${source.version}`));
  if (access.kind === 'account') await revalidateWorkerAccount(access.account);
  if (getPersistenceMode() === 'firestore') {
    const root = managedRoot(access), ref = root.collection('auditRuns').doc(run.id);
    await root.firestore.runTransaction(async transaction => {
      const owner = await transaction.get(root); checkRoot(access, owner.data(), state.id);
      const quotaRef = root.collection('auditMetadata').doc('quota');
      const quota = await transaction.get(quotaRef);
      const count = Number(quota.get('count') ?? 0);
      if (count >= MAX_RUNS) throw new AuditStoreError('Audit journal capacity reached.', 429, 'audit_capacity');
      transaction.create(ref, { workspaceId: state.id, run, ...(access.kind === 'demo' ? { expiresAt: new Date(state.expiresAt) } : {}) });
      transaction.set(quotaRef, { workspaceId: state.id, count: count + 1, ...(access.kind === 'demo' ? { expiresAt: new Date(state.expiresAt) } : {}) });
    }, { maxAttempts: 2 });
  } else {
    if (access.kind !== 'demo') throw new AuditStoreError('Private audit storage requires Firestore.', 503, 'audit_storage_unavailable');
    // Ensure the ordinary store has established its table and authorize the token.
    const current = await readWorkspaceByAccess(access); if (!current || current.id !== state.id) throw new WorkspaceNotFoundError();
    const db = localDatabase(); db.exec('BEGIN IMMEDIATE');
    try { checkLocal(db, access.token, state.id);
      if (Number(db.prepare('SELECT COUNT(*) AS count FROM audit_runs WHERE token_hash=?').get(hash(access.token))?.count) >= MAX_RUNS) throw new AuditStoreError('Audit journal capacity reached.', 429, 'audit_capacity');
      db.prepare('INSERT INTO audit_runs (id,token_hash,workspace_id,started_at,payload) VALUES (?,?,?,?,?)').run(run.id, hash(access.token), state.id, now, JSON.stringify(run)); db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
  return { id: run.id,
    async append(event) {
      const parsedEvent = auditEventInputSchema.safeParse(event);
      if (!parsedEvent.success) throw new AuditStoreError('Audit event is invalid.', 422, 'invalid_audit_event');
      const unknownRefs = parsedEvent.data.evidence?.filter(ref => !refs.has(`${ref.sourceId}:${ref.version}`)) ?? [];
      if (unknownRefs.length) {
        // A collector may record a newly persisted version after the initial snapshot.
        // Models cannot grant themselves access to later or invented evidence.
        const fresh = parsed.data.kind === 'source-refresh' && parsedEvent.data.actor === 'application' ? await readWorkspaceByAccess(access) : null;
        if (!fresh || fresh.id !== state.id || unknownRefs.some(ref => !fresh.sources.some(source => source.id === ref.sourceId && source.version === ref.version))) throw new AuditStoreError('Audit event refers to unavailable evidence.', 422, 'invalid_audit_event');
      }
      let capacity = false;
      await mutate(access, state.id, run.id, current => {
        if (current.status !== 'running') throw new AuditStoreError('Audit run is already closed.', 409, 'audit_closed');
        const next: AuditRun = { ...current, updatedAt: new Date().toISOString(), journalRevision: current.journalRevision + 1,
          events: [...current.events, { ...parsedEvent.data, seq: current.events.length + 1, at: new Date().toISOString() }] };
        if (next.events.length > MAX_EVENTS || Buffer.byteLength(JSON.stringify(next)) > MAX_RUN_BYTES) { capacity = true; return { ...current, status: 'interrupted', updatedAt: next.updatedAt, journalRevision: next.journalRevision }; }
        return next;
      });
      if (capacity) throw new AuditStoreError('Audit journal event capacity reached; processing stopped.', 413, 'audit_event_capacity');
    },
    async finish(patch) {
      const parsedFinish = auditFinishSchema.safeParse(patch); if (!parsedFinish.success) throw new AuditStoreError('Invalid audit outcome.', 422, 'invalid_audit_outcome');
      const finishPatch = Object.fromEntries(Object.entries(parsedFinish.data).filter(([, value]) => value !== undefined)) as AuditFinish;
      const hasLesson = Boolean(parsedFinish.data.selectedLessonId || parsedFinish.data.publishedLessonId);
      const fresh = hasLesson || parsedFinish.data.committedRevision !== undefined ? await readWorkspaceByAccess(access) : undefined;
      if (hasLesson && (!fresh || fresh.id !== state.id)) throw new AuditStoreError('Workspace generation is no longer active.', 409, 'audit_generation_changed');
      if (parsedFinish.data.committedRevision !== undefined && (!fresh || fresh.id !== state.id || fresh.revision !== parsedFinish.data.committedRevision)) throw new AuditStoreError('The workspace changed before audit confirmation.', 409, 'audit_context_changed');
      const pins: Pick<AuditRun, 'selectedLessonVersion' | 'publishedLessonVersion' | 'selectedLessonContext' | 'publishedLessonContext'> = {};
      for (const [idKey, versionKey] of [['selectedLessonId', 'selectedLessonVersion'], ['publishedLessonId', 'publishedLessonVersion']] as const) {
        const id = parsedFinish.data[idKey]; if (!id) continue;
        const lesson = fresh?.lessons.find(item => item.id === id && (!parsed.data.courseId || item.courseId === parsed.data.courseId));
        if (!lesson && parsedFinish.data.status !== 'proposed') throw new AuditStoreError('The audit outcome refers to an unavailable activity.', 422, 'invalid_audit_outcome');
        if (lesson) { pins[versionKey] = lesson.version; pins[idKey === 'selectedLessonId' ? 'selectedLessonContext' : 'publishedLessonContext'] = { modelVersion: lesson.modelVersion, sourceVersions: { ...lesson.sourceVersions } }; }
      }
      let capacity = false;
      await mutate(access, state.id, run.id, current => {
        if (current.status !== 'running') {
          if (current.status === parsedFinish.data.status && Object.entries(finishPatch).every(([key, value]) => current[key as keyof AuditRun] === value)) return current;
          throw new AuditStoreError('Audit run is already closed.', 409, 'audit_closed');
        }
        const next = { ...current, ...finishPatch, ...pins, updatedAt: new Date().toISOString(), journalRevision: current.journalRevision + 1 };
        if (Buffer.byteLength(JSON.stringify(next)) > MAX_RUN_BYTES) { capacity = true; return { ...current, status: 'interrupted', updatedAt: next.updatedAt, journalRevision: next.journalRevision }; }
        return next;
      });
      if (capacity) throw new AuditStoreError('Audit outcome capacity reached; confirmation is incomplete.', 413, 'audit_event_capacity');
    },
  };
}
async function readAuditPageInternal(access: WorkspaceAccess, state: WorkspaceState, runId?: string, cursor?: string): Promise<AuditPage> {
  const after = decodeAuditCursor(cursor);
  if (runId && after) throw new AuditStoreError('Choose a run or a history cursor.', 400, 'invalid_audit_cursor');
  if (runId && !/^[a-f0-9-]{36}$/.test(runId)) throw new AuditStoreError('Invalid audit run.', 400, 'invalid_audit_id');
  let runs: AuditRun[];
  if (getPersistenceMode() === 'firestore') {
    const root = managedRoot(access);
    runs = await root.firestore.runTransaction(async transaction => {
      const owner = await transaction.get(root); checkRoot(access, owner.data(), state.id);
      if (runId) { const doc = await transaction.get(root.collection('auditRuns').doc(runId)); return doc.exists ? [doc.get('run') as AuditRun] : []; }
      let query = root.collection('auditRuns').orderBy('run.startedAt', 'desc').orderBy(FieldPath.documentId(), 'desc');
      if (after) query = query.startAfter(after[0], after[1]);
      const docs = await transaction.get(query.limit(31));
      return docs.docs.map(doc => doc.get('run') as AuditRun);
    }, { readOnly: true });
  } else {
    if (access.kind !== 'demo') throw new AuditStoreError('Private audit storage requires Firestore.', 503, 'audit_storage_unavailable');
    const db = localDatabase(); checkLocal(db, access.token, state.id);
    const rows = runId ? db.prepare('SELECT payload FROM audit_runs WHERE id=? AND token_hash=? AND workspace_id=?').all(runId, hash(access.token), state.id) : after ? db.prepare('SELECT payload FROM audit_runs WHERE token_hash=? AND workspace_id=? AND (started_at<? OR (started_at=? AND id<?)) ORDER BY started_at DESC,id DESC LIMIT 31').all(hash(access.token), state.id, after[0], after[0], after[1]) : db.prepare('SELECT payload FROM audit_runs WHERE token_hash=? AND workspace_id=? ORDER BY started_at DESC,id DESC LIMIT 31').all(hash(access.token), state.id);
    runs = rows.map(row => JSON.parse(String(row.payload)) as AuditRun);
  }
  const owned = runs.filter(run => run.workspaceId === state.id), hasMore = owned.length > 30, page = owned.slice(0, 30);
  return { runs: page.map(run => auditRunView(run, state)), ...(hasMore ? { nextCursor: encodeAuditCursor(page[page.length - 1]) } : {}) };
}
export type AuditPage = { runs: AuditRunView[]; nextCursor?: string };
function encodeAuditCursor(run: AuditRun): string { return Buffer.from(JSON.stringify([run.startedAt, run.id])).toString('base64url'); }
function decodeAuditCursor(cursor?: string): [string, string] | undefined {
  if (cursor === undefined) return undefined;
  try {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(cursor)) throw new Error();
    const value: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (!Array.isArray(value) || value.length !== 2 || typeof value[0] !== 'string' || new Date(value[0]).toISOString() !== value[0] || typeof value[1] !== 'string' || !/^[a-f0-9-]{36}$/.test(value[1])) throw new Error();
    return value as [string, string];
  } catch { throw new AuditStoreError('Invalid audit history cursor.', 400, 'invalid_audit_cursor'); }
}
export async function readAuditPage(access: WorkspaceAccess, state: WorkspaceState, cursor?: string): Promise<AuditPage> { return readAuditPageInternal(access, state, undefined, cursor); }
export async function readAuditRuns(access: WorkspaceAccess, state: WorkspaceState, runId?: string): Promise<AuditRunView[]> { return (await readAuditPageInternal(access, state, runId)).runs; }


function auditFailure(error: unknown): AuditStoreError {
  if (error instanceof AuditStoreError) return error;
  const typed = error as { status?: number; code?: string; message?: string };
  const status = typed.status && typed.status >= 400 && typed.status <= 503 ? typed.status : 503;
  return new AuditStoreError(status < 500 ? typed.message ?? 'Audit access is no longer valid.' : 'The audit journal is unavailable. Processing stopped before further decisions.', status, typed.status ? typed.code ?? 'audit_access_failed' : 'audit_storage_failed');
}
/** Journal errors remain distinguishable so callers cannot silently fall back unaudited. */
export async function createAuditRun(access: WorkspaceAccess, state: WorkspaceState, metadata: AuditRunMetadata): Promise<AuditWriter> {
  let writer: AuditWriter;
  try { writer = await auditDeadline(createAuditRunInternal(access, state, metadata)); } catch (error) { throw auditFailure(error); }
  return { id: writer.id,
    async append(event) { try { await auditDeadline(writer.append(event)); } catch (error) { throw auditFailure(error); } },
    async finish(patch) { try { await auditDeadline(writer.finish(patch)); } catch (error) { throw auditFailure(error); } },
  };
}

/** Fail closed after five seconds. A dispatched append may still settle remotely;
 * callers must stop and must not retry assuming no event was stored. The journal
 * is the confirmed prefix, and stale in-progress runs display as interrupted. */
function auditDeadline<T>(operation: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new AuditStoreError('Audit confirmation timed out. Processing stopped; the journal may contain only a confirmed prefix.', 503, 'audit_confirmation_timeout')), 5000); timer.unref?.(); });
  return Promise.race([operation, timeout]).finally(() => clearTimeout(timer));
}

/** Bounded scheduler janitor; expiry checks do not rely on paid/optional TTL.
 * Only anonymous-demo children qualify. Every deletion rechecks expiry and parent. */
async function purgeExpiredDemoAuditDataInternal(limit: number): Promise<number> {
  if (getPersistenceMode() !== 'firestore') return 0;
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new AuditStoreError('Invalid audit cleanup bound.', 422, 'invalid_audit_cleanup');
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
}

export async function purgeExpiredDemoAuditData(limit = 25): Promise<number> {
  try { return await auditDeadline(purgeExpiredDemoAuditDataInternal(limit)); } catch (error) { throw auditFailure(error); }
}
