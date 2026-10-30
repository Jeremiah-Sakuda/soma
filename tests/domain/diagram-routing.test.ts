import { it, expect } from 'vitest';
import { diagramLayout } from '../../src/lib/domain/exploration-layout';
import {
  diagramRoutes,
  pointOnDiagramRoute,
  segmentCrossesBox,
} from '../../src/lib/domain/diagram-routing';
import type { ExplorationPanel } from '../../src/lib/domain/exploration';
it('a branch skips the intervening card instead of visually turning it into a sequence', () => {
  const p: Extract<ExplorationPanel, { kind: 'diagram' }> = {
    id: 'branch',
    kind: 'diagram',
    title: 'Two paths',
    placement: { column: 1, row: 1, columnSpan: 2 },
    objects: [
      ...['reactants', 'high', 'low', 'products'].map((id, i) => ({
        id,
        kind: 'block' as const,
        label: id,
        position: { x: 0.45 + i * 0.01, y: 0.5 },
      })),
      {
        id: 'r-h',
        kind: 'edge',
        from: 'reactants',
        to: 'high',
        directed: true,
        label: 'high barrier',
      },
      {
        id: 'r-l',
        kind: 'edge',
        from: 'reactants',
        to: 'low',
        directed: true,
        label: 'lower barrier',
      },
      {
        id: 'h-p',
        kind: 'edge',
        from: 'high',
        to: 'products',
        directed: true,
        label: 'same products',
      },
      {
        id: 'l-p',
        kind: 'edge',
        from: 'low',
        to: 'products',
        directed: true,
        label: 'same products',
      },
    ],
  };
  for (const width of [280, 548, 760]) {
    const l = diagramLayout(p, width < 400, width),
      routes = diagramRoutes(p, l);
    expect(routes).toHaveLength(4);
    for (const r of routes) {
      expect(r.points.length).toBeGreaterThanOrEqual(2);
      for (let i = 1; i < r.points.length; i++) {
        for (const c of l.positions)
          expect(
            segmentCrossesBox(r.points[i - 1], r.points[i], {
              x1: c.x - l.cardWidth / 2,
              x2: c.x + l.cardWidth / 2,
              y1: c.y - l.cardHeight / 2,
              y2: c.y + l.cardHeight / 2,
            }),
          ).toBe(false);
      }
      for (const q of r.points) {
        expect(q.x).toBeGreaterThanOrEqual(0);
        expect(q.x).toBeLessThanOrEqual(l.width);
        expect(q.y).toBeGreaterThanOrEqual(0);
        expect(q.y).toBeLessThanOrEqual(l.height);
      }
      const length = r.points
        .slice(1)
        .reduce((sum, q, i) => sum + Math.hypot(q.x - r.points[i].x, q.y - r.points[i].y), 0);
      let before = pointOnDiagramRoute(r.points, 0);
      for (let i = 1; i <= 100; i++) {
        const next = pointOnDiagramRoute(r.points, i / 100);
        expect(Math.hypot(next.x - before.x, next.y - before.y)).toBeLessThanOrEqual(
          length / 100 + 0.001,
        );
        before = next;
      }
      expect(pointOnDiagramRoute(r.points, 1)).toEqual(r.points.at(-1));
    }
  }
});
