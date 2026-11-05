import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { planSession } from '../../src/lib/domain/session';

describe('source investigation recommendation in the next session', () => {
  it('features an ordinary diagnostic without manufacturing an authored follow-up', () => {
    const state = seedWorkspace('recommendation');
    const base = state.lessons.find((lesson) => lesson.courseId === 'probability')!;
    const diagnostic = {
      ...base,
      id: 'diagnostic-text',
      exposure: 'fresh-no-diagram' as const,
      diagnosticInvestigationId: 'investigation-source',
    };
    state.lessons.push(diagnostic);
    state.recommendedLessonId = diagnostic.id;
    const before = structuredClone(state);
    const plan = planSession(state, 20);
    expect(plan.items[0]).toMatchObject({ lessonId: diagnostic.id, title: diagnostic.title });
    expect(
      [...plan.items, ...plan.omittedItems].some((item) => item.id === `${diagnostic.id}-fresh`),
    ).toBe(false);
    expect(state).toEqual(before);
    state.lessons.find((lesson) => lesson.id === diagnostic.id)!.state = 'stale';
    expect(planSession(state).items[0].lessonId).not.toBe(diagnostic.id);
  });
  it('can select the actual course instead of preferring the resistor fixture', () => {
    const state = seedWorkspace('actual-course-order');
    const writing = state.lessons.find((lesson) => lesson.courseId === 'writing')!;
    state.recommendedLessonId = writing.id;
    expect(planSession(state).items[0].lessonId).toBe(writing.id);
    const reordered = {
      ...state,
      recommendedLessonId: undefined,
      lessons: [writing, ...state.lessons.filter((lesson) => lesson.id !== writing.id)],
    };
    expect(planSession(reordered).items[0].lessonId).toBe(writing.id);
  });
});
