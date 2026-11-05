import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
const { WebSocket } = createRequire(
  new URL('../../services/credential-runner/package.json', import.meta.url),
)('ws');
import { afterEach, describe, it, expect, vi } from 'vitest';
import { createCredentialRunner } from '../../services/credential-runner/server.mjs';
import {
  checkFormFacts,
  allowedOrigin,
  allowedUrl,
} from '../../services/credential-runner/policy.mjs';
const cleanup: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const close of cleanup.splice(0)) await close();
});
const owner = 'a'.repeat(64),
  other = 'b'.repeat(64),
  key = 'k'.repeat(48),
  origin = 'https://credential.example.com';
function deferred() {
  let resolve!: (value?: unknown) => void;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}
async function harness(
  options: {
    holdDecrypt?: ReturnType<typeof deferred>;
    secretCookie?: string;
    auditFailure?: string;
    holdPublication?: ReturnType<typeof deferred>;
    holdConsent?: ReturnType<typeof deferred>;
    diagnosticFailure?: 'sync' | 'async';
  } = {},
) {
  let active: any = null,
    authorized = true,
    authorizationUnavailable = false,
    clock = Date.now(),
    version = 'v1',
    closed = 0,
    saved: any = null;
  const consumed = new Set<string>();
  const store = {
    inspect: vi.fn(async () => ({ active })),
    claim: vi.fn(async (_id: string, _owner: string, id: string, expiresAt: number) => {
      if (active) throw Error('busy');
      active = { id, expiresAt };
      return { storageState: null };
    }),
    abandon: vi.fn(async () => {
      active = null;
    }),
    finish: vi.fn(async (_id: string, _owner: string, _session: string, state: any) => {
      saved = state;
      active = null;
    }),
  };
  const vault = {
    metadata: vi.fn(async () => ({ status: 'active', version })),
    save: vi.fn(async () => ({ status: 'active', version })),
    decrypt: vi.fn(async () => {
      await options.holdDecrypt?.promise;
      return { identifier: 'student@bu.edu', password: 'sensitive-canary' };
    }),
    rotate: vi.fn(async () => {
      version = 'v2';
      return { status: 'active', version };
    }),
    forget: vi.fn(async () => {
      version = 'forgotten';
      return { status: 'forgotten', version };
    }),
  };
  const auditEvents: any[] = [];
  const audit = {
    emit: vi.fn(async (_owner: string, event: any) => {
      if (event.event === 'session_saved' && event.outcome === 'started')
        await options.holdPublication?.promise;
      if (event.event === 'consent') await options.holdConsent?.promise;
      if (
        event.event === options.auditFailure &&
        (event.event !== 'session_saved' || event.outcome === 'succeeded')
      )
        throw new Error('synthetic audit failure');
      auditEvents.push(event);
    }),
  };
  const browser = {
    inspect: vi.fn(async () => ({ reviewed: true })),
    fill: vi.fn(async (_secret: any, recheck: () => Promise<void>) => {
      await recheck();
    }),
    safeForViewer: vi.fn(async () => true),
    snapshot: vi.fn(async () => ({
      cookies: options.secretCookie ? [{ value: options.secretCookie }] : [],
      origins: [],
    })),
    close: vi.fn(async () => {
      closed++;
    }),
    view: vi.fn(async () => {}),
  };
  const authorize = vi.fn(async () => {
    if (authorizationUnavailable)
      throw Object.assign(Error('synthetic unavailable'), {
        code: 'credential_authorization_unavailable',
        status: 503,
      });
    if (!authorized)
      throw Object.assign(Error('revoked'), { code: 'credential_authorization', status: 403 });
    return { identifier: 'student@bu.edu' };
  });
  const failures: any[] = [];
  const runner = createCredentialRunner({
    reportFailure: (facts: any) => {
      failures.push(facts);
      if (options.diagnosticFailure === 'sync') throw Error('synthetic diagnostic sink failure');
      if (options.diagnosticFailure === 'async')
        return Promise.reject(Error('synthetic async diagnostic sink failure'));
    },
    store,
    vault,
    audit,
    grantStore: {
      consume: async (id: string) => {
        if (consumed.has(id))
          throw Object.assign(Error('replay'), { code: 'grant_replayed', status: 409 });
        consumed.add(id);
      },
    },
    engine: { start: async () => browser },
    authorize,
    controlKey: key,
    publicOrigin: origin,
    proxyUrl: 'http://127.0.0.1:1',
    now: () => clock,
  });
  await new Promise<void>((resolve, reject) => {
    runner.server.once('error', reject);
    runner.server.listen(0, '127.0.0.1', resolve);
  });
  const port = (runner.server.address() as any).port;
  cleanup.push(() => runner.close());
  const request = async (
    path: string,
    data?: any,
    {
      human = false,
      cookie = '',
      ownerOverride = owner,
      method = data === undefined ? 'GET' : 'POST',
    } = {},
  ) => {
    const headers: any = { 'content-type': 'application/json' };
    if (human) {
      headers.origin = origin;
      if (cookie) headers.cookie = cookie;
    } else {
      headers.authorization = 'Bearer ' + key;
      headers['x-soma-owner'] = ownerOverride;
    }
    return fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers,
      body: data === undefined ? undefined : JSON.stringify(data),
    });
  };
  const grant = {
    uid: 'firebase-user',
    workspaceId: 'workspace',
    workspaceGeneration: 'workspace',
    provider: 'blackboard',
    contextId: randomUUID(),
    connectionVersion: 1,
    recentAuthAt: Math.floor(clock / 1000),
    authorizationId: randomUUID(),
  };
  const create = async () => {
    const response = await request('/v1/grants', grant);
    expect(response.status).toBe(201);
    return response.json();
  };
  const bootstrap = async (session: any) => {
    const response = await request(
      `/login/${session.sessionId}/bootstrap`,
      { token: new URL(session.loginUrl).hash.slice(1) },
      { human: true },
    );
    expect(response.status).toBe(200);
    return response.headers.get('set-cookie')!.split(';')[0];
  };
  return {
    request,
    grant,
    create,
    bootstrap,
    websocketOrigin: `ws://127.0.0.1:${port}`,
    browser,
    vault,
    store,
    audit,
    auditEvents,
    failures,
    authorize,
    advance: (ms: number) => {
      clock += ms;
    },
    unavailable: (value = true) => {
      authorizationUnavailable = value;
    },
    get saved() {
      return saved;
    },
    get closed() {
      return closed;
    },
    revoke: () => {
      authorized = false;
    },
    rotate: () => {
      version = 'v2';
    },
    expire: () => {
      clock += 31 * 60_000;
    },
  };
}
describe('isolated credential login boundary', () => {
  it('retains an idle setup across uncertain authorization, rejects actions, then recovers with the same one-use entry', async () => {
    const h = await harness(),
      session = await h.create();
    h.advance(25_000);
    h.unavailable();
    await vi.waitFor(
      () =>
        expect(
          h.failures.some((facts) => facts.code === 'credential_authorization_unavailable'),
        ).toBe(true),
      { timeout: 2500 },
    );
    expect(h.closed).toBe(0);
    expect(h.store.abandon).not.toHaveBeenCalled();
    const unavailable = await h.request(
      `/login/${session.sessionId}/bootstrap`,
      { token: new URL(session.loginUrl).hash.slice(1) },
      { human: true },
    );
    expect(unavailable.status).toBe(503);
    expect(h.vault.metadata).not.toHaveBeenCalled();
    expect(h.browser.fill).not.toHaveBeenCalled();
    h.unavailable(false);
    const cookie = await h.bootstrap(session);
    expect(
      (await h.request(`/login/${session.sessionId}/status`, {}, { human: true, cookie })).status,
    ).toBe(200);
    expect(h.closed).toBe(0);
    expect(h.store.abandon).not.toHaveBeenCalled();
  });
  it('closes an existing MFA viewer during uncertain authorization while retaining bounded recovery', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(200);
    const viewer = new WebSocket(`${h.websocketOrigin}/login/${session.sessionId}/socket`, {
      headers: { origin, cookie },
    });
    await new Promise<void>((resolve, reject) => {
      viewer.once('open', resolve);
      viewer.once('error', reject);
    });
    const closed = new Promise<number>((resolve) =>
      viewer.once('close', (code: number) => resolve(code)),
    );
    h.unavailable();
    expect(await closed).toBe(1008);
    expect(h.closed).toBe(0);
    expect(h.store.finish).not.toHaveBeenCalled();
    expect(
      (await h.request(`/login/${session.sessionId}/status`, {}, { human: true, cookie })).status,
    ).toBe(503);
    h.unavailable(false);
    expect(
      (await h.request(`/login/${session.sessionId}/status`, {}, { human: true, cookie })).status,
    ).toBe(200);
    expect(h.browser.fill).toHaveBeenCalledTimes(1);
    expect(h.closed).toBe(0);
  });
  it('serializes background authorization checks even when one callback takes multiple sweep intervals', async () => {
    const h = await harness(),
      session = await h.create(),
      hold = deferred();
    let inFlight = 0,
      maximum = 0;
    h.authorize.mockImplementation(async () => {
      inFlight++;
      maximum = Math.max(maximum, inFlight);
      await hold.promise;
      inFlight--;
      return { identifier: 'student@bu.edu' };
    });
    await vi.waitFor(() => expect(inFlight).toBe(1), { timeout: 2000 });
    await new Promise((resolve) => setTimeout(resolve, 1200));
    expect(maximum).toBe(1);
    expect(inFlight).toBe(1);
    expect(h.closed).toBe(0);
    hold.resolve();
    h.authorize.mockImplementation(async () => ({ identifier: 'student@bu.edu' }));
    await h.bootstrap(session);
    expect(h.closed).toBe(0);
  });
  it('an explicit authorization denial closes the setup and rejects any later viewer or entry use', async () => {
    const h = await harness(),
      session = await h.create();
    h.revoke();
    await vi.waitFor(() => expect(h.closed).toBe(1), { timeout: 2500 });
    expect(h.store.abandon).toHaveBeenCalledTimes(1);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/bootstrap`,
          { token: new URL(session.loginUrl).hash.slice(1) },
          { human: true },
        )
      ).status,
    ).toBe(404);
    expect(
      (await h.request(`/login/${session.sessionId}/status`, {}, { human: true })).status,
    ).toBe(401);
    const viewer = new WebSocket(`${h.websocketOrigin}/login/${session.sessionId}/socket`, {
      headers: { origin },
    });
    const denied = await new Promise<number>((resolve, reject) => {
      viewer.once('open', () => {
        viewer.terminate();
        reject(Error('Revoked synthetic viewer was accepted'));
      });
      viewer.once('unexpected-response', (_request: unknown, response: any) => {
        response.resume();
        resolve(response.statusCode);
        viewer.terminate();
      });
      viewer.once('error', () => {});
    });
    expect(denied).toBe(401);
  });
  it('an uncertain callback cannot extend the original setup deadline', async () => {
    const h = await harness(),
      session = await h.create();
    h.unavailable();
    await vi.waitFor(() => expect(h.failures.length).toBeGreaterThan(0), { timeout: 2500 });
    h.expire();
    await vi.waitFor(() => expect(h.closed).toBe(1), { timeout: 2500 });
    expect(h.store.abandon).toHaveBeenCalledTimes(1);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/bootstrap`,
          { token: new URL(session.loginUrl).hash.slice(1) },
          { human: true },
        )
      ).status,
    ).toBe(404);
  });
  it('one-use fragment becomes scoped HttpOnly cookie, blocks replay and owner crossover', async () => {
    const h = await harness(),
      session = await h.create();
    expect(session.sessionId).toBe(h.grant.authorizationId);
    expect(session).not.toHaveProperty('connectUrl');
    const cookie = await h.bootstrap(session);
    expect(cookie).toContain('__Secure-soma_credential=');
    const replay = await h.request(
      `/login/${session.sessionId}/bootstrap`,
      { token: new URL(session.loginUrl).hash.slice(1) },
      { human: true },
    );
    expect(replay.status).toBe(401);
    expect(
      (await h.request(`/v1/sessions/${session.sessionId}`, undefined, { ownerOverride: other }))
        .status,
    ).toBe(404);
    expect((await h.request('/cdp/' + session.sessionId)).status).toBe(404);
  });
  it('fills once, emits no plaintext, exports auth only, and rejects durable grant reuse', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const response = await h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    expect(response.status).toBe(200);
    expect(await response.text()).not.toContain('sensitive-canary');
    expect(h.browser.fill).toHaveBeenCalledTimes(1);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(409);
    expect((await h.request(`/v1/sessions/${session.sessionId}/release`, {})).status).toBe(200);
    expect(h.saved).toEqual({ cookies: [], origins: [] });
    expect((await h.request('/v1/grants', h.grant)).status).toBe(409);
  });
  it('only the app broker may persist the authenticated browser handoff', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(200);
    expect(
      (await h.request(`/login/${session.sessionId}/release`, {}, { human: true, cookie })).status,
    ).toBe(404);
    expect(h.store.finish).not.toHaveBeenCalled();
  });
  it('a failed browser close can be retried without overwriting the saved context', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(200);
    h.browser.close.mockRejectedValueOnce(new Error('synthetic close failure'));
    expect((await h.request(`/v1/sessions/${session.sessionId}/release`, {})).status).toBe(503);
    expect(h.store.finish).toHaveBeenCalledTimes(1);
    expect(
      (await h.request(`/v1/sessions/${session.sessionId}`, {}, { method: 'DELETE' })).status,
    ).toBe(204);
    expect(h.store.finish).toHaveBeenCalledTimes(1);
    expect(h.browser.close).toHaveBeenCalledTimes(2);
  });
  it('fixed audit facts retain consent and actions without credentials or arbitrary errors', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/save-fill`,
          {
            identifier: 'student@bu.edu',
            password: 'sensitive-canary',
            consent: true,
            version: 'v1',
          },
          { human: true, cookie },
        )
      ).status,
    ).toBe(200);
    expect(
      h.auditEvents
        .filter((event) => !event.event.startsWith('grant_'))
        .map((event) => event.event),
    ).toEqual(['consent', 'credential_saved', 'fill_started', 'fill_succeeded']);
    const serialized = JSON.stringify(h.auditEvents);
    expect(serialized).not.toContain('sensitive-canary');
    expect(serialized).not.toContain('student@bu.edu');
    expect(serialized).not.toContain(session.sessionId);
  });
  it('reports only fixed failure facts after a saved enrollment is blocked by a browser guard', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    h.browser.fill.mockRejectedValueOnce(
      Object.assign(new Error('private provider response and password'), {
        code: 'credential_frame_guard',
        status: 409,
        request: { password: 'sensitive-canary' },
      }),
    );
    const response = await h.request(
      `/login/${session.sessionId}/save-fill`,
      { identifier: 'student@bu.edu', password: 'sensitive-canary', consent: true, version: 'v1' },
      { human: true, cookie },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'Credential operation unavailable. Start a fresh login or use manual sign-in.',
      code: 'credential_frame_guard',
    });
    expect(h.vault.save).toHaveBeenCalledTimes(1);
    expect(h.store.finish).not.toHaveBeenCalled();
    expect(h.closed).toBe(1);
    expect(h.failures).toEqual([
      {
        event: 'credential_operation_failed',
        operation: 'save-fill',
        code: 'credential_frame_guard',
        status: 409,
      },
    ]);
    expect(JSON.stringify(h.failures)).not.toMatch(/student|sensitive|password|response|request/);
    expect(
      h.auditEvents.some(
        (event) => event.event === 'credential_saved' && event.outcome === 'succeeded',
      ),
    ).toBe(true);
    expect(h.auditEvents.some((event) => event.event === 'fill_succeeded')).toBe(false);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(401);
    expect(h.browser.fill).toHaveBeenCalledTimes(1);
  });
  it.each(['sync', 'async'] as const)(
    'diagnostic delivery failure %s cannot prevent guarded cleanup or the HTTP rejection',
    async (diagnosticFailure) => {
      const h = await harness({ diagnosticFailure }),
        session = await h.create(),
        cookie = await h.bootstrap(session);
      h.browser.fill.mockRejectedValueOnce(
        Object.assign(new Error('untrusted private failure'), {
          code: 'untrusted_private_failure',
          status: 409,
        }),
      );
      const response = await h.request(
        `/login/${session.sessionId}/fill`,
        { version: 'v1' },
        { human: true, cookie },
      );
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe('credential_unavailable');
      expect(h.closed).toBe(1);
      expect(h.store.finish).not.toHaveBeenCalled();
      expect(h.failures).toEqual([
        {
          event: 'credential_operation_failed',
          operation: 'fill',
          code: 'credential_unavailable',
          status: 409,
        },
      ]);
    },
  );
  it('audit failure prevents autofill and never reports a successful save', async () => {
    const h = await harness({ auditFailure: 'fill_started' }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const response = await h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    expect(response.status).toBe(503);
    expect(h.browser.fill).not.toHaveBeenCalled();
    expect(h.store.finish).not.toHaveBeenCalled();
  });
  it('grant issuance denial and replay retain only fixed safe facts', async () => {
    const h = await harness(),
      session = await h.create();
    await h.bootstrap(session);
    await h.request(`/v1/sessions/${session.sessionId}`, {}, { method: 'DELETE' });
    expect((await h.request('/v1/grants', h.grant)).status).toBe(409);
    expect(
      h.auditEvents.some(
        (event) => event.event === 'grant_issued' && event.outcome === 'succeeded',
      ),
    ).toBe(true);
    expect(h.auditEvents.some((event) => event.event === 'grant_used')).toBe(true);
    expect(h.auditEvents.some((event) => event.event === 'grant_replayed')).toBe(true);
    h.revoke();
    expect(
      (await h.request('/v1/grants', { ...h.grant, authorizationId: randomUUID() })).status,
    ).toBe(403);
    expect(h.auditEvents.some((event) => event.event === 'grant_denied')).toBe(true);
    const text = JSON.stringify(h.auditEvents);
    expect(text).not.toContain(h.grant.uid);
    expect(text).not.toContain(session.sessionId);
    expect(text).not.toContain('Error: revoked');
  });
  it('grant audit failure stops all browser and state allocation', async () => {
    const h = await harness({ auditFailure: 'grant_issued' });
    expect((await h.request('/v1/grants', h.grant)).status).toBe(503);
    expect(h.store.claim).not.toHaveBeenCalled();
    expect(h.browser.inspect).not.toHaveBeenCalled();
  });
  it('revocation during the consent audit prevents any credential save', async () => {
    const hold = deferred(),
      h = await harness({ holdConsent: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const pending = h.request(
      `/login/${session.sessionId}/save-fill`,
      { identifier: 'student@bu.edu', password: 'sensitive-canary', consent: true, version: 'v1' },
      { human: true, cookie },
    );
    await vi.waitFor(() =>
      expect(h.audit.emit.mock.calls.some(([, event]) => event.event === 'consent')).toBe(true),
    );
    h.revoke();
    hold.resolve();
    expect((await pending).status).toBe(403);
    expect(h.vault.save).not.toHaveBeenCalled();
    expect(h.browser.fill).not.toHaveBeenCalled();
  });
  it('missing consent audit blocks credential storage', async () => {
    const h = await harness({ auditFailure: 'consent' }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/save-fill`,
          {
            identifier: 'student@bu.edu',
            password: 'sensitive-canary',
            consent: true,
            version: 'v1',
          },
          { human: true, cookie },
        )
      ).status,
    ).toBe(503);
    expect(h.vault.save).not.toHaveBeenCalled();
    expect(h.browser.fill).not.toHaveBeenCalled();
  });
  it('publication audit failure retains a saved state but does not claim success', async () => {
    const h = await harness({ auditFailure: 'session_saved' }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(200);
    const result = await h.request(`/v1/sessions/${session.sessionId}/release`, {});
    expect(result.status).toBe(503);
    expect(h.saved).toEqual({ cookies: [], origins: [] });
    expect(
      h.auditEvents.some((event) => event.event === 'session_saved' && event.outcome === 'started'),
    ).toBe(true);
    expect(
      h.auditEvents.some(
        (event) => event.event === 'session_saved' && event.outcome === 'succeeded',
      ),
    ).toBe(false);
  });
  it('revocation while publication intent is being audited prevents the state commit', async () => {
    const hold = deferred(),
      h = await harness({ holdPublication: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(200);
    const pending = h.request(`/v1/sessions/${session.sessionId}/release`, {});
    await vi.waitFor(() =>
      expect(
        h.audit.emit.mock.calls.some(
          ([, event]) => event.event === 'session_saved' && event.outcome === 'started',
        ),
      ).toBe(true),
    );
    h.revoke();
    hold.resolve();
    expect((await pending).status).toBe(403);
    expect(h.store.finish).not.toHaveBeenCalled();
    expect(h.saved).toBeNull();
  });
  it('operator rotation fences a credential already waiting for decrypt', async () => {
    const hold = deferred(),
      h = await harness({ holdDecrypt: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const pending = h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    await vi.waitFor(() => expect(h.vault.decrypt).toHaveBeenCalled());
    expect(
      (
        await h.request('/v1/credentials/rotate', {
          owner,
          workspaceId: 'workspace',
          workspaceGeneration: 'workspace',
          provider: 'blackboard',
          origin: 'https://shib.bu.edu',
        })
      ).status,
    ).toBe(200);
    hold.resolve();
    expect((await pending).status).toBe(409);
    expect(h.browser.fill).not.toHaveBeenCalled();
  });
  it('operator rotation revokes active fills, updates the version and returns no plaintext', async () => {
    const h = await harness();
    await h.create();
    const response = await h.request('/v1/credentials/rotate', {
      owner,
      workspaceId: 'workspace',
      workspaceGeneration: 'workspace',
      provider: 'blackboard',
      origin: 'https://shib.bu.edu',
    });
    expect(response.status).toBe(200);
    expect(h.closed).toBe(1);
    expect(h.vault.rotate).toHaveBeenCalledWith(expect.anything(), 'v1');
    expect(await response.text()).not.toContain('sensitive-canary');
    expect(
      h.auditEvents.some(
        (event) => event.event === 'credential_rotated' && event.outcome === 'succeeded',
      ),
    ).toBe(true);
  });
  it('revocation during KMS unwrap prevents any browser fill', async () => {
    const hold = deferred(),
      h = await harness({ holdDecrypt: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const pending = h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    await vi.waitFor(() => expect(h.vault.decrypt).toHaveBeenCalled());
    h.revoke();
    hold.resolve();
    expect((await pending).status).toBe(403);
    expect(h.browser.fill).not.toHaveBeenCalled();
    expect(h.closed).toBe(1);
  });
  it('concurrent redemption consumes only one fill and origin spoofing has no cookie bypass', async () => {
    const hold = deferred(),
      h = await harness({ holdDecrypt: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const pending = h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    await vi.waitFor(() => expect(h.vault.decrypt).toHaveBeenCalled());
    expect(
      (
        await h.request(
          `/login/${session.sessionId}/fill`,
          { version: 'v1' },
          { human: true, cookie },
        )
      ).status,
    ).toBe(409);
    expect((await h.request(`/login/${session.sessionId}/status`, {}, { cookie })).status).toBe(
      403,
    );
    hold.resolve();
    expect((await pending).status).toBe(200);
    expect(h.browser.fill).toHaveBeenCalledTimes(1);
  });
  it('session expiry during unwrap closes the browser before any fill', async () => {
    const hold = deferred(),
      h = await harness({ holdDecrypt: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const pending = h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    await vi.waitFor(() => expect(h.vault.decrypt).toHaveBeenCalled());
    h.expire();
    hold.resolve();
    expect((await pending).status).toBe(404);
    expect(h.browser.fill).not.toHaveBeenCalled();
  });
  it('credential rotation during unwrap prevents fill', async () => {
    const hold = deferred(),
      h = await harness({ holdDecrypt: hold }),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const pending = h.request(
      `/login/${session.sessionId}/fill`,
      { version: 'v1' },
      { human: true, cookie },
    );
    await vi.waitFor(() => expect(h.vault.decrypt).toHaveBeenCalled());
    h.rotate();
    hold.resolve();
    expect((await pending).status).toBe(409);
    expect(h.browser.fill).not.toHaveBeenCalled();
  });
  it('cookie-prefix escaped and encoded secret canaries cannot enter handoff', async () => {
    for (const secretCookie of [
      'prefix:sensitive-canary:suffix',
      encodeURIComponent('prefix:sensitive-canary'),
      Buffer.from('sensitive-canary').toString('base64'),
    ]) {
      const h = await harness({ secretCookie }),
        session = await h.create(),
        cookie = await h.bootstrap(session);
      expect(
        (
          await h.request(
            `/login/${session.sessionId}/fill`,
            { version: 'v1' },
            { human: true, cookie },
          )
        ).status,
      ).toBe(200);
      const release = await h.request(`/v1/sessions/${session.sessionId}/release`, {});
      expect(release.status).toBe(503);
      expect(h.saved).toBeNull();
    }
  });
  it('explicit enrollment requires opt-in and exact verified BU identity', async () => {
    const h = await harness(),
      session = await h.create(),
      cookie = await h.bootstrap(session);
    const response = await h.request(
      `/login/${session.sessionId}/save-fill`,
      {
        identifier: 'foreign@bu.edu',
        password: 'not-a-real-password',
        consent: true,
        version: 'v1',
      },
      { human: true, cookie },
    );
    expect(response.status).toBe(403);
    expect(h.vault.save).not.toHaveBeenCalled();
    expect(h.browser.fill).not.toHaveBeenCalled();
  });
  it('destructive control cleanup forgets even without live owner authorization', async () => {
    const h = await harness();
    await h.create();
    h.revoke();
    const response = await h.request(
      '/v1/credentials',
      {
        owner,
        workspaceId: 'workspace',
        workspaceGeneration: 'workspace',
        provider: 'blackboard',
        origin: 'https://shib.bu.edu',
      },
      { method: 'DELETE' },
    );
    expect(response.status).toBe(200);
    expect(h.vault.forget).toHaveBeenCalled();
    expect(h.closed).toBe(1);
  });
  it('expired auth cannot create grants; no CORS entry or arbitrary paths', async () => {
    const h = await harness();
    h.expire();
    expect((await h.request('/v1/grants', h.grant)).status).toBe(400);
    const response = await h.request('/health');
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
    expect((await h.request('/v1/control')).status).toBe(404);
  });
});
it('reviewed form and network policy reject lookalikes, frames, GET and external targets', () => {
  const valid = {
    topOrigin: 'https://shib.bu.edu',
    frameCount: 1,
    pageCount: 1,
    forms: 1,
    passwords: 1,
    identifiers: 1,
    method: 'post',
    target: '',
    actionOrigin: 'https://shib.bu.edu',
    actionPath: '/idp/profile/SAML2/Redirect/SSO',
    identifierType: 'text',
    passwordType: 'password',
    submitters: 1,
  };
  expect(checkFormFacts(valid)).toBe(true);
  for (const change of [
    { frameCount: 2 },
    { method: 'get' },
    { target: '_blank' },
    { actionOrigin: 'https://shib.bu.edu.evil.com' },
  ])
    expect(() => checkFormFacts({ ...valid, ...change })).toThrow();
  expect(allowedUrl('https://shib.bu.edu/idp')).toBe(true);
  for (const url of [
    'http://shib.bu.edu/idp',
    'https://shib.bu.edu:8443/idp',
    'https://shib.bu.edu.evil.com/',
    'https://127.0.0.1/',
    'https://shib.bu.edu@evil.com/',
  ])
    expect(allowedUrl(url)).toBe(false);
  expect(allowedOrigin('piazza', 'https://shib.bu.edu')).toBe(false);
});
