import { z } from 'zod';
import type { SourceAuthorityContext } from './source-context';
export { sourceAuthorityContextSchema, validateSourceContext } from './source-context';
export type { SourceAuthorityContext } from './source-context';
import type { Source, SourceRef, WorkspaceState } from './types';

export type SourceEvidenceRef = SourceRef & { quote: string };
/** Owner-declared source context; titles, sender names and recency do not establish authority. */

export type InvestigableSource = Source & {
  context?: SourceAuthorityContext;
  relatedSourceIds?: string[];
};
export type ReadSourceEvidence = {
  version: number;
  body?: string;
  segments?: { offset: number; body: string }[];
};
export type InvestigationReads = ReadonlyMap<string, ReadSourceEvidence>;
const id = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/);
const evidenceSchema = z.strictObject({
  sourceId: id,
  version: z.number().int().min(1),
  quote: z.string().min(10).max(1000),
});
export const academicUpdateSchema = z.strictObject({
  assessmentId: id,
  kind: z.enum(['deadline', 'coverage', 'eligibility']),
  sourceRef: evidenceSchema,
  lessonIds: z.array(id).max(30),
  topic: z.string().trim().max(120),
  eligible: z.boolean(),
});
export type AcademicUpdate = z.infer<typeof academicUpdateSchema>;
export const sourceDecisionSchema = z.strictObject({
  decision: z.enum(['revise-session', 'keep-current', 'needs-evidence']),
  reason: z.string().trim().min(10).max(1200),
  academicUpdates: z.array(academicUpdateSchema).max(8).optional(),
  sourceRefs: z.array(evidenceSchema).min(1).max(8),
  assessmentId: id.nullable(),
  applicability: z.enum(['course', 'assessment', 'unknown']),
  conflicts: z
    .array(
      z.strictObject({
        sourceIds: z.array(id).min(2).max(8),
        reason: z.string().trim().min(10).max(800),
        resolution: z.enum(['unresolved', 'explicit-supersession']),
        preferredSourceId: id.nullable(),
      }),
    )
    .max(8),
});
export type SourceDecision = z.infer<typeof sourceDecisionSchema>;
export type InvestigationRecord = SourceDecision & {
  id: string;
  workspaceId: string;
  courseId: string;
  createdAt: string;
  mode: 'live' | 'synthetic' | 'prepared';
  supersedesId?: string;
  attemptIds?: string[];
};
export type InvestigationWorkspace = WorkspaceState & { investigations?: InvestigationRecord[] };
export const sourceDecisionTool = {
  type: 'function',
  name: 'finish_investigation',
  strict: true,
  description:
    'Propose a source-supported next-session decision. Cite exact disclosed passages for every source. Keep unresolved authority/applicability conflicts explicit; recency alone never resolves them. Academic updates can apply only explicit owner-confirmed typed assessment facts and exact cited evidence; they cannot invent dates, source observations or learner evidence.',
  parameters: {
    type: 'object',
    properties: {
      decision: { type: 'string', enum: ['revise-session', 'keep-current', 'needs-evidence'] },
      reason: { type: 'string', minLength: 10, maxLength: 1200 },
      sourceRefs: {
        type: 'array',
        minItems: 1,
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            sourceId: { type: 'string' },
            version: { type: 'integer', minimum: 1 },
            quote: { type: 'string', minLength: 10, maxLength: 1000 },
          },
          required: ['sourceId', 'version', 'quote'],
          additionalProperties: false,
        },
      },
      assessmentId: { type: ['string', 'null'] },
      applicability: { type: 'string', enum: ['course', 'assessment', 'unknown'] },
      conflicts: {
        type: 'array',
        maxItems: 8,
        items: {
          type: 'object',
          properties: {
            sourceIds: { type: 'array', minItems: 2, maxItems: 8, items: { type: 'string' } },
            reason: { type: 'string', minLength: 10, maxLength: 800 },
            resolution: { type: 'string', enum: ['unresolved', 'explicit-supersession'] },
            preferredSourceId: { type: ['string', 'null'] },
          },
          required: ['sourceIds', 'reason', 'resolution', 'preferredSourceId'],
          additionalProperties: false,
        },
      },
    },
    required: ['decision', 'reason', 'sourceRefs', 'assessmentId', 'applicability', 'conflicts'],
    additionalProperties: false,
  },
} as const;

function sourcesInCourse(state: WorkspaceState, courseId: string): InvestigableSource[] {
  if (!state.courses.some((course) => course.id === courseId))
    throw new Error('Investigation course is outside this workspace.');
  const latest = new Map<string, InvestigableSource>();
  for (const source of state.sources as InvestigableSource[]) {
    if (source.courseId !== courseId) continue;
    const old = latest.get(source.id);
    if (!old || old.version < source.version) latest.set(source.id, source);
    else if (old.version === source.version) throw new Error('Ambiguous source version.');
  }
  return [...latest.values()].filter((source) => source.status === 'current');
}
function currentSource(
  state: WorkspaceState,
  courseId: string,
  sourceId: string,
): InvestigableSource {
  const source = sourcesInCourse(state, courseId).find((item) => item.id === sourceId);
  if (!source || state.sources.some((item) => item.id === sourceId && item.courseId !== courseId))
    throw new Error('Source is unavailable in this course.');
  return source;
}
export function listInvestigationSources(state: WorkspaceState, courseId: string, offset = 0) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('Invalid source-list offset.');
  const sources = sourcesInCourse(state, courseId).sort((a, b) => a.id.localeCompare(b.id));
  return {
    sources: sources.slice(offset, offset + 20).map((source) => ({
      sourceId: source.id,
      version: source.version,
      title: source.title,
      length: source.body.length,
      context: source.context ? structuredClone(source.context) : null,
    })),
    nextOffset: offset + 20 < sources.length ? offset + 20 : null,
  };
}
function disclosedSegments(source: InvestigableSource, reads: InvestigationReads): string[] {
  const read = reads.get(source.id);
  if (!read || read.version !== source.version)
    throw new Error('Source version has not been read.');
  const segments =
    read.segments ?? (read.body !== undefined ? [{ offset: 0, body: read.body }] : []);
  if (!segments.length || segments.length > 32)
    throw new Error('Invalid disclosed source segments.');
  for (const segment of segments)
    if (
      !Number.isSafeInteger(segment.offset) ||
      segment.offset < 0 ||
      segment.body.length > 4000 ||
      !segment.body ||
      source.body.slice(segment.offset, segment.offset + segment.body.length) !== segment.body
    )
      throw new Error('Disclosed source segment does not match this version.');
  return segments.map((segment) => segment.body);
}
function knownLinks(
  state: WorkspaceState,
  courseId: string,
  source: InvestigableSource,
  disclosed: string[],
) {
  const urls = new Set(disclosed.flatMap((body) => body.match(/https:\/\/[^\s<>"'\])]+/g) ?? []));
  return sourcesInCourse(state, courseId)
    .filter(
      (target) =>
        target.id !== source.id &&
        ((source.relatedSourceIds ?? []).includes(target.id) ||
          (target.url && urls.has(target.url))),
    )
    .map((target) => ({ sourceId: target.id, version: target.version, title: target.title }));
}
export function readInvestigationSource(
  state: WorkspaceState,
  courseId: string,
  sourceId: string,
  offset = 0,
) {
  const source = currentSource(state, courseId, sourceId);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > source.body.length)
    throw new Error('Invalid source-read offset.');
  const body = source.body.slice(offset, offset + 4000);
  return {
    sourceId: source.id,
    version: source.version,
    offset,
    body,
    nextOffset: offset + body.length < source.body.length ? offset + body.length : null,
    context: source.context ? structuredClone(source.context) : null,
    links: knownLinks(state, courseId, source, [body]),
  };
}
/** Only registered same-course links are followable. This function never fetches a URL. */
export function followSourceReference(
  state: WorkspaceState,
  courseId: string,
  fromId: string,
  targetId: string,
  reads: InvestigationReads,
) {
  const from = currentSource(state, courseId, fromId);
  const segments = disclosedSegments(from, reads);
  if (!knownLinks(state, courseId, from, segments).some((link) => link.sourceId === targetId))
    throw new Error('Reference was not disclosed or authorized in this course.');
  return readInvestigationSource(state, courseId, targetId);
}

function hasQuotedCorrection(
  preferred: InvestigableSource,
  old: InvestigableSource,
  quote: string,
): boolean {
  if (
    preferred.context?.role !== 'instructor-update' ||
    !['syllabus', 'teaching-material'].includes(old.context?.role ?? '')
  )
    return false;
  // This is only a conservative admissibility check. Semantic fit is still an
  // interpretation, and never changes dates, personal exceptions or exam facts.
  const statement = quote.toLowerCase();
  if (/\b(?:not|never|doesn.t|isn.t|may|might|could|if)\b|\?/.test(statement)) return false;
  return (
    /\b(?:supersedes?|replaces?|corrects?|correction|instead of|no longer)\b/.test(statement) &&
    (statement.includes(old.title.toLowerCase()) ||
      /\b(?:syllabus|previous|earlier|prior)\b/.test(statement))
  );
}

/** Validates reference integrity and declared authority, not semantic truth of model-written prose. */
export function validateInvestigationDecision(
  raw: unknown,
  state: InvestigationWorkspace,
  courseId: string,
  reads: InvestigationReads,
  previous?: InvestigationRecord,
): SourceDecision {
  const plan = sourceDecisionSchema.parse(raw);
  if (new Set(plan.sourceRefs.map((ref) => ref.sourceId)).size !== plan.sourceRefs.length)
    throw new Error('Cite each source once.');
  const cited = new Map<string, InvestigableSource>();
  for (const ref of plan.sourceRefs) {
    const source = currentSource(state, courseId, ref.sourceId);
    if (
      source.version !== ref.version ||
      !disclosedSegments(source, reads).some((segment) => segment.includes(ref.quote))
    )
      throw new Error('Every source needs an exact quote from its disclosed current version.');
    cited.set(source.id, source);
  }
  if (previous) {
    const previousId = previous.id;
    const stored = state.investigations?.find(
      (item) =>
        item.id === previousId && item.workspaceId === state.id && item.courseId === courseId,
    );
    if (!stored || previous.workspaceId !== state.id || previous.courseId !== courseId)
      throw new Error('Previous investigation is outside this workspace and course.');
    previous = stored;
  }
  if (
    plan.applicability !== 'unknown' &&
    [...cited.values()].some((source) =>
      ['personal', 'unknown'].includes(source.context?.applicability ?? ''),
    )
  )
    throw new Error('Personal or unknown applicability must remain needs-evidence.');
  if (plan.applicability === 'assessment') {
    if (
      !plan.assessmentId ||
      ![...cited.values()].every((source) => source.context?.assessmentId === plan.assessmentId) ||
      ![...cited.values()].some((source) =>
        ['instructor-update', 'syllabus'].includes(source.context?.role ?? ''),
      )
    )
      throw new Error('Assessment applicability needs matching declared source authority.');
  } else if (plan.assessmentId !== null)
    throw new Error('Unknown or course-only applicability cannot claim an assessment.');
  if (plan.applicability === 'unknown' && plan.decision === 'revise-session')
    throw new Error('Unknown applicability needs evidence before revising the session.');
  for (const conflict of plan.conflicts) {
    if (
      new Set(conflict.sourceIds).size !== conflict.sourceIds.length ||
      conflict.sourceIds.some((sourceId) => !cited.has(sourceId))
    )
      throw new Error('Every conflicting source must have disclosed supporting evidence.');
    if (conflict.resolution === 'unresolved') {
      if (conflict.preferredSourceId !== null || plan.decision !== 'needs-evidence')
        throw new Error('Unresolved conflicts must remain uncertain.');
      continue;
    }
    const preferred = conflict.preferredSourceId && cited.get(conflict.preferredSourceId);
    if (
      !preferred ||
      !conflict.sourceIds.includes(preferred.id) ||
      !['instructor-update', 'syllabus'].includes(preferred.context?.role ?? '') ||
      !preferred.context?.assessmentId ||
      preferred.context.assessmentId !== plan.assessmentId
    )
      throw new Error('Conflict resolution needs an explicitly applicable authority.');
    for (const sourceId of conflict.sourceIds.filter((value) => value !== preferred.id)) {
      const old = cited.get(sourceId)!;
      const declared = preferred.context.supersedes?.some(
        (ref) => ref.sourceId === old.id && ref.version === old.version,
      );
      const quote = plan.sourceRefs.find((ref) => ref.sourceId === preferred.id)!.quote;
      if (
        old.context?.assessmentId !== preferred.context.assessmentId ||
        (!declared && !hasQuotedCorrection(preferred, old, quote))
      )
        throw new Error(
          'Recency does not supersede a source; explicit declared or quoted correction evidence is required.',
        );
    }
  }
  if (previous && plan.decision !== 'needs-evidence') {
    for (const unresolved of previous.conflicts.filter(
      (conflict) => conflict.resolution === 'unresolved',
    )) {
      if (
        !plan.conflicts.some(
          (conflict) =>
            conflict.resolution === 'explicit-supersession' &&
            unresolved.sourceIds.every((sourceId) => conflict.sourceIds.includes(sourceId)),
        )
      )
        throw new Error('A prior unresolved conflict cannot silently disappear.');
    }
  }
  validateAcademicUpdates(plan, state, courseId, cited, reads);
  return plan;
}

function validateAcademicUpdates(
  plan: SourceDecision,
  state: WorkspaceState,
  courseId: string,
  cited: Map<string, InvestigableSource>,
  reads: InvestigationReads,
) {
  const updates = plan.academicUpdates ?? [];
  if (!updates.length) return;
  if (plan.decision === 'needs-evidence' || plan.applicability !== 'assessment')
    throw new Error('Academic changes require resolved assessment applicability.');
  const course = state.courses.find((item) => item.id === courseId)!;
  const touched = new Set<string>();
  for (const update of updates) {
    const assessment = course.assessments?.find((item) => item.id === update.assessmentId);
    const source = cited.get(update.sourceRef.sourceId);
    const key = `${update.assessmentId}:${update.kind}`;
    if (touched.has(key)) throw new Error('Only one update per assessment field is allowed.');
    touched.add(key);
    if (
      !assessment ||
      plan.assessmentId !== assessment.id ||
      !source ||
      source.version !== update.sourceRef.version ||
      !disclosedSegments(source, reads).some((segment) => segment.includes(update.sourceRef.quote))
    )
      throw new Error(
        'Academic update needs a registered course assessment and exact cited evidence.',
      );
    if (
      source.context?.assessmentId !== assessment.id ||
      source.context.applicability !== 'assessment' ||
      !['syllabus', 'instructor-update'].includes(source.context.role)
    )
      throw new Error('Academic authority must be explicitly declared for this assessment.');
    const supersededBy = sourcesInCourse(state, courseId).find(
      (candidate) =>
        candidate.id !== source.id &&
        candidate.context?.assessmentId === assessment.id &&
        candidate.context.applicability === 'assessment' &&
        ['syllabus', 'instructor-update'].includes(candidate.context.role) &&
        candidate.context.supersedes?.some(
          (ref) => ref.sourceId === source.id && ref.version === source.version,
        ),
    );
    if (supersededBy)
      throw new Error(
        'A superseded source cannot establish current academic authority; read its declared replacement.',
      );
    const fact =
      update.kind === 'deadline'
        ? source.context.confirmedFacts?.deadline
        : source.context.confirmedFacts?.coverage;
    if (!fact || fact.quote !== update.sourceRef.quote)
      throw new Error(
        'Academic values must come from owner-confirmed typed facts with the exact cited passage.',
      );
    if (
      update.kind !== 'eligibility' &&
      (update.lessonIds.length || update.topic || update.eligible)
    )
      throw new Error('Only eligibility updates can select lessons or topics.');
    for (const old of (update.kind === 'deadline'
      ? assessment.deadlineAt
        ? (assessment.deadlineSourceRefs ?? assessment.sourceRefs)
        : []
      : assessment.includedTopics || assessment.excludedTopics
        ? (assessment.coverageSourceRefs ?? assessment.sourceRefs)
        : []) ?? []) {
      if (old.sourceId === source.id && old.version === source.version) continue;
      const previous = state.sources.find(
        (item) =>
          item.id === old.sourceId && item.version === old.version && item.courseId === courseId,
      );
      const sameFacts =
        update.kind === 'deadline'
          ? previous?.context?.confirmedFacts?.deadline?.at ===
              source.context.confirmedFacts?.deadline?.at &&
            previous?.context?.confirmedFacts?.deadline?.timezone ===
              source.context.confirmedFacts?.deadline?.timezone
          : JSON.stringify(previous?.context?.confirmedFacts?.coverage) ===
            JSON.stringify(source.context.confirmedFacts?.coverage);
      if (
        !sameFacts &&
        !source.context.supersedes?.some(
          (ref) => ref.sourceId === old.sourceId && ref.version === old.version,
        )
      )
        throw new Error(
          'Changing confirmed academic facts requires explicit supersession of the previous source version.',
        );
    }
    if (update.kind === 'eligibility') {
      const coverageUpdate = updates.find(
        (item) => item.assessmentId === assessment.id && item.kind === 'coverage',
      );
      const proposedCoverageSource = coverageUpdate && cited.get(coverageUpdate.sourceRef.sourceId);
      const coverage = coverageUpdate
        ? proposedCoverageSource?.context?.confirmedFacts?.coverage
        : assessment.includedTopics !== undefined || assessment.excludedTopics !== undefined
          ? {
              includedTopics: assessment.includedTopics ?? [],
              excludedTopics: assessment.excludedTopics ?? [],
            }
          : source.context.confirmedFacts!.coverage;
      if (!coverage) throw new Error('Eligibility requires valid final assessment coverage.');
      if (!update.lessonIds.length || !update.topic)
        throw new Error('Eligibility needs an explicit topic and scoped lessons.');
      const topic = update.topic.toLowerCase();
      const citedCoverage = source.context.confirmedFacts!.coverage!;
      if (
        update.eligible &&
        (!citedCoverage.includedTopics.some((value) => value.toLowerCase() === topic) ||
          citedCoverage.excludedTopics.some((value) => value.toLowerCase() === topic))
      )
        throw new Error(
          'Excluded or unlisted topics in the cited source cannot be attached to an assessment.',
        );
      const included = coverage.includedTopics.some((value) => value.toLowerCase() === topic);
      const excluded = coverage.excludedTopics.some((value) => value.toLowerCase() === topic);
      if (update.eligible && (!included || excluded))
        throw new Error('Excluded or unlisted topics cannot be attached to an assessment.');
      for (const lessonId of update.lessonIds) {
        const lesson = state.lessons.find(
          (item) => item.id === lessonId && item.courseId === courseId,
        );
        if (
          !lesson ||
          lesson.state !== 'ready' ||
          !lesson.sourceIds.every((id) =>
            state.sources.some(
              (item) =>
                item.id === id &&
                item.version === lesson.sourceVersions[id] &&
                item.status === 'current' &&
                item.courseId === courseId,
            ),
          )
        )
          throw new Error('Eligibility lesson must be current and in this course.');
        if (
          update.eligible &&
          coverage.excludedTopics.some((excludedTopic) =>
            [
              lesson.title,
              lesson.objective,
              lesson.description,
              lesson.question,
              lesson.explanation,
            ]
              .join(' ')
              .toLowerCase()
              .includes(excludedTopic.toLowerCase()),
          )
        )
          throw new Error(
            'A lesson containing an excluded topic cannot be attached to the assessment.',
          );
        if (
          update.eligible &&
          (lesson.validation?.status !== 'checked' ||
            ![lesson.title, lesson.objective, lesson.description].some((value) =>
              value.toLowerCase().includes(topic),
            ))
        )
          throw new Error(
            'Exam eligibility requires checked content and an explicit matching topic.',
          );
      }
    }
  }
}

function publishAcademicUpdates(
  state: WorkspaceState,
  courseId: string,
  plan: SourceDecision,
  record: InvestigationRecord,
) {
  const course = state.courses.find((item) => item.id === courseId)!;
  for (const [index, update] of (plan.academicUpdates ?? []).entries()) {
    const assessment = course.assessments!.find((item) => item.id === update.assessmentId)!;
    const source = state.sources.find(
      (item) => item.id === update.sourceRef.sourceId && item.version === update.sourceRef.version,
    )!;
    const before: Record<string, string | number | boolean | null> = {};
    const after: Record<string, string | number | boolean | null> = {};
    if (update.kind === 'deadline') {
      const fact = source.context!.confirmedFacts!.deadline!;
      before.deadlineAt = assessment.deadlineAt ?? null;
      before.timezone = assessment.timezone ?? null;
      assessment.deadlineAt = fact.at;
      assessment.timezone = fact.timezone;
      assessment.deadlineSourceRefs = [{ sourceId: source.id, version: source.version }];
      after.deadlineAt = fact.at;
      after.timezone = fact.timezone;
    } else if (update.kind === 'coverage') {
      const fact = source.context!.confirmedFacts!.coverage!;
      before.includedTopics = JSON.stringify(assessment.includedTopics ?? []);
      before.excludedTopics = JSON.stringify(assessment.excludedTopics ?? []);
      assessment.includedTopics = [...fact.includedTopics];
      assessment.excludedTopics = [...fact.excludedTopics];
      assessment.coverageSourceRefs = [{ sourceId: source.id, version: source.version }];
      after.includedTopics = JSON.stringify(fact.includedTopics);
      after.excludedTopics = JSON.stringify(fact.excludedTopics);
      // Removing coverage always removes an existing attachment; adding coverage never silently validates a lesson.
      for (const lesson of state.lessons.filter((item) => item.courseId === courseId))
        for (const eligibility of lesson.assessmentEligibility ?? [])
          if (
            eligibility.assessmentId === assessment.id &&
            (!fact.includedTopics.some(
              (topic) => topic.toLowerCase() === eligibility.topic.toLowerCase(),
            ) ||
              fact.excludedTopics.some(
                (topic) => topic.toLowerCase() === eligibility.topic.toLowerCase(),
              ))
          ) {
            eligibility.eligible = false;
            lesson.examEligible = false;
          }
    } else {
      for (const lesson of state.lessons.filter((item) => update.lessonIds.includes(item.id))) {
        before[lesson.id] =
          lesson.assessmentEligibility?.find((item) => item.assessmentId === assessment.id)
            ?.eligible ?? false;
        lesson.assessmentEligibility = [
          ...(lesson.assessmentEligibility ?? []).filter(
            (item) => item.assessmentId !== assessment.id,
          ),
          {
            assessmentId: assessment.id,
            topic: update.topic,
            eligible: update.eligible,
            sourceRefs: [{ sourceId: source.id, version: source.version }],
          },
        ];
        lesson.examEligible = lesson.assessmentEligibility.some((item) => item.eligible);
        after[lesson.id] = update.eligible;
      }
    }
    assessment.sourceRefs = [{ sourceId: source.id, version: source.version }];
    assessment.updatedAt = record.createdAt;
    state.consequences ??= [];
    state.consequences.push({
      id: `academic-${record.id}-${index}`,
      workspaceId: state.id,
      createdAt: record.createdAt,
      trigger: 'Confirmed academic update',
      classification: update.kind === 'deadline' ? 'timing' : 'scope',
      sourceRefs: [{ sourceId: source.id, version: source.version }],
      affectedIds: [courseId, assessment.id, ...update.lessonIds],
      before,
      after,
      reason: plan.reason,
      result:
        'Applied owner-confirmed facts from exact current source evidence. Original attempts retained.',
    });
  }
}

export function applySourceDecision(
  state: InvestigationWorkspace,
  courseId: string,
  raw: unknown,
  reads: InvestigationReads,
  metadata: {
    id: string;
    createdAt: string;
    mode: InvestigationRecord['mode'];
    supersedesId?: string;
    attemptIds?: string[];
  },
): InvestigationWorkspace & { investigations: InvestigationRecord[] } {
  id.parse(metadata.id);
  if (
    !Number.isFinite(Date.parse(metadata.createdAt)) ||
    !['live', 'synthetic', 'prepared'].includes(metadata.mode)
  )
    throw new Error('Invalid investigation metadata.');
  const previous = metadata.supersedesId
    ? state.investigations?.find((item) => item.id === metadata.supersedesId)
    : undefined;
  if (metadata.supersedesId && !previous) throw new Error('Superseded investigation is missing.');
  const plan = validateInvestigationDecision(raw, state, courseId, reads, previous);
  for (const attemptId of metadata.attemptIds ?? [])
    if (
      !state.attempts.some(
        (attempt) =>
          attempt.id === attemptId &&
          state.lessons.some(
            (lesson) => lesson.id === attempt.lessonId && lesson.courseId === courseId,
          ),
      )
    )
      throw new Error('Attempt is outside this investigation course.');
  const record: InvestigationRecord = {
    ...plan,
    ...structuredClone(metadata),
    workspaceId: state.id,
    courseId,
  };
  const existing = state.investigations?.find((item) => item.id === record.id);
  if (existing && JSON.stringify(existing) !== JSON.stringify(record))
    throw new Error('Investigation records are immutable.');
  const next = structuredClone(state) as InvestigationWorkspace & {
    investigations: InvestigationRecord[];
  };
  next.investigations ??= [];
  if (existing) return next;
  next.investigations.push(record);
  publishAcademicUpdates(next, courseId, plan, record);
  next.consequences ??= [];
  next.consequences.push({
    id: `investigation-${record.id}`,
    workspaceId: state.id,
    createdAt: record.createdAt,
    trigger: 'Source investigation',
    classification: plan.decision === 'needs-evidence' ? 'uncertainty' : 'content',
    sourceRefs: plan.sourceRefs.map(({ sourceId, version }) => ({ sourceId, version })),
    affectedIds: [courseId],
    before: { investigationId: previous?.id ?? null },
    after: {
      investigationId: record.id,
      decision: plan.decision,
      applicability: plan.applicability,
      assessmentId: plan.assessmentId,
    },
    reason: plan.reason,
    result:
      plan.decision === 'revise-session'
        ? 'A source-supported session revision was proposed; lesson publication requires its own validation.'
        : plan.decision === 'keep-current'
          ? 'Current lessons were retained without regeneration.'
          : 'More evidence is needed before revising the session.',
  });
  return next;
}
