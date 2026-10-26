import { z } from 'zod';
import type { Source, SourceRef, WorkspaceState } from './types';

const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const quote = z.string().trim().min(10).max(1000);
const timezone = z.string().min(1).max(80).refine(value => { try { new Intl.DateTimeFormat('en', { timeZone: value }); return true; } catch { return false; } });
const topics = z.array(z.string().trim().max(120)).max(30).transform(items => items.filter(Boolean)).refine(items => new Set(items.map(item => item.toLowerCase())).size === items.length);
export const assessmentRegistrationSchema = z.strictObject({ id, title: z.string().trim().min(1).max(160) });
export const confirmedAcademicFactsSchema = z.strictObject({
  deadline: z.strictObject({ at: z.string().datetime({ offset: true }), timezone, quote }).optional(),
  coverage: z.strictObject({ includedTopics: topics, excludedTopics: topics, quote }).optional(),
});
/** These fields are supplied by the account owner, never inferred from sender/title. */
export const sourceAuthorityContextSchema = z.strictObject({
  role: z.enum(['instructor-update', 'syllabus', 'teaching-material', 'returned-work', 'student-question']),
  assessmentId: id.optional(), applicability: z.enum(['course', 'assessment', 'personal', 'unknown']).optional(),
  publishedAt: z.string().datetime({ offset: true }).optional(),
  supersedes: z.array(z.strictObject({ sourceId: id, version: z.number().int().min(1) })).max(8).optional(),
  changeImpact: z.enum(['content', 'timing-only', 'no-effect']).optional(),
  confirmedFacts: confirmedAcademicFactsSchema.optional(),
});
export type SourceAuthorityContext = z.infer<typeof sourceAuthorityContextSchema>;
export type Assessment = z.infer<typeof assessmentRegistrationSchema> & {
  deadlineAt?: string; timezone?: string; includedTopics?: string[]; excludedTopics?: string[];
  sourceRefs?: SourceRef[]; deadlineSourceRefs?: SourceRef[]; coverageSourceRefs?: SourceRef[]; updatedAt?: string;
};

export function validateSourceContext(state: WorkspaceState, courseId: string | undefined, raw: unknown, body?: string): SourceAuthorityContext | undefined {
  if (raw === undefined) return undefined;
  const value = sourceAuthorityContextSchema.parse(raw);
  const course = state.courses.find(item => item.id === courseId);
  if (!course) throw new Error('Source context requires a course in this workspace.');
  if (value.assessmentId && !course.assessments?.some(item => item.id === value.assessmentId)) throw new Error('Choose a registered assessment in this course.');
  if (value.applicability === 'assessment' && !value.assessmentId) throw new Error('Assessment applicability requires a registered assessment.');
  if (value.assessmentId && value.applicability === 'course') throw new Error('Course-wide context cannot claim an assessment.');
  for (const ref of value.supersedes ?? []) if (!state.sources.some(source => source.id === ref.sourceId && source.version === ref.version && source.courseId === courseId)) throw new Error('Superseded source must be an existing version in this course.');
  if (value.confirmedFacts) {
    if (!value.assessmentId || value.applicability !== 'assessment' || !['syllabus', 'instructor-update'].includes(value.role)) throw new Error('Confirmed academic facts require declared assessment authority.');
    if (body !== undefined) for (const fact of Object.values(value.confirmedFacts)) if (fact && !body.includes(fact.quote)) throw new Error('Confirmed academic facts need exact source passages.');
    const coverage = value.confirmedFacts.coverage;
    if (coverage && coverage.includedTopics.some(topic => coverage.excludedTopics.some(excluded => excluded.toLowerCase() === topic.toLowerCase()))) throw new Error('A topic cannot be both included and excluded.');
  }
  return value;
}

/** Preserve immutable prior lessons, rebasing only an explicitly non-content update with unchanged quoted teaching evidence. */
export function reconcileSourceRefresh(state: WorkspaceState, source: Source, previous?: Source): void {
  for (const lesson of [...state.lessons]) {
    if (!lesson.sourceIds.includes(source.id)) continue;
    if (lesson.sourceVersions[source.id] === source.version) {
      if (lesson.sourceIds.every(id => state.sources.some(item => item.id === id && item.version === lesson.sourceVersions[id] && item.status === 'current' && !state.sources.some(newer => newer.id === id && newer.version > item.version)))) lesson.state = 'ready';
      continue;
    }
    if (!previous || lesson.sourceVersions[source.id] !== previous.version) continue;
    const passages = lesson.supportingPassages?.filter(ref => ref.sourceId === source.id) ?? [];
    const sameScope = previous.context?.role === source.context?.role && previous.context?.assessmentId === source.context?.assessmentId && previous.context?.applicability === source.context?.applicability;
    const reusable = lesson.state === 'ready' && sameScope && ['timing-only', 'no-effect'].includes(source.context?.changeImpact ?? '') && passages.length > 0 && passages.every(ref => ref.version === previous.version && previous.body.includes(ref.quote) && source.body.includes(ref.quote));
    lesson.state = 'stale';
    if (!reusable) continue;
    const nextId = `${lesson.id.slice(0, 70)}-source-v${source.version}-${state.lessons.length}`;
    const replacement = { ...structuredClone(lesson), id: nextId, version: lesson.version + 1, state: 'ready' as const, sourceVersions: { ...lesson.sourceVersions, [source.id]: source.version }, supportingPassages: lesson.supportingPassages?.map(ref => ref.sourceId === source.id ? { ...ref, version: source.version } : ref), parentLessonId: lesson.id };
    // Prediction/diagnostic IDs bind the original item and cannot be silently rebased.
    if (lesson.diagnosticInvestigationId || lesson.predictionId) continue;
    state.lessons.push(replacement);
    if (state.assistance[lesson.id]) state.assistance[replacement.id] = structuredClone(state.assistance[lesson.id]);
    if (state.savedInputs[lesson.id]) state.savedInputs[replacement.id] = structuredClone(state.savedInputs[lesson.id]);
    if (state.recommendedLessonId === lesson.id) state.recommendedLessonId = replacement.id;
    state.consequences ??= [];
    state.consequences.push({ id: `source-rebase-${replacement.id}`, workspaceId: state.id, createdAt: source.retrievedAt, trigger: 'Declared source update', classification: source.context?.changeImpact === 'timing-only' ? 'timing' : 'content', sourceRefs: [{ sourceId: source.id, version: source.version }], affectedIds: [lesson.id, replacement.id], before: { lessonId: lesson.id, sourceVersion: previous.version }, after: { lessonId: replacement.id, sourceVersion: source.version }, reason: 'The owner declared a non-content update and the cited teaching passages are unchanged.', result: 'Teaching activity reused with current source references; original item and attempts retained.' });
  }
}
