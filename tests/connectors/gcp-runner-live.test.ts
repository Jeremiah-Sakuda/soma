import { randomUUID, createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { describe, it, expect } from 'vitest';
import { chromium } from 'playwright-core';
const { WebSocket } = createRequire(
  new URL('../../services/browser-runner/package.json', import.meta.url),
)('ws');
const holdSeconds = Number(process.env.SOMA_GCP_RUNNER_HOLD_SECONDS ?? 0);

/** Original synthetic browser state only. No course account or Meta call. */
describe.skipIf(process.env.SOMA_GCP_RUNNER_LIVE_TEST !== 'true')(
  'GCP deployed browser runtime',
  () => {
    it(
      'proves private invocation, browser sandbox startup, CDP, encrypted restart and metadata denial',
      async () => {
        const origin = process.env.SOMA_GCP_BROWSER_URL,
          projectId = process.env.SOMA_GCP_BROWSER_PROJECT_ID;
        if (!origin || !projectId) throw new Error('Explicit deployed runner scope required.');
        if (!Number.isInteger(holdSeconds) || holdSeconds < 0 || holdSeconds > 180)
          throw new Error('Synthetic hold must be between zero and 180 seconds.');
        const control = readFileSync('.local/gcp-browser-secrets/control', 'utf8');
        const publicEntry = process.env.SOMA_GCP_RUNNER_PUBLIC_ENTRY === 'true';
        const identity = publicEntry
          ? undefined
          : execFileSync('gcloud', ['auth', 'print-identity-token', '--quiet'], {
              encoding: 'utf8',
            }).trim();
        const iamHeaders: Record<string, string> = identity
          ? { 'X-Serverless-Authorization': 'Bearer ' + identity }
          : {};
        const owner = createHash('sha256')
          .update('synthetic-gcp:' + randomUUID())
          .digest('hex');
        const headers = {
          Authorization: 'Bearer ' + control,
          ...iamHeaders,
          'X-Soma-Owner': owner,
          'Content-Type': 'application/json',
        };
        const call = async (path: string, method = 'GET', body?: unknown) =>
          fetch(origin + path, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
            signal: AbortSignal.timeout(65000),
            redirect: 'error',
          });
        const anonymous = await fetch(origin + '/v1/projects', {
          signal: AbortSignal.timeout(15000),
        });
        expect([401, 403]).toContain(anonymous.status);
        expect((await call('/v1/projects')).status).toBe(200);
        if (publicEntry) {
          expect(
            (await fetch(origin + '/health', { signal: AbortSignal.timeout(15000) })).status,
          ).toBe(200);
          expect(
            (
              await fetch(origin + '/v1/projects', {
                headers: { Authorization: 'Bearer original-synthetic-invalid-key' },
                signal: AbortSignal.timeout(15000),
              })
            ).status,
          ).toBe(401);
          expect(
            (
              await fetch(origin + '/v1/contexts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: '{}',
                signal: AbortSignal.timeout(15000),
              })
            ).status,
          ).toBe(401);
        }
        const contextResponse = await call('/v1/contexts', 'POST', {
          projectId,
          userMetadata: { somaOwner: owner },
        });
        expect(contextResponse.status).toBe(201);
        const context = (await contextResponse.json()) as { id: string };
        let sessionId: string | undefined,
          browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
        const start = async (timeout = 180) => {
          const response = await call('/v1/sessions', 'POST', {
            projectId,
            timeout,
            keepAlive: true,
            browserSettings: {
              context: { id: context.id, persist: true },
              recordSession: false,
              logSession: false,
              solveCaptchas: false,
            },
            userMetadata: { somaOwner: owner },
          });
          if (response.status !== 201) {
            const body = (await response.json()) as { code?: string };
            throw new Error(
              `Synthetic runner start failed: ${response.status}/${body.code ?? 'unknown'}`,
            );
          }
          const session = (await response.json()) as { id: string; connectUrl: string };
          sessionId = session.id;
          browser = await chromium.connectOverCDP(session.connectUrl, { headers, timeout: 20000 });
          return browser.contexts()[0];
        };
        const release = async () => {
          if (browser) {
            await browser.close();
            browser = undefined;
          }
          if (sessionId) {
            const response = await call('/v1/sessions/' + sessionId, 'POST', {
              status: 'REQUEST_RELEASE',
            });
            expect(response.status).toBe(200);
            sessionId = undefined;
          }
        };
        try {
          let contextBrowser = await start(),
            page = await contextBrowser.newPage();
          if (publicEntry) {
            const unauthenticated = new WebSocket(
              origin.replace(/^http/, 'ws') + '/cdp/' + sessionId,
            );
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error('Synthetic unauthorized CDP check timed out.')),
                10000,
              );
              unauthenticated.on('open', () => {
                clearTimeout(timer);
                unauthenticated.close();
                reject(new Error('Unauthenticated CDP unexpectedly opened.'));
              });
              unauthenticated.on(
                'unexpected-response',
                (_request: unknown, response: { statusCode: number; resume: () => void }) => {
                  clearTimeout(timer);
                  response.resume();
                  unauthenticated.terminate();
                  if (response.statusCode !== 401)
                    reject(new Error('Unauthenticated CDP was not rejected.'));
                  else resolve();
                },
              );
              unauthenticated.on('error', () => undefined);
            });
          }
          await page.goto('https://example.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
          });
          await contextBrowser.addCookies([
            {
              name: 'soma_synthetic',
              value: 'original-synthetic-state',
              domain: 'example.com',
              path: '/',
              secure: true,
              httpOnly: true,
              sameSite: 'Lax',
            },
          ]);
          await page.evaluate(async () => {
            localStorage.setItem('soma-synthetic', 'retained');
            await new Promise<void>((resolve, reject) => {
              const request = indexedDB.open('soma-synthetic', 1);
              request.onupgradeneeded = () => request.result.createObjectStore('values');
              request.onerror = () => reject(new Error('Synthetic database unavailable.'));
              request.onsuccess = () => {
                const db = request.result,
                  transaction = db.transaction('values', 'readwrite');
                transaction.objectStore('values').put('retained', 'key');
                transaction.oncomplete = () => {
                  db.close();
                  resolve();
                };
                transaction.onerror = () => reject(new Error('Synthetic write failed.'));
              };
            });
          });
          const blocked = await contextBrowser.newPage();
          const response = await blocked.goto('http://169.254.169.254/computeMetadata/v1/', {
            timeout: 10000,
          });
          expect(response?.status()).toBe(403);
          await blocked.close();
          await release();
          const objectUrl = `gs://soma-meta-jerem-2026-browser-state/browser-contexts/${context.id}.json`;
          const atRest = JSON.parse(
            execFileSync('gcloud', ['storage', 'cat', objectUrl, '--quiet'], { encoding: 'utf8' }),
          );
          expect(atRest.state?.v).toBe(1);
          expect(JSON.stringify(atRest)).not.toContain('original-synthetic-state');
          expect(JSON.stringify(atRest)).not.toContain('soma-synthetic');
          contextBrowser = await start();
          page = await contextBrowser.newPage();
          await page.goto('https://example.com/', {
            waitUntil: 'domcontentloaded',
            timeout: 25000,
          });
          expect(
            (await contextBrowser.cookies('https://example.com')).some(
              (cookie) =>
                cookie.name === 'soma_synthetic' && cookie.value === 'original-synthetic-state',
            ),
          ).toBe(true);
          expect(await page.evaluate(() => localStorage.getItem('soma-synthetic'))).toBe(
            'retained',
          );
          expect(
            await page.evaluate(
              () =>
                new Promise((resolve, reject) => {
                  const request = indexedDB.open('soma-synthetic', 1);
                  request.onerror = () => reject(new Error('Synthetic restore failed.'));
                  request.onsuccess = () => {
                    const db = request.result,
                      get = db.transaction('values').objectStore('values').get('key');
                    get.onsuccess = () => {
                      db.close();
                      resolve(get.result);
                    };
                    get.onerror = () => reject(new Error('Synthetic restore failed.'));
                  };
                }),
            ),
          ).toBe('retained');
          await release();
          contextBrowser = await start(1800);
          page = await contextBrowser.newPage();
          await page.setContent(
            '<html><body><h1>Original synthetic sign-in check</h1><input aria-label="Synthetic field"></body></html>',
          );
          const debugResponse = await call('/v1/sessions/' + sessionId + '/debug?expiresIn=600');
          expect(debugResponse.status).toBe(200);
          const debug = (await debugResponse.json()) as {
            pages: { id: string; debuggerFullscreenUrl: string }[];
          };
          const login = new URL(debug.pages.at(-1)!.debuggerFullscreenUrl);
          const bootstrap = await call(login.pathname + '/bootstrap', 'POST', {
            token: login.hash.slice(1),
          });
          expect(bootstrap.status).toBe(403);
          const boot = await fetch(origin + login.pathname + '/bootstrap', {
            method: 'POST',
            headers: { ...iamHeaders, Origin: origin, 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: login.hash.slice(1) }),
            signal: AbortSignal.timeout(15000),
          });
          expect(boot.status).toBe(200);
          const cookie = boot.headers.get('set-cookie')!.split(';')[0];
          const timing = (await boot.json()) as { expiresAt: string; remainingMs: number };
          expect(timing.remainingMs).toBeGreaterThan(28 * 60000);
          const resume = await fetch(origin + login.pathname + '/resume', {
            method: 'POST',
            headers: {
              ...iamHeaders,
              Origin: origin,
              Cookie: cookie,
              'Content-Type': 'application/json',
            },
            body: '{}',
            signal: AbortSignal.timeout(15000),
          });
          expect(resume.status).toBe(200);
          expect(resume.headers.get('set-cookie')).toBeNull();
          expect((await resume.json()).expiresAt).toBe(timing.expiresAt);
          const socket = new WebSocket(origin.replace(/^http/, 'ws') + login.pathname + '/socket', {
            headers: { ...iamHeaders, Origin: origin, Cookie: cookie },
          });
          try {
            await new Promise<void>((resolve, reject) => {
              const timer = setTimeout(
                () => reject(new Error('Synthetic viewer frame timed out.')),
                10000,
              );
              socket.on('error', () => {
                clearTimeout(timer);
                reject(new Error('Synthetic viewer unavailable.'));
              });
              socket.on('message', (bytes: Buffer) => {
                const value = JSON.parse(bytes.toString());
                if (
                  value.type === 'frame' &&
                  typeof value.data === 'string' &&
                  value.data.startsWith('/9j/')
                ) {
                  clearTimeout(timer);
                  resolve();
                }
              });
            });
            const field = page.getByLabel('Synthetic field'),
              box = await field.boundingBox();
            expect(box).not.toBeNull();
            for (const event of ['mousePressed', 'mouseReleased'])
              socket.send(
                JSON.stringify({
                  type: 'mouse',
                  event,
                  x: box!.x + box!.width / 2,
                  y: box!.y + box!.height / 2,
                }),
              );
            socket.send(JSON.stringify({ type: 'text', text: 'original-synthetic-input' }));
            await expect
              .poll(() => field.inputValue(), { timeout: 5000 })
              .toBe('original-synthetic-input');
            if (holdSeconds)
              await new Promise<void>((resolve, reject) => {
                const lost = () => {
                  clearTimeout(timer);
                  reject(new Error('Synthetic viewer disconnected during stability hold.'));
                };
                const timer = setTimeout(() => {
                  socket.off('close', lost);
                  resolve();
                }, holdSeconds * 1000);
                socket.once('close', lost);
              });
            const closed = new Promise<void>((resolve) => socket.once('close', () => resolve()));
            await release();
            await closed;
          } finally {
            socket.close();
          }
          expect((await call('/v1/contexts/' + context.id, 'DELETE')).status).toBe(204);
          expect((await call('/v1/contexts/' + context.id)).status).toBe(404);
          const erased = JSON.parse(
            execFileSync('gcloud', ['storage', 'cat', objectUrl, '--quiet'], { encoding: 'utf8' }),
          );
          expect(erased.deleted).toBe(true);
          expect(erased.state).toBeNull();
          expect(erased.active).toBeNull();
          process.stdout.write(
            JSON.stringify({
              syntheticGcpRuntime: true,
              publicEntry,
              anonymousControlDenied: true,
              stateRestored: ['cookies', 'localStorage', 'IndexedDB'],
              encryptedAtRest: true,
              metadataDenied: true,
              viewerFrame: true,
              viewerInput: true,
              cookieResume: true,
              viewerStableSeconds: holdSeconds,
              viewerRevoked: true,
              contextDeleted: true,
              modelCalls: 0,
            }) + '\n',
          );
        } finally {
          if (browser) await browser.close().catch(() => undefined);
          if (sessionId)
            await call('/v1/sessions/' + sessionId, 'POST', { status: 'REQUEST_RELEASE' }).catch(
              () => undefined,
            );
          await call('/v1/contexts/' + context.id, 'DELETE').catch(() => undefined);
        }
      },
      Math.max(
        150000,
        (Number.isInteger(holdSeconds) && holdSeconds >= 0 && holdSeconds <= 180
          ? holdSeconds
          : 0) *
          1000 +
          60000,
      ),
    );
  },
);
