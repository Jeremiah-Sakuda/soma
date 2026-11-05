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
    leaseId: 'exclusive-gradescope',
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
vi.mock('../../src/lib/server/connectors/gradescope-materials', () => ({
  readGradescopeAssignmentMetadata: vi.fn(),
}));
import { readGradescopeAssignmentMetadata } from '../../src/lib/server/connectors/gradescope-materials';
import { refreshBrowser } from '../../src/lib/server/connectors/browser';
import { updateAccountWorkspace } from '../../src/lib/server/account-store';
import { releaseConnectionLease } from '../../src/lib/server/connectors/store';
const account = {} as VerifiedAccount,
  origin = 'https://www.gradescope.com';
const course = (id: number) => `${origin}/courses/${id}`;
const session = () => ({
  id: 'session-gradescope',
  contextId: 'context-gradescope',
  projectId: 'project-gradescope',
  status: fixture.released ? 'COMPLETED' : 'RUNNING',
  expiresAt: new Date(Date.now() + 60000).toISOString(),
  connectUrl: 'wss://connect.browserbase.com/synthetic',
  userMetadata: {
    somaOwner: createHash('sha256')
      .update(fixture.workspace.id + ':browser-gradescope')
      .digest('hex'),
  },
});
beforeEach(() => {
  vi.stubEnv('BROWSERBASE_API_KEY', 'synthetic-key');
  vi.stubEnv('BROWSERBASE_PROJECT_ID', 'project-gradescope');
  vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', 'a'.repeat(64));
  const seed = seedEmptyAccountWorkspace('synthetic-gradescope-refresh', '2026-10-27T12:00:00Z');
  seed.courses = Array.from({ length: 7 }, (_, index) => ({
    id: `course-${index + 1}`,
    code: `SYN ${index + 1}`,
    title: `Synthetic course ${index + 1}`,
    instructor: '',
    color: 'blue',
    nextEvent: '',
    deadline: '',
  }));
  fixture.workspace = applyCollectedSources(
    seed,
    seed.courses.map((item, index) => ({
      id: course(index + 1),
      url: course(index + 1),
      title: 'Synthetic previous overview',
      body: 'Original synthetic saved observation.',
      courseId: item.id,
      kind: 'gradescope' as const,
    })),
    { provider: 'gradescope', connectionId: 'browser-gradescope', checkedAt: seed.createdAt },
  ).workspace;
  fixture.workspace.revision = 7;
  fixture.connection = {
    id: 'browser-gradescope',
    workspaceId: fixture.workspace.id,
    provider: 'gradescope',
    version: 1,
    status: 'connected',
    secret: { contextId: 'context-gradescope' },
    configuration: {
      targets: seed.courses.map((item, index) => ({ courseId: item.id, url: course(index + 1) })),
      nextTargetIndex: 0,
    },
  };
  fixture.released = false;
  fixture.calls = [];
  fixture.route = null;
  fixture.guard = vi.fn(async () => undefined);
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
  vi.mocked(readGradescopeAssignmentMetadata).mockImplementation(async (_page, target) => ({
    id: target.url,
    url: target.url,
    title: 'Gradescope assignment overview',
    body: 'Original synthetic updated assignment metadata.',
    courseId: target.courseId,
    kind: 'gradescope',
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input, init) => {
      const url = String(input);
      if (url.endsWith('/sessions') && init?.method === 'POST') {
        fixture.calls.push('session-create');
        return new Response(JSON.stringify(session()));
      }
      if (url.endsWith('/sessions/session-gradescope') && init?.method === 'POST') {
        fixture.calls.push('session-release');
        fixture.released = true;
        return new Response('{}');
      }
      if (url.endsWith('/sessions/session-gradescope'))
        return new Response(JSON.stringify(session()));
      throw new Error('Unexpected synthetic provider endpoint');
    }),
  );
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe('Gradescope refresh orchestration with synthetic provider and real source versioning', () => {
  it('does not classify an unknown future provider failure as a locally recoverable layout error', async () => {
    vi.mocked(readGradescopeAssignmentMetadata).mockRejectedValueOnce(
      new WorkspaceStoreError(
        'Synthetic unknown provider failure.',
        409,
        'gradescope_future_auth_failure',
      ),
    );
    await expect(refreshBrowser(account, 'gradescope')).rejects.toMatchObject({
      code: 'gradescope_future_auth_failure',
    });
    expect(readGradescopeAssignmentMetadata).toHaveBeenCalledTimes(1);
    expect(
      fixture.workspace.sources.every(
        (source: any) => source.version === 1 && source.status === 'stale',
      ),
    ).toBe(true);
  });
  it('reads four of seven targets, guards publication at the original revision and retains unvisited observations', async () => {
    const before = structuredClone(fixture.workspace);
    const result = await refreshBrowser(account, 'gradescope');
    expect(fixture.page.goto.mock.calls.map((call: any[]) => call[0])).toEqual([
      course(1),
      course(2),
      course(3),
      course(4),
    ]);
    expect(readGradescopeAssignmentMetadata).toHaveBeenCalledTimes(4);
    expect(updateAccountWorkspace).toHaveBeenCalledExactlyOnceWith(
      account,
      expect.any(Function),
      7,
      fixture.guard,
    );
    expect(fixture.guard).toHaveBeenCalledWith('synthetic-transaction', 'synthetic-root');
    expect(result.changedSourceIds).toHaveLength(4);
    expect(result.workspace.sources.filter((source: any) => source.version === 2)).toHaveLength(4);
    expect(
      result.workspace.sources.filter((source: any) => source.courseId === 'course-7'),
    ).toEqual(before.sources.filter((source: any) => source.courseId === 'course-7'));
    expect(fixture.connection.configuration.nextTargetIndex).toBe(4);
    expect(fixture.connection.configuration.targets).toHaveLength(7);
    expect(fixture.connection.status).toBe('connected');
    expect(fixture.connection.notice).toContain('More selected pages remain');
    expect(fixture.connection.notice).toContain(
      'scores, student responses and returned-work files are not collected',
    );
    expect(fixture.connection.secret.contextId).toBe('context-gradescope');
    expect(fixture.connection.secret.sessionId).toBeUndefined();
    expect(fixture.calls.indexOf('browser-close')).toBeLessThan(
      fixture.calls.indexOf('session-release'),
    );
    expect(fixture.calls.indexOf('session-release')).toBeLessThan(
      fixture.calls.indexOf('lease-release'),
    );
  });
  it('resumes the saved cursor and wraps across a complete course load', async () => {
    fixture.connection.configuration.nextTargetIndex = 4;
    await refreshBrowser(account, 'gradescope');
    expect(fixture.page.goto.mock.calls.map((call: any[]) => call[0])).toEqual([
      course(5),
      course(6),
      course(7),
      course(1),
    ]);
    expect(fixture.connection.configuration.nextTargetIndex).toBe(1);
  });
  it('enforces selected-batch document scope at the actual installed network policy', async () => {
    await refreshBrowser(account, 'gradescope');
    const cases = [
      { url: course(1), allow: true },
      { url: course(5) },
      { url: course(1) + '/grades' },
      { url: course(1) + '/assignments/9/submissions/99' },
      { url: origin + '/api/courses/1' },
      { url: course(1), method: 'POST' },
      { url: course(1), type: 'script', navigation: false },
      { url: course(1), type: 'xhr', navigation: false },
      { url: 'https://evil.example/courses/1' },
      { url: course(1), parent: {} },
      { url: origin + '/account' },
    ];
    for (const item of cases) {
      const route = {
        request: () => ({
          url: () => item.url,
          method: () => item.method ?? 'GET',
          resourceType: () => item.type ?? 'document',
          isNavigationRequest: () => item.navigation ?? true,
          frame: () => ({ parentFrame: () => item.parent ?? null }),
        }),
        continue: vi.fn(),
        abort: vi.fn(),
      };
      await fixture.route(route);
      expect(route.continue).toHaveBeenCalledTimes(item.allow ? 1 : 0);
      expect(route.abort).toHaveBeenCalledTimes(item.allow ? 0 : 1);
    }
  });
  it.each(['unsupported', 'login'] as const)(
    'retains original observations and marks stale after %s failure; only non-auth failures advance partial rotation',
    async (kind) => {
      const before = structuredClone(fixture.workspace),
        code = kind === 'login' ? 'browser_login_required' : 'gradescope_read_structure';
      vi.mocked(readGradescopeAssignmentMetadata).mockRejectedValue(
        new WorkspaceStoreError('Synthetic failed read.', kind === 'login' ? 409 : 422, code),
      );
      await expect(refreshBrowser(account, 'gradescope')).rejects.toMatchObject({
        code: kind === 'login' ? code : 'gradescope_no_supported_overview',
      });
      expect(fixture.workspace.sources).toEqual(
        before.sources.map((source: any) => ({ ...source, status: 'stale' })),
      );
      expect(fixture.connection.status).toBe(kind === 'login' ? 'login-required' : 'stale');
      expect(fixture.connection.configuration.nextTargetIndex).toBe(kind === 'login' ? 0 : 4);
      expect(fixture.connection.secret.contextId).toBe('context-gradescope');
      expect(fixture.connection.secret.sessionId).toBeUndefined();
      expect(updateAccountWorkspace).toHaveBeenCalledExactlyOnceWith(
        account,
        expect.any(Function),
        undefined,
        fixture.guard,
      );
      expect(fixture.calls).toContain('session-release');
    },
  );
  it('withholds an entire interrupted batch after a global deadline failure', async () => {
    const before = structuredClone(fixture.workspace);
    vi.mocked(readGradescopeAssignmentMetadata)
      .mockImplementationOnce(async (_page, target) => ({
        id: target.url,
        url: target.url,
        title: 'Synthetic prefix',
        body: 'Original synthetic new observation.',
        courseId: target.courseId,
        kind: 'gradescope',
      }))
      .mockRejectedValueOnce(new WorkspaceStoreError('Synthetic timeout.', 408, 'browser_timeout'));
    await expect(refreshBrowser(account, 'gradescope')).rejects.toMatchObject({
      code: 'browser_timeout',
    });
    expect(readGradescopeAssignmentMetadata).toHaveBeenCalledTimes(2);
    expect(fixture.workspace.sources).toEqual(
      before.sources.map((source: any) => ({ ...source, status: 'stale' })),
    );
    expect(
      fixture.workspace.sources.some((source: any) => source.title === 'Synthetic prefix'),
    ).toBe(false);
  });
  it('isolates a failed first course without starving the other seven, and refreshes unchanged supported observations', async () => {
    const eighth = {
      ...fixture.workspace.courses[0],
      id: 'course-8',
      code: 'SYN 8',
      title: 'Synthetic course 8',
    };
    fixture.workspace.courses.push(eighth);
    fixture.connection.configuration.targets.push({ courseId: eighth.id, url: course(8) });
    fixture.workspace = applyCollectedSources(
      fixture.workspace,
      [
        {
          id: course(8),
          url: course(8),
          title: 'Synthetic previous overview',
          body: 'Original synthetic saved observation.',
          courseId: eighth.id,
          kind: 'gradescope',
        },
      ],
      {
        provider: 'gradescope',
        connectionId: 'browser-gradescope',
        checkedAt: fixture.workspace.createdAt,
      },
    ).workspace;
    const before = structuredClone(fixture.workspace);
    vi.mocked(readGradescopeAssignmentMetadata).mockImplementation(async (_page, target) => {
      if (target.url === course(1))
        throw new WorkspaceStoreError(
          'Synthetic unsupported first course.',
          422,
          'gradescope_read_structure',
        );
      return {
        id: target.url,
        url: target.url,
        title: 'Gradescope assignment overview',
        body: 'Original synthetic updated assignment metadata.',
        courseId: target.courseId,
        kind: 'gradescope',
      };
    });
    const first = await refreshBrowser(account, 'gradescope');
    expect(readGradescopeAssignmentMetadata).toHaveBeenCalledTimes(4);
    expect(first.changedSourceIds).toHaveLength(3);
    expect(fixture.connection.status).toBe('stale');
    expect(first.notice).toContain('1 selected page(s) could not be verified');
    expect(fixture.connection.configuration.nextTargetIndex).toBe(4);
    expect(
      fixture.workspace.sources.filter((source: any) => source.courseId === 'course-1'),
    ).toEqual(
      before.sources
        .filter((source: any) => source.courseId === 'course-1')
        .map((source: any) => ({ ...source, status: 'stale' })),
    );
    expect(
      fixture.workspace.sources
        .filter((source: any) => source.version === 2)
        .map((source: any) => source.courseId),
    ).toEqual(['course-2', 'course-3', 'course-4']);
    // Simulate the documented saved-context sync delay elapsing between independent runs.
    fixture.connection.secret.readyAt = '2026-01-01T00:00:00Z';
    fixture.released = false;
    const second = await refreshBrowser(account, 'gradescope');
    expect(second.changedSourceIds).toHaveLength(4);
    expect(fixture.connection.configuration.nextTargetIndex).toBe(0);
    expect(fixture.workspace.sources.filter((source: any) => source.version === 2)).toHaveLength(7);
    expect(
      fixture.workspace.sources
        .filter((source: any) => source.version === 2)
        .every((source: any) => source.status === 'current'),
    ).toBe(true);
    const supportedBeforeThird = structuredClone(
      fixture.workspace.sources.filter((source: any) => source.version === 2),
    );
    fixture.connection.secret.readyAt = '2026-01-01T00:00:00Z';
    fixture.released = false;
    const third = await refreshBrowser(account, 'gradescope');
    expect(third.changedSourceIds).toEqual([]);
    expect(fixture.connection.status).toBe('stale');
    const supportedAfter = fixture.workspace.sources.filter((source: any) => source.version === 2);
    expect(supportedAfter).toHaveLength(7);
    expect(supportedAfter.map(({ retrievedAt: _retrievedAt, ...source }: any) => source)).toEqual(
      supportedBeforeThird.map(({ retrievedAt: _retrievedAt, ...source }: any) => source),
    );
    expect(fixture.page.goto.mock.calls.map((call: any[]) => call[0])).toEqual([
      course(1),
      course(2),
      course(3),
      course(4),
      course(5),
      course(6),
      course(7),
      course(8),
      course(1),
      course(2),
      course(3),
      course(4),
    ]);
  });
  it('withdraws a failed overview’s teaching evidence while preserving attempts and an unchanged supported lesson', async () => {
    const authored = seedWorkspace('synthetic-retained-lesson', fixture.workspace.createdAt)
      .lessons[0];
    fixture.workspace.lessons = fixture.workspace.sources
      .slice(0, 2)
      .map((source: any, index: number) => ({
        ...structuredClone(authored),
        id: `synthetic-lesson-${index + 1}`,
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
        createdAt: fixture.workspace.createdAt,
        novel: true,
        feedback: 'Original retained feedback.',
        sourceVersions: structuredClone(lesson.sourceVersions),
      },
    ];
    fixture.workspace.assistance[lesson.id] = ['hint requested after original attempt'];
    fixture.workspace.savedInputs[lesson.id] = structuredClone(lesson.circuit);
    fixture.workspace.reviews = [
      { lessonId: lesson.id, dueAt: '2026-10-29T12:00:00Z', rating: 'again' },
    ];
    const before = structuredClone(fixture.workspace);
    vi.mocked(readGradescopeAssignmentMetadata).mockImplementation(async (_page, target) => {
      if (target.url === course(1))
        throw new WorkspaceStoreError(
          'Synthetic unsupported overview.',
          422,
          'gradescope_read_structure',
        );
      const source = before.sources.find((source: any) => source.url === target.url);
      return {
        id: target.url,
        url: target.url,
        title: source.title,
        body: source.body,
        courseId: target.courseId,
        kind: 'gradescope',
      };
    });
    const result = await refreshBrowser(account, 'gradescope');
    expect(result.changedSourceIds).toEqual([]);
    expect(fixture.workspace.sources[0]).toEqual({ ...before.sources[0], status: 'stale' });
    expect(fixture.workspace.sources[1]).toMatchObject({
      id: before.sources[1].id,
      version: before.sources[1].version,
      status: 'current',
      body: before.sources[1].body,
    });
    expect(fixture.workspace.lessons[0]).toEqual({ ...before.lessons[0], state: 'stale' });
    expect(fixture.workspace.lessons[1]).toEqual(before.lessons[1]);
    for (const retained of ['attempts', 'assistance', 'savedInputs', 'reviews'])
      expect(fixture.workspace[retained]).toEqual(before[retained]);
  });
  it('refuses publication when connection authorization changes', async () => {
    const before = structuredClone(fixture.workspace);
    fixture.guard.mockRejectedValue(
      new WorkspaceStoreError('Synthetic authorization changed.', 409, 'connection_changed'),
    );
    await expect(refreshBrowser(account, 'gradescope')).rejects.toMatchObject({
      code: 'connection_changed',
    });
    expect(fixture.workspace).toEqual(before);
    expect(fixture.calls).toContain('session-release');
  });
  it('canonicalizes a selected trailing slash before navigation and collection', async () => {
    fixture.connection.configuration.targets = [{ courseId: 'course-1', url: course(1) + '/' }];
    await refreshBrowser(account, 'gradescope');
    expect(fixture.page.goto).toHaveBeenCalledExactlyOnceWith(course(1), expect.any(Object));
    expect(readGradescopeAssignmentMetadata).toHaveBeenCalledWith(
      fixture.page,
      { courseId: 'course-1', url: course(1) },
      expect.any(Number),
    );
    expect(fixture.connection.status).toBe('current');
  });
  it.each([
    course(1) + '#fragment',
    origin + '/unexpected/../courses/1',
    'https://gradescope.com/courses/1',
    course(1) + '?',
  ])('rejects unsafe raw saved targets before a paid session: %s', async (url) => {
    fixture.connection.configuration.targets = [{ courseId: 'course-1', url }];
    await expect(refreshBrowser(account, 'gradescope')).rejects.toMatchObject({
      code: 'source_course_scope',
    });
    expect(fetch).not.toHaveBeenCalled();
    expect(readGradescopeAssignmentMetadata).not.toHaveBeenCalled();
    expect(updateAccountWorkspace).not.toHaveBeenCalled();
    expect(releaseConnectionLease).toHaveBeenCalledOnce();
  });
});
