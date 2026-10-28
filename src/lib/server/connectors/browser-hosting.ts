import { WorkspaceStoreError } from '../store';

export type BrowserBackend = 'browserbase' | 'gcp';
export type BrowserHostingReference = { backend?: unknown; version?: unknown };
const fail = (code = 'browser_configuration', status = 503) => new WorkspaceStoreError(
  code === 'browser_configuration' ? 'Browser hosting is not configured safely.' : 'The browser service returned an invalid private connection.', status, code,
);

export function configuredBrowserBackend(): BrowserBackend {
  const value = process.env.SOMA_BROWSER_BACKEND ?? 'browserbase';
  if (value !== 'browserbase' && value !== 'gcp') throw fail();
  return value;
}

/** An absent discriminator is the original encrypted Browserbase format. Never infer from IDs. */
export function recordedBrowserBackend(reference: BrowserHostingReference): BrowserBackend {
  if (reference.backend === undefined && reference.version === undefined) return 'browserbase';
  if (!['browserbase', 'gcp'].includes(reference.backend as string) || reference.version !== 1) throw fail('browser_backend', 409);
  return reference.backend as BrowserBackend;
}

export function browserHostingSettings(backend: BrowserBackend) {
  if (backend === 'browserbase') {
    const key = process.env.BROWSERBASE_API_KEY;
    if (!key) throw fail();
    return { backend, key, origin: 'https://api.browserbase.com', projectId: process.env.BROWSERBASE_PROJECT_ID };
  }
  let origin: URL;
  try { origin = new URL(process.env.SOMA_GCP_BROWSER_URL ?? ''); } catch { throw fail(); }
  const key = process.env.SOMA_GCP_BROWSER_CONTROL_KEY, projectId = process.env.SOMA_GCP_BROWSER_PROJECT_ID;
  if (origin.protocol !== 'https:' || !/^(?:[a-z0-9-]+\.)+run\.app$/.test(origin.hostname) || origin.username || origin.password || origin.port || origin.pathname !== '/' || origin.search || origin.hash
    || !key || !/^[A-Za-z0-9_-]{40,256}$/.test(key) || !projectId || !/^[A-Za-z0-9_-]{1,128}$/.test(projectId)) throw fail();
  return { backend, key, origin: origin.origin, projectId };
}

export function browserControlHeaders(backend: BrowserBackend, owner: string | undefined, path: string): Record<string, string> {
  const config = browserHostingSettings(backend);
  if (backend === 'browserbase') return { 'X-BB-API-Key': config.key, 'Content-Type': 'application/json' };
  if (path !== '/projects' && !/^[a-f0-9]{64}$/.test(owner ?? '')) throw fail('browser_owner', 403);
  return { Authorization: `Bearer ${config.key}`, 'Content-Type': 'application/json', ...(path === '/projects' ? {} : { 'X-Soma-Owner': owner! }) };
}

export async function browserControlRequest<T>(backend: BrowserBackend, owner: string | undefined, path: string, method = 'GET', body?: unknown, missingOk = false): Promise<T> {
  if (!/^\/(?:projects|contexts(?:\/[A-Za-z0-9_-]{1,160})?|sessions(?:\/[A-Za-z0-9_-]{1,160}(?:\/debug\?expiresIn=600)?)?)$/.test(path)) throw fail('browser_control_path');
  const config = browserHostingSettings(backend);
  const response = await fetch(`${config.origin}/v1${path}`, {
    method, headers: browserControlHeaders(backend, owner, path), ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(15_000), cache: 'no-store', redirect: 'error',
  });
  if (missingOk && response.status === 404) return undefined as T;
  if (!response.ok) throw Object.assign(new WorkspaceStoreError('The browser service is unavailable. Saved authorization has been retained; try again.', 503, 'browser_provider'), { providerStatus: response.status });
  if (response.status === 204 && method === 'GET') throw fail('browser_provider');
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

export function browserCdpOptions(backend: BrowserBackend, raw: string, sessionId: string, owner: string): { timeout: number; headers?: Record<string, string> } {
  let address: URL;
  try { address = new URL(raw); } catch { throw fail('browser_connect_target'); }
  if (backend === 'gcp') {
    const config = browserHostingSettings(backend), expected = new URL(config.origin); expected.protocol = 'wss:'; expected.pathname = `/cdp/${sessionId}`;
    if (address.href !== expected.href || address.username || address.password || address.search || address.hash) throw fail('browser_connect_target');
    const { 'Content-Type': _content, ...headers } = browserControlHeaders(backend, owner, '/sessions');
    return { timeout: 15_000, headers };
  }
  if (address.protocol !== 'wss:' || address.username || address.password || (address.port && address.port !== '443') || !(address.hostname === 'connect.browserbase.com' || /^connect\.[a-z0-9-]+\.browserbase\.com$/.test(address.hostname))) throw fail('browser_connect_target');
  return { timeout: 15_000 };
}

export function validateBrowserLoginUrl(backend: BrowserBackend, raw: string, sessionId: string, pageId: string): string {
  let login: URL;
  try { login = new URL(raw); } catch { throw fail('browser_login_target'); }
  if (backend === 'gcp') {
    const config = browserHostingSettings(backend);
    if (login.origin !== config.origin || login.username || login.password || login.pathname !== `/viewer/${sessionId}` || login.search || !/^#[A-Za-z0-9_-]{43}$/.test(login.hash)) throw fail('browser_login_target');
    return login.href;
  }
  const rawSocket = login.searchParams.get('wss');
  let socket: URL;
  try { socket = new URL(rawSocket?.startsWith('wss://') ? rawSocket : `wss://${rawSocket ?? ''}`); } catch { throw fail('browser_login_target'); }
  if (login.protocol !== 'https:' || login.username || login.password || (login.port && login.port !== '443') || !(login.hostname === 'browserbase.com' || login.hostname.endsWith('.browserbase.com'))
    || socket.protocol !== 'wss:' || socket.username || socket.password || (socket.port && socket.port !== '443') || !(socket.hostname === 'connect.browserbase.com' || /^connect\.[a-z0-9-]+\.browserbase\.com$/.test(socket.hostname))
    || socket.pathname !== `/debug/${sessionId}/devtools/page/${pageId}`) throw fail('browser_login_target');
  return login.href;
}
