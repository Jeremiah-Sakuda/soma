import { NextResponse } from 'next/server';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import { googleConnectionStatus } from '@/lib/server/connectors/google';
import { apiError } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function GET(request: Request) {
  try { const account = await verifyAccountSession(request); if (!account) throw new AccountSessionError('Sign in to manage sources.', 401, 'account_required'); return NextResponse.json(await googleConnectionStatus(account), { headers: { 'Cache-Control': 'private, no-store' } }); }
  catch (error) { return apiError(error); }
}
