import { calculateCircuit } from './circuit';
import { recheckDiagnosticExperimentInput } from './diagnostics';
import { followupLesson } from './lessons';
import type { CircuitInput, Lesson, PredictionCheckpoint, PredictionInteraction, WorkspaceState } from './types';

export const INPUT_RANGES: NonNullable<Lesson['inputRanges']> = { voltage: { min: 0, max: 24, unit: 'V' }, r1: { min: 1, max: 100, unit: 'Ω' }, r2: { min: 1, max: 100, unit: 'Ω' } };

/** The outcome and answer are derived from the same numerical model as every visual readout. */
export function getPredictionCheckpoint(lesson: Lesson, inputs: CircuitInput = lesson.circuit): PredictionCheckpoint {
  if (lesson.diagnosticExperiment) {
    const experiment = lesson.diagnosticExperiment.input, baseline = experiment.baseline;
    const { parameter, value: targetValue } = experiment.change;
    const before = calculateCircuit(baseline), after = calculateCircuit({ ...baseline, [parameter]: targetValue });
    const observable = experiment.observable, unit = observable.startsWith('current') ? 'A' : 'V';
    const label = { r1: 'R₁', r2: 'R₂', voltage: 'source voltage' }[parameter];
    const readout = { current1: 'current through R₁', current2: 'current through R₂', voltage1: 'voltage across R₁', voltage2: 'voltage across R₂' }[observable];
    const checked = experiment.predictions.some(prediction => prediction.predictionForm) ? recheckDiagnosticExperimentInput(experiment) : undefined;
    const format = (value: number) => `${Number(value.toPrecision(6))} ${unit}`;
    const candidates = [after[observable], before[observable], ...experiment.predictions.map(prediction => prediction.predictedValue), 0, 1, 24];
    const options = checked?.diagnosticOptions ?? [...new Set(candidates.map(format))].slice(0, 3);
    const parameterUnit = parameter === 'voltage' ? 'V' : 'Ω';
    return {
      id: `${lesson.id}-${parameter}-${observable}`, parameter, targetValue, observedOutput: observable,
      multiplier: baseline[parameter] === 0 ? 1 : targetValue / baseline[parameter],
      question: checked?.diagnosticQuestion ?? `Starting from ${label} = ${baseline[parameter]} ${parameterUnit} and ${readout} = ${format(before[observable])}, set ${label} to ${targetValue} ${parameterUnit} with every other input fixed. What is the resulting ${readout}?`,
      options, answerIndex: options.indexOf(format(after[observable])), revealLabel: `Set ${label} to ${targetValue} ${parameterUnit} and see`,
      explanation: `The ideal DC calculation gives ${format(after[observable])} for the ${readout}, compared with ${format(before[observable])} at the tested baseline. Only ${label} changed. This calculated result is model support, not evidence of independent understanding.`,
    };
  }
  const multiplier = inputs.r2 <= 50 ? 2 : 0.5;
  const before = calculateCircuit(inputs), after = calculateCircuit({ ...inputs, r2: inputs.r2 * multiplier });
  const difference = after.current1 - before.current1;
  const change = multiplier === 2 ? 'doubles' : 'halves';
  return { id: `${lesson.id}-r2-current`, question: `If R₂ ${change} and everything else stays the same, what happens to the current through R₁?`, options: ['It increases', 'It stays the same', 'It decreases'],
    answerIndex: Math.abs(difference) < 1e-10 ? 1 : difference > 0 ? 0 : 2,
    revealLabel: multiplier === 2 ? 'Double R₂ and see' : 'Halve R₂ and see', parameter: 'r2', multiplier, observedOutput: 'current1',
    explanation: inputs.voltage === 0 ? 'With a zero-volt source, both currents remain zero.' : inputs.topology === 'parallel' ? 'R₁ still connects to the same source voltage, so its current V/R₁ is unchanged when the other branch resistance changes.' : 'The resistors share one current. Changing R₂ changes the total resistance, so the shared current changes according to I = V/(R₁ + R₂).' };
}

export function withLessonMetadata(lesson: Lesson): Lesson {
  return { ...lesson, exposure: lesson.exposure ?? 'lab', validation: lesson.validation ?? { status: 'development-preview', modelVersion: lesson.modelVersion },
    ...(lesson.kind === 'circuit' ? { inputRanges: structuredClone(INPUT_RANGES), checkpoint: getPredictionCheckpoint(lesson) } : {}) };
}

function interaction(state: WorkspaceState, lesson: Lesson, now: string, kind: PredictionInteraction['kind'], inputs: CircuitInput, extra: Partial<PredictionInteraction> = {}) {
  state.predictions ??= [];
  const record: PredictionInteraction = { id: `interaction-${state.predictions.length + 1}`, lessonId: lesson.id, lessonVersion: lesson.version, modelVersion: lesson.modelVersion, kind, createdAt: now, inputs: structuredClone(inputs), ...extra };
  state.predictions.push(record);
  return record;
}
export function recordPrediction(state: WorkspaceState, lesson: Lesson, optionIndex: number, now: string) {
  if (lesson.diagnosticExperiment) recheckDiagnosticExperimentInput(lesson.diagnosticExperiment.input);
  if (lesson.kind !== 'circuit' || lesson.exposure === 'fresh-no-diagram') throw new Error('Predictions belong to the interactive circuit lesson.');
  if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex > 2) throw new Error('Choose an available prediction.');
  if (state.predictionStates?.[lesson.id]?.state === 'revealed') throw new Error('The original reveal is preserved. Use a fresh question or another lesson to predict again.');
  const inputs = state.savedInputs[lesson.id] ?? lesson.circuit;
  if (lesson.diagnosticExperiment && (['topology', 'voltage', 'r1', 'r2'] as const).some(parameter => inputs[parameter] !== lesson.diagnosticExperiment!.input.baseline[parameter])) throw new Error('Restore the tested experiment baseline before predicting, or keep exploring freely.');
  const checkpoint = getPredictionCheckpoint(lesson, inputs);
  const record = interaction(state, lesson, now, 'selection', inputs, { optionIndex, checkpoint });
  state.predictionStates ??= {};
  state.predictionStates[lesson.id] = { state: 'predicted', selectedPredictionId: record.id };
}
export function exploreLesson(state: WorkspaceState, lesson: Lesson, now: string) {
  if (lesson.kind !== 'circuit') throw new Error('This lesson does not have a circuit exploration.');
  interaction(state, lesson, now, 'exploration', state.savedInputs[lesson.id] ?? lesson.circuit);
  state.predictionStates ??= {};
  if (!state.predictionStates[lesson.id] || state.predictionStates[lesson.id].state === 'idle') state.predictionStates[lesson.id] = { state: 'exploring' };
  state.assistance[lesson.id] = [...(state.assistance[lesson.id] ?? []), `${now} · exploration`];
}
export function revealPrediction(state: WorkspaceState, lesson: Lesson, now: string, manualInputs?: CircuitInput) {
  if (lesson.diagnosticExperiment) recheckDiagnosticExperimentInput(lesson.diagnosticExperiment.input);
  const predictionState = state.predictionStates?.[lesson.id];
  if (predictionState?.state === 'revealed') return;
  const selection = state.predictions?.find(item => item.id === predictionState?.selectedPredictionId && item.kind === 'selection');
  if (!selection) throw new Error('Choose a prediction before revealing, or explore freely.');
  const checkpoint = selection.checkpoint ?? getPredictionCheckpoint(lesson, selection.inputs);
  const targetValue = checkpoint.targetValue ?? selection.inputs[checkpoint.parameter] * checkpoint.multiplier;
  const resultInputs = manualInputs ?? { ...selection.inputs, [checkpoint.parameter]: targetValue };
  calculateCircuit(resultInputs);
  const baseline = calculateCircuit(selection.inputs), result = calculateCircuit(resultInputs);
  const delta = result[checkpoint.observedOutput] - baseline[checkpoint.observedOutput];
  const outcomeIndex = checkpoint.targetValue !== undefined ? checkpoint.answerIndex : Math.abs(delta) < 1e-10 ? 1 : delta > 0 ? 0 : 2;
  const comparisonValid = resultInputs.topology === selection.inputs.topology && (['voltage', 'r1', 'r2'] as const).every(parameter => parameter === checkpoint.parameter || resultInputs[parameter] === selection.inputs[parameter]) && (checkpoint.targetValue === undefined || resultInputs[checkpoint.parameter] === targetValue);
  const revealedCheckpoint = comparisonValid ? checkpoint : { ...checkpoint, explanation: 'The control change did not match the original prediction conditions. This result cannot judge the original prediction; its original choice and conditions remain preserved.' };
  const record = interaction(state, lesson, now, 'reveal', selection.inputs, { predictionId: selection.id, resultInputs: structuredClone(resultInputs), result, comparisonValid, ...(comparisonValid ? { matched: selection.optionIndex === outcomeIndex } : {}), checkpoint: revealedCheckpoint });
  state.savedInputs[lesson.id] = structuredClone(resultInputs);
  state.predictionStates![lesson.id] = { state: 'revealed', selectedPredictionId: selection.id, revealId: record.id };
  state.assistance[lesson.id] = [...(state.assistance[lesson.id] ?? []), `${now} · prediction-reveal`];
}

/** A fresh item has no diagram. Prior lab help is linked context; new help on this item remains separately recorded. */
export function prepareFreshQuestion(state: WorkspaceState, lesson: Lesson, when: 'now' | 'later', now: string) {
  if (lesson.diagnosticInvestigationId) throw new Error('Reconsider the saved diagnostic response to select the next source-grounded activity.');
  if (lesson.exposure === 'fresh-no-diagram') throw new Error('This is already a fresh question.');
  state.freshRequests ??= [];
  const predictionId = state.predictionStates?.[lesson.id]?.selectedPredictionId;
  const existing = state.freshRequests.find(request => request.parentLessonId === lesson.id && request.predictionId === predictionId);
  if (existing) {
    if (when === 'now' && existing.status === 'pending') { existing.status = 'opened'; existing.openedAt = now; existing.when = 'now'; }
    return;
  }
  const prediction = state.predictions?.find(item => item.id === predictionId);
  const ordinal = state.attempts.length + state.freshRequests.length + 1;
  // A differing prediction selects a distinct parameterized application without changing the original interaction.
  const branch = prediction?.optionIndex === 2 ? ordinal + 7 : ordinal;
  const fresh = followupLesson(lesson, branch, false);
  fresh.id = `${lesson.id.slice(0, 80)}-fresh-${state.freshRequests.length + 1}`;
  fresh.exposure = 'fresh-no-diagram'; fresh.parentLessonId = lesson.id;
  if (predictionId) fresh.predictionId = predictionId;
  fresh.reason = predictionId ? 'A fresh application follows your recorded prediction. The original prediction and lab support remain separate; this question has no diagram.' : 'A different application without the diagram. Earlier exploration remains recorded separately.';
  delete fresh.checkpoint;
  state.lessons.push(fresh);
  state.freshRequests.push({ id: `fresh-request-${state.freshRequests.length + 1}`, parentLessonId: lesson.id, lessonId: fresh.id, ...(predictionId ? { predictionId } : {}), requestedAt: now, when, status: when === 'now' ? 'opened' : 'pending', ...(when === 'now' ? { openedAt: now } : {}) });
}
