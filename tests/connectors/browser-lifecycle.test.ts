import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';
const state = vi.hoisted(() => ({ connection: null as any, workspace: { id: 'workspace-one', revision: 1, courses: [{ id: 'course-one' }], sources: [],lessons:[] }, calls: [] as string[] }));
vi.mock('../../src/lib/server/account-store', () => ({
  readAccountWorkspace: vi.fn(async () => state.workspace),
  updateAccountWorkspace: vi.fn(async (_account: unknown, action: any) => action(state.workspace)),
}));
vi.mock('../../src/lib/server/connectors/store', () => ({
  connectionsForDeletion: vi.fn(async () => state.connection ? [state.connection] : []),
  readConnection: vi.fn(async () => state.connection),
  listConnections: vi.fn(async () => state.connection ? [state.connection] : []),
  saveConnection: vi.fn(async (_a, _w, id, input) => { state.connection = { ...input, id, workspaceId: state.workspace.id }; return state.connection; }),
  acquireConnectionLease: vi.fn(async () => ({ connection: structuredClone(state.connection), leaseId: 'exclusive-lease' })),
  checkpointConnectionLease: vi.fn(async (_a, _id, _lease, patch) => { state.calls.push('checkpoint'); state.connection = { ...state.connection, ...patch }; return true; }),
  releaseConnectionLease: vi.fn(async (_a, _id, _lease, patch) => { state.connection = { ...state.connection, ...patch }; return true; }),
  connectionPublicationGuard: vi.fn(),
  deleteConnection: vi.fn(async () => { state.calls.push('delete-local'); state.connection = null; }),
}));
import { browserConfigured, resolveBrowserProjectId, configureBrowser, disconnectBrowser, refreshBrowser, startBrowserLogin, cleanupBrowsersForDeletion } from '../../src/lib/server/connectors/browser';
import { createHash } from 'node:crypto';
const account = {} as VerifiedAccount; // Store/account integration tests verify the actual authenticated brand; this suite tests orchestration.
const makeConnection = (secret: Record<string, unknown> = {}) => ({ id: 'browser-gradescope', workspaceId: 'workspace-one', provider: 'gradescope', version: 1, status: 'connected', configuration: { targets: [{ courseId: 'course-one', url: 'https://www.gradescope.com/courses/123' }] }, secret });
beforeEach(() => {
  vi.stubEnv('BROWSERBASE_API_KEY', 'test-key'); vi.stubEnv('BROWSERBASE_PROJECT_ID', 'project-one'); vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  state.connection = null; state.calls = []; vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.clearAllMocks(); });
describe('browser lifecycle orchestration with synthetic provider responses', () => {
  it('fails honestly before any external call when provider keys are absent', async () => {
    vi.stubEnv('BROWSERBASE_API_KEY', ''); expect(browserConfigured()).toBe(false);
    await expect(startBrowserLogin(account, 'gradescope')).rejects.toMatchObject({ code: 'browser_configuration' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('resolves a single granted project with only the API key and caches discovery', async () => {
    vi.stubEnv('BROWSERBASE_PROJECT_ID', ''); vi.stubEnv('BROWSERBASE_API_KEY', 'key-discovery-single');
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify([{ id: 'inferred-project' }])));
    expect(browserConfigured()).toBe(true);
    expect(await resolveBrowserProjectId()).toBe('inferred-project');
    expect(await resolveBrowserProjectId()).toBe('inferred-project');
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(String(vi.mocked(fetch).mock.calls[0][0])).toBe('https://api.browserbase.com/v1/projects');
  });
  it('never silently selects among several projects and permits recovery after discovery failure', async () => {
    vi.stubEnv('BROWSERBASE_PROJECT_ID', ''); vi.stubEnv('BROWSERBASE_API_KEY', 'key-discovery-many');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'one' }, { id: 'two' }])));
    await expect(resolveBrowserProjectId()).rejects.toMatchObject({ code: 'browser_project' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response(JSON.stringify([{ id: 'one' }])));
    expect(await resolveBrowserProjectId()).toBe('one');
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('rejects authority metadata for a different course assessment before a paid session', async () => {
    await expect(configureBrowser(account, 'gradescope', [{ courseId: 'course-one', url: 'https://www.gradescope.com/courses/123', context: { role: 'instructor-update', applicability: 'assessment', assessmentId: 'foreign-exam' } }])).rejects.toThrow('registered assessment');
    expect(fetch).not.toHaveBeenCalled();
  });
  it('rejects cross-workspace course selections before creating a paid session', async () => {
    await expect(configureBrowser(account, 'gradescope', [{ courseId: 'another-workspace-course', url: 'https://www.gradescope.com/courses/123' }])).rejects.toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled(); expect(state.connection).toBeNull();
  });
  it('rejects Gradescope submission/detail targets before allocating a browser',async()=>{
    await expect(configureBrowser(account,'gradescope',[{courseId:'course-one',url:'https://www.gradescope.com/courses/123/assignments/456'}])).rejects.toMatchObject({code:'source_course_scope'});
    expect(fetch).not.toHaveBeenCalled();expect(state.connection).toBeNull();
  });
  it('rechecks saved selected courses before starting a browser', async () => {
    state.connection = makeConnection(); state.connection.configuration.targets[0].courseId = 'removed-course';
    await expect(startBrowserLogin(account, 'gradescope')).rejects.toMatchObject({ status: 400 }); expect(fetch).not.toHaveBeenCalled();
  });
  it('does not release a user’s active sign-in session when refresh is clicked early', async () => {
    state.connection = makeConnection({ contextId: 'context-one', sessionId: 'session-one' });
    vi.mocked(fetch).mockResolvedValue(new Response(JSON.stringify({ id: 'session-one', contextId: 'context-one', projectId: 'project-one', status: 'RUNNING', expiresAt: new Date(Date.now() + 60_000).toISOString(), userMetadata: { somaOwner: createHash('sha256').update('workspace-one:browser-gradescope').digest('hex') } })));
    await expect(refreshBrowser(account, 'gradescope')).rejects.toThrow('Finish the sign-in session');
    expect(fetch).toHaveBeenCalledTimes(1); expect(state.connection.secret.sessionId).toBe('session-one');
  });
  it('retains cleanup references when the provider fails to delete a context', async () => {
    state.connection = makeConnection({ contextId: 'context-one' }); vi.mocked(fetch).mockResolvedValue(new Response('failed', { status: 503 }));
    await expect(disconnectBrowser(account, 'gradescope')).rejects.toMatchObject({ code: 'browser_provider' });
    expect(state.connection.secret.contextId).toBe('context-one'); expect(state.calls).not.toContain('delete-local');
  });
  it('cleans a frozen deletion snapshot without normal connection mutation or losing retry references', async () => {
    state.connection = makeConnection({ contextId: 'context-for-frozen-cleanup' });
    vi.mocked(fetch).mockResolvedValueOnce(new Response('unavailable', {status:503}));
    await expect(cleanupBrowsersForDeletion(account,'workspace-one')).rejects.toMatchObject({code:'browser_provider'});
    expect(state.connection.secret.contextId).toBe('context-for-frozen-cleanup');
    expect(state.calls).not.toContain('delete-local');
    vi.mocked(fetch).mockResolvedValueOnce(new Response(null,{status:204}));
    await cleanupBrowsersForDeletion(account,'workspace-one');
    expect(String(vi.mocked(fetch).mock.calls.at(-1)![0])).toContain('/contexts/context-for-frozen-cleanup');
    expect(vi.mocked(fetch).mock.calls.at(-1)![1]?.method).toBe('DELETE');
    expect(state.calls).toEqual([]);
  });
  it('deletes remote context before discarding local encrypted authorization', async () => {
    state.connection = makeConnection({ contextId: 'context-one' });
    vi.mocked(fetch).mockImplementation(async (_url, init) => { expect(init?.method).toBe('DELETE'); state.calls.push('delete-remote'); return new Response(null, { status: 204 }); });
    await disconnectBrowser(account, 'gradescope'); expect(state.calls).toEqual(['delete-remote', 'delete-local']);
  });
  it('persists the context and session-budget reservation before session creation', async () => {
    state.connection = makeConnection();
    vi.mocked(fetch).mockImplementation(async (url) => {
      if (String(url).endsWith('/contexts')) { state.calls.push('create-context'); return new Response(JSON.stringify({ id: 'context-one' })); }
      state.calls.push('create-session');
      expect(state.connection.secret.contextId).toBe('context-one'); expect(state.connection.secret.starts).toBe(1);
      return new Response('unavailable', { status: 503 });
    });
    await expect(startBrowserLogin(account, 'gradescope')).rejects.toMatchObject({ code: 'browser_provider' });
    expect(state.calls).toEqual(['create-context', 'checkpoint', 'checkpoint', 'create-session']);
    expect(state.connection.secret.contextId).toBe('context-one'); expect(state.connection.secret.starts).toBe(1);
  });
});
