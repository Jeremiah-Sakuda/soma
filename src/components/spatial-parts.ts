import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { SpatialObject } from '@/lib/domain/spatial-exploration';

export const spatialColors = { clay: 0xb56845, sage: 0x408779, blue: 0x668597, gold: 0xd4a237, violet: 0x6553cf };

/** Fixed illustrative parts. Detail communicates a role, never recovered construction. */
export function createSpatialPart(object: SpatialObject, selected: boolean, shell: boolean) {
  const root = new THREE.Group();
  const tint = spatialColors[object.color];
  const surface = (color: number, metalness = 0.15, opacity = 1) => new THREE.MeshStandardMaterial({
    color, metalness, roughness: metalness > 0.5 ? 0.32 : 0.42,
    transparent: opacity < 1, opacity, depthWrite: opacity === 1,
    side: THREE.DoubleSide,
  });
  const body = surface(tint), dark = surface(0x263e43), metal = surface(0xaab9b8, 0.75), ceramic = surface(0xe5e8e3);
  // Materials are shared inside a part and disposed once by the renderer.
  const used = new Set<THREE.Material>();
  function mesh(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number] = [0, 0, 0]) {
    const result = new THREE.Mesh(geometry, material); result.position.set(...position);
    result.userData.objectId = object.id; result.castShadow = !shell; result.receiveShadow = true;
    used.add(material); root.add(result); return result;
  }
  function box(w: number, h: number, d: number, material: THREE.Material, position: [number, number, number] = [0, 0, 0], radius = 0.04) {
    return mesh(new RoundedBoxGeometry(w, h, d, 2, Math.min(radius, w / 4, h / 4, d / 4)), material, position);
  }
  function cylinder(radius: number, height: number, material: THREE.Material, position: [number, number, number] = [0, 0, 0]) {
    return mesh(new THREE.CylinderGeometry(radius, radius, height, 32), material, position);
  }
  switch (object.renderStyle) {
    case 'housing': {
      // An open tray and transparent cover keep the teaching mechanism visible.
      box(1, 0.07, 1, ceramic, [0, -0.465, 0]);
      box(1, 0.055, 1, dark, [0, -0.405, 0]);
      box(1, 0.35, 0.035, ceramic, [0, -0.30, -0.48]);
      box(0.035, 0.35, 1, ceramic, [-0.48, -0.30, 0]);
      box(0.035, 0.35, 1, ceramic, [0.48, -0.30, 0]);
      box(1, 0.08, 0.035, ceramic, [0, -0.43, 0.48]);
      const glass = surface(0xb1cdd4, 0.05, 0.12);
      box(0.97, 0.022, 0.97, glass, [0, 0.47, 0]);
      for (const x of [-0.435, 0.435]) for (const z of [-0.435, 0.435]) cylinder(0.014, 0.035, metal, [x, -0.36, z]);
      break;
    }
    case 'chip': {
      box(0.96, 0.065, 0.96, surface(0x377c6c), [0, -0.35, 0]);
      box(0.72, 0.5, 0.72, dark, [0, -0.03, 0], 0.06);
      box(0.52, 0.04, 0.52, body, [0, 0.24, 0]);
      for (const side of [-1, 1]) for (let pin = 0; pin < 5; pin++) {
        const offset = (pin - 2) * 0.13;
        box(0.12, 0.055, 0.055, metal, [side * 0.42, -0.22, offset], 0.01);
        box(0.055, 0.055, 0.12, metal, [offset, -0.22, side * 0.42], 0.01);
      }
      // Simple unlettered mark: no invented specification, pin count or chip ID claim.
      cylinder(0.035, 0.014, ceramic, [-0.23, 0.245, 0.23]);
      break;
    }
    case 'sensor': {
      box(0.92, 0.92, 0.28, body, [0, 0, -0.26], 0.09);
      const barrel = cylinder(0.36, 0.42, dark, [0, 0, 0.02]); barrel.rotation.x = Math.PI / 2;
      const bezel = cylinder(0.30, 0.04, metal, [0, 0, 0.25]); bezel.rotation.x = Math.PI / 2;
      const lens = mesh(new THREE.SphereGeometry(0.26, 32, 20), surface(0x254f63, 0.5), [0, 0, 0.29]); lens.scale.z = 0.3;
      break;
    }
    case 'indicator': {
      cylinder(0.43, 0.12, dark, [0, -0.38, 0]);
      cylinder(0.35, 0.07, metal, [0, -0.29, 0]);
      const glow = surface(tint, 0.05); glow.emissive.set(tint); glow.emissiveIntensity = object.highlighted ? 0.35 : 0.06;
      const dome = mesh(new THREE.SphereGeometry(0.34, 32, 20), glow, [0, -0.01, 0]); dome.scale.y = 1.2;
      break;
    }
    case 'marker': {
      const glow = surface(tint); glow.emissive.set(tint); glow.emissiveIntensity = 0.35;
      mesh(new THREE.SphereGeometry(0.42, 24, 16), glow);
      break;
    }
    default: {
      const material = shell ? surface(tint, 0.05, 0.13) : body;
      const shape = object.shape === 'sphere' ? new THREE.SphereGeometry(0.5, 32, 24)
        : object.shape === 'cylinder' ? new THREE.CylinderGeometry(0.5, 0.5, 1, 32)
        : object.shape === 'torus' ? new THREE.TorusGeometry(0.35, 0.14, 16, 40)
        : new RoundedBoxGeometry(1, 1, 1, 3, 0.07);
      mesh(shape, material);
    }
  }
  if (selected || object.highlighted) {
    const ringMaterial = new THREE.MeshBasicMaterial({ color: selected ? 0x5551f5 : tint, transparent: true, opacity: 0.8, depthWrite: false });
    const ring = mesh(new THREE.TorusGeometry(0.55, 0.012, 8, 48), ringMaterial, [0, -0.48, 0]); ring.rotation.x = Math.PI / 2; ring.castShadow = false;
  }
  for (const material of [body, dark, metal, ceramic]) if (!used.has(material)) material.dispose();
  root.scale.set(object.size.x, object.size.y, object.size.z);
  root.position.set(object.position.x, object.position.y, object.position.z);
  return root;
}
