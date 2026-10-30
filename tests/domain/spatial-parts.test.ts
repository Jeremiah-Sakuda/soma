import { expect, it } from 'vitest';
import * as THREE from 'three';
import { createSpatialPart } from '../../src/components/spatial-parts';
import { placeSpatialLabel, spatialCameraDistance, type LabelRect } from '../../src/components/spatial-layout';
import { spatialRenderStyles, spatialPanelSchema } from '../../src/lib/domain/spatial-schema';
import { createSpatialExample } from '../../src/lib/domain/spatial-example';

it.each(spatialRenderStyles)('%s builds finite, bounded, selectable geometry within a fixed mesh budget', (renderStyle) => {
  const object = { id: 'part', label: 'Part', description: 'Illustrative geometry', renderStyle, shape: 'box' as const, color: 'sage' as const, position: { x: 0, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, parentId: null, visible: true, highlighted: false, status: 'Visible' };
  const root = createSpatialPart(object, false, false);
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
  let triangles = 0;
  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;
    expect(child.userData.objectId).toBe('part');
    const geometry = child.geometry as THREE.BufferGeometry;
    for (const attribute of ['position', 'normal']) expect(Array.from(geometry.getAttribute(attribute).array).every(Number.isFinite)).toBe(true);
    const count = geometry.getAttribute('position').count;
    if (geometry.index) expect(Array.from(geometry.index.array).every((index) => index < count)).toBe(true);
    triangles += (geometry.index?.count ?? count) / 3;
    geometries.add(geometry);
    for (const mat of Array.isArray(child.material) ? child.material : [child.material]) materials.add(mat);
  });
  const bounds = new THREE.Box3().setFromObject(root);
  for (const axis of ['x', 'y', 'z'] as const) {
    expect(bounds.min[axis]).toBeGreaterThanOrEqual(-0.501);
    expect(bounds.max[axis]).toBeLessThanOrEqual(0.501);
    expect(bounds.max[axis] - bounds.min[axis]).toBeGreaterThan(0.1);
  }
  expect(geometries.size).toBeGreaterThan(0); expect(geometries.size).toBeLessThanOrEqual(32);
  expect(triangles).toBeLessThan(18000);
  for (const resource of [...geometries, ...materials]) resource.dispose();
});

it('exposes all styles through the authoring schema without relaxing legacy or hostile-asset boundaries', () => {
  const example = createSpatialExample();
  if (example.mode !== 'explanation' || example.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
  const panel = example.scene.panels[0];
  for (const style of [...spatialRenderStyles, null, undefined]) {
    panel.objects[0].renderStyle = style;
    expect(spatialPanelSchema.safeParse(panel).success).toBe(true);
  }
  for (const style of ['https://untrusted.invalid/model.glb', 'custom-code', '<script>']) {
    expect(spatialPanelSchema.safeParse({ ...panel, objects: [{ ...panel.objects[0], renderStyle: style }] }).success).toBe(false);
  }
});

it('fits wide, tall and deep assemblies without clipping at portrait and landscape aspects', () => {
  for (const dimensions of [[6, 1, 2], [1, 7, 1], [2, 2, 8]]) for (const aspect of [0.55, 1, 2.4]) for (const [az, el] of [[35, 25], [0, 0], [0, 85], [90, 0], [-80, -40]]) {
    const bounds = new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(2, 1, -1), new THREE.Vector3(...dimensions));
    const azimuth = THREE.MathUtils.degToRad(az), elevation = THREE.MathUtils.degToRad(el);
    const distance = spatialCameraDistance(bounds, azimuth, elevation, aspect);
    const camera = new THREE.PerspectiveCamera(38, aspect, 0.1, 200), center = bounds.getCenter(new THREE.Vector3());
    camera.position.set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation)).multiplyScalar(distance).add(center);
    camera.lookAt(center); camera.updateMatrixWorld();
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      expect(Math.abs(p.x)).toBeLessThanOrEqual(0.761); expect(Math.abs(p.y)).toBeLessThanOrEqual(0.681);
      expect(p.z).toBeLessThan(1); expect(p.z).toBeGreaterThan(-1);
    }
  }
});

it('places wrapped callouts inside the stage without label collisions, including crowded anchors', () => {
  for (const width of [275, 550, 1000]) {
    const occupied: LabelRect[] = [];
    for (let i = 0; i < 16; i++) {
      const result = placeSpatialLabel({ x: width / 2, y: 120 }, { width: 150, height: i % 2 ? 45 : 28 }, { width, height: 290 }, occupied);
      if (!result) continue;
      expect(result.x - result.width / 2).toBeGreaterThanOrEqual(10);
      expect(result.x + result.width / 2).toBeLessThanOrEqual(width - 10);
      expect(result.y - result.height / 2).toBeGreaterThanOrEqual(10);
      expect(result.y + result.height / 2).toBeLessThanOrEqual(256);
      for (const other of occupied) expect(Math.abs(other.x - result.x) >= (other.width + result.width) / 2 + 8 || Math.abs(other.y - result.y) >= (other.height + result.height) / 2 + 8).toBe(true);
      occupied.push(result);
    }
    expect(occupied.length).toBeGreaterThanOrEqual(4);
  }
});
