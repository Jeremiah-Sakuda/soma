import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import { getPredictionCheckpoint, recordPrediction, revealPrediction, withLessonMetadata } from '../../src/lib/domain/prediction';
import type { DiagnosticExperimentInput } from '../../src/lib/domain/diagnostics';
const now = '2026-10-26T16:00:00.000Z';
const later = '2026-10-26T16:05:00.000Z';
const experiment = (change?: Partial<DiagnosticExperimentInput>): DiagnosticExperimentInput => ({
  baseline: { topology: 'series', voltage: 12, r1: 2, r2: 4 }, change: { parameter: 'r1', value: 4 }, observable: 'voltage1',
  predictions: [{ hypothesisId: 'proportional', claim: 'The voltage changes with the resistor ratio.', predictedValue: 6 }, { hypothesisId: 'unchanged', claim: 'The voltage stays unchanged despite resistance changes.', predictedValue: 4 }], ...change,
});
function setup(input = experiment()) {
  const state = seedWorkspace('diagnostic-experiment', now);
  const lesson = withLessonMetadata({ ...state.lessons[0], id: 'model-experiment', diagnosticInvestigationId: 'model-investigation', diagnosticExperiment: { input }, circuit: { ...input.baseline }, examEligible: false, mode: 'live' as const });
  state.lessons.push(lesson); return { state, lesson };
}
describe('diagnostic prediction binds the actual proposed experiment', () => {
  it('uses an R1 intervention and voltage1 readout rather than the legacy R2/current1 checkpoint', () => {
    const { state, lesson } = setup(), checkpoint = getPredictionCheckpoint(lesson);
    expect(checkpoint).toMatchObject({ parameter: 'r1', targetValue: 4, observedOutput: 'voltage1' });
    expect(checkpoint.options[checkpoint.answerIndex]).toBe('6 V'); // 12 V × 4/(4+4).
    expect(new Set(checkpoint.options).size).toBe(3); expect(checkpoint.question).toContain('R₁ = 2 Ω');
    recordPrediction(state, lesson, checkpoint.answerIndex, now);
    const original = structuredClone(state.predictions![0]);
    revealPrediction(state, lesson, later);
    const reveal = state.predictions!.at(-1)!;
    expect(reveal.resultInputs).toEqual({ topology: 'series', voltage: 12, r1: 4, r2: 4 });
    expect(reveal.result?.voltage1).toBe(6); expect(reveal.result?.current1).toBe(1.5);
    expect(reveal).toMatchObject({ comparisonValid: true, matched: true, createdAt: later });
    expect(state.predictions![0]).toEqual(original); expect(state.attempts).toEqual([]);
    expect(state.assistance[lesson.id].some(item => item.includes('prediction-reveal'))).toBe(true);
  });
  it('applies an absolute voltage target from a zero-voltage baseline without an infinite multiplier', () => {
    const input = experiment({ baseline: { topology: 'parallel', voltage: 0, r1: 6, r2: 3 }, change: { parameter: 'voltage', value: 12 }, observable: 'current2', predictions: [{ hypothesisId: 'r2-law', claim: 'The second branch follows its own resistance.', predictedValue: 4 }, { hypothesisId: 'same-current', claim: 'The unequal branches must carry equal currents.', predictedValue: 2 }] });
    const { state, lesson } = setup(input), checkpoint = getPredictionCheckpoint(lesson);
    expect(checkpoint).toMatchObject({ parameter: 'voltage', targetValue: 12, observedOutput: 'current2' });
    expect(Number.isFinite(checkpoint.multiplier)).toBe(true); expect(checkpoint.options[checkpoint.answerIndex]).toBe('4 A');
    expect(checkpoint.options).toContain('0 A');
    recordPrediction(state, lesson, checkpoint.options.indexOf('0 A'), now);
    revealPrediction(state, lesson, later);
    expect(state.predictions!.at(-1)).toMatchObject({ resultInputs: { voltage: 12, r1: 6, r2: 3 }, result: { current1: 2, current2: 4 }, comparisonValid: true, matched: false });
  });
  it('recomputes diagnostic metadata rather than retaining a previous authored checkpoint', () => {
    const { lesson } = setup(experiment({ baseline: { topology: 'parallel', voltage: 12, r1: 6, r2: 3 }, change: { parameter: 'r2', value: 6 }, observable: 'current2' }));
    const metadata = withLessonMetadata({ ...lesson, checkpoint: { ...lesson.checkpoint!, parameter: 'r1', targetValue: 99, observedOutput: 'current1' } });
    expect(metadata.checkpoint).toMatchObject({ parameter: 'r2', targetValue: 6, observedOutput: 'current2' });
    expect(metadata.checkpoint?.options[metadata.checkpoint.answerIndex]).toBe('2 A');
    expect(getPredictionCheckpoint(lesson, { ...lesson.circuit, voltage: 24 })).toEqual(getPredictionCheckpoint(lesson));
  });
  it.each(['other-control', 'different-target'])('does not judge a diagnostic prediction after %s changes', variation => {
    const { state, lesson } = setup(); recordPrediction(state, lesson, 0, now);
    const original = structuredClone(state.predictions![0]);
    revealPrediction(state, lesson, later, variation === 'other-control' ? { ...lesson.circuit, r1: 4, voltage: 24 } : { ...lesson.circuit, r1: 3 });
    expect(state.predictions!.at(-1)?.comparisonValid).toBe(false); expect(state.predictions!.at(-1)?.matched).toBeUndefined();
    expect(state.predictions!.at(-1)?.checkpoint?.explanation).toContain('cannot judge');
    expect(state.predictions![0]).toEqual(original);
  });
  it('permits free exploration but requires restoring the tested baseline before a diagnostic prediction', () => {
    const { state, lesson } = setup();
    const explored = applyAction(state, { type: 'save-inputs', lessonId: lesson.id, inputs: { ...lesson.circuit, voltage: 24 } }, now);
    expect(explored.attempts).toEqual([]);
    expect(() => applyAction(explored, { type: 'prediction', lessonId: lesson.id, optionIndex: 0 }, later)).toThrow(/tested experiment baseline/);
    expect(explored.predictions).toEqual([]);
  });
  it('routes a saved R1 control change through the generic reveal path', () => {
    const { state, lesson } = setup();
    const predicted = applyAction(state, { type: 'prediction', lessonId: lesson.id, optionIndex: lesson.checkpoint!.answerIndex }, now);
    const result = applyAction(predicted, { type: 'save-inputs', lessonId: lesson.id, inputs: { ...lesson.circuit, r1: 4 } }, later);
    expect(result.predictionStates?.[lesson.id].state).toBe('revealed');
    expect(result.predictions!.at(-1)).toMatchObject({ comparisonValid: true, matched: true, result: { voltage1: 6 } });
  });
  it('requires reconsideration instead of manufacturing an authored diagnostic follow-up', () => {
    const { state, lesson } = setup(), before = structuredClone(state);
    expect(() => applyAction(state, { type: 'fresh-question', lessonId: lesson.id, when: 'now' }, later)).toThrow(/Reconsider/);
    expect(state).toEqual(before);
  });
});
