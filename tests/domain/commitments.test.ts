import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/lib/domain/learning';
import { seedWorkspace, seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { ingestCommitments, mergeBusyIntervals, selectAvailability, validateRecommendationPublication } from '../../src/lib/domain/commitments';
import { planSession } from '../../src/lib/domain/session';
import type { CommitmentObservation, WorkspaceState } from '../../src/lib/domain/types';
const now = '2026-10-26T20:00:00.000Z';
const seed = () => seedWorkspace('commitment-test', now);
const scenario = (state: WorkspaceState, value: 'commitment-overlap' | 'commitment-no-overlap' | 'commitment-tentative' | 'commitment-duplicate') => applyAction(state, { type: 'scenario', scenario: value }, now);
function observation(state: WorkspaceState, changes: Partial<CommitmentObservation> = {}): CommitmentObservation {
  return { id: 'obs-test', workspaceId: state.id, eventId: 'event-test', title: 'Confirmed appointment', category: 'Personal', kind: 'event', startAt: '2026-10-28T20:20:00Z', endAt: '2026-10-28T21:00:00Z', timezone: 'America/New_York', status: 'confirmed', bufferBeforeMinutes: 0, bufferAfterMinutes: 0, sourceRefs: [{ sourceId: 'source-calendar', version: 1 }], observedAt: now, identityBasis: 'Student-selected event with explicit calendar identity.', ...changes };
}

describe('R12 bounded commitments and consequences', () => {
  it('uses the declared focus window, not empty space elsewhere in the day', () => {
    const state = seed();
    expect(selectAvailability(state).availableMinutes).toBe(45);
    state.focusWindows = [];
    expect(selectAvailability(state).availableMinutes).toBeNull();
    expect(selectAvailability(state).status).toBe('missing');
  });
  it('confirmed overlap reduces the session to 20 minutes while 25 minutes stay pending', () => {
    const original = seed(), changed = scenario(original, 'commitment-overlap');
    expect(changed.commitments).toHaveLength(1);
    expect(changed.commitmentObservations).toHaveLength(2);
    expect(selectAvailability(changed).availableMinutes).toBe(20);
    expect(changed.sessionRecommendation?.minutes).toBe(20);
    expect(changed.consequences?.at(-1)?.before.sessionMinutes).toBe(45);
    expect(changed.consequences?.at(-1)?.after.sessionMinutes).toBe(20);
    expect(changed.consequences?.at(-1)?.createdAt).toBe(now);
    expect(changed.consequences?.at(-1)?.sourceRefs.some(ref => ref.sourceId === 'source-interview-calendar')).toBe(true);
    expect(planSession(changed, 20).omittedMinutes).toBe(25);
    expect(changed.lessons).toEqual(original.lessons);
    expect(changed.attempts).toEqual(original.attempts);
    expect(changed.interpretations).toEqual(original.interpretations);
  });
  it('retains confirmed transparent events without making them busy or cancelled', () => {
    const state = seed();
    const result = ingestCommitments(state, [observation(state, { blocksFocus: false })], now);
    expect(result.commitments?.[0].status).toBe('confirmed');
    expect(result.commitmentObservations?.[0].blocksFocus).toBe(false);
    expect(selectAvailability(result).busyIntervals).toEqual([]);
    expect(selectAvailability(result).availableMinutes).toBe(45);
    expect(result.sessionRecommendation?.minutes).toBe(45);
    expect(() => ingestCommitments(result, [observation(state, { blocksFocus: true })], now)).toThrow(/unchanged source/);
    const conflicting = ingestCommitments(result, [observation(state, { id: 'obs-busy', blocksFocus: true, sourceRefs: [{ sourceId: 'source-g', version: 1 }] })], now);
    expect(conflicting.commitments?.[0].status).toBe('conflict');
    expect(selectAvailability(conflicting).status).toBe('uncertain');
  });
  it('a non-overlapping event adds context but no misleading change row or regenerated lesson', () => {
    const original = seed(), changed = scenario(original, 'commitment-no-overlap');
    expect(selectAvailability(changed).availableMinutes).toBe(45);
    expect(changed.consequences).toEqual([]);
    expect(changed.lessons).toEqual(original.lessons);
  });
  it('a proposed slot remains tentative and offers a conditional 20 minutes without shortening 45', () => {
    const changed = scenario(seed(), 'commitment-tentative');
    const availability = selectAvailability(changed);
    expect(changed.commitments?.[0].status).toBe('tentative');
    expect(availability.status).toBe('uncertain');
    expect(availability.availableMinutes).toBe(45);
    expect(availability.tentativeAvailableMinutes).toBe(20);
    expect(changed.sessionRecommendation?.minutes).toBe(45);
    expect(changed.consequences?.at(-1)?.classification).toBe('uncertainty');
  });
  it('deduplicates matching email/calendar identity and repeated collection without extra busy time', () => {
    const first = scenario(seed(), 'commitment-overlap');
    const duplicate = scenario(first, 'commitment-duplicate');
    expect(duplicate.commitments).toEqual(first.commitments);
    expect(duplicate.commitmentObservations).toEqual(first.commitmentObservations);
    expect(duplicate.consequences).toEqual(first.consequences);
    expect(duplicate.sessionRecommendation).toEqual(first.sessionRecommendation);
    expect(selectAvailability(duplicate).busyIntervals).toHaveLength(1);
    expect(selectAvailability(duplicate).availableMinutes).toBe(20);
  });
  it('changing the event time preserves historical sources and produces a real 20 to 45 consequence', () => {
    const first = scenario(seed(), 'commitment-overlap');
    const revised = scenario(first, 'commitment-no-overlap');
    expect(revised.sources.filter(source => source.id === 'source-interview-calendar').map(source => source.version)).toEqual([1, 2]);
    expect(revised.commitmentObservations).toHaveLength(4);
    expect(revised.commitments).toHaveLength(1);
    expect(revised.consequences?.at(-1)?.before.sessionMinutes).toBe(20);
    expect(revised.consequences?.at(-1)?.after.sessionMinutes).toBe(45);
  });
  it('clips elapsed time, merges overlapping events, and honors buffers and explicit offsets', () => {
    const state = seed();
    const first = observation(state, { startAt: '2026-10-28T16:20:00-04:00', bufferBeforeMinutes: 5 });
    const second = observation(state, { id: 'obs-2', eventId: 'event-2', startAt: '2026-10-28T20:30:00Z', endAt: '2026-10-28T21:10:00Z' });
    const result = ingestCommitments(state, [first, second], now);
    expect(selectAvailability(result).availableMinutes).toBe(15);
    expect(selectAvailability(result).busyIntervals).toHaveLength(1);
    expect(selectAvailability(result, '2026-10-28T20:10:00Z').availableMinutes).toBe(5);
    expect(selectAvailability(result, '2026-10-28T21:10:00Z').availableMinutes).toBeNull();
  });
  it('handles a daylight-saving transition by elapsed instants, not local-clock subtraction', () => {
    const state = seed();
    state.demoClock = '2026-11-01T04:00:00Z';
    state.focusWindows = [{ id: 'dst', startAt: '2026-11-01T01:00:00-04:00', endAt: '2026-11-01T02:00:00-05:00', timezone: 'America/New_York', declaredAt: now }];
    expect(selectAvailability(state).availableMinutes).toBe(120);
    expect(mergeBusyIntervals([{ startAt: '2026-11-01T01:30:00-04:00', endAt: '2026-11-01T01:30:00-05:00' }], state.focusWindows[0].startAt, state.focusWindows[0].endAt)).toEqual([{ startAt: '2026-11-01T05:30:00.000Z', endAt: '2026-11-01T06:30:00.000Z' }]);
  });
  it('does not turn stale or missing calendar context into claimed free time', () => {
    const state = scenario(seed(), 'commitment-overlap');
    state.sources.find(source => source.id === 'source-interview-email')!.status = 'stale';
    expect(selectAvailability(state).status).toBe('stale');
    expect(selectAvailability(state).availableMinutes).toBeNull();
    const empty = seedEmptyAccountWorkspace('private', now);
    expect(empty.sources).toEqual([]);
    expect(empty.lessons).toEqual([]);
    expect(empty.demoClock).toBeUndefined();
  });
  it('surfaces conflicting observations instead of choosing the newest convenient time', () => {
    const state = seed();
    const one = observation(state);
    const two = observation(state, { id: 'obs-other-source', startAt: '2026-10-28T20:30:00Z', sourceRefs: [{ sourceId: 'source-g', version: 1 }] });
    const result = ingestCommitments(state, [one, two], now);
    expect(result.commitments?.[0].status).toBe('conflict');
    expect(selectAvailability(result).status).toBe('uncertain');
    expect(selectAvailability(result).availableMinutes).toBe(45);
  });
  it('persists a user correction internally across refreshes without changing sources or another account', () => {
    const original = scenario(seed(), 'commitment-tentative');
    const corrected = applyAction(original, { type: 'correct-commitment', commitmentId: 'interview-demo', status: 'confirmed', note: 'I accepted the invitation.' }, now);
    expect(corrected.sources).toEqual(original.sources);
    expect(corrected.commitments?.[0].status).toBe('confirmed');
    expect(selectAvailability(corrected).availableMinutes).toBe(20);
    expect(corrected.corrections?.[0].before.status).toBe('tentative');
    const reloaded = JSON.parse(JSON.stringify(corrected));
    const refreshed = scenario(reloaded, 'commitment-no-overlap');
    expect(refreshed.commitments?.[0].startAt).toBe('2026-10-28T17:00:00-04:00');
    expect(refreshed.commitments?.[0].status).toBe('confirmed');
    expect(refreshed.corrections?.[0].fields).toEqual(['status']);
    expect(refreshed.commitments?.[0].correctionId).toBe('correction-1');
    const another = seedWorkspace('other', now);
    expect(() => applyAction(another, { type: 'correct-commitment', commitmentId: 'interview-demo', status: 'confirmed', note: 'Not mine' }, now)).toThrow(/workspace/);
    expect(another.corrections).toEqual([]);
  });
  it('rejects foreign ownership, forged source refs, contradictory replay, and publication races', () => {
    const state = seed();
    expect(() => ingestCommitments(state, [observation(state, { workspaceId: 'foreign' })], now)).toThrow(/ownership/);
    expect(() => ingestCommitments(state, [observation(state, { sourceRefs: [{ sourceId: 'foreign', version: 1 }] })], now)).toThrow(/references/);
    const ingested = ingestCommitments(state, [observation(state)], now);
    expect(() => ingestCommitments(ingested, [observation(state, { startAt: '2026-10-28T20:30:00Z' })], now)).toThrow(/unchanged source/);
    expect(() => validateRecommendationPublication(state, state.revision + 1, [])).toThrow(/changed/);
    expect(() => validateRecommendationPublication(state, state.revision, [{ sourceId: 'source-calendar', version: 2 }])).toThrow(/changed/);
    expect(() => validateRecommendationPublication(state, state.revision, [{ sourceId: 'source-calendar', version: 1 }])).not.toThrow();
  });
  it('never forces academic deadlines into independently editable commitments', () => {
    const state = scenario(seed(), 'commitment-overlap');
    expect(state.commitments?.some(item => item.title.includes('Exam'))).toBe(false);
    expect(state.courses.find(course => course.id === 'writing')?.deadline).toBe('2026-10-29T17:00:00-04:00');
  });
});

describe('real bounded session contents', () => {
  it.each([10, 20, 45] as const)('selects %i minutes of actual activities and retains omitted items', minutes => {
    const state = seed();
    const plan = planSession(state, minutes);
    expect(plan.items.reduce((sum, item) => sum + item.minutes, 0)).toBe(minutes);
    expect(plan.omittedMinutes).toBe(45 - minutes);
    expect(new Set([...plan.items, ...plan.omittedItems].map(item => item.id)).size).toBe(6);
    expect(plan.items.every(item => state.lessons.some(lesson => lesson.id === item.lessonId))).toBe(true);
    expect(state.attempts).toEqual([]);
  });
  it('keeps a longer session selectable while naming the availability mismatch', () => {
    const state = scenario(seed(), 'commitment-overlap');
    expect(planSession(state, 45).longerThanAvailable).toBe(true);
    expect(planSession(state, 20).longerThanAvailable).toBe(false);
    const selected = applyAction(state, { type: 'select-session', minutes: 10 }, now);
    expect(planSession(selected).minutes).toBe(10);
    expect(selected.attempts).toEqual(state.attempts);
    expect(selected.lessons).toEqual(state.lessons);
  });
  it('does not invent items to fill an empty private account', () => {
    expect(planSession(seedEmptyAccountWorkspace('private', now), 45).items).toEqual([]);
    expect(planSession(seedEmptyAccountWorkspace('private', now), 45).minutes).toBe(0);
  });
});
