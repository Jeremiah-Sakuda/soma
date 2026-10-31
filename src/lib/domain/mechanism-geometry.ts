import type { MechanismPiece } from './mechanism-schema';

export type MeshPoint = [number, number, number];
export type MechanismMesh = { id: string; color: MechanismPiece['color']; vertices: MeshPoint[]; faces: number[][] };
export type GeometryObject = { position: { x: number; y: number; z: number }; size: { x: number; y: number; z: number }; geometry?: MechanismPiece[] | null; parameterValues?: Record<string, number> };
export const mechanismPalette = { clay: '#ad6447', sage: '#628575', blue: '#65889c', gold: '#b18a3a', violet: '#89739c', graphite: '#3e514d', ivory: '#e8e6d9', metal: '#aab5ad' };
const add = (a: MeshPoint, b: MeshPoint): MeshPoint => a.map((n, i) => n + b[i]) as MeshPoint;
const sub = (a: MeshPoint, b: MeshPoint): MeshPoint => a.map((n, i) => n - b[i]) as MeshPoint;
const cross = (a: MeshPoint, b: MeshPoint): MeshPoint => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (p: MeshPoint): MeshPoint => { const d = Math.hypot(...p) || 1; return p.map(n => n / d) as MeshPoint; };
const tuple = (p: { x: number; y: number; z: number }): MeshPoint => [p.x, p.y, p.z];
/** Explicit x, then y, then z rotations in degrees. Same compiler serves both renderers. */
export function rotatePoint(p: MeshPoint, angles: MeshPoint): MeshPoint {
  let [x, y, z] = p;
  for (const [axis, degrees] of angles.entries()) {
    const a = degrees * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    if (axis === 0) [y, z] = [y * c - z * s, y * s + z * c];
    if (axis === 1) [x, z] = [x * c + z * s, -x * s + z * c];
    if (axis === 2) [x, y] = [x * c - y * s, x * s + y * c];
  }
  return [x, y, z];
}

function rawMesh(piece: MechanismPiece) {
  const vertices: MeshPoint[] = [], faces: number[][] = [], f = piece.form;
  if (f.kind === 'prism') {
    const area = f.outline.reduce((sum, p, i) => { const q = f.outline[(i + 1) % f.outline.length]; return sum + p.x * q.z - q.x * p.z; }, 0);
    const ring = area < 0 ? [...f.outline].reverse() : f.outline, n = ring.length;
    for (const y of [-f.height / 2, f.height / 2]) for (const p of ring) vertices.push([p.x, y, p.z]);
    faces.push(Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => n * 2 - 1 - i));
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; faces.push([i, i + n, j + n, j]); }
  } else if (f.kind === 'lathe') {
    const n = 12;
    for (const p of f.profile) for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; vertices.push([p.radius * Math.cos(a), p.y, p.radius * Math.sin(a)]); }
    for (let row = 0; row < f.profile.length - 1; row++) for (let i = 0; i < n; i++) {
      const j = (i + 1) % n; faces.push([row * n + i, (row + 1) * n + i, (row + 1) * n + j, row * n + j]);
    }
    faces.push(Array.from({ length: n }, (_, i) => i), Array.from({ length: n }, (_, i) => vertices.length - 1 - i));
  } else {
    // Each segment is an independently capped octagonal tube. No smoothing or
    // hidden physical constraints are inferred at bends.
    for (let segment = 0; segment < f.path.length - 1; segment++) {
      const a = tuple(f.path[segment]), b = tuple(f.path[segment + 1]), direction = unit(sub(b, a));
      const right = unit(cross(direction, Math.abs(direction[1]) < .9 ? [0, 1, 0] : [1, 0, 0])), up = cross(right, direction), base = vertices.length;
      for (const center of [a, b]) for (let i = 0; i < 8; i++) {
        const angle = i / 8 * Math.PI * 2;
        vertices.push(add(center, right.map((n, j) => f.radius * (n * Math.cos(angle) + up[j] * Math.sin(angle))) as MeshPoint));
      }
      const localFaces: number[][] = [Array.from({ length: 8 }, (_, i) => base + i), Array.from({ length: 8 }, (_, i) => base + 15 - i)];
      for (let i = 0; i < 8; i++) { const j = (i + 1) % 8; localFaces.push([base + i, base + j, base + j + 8, base + i + 8]); }
      const center = a.map((n, i) => (n + b[i]) / 2) as MeshPoint;
      for (const face of localFaces) {
        const normal = cross(sub(vertices[face[1]], vertices[face[0]]), sub(vertices[face[2]], vertices[face[0]]));
        const midpoint = face.reduce((p, i) => add(p, vertices[i]), [0, 0, 0] as MeshPoint).map(n => n / face.length) as MeshPoint;
        faces.push(normal.reduce((sum, n, i) => sum + n * (midpoint[i] - center[i]), 0) < 0 ? [...face].reverse() : face);
      }
    }
  }
  return { vertices, faces };
}

export function pieceMesh(piece: MechanismPiece, value = 0): MechanismMesh {
  const raw = rawMesh(piece), driver = piece.driver, t = Math.max(0, Math.min(1, value));
  const vertices = raw.vertices.map(p => {
    let point = add(rotatePoint(p.map((n, i) => n * tuple(piece.scale)[i]) as MeshPoint, tuple(piece.rotation)), tuple(piece.position));
    if (driver) point = add(add(rotatePoint(sub(point, tuple(driver.pivot)), tuple(driver.rotation).map(n => n * t) as MeshPoint), tuple(driver.pivot)), tuple(driver.translation).map(n => n * t) as MeshPoint);
    return point;
  });
  return { id: piece.id, color: piece.color, vertices, faces: raw.faces };
}

export function mechanismMeshes(object: GeometryObject): MechanismMesh[] {
  return (object.geometry ?? []).map(piece => {
    const mesh = pieceMesh(piece, piece.driver ? object.parameterValues?.[piece.driver.parameterId] ?? 0 : 0);
    return { ...mesh, vertices: mesh.vertices.map(p => p.map((n, i) => n * tuple(object.size)[i]) as MeshPoint) };
  });
}

// Specifications are immutable. Cache local swept bounds by piece identity so a
// slider event does not rebuild seventeen complete meshes just to fit the camera.
// Weak keys release old revisions; callers only receive fresh world-space arrays.
const sweptBounds = new WeakMap<MechanismPiece, { min: MeshPoint; max: MeshPoint }>();
function pieceBounds(piece: MechanismPiece) {
  const cached = sweptBounds.get(piece);
  if (cached) return cached;
  const min: MeshPoint = [Infinity, Infinity, Infinity], max: MeshPoint = [-Infinity, -Infinity, -Infinity];
  const rest = pieceMesh(piece), pivot = piece.driver ? tuple(piece.driver.pivot) : [0, 0, 0] as MeshPoint;
  const radius = Math.max(...rest.vertices.map(p => Math.hypot(...sub(p, pivot))));
  const pad = piece.driver ? radius * tuple(piece.driver.rotation).reduce((sum, n) => sum + Math.abs(n) * Math.PI / 180, 0) / 32 : 0;
  for (let i = 0; i <= (piece.driver ? 16 : 0); i++) for (const p of pieceMesh(piece, i / 16).vertices) for (let axis = 0; axis < 3; axis++) {
    min[axis] = Math.min(min[axis], p[axis] - pad); max[axis] = Math.max(max[axis], p[axis] + pad);
  }
  const bounds = { min, max }; sweptBounds.set(piece, bounds); return bounds;
}

/** Covers a part's complete driver range, keeping framing stable while scrubbing. */
export function mechanismBounds(object: GeometryObject): { min: MeshPoint; max: MeshPoint } {
  const min: MeshPoint = [Infinity, Infinity, Infinity], max: MeshPoint = [-Infinity, -Infinity, -Infinity];
  for (const piece of object.geometry ?? []) {
    const local = pieceBounds(piece);
    for (let axis = 0; axis < 3; axis++) {
      const size = tuple(object.size)[axis], origin = tuple(object.position)[axis];
      min[axis] = Math.min(min[axis], origin + local.min[axis] * size); max[axis] = Math.max(max[axis], origin + local.max[axis] * size);
    }
  }
  return { min, max };
}

export function meshTriangles(mesh: MechanismMesh): number[] {
  const output: number[] = [];
  for (const face of mesh.faces) for (let i = 1; i < face.length - 1; i++) for (const index of [face[0], face[i], face[i + 1]]) output.push(...mesh.vertices[index]);
  return output;
}

export function faceNormal(vertices: MeshPoint[], face: number[]): MeshPoint {
  for (let i = 1; i < face.length - 1; i++) {
    const n = cross(sub(vertices[face[i]], vertices[face[0]]), sub(vertices[face[i + 1]], vertices[face[0]]));
    if (Math.hypot(...n) > 1e-9) return unit(n);
  }
  return [0, 0, 0];
}
