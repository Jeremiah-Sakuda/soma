import { NextResponse } from 'next/server';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { resolveWorkspaceAccess, readWorkspaceByAccess, updateWorkspaceByAccess } from '@/lib/server/workspace-access';
import { investigateWithSpark, investigationRequestSchema, publishInvestigation, InvestigationError, ENGINE_VERSION } from '@/lib/server/investigator';
import { runAuditedPublication } from '@/lib/server/audited-publication';
import { META_MODEL } from '@/lib/server/meta-client';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') return NextResponse.json({ error: 'JSON is required.' }, { status: 415 });
    const access = await resolveWorkspaceAccess(request);
    if (!access) return NextResponse.json({ error: 'Open your workspace or sign in first.' }, { status: 401 });
    const reader = request.body?.getReader(); if (!reader) throw Object.assign(new Error('An investigation is required.'), { status: 400 });
    const chunks: Uint8Array[] = []; let size = 0;
    while (true) { const { done, value } = await reader.read(); if (done) break; size += value.byteLength; if (size > 8192) { await reader.cancel(); throw Object.assign(new Error('Request is too large.'), { status: 413 }); } chunks.push(value); }
    let json: unknown; try { json = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Invalid JSON.'), { status: 400 }); }
    const parsed = investigationRequestSchema.safeParse(json); if (!parsed.success) throw Object.assign(new Error('Choose a course, bounded goal and valid source/response references.'), { status: 400 });
    const before = await readWorkspaceByAccess(access);
    if (!before) throw Object.assign(new Error('Workspace expired.'), { status: 401 });
    // Reject source/course scope before creating a journal or authorizing inference.
    if (!before.courses.some(course => course.id === parsed.data.courseId)) throw Object.assign(new Error('Choose a course in this workspace.'), { status: 400 });
    const execution = await runAuditedPublication({ access, before, reuse: 'reopen',
      metadata: { kind: 'investigation', trigger: parsed.data.attemptId ? 'Saved diagnostic response reconsideration' : 'Direct course investigation', mode: 'live', courseId: parsed.data.courseId, model: META_MODEL, engineVersion: ENGINE_VERSION, promptVersion: ENGINE_VERSION },
      execute: async audit => {
        await audit.append({ actor: 'application', kind: 'started', summary: 'A course investigation started from this workspace and its current source versions.', visibility: 'public' });
        try { return { kind: 'investigation' as const, result: await investigateWithSpark(before, parsed.data, { audit }) }; }
        catch (error) {
          if (!(error instanceof InvestigationError)) throw error;
          return { kind: 'failed-investigation' as const, failedRun: error.run };
        }
      },
      publish: outcome => updateWorkspaceByAccess(access, state => {
        if (outcome.kind === 'failed-investigation') { state.runs.unshift(outcome.failedRun); return state; }
        return publishInvestigation(state, outcome.result);
      }, before.revision),
    });
    const notice = !execution.auditComplete ? 'The decision was saved, but its final audit confirmation could not be recorded. The audit trail remains incomplete.'
      : execution.outcome.kind === 'failed-investigation' ? 'The investigation stopped at its validation or provider boundary. Its audit history is retained; existing activities remain available.'
      : execution.outcome.result.reused ? 'Reopened the unchanged saved investigation. No inference was needed.'
      : 'Spark’s evidence-based decision and its audit trail are saved. Interpretations remain provisional.';
    return workspaceResponse(execution.workspace, notice, execution.selectedLessonId);
  } catch (error) { return apiError(error); }
}
