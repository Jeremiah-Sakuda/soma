import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import {
  exchangeAccountSession,
  verifyAccountSession,
  ACCOUNT_SESSION_COOKIE,
  type VerifiedAccount,
} from '../../src/lib/server/account';
import {
  readOrCreateAccountWorkspace,
  readAccountWorkspace,
  updateAccountWorkspace,
  deleteAccountWorkspace,
} from '../../src/lib/server/account-store';
import {
  enqueuePreparation,
  listPreparationJobs,
  claimPreparationJob,
  runPreparationJob,
} from '../../src/lib/server/jobs';
import {
  reserveInference,
  settleInference,
  InferenceBudgetError,
} from '../../src/lib/server/budget';
import { importWithAutomation } from '../../src/lib/server/import-automation';
import { applySourceImport, sourceImportSchema } from '../../src/lib/server/imports';

// Explicit live integration only; creates disposable synthetic users, never uses real learner data.
describe.skipIf(process.env.SOMA_LIVE_FIRESTORE_TEST !== 'true')(
  'live Firebase authentication and account isolation',
  () => {
    it('isolates authenticated users, survives connection restart, resolves CAS and deletes private records', async () => {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)
        throw new Error('This check requires real Firebase services.');
      const created: { uid: string; account?: VerifiedAccount }[] = [];
      const budgetFixtures: { id: string; dailyId: string }[] = [];
      try {
        for (let index = 0; index < 2; index++) {
          const email = `soma-integration-${randomUUID()}@example.invalid`;
          const password = randomBytes(24).toString('base64url');
          const user = await getAuth(getServerApp()).createUser({ email, password });
          const record: { uid: string; account?: VerifiedAccount } = { uid: user.uid };
          created.push(record);
          const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: true }),
            },
          );
          if (!response.ok)
            throw new Error(`Synthetic Firebase sign-in failed (${response.status}).`);
          const body = (await response.json()) as { idToken: string };
          const session = await exchangeAccountSession(body.idToken);
          const account = await verifyAccountSession(
            new Request('https://soma.example', {
              headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${session.sessionCookie}` },
            }),
          );
          if (!account || account.uid !== user.uid)
            throw new Error('Synthetic account identity verification failed.');
          record.account = account;
        }
        const a = created[0].account!;
        const b = created[1].account!;
        const first = await readOrCreateAccountWorkspace(a);
        const other = await readOrCreateAccountWorkspace(b);
        expect(first.id).not.toBe(other.id);
        const importInput = sourceImportSchema.parse({
          importId: 'synthetic-import-1',
          expectedRevision: 0,
          sourceKey: 'original-integration-fixture',
          title: 'Original synthetic integration fixture',
          kind: 'course-text',
          text: 'This is synthetic resistor test content, not a student record.',
          course: { id: 'test-course', code: 'TEST', title: 'Synthetic integration course' },
        });
        await updateAccountWorkspace(
          a,
          (workspace) => importWithAutomation(workspace, importInput),
          0,
        );
        expect((await readAccountWorkspace(b))?.sources).toHaveLength(0);
        await deleteApp(getServerApp());
        expect((await readAccountWorkspace(a))?.sources).toHaveLength(1);
        const material = (await readAccountWorkspace(a))!;
        expect(applySourceImport(material, importInput).changed).toBe(false);
        expect(material.importReceipts).toHaveLength(1);
        const sourceRefs = [{ sourceId: material.sources[0].id, version: 1 }];
        const job = await enqueuePreparation(
          a,
          material,
          'test-course',
          sourceRefs,
          'Original synthetic resistor fixture',
        );
        const duplicate = await enqueuePreparation(
          a,
          material,
          'test-course',
          sourceRefs,
          'Original synthetic resistor fixture',
        );
        expect(duplicate.id).toBe(job.id);
        expect(await listPreparationJobs(a)).toHaveLength(1);
        expect(await listPreparationJobs(b)).toHaveLength(0);
        if (process.env.SOMA_LIVE_JOB_BUDGET_TEST === 'true') {
          const reservation = await reserveInference(material.id);
          budgetFixtures.push({
            id: reservation,
            dailyId: `${material.id}-${new Date().toISOString().slice(0, 10)}`,
          });
          await settleInference(reservation, 0, true);
          const originalFetch = globalThis.fetch;
          let metaCalls = 0;
          const guarded = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
            const url = input instanceof Request ? input.url : String(input);
            if (new URL(url).hostname === 'api.meta.ai') {
              metaCalls++;
              throw new Error('No provider calls are allowed in this budget test.');
            }
            return originalFetch(input, init);
          });
          try {
            for (let repeat = 0; repeat < 4; repeat++) {
              const denied = await runPreparationJob(a, job.id).catch((error) => error);
              expect(denied).toBeInstanceOf(InferenceBudgetError);
              expect(denied.reason).toBe('daily');
              const stored = await getServerFirestore()
                .collection('somaAccounts')
                .doc(createHash('sha256').update(a.uid).digest('hex'))
                .collection('jobs')
                .doc(job.id)
                .get();
              expect(stored.data()).toMatchObject({
                status: 'queued',
                attempts: 0,
                leaseId: '',
                leaseUntil: 0,
                ownerId: a.uid,
                notice: expect.stringContaining('no Meta request was made'),
              });
            }
            expect(metaCalls).toBe(0);
            expect(await listPreparationJobs(b)).toEqual([]);
            expect(await readAccountWorkspace(b)).toEqual(other);
            expect(await readAccountWorkspace(a)).toEqual(material);
          } finally {
            guarded.mockRestore();
          }
        }
        const lease = await claimPreparationJob(a, material, job.id);
        expect(lease?.attempts).toBe(1);
        expect(await claimPreparationJob(a, material, job.id)).toBeNull();
        // Original synthetic job only: model execution is deliberately unnecessary for lease recovery.
        const jobRef = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(a.uid).digest('hex'))
          .collection('jobs')
          .doc(job.id);
        await jobRef.update({ leaseUntil: 0 });
        const recovered = await claimPreparationJob(a, material, job.id);
        expect(recovered?.attempts).toBe(2);
        expect(recovered?.leaseId === lease?.leaseId).toBe(false);
        let enter!: () => void;
        let release!: () => void;
        const entered = new Promise<void>((resolve) => {
          enter = resolve;
        });
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const slow = updateAccountWorkspace(
          a,
          async (workspace) => {
            enter();
            await gate;
            workspace.preferences.sessionMinutes = 45;
            return workspace;
          },
          1,
        );
        await entered;
        await updateAccountWorkspace(
          a,
          (workspace) => {
            workspace.preferences.sessionMinutes = 20;
            return workspace;
          },
          1,
        );
        release();
        await expect(slow).rejects.toMatchObject({ status: 409 });
        let publicationEnter!: () => void;
        let publicationRelease!: () => void;
        const publicationEntered = new Promise<void>((resolve) => {
          publicationEnter = resolve;
        });
        const publicationGate = new Promise<void>((resolve) => {
          publicationRelease = resolve;
        });
        const oldPublication = updateAccountWorkspace(
          a,
          async (workspace) => {
            publicationEnter();
            await publicationGate;
            workspace.preferences.sessionMinutes = 90;
            return workspace;
          },
          2,
        );
        await publicationEntered;
        await deleteAccountWorkspace(a);
        expect(await readAccountWorkspace(a)).toBeNull();
        expect((await jobRef.get()).exists).toBe(false);
        const recreated = await readOrCreateAccountWorkspace(a);
        publicationRelease();
        await expect(oldPublication).rejects.toMatchObject({ status: 409 });
        expect(recreated.id).not.toBe(first.id);
        expect(recreated.sources).toHaveLength(0);
        expect((await readAccountWorkspace(b))?.id).toBe(other.id);
      } finally {
        for (const fixture of budgetFixtures) {
          await settleInference(fixture.id, 0, true);
          await getServerFirestore().doc(`somaBudgetReservations/${fixture.id}`).delete();
          await getServerFirestore().doc(`somaBudgetDays/${fixture.dailyId}`).delete();
        }
        for (const record of created) {
          if (record.account) await deleteAccountWorkspace(record.account);
          const accountPath = createHash('sha256').update(record.uid).digest('hex');
          await getServerFirestore().recursiveDelete(
            getServerFirestore().collection('somaAccounts').doc(accountPath),
          );
          await getAuth(getServerApp()).deleteUser(record.uid);
        }
      }
    }, 120_000);
  },
);
