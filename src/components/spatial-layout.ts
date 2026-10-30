import * as THREE from 'three';

/** Fit actual bounds in camera space, reserving room for callouts on every aspect ratio. */
export function spatialCameraDistance(bounds: THREE.Box3, azimuth: number, elevation: number, aspect: number, fov = 38, viewportHeight = 420) {
  const center = bounds.getCenter(new THREE.Vector3());
  const forward = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
  const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth));
  const up = new THREE.Vector3().crossVectors(forward, right);
  const tanY = Math.tan(THREE.MathUtils.degToRad(fov / 2));
  const verticalFill = Math.min(0.68, Math.max(0.4, (viewportHeight - 140) / viewportHeight));
  let distance = 0.8;
  for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
    const p = new THREE.Vector3(x, y, z).sub(center), depth = p.dot(forward);
    distance = Math.max(distance, Math.abs(p.dot(right)) / (tanY * aspect * 0.76) + depth, Math.abs(p.dot(up)) / (tanY * verticalFill) + depth);
  }
  return distance;
}

export type LabelRect = { x: number; y: number; width: number; height: number };
/** Prefer a short leader, then try both sides and rows. Never overlap a placed label. */
export function placeSpatialLabel(anchor: { x: number; y: number }, size: { width: number; height: number }, stage: { width: number; height: number }, occupied: LabelRect[]): LabelRect | null {
  const margin = 10, bottom = stage.height - 34;
  if (size.width + margin * 2 > stage.width || size.height + margin * 2 > bottom) return null;
  const clampX = (x: number) => Math.max(size.width / 2 + margin, Math.min(stage.width - size.width / 2 - margin, x));
  const clampY = (y: number) => Math.max(size.height / 2 + margin, Math.min(bottom - size.height / 2, y));
  const candidates: LabelRect[] = [];
  for (let row = 0; row < 7; row++) for (const sign of [-1, 1]) for (const side of [0, -1, 1]) {
    candidates.push({ ...size, x: clampX(anchor.x + side * (size.width / 2 + 30)), y: clampY(anchor.y + sign * (30 + row * (size.height + 8))) });
  }
  candidates.sort((a, b) => Math.hypot(a.x - anchor.x, a.y - anchor.y) - Math.hypot(b.x - anchor.x, b.y - anchor.y));
  return candidates.find((c) => !occupied.some((p) => Math.abs(p.x - c.x) < (p.width + c.width) / 2 + 8 && Math.abs(p.y - c.y) < (p.height + c.height) / 2 + 8)) ?? null;
}
