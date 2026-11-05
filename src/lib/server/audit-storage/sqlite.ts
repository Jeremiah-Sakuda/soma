import { createHash } from 'node:crypto';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
// Static import is required by the serverless bundler, even though production
// selects Firestore. This adapter accepts anonymous synthetic sessions only.
import { DatabaseSync } from 'node:sqlite';
import type { AuditRun } from '../../domain/audit';
import { WorkspaceNotFoundError } from '../store';
import { readWorkspaceByAccess, type WorkspaceAccess } from '../workspace-access';
import { AUDIT_LIMITS, AuditStoreError, type AuditStorage } from './contract';

const databases = new Map<string, DatabaseSync>();
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
function database() {
  const path = resolve(
    /* turbopackIgnore: true */ process.env.SOMA_LOCAL_DATABASE_PATH || '.local/soma-demo.sqlite',
  );
  let db = databases.get(path);
  if (!db) {
    mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
    db = new DatabaseSync(path);
    chmodSync(path, 0o600);
    db.exec(
      'PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS audit_runs (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, workspace_id TEXT NOT NULL, started_at TEXT NOT NULL, payload TEXT NOT NULL); CREATE INDEX IF NOT EXISTS audit_owner ON audit_runs(token_hash, started_at);',
    );
    databases.set(path, db);
  }
  db.prepare(
    'DELETE FROM audit_runs WHERE NOT EXISTS (SELECT 1 FROM demo_sessions WHERE demo_sessions.token_hash=audit_runs.token_hash AND demo_sessions.expires_at>?)',
  ).run(Date.now());
  return db;
}
export function closeLocalAuditStore() {
  for (const db of databases.values()) db.close();
  databases.clear();
}
function tokenFor(access: WorkspaceAccess) {
  if (access.kind !== 'demo')
    throw new AuditStoreError(
      'Private audit storage requires Firestore.',
      503,
      'audit_storage_unavailable',
    );
  if (!/^[a-f0-9]{64}$/.test(access.token)) throw new WorkspaceNotFoundError();
  return access.token;
}
function authorize(db: DatabaseSync, token: string, workspaceId: string) {
  const row = db
    .prepare('SELECT workspace_id, expires_at FROM demo_sessions WHERE token_hash=?')
    .get(hash(token));
  if (!row || row.workspace_id !== workspaceId || Number(row.expires_at) <= Date.now())
    throw new WorkspaceNotFoundError();
}
function transaction<T>(db: DatabaseSync, operation: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = operation();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export const sqliteAuditStorage: AuditStorage = {
  async create(access, state, run) {
    const token = tokenFor(access);
    // Establish the ordinary store table and authorize the supplied generation.
    const current = await readWorkspaceByAccess(access);
    if (!current || current.id !== state.id) throw new WorkspaceNotFoundError();
    const db = database();
    transaction(db, () => {
      authorize(db, token, state.id);
      if (
        Number(
          db.prepare('SELECT COUNT(*) AS count FROM audit_runs WHERE token_hash=?').get(hash(token))
            ?.count,
        ) >= AUDIT_LIMITS.runs
      )
        throw new AuditStoreError('Audit journal capacity reached.', 429, 'audit_capacity');
      db.prepare(
        'INSERT INTO audit_runs (id,token_hash,workspace_id,started_at,payload) VALUES (?,?,?,?,?)',
      ).run(run.id, hash(token), state.id, run.startedAt, JSON.stringify(run));
    });
  },
  async mutate(access, workspaceId, id, change) {
    const token = tokenFor(access),
      db = database();
    return transaction(db, () => {
      authorize(db, token, workspaceId);
      const row = db
        .prepare('SELECT payload FROM audit_runs WHERE id=? AND token_hash=? AND workspace_id=?')
        .get(id, hash(token), workspaceId);
      if (!row) throw new AuditStoreError('Audit run was not found.', 404, 'audit_not_found');
      const next = change(JSON.parse(String(row.payload)) as AuditRun);
      db.prepare('UPDATE audit_runs SET payload=? WHERE id=?').run(JSON.stringify(next.run), id);
      return next.result;
    });
  },
  async read(access, workspaceId, { runId, after }) {
    const token = tokenFor(access),
      db = database();
    authorize(db, token, workspaceId);
    const rows = runId
      ? db
          .prepare('SELECT payload FROM audit_runs WHERE id=? AND token_hash=? AND workspace_id=?')
          .all(runId, hash(token), workspaceId)
      : after
        ? db
            .prepare(
              'SELECT payload FROM audit_runs WHERE token_hash=? AND workspace_id=? AND (started_at<? OR (started_at=? AND id<?)) ORDER BY started_at DESC,id DESC LIMIT ?',
            )
            .all(hash(token), workspaceId, after[0], after[0], after[1], AUDIT_LIMITS.page + 1)
        : db
            .prepare(
              'SELECT payload FROM audit_runs WHERE token_hash=? AND workspace_id=? ORDER BY started_at DESC,id DESC LIMIT ?',
            )
            .all(hash(token), workspaceId, AUDIT_LIMITS.page + 1);
    return rows.map((row) => JSON.parse(String(row.payload)) as AuditRun);
  },
  async purgeExpiredDemos() {
    return 0;
  },
};
