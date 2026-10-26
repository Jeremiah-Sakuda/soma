import { NextResponse } from 'next/server';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { resolveWorkspaceAccess, readWorkspaceByAccess, updateWorkspaceByAccess } from '@/lib/server/workspace-access';
import { investigateWithSpark, investigationRequestSchema, publishInvestigation, InvestigationError, ENGINE_VERSION } from '@/lib/server/investigator';
import { createAuditRun, type AuditWriter } from '@/lib/server/audit-store';
import { META_MODEL } from '@/lib/server/meta-client';
import { InferenceBudgetError } from '@/lib/server/budget';
import type { WorkspaceState } from '@/lib/domain/types';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  let audit: AuditWriter | undefined, auditFinished = false, committed: WorkspaceState | undefined;
  let selectedLessonId: string | undefined;
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
    audit = await createAuditRun(access, before, { kind: 'investigation', trigger: parsed.data.attemptId ? 'Saved diagnostic response reconsideration' : 'Direct course investigation', mode: 'live', courseId: parsed.data.courseId, model: META_MODEL, engineVersion: ENGINE_VERSION, promptVersion: ENGINE_VERSION });
    await audit.append({ actor: 'application', kind: 'started', summary: 'A course investigation started from this workspace and its current source versions.', visibility: 'public' });
    try {
      const result = await investigateWithSpark(before, parsed.data, { audit });
      selectedLessonId = result.selectedLessonId;
      if (result.reused) {
        await audit.finish({ status: 'unchanged', committedRevision: before.revision, mode: 'prepared', ...(selectedLessonId ? { selectedLessonId } : {}) }); auditFinished = true;
        return workspaceResponse(before, 'Reopened the unchanged saved investigation. No inference was needed.', selectedLessonId);
      }
      committed = await updateWorkspaceByAccess(access, state => publishInvestigation(state, result), before.revision);
      await audit.append({ actor: 'application', kind: 'publication', summary: result.selectedLessonId ? 'The current workspace commit saved the decision and selected activity.' : 'The current workspace commit saved the decision; no activity replacement was required.', visibility: 'public', evidence: result.record.sourceRefs.map(({ sourceId, version }) => ({ sourceId, version })) });
      await audit.finish({ status: 'published', committedRevision: committed.revision, protectUnpublishedActivity: result.protectUnpublishedActivity, ...(selectedLessonId ? { selectedLessonId } : {}), ...(result.lesson ? { publishedLessonId: result.lesson.id } : {}) }); auditFinished = true;
      return workspaceResponse(committed, 'Spark’s evidence-based decision and its audit trail are saved. Interpretations remain provisional.', selectedLessonId);
    } catch (error) {
      if (!(error instanceof InvestigationError)) throw error;
      const saved = await updateWorkspaceByAccess(access, state => { state.runs.unshift(error.run); return state; }, before.revision);
      await audit.finish({ status: 'failed' }); auditFinished = true;
      return workspaceResponse(saved, 'The investigation stopped at its validation or provider boundary. Its audit history is retained; existing activities remain available.');
    }
  } catch (error) {
    if (committed) return workspaceResponse(committed, 'The decision was saved, but its final audit confirmation could not be recorded. The audit trail remains incomplete.', selectedLessonId);
    if (audit && !auditFinished) {
      try {
        await audit.append({ actor: 'application', kind: 'stopped', summary: error instanceof InferenceBudgetError ? 'The configured model allowance blocked this run before a model call.' : 'The run stopped before a new decision was committed. Its confirmed events are retained.', visibility: 'public' });
        await audit.finish({ status: error instanceof InferenceBudgetError ? 'blocked' : 'failed' });
      } catch { /* Confirmed prefix remains durable; stale run projection reports interruption. */ }
    }
    return apiError(error);
  }
}
