import { NextResponse } from 'next/server';
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions, exchangeAccountSession, readAccountExchange, verifyAccountSession } from '@/lib/server/account';
import { requireSameOrigin } from '@/lib/server/http';

export const runtime = 'nodejs';
const responseHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const accountWorkspaceAvailable = () => process.env.SOMA_PERSISTENCE === 'firestore';

function failure(error: unknown) {
  const candidate = error as { status?: number; message?: string };
  const status = candidate.status && [400, 401, 403, 413, 415, 503].includes(candidate.status) ? candidate.status : 500;
  return NextResponse.json({ error: status === 500 ? 'Account sign-in is temporarily unavailable.' : candidate.message }, { status, headers: responseHeaders });
}

export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const token = await readAccountExchange(request);
    const account = await exchangeAccountSession(token);
    const response = NextResponse.json({ authenticated: true, uid: account.uid, accountWorkspaceAvailable: accountWorkspaceAvailable() }, { headers: responseHeaders });
    response.cookies.set(ACCOUNT_SESSION_COOKIE, account.sessionCookie, accountSessionCookieOptions());
    return response;
  } catch (error) { return failure(error); }
}

export async function GET(request: Request) {
  try {
    const account = await verifyAccountSession(request);
    return NextResponse.json({ authenticated: Boolean(account), ...(account ? { uid: account.uid } : {}), accountWorkspaceAvailable: accountWorkspaceAvailable() }, { headers: responseHeaders });
  } catch (error) { return failure(error); }
}

export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    // Ordinary logout expires this browser's cookie; it does not revoke other devices.
    const response = NextResponse.json({ authenticated: false, accountWorkspaceAvailable: false }, { headers: responseHeaders });
    response.cookies.set(ACCOUNT_SESSION_COOKIE, '', { ...accountSessionCookieOptions(), maxAge: 0 });
    return response;
  } catch (error) { return failure(error); }
}
