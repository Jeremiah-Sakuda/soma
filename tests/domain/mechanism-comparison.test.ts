import { describe, expect, it } from 'vitest';
import pairs from '../../docs/examples/pm117/comparisons.json';
import originalPiston from '../../docs/examples/pm117/piston-original-after.json';
import { checkExploration } from '../../src/lib/domain/exploration';
import { mechanismMeshes } from '../../src/lib/domain/mechanism-geometry';
import type { ExplorationArtifact } from '../../src/lib/server/exploration-types';
const artifacts = pairs as unknown as {
  id: string;
  before: ExplorationArtifact;
  after: ExplorationArtifact;
}[];
function panel(a: ExplorationArtifact) {
  if (a.spec.mode !== 'explanation') throw Error('Expected explanation');
  const p = a.spec.scene.panels.find((p) => p.kind === 'spatial');
  if (p?.kind !== 'spatial') throw Error('Expected spatial panel');
  return p;
}
function yBounds(a: ExplorationArtifact, id: string, t: number, piece?: string) {
  const o = panel(a).objects.find((o) => o.id === id)!;
  const points = mechanismMeshes({
    ...o,
    geometry: piece ? o.geometry!.filter((p) => p.id === piece) : o.geometry,
    parameterValues: { compress: t },
  }).flatMap((m) => m.vertices.map((v) => v[1] + o.position.y));
  return { min: Math.min(...points), max: Math.max(...points) };
}
describe('actual Muse comparison mechanisms', () => {
  for (const pair of artifacts)
    it(`${pair.id}: rigid moving group and fixed supports across the entire control range`, () => {
      for (const a of [pair.before, pair.after])
        expect(checkExploration(a.spec).validation.assurance).toBe('explanation-only');
      const p = panel(pair.after),
        parameter = p.parameters![0];
      const pieces = p.objects.flatMap((o) =>
        (o.geometry ?? []).map((piece) => ({ ...o, geometry: [piece] })),
      );
      const moving = pieces.filter((o) => o.geometry[0].driver),
        fixed = pieces.filter((o) => !o.geometry[0].driver);
      expect(moving.length).toBeGreaterThanOrEqual(2);
      expect(fixed.length).toBeGreaterThan(0);
      const point = (o: (typeof pieces)[number], t: number) =>
        mechanismMeshes({ ...o, parameterValues: { [parameter.id]: t } })[0].vertices[0].map(
          (n, i) => n + [o.position.x, o.position.y, o.position.z][i],
        );
      const dist = (a: number[], b: number[]) => Math.hypot(...a.map((n, i) => n - b[i]));
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        for (let a = 0; a < moving.length; a++)
          for (let b = a + 1; b < moving.length; b++)
            expect(dist(point(moving[a], t), point(moving[b], t))).toBeCloseTo(
              dist(point(moving[a], 0), point(moving[b], 0)),
              8,
            );
        for (const o of fixed) expect(point(o, t)).toEqual(point(o, 0));
      }
    });
  it('corrected piston never enters its base and keeps the rod touching head and grip at 101 positions', () => {
    const a = artifacts.find((p) => p.id === 'piston')!.after,
      top = yBounds(a, 'guideObj', 0, 'guideBase').max;
    for (let i = 0; i <= 100; i++) {
      const head = yBounds(a, 'headObj', i / 100),
        rod = yBounds(a, 'rodObj', i / 100),
        grip = yBounds(a, 'gripObj', i / 100);
      expect(head.min).toBeGreaterThan(top + 0.002);
      expect(Math.abs(rod.min - head.max)).toBeLessThan(0.015);
      expect(Math.abs(grip.min - rod.max)).toBeLessThan(0.015);
    }
  });
  it('retains the original piston error as evidence; schema validation alone does not detect collision', () => {
    const a = originalPiston as unknown as ExplorationArtifact;
    expect(checkExploration(a.spec).validation.assurance).toBe('explanation-only');
    expect(yBounds(a, 'headObj', 1).min).toBeLessThan(yBounds(a, 'guideObj', 0, 'guideBase').max);
  });
});
