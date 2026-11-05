import { describe, expect, it } from 'vitest';
import { appendFileSync, mkdirSync, chmodSync } from 'node:fs';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { encodeAccountRecords } from '../../src/lib/server/account-store';
import { adaptationFixture } from '../fixtures/adaptation';
import { INVESTIGATION_RESERVATION_USD } from '../../src/lib/server/budget';

/** Opt-in deployed dispatch proof. Original prepared synthetic diagnostic, actual Meta follow-up.
 * Never seeds or reads a real learner account. A prepared plan is not initial live-model evidence. */
describe.skipIf(process.env.SOMA_PRODUCTION_ADAPTATION_TEST !== 'true')(
  'hosted automatic follow-up without a browser',
  () => {
    it(
      'saves a response and automatically publishes a linked live reconsideration',
      { timeout: 170_000, retry: 0 },
      async (context) => {
        const base = 'https://soma-woad-beta.vercel.app',
          db = getServerFirestore(),
          started = Date.now();
        const cap = Number(process.env.META_APP_SPEND_CAP_USD),
          allocation = Number(process.env.META_ALLOCATION_USD);
        expect(cap > 0 && cap <= 2 && allocation === 150).toBe(true);
        if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
          throw new Error('Real services required.');
        const headroom =
          Math.min(cap, allocation * 0.8) -
          Number((await db.doc('somaBudget/global').get()).get('consumed') ?? 0);
        if (headroom < INVESTIGATION_RESERVATION_USD)
          context.skip('Insufficient authorized headroom. No user or model call created.');
        let uid: string | undefined,
          rootId: string | undefined,
          completed = false;
        try {
          const email = `soma-hosted-adaptation-${randomUUID()}@example.invalid`,
            password = randomBytes(24).toString('base64url');
          uid = (await getAuth(getServerApp()).createUser({ email, password })).uid;
          rootId = createHash('sha256').update(uid).digest('hex');
          const fixture = adaptationFixture(`hosted-${randomUUID()}`),
            encoded = encodeAccountRecords(fixture),
            root = db.collection('somaAccounts').doc(rootId),
            batch = db.batch();
          batch.set(root, {
            ownerId: uid,
            workspaceId: fixture.id,
            revision: fixture.revision,
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
                workspaceId: fixture.id,
              });
          await batch.commit();
          const signIn = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: true }),
              signal: AbortSignal.timeout(15_000),
            },
          );
          expect(signIn.status).toBe(200);
          const idToken = (await signIn.json()).idToken;
          const session = await fetch(`${base}/api/auth/session`, {
            method: 'POST',
            headers: { origin: base, 'content-type': 'application/json' },
            body: JSON.stringify({ idToken }),
            signal: AbortSignal.timeout(15_000),
          });
          expect(session.status).toBe(200);
          const cookie = session.headers
            .getSetCookie()
            .find((value) => value.startsWith('soma_account='))
            ?.split(';')[0];
          if (!cookie) throw new Error('Hosted cookie exchange failed.');
          const saved = await fetch(`${base}/api/actions`, {
            method: 'POST',
            headers: { origin: base, cookie, 'content-type': 'application/json' },
            body: JSON.stringify({
              type: 'attempt',
              lessonId: 'original-adaptive-question',
              optionIndex: 1,
            }),
            signal: AbortSignal.timeout(110_000),
          });
          expect(saved.status).toBe(200);
          const response = await saved.json(),
            originalAttempt = response.workspace.attempts.at(-1);
          expect(originalAttempt.correct).toBeNull();
          // Only durable storage is observed. No UI, investigation request, manual worker call or retry starts the job.
          let jobs = await root.collection('adaptationJobs').get();
          const deadline = Date.now() + 105_000;
          while (jobs.docs[0]?.get('status') !== 'ready' && Date.now() < deadline) {
            if (['failed', 'stale'].includes(jobs.docs[0]?.get('status')))
              throw new Error('Hosted follow-up stopped without publication.');
            await new Promise((resolve) => setTimeout(resolve, 2000));
            jobs = await root.collection('adaptationJobs').get();
          }
          expect(jobs.size).toBe(1);
          expect(jobs.docs[0].get('status')).toBe('ready');
          const attempts = await root.collection('attempts').get();
          expect(
            attempts.docs.find((doc) => doc.get('value.id') === originalAttempt.id)?.get('value'),
          ).toEqual(originalAttempt);
          const investigations = await root.collection('investigations').get();
          const record = investigations.docs
            .map((doc) => doc.get('value'))
            .find((record) => record.supersedesId === 'original-adaptation-investigation');
          expect(record?.mode).toBe('live');
          expect(record?.attemptIds).toContain(originalAttempt.id);
          expect(record?.hypothesisRevisions?.length).toBeGreaterThan(0);
          const reservations = await db
            .collection('somaBudgetReservations')
            .where('workspaceId', '==', fixture.id)
            .get();
          expect(reservations.size).toBe(1);
          const cost = reservations.docs[0].get('charged');
          expect(cost).toBeGreaterThan(0);
          expect(cost).toBeLessThanOrEqual(INVESTIGATION_RESERVATION_USD);
          completed = true;
          mkdirSync('.local', { recursive: true });
          const metrics = {
            automaticHostedFollowUp: 'passed',
            elapsedMs: Date.now() - started,
            calls: record.usage.calls,
            costUsd: cost,
            decision: record.decision,
            selectedActivity: Boolean(record.selectedLessonId),
            preparedInitialDiagnostic: true,
          };
          appendFileSync('.local/hosted-adaptation-metrics.jsonl', JSON.stringify(metrics) + '\n', {
            mode: 0o600,
          });
          chmodSync('.local/hosted-adaptation-metrics.jsonl', 0o600);
          console.log(JSON.stringify(metrics));
        } finally {
          if (rootId) await db.recursiveDelete(db.collection('somaAccounts').doc(rootId));
          if (uid) await getAuth(getServerApp()).deleteUser(uid);
          console.log(
            JSON.stringify({ disposableHostedAccountCleanup: 'completed', passed: completed }),
          );
        }
      },
    );
  },
);
