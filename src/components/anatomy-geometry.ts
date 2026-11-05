import {
  cylinder,
  depthOf,
  extrude,
  fitProjection,
  iso,
  pathOf,
  slabOf,
  type Point3,
  type Projection,
  type SolidPaths,
} from '@/vendor/anatomy/iso-kit';
import type { SpatialObject, SpatialScene } from '@/lib/domain/spatial-exploration';
import type { SpatialView } from '@/lib/domain/spatial-schema';
import {
  faceNormal,
  mechanismBounds,
  mechanismMeshes,
  mechanismPalette,
} from '@/lib/domain/mechanism-geometry';

export type AnatomySolid = {
  paths: SolidPaths;
  color: string;
  depth: number;
  opacity: number;
  min: Point3;
  max: Point3;
  screen: { left: number; right: number; top: number; bottom: number };
};
export type AnatomyLine = { d: string; color: string; width: number };
export type AnatomyPart = {
  object: SpatialObject;
  solids: AnatomySolid[];
  lines: AnatomyLine[];
  anchor: [number, number];
};
export const anatomyPalette = {
  clay: '#ad6447',
  sage: '#628575',
  blue: '#65889c',
  gold: '#b18a3a',
  violet: '#89739c',
};
// Soma uses y-up; the upstream kit uses z-up. Preserve identity and world position.
export const anatomyPoint = ({ x, y, z }: SpatialObject['position']): Point3 => [x, z, y];

export function anatomyProjection(
  scene: SpatialScene,
  view: SpatialView,
  width: number,
  height: number,
): Projection {
  const points: Point3[] = [];
  for (const o of scene.objects.filter((o) => o.visible)) {
    if (o.geometry?.length) {
      const b = mechanismBounds(o);
      for (const x of [b.min[0], b.max[0]])
        for (const y of [b.min[1], b.max[1]])
          for (const z of [b.min[2], b.max[2]]) points.push([x, z, y]);
      continue;
    }
    for (const x of [-0.5, 0.5])
      for (const y of [-0.5, 0.5])
        for (const z of [-0.5, 0.5])
          points.push(
            anatomyPoint({
              x: o.position.x + x * o.size.x,
              y: o.position.y + y * o.size.y,
              z: o.position.z + z * o.size.z,
            }),
          );
  }
  // An empty/fully hidden frame still has a finite, stable projection.
  if (!points.length) points.push([-1, -1, -1], [1, 1, 1]);
  const p = fitProjection(points, Math.max(width, 100), Math.max(height, 100), {
    pad: Math.min(62, width * 0.14),
    headroom: 30,
    azimuth: 90 - view.azimuth,
    elevation: Math.max(0, view.elevation),
  });
  // Match the existing Three camera-distance multiplier, including saved views.
  return { ...p, scale: (p.scale / view.zoom) * 0.88 };
}

/** Application-owned illustration grammar. No strings from the model become markup or code. */
export function anatomyPart(
  object: SpatialObject,
  projection: Projection,
  slice: number,
): AnatomyPart {
  if (object.geometry?.length) return authoredPart(object, projection);
  const [cx, cy, cz] = anatomyPoint(object.position),
    { x: w, y: h, z: d } = object.size;
  const color = anatomyPalette[object.color],
    metal = '#aab5ad',
    dark = '#3e514d',
    pale = '#d7dfd3';
  const solids: AnatomySolid[] = [],
    lines: AnatomyLine[] = [];
  const point = (x: number, y: number, z: number): Point3 => [cx + x * w, cy + y * d, cz + z * h];
  const add = (paths: SolidPaths, at: Point3, tint: string, half: Point3, opacity = 1) => {
    const min = at.map((n, i) => n - half[i]) as Point3,
      max = at.map((n, i) => n + half[i]) as Point3;
    const corners = [min[0], max[0]].flatMap((x) =>
      [min[1], max[1]].flatMap((y) => [min[2], max[2]].map((z) => iso([x, y, z], projection))),
    );
    solids.push({
      paths,
      color: tint,
      depth: depthOf(at, projection),
      opacity,
      min,
      max,
      screen: {
        left: Math.min(...corners.map((p) => p[0])),
        right: Math.max(...corners.map((p) => p[0])),
        top: Math.min(...corners.map((p) => p[1])),
        bottom: Math.max(...corners.map((p) => p[1])),
      },
    });
  };
  const box = (
    x: number,
    y: number,
    z: number,
    a: number,
    b: number,
    c: number,
    tint = color,
    opacity = 1,
  ) => {
    const p = point(x, y, z),
      plan = {
        x: p[0] - (a * w) / 2,
        y: p[1] - (b * d) / 2,
        w: a * w,
        d: b * d,
        r: Math.min(a * w, b * d) * 0.08,
      };
    add(
      slabOf(plan, p[2] - (c * h) / 2, c * h, projection, 3, Math.min(a * w, b * d, c * h) * 0.07),
      p,
      tint,
      [(a * w) / 2, (b * d) / 2, (c * h) / 2],
      opacity,
    );
  };
  const disc = (
    x: number,
    y: number,
    z: number,
    radius: number,
    height: number,
    tint = color,
    opacity = 1,
  ) => {
    const p = point(x, y, z),
      r = radius * Math.min(w, d);
    add(
      cylinder(
        p[0],
        p[1],
        r,
        p[2] - (height * h) / 2,
        height * h,
        projection,
        24,
        0.015 * Math.min(w, d, h),
      ),
      p,
      tint,
      [r, r, (height * h) / 2],
      opacity,
    );
  };
  const line = (points: [number, number, number][], tint = dark, width = 1.1) =>
    lines.push({ d: pathOf(points.map((p) => iso(point(...p), projection))), color: tint, width });
  const screws = (z: number, reach = 0.4) => {
    for (const x of [-reach, reach])
      for (const y of [-reach, reach]) {
        disc(x, y, z, 0.028, 0.026, metal);
        line(
          [
            [x - 0.016, y, z + 0.015],
            [x + 0.016, y, z + 0.015],
          ],
          dark,
          0.65,
        );
      }
  };
  const pins = () => {
    for (const x of [-0.42, 0.42])
      for (let j = 0; j < 6; j++) box(x, -0.32 + j * 0.128, -0.18, 0.15, 0.045, 0.13, metal);
  };
  const globe = (tint: string, scale = 1, opacity = 1) => {
    for (let i = 0; i < 10; i++) {
      const z = -0.45 + i * 0.1,
        r = Math.sqrt(Math.max(0, 0.25 - z * z)) * scale;
      disc(0, 0, z * scale, r, 0.105 * scale, tint, opacity);
    }
  };
  const style = object.renderStyle;
  switch (style) {
    case 'housing': {
      box(0, 0, -0.46, 1, 1, 0.08, metal);
      screws(-0.405);
      for (const x of [-0.39, 0.39])
        for (const y of [-0.36, 0.36]) disc(x, y, -0.3, 0.025, 0.25, '#b8a476');
      box(0, 0, -0.2, 0.88, 0.84, 0.035, '#657e68');
      // Open-front enclosure: cutaway lowers the remaining walls and fades the lid.
      const wall = 0.75 * (1 - slice);
      box(0, -0.48, -0.4 + wall / 2, 1, 0.04, Math.max(0.025, wall), color, 0.32);
      box(-0.48, 0, -0.4 + wall / 2, 0.04, 1, Math.max(0.025, wall), color, 0.24);
      if (slice < 0.98) box(0, 0, 0.46, 1, 1, 0.045, '#9db8b4', 0.15 * (1 - slice));
      break;
    }
    case 'chip':
      pins();
      box(0, 0, -0.1, 0.76, 0.78, 0.3, dark);
      box(0, 0, 0.075, 0.62, 0.64, 0.045, color);
      disc(-0.19, -0.21, 0.108, 0.034, 0.008, '#e3d3b5');
      for (let i = 0; i < 3; i++)
        line(
          [
            [-0.15, -0.09 + i * 0.09, 0.105],
            [0.2, -0.09 + i * 0.09, 0.105],
          ],
          '#d8bb91',
          0.7,
        );
      break;
    case 'sensor':
      box(0, 0, -0.32, 0.94, 0.8, 0.14, metal);
      disc(0, 0, -0.07, 0.37, 0.42, dark);
      disc(0, 0, 0.155, 0.31, 0.06, color);
      disc(0, 0, 0.2, 0.24, 0.025, '#a8c4bb');
      disc(-0.065, -0.065, 0.22, 0.085, 0.012, '#ecf1e5');
      screws(-0.23, 0.34);
      break;
    case 'indicator':
      box(0, 0, -0.35, 0.82, 0.82, 0.12, metal);
      disc(0, 0, -0.16, 0.37, 0.22, dark);
      disc(0, 0, 0.03, 0.31, 0.2, color);
      disc(0, 0, 0.16, 0.23, 0.09, '#dec992');
      disc(-0.07, -0.07, 0.21, 0.07, 0.016, '#fff6d7');
      break;
    case 'battery':
      box(0, 0, -0.04, 0.8, 0.8, 0.82, color);
      box(0, 0, 0.38, 0.8, 0.8, 0.08, dark);
      for (const x of [-0.2, 0.2]) disc(x, 0, 0.45, 0.085, 0.08, metal);
      line(
        [
          [-0.26, 0, 0.5],
          [-0.14, 0, 0.5],
        ],
        dark,
      );
      line(
        [
          [0.2, -0.06, 0.5],
          [0.2, 0.06, 0.5],
        ],
        dark,
      );
      break;
    case 'coil': {
      box(0, 0, -0.4, 0.9, 0.76, 0.12, dark);
      box(0, 0, 0, 0.22, 0.3, 0.68, metal);
      const turns: [number, number, number][] = Array.from({ length: 145 }, (_, i) => {
        const a = (i / 144) * Math.PI * 14;
        return [0.34 * Math.cos(a), 0.34 * Math.sin(a), -0.32 + (i / 144) * 0.64];
      });
      line(turns, color, 4);
      break;
    }
    case 'gear': {
      const p = point(0, 0, -0.08),
        r = Math.min(w, d),
        ring = Array.from({ length: 64 }, (_, i): [number, number] => {
          const a = (i / 64) * Math.PI * 2,
            radius = (i % 4 < 2 ? 0.48 : 0.39) * r;
          return [p[0] + Math.cos(a) * radius, p[1] + Math.sin(a) * radius];
        });
      add(extrude(ring, p[2] - h * 0.1, h * 0.2, projection, { convex: false }), p, color, [
        r * 0.48,
        r * 0.48,
        h * 0.1,
      ]);
      disc(0, 0, 0.06, 0.16, 0.12, metal);
      disc(0, 0, 0.135, 0.065, 0.025, dark);
      break;
    }
    case 'piston':
      disc(0, 0, -0.26, 0.39, 0.32, color);
      disc(0, 0, 0.05, 0.12, 0.45, metal);
      disc(0, 0, 0.34, 0.28, 0.14, dark);
      for (const z of [-0.35, -0.29, -0.23]) disc(0, 0, z, 0.4, 0.025, dark);
      break;
    case 'turbine':
      disc(0, 0, -0.15, 0.45, 0.1, dark);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2,
          p = point(0, 0, -0.04),
          r = Math.min(w, d);
        const ring = [
          [0.13, 0],
          [0.45, 0.08],
          [0.42, 0.16],
          [0.14, 0.09],
        ].map(([x, y]): [number, number] => [
          p[0] + (x * Math.cos(a) - y * Math.sin(a)) * r,
          p[1] + (x * Math.sin(a) + y * Math.cos(a)) * r,
        ]);
        add(extrude(ring, p[2], h * 0.07, projection), [p[0], p[1], p[2] + h * 0.035], color, [
          r * 0.48,
          r * 0.48,
          h * 0.035,
        ]);
      }
      disc(0, 0, 0.09, 0.15, 0.24, metal);
      break;
    case 'pipe':
    case 'vessel': {
      const radius = style === 'pipe' ? 0.31 : 0.45;
      disc(0, 0, -0.03, radius, 0.82, color);
      disc(0, 0, 0.4, radius + 0.025, 0.06, metal);
      disc(0, 0, 0.436, radius * 0.77, 0.007, dark);
      disc(0, 0, 0.44, radius * 0.61, 0.007, '#8da8a4');
      if (style === 'pipe') disc(0, 0, -0.42, radius + 0.025, 0.07, metal);
      else {
        box(0, 0, -0.46, 0.84, 0.84, 0.08, dark);
        for (let i = 0; i < 4; i++)
          line(
            [
              [0.28, -0.1, -0.22 + i * 0.13],
              [0.39, -0.1, -0.22 + i * 0.13],
            ],
            pale,
          );
      }
      break;
    }
    case 'lens':
      disc(0, 0, -0.14, 0.47, 0.2, dark);
      disc(0, 0, -0.015, 0.41, 0.07, metal);
      disc(0, 0, 0.04, 0.36, 0.06, '#8fb5bb');
      disc(0, 0, 0.08, 0.27, 0.025, '#c0dcda');
      line(
        [
          [-0.22, -0.12, 0.1],
          [-0.08, -0.23, 0.1],
          [0.05, -0.23, 0.1],
        ],
        '#f5faf0',
        2,
      );
      break;
    case 'membrane':
      // Open cellular schematic, deliberately not a detailed anatomical claim.
      disc(0, 0, -0.24, 0.47, 0.25, color, 0.55);
      disc(0, 0, -0.1, 0.42, 0.04, '#c6d4af');
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        disc(Math.cos(a) * 0.42, Math.sin(a) * 0.42, -0.055, 0.025, 0.025, color);
      }
      break;
    case 'nucleus':
      globe(color, 0.82);
      disc(0, 0, 0.36, 0.13, 0.025, dark);
      break;
    case 'helix': {
      const strands: [number, number, number][][] = [[], []];
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * Math.PI * 4,
          z = -0.45 + (i / 72) * 0.9,
          x = Math.cos(a) * 0.28,
          y = Math.sin(a) * 0.28;
        strands[0].push([x, y, z]);
        strands[1].push([-x, -y, z]);
        if (i % 6 === 0)
          line(
            [
              [x, y, z],
              [-x, -y, z],
            ],
            metal,
            1.8,
          );
      }
      line(strands[0], color, 3);
      line(strands[1], '#b69a55', 3);
      break;
    }
    case 'speaker':
      box(0, 0, -0.14, 0.92, 0.92, 0.4, dark);
      disc(0, 0, 0.1, 0.41, 0.1, metal);
      disc(0, 0, 0.17, 0.35, 0.08, color);
      disc(0, 0, 0.23, 0.25, 0.05, dark);
      disc(0, 0, 0.28, 0.12, 0.06, metal);
      screws(0.08);
      break;
    case 'marker':
      globe(color);
      break;
    default:
      if (object.shape === 'sphere') globe(color);
      else if (object.shape === 'cylinder') disc(0, 0, 0, 0.5, 1);
      else if (object.shape === 'torus') {
        disc(0, 0, 0, 0.48, 0.25);
        disc(0, 0, 0.135, 0.25, 0.015, dark);
      } else box(0, 0, 0, 1, 1, 1);
  }
  solids.sort((a, b) => a.depth - b.depth);
  return { object, solids, lines, anchor: iso(point(0, 0, 0.5), projection) };
}

/** Muse-authored surfaces, shaded and projected as data through the Anatomy kit. */
function authoredPart(object: SpatialObject, p: Projection): AnatomyPart {
  const solids: AnatomySolid[] = [],
    a = ((p.azimuth ?? 45) * Math.PI) / 180,
    e = ((p.elevation ?? 30) * Math.PI) / 180;
  const viewer = [Math.cos(a) * Math.cos(e), Math.sin(e), Math.sin(a) * Math.cos(e)];
  const min = [Infinity, Infinity, Infinity],
    max = [-Infinity, -Infinity, -Infinity];
  for (const mesh of mechanismMeshes(object)) {
    const vertices = mesh.vertices.map(
      (v) =>
        v.map((n, i) => n + [object.position.x, object.position.y, object.position.z][i]) as [
          number,
          number,
          number,
        ],
    );
    for (const v of vertices)
      for (let axis = 0; axis < 3; axis++) {
        min[axis] = Math.min(min[axis], v[axis]);
        max[axis] = Math.max(max[axis], v[axis]);
      }
    const normals = mesh.faces.map((f) => faceNormal(vertices, f));
    const visible = normals.map((n) => n.reduce((sum, v, i) => sum + v * viewer[i], 0) > 1e-7);
    const edges = new Map<string, number[]>();
    mesh.faces.forEach((face, i) =>
      face.forEach((from, j) => {
        const to = face[(j + 1) % face.length],
          key = [from, to].sort((a, b) => a - b).join(':');
        edges.set(key, [...(edges.get(key) ?? []), i]);
      }),
    );
    mesh.faces.forEach((face, index) => {
      if (!visible[index]) return;
      const world = face.map((i) => vertices[i]),
        points = world.map((v) => [v[0], v[2], v[1]] as Point3),
        flat = points.map((v) => iso(v, p));
      let outline = '',
        crease = '';
      face.forEach((from, j) => {
        const to = face[(j + 1) % face.length],
          neighbors = edges.get([from, to].sort((a, b) => a - b).join(':')) ?? [];
        const d = pathOf([flat[j], flat[(j + 1) % flat.length]]);
        if (neighbors.length === 1 || neighbors.some((i) => !visible[i])) outline += d;
        else if (
          neighbors.some(
            (i) => normals[i].reduce((sum, n, axis) => sum + n * normals[index][axis], 0) < 0.7,
          )
        )
          crease += d;
      });
      const n = normals[index],
        light = Math.max(
          0,
          Math.min(1, 0.5 + 0.35 * n[1] + 0.15 * (n[0] * Math.cos(a) + n[2] * Math.sin(a))),
        );
      const shades = ['', '', '', ''];
      shades[Math.min(3, Math.floor(light * 4))] = pathOf(flat, true);
      const min = [0, 1, 2].map((axis) => Math.min(...points.map((v) => v[axis]))) as Point3,
        max = [0, 1, 2].map((axis) => Math.max(...points.map((v) => v[axis]))) as Point3;
      const center = min.map((v, i) => (v + max[i]) / 2) as Point3;
      solids.push({
        paths: { fill: pathOf(flat, true), top: '', shades, outline, crease },
        color: mechanismPalette[mesh.color],
        depth: depthOf(center, p),
        opacity: 1,
        min,
        max,
        screen: {
          left: Math.min(...flat.map((v) => v[0])),
          right: Math.max(...flat.map((v) => v[0])),
          top: Math.min(...flat.map((v) => v[1])),
          bottom: Math.max(...flat.map((v) => v[1])),
        },
      });
    });
  }
  // Labels follow the current part. Only camera fitting uses the full motion range.
  return {
    object,
    solids,
    lines: [],
    anchor: iso([(min[0] + max[0]) / 2, (min[2] + max[2]) / 2, max[1]], p),
  };
}

/** Painter constraints from separating world axes, then a stable depth fallback.
 * A broad platform below a component must paint first even if its center is nearer.
 * Intersecting/ambiguous solids use center depth; this is a schematic, not a mesh engine.
 */
export function anatomyPaintOrder<T extends { solid: AnatomySolid }>(
  items: T[],
  p: Projection,
): T[] {
  const a = ((p.azimuth ?? 45) * Math.PI) / 180,
    e = ((p.elevation ?? 30) * Math.PI) / 180;
  const direction = [Math.cos(a) * Math.cos(e), Math.sin(a) * Math.cos(e), Math.sin(e)];
  const opaque = items
    .filter((x) => x.solid.opacity >= 1)
    .sort((x, y) => x.solid.depth - y.solid.depth);
  const edges = opaque.map(() => new Set<number>()),
    incoming = opaque.map(() => 0);
  for (let i = 0; i < opaque.length; i++)
    for (let j = i + 1; j < opaque.length; j++) {
      const x = opaque[i].solid,
        y = opaque[j].solid,
        s = x.screen,
        t = y.screen;
      if (s.right <= t.left || t.right <= s.left || s.bottom <= t.top || t.bottom <= s.top)
        continue;
      const votes: number[] = [];
      for (let axis = 0; axis < 3; axis++) {
        if (Math.abs(direction[axis]) < 1e-6) continue;
        if (x.max[axis] <= y.min[axis] + 1e-6) votes.push(Math.sign(direction[axis]));
        else if (y.max[axis] <= x.min[axis] + 1e-6) votes.push(-Math.sign(direction[axis]));
      }
      if (!votes.length || votes.some((v) => v !== votes[0])) continue;
      const [before, after] = votes[0] > 0 ? [i, j] : [j, i];
      edges[before].add(after);
      incoming[after]++;
    }
  const ordered: T[] = [],
    remaining = new Set(opaque.map((_, i) => i));
  while (remaining.size) {
    // A bounded, stable fallback for genuinely intersecting schematic geometry.
    const next = [...remaining].find((i) => incoming[i] === 0) ?? remaining.values().next().value!;
    remaining.delete(next);
    ordered.push(opaque[next]);
    for (const after of edges[next]) incoming[after]--;
  }
  return [
    ...ordered,
    ...items.filter((x) => x.solid.opacity < 1).sort((x, y) => x.solid.depth - y.solid.depth),
  ];
}

export function anatomyConnections(scene: SpatialScene, p: Projection) {
  return scene.connections.flatMap((edge) => {
    const a = scene.objects.find((o) => o.id === edge.from && o.visible),
      b = scene.objects.find((o) => o.id === edge.to && o.visible);
    if (!a || !b) return [];
    const from = anatomyPoint(a.position),
      to = anatomyPoint(b.position);
    const mid: Point3 = [
      (from[0] + to[0]) / 2,
      (from[1] + to[1]) / 2,
      Math.min(from[2] - a.size.y / 2, to[2] - b.size.y / 2),
    ];
    return [
      {
        edge,
        d: pathOf([
          iso(from, p),
          iso([from[0], from[1], mid[2]], p),
          iso(mid, p),
          iso([to[0], to[1], mid[2]], p),
          iso(to, p),
        ]),
        from: iso(from, p),
        to: iso(to, p),
      },
    ];
  });
}
