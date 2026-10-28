import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';

const fixture = vi.hoisted(() => ({ connection: null as any, browser: null as any, calls: [] as { origin: string; path: string; method: string; headers: Record<string, string>; body?: any }[], contextPresent: false }));
vi.mock('../../src/lib/server/account-store', () => ({ readAccountWorkspace: vi.fn(async () => ({ id: 'synthetic-hosting-workspace', revision: 1, courses: [{ id: 'synthetic-course' }], sources: [], lessons: [] })), updateAccountWorkspace: vi.fn(async (_account, mutate) => mutate({ id: 'synthetic-hosting-workspace', sources: [], lessons: [], courses: [{ id: 'synthetic-course' }] })) }));
vi.mock('../../src/lib/server/connectors/store', () => ({
  readConnection: vi.fn(async () => fixture.connection), listConnections: vi.fn(async () => fixture.connection ? [fixture.connection] : []),
  connectionsForDeletion: vi.fn(async () => fixture.connection ? [fixture.connection] : []),
  acquireConnectionLease: vi.fn(async () => ({ connection: structuredClone(fixture.connection), leaseId: 'synthetic-hosting-lease' })),
  checkpointConnectionLease: vi.fn(async (_account, _id, _lease, patch) => { fixture.connection = { ...fixture.connection, ...structuredClone(patch) }; return true; }),
  releaseConnectionLease: vi.fn(async (_account, _id, _lease, patch) => { fixture.connection = { ...fixture.connection, ...structuredClone(patch) }; return true; }),
  connectionPublicationGuard: vi.fn(), saveConnection: vi.fn(), deleteConnection: vi.fn(async () => { fixture.connection = null; }),
}));
vi.mock('playwright-core', () => ({ chromium: { connectOverCDP: vi.fn(async () => fixture.browser) } }));
import { chromium } from 'playwright-core';
import { startBrowserLogin, refreshBrowser, withBrowserRead, disconnectBrowser, cleanupBrowsersForDeletion } from '../../src/lib/server/connectors/browser';

const account = {} as VerifiedAccount; // Actual identity/storage ownership is covered by managed account tests.
const origin = 'https://synthetic-browser-123.us-east1.run.app', owner = createHash('sha256').update('synthetic-hosting-workspace:browser-blackboard').digest('hex');
const controlKey = 'original-synthetic-gcp-control-key-123456789';
function connection(secret: Record<string, unknown> = {}) {
  return { id: 'browser-blackboard', workspaceId: 'synthetic-hosting-workspace', provider: 'blackboard', version: 1, status: 'connected', secret, configuration: {
    targets: [{ courseId: 'synthetic-course', url: 'https://learn.bu.edu/ultra/courses/_synthetic_1/outline' }],
    blackboard: { mode: 'courses', selected: [{ id: '_synthetic_1', courseId: 'synthetic-course' }], catalogIds: ['_synthetic_1'], catalogCheckedAt: '2026-10-27T12:00:00Z', catalogComplete: true, catalogEpoch: 'old-synthetic-epoch', catalogSubjectId: '_synthetic_user_1' },
  } };
}
function session(backend: 'browserbase' | 'gcp') {
  return { id: backend === 'gcp' ? 'gcp-session' : 'bb-session', contextId: backend === 'gcp' ? 'gcp-context' : 'bb-context', projectId: backend === 'gcp' ? 'gcp-project' : 'bb-project', status: 'RUNNING', expiresAt: new Date(Date.now() + 60_000).toISOString(), connectUrl: backend === 'gcp' ? origin.replace('https:', 'wss:') + '/cdp/gcp-session' : 'wss://connect.browserbase.com/synthetic', userMetadata: { somaOwner: owner } };
}
function respond() {
  vi.mocked(fetch).mockImplementation(async (input, init) => {
    const url = new URL(String(input)), method = init?.method ?? 'GET';
    fixture.calls.push({ origin: url.origin, path: url.pathname, method, headers: init?.headers as Record<string, string>, ...(init?.body ? { body: JSON.parse(String(init.body)) } : {}) });
    // Match the observed legacy API's strict empty-JSON rejection during cutover.
    if (method === 'DELETE' && !init?.body && (init?.headers as Record<string, string>)['Content-Type'] === 'application/json') return Response.json({ code: 'empty_json_body' }, { status: 400 });
    if (url.hostname === 'api.browserbase.com') {
      if (method === 'GET' && url.pathname === '/v1/sessions/bb-session') return Response.json(session('browserbase'));
      if (method === 'POST' && url.pathname === '/v1/sessions/bb-session') return new Response(null, { status: 204 });
      if (method === 'DELETE' && url.pathname === '/v1/contexts/bb-context') return new Response(null, { status: 204 });
    }
    if (url.origin === origin) {
      if (method === 'POST' && url.pathname === '/v1/contexts') return Response.json({ id: 'gcp-context' });
      if (method === 'POST' && url.pathname === '/v1/sessions') return Response.json(session('gcp'));
      if (method === 'GET' && url.pathname === '/v1/sessions/gcp-session') return Response.json(session('gcp'));
      if (method === 'POST' && url.pathname === '/v1/sessions/gcp-session') return new Response(null, { status: 204 });
      if (method === 'GET' && url.pathname === '/v1/sessions/gcp-session/debug') return Response.json({ pages: [{ id: 'synthetic-page', debuggerFullscreenUrl: `${origin}/viewer/gcp-session#${'t'.repeat(43)}` }] });
      if (method === 'DELETE' && url.pathname === '/v1/contexts/gcp-context') return new Response(null, { status: 204 });
      if (method === 'GET' && url.pathname === '/v1/contexts/gcp-context') return fixture.contextPresent ? Response.json({ id: 'gcp-context' }) : new Response(null, { status: 404 });
    }
    throw new Error('Unexpected original synthetic hosting request.');
  });
}
beforeEach(() => {
  vi.stubEnv('SOMA_BROWSER_BACKEND', 'gcp'); vi.stubEnv('SOMA_GCP_BROWSER_URL', origin); vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', controlKey); vi.stubEnv('SOMA_GCP_BROWSER_PROJECT_ID', 'gcp-project');
  vi.stubEnv('BROWSERBASE_API_KEY', 'original-synthetic-browserbase-key'); vi.stubEnv('BROWSERBASE_PROJECT_ID', 'bb-project'); vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'ab'.repeat(32));
  fixture.connection = connection(); fixture.calls = []; fixture.contextPresent = false;
  const page = { url: () => 'about:blank', isClosed: () => false, goto: vi.fn() };
  const context = { pages: () => [page], newCDPSession: vi.fn(async () => ({ send: vi.fn(async () => ({ targetInfo: { targetId: 'synthetic-page' } })), detach: vi.fn() })) };
  fixture.browser = { contexts: () => [context], close: vi.fn() };
  vi.stubGlobal('fetch', vi.fn()); respond();
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('GCP cutover and recorded-backend cleanup with original synthetic responses', () => {
  it('releases and deletes legacy resources before new allocation, preserves target mappings and invalidates the reconnect catalog', async () => {
    fixture.connection = connection({ contextId: 'bb-context', sessionId: 'bb-session' });
    const targets = structuredClone(fixture.connection.configuration.targets), selected = structuredClone(fixture.connection.configuration.blackboard.selected);
    const result = await startBrowserLogin(account, 'blackboard');
    expect(fixture.calls.slice(0, 4).map(call => [call.origin, call.path, call.method])).toEqual([
      ['https://api.browserbase.com', '/v1/sessions/bb-session', 'GET'], ['https://api.browserbase.com', '/v1/sessions/bb-session', 'POST'],
      ['https://api.browserbase.com', '/v1/contexts/bb-context', 'DELETE'], [origin, '/v1/contexts', 'POST'],
    ]);
    expect(fixture.calls.find(call => call.path === '/v1/contexts')!.body).toEqual({ projectId: 'gcp-project', userMetadata: { somaOwner: owner } });
    expect(fixture.calls.find(call => call.path === '/v1/sessions' && call.method === 'POST')!.body.timeout).toBe(1800);
    for (const call of fixture.calls.filter(call => call.origin === origin)) expect(call.headers).toEqual({ Authorization: `Bearer ${controlKey}`, 'X-Soma-Owner': owner, ...(call.body ? { 'Content-Type': 'application/json' } : {}) });
    expect(fixture.calls.find(call => call.method === 'DELETE')!.headers).not.toHaveProperty('Content-Type');
    expect(chromium.connectOverCDP).toHaveBeenCalledWith(origin.replace('https:', 'wss:') + '/cdp/gcp-session', { timeout: 15_000, headers: { Authorization: `Bearer ${controlKey}`, 'X-Soma-Owner': owner } });
    expect(fixture.connection.secret).toMatchObject({ backend: 'gcp', version: 1, contextId: 'gcp-context', sessionId: 'gcp-session' });
    expect(fixture.connection.configuration.targets).toEqual(targets);
    expect(fixture.connection.configuration.blackboard).toMatchObject({ selected, catalogIds: [], catalogCheckedAt: '', catalogComplete: false });
    expect(fixture.connection.configuration.blackboard.catalogEpoch).not.toBe('old-synthetic-epoch');
    expect(result.loginUrl).toBe(`${origin}/viewer/gcp-session#${'t'.repeat(43)}`);
    expect(JSON.stringify(fixture.connection.secret)).not.toContain('t'.repeat(43));
  });
  it('replaces an expired GCP session in one action without the legacy sync delay', async () => {
    fixture.connection = connection({ backend: 'gcp', version: 1, contextId: 'gcp-context', sessionId: 'expired-gcp-session', sessionExpiresAt: new Date(Date.now() - 1000).toISOString(), readyAt: new Date(Date.now() + 5000).toISOString() });
    const original = vi.mocked(fetch).getMockImplementation()!;
    vi.mocked(fetch).mockImplementation(async (input, init) => String(input).endsWith('/sessions/expired-gcp-session') ? new Response(null, { status: 404 }) : original(input, init));
    const result = await startBrowserLogin(account, 'blackboard');
    expect(result.loginUrl).toContain('/viewer/gcp-session#');
    expect(fixture.connection.secret).not.toHaveProperty('readyAt');
    expect(fixture.calls.filter(call => call.path === '/v1/sessions' && call.method === 'POST')).toHaveLength(1);
  });
  it('preserves early missing-session facts and does not reclaim a potentially live durable lease', async () => {
    fixture.connection = connection({ backend: 'gcp', version: 1, contextId: 'gcp-context', sessionId: 'missing-gcp-session', sessionExpiresAt: new Date(Date.now() + 120000).toISOString() });
    const before = structuredClone(fixture.connection.secret);
    vi.mocked(fetch).mockResolvedValue(new Response(null, { status: 404 }));
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_session_lost', status: 409 });
    expect(fixture.connection.secret).toEqual(before);
    expect(vi.mocked(fetch).mock.calls.every(([, init]) => init?.method === 'GET')).toBe(true);
  });
  it('retains exact legacy authorization and configuration if cutover cleanup fails, without allocating GCP resources', async () => {
    fixture.connection = connection({ contextId: 'bb-context' });
    const before = structuredClone(fixture.connection);
    vi.mocked(fetch).mockResolvedValue(new Response('original-synthetic-error', { status: 503 }));
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_provider' });
    expect(fixture.connection.secret).toEqual(before.secret); expect(fixture.connection.configuration).toEqual(before.configuration);
    expect(vi.mocked(fetch).mock.calls).toHaveLength(1); expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('https://api.browserbase.com/v1/contexts/bb-context');
    expect(chromium.connectOverCDP).not.toHaveBeenCalled();
  });
  it('requires reconnect for a legacy read after cutover without contacting either service or running the collector', async () => {
    fixture.connection = connection({ contextId: 'bb-context' });
    const operation = vi.fn();
    await expect(withBrowserRead(account, 'blackboard', () => true, operation)).rejects.toMatchObject({ code: 'browser_login_required' });
    // Exercise the separate exact-page reader as well as the shared adapter runner.
    fixture.connection.provider = 'gradescope'; fixture.connection.id = 'browser-gradescope'; fixture.connection.configuration = { targets: [{ courseId: 'synthetic-course', url: 'https://www.gradescope.com/courses/123' }] };
    await expect(refreshBrowser(account, 'gradescope')).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(fetch).not.toHaveBeenCalled(); expect(operation).not.toHaveBeenCalled();
  });
  it('dispatches legacy disconnect through Browserbase even with GCP configured', async () => {
    fixture.connection = connection({ contextId: 'bb-context' });
    await disconnectBrowser(account, 'blackboard');
    expect(fixture.calls.map(call => [call.origin, call.method, call.path])).toEqual([['https://api.browserbase.com', 'DELETE', '/v1/contexts/bb-context']]);
    expect(fixture.connection).toBeNull();
  });
  it('requires confirmed GCP deletion before local erasure and supports frozen workspace cleanup', async () => {
    fixture.connection = connection({ backend: 'gcp', version: 1, contextId: 'gcp-context' }); fixture.contextPresent = true;
    await expect(disconnectBrowser(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_cleanup_pending' });
    expect(fixture.connection.secret.contextId).toBe('gcp-context');
    fixture.contextPresent = false;
    await cleanupBrowsersForDeletion(account, 'synthetic-hosting-workspace');
    expect(fixture.calls.slice(-2).map(call => [call.method, call.path])).toEqual([['DELETE', '/v1/contexts/gcp-context'], ['GET', '/v1/contexts/gcp-context']]);
    expect(fixture.connection.secret.contextId).toBe('gcp-context'); // Frozen store owns final erasure.
    await disconnectBrowser(account, 'blackboard'); expect(fixture.connection).toBeNull();
  });
  it('rejects unknown saved hosting versions and cross-backend CDP addresses while retaining cleanup references', async () => {
    fixture.connection = connection({ backend: 'gcp', version: 2, contextId: 'gcp-context' });
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_backend' }); expect(fetch).not.toHaveBeenCalled();
    fixture.connection = connection({ backend: 'gcp', version: 1, contextId: 'gcp-context', sessionId: 'gcp-session' });
    vi.mocked(fetch).mockResolvedValue(Response.json({ ...session('gcp'), connectUrl: 'wss://connect.browserbase.com/synthetic' }));
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_connect_target' });
    expect(chromium.connectOverCDP).not.toHaveBeenCalled(); expect(fixture.connection.secret.contextId).toBe('gcp-context');
  });
  it('rejects GCP sessions with missing or swapped context identity before connecting', async () => {
    fixture.connection = connection({ backend: 'gcp', version: 1, contextId: 'gcp-context', sessionId: 'gcp-session' });
    const { contextId: _context, ...withoutContext } = session('gcp');
    vi.mocked(fetch).mockResolvedValueOnce(Response.json(withoutContext));
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_owner' });
    vi.mocked(fetch).mockResolvedValueOnce(Response.json({ ...session('gcp'), contextId: 'different-gcp-context' }));
    await expect(startBrowserLogin(account, 'blackboard')).rejects.toMatchObject({ code: 'browser_owner' });
    expect(chromium.connectOverCDP).not.toHaveBeenCalled(); expect(fixture.connection.secret.contextId).toBe('gcp-context');
  });
});
