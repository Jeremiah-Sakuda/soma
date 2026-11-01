import { describe, expect, it } from 'vitest';
import { applyGraphLayout, fitSourcePositions } from '../../src/lib/domain/source-layout';
import { createWeightedExample } from '../../src/lib/domain/exploration';

const ref = { observationId: 'original', version: 1, region: null };
const weighted = () => createWeightedExample(ref);

const slide = [
  { nodeId: 'A', x: 0.11, y: 0.54 },
  { nodeId: 'B', x: 0.23, y: 0.41 },
  { nodeId: 'C', x: 0.23, y: 0.7 },
  { nodeId: 'D', x: 0.41, y: 0.41 },
  { nodeId: 'E', x: 0.41, y: 0.7 },
  { nodeId: 'F', x: 0.53, y: 0.54 },
];

describe('source graph layout', () => {
  it('keeps the drawing’s shape and aspect ratio inside the panel', () => {
    const fitted = fitSourcePositions(['A', 'B', 'C', 'D', 'E', 'F'], slide)!;
    const at = (id: string) => fitted.find((p) => p.nodeId === id)!;
    expect(at('A').x).toBeCloseTo(0.08);
    expect(at('F').x).toBeCloseTo(0.92);
    expect(at('B').y).toBeCloseTo(at('D').y);
    expect(at('C').y).toBeGreaterThan(at('B').y);
    // 0.42 wide by 0.29 tall in the source: the vertical span shrinks with the same scale.
    expect(at('C').y - at('B').y).toBeCloseTo(((0.7 - 0.41) / 0.42) * 0.84, 3);
  });
  it('refuses incomplete or indistinguishable placements', () => {
    expect(fitSourcePositions(['A', 'B', 'G'], slide)).toBeNull();
    expect(
      fitSourcePositions(['A', 'B', 'C'], [
        { nodeId: 'A', x: 0, y: 0 },
        { nodeId: 'B', x: 1, y: 0 },
        { nodeId: 'C', x: 1.01, y: 0 },
      ]),
    ).toBeNull();
  });
  it('places a fresh source layout, otherwise keeps the previous revision, never changing the graph', () => {
    const spec = weighted();
    if (spec.mode !== 'checked-dijkstra') throw Error();
    const ids = spec.input.nodes.map((n) => n.id);
    const input = structuredClone(spec.input);
    const source = ids.map((nodeId, i) => ({ nodeId, x: (i % 3) / 2, y: Math.floor(i / 3) / 2 }));
    expect(applyGraphLayout(spec, { source })).toBe('source');
    expect(spec.input).toEqual(input);
    const placed = spec.scene.panels.find((p) => p.kind === 'graph')!;
    const next = weighted();
    expect(applyGraphLayout(next, { previous: spec })).toBe('previous');
    if (next.mode !== 'checked-dijkstra') throw Error();
    expect(next.scene.panels.find((p) => p.kind === 'graph')).toMatchObject({
      positions: placed.kind === 'graph' ? placed.positions : [],
    });
    expect(applyGraphLayout(weighted(), {})).toBeNull();
  });
});
