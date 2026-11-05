import {
  resolveWorkspaceAccess,
  readWorkspaceByAccess,
  updateWorkspaceByAccess,
} from '@/lib/server/workspace-access';
import { workspaceActionSchema } from '@/lib/server/action-schema';
import { applyAction } from '@/lib/domain/learning';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { NextResponse, after } from 'next/server';
import { AuditStoreError } from '@/lib/server/audit-store';
import { runAuditedPublication, type PublicationOutcome } from '@/lib/server/audited-publication';
import { META_MODEL } from '@/lib/server/meta-client';
import { InferenceBudgetError, inferenceEnabled } from '@/lib/server/budget';
import { prepareWithSpark, PreparationError, SPARK_ENGINE_VERSION } from '@/lib/server/meta';
import {
  adaptationForAttempt,
  runAdaptationJob,
  saveActionWithAdaptation,
} from '@/lib/server/adaptation-jobs';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json'))
      return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
    const access = await resolveWorkspaceAccess(request);
    if (!access)
      return NextResponse.json(
        { error: 'Your session expired. Reload to start a new private demo.' },
        { status: 401 },
      );
    // Read the stream with a real byte ceiling; Content-Length alone is untrusted.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'An action is required.' }, { status: 400 });
    let length = 0;
    const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) {
        await reader.cancel();
        return NextResponse.json({ error: 'Request is too large.' }, { status: 413 });
      }
      chunks.push(value);
    }
    let input: unknown;
    try {
      input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }
    const parsed = workspaceActionSchema.safeParse(input);
    if (!parsed.success)
      return NextResponse.json(
        { error: 'That action contains invalid or unsupported values.' },
        { status: 400 },
      );
    const rawRevision = request.headers.get('x-workspace-revision');
    const revision = rawRevision === null ? undefined : Number(rawRevision);
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0))
      return NextResponse.json({ error: 'Invalid workspace revision.' }, { status: 400 });
    if (
      access.kind === 'account' &&
      (parsed.data.type === 'attempt' || parsed.data.type === 'correct-learning')
    ) {
      const saved = await saveActionWithAdaptation(access.account, parsed.data, revision);
      const job = adaptationForAttempt(saved, access.account.uid, saved.attempts.at(-1)!.id);
      if (job)
        after(async () => {
          try {
            await runAdaptationJob(access.account, job.id);
          } catch {
            /* Durable queue/backoff retains the outcome for the scheduled worker. */
          }
        });
      return workspaceResponse(
        saved,
        job
          ? 'Response saved. Soma’s follow-up is queued automatically; you can keep studying.'
          : undefined,
      );
    }
    if (parsed.data.type !== 'request-lesson') {
      const workspace = await updateWorkspaceByAccess(
        access,
        (state) => {
          try {
            return applyAction(state, parsed.data);
          } catch (error) {
            throw Object.assign(error as Error, { status: 422 });
          }
        },
        revision,
      );
      return workspaceResponse(workspace);
    }
    const action = parsed.data;
    const before = await readWorkspaceByAccess(access);
    if (!before) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
    if (revision !== undefined && before.revision !== revision)
      return NextResponse.json(
        { error: 'This workspace changed. Refresh and try again.' },
        { status: 409 },
      );
    let notice: string | undefined;
    const execution = await runAuditedPublication({
      access,
      before,
      metadata: {
        kind: 'lesson-preparation',
        trigger: 'direct-request',
        mode: inferenceEnabled() ? 'live' : 'prepared',
        courseId: action.courseId,
        model: META_MODEL,
        engineVersion: SPARK_ENGINE_VERSION,
        promptVersion: SPARK_ENGINE_VERSION,
      },
      execute: async (
        audit,
      ): Promise<Extract<PublicationOutcome, { kind: 'lesson' | 'prepared' }>> => {
        if (!inferenceEnabled()) {
          await audit.append({
            actor: 'application',
            kind: 'decision',
            summary:
              'Live inference is disabled. Checking supported prepared practice without a model call.',
            visibility: 'public',
          });
          return { kind: 'prepared' };
        }
        try {
          return {
            kind: 'lesson',
            result: await prepareWithSpark(before, action.courseId, action.topic, { audit }),
          };
        } catch (error) {
          if (error instanceof AuditStoreError || (error as { status?: number }).status === 409)
            throw error;
          await audit.append({
            actor: 'application',
            kind: 'stopped',
            summary:
              error instanceof InferenceBudgetError
                ? 'The enforced model allowance blocked live preparation. No new inference was made for this attempt.'
                : 'Live preparation stopped without publishing a new lesson. The application will check for supported prepared practice.',
            visibility: 'public',
          });
          notice =
            'Live preparation was unavailable or reached its limits. Showing prepared practice; no live lesson was published.';
          return {
            kind: 'prepared',
            failure: error,
            ...(error instanceof PreparationError ? { failedRun: error.run } : {}),
          };
        }
      },
      publish: (outcome) =>
        updateWorkspaceByAccess(
          access,
          (state) => {
            if (outcome.kind === 'lesson') {
              const result = outcome.result;
              for (const [id, version] of Object.entries(result.lesson.sourceVersions)) {
                if (
                  !state.sources.some(
                    (source) =>
                      source.id === id && source.version === version && source.status === 'current',
                  )
                )
                  throw Object.assign(
                    new Error('Sources changed during preparation. Please request again.'),
                    { status: 409 },
                  );
              }
              if (!state.lessons.some((lesson) => lesson.id === result.lesson.id))
                state.lessons.unshift(result.lesson);
              state.runs.unshift(result.run);
              return state;
            }
            try {
              const updated = applyAction(state, action);
              if (outcome.failedRun) updated.runs.push(outcome.failedRun);
              return updated;
            } catch (error) {
              if (outcome.failedRun) {
                state.runs.push(outcome.failedRun);
                notice =
                  'Preparation could not produce a lesson from the selected material. The failed run is saved; inspect sources or try a supported objective later.';
                return state;
              }
              throw Object.assign(error as Error, { status: 422 });
            }
          },
          before.revision,
        ),
    });
    if (!execution.auditComplete)
      notice =
        'Practice was saved, but its final audit confirmation could not be recorded. The audit remains incomplete.';
    else if (execution.outcome.kind === 'lesson')
      notice =
        execution.outcome.result.run.status === 'unchanged'
          ? 'Reopened saved Spark practice with unchanged context. No new inference was needed.'
          : before.mode === 'demo'
            ? 'Prepared with live Spark decisions over original synthetic sources.'
            : 'Prepared with live Spark decisions over your selected sources.';
    return workspaceResponse(execution.workspace, notice, execution.selectedLessonId);
  } catch (error) {
    return apiError(error);
  }
}
