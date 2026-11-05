import { NextResponse } from 'next/server';
import { apiError } from '@/lib/server/http';
import { resolveWorkspaceAccess, readWorkspaceByAccess } from '@/lib/server/workspace-access';
import { readAuditRuns, readAuditPage } from '@/lib/server/audit-store';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try {
    const params = new URL(request.url).searchParams;
    if (
      [...params.keys()].some((key) => !['runId', 'format', 'cursor'].includes(key)) ||
      params.getAll('runId').length > 1 ||
      params.getAll('format').length > 1 ||
      params.getAll('cursor').length > 1 ||
      (params.has('runId') && params.has('cursor')) ||
      (params.has('format') && params.get('format') !== 'json')
    )
      return NextResponse.json(
        { error: 'Choose a valid audit view.' },
        { status: 400, headers: { 'Cache-Control': 'private, no-store' } },
      );
    const access = await resolveWorkspaceAccess(request);
    if (!access)
      return NextResponse.json(
        { error: 'Open a workspace or sign in first.' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      );
    const workspace = await readWorkspaceByAccess(access);
    if (!workspace)
      return NextResponse.json(
        { error: 'Workspace expired.' },
        { status: 401, headers: { 'Cache-Control': 'private, no-store' } },
      );
    const runId = params.get('runId') ?? undefined;
    const page = runId
        ? { runs: await readAuditRuns(access, workspace, runId) }
        : await readAuditPage(access, workspace, params.get('cursor') ?? undefined),
      runs = page.runs;
    if (runId && !runs.length)
      return NextResponse.json(
        { error: 'Audit run was not found.' },
        { status: 404, headers: { 'Cache-Control': 'private, no-store' } },
      );
    const headers: Record<string, string> = {
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    };
    if (params.get('format') === 'json')
      headers['Content-Disposition'] = 'attachment; filename="soma-audit.json"';
    const exportScope =
      params.get('format') === 'json' ? { exportScope: runId ? 'run' : 'page' } : {};
    return NextResponse.json(
      runId
        ? { workspaceId: workspace.id, run: runs[0], ...exportScope }
        : { workspaceId: workspace.id, ...page, ...exportScope },
      { headers },
    );
  } catch (error) {
    return apiError(error);
  }
}
