import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { AuthoredFollowupUnavailableError, followupLesson, PREPARED_MODEL } from '../../src/lib/domain/lessons';
import { prepareFreshQuestion } from '../../src/lib/domain/prediction';
const now = '2026-10-26T15:00:00.000Z';

describe('authored follow-up freshness boundary', () => {
  it('rejects a generic live practice follow-up without adding a fresh question or request', () => {
    const state = seedWorkspace('fresh-test', now);
    const lesson = { ...state.lessons.find(item => item.courseId === 'writing')!, id: 'generated-history', courseId: 'history', mode: 'live' as const, modelVersion: 'practice-v1-development' };
    state.lessons.push(lesson); state.freshRequests = [];
    const before = structuredClone(state);
    expect(() => prepareFreshQuestion(state, lesson, 'now', now)).toThrow(/Request another source-grounded question/);
    expect(state).toEqual(before);
  });
  it('does not substitute an authored topic for a live lesson merely because its course ID matches a fixture', () => {
    const lesson = seedWorkspace('fresh-test', now).lessons.find(item => item.courseId === 'writing')!;
    expect(() => followupLesson({ ...lesson, mode: 'live', modelVersion: 'practice-v1-development', question: 'Which epic poetry passage supports the cited historical interpretation?' }, 1, false)).toThrow(AuthoredFollowupUnavailableError);
    expect(() => followupLesson({ ...lesson, sourceIds: ['private-writing-source'] }, 1, false)).toThrow(AuthoredFollowupUnavailableError);
  });
  it('preserves first authored fresh flows for every original fixture course', () => {
    const state = seedWorkspace('fresh-test', now);
    for (const lesson of state.lessons) {
      const next = followupLesson(lesson, 1, false);
      expect(next.question).not.toBe(lesson.question); expect(next.mode).toBe('prepared');
      expect(next.validation?.status).toBe('development-preview');
      if (lesson.kind === 'practice') { expect(next.modelVersion).toBe(PREPARED_MODEL); expect(next.description).toContain('synthetic'); }
    }
  });
  it('does not relabel a repeated static fixture as a fresh new application', () => {
    const lesson = seedWorkspace('fresh-test', now).lessons.find(item => item.courseId === 'design')!;
    const followup = followupLesson(lesson, 1, false);
    expect(() => followupLesson(followup, 2, false)).toThrow(AuthoredFollowupUnavailableError);
    const state = seedWorkspace('fresh-test', now); state.lessons.push(followup); state.freshRequests = [];
    expect(() => prepareFreshQuestion(state, followup, 'later', now)).toThrow(/another source-grounded question/);
    expect(state.freshRequests).toEqual([]);
  });
  it('labels a circuit follow-up as authored when its parent came from live Spark', () => {
    const lesson = seedWorkspace('fresh-test', now).lessons.find(item => item.kind === 'circuit')!;
    const next = followupLesson({ ...lesson, mode: 'live', description: 'Spark selected this example.' }, 1, true);
    expect(next.description).toContain('Authored parameterized'); expect(next.description).not.toContain('Spark selected');
    expect(next.mode).toBe('prepared');
  });
});
