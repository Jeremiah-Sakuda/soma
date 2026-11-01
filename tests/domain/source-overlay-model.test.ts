import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { runBfs, runDijkstra } from '../../src/lib/domain/graph-search';
import { sourceOverlayModel } from '../../src/lib/domain/source-overlay-model';

const require = createRequire(import.meta.url);
const { validOverlayModel } = require('../../desktop/screen-overlay.cjs') as { validOverlayModel: (m: unknown) => boolean };

const E = (id: string, from: string, to: string, weight: number) => ({ id, from, to, weight });
// The original Lecture 14 slide, with node and printed-weight positions as drawn.
const hero = {
  nodes: ['A', 'B', 'C', 'D', 'E', 'F'].map((id) => ({ id, label: id })),
  edges: [E('AB', 'A', 'B', 4), E('AC', 'A', 'C', 1), E('BC', 'B', 'C', 2), E('BD', 'B', 'D', 1), E('CE', 'C', 'E', 5), E('DE', 'D', 'E', 3), E('DF', 'D', 'F', 3), E('EF', 'E', 'F', 3), E('AF', 'A', 'F', 11)],
  directed: false,
  start: 'A',
  goal: 'F',
  neighborOrder: ['A', 'B', 'C', 'D', 'E', 'F'],
};
const layout = {
  nodes: [
    { nodeId: 'A', x: 0.107, y: 0.54 },
    { nodeId: 'B', x: 0.227, y: 0.41 },
    { nodeId: 'C', x: 0.227, y: 0.698 },
    { nodeId: 'D', x: 0.414, y: 0.41 },
    { nodeId: 'E', x: 0.414, y: 0.698 },
    { nodeId: 'F', x: 0.534, y: 0.54 },
  ],
  edgeLabels: [
    { edgeId: 'AF', x: 0.321, y: 0.302 },
    { edgeId: 'CE', x: 0.32, y: 0.725 },
  ],
};
const model = (index: number, extra = {}) => {
  const execution = runDijkstra({ ...hero, algorithm: 'dijkstra' });
  return sourceOverlayModel({ layout, graph: hero, execution, index, disabledEdgeIds: [], caption: 'x', stepLabel: 'Step', aspect: 0.5625, ...extra });
};

describe('source overlay model', () => {
  it('states the relaxation that beats the direct edge and strikes it, as computed', () => {
    const execution = runDijkstra({ ...hero, algorithm: 'dijkstra' });
    const at = execution.steps.findIndex((s) => s.distances.F === 7);
    const m = model(at);
    expect(m.tags.find((t) => t.tone === 'equation')?.text).toBe('4 + 3 = 7 < 11');
    expect(m.edges.find((e) => e.id === 'AF')?.tone).toBe('struck');
    expect(m.edges.find((e) => e.id === 'DF')?.tone).toBe('relaxed');
    expect(m.tags.filter((t) => t.tone === 'settled' || t.tone === 'current').map((t) => t.text)).toContain('④ D = 4');
  });
  it('draws an edge as an arc only when its printed label sits well off the straight line', () => {
    const m = model(0);
    const af = m.edges.find((e) => e.id === 'AF')!,
      ce = m.edges.find((e) => e.id === 'CE')!;
    expect(af.control.y).toBeLessThan(0.2);
    expect(ce.control.y).toBeCloseTo(0.698, 2);
  });
  it('replays the goal’s last relaxation and the route on the final frame', () => {
    const m = model(99);
    expect(m.tags.find((t) => t.tone === 'equation')?.text).toBe('4 + 3 = 7 < 11');
    expect(m.tags.find((t) => t.tone === 'route')?.text).toBe('A → C → B → D → F = 7');
    expect(m.edges.filter((e) => e.tone === 'path').map((e) => e.id).sort()).toEqual(['AC', 'BC', 'BD', 'DF']);
  });
  it('keeps every frame within the companion’s validator, even for large graphs with long labels', () => {
    for (let i = 0; i < 8; i++) expect(validOverlayModel(model(i))).toBe(true);
    const ids = Array.from({ length: 12 }, (_, i) => `n${i}`);
    const big = {
      nodes: ids.map((id) => ({ id, label: `${id} ${'long label '.repeat(7)}`.slice(0, 80) })),
      edges: ids.slice(1).map((id, i) => E(`e${i}`, ids[i], id, i + 1)),
      directed: false,
      start: 'n0',
      goal: 'n11',
      neighborOrder: ids,
    };
    const execution = runDijkstra({ ...big, algorithm: 'dijkstra' });
    const spread = { nodes: ids.map((nodeId, i) => ({ nodeId, x: 0.05 + (i % 6) * 0.17, y: 0.2 + Math.floor(i / 6) * 0.5 })), edgeLabels: [] };
    for (const index of [0, 5, 99]) {
      const m = sourceOverlayModel({ layout: spread, graph: big, execution, index, disabledEdgeIds: [], caption: 'c'.repeat(900), stepLabel: 'Step', aspect: 0.5625 });
      expect(validOverlayModel(m)).toBe(true);
    }
  });
});

describe('source overlay model edge cases', () => {
  it('keeps the route and the goal on a crowded final frame', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `n${i}`);
    const chain = { nodes: ids.map((id) => ({ id, label: id })), edges: ids.slice(1).map((id, i) => E(`e${i}`, ids[i], id, 1)), directed: false, start: 'n0', goal: 'n11', neighborOrder: ids };
    const execution = runDijkstra({ ...chain, algorithm: 'dijkstra' });
    const spread = { nodes: ids.map((nodeId, i) => ({ nodeId, x: 0.05 + (i % 6) * 0.17, y: 0.25 + Math.floor(i / 6) * 0.45 })), edgeLabels: [] };
    const m = sourceOverlayModel({ layout: spread, graph: chain, execution, index: 99, disabledEdgeIds: [], caption: 'cap', stepLabel: 'Round', aspect: 0.5625 });
    const route = m.tags.some((t) => t.tone === 'route') || m.caption!.text.includes('n0 → n1');
    expect(route).toBe(true);
    expect(m.tags.some((t) => t.id === 'settled-n11')).toBe(true);
  });
  it('rounds decimal costs in equations and tags', () => {
    const g = { nodes: ['A', 'B', 'C'].map((id) => ({ id, label: id })), edges: [E('AB', 'A', 'B', 0.1), E('BC', 'B', 'C', 0.2), E('AC', 'A', 'C', 0.5)], directed: false, start: 'A', goal: 'C', neighborOrder: ['A', 'B', 'C'] };
    const execution = runDijkstra({ ...g, algorithm: 'dijkstra' });
    const lay = { nodes: [{ nodeId: 'A', x: 0.1, y: 0.5 }, { nodeId: 'B', x: 0.4, y: 0.3 }, { nodeId: 'C', x: 0.7, y: 0.5 }], edgeLabels: [] };
    const texts = execution.steps.flatMap((_, i) => sourceOverlayModel({ layout: lay, graph: g, execution, index: i, disabledEdgeIds: [], caption: 'c', stepLabel: 'Round', aspect: 0.5625 }).tags.map((t) => t.text));
    expect(texts.join(' ')).not.toMatch(/\d\.\d{3,}/);
    expect(texts).toContain('0.1 + 0.2 = 0.3 < 0.5');
  });
  it('counts edges, not weights, for a breadth-first route', () => {
    const g = { ...hero, edges: hero.edges.map((e) => ({ ...e, weight: 1 })) };
    const execution = runBfs({ ...g, algorithm: 'bfs' });
    const m = sourceOverlayModel({ layout, graph: g, execution, index: 99, disabledEdgeIds: [], caption: 'c', stepLabel: 'Round', aspect: 0.5625 });
    const text = m.tags.find((t) => t.tone === 'route')?.text ?? m.caption!.text;
    expect(text).toContain('A → F = 1 edge');
  });
  it('labels a cut connection with its real cost', () => {
    const graph = hero;
    const execution = runDijkstra({ ...hero, edges: hero.edges.filter((e) => e.id !== 'DF'), algorithm: 'dijkstra' });
    const m = sourceOverlayModel({ layout, graph, execution, index: 99, disabledEdgeIds: ['DF'], caption: 'c', stepLabel: 'Round', aspect: 0.5625 });
    expect(m.edges.find((e) => e.id === 'DF')?.label).toMatch(/cost 3/);
  });
  it('keeps the total of a long route whole', () => {
    const names = ['Central Depot', 'Riverside Market', 'Old Town Hall', 'University', 'Harbor Station', 'Public Library', 'Airport Terminal'];
    const ids = names.map((_, i) => `n${i}`);
    const g = { nodes: ids.map((id, i) => ({ id, label: names[i] })), edges: ids.slice(1).map((id, i) => E(`e${i}`, ids[i], id, 13)), directed: false, start: 'n0', goal: 'n6', neighborOrder: ids };
    const execution = runDijkstra({ ...g, algorithm: 'dijkstra' });
    const lay = { nodes: ids.map((nodeId, i) => ({ nodeId, x: 0.08 + i * 0.13, y: i % 2 ? 0.35 : 0.6 })), edgeLabels: [] };
    const m = sourceOverlayModel({ layout: lay, graph: g, execution, index: 99, disabledEdgeIds: [], caption: 'c', stepLabel: 'Round', aspect: 0.5625 });
    const text = m.tags.find((t) => t.tone === 'route')?.text ?? m.caption!.text;
    expect(text).toContain('= 78');
    expect(validOverlayModel(m)).toBe(true);
  });
  it('rounds edited costs and node distances, and keeps huge costs valid', () => {
    const m = model(99, { weights: { AF: 134.6153846153846 } });
    expect(m.weights.find((w) => w.edgeId === 'AF')?.text).toBe('11 → 134.62');
    const big = model(99, { weights: { AF: 123456789.123 } });
    expect(validOverlayModel(big)).toBe(true);
  });
  it('makes a rounded equation add up', () => {
    const g = { nodes: ['A', 'B', 'C'].map((id) => ({ id, label: id })), edges: [E('AB', 'A', 'B', 0.004), E('BC', 'B', 'C', 0.004), E('AC', 'A', 'C', 1)], directed: false, start: 'A', goal: 'C', neighborOrder: ['A', 'B', 'C'] };
    const execution = runDijkstra({ ...g, algorithm: 'dijkstra' });
    const lay = { nodes: [{ nodeId: 'A', x: 0.1, y: 0.5 }, { nodeId: 'B', x: 0.4, y: 0.3 }, { nodeId: 'C', x: 0.7, y: 0.5 }], edgeLabels: [] };
    const eq = sourceOverlayModel({ layout: lay, graph: g, execution, index: 99, disabledEdgeIds: [], caption: 'c', stepLabel: 'Round', aspect: 0.5625 }).tags.find((t) => t.tone === 'equation')!.text;
    const [a, b, total] = eq.split(/[+=<]/).map((x) => Number(x.trim()));
    expect(Number((a + b).toFixed(4))).toBe(total);
  });
  it('labels the goal on a breadth-first final frame and stays valid', () => {
    const g = { ...hero, edges: hero.edges.map((e) => ({ ...e, weight: 1 })) };
    const execution = runBfs({ ...g, algorithm: 'bfs' });
    const m = sourceOverlayModel({ layout, graph: g, execution, index: 99, disabledEdgeIds: [], caption: 'c', stepLabel: 'Round', aspect: 0.5625 });
    expect(m.tags.some((t) => t.id === 'settled-F')).toBe(true);
    expect(validOverlayModel(m)).toBe(true);
  });
  it('keeps the caption on screen', () => {
    const low = { ...layout, nodes: layout.nodes.map((n) => ({ ...n, y: Math.min(0.95, n.y + 0.3) })) };
    const m = model(3, { layout: low });
    expect(m.caption!.y).toBeLessThanOrEqual(0.86);
  });
});

describe('companion overlay validator', () => {
  it('checks the optional strike point and quiet flag', () => {
    const m = model(99);
    expect(validOverlayModel(m)).toBe(true);
    const struck = structuredClone(m);
    struck.edges[0].strike = { x: 9, y: 9 };
    expect(validOverlayModel(struck)).toBe(false);
    const quiet = structuredClone(m);
    (quiet.tags[0] as { quiet?: unknown }).quiet = 'yes';
    expect(validOverlayModel(quiet)).toBe(false);
  });
});
