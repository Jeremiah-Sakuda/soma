import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { solveDc } from '../../src/lib/domain/dc-circuit';
import { circuitOverlayModel } from '../../src/lib/domain/circuit-overlay-model';
import { captionIsGrounded, circuitCaption, circuitExactQuantity } from '../../src/lib/domain/exploration-view';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

const require = createRequire(import.meta.url);
const { validOverlayModel } = require('../../desktop/screen-overlay.cjs') as { validOverlayModel: (m: unknown) => boolean };
const model = (state = {}, index = 99) => {
  const solution = solveDc(heroCircuit, state);
  return circuitOverlayModel({
    layout: heroCircuitLayout,
    solution,
    index,
    caption: circuitCaption(solution, index),
    stepLabel: 'Step',
    aspect: 1080 / 1920,
  })!;
};

describe('a checked circuit drawn over its own slide', () => {
  it('walks the bridge from ground up and every frame passes the companion validator', () => {
    const solution = solveDc(heroCircuit);
    expect(solution.steps.map((s) => s.node)).toEqual([null, 'A', 'B', 'C']);
    for (let i = 0; i < solution.steps.length; i++) {
      const m = model({}, i);
      expect(validOverlayModel(m)).toBe(true);
      expect(m.lift).toBeUndefined();
      expect(captionIsGrounded(m.caption!.text, [], solution)).toBe(true);
    }
    const first = model({}, 0);
    expect(first.edges.every((e) => e.tone === 'idle')).toBe(true);
    expect(first.tags.map((t) => t.text)).toEqual(['D = 0 V']);
  });

  it('shows why no current crosses a balanced bridge', () => {
    const m = model();
    const tags = Object.fromEntries(m.tags.map((t) => [t.id, t]));
    expect(tags['voltage-B'].text).toBe('B = 8 V');
    expect(tags['voltage-C'].text).toBe('C = 8 V');
    expect(tags['current-R5']).toMatchObject({ text: 'R₅: 0 A', tone: 'tentative' });
    expect(tags['current-R1'].text).toBe('R₁: 2 A ↓');
    expect(tags['current-R3'].text).toBe('R₃: 1 A ↓');
    expect(tags['current-V1'].text).toBe('12 V battery: 3 A ↑');
    expect(m.edges.find((e) => e.id === 'R5')!.tone).toBe('idle');
    expect(m.edges.find((e) => e.id === 'R1')!.tone).toBe('path');
    expect(m.caption!.text).toContain('R₅ carries no current: both its ends are at the same voltage.');
    expect(m.final).toBe(true);
  });

  it('redraws an experiment: an open part is crossed out and current finds R₅', () => {
    const m = model({ open: ['R2'] });
    expect(validOverlayModel(m)).toBe(true);
    expect(m.edges.find((e) => e.id === 'R2')!.tone).toBe('cut');
    const r5 = m.tags.find((t) => t.id === 'current-R5')!;
    expect(r5.text).toMatch(/^R₅ ≈ 0\.4138 A →$/);
    const changed = model({ values: { R4: 10 } });
    expect(changed.weights).toEqual([expect.objectContaining({ edgeId: 'R4', text: '8 → 10 Ω' })]);
    // A higher R₄ lifts C above B, so current crosses from C to B.
    expect(changed.tags.find((t) => t.id === 'current-R5')!.text).toMatch(/←$/);
  });

  it('declines to draw when the reading has no position for a node', () => {
    const solution = solveDc(heroCircuit);
    expect(
      circuitOverlayModel({
        layout: { ...heroCircuitLayout, nodes: heroCircuitLayout.nodes.slice(1) },
        solution,
        index: 0,
        caption: null,
        stepLabel: 'Step',
        aspect: 0.5625,
      }),
    ).toBeNull();
  });

  it('says a source with no current has no closed path, never that its ends match', () => {
    const solution = solveDc(heroCircuit, { open: ['R1', 'R3'] });
    const text = solution.steps.map((_, i) => circuitCaption(solution, i)).join(' ');
    expect(text).toContain('12 V battery carries no current: no closed path runs through it.');
    expect(text).not.toContain('battery carries no current: both its ends');
  });

  it('gives the real reason a source with an intact loop carries nothing', () => {
    const off = solveDc(heroCircuit, { values: { V1: 0 } });
    expect(off.steps.map((_, i) => circuitCaption(off, i)).join(' ')).toContain('12 V battery is set to 0, so it drives no current.');
  });
});

describe('exact circuit quantities', () => {
  it('puts the solver’s fraction beside its rounded value only when the value is not whole', () => {
    expect(circuitExactQuantity('12/29', 12 / 29, 'A')).toBe('12/29 A ≈ 0.4138 A');
    expect(circuitExactQuantity('-12/29', -12 / 29, 'A', true)).toBe('12/29 A ≈ 0.4138 A');
    expect(circuitExactQuantity('-264/29', -264 / 29, 'V')).toBe('−264/29 V ≈ −9.103 V');
    expect(circuitExactQuantity('1/4', 0.25, 'A')).toBe('1/4 A = 0.25 A');
    expect(circuitExactQuantity('8', 8, 'V')).toBe('8 V');
    expect(circuitExactQuantity(null, 3, 'V')).toBe('3 V');
  });
});
