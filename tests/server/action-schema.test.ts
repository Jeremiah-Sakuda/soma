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
