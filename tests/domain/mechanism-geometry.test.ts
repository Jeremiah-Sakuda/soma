import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { checkExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
import { createMechanismExample } from '../../src/lib/domain/mechanism-example';
import { faceNormal, mechanismBounds, mechanismMeshes, meshTriangles, pieceMesh, rotatePoint } from '../../src/lib/domain/mechanism-geometry';
import { mechanismPieceSchema, validateMechanism, type MechanismPiece } from '../../src/lib/domain/mechanism-schema';
import { spatialScene } from '../../src/lib/domain/spatial-exploration';
import { anatomyPart, anatomyProjection } from '../../src/components/anatomy-geometry';
import { createSpatialPart } from '../../src/components/spatial-parts';
import { iso } from '../../src/vendor/anatomy/iso-kit';
import { defaultSpatialView, validateSpatialPanel } from '../../src/lib/domain/spatial-schema';

const spec = createMechanismExample();
if (spec.mode !== 'explanation' || spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
const panel = spec.scene.panels[0], parameters = panel.parameters!;
const pieces = panel.objects.flatMap(o => o.geometry!);
const prism = pieces[0], lathe = pieces.find(p => p.form.kind === 'lathe')!, tube = pieces.find(p => p.form.kind === 'tube')!;
const zero = { x: 0, y: 0, z: 0 };
function validate(piece: MechanismPiece) { validateMechanism([mechanismPieceSchema.parse(piece)], parameters); }

describe('bounded mechanism compiler', () => {
  it('accepts the original prepared source as explanation-only, with all three forms', () => {
    expect(checkExploration(spec).validation.assurance).toBe('explanation-only');
    expect(new Set(pieces.map(p => p.form.kind))).toEqual(new Set(['prism', 'lathe', 'tube']));
    expect(validateMechanism(pieces, parameters)).toBeLessThan(100);
  });
  it.each([prism, lathe, tube])('$id compiles finite, outward-facing closed surfaces without mutating its specification', piece => {
    const before = JSON.stringify(piece), mesh = pieceMesh({ ...piece, driver: null });
    expect(meshTriangles(mesh).length % 9).toBe(0);
    const center = mesh.vertices.reduce<number[]>((p, v) => p.map((n, i) => n + v[i] / mesh.vertices.length), [0, 0, 0]);
    for (const face of mesh.faces) {
      expect(face.every(i => i >= 0 && i < mesh.vertices.length)).toBe(true);
      const normal = faceNormal(mesh.vertices, face);
      expect(normal.every(Number.isFinite)).toBe(true);
      if (piece.form.kind !== 'tube') {
        const centroid = face.reduce((p, i) => p.map((n, j) => n + mesh.vertices[i][j] / face.length), [0, 0, 0]);
        expect(normal.reduce((n, v, i) => n + v * (centroid[i] - center[i]), 0)).toBeGreaterThan(0);
      }
    }
    expect(JSON.stringify(piece)).toBe(before);
  });
  it('uses the stated hinge axis and preserves rigid distances throughout a coupled movement', () => {
    const piece = panel.objects[1].geometry![0], pivot = piece.driver!.pivot;
    const rest = pieceMesh(piece, 0), open = pieceMesh(piece, 1);
    for (const [i, p] of rest.vertices.entries()) {
      const [x, y, z] = open.vertices[i], angle = -100 * Math.PI / 180;
      expect(x).toBeCloseTo(pivot.x + (p[0] - pivot.x) * Math.cos(angle) + (p[2] - pivot.z) * Math.sin(angle), 12);
      expect(y).toBeCloseTo(p[1], 12);
      expect(z).toBeCloseTo(pivot.z - (p[0] - pivot.x) * Math.sin(angle) + (p[2] - pivot.z) * Math.cos(angle), 12);
      expect(Math.hypot(x - pivot.x, y - pivot.y, z - pivot.z)).toBeCloseTo(Math.hypot(p[0] - pivot.x, p[1] - pivot.y, p[2] - pivot.z), 12);
    }
    expect(rotatePoint([1, 0, 0], [0, 90, 0])).toEqual([expect.closeTo(0, 12), 0, -1]);
  });
  it('keeps every vertex inside a stable bound through compound rotations and translations', () => {
    const piece = { ...prism, driver: { parameterId: 'opening', pivot: { x: -.5, y: .5, z: -.5 }, translation: { x: .5, y: -.5, z: .5 }, rotation: { x: 180, y: -180, z: 180 } } };
    const object = { ...panel.objects[0], geometry: [piece] }, bound = mechanismBounds(object);
    for (let i = 0; i <= 257; i++) {
      const meshes = mechanismMeshes({ ...object, parameterValues: { opening: i / 257 } });
      for (const mesh of meshes) for (const vertex of mesh.vertices) for (const axis of [0, 1, 2]) {
        const actual = vertex[axis] + [object.position.x, object.position.y, object.position.z][axis];
        expect(actual).toBeGreaterThanOrEqual(bound.min[axis]); expect(actual).toBeLessThanOrEqual(bound.max[axis]);
      }
      expect(mechanismBounds({ ...object, parameterValues: { opening: i / 257 } })).toEqual(bound);
    }
  });
  it('fits revised geometry and world frames independently, even if a caller changes returned bounds', () => {
    const object = { ...panel.objects[1], geometry: [panel.objects[1].geometry![0]] };
    const original = mechanismBounds(object), expected = structuredClone(original);
    original.min[0] = -1e6; original.max[1] = 1e6;
    expect(mechanismBounds(object)).toEqual(expected);
    const piece = object.geometry[0];
    const revised = { ...object, position: { x: 3, y: -2, z: 1 }, size: { x: 2, y: 2, z: 2 }, geometry: [{ ...piece, position: { ...piece.position, x: piece.position.x + .8 } }] };
    const bound = mechanismBounds(revised);
    expect(bound).not.toEqual(expected);
    for (const value of [0, .17, .83, 1]) for (const mesh of mechanismMeshes({ ...revised, parameterValues: { opening: value } })) for (const p of mesh.vertices) for (const axis of [0, 1, 2]) {
      const actual = p[axis] + [revised.position.x, revised.position.y, revised.position.z][axis];
      expect(actual).toBeGreaterThanOrEqual(bound.min[axis]); expect(actual).toBeLessThanOrEqual(bound.max[axis]);
    }
  });
  it('shares exact compiled surfaces between Three and Anatomy, including world framing at phone sizes', () => {
    for (const value of [0, .45, 1]) {
      const state = { ...initialExplorationState(spec), spatial: { ...defaultSpatialView(), parameters: { opening: value } } }, scene = spatialScene(spec, state)!;
      for (const object of scene.objects) {
        const root = createSpatialPart(object, false, false); root.updateMatrixWorld(true);
        const compiled = mechanismMeshes(object);
        for (const [index, child] of root.children.entries()) {
          const position = (child as THREE.Mesh).geometry.getAttribute('position');
          const expected = meshTriangles(compiled[index]);
          for (let i = 0; i < position.count; i++) {
            const p = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
            for (const axis of [0, 1, 2]) expect(p.getComponent(axis)).toBeCloseTo(expected[i * 3 + axis] + [object.position.x, object.position.y, object.position.z][axis], 6);
          }
          (child as THREE.Mesh).geometry.dispose(); ((child as THREE.Mesh).material as THREE.Material).dispose();
        }
      }
      for (const width of [300, 620, 1200]) for (const azimuth of [-90, 0, 35, 90, 180]) {
        const projection = anatomyProjection(scene, { ...state.spatial, azimuth }, width, 360);
        for (const object of scene.objects) {
          const part = anatomyPart(object, projection, 0); expect(part.solids.length).toBeGreaterThan(0);
          for (const solid of part.solids) expect(solid.paths.fill).not.toMatch(/NaN|Infinity|undefined/);
          for (const mesh of mechanismMeshes(object)) for (const [x, y, z] of mesh.vertices) {
            const p = iso([x + object.position.x, z + object.position.z, y + object.position.y], projection);
            expect(p[0]).toBeGreaterThan(0); expect(p[0]).toBeLessThan(width);
            expect(p[1]).toBeGreaterThan(0); expect(p[1]).toBeLessThan(360);
          }
        }
      }
    }
  });
  it('moves part markers with the actual geometry while keeping the camera fixed over the full travel', () => {
    const scene = (opening: number) => spatialScene(spec, { ...initialExplorationState(spec), spatial: { ...defaultSpatialView(), parameters: { opening } } })!;
    const start = scene(0), end = scene(1), view = defaultSpatialView();
    const projection = anatomyProjection(start, view, 640, 360);
    expect(anatomyProjection(end, view, 640, 360)).toEqual(projection);
    const anchors = [start, end].map(s => {
      const o = s.objects[1], points = mechanismMeshes(o).flatMap(m => m.vertices.map(v => v.map((n, i) => n + [o.position.x, o.position.y, o.position.z][i])));
      const min = [0, 1, 2].map(axis => Math.min(...points.map(p => p[axis]))), max = [0, 1, 2].map(axis => Math.max(...points.map(p => p[axis])));
      const anchor = anatomyPart(o, projection, 0).anchor;
      expect(anchor).toEqual(iso([(min[0] + max[0]) / 2, (min[2] + max[2]) / 2, max[1]], projection));
      return anchor;
    });
    expect(anchors[0]).not.toEqual(anchors[1]);
  });
  it('resolves explanation poses separately from saved manual overrides', () => {
    const state = initialExplorationState(spec);
    expect(spatialScene(spec, { ...state, explanationStep: 1 })!.parameters![0]).toMatchObject({ value: .45, overridden: false });
    expect(spatialScene(spec, { ...state, explanationStep: 2, spatial: { ...defaultSpatialView(), parameters: { opening: .6 } } })!.parameters![0]).toMatchObject({ value: .6, overridden: true });
    expect(spatialScene(spec, { ...state, explanationStep: 2, spatial: { ...defaultSpatialView(), parameters: {} } })!.parameters![0].value).toBe(1);
  });
  it('accepts collinear convex edge subdivisions and clockwise input', () => {
    const outline = [{ x: -.5, z: -.5 }, { x: 0, z: -.5 }, { x: .5, z: -.5 }, { x: .5, z: .5 }, { x: -.5, z: .5 }];
    for (const points of [outline, [...outline].reverse()]) validate({ ...prism, form: { kind: 'prism', outline: points, height: .5 } });
  });
  it.each([
    { ...prism, form: { kind: 'prism', outline: [{ x: 0, z: 0 }, { x: 0, z: 0 }, { x: .5, z: .5 }], height: .5 } },
    { ...prism, form: { kind: 'prism', outline: [0, 2, 4, 1, 3].map(i => ({ x: .4 * Math.cos(i * Math.PI * 2 / 5), z: .4 * Math.sin(i * Math.PI * 2 / 5) })), height: .5 } },
    { ...lathe, form: { kind: 'lathe', profile: [{ radius: .3, y: .2 }, { radius: .2, y: .1 }] } },
    { ...tube, form: { kind: 'tube', path: [zero, zero], radius: .1 } },
    { ...prism, driver: { parameterId: 'foreign', pivot: zero, translation: zero, rotation: zero } },
    { ...prism, script: 'fetch(credentials)' },
    { ...prism, color: 'url(https://bad.invalid)' },
    { ...prism, position: { x: NaN, y: 0, z: 0 } },
  ])('rejects malformed topology, foreign references or executable fields %j', piece => { expect(() => validate(piece as MechanismPiece)).toThrow(); });
  it('rejects inert controls and duplicate step bindings', () => {
    expect(() => validateSpatialPanel({ ...panel, parameters: [...parameters, { ...parameters[0], id: 'unused' }] }, spec.mode === 'explanation' ? spec.steps : [])).toThrow(/moving piece/);
    expect(() => validateSpatialPanel({ ...panel, parameterPoses: [...panel.parameterPoses!, panel.parameterPoses![0]] }, spec.mode === 'explanation' ? spec.steps : [])).toThrow(/unique local/);
  });
  it('bounds surface cost independently of piece count', () => {
    const profile = Array.from({ length: 12 }, (_, i) => ({ radius: .3, y: -.5 + i / 11 }));
    const geometry = Array.from({ length: 12 }, (_, i) => ({ ...lathe, id: `lathe-${i}`, form: { kind: 'lathe' as const, profile } }));
    const objects = Array.from({ length: 3 }, (_, i) => ({ ...panel.objects[0], id: `part-${i}`, geometry }));
    expect(() => validateSpatialPanel({ ...panel, objects, parameters: [], parameterPoses: [] }, [])).toThrow(/4096-face/);
  });
  it('rejects over-budget geometry even when each individual part is well formed', () => {
    const candidate = structuredClone(spec);
    if (candidate.mode !== 'explanation' || candidate.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    const target = candidate.scene.panels[0];
    target.objects = Array.from({ length: 6 }, (_, i) => ({ ...panel.objects[0], id: `part-${i}`, geometry: Array.from({ length: 12 }, (_, j) => ({ ...prism, id: `piece-${j}` })) }));
    expect(() => validateSpatialPanel(target, candidate.steps)).toThrow(/64-piece/);
  });
});
