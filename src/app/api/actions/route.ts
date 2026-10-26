import { resolveWorkspaceAccess, readWorkspaceByAccess, updateWorkspaceByAccess } from '@/lib/server/workspace-access';
import { workspaceActionSchema } from '@/lib/server/action-schema';
import { applyAction } from '@/lib/domain/learning';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { inferenceEnabled } from '@/lib/server/budget';
import { prepareWithSpark, PreparationError } from '@/lib/server/meta';
import type { AgentRun } from '@/lib/domain/types';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(request: Request) {
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
    let notice: string | undefined;
    let failedRun: AgentRun | undefined;
    if (parsed.data.type === 'request-lesson' && inferenceEnabled()) {
      const before = await readWorkspaceByAccess(access);
      if (!before) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      if (revision !== undefined && before.revision !== revision) return NextResponse.json({ error: 'This workspace changed. Refresh and try again.' }, { status: 409 });
      const topic = parsed.data.topic;
        try {
          const result = await prepareWithSpark(before, parsed.data.courseId, topic);
          // Publication rechecks the full context revision. A raced job remains unpublished.
          const published = await updateWorkspaceByAccess(access, state => {
            for (const [id, version] of Object.entries(result.lesson.sourceVersions)) {
              if (!state.sources.some(s => s.id === id && s.version === version && s.status === 'current')) throw Object.assign(new Error('Sources changed during preparation. Please request again.'), { status: 409 });
            }
            if (!state.lessons.some(lesson => lesson.id === result.lesson.id)) state.lessons.unshift(result.lesson);
            state.runs.unshift(result.run);
            return state;
          }, before.revision);
          return workspaceResponse(published, result.run.status === 'unchanged' ? 'Reopened saved Spark practice with unchanged context. No new inference was needed.' : before.mode === 'demo' ? 'Prepared with live Spark decisions over original synthetic sources.' : 'Prepared with live Spark decisions over your selected sources.');
        } catch (error) {
          if ((error as { status?: number }).status === 409) throw error;
          if (error instanceof PreparationError) failedRun = error.run;
          notice = 'Live preparation was unavailable or reached its limits. Showing prepared practice; no live lesson was published.';
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
    return workspaceResponse(workspace, notice);
  } catch (error) { return apiError(error); }
}
