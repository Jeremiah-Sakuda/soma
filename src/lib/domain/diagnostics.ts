import { z } from 'zod';
import { calculateCircuit } from './circuit';
import { isSupportedCircuitRequest } from './support';
import type { Attempt, WorkspaceState } from './types';

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const boundedText = (max: number) => z.string().trim().min(10).max(max);
const circuitInput = z.strictObject({ topology: z.enum(['series', 'parallel']), voltage: z.number().min(0).max(24), r1: z.number().min(1).max(100), r2: z.number().min(1).max(100) });
const experimentSchema = z.strictObject({
  baseline: circuitInput, change: z.strictObject({ parameter: z.enum(['r1', 'r2', 'voltage']), value: z.number().finite() }),
  observable: z.enum(['current1', 'current2', 'voltage1', 'voltage2']),
  predictions: z.array(z.strictObject({ hypothesisId: identifier, claim: boundedText(400), predictedValue: z.number().min(0).max(24) })).length(2),
}).refine(input => input.predictions[0].hypothesisId !== input.predictions[1].hypothesisId, 'Experiment hypotheses must be distinct.');
export type DiagnosticExperimentInput = z.infer<typeof experimentSchema>;
export type DiagnosticExperimentResult = ReturnType<typeof evaluateDiagnosticExperiment>;

/** Application-owned numerical check. A supported difference in predictions is not evidence about a learner. */
export function evaluateDiagnosticExperiment(raw: unknown) {
  const input = experimentSchema.parse(raw);
  const changed = { ...input.baseline, [input.change.parameter]: input.change.value };
  const before = calculateCircuit(input.baseline), after = calculateCircuit(changed);
  const actual = after[input.observable], tolerance = Math.max(1e-8, Math.abs(actual) * 1e-6);
  const errors = input.predictions.map(prediction => Math.abs(prediction.predictedValue - actual));
  const separation = Math.abs(input.predictions[0].predictedValue - input.predictions[1].predictedValue);
  const margin = Math.abs(errors[0] - errors[1]);
  const matches = input.predictions.filter((_prediction, index) => errors[index] <= tolerance).map(prediction => prediction.hypothesisId);
  const unchangedInput = input.baseline[input.change.parameter] === input.change.value;
  const unpowered = input.baseline.voltage === 0 && changed.voltage === 0;
  const informative = !unchangedInput && !unpowered && separation > 2 * tolerance && matches.length === 1 && margin > tolerance;
  return {
    id: `experiment-${crypto.randomUUID()}`, input, before, after, changed, observable: input.observable,
    observedBefore: before[input.observable], observedAfter: actual, margin, predictionSeparation: separation, tolerance,
    informative, compatibleHypothesisIds: matches, reviewStatus: 'development-preview; source fit and independent scientific review pending' as const,
    reason: unchangedInput ? 'The proposed parameter did not change.' : unpowered ? 'Both configurations have zero source voltage; this does not distinguish the intended resistor explanations.' : separation <= 2 * tolerance ? 'The predictions are indistinguishable within the declared numerical tolerance.' : matches.length !== 1 ? 'The calculated outcome does not uniquely match one proposed prediction; revise the experiment or hypotheses.' : 'The calculated outcome separates the proposed predictions. This checks an experiment, not learner understanding.',
  };
}
export const experimentTool = {
  type: 'function', name: 'evaluate_experiment', strict: true,
  description: 'Check one proposed experiment in the existing ideal DC two-resistor family. Choose a baseline, change exactly one parameter, and supply two competing numerical predictions. Use feedback to revise an uninformative experiment before proposing a diagnostic. No learner evidence is written.',
  parameters: { type: 'object', properties: {
    baseline: { type: 'object', properties: { topology: { type: 'string', enum: ['series', 'parallel'] }, voltage: { type: 'number', minimum: 0, maximum: 24 }, r1: { type: 'number', minimum: 1, maximum: 100 }, r2: { type: 'number', minimum: 1, maximum: 100 } }, required: ['topology', 'voltage', 'r1', 'r2'], additionalProperties: false },
    change: { type: 'object', properties: { parameter: { type: 'string', enum: ['r1', 'r2', 'voltage'] }, value: { type: 'number' } }, required: ['parameter', 'value'], additionalProperties: false },
    observable: { type: 'string', enum: ['current1', 'current2', 'voltage1', 'voltage2'] },
    predictions: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', properties: { hypothesisId: { type: 'string' }, claim: { type: 'string', minLength: 10, maxLength: 400 }, predictedValue: { type: 'number', minimum: 0, maximum: 24 } }, required: ['hypothesisId', 'claim', 'predictedValue'], additionalProperties: false } },
  }, required: ['baseline', 'change', 'observable', 'predictions'], additionalProperties: false },
} as const;

export type DiagnosticHypothesisStatus = 'plausible' | 'weakened' | 'supported' | 'unresolved';
const evidenceSchema = z.strictObject({ sourceId: identifier, version: z.number().int().positive(), quote: z.string().min(20).max(500) });
export const diagnosticPlanSchema = z.strictObject({
  kind: z.enum(['text', 'circuit-experiment']), experimentRunId: identifier.nullable(),
  hypotheses: z.array(z.strictObject({ id: identifier, claim: boundedText(400), evidence: z.array(evidenceSchema).min(1).max(4), attemptIds: z.array(identifier).max(6) })).length(2),
  question: boundedText(1000), options: z.array(z.string().trim().min(1).max(400)).min(3).max(4),
  predictions: z.array(z.strictObject({ hypothesisId: identifier, predictedOptionIndex: z.number().int().min(0).max(3) })).length(2),
  rationale: boundedText(600), nextActivity: boundedText(500),
}).superRefine((plan, context) => {
  const unique = (values: string[]) => new Set(values).size === values.length;
  if (!unique(plan.hypotheses.map(hypothesis => hypothesis.id)) || !unique(plan.predictions.map(prediction => prediction.hypothesisId))) context.addIssue({ code: 'custom', message: 'Two distinct hypotheses and prediction mappings are required.' });
  if (!unique(plan.hypotheses.map(hypothesis => hypothesis.claim.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase()))) context.addIssue({ code: 'custom', message: 'Competing hypotheses need distinct claims.' });
  if (!unique(plan.options.map(option => option.normalize('NFKC').replace(/\s+/g, ' ').toLowerCase()))) context.addIssue({ code: 'custom', message: 'Diagnostic options must be distinct.' });
  if (plan.predictions.some(prediction => !plan.hypotheses.some(hypothesis => hypothesis.id === prediction.hypothesisId) || prediction.predictedOptionIndex >= plan.options.length) || plan.predictions[0].predictedOptionIndex === plan.predictions[1].predictedOptionIndex) context.addIssue({ code: 'custom', message: 'The two hypotheses must predict different available options.' });
  if ((plan.kind === 'text') !== (plan.experimentRunId === null)) context.addIssue({ code: 'custom', message: 'Only circuit diagnostics reference an evaluated experiment.' });
});
export type DiagnosticPlan = z.infer<typeof diagnosticPlanSchema>;
export type ValidatedDiagnosticPlan = Omit<DiagnosticPlan, 'hypotheses'> & { courseId: string; hypotheses: (DiagnosticPlan['hypotheses'][number] & { status: DiagnosticHypothesisStatus })[] };
// Zod provides the JSON schema from the same bounded input contract; refinement invariants remain application checks.
export const diagnosticTool = { type: 'function', name: 'prepare_diagnostic', strict: true, description: 'Propose two plausible, revisable explanations grounded in current read passages and optional recorded same-course attempts. Choose a diagnostic whose predicted responses differ and explain the next activity. Text diagnostics support actual course concepts. Circuit experiments must reference a prior informative evaluate_experiment result. No mastery or learning-record writes.', parameters: z.toJSONSchema(diagnosticPlanSchema) } as const;

export type DiagnosticReadSource = { version: number; body?: string; segments?: { offset: number; body: string }[] };
function disclosedSegments(read: DiagnosticReadSource) {
  return read.segments ?? (read.body === undefined ? [] : [{ offset: 0, body: read.body }]);
}

export function validateDiagnosticPlan(raw: unknown, state: WorkspaceState, courseId: string, readSources: ReadonlyMap<string, DiagnosticReadSource>, experimentRuns: ReadonlyMap<string, DiagnosticExperimentResult> = new Map()): ValidatedDiagnosticPlan {
  const plan = diagnosticPlanSchema.parse(raw);
  if ([...readSources.values()].reduce((total, read) => total + disclosedSegments(read).length, 0) > 8) throw new Error('Diagnostic investigation exceeds the eight-page read budget.');
  if (!state.courses.some(course => course.id === courseId)) throw new Error('Diagnostic course is outside this workspace.');
  for (const hypothesis of plan.hypotheses) {
    if (new Set(hypothesis.attemptIds).size !== hypothesis.attemptIds.length) throw new Error('Duplicate attempt reference.');
    for (const attemptId of hypothesis.attemptIds) {
      const attempt = state.attempts.find(item => item.id === attemptId);
      if (!attempt || !state.lessons.some(lesson => lesson.id === attempt.lessonId && lesson.courseId === courseId && lesson.version === attempt.lessonVersion)) throw new Error('Diagnostic attempt is outside this course or lesson version.');
    }
    for (const evidence of hypothesis.evidence) {
      const versions = state.sources.filter(source => source.id === evidence.sourceId);
      const source = versions.find(item => item.courseId === courseId && item.status === 'current' && item.version === evidence.version);
      const disclosed = readSources.get(evidence.sourceId);
      const segments = disclosed ? disclosedSegments(disclosed) : [];
      if (!source || versions.filter(item => item.status === 'current').length !== 1 || versions.some(item => item.courseId !== courseId || item.version > evidence.version) || !disclosed || disclosed.version !== evidence.version || !segments.length || segments.some(segment => !Number.isSafeInteger(segment.offset) || segment.offset < 0 || !segment.body || segment.body.length > 4000 || source.body.slice(segment.offset, segment.offset + segment.body.length) !== segment.body) || !segments.some(segment => segment.body.includes(evidence.quote))) throw new Error('Diagnostic evidence must quote an authorized, current, actually read source version.');
    }
  }
  if (plan.kind === 'circuit-experiment') {
    if (!plan.hypotheses.some(hypothesis => hypothesis.evidence.some(evidence => isSupportedCircuitRequest(evidence.quote)))) throw new Error('A circuit diagnostic needs a cited passage supporting the approved resistor family.');
    const run = experimentRuns.get(plan.experimentRunId!);
    if (!run || run.id !== plan.experimentRunId || !run.informative || !plan.hypotheses.every(hypothesis => run.input.predictions.some(prediction => prediction.hypothesisId === hypothesis.id && prediction.claim === hypothesis.claim))) throw new Error('Circuit diagnostics require a previously evaluated informative experiment for these hypotheses.');
  }
  return { ...plan, courseId, hypotheses: plan.hypotheses.map(hypothesis => ({ ...hypothesis, status: 'plausible' })) };
}

/** Only a persisted response to this exact diagnostic may revise its competing explanations. */
export function reviseHypothesesFromAttempt(plan: ValidatedDiagnosticPlan, attempt: Attempt, state: WorkspaceState) {
  const recorded = state.attempts.find(item => item.id === attempt.id);
  const lesson = recorded && state.lessons.find(item => item.id === recorded.lessonId && item.courseId === plan.courseId && item.version === recorded.lessonVersion);
  if (!recorded || JSON.stringify(recorded) !== JSON.stringify(attempt) || !lesson || lesson.question !== plan.question || JSON.stringify(lesson.options) !== JSON.stringify(plan.options) || recorded.question !== plan.question || recorded.modelVersion !== lesson.modelVersion) throw new Error('A saved response to this exact diagnostic is required.');
  for (const evidence of plan.hypotheses.flatMap(hypothesis => hypothesis.evidence)) if (lesson.sourceVersions[evidence.sourceId] !== evidence.version || recorded.sourceVersions?.[evidence.sourceId] !== evidence.version || !state.sources.some(source => source.id === evidence.sourceId && source.courseId === plan.courseId && source.version === evidence.version && source.status === 'current') || state.sources.some(source => source.id === evidence.sourceId && source.version > evidence.version)) throw new Error('Diagnostic source versions no longer match the saved response.');
  const optionIndex = plan.options.indexOf(recorded.response);
  if (optionIndex < 0) throw new Error('Saved response does not match a diagnostic option.');
  const support = recorded.assisted || recorded.assistance.length > 0 || (lesson.kind === 'circuit' && recorded.exposure !== 'fresh-no-diagram');
  const independentlyObserved = recorded.novel && !recorded.revisionOf && !support;
  const predicted = plan.predictions.find(prediction => prediction.predictedOptionIndex === optionIndex);
  return {
    attemptId: recorded.id, observedAt: recorded.createdAt, provisional: true as const,
    observation: { lessonId: recorded.lessonId, lessonVersion: recorded.lessonVersion, modelVersion: recorded.modelVersion, response: recorded.response, optionIndex, assisted: recorded.assisted, assistance: [...recorded.assistance], novel: recorded.novel, exposure: recorded.exposure ?? 'unknown', revisionOf: recorded.revisionOf ?? null, sourceVersions: { ...recorded.sourceVersions } },
    evidenceConstraint: 'Use this original observation to reconsider the explanations. Provisional statuses may be revised; no mastery, causal diagnosis, or external-help absence is established.',
    hypotheses: plan.hypotheses.map(hypothesis => ({ ...hypothesis, status: (!independentlyObserved || !predicted ? 'unresolved' : predicted.hypothesisId === hypothesis.id ? 'supported' : 'weakened') as DiagnosticHypothesisStatus })),
    reason: !independentlyObserved ? 'Recorded support, prior exposure, or a revision prevents distinguishing these explanations independently.' : !predicted ? 'The response matches neither predicted choice; both explanations remain unresolved.' : 'This single novel response without recorded support is consistent with one prediction and weakens the competing explanation. This is provisional, not mastery or retention evidence.',
    nextActivity: plan.nextActivity,
  };
}
