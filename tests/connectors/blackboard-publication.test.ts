import { describe, expect, it } from 'vitest';
import { seedWorkspace, seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { publishBlackboardRead } from '../../src/lib/server/connectors/blackboard-publication';
import type { WorkspaceState } from '../../src/lib/domain/types';
const checkedAt = '2026-10-27T16:00:00Z';
const record = (id: string, body = 'Original synthetic source.') => ({
  id: `_a_1:content:${id}`,
  title: 'Original recurrence notes',
  body,
  kind: 'blackboard' as const,
  url: 'https://learn.bu.edu/ultra/courses/_a_1/outline',
});
const publish = (
  state: WorkspaceState,
  records: ReturnType<typeof record>[],
  complete = true,
  materialIds = records.map((item) => item.id),
) =>
  publishBlackboardRead(state, {
    providerCourseId: '_a_1',
    courseId: 'course-a',
    records,
    complete,
    materialIds,
    checkedAt,
  });
function empty() {
  const state = seedEmptyAccountWorkspace('synthetic-blackboard-publication');
  state.courses = [
    {
      id: 'course-a',
      code: 'SYN A',
      title: 'Original synthetic course',
      instructor: '',
      color: 'blue',
      deadline: '',
      nextEvent: '',
    },
  ];
  return state;
}
describe('Blackboard observation publication', () => {
  it('does not fabricate learner evidence and preserves versions on unchanged and changed reads', () => {
    const state = empty(),
      first = publish(state, [record('_one_1')]);
    expect(state.sources).toEqual([]);
    expect(first.changedSourceIds).toHaveLength(1);
    expect(first.workspace.attempts).toEqual(state.attempts);
    expect(first.workspace.lessons).toEqual(state.lessons);
    const unchanged = publish(first.workspace, [record('_one_1')]);
    expect(unchanged.changedSourceIds).toEqual([]);
    expect(unchanged.workspace.sources).toHaveLength(1);
    const changed = publish(unchanged.workspace, [
      record('_one_1', 'Changed original synthetic source.'),
    ]);
    expect(changed.workspace.sources.map((s) => [s.version, s.status])).toEqual([
      [1, 'stale'],
      [2, 'current'],
    ]);
    expect(changed.workspace.sources[0].body).toBe('Original synthetic source.');
  });
  it('retains unvisited sources on partial walks and stales removed sources only after a finished walk', () => {
    const first = publish(empty(), [record('_one_1'), record('_two_1')]).workspace;
    const partial = publish(first, [record('_one_1')], false);
    expect(partial.workspace.sources.map((s) => s.status)).toEqual(['current', 'current']);
    const finished = publish(partial.workspace, [], true, [record('_one_1').id]);
    expect(finished.workspace.sources.map((s) => s.status)).toEqual(['current', 'stale']);
    expect(finished.workspace.sources).toHaveLength(2);
  });
  it('retains earlier slices in the completed traversal and keeps historical versions stale', () => {
    const first = publish(empty(), [record('_one_1')], false).workspace;
    const revised = publish(first, [record('_one_1', 'Revised text')], false).workspace;
    const finished = publish(revised, [record('_two_1')], true, [
      record('_one_1').id,
      record('_two_1').id,
    ]);
    expect(finished.workspace.sources.map((s) => [s.version, s.status])).toEqual([
      [1, 'stale'],
      [2, 'current'],
      [1, 'current'],
    ]);
  });
  it('does not touch another provider or course and supersedes only mapped legacy pages', () => {
    const state = publish(empty(), [record('_one_1')]).workspace,
      base = state.sources[0];
    state.sources.push(
      {
        ...base,
        id: 'other-course',
        courseId: 'another',
        provenance: {
          ...base.provenance!,
          sourceKey: 'blackboard:browser-blackboard:_b_1:content:_other_1',
        },
      },
      {
        ...base,
        id: 'piazza',
        kind: 'piazza',
        provenance: { ...base.provenance!, sourceKey: 'piazza:browser-piazza:original' },
      },
      {
        ...base,
        id: 'legacy',
        provenance: {
          ...base.provenance!,
          sourceKey:
            'blackboard:browser-blackboard:https://learn.bu.edu/ultra/courses/_a_1/outline',
        },
      },
    );
    const partial = publish(state, [], false);
    expect(partial.workspace.sources.find((s) => s.id === 'legacy')?.status).toBe('current');
    const final = publish(partial.workspace, []);
    expect(final.workspace.sources.map((s) => [s.id, s.status]).slice(1)).toEqual([
      ['other-course', 'current'],
      ['piazza', 'current'],
      ['legacy', 'stale'],
    ]);
  });
  it('rejects a missing workspace mapping without mutating input', () => {
    const state = empty();
    state.courses = [];
    expect(() => publish(state, [record('_one_1')])).toThrow();
    expect(state.sources).toEqual([]);
  });
});

it('marks a prepared lesson stale immediately when its exact observed support is withdrawn', () => {
  const state = publish(empty(), [record('_one_1')]).workspace,
    source = state.sources[0];
  const lesson = {
    ...seedWorkspace('original-fixture').lessons[0],
    id: 'blackboard-supported',
    courseId: 'course-a',
    sourceIds: [source.id],
    sourceVersions: { [source.id]: source.version },
    state: 'ready' as const,
  };
  state.lessons = [lesson];
  const partial = publish(state, [], false);
  expect(partial.workspace.lessons[0].state).toBe('ready');
  const withdrawn = publish(partial.workspace, []);
  expect(withdrawn.workspace.lessons[0].state).toBe('stale');
  expect(state.lessons[0].state).toBe('ready');
});
