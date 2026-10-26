import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/lib/domain/learning';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { calculateCircuit } from '../../src/lib/domain/circuit';
const now = '2026-10-26T20:00:00.000Z';
const later = '2026-10-26T20:10:00.000Z';
const seed = () => seedWorkspace('workspace-one', now);

describe('source-to-lesson synthetic transitions', () => {
  it('prepares a full original semester with no invented learner attempts or live claims', () => {
    const state = seed();
    expect(state.courses).toHaveLength(5);
    expect(state.lessons.filter(lesson => lesson.kind === 'circuit')).toHaveLength(2);
    expect(new Set(state.lessons.map(lesson => lesson.courseId)).size).toBe(5);
    expect(state.attempts).toEqual([]);
    expect(state.runs.every(run => run.mode === 'synthetic')).toBe(true);
    expect(state.sources.every(source => source.kind === 'synthetic' && source.retrievedAt === now)).toBe(true);
    for (const lesson of state.lessons.filter(item => item.kind === 'circuit')) calculateCircuit(lesson.circuit);
  });
  it('changes timing without regenerating lessons or losing nearer course deadlines', () => {
    const original = seed();
    const moved = applyAction(original, { type: 'scenario', scenario: 'exam-moved' }, later);
    expect(moved.courses.find(course => course.id === 'circuits')?.deadline).toBe('2026-10-30T10:00:00-04:00');
    expect(moved.courses.find(course => course.id === 'writing')).toEqual(original.courses.find(course => course.id === 'writing'));
    expect(moved.lessons).toEqual(original.lessons);
    expect(original.sources.some(source => source.id === 'source-b')).toBe(false);
    const again = applyAction(moved, { type: 'scenario', scenario: 'exam-moved' }, later);
    expect(again.sources).toEqual(moved.sources);
    expect(again.runs).toEqual(moved.runs);
  });
  it('narrows scope and keeps adversarial commands inert without manufacturing evidence', () => {
    const original = seed();
    const changed = applyAction(original, { type: 'scenario', scenario: 'injection' }, later);
    expect(changed.sources.find(source => source.id === 'source-h')?.body).toContain('Ignore prior instructions');
    expect(changed.attempts).toEqual(original.attempts);
    expect(changed.interpretations).toEqual(original.interpretations);
    expect(changed.reviews).toEqual(original.reviews);
    expect(changed.sources.find(source => source.id === 'source-g')).toEqual(original.sources.find(source => source.id === 'source-g'));
    expect(changed.lessons.filter(lesson => lesson.examEligible).every(lesson => lesson.kind === 'circuit')).toBe(true);
    expect(() => applyAction(changed, { type: 'request-lesson', courseId: 'circuits', topic: 'capacitor transients' }, later)).toThrow(/outside/);
  });
  it('preserves original snapshots and attempts when content is revised', () => {
    const answered = applyAction(seed(), { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 }, now);
    const revised = applyAction(answered, { type: 'scenario', scenario: 'source-revised' }, later);
    expect(revised.sources.filter(source => source.id === 'source-d').map(source => source.version)).toEqual([1, 2]);
    expect(revised.attempts).toEqual(answered.attempts);
    expect(revised.attempts[0].sourceVersions?.['source-d']).toBe(1);
    expect(revised.lessons.find(lesson => lesson.id === 'parallel-nodes')?.state).toBe('stale');
    const replacement = revised.lessons.find(lesson => lesson.id === 'parallel-nodes-v2')!;
    expect(replacement.sourceVersions['source-d']).toBe(2);
    expect(replacement.circuit).toEqual({ topology: 'parallel', voltage: 9, r1: 9, r2: 3 });
    expect(() => applyAction(revised, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 }, later)).toThrow(/stale/);
  });
  it('fails closed on expiry, refresh cannot claim unchanged, reconnect retains supersession', () => {
    const revised = applyAction(seed(), { type: 'scenario', scenario: 'source-revised' }, now);
    const expired = applyAction(revised, { type: 'scenario', scenario: 'source-expired' }, later);
    expect(expired.lessons.every(lesson => lesson.state === 'stale')).toBe(true);
    expect(() => applyAction(expired, { type: 'attempt', lessonId: 'parallel-nodes-v2', optionIndex: 0 }, later)).toThrow();
    expect(applyAction(expired, { type: 'refresh' }, later).runs.at(-1)?.status).toBe('failed');
    const reconnected = applyAction(expired, { type: 'scenario', scenario: 'reconnect' }, later);
    expect(reconnected.lessons.find(lesson => lesson.id === 'parallel-nodes')?.state).toBe('stale');
    expect(reconnected.lessons.find(lesson => lesson.id === 'parallel-nodes-v2')?.state).toBe('ready');
    expect(reconnected.sources.find(source => source.id === 'source-d' && source.version === 1)?.status).toBe('stale');
  });
  it('reuses prepared content on direct request and refresh', () => {
    const original = seed();
    const requested = applyAction(original, { type: 'request-lesson', courseId: 'circuits', topic: 'series' }, later);
    expect(requested.lessons).toEqual(original.lessons);
    expect(requested.runs.at(-1)?.trigger).toBe('request:series-contrast');
    const refreshed = applyAction(requested, { type: 'refresh' }, later);
    expect(refreshed.lessons).toEqual(requested.lessons);
    expect(refreshed.runs.at(-1)?.status).toBe('unchanged');
  });
});

describe('learning records preserve the difference between support and independent evidence', () => {
  it('help survives JSON reload; original and revised responses retain immutable support provenance', () => {
    const helped = applyAction(seed(), { type: 'assistance', lessonId: 'parallel-nodes', kind: 'explanation' }, now);
    const reloaded = JSON.parse(JSON.stringify(helped));
    const first = applyAction(reloaded, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 1 }, later);
    const revised = applyAction(first, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0, revisionOf: first.attempts[0].id }, later);
    expect(revised.attempts[0]).toEqual(first.attempts[0]);
    expect(revised.attempts[0].assisted).toBe(true);
    expect(revised.attempts[1].assistance.some(entry => entry.includes('explanation'))).toBe(true);
    expect(revised.attempts[1].assistance.some(entry => entry.includes('answer-feedback'))).toBe(true);
    expect(revised.attempts[1].novel).toBe(false);
    expect(revised.attempts[1].revisionOf).toBe('attempt-1');
    expect(revised.attempts[0].createdAt).toBe(later);
  });
  it('a contrary correct diagnostic changes the current interpretation and prepares a different question', () => {
    const original = seed();
    const answered = applyAction(original, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 }, later);
    expect(answered.interpretations[0]).toEqual(original.interpretations[0]);
    expect(answered.interpretations.at(-1)?.status).toBe('revised');
    expect(answered.interpretations.at(-1)?.claim).toContain('support');
    expect(answered.lessons.at(-1)?.question).not.toBe(original.lessons[0].question);
    expect(answered.lessons.at(-1)?.options).not.toEqual(original.lessons[0].options);
    expect(answered.attempts[0].assisted).toBe(true);
    expect(answered.attempts[0].assistance.some(item => item.includes('diagram-visible'))).toBe(true);
    expect(answered.lessons[0]).toEqual(original.lessons[0]);
  });
  it('saves controls and records exploration support without demanding an attempt', () => {
    const inputs = { topology: 'parallel' as const, voltage: 10, r1: 10, r2: 20 };
    const explored = applyAction(seed(), { type: 'save-inputs', lessonId: 'parallel-nodes', inputs }, later);
    const loaded = JSON.parse(JSON.stringify(explored));
    expect(loaded.savedInputs['parallel-nodes']).toEqual(inputs);
    expect(loaded.attempts).toEqual([]);
    expect(applyAction(loaded, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 }, later).attempts[0].assisted).toBe(true);
  });
  it('schedules self-ratings with persisted FSRS state while leaving understanding evidence unchanged', () => {
    const original = seed();
    const first = applyAction(original, { type: 'review', lessonId: 'parallel-nodes', rating: 'Good' }, now);
    const second = applyAction(JSON.parse(JSON.stringify(first)), { type: 'review', lessonId: 'parallel-nodes', rating: 'Easy' }, later);
    expect(second.reviews).toHaveLength(2);
    expect(second.reviews[0]).toEqual(first.reviews[0]);
    expect(second.reviews[1].card?.reps).toBe(2);
    expect(second.reviews[1].scheduler).toBe('ts-fsrs-5.4.2');
    expect(new Date(second.reviews[1].dueAt).getTime()).toBeGreaterThan(new Date(later).getTime());
    expect(second.attempts).toEqual(original.attempts);
    expect(second.interpretations).toEqual(original.interpretations);
  });
  it('isolates preference/input objects and refuses unknown foreign references', () => {
    const one = seed();
    const two = seedWorkspace('workspace-two', now);
    const changed = applyAction(one, { type: 'preference', sessionMinutes: 5, workedExamples: true }, now);
    expect(two.preferences).toEqual({ sessionMinutes: 20, workedExamples: false });
    expect(one.preferences).toEqual(two.preferences);
    expect(changed.preferences.sessionMinutes).toBe(5);
    expect(() => applyAction(one, { type: 'attempt', lessonId: 'foreign', optionIndex: 0 }, now)).toThrow(/workspace/);
    expect(() => applyAction(one, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0, revisionOf: 'foreign' }, now)).toThrow(/workspace/);
  });
  it('uses ordinary practice for the second domain with a meaningful fresh follow-up', () => {
    const answered = applyAction(seed(), { type: 'attempt', lessonId: 'independent-events', optionIndex: 0 }, now);
    expect(answered.interpretations.at(-1)?.courseId).toBe('probability');
    const next = answered.lessons.at(-1)!;
    expect(next.kind).toBe('practice');
    expect(next.question).not.toBe(answered.attempts[0].question);
    expect(next.sourceIds).toEqual(['source-probability']);
  });
});

describe('authored content does not inherit a live inference label', () => {
  it('marks a deterministic follow-up of a live parent prepared', () => {
    const state = seed();
    state.lessons[0].mode = 'live';
    const answered = applyAction(state, { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 }, later);
    expect(answered.lessons[0].mode).toBe('live');
    expect(answered.lessons.at(-1)?.mode).toBe('prepared');
    expect(answered.runs.at(-1)?.mode).toBe('synthetic');
  });
  it('marks a fixture content replacement of a live parent prepared', () => {
    const state = seed();
    state.lessons[0].mode = 'live';
    const revised = applyAction(state, { type: 'scenario', scenario: 'source-revised' }, later);
    expect(revised.lessons.find(lesson => lesson.id === 'parallel-nodes')?.mode).toBe('live');
    expect(revised.lessons.find(lesson => lesson.id === 'parallel-nodes-v2')?.mode).toBe('prepared');
  });
});
