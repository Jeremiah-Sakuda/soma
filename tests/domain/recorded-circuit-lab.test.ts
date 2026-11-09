import { describe, expect, it } from 'vitest';
import { openRecordedCircuitLab } from '@/lib/xr-lab/recorded-circuit-lab';
import { CIRCUIT_LAB_VALUE_RANGES, type CircuitLabState } from '@/lib/xr-lab/circuit-contract';
import { solveDc } from '@/lib/domain/dc-circuit';
import recording from '@/lib/fixtures/recorded-circuit.json';
import presentation from '@/lib/fixtures/recorded-circuit-presentation.json';

const part = (state: CircuitLabState, id: string) => state.parts.find((part) => part.id === id)!;
const currents = (state: CircuitLabState) =>
  Object.fromEntries(state.parts.map(({ id, current }) => [id, current]));
const voltages = (state: CircuitLabState) =>
  Object.fromEntries(state.nodes.map(({ id, voltage }) => [id, voltage]));

describe('recorded XR circuit lab', () => {
  it('recomputes the recorded balanced bridge, with signed source current and historical probe', () => {
    const state = openRecordedCircuitLab().state();
    // Independent divider/Ohm-law references from the recording: 12/(2+4)=2 A,
    // 12/(4+8)=1 A; the source supplies their sum from D to A.
    expect(voltages(state)).toEqual({ A: 12, B: 8, C: 8, D: 0 });
    expect(currents(state)).toEqual({ VS1: 3, R1: 2, R2: 2, R3: 1, R4: 1, R5: 0 });
    expect(state).toMatchObject({
      ground: 'D',
      status: 'solved',
      reason: null,
      checks: { kcl: true, sources: true, power: true },
      provenance: {
        model: 'muse-spark-1.3',
        recordedAt: recording.updatedAt,
        results: 'computed-now',
        solver: 'dc-nodal',
        solverVersion: 'dc-nodal-v1',
        layout: 'recorded-alignment-with-derived-labels',
      },
    });
    expect(state.probe).toEqual(recording.circuitExperiment);
    expect(state.probe).toMatchObject({
      componentId: 'R4',
      observe: { kind: 'current', componentId: 'R5' },
      criticalValue: 8,
    });
    expect(state.provenance.label).toBe(
      'Recorded Muse Spark 1.3 run, 2026-11-04; results computed now.',
    );
    expect(state.caption).toBe('Computed now: R5 carries 0 A: both ends are at 8 V.');
    expect(part(state, 'VS1')).toMatchObject({
      from: 'D',
      to: 'A',
      unit: 'V',
      value: 12,
      open: false,
    });
  });

  it('uses recorded body/node alignment and bounded derived label anchors', () => {
    const state = openRecordedCircuitLab().state();
    expect(state.nodes.map(({ id, x, y }) => ({ nodeId: id, x, y }))).toEqual(
      presentation.layout.nodes,
    );
    for (const p of state.parts) {
      const body = presentation.layout.components.find(({ componentId }) => componentId === p.id)!;
      expect(p.x).toBe((body.x1 + body.x2) / 2);
      expect(p.y).toBe((body.y1 + body.y2) / 2);
      for (const value of [p.x, p.y, p.labelX, p.labelY]) {
        expect(value).toBeGreaterThanOrEqual(0);
        expect(value).toBeLessThanOrEqual(1);
      }
      expect([p.labelX, p.labelY]).not.toEqual([p.x, p.y]);
    }
  });

  it('opens the chosen R4 resistor and recomputes every value, then closes it', () => {
    const lab = openRecordedCircuitLab();
    const initial = lab.state();
    const opened = lab.togglePart(initial.probe.componentId);
    const expected = solveDc(recording.spec.input, { open: ['R4'] });
    expect(currents(opened)).toEqual(expected.currents);
    expect(voltages(opened)).toEqual(expected.voltages);
    // With R4 open: R1 || (R3+R5) = 18/11 ohms, then R2 in series.
    expect(part(opened, 'VS1').current).toBeCloseTo(66 / 31, 12);
    expect(part(opened, 'R5').current).toBeCloseTo(-12 / 31, 12);
    expect(part(opened, 'R4')).toMatchObject({ open: true, current: 0, value: 8 });
    expect(opened.caption).toContain('Opened R4. Computed now: R5 carries');
    expect(opened.caption).toContain('from C to B');
    expect(opened.caption).not.toContain('both ends');
    expect(opened.probe).toEqual(initial.probe); // remains historical, not a new boundary claim
    expect(opened.checks).toEqual({ kcl: true, sources: true, power: true });
    const closed = lab.togglePart('R4');
    expect(currents(closed)).toEqual(currents(initial));
    expect(voltages(closed)).toEqual(voltages(initial));
  });

  it('reproduces each recorded probe sample and reverses bridge-current direction', () => {
    const lab = openRecordedCircuitLab();
    for (const sample of recording.circuitExperiment.cases) {
      const state = lab.setValue('R4', sample.value);
      expect(part(state, 'R5').current).toBeCloseTo(sample.observed, 12);
      expect(state.checks).toEqual({ kcl: true, sources: true, power: true });
      expect(state.caption).toContain(
        sample.value < 8
          ? 'from B to C'
          : sample.value > 8
            ? 'from C to B'
            : 'both ends are at 8 V',
      );
    }
  });

  it('clamps finite edits to documented kind-specific limits before solving', () => {
    const lab = openRecordedCircuitLab();
    for (const id of ['R4', 'VS1']) {
      const range = CIRCUIT_LAB_VALUE_RANGES[part(lab.state(), id).kind];
      for (const [requested, bounded] of [
        [-1e10, range.min],
        [1e10, range.max],
      ]) {
        lab.reset();
        const state = lab.setValue(id, requested);
        expect(part(state, id).value).toBe(bounded);
        expect(currents(state)).toEqual(
          solveDc(recording.spec.input, { values: { [id]: bounded } }).currents,
        );
        expect(state.checks).toEqual({ kcl: true, sources: true, power: true });
      }
    }
    lab.reset();
    expect(part(lab.setValue('R4', 7.25), 'R4').value).toBe(7.25);
  });

  it('keeps edited values on open resistors without using them until closed', () => {
    const lab = openRecordedCircuitLab();
    const open = lab.togglePart('R4');
    const edited = lab.setValue('R4', 4);
    expect(part(edited, 'R4')).toMatchObject({ open: true, value: 4, current: 0 });
    expect(currents(edited)).toEqual(currents(open));
    expect(part(lab.togglePart('R4'), 'R5').current).toBeCloseTo(0.24, 12);
  });

  it('distinguishes floating voltages and an opened observed resistor from a balanced bridge', () => {
    const lab = openRecordedCircuitLab();
    lab.setValue('R4', 4);
    expect(lab.togglePart('R5').caption).toContain('R5 is open, so it carries 0 A.');
    lab.togglePart('R1');
    const floating = lab.togglePart('R2');
    expect(voltages(floating).B).toBeNull();
    expect(part(floating, 'R5').current).toBe(0);
    expect(floating.caption).toContain('B is cut off from D');
    expect(floating.caption).not.toContain('both ends are at');
    expect(floating.checks).toEqual({ kcl: true, sources: true, power: true });
  });

  it('resets openings, resistor values and source polarity to the recorded state', () => {
    const lab = openRecordedCircuitLab();
    const initial = lab.state();
    lab.togglePart('R4');
    lab.setValue('R4', 4);
    lab.setValue('VS1', -24);
    expect(lab.reset()).toEqual({
      ...initial,
      caption: `Reset to the recorded circuit. ${initial.caption}`,
    });
  });

  it('isolates snapshots, historical probe data and separate lab instances', () => {
    const lab = openRecordedCircuitLab();
    const initial = lab.state();
    const edited = lab.setValue('R4', 4);
    edited.nodes[0].voltage = 999;
    edited.parts[0].current = 999;
    edited.probe.observe = { kind: 'voltage', nodeId: 'missing' };
    edited.probe.cases[0].observed = 999;
    edited.checks.kcl = false;
    edited.provenance.model = 'live';
    expect(lab.state().nodes[0].voltage).toBe(12);
    expect(lab.state().parts[0].current).not.toBe(999);
    expect(lab.state().probe).toEqual(initial.probe);
    expect(lab.state().checks.kcl).toBe(true);
    expect(lab.state().provenance).toEqual(initial.provenance);
    expect(openRecordedCircuitLab().state()).toEqual(initial);
    expect(part(initial, 'R4').value).toBe(8);
  });

  it('rejects invalid IDs, source toggles and nonfinite values without mutating state', () => {
    const lab = openRecordedCircuitLab();
    const initial = lab.state();
    expect(() => lab.togglePart('missing')).toThrow('Unknown lab part');
    expect(() => lab.setValue('missing', 1)).toThrow('Unknown lab part');
    expect(() => lab.togglePart('VS1')).toThrow('Only resistors');
    for (const invalid of [NaN, Infinity, -Infinity])
      expect(() => lab.setValue('R4', invalid)).toThrow('finite');
    expect(lab.state()).toEqual(initial);
  });
});
