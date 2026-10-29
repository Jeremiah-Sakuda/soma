import { seedWorkspace } from '../../src/lib/domain/seed';
import type { WorkspaceState } from '../../src/lib/domain/types';
export function adaptationFixture(id = 'original-adaptation-fixture'): WorkspaceState {
  const state = seedWorkspace(id); state.mode = 'account';
  const base = state.lessons.find(item => item.courseId === 'probability')!;
  const source = state.sources.find(item => item.id === base.sourceIds[0])!;
  for(const selected of state.sources.filter(item=>base.sourceIds.includes(item.id)))selected.provenance={automaticPreparation:true,origin:'manual-course',sourceKey:`original-selected-${selected.id}`,contentHash:'original-synthetic-consent-fixture',importedAt:state.createdAt};
  const evidence = [{ sourceId: source.id, version: source.version, quote: source.body.slice(0,100) }];
  const lesson = { ...base, id: 'original-adaptive-question', exposure: 'fresh-no-diagram' as const, diagnosticInvestigationId: 'original-adaptation-investigation', question: 'Which interpretation best explains this original synthetic relationship?', options: ['The first relationship applies.', 'The competing relationship applies.', 'The evidence remains uncertain.'], explanation: 'Your response can distinguish provisional explanations; it is not graded.' };
  state.lessons.unshift(lesson);
  state.investigations = [{ id: lesson.diagnosticInvestigationId, workspaceId: id, courseId: base.courseId, createdAt: state.createdAt, mode: 'synthetic', decision: 'revise-session', reason: 'Original synthetic diagnostic prepared for automatic follow-up checks.', sourceRefs: evidence, assessmentId: null, applicability: 'course', conflicts: [], diagnosticLessonId: lesson.id, diagnosticPlan: {
    kind: 'text', experimentRunId: null, courseId: base.courseId, hypotheses: [
      { id: 'first-explanation', claim: 'The learner may use the first relationship.', evidence, attemptIds: [], status: 'plausible' },
      { id: 'second-explanation', claim: 'The learner may use the competing relationship.', evidence, attemptIds: [], status: 'plausible' },
    ], question: lesson.question, options: lesson.options, predictions: [{ hypothesisId: 'first-explanation', predictedOptionIndex: 0 }, { hypothesisId: 'second-explanation', predictedOptionIndex: 1 }], rationale: 'These different choices separate two provisional interpretations.', nextActivity: 'Compare the recorded response with the cited course relationship.'
  } }];
  return state;
}
