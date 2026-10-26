import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { getServerApp, getServerFirestore } from './firebase-config';
import { assertTrustedWorker, type TrustedWorker } from './worker-auth';

declare const accountBrand: unique symbol;
export type VerifiedAccount = Readonly<{ uid: string; [accountBrand]: true }>;
const verifiedAccounts = new WeakSet<object>();
const workerAccounts = new WeakMap<object, { rootId: string; workspaceId: string; expiresAt: number }>();

export function assertVerifiedAccount(account: VerifiedAccount): void {
  if (!account || !verifiedAccounts.has(account)) throw new AccountSessionError('A verified account session is required.', 401, 'account_required');
  const worker = workerAccounts.get(account);
  if (worker && worker.expiresAt <= Date.now()) throw new AccountSessionError('Worker account authorization expired.', 401, 'worker_account_expired');
}

/** Regular session behavior is unchanged; scheduled capabilities bind one generation. */
export function assertAccountWorkspaceGeneration(account: VerifiedAccount, workspaceId: string): void {
  assertVerifiedAccount(account);
  const worker = workerAccounts.get(account);
  if (worker && worker.workspaceId !== workspaceId) throw new AccountSessionError('Worker workspace generation changed.', 409, 'worker_workspace_changed');
}

/** Identity comes exclusively from a stored account root, after worker authentication. */
export async function verifyWorkerAccount(capability: TrustedWorker, rootId: string, workspaceId: string): Promise<VerifiedAccount | null> {
  assertTrustedWorker(capability);
  if (!/^[a-f0-9]{64}$/.test(rootId) || !workspaceId) return null;
  const ref = getServerFirestore().collection('somaAccounts').doc(rootId);
  const first = await ref.get(), data = first.data();
  if (!data || data.deleted || data.workspaceId !== workspaceId || typeof data.ownerId !== 'string' || createHash('sha256').update(data.ownerId).digest('hex') !== rootId) return null;
  try { if ((await auth().getUser(data.ownerId)).disabled) return null; }
  catch (error) { if ((error as { code?: string }).code === 'auth/user-not-found') return null; throw new AccountSessionError('Worker account verification is unavailable.', 503, 'worker_account_unavailable'); }
  const current = (await ref.get()).data();
  if (!current || current.deleted || current.ownerId !== data.ownerId || current.workspaceId !== workspaceId) return null;
  const account = Object.freeze({ uid: data.ownerId }) as VerifiedAccount;
  verifiedAccounts.add(account);
  workerAccounts.set(account, { rootId, workspaceId, expiresAt: capability.expiresAt });
  return account;
}

/** Recheck disabled/deleted identities before publishing a long-running worker result. */
export async function revalidateWorkerAccount(account: VerifiedAccount): Promise<void> {
  assertVerifiedAccount(account);
  const worker = workerAccounts.get(account); if (!worker) return;
  const current = (await getServerFirestore().collection('somaAccounts').doc(worker.rootId).get()).data();
  if (!current || current.deleted || current.ownerId !== account.uid || current.workspaceId !== worker.workspaceId) throw new AccountSessionError('Worker workspace is no longer active.', 409, 'worker_workspace_changed');
  try { if ((await auth().getUser(account.uid)).disabled) throw new Error('disabled'); }
  catch { throw new AccountSessionError('Worker account is no longer active.', 401, 'worker_account_inactive'); }
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
