import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { runDijkstra } from '../../src/lib/domain/graph-search';
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
