import { describe, expect, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { applySourceImport, sourceImportSchema } from '../../src/lib/server/imports';
import { applyCollectedSources } from '../../src/lib/server/connectors/ingest';
import {
  applySourceDecision,
  followSourceReference,
  readInvestigationSource,
  validateInvestigationDecision,
  type SourceDecision,
} from '../../src/lib/domain/investigation';
import {
  sourceAuthorityContextSchema,
  validateSourceContext,
} from '../../src/lib/domain/source-context';
import { applyAction } from '../../src/lib/domain/learning';
import type { Lesson, Source, WorkspaceState } from '../../src/lib/domain/types';

const now = '2026-10-28T14:00:00Z';
const teaching =
  'A larger sample reduces sampling variability, but a biased sampling method remains biased.';
const deadlineQuote = 'Assessment one is due November fourth at nine in the evening Eastern time.';
const coverageQuote = 'Assessment one includes sampling variability. Sampling bias is excluded.';
const sourceText = `${teaching}\n${deadlineQuote}\n${coverageQuote}`;
function initial() {
  return seedEmptyAccountWorkspace('source-reconciliation-synthetic', now);
}
function imported() {
  return applySourceImport(
    initial(),
    sourceImportSchema.parse({
      importId: 'first',
      expectedRevision: 0,
      sourceKey: 'syllabus',
      title: 'Original synthetic syllabus',
      kind: 'course-text',
      text: sourceText,
      course: { id: 'statistics', code: 'SYN', title: 'Original synthetic statistics' },
      assessment: { id: 'exam-1', title: 'Original assessment one' },
      context: {
        role: 'syllabus',
        applicability: 'assessment',
        assessmentId: 'exam-1',
        confirmedFacts: {
          deadline: {
            at: '2026-11-04T21:00:00-05:00',
            timezone: 'America/New_York',
            quote: deadlineQuote,
          },
          coverage: {
            includedTopics: ['sampling variability'],
            excludedTopics: ['sampling bias'],
            quote: coverageQuote,
          },
        },
      },
    }),
    now,
  ).workspace;
}
function reads(state: WorkspaceState) {
  return new Map(
    state.sources
      .filter((source) => source.status === 'current')
      .map((source) => [source.id, { version: source.version, body: source.body }]),
  );
}
function decision(source: Source, kind: 'deadline' | 'coverage', quote: string): SourceDecision {
  const ref = { sourceId: source.id, version: source.version, quote };
  return {
    decision: 'keep-current',
    reason:
      'Apply the owner-confirmed assessment fact without regenerating valid teaching content.',
    sourceRefs: [ref],
    assessmentId: 'exam-1',
    applicability: 'assessment',
    conflicts: [],
    academicUpdates: [
      { assessmentId: 'exam-1', kind, sourceRef: ref, lessonIds: [], topic: '', eligible: false },
    ],
  };
}
function lesson(source: Source): Lesson {
  return {
    id: 'sampling-practice',
    courseId: 'statistics',
    title: 'Sampling variability',
    description: 'Original synthetic ordinary practice.',
    objective: 'Distinguish sample size from selection bias.',
    duration: 5,
    kind: 'practice',
    circuit: { topology: 'series', voltage: 1, r1: 1, r2: 1 },
    sourceIds: [source.id],
    sourceVersions: { [source.id]: source.version },
    supportingPassages: [{ sourceId: source.id, version: source.version, quote: teaching }],
    modelVersion: 'synthetic-practice-v1',
    version: 1,
    state: 'ready',
    examEligible: false,
    mode: 'prepared',
    reason: 'Original synthetic test material.',
    question: 'What does increasing sample size address?',
    options: ['Sampling variability', 'Every selection bias', 'Neither'],
    answerIndex: 0,
    hint: 'Separate variability from systematic bias.',
    explanation: teaching,
    exposure: 'fresh-no-diagram',
    validation: { status: 'development-preview', modelVersion: 'synthetic-practice-v1' },
  };
}
const metadata = (id: string) => ({ id, createdAt: now, mode: 'synthetic' as const });

describe('declared source authority and academic reconciliation', () => {
  it('imports declared context and registered per-course assessment without interpreting a sender or title', () => {
    const state = imported();
    expect(state.sources[0].context?.role).toBe('syllabus');
    expect(state.courses[0].assessments).toEqual([
      { id: 'exam-1', title: 'Original assessment one' },
    ]);
    expect(state.courses[0].deadline).toBe('');
    expect(state.courses[0].assessments?.[0].deadlineAt).toBeUndefined();
    const raw = {
      importId: 'plain',
      expectedRevision: 0,
      sourceKey: 'plain',
      title: 'Instructor says official exam correction',
      kind: 'email-text',
      text: sourceText,
      course: { id: 'statistics', code: 'SYN', title: 'Original synthetic statistics' },
    };
    expect(
      applySourceImport(state, sourceImportSchema.parse(raw), now).workspace.sources.at(-1)
        ?.context,
    ).toBeUndefined();
  });

  it('applies exact confirmed deadline and coverage with before/after records, retaining attempts and lesson content', () => {
    let state = imported();
    const source = state.sources[0];
    state.lessons = [lesson(source)];
    state = applyAction(
      state,
      { type: 'attempt', lessonId: state.lessons[0].id, optionIndex: 0 },
      now,
    );
    const attempts = structuredClone(state.attempts),
      lessons = structuredClone(state.lessons);
    state = applySourceDecision(
      state,
      'statistics',
      decision(source, 'deadline', deadlineQuote),
      reads(state),
      metadata('deadline'),
    );
    state = applySourceDecision(
      state,
      'statistics',
      decision(source, 'coverage', coverageQuote),
      reads(state),
      metadata('coverage'),
    );
    expect(state.courses[0].assessments?.[0]).toMatchObject({
      deadlineAt: '2026-11-04T21:00:00-05:00',
      timezone: 'America/New_York',
      includedTopics: ['sampling variability'],
      excludedTopics: ['sampling bias'],
    });
    expect(state.consequences?.find((item) => item.id === 'academic-deadline-0')).toMatchObject({
      classification: 'timing',
      before: { deadlineAt: null },
      after: { deadlineAt: '2026-11-04T21:00:00-05:00' },
    });
    expect(state.attempts).toEqual(attempts);
    expect(state.lessons).toEqual(lessons);
    expect(JSON.parse(JSON.stringify(state)).courses[0].assessments[0].timezone).toBe(
      'America/New_York',
    );
  });

  it('requires exact quotes, declared applicable authority, registered scope and explicit typed dates', () => {
    const state = imported(),
      source = state.sources[0];
    const plan = decision(source, 'deadline', deadlineQuote);
    expect(() =>
      validateInvestigationDecision(
        { ...plan, academicUpdates: [{ ...plan.academicUpdates![0], deadlineAt: '2029-01-01' }] },
        state,
        'statistics',
        reads(state),
      ),
    ).toThrow();
    const bad = structuredClone(state);
    delete bad.sources[0].context!.confirmedFacts;
    expect(() => validateInvestigationDecision(plan, bad, 'statistics', reads(bad))).toThrow(
      'owner-confirmed',
    );
    const unknown = structuredClone(state);
    unknown.sources[0].context!.applicability = 'unknown';
    expect(() =>
      validateInvestigationDecision(plan, unknown, 'statistics', reads(unknown)),
    ).toThrow('needs-evidence');
    const foreign = structuredClone(state);
    foreign.courses[0].assessments = [];
    expect(() =>
      validateInvestigationDecision(plan, foreign, 'statistics', reads(foreign)),
    ).toThrow('registered');
    expect(() =>
      validateSourceContext(
        state,
        'statistics',
        {
          ...source.context,
          confirmedFacts: {
            deadline: { at: '2026-11-04', timezone: 'America/New_York', quote: deadlineQuote },
          },
        },
        source.body,
      ),
    ).toThrow();
    expect(() =>
      validateSourceContext(
        state,
        'statistics',
        {
          ...source.context,
          confirmedFacts: {
            deadline: {
              at: '2026-11-04T21:00:00-05:00',
              timezone: 'America/New_York',
              quote: 'A fabricated passage that is absent.',
            },
          },
        },
        source.body,
      ),
    ).toThrow('exact');
  });

  it('keeps a personal exception ambiguous instead of generalizing it to the assessment', () => {
    const state = imported(),
      source = state.sources[0];
    source.context = {
      role: 'instructor-update',
      applicability: 'personal',
      assessmentId: 'exam-1',
    };
    const plan = decision(source, 'deadline', deadlineQuote);
    expect(() => validateInvestigationDecision(plan, state, 'statistics', reads(state))).toThrow(
      'Personal',
    );
    const uncertain = {
      ...plan,
      decision: 'needs-evidence' as const,
      applicability: 'unknown' as const,
      assessmentId: null,
      academicUpdates: [],
    };
    expect(
      validateInvestigationDecision(uncertain, state, 'statistics', reads(state)).decision,
    ).toBe('needs-evidence');
  });

  it('does not supersede existing confirmed facts from mere recency, then accepts exact declared replacement', () => {
    let state = imported();
    const first = state.sources[0];
    state = applySourceDecision(
      state,
      'statistics',
      decision(first, 'deadline', deadlineQuote),
      reads(state),
      metadata('first-deadline'),
    );
    const correction =
      'Correction: assessment one is now due November fifth at nine in the evening Eastern time.';
    const source: Source = {
      ...structuredClone(first),
      id: 'new-instructor-update',
      title: 'Original later correction',
      body: correction,
      context: {
        role: 'instructor-update',
        applicability: 'assessment',
        assessmentId: 'exam-1',
        publishedAt: '2026-10-29T18:00:00Z',
        confirmedFacts: {
          deadline: {
            at: '2026-11-05T21:00:00-05:00',
            timezone: 'America/New_York',
            quote: correction,
          },
        },
      },
    };
    state.sources.push(source);
    const plan = decision(source, 'deadline', correction);
    expect(() => validateInvestigationDecision(plan, state, 'statistics', reads(state))).toThrow(
      'supersession',
    );
    source.context!.supersedes = [{ sourceId: first.id, version: first.version }];
    const updated = applySourceDecision(
      state,
      'statistics',
      plan,
      reads(state),
      metadata('corrected-deadline'),
    );
    expect(updated.courses[0].assessments![0].deadlineAt).toBe('2026-11-05T21:00:00-05:00');
    expect(
      updated.consequences?.find((item) => item.id === 'academic-corrected-deadline-0')?.before
        .deadlineAt,
    ).toBe('2026-11-04T21:00:00-05:00');
  });

  it('never attaches excluded topics or development previews to an exam', () => {
    const state = imported(),
      source = state.sources[0];
    state.lessons = [lesson(source)];
    const plan = decision(source, 'coverage', coverageQuote);
    plan.academicUpdates = [
      {
        ...plan.academicUpdates![0],
        kind: 'eligibility',
        lessonIds: [state.lessons[0].id],
        topic: 'sampling bias',
        eligible: true,
      },
    ];
    expect(() => validateInvestigationDecision(plan, state, 'statistics', reads(state))).toThrow(
      'Excluded',
    );
    plan.academicUpdates[0].topic = 'sampling variability';
    expect(() => validateInvestigationDecision(plan, state, 'statistics', reads(state))).toThrow(
      'checked',
    );
    plan.academicUpdates[0].lessonIds = ['another-accounts-lesson'];
    expect(() => validateInvestigationDecision(plan, state, 'statistics', reads(state))).toThrow(
      'this course',
    );
  });

  it.each([false, true])(
    'rejects superseded eligibility authority in a combined batch regardless of order (%s)',
    (reverse) => {
      const state = imported(),
        old = state.sources[0];
      // This synthetic flag exercises the application gate; it is not a human-review claim.
      const item = {
        ...lesson(old),
        title: 'Sampling variability',
        objective: 'Study sampling variability',
        description: 'Original unit fixture',
        explanation: 'Original unit fixture',
        validation: { status: 'checked' as const, modelVersion: 'synthetic-practice-v1' },
      };
      state.lessons = [item];
      const replacementQuote =
        'The replacement assessment includes randomization and excludes sampling variability.';
      const replacement: Source = {
        ...structuredClone(old),
        id: 'replacement',
        body: replacementQuote,
        context: {
          role: 'instructor-update',
          applicability: 'assessment',
          assessmentId: 'exam-1',
          supersedes: [{ sourceId: old.id, version: old.version }],
          confirmedFacts: {
            coverage: {
              includedTopics: ['randomization'],
              excludedTopics: ['sampling variability'],
              quote: replacementQuote,
            },
          },
        },
      };
      state.sources.push(replacement);
      const oldRef = { sourceId: old.id, version: old.version, quote: coverageQuote },
        newRef = {
          sourceId: replacement.id,
          version: replacement.version,
          quote: replacementQuote,
        };
      const plan: SourceDecision = {
        decision: 'keep-current',
        reason: 'Original synthetic reproduction of conflicting batch proposals.',
        assessmentId: 'exam-1',
        applicability: 'assessment',
        conflicts: [],
        sourceRefs: [oldRef, newRef],
        academicUpdates: [
          {
            assessmentId: 'exam-1',
            kind: 'coverage',
            sourceRef: newRef,
            lessonIds: [],
            topic: '',
            eligible: false,
          },
          {
            assessmentId: 'exam-1',
            kind: 'eligibility',
            sourceRef: oldRef,
            lessonIds: [item.id],
            topic: 'sampling variability',
            eligible: true,
          },
        ],
      };
      if (reverse) plan.academicUpdates!.reverse();
      const original = structuredClone(state);
      expect(() =>
        applySourceDecision(state, 'statistics', plan, reads(state), metadata('invalid-batch')),
      ).toThrow('superseded source');
      expect(state).toEqual(original);
    },
  );

  it.each([false, true])(
    'checks eligibility against final batch coverage even without a declared source replacement (%s)',
    (reverse) => {
      const state = imported(),
        old = state.sources[0];
      const item = {
        ...lesson(old),
        title: 'Sampling variability',
        objective: 'Study sampling variability',
        description: 'Original unit fixture',
        explanation: 'Original unit fixture',
        validation: { status: 'checked' as const, modelVersion: 'synthetic-practice-v1' },
      };
      state.lessons = [item];
      const quote = 'Assessment coverage includes randomization and excludes sampling variability.';
      const newer: Source = {
        ...structuredClone(old),
        id: 'other-current-authority',
        body: quote,
        context: {
          role: 'instructor-update',
          applicability: 'assessment',
          assessmentId: 'exam-1',
          confirmedFacts: {
            coverage: {
              includedTopics: ['randomization'],
              excludedTopics: ['sampling variability'],
              quote,
            },
          },
        },
      };
      state.sources.push(newer);
      const oldRef = { sourceId: old.id, version: old.version, quote: coverageQuote },
        newRef = { sourceId: newer.id, version: newer.version, quote };
      const plan: SourceDecision = {
        decision: 'keep-current',
        reason: 'Original synthetic reproduction of inconsistent effective coverage.',
        assessmentId: 'exam-1',
        applicability: 'assessment',
        conflicts: [],
        sourceRefs: [oldRef, newRef],
        academicUpdates: [
          {
            assessmentId: 'exam-1',
            kind: 'coverage',
            sourceRef: newRef,
            lessonIds: [],
            topic: '',
            eligible: false,
          },
          {
            assessmentId: 'exam-1',
            kind: 'eligibility',
            sourceRef: oldRef,
            lessonIds: [item.id],
            topic: 'sampling variability',
            eligible: true,
          },
        ],
      };
      if (reverse) plan.academicUpdates!.reverse();
      expect(() =>
        applySourceDecision(
          state,
          'statistics',
          plan,
          reads(state),
          metadata('invalid-final-coverage'),
        ),
      ).toThrow('Excluded');
    },
  );

  it('rejects an isolated old deadline update after an explicitly declared current replacement', () => {
    const state = imported(),
      old = state.sources[0];
    state.sources.push({
      ...structuredClone(old),
      id: 'replacement',
      context: {
        ...old.context!,
        role: 'instructor-update',
        supersedes: [{ sourceId: old.id, version: old.version }],
      },
    });
    expect(() =>
      validateInvestigationDecision(
        decision(old, 'deadline', deadlineQuote),
        state,
        'statistics',
        reads(state),
      ),
    ).toThrow('superseded source');
  });

  it('retains known authorized URL references across imports and rejects foreign course targets', () => {
    let state = imported();
    const source = state.sources[0];
    source.url = 'https://source.example.invalid/teaching';
    const link = {
      ...structuredClone(source),
      id: 'link',
      body: 'Read https://source.example.invalid/teaching for the relevant original lesson.',
    };
    state.sources.push(link);
    expect(
      followSourceReference(state, 'statistics', 'link', source.id, reads(state)).sourceId,
    ).toBe(source.id);
    state = {
      ...state,
      courses: [...state.courses, { ...state.courses[0], id: 'foreign-course' }],
    };
    state.sources[0].courseId = 'foreign-course';
    expect(() =>
      followSourceReference(state, 'statistics', 'link', source.id, reads(state)),
    ).toThrow('authorized');
  });

  it('rebases only unchanged quoted teaching after a declared timing change, retaining support and immutable attempts', () => {
    const state = imported();
    state.sources = [];
    const context = { provider: 'blackboard', connectionId: 'owned', checkedAt: now };
    const record = {
      id: 'lecture',
      courseId: 'statistics',
      title: 'Original teaching page',
      body: teaching + '\nExam on Wednesday.',
      kind: 'blackboard' as const,
      context: { role: 'teaching-material' as const, applicability: 'course' as const },
    };
    let first = applyCollectedSources(state, [record], context).workspace;
    const source = first.sources[0];
    first.lessons = [lesson(source)];
    first.recommendedLessonId = first.lessons[0].id;
    first = applyAction(
      first,
      { type: 'assistance', lessonId: first.lessons[0].id, kind: 'hint' },
      now,
    );
    first = applyAction(
      first,
      { type: 'attempt', lessonId: first.lessons[0].id, optionIndex: 0 },
      now,
    );
    const attempts = structuredClone(first.attempts),
      oldLesson = structuredClone(first.lessons[0]);
    const changed = applyCollectedSources(
      first,
      [
        {
          ...record,
          body: teaching + '\nExam on Thursday.',
          context: { ...record.context, changeImpact: 'timing-only' },
        },
      ],
      context,
    ).workspace;
    const replacement = changed.lessons.find((item) => item.id === changed.recommendedLessonId)!;
    expect(replacement.id).not.toBe(oldLesson.id);
    expect(replacement.question).toBe(oldLesson.question);
    expect(replacement.sourceVersions[source.id]).toBe(2);
    expect(changed.lessons[0]).toEqual({ ...oldLesson, state: 'stale' });
    expect(changed.attempts).toEqual(attempts);
    expect(changed.assistance[replacement.id]).toEqual(first.assistance[oldLesson.id]);
    const repeated = applyAction(
      changed,
      { type: 'attempt', lessonId: replacement.id, optionIndex: 0 },
      now,
    ).attempts.at(-1)!;
    expect(repeated.novel).toBe(false);
    expect(repeated.assisted).toBe(true);
  });

  it('stales substantive changes despite a timing label, and recovers unchanged expired sources without a new version', () => {
    const state = imported();
    state.sources = [];
    const context = { provider: 'blackboard', connectionId: 'owned', checkedAt: now };
    const record = {
      id: 'lecture',
      courseId: 'statistics',
      title: 'Original teaching page',
      body: teaching,
      kind: 'blackboard' as const,
      context: { role: 'teaching-material' as const, applicability: 'course' as const },
    };
    const first = applyCollectedSources(state, [record], context).workspace;
    first.lessons = [lesson(first.sources[0])];
    const revised = applyCollectedSources(
      first,
      [
        {
          ...record,
          body: 'A substantively changed original explanation is provided here.',
          context: { ...record.context, changeImpact: 'timing-only' },
        },
      ],
      context,
    ).workspace;
    expect(revised.lessons).toHaveLength(1);
    expect(revised.lessons[0].state).toBe('stale');
    first.sources[0].status = 'stale';
    first.lessons[0].state = 'stale';
    const recovered = applyCollectedSources(first, [record], {
      ...context,
      checkedAt: '2026-10-29T14:00:00Z',
    });
    expect(recovered.changedSourceIds).toEqual([]);
    expect(recovered.workspace.sources).toHaveLength(1);
    expect(recovered.workspace.sources[0].retrievedAt).toBe('2026-10-29T14:00:00Z');
    expect(recovered.workspace.lessons[0].state).toBe('ready');
    expect(
      readInvestigationSource(recovered.workspace, 'statistics', recovered.workspace.sources[0].id)
        .body,
    ).toBe(teaching);
  });

  it('rejects cross-course declared supersession, unregistered assessments, executable metadata and invalid publication times', () => {
    const state = imported();
    expect(() =>
      validateSourceContext(state, 'statistics', {
        role: 'instructor-update',
        assessmentId: 'other-course-exam',
      }),
    ).toThrow('registered');
    expect(() =>
      validateSourceContext(state, 'statistics', {
        role: 'instructor-update',
        supersedes: [{ sourceId: 'foreign-source', version: 1 }],
      }),
    ).toThrow('existing version');
    expect(
      sourceAuthorityContextSchema.safeParse({ role: 'syllabus', publishedAt: 'yesterday' })
        .success,
    ).toBe(false);
    expect(
      sourceAuthorityContextSchema.safeParse({ role: 'syllabus', execute: 'doSomething()' })
        .success,
    ).toBe(false);
  });
});
