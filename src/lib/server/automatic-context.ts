import type { WorkspaceState } from '../domain/types';

/** Model input for unattended work may contain only explicitly selected source versions.
 * This is a transient view, never a replacement persisted workspace. Explicit user requests
 * keep their separate selected-material authority; legacy administrative previews are excluded. */
export function automaticModelContext(state: WorkspaceState): WorkspaceState {
  const sources = state.sources.filter(source => source.status === 'current' && source.provenance?.automaticPreparation === true && !state.sources.some(newer => newer.id === source.id && newer.version > source.version));
  const allowed = (id: string, version?: number) => sources.some(source => source.id === id && (version === undefined || source.version === version));
  const lessons = state.lessons.filter(lesson => lesson.sourceIds.length > 0 && lesson.sourceIds.every(id => allowed(id, lesson.sourceVersions[id])) && (lesson.supportingPassages ?? []).every(ref => allowed(ref.sourceId, ref.version)));
  const lessonIds = new Set(lessons.map(lesson => lesson.id));
  return { ...state, sources, lessons,
    attempts: state.attempts.filter(attempt => lessonIds.has(attempt.lessonId)),
    investigations: state.investigations?.filter(record => record.sourceRefs.every(ref => allowed(ref.sourceId, ref.version)) && (!record.diagnosticPlan || record.diagnosticPlan.hypotheses.every(hypothesis => hypothesis.evidence.every(ref => allowed(ref.sourceId, ref.version))))),
    ...(state.recommendedLessonId && !lessonIds.has(state.recommendedLessonId) ? { recommendedLessonId: undefined } : {}),
  };
}
