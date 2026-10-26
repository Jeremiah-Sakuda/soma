import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedWorkspace } from '../domain/seed';
import type { WorkspaceState } from '../domain/types';
import { insertManagedWorkspace, readManagedWorkspace, replaceManagedWorkspace, deleteManagedWorkspace } from './firestore';

const TOKEN_RE = /^[a-f0-9]{64}$/;
const MAX_SNAPSHOT_BYTES = 768 * 1024;
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const connections = new Map<string, DatabaseSync>();

export class WorkspaceStoreError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) { super(message); }
}
export class WorkspaceConflictError extends WorkspaceStoreError {
  constructor() { super('This workspace changed. Refresh and try again.', 409, 'revision_conflict'); }
}
export class WorkspaceNotFoundError extends WorkspaceStoreError {
  constructor() { super('This session expired or could not be found. Start a new demo.', 401, 'session_expired'); }
}

export function getPersistenceMode(): 'local-synthetic' | 'firestore' {
  const mode = process.env.SOMA_PERSISTENCE || 'local-synthetic';
  if (mode !== 'firestore' && mode !== 'local-synthetic') throw new WorkspaceStoreError('SOMA_PERSISTENCE must be firestore or local-synthetic.', 503, 'invalid_persistence_configuration');
  if (mode === 'local-synthetic' && process.env.VERCEL) throw new WorkspaceStoreError('Hosted deployments require Firestore persistence.', 503, 'persistent_storage_required');
  return mode;
}

function database() {
  const path = resolve(/* turbopackIgnore: true */ process.env.SOMA_LOCAL_DATABASE_PATH || '.local/soma-demo.sqlite');
  let db = connections.get(path);
  if (!db) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS demo_sessions (
        token_hash TEXT PRIMARY KEY, workspace_id TEXT NOT NULL UNIQUE,
        revision INTEGER NOT NULL, expires_at INTEGER NOT NULL, payload TEXT NOT NULL
      );`);
    connections.set(path, db);
  }
  return db;
}

/** Release handles for graceful shutdown and actual disk-reopen tests. */
export function closeLocalStore() {
  for (const db of connections.values()) db.close();
  connections.clear();
}

function hashToken(token: string): string {
  if (!TOKEN_RE.test(token)) throw new WorkspaceNotFoundError();
  return createHash('sha256').update(token).digest('hex');
}

function serializeSyntheticWorkspace(workspace: WorkspaceState): string {
  if (workspace.mode !== 'demo' || workspace.sources.some(source => source.kind !== 'synthetic')) {
    throw new WorkspaceStoreError('Anonymous demo storage accepts original synthetic material only. Private source ingestion requires the account service.', 422, 'synthetic_only');
  }
  const json = JSON.stringify(workspace);
  if (Buffer.byteLength(json, 'utf8') > MAX_SNAPSHOT_BYTES) throw new WorkspaceStoreError('Demo workspace capacity reached. Start a new demo.', 413, 'workspace_capacity');
  return json;
}

export async function createWorkspace(): Promise<{ workspace: WorkspaceState; token: string }> {
  const token = randomBytes(32).toString('hex');
  const now = new Date();
  const workspace = seedWorkspace(randomUUID(), now);
  workspace.expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  workspace.revision = 0;
  const payload = serializeSyntheticWorkspace(workspace);
  const tokenHash = hashToken(token);
  if (getPersistenceMode() === 'firestore') await insertManagedWorkspace(tokenHash, JSON.parse(payload) as WorkspaceState);
  else {
    const db = database();
    db.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').run(Date.now());
    if (Number(db.prepare('SELECT COUNT(*) AS count FROM demo_sessions').get()?.count) >= 200) throw new WorkspaceStoreError('Demo session capacity reached. Please try again later.', 429, 'session_capacity');
    db.prepare('INSERT INTO demo_sessions (token_hash, workspace_id, revision, expires_at, payload) VALUES (?, ?, ?, ?, ?)').run(tokenHash, workspace.id, workspace.revision, Date.parse(workspace.expiresAt), payload);
  }
  return { workspace, token };
}

/** Only the random session secret authorizes access; a public workspace ID cannot. */
export async function readWorkspace(token: string): Promise<WorkspaceState | null> {
  if (!TOKEN_RE.test(token)) return null;
  const tokenHash = hashToken(token);
  if (getPersistenceMode() === 'firestore') return readManagedWorkspace(tokenHash);
  const db = database();
  db.prepare('DELETE FROM demo_sessions WHERE expires_at <= ?').run(Date.now());
  const row = db.prepare('SELECT payload FROM demo_sessions WHERE token_hash = ? AND expires_at > ?').get(tokenHash, Date.now()) as { payload: string } | undefined;
  return row ? JSON.parse(row.payload) as WorkspaceState : null;
}

/** Optimistic compare-and-swap: async work never holds a database transaction. */
export async function updateWorkspace(token: string, mutator: (workspace: WorkspaceState) => WorkspaceState | Promise<WorkspaceState>, expectedRevision?: number): Promise<WorkspaceState> {
  const current = await readWorkspace(token);
  if (!current) throw new WorkspaceNotFoundError();
  if (expectedRevision !== undefined && current.revision !== expectedRevision) throw new WorkspaceConflictError();
  const next = await mutator(structuredClone(current));
  if (next.id !== current.id || next.mode !== current.mode || next.createdAt !== current.createdAt || next.expiresAt !== current.expiresAt) {
    throw new WorkspaceStoreError('Workspace ownership and lifetime cannot be changed by an action.', 422, 'immutable_workspace');
  }
  next.revision = current.revision + 1;
  const payload = serializeSyntheticWorkspace(next);
  let changed: boolean;
  if (getPersistenceMode() === 'firestore') changed = await replaceManagedWorkspace(hashToken(token), JSON.parse(payload) as WorkspaceState, current.revision);
  else {
    const result = database().prepare('UPDATE demo_sessions SET payload = ?, revision = ? WHERE token_hash = ? AND revision = ? AND expires_at > ?').run(payload, next.revision, hashToken(token), current.revision, Date.now());
    changed = Number(result.changes) === 1;
  }
  if (!changed) throw new WorkspaceConflictError();
  return next;
}

export async function deleteWorkspace(token: string): Promise<void> {
  if (!TOKEN_RE.test(token)) return;
  if (getPersistenceMode() === 'firestore') await deleteManagedWorkspace(hashToken(token));
  else database().prepare('DELETE FROM demo_sessions WHERE token_hash = ?').run(hashToken(token));
}
