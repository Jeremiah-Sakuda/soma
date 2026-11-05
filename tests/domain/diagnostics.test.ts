import { describe, expect, it } from 'vitest';
import {
  diagnosticPlanSchema,
  evaluateDiagnosticExperiment,
  recheckDiagnosticExperimentInput,
  reviseHypothesesFromAttempt,
  validateDiagnosticPlan,
} from '../../src/lib/domain/diagnostics';
import { seedWorkspace } from '../../src/lib/domain/seed';
import type { Attempt } from '../../src/lib/domain/types';
const now = '2026-10-26T15:00:00.000Z';
const state = () => seedWorkspace('diagnostic-test', now);
const plan = () => ({
  kind: 'text' as const,
  experimentRunId: null,
  hypotheses: [
    {
      id: 'h-rule',
      claim: 'The learner applies the independence product rule.',
      evidence: [
        {
          sourceId: 'source-probability',
          version: 1,
          quote: 'For independent events A and B, P(A and B) = P(A) × P(B).',
        },
      ],
      attemptIds: [] as string[],
    },
    {
      id: 'h-equal',
      claim: 'The learner conflates independence and equal probabilities.',
      evidence: [
        {
          sourceId: 'source-probability',
          version: 1,
          quote: 'Independence does not mean equal probabilities.',
        },
      ],
      attemptIds: [] as string[],
    },
  ],
  question: 'Independent events have unequal probabilities. Which statement follows?',
  options: [
    'Multiply the two probabilities for both events.',
    'The probabilities must actually be equal.',
    'Nothing can be concluded.',
  ],
  predictions: [
    { hypothesisId: 'h-rule', predictedOptionIndex: 0 },
    { hypothesisId: 'h-equal', predictedOptionIndex: 1 },
  ],
  rationale: 'The choices separate applying independence from assuming equality.',
  nextActivity:
    'Compare the chosen explanation with the cited source and request another application.',
});
const read = () =>
  new Map([
    [
      'source-probability',
      {
        version: 1,
        body: state().sources.find((source) => source.id === 'source-probability')!.body,
      },
    ],
  ]);
const experiment = () => ({
  baseline: { topology: 'parallel', voltage: 12, r1: 6, r2: 3 },
  change: { parameter: 'r2', value: 6 },
  observable: 'current2',
  predictions: [
    {
      hypothesisId: 'h-rule',
      claim: 'The branch current follows voltage divided by resistance.',
      predictionForm: 'checked-model',
    },
    {
      hypothesisId: 'h-equal',
      claim: 'The branch current stays fixed when its resistance changes.',
      predictionForm: 'unchanged',
    },
  ],
});
function withResponse(option = 0) {
  const workspace = state(),
    diagnostic = validateDiagnosticPlan(plan(), workspace, 'probability', read());
  const lesson = workspace.lessons.find((item) => item.courseId === 'probability')!;
  lesson.question = diagnostic.question;
  lesson.options = [...diagnostic.options];
  const attempt: Attempt = {
    id: 'diagnostic-attempt',
    lessonId: lesson.id,
    lessonVersion: lesson.version,
    modelVersion: lesson.modelVersion,
    question: lesson.question,
    response: lesson.options[option],
    correct: option === 0,
    assisted: false,
    assistance: [],
    createdAt: now,
    novel: true,
    feedback: 'Provisional recorded response.',
    sourceVersions: { ...lesson.sourceVersions },
  };
  workspace.attempts.push(attempt);
  return { workspace, diagnostic, attempt };
}
describe('deterministic diagnostic experiment feedback', () => {
  it('checks a model-selected single change against independently derived branch currents', () => {
    const input = experiment(),
      original = structuredClone(input),
      result = evaluateDiagnosticExperiment(input);
    expect(result.before.current2).toBe(4);
    expect(result.after.current2).toBe(2);
    expect(result.after.current1).toBe(2);
    expect(result.margin).toBe(2);
    expect(result.informative).toBe(true);
    expect(result.compatibleHypothesisIds).toEqual(['h-rule']);
    expect(result.reviewStatus).toContain('review pending');
    expect(input).toEqual(original);
  });
  it('rejects unchanged controls, zero-power experiments and identical predictions as uninformative', () => {
    expect(
      evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'r2', value: 3 } })
        .informative,
    ).toBe(false);
    expect(
      evaluateDiagnosticExperiment({
        ...experiment(),
        baseline: { ...experiment().baseline, voltage: 0 },
      }).informative,
    ).toBe(false);
    expect(
      evaluateDiagnosticExperiment({
        ...experiment(),
        predictions: experiment().predictions.map((item) => ({
          ...item,
          predictionForm: 'checked-model',
        })),
      }).informative,
    ).toBe(false);
  });
  it('computes each approved illustrative form instead of accepting free model numbers', () => {
    const equalCurrent = evaluateDiagnosticExperiment({
      ...experiment(),
      predictions: [
        experiment().predictions[0],
        { ...experiment().predictions[1], predictionForm: 'equal-branch-current' },
      ],
    });
    expect(equalCurrent.input.predictions.map((item) => item.predictedValue)).toEqual([2, 2]);
    expect(equalCurrent.informative).toBe(false);
    const splitVoltage = evaluateDiagnosticExperiment({
      baseline: { topology: 'series', voltage: 12, r1: 2, r2: 4 },
      change: { parameter: 'r1', value: 8 },
      observable: 'voltage1',
      predictions: [
        { ...experiment().predictions[0], predictionForm: 'checked-model' },
        { ...experiment().predictions[1], predictionForm: 'equal-voltage-drop' },
      ],
    });
    expect(splitVoltage.input.predictions.map((item) => item.predictedValue)).toEqual([8, 6]);
    expect(splitVoltage.unit).toBe('V');
    expect(splitVoltage.informative).toBe(true);
    expect(splitVoltage.diagnosticOptions).toEqual(['8 V', '6 V', 'A different value.']);
    for (const prediction of [
      { ...experiment().predictions[0], predictedValue: 1 },
      {
        hypothesisId: 'h-rule',
        claim: 'A model supplied free numerical prediction.',
        predictedValue: 2,
      },
      { ...experiment().predictions[0], predictionForm: 'custom-equation' },
    ])
      expect(() =>
        evaluateDiagnosticExperiment({
          ...experiment(),
          predictions: [prediction, experiment().predictions[1]],
        }),
      ).toThrow();
    expect(() =>
      evaluateDiagnosticExperiment({
        ...experiment(),
        predictions: [
          experiment().predictions[0],
          { ...experiment().predictions[1], predictionForm: 'equal-voltage-drop' },
        ],
      }),
    ).toThrow(/series/);
  });
  it('rejects comparisons that collapse into the same displayed quantity despite numeric separation', () => {
    const result = evaluateDiagnosticExperiment({
      ...experiment(),
      baseline: { topology: 'parallel', voltage: 12.00004, r1: 1, r2: 2 },
      change: { parameter: 'voltage', value: 12.00001 },
      observable: 'current1',
    });
    expect(result.predictionSeparation).toBeGreaterThan(2 * result.tolerance);
    expect(result.diagnosticOptions[0]).toBe(result.diagnosticOptions[1]);
    expect(result.informative).toBe(false);
  });
  it('rechecks persisted approved forms without trusting stored scalar values, preserving legacy artifacts as unsupported', () => {
    const result = evaluateDiagnosticExperiment(experiment());
    const tampered = structuredClone(result.input);
    tampered.predictions[0].predictedValue = 999;
    expect(recheckDiagnosticExperimentInput(tampered).input.predictions[0].predictedValue).toBe(2);
    const legacy = {
      ...result.input,
      predictions: result.input.predictions.map(({ predictionForm: _form, ...item }) => item),
    };
    expect(() => recheckDiagnosticExperimentInput(legacy)).toThrow();
  });
  it('keeps the approved model limits and rejects extra controls or executable payloads', () => {
    expect(() =>
      evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'r2', value: 0 } }),
    ).toThrow();
    expect(() =>
      evaluateDiagnosticExperiment({
        ...experiment(),
        change: { parameter: 'voltage', value: 25 },
      }),
    ).toThrow();
    expect(() =>
      evaluateDiagnosticExperiment({
        ...experiment(),
        change: { parameter: 'topology', value: 1 },
      }),
    ).toThrow();
    expect(() =>
      evaluateDiagnosticExperiment({ ...experiment(), code: 'run arbitrary code' }),
    ).toThrow();
  });
});
describe('diagnostic plan ownership and provenance', () => {
  it('validates a text diagnostic for a real course concept without requiring a simulator', () => {
    const validated = validateDiagnosticPlan(plan(), state(), 'probability', read());
    expect(validated.hypotheses.map((item) => item.status)).toEqual(['plausible', 'plausible']);
    expect(validated.kind).toBe('text');
    expect(validated.experimentRunId).toBeNull();
  });
  it('requires distinct predicted choices and distinct options, with no evidence writes', () => {
    expect(
      diagnosticPlanSchema.safeParse({
        ...plan(),
        predictions: plan().predictions.map((item) => ({ ...item, predictedOptionIndex: 0 })),
      }).success,
    ).toBe(false);
    expect(
      diagnosticPlanSchema.safeParse({ ...plan(), options: ['Same', ' SAME ', 'Other'] }).success,
    ).toBe(false);
    expect(diagnosticPlanSchema.safeParse({ ...plan(), mastery: true }).success).toBe(false);
    expect(
      diagnosticPlanSchema.safeParse({
        ...plan(),
        hypotheses: plan().hypotheses.map((item) => ({ ...item, status: 'supported' })),
      }).success,
    ).toBe(false);
  });
  it('rejects unread, stale, foreign-course or undisclosed evidence and foreign attempts', () => {
    expect(() => validateDiagnosticPlan(plan(), state(), 'probability', new Map())).toThrow();
    expect(() => validateDiagnosticPlan(plan(), state(), 'writing', read())).toThrow();
    const stale = state();
    stale.sources.find((source) => source.id === 'source-probability')!.version = 2;
    expect(() => validateDiagnosticPlan(plan(), stale, 'probability', read())).toThrow();
    const foreign = plan();
    foreign.hypotheses[0].attemptIds = ['someone-elses-attempt'];
    expect(() => validateDiagnosticPlan(foreign, state(), 'probability', read())).toThrow();
    expect(() =>
      validateDiagnosticPlan(
        plan(),
        state(),
        'probability',
        new Map([['source-probability', { version: 1, body: 'For independent events A and B,' }]]),
      ),
    ).toThrow();
  });
  it('accepts evidence actually read after character 4000 with exact offsets', () => {
    const workspace = state(),
      source = workspace.sources.find((item) => item.id === 'source-probability')!;
    const original = source.body;
    source.body = 'Unrelated introduction. '.repeat(220) + original;
    const offset = source.body.length - original.length;
    expect(offset).toBeGreaterThan(4000);
    const pages = new Map([[source.id, { version: 1, segments: [{ offset, body: original }] }]]);
    expect(validateDiagnosticPlan(plan(), workspace, 'probability', pages).hypotheses).toHaveLength(
      2,
    );
    expect(() =>
      validateDiagnosticPlan(
        plan(),
        workspace,
        'probability',
        new Map([[source.id, { version: 1, body: original }]]),
      ),
    ).toThrow();
  });
  it('rejects fabricated, misplaced and oversized source segments even if they contain a supporting quote', () => {
    const workspace = state(),
      source = workspace.sources.find((item) => item.id === 'source-probability')!;
    for (const segment of [
      { offset: 1, body: source.body },
      { offset: -1, body: source.body },
      { offset: 0.5, body: source.body },
      { offset: 0, body: source.body + ' Fabricated extra material.' },
      { offset: 0, body: 'x'.repeat(4001) + source.body },
    ]) {
      expect(() =>
        validateDiagnosticPlan(
          plan(),
          workspace,
          'probability',
          new Map([[source.id, { version: 1, segments: [segment] }]]),
        ),
      ).toThrow();
    }
  });
  it('does not concatenate separately read pages into an undisclosed quotation', () => {
    const workspace = state(),
      source = workspace.sources.find((item) => item.id === 'source-probability')!;
    const split = 25;
    const pages = new Map([
      [
        source.id,
        {
          version: 1,
          segments: [
            { offset: 0, body: source.body.slice(0, split) },
            { offset: split, body: source.body.slice(split) },
          ],
        },
      ],
    ]);
    expect(() => validateDiagnosticPlan(plan(), workspace, 'probability', pages)).toThrow();
  });
  it('enforces the total eight-segment job budget across the supplied read ledger', () => {
    const workspace = state(),
      source = workspace.sources.find((item) => item.id === 'source-probability')!;
    const pages = new Map([
      [
        source.id,
        {
          version: 1,
          segments: Array.from({ length: 8 }, () => ({ offset: 0, body: source.body })),
        },
      ],
    ]);
    expect(validateDiagnosticPlan(plan(), workspace, 'probability', pages).kind).toBe('text');
    pages.set('other-read-source', {
      version: 1,
      segments: [{ offset: 0, body: 'Another actual read counts toward the budget.' }],
    });
    expect(() => validateDiagnosticPlan(plan(), workspace, 'probability', pages)).toThrow(
      /eight-page/,
    );
  });
  it('requires an existing informative test result tied to these exact hypotheses', () => {
    const result = evaluateDiagnosticExperiment(experiment());
    const courseSource = state().sources.find((source) => source.id === 'source-d')!;
    const circuitReads = new Map([
      [courseSource.id, { version: courseSource.version, body: courseSource.body }],
    ]);
    const circuit = {
      ...plan(),
      kind: 'circuit-experiment',
      experimentRunId: result.id,
      hypotheses: plan().hypotheses.map((hypothesis, index) => ({
        ...hypothesis,
        claim: result.input.predictions[index].claim,
        evidence: [
          {
            sourceId: courseSource.id,
            version: 1,
            quote: 'For ideal resistors, voltage drop equals current times resistance.',
          },
        ],
      })),
      question: result.diagnosticQuestion,
      options: result.diagnosticOptions,
      predictions: result.optionMappings,
    };
    expect(() => validateDiagnosticPlan(circuit, state(), 'circuits', circuitReads)).toThrow();
    expect(
      validateDiagnosticPlan(
        circuit,
        state(),
        'circuits',
        circuitReads,
        new Map([[result.id, result]]),
      ).experimentRunId,
    ).toBe(result.id);
    expect(() =>
      validateDiagnosticPlan(
        { ...plan(), kind: 'circuit-experiment', experimentRunId: result.id },
        state(),
        'probability',
        read(),
        new Map([[result.id, result]]),
      ),
    ).toThrow();
    const weak = evaluateDiagnosticExperiment({
      ...experiment(),
      change: { parameter: 'r2', value: 3 },
    });
    expect(() =>
      validateDiagnosticPlan(
        { ...circuit, experimentRunId: weak.id },
        state(),
        'circuits',
        circuitReads,
        new Map([[weak.id, weak]]),
      ),
    ).toThrow();
    expect(() =>
      validateDiagnosticPlan(
        {
          ...circuit,
          question: 'What is the total voltage rather than the checked branch current?',
        },
        state(),
        'circuits',
        circuitReads,
        new Map([[result.id, result]]),
      ),
    ).toThrow(/computed/);
    expect(() =>
      validateDiagnosticPlan(
        { ...circuit, options: ['Wrong labels', 'Wrong units', 'Other'] },
        state(),
        'circuits',
        circuitReads,
        new Map([[result.id, result]]),
      ),
    ).toThrow(/computed/);
    expect(() =>
      validateDiagnosticPlan(
        { ...circuit, predictions: [...circuit.predictions].reverse() },
        state(),
        'circuits',
        circuitReads,
        new Map([[result.id, result]]),
      ),
    ).toThrow(/computed/);
    const changed = {
      ...circuit,
      hypotheses: circuit.hypotheses.map((item) => ({
        ...item,
        claim: 'A different explanation never tested.',
      })),
    };
    expect(() =>
      validateDiagnosticPlan(
        changed,
        state(),
        'circuits',
        circuitReads,
        new Map([[result.id, result]]),
      ),
    ).toThrow();
  });
});
describe('revisable interpretation from actual observations', () => {
  it('uses the recorded choice rather than its correctness flag and preserves original records', () => {
    const { workspace, diagnostic, attempt } = withResponse(1),
      before = structuredClone(workspace);
    const revised = reviseHypothesesFromAttempt(diagnostic, attempt, workspace);
    expect(revised.hypotheses.map((item) => item.status)).toEqual(['weakened', 'supported']);
    expect(revised.provisional).toBe(true);
    expect(revised.observedAt).toBe(now);
    expect(revised.reason).toContain('not mastery');
    expect(workspace).toEqual(before);
    expect(diagnostic.hypotheses.every((item) => item.status === 'plausible')).toBe(true);
  });
  it.each(['assisted', 'repeated', 'revised', 'unlisted-response'])(
    'keeps %s evidence unresolved',
    (variant) => {
      const { workspace, diagnostic, attempt } = withResponse(
        variant === 'unlisted-response' ? 2 : 0,
      );
      if (variant === 'assisted') {
        attempt.assistance = ['hint'];
        attempt.assisted = true;
      }
      if (variant === 'repeated') attempt.novel = false;
      if (variant === 'revised') attempt.revisionOf = 'original';
      expect(
        reviseHypothesesFromAttempt(diagnostic, attempt, workspace).hypotheses.every(
          (item) => item.status === 'unresolved',
        ),
      ).toBe(true);
    },
  );
  it('rejects fabricated responses, altered lesson mappings and stale source versions', () => {
    const { workspace, diagnostic, attempt } = withResponse();
    expect(() =>
      reviseHypothesesFromAttempt(
        diagnostic,
        { ...attempt, response: diagnostic.options[1] },
        workspace,
      ),
    ).toThrow();
    workspace.lessons.find((item) => item.id === attempt.lessonId)!.options.reverse();
    expect(() => reviseHypothesesFromAttempt(diagnostic, attempt, workspace)).toThrow();
    const next = withResponse();
    next.workspace.sources.find((source) => source.id === 'source-probability')!.status = 'stale';
    expect(() =>
      reviseHypothesesFromAttempt(next.diagnostic, next.attempt, next.workspace),
    ).toThrow();
  });
});
