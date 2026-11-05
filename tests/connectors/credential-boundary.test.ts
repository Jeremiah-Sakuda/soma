import { createHash, randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as credentialGrants from '../../src/lib/server/connectors/credential-grants';
import { credentialAutofillUidAllowed } from '../../src/lib/server/connectors/credential-settings';
import {
  validCredentialAuthorization,
  credentialGrantSchema,
} from '../../src/lib/server/connectors/credential-grants';
import {
  credentialAutofillConfigured,
  credentialServiceSettings,
  validateCredentialLoginUrl,
} from '../../src/lib/server/connectors/credential-login';
import { recentAccountAuthentication, type VerifiedAccount } from '../../src/lib/server/account';
import { POST as action } from '../../src/app/api/connectors/credentials/route';
import { POST as authorize } from '../../src/app/api/connectors/credentials/authorize/route';
import { createAppAuthorizer } from '../../services/credential-runner/authorize.mjs';
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const now = Date.now(),
  workspaceId = randomUUID();
const grant = {
  authorizationId: randomUUID(),
  uid: 'original-synthetic-credential-user',
  workspaceId,
  workspaceGeneration: workspaceId,
  owner: hash(`${workspaceId}:browser-blackboard`),
  provider: 'blackboard' as const,
  contextId: randomUUID(),
  connectionVersion: 1,
  recentAuthAt: Math.floor(now / 1000) - 10,
};
function configured() {
  vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS', undefined);
  vi.stubEnv('SOMA_BROWSER_BACKEND', 'gcp');
  vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  vi.stubEnv('SOMA_GCP_BROWSER_URL', 'https://synthetic-browser-123.us-east1.run.app');
  vi.stubEnv('SOMA_GCP_BROWSER_PROJECT_ID', 'synthetic');
  vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', 'b'.repeat(48));
  vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'true');
  vi.stubEnv('SOMA_CREDENTIAL_RUNNER_URL', 'https://synthetic-login-123.us-east1.run.app');
  vi.stubEnv('SOMA_CREDENTIAL_RUNNER_CONTROL_KEY', 'c'.repeat(48));
  vi.stubEnv('SOMA_CREDENTIAL_AUTHORIZATION_KEY', 'd'.repeat(48));
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});
describe('isolated credential broker security boundary', () => {
  beforeEach(configured);
  it('requires separate configured identities/origins and an explicit enable gate', () => {
    expect(credentialAutofillConfigured()).toBe(true);
    for (const [name, value] of [
      ['SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'false'],
      ['SOMA_CREDENTIAL_RUNNER_URL', 'https://synthetic-browser-123.us-east1.run.app'],
      ['SOMA_CREDENTIAL_RUNNER_URL', 'https://evil.example'],
      ['SOMA_CREDENTIAL_RUNNER_CONTROL_KEY', 'b'.repeat(48)],
      ['SOMA_CREDENTIAL_AUTHORIZATION_KEY', 'c'.repeat(48)],
    ]) {
      configured();
      vi.stubEnv(name, value);
      expect(credentialAutofillConfigured()).toBe(false);
    }
  });
  it('limits availability to exact server-side rollout UIDs while preserving unset multi-account behavior', () => {
    expect(credentialAutofillUidAllowed('another-normal-account')).toBe(true);
    expect(credentialAutofillConfigured('another-normal-account')).toBe(true);
    vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS', ` ${grant.uid},another-synthetic-user `);
    expect(credentialAutofillUidAllowed(grant.uid)).toBe(true);
    expect(credentialAutofillConfigured(grant.uid)).toBe(true);
    expect(credentialAutofillUidAllowed('another-synthetic-user')).toBe(true);
    expect(credentialAutofillConfigured('excluded-user')).toBe(false);
    expect(credentialAutofillUidAllowed('excluded-user')).toBe(false);
    expect(credentialAutofillConfigured()).toBe(false);
  });
  it('fails closed on malformed rollout lists without disabling cleanup configuration', () => {
    for (const value of [
      '',
      ' ',
      '*',
      'uid,,other',
      'uid,uid',
      'uid with spaces',
      '["uid"]',
      'x'.repeat(129),
    ]) {
      vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS', value);
      expect(credentialAutofillUidAllowed('uid')).toBe(false);
      expect(credentialAutofillConfigured('uid')).toBe(false);
      expect(() => credentialServiceSettings()).toThrow();
      expect(credentialServiceSettings(false).origin).toContain('synthetic-login');
    }
  });
  it('gates actual service callback principals before any authorization storage access', async () => {
    vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS', grant.uid);
    const check = vi
      .spyOn(credentialGrants, 'authorizeCredentialGrant')
      .mockResolvedValue({ identifier: 'original-synthetic@bu.edu' });
    const request = (uid: string) =>
      new Request('https://soma.example/api/connectors/credentials/authorize', {
        method: 'POST',
        headers: { authorization: `Bearer ${'d'.repeat(48)}`, 'content-type': 'application/json' },
        body: JSON.stringify({ ...grant, uid, purpose: 'session' }),
      });
    expect((await authorize(request('excluded-user'))).status).toBe(403);
    expect(check).not.toHaveBeenCalled();
    expect((await authorize(request(grant.uid))).status).toBe(200);
    expect(check).toHaveBeenCalledWith(grant, 'session');
    check.mockClear();
    vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS', '*');
    expect((await authorize(request(grant.uid))).status).toBe(403);
    expect(check).not.toHaveBeenCalled();
  });
  it('leaves credential cleanup configuration accessible when new setup is disabled', () => {
    vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'false');
    expect(() => credentialServiceSettings()).toThrow();
    expect(credentialServiceSettings(false).origin).toContain('synthetic-login');
  });
  it('pins the returned human entry link to one isolated session and origin', () => {
    const base = credentialServiceSettings().origin,
      valid = `${base}/login/${grant.authorizationId}#${'t'.repeat(43)}`;
    expect(validateCredentialLoginUrl(valid, grant.authorizationId)).toBe(valid);
    for (const bad of [
      valid.replace('synthetic-login', 'lookalike'),
      valid.replace(grant.authorizationId, randomUUID()),
      valid.replace('/login/', '/viewer/'),
      valid.replace('#', '?token='),
      valid.replace('https:', 'http:'),
      valid.replace('https://', 'https://user:password@'),
      valid + 'a',
    ])
      expect(() => validateCredentialLoginUrl(bad, grant.authorizationId)).toThrow();
  });
  it('cannot grant a recent credential operation with a forged verified-account object', () => {
    expect(() => recentAccountAuthentication({ uid: grant.uid } as VerifiedAccount)).toThrow(
      'verified account',
    );
  });
  it('enforces fresh secret operations while allowing bounded human MFA completion', () => {
    const record = { ...grant, active: true, expiresAt: now + 1800000 };
    expect(validCredentialAuthorization(record, grant, 'credential', now)).toBe(true);
    expect(
      validCredentialAuthorization(record, grant, 'credential', (grant.recentAuthAt + 300) * 1000),
    ).toBe(false);
    expect(validCredentialAuthorization(record, grant, 'session', now + 600000)).toBe(true);
    expect(validCredentialAuthorization(record, grant, 'session', record.expiresAt)).toBe(false);
    expect(validCredentialAuthorization({ ...record, active: false }, grant, 'session', now)).toBe(
      false,
    );
  });
  it('rejects every cross-owner/generation/context/provider/version principal transplant', () => {
    const record = { ...grant, active: true, expiresAt: now + 1800000 };
    const swapped = {
      authorizationId: randomUUID(),
      uid: 'other',
      owner: 'f'.repeat(64),
      workspaceId: randomUUID(),
      workspaceGeneration: randomUUID(),
      provider: 'piazza',
      contextId: randomUUID(),
      connectionVersion: 2,
      recentAuthAt: grant.recentAuthAt + 1,
    };
    for (const [key, value] of Object.entries(swapped))
      expect(
        validCredentialAuthorization(
          record,
          { ...grant, [key]: value } as typeof grant,
          'session',
          now,
        ),
      ).toBe(false);
    expect(
      validCredentialAuthorization(
        { ...record, owner: 'f'.repeat(64) },
        { ...grant, owner: 'f'.repeat(64) },
        'session',
        now,
      ),
    ).toBe(false);
    expect(
      credentialGrantSchema.safeParse({ ...grant, password: 'original-synthetic-canary' }).success,
    ).toBe(false);
  });
  it('blocks cross-origin and unauthenticated actions without accepting secret input', async () => {
    const request = (origin: string) =>
      new Request('https://soma.example/api/connectors/credentials', {
        method: 'POST',
        headers: { origin, 'content-type': 'application/json' },
        body: JSON.stringify({
          provider: 'blackboard',
          action: 'open',
          password: 'original-synthetic-canary',
        }),
      });
    const foreign = await action(request('https://evil.example'));
    expect(foreign.status).toBe(403);
    expect(await foreign.text()).not.toContain('canary');
    const missing = await action(request('https://soma.example'));
    expect(missing.status).toBe(401);
    expect(await missing.text()).not.toContain('canary');
  });
  it('requires the distinct service callback credential before reading principal data', async () => {
    for (const token of ['', `Bearer ${'c'.repeat(48)}`, `Bearer ${'b'.repeat(48)}`]) {
      const response = await authorize(
        new Request('https://soma.example/api/connectors/credentials/authorize', {
          method: 'POST',
          headers: { authorization: token, 'content-type': 'application/json' },
          body: JSON.stringify({
            ...grant,
            purpose: 'credential',
            password: 'original-synthetic-canary',
          }),
        }),
      );
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain('canary');
    }
    const response = await authorize(
      new Request('https://soma.example/api/connectors/credentials/authorize', {
        method: 'POST',
        headers: { authorization: `Bearer ${'d'.repeat(48)}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          ...grant,
          purpose: 'credential',
          password: 'original-synthetic-canary',
        }),
      }),
    );
    expect(response.status).toBe(403);
  });
  it('keeps the separate service callback fixed, bounded and free of extra secret fields', async () => {
    const fetchImpl = vi.fn(async () => Response.json({ identifier: 'original-synthetic@bu.edu' }));
    const checker = createAppAuthorizer({
      url: 'https://synthetic-app.vercel.app/api/connectors/credentials/authorize',
      key: 'd'.repeat(48),
      fetchImpl,
    });
    expect(
      await checker({ ...grant, password: 'original-synthetic-canary' }, { purpose: 'session' }),
    ).toEqual({ identifier: 'original-synthetic@bu.edu' });
    const args = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(args[0]).toBe('https://synthetic-app.vercel.app/api/connectors/credentials/authorize');
    expect(args[1].redirect).toBe('error');
    expect(args[1].body).not.toContain('canary');
    fetchImpl.mockImplementation(async () =>
      Response.json({ identifier: 'other@example.invalid' }),
    );
    await expect(checker(grant)).rejects.toMatchObject({
      code: 'credential_authorization_unavailable',
      status: 503,
    });
    for (const url of [
      'http://synthetic-app.vercel.app/api/connectors/credentials/authorize',
      'https://evil.example/api/connectors/credentials/authorize',
      'https://synthetic-app.vercel.app/api/connectors/credentials/authorize?redirect=evil',
      'https://synthetic-app.vercel.app/api/connectors/credentials',
    ])
      expect(() => createAppAuthorizer({ url, key: 'd'.repeat(48) })).toThrow();
  });
});
