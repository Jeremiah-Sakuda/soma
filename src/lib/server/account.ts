import { getAuth } from 'firebase-admin/auth';
import { z } from 'zod';
import { getServerApp } from './firebase-config';

declare const accountBrand: unique symbol;
export type VerifiedAccount = Readonly<{ uid: string; [accountBrand]: true }>;
const verifiedAccounts = new WeakSet<object>();

export function assertVerifiedAccount(account: VerifiedAccount): void {
  if (!account || !verifiedAccounts.has(account)) throw new AccountSessionError('A verified account session is required.', 401, 'account_required');
}

export const ACCOUNT_SESSION_COOKIE = 'soma_account';
export const ACCOUNT_SESSION_TTL_SECONDS = 24 * 60 * 60;
const MAX_REQUEST_BYTES = 8192;
const jwtShape = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const exchangeSchema = z.strictObject({ idToken: z.string().max(7168).regex(jwtShape) });

export class AccountSessionError extends Error {
  constructor(message: string, public readonly status: number, public readonly code: string) { super(message); }
}

function auth() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new AccountSessionError('Account sign-in is not configured.', 503, 'auth_unavailable');
  // Production must never accept the unsigned tokens supported by an emulator.
  if (process.env.NODE_ENV === 'production' && process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    throw new AccountSessionError('Account sign-in is not configured safely.', 503, 'auth_unavailable');
  }
  return getAuth(getServerApp());
}

export function accountSessionCookieOptions() {
  return { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, path: '/', maxAge: ACCOUNT_SESSION_TTL_SECONDS };
}

/** A byte ceiling is enforced on the stream, independent of Content-Length. */
export async function readAccountExchange(request: Request): Promise<string> {
  if (request.headers.get('content-type')?.split(';')[0].trim().toLowerCase() !== 'application/json') {
    throw new AccountSessionError('JSON is required.', 415, 'json_required');
  }
  const reader = request.body?.getReader();
  if (!reader) throw new AccountSessionError('A sign-in token is required.', 400, 'invalid_exchange');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_REQUEST_BYTES) {
      await reader.cancel();
      throw new AccountSessionError('Sign-in request is too large.', 413, 'exchange_too_large');
    }
    chunks.push(value);
  }
  let input: unknown;
  try { input = JSON.parse(Buffer.concat(chunks).toString('utf8')); }
  catch { throw new AccountSessionError('Invalid sign-in request.', 400, 'invalid_exchange'); }
  const result = exchangeSchema.safeParse(input);
  if (!result.success) throw new AccountSessionError('A valid sign-in token is required.', 400, 'invalid_exchange');
  return result.data.idToken;
}

/** Evaluate only verified claims. This is not a substitute for SDK verification. */
export function requireRecentAuthentication(authTime: number, nowSeconds = Date.now() / 1000): void {
  if (!Number.isFinite(authTime) || authTime > nowSeconds || nowSeconds - authTime >= 5 * 60) {
    throw new AccountSessionError('Please sign in again to establish a new session.', 401, 'recent_auth_required');
  }
}

// Firebase's supported server session flow:
// https://firebase.google.com/docs/auth/admin/manage-cookies
export async function exchangeAccountSession(idToken: string): Promise<{ uid: string; sessionCookie: string }> {
  if (!exchangeSchema.safeParse({ idToken }).success) throw new AccountSessionError('Invalid sign-in token.', 401, 'invalid_token');
  const provider = auth();
  try {
    const decoded = await provider.verifyIdToken(idToken, true);
    requireRecentAuthentication(decoded.auth_time);
    const sessionCookie = await provider.createSessionCookie(idToken, { expiresIn: ACCOUNT_SESSION_TTL_SECONDS * 1000 });
    return { uid: decoded.uid, sessionCookie };
  } catch (error) {
    if (error instanceof AccountSessionError) throw error;
    // Provider errors can contain account details; never return or log them here.
    throw new AccountSessionError('Sign-in could not be verified. Please sign in again.', 401, 'invalid_token');
  }
}

/** Returns identity only after verified signature, audience, expiry and revocation. */
export async function verifyAccountSession(request: Request): Promise<VerifiedAccount | null> {
  const matches = (request.headers.get('cookie') ?? '').split(';').map(value => value.trim()).filter(value => value.startsWith(`${ACCOUNT_SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  const cookie = matches[0].slice(ACCOUNT_SESSION_COOKIE.length + 1);
  if (cookie.length > 7168 || !jwtShape.test(cookie)) return null;
  const provider = auth();
  try {
    const decoded = await provider.verifySessionCookie(cookie, true);
    const account = Object.freeze({ uid: decoded.uid }) as VerifiedAccount;
    verifiedAccounts.add(account);
    return account;
  } catch { return null; }
}
