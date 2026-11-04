import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import SpatialHeightReadout from '../../src/components/spatial-height-readout';
import { checkExploration, createWeightedExample, type ExplorationSpec } from '../../src/lib/domain/exploration';
import { initialExplorationState, type ExplorationViewState } from '../../src/lib/domain/exploration-view';
import { createSpatialExample } from '../../src/lib/domain/spatial-example';
import { circuitSpec } from '../../src/lib/server/circuit-authoring';
import recordedGraph from '../../src/lib/fixtures/recorded-graph.json';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

const graph = () => checkExploration(recordedGraph.spec).spec;
function render(spec: ExplorationSpec, changes: Partial<ExplorationViewState> = {}, which: 'primary' | 'comparison' = 'primary') {
  const html = renderToStaticMarkup(createElement(SpatialHeightReadout, {
    spec, state: { ...initialExplorationState(spec), ...changes }, which,
  }));
  const entries = Object.fromEntries([...html.matchAll(/data-height-node="([^"]+)"><dt>(.*?)<\/dt><dd>(.*?)<\/dd>/g)]
    .map(([, id, label, value]) => [id, { label, value }]));
  return { html, entries };
}
function circuit() {
  return circuitSpec({
    id: 'height-readout-circuit', version: 1, observationId: 'original-synthetic-test', sourceVersion: 1,
    input: structuredClone(heroCircuit), layout: heroCircuitLayout, uncertainty: [],
    copy: { title: 'Bridge voltage', objective: 'Inspect computed voltage.', assumptions: [], followups: [],
      steps: [{ traceIndex: 3, caption: 'Inspect the circuit.', narration: 'Inspect the circuit.', highlightIds: [] }] },
  });
}

describe('checked browser height readout', () => {
  it('shows the current Dijkstra snapshot, including unreached and tentative values before the final distance', () => {
    const spec = graph();
    expect(render(spec).entries).toMatchObject({ A: { value: '0' }, F: { value: 'Unreached' } });
    const first = render(spec, { step: 1 });
    expect(first.html).toContain('Current Dijkstra distances');
    expect(first.entries).toMatchObject({ B: { value: '≤ 4' }, C: { value: '≤ 1' }, F: { value: '≤ 11' } });
    expect(first.html).toContain('≤ tentative');
    expect(render(spec, { step: 99 }).entries).toMatchObject({ B: { value: '3' }, F: { value: '7' } });
  });

  it('uses the selected comparison execution rather than the primary search cost', () => {
    const spec = createWeightedExample({ observationId: 'original-synthetic-test', version: 1, region: null });
    expect(render(spec, { step: 99 }).entries.g.value).toBe('3');
    const comparison = render(spec, { step: 99 }, 'comparison');
    expect(comparison.html).toContain('BFS hop distances');
    expect(comparison.entries.g).toEqual({ label: 'Goal', value: '1' });
    expect(comparison.html).not.toContain('tentative');
  });

  it('follows changed weights and disconnected goals without mutating scientific, source or selected state', () => {
    const spec = graph(), original = JSON.stringify(spec);
    const changed = { step: 99, edgeWeights: { e_DF: 6 }, selectedObjectId: 'F' };
    expect(render(spec, changed).entries.F.value).toBe('9');
    expect(render(spec, { step: 99, disabledEdgeIds: ['e_AF', 'e_DF', 'e_EF'] }).entries.F.value).toBe('Unreached');
    expect(changed).toEqual({ step: 99, edgeWeights: { e_DF: 6 }, selectedObjectId: 'F' });
    expect(JSON.stringify(spec)).toBe(original);
  });

  it('retains small graph values instead of rounding or flooring them to zero', () => {
    const spec = createWeightedExample({ observationId: 'original-synthetic-test', version: 1, region: null });
    const fraction = render(spec, { step: 99, edgeWeights: { sg: 0.0051 } });
    expect(fraction.entries.g.value).toBe('0.0051');
    if (spec.mode !== 'checked-dijkstra') throw new Error('fixture');
    for (const edge of spec.input.edges) edge.weight = (edge.weight ?? 1) * 1e-200;
    expect(render(spec, { step: 99 }).entries.g.value).toBe('3e-200');
  });

  it('reveals circuit voltages with the step and distinguishes balanced and changed values', () => {
    const spec = circuit();
    expect(render(spec).entries).toMatchObject({ A: { value: 'Not revealed' }, B: { value: 'Not revealed' }, D: { value: '0 V' } });
    expect(render(spec).html).toContain('Relative to D (ground)');
    expect(render(spec, { step: 99 }).entries).toMatchObject({ B: { value: '8 V' }, C: { value: '8 V' } });
    expect(render(spec, { step: 99, edgeWeights: { R4: 7.2 } }).entries)
      .toMatchObject({ B: { value: '≈ 7.957 V' }, C: { value: '≈ 7.797 V' } });
    expect(render(spec, { step: 99, edgeWeights: { R4: 8.8 } }).entries)
      .toMatchObject({ B: { value: '≈ 8.037 V' }, C: { value: '≈ 8.174 V' } });
  });

  it('does not present floating or not-yet-revealed circuit nodes as zero volts', () => {
    const spec = circuit(), disabledEdgeIds = ['R1', 'R2', 'R5'];
    expect(render(spec, { disabledEdgeIds }).entries.B.value).toBe('Not revealed');
    expect(render(spec, { step: 99, disabledEdgeIds }).entries.B.value).toBe('Cut off from ground');
  });

  it('retains small signed voltages and identifies rounded quantities as approximate', () => {
    const result = render(circuit(), { step: 99, edgeWeights: { V1: -1e-12 } });
    expect(result.entries.B.value).toBe('≈ −6.667e-13 V');
    expect(result.entries.D.value).toBe('0 V');
  });

  it('adds no checked readout to a general 3D explanation', () => {
    expect(render(createSpatialExample()).html).toBe('');
  });
});
