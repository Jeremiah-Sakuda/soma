import { describe, expect, it } from 'vitest';
import { calculateCircuit } from '../../src/lib/domain/circuit';
import type { CircuitInput } from '../../src/lib/domain/types';

describe('ideal two-resistor model (development checks, not human review)', () => {
  it('matches independently specified series values', () => {
    expect(calculateCircuit({ topology: 'series', voltage: 12, r1: 2, r2: 4 })).toEqual({
      equivalentResistance: 6,
      totalCurrent: 2,
      current1: 2,
      current2: 2,
      voltage1: 4,
      voltage2: 8,
      power: 24,
    });
  });
  it('matches independently specified unequal and equal parallel cases', () => {
    expect(calculateCircuit({ topology: 'parallel', voltage: 12, r1: 6, r2: 3 })).toEqual({
      equivalentResistance: 2,
      totalCurrent: 6,
      current1: 2,
      current2: 4,
      voltage1: 12,
      voltage2: 12,
      power: 72,
    });
    const equal = calculateCircuit({ topology: 'parallel', voltage: 10, r1: 10, r2: 10 });
    expect(equal.equivalentResistance).toBe(5);
    expect(equal.current1).toBe(1);
    expect(equal.current2).toBe(1);
  });
  it('preserves Kirchhoff and energy relationships across illustration bounds', () => {
    for (const topology of ['series', 'parallel'] as const) {
      for (const voltage of [0, 0.5, 9, 24])
        for (const r1 of [1, 2, 17, 100])
          for (const r2 of [1, 3, 99, 100]) {
            const out = calculateCircuit({ topology, voltage, r1, r2 });
            expect(out.power).toBeCloseTo(out.current1 ** 2 * r1 + out.current2 ** 2 * r2, 9);
            if (topology === 'series') {
              expect(out.voltage1 + out.voltage2).toBeCloseTo(voltage, 10);
              expect(out.current1).toBe(out.current2);
            } else {
              expect(out.current1 + out.current2).toBeCloseTo(out.totalCurrent, 10);
              expect(out.equivalentResistance).toBeLessThan(Math.min(r1, r2));
              expect(out.voltage1).toBe(voltage);
            }
            expect(Object.values(out).every(Number.isFinite)).toBe(true);
          }
    }
  });
  it('handles zero and unequal extreme series reference cases', () => {
    for (const topology of ['series', 'parallel'] as const) {
      const zero = calculateCircuit({ topology, voltage: 0, r1: 1, r2: 100 });
      expect(zero.totalCurrent).toBe(0);
      expect(zero.power).toBe(0);
    }
    const extreme = calculateCircuit({ topology: 'series', voltage: 24, r1: 1, r2: 99 });
    expect(extreme.totalCurrent).toBe(0.24);
    expect(extreme.voltage1).toBe(0.24);
    expect(extreme.voltage2).toBeCloseTo(23.76);
  });
  it.each([
    { voltage: NaN },
    { r1: 0 },
    { r2: -1 },
    { voltage: 25 },
    { r2: Infinity },
    { r1: 101 },
    { topology: 'bridge' },
    { voltage: '12' },
  ])('rejects unsupported input %o', (bad) => {
    expect(() =>
      calculateCircuit({ topology: 'parallel', voltage: 12, r1: 6, r2: 3, ...bad } as CircuitInput),
    ).toThrow();
  });
});
