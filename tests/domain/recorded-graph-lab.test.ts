import { describe, expect, it } from 'vitest';
import { openRecordedGraphLab } from '@/lib/xr-lab/recorded-graph-lab';
import type { LabState } from '@/lib/xr-lab/contract';
import presentation from '@/lib/fixtures/recorded-graph-presentation.json';

const basePath = ['A', 'C', 'B', 'D', 'F'];
const viaE = ['A', 'C', 'E', 'F'];
const edge = (state: LabState, id: string) => state.edges.find((edge) => edge.id === id);
const highlighted = (state: LabState) =>
  state.edges.filter((edge) => edge.onPath).map(({ id }) => id);

describe('recorded XR graph lab', () => {
  it('opens the recorded graph with the computed shortest route and undirected highlights', () => {
    const state = openRecordedGraphLab().state();
    expect(state).toMatchObject({
      start: 'A',
      goal: 'F',
      path: basePath,
      totalCost: 7,
      status: 'found',
      probe: { edgeId: 'e_DF', originalCost: 3, criticalCost: 5 },
      provenance: {
        model: 'muse-spark-1.3',
        recordedAt: '2026-11-04T03:14:33.839Z',
        label: 'Recorded Muse Spark 1.3 run, 2026-11-04',
      },
    });
    expect(edge(state, 'e_AF')?.cost).toBe(11);
    expect(highlighted(state)).toEqual(['e_AC', 'e_BD', 'e_BC', 'e_DF']);
    expect(state.caption).toBe('Computed shortest route: A → C → B → D → F (cost 7).');
    expect(state.nodes.map(({ id, x, y }) => ({ nodeId: id, x, y }))).toEqual(
      presentation.layout.nodes,
    );
    expect(
      state.edges.map(({ id, labelX, labelY }) => ({
        edgeId: id,
        x: labelX,
        y: labelY,
      })),
    ).toEqual(presentation.layout.edgeLabels);
  });

  it('keeps a cut edge visible and recomputes the route, then restores it', () => {
    const lab = openRecordedGraphLab();
    const cut = lab.toggleEdge('e_DF');
    expect(cut).toMatchObject({ path: viaE, totalCost: 9, status: 'found' });
    expect(edge(cut, 'e_DF')).toMatchObject({
      enabled: false,
      onPath: false,
      cost: 3,
    });
    expect(highlighted(cut)).toEqual(['e_AC', 'e_CE', 'e_EF']);
    expect(cut.caption).toBe('Cut D–F. Computed shortest route: A → C → E → F (cost 9).');
    const restored = lab.toggleEdge('e_DF');
    expect(restored).toMatchObject({ path: basePath, totalCost: 7 });
    expect(edge(restored, 'e_DF')).toMatchObject({
      enabled: true,
      onPath: true,
    });
    expect(restored.caption).toMatch(/^Restored D–F\./);
  });

  it('returns no route, total or highlights once the goal is disconnected', () => {
    const lab = openRecordedGraphLab();
    lab.toggleEdge('e_AF');
    lab.toggleEdge('e_DF');
    const disconnected = lab.toggleEdge('e_EF');
    expect(disconnected).toMatchObject({
      path: null,
      totalCost: null,
      status: 'unreachable',
    });
    expect(highlighted(disconnected)).toEqual([]);
    expect(disconnected.caption).toBe('Cut E–F. Computed result: no route from A to F.');
  });

  it('resets cuts and cost edits to the original recorded graph', () => {
    const lab = openRecordedGraphLab();
    const initial = lab.state();
    lab.toggleEdge('e_AC');
    lab.setCost('e_AF', 1);
    lab.setCost('e_DF', 7);
    const reset = lab.reset();
    expect(reset).toEqual({
      ...initial,
      caption: `Reset to the recorded graph. ${initial.caption}`,
    });
    expect(lab.state()).toEqual(reset);
  });

  it('clamps edited costs to 0–10, including an edit to an original cost of 11', () => {
    const lab = openRecordedGraphLab();
    const low = lab.setCost('e_DF', -1);
    expect(edge(low, 'e_DF')?.cost).toBe(0);
    expect(low).toMatchObject({ path: basePath, totalCost: 4 });
    const high = lab.setCost('e_DF', 15);
    expect(edge(high, 'e_DF')?.cost).toBe(10);
    expect(high.caption).toBe(
      'D–F cost changed from 0 to 10. Computed shortest route: A → C → E → F (cost 9).',
    );
    expect(edge(lab.setCost('e_AF', 11), 'e_AF')?.cost).toBe(10);
  });

  it('recomputes the recorded threshold and reroutes via E above 5 at cost 9', () => {
    const lab = openRecordedGraphLab();
    const { edgeId, criticalCost } = lab.state().probe;
    expect(lab.setCost(edgeId, criticalCost - 1)).toMatchObject({
      path: basePath,
      totalCost: 8,
    });
    expect(lab.setCost(edgeId, criticalCost).totalCost).toBe(9);
    const result = lab.setCost(edgeId, criticalCost + 1);
    expect(result).toMatchObject({ path: viaE, totalCost: 9, status: 'found' });
    expect(edge(result, edgeId)).toMatchObject({
      cost: 6,
      enabled: true,
      onPath: false,
    });
    expect(result.caption).toBe(
      'D–F cost changed from 5 to 6. Computed shortest route: A → C → E → F (cost 9).',
    );
  });

  it('retains an edited cost on a cut edge without using it until restored', () => {
    const lab = openRecordedGraphLab();
    lab.toggleEdge('e_DF');
    const cut = lab.setCost('e_DF', 0);
    expect(cut).toMatchObject({ path: viaE, totalCost: 9 });
    expect(edge(cut, 'e_DF')).toMatchObject({ enabled: false, cost: 0 });
    expect(lab.toggleEdge('e_DF')).toMatchObject({
      path: basePath,
      totalCost: 4,
    });
  });

  it('keeps previous snapshots, consumers and reopened labs isolated', () => {
    const lab = openRecordedGraphLab();
    const initial = lab.state();
    const edited = lab.setCost('e_DF', 6);
    expect(initial.path).toEqual(basePath);
    edited.nodes[0].label = 'changed';
    edited.edges[0].cost = 0;
    edited.path?.push('changed');
    expect(lab.state()).toMatchObject({
      nodes: initial.nodes,
      edges: expect.arrayContaining([expect.objectContaining({ id: 'e_AB', cost: 4 })]),
      path: viaE,
    });
    expect(openRecordedGraphLab().state()).toEqual(initial);
  });

  it('rejects invalid edits without changing the lab', () => {
    const lab = openRecordedGraphLab();
    const initial = lab.state();
    expect(() => lab.toggleEdge('unknown')).toThrow('Unknown lab edge');
    expect(() => lab.setCost('e_DF', Number.NaN)).toThrow();
    expect(lab.state()).toEqual(initial);
  });
});
