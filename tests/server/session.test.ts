import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  readSessionToken,
  sessionCookieOptions,
  SESSION_COOKIE,
} from '../../src/lib/server/session';

describe('session cookie boundary', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('accepts only exactly one syntactically valid session cookie', async () => {
    const token = 'a'.repeat(64);
    const request = (cookie: string) =>
      new Request('https://soma.example/api/workspace', { headers: { cookie } });
    expect(await readSessionToken(request(`other=1; ${SESSION_COOKIE}=${token}`))).toBe(token);
    expect(await readSessionToken(request(`${SESSION_COOKIE}=workspace-id`))).toBeUndefined();
    expect(
      await readSessionToken(request(`${SESSION_COOKIE}=${token}; ${SESSION_COOKIE}=${token}`)),
    ).toBeUndefined();
    expect(await readSessionToken(request(''))).toBeUndefined();
  });
  it('makes production cookies secure, httpOnly and same-site with a bounded lifetime', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions()).toEqual({
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      maxAge: 86400,
      path: '/',
    });
  });
});
