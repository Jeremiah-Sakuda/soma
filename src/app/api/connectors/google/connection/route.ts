import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import { disconnectGoogleConnection, readGoogleJson } from '@/lib/server/connectors/google';
import { apiError, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function DELETE(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await verifyAccountSession(request);
    if (!account)
      throw new AccountSessionError('Sign in to disconnect sources.', 401, 'account_required');
    const input = z
      .strictObject({ provider: z.enum(['gmail', 'calendar']) })
      .safeParse(await readGoogleJson(request));
    if (!input.success)
      return NextResponse.json({ error: 'Choose Gmail or Google Calendar.' }, { status: 400 });
    await disconnectGoogleConnection(account, input.data.provider);
    return NextResponse.json(
      { disconnected: true },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
