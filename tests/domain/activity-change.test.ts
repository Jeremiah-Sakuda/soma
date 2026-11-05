import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { materiallyDifferentActivity } from '../../src/lib/domain/activity-change';
describe('material next activity', () => {
  it('rejects punctuation-only and invisible-text disguises of the same question', () => {
    const lesson = {
      ...seedWorkspace('synthetic-cosmetic-followup').lessons[0],
      question: 'Which branch current changes?',
    };
    for (const question of [
      'Which branch current changes!!!',
      'Which branch current changes?\u200b',
    ])
      expect(materiallyDifferentActivity(lesson, { ...lesson, id: 'cosmetic-id', question })).toBe(
        false,
      );
  });
  it('rejects renamed or relabeled duplicates but accepts a fresh supported condition', () => {
    const lesson = seedWorkspace('synthetic-material-followup').lessons[0];
    expect(
      materiallyDifferentActivity(lesson, {
        ...lesson,
        id: 'new-id',
        title: 'New label',
        reason: 'New wording',
      }),
    ).toBe(false);
    expect(
      materiallyDifferentActivity(lesson, {
        ...lesson,
        id: 'new-id',
        question: `  ${lesson.question.toUpperCase()}  `,
      }),
    ).toBe(false);
    expect(
      materiallyDifferentActivity(lesson, {
        ...lesson,
        id: 'new-id',
        circuit: { ...lesson.circuit, r1: lesson.circuit.r1 + 1 },
      }),
    ).toBe(true);
    expect(
      materiallyDifferentActivity(lesson, {
        ...lesson,
        id: 'new-id',
        question: 'What changes under a different condition?',
      }),
    ).toBe(true);
  });
});
