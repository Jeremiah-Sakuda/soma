import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';

// These tests exercise broker ordering and recovery, not Firestore or identity
// verification. Those boundaries have separate managed-storage checks.
const fixture = vi.hoisted(() => ({
  connection: null as any, marker: '', authorizationActive: false,
  events: [] as { kind: string; value?: any }[], reply: 'valid', deleteFails: false, releaseFails: false,
}));
vi.mock('../../src/lib/server/account', async importOriginal => ({
  ...await importOriginal<typeof import('../../src/lib/server/account')>(),
  assertVerifiedAccount: vi.fn(),
}));
vi.mock('../../src/lib/server/account-store', () => ({
  readAccountWorkspace: vi.fn(async () => ({ id: 'synthetic-credential-workspace', revision: 1, courses: [], sources: [], lessons: [] })),
  updateAccountWorkspace: vi.fn(async (_account, mutate) => mutate({ id: 'synthetic-credential-workspace', sources: [], lessons: [], courses: [] })),
}));
vi.mock('../../src/lib/server/connectors/store', () => ({
  readConnection: vi.fn(async () => structuredClone(fixture.connection)),
  listConnections: vi.fn(async () => [structuredClone(fixture.connection)]),
  connectionsForDeletion: vi.fn(async () => [structuredClone(fixture.connection)]),
  acquireConnectionLease: vi.fn(async () => ({ connection: structuredClone(fixture.connection), leaseId: 'synthetic-credential-lease' })),
  checkpointConnectionLease: vi.fn(async (_account, _id, _lease, patch) => {
    fixture.events.push({ kind: 'checkpoint', value: structuredClone(patch) });
    fixture.connection = { ...fixture.connection, ...structuredClone(patch) }; return true;
  }),
  releaseConnectionLease: vi.fn(async (_account, _id, _lease, patch) => {
    fixture.events.push({ kind: 'lease-release', value: structuredClone(patch) });
    fixture.connection = { ...fixture.connection, ...structuredClone(patch) }; return true;
  }),
  connectionPublicationGuard: vi.fn(), saveConnection: vi.fn(), deleteConnection: vi.fn(),
}));
vi.mock('../../src/lib/server/connectors/credential-grants', () => ({
  createCredentialAuthorization: vi.fn(async (_account, grant) => {
    expect(fixture.connection.secret.credentialLogin.authorizationId).toBe(grant.authorizationId);
    fixture.events.push({ kind: 'authorize', value: structuredClone(grant) });
    fixture.marker = grant.authorizationId; fixture.authorizationActive = true;
  }),
  revokeCredentialAuthorization: vi.fn(async (_account, _workspace, id) => {
    fixture.events.push({ kind: 'revoke', value: id }); fixture.authorizationActive = false;
  }),
  clearCredentialAuthorizationReference: vi.fn(async (_account, _workspace, id) => {
    fixture.events.push({ kind: 'clear-reference', value: id });
    if (fixture.marker === id) fixture.marker = '';
  }),
}));
vi.mock('playwright-core', () => ({ chromium: { connectOverCDP: vi.fn() } }));

import { chromium } from 'playwright-core';
import { cleanupBrowsersForDeletion, startBrowserLogin, withBrowserRead } from '../../src/lib/server/connectors/browser';
import { credentialLoginStatus, finishCredentialLogin, forgetStoredCredential, openCredentialLogin } from '../../src/lib/server/connectors/credential-login';

const account = { uid: 'synthetic-credential-owner' } as VerifiedAccount;
const loginOrigin = 'https://synthetic-login-123.us-east1.run.app';
const browserOrigin = 'https://synthetic-browser-123.us-east1.run.app';
const contextId = '260ef7f8-bd43-4d93-9665-88a80538165f';
const otherId = '5ebc887b-ffcd-45d7-819f-eaf09b0db14b';
const owner = createHash('sha256').update('synthetic-credential-workspace:browser-blackboard').digest('hex');
const configuration = { targets: [{ courseId: 'synthetic-course', url: 'https://learn.bu.edu/ultra/courses/_synthetic_1/outline' }] };
function pending() {
  const authorizationId = otherId;
  fixture.connection.secret = { backend: 'gcp', version: 1, contextId, credentialVault: true, credentialLogin: { authorizationId, sessionId: authorizationId, expiresAt: new Date(Date.now() + 1800000).toISOString() } };
  fixture.marker = authorizationId; fixture.authorizationActive = true;
  return authorizationId;
}
function remoteEvents() { return fixture.events.filter(event => event.kind === 'remote'); }

beforeEach(() => {
  fixture.connection = { id: 'browser-blackboard', workspaceId: 'synthetic-credential-workspace', provider: 'blackboard', version: 7, status: 'connected', secret: { backend: 'gcp', version: 1, contextId }, configuration: structuredClone(configuration) };
  fixture.marker = ''; fixture.authorizationActive = false; fixture.events = []; fixture.reply = 'valid'; fixture.deleteFails = false; fixture.releaseFails = false;
  vi.stubEnv('SOMA_BROWSER_BACKEND', 'gcp'); vi.stubEnv('SOMA_GCP_BROWSER_URL', browserOrigin);
  vi.stubEnv('SOMA_GCP_BROWSER_PROJECT_ID', 'synthetic-project'); vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', 'b'.repeat(48));
  vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'ab'.repeat(32));
  vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'true'); vi.stubEnv('SOMA_CREDENTIAL_RUNNER_URL', loginOrigin);
  vi.stubEnv('SOMA_CREDENTIAL_RUNNER_CONTROL_KEY', 'c'.repeat(48)); vi.stubEnv('SOMA_CREDENTIAL_AUTHORIZATION_KEY', 'd'.repeat(48));
  vi.stubGlobal('fetch', vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = new URL(String(input));
    const method = init?.method ?? 'GET', body = init?.body ? JSON.parse(String(init.body)) : undefined;
    fixture.events.push({ kind: 'remote', value: { origin: url.origin, path: url.pathname, method, body, headers: init?.headers } });
    if (url.origin === browserOrigin) {
      if (method === 'POST' && url.pathname === '/v1/contexts') return Response.json({ id: contextId });
      if (method === 'DELETE') return new Response(null, { status: 204 });
      if (method === 'GET') return new Response(null, { status: 404 });
    }
    if (url.origin === loginOrigin && method === 'POST' && url.pathname === '/v1/grants') {
      // Remote allocation must already have both an encrypted session cleanup
      // reference and a durable authorization marker, even if this call fails.
      expect(fixture.connection.secret.credentialLogin).toMatchObject({ authorizationId: body.authorizationId, sessionId: body.authorizationId });
      expect(fixture.marker).toBe(body.authorizationId); expect(fixture.authorizationActive).toBe(true);
      if (fixture.reply === 'unavailable') return Response.json({ error: 'synthetic provider error' }, { status: 503 });
      return Response.json({ sessionId: fixture.reply === 'foreign-id' ? otherId : body.authorizationId,
        loginUrl: `${fixture.reply === 'foreign-url' ? 'https://foreign.example' : loginOrigin}/login/${body.authorizationId}#${'t'.repeat(43)}`,
        expiresAt: fixture.connection.secret.credentialLogin.expiresAt });
    }
    if (url.origin === loginOrigin && url.pathname.endsWith('/release')) return new Response(null, { status: fixture.releaseFails ? 503 : 204 });
    if (url.origin === loginOrigin && method === 'DELETE') return new Response(null, { status: fixture.deleteFails ? 503 : 204 });
    throw new Error('Unexpected synthetic credential broker request.');
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('isolated credential-login broker lifecycle with synthetic services', () => {
  it('checkpoints context and session references and authorizes before remote allocation, without sending credential values or a body owner', async () => {
    fixture.connection.secret = { backend: 'gcp', version: 1 };
    const result = await openCredentialLogin(account, 'blackboard', Math.floor(Date.now() / 1000));
    expect(fixture.events.map(event => event.kind)).toEqual(['remote', 'checkpoint', 'checkpoint', 'authorize', 'remote', 'lease-release']);
    const call = remoteEvents().find(event => event.value.path === '/v1/grants')!.value;
    expect(call.headers['X-Soma-Owner']).toBe(owner);
    expect(call.body).toEqual({ authorizationId: expect.any(String), uid: account.uid, workspaceId: 'synthetic-credential-workspace', workspaceGeneration: 'synthetic-credential-workspace', provider: 'blackboard', contextId, connectionVersion: 7, recentAuthAt: expect.any(Number) });
    expect(call.body).not.toHaveProperty('owner'); expect(call.body).not.toHaveProperty('password');
    expect(fixture.connection.secret.credentialLogin.sessionId).toBe(call.body.authorizationId);
    expect(result.loginUrl).toBe(`${loginOrigin}/login/${call.body.authorizationId}#${'t'.repeat(43)}`);
    expect(JSON.stringify(fixture.connection)).not.toContain('t'.repeat(43));
    expect(fixture.connection.configuration).toEqual(configuration);
  });

  it.each(['foreign-id', 'foreign-url', 'unavailable'])('retains cleanup and authorization references after a %s allocation response', async reply => {
    fixture.reply = reply;
    await expect(openCredentialLogin(account, 'blackboard', Math.floor(Date.now() / 1000))).rejects.toMatchObject({ code: 'credential_service' });
    const ref = fixture.connection.secret.credentialLogin;
    expect(ref.sessionId).toBe(ref.authorizationId); expect(fixture.marker).toBe(ref.authorizationId);
    expect(fixture.connection.secret.credentialVault).toBe(true);
    expect(fixture.connection.configuration).toEqual(configuration);
    expect(fixture.events.some(event => event.kind === 'clear-reference')).toBe(false);
  });

  it('does not steal an existing manual login session', async () => {
    fixture.connection.secret.sessionId = 'synthetic-manual-session';
    const before = structuredClone(fixture.connection.secret);
    await expect(openCredentialLogin(account, 'blackboard', Math.floor(Date.now() / 1000))).rejects.toMatchObject({ status: 409 });
    expect(fixture.connection.secret).toEqual(before); expect(fetch).not.toHaveBeenCalled(); expect(fixture.marker).toBe('');
  });

  it('does not replace an already pending secure login or allocate a second window', async () => {
    const id = pending();
    await expect(openCredentialLogin(account, 'blackboard', Math.floor(Date.now() / 1000))).rejects.toMatchObject({ status: 409 });
    expect(fetch).not.toHaveBeenCalled(); expect(fixture.connection.secret.credentialLogin.authorizationId).toBe(id);
  });

  it('revokes before cancellation and retains exact cleanup references when DELETE fails, then recovers on retry', async () => {
    const id = pending(); fixture.deleteFails = true;
    await expect(finishCredentialLogin(account, 'blackboard', true)).rejects.toMatchObject({ code: 'credential_service' });
    expect(fixture.events.slice(0, 2).map(event => event.kind)).toEqual(['revoke', 'remote']);
    expect(fixture.authorizationActive).toBe(false); expect(fixture.marker).toBe(id);
    expect(fixture.connection.secret.credentialLogin.sessionId).toBe(id);
    fixture.deleteFails = false;
    await finishCredentialLogin(account, 'blackboard', true);
    expect(fixture.marker).toBe(''); expect(fixture.connection.secret).not.toHaveProperty('credentialLogin');
    expect(fixture.connection.secret.credentialVault).toBe(true);
    expect(fixture.connection.configuration).toEqual(configuration);
  });

  it('only clears completion references after a confirmed remote release', async () => {
    const id = pending(); fixture.releaseFails = true;
    await expect(finishCredentialLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'credential_service' });
    expect(fixture.marker).toBe(id); expect(fixture.authorizationActive).toBe(true);
    expect(fixture.connection.secret.credentialLogin.sessionId).toBe(id);
    expect(fixture.events.some(event => event.kind === 'revoke')).toBe(false);
    fixture.events = []; fixture.releaseFails = false;
    await finishCredentialLogin(account, 'blackboard');
    expect(fixture.events.map(event => event.kind)).toEqual(['remote', 'revoke', 'clear-reference', 'lease-release']);
    expect(fixture.marker).toBe(''); expect(fixture.connection.secret).not.toHaveProperty('credentialLogin');
    expect(fixture.connection.status).toBe('connected');
  });

  it('permits forget with the feature disabled while preserving course mappings and saved browser context', async () => {
    pending(); vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'false');
    await forgetStoredCredential(account);
    expect(remoteEvents().map(event => [event.value.method, event.value.path])).toEqual([['DELETE', `/v1/sessions/${otherId}`], ['DELETE', '/v1/credentials']]);
    expect(fixture.connection.secret).toEqual({ backend: 'gcp', version: 1, contextId });
    expect(fixture.connection.configuration).toEqual(configuration); expect(fixture.marker).toBe('');
  });

  it('keeps the vault cleanup marker when forgetting fails and still allows a disabled-feature retry', async () => {
    fixture.connection.secret.credentialVault = true; fixture.deleteFails = true;
    vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'false');
    await expect(forgetStoredCredential(account)).rejects.toMatchObject({ code: 'credential_service' });
    expect(fixture.connection.secret.credentialVault).toBe(true);
    fixture.deleteFails = false; await forgetStoredCredential(account);
    expect(fixture.connection.secret).not.toHaveProperty('credentialVault'); expect(fixture.connection.configuration).toEqual(configuration);
  });

  it('cleans optional credentials and context for a frozen account even when new autofill is disabled', async () => {
    pending(); vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'false');
    const before = structuredClone(fixture.connection);
    await cleanupBrowsersForDeletion(account, 'synthetic-credential-workspace');
    expect(remoteEvents().map(event => [event.value.origin, event.value.method, event.value.path])).toEqual([
      [loginOrigin, 'DELETE', `/v1/sessions/${otherId}`], [loginOrigin, 'DELETE', '/v1/credentials'],
      [browserOrigin, 'DELETE', `/v1/contexts/${contextId}`], [browserOrigin, 'GET', `/v1/contexts/${contextId}`],
    ]);
    expect(fixture.marker).toBe('');
    // Account deletion's frozen store owns final local erasure, not this broker.
    expect(fixture.connection).toEqual(before);
  });

  it('blocks normal browser start and collection while secure login is active', async () => {
    pending(); const collector = vi.fn();
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ status: 409, code: 'credential_login_active' });
    await expect(withBrowserRead(account, 'blackboard', () => true, collector)).rejects.toMatchObject({ status: 409, code: 'credential_login_active' });
    expect(fetch).not.toHaveBeenCalled(); expect(collector).not.toHaveBeenCalled(); expect(chromium.connectOverCDP).not.toHaveBeenCalled();
  });

  it('reports pending recovery metadata without exposing private window addresses when disabled', async () => {
    pending(); vi.stubEnv('SOMA_CREDENTIAL_AUTOFILL_ENABLED', 'false');
    const status = await credentialLoginStatus(account);
    expect(status).toEqual({ configured: false, providers: [{ provider: 'blackboard', available: false, stored: true, active: { expiresAt: fixture.connection.secret.credentialLogin.expiresAt } }] });
    expect(JSON.stringify(status)).not.toContain(otherId); expect(JSON.stringify(status)).not.toContain(contextId);
  });
});
