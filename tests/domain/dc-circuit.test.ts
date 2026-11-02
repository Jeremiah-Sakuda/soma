import { describe, expect, it } from 'vitest';
import { calculateCircuit } from '../../src/lib/domain/circuit';
import { dcInputSchema, exactDecimal, probeDcValue, solveDc, type DcInput } from '../../src/lib/domain/dc-circuit';

const series: DcInput = {
  nodes: [
    { id: 'G', label: 'ground' },
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
  ],
  ground: 'G',
  components: [
    { id: 'V1', label: '12 V battery', kind: 'voltage-source', from: 'G', to: 'A', value: 12 },
    { id: 'R1', label: 'R1', kind: 'resistor', from: 'A', to: 'B', value: 4 },
    { id: 'R2', label: 'R2', kind: 'resistor', from: 'B', to: 'G', value: 8 },
  ],
};
/** Wheatstone bridge: top T at the battery's + terminal, left L and right R midpoints, R5 across. */
const bridge = (r4: number): DcInput => ({
  nodes: ['G', 'T', 'L', 'R'].map((id) => ({ id, label: id })),
  ground: 'G',
  components: [
    { id: 'V1', label: 'V1', kind: 'voltage-source', from: 'G', to: 'T', value: 12 },
    { id: 'R1', label: 'R1', kind: 'resistor', from: 'T', to: 'L', value: 2 },
    { id: 'R2', label: 'R2', kind: 'resistor', from: 'L', to: 'G', value: 4 },
    { id: 'R3', label: 'R3', kind: 'resistor', from: 'T', to: 'R', value: 3 },
    { id: 'R4', label: 'R4', kind: 'resistor', from: 'R', to: 'G', value: r4 },
    { id: 'R5', label: 'R5', kind: 'resistor', from: 'L', to: 'R', value: 10 },
  ],
});

/** Kirchhoff and Ohm checked from the reported numbers alone, independent of the solver's own
 * exact checks: together they determine a linear circuit's solution uniquely. */
function expectPhysical(input: DcInput, s: ReturnType<typeof solveDc>) {
  expect(s.status).toBe('solved');
  expect(s.checks).toEqual({ kcl: true, sources: true, power: true });
  const open = new Set(s.state.open),
    shorted = new Set(s.state.shorted);
  for (const c of input.components) {
    const value = s.state.values[c.id];
    if (open.has(c.id)) expect(s.currents[c.id]).toBe(0);
    else if (shorted.has(c.id)) expect(s.drops[c.id]).toBeCloseTo(0, 9);
    else if (c.kind === 'resistor') expect(s.currents[c.id] * (value ?? c.value)).toBeCloseTo(s.drops[c.id]!, 9);
    else if (c.kind === 'voltage-source') expect(-s.drops[c.id]!).toBeCloseTo(value ?? c.value, 9);
    else expect(s.currents[c.id]).toBeCloseTo(value ?? c.value, 9);
  }
  for (const n of input.nodes) {
    const net = input.components.reduce(
      (sum, c) => sum + (c.from === n.id ? s.currents[c.id] : c.to === n.id ? -s.currents[c.id] : 0),
      0,
    );
    expect(net).toBeCloseTo(0, 9);
  }
  expect(s.voltages[input.ground]).toBe(0);
}

describe('checked DC circuits (nodal analysis, exact fractions)', () => {
  it('solves a series loop exactly and walks it downhill from the battery', () => {
    const s = solveDc(series);
    expectPhysical(series, s);
    expect(s.exact.currents).toEqual({ V1: '1', R1: '1', R2: '1' });
    expect(s.voltages).toEqual({ G: 0, A: 12, B: 8 });
    expect(s.drops.R1).toBe(4);
    expect(s.power).toEqual({ V1: -12, R1: 4, R2: 8 });
    expect(s.steps.map((step) => step.node)).toEqual([null, 'A', 'B']);
    expect(s.steps.map((step) => step.revealedComponents)).toEqual([[], ['V1'], ['V1', 'R1', 'R2']]);
    expect(s.steps.map((step) => step.status)).toEqual(['ready', 'solving', 'complete']);
  });

  it('keeps answers as exact fractions where decimals would round', () => {
    const third = solveDc({
      ...series,
      components: [series.components[0], { ...series.components[1], value: 1 }, { ...series.components[2], value: 35 }],
    });
    expect(third.exact.currents.R1).toBe('1/3');
    expect(third.exact.voltages.B).toBe('35/3');
    expect(exactDecimal(0.1)).toEqual({ n: 1n, d: 10n });
    expect(exactDecimal(4.7e3)).toEqual({ n: 4700n, d: 1n });
    expect(exactDecimal(1e-7)).toEqual({ n: 1n, d: 10000000n });
  });

  it('agrees with the independent two-resistor formulas across their whole range', () => {
    for (const voltage of [0, 0.5, 9, 24])
      for (const r1 of [1, 2, 17, 100])
        for (const r2 of [1, 3, 99, 100]) {
          const s = solveDc({
            ...series,
            components: [
              { ...series.components[0], value: voltage },
              { ...series.components[1], value: r1 },
              { ...series.components[2], value: r2 },
            ],
          });
          const ref = calculateCircuit({ topology: 'series', voltage, r1, r2 });
          expect(s.currents.R1).toBeCloseTo(ref.current1, 10);
          expect(s.drops.R2).toBeCloseTo(ref.voltage2, 10);
          const parallel: DcInput = {
            nodes: [
              { id: 'G', label: 'G' },
              { id: 'A', label: 'A' },
            ],
            ground: 'G',
            components: [
              { id: 'V1', label: 'V1', kind: 'voltage-source', from: 'G', to: 'A', value: voltage },
              { id: 'R1', label: 'R1', kind: 'resistor', from: 'A', to: 'G', value: r1 },
              { id: 'R2', label: 'R2', kind: 'resistor', from: 'A', to: 'G', value: r2 },
            ],
          };
          const p = solveDc(parallel),
            pref = calculateCircuit({ topology: 'parallel', voltage, r1, r2 });
          expectPhysical(parallel, p);
          expect(p.currents.V1).toBeCloseTo(pref.totalCurrent, 10);
          expect(p.currents.R2).toBeCloseTo(pref.current2, 10);
        }
  });

  it('finds that a balanced bridge carries no current through its middle, and where it flips', () => {
    const balanced = solveDc(bridge(6));
    expectPhysical(bridge(6), balanced);
    expect(balanced.exact.currents.R5).toBe('0');
    expect(balanced.voltages.L).toBe(8);
    expect(balanced.voltages.R).toBe(8);
    const below = solveDc(bridge(5)),
      above = solveDc(bridge(7));
    expect(below.currents.R5).toBeGreaterThan(0);
    expect(above.currents.R5).toBeLessThan(0);
    const probe = probeDcValue(bridge(5), undefined, 'R4', { kind: 'current', componentId: 'R5' }, 'zero', 'R4 sets the right side.');
    expect(probe).toMatchObject({ criticalValue: 6, criticalExact: '6', verified: true, originalValue: 5 });
    expect(probe.note).toContain('exactly zero when R4 is 6 Ω');
    expect(probe.cases.find((c) => c.value === 6)?.observed).toBe(0);
    expect(probe.cases.map((c) => Math.sign(c.observed))).toEqual([1, 1, 0, -1]);
    // The middle resistor's own value never unbalances a balanced bridge.
    expect(probeDcValue(bridge(6), undefined, 'R5', { kind: 'current', componentId: 'R5' }, 'zero').note).toContain(
      'does not depend on R5',
    );
  });

  it('verifies tipping points that are not terminating decimals', () => {
    // V_L = 12·4/6 = 8, so V_R = 12·R4/(3 + R4) reaches 8.5 at R4 = 51/7.
    const open = { open: ['R5'] };
    const probe = probeDcValue(bridge(5), open, 'R4', { kind: 'voltage', nodeId: 'R' }, { equals: 8.5 });
    expect(probe.criticalExact).toBe('51/7');
    expect(probe.verified).toBe(true);
    expect(probe.criticalValue).toBeCloseTo(51 / 7, 10);
  });

  it('finds maximum power where the load matches the rest of the circuit', () => {
    const source: DcInput = {
      nodes: ['G', 'A', 'B'].map((id) => ({ id, label: id })),
      ground: 'G',
      components: [
        { id: 'V1', label: 'V1', kind: 'voltage-source', from: 'G', to: 'A', value: 12 },
        { id: 'Rint', label: 'internal', kind: 'resistor', from: 'A', to: 'B', value: 4 },
        { id: 'RL', label: 'load', kind: 'resistor', from: 'B', to: 'G', value: 2 },
      ],
    };
    const probe = probeDcValue(source, undefined, 'RL', { kind: 'power', componentId: 'RL' }, 'maximum-power');
    expect(probe).toMatchObject({ criticalValue: 4, verified: true });
    expect(probe.cases.find((c) => c.value === 4)?.observed).toBe(9);
    expect(() => probeDcValue(source, undefined, 'Rint', { kind: 'power', componentId: 'RL' }, 'maximum-power')).toThrow();
  });

  it('opens and shorts parts without changing the circuit as read', () => {
    const opened = solveDc(series, { open: ['R2'] });
    expectPhysical(series, opened);
    expect(opened.currents).toEqual({ V1: 0, R1: 0, R2: 0 });
    expect(opened.voltages.B).toBe(12);
    const isolated = solveDc(series, { open: ['R1', 'R2'] });
    expect(isolated.voltages.B).toBeNull();
    const shorted = solveDc(series, { shorted: ['R1'] });
    expectPhysical(series, shorted);
    expect(shorted.exact.currents.R1).toBe('3/2');
    expect(shorted.drops.R1).toBe(0);
    const dead = solveDc(series, { shorted: ['R1', 'R2'] });
    expect(dead.status).toBe('unsolvable');
    expect(dead.reason).toMatch(/ideal source is shorted/);
    expect(solveDc(series, { values: { R2: 4 } }).exact.currents.R1).toBe('3/2');
    expect(series.components[2]).toMatchObject({ value: 8 });
  });

  it('drives current sources and keeps a loop cut off from ground running', () => {
    const fed: DcInput = {
      nodes: ['G', 'A'].map((id) => ({ id, label: id })),
      ground: 'G',
      components: [
        { id: 'I1', label: 'I1', kind: 'current-source', from: 'G', to: 'A', value: 2 },
        { id: 'R1', label: 'R1', kind: 'resistor', from: 'A', to: 'G', value: 3 },
        { id: 'R2', label: 'R2', kind: 'resistor', from: 'A', to: 'G', value: 6 },
      ],
    };
    const s = solveDc(fed);
    expectPhysical(fed, s);
    expect(s.voltages.A).toBe(4);
    expect(solveDc(fed, { open: ['R1', 'R2'] }).status).toBe('unsolvable');
    const twoLoops: DcInput = {
      nodes: ['G', 'A', 'B', 'C'].map((id) => ({ id, label: id })),
      ground: 'G',
      components: [
        { id: 'V1', label: 'V1', kind: 'voltage-source', from: 'G', to: 'A', value: 6 },
        { id: 'R1', label: 'R1', kind: 'resistor', from: 'A', to: 'G', value: 2 },
        { id: 'Rlink', label: 'link', kind: 'resistor', from: 'A', to: 'B', value: 1 },
        { id: 'V2', label: 'V2', kind: 'voltage-source', from: 'B', to: 'C', value: 9 },
        { id: 'R2', label: 'R2', kind: 'resistor', from: 'C', to: 'B', value: 3 },
      ],
    };
    const cut = solveDc(twoLoops, { open: ['Rlink'] });
    expectPhysical(twoLoops, cut);
    expect(cut.voltages.B).toBeNull();
    expect(cut.currents.R2).toBe(3);
    expect(cut.drops.R2).toBe(9);
  });

  it('holds Kirchhoff and Ohm on random connected circuits', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
    for (let trial = 0; trial < 60; trial++) {
      const n = 2 + Math.floor(rand() * 7);
      const ids = Array.from({ length: n }, (_, i) => `N${i}`);
      const components: DcInput['components'] = [];
      for (let i = 1; i < n; i++)
        components.push({ id: `T${i}`, label: `T${i}`, kind: 'resistor', from: ids[Math.floor(rand() * i)], to: ids[i], value: 1 + Math.floor(rand() * 20) / 2 });
      for (let k = 0; k < 4; k++) {
        const a = ids[Math.floor(rand() * n)],
          b = ids[Math.floor(rand() * n)];
        if (a !== b) components.push({ id: `X${k}`, label: `X${k}`, kind: 'resistor', from: a, to: b, value: 0.5 + Math.floor(rand() * 30) / 4 });
      }
      components.push({ id: 'S', label: 'S', kind: 'voltage-source', from: ids[0], to: ids[n - 1], value: Math.floor(rand() * 40) - 20 });
      if (n > 2) components.push({ id: 'J', label: 'J', kind: 'current-source', from: ids[1], to: ids[0], value: Math.floor(rand() * 8) / 4 });
      const input = { nodes: ids.map((id) => ({ id, label: id })), ground: ids[0], components };
      expectPhysical(input, solveDc(input));
      const first = components[0].id;
      expectPhysical(input, solveDc(input, { open: components.some((c) => c.id === 'X0') ? ['X0'] : [], values: { [first]: 3.25 } }));
    }
  });

  it('rejects circuits that cannot be read as one connected network', () => {
    const bad = (patch: Partial<DcInput>) => dcInputSchema.safeParse({ ...series, ...patch }).success;
    expect(bad({ ground: 'Z' })).toBe(false);
    expect(bad({ nodes: [...series.nodes, { id: 'C', label: 'C' }] })).toBe(false);
    expect(bad({ components: [...series.components, { id: 'R9', label: 'R9', kind: 'resistor', from: 'A', to: 'A', value: 1 }] })).toBe(false);
    expect(bad({ components: [...series.components, { ...series.components[1] }] })).toBe(false);
    expect(bad({ components: series.components.filter((c) => c.kind === 'resistor') })).toBe(false);
    expect(bad({ components: [series.components[0], { ...series.components[1], value: 0 }, series.components[2]] })).toBe(false);
    expect(bad({})).toBe(true);
  });

  it('keeps inherited names out of IDs and leaves the voltage across a cut-apart part undefined', () => {
    for (const id of ['toString', 'valueOf', 'hasOwnProperty'])
      expect(dcInputSchema.safeParse({ ...series, components: series.components.map((c, i) => (i === 1 ? { ...c, id } : c)) }).success).toBe(false);
    // With R1, R2 and R5 open, the bridge's left node B floats on its own.
    const s = solveDc(bridge(6), { open: ['R1', 'R2', 'R5'] });
    expect(s.status).toBe('solved');
    expect(s.voltages.L).toBeNull();
    expect(s.drops.R1).toBeNull();
    expect(s.drops.R3).toBe(4);
  });
});
