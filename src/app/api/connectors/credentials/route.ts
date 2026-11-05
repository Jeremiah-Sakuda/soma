import { NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyAccountSession, recentAccountAuthentication } from '@/lib/server/account';
import { apiError, readJsonBody, requireSameOrigin } from '@/lib/server/http';
import {
  credentialLoginStatus,
  finishCredentialLogin,
  openCredentialLogin,
  forgetStoredCredential,
} from '@/lib/server/connectors/credential-login';
export const runtime = 'nodejs';
export const maxDuration = 120;
const response = (body: unknown) =>
  NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
const action = z.strictObject({
  provider: z.literal('blackboard'),
  action: z.enum(['open', 'complete', 'cancel', 'forget']),
});
async function account(request: Request) {
  const value = await verifyAccountSession(request);
  if (!value) throw Object.assign(new Error('Sign in to manage secure autofill.'), { status: 401 });
  return value;
}
export async function GET(request: Request) {
  try {
    return response(await credentialLoginStatus(await account(request)));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    requireSameOrigin(request);
    const owner = await account(request),
      parsed = action.safeParse(await readJsonBody(request, 1024));
    if (!parsed.success)
      throw Object.assign(
        new Error(
          'Invalid secure sign-in action. Enter institutional credentials only in the separate secure sign-in service.',
        ),
        { status: 400 },
      );
    if (parsed.data.action === 'open')
      return response(
        await openCredentialLogin(owner, parsed.data.provider, recentAccountAuthentication(owner)),
      );
    if (parsed.data.action === 'forget') {
      recentAccountAuthentication(owner);
      return response(await forgetStoredCredential(owner));
    }
    return response(
      await finishCredentialLogin(owner, parsed.data.provider, parsed.data.action === 'cancel'),
    );
  } catch (error) {
    return apiError(error);
  }
}
