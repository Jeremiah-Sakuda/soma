import { resolveWorkspaceAccess, readWorkspaceByAccess, updateWorkspaceByAccess } from '@/lib/server/workspace-access';
import { workspaceActionSchema } from '@/lib/server/action-schema';
import { applyAction } from '@/lib/domain/learning';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { NextResponse, after } from 'next/server';
import { createAuditRun, AuditStoreError, type AuditWriter } from '@/lib/server/audit-store';
import { META_MODEL } from '@/lib/server/meta-client';
import { InferenceBudgetError, inferenceEnabled } from '@/lib/server/budget';
import { prepareWithSpark, PreparationError, SPARK_ENGINE_VERSION } from '@/lib/server/meta';
import { adaptationForAttempt, runAdaptationJob, saveActionWithAdaptation } from '@/lib/server/adaptation-jobs';
import type { AgentRun } from '@/lib/domain/types';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
  let audit: AuditWriter | undefined;
  let auditTerminal = false;
  try {
    requireSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
    const access = await resolveWorkspaceAccess(request);
    if (!access) return NextResponse.json({ error: 'Your session expired. Reload to start a new private demo.' }, { status: 401 });
    // Read the stream with a real byte ceiling; Content-Length alone is untrusted.
    const reader = request.body?.getReader();
    if (!reader) return NextResponse.json({ error: 'An action is required.' }, { status: 400 });
    let length = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); return NextResponse.json({ error: 'Request is too large.' }, { status: 413 }); }
      chunks.push(value);
    }
    let input: unknown;
    try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 }); }
    const parsed = workspaceActionSchema.safeParse(input);
    if (!parsed.success) return NextResponse.json({ error: 'That action contains invalid or unsupported values.' }, { status: 400 });
    const rawRevision = request.headers.get('x-workspace-revision');
    const revision = rawRevision === null ? undefined : Number(rawRevision);
    if (revision !== undefined && (!Number.isSafeInteger(revision) || revision < 0)) return NextResponse.json({ error: 'Invalid workspace revision.' }, { status: 400 });
    if (access.kind === 'account' && parsed.data.type === 'attempt') {
      const saved = await saveActionWithAdaptation(access.account, parsed.data, revision);
      const job = adaptationForAttempt(saved, access.account.uid, saved.attempts.at(-1)!.id);
      if(job)after(async()=>{try{await runAdaptationJob(access.account,job.id);}catch{/* Durable queue/backoff retains the outcome for the scheduled worker. */}});
      return workspaceResponse(saved, job ? 'Response saved. Soma’s follow-up is queued automatically; you can keep studying.' : undefined);
    }
    let notice: string | undefined;
    let failedRun: AgentRun | undefined;
    let preparationStopped: 'failed' | 'blocked' | undefined;
    if (parsed.data.type === 'request-lesson') {
      const before = await readWorkspaceByAccess(access);
      if (!before) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      if (revision !== undefined && before.revision !== revision) return NextResponse.json({ error: 'This workspace changed. Refresh and try again.' }, { status: 409 });
      const topic = parsed.data.topic;
      audit = await createAuditRun(access, before, { kind: 'lesson-preparation', trigger: 'direct-request', mode: inferenceEnabled() ? 'live' : 'prepared', courseId: parsed.data.courseId, model: META_MODEL, engineVersion: SPARK_ENGINE_VERSION, promptVersion: SPARK_ENGINE_VERSION });
      if (inferenceEnabled()) {
        try {
          const result = await prepareWithSpark(before, parsed.data.courseId, topic, { audit });
          // Publication rechecks the full context revision. A raced job remains unpublished.
          const published = await updateWorkspaceByAccess(access, state => {
            for (const [id, version] of Object.entries(result.lesson.sourceVersions)) {
              if (!state.sources.some(s => s.id === id && s.version === version && s.status === 'current')) throw Object.assign(new Error('Sources changed during preparation. Please request again.'), { status: 409 });
            }
            if (!state.lessons.some(lesson => lesson.id === result.lesson.id)) state.lessons.unshift(result.lesson);
            state.runs.unshift(result.run);
            return state;
          }, before.revision);
          try {
            await audit.append({ actor: 'application', kind: 'publication', summary: 'Saved the validated activity after rechecking source versions and the current workspace revision.', visibility: 'public' });
            await audit.finish({ committedRevision: published.revision, status: result.run.status === 'unchanged' ? 'unchanged' : 'published', ...(result.run.status === 'unchanged' ? { mode: 'prepared' } : {}), selectedLessonId: result.lesson.id, ...(result.run.status === 'unchanged' ? {} : { publishedLessonId: result.lesson.id }) });
            auditTerminal = true;
          } catch {
            auditTerminal = true;
            return workspaceResponse(published, 'Practice was saved, but its final audit confirmation could not be recorded. The audit remains incomplete.', result.lesson.id);
          }
          return workspaceResponse(published, result.run.status === 'unchanged' ? 'Reopened saved Spark practice with unchanged context. No new inference was needed.' : before.mode === 'demo' ? 'Prepared with live Spark decisions over original synthetic sources.' : 'Prepared with live Spark decisions over your selected sources.', result.lesson.id);
        } catch (error) {
          if (error instanceof AuditStoreError) throw error;
          preparationStopped = error instanceof InferenceBudgetError ? 'blocked' : 'failed';
          await audit.append({ actor: 'application', kind: 'stopped', summary: error instanceof InferenceBudgetError ? 'The enforced model allowance blocked live preparation. No new inference was made for this attempt.' : 'Live preparation stopped without publishing a new lesson. The application will check for supported prepared practice.', visibility: 'public' });
          if ((error as { status?: number }).status === 409) throw error;
          if (error instanceof PreparationError) failedRun = error.run;
          notice = 'Live preparation was unavailable or reached its limits. Showing prepared practice; no live lesson was published.';
        }
      } else {
        await audit.append({ actor: 'application', kind: 'decision', summary: 'Live inference is disabled. Checking supported prepared practice without a model call.', visibility: 'public' });
      }
    }
    const workspace = await updateWorkspaceByAccess(access, state => {
      try { const updated = applyAction(state, parsed.data); if (failedRun) updated.runs.push(failedRun); return updated; }
      catch (error) {
        if (failedRun && parsed.data.type === 'request-lesson') {
          state.runs.push(failedRun);
          notice = 'Preparation could not produce a lesson from the selected material. The failed run is saved; inspect sources or try a supported objective later.';
          return state;
        }
        throw Object.assign(error as Error, { status: 422 });
      }
    }, revision);
    if (audit && parsed.data.type === 'request-lesson') {
      try {
        await audit.append({ actor: 'application', kind: 'publication', summary: 'Saved the supported prepared-practice outcome. No new live lesson was published.', visibility: 'public' });
        await audit.finish({ status: preparationStopped ?? 'unchanged', mode: 'prepared' });
        auditTerminal = true;
      } catch {
        auditTerminal = true;
        return workspaceResponse(workspace, 'Prepared practice was saved, but its final audit confirmation could not be recorded. The audit remains incomplete.');
      }
    }
    return workspaceResponse(workspace, notice);
  } catch (error) {
    if (audit && !auditTerminal && !(error instanceof AuditStoreError)) {
      try {
        await audit.append({ actor: 'application', kind: 'stopped', summary: (error as { status?: number }).status === 409 ? 'The workspace changed before publication. No obsolete preparation result was saved.' : 'Preparation could not commit an outcome to this workspace.', visibility: 'public' });
        await audit.finish({ status: 'failed' });
      } catch { /* The audit remains explicitly incomplete when persistence is unavailable. */ }
    }
    return apiError(error);
  }
}
