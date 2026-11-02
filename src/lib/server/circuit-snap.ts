import sharp from 'sharp';
import type { CircuitLayoutRead } from './circuit-authoring';

type Point = { x: number; y: number };
type Affine = (p: Point) => Point;

/** Least-squares map from read points to where the drawing has them: affine with three or more
 * spread points, scale and shift per axis with two, a shift with one. */
function fit(pairs: { from: Point; to: Point }[]): Affine | null {
  if (!pairs.length) return null;
  const mean = (f: (p: { from: Point; to: Point }) => number) => pairs.reduce((s, p) => s + f(p), 0) / pairs.length;
  const fx = mean((p) => p.from.x), fy = mean((p) => p.from.y), tx = mean((p) => p.to.x), ty = mean((p) => p.to.y);
  if (pairs.length === 1) return (p) => ({ x: p.x + tx - fx, y: p.y + ty - fy });
  // Per-axis scale, used when the points do not span both axes.
  const axis = (k: 'x' | 'y', f: number, t: number) => {
    const sxx = pairs.reduce((s, p) => s + (p.from[k] - f) ** 2, 0);
    const sxt = pairs.reduce((s, p) => s + (p.from[k] - f) * (p.to[k] - t), 0);
    return sxx > 1e-6 ? sxt / sxx : 1;
  };
  const a = axis('x', fx, tx), d = axis('y', fy, ty);
  if (pairs.length === 2) return (p) => ({ x: tx + (p.x - fx) * a, y: ty + (p.y - fy) * d });
  // Full affine by normal equations on centred coordinates.
  let sxx = 0, sxy = 0, syy = 0, xX = 0, yX = 0, xY = 0, yY = 0;
  for (const p of pairs) {
    const x = p.from.x - fx, y = p.from.y - fy, X = p.to.x - tx, Y = p.to.y - ty;
    sxx += x * x; sxy += x * y; syy += y * y;
    xX += x * X; yX += y * X; xY += x * Y; yY += y * Y;
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-9 * Math.max(1, sxx * syy)) return (p) => ({ x: tx + (p.x - fx) * a, y: ty + (p.y - fy) * d });
  const m11 = (xX * syy - yX * sxy) / det, m12 = (yX * sxx - xX * sxy) / det;
  const m21 = (xY * syy - yY * sxy) / det, m22 = (yY * sxx - xY * sxy) / det;
  return (p) => ({ x: tx + m11 * (p.x - fx) + m12 * (p.y - fy), y: ty + m21 * (p.x - fx) + m22 * (p.y - fy) });
}

/** Moves a circuit read by Spark onto the drawing itself. Deterministic, no model call:
 * 1. each node point snaps to the filled junction dot near it, when one clearly stands out;
 * 2. those matches correct everything else, since a misread scale or shift is shared;
 * 3. each part finds the wire it sits on, then its body along that wire: the stretch where the
 *    ink spreads wide (a resistor's zigzag or box, a battery's plates). Anything not found
 *    keeps its corrected estimate. Light or dark slides alike. */
export async function snapCircuitToDrawing(dataUrl: string, layout: CircuitLayoutRead) {
  const { data, info } = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    limitInputPixels: 1600 * 1600,
    failOn: 'error',
  })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  let sum = 0;
  for (let i = 0; i < data.length; i += 7) sum += data[i];
  const light = sum / Math.ceil(data.length / 7) >= 128;
  const ink = (x: number, y: number) => {
    const ix = Math.round(x),
      iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return 0;
    const v = data[iy * W + ix] / 255;
    return (light ? 1 - v : v) > 0.45 ? 1 : 0;
  };
  const px = (p: Point) => ({ x: p.x * W, y: p.y * H });

  // 1. Junction dots: a filled disc, inked inside and mostly clear around (wires cross it).
  const disc = (cx: number, cy: number, r: number) => {
    let inside = 0, n = 0, around = 0, m = 0;
    for (let dy = -r; dy <= r; dy++)
      for (let dx = -r; dx <= r; dx++)
        if (dx * dx + dy * dy <= r * r * 0.8) {
          inside += ink(cx + dx, cy + dy);
          n++;
        }
    for (let k = 0; k < 48; k++) {
      const t = (k / 48) * Math.PI * 2;
      around += ink(cx + Math.cos(t) * r * 1.9, cy + Math.sin(t) * r * 1.9);
      m++;
    }
    return { inside: inside / n, around: around / m };
  };
  const radii = [0.003, 0.004, 0.005, 0.006, 0.0075].map((f) => Math.max(3, Math.round(f * W)));
  const reach = Math.round(0.08 * W);
  const snappedNodes = layout.nodes.map((node) => {
    const p = px(node);
    const found: { x: number; y: number; r: number; d: number }[] = [];
    for (let dy = -reach; dy <= reach; dy += 2)
      for (let dx = -reach; dx <= reach; dx += 2) {
        if (dx * dx + dy * dy > reach * reach) continue;
        for (const r of radii) {
          const s = disc(p.x + dx, p.y + dy, r);
          if (s.inside >= 0.9 && s.around <= 0.3) {
            found.push({ x: p.x + dx, y: p.y + dy, r, d: Math.hypot(dx, dy) });
            break;
          }
        }
      }
    if (!found.length) return null;
    // Group hits into dots; take the nearest dot, but only when no second dot is nearly as near.
    const dots: { x: number; y: number; d: number; n: number }[] = [];
    for (const f of found) {
      const dot = dots.find((g) => Math.hypot(g.x / g.n - f.x, g.y / g.n - f.y) <= radii.at(-1)! * 2);
      if (dot) {
        dot.x += f.x;
        dot.y += f.y;
        dot.n++;
        dot.d = Math.min(dot.d, f.d);
      } else dots.push({ x: f.x, y: f.y, d: f.d, n: 1 });
    }
    dots.sort((a, b) => a.d - b.d);
    if (dots.length > 1 && dots[1].d < dots[0].d * 1.5 + radii[0] * 4) return null;
    return { nodeId: node.nodeId, from: p, to: { x: dots[0].x / dots[0].n, y: dots[0].y / dots[0].n } };
  });
  const pairs = snappedNodes.filter((s): s is NonNullable<typeof s> => s !== null);
  const correct = fit(pairs) ?? ((p: Point) => p);
  // A correction that stretches the drawing implausibly is not trusted.
  const probe = [correct({ x: 0, y: 0 }), correct({ x: W, y: H })];
  const sane =
    Math.abs(probe[1].x - probe[0].x) / W > 0.6 &&
    Math.abs(probe[1].x - probe[0].x) / W < 1.6 &&
    Math.abs(probe[1].y - probe[0].y) / H > 0.6 &&
    Math.abs(probe[1].y - probe[0].y) / H < 1.6;
  const move = sane ? correct : (p: Point) => p;
  const nodes = layout.nodes.map((node) => {
    const exact = snappedNodes.find((s) => s?.nodeId === node.nodeId);
    const p = exact ? exact.to : move(px(node));
    return { nodeId: node.nodeId, x: clamp(p.x / W), y: clamp(p.y / H) };
  });

  // 3. Parts: the wire under the corrected estimate, then the wide-ink stretch along it.
  const stroke = Math.max(2, Math.round(0.0025 * W));
  let refined = 0;
  const components = layout.components.map((part) => {
    const a = move(px({ x: part.x1, y: part.y1 })),
      b = move(px({ x: part.x2, y: part.y2 }));
    const horizontal = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y);
    const along = (p: Point) => (horizontal ? p.x : p.y),
      across = (p: Point) => (horizontal ? p.y : p.x);
    const at = (u: number, v: number) => (horizontal ? ink(u, v) : ink(v, u));
    const lo = Math.min(along(a), along(b)),
      hi = Math.max(along(a), along(b)),
      length = Math.max(hi - lo, 0.02 * W),
      centre = (along(a) + along(b)) / 2,
      line = (across(a) + across(b)) / 2;
    const from = Math.round(centre - length * 1.2),
      to = Math.round(centre + length * 1.2);
    // The wire: the offset whose straight line through the window is inked most often.
    let bestLine = line,
      bestInk = -1;
    const shift = Math.round(0.05 * W);
    for (let d = -shift; d <= shift; d++) {
      let count = 0;
      for (let u = from; u <= to; u += 2) count += at(u, line + d);
      const score = count - Math.abs(d) * 0.01;
      if (score > bestInk) {
        bestInk = score;
        bestLine = line + d;
      }
    }
    const extent = (u: number) => {
      let spread = 0;
      for (let v = 1; v <= 0.04 * W; v++) if (at(u, bestLine + v) || at(u, bestLine - v)) spread = v;
      return spread;
    };
    const wide = (u: number) => extent(u) > stroke * 2.2;
    // Runs of wide ink, merged across short gaps (a battery's plates, a zigzag's turns).
    const runs: [number, number][] = [];
    for (let u = from; u <= to; u++)
      if (wide(u)) {
        const last = runs.at(-1);
        if (last && u - last[1] <= 0.025 * W) last[1] = u;
        else runs.push([u, u]);
      }
    const body = runs
      .filter(([s, e]) => e - s >= stroke)
      .sort((x, y) => Math.abs((x[0] + x[1]) / 2 - centre) - Math.abs((y[0] + y[1]) / 2 - centre))[0];
    let ends: [Point, Point];
    const point = (u: number, v: number): Point => (horizontal ? { x: u, y: v } : { x: v, y: u });
    if (body && Math.abs((body[0] + body[1]) / 2 - centre) <= length * 0.9 && body[1] - body[0] <= length * 2.2) {
      refined++;
      const first = along(a) <= along(b);
      ends = first ? [point(body[0], bestLine), point(body[1], bestLine)] : [point(body[1], bestLine), point(body[0], bestLine)];
    } else ends = [point(along(a), bestInk > 0 ? bestLine : across(a)), point(along(b), bestInk > 0 ? bestLine : across(b))];
    return {
      componentId: part.componentId,
      x1: clamp(ends[0].x / W),
      y1: clamp(ends[0].y / H),
      x2: clamp(ends[1].x / W),
      y2: clamp(ends[1].y / H),
    };
  });
  return { layout: { nodes, components }, snappedNodes: pairs.length, refinedParts: refined, corrected: sane && pairs.length > 0 };
}
const clamp = (v: number) => Math.min(1, Math.max(0, v));
