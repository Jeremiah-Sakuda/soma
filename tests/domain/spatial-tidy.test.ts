import { describe, expect, it } from 'vitest';
import { tidySpatialPanel } from '../../src/lib/domain/spatial-tidy';
import { validateSpatialPanel, type SpatialPanel } from '../../src/lib/domain/spatial-schema';

const part = (id: string, x: number, y: number, z: number, s = 0.3, parentId: string | null = null): SpatialPanel['objects'][number] => ({
  id, label: id, description: `${id} part`, shape: 'box', color: 'sage', position: { x, y, z }, size: { x: s, y: s, z: s }, parentId,
});
const panel = (objects: SpatialPanel['objects'], poses: SpatialPanel['poses'] = []): SpatialPanel => ({
  id: 'model', kind: 'spatial', title: 'Model', placement: { column: 1, row: 1, columnSpan: 2 }, objects, connections: [], poses,
});
const box = (o: SpatialPanel['objects'][number]) => ({
  min: [o.position.x - o.size.x / 2, o.position.y - o.size.y / 2, o.position.z - o.size.z / 2],
  max: [o.position.x + o.size.x / 2, o.position.y + o.size.y / 2, o.position.z + o.size.z / 2],
});

describe('tidySpatialPanel', () => {
  it('fills the stage with a scattered, tiny model, centred and standing on one floor', () => {
    const out = tidySpatialPanel(panel([part('a', -5.5, 3, 0, 0.15), part('b', 5, 4, 1, 0.2), part('c', 0, 2.5, -2, 0.1)]));
    const xs = out.objects.flatMap((o) => [box(o).min[0], box(o).max[0]]);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(5.5);
    expect(Math.abs(Math.max(...xs) + Math.min(...xs))).toBeLessThan(0.01);
    expect(Math.min(...out.objects.map((o) => box(o).min[1]))).toBeCloseTo(-1.5, 5);
    // Every part is big enough to see next to the model's span.
    for (const o of out.objects) expect(Math.max(o.size.x, o.size.y, o.size.z)).toBeGreaterThan(0.4);
    expect(() => validateSpatialPanel(out, [])).not.toThrow();
  });
  it('moves apart parts that interpenetrate, but keeps a part inside its container', () => {
    const out = tidySpatialPanel(panel([part("a", 0, 0, 0, 1), part("b", 0.1, 0, 0, 1), part('shell', 3, 0, 0, 2), part('core', 3, 0, 0, 0.5, 'shell')]));
    const [a, b, shell, core] = out.objects.map(box);
    const overlapX = Math.min(a.max[0], b.max[0]) - Math.max(a.min[0], b.min[0]);
    const overlapZ = Math.min(a.max[2], b.max[2]) - Math.max(a.min[2], b.min[2]);
    expect(overlapX <= 0.05 || overlapZ <= 0.05).toBe(true);
    for (let k = 0; k < 3; k++) {
      expect(core.min[k]).toBeGreaterThanOrEqual(shell.min[k] - 1e-9);
      expect(core.max[k]).toBeLessThanOrEqual(shell.max[k] + 1e-9);
    }
  });
  it('moves step poses with the model, so motion between steps is kept', () => {
    const out = tidySpatialPanel(panel([part('ball', -1, 0, 0, 0.5), part('wall', 1, 0, 0, 0.5)], [{ stepId: 's2', objectId: 'ball', position: { x: 0, y: 0, z: 0 }, visible: true }]));
    const ball = out.objects[0], wall = out.objects[1], pose = out.poses[0].position;
    // The ball still travels halfway to the wall.
    expect((pose.x - ball.position.x) / (wall.position.x - ball.position.x)).toBeCloseTo(0.5, 5);
  });
});
describe('tidySpatialPanel attachments', () => {
  it('leaves attached parts where the author put them', () => {
    const out = tidySpatialPanel(panel([part('string', 0, 0, 0, 2), part('clamp', 1, 0, 0, 0.5)]));
    const [string, clamp] = out.objects;
    // Still touching the string's end after the uniform rescale.
    expect(clamp.position.x - string.position.x).toBeCloseTo((string.size.x / 2), 5);
  });
});
describe('tidySpatialPanel arrows and tubes', () => {
  it('scales a path with the model and keeps a line thin', () => {
    const arrow = { ...part('force', 0, 1, 0, 0.1), shape: 'arrow' as const, path: [{ x: 0, y: 0.5, z: 0 }, { x: 0, y: 1.5, z: 0 }] };
    const out = tidySpatialPanel(panel([part('block', 0, 0, 0, 1), arrow]));
    const [block, force] = out.objects;
    expect(force.size.x).toBeLessThanOrEqual(0.4);
    // The arrow still starts on top of the block.
    expect(force.path![0].y).toBeCloseTo(block.position.y + block.size.y / 2, 5);
    expect(() => validateSpatialPanel(out, [])).not.toThrow();
  });
  it('turns an arrow without a path into a plain part', () => {
    const out = tidySpatialPanel(panel([{ ...part('x', 0, 0, 0, 1), shape: 'arrow' as const }]));
    expect(out.objects[0].shape).toBe('cylinder');
    expect(() => validateSpatialPanel(out, [])).not.toThrow();
  });
});
