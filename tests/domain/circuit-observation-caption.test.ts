import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExplorationScene } from '../../src/components/exploration-scene';
import { solveDc, type DcInput, type DcObservation } from '../../src/lib/domain/dc-circuit';
import { circuitCaption, circuitObservationCaption, initialExplorationState } from '../../src/lib/domain/exploration-view';
import { circuitSpec } from '../../src/lib/server/circuit-authoring';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

const bridgeCurrent: DcObservation = { kind: 'current', componentId: 'R5' };
const sourceLoop = (kind: 'voltage-source' | 'current-source', value: number): DcInput => ({
  nodes: [{ id: 'G', label: 'Ground' }, { id: 'A', label: 'Supply' }],
  ground: 'G',
  components: [
    { id: 'source', label: 'Source', kind, from: 'G', to: 'A', value },
    { id: 'load', label: 'Load', kind: 'resistor', from: 'A', to: 'G', value: 4 },
  ],
});

describe('the selected circuit observation caption', () => {
  it('leads with the observed resistor and its equal end voltages only at exact zero', () => {
    const balanced = solveDc(heroCircuit);
    expect(balanced.exact.currents.R5).toBe('0');
    expect(circuitObservationCaption(balanced, bridgeCurrent)).toBe('R₅ carries 0 A: both ends are at 8 V.');
    for (const [resistance, direction] of [[7.2, 'B to C'], [8.8, 'C to B']] as const) {
      const solution = solveDc(heroCircuit, { values: { R4: resistance } });
      const caption = circuitObservationCaption(solution, bridgeCurrent)!;
      expect(Math.sign(solution.currents.R5)).toBe(resistance < 8 ? 1 : -1);
      expect(caption).toMatch(/^R₅ carries ≈ [\d.]+ A from /);
      expect(caption).toContain(`from ${direction}.`);
      expect(caption).toContain('B is at');
      expect(caption).toContain('C is at');
      expect(caption).not.toContain('both ends');
      expect(caption).not.toContain('R₃');
      expect(caption.split(/\s+/).length).toBeLessThan(32);
    }
  });

  it('uses the requested component and its labels rather than a particular bridge ID', () => {
    const input = {
      ...heroCircuit,
      components: heroCircuit.components.map(c => c.id === 'R5' ? { ...c, id: 'crossbar', label: 'Bridge link' } : c),
    };
    expect(circuitObservationCaption(solveDc(input), { kind: 'current', componentId: 'crossbar' }))
      .toBe('Bridge link carries 0 A: both ends are at 8 V.');
  });

  it('attributes an open component’s zero current to the opening, not equal voltages', () => {
    const solution = solveDc(heroCircuit, { values: { R4: 7.2 }, open: ['R5'] });
    expect(solution.voltages.B).not.toBe(solution.voltages.C);
    expect(circuitObservationCaption(solution, bridgeCurrent)).toBe('R₅ is open, so it carries 0 A.');
  });

  it('falls back for missing targets, floating observed endpoints and unsolved circuits', () => {
    const floating = solveDc(heroCircuit, { open: ['R1', 'R2', 'R5'] });
    expect(floating.voltages.B).toBeNull();
    expect(circuitObservationCaption(floating, bridgeCurrent)).toBeNull();
    expect(circuitObservationCaption(floating, { kind: 'power', componentId: 'R5' })).toBeNull();
    expect(circuitObservationCaption(floating, { kind: 'voltage', nodeId: 'B' })).toBeNull();
    expect(circuitCaption(floating, 99)).toContain('B is cut off');
    expect(circuitObservationCaption(solveDc(heroCircuit), { kind: 'current', componentId: 'missing' })).toBeNull();
    expect(circuitObservationCaption(solveDc(heroCircuit), { kind: 'voltage', nodeId: 'missing' })).toBeNull();
    const unsolved = solveDc(sourceLoop('current-source', 2), { open: ['load'] });
    expect(unsolved.status).toBe('unsolvable');
    expect(circuitObservationCaption(unsolved, { kind: 'current', componentId: 'source' })).toBeNull();
  });

  it.each(['voltage-source', 'current-source'] as const)('uses through-component current signs for a %s', kind => {
    for (const [setting, direction] of [[12, 'Ground to Supply'], [-12, 'Supply to Ground']] as const) {
      const solution = solveDc(sourceLoop(kind, setting));
      const current = kind === 'voltage-source' ? 3 : 12;
      expect(circuitObservationCaption(solution, { kind: 'current', componentId: 'source' }))
        .toBe(`Source carries ${current} A from ${direction}.`);
    }
    const off = solveDc(sourceLoop(kind, 0));
    expect(circuitObservationCaption(off, { kind: 'current', componentId: 'source' })).toBe('Source carries 0 A.');
  });

  it('does not infer equal source voltages from zero source current', () => {
    const solution = solveDc(sourceLoop('voltage-source', 12), { open: ['load'] });
    expect(solution.drops.source).toBe(-12);
    expect(circuitObservationCaption(solution, { kind: 'current', componentId: 'source' })).toBe('Source carries 0 A.');
  });

  it('names the ground reference for voltages and distinguishes absorbed from supplied power', () => {
    const input = sourceLoop('voltage-source', 12), solution = solveDc(input);
    expect(circuitObservationCaption(solution, { kind: 'voltage', nodeId: 'A' }))
      .toBe('Supply is at 12 V relative to Ground (ground).');
    expect(circuitObservationCaption(solution, { kind: 'power', componentId: 'load' })).toBe('Load absorbs 36 W.');
    expect(circuitObservationCaption(solution, { kind: 'power', componentId: 'source' })).toBe('Source supplies 36 W.');
    const charging = solveDc({ ...input, components: [
      ...input.components,
      { id: 'injection', label: 'Injection', kind: 'current-source', from: 'G', to: 'A', value: 4 },
    ] });
    expect(charging.currents.source).toBe(-1);
    expect(circuitObservationCaption(charging, { kind: 'current', componentId: 'source' }))
      .toBe('Source carries 1 A from Supply to Ground.');
    expect(circuitObservationCaption(charging, { kind: 'power', componentId: 'source' })).toBe('Source absorbs 12 W.');
  });
});

const spec = circuitSpec({
  id: 'observation-caption', version: 1, observationId: 'slide', sourceVersion: 1,
  input: heroCircuit, layout: heroCircuitLayout, uncertainty: [],
  copy: {
    title: 'Bridge experiment', objective: 'Inspect the bridge.', assumptions: [], followups: [],
    steps: [{ traceIndex: 3, caption: 'Authored bridge explanation.', narration: 'Inspect the bridge.', highlightIds: ['R5'] }],
  },
});
const captionText = (html: string) => html.match(/<div class="exploration-caption"[^>]*>.*?<p>(.*?)<\/p>/)?.[1];

describe('the circuit scene observation binding', () => {
  it('passes the observation through the real scene, retaining the change lead and full checked readout', () => {
    const state = { ...initialExplorationState(spec), step: 3, edgeWeights: { R4: 7.2 } };
    const html = renderToStaticMarkup(createElement(ExplorationScene, {
      spec, state, onChange() {}, circuitObservation: bridgeCurrent,
    }));
    const caption = captionText(html)!;
    expect(caption).toMatch(/^R₄ is now 7\.2 Ω \(was 8\)\. R₅ carries ≈ [\d.]+ A from B to C\./);
    expect(caption).not.toContain('R₃');
    expect(caption).not.toContain('At every junction');
    expect(html).toContain('<summary>Checked values in a table</summary><p>C sits at');
    expect(html).toContain('At every junction, the current in equals the current out.');
    expect(html).toContain('circuit-readings');
  });

  it('keeps the ordinary caption without an observation and when authored controls still match', () => {
    const state = { ...initialExplorationState(spec), step: 3, edgeWeights: { R4: 7.2 } };
    const without = renderToStaticMarkup(createElement(ExplorationScene, { spec, state, onChange() {} }));
    expect(captionText(without)).toContain('R₃ carries');
    if (spec.mode !== 'checked-circuit') throw new Error('Expected circuit');
    const bound = { ...spec, writtenFor: { open: [], values: { R4: 7.2 } } };
    const matching = renderToStaticMarkup(createElement(ExplorationScene, {
      spec: bound, state, onChange() {}, circuitObservation: bridgeCurrent,
    }));
    expect(captionText(matching)).toContain('R₃ carries');
    expect(matching).toContain('Soma’s explanation: Authored bridge explanation.');
  });

  it('keeps floating and unsolved consequences visible rather than substituting a focused result', () => {
    const state = { ...initialExplorationState(spec), step: 3, disabledEdgeIds: ['R1', 'R2', 'R5'] };
    const html = renderToStaticMarkup(createElement(ExplorationScene, {
      spec, state, onChange() {}, circuitObservation: bridgeCurrent,
    }));
    expect(captionText(html)).toContain('B is cut off');
    if (spec.mode !== 'checked-circuit') throw new Error('Expected circuit');
    const currentSpec = { ...spec, input: sourceLoop('current-source', 2), scene: {
      ...spec.scene, panels: spec.scene.panels.map(panel => panel.kind === 'circuit' ? {
        ...panel, positions: [{ nodeId: 'G', x: 0.2, y: 0.8 }, { nodeId: 'A', x: 0.2, y: 0.2 }],
      } : panel),
    } };
    const unsolved = renderToStaticMarkup(createElement(ExplorationScene, {
      spec: currentSpec, state: { ...initialExplorationState(currentSpec), disabledEdgeIds: ['load'] },
      onChange() {}, circuitObservation: { kind: 'current', componentId: 'source' },
    }));
    expect(captionText(unsolved)).toContain('No single answer exists');
  });
});
