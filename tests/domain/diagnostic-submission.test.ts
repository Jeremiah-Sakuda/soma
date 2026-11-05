import { describe, expect, it } from 'vitest';
import { applyAction } from '../../src/lib/domain/learning';
import { seedWorkspace } from '../../src/lib/domain/seed';
import type { WorkspaceState } from '../../src/lib/domain/types';

const createdAt = '2026-10-26T16:00:00.000Z';
const helpedAt = '2026-10-26T16:03:00.000Z';
const answeredAt = '2026-10-26T16:05:00.000Z';
const revisedAt = '2026-10-26T16:07:00.000Z';
function diagnosticState(kind: 'practice' | 'circuit' = 'practice'): WorkspaceState {
  const workspace = seedWorkspace('diagnostic-submission', createdAt);
  const lesson = structuredClone(workspace.lessons.find((item) => item.kind === kind)!);
  lesson.id = 'original-diagnostic';
  lesson.mode = 'live';
  lesson.examEligible = false;
  lesson.diagnosticInvestigationId = 'original-investigation';
  lesson.answerIndex = 0; // Shared renderer field, deliberately not a diagnostic correctness key.
  lesson.explanation =
    'This response can inform a later comparison of two provisional explanations.';
  if (kind === 'practice') lesson.exposure = 'fresh-no-diagram';
  workspace.lessons.push(lesson);
  workspace.investigations = [
    {
      id: 'original-investigation',
      workspaceId: workspace.id,
      courseId: lesson.courseId,
      createdAt,
      mode: 'prepared',
      decision: 'revise-session',
      reason: 'A prepared test diagnostic separates two provisional explanations.',
      sourceRefs: lesson.sourceIds.map((sourceId) => ({
        sourceId,
        version: lesson.sourceVersions[sourceId],
        quote: workspace.sources.find((source) => source.id === sourceId)!.body.slice(0, 60),
      })),
      assessmentId: null,
      applicability: 'course',
      conflicts: [],
      diagnosticLessonId: lesson.id,
      hypothesisRevisions: [
        { hypothesisId: 'first-explanation', status: 'plausible' },
        { hypothesisId: 'competing-explanation', status: 'unresolved' },
      ],
    },
  ];
  return workspace;
}
const submit = (workspace: WorkspaceState, optionIndex: number, revisionOf?: string) =>
  applyAction(
    workspace,
    {
      type: 'attempt',
      lessonId: 'original-diagnostic',
      optionIndex,
      ...(revisionOf ? { revisionOf } : {}),
    },
    revisionOf ? revisedAt : answeredAt,
  );

describe('diagnostic submissions store observations without grading or automatic interpretation', () => {
  it.each([0, 1, 2])(
    'keeps option %s ungraded, including the renderer answerIndex placeholder',
    (optionIndex) => {
      const original = diagnosticState(),
        before = structuredClone(original);
      const result = submit(original, optionIndex),
        attempt = result.attempts.at(-1)!;
      const lesson = original.lessons.find((item) => item.id === 'original-diagnostic')!;
      expect(attempt).toMatchObject({
        correct: null,
        question: lesson.question,
        response: lesson.options[optionIndex],
        createdAt: answeredAt,
        lessonVersion: lesson.version,
        modelVersion: lesson.modelVersion,
        sourceVersions: lesson.sourceVersions,
        assisted: false,
        assistance: [],
        novel: true,
        exposure: 'fresh-no-diagram',
      });
      expect(attempt.feedback).toContain('without a correctness grade');
      expect(attempt.feedback).not.toContain('selected explanation is correct');
      expect(attempt.feedback).not.toContain('answer needs another look');
      expect(result.lessons).toEqual(original.lessons);
      expect(result.interpretations).toEqual(original.interpretations);
      expect(result.investigations).toEqual(original.investigations);
      expect(result.reviews).toEqual(original.reviews);
      expect(result.runs.at(-1)).toMatchObject({
        status: 'unchanged',
        createdAt: answeredAt,
        trigger: `diagnostic:${attempt.id}`,
      });
      expect(
        result.runs.slice(original.runs.length).some((run) => run.trigger.startsWith('followup:')),
      ).toBe(false);
      expect(result.revision).toBe(original.revision + 1);
      expect(original).toEqual(before);
    },
  );
  it('preserves actual help and source snapshots through JSON reload and subsequent revision', () => {
    const helped = applyAction(
      diagnosticState(),
      { type: 'assistance', lessonId: 'original-diagnostic', kind: 'hint' },
      helpedAt,
    );
    const originalHelp = [...helped.assistance['original-diagnostic']];
    const first = submit(JSON.parse(JSON.stringify(helped)), 1),
      originalAttempt = structuredClone(first.attempts.at(-1)!);
    expect(originalAttempt.correct).toBeNull();
    expect(originalAttempt.assisted).toBe(true);
    expect(originalAttempt.assistance).toEqual(originalHelp);
    expect(originalAttempt.assistance[0]).toContain(helpedAt);
    const revised = submit(JSON.parse(JSON.stringify(first)), 0, originalAttempt.id),
      revision = revised.attempts.at(-1)!;
    expect(revised.attempts[0]).toEqual(originalAttempt);
    expect(revision).toMatchObject({
      correct: null,
      revisionOf: originalAttempt.id,
      createdAt: revisedAt,
      assisted: true,
      novel: false,
      sourceVersions: originalAttempt.sourceVersions,
    });
    expect(revision.assistance).toEqual(expect.arrayContaining(originalHelp));
    expect(revision.assistance.some((item) => item.includes('diagnostic-response-exposure'))).toBe(
      true,
    );
    expect(revised.interpretations).toEqual(helped.interpretations);
    expect(revised.investigations).toEqual(helped.investigations);
    expect(revised.lessons).toEqual(helped.lessons);
    expect(revised.reviews).toEqual(helped.reviews);
    expect(JSON.parse(JSON.stringify(revised)).attempts).toEqual(revised.attempts);
  });
  it('does not treat a repeated diagnostic choice as a fresh unsupported observation', () => {
    const first = submit(diagnosticState(), 0),
      original = structuredClone(first.attempts[0]);
    const second = applyAction(
      first,
      { type: 'attempt', lessonId: 'original-diagnostic', optionIndex: 2 },
      revisedAt,
    );
    expect(second.attempts[0]).toEqual(original);
    expect(second.attempts[1]).toMatchObject({
      correct: null,
      novel: false,
      assisted: true,
      createdAt: revisedAt,
    });
    expect(
      second.attempts[1].assistance.some((item) => item.includes('diagnostic-response-exposure')),
    ).toBe(true);
    expect(second.attempts[1].feedback).toContain('not fresh transfer evidence');
    expect(second.interpretations).toEqual(first.interpretations);
  });
  it('retains visible circuit support even when no hint was requested', () => {
    const result = submit(diagnosticState('circuit'), 0),
      attempt = result.attempts[0];
    expect(attempt).toMatchObject({ correct: null, assisted: true, exposure: 'lab' });
    expect(attempt.assistance.some((item) => item.includes('diagram-visible'))).toBe(true);
    expect(result.lessons).toHaveLength(diagnosticState('circuit').lessons.length);
  });
  it('keeps an Easy self-rating separate from ungraded responses and hypothesis statuses', () => {
    const answered = submit(diagnosticState(), 1),
      originalAttempt = structuredClone(answered.attempts[0]);
    const reviewed = applyAction(
      answered,
      { type: 'review', lessonId: 'original-diagnostic', rating: 'Easy' },
      revisedAt,
    );
    expect(reviewed.reviews.at(-1)).toMatchObject({
      rating: 'Easy',
      reviewedAt: revisedAt,
      lessonId: 'original-diagnostic',
    });
    expect(reviewed.attempts).toEqual([originalAttempt]);
    expect(reviewed.attempts[0].correct).toBeNull();
    expect(reviewed.investigations).toEqual(answered.investigations);
    expect(reviewed.interpretations).toEqual(answered.interpretations);
    expect(reviewed.lessons).toEqual(answered.lessons);
  });
  it('still rejects stale sources and revisions of another lesson without creating observations', () => {
    const stale = diagnosticState(),
      before = structuredClone(stale);
    const lesson = stale.lessons.find((item) => item.id === 'original-diagnostic')!;
    stale.sources.find((source) => source.id === lesson.sourceIds[0])!.status = 'stale';
    expect(() => submit(stale, 0)).toThrow(/stale/);
    expect(stale.attempts).toEqual(before.attempts);
    const other = applyAction(
      diagnosticState(),
      { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 },
      createdAt,
    );
    const existing = structuredClone(other);
    expect(() => submit(other, 0, other.attempts[0].id)).toThrow(/revision/);
    expect(other).toEqual(existing);
  });
});

it('records source-disclosure help while stale without allowing stale attempts or losing exposure after recovery', () => {
  let state = seedWorkspace('stale-disclosure');
  const base = state.lessons.find((lesson) => lesson.courseId === 'probability')!;
  state.lessons.push({
    ...base,
    id: 'stale-diagnostic',
    diagnosticInvestigationId: 'investigation-stale',
    exposure: 'fresh-no-diagram',
    state: 'stale',
  });
  state = applyAction(
    state,
    { type: 'assistance', lessonId: 'stale-diagnostic', kind: 'explanation' },
    '2026-10-28T13:00:00.000Z',
  );
  expect(() =>
    applyAction(state, { type: 'attempt', lessonId: 'stale-diagnostic', optionIndex: 0 }),
  ).toThrow(/stale/i);
  expect(() =>
    applyAction(state, { type: 'assistance', lessonId: 'not-owned', kind: 'explanation' }),
  ).toThrow(/belong/);
  state.lessons.find((lesson) => lesson.id === 'stale-diagnostic')!.state = 'ready';
  const recovered = applyAction(
    state,
    { type: 'attempt', lessonId: 'stale-diagnostic', optionIndex: 0 },
    '2026-10-28T13:10:00.000Z',
  );
  expect(recovered.attempts.at(-1)).toMatchObject({
    correct: null,
    assisted: true,
    assistance: ['2026-10-28T13:00:00.000Z · explanation'],
  });
});
