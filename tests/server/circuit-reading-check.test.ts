import { describe, expect, it } from 'vitest';
import { reconcileCircuitReading, circuitReadingSchemas } from '../../src/lib/server/circuit-reading-check';
import { heroCircuit } from '../fixtures/hero-circuit';

describe('independent circuit image readings', () => {
  const schemas = circuitReadingSchemas(heroCircuit);
  const issue = { componentId: 'R4', kind: 'value' as const, value: 10, note: 'Printed ten ohms.' };
  const reading = { verdict: 'disagree' as const, issues: [issue] };
  it('keeps the original immutable and requires agreement before a correction', () => {
    const original = JSON.stringify(heroCircuit);
    const result = reconcileCircuitReading(heroCircuit, reading, { values: [{ componentId: 'R4', value: 10 }] });
    expect(result.input.components.find((p) => p.id === 'R4')!.value).toBe(10);
    expect(result.check.status).toBe('corrected');
    expect(JSON.stringify(heroCircuit)).toBe(original);
    for (const value of [8, null]) {
      const disputed = reconcileCircuitReading(heroCircuit, reading, { values: [{ componentId: 'R4', value }] });
      expect(disputed.check.status).toBe('disputed');
      expect(disputed.input).toEqual(heroCircuit);
    }
    expect(reconcileCircuitReading(heroCircuit, reading, null).check.status).toBe('disputed');
  });
  it('never rewrites polarity, junctions, missing parts, or unreadable values', () => {
    for (const kind of ['polarity', 'connection', 'missing', 'extra', 'label', 'unreadable'] as const) {
      const result = reconcileCircuitReading(heroCircuit, { verdict: 'disagree', issues: [{ ...issue, kind }] }, { values: [{ componentId: 'R4', value: 10 }] });
      expect(result.check.status).toBe('disputed');
      expect(result.check.corrections).toEqual([]);
      expect(result.input).toEqual(heroCircuit);
    }
  });
  it('declines illegal values and contradictory duplicate readings', () => {
    for (const value of [0, -1, 1e12]) {
      const result = reconcileCircuitReading(heroCircuit, { verdict: 'disagree', issues: [{ ...issue, value }] }, { values: [{ componentId: 'R4', value }] });
      expect(result.check.status).toBe('disputed');
      expect(result.input).toEqual(heroCircuit);
    }
    const duplicate = reconcileCircuitReading(heroCircuit, reading, { values: [{ componentId: 'R4', value: 10 }, { componentId: 'R4', value: 8 }] });
    expect(duplicate.check.status).toBe('disputed');
    expect(duplicate.check.corrections).toEqual([]);
  });
  it('does not hide disagreements behind a confirmed verdict or an empty issue list', () => {
    expect(reconcileCircuitReading(heroCircuit, { ...reading, verdict: 'confirmed' }, null).check.status).toBe('disputed');
    expect(reconcileCircuitReading(heroCircuit, { verdict: 'disagree', issues: [] }, null).check.status).toBe('disputed');
  });
  it('rejects invented component IDs and nonfinite model values', () => {
    expect(schemas.check.safeParse({ ...reading, issues: [{ ...issue, componentId: 'made-up' }] }).success).toBe(false);
    expect(schemas.check.safeParse({ ...reading, issues: [{ ...issue, value: Infinity }] }).success).toBe(false);
  });
});
