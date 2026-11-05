import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { verifyWorkerAccount } from '../../src/lib/server/account';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import {
  encodeAccountRecords,
  deleteAccountWorkspace,
  readAccountWorkspace,
} from '../../src/lib/server/account-store';
import {
  enqueuePreparation,
  claimPreparationJob,
  listNextPreparationJob,
  type PreparationJob,
} from '../../src/lib/server/jobs';

// Real managed transactions, synthetic disposable identity/course only. No provider calls,
// connected-source reads, existing-account writes or model allowance changes.
describe.skipIf(process.env.SOMA_LIVE_QUEUE_RECOVERY_TEST !== 'true')(
  'managed preparation queue recovery',
  () => {
    it('atomically retires obsolete work without bypassing capacity, leases or current revisions', async () => {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)
        throw new Error('Managed Firebase is required.');
      const db = getServerFirestore(),
        uid = `synthetic-queue-${randomUUID()}`;
      const root = db
        .collection('somaAccounts')
        .doc(createHash('sha256').update(uid).digest('hex'));
      const globalBefore = (await db.doc('somaBudget/global').get()).get('consumed');
      const state = seedEmptyAccountWorkspace(
        `synthetic-queue-${randomUUID()}`,
        '2026-10-28T12:00:00.000Z',
      );
      state.revision = 2;
      state.courses = [
        {
          id: 'original-course',
          code: 'SYNTHETIC',
          title: 'Original queue test',
          instructor: '',
          color: '#2244C2',
          deadline: '',
          nextEvent: '',
        },
      ];
      state.sources = [
        {
          id: 'original-source',
          version: 2,
          courseId: 'original-course',
          title: 'Original synthetic note',
          body: 'These invented notes test queue bookkeeping only.',
          kind: 'upload',
          retrievedAt: state.createdAt,
          status: 'current',
        },
      ];
      const originalFetch = globalThis.fetch;
      const noMeta = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
        if (
          (input instanceof Request ? input.url : String(input)).startsWith('https://api.meta.ai/')
        )
          throw new Error('Provider calls are prohibited in this queue test.');
        return originalFetch(input, init);
      });
      const secret = randomBytes(32).toString('hex');
      vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
      vi.stubEnv('SOMA_WORKER_SECRET', secret);
      let account: Awaited<ReturnType<typeof verifyWorkerAccount>> = null;
      const fixture = (id: string, patch: Partial<PreparationJob> = {}): PreparationJob => ({
        id,
        ownerId: uid,
        workspaceId: state.id,
        courseId: 'original-course',
        topic: 'Original queue fixture',
        sourceRefs: [{ sourceId: 'original-source', version: 2 }],
        status: 'queued',
        createdAt: state.createdAt,
        updatedAt: state.createdAt,
        attempts: 0,
        contextRevision: state.revision,
        ...patch,
      });
      const replaceJobs = async (jobs: PreparationJob[]) => {
        const batch = db.batch();
        for (const document of (await root.collection('jobs').get()).docs)
          batch.delete(document.ref);
        for (const job of jobs) batch.set(root.collection('jobs').doc(job.id), job);
        await batch.commit();
      };
      try {
        await getAuth(getServerApp()).createUser({ uid });
        const encoded = encodeAccountRecords(state),
          batch = db.batch();
        batch.set(root, {
          ownerId: uid,
          workspaceId: state.id,
          revision: state.revision,
          summary: encoded.summary,
          groups: Object.fromEntries(
            Object.entries(encoded.groups).map(([name, group]) => [name, group.kind]),
          ),
        });
        for (const [name, group] of Object.entries(encoded.groups))
          for (const [id, record] of Object.entries(group.records))
            batch.set(root.collection(name).doc(id), {
              ...record,
              ownerId: uid,
              workspaceId: state.id,
            });
        await batch.commit();
        const capability = verifyWorkerRequest(
          new Request('https://soma.example/api/internal/worker', {
            headers: { authorization: `Bearer ${secret}` },
          }),
        );
        account = await verifyWorkerAccount(capability, root.id, state.id);
        if (!account) throw new Error('Disposable queue account was not verified.');
        const stale = fixture('0'.repeat(64), {
          sourceRefs: [{ sourceId: 'original-source', version: 1 }],
          createdAt: '2026-10-28T13:00:00.000Z',
          leaseId: 'original-expired-queued-lease',
          leaseUntil: Date.now() - 1,
        });
        const current = Array.from({ length: 4 }, (_, index) => fixture(`${index + 1}`.repeat(64)));
        await replaceJobs([...current, stale]);
        expect(await listNextPreparationJob(account)).toEqual({ id: stale.id });
        const created = await enqueuePreparation(
          account,
          state,
          'original-course',
          [{ sourceId: 'original-source', version: 2 }],
          'New original synthetic request',
        );
        expect((await root.collection('jobs').doc(stale.id).get()).data()).toMatchObject({
          status: 'stale',
          leaseId: '',
          leaseUntil: 0,
        });
        expect(
          (
            await root
              .collection('jobs')
              .where('status', 'in', ['queued', 'generating', 'checking'])
              .get()
          ).size,
        ).toBe(5);
        expect(await listNextPreparationJob(account)).toEqual({ id: current[0].id });
        expect((await readAccountWorkspace(account))!.sources).toEqual(state.sources);
        const late = structuredClone(state);
        late.revision = 1;
        late.sources[0].version = 1;
        await expect(
          enqueuePreparation(
            account,
            late,
            'original-course',
            [{ sourceId: 'original-source', version: 1 }],
            'Late old snapshot',
          ),
        ).rejects.toMatchObject({ status: 409 });
        await expect(claimPreparationJob(account, late, created.id)).rejects.toMatchObject({
          status: 409,
        });
        expect((await root.collection('jobs').doc(created.id).get()).get('status')).toBe('queued');

        // Claim-time stale retirement also revokes an expired legacy lease token;
        // a delayed failure with the previous token cannot match the retired job.
        await root.collection('jobs').doc(stale.id).set(stale);
        expect(await claimPreparationJob(account, state, stale.id)).toBeNull();
        const retiredClaim = (await root.collection('jobs').doc(stale.id).get()).data()!;
        expect(retiredClaim).toMatchObject({ status: 'stale', leaseId: '', leaseUntil: 0 });
        expect(retiredClaim.leaseId).not.toBe(stale.leaseId);

        // A legacy overfull queue must not become six retained active jobs when an
        // early stale document makes a five-document query look artificially small.
        await replaceJobs([...current, fixture('5'.repeat(64)), stale]);
        await expect(
          enqueuePreparation(
            account,
            state,
            'original-course',
            [{ sourceId: 'original-source', version: 2 }],
            'Capacity remains five',
          ),
        ).rejects.toMatchObject({ code: 'job_capacity' });
        expect((await root.collection('jobs').doc(stale.id).get()).get('status')).toBe('queued'); // Entire transaction rolled back.
        expect((await root.collection('jobs').get()).size).toBe(6);

        const leased = {
          ...stale,
          leaseId: 'original-active-lease',
          leaseUntil: Date.now() + 120_000,
        };
        await replaceJobs([...current, leased]);
        await expect(
          enqueuePreparation(
            account,
            state,
            'original-course',
            [{ sourceId: 'original-source', version: 2 }],
            'Cannot steal active queued lease',
          ),
        ).rejects.toMatchObject({ code: 'job_capacity' });
        expect(await claimPreparationJob(account, state, leased.id)).toBeNull();
        expect((await root.collection('jobs').doc(leased.id).get()).data()).toEqual(leased);
        const generating = fixture('6'.repeat(64), {
          ...stale,
          id: '6'.repeat(64),
          status: 'generating',
          leaseUntil: Date.now() - 1,
        });
        const checking = fixture('7'.repeat(64), {
          ...stale,
          id: '7'.repeat(64),
          status: 'checking',
          leaseUntil: Date.now() - 1,
        });
        await replaceJobs([current[0], current[1], generating, checking, leased]);
        await expect(
          enqueuePreparation(
            account,
            state,
            'original-course',
            [{ sourceId: 'original-source', version: 2 }],
            'Cannot retire running statuses',
          ),
        ).rejects.toMatchObject({ code: 'job_capacity' });
        expect((await root.collection('jobs').doc(generating.id).get()).data()).toEqual(generating);
        expect((await root.collection('jobs').doc(checking.id).get()).data()).toEqual(checking);
        expect((await db.doc('somaBudget/global').get()).get('consumed')).toEqual(globalBefore);
      } finally {
        if (account) await deleteAccountWorkspace(account).catch(() => {});
        await db.recursiveDelete(root).catch(() => {});
        await getAuth(getServerApp())
          .deleteUser(uid)
          .catch(() => {});
        noMeta.mockRestore();
        vi.unstubAllEnvs();
      }
    }, 120_000);
  },
);
