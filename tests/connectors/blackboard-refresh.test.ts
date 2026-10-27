import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VerifiedAccount } from '../../src/lib/server/account';
import type { WorkspaceState } from '../../src/lib/domain/types';
import { seedEmptyAccountWorkspace, seedWorkspace } from '../../src/lib/domain/seed';
import { applyCollectedSources } from '../../src/lib/server/connectors/ingest';
import { WorkspaceStoreError } from '../../src/lib/server/store';

const fixture = vi.hoisted(() => ({ workspace: null as any, connection: null as any, page: null as any, guard: null as any, checkpoint: null as any, result: null as any }));
vi.mock('../../src/lib/server/connectors/browser', () => ({
  withBrowserRead: vi.fn(async (_account, _provider, _allow, operation) => {
    const result = await operation({ page: fixture.page, workspace: structuredClone(fixture.workspace), connection: structuredClone(fixture.connection), guard: fixture.guard,
      deadline: Date.now() + 30000, blockedOrigins: new Set(), checkpointConfiguration: fixture.checkpoint });
    fixture.result = result;
    if (result.configuration) fixture.connection.configuration = result.configuration;
    return result.value;
  }),
}));
vi.mock('../../src/lib/server/account-store', () => ({
  readAccountWorkspace: vi.fn(async () => structuredClone(fixture.workspace)),
  updateAccountWorkspace: vi.fn(async (_account, mutate, expectedRevision, guard) => {
    if (expectedRevision !== undefined && expectedRevision !== fixture.workspace.revision) throw new WorkspaceStoreError('Revision changed.', 409, 'workspace_changed');
    await guard('synthetic-transaction', 'synthetic-root');
    fixture.workspace = await mutate(structuredClone(fixture.workspace)); fixture.workspace.revision++;
    return structuredClone(fixture.workspace);
  }),
}));
vi.mock('../../src/lib/server/connectors/blackboard-materials', () => ({ collectBlackboardMaterials: vi.fn() }));
import { collectBlackboardMaterials } from '../../src/lib/server/connectors/blackboard-materials';
import { refreshBlackboardCourses } from '../../src/lib/server/connectors/blackboard';
import { updateAccountWorkspace } from '../../src/lib/server/account-store';

const account = {} as VerifiedAccount;
const providerIds = ['_101_1', '_102_1'];
const cursor = (id: string) => ({ providerCourseId: id, pending: [`/learn/api/v1/courses/${id}/contents?limit=20&offset=20`], seen: [], materialIds: [] });
function state(): WorkspaceState {
  const seed = seedEmptyAccountWorkspace('original-synthetic-refresh', '2026-10-27T12:00:00Z');
  seed.courses = ['one', 'two'].map(name => ({ id: `course-${name}`, code: `SYN ${name}`, title: `Original synthetic course ${name}`, instructor: '', color: 'blue', nextEvent: '', deadline: '' }));
  const { workspace } = applyCollectedSources(seed, providerIds.map((id, index) => ({ id: `${id}:content:_existing_1`, title: `Original synthetic source ${index}`, body: 'Original synthetic course material for refresh-state verification.', courseId: seed.courses[index].id, kind: 'blackboard' as const })), { provider: 'blackboard', connectionId: 'browser-blackboard', checkedAt: seed.createdAt });
  const authored = seedWorkspace('original-synthetic-lesson', seed.createdAt).lessons[0];
  workspace.lessons = workspace.sources.map((source, index) => ({ ...structuredClone(authored), id: `synthetic-lesson-${index}`, courseId: source.courseId!, sourceIds: [source.id], sourceVersions: { [source.id]: source.version }, state: 'ready' }));
  workspace.revision = 7;
  return workspace;
}
beforeEach(() => {
  fixture.workspace = state(); fixture.result = null;
  fixture.connection = { id: 'browser-blackboard', workspaceId: fixture.workspace.id, configuration: { targets: [], blackboard: { mode: 'courses', selected: providerIds.map((id, index) => ({ id, courseId: fixture.workspace.courses[index].id })), selectedSubjectId: '_self_1', catalogIds: providerIds, catalogComplete: true, catalogCheckedAt: fixture.workspace.createdAt, nextCourseIndex: 0, traversals: {} } } };
  fixture.guard = vi.fn(async () => undefined);
  fixture.checkpoint = vi.fn(async configuration => { fixture.connection.configuration = configuration; });
  fixture.page = { request: { get: vi.fn(async () => ({ status: () => 200, headers: () => ({}), body: async () => Buffer.from('{"id":"_self_1"}'), dispose: vi.fn(async () => undefined) })) } };
  vi.mocked(collectBlackboardMaterials).mockResolvedValue({ records: [], complete: true, warnings: 0, materialIds: [] });
});
afterEach(() => vi.clearAllMocks());

describe('Blackboard refresh orchestration with real source publication', () => {
  it('maps one provider slice into the selected workspace course under the original revision and publication guard', async () => {
    vi.mocked(collectBlackboardMaterials).mockResolvedValue({ records: [{ id: '_101_1:content:_new_1', title: 'Original synthetic update', body: 'A new original synthetic statement.', kind: 'blackboard' }], complete: false, cursor: cursor('_101_1'), warnings: 0, materialIds: ['_101_1:content:_new_1'] });
    const before = structuredClone(fixture.workspace);
    const result = await refreshBlackboardCourses(account);
    expect(collectBlackboardMaterials).toHaveBeenCalledWith(fixture.page, '_101_1', undefined, expect.any(Number));
    expect(fixture.page.request.get).toHaveBeenCalledWith('https://learn.bu.edu/learn/api/v1/users/me', expect.objectContaining({ maxRedirects: 0 }));
    expect(updateAccountWorkspace).toHaveBeenCalledWith(account, expect.any(Function), before.revision, fixture.guard);
    expect(fixture.guard).toHaveBeenCalledWith('synthetic-transaction', 'synthetic-root');
    const published = result.workspace.sources.find(source => source.title === 'Original synthetic update')!;
    expect(published).toMatchObject({ courseId: 'course-one', origin: 'live', status: 'current', version: 1 });
    expect(result.changedSourceIds).toEqual([published.id]);
    expect(result.workspace.sources.find(source => source.id === before.sources[1].id)).toEqual(before.sources[1]);
    expect(fixture.result.configuration.blackboard).toMatchObject({ nextCourseIndex: 1, traversals: { _101_1: cursor('_101_1') } });
    expect(fixture.result.status).toBe('connected'); expect(fixture.checkpoint).not.toHaveBeenCalled();
  });
  it('resumes one course cursor and retains other-course progress while rotating fairly', async () => {
    fixture.connection.configuration.blackboard.traversals = { _101_1: cursor('_101_1'), _102_1: cursor('_102_1') };
    const next = { ...cursor('_101_1'), pending: ['/learn/api/v1/courses/_101_1/contents?limit=20&offset=40'] };
    vi.mocked(collectBlackboardMaterials).mockResolvedValue({ records: [], complete: false, cursor: next, warnings: 1, materialIds: [] });
    await refreshBlackboardCourses(account);
    expect(collectBlackboardMaterials).toHaveBeenCalledWith(fixture.page, '_101_1', cursor('_101_1'), expect.any(Number));
    expect(fixture.result.configuration.blackboard).toMatchObject({ nextCourseIndex: 1, traversals: { _101_1: next, _102_1: cursor('_102_1') } });
    vi.mocked(collectBlackboardMaterials).mockResolvedValue({ records: [], complete: true, warnings: 0, materialIds: [] });
    await refreshBlackboardCourses(account);
    expect(collectBlackboardMaterials).toHaveBeenLastCalledWith(fixture.page, '_102_1', cursor('_102_1'), expect.any(Number));
    expect(fixture.result.configuration.blackboard).toMatchObject({ nextCourseIndex: 0, traversals: { _101_1: next } });
    expect(fixture.result.configuration.blackboard.traversals._102_1).toBeUndefined();
  });
  it.each(['empty', 'missing-mapping'] as const)('rejects %s selection before identity or material requests', async kind => {
    if (kind === 'empty') fixture.connection.configuration.blackboard.selected = [];
    else fixture.connection.configuration.blackboard.selected[0].courseId = 'absent-course';
    await expect(refreshBlackboardCourses(account)).rejects.toMatchObject({ code: 'source_course_scope' });
    expect(fixture.page.request.get).not.toHaveBeenCalled(); expect(collectBlackboardMaterials).not.toHaveBeenCalled();
    expect(updateAccountWorkspace).not.toHaveBeenCalled(); expect(fixture.checkpoint).not.toHaveBeenCalled();
  });
  it.each(['different-subject', 'expired-login'] as const)('withdraws only the affected course after %s without advancing global authentication failure', async kind => {
    if (kind === 'different-subject') fixture.page.request.get.mockResolvedValue({ status: () => 200, headers: () => ({}), body: async () => Buffer.from('{"id":"_different_1"}'), dispose: vi.fn(async () => undefined) });
    else fixture.page.request.get.mockResolvedValue({ status: () => 401, headers: () => ({}), body: vi.fn(), dispose: vi.fn(async () => undefined) });
    const before = structuredClone(fixture.workspace);
    await expect(refreshBlackboardCourses(account)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(collectBlackboardMaterials).not.toHaveBeenCalled(); expect(fixture.checkpoint).not.toHaveBeenCalled();
    expect(fixture.workspace.sources[0]).toEqual({ ...before.sources[0], status: 'stale' });
    expect(fixture.workspace.lessons[0].state).toBe('stale');
    expect(fixture.workspace.sources[1]).toEqual(before.sources[1]); expect(fixture.workspace.lessons[1]).toEqual(before.lessons[1]);
    expect(updateAccountWorkspace).toHaveBeenCalledWith(account, expect.any(Function), undefined, fixture.guard);
    expect(fixture.connection.configuration.blackboard.nextCourseIndex).toBe(0);
  });
  it('retains interrupted traversal but advances past a course-specific unsupported read', async () => {
    fixture.connection.configuration.blackboard.traversals = { _101_1: cursor('_101_1') };
    vi.mocked(collectBlackboardMaterials).mockRejectedValue(new WorkspaceStoreError('Unsupported original synthetic route.', 422, 'blackboard_read_unavailable'));
    await expect(refreshBlackboardCourses(account)).rejects.toMatchObject({ code: 'blackboard_read_unavailable' });
    expect(fixture.workspace.sources[0].status).toBe('stale'); expect(fixture.workspace.lessons[0].state).toBe('stale');
    expect(fixture.checkpoint).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ blackboard: expect.objectContaining({ nextCourseIndex: 1, traversals: { _101_1: cursor('_101_1') } }) }));
  });
  it('withdraws missing material and its dependent ready lesson only after a proven complete walk', async () => {
    const before = structuredClone(fixture.workspace);
    await refreshBlackboardCourses(account);
    expect(fixture.workspace.sources[0]).toEqual({ ...before.sources[0], status: 'stale' });
    expect(fixture.workspace.lessons[0].state).toBe('stale');
    expect(fixture.workspace.sources[1]).toEqual(before.sources[1]); expect(fixture.workspace.lessons[1]).toEqual(before.lessons[1]);
    expect(fixture.workspace.sources).toHaveLength(before.sources.length);
  });
  it('refuses publication when the supplied connection guard loses authorization', async () => {
    const before = structuredClone(fixture.workspace);
    fixture.guard.mockRejectedValue(new WorkspaceStoreError('Authorization changed.', 409, 'connection_changed'));
    await expect(refreshBlackboardCourses(account)).rejects.toMatchObject({ code: 'connection_changed' });
    expect(fixture.workspace).toEqual(before); expect(fixture.checkpoint).not.toHaveBeenCalled();
    expect(fixture.result).toBeNull();
  });
});
