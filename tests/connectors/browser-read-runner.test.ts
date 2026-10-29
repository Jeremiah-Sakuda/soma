import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';
import { isAllowedBlackboardRequest } from '../../src/lib/domain/blackboard-navigation';

const fixture = vi.hoisted(() => ({ connection: null as any, browser: null as any, workspace: null as any, calls: [] as string[], route: null as any, websocket: null as any, cdp: null as any, released: false, releaseFails: false, leaseAlive: true, checkpoint: true }));
vi.mock('../../src/lib/server/account-store', () => ({ readAccountWorkspace: vi.fn(async () => fixture.workspace), updateAccountWorkspace: vi.fn() }));
vi.mock('../../src/lib/server/connectors/store', () => ({
  acquireConnectionLease: vi.fn(async () => ({ connection: structuredClone(fixture.connection), leaseId: 'exclusive-read' })),
  checkpointConnectionLease: vi.fn(async (_a, _id, _lease, patch) => { fixture.calls.push('checkpoint'); if (fixture.checkpoint) fixture.connection = { ...fixture.connection, ...patch }; return fixture.checkpoint; }),
  releaseConnectionLease: vi.fn(async (_a, _id, _lease, patch) => { fixture.calls.push('lease-release'); if (!fixture.leaseAlive) return false; fixture.connection = { ...fixture.connection, ...patch }; return true; }),
  connectionPublicationGuard: vi.fn(() => async () => { fixture.calls.push('publication-guard'); if (!fixture.leaseAlive) throw Object.assign(new Error('Authorization changed'), { code: 'connection_changed' }); }),
  connectionsForDeletion: vi.fn(), readConnection: vi.fn(), listConnections: vi.fn(), saveConnection: vi.fn(), deleteConnection: vi.fn(),
}));
vi.mock('playwright-core', () => ({ chromium: { connectOverCDP: vi.fn(async () => { fixture.calls.push('connect'); return fixture.browser; }) } }));
import { withBrowserRead } from '../../src/lib/server/connectors/browser';
import { releaseConnectionLease } from '../../src/lib/server/connectors/store';

const account = {} as VerifiedAccount;
const allow = (request: Parameters<typeof isAllowedBlackboardRequest>[0]) => isAllowedBlackboardRequest(request, ['_101_1'], 'collect');
const session = () => ({ id: 'session-read', contextId: 'context-read', projectId: 'project-read', status: fixture.released ? 'COMPLETED' : 'RUNNING', expiresAt: new Date(Date.now() + 60_000).toISOString(), connectUrl: 'wss://connect.browserbase.com/synthetic', userMetadata: { somaOwner: createHash('sha256').update('workspace-read:browser-blackboard').digest('hex') } });
beforeEach(() => {
  vi.stubEnv('BROWSERBASE_API_KEY', 'synthetic-key'); vi.stubEnv('BROWSERBASE_PROJECT_ID', 'project-read'); vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  fixture.connection = { id: 'browser-blackboard', workspaceId: 'workspace-read', provider: 'blackboard', version: 1, status: 'connected', configuration: { targets: [] }, secret: { contextId: 'context-read' } };
  fixture.workspace = { id: 'workspace-read', mode: 'account', revision: 1, courses: [], sources: [] };
  fixture.calls = []; fixture.route = null; fixture.websocket = null; fixture.released = false; fixture.releaseFails = false; fixture.leaseAlive = true; fixture.checkpoint = true;
  let workerEnabled = false;
  fixture.cdp = { send: vi.fn(async (name: string) => {
    fixture.calls.push(name);
    if (name === 'ServiceWorker.enable') workerEnabled = true;
    if (name === 'ServiceWorker.stopAllWorkers' && !workerEnabled) throw new Error('Domain not enabled');
  }) };
  const context = {
    route: vi.fn(async (_pattern, handler) => { fixture.calls.push('install-policy'); fixture.route = handler; }),
    routeWebSocket: vi.fn(async (_pattern, handler) => { fixture.calls.push('install-websocket-block'); fixture.websocket = handler; }),
    pages: () => [{ close: vi.fn(async () => fixture.calls.push('close-restored-tab')) }],
    newPage: vi.fn(async () => { fixture.calls.push('new-page'); return { id: 'read-page' }; }),
    newCDPSession: vi.fn(async () => fixture.cdp),
  };
  fixture.browser = { contexts: () => [context], close: vi.fn(async () => fixture.calls.push('browser-close')) };
  vi.stubGlobal('fetch', vi.fn(async (input, init) => {
    const url = String(input);
    if (url.endsWith('/sessions') && init?.method === 'POST') { fixture.calls.push('allocate-session'); return new Response(JSON.stringify(session())); }
    if (url.endsWith('/sessions/session-read') && init?.method === 'POST') {
      fixture.calls.push('release-session');
      if (fixture.releaseFails) return new Response('unavailable', { status: 503 });
      fixture.released = true; return new Response('{}');
    }
    if (url.endsWith('/sessions/session-read')) { fixture.calls.push('read-session'); return new Response(JSON.stringify(session())); }
    throw new Error('Unexpected synthetic provider request');
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks(); });

describe('private read runner lifecycle with synthetic browser/provider', () => {
  it('installs read restrictions before closing restored tabs and enables the service-worker domain before stopping workers', async () => {
    const result = await withBrowserRead(account, 'blackboard', allow, async input => {
      fixture.calls.push('operation');
      expect(input.workspace.id).toBe('workspace-read');
      await input.guard({} as any, {} as any);
      return { value: { count: 2 }, configuration: { targets: [] }, notice: 'Two materials read.' };
    });
    expect(result).toEqual({ count: 2 });
    for (const [first, second] of [['install-policy', 'close-restored-tab'], ['install-websocket-block', 'close-restored-tab'], ['ServiceWorker.enable', 'ServiceWorker.stopAllWorkers'], ['ServiceWorker.stopAllWorkers', 'operation'], ['browser-close', 'release-session'], ['release-session', 'lease-release']]) {
      expect(fixture.calls.indexOf(first)).toBeLessThan(fixture.calls.indexOf(second));
    }
    expect(fixture.connection.secret.contextId).toBe('context-read');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
    expect(fixture.connection.notice).toBe('Two materials read.');
  });
  it('does not connect to, close or release the student’s active sign-in browser', async () => {
    fixture.connection.secret.sessionId = 'session-read';
    const operation = vi.fn();
    await expect(withBrowserRead(account, 'blackboard', allow, operation)).rejects.toThrow('Finish the sign-in session');
    expect(operation).not.toHaveBeenCalled();
    expect(fixture.calls).toEqual(['read-session', 'lease-release']);
    expect(fixture.connection.secret.sessionId).toBe('session-read');
    expect(fixture.connection.status).toBe('connected');
    expect(fixture.browser.close).not.toHaveBeenCalled();
  });
  it('avoids allocating a browser when the saved context is absent', async () => {
    fixture.connection.secret = {};
    await expect(withBrowserRead(account, 'blackboard', allow, vi.fn())).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(fetch).not.toHaveBeenCalled();
    expect(releaseConnectionLease).toHaveBeenCalledOnce();
  });
  it('blocks write/foreign-course requests, identifies iframe navigation, and records origins without private paths', async () => {
    await withBrowserRead(account, 'blackboard', allow, async ({ blockedOrigins }) => {
      const requests = [
        { url: 'https://learn.bu.edu/ultra/courses/_101_1/outline', method: 'GET', type: 'document', navigation: true, parent: null, allowed: true },
        { url: 'https://learn.bu.edu/ultra/courses/_101_1/cl/announcements', method: 'GET', type: 'document', navigation: true, parent: {}, allowed: true },
        { url: 'https://learn.bu.edu/ultra/courses/_999_1/outline', method: 'GET', type: 'document', navigation: true, parent: {}, allowed: false },
        { url: 'https://learn.bu.edu/ultra/courses/_101_1/outline', method: 'POST', type: 'document', navigation: true, parent: null, allowed: false },
        { url: 'https://foreign.test/private?token=sensitive', method: 'GET', type: 'fetch', navigation: false, parent: null, allowed: false },
      ];
      for (const item of requests) {
        const route = { request: () => ({ url: () => item.url, method: () => item.method, resourceType: () => item.type, isNavigationRequest: () => item.navigation, frame: () => ({ parentFrame: () => item.parent }) }), continue: vi.fn(), abort: vi.fn() };
        await fixture.route(route);
        expect(route.continue).toHaveBeenCalledTimes(item.allowed ? 1 : 0);
        expect(route.abort).toHaveBeenCalledTimes(item.allowed ? 0 : 1);
      }
      const close = vi.fn(); fixture.websocket({ close }); expect(close).toHaveBeenCalledOnce();
      expect([...blockedOrigins]).toEqual(['https://learn.bu.edu', 'https://foreign.test']);
      return { value: true };
    });
  });
  it('releases failed reads and clears only session references while retaining the saved context', async () => {
    await expect(withBrowserRead(account, 'blackboard', allow, async () => { throw Object.assign(new Error('Sign-in expired'), { code: 'browser_login_required' }); })).rejects.toThrow('Sign-in expired');
    expect(fixture.connection.secret.contextId).toBe('context-read');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
    expect(fixture.connection.status).toBe('login-required');
    expect(fixture.calls).toContain('release-session');
    expect(fixture.browser.close).toHaveBeenCalledOnce();
  });
  it('retains encrypted remote cleanup references when provider release fails', async () => {
    fixture.releaseFails = true;
    await expect(withBrowserRead(account, 'blackboard', allow, async () => ({ value: 'read-complete' }))).rejects.toMatchObject({ code: 'browser_provider' });
    expect(fixture.connection.secret.contextId).toBe('context-read');
    expect(fixture.connection.secret.sessionId).toBe('session-read');
    expect(fixture.connection.status).toBe('stale');
    expect(fixture.calls.filter(call => call === 'release-session')).toHaveLength(2);
  });
  it('rejects publication after authorization changes and still releases the allocated remote session', async () => {
    const commit = vi.fn();
    await expect(withBrowserRead(account, 'blackboard', allow, async ({ guard }) => {
      fixture.leaseAlive = false;
      await guard({} as any, {} as any);
      commit(); return { value: 'published' };
    })).rejects.toMatchObject({ code: 'connection_changed' });
    expect(commit).not.toHaveBeenCalled();
    expect(fixture.calls).toContain('release-session');
    expect(fixture.browser.close).toHaveBeenCalledOnce();
  });
  it('does not report success when final connection persistence loses its lease', async () => {
    await expect(withBrowserRead(account, 'blackboard', allow, async () => { fixture.leaseAlive = false; return { value: 'not-returned' }; })).rejects.toThrow('Source settings changed');
    expect(fixture.calls).toContain('release-session');
    expect(fixture.released).toBe(true);
  });
});

it('records the exact publication phase without exposing an unknown exception or changing cleanup', async () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  const error = new TypeError('wss://synthetic.invalid/private?token=never-log-this');
  try {
    await expect(withBrowserRead(account, 'blackboard', allow, async ({ markPhase }) => {
      markPhase?.('source-publication'); throw error;
    })).rejects.toBe(error);
    expect(warn).toHaveBeenCalledExactlyOnceWith(JSON.stringify({ event: 'browser_read_failed', phase: 'source-publication', errorType: 'TypeError' }));
    expect(JSON.stringify(warn.mock.calls)).not.toContain('never-log-this');
    expect(fixture.calls).toContain('release-session');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
  } finally { warn.mockRestore(); }
});
