import { z } from 'zod';
import { calculateCircuit } from './circuit';
import { isSupportedCircuitRequest } from './support';
import type { Attempt, WorkspaceState } from './types';

const identifier = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
const boundedText = (max: number) => z.string().trim().min(10).max(max);
const circuitInput = z.strictObject({ topology: z.enum(['series', 'parallel']), voltage: z.number().min(0).max(24), r1: z.number().min(1).max(100), r2: z.number().min(1).max(100) });
const predictionForm = z.enum(['checked-model', 'unchanged', 'equal-branch-current', 'equal-voltage-drop']);
const predictionSchema = z.strictObject({ hypothesisId: identifier, claim: boundedText(400), predictionForm });
const experimentSchema = z.strictObject({
  baseline: circuitInput, change: z.strictObject({ parameter: z.enum(['r1', 'r2', 'voltage']), value: z.number().finite() }),
  observable: z.enum(['current1', 'current2', 'voltage1', 'voltage2']),
  predictions: z.array(predictionSchema).length(2),
}).refine(input => input.predictions[0].hypothesisId !== input.predictions[1].hypothesisId, 'Experiment hypotheses must be distinct.');
/** Older artifacts retain their original values, but cannot enter the checked live path without approved forms. */
export type DiagnosticExperimentInput = Omit<z.infer<typeof experimentSchema>, 'predictions'> & {
  predictions: { hypothesisId: string; claim: string; predictionForm?: z.infer<typeof predictionForm>; predictedValue: number }[];
};
export type DiagnosticExperimentResult = ReturnType<typeof evaluateDiagnosticExperiment>;
const quantity = (value: number, unit: string) => `${Number(value.toPrecision(6))} ${unit}`;

/** Application-owned numerical check. Forms are illustrative competing predictions, never learner facts. */
export function evaluateDiagnosticExperiment(raw: unknown) {
  const proposed = experimentSchema.parse(raw);
  const changed = { ...proposed.baseline, [proposed.change.parameter]: proposed.change.value };
  const before = calculateCircuit(proposed.baseline), after = calculateCircuit(changed);
  const unit = proposed.observable.startsWith('current') ? 'A' : 'V';
  const predictions = proposed.predictions.map(prediction => {
    let predictedValue: number;
    switch (prediction.predictionForm) {
      case 'checked-model': predictedValue = after[proposed.observable]; break;
      case 'unchanged': predictedValue = before[proposed.observable]; break;
      case 'equal-branch-current':
        if (changed.topology !== 'parallel' || unit !== 'A') throw new Error('Equal-branch-current is supported only for a parallel branch-current observable.');
        predictedValue = after.totalCurrent / 2; break;
      case 'equal-voltage-drop':
        if (changed.topology !== 'series' || unit !== 'V') throw new Error('Equal-voltage-drop is supported only for a series voltage-drop observable.');
        predictedValue = changed.voltage / 2; break;
    }
    return { ...prediction, predictedValue };
  });
  const input = { ...proposed, predictions };
  const actual = after[input.observable], tolerance = Math.max(1e-8, Math.abs(actual) * 1e-6);
  const errors = predictions.map(prediction => Math.abs(prediction.predictedValue - actual));
  const separation = Math.abs(predictions[0].predictedValue - predictions[1].predictedValue);
  const margin = Math.abs(errors[0] - errors[1]);
  const matches = predictions.filter((_prediction, index) => errors[index] <= tolerance).map(prediction => prediction.hypothesisId);
  const unchangedInput = input.baseline[input.change.parameter] === input.change.value;
  const unpowered = input.baseline.voltage === 0 && changed.voltage === 0;
  const diagnosticOptions = [...predictions.map(prediction => quantity(prediction.predictedValue, unit)), 'A different value.'];
  const label = { r1: 'R₁', r2: 'R₂', voltage: 'source voltage' }[input.change.parameter];
  const readout = { current1: 'current through R₁', current2: 'current through R₂', voltage1: 'voltage across R₁', voltage2: 'voltage across R₂' }[input.observable];
  const parameterUnit = input.change.parameter === 'voltage' ? 'V' : 'Ω';
  const diagnosticQuestion = `Starting from ${label} = ${input.baseline[input.change.parameter]} ${parameterUnit} and ${readout} = ${quantity(before[input.observable], unit)}, set ${label} to ${input.change.value} ${parameterUnit} with every other input fixed. What is the resulting ${readout}?`;
  const readableSeparation = new Set(diagnosticOptions).size === 3;
  const informative = readableSeparation && !unchangedInput && !unpowered && separation > 2 * tolerance && matches.length === 1 && margin > tolerance;
  return {
    id: `experiment-${crypto.randomUUID()}`, input, before, after, changed, observable: input.observable, unit,
    diagnosticOptions, diagnosticQuestion,
    optionMappings: predictions.map((prediction, predictedOptionIndex) => ({ hypothesisId: prediction.hypothesisId, predictedOptionIndex })),
    observedBefore: before[input.observable], observedAfter: actual, margin, predictionSeparation: separation, tolerance,
    informative, compatibleHypothesisIds: matches, reviewStatus: 'development-preview; source fit and independent scientific review pending' as const,
    reason: unchangedInput ? 'The proposed parameter did not change.' : unpowered ? 'Both configurations have zero source voltage; this does not distinguish the intended resistor explanations.' : !readableSeparation || separation <= 2 * tolerance ? 'The predictions are indistinguishable within the declared numerical tolerance.' : matches.length !== 1 ? 'The calculated outcome does not uniquely match one proposed prediction; revise the experiment or hypotheses.' : 'The calculated outcome separates the proposed predictions. This checks an experiment, not learner understanding.',
  };
}

/** Recompute saved approved forms; stored values never control the result. Legacy numeric-only artifacts stay unsupported. */
export function recheckDiagnosticExperimentInput(input: DiagnosticExperimentInput) {
  return evaluateDiagnosticExperiment({ ...input, predictions: input.predictions.map(({ predictedValue: _storedValue, ...prediction }) => prediction) });
}
export const experimentTool = {
  type: 'function', name: 'evaluate_experiment', strict: true,
  description: 'Check one ideal DC two-resistor experiment. Select approved predictionForm for each hypothesis: checked-model uses the changed circuit; unchanged uses the baseline readout; equal-branch-current splits total current equally in parallel (current observable only); equal-voltage-drop splits source voltage equally in series (voltage observable only). Application computes all numbers and units. No predictedValue, equations or code are accepted. Inspect feedback and revise an uninformative comparison. Returned diagnosticQuestion, diagnosticOptions and optionMappings must be copied exactly into prepare_experiment_diagnostic. No learner evidence is written.',
  parameters: { type: 'object', properties: {
    baseline: { type: 'object', properties: { topology: { type: 'string', enum: ['series', 'parallel'] }, voltage: { type: 'number', minimum: 0, maximum: 24 }, r1: { type: 'number', minimum: 1, maximum: 100 }, r2: { type: 'number', minimum: 1, maximum: 100 } }, required: ['topology', 'voltage', 'r1', 'r2'], additionalProperties: false },
    change: { type: 'object', properties: { parameter: { type: 'string', enum: ['r1', 'r2', 'voltage'] }, value: { type: 'number' } }, required: ['parameter', 'value'], additionalProperties: false },
    observable: { type: 'string', enum: ['current1', 'current2', 'voltage1', 'voltage2'] },
    predictions: { type: 'array', minItems: 2, maxItems: 2, items: { type: 'object', properties: { hypothesisId: { type: 'string' }, claim: { type: 'string', minLength: 10, maxLength: 400 }, predictionForm: { type: 'string', enum: ['checked-model', 'unchanged', 'equal-branch-current', 'equal-voltage-drop'] } }, required: ['hypothesisId', 'claim', 'predictionForm'], additionalProperties: false } },
  }, required: ['baseline', 'change', 'observable', 'predictions'], additionalProperties: false },
} as const;

export type DiagnosticHypothesisStatus = 'plausible' | 'weakened' | 'supported' | 'unresolved';
const evidenceSchema = z.strictObject({ sourceId: identifier, version: z.number().int().positive(), quote: z.string().min(20).max(500) });
export const diagnosticPlanSchema = z.strictObject({
  kind: z.enum(['text', 'circuit-experiment']), experimentRunId: identifier.nullable().describe('For kind text this MUST be JSON null. For circuit-experiment use an informative evaluate_experiment result ID. Never invent an ID or use an empty string.'),
  hypotheses: z.array(z.strictObject({ id: identifier, claim: boundedText(400), evidence: z.array(evidenceSchema).min(1).max(4), attemptIds: z.array(identifier).max(6).describe('Always include this array in each hypothesis. Use [] unless actual saved same-course attempt IDs were disclosed; never use null.') })).length(2),
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
// Capabilities omit irrelevant nullable/discriminator fields; full-plan validation stays mandatory.
const { kind: _kind, experimentRunId: _experiment, ...diagnosticFields } = diagnosticPlanSchema.shape;
export const textDiagnosticInputSchema = z.strictObject(diagnosticFields);
export const experimentDiagnosticInputSchema = z.strictObject({ ...diagnosticFields, experimentRunId: identifier.describe('ID returned by a prior informative evaluate_experiment call for these exact hypotheses.') });
export const diagnosticTool = { type: 'function', name: 'prepare_diagnostic', strict: true, description: 'Prepare a TEXT diagnostic for an ordinary course concept. Propose two plausible revisable explanations grounded in current read passages. Each hypothesis requires evidence and attemptIds (use [] without disclosed saved IDs). Choose different predicted option indices and explain the next activity. No kind or experimentRunId fields belong in this tool. No mastery or learner-record writes.', parameters: z.toJSONSchema(textDiagnosticInputSchema) } as const;
export const experimentDiagnosticTool = { type: 'function', name: 'prepare_experiment_diagnostic', strict: true, description: 'Prepare an interactive resistor diagnostic using a prior informative evaluate_experiment result ID and the exact same two hypothesis IDs and claims. Each hypothesis requires evidence and attemptIds (use [] without disclosed saved IDs). Copy evaluated diagnosticQuestion, diagnosticOptions and optionMappings exactly as question, options and predictions. Application validates source fit and calculated experiment before creating a lesson. No kind field belongs in this tool.', parameters: z.toJSONSchema(experimentDiagnosticInputSchema) } as const;

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
    if (plan.question !== run.diagnosticQuestion || JSON.stringify(plan.options) !== JSON.stringify(run.diagnosticOptions) || JSON.stringify(plan.predictions) !== JSON.stringify(run.optionMappings)) throw new Error('Circuit question, options and prediction mappings must exactly match the application-computed diagnosticQuestion, diagnosticOptions and optionMappings.');
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
  if (optionIndex < 0 && recorded.responseKind !== 'correction') throw new Error('Saved response does not match a diagnostic option.');
  const support = recorded.assisted || recorded.assistance.length > 0 || (lesson.kind === 'circuit' && recorded.exposure !== 'fresh-no-diagram');
  const independentlyObserved = recorded.responseKind !== 'correction' && recorded.novel && !recorded.revisionOf && !support;
  const predicted = plan.predictions.find(prediction => prediction.predictedOptionIndex === optionIndex);
  return {
    attemptId: recorded.id, observedAt: recorded.createdAt, provisional: true as const,
    observation: { lessonId: recorded.lessonId, lessonVersion: recorded.lessonVersion, modelVersion: recorded.modelVersion, response: recorded.response, responseKind: recorded.responseKind ?? 'selection', correctionOf: recorded.correctionOf ?? null, optionIndex: recorded.responseKind === 'correction' ? null : optionIndex, assisted: recorded.assisted, assistance: [...recorded.assistance], novel: recorded.novel, exposure: recorded.exposure ?? 'unknown', revisionOf: recorded.revisionOf ?? null, sourceVersions: { ...recorded.sourceVersions } },
    evidenceConstraint: 'Use this original observation to reconsider the explanations. Provisional statuses may be revised; no mastery, causal diagnosis, or external-help absence is established.',
    hypotheses: plan.hypotheses.map(hypothesis => ({ ...hypothesis, status: (!independentlyObserved || !predicted ? 'unresolved' : predicted.hypothesisId === hypothesis.id ? 'supported' : 'weakened') as DiagnosticHypothesisStatus })),
    reason: recorded.responseKind === 'correction' ? 'A student correction challenges the original interpretation. Reconsider the corrected observation while retaining both original hypotheses as unresolved; the correction is not a graded diagnostic choice. Spark may revise provisional explanations using this self-report, with an explicit not-independently-verified qualification; this never establishes independent performance.' : !independentlyObserved ? 'Recorded support, prior exposure, or a revision prevents distinguishing these explanations independently.' : !predicted ? 'The response matches neither predicted choice; both explanations remain unresolved.' : 'This single novel response without recorded support is consistent with one prediction and weakens the competing explanation. This is provisional, not mastery or retention evidence.',
    nextActivity: plan.nextActivity,
  };
}
