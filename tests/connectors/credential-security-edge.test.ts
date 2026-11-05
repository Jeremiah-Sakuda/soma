import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ connection: null as any, patches: [] as any[] }));
vi.mock('../../src/lib/server/connectors/store', async (original) => ({
  ...(await original<any>()),
  acquireConnectionLease: vi.fn(async () => ({
    connection: structuredClone(state.connection),
    leaseId: 'original-lease',
  })),
  releaseConnectionLease: vi.fn(async (_a, _id, _lease, patch) => {
    state.patches.push(patch);
    return true;
  }),
}));
import { listGoogleCalendars } from '../../src/lib/server/connectors/google';
import type { VerifiedAccount } from '../../src/lib/server/account';
const account = {} as VerifiedAccount;
beforeEach(() => {
  for (const [key, value] of Object.entries({
    GOOGLE_OAUTH_CLIENT_ID: 'synthetic-client',
    GOOGLE_OAUTH_CLIENT_SECRET: 'synthetic-client-secret',
    SOMA_APP_URL: 'https://soma.example',
    SOMA_CONNECTOR_ENCRYPTION_KEY: 'ab'.repeat(32),
  }))
    vi.stubEnv(key, value);
  state.connection = {
    id: 'google-calendar',
    secret: {
      accessToken: 'expired-fixture',
      refreshToken: 'old-refresh-fixture',
      expiresAt: 0,
      scopes: ['https://www.googleapis.com/auth/calendar.events.readonly'],
    },
    configuration: {},
  };
  state.patches = [];
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe('Google credential refresh failure recovery', () => {
  it('retains a newly rotated refresh token when the subsequent selected read fails', async () => {
    const requests: { url: string; options: RequestInit }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url, options) => {
        requests.push({ url: String(url), options });
        return String(url).endsWith('/token')
          ? new Response(
              JSON.stringify({
                access_token: 'new-access-fixture',
                refresh_token: 'rotated-refresh-fixture',
                token_type: 'Bearer',
                expires_in: 3600,
              }),
            )
          : new Response('provider failure', { status: 503 });
      }),
    );
    await expect(listGoogleCalendars(account)).rejects.toMatchObject({ code: 'google_read' });
    expect(state.patches.at(-1).secret).toMatchObject({
      accessToken: 'new-access-fixture',
      refreshToken: 'rotated-refresh-fixture',
    });
    expect(requests[0].options.redirect).toBe('error');
    expect(requests[1].options.headers).toEqual({ Authorization: 'Bearer new-access-fixture' });
    expect(String(requests[1].options.body ?? '')).not.toContain('refresh');
  });
  it('does not replace saved credentials with malformed refresh responses or echo provider details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              access_token: '',
              refresh_token: 'malformed-new-token',
              expires_in: -1,
              error_description: 'synthetic-sensitive-provider-canary',
            }),
          ),
      ),
    );
    await expect(listGoogleCalendars(account)).rejects.toMatchObject({
      code: 'google_authorization',
    });
    expect(state.patches.at(-1).secret.refreshToken).toBe('old-refresh-fixture');
    expect(JSON.stringify(state.patches)).not.toContain('synthetic-sensitive-provider-canary');
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
