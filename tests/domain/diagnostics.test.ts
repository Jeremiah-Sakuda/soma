import { describe, expect, it } from 'vitest';
import { diagnosticPlanSchema, evaluateDiagnosticExperiment, reviseHypothesesFromAttempt, validateDiagnosticPlan } from '../../src/lib/domain/diagnostics';
import { seedWorkspace } from '../../src/lib/domain/seed';
import type { Attempt } from '../../src/lib/domain/types';
const now = '2026-10-26T15:00:00.000Z';
const state = () => seedWorkspace('diagnostic-test', now);
const plan = () => ({ kind: 'text' as const, experimentRunId: null,
  hypotheses: [
    { id: 'h-rule', claim: 'The learner applies the independence product rule.', evidence: [{ sourceId: 'source-probability', version: 1, quote: 'For independent events A and B, P(A and B) = P(A) × P(B).' }], attemptIds: [] as string[] },
    { id: 'h-equal', claim: 'The learner conflates independence and equal probabilities.', evidence: [{ sourceId: 'source-probability', version: 1, quote: 'Independence does not mean equal probabilities.' }], attemptIds: [] as string[] },
  ], question: 'Independent events have unequal probabilities. Which statement follows?', options: ['Multiply the two probabilities for both events.', 'The probabilities must actually be equal.', 'Nothing can be concluded.'],
  predictions: [{ hypothesisId: 'h-rule', predictedOptionIndex: 0 }, { hypothesisId: 'h-equal', predictedOptionIndex: 1 }],
  rationale: 'The choices separate applying independence from assuming equality.', nextActivity: 'Compare the chosen explanation with the cited source and request another application.',
});
const read = () => new Map([['source-probability', { version: 1, body: state().sources.find(source => source.id === 'source-probability')!.body }]]);
const experiment = () => ({ baseline: { topology: 'parallel', voltage: 12, r1: 6, r2: 3 }, change: { parameter: 'r2', value: 6 }, observable: 'current2', predictions: [{ hypothesisId: 'h-rule', claim: 'The branch current follows voltage divided by resistance.', predictedValue: 2 }, { hypothesisId: 'h-equal', claim: 'The branch current stays fixed when its resistance changes.', predictedValue: 4 }] });
function withResponse(option = 0) {
  const workspace = state(), diagnostic = validateDiagnosticPlan(plan(), workspace, 'probability', read());
  const lesson = workspace.lessons.find(item => item.courseId === 'probability')!;
  lesson.question = diagnostic.question; lesson.options = [...diagnostic.options];
  const attempt: Attempt = { id: 'diagnostic-attempt', lessonId: lesson.id, lessonVersion: lesson.version, modelVersion: lesson.modelVersion, question: lesson.question, response: lesson.options[option], correct: option === 0, assisted: false, assistance: [], createdAt: now, novel: true, feedback: 'Provisional recorded response.', sourceVersions: { ...lesson.sourceVersions } };
  workspace.attempts.push(attempt); return { workspace, diagnostic, attempt };
}
describe('deterministic diagnostic experiment feedback', () => {
  it('checks a model-selected single change against independently derived branch currents', () => {
    const input = experiment(), original = structuredClone(input), result = evaluateDiagnosticExperiment(input);
    expect(result.before.current2).toBe(4); expect(result.after.current2).toBe(2); expect(result.after.current1).toBe(2);
    expect(result.margin).toBe(2); expect(result.informative).toBe(true); expect(result.compatibleHypothesisIds).toEqual(['h-rule']);
    expect(result.reviewStatus).toContain('review pending'); expect(input).toEqual(original);
  });
  it('rejects unchanged controls, zero-power experiments and identical predictions as uninformative', () => {
    expect(evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'r2', value: 3 } }).informative).toBe(false);
    expect(evaluateDiagnosticExperiment({ ...experiment(), baseline: { ...experiment().baseline, voltage: 0 } }).informative).toBe(false);
    expect(evaluateDiagnosticExperiment({ ...experiment(), predictions: experiment().predictions.map(item => ({ ...item, predictedValue: 2 })) }).informative).toBe(false);
  });
  it('does not equate merely different predictions with a useful separating experiment', () => {
    const result = evaluateDiagnosticExperiment({ ...experiment(), predictions: [{ ...experiment().predictions[0], predictedValue: 1 }, { ...experiment().predictions[1], predictedValue: 3 }] });
    expect(result.informative).toBe(false); expect(result.margin).toBe(0); expect(result.compatibleHypothesisIds).toEqual([]);
    const nearlySame = evaluateDiagnosticExperiment({ ...experiment(), predictions: [{ ...experiment().predictions[0], predictedValue: 2 }, { ...experiment().predictions[1], predictedValue: 2.0000001 }] });
    expect(nearlySame.informative).toBe(false);
  });
  it('keeps the approved model limits and rejects extra controls or executable payloads', () => {
    expect(() => evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'r2', value: 0 } })).toThrow();
    expect(() => evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'voltage', value: 25 } })).toThrow();
    expect(() => evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'topology', value: 1 } })).toThrow();
    expect(() => evaluateDiagnosticExperiment({ ...experiment(), code: 'run arbitrary code' })).toThrow();
  });
});
describe('diagnostic plan ownership and provenance', () => {
  it('validates a text diagnostic for a real course concept without requiring a simulator', () => {
    const validated = validateDiagnosticPlan(plan(), state(), 'probability', read());
    expect(validated.hypotheses.map(item => item.status)).toEqual(['plausible', 'plausible']);
    expect(validated.kind).toBe('text'); expect(validated.experimentRunId).toBeNull();
  });
  it('requires distinct predicted choices and distinct options, with no evidence writes', () => {
    expect(diagnosticPlanSchema.safeParse({ ...plan(), predictions: plan().predictions.map(item => ({ ...item, predictedOptionIndex: 0 })) }).success).toBe(false);
    expect(diagnosticPlanSchema.safeParse({ ...plan(), options: ['Same', ' SAME ', 'Other'] }).success).toBe(false);
    expect(diagnosticPlanSchema.safeParse({ ...plan(), mastery: true }).success).toBe(false);
    expect(diagnosticPlanSchema.safeParse({ ...plan(), hypotheses: plan().hypotheses.map(item => ({ ...item, status: 'supported' })) }).success).toBe(false);
  });
  it('rejects unread, stale, foreign-course or undisclosed evidence and foreign attempts', () => {
    expect(() => validateDiagnosticPlan(plan(), state(), 'probability', new Map())).toThrow();
    expect(() => validateDiagnosticPlan(plan(), state(), 'writing', read())).toThrow();
    const stale = state(); stale.sources.find(source => source.id === 'source-probability')!.version = 2;
    expect(() => validateDiagnosticPlan(plan(), stale, 'probability', read())).toThrow();
    const foreign = plan(); foreign.hypotheses[0].attemptIds = ['someone-elses-attempt'];
    expect(() => validateDiagnosticPlan(foreign, state(), 'probability', read())).toThrow();
    expect(() => validateDiagnosticPlan(plan(), state(), 'probability', new Map([['source-probability', { version: 1, body: 'For independent events A and B,' }]]))).toThrow();
  });
  it('requires an existing informative test result tied to these exact hypotheses', () => {
    const result = evaluateDiagnosticExperiment(experiment());
    const courseSource = state().sources.find(source => source.id === 'source-d')!;
    const circuitReads = new Map([[courseSource.id, { version: courseSource.version, body: courseSource.body }]]);
    const circuit = { ...plan(), kind: 'circuit-experiment', experimentRunId: result.id,
      hypotheses: plan().hypotheses.map((hypothesis, index) => ({ ...hypothesis, claim: result.input.predictions[index].claim, evidence: [{ sourceId: courseSource.id, version: 1, quote: 'For ideal resistors, voltage drop equals current times resistance.' }] })),
      question: 'What happens to branch current when its resistance doubles at fixed voltage?', options: ['It halves.', 'It remains the same.', 'It doubles.'],
    };
    expect(() => validateDiagnosticPlan(circuit, state(), 'circuits', circuitReads)).toThrow();
    expect(validateDiagnosticPlan(circuit, state(), 'circuits', circuitReads, new Map([[result.id, result]])).experimentRunId).toBe(result.id);
    expect(() => validateDiagnosticPlan({ ...plan(), kind: 'circuit-experiment', experimentRunId: result.id }, state(), 'probability', read(), new Map([[result.id, result]]))).toThrow();
    const weak = evaluateDiagnosticExperiment({ ...experiment(), change: { parameter: 'r2', value: 3 } });
    expect(() => validateDiagnosticPlan({ ...circuit, experimentRunId: weak.id }, state(), 'circuits', circuitReads, new Map([[weak.id, weak]]))).toThrow();
    const changed = { ...circuit, hypotheses: circuit.hypotheses.map(item => ({ ...item, claim: 'A different explanation never tested.' })) };
    expect(() => validateDiagnosticPlan(changed, state(), 'circuits', circuitReads, new Map([[result.id, result]]))).toThrow();
  });
});
describe('revisable interpretation from actual observations', () => {
  it('uses the recorded choice rather than its correctness flag and preserves original records', () => {
    const { workspace, diagnostic, attempt } = withResponse(1), before = structuredClone(workspace);
    const revised = reviseHypothesesFromAttempt(diagnostic, attempt, workspace);
    expect(revised.hypotheses.map(item => item.status)).toEqual(['weakened', 'supported']);
    expect(revised.provisional).toBe(true); expect(revised.observedAt).toBe(now); expect(revised.reason).toContain('not mastery'); expect(workspace).toEqual(before);
    expect(diagnostic.hypotheses.every(item => item.status === 'plausible')).toBe(true);
  });
  it.each(['assisted', 'repeated', 'revised', 'unlisted-response'])('keeps %s evidence unresolved', variant => {
    const { workspace, diagnostic, attempt } = withResponse(variant === 'unlisted-response' ? 2 : 0);
    if (variant === 'assisted') { attempt.assistance = ['hint']; attempt.assisted = true; }
    if (variant === 'repeated') attempt.novel = false;
    if (variant === 'revised') attempt.revisionOf = 'original';
    expect(reviseHypothesesFromAttempt(diagnostic, attempt, workspace).hypotheses.every(item => item.status === 'unresolved')).toBe(true);
  });
  it('rejects fabricated responses, altered lesson mappings and stale source versions', () => {
    const { workspace, diagnostic, attempt } = withResponse();
    expect(() => reviseHypothesesFromAttempt(diagnostic, { ...attempt, response: diagnostic.options[1] }, workspace)).toThrow();
    workspace.lessons.find(item => item.id === attempt.lessonId)!.options.reverse();
    expect(() => reviseHypothesesFromAttempt(diagnostic, attempt, workspace)).toThrow();
    const next = withResponse(); next.workspace.sources.find(source => source.id === 'source-probability')!.status = 'stale';
    expect(() => reviseHypothesesFromAttempt(next.diagnostic, next.attempt, next.workspace)).toThrow();
  });
});
