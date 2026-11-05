import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import {
  parseGoogleProvider,
  readGoogleJson,
  startGoogleConnection,
} from '@/lib/server/connectors/google';
import { apiError, requireSameOrigin } from '@/lib/server/http';
export const runtime = 'nodejs';
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const account = await verifyAccountSession(request);
    if (!account)
      throw new AccountSessionError('Sign in to connect Google.', 401, 'account_required');
    const input = z
      .strictObject({ provider: z.enum(['gmail', 'calendar']) })
      .safeParse(await readGoogleJson(request));
    if (!input.success)
      return NextResponse.json({ error: 'Choose Gmail or Google Calendar.' }, { status: 400 });
    return NextResponse.json(
      {
        authorizationUrl: await startGoogleConnection(
          account,
          parseGoogleProvider(input.data.provider),
        ),
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return apiError(error);
  }
}
