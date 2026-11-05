import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { describe, it } from 'vitest';
import type { AuditRunView } from '../../src/lib/domain/audit';
import type { WorkspaceResponse } from '../../src/lib/domain/types';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { ENGINE_VERSION } from '../../src/lib/server/investigator';
import { INVESTIGATION_RESERVATION_USD } from '../../src/lib/server/budget';

function check(value: unknown, stage: string): asserts value {
  if (!value) throw new Error(`Hosted investigation check failed at ${stage}.`);
}
async function bounded<T>(operation: Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Read timeout.')), milliseconds);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Explicit hosted check using two disposable original synthetic demo sessions; no private accounts or material. */
describe.skipIf(process.env.SOMA_PRODUCTION_INVESTIGATION_TEST !== 'true')(
  'hosted source investigation, persistence and isolation',
  () => {
    it(
      'rejects unauthorized input, persists one no-effect investigation, and reopens it without inference',
      { timeout: 119_000, retry: 0 },
      async (context) => {
        const base = new URL(
          process.env.SOMA_PRODUCTION_BASE_URL || 'https://soma-woad-beta.vercel.app',
        ).origin;
        check(base.startsWith('https://'), 'HTTPS deployment');
        const started = Date.now(),
          deadline = started + 105_000;
        const cookies = ['', ''];
        const workspaceIds: string[] = [];
        const statuses: Record<string, number> = {};
        let stage = 'preflight',
          outcome = 'failed',
          blocked = false,
          failed = false,
          headroom: number | null = null,
          charge: number | null = null,
          reservations = 0,
          modelCalls: number | null = null;
        const cleanup: boolean[] = [false, false];
        const call = (
          path: string,
          method = 'GET',
          body?: unknown,
          session?: number,
          origin = base,
          cleanupRequest = false,
        ) => {
          const remaining = cleanupRequest ? 8000 : deadline - Date.now();
          check(remaining > 0, 'shared deadline');
          return fetch(`${base}${path}`, {
            method,
            redirect: 'error',
            signal: AbortSignal.timeout(
              Math.min(
                remaining,
                method === 'POST' && path === '/api/investigations' ? 95_000 : 10_000,
              ),
            ),
            headers: {
              ...(session !== undefined && cookies[session] ? { Cookie: cookies[session] } : {}),
              ...(method !== 'GET' ? { Origin: origin, 'Content-Type': 'application/json' } : {}),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
          });
        };
        const request = {
          courseId: 'programming',
          initialSourceIds: ['source-programming'],
          goal: 'Review the current Programming course note and existing boundary-check practice. There is no source change or new learner response. Determine whether the current activity still fits the note and retain it when no revision is warranted.',
        };
        const ledger = async (workspaceId: string) =>
          bounded(
            getServerFirestore()
              .collection('somaBudgetReservations')
              .where('workspaceId', '==', workspaceId)
              .get(),
            5000,
          );
        try {
          const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1'),
            allocation = Number(process.env.META_ALLOCATION_USD);
          check(
            cap > 0 && cap <= 2 && allocation > 0 && !process.env.FIRESTORE_EMULATOR_HOST,
            'authorized real budget configuration',
          );
          const noCookie = await call('/api/investigations', 'POST', request);
          statuses.noCookie = noCookie.status;
          check(noCookie.status === 401, 'missing-session rejection');
          stage = 'disposable synthetic sessions';
          const initial: WorkspaceResponse[] = [];
          for (const session of [0, 1]) {
            const response = await call('/api/workspace');
            check(response.status === 200, 'demo workspace creation');
            cookies[session] = response.headers
              .getSetCookie()
              .map((value) => value.split(';')[0])
              .join('; ');
            check(cookies[session], 'in-memory session cookie');
            initial.push((await response.json()) as WorkspaceResponse);
            workspaceIds[session] = initial[session].workspace.id;
            check(
              initial[session].workspace.mode === 'demo' &&
                initial[session].capabilities.persistence === 'firestore',
              'hosted synthetic managed storage',
            );
          }
          check(initial[0].workspace.id !== initial[1].workspace.id, 'distinct session ownership');
          stage = 'zero-inference request boundaries';
          const cross = await call(
            '/api/investigations',
            'POST',
            request,
            0,
            'https://unrelated.example.invalid',
          );
          statuses.crossOrigin = cross.status;
          check(cross.status === 403, 'cross-origin rejection');
          const extra = await call(
            '/api/investigations',
            'POST',
            { ...request, workspaceId: initial[1].workspace.id },
            0,
          );
          statuses.extraWorkspace = extra.status;
          check(extra.status === 400, 'caller-selected workspace rejection');
          const preflightLedgers = await Promise.all([
            ledger(initial[0].workspace.id),
            ledger(initial[1].workspace.id),
          ]);
          check(
            preflightLedgers.every((snapshot) => snapshot.empty),
            'rejected actions have no inference reservations',
          );
          stage = 'application headroom';
          const budget = await bounded(getServerFirestore().doc('somaBudget/global').get(), 5000);
          headroom = Math.min(cap, allocation * 0.8) - Number(budget.data()?.consumed || 0);
          if (headroom < INVESTIGATION_RESERVATION_USD) {
            blocked = true;
            outcome = 'blocked-headroom';
          } else {
            check(initial[0].capabilities.spark, 'hosted inference enabled');
            stage = 'one hosted investigation';
            let settled = false,
              observedRunning = false;
            const pending = call('/api/investigations', 'POST', request, 0).finally(() => {
              settled = true;
            });
            for (let poll = 0; !settled && poll < 20; poll++) {
              const progressResponse = await call('/api/audit', 'GET', undefined, 0);
              check(progressResponse.status === 200, 'owner audit progress access');
              const progress = (await progressResponse.json()) as { runs: AuditRunView[] };
              const running = progress.runs.find(
                (run) => run.kind === 'investigation' && run.status === 'running',
              );
              if (running) {
                observedRunning = true;
                check(
                  running.events
                    .filter((event) => event.actor === 'model')
                    .every((event) => event.protected && !event.rationale),
                  'live model rationale protection',
                );
              }
              if (!settled) await new Promise((resolve) => setTimeout(resolve, 750));
            }
            const investigated = await pending;
            statuses.investigate = investigated.status;
            check(observedRunning, 'durable live progress before completion');
            check(investigated.status === 200, 'investigation HTTP response');
            const saved = (await investigated.json()) as WorkspaceResponse;
            const record = saved.workspace.investigations?.find(
              (item) => item.courseId === 'programming',
            );
            check(
              record?.decision === 'keep-current' &&
                record.mode === 'live' &&
                record.engineVersion === ENGINE_VERSION,
              'persisted no-effect decision',
            );
            const activity = record.toolActivity;
            check(
              activity &&
                activity.some((item) => item.tool === 'read_source') &&
                activity.some((item) => item.tool === 'finish_investigation'),
              'actual source read and completed decision',
            );
            check(
              activity.every((item) =>
                [
                  'list_sources',
                  'read_source',
                  'follow_reference',
                  'finish_investigation',
                ].includes(item.tool),
              ),
              'source-only investigation',
            );
            check(
              JSON.stringify(saved.workspace.lessons) ===
                JSON.stringify(initial[0].workspace.lessons) &&
                JSON.stringify(saved.workspace.attempts) ===
                  JSON.stringify(initial[0].workspace.attempts),
              'no lesson regeneration or evidence mutation',
            );
            check(
              saved.workspace.id === initial[0].workspace.id &&
                saved.workspace.revision > initial[0].workspace.revision,
              'owned durable revision',
            );
            modelCalls = record.usage?.calls ?? null;
            stage = 'hosted audit readback and protected export';
            const auditResponse = await call('/api/audit', 'GET', undefined, 0);
            check(
              auditResponse.status === 200 &&
                /no-store/.test(auditResponse.headers.get('cache-control') ?? ''),
              'private audit readback',
            );
            const audits = (await auditResponse.json()) as { runs: AuditRunView[] };
            const journal = audits.runs.find((run) => run.kind === 'investigation');
            check(
              journal?.status === 'published' &&
                journal.model &&
                journal.engineVersion === ENGINE_VERSION,
              'actual terminal audit metadata',
            );
            check(
              journal.events.some(
                (event) => event.actor === 'application' && event.kind === 'publication',
              ) &&
                journal.events.some(
                  (event) => event.kind === 'usage' && event.usage?.calls === modelCalls,
                ),
              'observed commit and reconciled audit usage',
            );
            check(
              journal.events.some(
                (event) =>
                  event.actor === 'model' &&
                  event.rationaleStatus === 'recorded' &&
                  event.rationale,
              ),
              'actual model stated purpose recorded',
            );
            const exportResponse = await call(
              `/api/audit?runId=${journal.id}&format=json`,
              'GET',
              undefined,
              0,
            );
            check(
              exportResponse.status === 200 &&
                /attachment/.test(exportResponse.headers.get('content-disposition') ?? ''),
              'owner export',
            );
            const exported = (await exportResponse.json()) as {
              run: AuditRunView;
              exportScope: string;
            };
            check(
              exported.exportScope === 'run' &&
                JSON.stringify(exported.run) === JSON.stringify(journal),
              'same protected projection in export',
            );
            check(
              (await call(`/api/audit?runId=${journal.id}`, 'GET', undefined, 1)).status === 404,
              'cross-session journal isolation',
            );
            check(
              (await call(`/api/audit?workspaceId=${saved.workspace.id}`, 'GET', undefined, 1))
                .status === 400 && (await call('/api/audit')).status === 401,
              'no arbitrary owner selection or implicit demo',
            );
            stage = 'hosted readback and reuse';
            const readbackResponse = await call('/api/workspace', 'GET', undefined, 0);
            check(readbackResponse.status === 200, 'workspace readback');
            const readback = (await readbackResponse.json()) as WorkspaceResponse;
            check(
              JSON.stringify(readback.workspace) === JSON.stringify(saved.workspace),
              'persisted workspace readback',
            );
            const cachedResponse = await call('/api/investigations', 'POST', request, 0);
            statuses.cached = cachedResponse.status;
            check(cachedResponse.status === 200, 'cached HTTP response');
            const cached = (await cachedResponse.json()) as WorkspaceResponse;
            check(
              JSON.stringify(cached.workspace) === JSON.stringify(saved.workspace) &&
                /No inference was needed/.test(cached.notice ?? ''),
              'unchanged cached decision',
            );
            const otherResponse = await call('/api/workspace', 'GET', undefined, 1);
            check(otherResponse.status === 200, 'isolated session readback');
            const other = (await otherResponse.json()) as WorkspaceResponse;
            check(
              JSON.stringify(other.workspace) === JSON.stringify(initial[1].workspace),
              'second session unaffected',
            );
            stage = 'settled single reservation';
            const [ownLedger, otherLedger] = await Promise.all([
              ledger(initial[0].workspace.id),
              ledger(initial[1].workspace.id),
            ]);
            reservations = ownLedger.size;
            check(
              reservations === 1 && otherLedger.empty,
              'single owned reservation and isolated budget',
            );
            charge = ownLedger.docs[0].get('charged') as number | null;
            check(
              typeof charge === 'number' &&
                charge > 0 &&
                charge <= INVESTIGATION_RESERVATION_USD &&
                ownLedger.docs[0].get('reserved') === INVESTIGATION_RESERVATION_USD,
              'settled charge within unchanged cap',
            );
            outcome = 'passed';
            stage = 'none';
          }
        } catch {
          failed = true;
        } finally {
          if (workspaceIds[0] && reservations === 0 && !blocked) {
            try {
              const savedLedger = await ledger(workspaceIds[0]);
              reservations = savedLedger.size;
              if (reservations === 1) charge = savedLedger.docs[0].get('charged') as number | null;
            } catch {
              /* Report unavailable charge; never guess. */
            }
          }
          await Promise.all(
            cookies.map(async (cookie, index) => {
              if (!cookie) {
                cleanup[index] = true;
                return;
              }
              try {
                const response = await call(
                  '/api/workspace',
                  'DELETE',
                  undefined,
                  index,
                  base,
                  true,
                );
                cleanup[index] =
                  response.status === 200 && (await response.json()).deleted === true;
              } catch {
                cleanup[index] = false;
              }
              cookies[index] = '';
            }),
          );
          if (!cleanup.every(Boolean)) {
            failed = true;
            outcome = 'failed';
            stage = 'disposable session cleanup';
          }
          mkdirSync('.local', { recursive: true, mode: 0o700 });
          const path = '.local/investigator-production-metrics.json';
          writeFileSync(path, '', { mode: 0o600 });
          chmodSync(path, 0o600);
          writeFileSync(
            path,
            JSON.stringify(
              {
                label: 'Hosted synthetic-session HTTP/storage check; no private course material.',
                at: new Date().toISOString(),
                outcome,
                stage,
                elapsedMs: Date.now() - started,
                statuses,
                paidPartSkipped: blocked,
                headroomBeforeUsd: headroom,
                reservations,
                settledChargeUsd: charge,
                modelCalls,
                cleanedSessions: cleanup.filter(Boolean).length,
              },
              null,
              2,
            ),
            { mode: 0o600 },
          );
        }
        if (failed)
          throw new Error(
            `Hosted investigation check stopped at ${stage}; see body-free metrics. No rerun attempted.`,
          );
        if (blocked)
          context.skip(
            'Insufficient application headroom; paid portion skipped without raising the cap.',
          );
      },
    );
  },
);
