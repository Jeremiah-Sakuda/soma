import { afterEach, describe, expect, it, vi } from 'vitest';
import { ACCOUNT_SESSION_COOKIE, accountSessionCookieOptions, exchangeAccountSession, readAccountExchange, requireRecentAuthentication, verifyAccountSession } from '../../src/lib/server/account';
import { DELETE, GET, POST } from '../../src/app/api/auth/session/route';

const unsignedToken = `${Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url')}.${Buffer.from(JSON.stringify({ sub: 'attacker', aud: 'soma-test', iss: 'https://securetoken.google.com/soma-test', auth_time: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url')}.fake`;
const request = (body: string, headers: Record<string, string> = {}) => new Request('https://soma.example/api/auth/session', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://soma.example', ...headers }, body });

describe('Firebase account boundary', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('requires same-origin exchanges and logout, before reading credentials', async () => {
    expect((await POST(request('{}', { origin: 'https://attacker.example' }))).status).toBe(403);
    expect((await POST(request('{}', { 'sec-fetch-site': 'cross-site' }))).status).toBe(403);
    expect((await DELETE(new Request('https://soma.example/api/auth/session', { method: 'DELETE' }))).status).toBe(403);
  });

  it('rejects spoofed identity fields, malformed JSON and content-type tricks', async () => {
    await expect(readAccountExchange(request(JSON.stringify({ idToken: unsignedToken, uid: 'victim' })))).rejects.toMatchObject({ status: 400 });
    await expect(readAccountExchange(request('{'))).rejects.toMatchObject({ status: 400 });
    await expect(readAccountExchange(request('{}', { 'content-type': 'application/json-malicious' }))).rejects.toMatchObject({ status: 415 });
    await expect(readAccountExchange(request(JSON.stringify({ idToken: 'arbitrary-account-id' })))).rejects.toMatchObject({ status: 400 });
  });

  it('enforces actual bytes even when Content-Length lies', async () => {
    await expect(readAccountExchange(request(' '.repeat(8193), { 'content-length': '2' }))).rejects.toMatchObject({ status: 413 });
  });

  it('rejects old or future authentication timestamps at the exact boundary', () => {
    expect(() => requireRecentAuthentication(701, 1000)).not.toThrow();
    for (const timestamp of [700, 0, 1001, Infinity, NaN]) expect(() => requireRecentAuthentication(timestamp, 1000)).toThrow('Please sign in again');
  });

  it('rejects unsigned forged credentials through the actual Admin verifier', async () => {
    vi.stubEnv('FIREBASE_PROJECT_ID', 'soma-test');
    vi.stubEnv('FIREBASE_AUTH_EMULATOR_HOST', '');
    await expect(exchangeAccountSession(unsignedToken)).rejects.toMatchObject({ status: 401, code: 'invalid_token' });
    expect(await verifyAccountSession(new Request('https://soma.example', { headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${unsignedToken}` } }))).toBeNull();
  });

  it('cannot authenticate through demo cookies or duplicate account cookies', async () => {
    expect(await verifyAccountSession(new Request('https://soma.example', { headers: { cookie: `soma_session=${'a'.repeat(64)}` } }))).toBeNull();
    expect(await verifyAccountSession(new Request('https://soma.example', { headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${unsignedToken}; ${ACCOUNT_SESSION_COOKIE}=${unsignedToken}` } }))).toBeNull();
    const response = await GET(new Request('https://soma.example/api/auth/session'));
    expect(await response.json()).toEqual({ authenticated: false, accountWorkspaceAvailable: false });
  });

  it('expires only the account cookie on logout and applies production protections', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(accountSessionCookieOptions()).toEqual({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 86400 });
    const response = await DELETE(new Request('https://soma.example/api/auth/session', { method: 'DELETE', headers: { origin: 'https://soma.example' } }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain(`${ACCOUNT_SESSION_COOKIE}=`);
    expect(response.headers.get('set-cookie')).toContain('Max-Age=0');
    expect(response.headers.get('set-cookie')).not.toContain('soma_session');
  });
});
