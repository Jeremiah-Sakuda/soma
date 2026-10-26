import { describe, expect, it } from 'vitest';
import { workspaceActionSchema } from '../../src/lib/server/action-schema';

describe('untrusted action boundaries', () => {
  it('rejects attempted ownership, grading, or arbitrary evidence writes', () => {
    for (const field of ['ownerId', 'workspaceId', 'correct', 'assisted', 'attempts']) {
      expect(workspaceActionSchema.safeParse({ type: 'attempt', lessonId: 'lesson-1', optionIndex: 1, [field]: 'injected' }).success).toBe(false);
    }
    expect(workspaceActionSchema.safeParse({ type: 'set-state', workspace: {} }).success).toBe(false);
  });
  it('bounds expensive text and rejects nonphysical or nonfinite circuit parameters', () => {
    expect(workspaceActionSchema.safeParse({ type: 'request-lesson', courseId: 'course-1', topic: 'x'.repeat(301) }).success).toBe(false);
    expect(workspaceActionSchema.safeParse({ type: 'request-lesson', courseId: 'course-1', topic: '  ' }).success).toBe(false);
    for (const invalid of [0, -1, Infinity, NaN, 101]) {
      expect(workspaceActionSchema.safeParse({ type: 'save-inputs', lessonId: 'lesson-1', inputs: { topology: 'parallel', voltage: 12, r1: invalid, r2: 10 } }).success).toBe(false);
    }
    expect(workspaceActionSchema.safeParse({ type: 'save-inputs', lessonId: 'lesson-1', inputs: { topology: 'parallel', voltage: 0, r1: 1, r2: 100 } }).success).toBe(true);
  });
  it('requires real preference changes and bounded response indices', () => {
    expect(workspaceActionSchema.safeParse({ type: 'preference' }).success).toBe(false);
    expect(workspaceActionSchema.safeParse({ type: 'preference', workedExamples: false }).success).toBe(true);
    expect(workspaceActionSchema.safeParse({ type: 'attempt', lessonId: 'lesson-1', optionIndex: -1 }).success).toBe(false);
    expect(workspaceActionSchema.safeParse({ type: 'attempt', lessonId: 'lesson-1', optionIndex: 0.5 }).success).toBe(false);
  });
});

describe('bounded Ready Card actions', () => {
  it('accepts declared windows, optional prediction flow, and supported session sizes', () => {
    for (const action of [
      { type: 'focus-window', startAt: '2026-10-28T16:00:00-04:00', endAt: '2026-10-28T16:45:00-04:00', timezone: 'America/New_York' },
      { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1 },
      { type: 'reveal-prediction', lessonId: 'parallel-nodes' },
      { type: 'fresh-question', lessonId: 'parallel-nodes', when: 'later' },
      { type: 'select-session', minutes: 45 },
      { type: 'correct-commitment', commitmentId: 'interview-demo', status: 'tentative', note: 'The slot was only proposed.' },
    ]) expect(workspaceActionSchema.safeParse(action).success).toBe(true);
  });
  it('rejects client-authored outcomes, missing-offset times and arbitrary event writes', () => {
    for (const action of [
      { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1, matched: true },
      { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 3 },
      { type: 'select-session', minutes: 30 },
      { type: 'focus-window', startAt: '2026-10-28T16:00:00', endAt: '2026-10-28T16:45:00', timezone: 'America/New_York' },
      { type: 'correct-commitment', commitmentId: 'interview-demo', note: 'No actual change' },
      { type: 'correct-commitment', commitmentId: 'interview-demo', status: 'confirmed', note: 'x', workspaceId: 'foreign' },
      { type: 'create-event', title: 'Write to my calendar' },
    ]) expect(workspaceActionSchema.safeParse(action).success).toBe(false);
  });
});
