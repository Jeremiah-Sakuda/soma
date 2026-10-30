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
  function ring(radius: number, tube: number, material: THREE.Material, position: [number, number, number] = [0, 0, 0]) {
    return mesh(new THREE.TorusGeometry(radius, tube, 10, 48), material, position);
  }
  function winding(radius: number, turns: number, phase: number, material: THREE.Material, tube = 0.025) {
    const points = Array.from({ length: 97 }, (_, i) => {
      const t = i / 96, angle = t * Math.PI * 2 * turns + phase;
      return new THREE.Vector3(Math.cos(angle) * radius, (t - 0.5) * 0.84, Math.sin(angle) * radius);
    });
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 128, tube, 8, false), material);
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
    case 'battery': {
      cylinder(0.31, 0.82, body);
      cylinder(0.32, 0.06, metal, [0, -0.41, 0]);
      cylinder(0.32, 0.06, metal, [0, 0.41, 0]);
      cylinder(0.12, 0.08, dark, [0, 0.46, 0]);
      // Unlettered jacket; no invented chemistry, voltage or brand.
      box(0.17, 0.4, 0.025, ceramic, [0, 0, 0.305], 0.01);
      break;
    }
    case 'coil': {
      cylinder(0.19, 0.88, dark);
      winding(0.29, 6, 0, surface(0xb67846, 0.65), 0.045);
      for (const y of [-0.46, 0.46]) cylinder(0.37, 0.06, ceramic, [0, y, 0]);
      break;
    }
    case 'gear': {
      const profile = new THREE.Shape();
      for (let i = 0; i <= 96; i++) {
        const angle = i / 96 * Math.PI * 2, radius = i % 8 < 4 ? 0.46 : 0.38;
        if (i === 0) profile.moveTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
        else profile.lineTo(Math.cos(angle) * radius, Math.sin(angle) * radius);
      }
      profile.closePath();
      const hole = new THREE.Path(); hole.absarc(0, 0, 0.12, 0, Math.PI * 2, true); profile.holes.push(hole);
      mesh(new THREE.ExtrudeGeometry(profile, { depth: 0.17, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2, steps: 1, curveSegments: 24 }), body, [0, 0, -0.085]);
      ring(0.20, 0.025, metal, [0, 0, 0.10]);
      break;
    }
    case 'piston': {
      // Open cylinder reveals a piston head and rod; no cycle or force solver.
      mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.78, 40, 1, true, Math.PI / 2, Math.PI * 1.5), body, [0, 0.1, 0]);
      cylinder(0.34, 0.16, metal, [0, 0.1, 0]);
      for (const y of [0.06, 0.14]) { const seal = ring(0.34, 0.018, dark, [0, y, 0]); seal.rotation.x = Math.PI / 2; }
      cylinder(0.075, 0.52, metal, [0, -0.24, 0]);
      break;
    }
    case 'turbine': {
      cylinder(0.12, 0.6, metal);
      cylinder(0.19, 0.18, body);
      for (let i = 0; i < 8; i++) {
        const angle = i * Math.PI / 4;
        const blade = box(0.29, 0.045, 0.15, body, [Math.cos(angle) * 0.3, 0, Math.sin(angle) * 0.3], 0.02);
        blade.rotation.set(0.35, -angle, 0.15);
      }
      break;
    }
    case 'pipe': {
      // The bore is genuinely open at both ends, including the annular rims.
      mesh(new THREE.CylinderGeometry(0.38, 0.38, 0.9, 40, 1, true), body);
      mesh(new THREE.CylinderGeometry(0.29, 0.29, 0.9, 40, 1, true), dark);
      for (const y of [-0.45, 0.45]) {
        const rim = mesh(new THREE.RingGeometry(0.29, 0.38, 40), metal, [0, y, 0]); rim.rotation.x = Math.PI / 2;
      }
      break;
    }
    case 'vessel': {
      const glass = surface(0xb1cdd4, 0.05, 0.24);
      mesh(new THREE.CylinderGeometry(0.43, 0.36, 0.88, 40, 1, true), glass);
      cylinder(0.36, 0.035, ceramic, [0, -0.44, 0]);
      cylinder(0.365, 0.32, surface(tint, 0.05, 0.7), [0, -0.25, 0]);
      const lip = ring(0.43, 0.018, metal, [0, 0.44, 0]); lip.rotation.x = Math.PI / 2;
      break;
    }
    case 'lens': {
      ring(0.44, 0.035, dark);
      const glass = mesh(new THREE.SphereGeometry(0.43, 40, 24), surface(0x8cbfc9, 0.25, 0.46)); glass.scale.z = 0.28;
      break;
    }
    case 'membrane': {
      // A removed wedge makes containment legible without hiding internal parts.
      mesh(new THREE.SphereGeometry(0.47, 40, 24, Math.PI, Math.PI * 1.5), surface(tint, 0.05, 0.32));
      mesh(new THREE.SphereGeometry(0.44, 40, 24, Math.PI, Math.PI * 1.5), surface(0xd5dcca, 0.05, 0.2));
      break;
    }
    case 'nucleus': {
      mesh(new THREE.SphereGeometry(0.44, 32, 24, Math.PI, Math.PI * 1.5), body);
      mesh(new THREE.SphereGeometry(0.19, 24, 16), dark, [0.08, -0.03, 0.04]);
      break;
    }
    case 'helix': {
      winding(0.29, 1.5, 0, body, 0.04);
      winding(0.29, 1.5, Math.PI, surface(object.color === 'blue' ? 0xb56845 : 0x537b8c), 0.04);
      for (let i = 0; i < 12; i++) {
        const t = (i + 0.5) / 12, angle = t * Math.PI * 3;
        const rung = cylinder(0.018, 0.56, ceramic, [0, (t - 0.5) * 0.84, 0]);
        rung.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)));
      }
      break;
    }
    case 'speaker': {
      box(0.94, 0.94, 0.4, body, [0, 0, -0.22], 0.08);
      ring(0.37, 0.045, dark, [0, 0, 0.03]);
      const cone = mesh(new THREE.CylinderGeometry(0.36, 0.12, 0.2, 40, 1, true), ceramic, [0, 0, -0.04]); cone.rotation.x = Math.PI / 2;
      const cap = mesh(new THREE.SphereGeometry(0.12, 24, 16), dark, [0, 0, 0.01]); cap.scale.z = 0.5;
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
