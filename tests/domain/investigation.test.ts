import { describe, expect, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import {
  applySourceDecision,
  followSourceReference,
  listInvestigationSources,
  readInvestigationSource,
  validateInvestigationDecision,
  type InvestigableSource,
  type InvestigationReads,
  type InvestigationWorkspace,
  type SourceDecision,
} from '../../src/lib/domain/investigation';

const at = '2026-10-28T12:00:00.000Z';
function fixture(): InvestigationWorkspace {
  const state = seedEmptyAccountWorkspace('original-investigation-workspace', at);
  state.courses = ['course-a', 'course-b'].map((id) => ({
    id,
    code: id,
    title: 'Original synthetic course',
    instructor: '',
    color: '#123456',
    deadline: '',
    nextEvent: '',
  }));
  const sources: InvestigableSource[] = [
    {
      id: 'syllabus',
      courseId: 'course-a',
      title: 'Original syllabus',
      version: 1,
      status: 'current',
      kind: 'synthetic',
      body: 'Assessment alpha covers series and parallel resistor reasoning.',
      retrievedAt: at,
      url: 'https://course.example.invalid/syllabus',
      context: { role: 'syllabus', assessmentId: 'alpha', publishedAt: '2026-10-01T12:00:00Z' },
    },
    {
      id: 'update',
      courseId: 'course-a',
      title: 'Original instructor update',
      version: 1,
      status: 'current',
      kind: 'synthetic',
      body: 'This update supersedes the Original syllabus for assessment alpha: prepare parallel networks only.',
      retrievedAt: at,
      context: { role: 'instructor-update', assessmentId: 'alpha', publishedAt: at },
    },
    {
      id: 'foreign',
      courseId: 'course-b',
      title: 'Other course original source',
      version: 1,
      status: 'current',
      kind: 'synthetic',
      body: 'Other course material must never be silently imported into course A.',
      retrievedAt: at,
      url: 'https://course.example.invalid/foreign',
    },
  ];
  state.sources = sources;
  return state;
}
function reads(state: InvestigationWorkspace): InvestigationReads {
  return new Map(
    state.sources
      .filter((source) => source.courseId === 'course-a')
      .map((source) => [source.id, { version: source.version, body: source.body.slice(0, 4000) }]),
  );
}
function decision(state: InvestigationWorkspace): SourceDecision {
  return {
    decision: 'revise-session',
    reason: 'The instructor explicitly corrected the assessment scope.',
    sourceRefs: state.sources
      .filter((source) => source.courseId === 'course-a')
      .map((source) => ({ sourceId: source.id, version: source.version, quote: source.body })),
    assessmentId: 'alpha',
    applicability: 'assessment',
    conflicts: [
      {
        sourceIds: ['syllabus', 'update'],
        reason: 'The original syllabus and instructor update describe different scope.',
        resolution: 'explicit-supersession',
        preferredSourceId: 'update',
      },
    ],
  };
}

describe('bounded course-source investigation', () => {
  it('pages current same-course records and never falls back from a stale newest version', () => {
    const state = fixture();
    state.sources.push({ ...state.sources[0], version: 2, status: 'stale' });
    expect(
      listInvestigationSources(state, 'course-a').sources.map((source) => source.sourceId),
    ).toEqual(['update']);
    expect(() => readInvestigationSource(state, 'course-a', 'syllabus')).toThrow('unavailable');
    expect(() => readInvestigationSource(state, 'course-a', 'foreign')).toThrow('unavailable');
    expect(() => listInvestigationSources(state, 'absent')).toThrow('outside');
    expect(() => readInvestigationSource(state, 'course-a', 'update', -1)).toThrow('offset');
  });

  it('requires actual disclosed page content, including supporting passages after the first 4000 characters', () => {
    const state = fixture();
    const source = state.sources[1];
    const ending = 'Original late-page evidence supports studying parallel circuits.';
    source.body = 'x'.repeat(4000) + ending;
    const first = readInvestigationSource(state, 'course-a', source.id);
    const second = readInvestigationSource(state, 'course-a', source.id, first.nextOffset!);
    expect(first.body).toHaveLength(4000);
    expect(second.body).toBe(ending);
    expect(second.nextOffset).toBeNull();
    const plan: SourceDecision = {
      decision: 'keep-current',
      reason: 'The disclosed material supports the existing practice.',
      sourceRefs: [{ sourceId: source.id, version: 1, quote: ending }],
      assessmentId: null,
      applicability: 'course',
      conflicts: [],
    };
    expect(() => validateInvestigationDecision(plan, state, 'course-a', reads(state))).toThrow(
      'exact quote',
    );
    const paged = new Map([
      [source.id, { version: 1, segments: [{ offset: 4000, body: ending }] }],
    ]);
    expect(validateInvestigationDecision(plan, state, 'course-a', paged).decision).toBe(
      'keep-current',
    );
    expect(() =>
      validateInvestigationDecision(
        plan,
        state,
        'course-a',
        new Map([[source.id, { version: 1, segments: [{ offset: 0, body: ending }] }]]),
      ),
    ).toThrow('segment');
  });

  it('follows only disclosed registered URLs or explicit relations within the same course', () => {
    const state = fixture();
    const source = state.sources[1] as InvestigableSource;
    source.body = `Read https://course.example.invalid/syllabus\nOther https://course.example.invalid/foreign\nUnregistered https://external.example.invalid/secret`;
    expect(
      followSourceReference(state, 'course-a', 'update', 'syllabus', reads(state)).sourceId,
    ).toBe('syllabus');
    expect(() =>
      followSourceReference(state, 'course-a', 'update', 'foreign', reads(state)),
    ).toThrow('authorized');
    expect(() =>
      followSourceReference(state, 'course-a', 'update', 'unregistered', reads(state)),
    ).toThrow('authorized');
    expect(() => followSourceReference(state, 'course-a', 'update', 'syllabus', new Map())).toThrow(
      'read',
    );
    source.body = 'The exact registered URL is absent from this source.';
    expect(() =>
      followSourceReference(state, 'course-a', 'update', 'syllabus', reads(state)),
    ).toThrow('disclosed');
    source.relatedSourceIds = ['syllabus', 'foreign'];
    expect(
      followSourceReference(state, 'course-a', 'update', 'syllabus', reads(state)).sourceId,
    ).toBe('syllabus');
    expect(() =>
      followSourceReference(state, 'course-a', 'update', 'foreign', reads(state)),
    ).toThrow('authorized');
  });

  it('accepts applicable declared authority plus an exact correction passage, not recency alone', () => {
    const state = fixture();
    expect(
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)).decision,
    ).toBe('revise-session');
    state.sources[1].body =
      'A recent course message discusses parallel circuits and has a newer publication date.';
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)),
    ).toThrow('Recency');
    (state.sources[1] as InvestigableSource).context!.supersedes = [
      { sourceId: 'syllabus', version: 1 },
    ];
    expect(
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)).decision,
    ).toBe('revise-session');
    (state.sources[1] as InvestigableSource).context!.supersedes = [
      { sourceId: 'syllabus', version: 2 },
    ];
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)),
    ).toThrow('Recency');
  });

  it('does not infer instructor authority from source instructions or apply a correction to another assessment', () => {
    const state = fixture();
    (state.sources[1] as InvestigableSource).context!.role = 'student-question';
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)),
    ).toThrow('authority');
    (state.sources[1] as InvestigableSource).context!.role = 'instructor-update';
    (state.sources[1] as InvestigableSource).context!.assessmentId = 'beta';
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)),
    ).toThrow('applicability');
    (state.sources[1] as InvestigableSource).context!.assessmentId = 'alpha';
    state.sources[1].body =
      'This update does not replace the Original syllabus for assessment alpha.';
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)),
    ).toThrow('Recency');
  });

  it('retains individual instructor exceptions without an exact declared supersession', () => {
    const state = fixture();
    (state.sources[0] as InvestigableSource).context!.role = 'instructor-update';
    state.sources[0].body =
      'For your individual assessment alpha, the earlier personal exception still applies.';
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', reads(state)),
    ).toThrow('Recency');
    const plan = decision(state);
    plan.decision = 'needs-evidence';
    plan.conflicts[0].resolution = 'unresolved';
    plan.conflicts[0].preferredSourceId = null;
    expect(validateInvestigationDecision(plan, state, 'course-a', reads(state)).decision).toBe(
      'needs-evidence',
    );
    plan.decision = 'revise-session';
    expect(() => validateInvestigationDecision(plan, state, 'course-a', reads(state))).toThrow(
      'uncertain',
    );
  });

  it('requires current supporting quotes for every source and rejects fabricated academic fields', () => {
    const state = fixture();
    const plan = decision(state);
    plan.sourceRefs[1].quote = 'Fabricated unsupported correction statement.';
    expect(() => validateInvestigationDecision(plan, state, 'course-a', reads(state))).toThrow(
      'exact quote',
    );
    expect(() =>
      validateInvestigationDecision(
        { ...decision(state), examEligible: true },
        state,
        'course-a',
        reads(state),
      ),
    ).toThrow();
    expect(() =>
      validateInvestigationDecision(
        { ...decision(state), deadline: '2026-11-01' },
        state,
        'course-a',
        reads(state),
      ),
    ).toThrow();
    expect(() =>
      validateInvestigationDecision(
        { ...decision(state), applicability: 'unknown' },
        state,
        'course-a',
        reads(state),
      ),
    ).toThrow('cannot claim');
    const changedReads = new Map(reads(state));
    changedReads.set('update', { version: 2, body: state.sources[1].body });
    expect(() =>
      validateInvestigationDecision(decision(state), state, 'course-a', changedReads),
    ).toThrow('version');
  });

  it('appends retry-safe immutable proposals and consequences without altering lessons or academic records', () => {
    const state = fixture();
    const original = structuredClone(state);
    const plan = decision(state);
    const metadata = { id: 'investigation-1', createdAt: at, mode: 'synthetic' as const };
    const result = applySourceDecision(state, 'course-a', plan, reads(state), metadata);
    expect(state).toEqual(original);
    expect(result.investigations).toHaveLength(1);
    expect(result.consequences).toHaveLength(1);
    for (const key of [
      'lessons',
      'sources',
      'courses',
      'attempts',
      'interpretations',
      'preferences',
    ] as const)
      expect(result[key]).toEqual(original[key]);
    expect(result.consequences?.[0].result).toContain('proposed');
    expect(applySourceDecision(result, 'course-a', plan, reads(result), metadata)).toEqual(result);
    expect(() =>
      applySourceDecision(
        result,
        'course-a',
        { ...plan, reason: 'A different immutable interpretation.' },
        reads(result),
        metadata,
      ),
    ).toThrow('immutable');
    const keep = { ...plan, decision: 'keep-current' as const };
    const successor = applySourceDecision(result, 'course-a', keep, reads(result), {
      ...metadata,
      id: 'investigation-2',
      supersedesId: 'investigation-1',
    });
    expect(successor.investigations[0]).toEqual(result.investigations[0]);
    expect(successor.investigations[1].supersedesId).toBe('investigation-1');
  });

  it('does not drop an unresolved prior conflict or attach another course attempt', () => {
    const state = fixture();
    const unresolved = decision(state);
    unresolved.decision = 'needs-evidence';
    unresolved.conflicts[0].resolution = 'unresolved';
    unresolved.conflicts[0].preferredSourceId = null;
    const first = applySourceDecision(state, 'course-a', unresolved, reads(state), {
      id: 'first',
      createdAt: at,
      mode: 'synthetic',
    });
    const unsupported = { ...decision(state), conflicts: [] };
    expect(() =>
      applySourceDecision(first, 'course-a', unsupported, reads(first), {
        id: 'second',
        createdAt: at,
        mode: 'synthetic',
        supersedesId: 'first',
      }),
    ).toThrow('silently disappear');
    expect(() =>
      applySourceDecision(first, 'course-b', unsupported, reads(first), {
        id: 'second',
        createdAt: at,
        mode: 'synthetic',
        supersedesId: 'first',
      }),
    ).toThrow();
    expect(() =>
      applySourceDecision(first, 'course-a', decision(state), reads(first), {
        id: 'second',
        createdAt: at,
        mode: 'synthetic',
        attemptIds: ['foreign-attempt'],
      }),
    ).toThrow('outside');
  });
});
