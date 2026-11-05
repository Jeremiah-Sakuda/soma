import { createHash } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { deleteApp } from 'firebase-admin/app';
import { vi } from 'vitest';
import type { AuditRun } from '../../src/lib/domain/audit';
import { closeLocalAuditStore } from '../../src/lib/server/audit-store';
import {
  createWorkspace,
  closeLocalStore,
  deleteWorkspace,
  updateWorkspace,
} from '../../src/lib/server/store';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { auditStorageContract, type AuditContractFixture } from './fixtures/audit-storage-contract';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const demo = async () => {
  const session = await createWorkspace();
  return { ...session, access: { kind: 'demo' as const, token: session.token } };
};

auditStorageContract('real SQLite', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'soma-audit-contract-')),
    path = join(dir, 'store.sqlite');
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_LOCAL_DATABASE_PATH', path);
  const own = await demo(),
    other = await demo();
  const sql = <T>(operation: (db: DatabaseSync) => T): T => {
    const db = new DatabaseSync(path);
    try {
      return operation(db);
    } finally {
      db.close();
    }
  };
  return {
    ...own,
    other,
    update: (change) => updateWorkspace(own.token, change),
    async reopen() {
      closeLocalAuditStore();
      closeLocalStore();
    },
    async raw(id) {
      return sql(
        (db) =>
          JSON.parse(
            String(
              db
                .prepare('SELECT payload FROM audit_runs WHERE id=? AND token_hash=?')
                .get(id, hash(own.token))?.payload,
            ),
          ) as AuditRun,
      );
    },
    async seed(runs) {
      sql((db) => {
        db.exec('BEGIN IMMEDIATE');
        for (const run of runs)
          db.prepare(
            'INSERT OR REPLACE INTO audit_runs (id,token_hash,workspace_id,started_at,payload) VALUES (?,?,?,?,?)',
          ).run(run.id, hash(own.token), own.workspace.id, run.startedAt, JSON.stringify(run));
        db.exec('COMMIT');
      });
    },
    async exhaustQuota(run) {
      const prefix = run.id.slice(0, 24);
      sql((db) =>
        db
          .prepare(
            "WITH RECURSIVE slots(n) AS (SELECT 1 UNION ALL SELECT n+1 FROM slots WHERE n<4999) INSERT INTO audit_runs (id,token_hash,workspace_id,started_at,payload) SELECT printf('%s%012x',?,n),?,?,?,json_set(?,'$.id',printf('%s%012x',?,n)) FROM slots",
          )
          .run(
            prefix,
            hash(own.token),
            own.workspace.id,
            run.startedAt,
            JSON.stringify(run),
            prefix,
          ),
      );
    },
    async close() {
      closeLocalAuditStore();
      closeLocalStore();
      vi.unstubAllEnvs();
      rmSync(dir, { recursive: true, force: true });
    },
  } satisfies AuditContractFixture;
});

auditStorageContract(
  'real Firestore',
  async () => {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)
      throw new Error('Real Firebase is required.');
    vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
    const originalFetch = globalThis.fetch,
      noMeta = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        if (
          (input instanceof Request ? input.url : String(input)).startsWith('https://api.meta.ai/')
        )
          throw new Error('Meta calls are forbidden in journal adapter verification.');
        return originalFetch(input, init);
      });
    const created: Awaited<ReturnType<typeof demo>>[] = [];
    try {
      const own = await demo();
      created.push(own);
      const other = await demo();
      created.push(other);
      const root = () => getServerFirestore().collection('somaDemoSessions').doc(hash(own.token));
      return {
        ...own,
        other,
        update: (change) => updateWorkspace(own.token, change),
        async reopen() {
          await deleteApp(getServerApp());
        },
        async raw(id) {
          return (await root().collection('auditRuns').doc(id).get()).get('run') as AuditRun;
        },
        async seed(runs) {
          const batch = getServerFirestore().batch();
          for (const run of runs)
            batch.set(root().collection('auditRuns').doc(run.id), {
              workspaceId: own.workspace.id,
              expiresAt: new Date(own.workspace.expiresAt),
              run,
            });
          await batch.commit();
        },
        async exhaustQuota() {
          await root()
            .collection('auditMetadata')
            .doc('quota')
            .set({
              workspaceId: own.workspace.id,
              count: 5000,
              expiresAt: new Date(own.workspace.expiresAt),
            });
        },
        async close() {
          try {
            for (const item of created) await deleteWorkspace(item.token);
          } finally {
            noMeta.mockRestore();
            vi.unstubAllEnvs();
          }
        },
      } satisfies AuditContractFixture;
    } catch (error) {
      try {
        for (const item of created) await deleteWorkspace(item.token);
      } finally {
        noMeta.mockRestore();
        vi.unstubAllEnvs();
      }
      throw error;
    }
  },
  process.env.SOMA_LIVE_AUDIT_TEST === 'true',
);
