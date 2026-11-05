import { describe, expect, it } from 'vitest';
import { graphFixture } from '../helpers/learning-graph';
import { reconcileLearningGraph, localLearningGraph } from '../../src/lib/domain/learning-graph';
import { applyAction } from '../../src/lib/domain/learning';

describe('graph revisions across fresh diagnostics', () => {
  it('revises the original explanations and separately records the new diagnostic', () => {
    const raw = graphFixture(),
      before = reconcileLearningGraph({ ...raw, investigations: [] }, raw);
    const next = applyAction(
      before,
      { type: 'attempt', lessonId: before.lessons[0].id, optionIndex: 0 },
      '2026-10-27T12:01:00Z',
    );
    const original = before.investigations![0],
      first = before.lessons[0],
      observation = next.attempts.at(-1)!;
    const fresh = {
      ...first,
      id: 'different-diagnostic',
      objective: 'A fresh representation of the branch relationship',
      diagnosticInvestigationId: 'follow-up',
      question: 'Which two endpoint nodes share the source voltage?',
    };
    const plan = structuredClone(original.diagnosticPlan!);
    plan.question = fresh.question;
    plan.hypotheses.forEach((hypothesis, index) => {
      hypothesis.id = `fresh-${index}`;
      hypothesis.claim = `A separate provisional explanation ${index}`;
    });
    plan.predictions = plan.predictions.map((prediction, index) => ({
      ...prediction,
      hypothesisId: `fresh-${index}`,
    }));
    next.lessons.push(fresh);
    next.investigations!.push({
      ...original,
      id: 'follow-up',
      createdAt: '2026-10-27T12:02:00Z',
      supersedesId: original.id,
      attemptIds: [observation.id],
      selectedLessonId: fresh.id,
      diagnosticLessonId: fresh.id,
      diagnosticPlan: plan,
      hypothesisRevisions: [
        {
          hypothesisId: 'one',
          status: 'weakened',
          reason: 'The saved response weakens the original explanation.',
        },
        {
          hypothesisId: 'two',
          status: 'unresolved',
          reason: 'The competing explanation remains uncertain.',
        },
      ],
    });
    const result = reconcileLearningGraph(before, next);
    const old = localLearningGraph(result, first.id).filter(
      (record) => record.kind === 'interpretation',
    );
    expect(old).toHaveLength(2);
    expect(
      old.find(
        (record) =>
          record.kind === 'interpretation' && record.claim === 'Provisional explanation one',
      ),
    ).toMatchObject({ version: 2, status: 'weakened', observationIds: [observation.id] });
    const introduced = localLearningGraph(result, fresh.id).filter(
      (record) => record.kind === 'interpretation',
    );
    expect(introduced).toHaveLength(2);
    expect(
      introduced.every(
        (record) =>
          record.version === 1 && record.kind === 'interpretation' && record.status === 'plausible',
      ),
    ).toBe(true);
    expect(result.learningGraph!.slice(0, before.learningGraph!.length)).toEqual(
      before.learningGraph,
    );
    expect(reconcileLearningGraph(result, structuredClone(result))).toEqual(result);
  });
  it('retains the last supported status and its observations when a later investigation adds no revision', () => {
    const raw = graphFixture(),
      initial = reconcileLearningGraph({ ...raw, investigations: [] }, raw);
    const answered = applyAction(
        initial,
        { type: 'attempt', lessonId: initial.lessons[0].id, optionIndex: 0 },
        '2026-10-27T12:01:00Z',
      ),
      root = initial.investigations![0],
      attempt = answered.attempts.at(-1)!;
    answered.investigations!.push({
      ...root,
      id: 'response-revision',
      supersedesId: root.id,
      createdAt: '2026-10-27T12:02:00Z',
      diagnosticPlan: undefined,
      diagnosticLessonId: undefined,
      attemptIds: [attempt.id],
      hypothesisRevisions: [
        {
          hypothesisId: 'one',
          status: 'weakened',
          reason: 'The recorded observation provisionally weakens this explanation.',
        },
      ],
    });
    const revised = reconcileLearningGraph(initial, answered),
      later = structuredClone(revised);
    later.investigations!.push({
      ...root,
      id: 'source-only-continuation',
      supersedesId: 'response-revision',
      createdAt: '2026-10-27T12:03:00Z',
      diagnosticPlan: undefined,
      diagnosticLessonId: undefined,
    });
    const final = reconcileLearningGraph(revised, later);
    expect(
      localLearningGraph(final, initial.lessons[0].id).find(
        (record) =>
          record.kind === 'interpretation' && record.claim === 'Provisional explanation one',
      ),
    ).toMatchObject({
      status: 'weakened',
      observationIds: [attempt.id],
      uncertainty: 'The recorded observation provisionally weakens this explanation.',
    });
  });
  it('does not transfer a revision to a different hypothesis with a reused short ID', () => {
    const raw = graphFixture(),
      before = reconcileLearningGraph({ ...raw, investigations: [] }, raw),
      next = structuredClone(before),
      original = before.investigations![0];
    const fresh = {
      ...before.lessons[0],
      id: 'fresh-reused-id',
      objective: 'Different supported diagnostic objective',
      diagnosticInvestigationId: 'fresh-investigation',
    };
    next.lessons.push(fresh);
    const plan = structuredClone(original.diagnosticPlan!);
    plan.hypotheses[0].claim = 'Different claim sharing a local identifier.';
    next.investigations!.push({
      ...original,
      id: 'fresh-investigation',
      createdAt: '2026-10-27T12:02:00Z',
      supersedesId: original.id,
      selectedLessonId: fresh.id,
      diagnosticLessonId: fresh.id,
      diagnosticPlan: plan,
      hypothesisRevisions: [
        { hypothesisId: 'one', status: 'weakened', reason: 'Only the original claim is weakened.' },
        { hypothesisId: 'two', status: 'unresolved', reason: 'Original ambiguity remains.' },
      ],
    });
    const result = reconcileLearningGraph(before, next),
      freshRecords = localLearningGraph(result, fresh.id).filter(
        (record) => record.kind === 'interpretation',
      );
    expect(
      freshRecords.find(
        (record) => record.kind === 'interpretation' && record.claim === plan.hypotheses[0].claim,
      ),
    ).toMatchObject({ version: 1, status: 'plausible' });
    expect(
      localLearningGraph(result, before.lessons[0].id).find(
        (record) =>
          record.kind === 'interpretation' && record.claim === 'Provisional explanation one',
      ),
    ).toMatchObject({ version: 2, status: 'weakened' });
  });
});

describe('graph stale and malformed lineage cases', () => {
  it('rejects cyclic and foreign/missing predecessors without mutating the original', () => {
    for (const parent of ['missing', 'foreign', 'cycle']) {
      const state = graphFixture(),
        snapshot = structuredClone(state);
      if (parent === 'cycle') state.investigations![0].supersedesId = state.investigations![0].id;
      else {
        state.investigations![0].supersedesId = parent;
        if (parent === 'foreign')
          state.investigations!.push({
            ...snapshot.investigations![0],
            id: 'foreign',
            courseId: 'other-course',
          });
      }
      expect(() => reconcileLearningGraph({ ...state, investigations: [] }, state)).toThrow(
        /lineage|predecessor/i,
      );
      expect(state.learningGraph).toBeUndefined();
    }
  });
  it('does not attach a previous activity version to a replacement with the same ID', () => {
    const raw = graphFixture(),
      before = reconcileLearningGraph({ ...raw, investigations: [] }, raw),
      next = structuredClone(before);
    next.lessons[0].version++;
    expect(localLearningGraph(next, next.lessons[0].id)).toEqual([]);
    expect(next.learningGraph).toEqual(before.learningGraph);
  });
});
