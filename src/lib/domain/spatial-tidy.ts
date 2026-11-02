import { mechanismBounds } from './mechanism-geometry';
import type { SpatialPanel, SpatialVector } from './spatial-schema';

type Box = { min: [number, number, number]; max: [number, number, number] };
// The model fills about this wide a stage, centred on the origin and standing on the floor.
const TARGET = 6.4,
  LIMIT = 5.8;
const clampSize = (n: number) => Math.max(0.1, Math.min(4, n));

const drawn = (o: SpatialPanel['objects'][number]) => (o.shape === 'arrow' || o.shape === 'tube') && (o.path?.length ?? 0) >= 2;
function boxOf(o: SpatialPanel['objects'][number], at: SpatialVector = o.position): Box {
  if (drawn(o)) {
    const d = [at.x - o.position.x, at.y - o.position.y, at.z - o.position.z], r = o.size.x / 2;
    const xs = o.path!.map((p) => [p.x + d[0], p.y + d[1], p.z + d[2]]);
    return {
      min: [0, 1, 2].map((k) => Math.min(...xs.map((p) => p[k])) - r) as Box['min'],
      max: [0, 1, 2].map((k) => Math.max(...xs.map((p) => p[k])) + r) as Box['max'],
    };
  }
  if (o.geometry?.length) {
    const b = mechanismBounds({ ...o, position: at });
    return { min: b.min, max: b.max };
  }
  return {
    min: [at.x - o.size.x / 2, at.y - o.size.y / 2, at.z - o.size.z / 2],
    max: [at.x + o.size.x / 2, at.y + o.size.y / 2, at.z + o.size.z / 2],
  };
}

/** Arranges a freshly authored model so it reads at a glance, whatever coordinates the author
 * chose: one uniform scale and shift so the whole model (every step's pose included) fills
 * the stage and stands on the floor; parts too small to see grow to a legible size; parts
 * that interpenetrate without being contained move apart. Proportions, containment and
 * motion between steps are kept. Presentation only; nothing here is a source fact. */
export function tidySpatialPanel(panel: SpatialPanel): SpatialPanel {
  const next: SpatialPanel = structuredClone(panel);
  const objects = next.objects;
  if (!objects.length) return next;
  // An arrow or tube needs its path; a path on any other shape is dropped.
  for (const o of objects) {
    if ((o.shape === 'arrow' || o.shape === 'tube') && (o.path?.length ?? 0) < 2) o.shape = 'cylinder';
    if (o.shape !== 'arrow' && o.shape !== 'tube') delete o.path;
    else o.path = o.path!.filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y, p.z - all[i - 1].z) >= 0.02);
    if (o.path && o.path.length < 2) {
      o.shape = 'cylinder';
      delete o.path;
    }
  }
  const byId = new Map(objects.map((o) => [o.id, o]));
  const frames = (o: SpatialPanel['objects'][number]) => [o.position, ...next.poses.filter((p) => p.objectId === o.id).map((p) => p.position)];
  const extent = () => {
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const o of objects)
      for (const at of frames(o)) {
        const b = boxOf(o, at);
        for (let i = 0; i < 3; i++) {
          min[i] = Math.min(min[i], b.min[i]);
          max[i] = Math.max(max[i], b.max[i]);
        }
      }
    return { min, max };
  };
  // Small parts first: the smallest visible dimension of each top-level part is at least a
  // twelfth of the model's span, scaling contained parts with their container.
  const span0 = (() => {
    const e = extent();
    return Math.max(e.max[0] - e.min[0], e.max[2] - e.min[2], e.max[1] - e.min[1], 1e-3);
  })();
  for (const o of objects) {
    if (o.geometry?.length || o.parentId || drawn(o)) continue;
    const largest = Math.max(o.size.x, o.size.y, o.size.z);
    const grow = (span0 / 12) / largest;
    if (grow > 1) {
      o.size = { x: clampSize(o.size.x * grow), y: clampSize(o.size.y * grow), z: clampSize(o.size.z * grow) };
      for (const child of objects)
        if (child.parentId === o.id && !child.geometry?.length)
          child.size = { x: clampSize(child.size.x * grow), y: clampSize(child.size.y * grow), z: clampSize(child.size.z * grow) };
    }
  }
  // Part from part: top-level, uncontained parts whose boxes overlap are pushed apart on the
  // floor, along the line between them; contained parts move with their container.
  // Custom-piece parts share one assembly frame by design, so they are never moved apart.
  const top = objects.filter((o) => !o.parentId && !o.geometry?.length && !drawn(o));
  const move = (o: SpatialPanel['objects'][number], dx: number, dz: number) => {
    const shift = (p: SpatialVector) => ({ ...p, x: p.x + dx, z: p.z + dz });
    const family = [o, ...objects.filter((c) => {
      for (let p = c.parentId; p; p = byId.get(p)?.parentId ?? null) if (p === o.id) return true;
      return false;
    })];
    for (const member of family) {
      member.position = shift(member.position);
      if (member.path) member.path = member.path.map(shift);
      for (const pose of next.poses) if (pose.objectId === member.id) pose.position = shift(pose.position);
    }
  };
  for (let round = 0; round < 40; round++) {
    let moved = false;
    for (let i = 0; i < top.length; i++)
      for (let j = i + 1; j < top.length; j++) {
        const a = boxOf(top[i]),
          b = boxOf(top[j]);
        const over = [0, 1, 2].map((k) => Math.min(a.max[k], b.max[k]) - Math.max(a.min[k], b.min[k]));
        // Attached parts touch or overlap a little (a clamp on a string, a piston in its bore);
        // only parts stacked on nearly the same spot, as when an author leaves several at the
        // origin, are moved apart.
        const size = Math.min(...[0, 2].map((k) => Math.min(a.max[k] - a.min[k], b.max[k] - b.min[k])));
        let dx = (b.min[0] + b.max[0] - a.min[0] - a.max[0]) / 2,
          dz = (b.min[2] + b.max[2] - a.min[2] - a.max[2]) / 2;
        if (over.some((v) => v <= 0) || Math.hypot(dx, dz) > size * 0.3) continue;
        if (Math.hypot(dx, dz) < 1e-3) [dx, dz] = [1, 0];
        const along = over[0] < over[2] ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
        const push = (Math.min(over[0], over[2]) + 0.05) / 2;
        move(top[i], -along[0] * push, -along[1] * push);
        move(top[j], along[0] * push, along[1] * push);
        moved = true;
      }
    if (!moved) break;
  }
  // One uniform scale and shift: fill the stage, centre it, stand it on the floor.
  const e = extent();
  const span = Math.max(e.max[0] - e.min[0], e.max[2] - e.min[2], (e.max[1] - e.min[1]) * 1.2, 1e-3);
  const k = Math.min(TARGET / span, 4 / Math.max(...objects.filter((o) => !drawn(o)).map((o) => Math.max(o.size.x, o.size.y, o.size.z)), 0.1));
  const cx = (e.min[0] + e.max[0]) / 2,
    cz = (e.min[2] + e.max[2]) / 2,
    floor = e.min[1];
  const place = (p: SpatialVector): SpatialVector => ({
    x: Math.max(-LIMIT, Math.min(LIMIT, (p.x - cx) * k)),
    y: Math.max(-LIMIT, Math.min(LIMIT, (p.y - floor) * k - 1.5)),
    z: Math.max(-LIMIT, Math.min(LIMIT, (p.z - cz) * k)),
  });
  for (const o of objects) {
    o.position = place(o.position);
    if (drawn(o)) {
      o.path = o.path!.map(place);
      // A line's thickness stays a line's, whatever the scale.
      const t = Math.max(0.06, Math.min(0.4, o.size.x * k));
      o.size = { x: t, y: t, z: t };
    } else o.size = { x: clampSize(o.size.x * k), y: clampSize(o.size.y * k), z: clampSize(o.size.z * k) };
  }
  for (const pose of next.poses) pose.position = place(pose.position);
  return next;
}
