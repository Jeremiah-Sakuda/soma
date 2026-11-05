import { describe, expect, it } from 'vitest';
import {
  graphRecordCurrent,
  localLearningGraph,
  reconcileLearningGraph,
} from '../../src/lib/domain/learning-graph';
import type { WorkspaceState } from '../../src/lib/domain/types';
import { graphFixture } from '../helpers/learning-graph';
describe('durable local learning graph', () => {
  it('connects source, concept, provisional interpretations and activity with stable retry identities', () => {
    const state = graphFixture(),
      graph = reconcileLearningGraph({ ...state, investigations: [] }, state);
    expect(graph.learningGraph?.filter((record) => record.kind === 'concept')).toHaveLength(1);
    expect(graph.learningGraph?.filter((record) => record.kind === 'interpretation')).toHaveLength(
      2,
    );
    expect(localLearningGraph(graph, state.lessons[0].id).length).toBeGreaterThan(4);
    expect(reconcileLearningGraph(graph, structuredClone(graph))).toEqual(graph);
    expect(state.learningGraph).toBeUndefined();
  });
  it('retains the original interpretation and saved response when a new version weakens it', () => {
    const state = graphFixture(),
      original = reconcileLearningGraph({ ...state, investigations: [] }, state),
      next = structuredClone(original),
      lesson = state.lessons[0];
    next.attempts.push({
      id: 'response-original',
      lessonId: lesson.id,
      lessonVersion: lesson.version,
      modelVersion: lesson.modelVersion,
      question: lesson.question,
      response: lesson.options[0],
      correct: null,
      assisted: true,
      assistance: ['explanation'],
      createdAt: '2026-10-27T12:01:00Z',
      novel: false,
      feedback: 'Synthetic response',
      sourceVersions: lesson.sourceVersions,
    });
    next.investigations!.unshift({
      ...state.investigations![0],
      id: 'investigation-revision',
      supersedesId: 'investigation-original',
      createdAt: '2026-10-27T12:02:00Z',
      diagnosticPlan: undefined,
      diagnosticLessonId: undefined,
      attemptIds: ['response-original'],
      hypothesisRevisions: [
        {
          hypothesisId: 'one',
          status: 'weakened',
          reason: 'Saved response contradicted this provisional prediction.',
        },
      ],
    });
    const revised = reconcileLearningGraph(original, next);
    expect(
      revised.learningGraph?.filter((record) => record.kind === 'interpretation'),
    ).toHaveLength(4);
    expect(
      revised.learningGraph?.find(
        (record) =>
          record.kind === 'interpretation' && record.version === 2 && record.status === 'weakened',
      ),
    ).toBeDefined();
    expect(revised.attempts.at(-1)).toEqual(next.attempts.at(-1));
    expect(revised.learningGraph?.slice(0, original.learningGraph!.length)).toEqual(
      original.learningGraph,
    );
    expect(
      localLearningGraph(revised, lesson.id)
        .filter((record) => record.kind === 'interpretation')
        .every((record) => record.version === 2),
    ).toBe(true);
  });
  it('starts a newly introduced hypothesis at version one without inventing a predecessor', () => {
    const state = graphFixture(),
      original = reconcileLearningGraph({ ...state, investigations: [] }, state),
      next = structuredClone(original);
    const revised = structuredClone(state.investigations![0]);
    revised.id = 'new-explanation';
    revised.supersedesId = state.investigations![0].id;
    revised.createdAt = '2026-10-27T12:02:00Z';
    revised.diagnosticPlan!.hypotheses[0].id = 'new-hypothesis';
    next.investigations!.push(revised);
    const graph = reconcileLearningGraph(original, next),
      fresh = graph.learningGraph!.find(
        (record) =>
          record.kind === 'interpretation' &&
          record.investigationId === 'new-explanation' &&
          record.hypothesisId === 'new-hypothesis',
      )!;
    expect(fresh.version).toBe(1);
    expect(fresh.supersedes).toBeUndefined();
  });
  it('finds the nearest diagnostic after an earlier source-only investigation', () => {
    const state = graphFixture(),
      diagnostic = state.investigations![0];
    const sourceOnly = {
      ...diagnostic,
      id: 'source-only',
      createdAt: '2026-10-27T11:59:00Z',
      diagnosticPlan: undefined,
      diagnosticLessonId: undefined,
    };
    diagnostic.supersedesId = sourceOnly.id;
    state.investigations!.unshift(sourceOnly);
    const original = reconcileLearningGraph({ ...state, investigations: [] }, state),
      next = structuredClone(original);
    next.investigations!.push({
      ...diagnostic,
      id: 'later-revision',
      supersedesId: diagnostic.id,
      createdAt: '2026-10-27T12:02:00Z',
      diagnosticPlan: undefined,
      diagnosticLessonId: undefined,
      hypothesisRevisions: [
        {
          hypothesisId: 'one',
          status: 'weakened',
          reason: 'The evidence now weakens this provisional explanation.',
        },
      ],
    });
    expect(
      reconcileLearningGraph(original, next).learningGraph!.filter(
        (record) => record.kind === 'interpretation',
      ),
    ).toHaveLength(4);
  });
  it('keeps history but removes stale local connections after source revision', () => {
    const state = graphFixture(),
      original = reconcileLearningGraph({ ...state, investigations: [] }, state),
      next = structuredClone(original),
      source = next.sources.find((item) => item.id === next.lessons[0].sourceIds[0])!;
    source.status = 'stale';
    next.sources.push({ ...source, version: source.version + 1, status: 'current' });
    const stale = reconcileLearningGraph(original, next);
    expect(stale.learningGraph).toEqual(original.learningGraph);
    expect(localLearningGraph(stale, next.lessons[0].id)).toEqual([]);
    expect(stale.learningGraph!.some((record) => graphRecordCurrent(stale, record))).toBe(false);
  });
  it('rejects forged graph edits, foreign workspaces, cross-course citations and unversioned activities', () => {
    const state = graphFixture(),
      graph = reconcileLearningGraph({ ...state, investigations: [] }, state),
      edited = structuredClone(graph);
    edited.learningGraph![0].courseId = 'foreign';
    expect(() => reconcileLearningGraph(graph, edited)).toThrow('immutable');
    for (const mutate of [
      (value: WorkspaceState) => {
        value.investigations![0].workspaceId = 'foreign';
      },
      (value: WorkspaceState) => {
        value.sources.find((source) => source.id === value.lessons[0].sourceIds[0])!.courseId =
          'foreign';
      },
      (value: WorkspaceState) => {
        value.lessons[0].sourceVersions = {};
      },
    ]) {
      const next = structuredClone(state);
      mutate(next);
      expect(() => reconcileLearningGraph({ ...state, investigations: [] }, next)).toThrow();
    }
  });
});
