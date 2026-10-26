import { NextResponse } from 'next/server';
import { verifyAccountSession } from '@/lib/server/account';
import { finishGoogleConnection, googleAppOrigin } from '@/lib/server/connectors/google';
import { consumeConnectionState } from '@/lib/server/connectors/store';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  let origin: string;
  try { origin = googleAppOrigin(); } catch { return NextResponse.json({ error: 'Google callback is not configured.' }, { status: 503 }); }
  const result = new URL(origin);
  try {
    const account = await verifyAccountSession(request); if (!account) throw new Error('Account session required.');
    const query = new URL(request.url).searchParams;
    if (query.get('error')) { await consumeConnectionState(account, query.get('state') || ''); throw new Error('Authorization not granted.'); }
    await finishGoogleConnection(account, query.get('state') || '', query.get('code') || '');
    result.searchParams.set('google', 'connected');
  } catch { result.searchParams.set('google', 'error'); }
  return NextResponse.redirect(result, { status: 303, headers: { 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}
