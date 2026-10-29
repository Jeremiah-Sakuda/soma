import { createWorkspace } from '@/lib/server/store';
import { resolveWorkspaceAccess, readWorkspaceByAccess, deleteWorkspaceByAccess } from '@/lib/server/workspace-access';
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions } from '@/lib/server/account';
import { SESSION_COOKIE, sessionCookieOptions } from '@/lib/server/session';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';
export const maxDuration = 120;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    // A cross-site navigation can load the app; cross-site API requests cannot mint sessions.
    if (request.headers.get('sec-fetch-site') === 'cross-site') return NextResponse.json({ error: 'Open Soma directly.' }, { status: 403 });
    const access = await resolveWorkspaceAccess(request);
    const existing = access ? await readWorkspaceByAccess(access, true) : null;
    if (existing) return workspaceResponse(existing);
    const created = await createWorkspace();
    const response = workspaceResponse(created.workspace);
    response.cookies.set(SESSION_COOKIE, created.token, sessionCookieOptions());
    return response;
  } catch (error) { return apiError(error); }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const access = await resolveWorkspaceAccess(request);
    if (access) await deleteWorkspaceByAccess(access);
    const response = NextResponse.json({ deleted: true });
    response.cookies.set(SESSION_COOKIE, '', { ...sessionCookieOptions(), maxAge: 0 });
    response.cookies.set(ACCOUNT_SESSION_COOKIE, '', { ...accountSessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) { return apiError(error); }
}
