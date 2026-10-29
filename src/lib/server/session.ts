import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'soma_session';
export const SESSION_TTL_SECONDS = 24 * 60 * 60;
export const isSessionToken = (token: unknown): token is string => typeof token === 'string' && /^[a-f0-9]{64}$/.test(token);

export function sessionCookieOptions() {
  return { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', maxAge: SESSION_TTL_SECONDS, path: '/' };
}

export async function readSessionToken(request?: Request): Promise<string | undefined> {
  if (!request) {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    return isSessionToken(token) ? token : undefined;
  }
  const matches = (request.headers.get('cookie') ?? '').split(';').map(part => part.trim()).filter(part => part.startsWith(`${SESSION_COOKIE}=`));
  // Ambiguous cookies are rejected, rather than allowing parser differences.
  if (matches.length !== 1) return undefined;
  const token = matches[0].slice(SESSION_COOKIE.length + 1);
  return isSessionToken(token) ? token : undefined;
}
