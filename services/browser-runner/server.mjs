import http from 'node:http';
import { randomBytes, randomUUID, timingSafeEqual, createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { WebSocket, WebSocketServer } from 'ws';

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ownerPattern = /^[a-f0-9]{64}$/;
const hash = (value) => createHash('sha256').update(value).digest('hex');
const same = (left, right) => {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const failure = (status, code) =>
  Object.assign(new Error('Browser operation unavailable.'), { status, code });
const assets = new Map([
  ['/assets/viewer.js', ['viewer.js', 'text/javascript']],
  ['/assets/viewer.css', ['viewer.css', 'text/css']],
]);
async function jsonBody(request) {
  if (request.headers['content-type']?.split(';')[0] !== 'application/json')
    throw failure(415, 'content_type');
  const chunks = [];
  let size = 0;
  for await (const piece of request) {
    size += piece.length;
    if (size > 16384) throw failure(413, 'body_size');
    chunks.push(piece);
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw failure(400, 'body_json');
  }
}
function send(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  response.end(body === undefined ? '' : JSON.stringify(body));
}

/** Only an authenticated broker can create sessions; human viewers receive one
 * session-scoped capability, never control API credentials or arbitrary CDP. */
export function createRunner({
  store,
  engine,
  controlKey,
  publicOrigin,
  projectId,
  proxyUrl,
  now = Date.now,
  maximum = 1,
}) {
  if (typeof controlKey !== 'string' || controlKey.length < 40)
    throw new Error('Control key configuration required.');
  const origin = new URL(publicOrigin).origin;
  if (origin !== publicOrigin) throw new Error('Canonical public origin required.');
  const sessions = new Map();
  let starting = 0;
  const controls = new WebSocketServer({
    noServer: true,
    maxPayload: 8 * 1024 * 1024,
    perMessageDeflate: false,
  });
  const viewers = new WebSocketServer({
    noServer: true,
    maxPayload: 8192,
    perMessageDeflate: false,
  });
  const authenticate = (request) => {
    if (
      !same(request.headers.authorization, 'Bearer ' + controlKey) ||
      !ownerPattern.test(request.headers['x-soma-owner'] ?? '')
    )
      throw failure(401, 'authorization');
    return request.headers['x-soma-owner'];
  };
  const fence = async (session) => {
    if (!session || session.ending || session.expires <= now()) throw failure(404, 'session_ended');
    const meta = await store.inspect(session.contextId, session.owner);
    if (meta.active?.id !== session.id || meta.active.expiresAt <= now())
      throw failure(404, 'session_ended');
  };
  const getSession = async (id, owner) => {
    const session = sessions.get(id);
    if (!session || session.owner !== owner) throw failure(404, 'session_missing');
    await fence(session);
    return session;
  };
  const checkViewerGrant = ({ session, key, grant }) => {
    if (
      session.ending ||
      session.expires <= now() ||
      session.cookies.get(key) !== grant ||
      grant.expires <= now()
    )
      throw failure(401, 'viewer_cookie');
  };
  const viewerSession = async (id, request) => {
    const session = sessions.get(id);
    const cookie = /(?:^|;\s*)__Secure-soma_view=([A-Za-z0-9_-]{43})(?:;|$)/.exec(
      request.headers.cookie ?? '',
    )?.[1];
    const key = cookie && hash(cookie),
      grant = key && session?.cookies.get(key);
    if (!grant || grant.expires <= now()) throw failure(401, 'viewer_cookie');
    await fence(session);
    if (session.mode !== 'login') throw failure(403, 'viewer_mode');
    return { session, key, grant };
  };
  const viewerTiming = (session) => ({
    ready: true,
    expiresAt: new Date(session.expires).toISOString(),
    remainingMs: Math.max(0, session.expires - now()),
  });
  const revoke = (session) => {
    session.tokens.clear();
    session.cookies.clear();
    for (const socket of [...session.viewers, ...session.controllers]) socket.close(1000);
  };
  async function finish(session, persist = true) {
    if (session.cleanup) return session.cleanup;
    const alreadyEnding = session.ending;
    session.ending = true;
    revoke(session);
    clearTimeout(session.timer);
    session.cleanup = (async () => {
      let saveError;
      try {
        if (persist && !alreadyEnding && session.expires > now())
          await store.finish(
            session.contextId,
            session.owner,
            session.id,
            await session.browser.snapshot(),
          );
      } catch (error) {
        await store.abandon(session.contextId, session.owner, session.id).catch(() => undefined);
        saveError = error;
      }
      // A failed close retains a revoked session reference and capacity until retry.
      // DELETE cannot report successful cleanup while this close remains unconfirmed.
      await session.browser.close();
      sessions.delete(session.id);
      if (saveError) throw saveError;
    })();
    try {
      return await session.cleanup;
    } finally {
      session.cleanup = null;
    }
  }
  const metadata = (session) => ({
    id: session.id,
    projectId,
    contextId: session.contextId,
    status: 'RUNNING',
    expiresAt: new Date(session.expires).toISOString(),
    connectUrl: origin.replace(/^http/, 'ws') + '/cdp/' + session.id,
    userMetadata: { somaOwner: session.owner },
  });
  const server = http.createServer(async (request, response) => {
    try {
      if (
        !request.url ||
        !request.url.startsWith('/') ||
        request.url.startsWith('//') ||
        request.url.length > 2048 ||
        request.url.includes('%') ||
        request.url.includes('\\')
      )
        throw failure(400, 'request_path');
      const url = new URL(request.url, origin),
        path = url.pathname;
      if (request.method === 'GET' && path === '/health' && !url.search) {
        send(response, 200, { status: 'ok' });
        return;
      }
      if (request.method === 'GET' && assets.has(path) && !url.search) {
        const [file, type] = assets.get(path);
        response.writeHead(200, {
          'Content-Type': type,
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        response.end(await readFile(new URL(file, import.meta.url)));
        return;
      }
      const viewer = /^\/viewer\/([a-f0-9-]+)(?:\/(bootstrap|resume))?$/.exec(path);
      if (viewer) {
        if (!uuid.test(viewer[1]) || url.search) throw failure(404, 'viewer_missing');
        if (request.method === 'GET' && !viewer[2]) {
          response.writeHead(200, {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
            'Referrer-Policy': 'no-referrer',
            'X-Content-Type-Options': 'nosniff',
            'Content-Security-Policy':
              "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src data:; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
          });
          response.end(await readFile(new URL('viewer.html', import.meta.url)));
          return;
        }
        if (request.method !== 'POST' || !viewer[2] || request.headers.origin !== origin)
          throw failure(403, 'viewer_origin');
        if (viewer[2] === 'resume') {
          const access = await viewerSession(viewer[1], request),
            { session } = access,
            body = await jsonBody(request);
          if (!body || Array.isArray(body) || typeof body !== 'object' || Object.keys(body).length)
            throw failure(400, 'resume_body');
          // Cookie-only recovery never renews the allocation, cookie or entry capability.
          await fence(session);
          checkViewerGrant(access);
          send(response, 200, viewerTiming(session));
          return;
        }
        const session = sessions.get(viewer[1]);
        await fence(session);
        if (session.mode !== 'login') throw failure(403, 'viewer_mode');
        const body = await jsonBody(request);
        if (!body || typeof body.token !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(body.token))
          throw failure(401, 'viewer_token');
        const grant = session.tokens.get(hash(body.token));
        if (!grant || grant.expires <= now()) throw failure(401, 'viewer_token');
        // Consume before asynchronous work; revoke every previously established viewer.
        session.tokens.clear();
        session.cookies.clear();
        for (const socket of session.viewers) socket.close(1000);
        const cookie = randomBytes(32).toString('base64url');
        session.cookies.set(hash(cookie), { pageId: grant.pageId, expires: session.expires });
        response.setHeader(
          'Set-Cookie',
          `__Secure-soma_view=${cookie}; Path=/viewer/${session.id}; HttpOnly; Secure; SameSite=Strict; Max-Age=${Math.max(0, Math.floor((session.expires - now()) / 1000))}`,
        );
        send(response, 200, viewerTiming(session));
        return;
      }
      if (request.method === 'GET' && path === '/v1/projects' && !url.search) {
        if (!same(request.headers.authorization, 'Bearer ' + controlKey))
          throw failure(401, 'authorization');
        send(response, 200, [{ id: projectId }]);
        return;
      }
      const owner = authenticate(request);
      if (
        url.search &&
        !(
          request.method === 'GET' &&
          /^\/v1\/sessions\/[a-f0-9-]+\/debug$/.test(path) &&
          url.search === '?expiresIn=600'
        )
      )
        throw failure(400, 'request_query');
      if (request.method === 'POST' && path === '/v1/contexts') {
        const body = await jsonBody(request);
        if (body.projectId !== projectId || body.userMetadata?.somaOwner !== owner)
          throw failure(403, 'context_owner');
        send(response, 201, { id: await store.create(owner) });
        return;
      }
      const context = /^\/v1\/contexts\/([a-f0-9-]+)$/.exec(path);
      if (context && uuid.test(context[1])) {
        if (request.method === 'GET') {
          await store.inspect(context[1], owner);
          send(response, 200, { id: context[1], projectId, userMetadata: { somaOwner: owner } });
          return;
        }
        if (request.method === 'DELETE') {
          await store.remove(context[1], owner);
          for (const session of sessions.values())
            if (session.contextId === context[1] && session.owner === owner)
              await finish(session, false);
          send(response, 204);
          return;
        }
      }
      if (request.method === 'POST' && path === '/v1/sessions') {
        const body = await jsonBody(request),
          settings = body.browserSettings;
        if (
          body.projectId !== projectId ||
          body.userMetadata?.somaOwner !== owner ||
          !uuid.test(settings?.context?.id ?? '') ||
          settings.context.persist !== true ||
          settings.recordSession !== false ||
          settings.logSession !== false ||
          settings.solveCaptchas !== false ||
          !Number.isInteger(body.timeout) ||
          body.timeout < 30 ||
          body.timeout > 1800
        )
          throw failure(400, 'session_configuration');
        if (sessions.size + starting >= maximum) throw failure(429, 'browser_capacity');
        starting++;
        try {
          const id = randomUUID(),
            expires = now() + body.timeout * 1000;
          const saved = await store.claim(settings.context.id, owner, id, expires);
          let browser;
          try {
            browser = await engine.start({ state: saved.storageState, proxyUrl });
          } catch {
            await store.abandon(settings.context.id, owner, id).catch(() => undefined);
            throw failure(503, 'browser_startup');
          }
          const session = {
            id,
            contextId: settings.context.id,
            owner,
            expires,
            browser,
            mode: body.timeout > 180 ? 'login' : 'collect',
            tokens: new Map(),
            cookies: new Map(),
            viewers: new Set(),
            controllers: new Set(),
            ending: false,
          };
          sessions.set(id, session);
          session.timer = setTimeout(
            () => void finish(session, false).catch(() => undefined),
            Math.max(1, expires - now()),
          );
          session.timer.unref();
          try {
            await fence(session);
          } catch (error) {
            await finish(session, false).catch(() => undefined);
            await store.abandon(settings.context.id, owner, id).catch(() => undefined);
            throw error;
          }
          send(response, 201, metadata(session));
          return;
        } finally {
          starting--;
        }
      }
      const sessionPath = /^\/v1\/sessions\/([a-f0-9-]+)(?:\/(debug))?$/.exec(path);
      if (sessionPath && uuid.test(sessionPath[1])) {
        if (request.method === 'POST' && !sessionPath[2]) {
          const body = await jsonBody(request);
          if (body.status !== 'REQUEST_RELEASE') throw failure(400, 'release_status');
          const session = sessions.get(sessionPath[1]);
          if (!session || session.owner !== owner) throw failure(404, 'session_missing');
          if (!session.ending) await fence(session);
          await finish(session, true);
          send(response, 200, { status: 'COMPLETED' });
          return;
        }
        const session = await getSession(sessionPath[1], owner);
        if (request.method === 'GET' && !sessionPath[2]) {
          send(response, 200, metadata(session));
          return;
        }
        if (request.method === 'GET' && sessionPath[2]) {
          if (session.mode !== 'login') throw failure(403, 'viewer_mode');
          const pages = await session.browser.pages();
          if (pages.length > 100) throw failure(413, 'page_capacity');
          session.tokens.clear();
          send(response, 200, {
            pages: pages.map((page) => {
              const token = randomBytes(32).toString('base64url');
              session.tokens.set(hash(token), {
                pageId: page.id,
                expires: Math.min(session.expires, now() + 600000),
              });
              return {
                id: page.id,
                debuggerFullscreenUrl: origin + '/viewer/' + session.id + '#' + token,
              };
            }),
          });
          return;
        }
      }
      throw failure(404, 'route_missing');
    } catch (error) {
      send(response, Number.isInteger(error?.status) ? error.status : 503, {
        error: 'Browser operation unavailable.',
        code:
          typeof error?.code === 'string' && /^[a-z_]{1,60}$/.test(error.code)
            ? error.code
            : 'browser_unavailable',
      });
    }
  });
  server.on('upgrade', async (request, socket, head) => {
    try {
      if (
        !request.url ||
        request.url.includes('?') ||
        request.url.includes('%') ||
        request.url.includes('\\')
      )
        throw failure(401, 'socket_path');
      const control = /^\/cdp\/([a-f0-9-]+)$/.exec(request.url),
        view = /^\/viewer\/([a-f0-9-]+)\/socket$/.exec(request.url);
      if (control && uuid.test(control[1])) {
        const owner = authenticate(request),
          session = await getSession(control[1], owner);
        controls.handleUpgrade(request, socket, head, (client) => {
          session.controllers.add(client);
          const upstream = new WebSocket(session.browser.connectUrl, {
            maxPayload: 8 * 1024 * 1024,
            perMessageDeflate: false,
          });
          const queue = [];
          let size = 0;
          client.on('message', (data, binary) => {
            if (upstream.readyState === 1) {
              if (upstream.bufferedAmount > 8 * 1024 * 1024) client.close(1009);
              else upstream.send(data, { binary });
            } else if (upstream.readyState === 0) {
              size += data.length;
              if (size > 1024 * 1024) client.close(1009);
              else queue.push([data, binary]);
            }
          });
          upstream.on('open', () => {
            for (const [data, binary] of queue) upstream.send(data, { binary });
            queue.length = 0;
          });
          upstream.on('message', (data, binary) => {
            if (client.readyState === 1) {
              if (client.bufferedAmount > 8 * 1024 * 1024) client.close(1009);
              else client.send(data, { binary });
            }
          });
          const close = () => {
            session.controllers.delete(client);
            if (upstream.readyState === 0 || upstream.readyState === 1) upstream.close();
            if (client.readyState === 1) client.close();
          };
          client.on('close', close);
          client.on('error', close);
          upstream.on('close', close);
          upstream.on('error', close);
        });
        return;
      }
      if (view && uuid.test(view[1])) {
        if (request.headers.origin !== origin) throw failure(403, 'viewer_origin');
        const access = await viewerSession(view[1], request),
          { session, grant } = access;
        checkViewerGrant(access);
        viewers.handleUpgrade(request, socket, head, (client) => {
          session.viewers.add(client);
          client.once('close', () => session.viewers.delete(client));
          client.on('error', () => client.close());
          void session.browser.view(grant.pageId, client).catch(() => client.close(1008));
        });
        return;
      }
      throw failure(404, 'socket_missing');
    } catch {
      socket.write('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      socket.destroy();
    }
  });
  const audit = setInterval(() => {
    for (const session of sessions.values())
      void fence(session)
        .catch(() => finish(session, false))
        .catch(() => undefined);
  }, 3000);
  audit.unref();
  return {
    server,
    async close() {
      clearInterval(audit);
      for (const session of [...sessions.values()]) await finish(session, false);
      controls.close();
      viewers.close();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
