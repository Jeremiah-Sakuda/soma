import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
const background = vi.hoisted(() => ({ callbacks: [] as (() => Promise<void>)[] }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after: (callback: () => Promise<void>) => background.callbacks.push(callback),
}));
import { POST } from '../../src/app/api/actions/route';
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
  enqueueAdaptation,
  listAdaptationJobs,
  runAdaptationJob,
  claimAdaptationJob,
  listNextAdaptationJob,
} from '../../src/lib/server/adaptation-jobs';
import { readAuditRuns } from '../../src/lib/server/audit-store';
import { settleInference } from '../../src/lib/server/budget';
import { adaptationFixture } from '../fixtures/adaptation';
import type { WorkspaceState } from '../../src/lib/domain/types';

// Real disposable Firebase users + Firestore transactions; only Meta transport is scripted.
// No student data, no provider inference, and no billed tokens are used.
describe.skipIf(process.env.SOMA_LIVE_ADAPTATION_TEST !== 'true')(
  'real account adaptation outbox',
  () => {
    it('atomically queues from the action route, survives restart, isolates owners and rejects stale publication', async () => {
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
        throw new Error('Requires real Firebase services.');
      const users: {
        uid: string;
        account?: VerifiedAccount;
        cookie?: string;
        workspaceId?: string;
      }[] = [];
      const originalFetch = globalThis.fetch;
      let providerCalls = 0,
        holdFinal = false,
        release!: () => void,
        arrived!: () => void;
      let held = Promise.resolve(),
        entered = Promise.resolve();
      try {
        for (let index = 0; index < 2; index++) {
          const email = `soma-adaptation-${randomUUID()}@example.invalid`,
            password = randomBytes(24).toString('base64url');
          const user = await getAuth(getServerApp()).createUser({ email, password });
          const record: (typeof users)[number] = { uid: user.uid };
          users.push(record);
          const login = await originalFetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: true }),
            },
          );
          if (!login.ok)
            throw new Error(`Synthetic account authentication failed (${login.status}).`);
          const session = await exchangeAccountSession((await login.json()).idToken);
          record.cookie = `${ACCOUNT_SESSION_COOKIE}=${session.sessionCookie}`;
          record.account = (await verifyAccountSession(
            new Request('https://soma.example', { headers: { cookie: record.cookie } }),
          ))!;
          const initial = await readOrCreateAccountWorkspace(record.account);
          record.workspaceId = initial.id;
          await updateAccountWorkspace(record.account, (current) => {
            const fixture = {
              ...adaptationFixture(current.id),
              createdAt: current.createdAt,
              expiresAt: current.expiresAt,
              revision: current.revision,
            };
            const selected = fixture.lessons[0],
              legacySource = {
                ...fixture.sources.find((item) => item.id === selected.sourceIds[0])!,
                id: 'legacy-unselected-source',
                body: 'UNCONSENTED_BODY_MUST_NOT_REACH_MODEL',
                provenance: undefined,
              };
            fixture.sources.push(legacySource);
            fixture.lessons.push({
              ...selected,
              id: 'legacy-unselected-lesson',
              title: 'UNCONSENTED_LESSON_MUST_NOT_REACH_MODEL',
              sourceIds: [legacySource.id],
              sourceVersions: { [legacySource.id]: legacySource.version },
              diagnosticInvestigationId: 'legacy-unselected-investigation',
            });
            const previous = fixture.investigations![0],
              refs = [
                {
                  sourceId: legacySource.id,
                  version: legacySource.version,
                  quote: legacySource.body,
                },
              ];
            fixture.investigations!.push({
              ...previous,
              id: 'legacy-unselected-investigation',
              sourceRefs: refs,
              diagnosticLessonId: 'legacy-unselected-lesson',
              diagnosticPlan: {
                ...previous.diagnosticPlan!,
                hypotheses: previous.diagnosticPlan!.hypotheses.map((item) => ({
                  ...item,
                  claim: 'UNCONSENTED_HYPOTHESIS_MUST_NOT_REACH_MODEL',
                  evidence: refs,
                })),
              },
            });
            return fixture;
          });
        }
        const [a, b] = users;
        const owner = a.account!,
          other = b.account!;
        const otherBefore = await readAccountWorkspace(other);
        const audits = async (account = owner) =>
          readAuditRuns({ kind: 'account', account }, (await readAccountWorkspace(account))!);
        const submit = async (optionIndex: number, revisionOf?: string) => {
          const response = await POST(
            new Request('https://soma.example/api/actions', {
              method: 'POST',
              headers: {
                cookie: a.cookie!,
                Origin: 'https://soma.example',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'attempt',
                lessonId: 'original-adaptive-question',
                optionIndex,
                ...(revisionOf ? { revisionOf } : {}),
              }),
            }),
          );
          expect(response.status).toBe(200);
          return (await response.json()).workspace as WorkspaceState;
        };
        let saved = await submit(0);
        const original = structuredClone(saved.attempts[0]);
        expect(providerCalls).toBe(0);
        expect(background.callbacks).toHaveLength(1);
        const first = (await listAdaptationJobs(owner))[0];
        expect(first).toMatchObject({ status: 'queued', attemptId: original.id });
        expect((await enqueueAdaptation(owner, original.id)).id).toBe(first.id);
        await deleteApp(getServerApp());
        expect((await readAccountWorkspace(owner))?.attempts[0]).toEqual(original);
        expect(await listAdaptationJobs(other)).toEqual([]);
        expect(await listAdaptationJobs(owner)).toHaveLength(1);
        await expect(
          claimAdaptationJob(other, (await readAccountWorkspace(other))!, first.id),
        ).rejects.toMatchObject({ status: 404 });
        const source = saved.sources.find(
          (item) => item.id === saved.investigations![0].sourceRefs[0].sourceId,
        )!;
        const intercepted = vi
          .spyOn(globalThis, 'fetch')
          .mockImplementation(async (input, init) => {
            const url = input instanceof Request ? input.url : String(input);
            if (url !== 'https://api.meta.ai/v1/responses') return originalFetch(input, init);
            providerCalls++;
            expect(String(init?.body)).not.toContain('UNCONSENTED_');
            const request = JSON.parse(String(init?.body));
            const start = JSON.parse(request.input[0].content);
            const step = request.input.filter(
              (item: { type?: string }) => item.type === 'function_call',
            ).length;
            let name: string, args: unknown;
            if (step === 0) {
              name = 'read_source';
              args = { sourceId: source.id, offset: 0 };
            } else if (step === 1 || step === 2) {
              const hypothesis = start.previous.savedResponse.hypotheses[step - 1];
              name = 'revise_interpretation';
              args = {
                hypothesisId: hypothesis.id,
                status: hypothesis.status,
                attemptId: start.previous.savedResponse.attemptId,
                reason:
                  'The saved response and recorded support constrain this provisional explanation.',
              };
            } else {
              name = 'finish_investigation';
              args = {
                decision: 'keep-current',
                reason:
                  'The original response was considered; retain current practice while uncertainty remains.',
                sourceRefs: [
                  {
                    sourceId: source.id,
                    version: source.version,
                    quote: source.body.slice(0, 100),
                  },
                ],
                assessmentIds: [],
                applicability: 'course',
                conflicts: [],
                selectedLessonIds: [],
              };
              if (holdFinal) {
                arrived();
                await held;
              }
            }
            return new Response(
              JSON.stringify({
                status: 'completed',
                usage: { input_tokens: 0, output_tokens: 0 },
                output: [
                  {
                    type: 'function_call',
                    name,
                    arguments: JSON.stringify({
                      ...(args as Record<string, unknown>),
                      auditRationale:
                        'Check the saved response against the available course evidence.',
                    }),
                    call_id: `synthetic-${providerCalls}`,
                  },
                ],
              }),
              { headers: { 'Content-Type': 'application/json' } },
            );
          });
        try {
          // The real after-response callback dispatches the same durable worker function.
          await background.callbacks.shift()!();
          expect((await listAdaptationJobs(owner))[0]).toMatchObject({ status: 'ready' });
          expect(providerCalls).toBe(4);
          saved = (await readAccountWorkspace(owner))!;
          expect(saved.attempts[0]).toEqual(original);
          expect(saved.investigations?.at(-1)?.attemptIds).toContain(original.id);
          const firstAudit = (await audits())[0];
          expect(firstAudit).toMatchObject({
            kind: 'adaptation',
            trigger: 'diagnostic-response',
            status: 'published',
          });
          expect(
            firstAudit.events.some(
              (event) => event.kind === 'publication' && event.actor === 'application',
            ),
          ).toBe(true);
          expect(
            firstAudit.events.some(
              (event) => event.kind === 'proposal' && event.actor === 'model' && event.rationale,
            ),
          ).toBe(true);
          expect(await audits(other)).toEqual([]);
          const count = providerCalls;
          expect(await runAdaptationJob(owner, first.id)).toBeNull();
          expect(providerCalls).toBe(count);
          saved = await submit(1, original.id);
          const second = (await listAdaptationJobs(owner))[0];
          holdFinal = true;
          held = new Promise<void>((resolve) => {
            release = resolve;
          });
          entered = new Promise<void>((resolve) => {
            arrived = resolve;
          });
          const pending = runAdaptationJob(owner, second.id);
          await entered;
          const liveAudit = (await audits())[0];
          expect(liveAudit.status).toBe('running');
          expect(liveAudit.events.length).toBeGreaterThan(3);
          expect(
            liveAudit.events
              .filter((event) => event.actor === 'model')
              .every((event) => event.protected && !event.rationale),
          ).toBe(true);
          expect(liveAudit.events.map((event) => event.seq)).toEqual(
            liveAudit.events.map((_, index) => index + 1),
          );
          const newer = await submit(2, saved.attempts.at(-1)!.id);
          release();
          await expect(pending).rejects.toMatchObject({ status: 409 });
          expect(
            (await listAdaptationJobs(owner)).find((job) => job.id === second.id)?.status,
          ).toBe('stale');
          expect((await readAccountWorkspace(owner))?.attempts).toEqual(newer.attempts);
          const staleAudit = (await audits())[0];
          expect(staleAudit.status).toBe('failed');
          expect(staleAudit.events.some((event) => event.kind === 'publication')).toBe(false);
          const latest = (await listAdaptationJobs(owner))[0];
          vi.stubEnv('SOMA_LIVE_INFERENCE', 'false');
          const callsBefore = providerCalls;
          await expect(runAdaptationJob(owner, latest.id)).rejects.toMatchObject({
            reason: 'configured',
          });
          const root = getServerFirestore()
            .collection('somaAccounts')
            .doc(createHash('sha256').update(owner.uid).digest('hex'));
          expect(
            (await root.collection('adaptationJobs').doc(latest.id).get()).data(),
          ).toMatchObject({ status: 'queued', attempts: 0 });
          expect(providerCalls).toBe(callsBefore);
          expect((await audits())[0].status).toBe('blocked');
          vi.unstubAllEnvs();
          await root
            .collection('adaptationJobs')
            .doc(latest.id)
            .update({ status: 'running', attempts: 3, leaseUntil: 0, nextAttemptAt: 0 });
          expect(await listNextAdaptationJob(owner)).toEqual({ id: latest.id });
          expect(await runAdaptationJob(owner, latest.id)).toBeNull();
          expect((await listAdaptationJobs(owner))[0].status).toBe('failed');
          // Immediate after() uses an ordinary session capability; disabled users must also stop.
          const beforeDisabled = await submit(0, newer.attempts.at(-1)!.id),
            preDisabled = (await listAdaptationJobs(owner))[0];
          await getAuth(getServerApp()).updateUser(a.uid, { disabled: true });
          const countBeforeDisabled = providerCalls;
          await expect(runAdaptationJob(owner, preDisabled.id)).rejects.toMatchObject({
            code: 'background_account_inactive',
            status: 401,
          });
          expect(providerCalls).toBe(countBeforeDisabled);
          expect((await listAdaptationJobs(owner))[0].status).toBe('failed');
          await getAuth(getServerApp()).updateUser(a.uid, { disabled: false });
          const beforePublication = await submit(1, beforeDisabled.attempts.at(-1)!.id),
            disabledDuring = (await listAdaptationJobs(owner))[0];
          held = new Promise<void>((resolve) => {
            release = resolve;
          });
          entered = new Promise<void>((resolve) => {
            arrived = resolve;
          });
          const disabledPending = runAdaptationJob(owner, disabledDuring.id);
          await entered;
          await getAuth(getServerApp()).updateUser(a.uid, { disabled: true });
          release();
          await expect(disabledPending).rejects.toMatchObject({
            code: 'background_account_inactive',
            status: 401,
          });
          expect((await readAccountWorkspace(owner))!.investigations).toEqual(
            beforePublication.investigations,
          );
          expect((await readAccountWorkspace(owner))!.attempts).toEqual(beforePublication.attempts);
          expect((await listAdaptationJobs(owner))[0].status).toBe('failed');
          await getAuth(getServerApp()).updateUser(a.uid, { disabled: false });
          const originalObservations = structuredClone(
            (await readAccountWorkspace(owner))!.attempts,
          );
          const correction = await POST(
            new Request('https://soma.example/api/actions', {
              method: 'POST',
              headers: {
                cookie: a.cookie!,
                Origin: 'https://soma.example',
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                type: 'correct-learning',
                lessonId: 'original-adaptive-question',
                revisionOf: originalObservations.at(-1)!.id,
                note: 'I interpreted the prompt differently; please reconsider the observation.',
              }),
            }),
          );
          expect(correction.status).toBe(200);
          const correctionState = (await correction.json()).workspace as WorkspaceState,
            corrected = correctionState.attempts.at(-1)!;
          expect(corrected).toMatchObject({
            correct: null,
            responseKind: 'correction',
            correctionOf: originalObservations.at(-1)!.id,
          });
          expect(correctionState.attempts.slice(0, -1)).toEqual(originalObservations);
          expect(
            (await listAdaptationJobs(owner)).some(
              (job) => job.attemptId === corrected.id && job.status === 'queued',
            ),
          ).toBe(true);
          await deleteApp(getServerApp());
          expect((await readAccountWorkspace(owner))!.attempts.at(-1)).toEqual(corrected);
          await deleteAccountWorkspace(owner);
          expect(await listAdaptationJobs(owner)).toEqual([]);
          expect(await readAccountWorkspace(other)).toEqual(otherBefore);
        } finally {
          release?.();
          intercepted.mockRestore();
        }
      } finally {
        vi.unstubAllEnvs();
        background.callbacks = [];
        for (const user of users) {
          if (user.account) await deleteAccountWorkspace(user.account);
          await getServerFirestore().recursiveDelete(
            getServerFirestore()
              .collection('somaAccounts')
              .doc(createHash('sha256').update(user.uid).digest('hex')),
          );
          if (user.workspaceId) {
            const reservations = await getServerFirestore()
              .collection('somaBudgetReservations')
              .where('workspaceId', '==', user.workspaceId)
              .get();
            for (const item of reservations.docs) {
              await settleInference(item.id, 0, true);
              await item.ref.delete();
            } // Transport was fully scripted; these reservations had no provider spend.
            await getServerFirestore()
              .doc(
                `somaBudgetDays/${user.workspaceId}-${new Date().toISOString().slice(0, 10)}-investigation`,
              )
              .delete();
          }
          await getAuth(getServerApp()).deleteUser(user.uid);
        }
      }
    }, 120000);
  },
);
