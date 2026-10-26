import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import { calculateCircuit } from '../../src/lib/domain/circuit';
import { getPredictionCheckpoint } from '../../src/lib/domain/prediction';
const now = '2026-10-26T20:00:00.000Z';
const later = '2026-10-26T20:01:00.000Z';
const seed = () => seedWorkspace('prediction-test', now);

describe('optional predictions preserve original interactions without inventing understanding evidence', () => {
  it('stores every choice and the selection in force at reveal, without rewriting previous predictions', () => {
    const first = applyAction(seed(), { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 2 }, now);
    const second = applyAction(first, { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1 }, later);
    const revealed = applyAction(JSON.parse(JSON.stringify(second)), { type: 'reveal-prediction', lessonId: 'parallel-nodes' }, later);
    expect(revealed.predictions?.[0]).toEqual(first.predictions?.[0]);
    expect(revealed.predictions?.[1].optionIndex).toBe(1);
    const reveal = revealed.predictions?.at(-1)!;
    expect(reveal.predictionId).toBe(second.predictions?.[1].id);
    expect(reveal.inputs.r2).toBe(3);
    expect(reveal.resultInputs?.r2).toBe(6);
    expect(reveal.result?.current1).toBe(2);
    expect(reveal.matched).toBe(true);
    expect(revealed.attempts).toEqual([]);
    expect(revealed.interpretations).toEqual(first.interpretations);
    expect(revealed.savedInputs['parallel-nodes']).toEqual(reveal.resultInputs);
    expect(revealed.assistance['parallel-nodes'].some(item => item.includes('prediction-reveal'))).toBe(true);
    expect(() => applyAction(revealed, { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 0 }, later)).toThrow(/preserved/);
  });
  it('changing the declared control while predicted reveals through the same model once', () => {
    const predicted = applyAction(seed(), { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 2 }, now);
    const inputs = { topology: 'parallel' as const, voltage: 12, r1: 6, r2: 6 };
    const moved = applyAction(predicted, { type: 'save-inputs', lessonId: 'parallel-nodes', inputs }, later);
    expect(moved.predictionStates?.['parallel-nodes'].state).toBe('revealed');
    expect(moved.predictions?.at(-1)?.result).toEqual(calculateCircuit(inputs));
    expect(moved.predictions?.at(-1)?.matched).toBe(false);
    const repeated = applyAction(moved, { type: 'reveal-prediction', lessonId: 'parallel-nodes' }, later);
    expect(repeated.predictions).toEqual(moved.predictions);
  });
  it('exploration requires no assessment and preserves the option to predict', () => {
    const explored = applyAction(seed(), { type: 'explore-lesson', lessonId: 'parallel-nodes' }, now);
    expect(explored.predictionStates?.['parallel-nodes'].state).toBe('exploring');
    expect(explored.attempts).toEqual([]);
    const predicted = applyAction(explored, { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1 }, later);
    expect(predicted.predictionStates?.['parallel-nodes'].state).toBe('predicted');
    expect(predicted.predictions?.[0].kind).toBe('exploration');
  });
  it('the checkpoint remains bounded at high resistances and is correct for zero source and both topologies', () => {
    const lesson = seed().lessons[0];
    for (const topology of ['series', 'parallel'] as const) for (const r2 of [1, 50, 51, 100]) for (const voltage of [0, 12, 24]) {
      const inputs = { topology, voltage, r1: 6, r2 };
      const checkpoint = getPredictionCheckpoint(lesson, inputs);
      const changed = { ...inputs, r2: r2 * checkpoint.multiplier };
      const before = calculateCircuit(inputs), after = calculateCircuit(changed);
      const diff = after.current1 - before.current1;
      expect(checkpoint.answerIndex).toBe(Math.abs(diff) < 1e-10 ? 1 : diff > 0 ? 0 : 2);
      expect(changed.r2).toBeGreaterThanOrEqual(1);
      expect(changed.r2).toBeLessThanOrEqual(100);
    }
  });
  it('blocks stale predictions and retains visible-diagram support on every lab attempt', () => {
    const expired = applyAction(seed(), { type: 'scenario', scenario: 'source-expired' }, now);
    expect(() => applyAction(expired, { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1 }, now)).toThrow(/stale/);
    const answered = applyAction(seed(), { type: 'attempt', lessonId: 'parallel-nodes', optionIndex: 0 }, now);
    expect(answered.attempts[0].exposure).toBe('lab');
    expect(answered.attempts[0].assisted).toBe(true);
    expect(answered.attempts[0].assistance.some(item => item.includes('diagram-visible'))).toBe(true);
  });
  it('keeps Later as an actual pending item, then opens the same fresh question without diagram', () => {
    const predicted = applyAction(seed(), { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 2 }, now);
    const revealed = applyAction(predicted, { type: 'reveal-prediction', lessonId: 'parallel-nodes' }, later);
    const pending = applyAction(revealed, { type: 'fresh-question', lessonId: 'parallel-nodes', when: 'later' }, later);
    const request = pending.freshRequests![0];
    const lesson = pending.lessons.find(item => item.id === request.lessonId)!;
    expect(request.status).toBe('pending');
    expect(lesson.exposure).toBe('fresh-no-diagram');
    expect(lesson.question).not.toBe(pending.lessons[0].question);
    expect(() => applyAction(pending, { type: 'attempt', lessonId: lesson.id, optionIndex: lesson.answerIndex }, later)).toThrow(/Open/);
    const opened = applyAction(JSON.parse(JSON.stringify(pending)), { type: 'fresh-question', lessonId: 'parallel-nodes', when: 'now' }, later);
    expect(opened.freshRequests).toHaveLength(1);
    expect(opened.lessons).toHaveLength(pending.lessons.length);
    expect(opened.freshRequests![0].openedAt).toBe(later);
    const answered = applyAction(opened, { type: 'attempt', lessonId: lesson.id, optionIndex: lesson.answerIndex }, later);
    expect(answered.attempts[0].assisted).toBe(false);
    expect(answered.attempts[0].exposure).toBe('fresh-no-diagram');
    expect(answered.attempts[0].predictionId).toBe(predicted.predictions![0].id);
    expect(answered.attempts[0].createdAt).toBe(later);
    expect(answered.interpretations.at(-1)?.claim).toContain('contradicts');
    expect(answered.predictions).toEqual(opened.predictions);
  });
  it('records new help on a fresh item and never treats a repeated response as fresh transfer', () => {
    const prepared = applyAction(seed(), { type: 'fresh-question', lessonId: 'parallel-nodes', when: 'now' }, now);
    const lesson = prepared.lessons.at(-1)!;
    expect(() => applyAction(prepared, { type: 'save-inputs', lessonId: lesson.id, inputs: lesson.circuit }, now)).toThrow(/interactive/);
    const helped = applyAction(prepared, { type: 'assistance', lessonId: lesson.id, kind: 'hint' }, now);
    const first = applyAction(helped, { type: 'attempt', lessonId: lesson.id, optionIndex: lesson.answerIndex }, later);
    expect(first.attempts[0].assisted).toBe(true);
    const repeated = applyAction(first, { type: 'attempt', lessonId: lesson.id, optionIndex: lesson.answerIndex }, later);
    expect(repeated.attempts[1].novel).toBe(false);
    expect(repeated.attempts[0]).toEqual(first.attempts[0]);
  });
  it('different predictions select meaningfully different authored fresh parameters', () => {
    const left = applyAction(applyAction(seed(), { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1 }, now), { type: 'fresh-question', lessonId: 'parallel-nodes', when: 'now' }, later);
    const right = applyAction(applyAction(seed(), { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 2 }, now), { type: 'fresh-question', lessonId: 'parallel-nodes', when: 'now' }, later);
    expect(left.lessons.at(-1)?.circuit).not.toEqual(right.lessons.at(-1)?.circuit);
    expect(left.lessons.at(-1)?.question).not.toBe(right.lessons.at(-1)?.question);
  });
});

describe('prediction comparisons honor their original conditions', () => {
  it('does not score a confounded result when the source voltage changed before R2', () => {
    const predicted = applyAction(seed(), { type: 'prediction', lessonId: 'parallel-nodes', optionIndex: 1 }, now);
    const voltageChanged = applyAction(predicted, { type: 'save-inputs', lessonId: 'parallel-nodes', inputs: { topology: 'parallel', voltage: 24, r1: 6, r2: 3 } }, later);
    const revealed = applyAction(voltageChanged, { type: 'save-inputs', lessonId: 'parallel-nodes', inputs: { topology: 'parallel', voltage: 24, r1: 6, r2: 6 } }, later);
    expect(revealed.predictions?.at(-1)?.comparisonValid).toBe(false);
    expect(revealed.predictions?.at(-1)?.matched).toBeUndefined();
    expect(revealed.predictions?.at(-1)?.checkpoint?.explanation).toContain('cannot judge');
    expect(revealed.predictions?.[0]).toEqual(predicted.predictions?.[0]);
    expect(revealed.attempts).toEqual([]);
  });
  it('cannot replace a source-backed lesson topology using the control endpoint', () => {
    expect(() => applyAction(seed(), { type: 'save-inputs', lessonId: 'parallel-nodes', inputs: { topology: 'series', voltage: 12, r1: 6, r2: 3 } }, now)).toThrow(/matching lesson variant/);
  });
});
