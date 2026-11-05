import { seedWorkspace } from '../../src/lib/domain/seed';
import type { WorkspaceState, SomaInvestigation } from '../../src/lib/domain/types';
export function graphFixture(): WorkspaceState {
  const state = seedWorkspace('synthetic-graph', '2026-10-27T12:00:00Z');
  const lesson = state.lessons[0],
    source = state.sources.find((item) => lesson.sourceIds.includes(item.id))!;
  lesson.sourceIds = [source.id];
  lesson.sourceVersions = { [source.id]: source.version };
  lesson.diagnosticInvestigationId = 'investigation-original';
  const hypothesis = (id: string) => ({
    id,
    claim: `Provisional explanation ${id}`,
    status: 'plausible' as const,
    evidence: [{ sourceId: source.id, version: source.version, quote: source.body.slice(0, 30) }],
    attemptIds: [],
  });
  const record: SomaInvestigation = {
    id: 'investigation-original',
    workspaceId: state.id,
    courseId: lesson.courseId,
    createdAt: state.createdAt,
    mode: 'synthetic',
    decision: 'revise-session',
    reason: 'An ambiguous synthetic observation needs investigation.',
    sourceRefs: [{ sourceId: source.id, version: source.version, quote: source.body.slice(0, 30) }],
    assessmentId: null,
    applicability: 'course',
    conflicts: [],
    diagnosticLessonId: lesson.id,
    diagnosticPlan: {
      courseId: lesson.courseId,
      kind: 'text',
      experimentRunId: null,
      hypotheses: [hypothesis('one'), hypothesis('two')],
      question: lesson.question,
      options: lesson.options,
      predictions: [
        { hypothesisId: 'one', predictedOptionIndex: 0 },
        { hypothesisId: 'two', predictedOptionIndex: 1 },
      ],
      rationale: 'Distinguish two provisional explanations.',
      nextActivity: 'Try a different supported condition.',
    },
  };
  state.investigations = [record];
  return state;
}
