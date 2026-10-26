import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccountSession, AccountSessionError } from '@/lib/server/account';
import { readGoogleJson, refreshGoogleConnection } from '@/lib/server/connectors/google';
import { apiError, requireSameOrigin, workspaceResponse } from '@/lib/server/http';
import { queueCollectedPreparation } from '@/lib/server/connectors/preparation';
export const runtime = 'nodejs';
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    requireSameOrigin(request); const account = await verifyAccountSession(request); if (!account) throw new AccountSessionError('Sign in to refresh sources.', 401, 'account_required');
    const input = z.strictObject({ provider: z.enum(['gmail', 'calendar']) }).safeParse(await readGoogleJson(request));
    if (!input.success) return NextResponse.json({ error: 'Choose Gmail or Google Calendar.' }, { status: 400 });
    const workspace = await refreshGoogleConnection(account, input.data.provider);
    const preparation = input.data.provider === 'gmail' ? await queueCollectedPreparation(account, workspace, 'gmail:google-gmail:') : '';
    return workspaceResponse(workspace, `Selected Google source read completed. Check source settings for coverage limits.${preparation}`);
  } catch (error) { return apiError(error); }
}
