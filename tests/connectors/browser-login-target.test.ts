import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';

const fixture = vi.hoisted(() => ({ connection: null as any, pages: [] as any[], browser: null as any, checkpoint: true }));
vi.mock('../../src/lib/server/account-store', () => ({
  readAccountWorkspace: vi.fn(async () => ({ id: 'workspace-login', courses: [], sources: [] })),
  updateAccountWorkspace: vi.fn(),
}));
vi.mock('../../src/lib/server/connectors/store', () => ({
  readConnection: vi.fn(async () => fixture.connection),
  acquireConnectionLease: vi.fn(async () => ({ connection: structuredClone(fixture.connection), leaseId: 'lease-login' })),
  checkpointConnectionLease: vi.fn(async (_a, _id, _lease, patch) => { if (fixture.checkpoint) fixture.connection = { ...fixture.connection, ...patch }; return fixture.checkpoint; }),
  releaseConnectionLease: vi.fn(async (_a, _id, _lease, patch) => { fixture.connection = { ...fixture.connection, ...patch }; return true; }),
  connectionsForDeletion: vi.fn(), connectionPublicationGuard: vi.fn(), deleteConnection: vi.fn(), listConnections: vi.fn(), saveConnection: vi.fn(),
}));
vi.mock('playwright-core', () => ({ chromium: { connectOverCDP: vi.fn(async () => fixture.browser) } }));
import { completeBrowserLogin, startBrowserLogin } from '../../src/lib/server/connectors/browser';

const account = {} as VerifiedAccount;
function page(id: string, initialUrl = 'about:blank') {
  let url = initialUrl;
  return { id, url: () => url, isClosed: () => false, goto: vi.fn(async (next: string) => { url = next; }) };
}
function link(id: string, sessionId = 'session-login') {
  const url = new URL('https://www.browserbase.com/devtools-fullscreen-compiled/index.html');
  url.searchParams.set('wss', `connect.browserbase.com/debug/${sessionId}/devtools/page/${id}?t=synthetic-control-token`);
  return url.href;
}
function session() {
  return { id: 'session-login', contextId: 'context-login', projectId: 'project-login', status: 'RUNNING', expiresAt: new Date(Date.now() + 60_000).toISOString(), connectUrl: 'wss://connect.browserbase.com/synthetic', userMetadata: { somaOwner: createHash('sha256').update('workspace-login:browser-blackboard').digest('hex') } };
}
function respond(debug: unknown = { pages: [{ id: 'target-one', debuggerFullscreenUrl: link('target-one') }] }) {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = String(input);
    if (url.includes('/debug?')) return new Response(JSON.stringify(debug));
    if (url.endsWith('/sessions/session-login') && init?.method === 'POST') return new Response(JSON.stringify({}));
    if (url.endsWith('/sessions/session-login') || url.endsWith('/sessions')) return new Response(JSON.stringify(session()));
    throw new Error('Unexpected synthetic provider request');
  });
}
beforeEach(() => {
  vi.stubEnv('BROWSERBASE_API_KEY', 'synthetic-key'); vi.stubEnv('BROWSERBASE_PROJECT_ID', 'project-login'); vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  fixture.connection = { id: 'browser-blackboard', workspaceId: 'workspace-login', provider: 'blackboard', version: 1, status: 'connecting', configuration: { targets: [] }, secret: { contextId: 'context-login', sessionId: 'session-login' } };
  fixture.pages = [page('target-one')]; fixture.checkpoint = true;
  const context = { pages: () => fixture.pages, newPage: vi.fn(async () => { const next = page('target-new'); fixture.pages.push(next); return next; }),
    newCDPSession: vi.fn(async (selected: any) => ({ send: vi.fn(async () => ({ targetInfo: { targetId: selected.id } })), detach: vi.fn() })) };
  fixture.browser = { contexts: () => [context], close: vi.fn() };
  vi.stubGlobal('fetch', vi.fn()); respond();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('page-specific institutional login recovery (synthetic browser only)', () => {
  it('repairs an active wholly blank session and returns its exact page URL', async () => {
    const result = await startBrowserLogin(account, 'blackboard');
    expect(fixture.pages[0].goto).toHaveBeenCalledWith('https://learn.bu.edu/', expect.any(Object));
    expect(result.loginUrl).toBe(link('target-one'));
    expect(fixture.connection.secret.loginPageId).toBe('target-one');
    expect(fixture.browser.close).toHaveBeenCalledOnce();
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).endsWith('/sessions'))).toBe(false);
  });
  it('leaves an active SSO/MFA page untouched when another restored tab is blank', async () => {
    fixture.pages = [page('blank-tab'), page('sso-tab', 'https://shib.bu.edu/idp/profile/SAML2/Redirect/SSO')];
    respond({ pages: [{ id: 'blank-tab', debuggerFullscreenUrl: link('blank-tab') }, { id: 'sso-tab', debuggerFullscreenUrl: link('sso-tab') }] });
    expect((await startBrowserLogin(account, 'blackboard')).loginUrl).toBe(link('sso-tab'));
    for (const selected of fixture.pages) expect(selected.goto).not.toHaveBeenCalled();
  });
  it('retains the selected nonblank target regardless of debug page order', async () => {
    fixture.pages = [page('target-one', 'https://learn.bu.edu/ultra/course'), page('other-tab', 'https://learn.bu.edu/ultra/profile')];
    fixture.connection.secret.loginPageId = 'target-one';
    respond({ debuggerFullscreenUrl: link('other-tab'), pages: [{ id: 'other-tab', debuggerFullscreenUrl: link('other-tab') }, { id: 'target-one', debuggerFullscreenUrl: link('target-one') }] });
    expect((await startBrowserLogin(account, 'blackboard')).loginUrl).toBe(link('target-one'));
    for (const selected of fixture.pages) expect(selected.goto).not.toHaveBeenCalled();
  });
  it('allocates an empty session and navigates its newly created target', async () => {
    fixture.connection.secret = { contextId: 'context-login' }; fixture.pages = [];
    respond({ pages: [{ id: 'target-new', debuggerFullscreenUrl: link('target-new') }] });
    expect((await startBrowserLogin(account, 'blackboard')).loginUrl).toBe(link('target-new'));
    expect(fixture.pages[0].goto).toHaveBeenCalledOnce();
    expect(fixture.connection.secret.sessionId).toBe('session-login');
  });
  it.each([
    { pages: [] },
    { debuggerFullscreenUrl: link('target-one'), pages: [{ id: 'different-target', debuggerFullscreenUrl: link('different-target') }] },
    { pages: [{ id: 'target-one', debuggerFullscreenUrl: link('target-one') }, { id: 'target-one', debuggerFullscreenUrl: link('target-one') }] },
    { pages: [{ id: 'target-one', debuggerFullscreenUrl: link('different-target') }] },
    { pages: [{ id: 'target-one', debuggerFullscreenUrl: link('target-one', 'different-session') }] },
    { pages: [{ id: 'target-one', debuggerFullscreenUrl: 'https://browserbase.com.evil.test/login' }] },
    { pages: [{ id: 'target-one', debuggerFullscreenUrl: 'https://www.browserbase.com/generic-view' }] },
  ])('never returns a missing, ambiguous, mismatched or foreign page link', async debug => {
    respond(debug);
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_login_target' });
    expect(fixture.connection.secret.sessionId).toBe('session-login');
    expect(fixture.connection.secret.contextId).toBe('context-login');
    expect(fixture.connection.status).toBe('error');
    expect(fixture.browser.close).toHaveBeenCalledOnce();
  });
  it('does not publish a debug URL after its checkpoint loses ownership', async () => {
    fixture.checkpoint = false;
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toThrow('Source settings changed');
    expect(vi.mocked(fetch).mock.calls.some(([url]) => String(url).includes('/debug?'))).toBe(false);
    expect(fixture.browser.close).toHaveBeenCalledOnce();
  });
  it('clears the target reference when ending the interactive login session', async () => {
    fixture.connection.secret.loginPageId = 'target-one';
    await completeBrowserLogin(account, 'blackboard');
    expect(fixture.connection.secret.loginPageId).toBeUndefined();
    expect(fixture.connection.secret.sessionId).toBeUndefined();
    expect(fixture.connection.secret.contextId).toBe('context-login');
  });
});
