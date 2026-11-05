import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { verifyWorkerAccount, type VerifiedAccount } from '../../src/lib/server/account';
import { seedWorkspace, seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import type { WorkspaceState } from '../../src/lib/domain/types';
import { encodeAccountRecords, deleteAccountWorkspace } from '../../src/lib/server/account-store';
import {
  createAuditRun,
  readAuditRuns,
  readAuditPage,
  purgeExpiredDemoAuditData,
} from '../../src/lib/server/audit-store';

describe.skipIf(process.env.SOMA_LIVE_AUDIT_TEST !== 'true')(
  'real Firestore audit ownership and lifecycle',
  () => {
    it('isolates accounts, persists app restart, serializes append, and rejects deleted generations', async () => {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)
        throw new Error('Real Firebase is required.');
      const created: { uid: string; workspace: WorkspaceState; account?: VerifiedAccount }[] = [];
      const secret = randomBytes(32).toString('hex');
      vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
      vi.stubEnv('SOMA_WORKER_SECRET', secret);
      const capability = verifyWorkerRequest(
        new Request('https://soma.example/api/internal/worker', {
          headers: { authorization: `Bearer ${secret}` },
        }),
      );
      const originalFetch = globalThis.fetch,
        noMeta = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
          if (
            (input instanceof Request ? input.url : String(input)).startsWith(
              'https://api.meta.ai/',
            )
          )
            throw new Error('Model calls are forbidden in audit persistence verification.');
          return originalFetch(input, init);
        });
      try {
        for (let index = 0; index < 2; index++) {
          const user = await getAuth(getServerApp()).createUser({
            email: `audit-synthetic-${randomUUID()}@example.invalid`,
          });
          const workspace = seedEmptyAccountWorkspace(randomUUID()),
            item: (typeof created)[number] = { uid: user.uid, workspace };
          created.push(item);
          const records = encodeAccountRecords(workspace),
            root = getServerFirestore()
              .collection('somaAccounts')
              .doc(createHash('sha256').update(user.uid).digest('hex'));
          await root.set({
            ownerId: user.uid,
            workspaceId: workspace.id,
            revision: workspace.revision,
            summary: records.summary,
            groups: Object.fromEntries(
              Object.entries(records.groups).map(([name, group]) => [name, group.kind]),
            ),
          });
          item.account = (await verifyWorkerAccount(capability, root.id, workspace.id))!;
          expect(item.account).toBeTruthy();
        }
        const [a, b] = created,
          accessA = { kind: 'account' as const, account: a.account! },
          accessB = { kind: 'account' as const, account: b.account! };
        const run = await createAuditRun(accessA, a.workspace, {
          kind: 'source-refresh',
          trigger: 'Original synthetic Firestore audit check',
          mode: 'synthetic',
        });
        await Promise.all([
          run.append({
            actor: 'application',
            kind: 'started',
            summary: 'Read-only synthetic refresh began.',
            visibility: 'public',
          }),
          run.append({
            actor: 'model',
            kind: 'decision',
            summary: 'No change was proposed.',
            rationale: 'Synthetic source versions were unchanged.',
            visibility: 'protected',
          }),
        ]);
        expect(await readAuditRuns(accessB, b.workspace, run.id)).toEqual([]);
        await expect(readAuditRuns(accessB, a.workspace, run.id)).rejects.toMatchObject({
          code: 'worker_workspace_changed',
        });
        await deleteApp(getServerApp());
        const [reopened] = await readAuditRuns(accessA, a.workspace, run.id);
        expect(reopened.events.map((event) => event.seq)).toEqual([1, 2]);
        expect(reopened.events.find((event) => event.actor === 'model')?.protected).toBe(true);
        await run.finish({ status: 'unchanged' });
        expect(
          (await readAuditRuns(accessA, a.workspace, run.id))[0].events.find(
            (event) => event.actor === 'model',
          )?.protected,
        ).toBe(false);
        // Persist an original synthetic same-timestamp semester page through real Firestore.
        const historyRoot = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(a.uid).digest('hex'));
        const historyBatch = getServerFirestore().batch(),
          historyTime = new Date(Date.now() + 1000).toISOString();
        const ids = Array.from({ length: 32 }, () => randomUUID());
        for (const id of ids)
          historyBatch.create(historyRoot.collection('auditRuns').doc(id), {
            workspaceId: a.workspace.id,
            run: { ...reopened, id, startedAt: historyTime, updatedAt: historyTime },
          });
        await historyBatch.commit();
        const firstPage = await readAuditPage(accessA, a.workspace),
          secondPage = await readAuditPage(accessA, a.workspace, firstPage.nextCursor);
        expect(firstPage.runs).toHaveLength(30);
        expect(secondPage.runs).toHaveLength(3);
        expect(secondPage.nextCursor).toBeUndefined();
        expect(firstPage.runs.map((item) => item.id)).toEqual(ids.sort().reverse().slice(0, 30));
        expect(new Set([...firstPage.runs, ...secondPage.runs].map((item) => item.id)).size).toBe(
          33,
        );
        const pending = await createAuditRun(accessA, a.workspace, {
          kind: 'investigation',
          trigger: 'Original synthetic deletion race',
          mode: 'synthetic',
        });
        await deleteAccountWorkspace(a.account!);
        const root = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(a.uid).digest('hex'));
        expect((await root.collection('auditRuns').get()).empty).toBe(true);
        expect((await root.collection('auditMetadata').get()).empty).toBe(true);
        await expect(
          pending.append({
            actor: 'application',
            kind: 'stopped',
            summary: 'Must not resurrect a deleted generation.',
            visibility: 'public',
          }),
        ).rejects.toMatchObject({ status: 409 });
      } finally {
        noMeta.mockRestore();
        for (const item of created) {
          await getServerFirestore().recursiveDelete(
            getServerFirestore()
              .collection('somaAccounts')
              .doc(createHash('sha256').update(item.uid).digest('hex')),
          );
          await getAuth(getServerApp()).deleteUser(item.uid);
        }
        vi.unstubAllEnvs();
      }
    }, 120_000);
    it('cleans expired anonymous children without TTL and preserves current sessions and account journals', async () => {
      const db = getServerFirestore(),
        roots = [
          db
            .collection('somaDemoSessions')
            .doc(createHash('sha256').update(randomUUID()).digest('hex')),
          db
            .collection('somaDemoSessions')
            .doc(createHash('sha256').update(randomUUID()).digest('hex')),
          db
            .collection('somaAccounts')
            .doc(createHash('sha256').update(randomUUID()).digest('hex')),
        ];
      const past = new Date(Date.now() - 60_000),
        future = new Date(Date.now() + 60_000);
      try {
        for (let index = 0; index < roots.length; index++) {
          const workspace = seedWorkspace(randomUUID());
          workspace.expiresAt = (index === 0 ? past : future).toISOString();
          await roots[index].set({ workspace, workspaceId: workspace.id, revision: 0 });
          await roots[index]
            .collection('auditRuns')
            .doc('original-synthetic-cleanup')
            .set({ expiresAt: past, workspaceId: workspace.id });
        }
        await roots[0].collection('auditMetadata').doc('quota').set({ expiresAt: past, count: 1 });
        expect(await purgeExpiredDemoAuditData(100)).toBeGreaterThanOrEqual(2);
        expect((await roots[0].get()).exists).toBe(false);
        expect((await roots[0].collection('auditRuns').get()).empty).toBe(true);
        expect((await roots[0].collection('auditMetadata').get()).empty).toBe(true);
        for (const root of roots.slice(1))
          expect((await root.collection('auditRuns').get()).empty).toBe(false);
      } finally {
        for (const root of roots) await db.recursiveDelete(root);
      }
    }, 60_000);
  },
);
