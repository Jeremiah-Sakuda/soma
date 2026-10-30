import { readFileSync } from 'node:fs';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import { it, expect } from 'vitest';
import {
  diagramLayout,
  diagramEdgeLabels,
  arrangeExplanationPanels,
} from '../../src/lib/domain/exploration-layout';
import type { ExplorationPanel } from '../../src/lib/domain/exploration';
const panel = (count: number): Extract<ExplorationPanel, { kind: 'diagram' }> => ({
  id: 'process',
  kind: 'diagram',
  title: 'Dense process',
  placement: { column: 1, row: 1, columnSpan: 2 },
  objects: [
    ...Array.from({ length: count }, (_, i) => ({
      id: `stage${i}`,
      kind: 'block' as const,
      label: `Processing stage ${i}`,
      position: { x: 0.4 + i * 0.001, y: 0.5 },
    })),
    {
      id: 'note',
      kind: 'text',
      text: 'A full explanation remains visible below the mechanism.',
      position: { x: 0.5, y: 0.5 },
    },
  ],
});
it.each([false, true])(
  'lays out 2–29 crowded cards without intersections or clipped bounds, compact=%s',
  (compact) => {
    for (let n = 2; n <= 29; n++) {
      const p = panel(n),
        before = structuredClone(p),
        layout = diagramLayout(p, compact);
      expect(layout.crowded).toBe(true);
      expect(p).toEqual(before);
      for (const [i, a] of layout.positions.entries()) {
        expect(a.x - layout.cardWidth / 2).toBeGreaterThanOrEqual(0);
        expect(a.x + layout.cardWidth / 2).toBeLessThanOrEqual(layout.width);
        expect(a.y - layout.cardHeight / 2).toBeGreaterThanOrEqual(0);
        expect(a.y + layout.cardHeight / 2).toBeLessThan(layout.notes[0].y);
        for (const b of layout.positions.slice(i + 1))
          expect(
            Math.abs(a.x - b.x) >= layout.cardWidth || Math.abs(a.y - b.y) >= layout.cardHeight,
          ).toBe(true);
      }
      expect(layout.notes[0].y + layout.notes[0].height).toBeLessThanOrEqual(layout.height);
    }
  },
);
it('keeps distinct authored positions and semantic identities stable', () => {
  const p = panel(2);
  for (const [i, o] of p.objects.entries()) if (o.kind === 'block') o.position = { x: i, y: i };
  const layout = diagramLayout(p, false);
  expect(layout.crowded).toBe(false);
  expect(layout.positions.map((p) => p.id)).toEqual(['stage0', 'stage1']);
  expect(diagramLayout(p, false)).toEqual(layout);
});

it('reserves headroom for a visible self-loop above the first card', () => {
  const p = panel(2);
  p.objects.push({
    id: 'again',
    kind: 'edge',
    from: 'stage0',
    to: 'stage0',
    directed: true,
    label: 'retry',
  });
  expect(diagramLayout(p, true).positions[0].y - 82).toBeGreaterThanOrEqual(0);
});

it('reflows a crowded causal chain in arrow order instead of backwards authored y order', () => {
  const p = panel(5);
  for (const [i, o] of p.objects.entries())
    if (o.kind === 'block') o.position = { x: 0.5, y: 0.5 - i * 0.001 };
  for (let i = 0; i < 4; i++)
    p.objects.push({
      id: `flow${i}`,
      kind: 'edge',
      from: `stage${i}`,
      to: `stage${i + 1}`,
      directed: true,
      label: '',
    });
  const before = structuredClone(p),
    layout = diagramLayout(p, false, 620);
  expect(layout.positions.map((n) => n.id)).toEqual([
    'stage0',
    'stage1',
    'stage2',
    'stage3',
    'stage4',
  ]);
  expect(layout.positions[3].x).toBe(layout.positions[2].x);
  expect(layout.positions[4].x).toBeLessThan(layout.positions[3].x);
  expect(p).toEqual(before);
});

it.each([280, 320, 375, 400, 620, 760])(
  'keeps long labels and dense connections clear at measured width %i',
  (width) => {
    const p = panel(8);
    for (const o of p.objects)
      if (o.kind === 'block')
        o.label =
          'A long source-specific processing label that must remain readable in the companion';
    for (let i = 0; i < 7; i++)
      p.objects.push({
        id: `edge${i}`,
        kind: 'edge',
        from: `stage${i}`,
        to: `stage${i + 1}`,
        directed: true,
        label: `transform ${i} into ${i + 1}`,
      });
    const layout = diagramLayout(p, width <= 620, width),
      labels = diagramEdgeLabels(p, layout);
    expect(layout.cardHeight).toBeGreaterThan(76);
    expect(labels).toHaveLength(7);
    for (const node of layout.positions) {
      expect(node.x - layout.cardWidth / 2).toBeGreaterThanOrEqual(0);
      expect(node.x + layout.cardWidth / 2).toBeLessThanOrEqual(width);
    }
    for (const [i, label] of labels.entries())
      if (!label.legend) {
        expect(label.x - label.width / 2).toBeGreaterThanOrEqual(0);
        expect(label.x + label.width / 2).toBeLessThanOrEqual(width);
        for (const node of layout.positions)
          expect(
            Math.abs(label.x - node.x) >= (label.width + layout.cardWidth) / 2 ||
              Math.abs(label.y - node.y) >= (24 + layout.cardHeight) / 2,
          ).toBe(true);
        for (const other of labels.slice(i + 1).filter((l) => !l.legend))
          expect(
            Math.abs(label.x - other.x) >= (label.width + other.width) / 2 ||
              Math.abs(label.y - other.y) >= 24,
          ).toBe(true);
      }
  },
);

it('moves a connection label to the legend instead of covering another connection', () => {
  const p = panel(2);
  for (const [i, object] of p.objects.entries())
    if (object.kind === 'block') object.position = { x: i, y: 0 };
  p.objects.push({
    id: 'a',
    kind: 'edge',
    from: 'stage0',
    to: 'stage1',
    directed: true,
    label: 'flow',
  });
  const layout = diagramLayout(p, false, 600),
    y = layout.positions[0].y;
  const direct = {
    id: 'a',
    points: [
      { x: 172, y },
      { x: 428, y },
    ],
  };
  expect(diagramEdgeLabels(p, layout, [direct])[0].legend).toBe(false);
  const labels = diagramEdgeLabels(p, layout, [
    direct,
    {
      id: 'crossing',
      points: [
        { x: 300, y: 0 },
        { x: 300, y: layout.height },
      ],
    },
  ]);
  expect(labels[0].legend).toBe(true);
  expect(labels[0].text).toBe('flow');
});

it('reflows overlapping explanatory panels without another model call or any content changes', () => {
  const spec = structuredClone(
    JSON.parse(readFileSync('tests/fixtures/visual-polish-scenes.json', 'utf8')).gradient,
  );
  spec.scene.panels[1].placement = { ...spec.scene.panels[0].placement };
  const original = structuredClone(spec);
  expect(() => checkExploration(spec)).toThrow('overlap');
  const out = arrangeExplanationPanels(spec);
  expect(out.changed).toBe(true);
  expect(() => checkExploration(out.spec)).not.toThrow();
  expect(out.spec.mode).toBe('explanation');
  if (out.spec.mode !== 'explanation') throw Error('fixture');
  expect(out.spec.scene.panels.map(({ placement, ...content }) => content)).toEqual(
    original.scene.panels.map(({ placement, ...content }: any) => content),
  );
  expect({ ...out.spec, scene: original.scene }).toEqual(original);
  expect(spec).toEqual(original);
});
it('leaves checked scenes and valid explanation layout unchanged', () => {
  const checked = createExampleExploration();
  expect(arrangeExplanationPanels(checked)).toEqual({ spec: checked, changed: false });
  const spec = checkExploration(
    JSON.parse(readFileSync('tests/fixtures/visual-polish-scenes.json', 'utf8')).gradient,
  ).spec;
  expect(arrangeExplanationPanels(spec)).toEqual({ spec, changed: false });
});
