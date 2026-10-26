import { NextResponse } from 'next/server';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { resolveWorkspaceAccess, readWorkspaceByAccess, updateWorkspaceByAccess } from '@/lib/server/workspace-access';
import { investigateWithSpark, investigationRequestSchema, publishInvestigation, InvestigationError } from '@/lib/server/investigator';
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
    try {
      const result = await investigateWithSpark(before, parsed.data);
      if (result.reused) return workspaceResponse(before, 'Reopened the unchanged saved investigation. No inference was needed.', result.selectedLessonId);
      const saved = await updateWorkspaceByAccess(access, state => publishInvestigation(state, result), before.revision);
      return workspaceResponse(saved, 'Spark’s evidence-based decision is saved. Its hypotheses and source interpretation remain provisional.', result.selectedLessonId);
    } catch (error) {
      if (!(error instanceof InvestigationError)) throw error;
      const saved = await updateWorkspaceByAccess(access, state => { state.runs.unshift(error.run); return state; }, before.revision);
      return workspaceResponse(saved, 'The investigation stopped at its validation or budget boundary. Existing activities remain available; inspect Soma’s activity for the recorded result.');
    }
  } catch (error) { return apiError(error); }
}
