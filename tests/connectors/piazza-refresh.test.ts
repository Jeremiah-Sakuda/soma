import { createHash } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';
import { seedEmptyAccountWorkspace, seedWorkspace } from '../../src/lib/domain/seed';
import { applyCollectedSources } from '../../src/lib/server/connectors/ingest';
import { WorkspaceStoreError } from '../../src/lib/server/store';
const fixture = vi.hoisted(() => ({
  workspace: null as any,
  connection: null as any,
  browser: null as any,
  page: null as any,
  route: null as any,
  guard: null as any,
  released: false,
  calls: [] as string[],
  scriptBefore: false,
  scriptAfter: false,
}));
vi.mock('../../src/lib/server/account-store', () => ({
  readAccountWorkspace: vi.fn(async () => structuredClone(fixture.workspace)),
  updateAccountWorkspace: vi.fn(async (_account, mutate, revision, guard) => {
    if (revision !== undefined && revision !== fixture.workspace.revision)
      throw new WorkspaceStoreError('Synthetic revision conflict.', 409, 'revision_conflict');
    await guard('synthetic-transaction', 'synthetic-root');
    fixture.workspace = await mutate(structuredClone(fixture.workspace));
    fixture.workspace.revision++;
    return structuredClone(fixture.workspace);
  }),
}));
vi.mock('../../src/lib/server/connectors/store', () => ({
  acquireConnectionLease: vi.fn(async () => ({
    connection: structuredClone(fixture.connection),
    leaseId: 'exclusive-piazza',
  })),
  checkpointConnectionLease: vi.fn(async (_a, _id, _lease, patch) => {
    fixture.connection = { ...fixture.connection, ...patch };
    return true;
  }),
  releaseConnectionLease: vi.fn(async (_a, _id, _lease, patch) => {
    fixture.calls.push('lease-release');
    fixture.connection = { ...fixture.connection, ...patch };
    return true;
  }),
  connectionPublicationGuard: vi.fn(() => fixture.guard),
  readConnection: vi.fn(async () => fixture.connection),
  connectionsForDeletion: vi.fn(),
  listConnections: vi.fn(),
  saveConnection: vi.fn(),
  deleteConnection: vi.fn(),
}));
vi.mock('playwright-core', () => ({
  chromium: { connectOverCDP: vi.fn(async () => fixture.browser) },
}));
vi.mock('../../src/lib/server/connectors/piazza-page', () => ({ renderPiazzaCourse: vi.fn() }));
vi.mock('../../src/lib/server/connectors/piazza-materials', () => ({
  readPiazzaFeedPreviews: vi.fn(),
}));
import { renderPiazzaCourse } from '../../src/lib/server/connectors/piazza-page';
import { readPiazzaFeedPreviews } from '../../src/lib/server/connectors/piazza-materials';
import { refreshBrowser } from '../../src/lib/server/connectors/browser';
import { updateAccountWorkspace } from '../../src/lib/server/account-store';
import { releaseConnectionLease } from '../../src/lib/server/connectors/store';
const account = {} as VerifiedAccount,
  origin = 'https://piazza.com';
const course = (id: number) => `${origin}/class/synthetic_${id}`;
const script = '/packs/js/qa-synthetic.chunk.js';
const session = () => ({
  id: 'session-piazza',
  contextId: 'context-piazza',
  projectId: 'project-piazza',
  status: fixture.released ? 'COMPLETED' : 'RUNNING',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  connectUrl: 'wss://connect.browserbase.com/synthetic',
  userMetadata: {
    somaOwner: createHash('sha256')
      .update(fixture.workspace.id + ':browser-piazza')
      .digest('hex'),
  },
});
async function allowed(input: {
  url: string;
  method?: string;
  type?: string;
  navigation?: boolean;
  parent?: object;
}) {
  const route = {
    request: () => ({
      url: () => input.url,
      method: () => input.method ?? 'GET',
      resourceType: () => input.type ?? 'document',
      isNavigationRequest: () => input.navigation ?? true,
      frame: () => ({ parentFrame: () => input.parent ?? null }),
    }),
    continue: vi.fn(),
    abort: vi.fn(),
  };
  await fixture.route(route);
  expect(route.continue.mock.calls.length + route.abort.mock.calls.length).toBe(1);
  return route.continue.mock.calls.length === 1;
}
function nextRun() {
  fixture.connection.secret.readyAt = '2026-01-01T00:00:00Z';
  fixture.released = false;
}
beforeEach(() => {
  vi.stubEnv('BROWSERBASE_API_KEY', 'synthetic-key');
  vi.stubEnv('BROWSERBASE_PROJECT_ID', 'project-piazza');
  vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  const seed = seedEmptyAccountWorkspace('synthetic-piazza-refresh', '2026-10-27T12:00:00Z');
  seed.courses = Array.from({ length: 7 }, (_, i) => ({
    id: `course-${i + 1}`,
    code: `SYN ${i + 1}`,
    title: `Synthetic course ${i + 1}`,
    instructor: '',
    color: 'blue',
    nextEvent: '',
    deadline: '',
  }));
  fixture.workspace = applyCollectedSources(
    seed,
    seed.courses.map((item, i) => ({
      id: course(i + 1),
      url: course(i + 1),
      title: 'Piazza instructor-note previews',
      body: 'Original synthetic retained preview.',
      courseId: item.id,
      kind: 'piazza' as const,
    })),
    { provider: 'piazza', connectionId: 'browser-piazza', checkedAt: seed.createdAt },
  ).workspace;
  fixture.workspace.revision = 7;
  const authored = seedWorkspace('synthetic-piazza-lesson', seed.createdAt).lessons[0];
  fixture.workspace.lessons = fixture.workspace.sources
    .slice(0, 2)
    .map((source: any, i: number) => ({
      ...structuredClone(authored),
      id: `synthetic-lesson-${i + 1}`,
      courseId: source.courseId,
      sourceIds: [source.id],
      sourceVersions: { [source.id]: source.version },
      state: 'ready',
    }));
  const lesson = fixture.workspace.lessons[0];
  fixture.workspace.attempts = [
    {
      id: 'synthetic-original-attempt',
      lessonId: lesson.id,
      lessonVersion: lesson.version,
      modelVersion: lesson.modelVersion,
      question: lesson.question,
      response: 'Original synthetic independent response.',
      correct: false,
      assisted: false,
      assistance: [],
      createdAt: seed.createdAt,
      novel: true,
      feedback: 'Original retained feedback.',
      sourceVersions: structuredClone(lesson.sourceVersions),
    },
  ];
  fixture.connection = {
    id: 'browser-piazza',
    workspaceId: fixture.workspace.id,
    provider: 'piazza',
    version: 1,
    status: 'connected',
    secret: { contextId: 'context-piazza' },
    configuration: {
      targets: seed.courses.map((item, i) => ({ courseId: item.id, url: course(i + 1) })),
      nextTargetIndex: 0,
    },
  };
  fixture.released = false;
  fixture.calls = [];
  fixture.route = null;
  fixture.guard = vi.fn(async () => undefined);
  fixture.scriptBefore = false;
  fixture.scriptAfter = false;
  fixture.page = { goto: vi.fn(async () => ({ ok: () => true })) };
  const context = {
    route: vi.fn(async (_pattern, handler) => {
      fixture.route = handler;
    }),
    routeWebSocket: vi.fn(),
    pages: () => [],
    newPage: vi.fn(async () => fixture.page),
    newCDPSession: vi.fn(async () => ({ send: vi.fn() })),
  };
  fixture.browser = {
    contexts: () => [context],
    close: vi.fn(async () => {
      fixture.calls.push('browser-close');
    }),
  };
  vi.mocked(renderPiazzaCourse).mockImplementation(async (_page, _deadline, authorize) => {
    fixture.calls.push('render');
    fixture.scriptBefore = await allowed({
      url: origin + script,
      type: 'script',
      navigation: false,
    });
    authorize([script]);
    fixture.scriptAfter = await allowed({
      url: origin + script,
      type: 'script',
      navigation: false,
    });
  });
  vi.mocked(readPiazzaFeedPreviews).mockImplementation(async (_page, target) => {
    fixture.calls.push('read-previews');
    return {
      id: target.url,
      url: target.url,
      title: 'Piazza instructor-note previews',
      body: 'Original synthetic updated partial visible preview.',
      courseId: target.courseId,
      kind: 'piazza',
    };
  });
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/sessions') && init?.method === 'POST')
        return new Response(JSON.stringify(session()));
      if (url.endsWith('/sessions/session-piazza') && init?.method === 'POST') {
        fixture.calls.push('session-release');
        fixture.released = true;
        return new Response('{}');
      }
      if (url.endsWith('/sessions/session-piazza')) return new Response(JSON.stringify(session()));
      throw new Error('Unexpected synthetic provider endpoint');
    }),
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('Piazza bounded refresh orchestration with synthetic provider and real versioned ingestion', () => {
  it('retains a safe upstream 402 status without creating a browser session or mutating workspace observations', async () => {
    const before = structuredClone(fixture.workspace);
    vi.mocked(fetch).mockResolvedValueOnce(
      new Response('synthetic-never-retain-provider-body-secret', { status: 402 }),
    );
    let failure: unknown;
    try {
      await refreshBrowser(account, 'piazza');
      throw new Error('Expected provider refusal');
    } catch (error) {
      failure = error;
    }
    expect(failure).toMatchObject({ status: 503, code: 'browser_provider', providerStatus: 402 });
    expect(String(failure)).not.toContain('synthetic-never-retain-provider-body-secret');
    expect(JSON.stringify(failure)).not.toContain('synthetic-never-retain-provider-body-secret');
    expect(fetch).toHaveBeenCalledExactlyOnceWith(
      'https://api.browserbase.com/v1/sessions',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fixture.workspace).toEqual(before);
    expect(updateAccountWorkspace).not.toHaveBeenCalled();
    expect(fixture.page.goto).not.toHaveBeenCalled();
    expect(renderPiazzaCourse).not.toHaveBeenCalled();
    expect(readPiazzaFeedPreviews).not.toHaveBeenCalled();
    expect(fixture.browser.close).not.toHaveBeenCalled();
    expect(fixture.calls).not.toContain('session-release');
    expect(fixture.connection.secret.contextId).toBe('context-piazza');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
    expect(fixture.connection.secret.starts).toBe(1);
    expect(fixture.connection.status).toBe('connected');
    expect(releaseConnectionLease).toHaveBeenCalledOnce();
  });
  it('reads one scoped class per session and publishes at the guarded original revision', async () => {
    const before = structuredClone(fixture.workspace),
      result = await refreshBrowser(account, 'piazza');
    expect(fixture.page.goto).toHaveBeenCalledExactlyOnceWith(course(1), expect.any(Object));
    expect(renderPiazzaCourse).toHaveBeenCalledOnce();
    expect(readPiazzaFeedPreviews).toHaveBeenCalledOnce();
    expect(fixture.calls.indexOf('render')).toBeLessThan(fixture.calls.indexOf('read-previews'));
    expect(updateAccountWorkspace).toHaveBeenCalledExactlyOnceWith(
      account,
      expect.any(Function),
      7,
      fixture.guard,
    );
    expect(fixture.guard).toHaveBeenCalledWith('synthetic-transaction', 'synthetic-root');
    expect(result.changedSourceIds).toHaveLength(1);
    expect(
      fixture.workspace.sources.filter((source: any) => source.courseId === 'course-7'),
    ).toEqual(before.sources.filter((source: any) => source.courseId === 'course-7'));
    expect(fixture.connection.configuration.targets).toHaveLength(7);
    expect(fixture.connection.configuration.nextTargetIndex).toBe(1);
    expect(fixture.connection.status).toBe('connected');
    expect(result.notice).toContain('Initial visible-feed previews');
    expect(result.notice).toContain('More selected pages remain');
    expect(fixture.connection.secret.contextId).toBe('context-piazza');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
    expect(fixture.calls.indexOf('browser-close')).toBeLessThan(
      fixture.calls.indexOf('session-release'),
    );
  });
  it('reaches every class in a course load larger than five and wraps the cursor', async () => {
    for (let i = 0; i < 7; i++) {
      if (i) nextRun();
      await refreshBrowser(account, 'piazza');
    }
    expect(fixture.page.goto.mock.calls.map((call: any[]) => call[0])).toEqual(
      Array.from({ length: 7 }, (_, i) => course(i + 1)),
    );
    expect(fixture.workspace.sources.filter((source: any) => source.version === 2)).toHaveLength(7);
    expect(fixture.connection.configuration.nextTargetIndex).toBe(0);
  });
  it('authorizes only observed scripts after inventory and blocks all APIs, writes and other classes', async () => {
    await refreshBrowser(account, 'piazza');
    expect(fixture.scriptBefore).toBe(false);
    expect(fixture.scriptAfter).toBe(true);
    expect(await allowed({ url: course(1) })).toBe(true);
    for (const input of [
      { url: course(2) },
      { url: course(1) + '?cid=42' },
      { url: origin + '/logic', method: 'POST', type: 'xhr', navigation: false },
      { url: origin + '/logic', type: 'fetch', navigation: false },
      { url: origin + '/logic', type: 'xhr', navigation: false },
      { url: course(1), method: 'POST' },
      { url: course(1), parent: {} },
      { url: 'wss://piazza.com/socket', type: 'websocket', navigation: false },
      { url: 'https://evil.example/class/synthetic_1' },
      { url: origin + '/packs/js/unknown.js', type: 'script', navigation: false },
      { url: origin + script + '?token=secret', type: 'script', navigation: false },
    ])
      expect(await allowed(input)).toBe(false);
  });
  it('marks only a structurally failed class and dependent lesson stale, preserving other classes and original attempts', async () => {
    const before = structuredClone(fixture.workspace);
    vi.mocked(readPiazzaFeedPreviews).mockRejectedValueOnce(
      new WorkspaceStoreError('Synthetic unsupported layout.', 422, 'piazza_read_structure'),
    );
    await expect(refreshBrowser(account, 'piazza')).rejects.toMatchObject({
      code: 'piazza_read_structure',
    });
    expect(fixture.workspace.sources[0]).toEqual({ ...before.sources[0], status: 'stale' });
    expect(fixture.workspace.sources.slice(1)).toEqual(before.sources.slice(1));
    expect(fixture.workspace.lessons[0]).toEqual({ ...before.lessons[0], state: 'stale' });
    expect(fixture.workspace.lessons[1]).toEqual(before.lessons[1]);
    expect(fixture.workspace.attempts).toEqual(before.attempts);
    expect(fixture.connection.configuration.nextTargetIndex).toBe(1);
    expect(fixture.connection.status).toBe('stale');
    nextRun();
    await refreshBrowser(account, 'piazza');
    expect(fixture.page.goto.mock.calls.map((call: any[]) => call[0])).toEqual([
      course(1),
      course(2),
    ]);
  });
  it('treats authentication failure globally and retains all saved observations without publication', async () => {
    const before = structuredClone(fixture.workspace);
    vi.mocked(readPiazzaFeedPreviews).mockRejectedValueOnce(
      new WorkspaceStoreError('Synthetic login expired.', 409, 'browser_login_required'),
    );
    await expect(refreshBrowser(account, 'piazza')).rejects.toMatchObject({
      code: 'browser_login_required',
    });
    expect(fixture.workspace.sources).toEqual(
      before.sources.map((source: any) => ({ ...source, status: 'stale' })),
    );
    expect(fixture.workspace.lessons.every((lesson: any) => lesson.state === 'stale')).toBe(true);
    expect(fixture.workspace.attempts).toEqual(before.attempts);
    expect(fixture.connection.status).toBe('login-required');
    expect(fixture.connection.configuration.nextTargetIndex).toBe(0);
    expect(fixture.connection.secret.contextId).toBe('context-piazza');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
  });
  it('reuses unchanged previews without duplicate versions or changing independent attempts', async () => {
    const before = structuredClone(fixture.workspace);
    vi.mocked(readPiazzaFeedPreviews).mockImplementation(async (_page, target) => {
      const source = before.sources.find((source: any) => source.url === target.url);
      return {
        id: target.url,
        url: target.url,
        title: source.title,
        body: source.body,
        courseId: target.courseId,
        kind: 'piazza',
      };
    });
    const result = await refreshBrowser(account, 'piazza');
    expect(result.changedSourceIds).toEqual([]);
    expect(fixture.workspace.sources).toHaveLength(before.sources.length);
    expect(
      fixture.workspace.sources.every(
        (source: any) => source.version === 1 && source.status === 'current',
      ),
    ).toBe(true);
    expect(fixture.workspace.attempts).toEqual(before.attempts);
    expect(fixture.workspace.lessons).toEqual(before.lessons);
  });
  it('withholds source publication when connection authorization changes', async () => {
    const before = structuredClone(fixture.workspace);
    fixture.guard.mockRejectedValue(
      new WorkspaceStoreError('Synthetic revoked connection.', 409, 'connection_changed'),
    );
    await expect(refreshBrowser(account, 'piazza')).rejects.toMatchObject({
      code: 'connection_changed',
    });
    expect(fixture.workspace).toEqual(before);
    expect(fixture.calls).toContain('session-release');
  });
  it.each([
    course(1) + '?cid=42',
    origin + '/unexpected/../class/synthetic_1',
    course(1) + '#post',
    'https://www.piazza.com/class/synthetic_1',
  ])('rejects raw unsupported targets before browser allocation: %s', async (url) => {
    fixture.connection.configuration.targets = [{ courseId: 'course-1', url }];
    await expect(refreshBrowser(account, 'piazza')).rejects.toMatchObject({
      code: 'source_course_scope',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(renderPiazzaCourse).not.toHaveBeenCalled();
    expect(readPiazzaFeedPreviews).not.toHaveBeenCalled();
    expect(updateAccountWorkspace).not.toHaveBeenCalled();
  });
});
