import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  verifyWorkerRequest,
  assertTrustedWorker,
  type TrustedWorker,
} from '../../src/lib/server/worker-auth';
import {
  connectionDue,
  connectionRefreshInterval,
  connectionScopeFingerprint,
  retryDelayMs,
  SOURCE_REFRESH_MS,
} from '../../src/lib/server/worker';
import { POST } from '../../src/app/api/internal/worker/route';
import type { PublicConnection } from '../../src/lib/server/connectors/store';
import { automaticPreparationSources } from '../../src/lib/server/jobs';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const request = (token?: string, body?: string) =>
  new Request('https://soma.example/api/internal/worker', {
    method: 'POST',
    headers: token ? { authorization: `Bearer ${token}` } : {},
    ...(body !== undefined ? { body } : {}),
  });
const token = 'original-synthetic-worker-test-token-123456789';
function enable() {
  vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
  vi.stubEnv('SOMA_WORKER_SECRET', token);
}
describe('scheduled worker authentication and due work', () => {
  it('requires explicit activation and the full bearer secret, not a user identity or cookie', () => {
    vi.stubEnv('SOMA_WORKER_ENABLED', 'false');
    vi.stubEnv('SOMA_WORKER_SECRET', token);
    expect(() => verifyWorkerRequest(request(token))).toThrow();
    enable();
    for (const input of [
      request(),
      request(token.slice(1)),
      request('uid-worker'),
      new Request('https://soma.example', { headers: { cookie: `soma_account=${token}` } }),
    ])
      expect(() => verifyWorkerRequest(input)).toThrow();
    expect(() =>
      assertTrustedWorker({ expiresAt: Date.now() + 10_000 } as TrustedWorker),
    ).toThrow();
    const verified = verifyWorkerRequest(request(token));
    expect(() => assertTrustedWorker(verified)).not.toThrow();
    vi.spyOn(Date, 'now').mockReturnValue(verified.expiresAt);
    expect(() => assertTrustedWorker(verified)).toThrow();
  });
  it('rejects account selection at the HTTP boundary before any database or job action', async () => {
    enable();
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request(token, '{"uid":"another-account"}'))).status).toBe(400);
    expect((await POST(request(token, 'x'.repeat(33)))).status).toBe(400);
  });
  const connection: PublicConnection = {
    id: 'google-gmail',
    provider: 'gmail',
    workspaceId: 'original-synthetic-workspace',
    version: 1,
    status: 'current',
    configuration: {
      queries: [{ courseId: 'original-course', query: 'subject:original' }],
      nextQueryIndex: 0,
    },
  };
  it('ignores exact-page rotation progress but detects a changed Gradescope selection', () => {
    const saved: PublicConnection = {
      ...connection,
      id: 'browser-gradescope',
      provider: 'gradescope',
      configuration: {
        targets: [{ courseId: 'original-course', url: 'https://www.gradescope.com/courses/42' }],
        nextTargetIndex: 0,
      },
    };
    expect(
      connectionScopeFingerprint({
        ...saved,
        configuration: { ...saved.configuration, nextTargetIndex: 4 },
      }),
    ).toBe(connectionScopeFingerprint(saved));
    expect(
      connectionScopeFingerprint({
        ...saved,
        configuration: {
          targets: [{ courseId: 'original-course', url: 'https://www.gradescope.com/courses/43' }],
          nextTargetIndex: 0,
        },
      }),
    ).not.toBe(connectionScopeFingerprint(saved));
  });
  it('rotates Piazza classes while reserving manual browser starts for a larger course load', () => {
    const base: PublicConnection = {
      ...connection,
      id: 'browser-piazza',
      provider: 'piazza',
      configuration: {
        targets: Array.from({ length: 7 }, (_, i) => ({
          courseId: `course-${i}`,
          url: `https://piazza.com/class/class-${i}`,
        })),
        nextTargetIndex: 0,
      },
    };
    expect(connectionRefreshInterval(base)).toBe(SOURCE_REFRESH_MS / 4);
    expect(
      connectionRefreshInterval({
        ...base,
        configuration: { targets: (base.configuration.targets as unknown[]).slice(0, 2) },
      }),
    ).toBe(SOURCE_REFRESH_MS / 2);
    expect(
      connectionScopeFingerprint({
        ...base,
        configuration: { ...base.configuration, nextTargetIndex: 1 },
      }),
    ).toBe(connectionScopeFingerprint(base));
  });
  it('does not refresh on lease versions or query rotation; changed selection invalidates schedule', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    const schedule = {
      [connection.id]: {
        scope: connectionScopeFingerprint(connection),
        nextAt: now + SOURCE_REFRESH_MS,
        failures: 0,
        lastAttemptAt: new Date(now).toISOString(),
        outcome: 'completed',
      },
    };
    expect(
      connectionDue(
        {
          ...connection,
          version: 8,
          configuration: { ...connection.configuration, nextQueryIndex: 1 },
        },
        schedule,
        now + 60_000,
      ),
    ).toBe(false);
    expect(connectionDue(connection, schedule, now + SOURCE_REFRESH_MS)).toBe(true);
    expect(
      connectionDue(
        {
          ...connection,
          configuration: { queries: [{ courseId: 'original-course', query: 'subject:changed' }] },
        },
        schedule,
        now + 60_000,
      ),
    ).toBe(true);
  });
  it('rotates selected Gmail queries within the same six-hour target instead of six hours per query', () => {
    const selected = {
      ...connection,
      configuration: {
        queries: Array.from({ length: 5 }, (_, i) => ({
          courseId: `course-${i}`,
          query: `subject:fixture-${i}`,
        })),
      },
    };
    const now = Date.parse('2026-10-28T12:00:00Z');
    expect(connectionRefreshInterval(selected)).toBe(SOURCE_REFRESH_MS / 5);
    expect(
      connectionDue(
        { ...selected, lastSuccessAt: new Date(now).toISOString() },
        undefined,
        now + SOURCE_REFRESH_MS / 5 - 1,
      ),
    ).toBe(false);
    expect(
      connectionDue(
        { ...selected, lastSuccessAt: new Date(now).toISOString() },
        undefined,
        now + SOURCE_REFRESH_MS / 5,
      ),
    ).toBe(true);
    expect(connectionRefreshInterval({ ...selected, provider: 'calendar' })).toBe(
      SOURCE_REFRESH_MS,
    );
  });
  const blackboard: PublicConnection = {
    id: 'browser-blackboard',
    provider: 'blackboard',
    workspaceId: 'original-synthetic-workspace',
    version: 1,
    status: 'current',
    configuration: {
      targets: [
        { courseId: 'course-one', url: 'https://learn.bu.edu/ultra/courses/_101_1/outline' },
      ],
      blackboard: {
        mode: 'courses',
        selected: [
          { id: '_101_1', courseId: 'course-one' },
          { id: '_102_1', courseId: 'course-two' },
        ],
        catalogIds: ['_101_1', '_102_1'],
        catalogCheckedAt: '2026-10-27T12:00:00Z',
        catalogComplete: false,
        nextCourseIndex: 0,
      },
    },
  };
  it('keeps Blackboard discovery, traversal and rotation progress out of authorization-scope scheduling', () => {
    const configuration = blackboard.configuration.blackboard as Record<string, unknown>;
    const advanced = {
      ...blackboard,
      version: 9,
      configuration: {
        targets: [],
        blackboard: {
          ...configuration,
          selected: [...(configuration.selected as unknown[])].reverse(),
          catalogIds: ['_101_1', '_102_1', '_103_1'],
          catalogCheckedAt: '2026-10-28T12:00:00Z',
          catalogComplete: true,
          nextCourseIndex: 1,
          traversal: {
            providerCourseId: '_101_1',
            pending: ['contents-page-two'],
            seen: ['contents-page-one'],
            materialIds: ['_101_1:content:_material_1'],
          },
        },
      },
    };
    expect(connectionScopeFingerprint(advanced)).toBe(connectionScopeFingerprint(blackboard));
    const now = Date.parse('2026-10-28T12:00:00Z');
    const schedule = {
      [blackboard.id]: {
        scope: connectionScopeFingerprint(blackboard),
        nextAt: now + 60_000,
        failures: 0,
        lastAttemptAt: new Date(now).toISOString(),
        outcome: 'completed',
      },
    };
    expect(connectionDue(advanced, schedule, now)).toBe(false);
  });
  it('invalidates a Blackboard schedule when selected provider courses or workspace mappings change', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    const schedule = {
      [blackboard.id]: {
        scope: connectionScopeFingerprint(blackboard),
        nextAt: now + SOURCE_REFRESH_MS,
        failures: 0,
        lastAttemptAt: new Date(now).toISOString(),
        outcome: 'completed',
      },
    };
    for (const selected of [
      [{ id: '_101_1', courseId: 'course-one' }],
      [
        { id: '_101_1', courseId: 'corrected-course' },
        { id: '_102_1', courseId: 'course-two' },
      ],
      [
        { id: '_101_1', courseId: 'course-one' },
        { id: '_103_1', courseId: 'course-two' },
      ],
    ]) {
      const changed = {
        ...blackboard,
        configuration: {
          ...blackboard.configuration,
          blackboard: { ...(blackboard.configuration.blackboard as object), selected },
        },
      };
      expect(connectionScopeFingerprint(changed)).not.toBe(connectionScopeFingerprint(blackboard));
      expect(connectionDue(changed, schedule, now)).toBe(true);
    }
  });
  it('pauses explicit empty course selection even when older exact-page targets remain', () => {
    const paused = {
      ...blackboard,
      configuration: { ...blackboard.configuration, blackboard: { mode: 'courses', selected: [] } },
    };
    expect(connectionDue(paused, undefined)).toBe(false);
    expect(connectionRefreshInterval(paused)).toBe(SOURCE_REFRESH_MS);
    const legacy = { ...blackboard, configuration: { targets: blackboard.configuration.targets } };
    expect(connectionDue(legacy, undefined)).toBe(true);
  });
  it('retains every Blackboard course while reserving browser starts and allowing larger cycles to take longer', () => {
    const selected = Array.from({ length: 11 }, (_, index) => ({
      id: `_course_${index}`,
      courseId: `course-${index}`,
    }));
    const many = { ...blackboard, configuration: { blackboard: { mode: 'courses', selected } } };
    const now = Date.parse('2026-10-28T12:00:00Z');
    const interval = SOURCE_REFRESH_MS / 4;
    expect(connectionRefreshInterval(many)).toBe(interval);
    expect(
      connectionDue(
        { ...many, lastSuccessAt: new Date(now).toISOString() },
        undefined,
        now + interval - 1,
      ),
    ).toBe(false);
    expect(
      connectionDue(
        { ...many, lastSuccessAt: new Date(now).toISOString() },
        undefined,
        now + interval,
      ),
    ).toBe(true);
    const more = {
      ...many,
      configuration: {
        blackboard: {
          mode: 'courses',
          selected: [...selected, { id: '_course_12', courseId: 'course-12' }],
        },
      },
    };
    expect(connectionRefreshInterval(more)).toBe(interval);
    expect((24 * 60 * 60_000) / interval).toBe(16);
    expect(interval * selected.length).toBeGreaterThan(SOURCE_REFRESH_MS);
    expect(connectionScopeFingerprint(more)).not.toBe(connectionScopeFingerprint(many));
    for (const count of [1, 2, 4]) {
      const fewer = {
        ...many,
        configuration: { blackboard: { mode: 'courses', selected: selected.slice(0, count) } },
      };
      expect(connectionRefreshInterval(fewer)).toBe(SOURCE_REFRESH_MS / count);
    }
  });
  it('respects manual success, missing scope and reconnect states, and bounds failure backoff', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    const schedule = {
      [connection.id]: {
        scope: connectionScopeFingerprint(connection),
        nextAt: now,
        failures: 0,
        lastAttemptAt: new Date(now - SOURCE_REFRESH_MS).toISOString(),
        outcome: 'completed',
      },
    };
    expect(
      connectionDue(
        { ...connection, lastSuccessAt: new Date(now - 60_000).toISOString() },
        schedule,
        now,
      ),
    ).toBe(false);
    for (const status of ['connecting', 'login-required', 'disconnected'] as const)
      expect(connectionDue({ ...connection, status }, undefined, now)).toBe(false);
    expect(connectionDue({ ...connection, configuration: {} }, undefined, now)).toBe(false);
    expect(retryDelayMs(2)).toBeGreaterThan(retryDelayMs(1));
    expect(retryDelayMs(100)).toBe(SOURCE_REFRESH_MS);
  });
  it('never backfills inference consent for legacy or administratively transferred sources', () => {
    const state = seedEmptyAccountWorkspace('original-synthetic-consent');
    state.courses = [
      {
        id: 'course',
        code: 'SYN',
        title: 'Original fixture',
        instructor: '',
        color: '#123456',
        deadline: '',
        nextEvent: '',
      },
    ];
    const source = {
      id: 'legacy',
      version: 1,
      courseId: 'course',
      title: 'Original fixture',
      body: 'Original synthetic material.',
      kind: 'upload' as const,
      status: 'current' as const,
      retrievedAt: state.createdAt,
    };
    state.sources = [
      source,
      { ...source, id: 'legacy-live', origin: 'live' },
      {
        ...source,
        id: 'approved',
        provenance: {
          automaticPreparation: true,
          origin: 'manual-course',
          sourceKey: 'fixture',
          contentHash: 'fixture',
          importedAt: state.createdAt,
        },
      },
    ];
    expect(automaticPreparationSources(state).map((item) => item.id)).toEqual(['approved']);
    state.sources.push({ ...state.sources[2], version: 2, status: 'stale' });
    expect(automaticPreparationSources(state)).toEqual([]);
  });
});
