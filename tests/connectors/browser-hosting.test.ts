import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { browserCdpOptions, browserControlHeaders, browserControlRequest, browserHostingSettings, configuredBrowserBackend, recordedBrowserBackend, validateBrowserLoginUrl } from '../../src/lib/server/connectors/browser-hosting';

const origin = 'https://synthetic-browser-123.us-east1.run.app';
const owner = 'a'.repeat(64), key = 'original-synthetic-control-key-12345678901234567890';
beforeEach(() => {
  vi.stubEnv('SOMA_GCP_BROWSER_URL', origin); vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', key); vi.stubEnv('SOMA_GCP_BROWSER_PROJECT_ID', 'original-synthetic-project');
  vi.stubEnv('BROWSERBASE_API_KEY', 'original-synthetic-legacy-key');
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('browser hosting discrimination and private transport', () => {
  it('defaults legacy references and deployment to Browserbase but rejects unknown saved formats', () => {
    vi.stubEnv('SOMA_BROWSER_BACKEND', 'browserbase');
    expect(configuredBrowserBackend()).toBe('browserbase');
    expect(recordedBrowserBackend({})).toBe('browserbase');
    expect(recordedBrowserBackend({ backend: 'gcp', version: 1 })).toBe('gcp');
    for (const invalid of [{ backend: 'unknown', version: 1 }, { backend: 'gcp' }, { version: 1 }, { backend: 'browserbase', version: 2 }]) expect(() => recordedBrowserBackend(invalid)).toThrow();
    vi.stubEnv('SOMA_BROWSER_BACKEND', 'unknown'); expect(() => configuredBrowserBackend()).toThrow();
  });
  it.each(['http://synthetic.run.app', 'https://synthetic.run.app.evil.test', 'https://user:secret@synthetic.run.app', 'https://synthetic.run.app:444', 'https://synthetic.run.app/path', 'https://synthetic.run.app/?key=private', 'https://synthetic.run.app/#private'])('rejects unsafe deployment endpoints without exposing configuration: %s', endpoint => {
    vi.stubEnv('SOMA_GCP_BROWSER_URL', endpoint);
    let error: unknown; try { browserHostingSettings('gcp'); } catch (caught) { error = caught; }
    expect(error).toMatchObject({ code: 'browser_configuration' });
    expect(String(error)).not.toContain(endpoint); expect(String(error)).not.toContain(key);
  });
  it('uses backend-specific authentication and requires owner scope everywhere except project enumeration', async () => {
    expect(browserControlHeaders('gcp', owner, '/contexts')).toEqual({ Authorization: `Bearer ${key}`, 'X-Soma-Owner': owner, 'Content-Type': 'application/json' });
    expect(browserControlHeaders('gcp', undefined, '/projects')).toEqual({ Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' });
    expect(browserControlHeaders('browserbase', undefined, '/contexts')).toEqual({ 'X-BB-API-Key': 'original-synthetic-legacy-key', 'Content-Type': 'application/json' });
    await expect(browserControlRequest('gcp', undefined, '/contexts')).rejects.toMatchObject({ code: 'browser_owner' });
    await expect(browserControlRequest('gcp', owner, '/contexts/../../sessions')).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'synthetic-context' })));
    await browserControlRequest('gcp', owner, '/contexts', 'POST', { projectId: 'original-synthetic-project', userMetadata: { somaOwner: owner } });
    expect(fetch).toHaveBeenCalledWith(`${origin}/v1/contexts`, expect.objectContaining({ redirect: 'error', cache: 'no-store', headers: { Authorization: `Bearer ${key}`, 'X-Soma-Owner': owner, 'Content-Type': 'application/json' } }));
    expect(String(vi.mocked(fetch).mock.calls[0][0])).not.toContain(key);
  });
  it('matches the service control-key minimum without echoing an invalid key', () => {
    vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', 'k'.repeat(39));
    expect(() => browserHostingSettings('gcp')).toThrow('not configured safely');
    vi.stubEnv('SOMA_GCP_BROWSER_CONTROL_KEY', 'k'.repeat(40));
    expect(browserHostingSettings('gcp').backend).toBe('gcp');
  });
  it.each(['browserbase', 'gcp'] as const)('omits JSON content type on body-less %s requests while preserving authentication', async backend => {
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      if ((init?.headers as Record<string, string>)['Content-Type'] && init?.body === undefined) return new Response(null, { status: 400 });
      return init?.method === 'DELETE' ? new Response(null, { status: 204 }) : Response.json({ id: 'synthetic-context' });
    });
    await expect(browserControlRequest(backend, owner, '/contexts/synthetic-context', 'DELETE')).resolves.toBeUndefined();
    await expect(browserControlRequest(backend, owner, '/contexts/synthetic-context')).resolves.toEqual({ id: 'synthetic-context' });
    for (const [, init] of vi.mocked(fetch).mock.calls) {
      expect(init!.headers).not.toHaveProperty('Content-Type');
      expect(init!.headers).toMatchObject(backend === 'gcp' ? { Authorization: `Bearer ${key}`, 'X-Soma-Owner': owner } : { 'X-BB-API-Key': 'original-synthetic-legacy-key' });
    }
  });
  it('requires exact GCP CDP session and origin, sending private authorization only in headers', () => {
    expect(browserCdpOptions('gcp', origin.replace('https:', 'wss:') + '/cdp/synthetic-session', 'synthetic-session', owner)).toEqual({ timeout: 15_000, headers: { Authorization: `Bearer ${key}`, 'X-Soma-Owner': owner } });
    for (const address of ['wss://connect.browserbase.com/synthetic-session', origin.replace('https:', 'wss:') + '/cdp/other-session', origin.replace('https:', 'wss:') + '/cdp/synthetic-session?token=private', origin.replace('https:', 'wss:') + '/cdp/synthetic-session#private', 'wss://evil.test/cdp/synthetic-session']) expect(() => browserCdpOptions('gcp', address, 'synthetic-session', owner)).toThrow();
    expect(() => browserCdpOptions('browserbase', origin.replace('https:', 'wss:') + '/cdp/synthetic-session', 'synthetic-session', owner)).toThrow();
  });
  it('accepts only a session-bound GCP viewer fragment and never returns its token in errors', () => {
    const token = 't'.repeat(43), url = `${origin}/viewer/synthetic-session#${token}`;
    expect(validateBrowserLoginUrl('gcp', url, 'synthetic-session', 'synthetic-page')).toBe(url);
    for (const invalid of [url.replace('/synthetic-session', '/other-session'), url.replace('#', '?token='), url.replace(origin, 'https://evil.test'), url.replace(token, 'short'), url.replace('/viewer/', '/viewer/%2f')]) {
      let error: unknown; try { validateBrowserLoginUrl('gcp', invalid, 'synthetic-session', 'synthetic-page'); } catch (caught) { error = caught; }
      expect(error).toMatchObject({ code: 'browser_login_target' }); expect(String(error)).not.toContain(token);
    }
    expect(() => validateBrowserLoginUrl('browserbase', url, 'synthetic-session', 'synthetic-page')).toThrow();
  });
  it('treats only 404 as missing during GET cleanup confirmation and suppresses upstream response details', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect(await browserControlRequest('gcp', owner, '/contexts/synthetic-context', 'GET', undefined, true)).toBeUndefined();
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null, { status: 204 }));
    await expect(browserControlRequest('gcp', owner, '/contexts/synthetic-context', 'GET', undefined, true)).rejects.toMatchObject({ code: 'browser_provider' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('original-private-provider-canary', { status: 503 }));
    await expect(browserControlRequest('gcp', owner, '/contexts/synthetic-context')).rejects.toThrow('Saved authorization has been retained');
  });
});
