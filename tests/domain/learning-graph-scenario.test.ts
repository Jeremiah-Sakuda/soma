import { describe, expect, it } from 'vitest';
import scenario from '../fixtures/learning-graph/scenario.json';
import { calculateCircuit } from '../../src/lib/domain/circuit';
import type { CircuitInput } from '../../src/lib/domain/types';
describe('original synthetic graph scientific references (not independent review)', () => {
  it.each(scenario.referenceCases)(
    'checks analytical values for $inputs.topology, $inputs.voltage V',
    ({ inputs, expected }) => {
      const result = calculateCircuit(inputs as CircuitInput);
      for (const [key, value] of Object.entries(expected))
        expect(result[key as keyof typeof expected]).toBeCloseTo(value, 10);
    },
  );
});
