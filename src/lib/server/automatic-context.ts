import type { WorkspaceState } from '../domain/types';

/** Model input for unattended work may contain only explicitly selected source versions.
 * This is a transient view, never a replacement persisted workspace. Explicit user requests
 * keep their separate selected-material authority; legacy administrative previews are excluded. */
export function automaticModelContext(state: WorkspaceState): WorkspaceState {
  const sources = state.sources.filter(
    (source) =>
      source.status === 'current' &&
      source.provenance?.automaticPreparation === true &&
      !state.sources.some((newer) => newer.id === source.id && newer.version > source.version),
  );
  const allowed = (id: string, version?: number) =>
    Number.isSafeInteger(version) &&
    sources.some((source) => source.id === id && source.version === version);
  const lessons = state.lessons.filter(
    (lesson) =>
      lesson.sourceIds.length > 0 &&
      lesson.sourceIds.every((id) => allowed(id, lesson.sourceVersions[id])) &&
      (lesson.supportingPassages ?? []).every((ref) => allowed(ref.sourceId, ref.version)),
  );
  const lessonIds = new Set(lessons.map((lesson) => lesson.id));
  const attempts = state.attempts.filter((attempt) => {
    const lesson = lessons.find((item) => item.id === attempt.lessonId);
    const versions = Object.entries(attempt.sourceVersions ?? {});
    return (
      lessonIds.has(attempt.lessonId) &&
      lesson?.version === attempt.lessonVersion &&
      lesson.modelVersion === attempt.modelVersion &&
      versions.length > 0 &&
      versions.every(([id, version]) => allowed(id, version))
    );
  });
  const attemptIds = new Set(attempts.map((attempt) => attempt.id));
  const investigations = state.investigations?.filter(
    (record) =>
      record.sourceRefs.every((ref) => allowed(ref.sourceId, ref.version)) &&
      (record.attemptIds ?? []).every((id) => attemptIds.has(id)) &&
      (!record.diagnosticPlan ||
        record.diagnosticPlan.hypotheses.every(
          (hypothesis) =>
            hypothesis.evidence.every((ref) => allowed(ref.sourceId, ref.version)) &&
            hypothesis.attemptIds.every((id) => attemptIds.has(id)),
        )),
  );
  const investigationIds = new Set(investigations?.map((record) => record.id));
  const candidates = (state.learningGraph ?? []).filter(
    (record) =>
      record.workspaceId === state.id &&
      record.sourceRefs.length > 0 &&
      record.sourceRefs.every((ref) => allowed(ref.sourceId, ref.version)),
  );
  const conceptIds = new Set(
    candidates
      .filter(
        (record) =>
          record.kind === 'relationship' &&
          record.relation === 'targets' &&
          record.from.kind === 'activity' &&
          lessons.some(
            (lesson) => lesson.id === record.from.id && lesson.version === record.from.version,
          ),
      )
      .map((record) => (record.kind === 'relationship' ? record.to.id : '')),
  );
  const interpretations = candidates.filter(
    (record) =>
      record.kind === 'interpretation' &&
      conceptIds.has(record.conceptId) &&
      investigationIds.has(record.investigationId) &&
      record.observationIds.every((id) => attemptIds.has(id)),
  );
  const interpretationIds = new Set(interpretations.map((record) => record.id));
  const referenceAllowed = (ref: import('../domain/learning-graph').GraphReference) =>
    ref.kind === 'source'
      ? allowed(ref.id, ref.version)
      : ref.kind === 'activity'
        ? lessons.some((lesson) => lesson.id === ref.id && lesson.version === ref.version)
        : ref.kind === 'attempt'
          ? attemptIds.has(ref.id)
          : ref.kind === 'interpretation'
            ? interpretationIds.has(ref.id)
            : conceptIds.has(ref.id);
  return {
    ...state,
    sources,
    lessons,
    attempts,
    investigations,
    learningGraph: state.learningGraph
      ? candidates.filter((record) =>
          record.kind === 'concept'
            ? conceptIds.has(record.id)
            : record.kind === 'interpretation'
              ? interpretationIds.has(record.id)
              : referenceAllowed(record.from) && referenceAllowed(record.to),
        )
      : undefined,
    ...(state.recommendedLessonId && !lessonIds.has(state.recommendedLessonId)
      ? { recommendedLessonId: undefined }
      : {}),
  };
}
