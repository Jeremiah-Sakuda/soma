import { mechanismBounds } from './mechanism-geometry';
import { pathMinimum, pathShapes, type SpatialPanel, type SpatialVector } from './spatial-schema';

type Box = { min: [number, number, number]; max: [number, number, number] };
// The model fills about this wide a stage, centred on the origin and standing on the floor.
const TARGET = 6.4,
  LIMIT = 5.8;
const clampSize = (n: number) => Math.max(0.1, Math.min(4, n));

const lined = (shape: string) => (pathShapes as readonly string[]).includes(shape);
const drawn = (o: SpatialPanel['objects'][number]) => lined(o.shape) && (o.path?.length ?? 0) >= pathMinimum(o.shape);
// An outline is a solid: its thickness may be a part's depth, not a line's.
const thickness = (o: SpatialPanel['objects'][number]) => (o.shape === 'outline' ? [0.12, 2.4] : [0.06, 0.4]);
function boxOf(o: SpatialPanel['objects'][number], at: SpatialVector = o.position): Box {
  // A lathe sweeps its profile round the vertical through its position.
  if (drawn(o) && o.shape === 'lathe') {
    const d = [at.x - o.position.x, at.y - o.position.y, at.z - o.position.z];
    const r = Math.max(...o.path!.map((p) => Math.abs(p.x - o.position.x)), 0.05);
    const ys = o.path!.map((p) => p.y + d[1]);
    return { min: [at.x - r, Math.min(...ys), at.z - r], max: [at.x + r, Math.max(...ys), at.z + r] };
  }
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
  const byId = new Map(objects.map((o) => [o.id, o]));
  // An arrow or tube needs its path; a path on any other shape is dropped.
  for (const o of objects) {
    if (!lined(o.shape)) delete o.path;
    else o.path = (o.path ?? []).filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y, p.z - all[i - 1].z) >= 0.02);
    // Too few points to draw: a sheet or outline becomes a slab, a line or lathe a plain rod.
    if (lined(o.shape) && !drawn(o)) {
      o.shape = o.shape === 'sheet' || o.shape === 'outline' ? 'box' : 'cylinder';
      delete o.path;
    }
    if (o.rotation && (o.geometry?.length || drawn(o))) delete o.rotation;
  }
  for (const pose of next.poses) {
    const owner = byId.get(pose.objectId);
    if (pose.path) pose.path = pose.path.filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y, p.z - all[i - 1].z) >= 0.02);
    // A posed path too short to draw keeps the part's own path at that step.
    if (pose.path && (!owner || !drawn(owner) || pose.path.length < pathMinimum(owner.shape))) delete pose.path;
  }
  const frames = (o: SpatialPanel['objects'][number]) => [o.position, ...next.poses.filter((p) => p.objectId === o.id && !p.path?.length).map((p) => p.position)];
  const posedPaths = (o: SpatialPanel['objects'][number]) => next.poses.filter((p) => p.objectId === o.id && p.path?.length).map((p) => p.path!);
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
    for (const o of objects)
      for (const path of posedPaths(o))
        for (const p of path)
          [p.x, p.y, p.z].forEach((v, i) => {
            min[i] = Math.min(min[i], v);
            max[i] = Math.max(max[i], v);
          });
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
      for (const pose of next.poses)
        if (pose.objectId === member.id) {
          pose.position = shift(pose.position);
          if (pose.path) pose.path = pose.path.map(shift);
        }
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
      // A line's thickness stays a line's, whatever the scale; an outline keeps a solid's depth.
      const [low, high] = thickness(o);
      const t = Math.max(low, Math.min(high, o.size.x * k));
      o.size = { x: t, y: t, z: t };
    } else o.size = { x: clampSize(o.size.x * k), y: clampSize(o.size.y * k), z: clampSize(o.size.z * k) };
  }
  for (const pose of next.poses) {
    pose.position = place(pose.position);
    if (pose.path?.length && drawn(byId.get(pose.objectId)!)) pose.path = pose.path.map(place);
    else delete pose.path;
  }
  return next;
}
