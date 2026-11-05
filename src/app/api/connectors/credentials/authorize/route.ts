import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/server/http';
import {
  credentialServiceSettings,
  credentialAutofillUidAllowed,
} from '@/lib/server/connectors/credential-settings';
import {
  authorizeCredentialGrant,
  credentialGrantSchema,
} from '@/lib/server/connectors/credential-grants';
export const runtime = 'nodejs';
const deny = () =>
  NextResponse.json(
    { error: 'Secure sign-in authorization unavailable.' },
    { status: 403, headers: { 'Cache-Control': 'no-store' } },
  );
export async function POST(request: Request) {
  try {
    const config = credentialServiceSettings(),
      supplied = Buffer.from(request.headers.get('authorization') ?? ''),
      expected = Buffer.from(`Bearer ${config.authorizationKey}`);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return deny();
    const raw = await readJsonBody(request, 4096);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return deny();
    const { purpose, ...facts } = raw as Record<string, unknown>;
    if (purpose !== 'credential' && purpose !== 'session') return deny();
    const grant = credentialGrantSchema.safeParse(facts);
    if (!grant.success || !credentialAutofillUidAllowed(grant.data.uid)) return deny();
    const result = await authorizeCredentialGrant(grant.data, purpose);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return deny();
  }
}
