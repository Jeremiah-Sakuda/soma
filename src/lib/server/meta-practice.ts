import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Lesson, Source, WorkspaceState } from '../domain/types';

export const PRACTICE_MODEL_VERSION = 'practice-v1-development';
const text = (min: number, max: number) => z.string().trim().min(min).max(max);
export const practiceProposalSchema = z.strictObject({
  sourceIds: z.array(text(1, 128)).min(1).max(4),
  evidence: z.array(z.strictObject({ sourceId: text(1, 128), quote: z.string().min(20).max(500) })).min(1).max(4),
  title: text(5, 120), objective: text(10, 400), reason: text(10, 500),
  question: text(15, 1000), options: z.array(text(1, 400)).min(3).max(4),
  answerIndex: z.number().int().min(0).max(3), explanation: text(20, 1200), hint: text(5, 500),
}).superRefine((plan, context) => {
  if (new Set(plan.sourceIds).size !== plan.sourceIds.length) context.addIssue({ code: 'custom', message: 'Cite each source once.' });
  const options = plan.options.map(option => option.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase());
  if (new Set(options).size !== options.length) context.addIssue({ code: 'custom', message: 'Answer options must be distinct.' });
  if (plan.answerIndex >= plan.options.length) context.addIssue({ code: 'custom', message: 'Answer index must reference an offered option.' });
});
export type PracticeProposal = z.infer<typeof practiceProposalSchema>;
export type ReadPracticeSource = { version: number; body: string };
export type ValidatedPractice = { plan: PracticeProposal; sourceVersions: Record<string, number> };

/** This tool proposes text only. It has no executable content, score, review, or evidence-write capability. */
export const practiceTool = {
  type: 'function', name: 'prepare_practice',
  description: 'Propose one ordinary text practice question grounded in course sources already read. Include an exact quote from each cited source. No interactive model, executable code, mastery claim, exam eligibility, or learner-evidence changes. Generated answers remain subject to human review.',
  strict: true,
  parameters: {
    type: 'object', properties: {
      sourceIds: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'string', maxLength: 128 } },
      evidence: { type: 'array', minItems: 1, maxItems: 4, items: { type: 'object', properties: { sourceId: { type: 'string', maxLength: 128 }, quote: { type: 'string', minLength: 20, maxLength: 500 } }, required: ['sourceId', 'quote'], additionalProperties: false } },
      title: { type: 'string', minLength: 5, maxLength: 120 }, objective: { type: 'string', minLength: 10, maxLength: 400 }, reason: { type: 'string', minLength: 10, maxLength: 500 },
      question: { type: 'string', minLength: 15, maxLength: 1000 }, options: { type: 'array', minItems: 3, maxItems: 4, items: { type: 'string', minLength: 1, maxLength: 400 } },
      answerIndex: { type: 'integer', minimum: 0, maximum: 3 }, explanation: { type: 'string', minLength: 20, maxLength: 1200 }, hint: { type: 'string', minLength: 5, maxLength: 500 },
    }, required: ['sourceIds', 'evidence', 'title', 'objective', 'reason', 'question', 'options', 'answerIndex', 'explanation', 'hint'], additionalProperties: false,
  },
} as const;

function currentSource(state: WorkspaceState, courseId: string, id: string): Source {
  const versions = state.sources.filter(source => source.id === id);
  const current = versions.filter(source => source.courseId === courseId && source.status === 'current');
  if (current.length !== 1 || versions.some(source => source.courseId !== courseId) || current[0].version !== Math.max(...versions.map(source => source.version))) throw new Error('Practice needs an unambiguous current source from this course.');
  return current[0];
}
export function validatePracticeProposal(raw: unknown, state: WorkspaceState, courseId: string, readIds: ReadonlySet<string>, readSources?: ReadonlyMap<string, ReadPracticeSource>): ValidatedPractice {
  const plan = practiceProposalSchema.parse(raw);
  if (!state.courses.some(course => course.id === courseId)) throw new Error('Practice course is outside this workspace.');
  const sourceVersions: Record<string, number> = {};
  for (const id of plan.sourceIds) {
    if (!readIds.has(id)) throw new Error('Practice sources must be read before they are cited.');
    const source = currentSource(state, courseId, id);
    const disclosed = readSources?.get(id) ?? (!readSources ? { version: source.version, body: source.body.slice(0, 4000) } : undefined);
    if (!disclosed || disclosed.version !== source.version || !disclosed.body || disclosed.body.length > 4000 || !source.body.slice(0, 4000).includes(disclosed.body)) throw new Error('Practice source version or disclosed read segment changed.');
    const evidence = plan.evidence.filter(passage => passage.sourceId === id);
    if (evidence.length !== 1 || !disclosed.body.includes(evidence[0].quote)) throw new Error('Each cited source needs one exact quote from its disclosed read segment.');
    sourceVersions[id] = source.version;
  }
  if (plan.evidence.some(passage => !plan.sourceIds.includes(passage.sourceId))) throw new Error('Supporting passages must belong to cited course sources.');
  return { plan, sourceVersions };
}

/** Text is rendered by the existing practice component, never compiled, evaluated, or used as tool instructions. */
export function instantiatePractice(state: WorkspaceState, courseId: string, validated: ValidatedPractice): Lesson {
  const { plan, sourceVersions } = validatePracticeProposal(validated.plan, state, courseId, new Set(validated.plan.sourceIds));
  for (const id of plan.sourceIds) if (sourceVersions[id] !== validated.sourceVersions[id]) throw new Error('Practice source changed before construction.');
  return {
    id: `practice-${randomUUID()}`, courseId, title: plan.title,
    description: 'Spark prepared this text practice from the cited course passages. Answer correctness and instructional fit still need human review.',
    objective: plan.objective, reason: plan.reason, duration: 8, kind: 'practice',
    // Required by the shared Lesson shape; the practice renderer does not expose or execute a quantitative model.
    circuit: { topology: 'series', voltage: 1, r1: 1, r2: 1 },
    sourceIds: [...plan.sourceIds], sourceVersions, modelVersion: PRACTICE_MODEL_VERSION, version: 1,
    state: 'ready', examEligible: false, mode: 'live', question: plan.question, options: [...plan.options],
    answerIndex: plan.answerIndex, explanation: plan.explanation, hint: plan.hint,
    validation: { status: 'development-preview', modelVersion: PRACTICE_MODEL_VERSION },
    supportingPassages: plan.evidence.map(passage => ({ ...passage, version: sourceVersions[passage.sourceId] })),
  };
}

/** Observations only: ratings, completion and exploration are not inferred as mastery. */
export function learnerPracticeContext(state: WorkspaceState, courseId: string) {
  const courseLessons = new Set(state.lessons.filter(lesson => lesson.courseId === courseId).map(lesson => lesson.id));
  return {
    evidencePolicy: 'These are prior observations, not a mastery diagnosis. Assisted, repeated and visible-lab responses are not independent understanding. Never rewrite original attempts.',
    preferences: { sessionMinutes: state.preferences.sessionMinutes, workedExamples: state.preferences.workedExamples },
    attempts: state.attempts.filter(attempt => courseLessons.has(attempt.lessonId)).slice(-6).map(attempt => ({
      id: attempt.id, lessonId: attempt.lessonId, lessonVersion: attempt.lessonVersion, modelVersion: attempt.modelVersion,
      question: attempt.question.slice(0, 300), response: attempt.response.slice(0, 300), correct: attempt.correct,
      assisted: attempt.assisted, assistance: attempt.assistance.slice(0, 8).map(item => item.slice(0, 100)),
      novel: attempt.novel, exposure: attempt.exposure ?? 'unknown', revisionOf: attempt.revisionOf ?? null,
      createdAt: attempt.createdAt, sourceVersions: Object.fromEntries(Object.entries(attempt.sourceVersions ?? {}).filter(([id]) => state.sources.some(source => source.id === id && source.courseId === courseId)).slice(0, 4)),
    })),
  };
}
