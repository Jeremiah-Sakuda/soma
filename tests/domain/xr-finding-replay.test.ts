import { describe, expect, it } from 'vitest';
import { circuitRecipe, graphRecipe, replayFinding } from '../../xr/src/finding-replay';
import { openRecordedGraphLab } from '../../src/lib/xr-lab/recorded-graph-lab';
import { openRecordedCircuitLab } from '../../src/lib/xr-lab/recorded-circuit-lab';

describe('XR finding replay', () => {
  it('restores a changed cost and cut while retaining the original out-of-range cost', () => {
    const graph = openRecordedGraphLab();
    const baseline = graph.state();
    graph.setCost('e_DF', 8);
    graph.toggleEdge('e_AF');
    const reopened = replayFinding(
      'graph',
      JSON.parse(JSON.stringify(graphRecipe(baseline, graph.state()))),
    );
    expect(reopened?.id).toBe('graph');
    if (reopened?.id !== 'graph') throw new Error('Expected a graph');
    expect(reopened.lab.state()).toMatchObject({ path: ['A', 'C', 'E', 'F'], totalCost: 9 });
    expect(reopened.lab.state().edges).toEqual(graph.state().edges);
    expect(reopened.lab.state().edges.find(({ id }) => id === 'e_AF')).toMatchObject({
      cost: 11,
      enabled: false,
    });
    expect(reopened.lab.reset().totalCost).toBe(7);
  });

  it('restores resistor changes and recomputes signed current', () => {
    const circuit = openRecordedCircuitLab();
    const baseline = circuit.state();
    circuit.setValue('R4', 16);
    circuit.togglePart('R1');
    const reopened = replayFinding('circuit', circuitRecipe(baseline, circuit.state()));
    expect(reopened?.id).toBe('circuit');
    if (reopened?.id !== 'circuit') throw new Error('Expected a circuit');
    expect(reopened.lab.state().parts).toEqual(circuit.state().parts);
    expect(reopened.lab.state().checks).toEqual({ kcl: true, sources: true, power: true });
  });

  it('rejects stale, cross-lab, out-of-bounds and duplicate inputs', () => {
    const graph = openRecordedGraphLab();
    const baseline = graph.state();
    const recipe = graphRecipe(baseline, graph.setCost('e_DF', 8));
    expect(replayFinding('graph', { ...recipe, source: 'stale' })).toBeNull();
    expect(replayFinding('circuit', recipe)).toBeNull();
    expect(
      replayFinding('graph', { ...recipe, edits: [...recipe.edits, ...recipe.edits] }),
    ).toBeNull();
    expect(
      replayFinding('graph', { ...recipe, edits: [{ id: 'e_DF', value: 99, enabled: true }] }),
    ).toBeNull();
    expect(
      replayFinding('graph', { ...recipe, edits: [{ id: 'unknown', value: 4, enabled: false }] }),
    ).toBeNull();
    expect(replayFinding('graph', undefined)).toBeNull();
  });
});
