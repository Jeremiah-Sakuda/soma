import { NextResponse } from 'next/server';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import {
  googleConnectionStatus,
  readGoogleJson,
  saveGoogleSettings,
} from '@/lib/server/connectors/google';
import { apiError, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function PATCH(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await verifyAccountSession(request);
    if (!account)
      throw new AccountSessionError('Sign in to select source scope.', 401, 'account_required');
    await saveGoogleSettings(account, await readGoogleJson(request));
    return NextResponse.json(await googleConnectionStatus(account), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return apiError(error);
  }
}
