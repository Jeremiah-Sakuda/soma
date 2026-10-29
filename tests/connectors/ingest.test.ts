import { describe, it, expect } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { applyCollectedSources } from '../../src/lib/server/connectors/ingest';

describe('live source observations', () => {
  const context = { provider: 'blackboard', connectionId: 'blackboard', checkedAt: '2026-10-26T18:00:00Z' };
  const record = { id: 'announcement-1', title: 'Course announcement', body: 'Original synthetic announcement.', kind: 'blackboard' as const, url: 'https://learn.bu.edu/ultra/courses/1' };
  it('skips unchanged content and preserves old versions when source content changes', () => {
    const initial = seedEmptyAccountWorkspace('owned');
    const first = applyCollectedSources(initial, [record], context);
    expect(initial.sources).toHaveLength(0);
    expect(first.changedSourceIds).toHaveLength(1);
    const unchanged = applyCollectedSources(first.workspace, [record], { ...context, checkedAt: '2026-10-26T19:00:00Z' });
    expect(unchanged.changedSourceIds).toHaveLength(0);
    expect(unchanged.workspace.sources).toHaveLength(1);
    const changed = applyCollectedSources(unchanged.workspace, [{ ...record, body: 'Revised original synthetic announcement.' }], context);
    expect(changed.workspace.sources.map(s => [s.version, s.status, s.origin])).toEqual([[1, 'stale', 'live'], [2, 'current', 'live']]);
    expect(changed.workspace.sources[0].body).toBe(record.body);
  });
  it('enforces workspace course references, batch identity and safe locations', () => {
    const state = seedEmptyAccountWorkspace('owned');
    expect(() => applyCollectedSources(state, [{ ...record, courseId: 'another-account-course' }], context)).toThrow();
    expect(() => applyCollectedSources(state, [record, record], context)).toThrow();
    expect(() => applyCollectedSources(state, [{ ...record, url: 'https://learn.bu.edu/?access_token=private' }], context)).toThrow();
    expect(state.sources).toHaveLength(0);
  });
});
