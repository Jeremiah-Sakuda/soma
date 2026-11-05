import http from 'node:http';
import { randomBytes, createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocketServer } from 'ws';
import { PROVIDER, LOGIN_ORIGIN, validIdentifier } from './policy.mjs';
import { credentialFailureFacts } from './diagnostics.mjs';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ownerPattern = /^[a-f0-9]{64}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const same = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const left = Buffer.from(a),
    right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
};
const fail = (code, status = 409) => {
  throw Object.assign(new Error('Credential operation unavailable.'), { code, status });
};
const fields = (body, required, optional = []) =>
  body &&
  typeof body === 'object' &&
  !Array.isArray(body) &&
  required.every((key) => Object.hasOwn(body, key)) &&
  Object.keys(body).every((key) => required.includes(key) || optional.includes(key));
const normalizeIdentifier = (value) => value.toLowerCase().replace(/@bu\.edu$/, '');

function secretFingerprints(password, key) {
  return [
    ...new Set([
      password,
      JSON.stringify(password).slice(1, -1),
      encodeURIComponent(password),
      Buffer.from(password).toString('base64'),
    ]),
  ]
    .filter(Boolean)
    .map((value) => ({
      length: value.length,
      digest: createHmac('sha256', key).update(value).digest('hex'),
    }));
}
function snapshotHasSecret(state, fingerprints, key) {
  const values = [],
    seen = new Set();
  let total = 0;
  const walk = (value) => {
    if (typeof value === 'string') {
      total += value.length;
      values.push(value);
      return;
    }
    if (value && typeof value === 'object') {
      if (seen.has(value)) throw new Error('Invalid state.');
      seen.add(value);
      for (const [name, item] of Object.entries(value)) {
        total += name.length;
        values.push(name);
        walk(item);
      }
    }
  };
  walk(state);
  if (total > 64 * 1024) return true;
  for (const value of values)
    for (const fingerprint of fingerprints ?? [])
      for (let i = 0; i <= value.length - fingerprint.length; i++)
        if (
          createHmac('sha256', key)
            .update(value.slice(i, i + fingerprint.length))
            .digest('hex') === fingerprint.digest
        )
          return true;
  return false;
}
async function body(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json')
    fail('content_type', 415);
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 8192) fail('body_size', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    fail('body_json', 400);
  }
}
function send(response, status, data) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(data === undefined ? '' : JSON.stringify(data));
}
/** No generic CDP route, model client, screenshots or arbitrary navigation API.
 * Control authenticates the broker only; human credentials stay on this origin. */
export function createCredentialRunner({
  store,
  vault,
  grantStore,
  audit,
  engine,
  authorize,
  controlKey,
  publicOrigin,
  proxyUrl,
  now = Date.now,
  maximum = 1,
  reportFailure = (facts) => console.warn(JSON.stringify(facts)),
}) {
  if (
    typeof controlKey !== 'string' ||
    controlKey.length < 40 ||
    typeof authorize !== 'function' ||
    typeof grantStore?.consume !== 'function' ||
    typeof audit?.emit !== 'function'
  )
    throw new Error('Credential runner configuration required.');
  const origin = new URL(publicOrigin).origin;
  if (origin !== publicOrigin || new URL(origin).protocol !== 'https:')
    throw new Error('Canonical HTTPS origin required.');
  const sessions = new Map(),
    maintenance = new Set();
  let starting = 0;
  const record = async (owner, event, outcome, sessionId = null, credentialVersion = null) => {
    try {
      await audit.emit(owner, {
        event,
        outcome,
        provider: PROVIDER,
        sessionHash: sessionId ? hash(sessionId) : null,
        credentialVersion,
        at: now(),
      });
    } catch {
      fail('credential_audit', 503);
    }
  };
  const viewers = new WebSocketServer({
    noServer: true,
    maxPayload: 8192,
    perMessageDeflate: false,
  });
  const control = (request) => {
    const owner = request.headers['x-soma-owner'];
    if (
      !same(request.headers.authorization, 'Bearer ' + controlKey) ||
      !ownerPattern.test(owner ?? '')
    )
      fail('authorization', 401);
    return owner;
  };
  const binding = (session) => ({
    owner: session.owner,
    workspaceId: session.grant.workspaceId,
    workspaceGeneration: session.grant.workspaceGeneration,
    provider: PROVIDER,
    origin: LOGIN_ORIGIN,
  });
  async function fence(session) {
    if (!session || session.ending || session.expires <= now() || maintenance.has(session.owner))
      fail('session_ended', 404);
    const meta = await store.inspect(session.contextId, session.owner);
    if (
      session.ending ||
      session.expires <= now() ||
      meta.active?.id !== session.id ||
      meta.active.expiresAt <= now()
    )
      fail('session_ended', 404);
  }
  async function authorized(session, purpose = 'credential') {
    await fence(session);
    const identity = await authorize(session.grant, { purpose });
    await fence(session);
    if (!validIdentifier(identity?.identifier)) fail('identity_unavailable', 403);
    return identity;
  }
  function liveCookie(session, request) {
    const cookie = /(?:^|;\s*)__Secure-soma_credential=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
      request.headers.cookie ?? '',
    )?.[1];
    if (!session || !cookie || session.cookieHash !== hash(cookie)) fail('human_session', 401);
  }
  async function human(id, request) {
    const session = sessions.get(id);
    liveCookie(session, request);
    await authorized(session, 'session');
    liveCookie(session, request);
    return session;
  }
  const safe = (session) => ({
    sessionId: session.id,
    phase: session.phase,
    expiresAt: new Date(session.expires).toISOString(),
    provider: PROVIDER,
  });
  function revoke(session) {
    session.tokenHash = null;
    session.cookieHash = null;
    for (const socket of session.viewers) socket.close(1000);
    session.viewers.clear();
  }
  async function finish(session, persist) {
    if (session.cleanup) return session.cleanup;
    session.ending = true;
    revoke(session);
    clearTimeout(session.timer);
    session.cleanup = (async () => {
      let failure;
      await session.started;
      try {
        if (session.stateReleased) {
          /* a retried close must not overwrite auth state */
        } else if (persist && session.phase === 'mfa') {
          // authorization intentionally performed directly: ending blocks normal ops.
          await authorize(session.grant, { purpose: 'session' });
          const state = await session.browser.snapshot();
          await authorize(session.grant, { purpose: 'session' });
          const current = await store.inspect(session.contextId, session.owner);
          if (current.active?.id !== session.id || current.active.expiresAt <= now())
            fail('session_ended');
          // Bounded HMAC substring checks cover raw/escaped/URL/base64 password canaries without retaining plaintext.
          if (snapshotHasSecret(state, session.secretFingerprints, session.secretHmacKey))
            fail('state_secret', 503);
          await record(session.owner, 'session_saved', 'started', session.id);
          await authorize(session.grant, { purpose: 'session' });
          const latest = await store.inspect(session.contextId, session.owner);
          if (
            maintenance.has(session.owner) ||
            session.expires <= now() ||
            latest.active?.id !== session.id ||
            latest.active.expiresAt <= now()
          )
            fail('session_ended');
          await store.finish(session.contextId, session.owner, session.id, state);
          session.stateReleased = true;
          await record(session.owner, 'session_saved', 'succeeded', session.id);
        } else {
          await store.abandon(session.contextId, session.owner, session.id);
          session.stateReleased = true;
          await record(session.owner, 'session_revoked', 'succeeded', session.id);
        }
      } catch (error) {
        failure = error;
        await record(
          session.owner,
          persist ? 'session_saved' : 'session_revoked',
          'failed',
          session.id,
        ).catch(() => undefined);
        try {
          await store.abandon(session.contextId, session.owner, session.id);
          session.stateReleased = true;
        } catch {
          /* retain fence for explicit cleanup retry */
        }
      }
      if (session.browser) await session.browser.close();
      sessions.delete(session.id);
      if (failure) throw failure;
    })();
    try {
      return await session.cleanup;
    } finally {
      session.cleanup = null;
    }
  }
  async function performFill(session, version, secret, identity) {
    const fresh = await vault.metadata(binding(session));
    if (fresh.status !== 'active' || fresh.version !== version) fail('credential_changed');
    await authorized(session);
    if (normalizeIdentifier(secret.identifier) !== normalizeIdentifier(identity.identifier))
      fail('identity_mismatch', 403);
    // Keep only keyed transient canary digests; no credential or hash is audited.
    session.secretHmacKey = randomBytes(32);
    session.secretFingerprints = secretFingerprints(secret.password, session.secretHmacKey);
    await record(session.owner, 'fill_started', 'started', session.id, version);
    await session.browser.fill(secret, async () => {
      await authorized(session);
      const latest = await vault.metadata(binding(session));
      if (latest.status !== 'active' || latest.version !== version) fail('credential_changed');
      await authorized(session);
    });
    await authorized(session);
    const latest = await vault.metadata(binding(session));
    if (latest.status !== 'active' || latest.version !== version) fail('credential_changed');
    await session.browser.safeForViewer();
    await record(session.owner, 'fill_succeeded', 'succeeded', session.id, version);
    session.phase = 'mfa';
  }
  const server = http.createServer(async (request, response) => {
    let diagnosticOperation = 'unknown';
    try {
      if (
        !request.url ||
        !request.url.startsWith('/') ||
        request.url.startsWith('//') ||
        request.url.length > 2048 ||
        request.url.includes('%') ||
        request.url.includes('\\')
      )
        fail('request_path', 400);
      const url = new URL(request.url, origin),
        path = url.pathname;
      if (url.search) fail('request_query', 400);
      if (request.method === 'GET' && path === '/health') {
        send(response, 200, { status: 'ok', protocol: 'credential-login-v1' });
        return;
      }
      if (
        request.method === 'GET' &&
        ['/assets/login.js', '/assets/login.css', '/assets/mfa.js'].includes(path)
      ) {
        const file = path.slice('/assets/'.length);
        response.writeHead(200, {
          'Content-Type': file.endsWith('.css') ? 'text/css' : 'text/javascript',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(await readFile(new URL(file, import.meta.url)));
        return;
      }
      const login = /^\/login\/([a-f0-9-]+)(?:\/(bootstrap|status|save-fill|fill|forget))?$/.exec(
        path,
      );
      if (login && uuid.test(login[1])) {
        diagnosticOperation = login[2] ?? 'unknown';
        if (request.method === 'GET' && !login[2]) {
          response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy':
              "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
          });
          response.end(await readFile(new URL('login.html', import.meta.url)));
          return;
        }
        if (request.method !== 'POST' || request.headers.origin !== origin || !login[2])
          fail('human_origin', 403);
        const data = await body(request),
          session = sessions.get(login[1]);
        if (login[2] === 'bootstrap') {
          if (
            !fields(data, ['token']) ||
            typeof data.token !== 'string' ||
            !/^[A-Za-z0-9_-]{43}$/.test(data.token)
          )
            fail('entry_token', 401);
          await authorized(session, 'session');
          if (
            !session.tokenHash ||
            session.entryExpires <= now() ||
            !same(session.tokenHash, hash(data.token))
          )
            fail('entry_token', 401);
          session.tokenHash = null;
          revoke(session);
          await record(session.owner, 'grant_used', 'succeeded', session.id);
          const cookie = randomBytes(32).toString('base64url');
          session.cookieHash = hash(cookie);
          response.setHeader(
            'Set-Cookie',
            `__Secure-soma_credential=${cookie}; Path=/login/${session.id}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.floor((session.expires - now()) / 1000)}`,
          );
          send(response, 200, {
            ...safe(session),
            credential: await vault.metadata(binding(session)),
          });
          return;
        }
        await human(login[1], request);
        if (login[2] === 'status') {
          if (!fields(data, [])) fail('body_invalid', 400);
          send(response, 200, {
            ...safe(session),
            credential: await vault.metadata(binding(session)),
          });
          return;
        }
        if (login[2] === 'forget') {
          if (!fields(data, ['version']) || typeof data.version !== 'string')
            fail('body_invalid', 400);
          // Disable filling synchronously before the first vault operation.
          await authorized(session);
          session.used = true;
          session.phase = 'revoked';
          for (const socket of session.viewers) socket.close(1000);
          await vault.forget(binding(session), data.version);
          await record(session.owner, 'credential_forgotten', 'succeeded', session.id);
          await finish(session, false);
          send(response, 200, { status: 'forgotten' });
          return;
        }
        if (!['fill', 'save-fill'].includes(login[2]) || session.used || session.phase !== 'ready')
          fail('fill_consumed');
        session.used = true;
        session.phase = 'filling'; // one-use before awaits and concurrent requests
        let secret;
        try {
          const identity = await authorized(session);
          let version;
          if (login[2] === 'save-fill') {
            if (
              !fields(data, ['identifier', 'password', 'consent', 'version']) ||
              data.consent !== true ||
              !validIdentifier(data.identifier) ||
              typeof data.password !== 'string' ||
              data.password.length < 1 ||
              data.password.length > 1024 ||
              (data.version !== null && typeof data.version !== 'string')
            )
              fail('body_invalid', 400);
            if (normalizeIdentifier(data.identifier) !== normalizeIdentifier(identity.identifier))
              fail('identity_mismatch', 403);
            secret = { identifier: data.identifier, password: data.password };
            await authorized(session);
            await record(session.owner, 'consent', 'succeeded', session.id);
            await authorized(session);
            const saved = await vault.save(binding(session), secret, data.version);
            version = saved.version;
            await record(session.owner, 'credential_saved', 'succeeded', session.id, version);
          } else {
            if (!fields(data, ['version']) || typeof data.version !== 'string')
              fail('body_invalid', 400);
            version = data.version;
            await authorized(session);
            secret = await vault.decrypt(binding(session), version);
          }
          await performFill(session, version, secret, identity);
          send(response, 200, safe(session));
          return;
        } catch (error) {
          session.phase = 'failed';
          await record(session.owner, 'fill_failed', 'failed', session.id).catch(() => undefined);
          await finish(session, false).catch(() => undefined);
          throw error;
        } finally {
          if (secret) {
            secret.identifier = '';
            secret.password = '';
          }
          if (data && typeof data === 'object') {
            delete data.password;
            delete data.identifier;
          }
        }
      }
      if (path.startsWith('/login/')) fail('route_missing', 404);
      const owner = control(request);
      if (path === '/v1/grants') diagnosticOperation = 'allocate';
      else if (path === '/v1/credentials/rotate') diagnosticOperation = 'rotate';
      else if (path === '/v1/credentials') diagnosticOperation = 'forget';
      if (request.method === 'DELETE' && path === '/v1/credentials') {
        const data = await body(request);
        if (
          !fields(data, ['owner', 'workspaceId', 'workspaceGeneration', 'provider', 'origin']) ||
          data.owner !== owner ||
          data.provider !== PROVIDER ||
          data.origin !== LOGIN_ORIGIN ||
          typeof data.workspaceId !== 'string' ||
          typeof data.workspaceGeneration !== 'string' ||
          data.workspaceGeneration !== data.workspaceId
        )
          fail('binding_invalid', 400);
        if (maintenance.has(owner)) fail('credential_maintenance');
        maintenance.add(owner);
        try {
          for (const session of [...sessions.values()])
            if (
              session.owner === owner &&
              session.grant.workspaceId === data.workspaceId &&
              session.grant.workspaceGeneration === data.workspaceGeneration
            )
              await finish(session, false);
          let forgotten = false;
          for (let attempt = 0; attempt < 3; attempt++) {
            try {
              const meta = await vault.metadata(data);
              await vault.forget(data, meta.version);
              forgotten = true;
              break;
            } catch (error) {
              if (error.code !== 'CONFLICT') throw error;
            }
          }
          if (!forgotten) fail('credential_changed');
          await record(owner, 'credential_forgotten', 'succeeded');
          send(response, 200, { status: 'forgotten' });
          return;
        } catch (error) {
          await record(owner, 'credential_forgotten', 'failed').catch(() => undefined);
          throw error;
        } finally {
          maintenance.delete(owner);
        }
      }
      if (request.method === 'POST' && path === '/v1/credentials/rotate') {
        const data = await body(request);
        if (
          !fields(data, ['owner', 'workspaceId', 'workspaceGeneration', 'provider', 'origin']) ||
          data.owner !== owner ||
          data.provider !== PROVIDER ||
          data.origin !== LOGIN_ORIGIN ||
          typeof data.workspaceId !== 'string' ||
          typeof data.workspaceGeneration !== 'string' ||
          data.workspaceGeneration !== data.workspaceId
        )
          fail('binding_invalid', 400);
        if (maintenance.has(owner)) fail('credential_maintenance');
        maintenance.add(owner);
        try {
          for (const session of [...sessions.values()])
            if (
              session.owner === owner &&
              session.grant.workspaceId === data.workspaceId &&
              session.grant.workspaceGeneration === data.workspaceGeneration
            )
              await finish(session, false);
          await record(owner, 'credential_rotated', 'started');
          const meta = await vault.metadata(data);
          if (meta.status !== 'active') fail('credential_missing', 404);
          const rotated = await vault.rotate(data, meta.version);
          await record(owner, 'credential_rotated', 'succeeded', null, rotated.version);
          send(response, 200, { status: 'rotated', version: rotated.version });
          return;
        } catch (error) {
          await record(owner, 'credential_rotated', 'failed').catch(() => undefined);
          throw error;
        } finally {
          maintenance.delete(owner);
        }
      }
      if (request.method === 'POST' && path === '/v1/grants') {
        const data = await body(request);
        if (
          !fields(data, [
            'uid',
            'workspaceId',
            'workspaceGeneration',
            'provider',
            'contextId',
            'connectionVersion',
            'recentAuthAt',
            'authorizationId',
          ]) ||
          data.provider !== PROVIDER ||
          !uuid.test(data.contextId ?? '') ||
          !uuid.test(data.authorizationId ?? '') ||
          typeof data.uid !== 'string' ||
          data.uid.length < 1 ||
          data.uid.length > 128 ||
          typeof data.workspaceId !== 'string' ||
          data.workspaceId.length < 1 ||
          data.workspaceId.length > 256 ||
          typeof data.workspaceGeneration !== 'string' ||
          data.workspaceGeneration !== data.workspaceId ||
          !Number.isSafeInteger(data.connectionVersion) ||
          data.connectionVersion < 1 ||
          !Number.isSafeInteger(data.recentAuthAt) ||
          data.recentAuthAt > Math.floor(now() / 1000) + 30 ||
          data.recentAuthAt < Math.floor(now() / 1000) - 5 * 60
        )
          fail('grant_invalid', 400);
        await record(owner, 'grant_issued', 'started', data.authorizationId);
        if (maintenance.has(owner)) {
          await record(owner, 'grant_denied', 'failed', data.authorizationId);
          fail('credential_maintenance');
        }
        if (sessions.size + starting >= maximum) {
          await record(owner, 'grant_denied', 'failed', data.authorizationId);
          fail('login_capacity', 429);
        }
        starting++;
        let session;
        try {
          const grant = { ...data, owner };
          const identity = await authorize(grant);
          if (maintenance.has(owner)) fail('credential_maintenance');
          if (!validIdentifier(identity?.identifier)) fail('identity_unavailable', 403);
          const id = data.authorizationId,
            expires = now() + 30 * 60_000;
          if (sessions.has(id)) fail('grant_replayed');
          await grantStore.consume(id, owner);
          const claimed = await store.claim(data.contextId, owner, id, expires);
          let resolveStarted;
          const started = new Promise((resolve) => {
            resolveStarted = resolve;
          });
          session = {
            id,
            owner,
            grant,
            contextId: data.contextId,
            expires,
            entryExpires: now() + 10 * 60_000,
            tokenHash: null,
            cookieHash: null,
            browser: null,
            phase: 'starting',
            used: false,
            ending: false,
            viewers: new Set(),
            started,
          };
          sessions.set(id, session);
          try {
            session.browser = await engine.start({ state: claimed.storageState, proxyUrl });
          } catch {
            resolveStarted();
            fail('browser_startup', 503);
          }
          resolveStarted();
          if (session.ending) fail('grant_revoked');
          const token = randomBytes(32).toString('base64url');
          session.phase = 'ready';
          session.tokenHash = hash(token);
          const browser = session.browser;
          session.timer = setTimeout(
            () => void finish(session, false).catch(() => undefined),
            Math.max(1, expires - now()),
          );
          session.timer.unref();
          await authorized(session);
          const inspected = await browser.inspect();
          if (!inspected.reviewed) fail('form_not_reviewed');
          await record(owner, 'grant_issued', 'succeeded', id);
          send(response, 201, {
            sessionId: id,
            loginUrl: `${origin}/login/${id}#${token}`,
            expiresAt: new Date(expires).toISOString(),
          });
          return;
        } catch (error) {
          await record(
            owner,
            error?.code === 'grant_replayed' ? 'grant_replayed' : 'grant_denied',
            'failed',
            data.authorizationId,
          ).catch(() => undefined);
          if (session) await finish(session, false).catch(() => undefined);
          throw error;
        } finally {
          starting--;
        }
      }
      const operation = /^\/v1\/sessions\/([a-f0-9-]+)(?:\/(release))?$/.exec(path);
      if (operation && uuid.test(operation[1])) {
        diagnosticOperation =
          operation[2] === 'release'
            ? 'release'
            : request.method === 'DELETE'
              ? 'cancel'
              : 'status';
        const session = sessions.get(operation[1]);
        if (!session) {
          if (request.method === 'DELETE' && !operation[2]) {
            const data = await body(request);
            if (!fields(data, ['contextId']) || !uuid.test(data.contextId ?? ''))
              fail('body_invalid', 400);
            const meta = await store.inspect(data.contextId, owner);
            if (meta.active?.id === operation[1])
              await store.abandon(data.contextId, owner, operation[1]);
            await record(owner, 'session_revoked', 'succeeded', operation[1]);
            send(response, 204);
            return;
          }
          fail('session_missing', 404);
        }
        if (session.owner !== owner) fail('session_missing', 404);
        if (request.method === 'DELETE' && !operation[2]) {
          await finish(session, false);
          send(response, 204);
          return;
        }
        await authorized(session, 'session');
        if (request.method === 'GET' && !operation[2]) {
          send(response, 200, safe(session));
          return;
        }
        if (request.method === 'POST' && operation[2] === 'release') {
          const data = await body(request);
          if (!fields(data, [])) fail('body_invalid', 400);
          await finish(session, true);
          send(response, 200, { status: 'completed' });
          return;
        }
      }
      fail('route_missing', 404);
    } catch (error) {
      const facts = credentialFailureFacts(error, diagnosticOperation);
      try {
        void Promise.resolve(reportFailure(facts)).catch(() => undefined);
      } catch {
        /* diagnostic delivery never changes cleanup or the rejection */
      }
      send(response, facts.status, {
        error: 'Credential operation unavailable. Start a fresh login or use manual sign-in.',
        code: facts.code,
      });
    }
  });
  server.on('upgrade', async (request, socket, head) => {
    try {
      const matched = /^\/login\/([a-f0-9-]+)\/socket$/.exec(request.url ?? '');
      if (!matched || !uuid.test(matched[1]) || request.headers.origin !== origin)
        fail('socket_denied', 401);
      const session = await human(matched[1], request);
      if (session.phase !== 'mfa') fail('viewer_not_ready', 403);
      await session.browser.safeForViewer();
      await authorized(session, 'session');
      liveCookie(session, request);
      if (session.phase !== 'mfa') fail('viewer_not_ready', 403);
      viewers.handleUpgrade(request, socket, head, (client) => {
        session.viewers.add(client);
        client.once('close', () => session.viewers.delete(client));
        client.on('error', () => client.close());
        void session.browser.view(client).catch(() => client.close(1008));
      });
    } catch {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
    }
  });
  server.headersTimeout = 15_000;
  server.requestTimeout = 45_000;
  server.keepAliveTimeout = 1000;
  // Cloud Run may suspend background CPU while no HTTP request is active.
  // One delayed callback must not create overlapping checks or turn a transient
  // authorization outage into destructive cancellation. All human/control/viewer
  // operations still perform fresh authorization at their own sensitive boundary.
  const sweep = setInterval(() => {
    for (const session of sessions.values()) {
      if (session.checking || session.ending) continue;
      session.checking = true;
      void authorized(session, 'session')
        .catch(async (error) => {
          const facts = credentialFailureFacts(error, 'sweep');
          try {
            void Promise.resolve(reportFailure(facts)).catch(() => undefined);
          } catch {
            /* diagnostics cannot affect the safety boundary */
          }
          if (error?.status === 503) {
            // Uncertainty grants no continued stream or new operation. Retain only the
            // original bounded setup so a later fresh successful check can recover.
            for (const socket of session.viewers) socket.close(1008);
            session.viewers.clear();
          } else await finish(session, false);
        })
        .catch(() => undefined)
        .finally(() => {
          session.checking = false;
        });
    }
  }, 1000);
  sweep.unref();
  return {
    server,
    async close() {
      clearInterval(sweep);
      for (const session of [...sessions.values()]) await finish(session, false);
      viewers.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
