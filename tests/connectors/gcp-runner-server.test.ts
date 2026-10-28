import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { AddressInfo } from 'node:net';
import { createRunner } from '../../services/browser-runner/server.mjs';
import { createStateStore } from '../../services/browser-runner/state.mjs';
import { createChromiumEngine } from '../../services/browser-runner/engine.mjs';

const requireRunner = createRequire(new URL('../../services/browser-runner/package.json', import.meta.url));
const { WebSocket } = requireRunner('ws');
const OWNER = 'a'.repeat(64), FOREIGN = 'b'.repeat(64), KEY = 'test-control-'.repeat(4);
const ORIGIN = 'https://synthetic-runner.example.invalid', PROJECT = 'synthetic-runner';
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => { for (const close of cleanups.splice(0).reverse()) await close(); vi.unstubAllEnvs(); });

async function fixture() {
  let clock = Date.now();
  const objects = new Map<string, { generation: string; data: unknown }>();
  let generation = 0;
  const adapter = {
    async read(id: string) { const record = objects.get(id); return record ? structuredClone(record) : null; },
    async write(id: string, data: unknown, expected: string | null) {
      if ((objects.get(id)?.generation ?? null) !== expected) throw Object.assign(new Error('synthetic conflict'), { code: 412 });
      objects.set(id, { generation: String(++generation), data: structuredClone(data) });
    },
  };
  const store = createStateStore(adapter, Buffer.alloc(32, 7).toString('base64'), { now: () => clock });
  const browser = {
    connectUrl: 'ws://127.0.0.1:1/devtools/browser/synthetic',
    snapshot: vi.fn(async () => ({ cookies: [], origins: [] })),
    close: vi.fn(async () => {}),
    pages: vi.fn(async () => [{ id: 'synthetic-page' }]),
    view: vi.fn(async (_page: string, _socket: unknown) => {}),
  };
  const engine = { start: vi.fn(async (_input: unknown) => browser) };
  const runner = createRunner({ store, engine, controlKey: KEY, publicOrigin: ORIGIN, projectId: PROJECT, proxyUrl: 'http://127.0.0.1:1', now: () => clock });
  await new Promise<void>((resolve, reject) => { runner.server.once('error', reject); runner.server.listen(0, '127.0.0.1', resolve); });
  const base = `http://127.0.0.1:${(runner.server.address() as AddressInfo).port}`;
  cleanups.push(() => runner.close());
  const api = (path: string, method = 'GET', body?: unknown, owner = OWNER, headers: Record<string, string> = {}) => fetch(base + path, {
    method, headers: { Authorization: 'Bearer ' + KEY, 'X-Soma-Owner': owner, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  async function context() {
    const response = await api('/v1/contexts', 'POST', { projectId: PROJECT, userMetadata: { somaOwner: OWNER } });
    expect(response.status).toBe(201); return (await response.json()).id as string;
  }
  async function start(contextId: string, timeout = 600) {
    return api('/v1/sessions', 'POST', { projectId: PROJECT, timeout, keepAlive: true, browserSettings: { context: { id: contextId, persist: true }, recordSession: false, logSession: false, solveCaptchas: false }, userMetadata: { somaOwner: OWNER } });
  }
  async function debug(id: string) {
    const response = await api(`/v1/sessions/${id}/debug?expiresIn=600`);
    expect(response.status).toBe(200);
    const link = new URL((await response.json()).pages[0].debuggerFullscreenUrl);
    expect(link.origin).toBe(ORIGIN); expect(link.search).toBe('');
    return link.hash.slice(1);
  }
  const bootstrap = (id: string, token: string, origin = ORIGIN) => fetch(`${base}/viewer/${id}/bootstrap`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ token }) });
  return { store, browser, engine, api, context, start, debug, bootstrap, base, advance: (ms: number) => { clock += ms; } };
}

function socketAttempt(url: string, headers: Record<string, string>): Promise<{ status: number; socket?: any }> {
  return new Promise(resolve => {
    const socket = new WebSocket(url, { headers });
    socket.on('error', () => resolve({ status: 0 }));
    socket.once('unexpected-response', (_request: unknown, response: any) => { response.resume(); resolve({ status: response.statusCode }); socket.terminate(); });
    socket.once('open', () => resolve({ status: 101, socket }));
  });
}

describe('private GCP runner control and viewer boundaries', () => {
  it('rejects foreign ownership, absent credentials, unexpected queries and unsupported HTTP methods without executing a browser', async () => {
    const f = await fixture(), id = await f.context();
    expect((await f.api(`/v1/contexts/${id}`, 'GET', undefined, FOREIGN)).status).toBe(404);
    expect((await f.api(`/v1/contexts/${id}`, 'DELETE', undefined, FOREIGN)).status).toBe(404);
    expect((await fetch(f.base + '/v1/projects')).status).toBe(401);
    expect((await f.api('/v1/projects?owner=' + FOREIGN)).status).toBe(400);
    expect((await f.api(`/v1/contexts/${id}`, 'PATCH', {})).status).toBe(404);
    expect((await f.api('/v1/projects', 'GET', undefined, OWNER, { Authorization: 'Bearer ' + 'é'.repeat(KEY.length) })).status).toBe(401);
    expect(f.engine.start).not.toHaveBeenCalled();
    expect(await f.store.inspect(id, OWNER)).toEqual({ active: null });
  });

  it('consumes a login fragment once, enforces exact origin and issues only a scoped secure HttpOnly cookie', async () => {
    const f = await fixture(), started = await f.start(await f.context());
    const session = await started.json(), token = await f.debug(session.id);
    expect((await f.bootstrap(session.id, token, 'https://attacker.example.invalid')).status).toBe(403);
    const accepted = await f.bootstrap(session.id, token);
    expect(accepted.status).toBe(200);
    const cookie = accepted.headers.get('set-cookie')!;
    expect(cookie).toContain(`Path=/viewer/${session.id}`);
    expect(cookie).toMatch(/HttpOnly; Secure; SameSite=Strict/);
    expect(cookie).not.toContain(KEY); expect(cookie).not.toContain(token);
    expect((await f.bootstrap(session.id, token)).status).toBe(401);
    const html = await fetch(f.base + `/viewer/${session.id}`);
    expect(html.headers.get('content-security-policy')).toContain("frame-ancestors 'none'");
    expect(html.headers.get('referrer-policy')).toBe('no-referrer');
    expect((await html.text())).not.toContain(KEY);
  });

  it('rejects viewer WebSockets without the exact origin, cookie or unmodified path and never exposes a collection viewer', async () => {
    const f = await fixture(), session = await (await f.start(await f.context())).json();
    const token = await f.debug(session.id), response = await f.bootstrap(session.id, token), cookie = response.headers.get('set-cookie')!.split(';')[0];
    const endpoint = f.base.replace('http:', 'ws:') + `/viewer/${session.id}/socket`;
    for (const [url, headers] of [
      [endpoint, { Origin: 'https://attacker.example.invalid', Cookie: cookie }],
      [endpoint, { Origin: ORIGIN }],
      [endpoint + '?token=' + token, { Origin: ORIGIN, Cookie: cookie }],
    ] as [string, Record<string, string>][]) expect((await socketAttempt(url, headers)).status).toBe(401);
    expect(f.browser.view).not.toHaveBeenCalled();
    expect((await socketAttempt(f.base.replace('http:', 'ws:') + `/cdp/${session.id}`, { Authorization: 'Bearer ' + KEY, 'X-Soma-Owner': FOREIGN })).status).toBe(401);
    expect((await f.api(`/v1/sessions/${session.id}`, 'POST', { status: 'REQUEST_RELEASE' })).status).toBe(200);
    const collection = await (await f.start(await f.context(), 180)).json();
    expect((await f.api(`/v1/sessions/${collection.id}/debug?expiresIn=600`)).status).toBe(403);
    expect((await f.bootstrap(collection.id, token)).status).toBe(403);
  });

  it('permits only one concurrent bootstrap exchange and rejects an expired session capability', async () => {
    const f = await fixture(), session = await (await f.start(await f.context())).json();
    const token = await f.debug(session.id);
    const attempts = await Promise.all([f.bootstrap(session.id, token), f.bootstrap(session.id, token)]);
    expect(attempts.map(response => response.status).sort()).toEqual([200, 401]);
    const cookie = attempts.find(response => response.status === 200)!.headers.get('set-cookie')!.split(';')[0];
    const nextToken = await f.debug(session.id);
    f.advance(600001);
    expect((await f.bootstrap(session.id, nextToken)).status).toBe(404);
    expect((await socketAttempt(f.base.replace('http:', 'ws:') + `/viewer/${session.id}/socket`, { Origin: ORIGIN, Cookie: cookie })).status).toBe(401);
    expect(f.browser.view).not.toHaveBeenCalled();
  });

  it('revokes an established viewer and its cookie on release while preserving the saved authorization', async () => {
    const f = await fixture(), id = await f.context(), session = await (await f.start(id)).json();
    const response = await f.bootstrap(session.id, await f.debug(session.id)), cookie = response.headers.get('set-cookie')!.split(';')[0];
    const endpoint = f.base.replace('http:', 'ws:') + `/viewer/${session.id}/socket`;
    const opened = await socketAttempt(endpoint, { Origin: ORIGIN, Cookie: cookie });
    expect(opened.status).toBe(101); expect(f.browser.view).toHaveBeenCalledOnce();
    const closed = new Promise(resolve => opened.socket.once('close', resolve));
    expect((await f.api(`/v1/sessions/${session.id}`, 'POST', { status: 'REQUEST_RELEASE' }, FOREIGN)).status).toBe(404);
    expect(opened.socket.readyState).toBe(1);
    expect((await f.api(`/v1/sessions/${session.id}`, 'POST', { status: 'REQUEST_RELEASE' })).status).toBe(200);
    await closed;
    expect(f.browser.snapshot).toHaveBeenCalledOnce(); expect(f.browser.close).toHaveBeenCalledOnce();
    expect(await f.store.inspect(id, OWNER)).toEqual({ active: null });
    expect((await socketAttempt(endpoint, { Origin: ORIGIN, Cookie: cookie })).status).toBe(401);
  });

  it('rejects malformed or excessive control bodies before claiming a browser context', async () => {
    const f = await fixture();
    for (const body of ['{"PRIVATE malformed', ' '.repeat(16385)]) {
      const response = await fetch(f.base + '/v1/sessions', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'X-Soma-Owner': OWNER, 'Content-Type': 'application/json' }, body });
      expect(response.status).toBe(body.startsWith('{') ? 400 : 413);
      expect(await response.text()).not.toContain(body);
    }
    expect((await f.api('/v1/sessions', 'POST', { projectId: PROJECT, password: 'synthetic-must-not-be-used' })).status).toBe(400);
    expect(f.engine.start).not.toHaveBeenCalled();
  });

  it('rejects malformed UTF-8 instead of silently replacing control bytes', async () => {
    const f = await fixture();
    const body = Buffer.concat([Buffer.from(`{"projectId":"${PROJECT}","userMetadata":{"somaOwner":"${OWNER}"},"extra":"`), Buffer.from([0xc3]), Buffer.from('"}')]);
    const response = await fetch(f.base + '/v1/contexts', { method: 'POST', headers: { Authorization: 'Bearer ' + KEY, 'X-Soma-Owner': OWNER, 'Content-Type': 'application/json' }, body });
    expect(response.status).toBe(400); expect(f.engine.start).not.toHaveBeenCalled();
  });

  it('abandons a failed startup claim without replacing previously encrypted authorization and permits immediate retry', async () => {
    const f = await fixture(), id = await f.context();
    const oldSession = '11111111-1111-4111-8111-111111111111';
    const previous = { cookies: [], origins: [{ origin: 'https://course.example.invalid', localStorage: [{ name: 'synthetic-auth', value: 'retained' }] }] };
    await f.store.claim(id, OWNER, oldSession, Date.now() + 10000); await f.store.finish(id, OWNER, oldSession, previous);
    f.engine.start.mockRejectedValueOnce(new Error('PRIVATE synthetic provider failure'));
    const rejected = await f.start(id);
    expect(rejected.status).toBe(503); expect(await rejected.text()).not.toContain('PRIVATE');
    expect(await f.store.inspect(id, OWNER)).toEqual({ active: null });
    expect(await f.store.read(id, OWNER)).toEqual(previous);
    expect((await f.start(id)).status).toBe(201);
  });

  it('closes a browser whose context was deleted during startup and never replaces the tombstone', async () => {
    const f = await fixture(), id = await f.context();
    f.engine.start.mockImplementationOnce(async () => { await f.store.remove(id, OWNER); return f.browser; });
    expect((await f.start(id)).status).toBe(404);
    expect(f.browser.close).toHaveBeenCalledOnce(); expect(f.browser.snapshot).not.toHaveBeenCalled();
    await expect(f.store.inspect(id, OWNER)).rejects.toMatchObject({ code: 'state_not_found' });
    expect((await f.start(await f.context())).status).toBe(201);
  });

  it('preserves old authorization and abandons the lease when snapshot persistence fails during release', async () => {
    const f = await fixture(), id = await f.context(), oldSession = '11111111-1111-4111-8111-111111111111';
    const previous = { cookies: [], origins: [{ origin: 'https://course.example.invalid', localStorage: [{ name: 'synthetic-auth', value: 'retained' }] }] };
    await f.store.claim(id, OWNER, oldSession, Date.now() + 10000); await f.store.finish(id, OWNER, oldSession, previous);
    const session = await (await f.start(id)).json();
    f.browser.snapshot.mockRejectedValueOnce(new Error('PRIVATE synthetic snapshot error'));
    const rejected = await f.api(`/v1/sessions/${session.id}`, 'POST', { status: 'REQUEST_RELEASE' });
    expect(rejected.status).toBe(503); expect(await rejected.text()).not.toContain('PRIVATE');
    expect(f.browser.close).toHaveBeenCalledOnce();
    expect(await f.store.inspect(id, OWNER)).toEqual({ active: null });
    expect(await f.store.read(id, OWNER)).toEqual(previous);
    expect((await f.start(id)).status).toBe(201);
  });

  it('retains revoked cleanup capacity after a failed browser close and retries deletion without resurrecting state', async () => {
    const f = await fixture(), id = await f.context(); await f.start(id);
    f.browser.close.mockRejectedValueOnce(new Error('PRIVATE synthetic close failure'));
    const rejected = await f.api(`/v1/contexts/${id}`, 'DELETE');
    expect(rejected.status).toBe(503); expect(await rejected.text()).not.toContain('PRIVATE');
    await expect(f.store.inspect(id, OWNER)).rejects.toMatchObject({ code: 'state_not_found' });
    const next = await f.context();
    expect((await f.start(next)).status).toBe(429);
    expect((await f.api(`/v1/contexts/${id}`, 'DELETE')).status).toBe(204);
    expect(f.browser.close).toHaveBeenCalledTimes(2); expect(f.browser.snapshot).not.toHaveBeenCalled();
    expect((await f.start(next)).status).toBe(201);
  });
});

async function engineFixture({ holdEnable = false, holdInput = false } = {}) {
  let releaseEnable!: () => void, releaseInput!: () => void, reachedEnable!: () => void, reachedInput!: () => void;
  const enable = new Promise<void>(resolve => { releaseEnable = resolve; }), input = new Promise<void>(resolve => { releaseInput = resolve; });
  const enabling = new Promise<void>(resolve => { reachedEnable = resolve; }), inputting = new Promise<void>(resolve => { reachedInput = resolve; });
  const sessions: any[] = [], commands: string[] = [];
  let inputCalls = 0;
  const context = {
    pages: () => [{ isClosed: () => false, url: () => 'https://login.example.invalid/' }],
    newCDPSession: vi.fn(async () => {
      const cdp: any = new EventEmitter();
      cdp.detach = vi.fn(async () => {});
      cdp.send = vi.fn(async (name: string) => {
        commands.push(name);
        if (name === 'Target.getTargetInfo') return { targetInfo: { targetId: 'synthetic-page' } };
        if (name === 'Page.enable') { reachedEnable(); if (holdEnable) await enable; }
        if (name === 'Input.insertText') { inputCalls++; reachedInput(); if (holdInput && inputCalls === 1) await input; }
      });
      sessions.push(cdp); return cdp;
    }),
    setStorageState: vi.fn(async () => {}), storageState: vi.fn(async () => ({ cookies: [], origins: [] })), close: vi.fn(async () => {}),
  };
  const launch = vi.fn(async (directory: string, _options: unknown) => { await writeFile(join(directory, 'DevToolsActivePort'), '12345\n/devtools/browser/synthetic'); return context; });
  const browser = await createChromiumEngine({ launchPersistentContext: launch } as any).start({ state: null, proxyUrl: 'http://127.0.0.1:1' });
  cleanups.push(() => browser.close());
  const socket: any = new EventEmitter(); socket.readyState = 1; socket.bufferedAmount = 0; socket.send = vi.fn();
  socket.close = vi.fn(() => { socket.readyState = 3; socket.emit('close'); });
  return { browser, socket, commands, sessions, context, launch, enabling, inputting, releaseEnable, releaseInput };
}

describe('Chromium viewer revocation and process boundaries', () => {
  it('detaches a viewer revoked during asynchronous CDP setup before starting its screencast', async () => {
    const f = await engineFixture({ holdEnable: true });
    const viewing = f.browser.view('synthetic-page', f.socket);
    const rejected = expect(viewing).rejects.toThrow('Viewer ended');
    await f.enabling; f.socket.close(); f.releaseEnable(); await rejected;
    expect(f.commands).not.toContain('Page.startScreencast');
    expect(f.sessions.at(-1).detach).toHaveBeenCalledOnce();
  });

  it('does not execute queued keyboard text after the established viewer is revoked', async () => {
    const f = await engineFixture({ holdInput: true }); await f.browser.view('synthetic-page', f.socket);
    f.socket.emit('message', Buffer.from(JSON.stringify({ type: 'text', text: 'first synthetic input' })));
    f.socket.emit('message', Buffer.from(JSON.stringify({ type: 'text', text: 'must not execute after revocation' })));
    await f.inputting; f.socket.close(); f.releaseInput();
    await new Promise(resolve => setImmediate(resolve));
    expect(f.commands.filter(name => name === 'Input.insertText')).toHaveLength(1);
    expect(f.sessions.at(-1).detach).toHaveBeenCalledOnce();
  });

  it('rejects raw CDP commands from the human viewer and starts Chromium without inherited broker secrets', async () => {
    vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', 'synthetic-control-secret');
    vi.stubEnv('SOMA_GCP_BROWSER_STATE_KEY', 'synthetic-encryption-secret');
    vi.stubEnv('GOOGLE_APPLICATION_CREDENTIALS', '/synthetic/private-service-account.json');
    const f = await engineFixture(); await f.browser.view('synthetic-page', f.socket);
    const launchOptions = f.launch.mock.calls[0][1] as { env: Record<string, string>; args: string[]; chromiumSandbox: boolean; acceptDownloads: boolean; serviceWorkers: string };
    expect(launchOptions.env).toEqual({ PATH: '/usr/local/bin:/usr/bin:/bin', HOME: '/tmp', LANG: 'C.UTF-8', TZ: 'UTC' });
    expect(JSON.stringify(launchOptions.env)).not.toContain('synthetic');
    expect(launchOptions.args).toContain('--proxy-bypass-list=<-loopback>');
    expect(launchOptions.args).toContain('--disable-quic');
    expect(launchOptions.chromiumSandbox).toBe(true);
    expect(launchOptions.acceptDownloads).toBe(false); expect(launchOptions.serviceWorkers).toBe('block');
    f.socket.emit('message', Buffer.from(JSON.stringify({ method: 'Network.getAllCookies', params: {} })));
    await new Promise(resolve => setImmediate(resolve));
    expect(f.socket.close).toHaveBeenCalledWith(1008);
    expect(f.commands).not.toContain('Network.getAllCookies');
  });
});
