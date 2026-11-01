import { expect, it } from 'vitest';
import { createWeightedExample } from '../../src/lib/domain/exploration';
import { weightedGraphLayout } from '../../src/lib/domain/weighted-graph-layout';

it.each([500, 640])('keeps the weighted comparison labels clear at width %s', (width) => {
  const spec = createWeightedExample({ observationId: 'synthetic', version: 1, region: null });
  if (spec.mode !== 'checked-dijkstra') throw Error();
  const panel = spec.scene.panels.find((p) => p.kind === 'graph')!;
  if (panel.kind !== 'graph') throw Error();
  const before = structuredClone(spec),
    layout = weightedGraphLayout(panel, spec.input, width);
  expect(layout.labels.filter((l) => l.legend)).toEqual([]);
  for (const [i, label] of layout.labels.entries()) {
    expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
    expect(label.x + label.width / 2).toBeLessThanOrEqual(width);
    for (const node of layout.nodes)
      expect(
        Math.abs(node.x - label.x) > (node.width + label.width) / 2 ||
          Math.abs(node.y - label.y) > (node.height + label.height) / 2,
      ).toBe(true);
    for (const other of layout.labels.slice(i + 1))
      expect(
        Math.abs(other.x - label.x) > (other.width + label.width) / 2 ||
          Math.abs(other.y - label.y) > (other.height + label.height) / 2,
      ).toBe(true);
  }
  for (const node of layout.nodes) {
    expect(node.x - node.width / 2).toBeGreaterThanOrEqual(0);
    expect(node.x + node.width / 2).toBeLessThanOrEqual(width);
    expect(node.y - node.height / 2).toBeGreaterThanOrEqual(0);
  }
  expect(layout.nodes.find((n) => n.id === 'x')!.label).toBe('Unconnected X');
  expect(spec).toEqual(before);
});

it.each([500, 640])('places each cost on its own connection at width %s', (width) => {
  const spec = createWeightedExample({ observationId: 'synthetic', version: 1, region: null });
  if (spec.mode !== 'checked-dijkstra') throw Error();
  const panel = spec.scene.panels.find((p) => p.kind === 'graph')!;
  if (panel.kind !== 'graph') throw Error();
  const layout = weightedGraphLayout(panel, spec.input, width);
  const nearest = (edge: (typeof layout.edges)[number], x: number, y: number) =>
    Math.min(
      ...Array.from({ length: 101 }, (_, i) => edge.point(i / 100)).map((p) =>
        Math.hypot(p.x - x, p.y - y),
      ),
    );
  for (const label of layout.labels.filter((l) => !l.legend)) {
    const own = layout.edges.find((e) => e.id === label.id)!;
    const distance = nearest(own, label.x, label.y);
    // On the line, or touching it: never a detached badge with a leader line.
    expect(distance).toBeLessThanOrEqual(21);
    for (const other of layout.edges.filter((e) => e.id !== label.id))
      expect(nearest(other, label.x, label.y)).toBeGreaterThan(distance);
  }
});
