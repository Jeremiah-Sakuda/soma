import { readWorkspace, updateWorkspace } from '@/lib/server/store';
import { readSessionToken } from '@/lib/server/session';
import { workspaceActionSchema } from '@/lib/server/action-schema';
import { applyAction } from '@/lib/domain/learning';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { NextResponse } from 'next/server';
import { inferenceEnabled } from '@/lib/server/budget';
import { prepareWithSpark } from '@/lib/server/meta';
export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (!request.headers.get('content-type')?.startsWith('application/json')) return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
    const token = await readSessionToken(request);
    if (!token) return NextResponse.json({ error: 'Your session expired. Reload to start a new private demo.' }, { status: 401 });
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
    if (parsed.data.type === 'request-lesson' && parsed.data.courseId === 'circuits' && inferenceEnabled()) {
      const before = await readWorkspace(token);
      if (!before) return NextResponse.json({ error: 'Session expired.' }, { status: 401 });
      if (revision !== undefined && before.revision !== revision) return NextResponse.json({ error: 'This workspace changed. Refresh and try again.' }, { status: 409 });
      // Never attach an unsupported objective to a supported model, even if the model proposes it.
      const topic = parsed.data.topic;
      const supported = /\b(resistor|resistance|series|parallel|ohm|voltage|current|circuit)\b/i.test(topic) && !/\b(capacitor|transient|inductor|ac|quantum)\b/i.test(topic);
      if (supported) {
        try {
          const result = await prepareWithSpark(before, parsed.data.courseId, topic);
          // Publication rechecks the full context revision. A raced job remains unpublished.
          const published = await updateWorkspace(token, state => {
            for (const [id, version] of Object.entries(result.lesson.sourceVersions)) {
              if (!state.sources.some(s => s.id === id && s.version === version && s.status === 'current')) throw Object.assign(new Error('Sources changed during preparation. Please request again.'), { status: 409 });
            }
            state.lessons.unshift(result.lesson); state.runs.unshift(result.run);
            return state;
          }, before.revision);
          return workspaceResponse(published, 'Prepared with live Spark decisions over original synthetic sources.');
        } catch (error) {
          if ((error as { status?: number }).status === 409) throw error;
          notice = 'Live preparation was unavailable or reached its limits. Showing prepared practice; no live lesson was published.';
        }
      }
    }
    const workspace = await updateWorkspace(token, state => {
      try { return applyAction(state, parsed.data); }
      catch (error) { throw Object.assign(error as Error, { status: 422 }); }
    }, revision);
    return workspaceResponse(workspace, notice);
  } catch (error) { return apiError(error); }
}
