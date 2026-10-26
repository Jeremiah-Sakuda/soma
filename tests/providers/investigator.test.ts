import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import type { SourceDecision } from '../../src/lib/domain/investigation';
import type { WorkspaceState } from '../../src/lib/domain/types';
import { InvestigationError, investigateWithSpark, publishInvestigation } from '../../src/lib/server/investigator';
import { META_ENDPOINT } from '../../src/lib/server/meta-client';

const at = '2026-10-28T12:00:00.000Z';
let directory: string;
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-investigator-'));
  for (const [name, value] of Object.entries({ SOMA_PERSISTENCE: 'local-synthetic', SOMA_LIVE_INFERENCE: 'true', MODEL_API_KEY: 'synthetic-key-never-sent', META_API_BASE_URL: 'https://api.meta.ai/v1', META_MODEL_ID: 'muse-spark-1.3', META_ALLOCATION_USD: '1', META_APP_SPEND_CAP_USD: '0.8', SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite') })) vi.stubEnv(name, value);
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected provider request: every response must be scripted.'); }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

function fixture(): WorkspaceState {
  const state = seedWorkspace('original-investigation-server', at);
  state.sources = [
    { id: 'syllabus', courseId: 'circuits', title: 'Original synthetic syllabus', version: 1, status: 'current', kind: 'synthetic', retrievedAt: at, url: 'https://course.example.invalid/syllabus', context: { role: 'syllabus', assessmentId: 'alpha' }, body: 'Assessment alpha covers series and parallel resistor reasoning.' },
    { id: 'update', courseId: 'circuits', title: 'Original synthetic correction', version: 1, status: 'current', kind: 'synthetic', retrievedAt: at, context: { role: 'instructor-update', assessmentId: 'alpha' }, body: 'This update supersedes the Original synthetic syllabus for assessment alpha: prepare parallel resistor networks only. Read https://course.example.invalid/syllabus for the earlier version.' },
  ];
  state.lessons = state.lessons.filter(lesson => lesson.courseId === 'circuits').map(lesson => ({ ...lesson, sourceIds: ['update'], sourceVersions: { update: 1 } }));
  state.recommendedLessonId = 'series-contrast';
  return state;
}
function decision(state: WorkspaceState, kind: SourceDecision['decision'] = 'revise-session', citeBoth = true): SourceDecision {
  return {
    decision: kind, reason: kind === 'revise-session' ? 'The applicable instructor correction explicitly changes the assessment preparation.' : 'The selected material needs no replacement of the current study activity.',
    sourceRefs: state.sources.filter(source => citeBoth || source.id === 'update').map(source => ({ sourceId: source.id, version: source.version, quote: source.body })),
    assessmentId: kind === 'revise-session' ? 'alpha' : null, applicability: kind === 'revise-session' ? 'assessment' : 'course',
    conflicts: kind === 'revise-session' ? [{ sourceIds: ['syllabus', 'update'], reason: 'The syllabus and the explicit correction describe different assessment coverage.', resolution: 'explicit-supersession', preferredSourceId: 'update' }] : [],
  };
}
type RequestBody = { input: ({ type?: string; output?: string; content?: string })[] };
type Step = { name: string; args: unknown } | ((body: RequestBody) => { name: string; args: unknown });
function script(steps: Step[]) {
  let index = 0;
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    expect(url).toBe(META_ENDPOINT);
    const body = JSON.parse(init!.body as string) as RequestBody;
    const step = steps[index++];
    if (!step) throw new Error('The investigation made an unexpected extra request.');
    const output = typeof step === 'function' ? step(body) : step;
    return new Response(JSON.stringify({ status: 'completed', usage: { input_tokens: 100, output_tokens: 20 }, output: [{ type: 'function_call', name: output.name, arguments: JSON.stringify(output.args), call_id: `original-call-${index}` }] }), { headers: { 'content-type': 'application/json' } });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}
function finishToolArgs(value: SourceDecision, selectedLessonId: unknown = null) {
  const { assessmentId, conflicts, ...rest } = value;
  return { ...rest, assessmentIds: assessmentId === null ? [] : [assessmentId], selectedLessonIds: selectedLessonId === null ? [] : [selectedLessonId], conflicts: conflicts.map(({ preferredSourceId, ...conflict }) => ({ ...conflict, preferredSourceIds: preferredSourceId === null ? [] : [preferredSourceId] })) };
}
function textToolArgs(plan: { kind: string; experimentRunId: unknown; [key: string]: unknown }) {
  const { kind: _kind, experimentRunId: _experimentRunId, ...args } = plan;
  return args;
}
function experimentToolArgs(plan: { kind: string; experimentRunId: unknown; [key: string]: unknown }, experimentRunId: unknown) {
  return { ...textToolArgs(plan), experimentRunId };
}
const readUpdate: Step = { name: 'read_source', args: { sourceId: 'update', offset: 0 } };
const followSyllabus: Step = { name: 'follow_reference', args: { fromId: 'update', targetId: 'syllabus' } };
const request = { courseId: 'circuits', goal: 'Investigate the original course correction.', initialSourceIds: ['update'] };

function lastToolOutput(body: RequestBody): Record<string, unknown> {
  const output = body.input.filter(item => item.type === 'function_call_output').at(-1)?.output;
  return JSON.parse(output!);
}

describe('integrated bounded Spark investigation', () => {
  it('follows a registered source, validates explicit authority, publishes a recommendation, and reuses it without another call', async () => {
    const state = fixture(), original = structuredClone(state);
    const fetcher = script([readUpdate, followSyllabus, { name: 'finish_investigation', args: finishToolArgs(decision(state), 'parallel-nodes') }]);
    const result = await investigateWithSpark(state, request);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect([...result.reads.keys()]).toEqual(['update', 'syllabus']);
    expect(result.record.toolActivity?.map(item => item.tool)).toEqual(['read_source', 'follow_reference', 'finish_investigation']);
    expect(state).toEqual(original);
    const published = publishInvestigation(state, result);
    expect(published.recommendedLessonId).toBe('parallel-nodes');
    expect(published.investigations).toHaveLength(1);
    for (const key of ['courses', 'sources', 'lessons', 'attempts'] as const) expect(published[key]).toEqual(original[key]);
    // A later unrelated recommendation must not change which activity this cached decision selected.
    published.recommendedLessonId = 'series-contrast';
    const cached = await investigateWithSpark(published, request);
    expect(cached).toMatchObject({ reused: true, selectedLessonId: 'parallel-nodes', run: { mode: 'prepared', status: 'unchanged' } });
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(publishInvestigation(published, cached)).toBe(published);
    const db = new DatabaseSync(join(directory, 'budget.sqlite'));
    try { expect(db.prepare('SELECT COUNT(*) AS count FROM reservations').get()?.count).toBe(1); } finally { db.close(); }
  });

  it('records a no-effect decision without replacing the session or changing academic facts', async () => {
    const state = fixture();
    script([readUpdate, { name: 'finish_investigation', args: finishToolArgs(decision(state, 'keep-current', false)) }]);
    const result = await investigateWithSpark(state, request);
    const next = publishInvestigation(state, result);
    expect(result.selectedLessonId).toBeUndefined();
    expect(next.recommendedLessonId).toBe(state.recommendedLessonId);
    expect(next.lessons).toEqual(state.lessons);
    expect(next.sources).toEqual(state.sources);
    expect(next.courses).toEqual(state.courses);
    expect(next.investigations?.[0].decision).toBe('keep-current');
  });

  it('refuses publication when a followed but uncited source becomes stale after investigation', async () => {
    const state = fixture();
    script([readUpdate, followSyllabus, { name: 'finish_investigation', args: finishToolArgs(decision(state, 'keep-current', false)) }]);
    const result = await investigateWithSpark(state, request);
    expect(result.record.sourceRefs.map(ref => ref.sourceId)).toEqual(['update']);
    state.sources.find(source => source.id === 'syllabus')!.status = 'stale';
    const beforePublication = structuredClone(state);
    expect(() => publishInvestigation(state, result)).toThrow();
    expect(state).toEqual(beforePublication);
    expect(state.investigations ?? []).toHaveLength(0);
  });

  it('rejects a stale registered follow and never publishes a decision from the failed run', async () => {
    const state = fixture();
    const fetcher = script([readUpdate, () => {
      state.sources.find(source => source.id === 'syllabus')!.status = 'stale';
      return followSyllabus as Exclude<Step, Function>;
    }, followSyllabus]);
    const failure = await investigateWithSpark(state, request).catch(error => error);
    expect(failure).toBeInstanceOf(InvestigationError);
    expect(failure.run.status).toBe('failed');
    expect(failure.run.steps.join(' ')).toContain('Rejected by application validation');
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(state.investigations ?? []).toHaveLength(0);
    expect(state.recommendedLessonId).toBe('series-contrast');
  });

  it('prepares an ungraded optional text diagnostic and explicitly revises hypotheses from its preserved response', async () => {
    const state = fixture();
    const source = state.sources.find(item => item.id === 'update')!;
    const evidence = [{ sourceId: source.id, version: 1, quote: source.body }];
    const plan = {
      kind: 'text', experimentRunId: null,
      hypotheses: [
        { id: 'series-transfer', claim: 'The learner may transfer a series current rule to parallel branches.', evidence, attemptIds: [] },
        { id: 'constant-total', claim: 'The learner may hold the total current fixed when branch resistance changes.', evidence, attemptIds: [] },
      ],
      question: 'What stays equal across ideal parallel resistor branches?', options: ['Branch voltage', 'Branch current', 'Branch resistance'],
      predictions: [{ hypothesisId: 'series-transfer', predictedOptionIndex: 1 }, { hypothesisId: 'constant-total', predictedOptionIndex: 2 }],
      rationale: 'The choices distinguish two provisional explanations without assigning a grade.', nextActivity: 'Explore the branch relationships with the source voltage held fixed.',
    };
    const fetcher = script([readUpdate, { name: 'prepare_diagnostic', args: textToolArgs(plan) }, body => {
      const prepared = lastToolOutput(body); expect(prepared.accepted).toBe(true);
      return { name: 'finish_investigation', args: finishToolArgs({ ...decision(state, 'keep-current', false), decision: 'revise-session' }, prepared.lessonId) };
    }]);
    const result = await investigateWithSpark(state, request);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(result.lesson).toMatchObject({ kind: 'practice', diagnosticInvestigationId: result.record.id, exposure: 'fresh-no-diagram', mode: 'live', examEligible: false });
    const published = publishInvestigation(state, result);
    const answered = applyAction(published, { type: 'attempt', lessonId: result.lesson!.id, optionIndex: 1 }, at);
    const attempt = answered.attempts.at(-1)!;
    expect(attempt).toMatchObject({ correct: null, assisted: false, novel: true });
    expect(answered.interpretations).toEqual(published.interpretations);
    expect(answered.lessons).toEqual(published.lessons);
    const immutableObservation = structuredClone(attempt), immutableRecord = structuredClone(answered.investigations![0]);
    const revisionFetcher = script([readUpdate,
      { name: 'revise_interpretation', args: { hypothesisId: 'series-transfer', status: 'supported', attemptId: attempt.id, reason: 'The original response is consistent with this provisional prediction, not mastery.' } },
      { name: 'revise_interpretation', args: { hypothesisId: 'constant-total', status: 'weakened', attemptId: attempt.id, reason: 'The saved option differs from this explanation’s predicted option.' } },
      { name: 'finish_investigation', args: finishToolArgs(decision(answered, 'keep-current', false)) },
    ]);
    const revised = await investigateWithSpark(answered, { ...request, previousInvestigationId: result.record.id, attemptId: attempt.id });
    const final = publishInvestigation(answered, revised);
    expect(revisionFetcher).toHaveBeenCalledTimes(4);
    expect(final.investigations).toHaveLength(2);
    expect(final.investigations![0]).toEqual(immutableRecord);
    expect(final.attempts.at(-1)).toEqual(immutableObservation);
    expect(final.investigations![1]).toMatchObject({ supersedesId: result.record.id, attemptIds: [attempt.id], hypothesisRevisions: [{ hypothesisId: 'series-transfer', status: 'supported' }, { hypothesisId: 'constant-total', status: 'weakened' }] });
    expect(final.interpretations).toEqual(answered.interpretations);
  });
});

function originalTextPlan(state: WorkspaceState) {
  const source = state.sources.find(item => item.id === 'update')!;
  const evidence = [{ sourceId: source.id, version: source.version, quote: source.body }];
  return {
    kind: 'text', experimentRunId: null,
    hypotheses: [
      { id: 'voltage-rule', claim: 'The learner may use the source voltage to determine branch current.', evidence, attemptIds: [] },
      { id: 'fixed-current', claim: 'The learner may expect branch current to stay fixed as voltage changes.', evidence, attemptIds: [] },
    ],
    question: 'What happens to branch current when the ideal source voltage doubles?', options: ['It doubles', 'It stays fixed', 'It halves'],
    predictions: [{ hypothesisId: 'voltage-rule', predictedOptionIndex: 0 }, { hypothesisId: 'fixed-current', predictedOptionIndex: 1 }],
    rationale: 'The competing predictions make this optional comparison useful for reconsideration.', nextActivity: 'Explore the relationship between voltage and current with resistance held fixed.',
  };
}

it('revises an uninformative experiment before persisting the exact informative voltage experiment', async () => {
  const state = fixture(), plan = originalTextPlan(state);
  const input = {
    baseline: { topology: 'parallel', voltage: 12, r1: 6, r2: 3 }, change: { parameter: 'voltage', value: 24 }, observable: 'current1',
    predictions: plan.hypotheses.map((hypothesis, index) => ({ hypothesisId: hypothesis.id, claim: hypothesis.claim, predictedValue: index === 0 ? 4 : 2 })),
  };
  const fetcher = script([readUpdate,
    { name: 'evaluate_experiment', args: { ...input, change: { parameter: 'voltage', value: 12 } } },
    body => {
      expect(lastToolOutput(body)).toMatchObject({ informative: false, reason: 'The proposed parameter did not change.' });
      return { name: 'evaluate_experiment', args: input };
    },
    body => {
      const experiment = lastToolOutput(body);
      expect(experiment).toMatchObject({ informative: true, observedAfter: 4 });
      return { name: 'prepare_experiment_diagnostic', args: experimentToolArgs(plan, experiment.id) };
    },
    body => ({ name: 'finish_investigation', args: finishToolArgs({ ...decision(state, 'keep-current', false), decision: 'revise-session' }, lastToolOutput(body).lessonId) }),
  ]);
  const result = await investigateWithSpark(state, request);
  expect(fetcher).toHaveBeenCalledTimes(5);
  expect(result.record.toolActivity?.filter(item => item.tool === 'evaluate_experiment')).toHaveLength(2);
  const published = publishInvestigation(state, result);
  expect(published.lessons.find(lesson => lesson.id === result.selectedLessonId)).toMatchObject({ kind: 'circuit', circuit: input.baseline, diagnosticExperiment: { input }, diagnosticInvestigationId: result.record.id });
  expect(published.attempts).toEqual(state.attempts);
});

it('retains the entire investigation reservation when the provider returns no trustworthy usage', async () => {
  const fetcher = vi.fn(async () => new Response(JSON.stringify({ status: 'completed', output: [] }), { headers: { 'content-type': 'application/json' } }));
  vi.stubGlobal('fetch', fetcher);
  await expect(investigateWithSpark(fixture(), request)).rejects.toBeInstanceOf(InvestigationError);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const db = new DatabaseSync(join(directory, 'budget.sqlite'));
  try {
    expect(db.prepare('SELECT reserved,charged FROM reservations').all()).toEqual([{ reserved: 0.35, charged: null }]);
    expect(db.prepare('SELECT SUM(COALESCE(charged,reserved)) AS consumed FROM reservations').get()?.consumed).toBe(0.35);
  } finally { db.close(); }
});

it('rejects reversed hypothesis judgments but accepts a conservative unresolved revision', async () => {
  const state = fixture(), plan = originalTextPlan(state);
  script([readUpdate, { name: 'prepare_diagnostic', args: textToolArgs(plan) }, body => ({ name: 'finish_investigation', args: finishToolArgs({ ...decision(state, 'keep-current', false), decision: 'revise-session' }, lastToolOutput(body).lessonId) })]);
  const first = await investigateWithSpark(state, request);
  const answered = applyAction(publishInvestigation(state, first), { type: 'attempt', lessonId: first.lesson!.id, optionIndex: 0 }, at);
  const attempt = answered.attempts.at(-1)!;
  const revisionRequest = { ...request, previousInvestigationId: first.record.id, attemptId: attempt.id };
  script([readUpdate,
    { name: 'revise_interpretation', args: { hypothesisId: 'voltage-rule', status: 'weakened', attemptId: attempt.id, reason: 'An invalid reversed status must not contradict this actual recorded choice.' } },
    { name: 'revise_interpretation', args: { hypothesisId: 'fixed-current', status: 'supported', attemptId: attempt.id, reason: 'This reversed claim also contradicts the saved response and must fail.' } },
  ]);
  await expect(investigateWithSpark(answered, revisionRequest)).rejects.toBeInstanceOf(InvestigationError);
  expect(answered.investigations).toHaveLength(1);
  const conservative = script([readUpdate,
    { name: 'revise_interpretation', args: { hypothesisId: 'voltage-rule', status: 'unresolved', attemptId: attempt.id, reason: 'A single response is insufficient to settle the learner explanation.' } },
    { name: 'finish_investigation', args: finishToolArgs(decision(answered, 'keep-current', false)) },
  ]);
  const result = await investigateWithSpark(answered, revisionRequest);
  expect(conservative).toHaveBeenCalledTimes(3);
  expect(result.record.hypothesisRevisions).toMatchObject([{ hypothesisId: 'voltage-rule', status: 'unresolved' }]);
  expect(publishInvestigation(answered, result).attempts.at(-1)).toEqual(attempt);
});

it('reads a later bounded source page before accepting its exact citation', async () => {
  const state = fixture(), ending = 'The later course paragraph confirms that no change to current preparation is needed.';
  state.sources.find(source => source.id === 'update')!.body = 'Original synthetic introductory material. '.repeat(30).slice(0, 1200).padEnd(1200, ' ') + ending;
  const fetcher = script([readUpdate,
    body => {
      expect(lastToolOutput(body).nextOffset).toBe(1200);
      expect(String(lastToolOutput(body).body)).not.toContain(ending);
      return { name: 'read_source', args: { sourceId: 'update', offset: 1200 } };
    },
    body => {
      expect(lastToolOutput(body).body).toBe(ending);
      return { name: 'finish_investigation', args: finishToolArgs({ ...decision(state, 'keep-current', false), sourceRefs: [{ sourceId: 'update', version: 1, quote: ending }] }) };
    },
  ]);
  const result = await investigateWithSpark(state, request);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(result.reads.get('update')?.segments?.map(segment => segment.offset)).toEqual([0, 1200]);
  expect(publishInvestigation(state, result).investigations?.[0].sourceRefs[0].quote).toBe(ending);
});

it.each([
  { field: 'kind', value: 'text' },
  { field: 'kind', value: 'circuit-experiment' },
  { field: 'experimentRunId', value: null },
  { field: 'experimentRunId', value: 'invented-experiment' },
])('rejects extra $field=$value in a text tool call instead of coercing it', async ({ field, value }) => {
  const state = fixture(), plan = originalTextPlan(state);
  const fetcher = script([readUpdate,
    { name: 'prepare_diagnostic', args: { ...textToolArgs(plan), [field]: value } },
    body => {
      expect(lastToolOutput(body).accepted).toBe(false);
      return { name: 'prepare_diagnostic', args: textToolArgs(plan) };
    },
    body => {
      const prepared = lastToolOutput(body); expect(prepared.accepted).toBe(true);
      return { name: 'finish_investigation', args: finishToolArgs({ ...decision(state, 'keep-current', false), decision: 'revise-session' }, prepared.lessonId) };
    },
  ]);
  const result = await investigateWithSpark(state, request);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(result.record.diagnosticPlan).toMatchObject({ kind: 'text', experimentRunId: null });
  expect(result.record.toolActivity?.filter(item => item.outcome.includes('Rejected'))).toHaveLength(1);
  expect(result.lesson?.kind).toBe('practice');
  const sent = JSON.parse(fetcher.mock.calls[0][1]!.body as string) as { tools: { name: string; parameters: { properties: Record<string, unknown>; required: string[] } }[] };
  const text = sent.tools.find(tool => tool.name === 'prepare_diagnostic')!;
  const experiment = sent.tools.find(tool => tool.name === 'prepare_experiment_diagnostic')!;
  expect(text.parameters.properties).not.toHaveProperty('kind');
  expect(text.parameters.properties).not.toHaveProperty('experimentRunId');
  expect(experiment.parameters.properties).not.toHaveProperty('kind');
  expect(experiment.parameters.properties.experimentRunId).toMatchObject({ type: 'string' });
  expect(experiment.parameters.required).toContain('experimentRunId');
});

it.each(['wrong-kind', 'null-run'] as const)('rejects malformed experiment tool arguments: %s', async failure => {
  const state = fixture(), plan = originalTextPlan(state);
  const input = {
    baseline: { topology: 'parallel', voltage: 12, r1: 6, r2: 3 }, change: { parameter: 'voltage', value: 24 }, observable: 'current1',
    predictions: plan.hypotheses.map((hypothesis, index) => ({ hypothesisId: hypothesis.id, claim: hypothesis.claim, predictedValue: index === 0 ? 4 : 2 })),
  };
  let experimentId: unknown;
  script([readUpdate, { name: 'evaluate_experiment', args: input },
    body => {
      const experiment = lastToolOutput(body); expect(experiment.informative).toBe(true); experimentId = experiment.id;
      return { name: 'prepare_experiment_diagnostic', args: { ...experimentToolArgs(plan, experimentId), ...(failure === 'wrong-kind' ? { kind: 'text' } : { experimentRunId: null }) } };
    },
    body => {
      expect(lastToolOutput(body).accepted).toBe(false);
      return { name: 'prepare_experiment_diagnostic', args: experimentToolArgs(plan, experimentId) };
    },
    body => {
      const prepared = lastToolOutput(body); expect(prepared.accepted).toBe(true);
      return { name: 'finish_investigation', args: finishToolArgs({ ...decision(state, 'keep-current', false), decision: 'revise-session' }, prepared.lessonId) };
    },
  ]);
  const result = await investigateWithSpark(state, request);
  expect(result.record.diagnosticPlan).toMatchObject({ kind: 'circuit-experiment', experimentRunId: experimentId });
  expect(result.lesson?.diagnosticExperiment?.input).toEqual(input);
  expect(result.record.toolActivity?.filter(item => item.outcome.includes('Rejected'))).toHaveLength(1);
});

it.each([
  'legacy-assessment', 'legacy-selection', 'legacy-conflict', 'course-assessment',
  'multiple-assessments', 'multiple-selections', 'multiple-preferences', 'null-array', 'unresolved-preference',
] as const)('rejects incompatible or nullable legacy finish arguments: %s', async failure => {
  const state = fixture(), valid = finishToolArgs(decision(state, 'keep-current'));
  let invalid: Record<string, unknown> = { ...valid };
  if (failure === 'legacy-assessment') invalid.assessmentId = null;
  if (failure === 'legacy-selection') invalid.selectedLessonId = null;
  if (failure === 'course-assessment') invalid.assessmentIds = ['alpha'];
  if (failure === 'multiple-assessments') invalid.assessmentIds = ['alpha', 'beta'];
  if (failure === 'multiple-selections') invalid.selectedLessonIds = ['parallel-nodes', 'series-contrast'];
  if (failure === 'null-array') invalid.selectedLessonIds = null;
  if (failure === 'legacy-conflict' || failure === 'multiple-preferences' || failure === 'unresolved-preference') {
    invalid = { ...invalid, decision: 'needs-evidence', conflicts: [{ sourceIds: ['syllabus', 'update'], reason: 'These original synthetic source statements remain unresolved.', resolution: 'unresolved',
      preferredSourceIds: failure === 'multiple-preferences' ? ['update', 'syllabus'] : failure === 'unresolved-preference' ? ['update'] : [],
      ...(failure === 'legacy-conflict' ? { preferredSourceId: null } : {}),
    }] };
  }
  const fetcher = script([readUpdate, followSyllabus,
    { name: 'finish_investigation', args: invalid },
    body => {
      expect(lastToolOutput(body).accepted).toBe(false);
      return { name: 'finish_investigation', args: valid };
    },
  ]);
  const result = await investigateWithSpark(state, request);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(result.record).toMatchObject({ decision: 'keep-current', assessmentId: null, conflicts: [] });
  expect(result.selectedLessonId).toBeUndefined();
  expect(result.record.toolActivity?.filter(item => item.outcome.includes('Rejected'))).toHaveLength(1);
  expect(publishInvestigation(state, result).recommendedLessonId).toBe(state.recommendedLessonId);
  const sent = JSON.parse(fetcher.mock.calls[0][1]!.body as string) as { tools: { name: string; parameters: { properties: Record<string, unknown> } }[] };
  const schema = sent.tools.find(tool => tool.name === 'finish_investigation')!.parameters;
  expect(schema.properties).not.toHaveProperty('assessmentId');
  expect(schema.properties).not.toHaveProperty('selectedLessonId');
  expect(schema.properties.assessmentIds).toMatchObject({ type: 'array', maxItems: 1 });
  expect(schema.properties.selectedLessonIds).toMatchObject({ type: 'array', maxItems: 1 });
});
