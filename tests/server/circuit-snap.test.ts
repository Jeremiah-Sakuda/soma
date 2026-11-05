import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import sharp from 'sharp';
import { snapCircuitToDrawing } from '../../src/lib/server/circuit-snap';
import { heroCircuitLayout } from '../fixtures/hero-circuit';

/** Spark's actual placement in the first live read of the Lecture 9 slide (35–117 px off). */
const liveRead = {
  nodes: [
    { nodeId: 'A', x: 0.312, y: 0.31 },
    { nodeId: 'B', x: 0.312, y: 0.56 },
    { nodeId: 'C', x: 0.545, y: 0.56 },
    { nodeId: 'D', x: 0.312, y: 0.84 },
  ],
  components: [
    { componentId: 'V1', x1: 0.115, y1: 0.483, x2: 0.115, y2: 0.595 },
    { componentId: 'R1', x1: 0.312, y1: 0.375, x2: 0.312, y2: 0.505 },
    { componentId: 'R2', x1: 0.312, y1: 0.615, x2: 0.312, y2: 0.785 },
    { componentId: 'R3', x1: 0.547, y1: 0.335, x2: 0.547, y2: 0.505 },
    { componentId: 'R4', x1: 0.547, y1: 0.615, x2: 0.547, y2: 0.785 },
    { componentId: 'R5', x1: 0.365, y1: 0.56, x2: 0.49, y2: 0.56 },
  ],
};
/** The second live read: x stretched about 1.3×, C 279 px off. */
const liveReadStretched = {
  nodes: [
    { nodeId: 'A', x: 691 / 1920, y: 311 / 1080 },
    { nodeId: 'B', x: 691 / 1920, y: 579 / 1080 },
    { nodeId: 'C', x: 1225 / 1920, y: 579 / 1080 },
    { nodeId: 'D', x: 691 / 1920, y: 872 / 1080 },
  ],
  components: [
    { componentId: 'V1', x1: 217 / 1920, y1: 526 / 1080, x2: 217 / 1920, y2: 616 / 1080 },
    { componentId: 'R1', x1: 691 / 1920, y1: 362 / 1080, x2: 691 / 1920, y2: 529 / 1080 },
    { componentId: 'R2', x1: 691 / 1920, y1: 630 / 1080, x2: 691 / 1920, y2: 821 / 1080 },
    { componentId: 'R3', x1: 1225 / 1920, y1: 313 / 1080, x2: 1225 / 1920, y2: 529 / 1080 },
    { componentId: 'R4', x1: 1225 / 1920, y1: 630 / 1080, x2: 1225 / 1920, y2: 821 / 1080 },
    { componentId: 'R5', x1: 778 / 1920, y1: 579 / 1080, x2: 1139 / 1920, y2: 579 / 1080 },
  ],
};
const slide = async (width = 1600) =>
  'data:image/png;base64,' +
  (
    await sharp(readFileSync('docs/examples/hero-circuit/lecture-9-bridge.png'))
      .resize({ width })
      .png()
      .toBuffer()
  ).toString('base64');
const px = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot((a.x - b.x) * 1920, (a.y - b.y) * 1080);
const mid = (c: { x1: number; y1: number; x2: number; y2: number }) => ({
  x: (c.x1 + c.x2) / 2,
  y: (c.y1 + c.y2) / 2,
});

describe('a circuit reading snapped onto its own drawing', () => {
  it.each([
    ['first live read', liveRead],
    ['stretched second live read', liveReadStretched],
  ])(
    'moves every node onto its junction dot and every part onto its body (%s)',
    async (_, read) => {
      const { layout, snappedNodes, refinedParts } = await snapCircuitToDrawing(
        await slide(),
        read,
      );
      expect(snappedNodes).toBe(4);
      expect(refinedParts).toBe(6);
      for (const truth of heroCircuitLayout.nodes)
        expect(
          px(
            layout.nodes.find((n) => n.nodeId === truth.nodeId)!,
            truth,
          ),
        ).toBeLessThan(6);
      for (const truth of heroCircuitLayout.components) {
        const got = layout.components.find((c) => c.componentId === truth.componentId)!;
        expect(px(mid(got), mid(truth))).toBeLessThan(12);
        // Each end lands within a stroke or two of where the body starts and stops; the battery's
        // printed + sign beside its plates can stretch its top end a little.
        const limit = truth.componentId === 'V1' ? 26 : 10;
        expect(px({ x: got.x1, y: got.y1 }, { x: truth.x1, y: truth.y1 })).toBeLessThan(limit);
        expect(px({ x: got.x2, y: got.y2 }, { x: truth.x2, y: truth.y2 })).toBeLessThan(limit);
      }
    },
  );

  it('works at a smaller capture and leaves an accurate reading where it is', async () => {
    const small = await snapCircuitToDrawing(await slide(1200), liveRead);
    for (const truth of heroCircuitLayout.nodes)
      expect(
        px(
          small.layout.nodes.find((n) => n.nodeId === truth.nodeId)!,
          truth,
        ),
      ).toBeLessThan(8);
    const exact = await snapCircuitToDrawing(await slide(), heroCircuitLayout);
    for (const truth of heroCircuitLayout.components)
      expect(
        px(
          mid(exact.layout.components.find((c) => c.componentId === truth.componentId)!),
          mid(truth),
        ),
      ).toBeLessThan(12);
  });
});
