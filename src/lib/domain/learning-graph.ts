import type { SourceRef, WorkspaceState, SomaInvestigation } from './types';

export type GraphReference = { kind: 'concept' | 'interpretation' | 'source' | 'attempt' | 'activity'; id: string; version: number };
type GraphBase = { id: string; version: number; workspaceId: string; courseId: string; createdAt: string; sourceRefs: SourceRef[]; supersedes?: { id: string; version: number } };
export type LearningGraphRecord = GraphBase & (
  | { kind: 'concept'; objective: string; definition: string }
  | { kind: 'interpretation'; conceptId: string; claim: string; status: 'plausible' | 'weakened' | 'supported' | 'unresolved'; uncertainty: string; investigationId: string; diagnosticInvestigationId?: string; hypothesisId?: string; observationIds: string[] }
  | { kind: 'relationship'; relation: 'grounds' | 'targets' | 'tests' | 'observed-in'; from: GraphReference; to: GraphReference; uncertainty: 'source-supported' | 'provisional' }
);
// Stable browser/server identity; exact payload comparison rejects an accidental collision.
function key(...parts: string[]) {
  const text = JSON.stringify(parts); let a = 2166136261, b = 3335557771;
  for (const char of text) { a = Math.imul(a ^ char.charCodeAt(0), 16777619); b = Math.imul(b ^ char.charCodeAt(0), 2246822519); }
  return `${(a >>> 0).toString(16)}${(b >>> 0).toString(16)}`;
}
function sourceExists(state: WorkspaceState, courseId: string, ref: SourceRef, current: boolean) {
  const same = state.sources.filter(source => source.id === ref.sourceId);
  return Number.isSafeInteger(ref.version) && ref.version > 0 && same.some(source => source.courseId === courseId && source.version === ref.version && (!current || source.status === 'current')) && same.every(source => source.courseId === courseId && (!current || source.version <= ref.version));
}
export function graphRecordCurrent(state: WorkspaceState, record: LearningGraphRecord) {
  return (record.kind !== 'interpretation' || state.investigations?.some(item => item.id === record.investigationId && item.workspaceId === state.id)) && record.workspaceId === state.id && state.courses.some(course => course.id === record.courseId) && record.sourceRefs.length > 0 && record.sourceRefs.every(ref => sourceExists(state, record.courseId, ref, true));
}
function lineage(state: WorkspaceState, record: SomaInvestigation): SomaInvestigation {
  const seen = new Set<string>(); let cursor = record;
  while (cursor.supersedesId) {
    if (seen.has(cursor.id)) throw new Error('Cyclic investigation lineage.'); seen.add(cursor.id);
    const parent = state.investigations?.find(item => item.id === cursor.supersedesId && item.courseId === record.courseId && item.workspaceId === state.id);
    if (!parent) throw new Error('Graph interpretation predecessor is unavailable in this course.'); cursor = parent;
  }
  return cursor;
}
/** Persisted projection of validated records, never a model-writable graph editor. History is append-only.
 * Canonical sources, attempts and activities retain observations; graph links never infer mastery. */
export function reconcileLearningGraph(before: WorkspaceState, next: WorkspaceState): WorkspaceState {
  const existing = before.learningGraph ?? [];
  const supplied = next.learningGraph ?? existing;
  for (const old of existing) if (!supplied.some(record => record.id === old.id && record.version === old.version && JSON.stringify(record) === JSON.stringify(old))) throw new Error('Learning graph history is immutable.');
  // Only this projector may introduce graph records; callers cannot forge concept/learner facts.
  if (supplied.length !== existing.length) throw new Error('Learning graph records are application-owned.');
  for (const record of existing) if (record.kind === 'interpretation') {
    const original = before.investigations?.find(item => item.id === record.investigationId);
    const retained = next.investigations?.find(item => item.id === record.investigationId);
    // Reset may remove canonical history; retained records cannot be rewritten.
    if (original && retained && JSON.stringify(original) !== JSON.stringify(retained)) throw new Error('Graph investigation observations are immutable.');
    for (const id of record.observationIds) {
      const originalAttempt = before.attempts.find(item => item.id === id), retainedAttempt = next.attempts.find(item => item.id === id);
      if (originalAttempt && retainedAttempt && JSON.stringify(originalAttempt) !== JSON.stringify(retainedAttempt)) throw new Error('Graph response observations are immutable.');
    }
  }
  const records = structuredClone(existing);
  const add = (record: LearningGraphRecord) => {
    const old = records.find(item => item.id === record.id && item.version === record.version);
    if (old) { if (JSON.stringify(old) !== JSON.stringify(record)) throw new Error('Graph identity collision or rewritten evidence.'); return; }
    if (record.workspaceId !== next.id || !next.courses.some(course => course.id === record.courseId) || !record.sourceRefs.length || record.sourceRefs.some(ref => !sourceExists(next, record.courseId, ref, false))) throw new Error('Graph evidence is outside this workspace and course.');
    records.push(record);
  };
  for (const investigation of [...(next.investigations ?? [])].sort((a,b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))) {
    if (records.some(record => record.kind === 'interpretation' && record.investigationId === investigation.id)) continue;
    const previous = before.investigations?.find(item => item.id === investigation.id);
    if (!previous && investigation.sourceRefs.some(ref => !sourceExists(next, investigation.courseId, ref, true))) throw new Error('New graph investigation has stale evidence.');
    const root = lineage(next, investigation);
    const nearestDiagnostic = (record: SomaInvestigation): SomaInvestigation => {
      let cursor = record;
      while (!cursor.diagnosticPlan && cursor.supersedesId) cursor = next.investigations!.find(item => item.id === cursor.supersedesId)!;
      return cursor;
    };
    const parent = investigation.supersedesId ? next.investigations!.find(item => item.id === investigation.supersedesId)! : undefined;
    const previousDiagnostic = parent && nearestDiagnostic(parent);
    // One publication can revise the previous diagnostic and introduce another one.
    // Those are separate claims, even when the model reuses local hypothesis IDs.
    const stages = investigation.diagnosticPlan && previousDiagnostic?.diagnosticPlan
      ? [{ diagnostic: previousDiagnostic, applyRevisions: true }, { diagnostic: investigation, applyRevisions: false }]
      : [{ diagnostic: nearestDiagnostic(investigation), applyRevisions: true }];
    for (const { diagnostic: diagnosticAncestor, applyRevisions } of stages) {
      const plan = diagnosticAncestor.diagnosticPlan;
      const lessonId = diagnosticAncestor.diagnosticLessonId;
      if (!plan || !lessonId) continue;
      for (const hypothesis of plan.hypotheses) for (const evidence of hypothesis.evidence) if (!next.sources.some(source => source.id === evidence.sourceId && source.version === evidence.version && source.courseId === investigation.courseId && source.body.includes(evidence.quote))) throw new Error('Graph explanation needs exact source evidence.');
      if (investigation.workspaceId !== next.id || plan.courseId !== investigation.courseId) throw new Error('Graph investigation is outside this workspace and course.');
      const lesson = next.lessons.find(item => item.id === lessonId && item.courseId === investigation.courseId);
      if (!lesson) throw new Error('Graph diagnostic activity is unavailable.');
      const conceptId = `concept-${key(next.id, lesson.courseId, lesson.objective.normalize('NFKC').trim().toLowerCase())}`;
      const refs = Object.entries(lesson.sourceVersions).map(([sourceId, version]) => ({ sourceId, version }));
      if (!lesson.sourceIds.length || lesson.sourceIds.some(id => !Number.isSafeInteger(lesson.sourceVersions[id])) || refs.some(ref => !sourceExists(next, lesson.courseId, ref, false))) throw new Error('Graph activity needs exact same-course source versions.');
      const base = { workspaceId: next.id, courseId: lesson.courseId, createdAt: root.createdAt, sourceRefs: refs };
      const priorConcept = records.filter(item => item.kind === 'concept' && item.id === conceptId).sort((a,b) => b.version-a.version)[0];
      let concept = priorConcept;
      // Reopening old publications never rolls current concept evidence back to an old source.
      if (!concept || (refs.some(ref => !concept!.sourceRefs.some(old => old.sourceId === ref.sourceId && old.version === ref.version)) && refs.every(ref => sourceExists(next, lesson.courseId, ref, true)))) {
        concept = { ...base, id: conceptId, version: (priorConcept?.version ?? 0) + 1, kind: 'concept', objective: lesson.objective, definition: lesson.description, ...(priorConcept ? { supersedes: { id: priorConcept.id, version: priorConcept.version } } : {}) }; add(concept);
      }
      const conceptRef: GraphReference = { kind: 'concept', id: conceptId, version: concept.version };
      const relation = (name: 'grounds' | 'targets' | 'tests' | 'observed-in', from: GraphReference, to: GraphReference, uncertainty: 'source-supported' | 'provisional', at = base.createdAt) => add({ ...base, createdAt: at, id: `link-${key(next.id, lesson.courseId, name, JSON.stringify(from), JSON.stringify(to))}`, version: 1, kind: 'relationship', relation: name, from, to, uncertainty });
      for (const ref of refs) relation('grounds', { kind: 'source', id: ref.sourceId, version: ref.version }, conceptRef, 'source-supported');
      relation('targets', { kind: 'activity', id: lesson.id, version: lesson.version }, conceptRef, 'source-supported');
      for (const hypothesis of plan.hypotheses) {
        const revision = applyRevisions ? investigation.hypothesisRevisions?.find(item => item.hypothesisId === hypothesis.id) : undefined;
        const diagnosticParent = diagnosticAncestor.supersedesId ? next.investigations!.find(item => item.id === diagnosticAncestor.supersedesId)! : undefined;
        const scope = diagnosticParent && nearestDiagnostic(diagnosticParent).diagnosticPlan ? diagnosticAncestor.id : root.id;
        const interpretationId = `interpretation-${key(next.id, lesson.courseId, scope, hypothesis.id)}`;
        const previousInterpretation = records.filter(record => record.kind === 'interpretation' && record.id === interpretationId).sort((a,b) => b.version - a.version)[0];
        const retained = previousInterpretation?.kind === 'interpretation' ? previousInterpretation : undefined;
        const observationIds = [...new Set([...(retained?.observationIds ?? []), ...hypothesis.attemptIds, ...(investigation.attemptIds ?? [])])];
        for (const id of observationIds) if (!next.attempts.some(attempt => attempt.id === id && next.lessons.some(item => item.id === attempt.lessonId && item.courseId === lesson.courseId && item.version === attempt.lessonVersion))) throw new Error('Graph observation is outside this course.');
        const generation = (previousInterpretation?.version ?? 0) + 1;
        const interpretation: LearningGraphRecord = { ...base, sourceRefs: hypothesis.evidence.map(({sourceId, version}) => ({sourceId, version})), id: interpretationId, version: generation, kind: 'interpretation', conceptId, claim: hypothesis.claim, status: revision?.status ?? retained?.status ?? hypothesis.status, uncertainty: revision?.reason ?? retained?.uncertainty ?? 'Provisional explanation; a single response cannot establish a diagnosis or broad understanding.', investigationId: investigation.id, diagnosticInvestigationId: diagnosticAncestor.id, hypothesisId: hypothesis.id, observationIds, createdAt: investigation.createdAt, ...(generation > 1 ? { supersedes: { id: interpretationId, version: generation - 1 } } : {}) };
        add(interpretation);
        relation('tests', { kind: 'activity', id: lesson.id, version: lesson.version }, { kind: 'interpretation', id: interpretation.id, version: interpretation.version }, 'provisional', investigation.createdAt);
        for (const id of observationIds) {
          const attempt = next.attempts.find(item => item.id === id)!;
          relation('observed-in', { kind: 'interpretation', id: interpretation.id, version: interpretation.version }, { kind: 'attempt', id, version: attempt.lessonVersion }, 'provisional', investigation.createdAt);
        }
      }
    }
  }
  return records.length ? { ...next, learningGraph: records } : next;
}
/** Current local connections; historical interpretation versions remain inspectable separately. */
export function localLearningGraph(state: WorkspaceState, lessonId: string) {
  const lesson = state.lessons.find(item => item.id === lessonId);
  if (!lesson) return [];
  const records = state.learningGraph ?? [];
  const candidates = records.filter(record => record.courseId === lesson.courseId && graphRecordCurrent(state, record) && !records.some(newer => newer.id === record.id && newer.version > record.version));
  const referenceExists = (ref: GraphReference) => ref.kind === 'source' ? sourceExists(state, lesson.courseId, {sourceId:ref.id,version:ref.version}, true)
    : ref.kind === 'activity' ? state.lessons.some(item => item.id === ref.id && item.version === ref.version && item.courseId === lesson.courseId && item.state === 'ready')
    : ref.kind === 'attempt' ? state.attempts.some(item => item.id === ref.id && item.lessonVersion === ref.version)
    : candidates.some(item => item.kind === ref.kind && item.id === ref.id && item.version === ref.version);
  const current = candidates.filter(record => record.kind !== 'relationship' || (referenceExists(record.from) && referenceExists(record.to)));
  const conceptIds = new Set(current.filter(record => record.kind === 'relationship' && record.relation === 'targets' && record.from.id === lessonId && record.from.version === lesson.version).map(record => record.kind === 'relationship' ? record.to.id : ''));
  const interpretationIds = new Set(current.filter(record => record.kind === 'relationship' && record.relation === 'tests' && record.from.id === lessonId && record.from.version === lesson.version).map(record => record.kind === 'relationship' ? record.to.id : ''));
  return current.filter(record => record.kind === 'concept' ? conceptIds.has(record.id) : record.kind === 'interpretation' ? interpretationIds.has(record.id) : [record.from,record.to].some(ref => ref.id === lessonId || conceptIds.has(ref.id) || interpretationIds.has(ref.id)));
}
