import type { CircuitInput, CircuitOutput } from './types';

/** Ideal two-resistor DC model. Illustration limits are not device safety ratings. */
export function calculateCircuit(input: CircuitInput): CircuitOutput {
  if (!input || (input.topology !== 'series' && input.topology !== 'parallel')) {
    throw new Error('Only ideal series or parallel circuits are supported.');
  }
  const { voltage, r1, r2, topology } = input;
  if (
    !Number.isFinite(voltage) ||
    voltage < 0 ||
    voltage > 24 ||
    !Number.isFinite(r1) ||
    r1 < 1 ||
    r1 > 100 ||
    !Number.isFinite(r2) ||
    r2 < 1 ||
    r2 > 100
  ) {
    throw new Error('Use 0–24 V and finite resistances of 1–100 Ω.');
  }
  const equivalentResistance = topology === 'series' ? r1 + r2 : (r1 * r2) / (r1 + r2);
  const totalCurrent = voltage / equivalentResistance;
  const current1 = topology === 'series' ? totalCurrent : voltage / r1;
  const current2 = topology === 'series' ? totalCurrent : voltage / r2;
  return {
    equivalentResistance,
    totalCurrent,
    current1,
    current2,
    voltage1: topology === 'series' ? current1 * r1 : voltage,
    voltage2: topology === 'series' ? current2 * r2 : voltage,
    power: voltage * totalCurrent,
  };
}
