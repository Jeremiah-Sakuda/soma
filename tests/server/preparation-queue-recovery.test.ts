import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { mayClaimJob, nextPreparationCandidate, staleQueuedPreparation, type PreparationJob } from '../../src/lib/server/jobs';

const state = seedWorkspace('original-queue-recovery', '2026-10-28T12:00:00.000Z');
state.sources = state.sources.filter(source => source.id === 'source-probability').map(source => ({ ...source, version: 2 }));
const job = (id: string, patch: Partial<PreparationJob> = {}): PreparationJob => ({ id, ownerId: 'original-owner', workspaceId: state.id, courseId: 'probability', topic: 'Original synthetic independence example', sourceRefs: [{ sourceId: 'source-probability', version: 2 }], status: 'queued', createdAt: state.createdAt, updatedAt: state.createdAt, attempts: 0, contextRevision: state.revision, ...patch });

describe('preparation queue recovery from obsolete sources', () => {
  it('selects a safely stale newer job before the oldest budget-blocked current work', () => {
    const current = job('old-current', { notice: 'Waiting for existing model allowance.' });
    const stale = job('new-obsolete', { sourceRefs: [{ sourceId: 'source-probability', version: 1 }], createdAt: '2026-10-28T13:00:00.000Z', nextAttemptAt: 999_999, attempts: 3 });
    expect(nextPreparationCandidate(state, [current, stale], 'original-owner', 100)?.id).toBe(stale.id);
    expect(mayClaimJob(stale, 100)).toBe(false); // Retirement requires no inference or retry allowance.
    expect(nextPreparationCandidate(state, [current, { ...stale, status: 'stale' }], 'original-owner', 100)?.id).toBe(current.id);
  });
  it('does not retire another owner, workspace or any running/checking/future lease', () => {
    const stale = job('obsolete', { sourceRefs: [{ sourceId: 'source-probability', version: 1 }] });
    expect(staleQueuedPreparation(state, stale, 'original-owner', 100)).toBe(true);
    for (const patch of [{ ownerId: 'other-owner' }, { workspaceId: 'replaced-workspace' }, { status: 'generating' as const }, { status: 'checking' as const }, { leaseUntil: 101 }, { status: 'ready' as const }]) {
      expect(staleQueuedPreparation(state, { ...stale, ...patch }, 'original-owner', 100)).toBe(false);
    }
    expect(staleQueuedPreparation(state, { ...stale, leaseId: 'expired-lease', leaseUntil: 99 }, 'original-owner', 100)).toBe(true);
    expect(mayClaimJob({ ...stale, leaseId: 'active-lease', leaseUntil: 101 }, 100)).toBe(false);
    expect(nextPreparationCandidate(state, [{ ...stale, leaseUntil: 101 }], 'original-owner', 100)).toBeUndefined();
  });
  it('keeps deterministic created-time/id ordering and existing retry/expired-lease recovery', () => {
    const a = job('a'), b = job('b');
    expect(nextPreparationCandidate(state, [b, a], 'original-owner', 100)?.id).toBe('a');
    expect(nextPreparationCandidate(state, [{ ...a, nextAttemptAt: 101 }, b], 'original-owner', 100)?.id).toBe('b');
    expect(nextPreparationCandidate(state, [{ ...a, attempts: 3 }, b], 'original-owner', 100)?.id).toBe('b');
    expect(nextPreparationCandidate(state, [{ ...a, status: 'generating', attempts: 3, leaseUntil: 99 }], 'original-owner', 100)?.id).toBe('a');
    expect(nextPreparationCandidate(state, [{ ...a, status: 'checking', leaseUntil: 101 }], 'original-owner', 100)).toBeUndefined();
  });
  it('retirement depends on obsolete references, not an optional reviewer version alone', () => {
    const reviewOnly = { ...job('review-change'), reviewVersion: 'unselected-review-version' };
    expect(staleQueuedPreparation(state, reviewOnly, 'original-owner', 100)).toBe(false);
    expect(nextPreparationCandidate(state, [reviewOnly], 'original-owner', 100)?.id).toBe(reviewOnly.id);
  });
});
