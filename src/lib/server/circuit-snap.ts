import sharp from 'sharp';
import type { CircuitLayoutRead } from './circuit-authoring';

type Point = { x: number; y: number };
type Affine = (p: Point) => Point;

/** Least-squares map from read points to where the drawing has them: affine with three or more
 * spread points, scale and shift per axis with two, a shift with one. */
function fit(pairs: { from: Point; to: Point }[]): Affine | null {
  if (!pairs.length) return null;
  const mean = (f: (p: { from: Point; to: Point }) => number) =>
    pairs.reduce((s, p) => s + f(p), 0) / pairs.length;
  const fx = mean((p) => p.from.x),
    fy = mean((p) => p.from.y),
    tx = mean((p) => p.to.x),
    ty = mean((p) => p.to.y);
  if (pairs.length === 1) return (p) => ({ x: p.x + tx - fx, y: p.y + ty - fy });
  // Per-axis scale, used when the points do not span both axes.
  const axis = (k: 'x' | 'y', f: number, t: number) => {
    const sxx = pairs.reduce((s, p) => s + (p.from[k] - f) ** 2, 0);
    const sxt = pairs.reduce((s, p) => s + (p.from[k] - f) * (p.to[k] - t), 0);
    return sxx > 1e-6 ? sxt / sxx : 1;
  };
  const a = axis('x', fx, tx),
    d = axis('y', fy, ty);
  if (pairs.length === 2) return (p) => ({ x: tx + (p.x - fx) * a, y: ty + (p.y - fy) * d });
  // Full affine by normal equations on centred coordinates.
  let sxx = 0,
    sxy = 0,
    syy = 0,
    xX = 0,
    yX = 0,
    xY = 0,
    yY = 0;
  for (const p of pairs) {
    const x = p.from.x - fx,
      y = p.from.y - fy,
      X = p.to.x - tx,
      Y = p.to.y - ty;
    sxx += x * x;
    sxy += x * y;
    syy += y * y;
    xX += x * X;
    yX += y * X;
    xY += x * Y;
    yY += y * Y;
  }
  const det = sxx * syy - sxy * sxy;
  if (Math.abs(det) < 1e-9 * Math.max(1, sxx * syy))
    return (p) => ({ x: tx + (p.x - fx) * a, y: ty + (p.y - fy) * d });
  const m11 = (xX * syy - yX * sxy) / det,
    m12 = (yX * sxx - xX * sxy) / det;
  const m21 = (xY * syy - yY * sxy) / det,
    m22 = (yY * sxx - xY * sxy) / det;
  return (p) => ({
    x: tx + m11 * (p.x - fx) + m12 * (p.y - fy),
    y: ty + m21 * (p.x - fx) + m22 * (p.y - fy),
  });
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

  // 1. Junction dots: the only ink thick enough to hold a small disc (wires, zigzags, plates and
  // letters are thinner). A chamfer distance transform finds every such core in one pass.
  const dist = new Uint16Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      if (!ink(x, y)) continue;
      let d = 60000;
      if (x > 0) d = Math.min(d, dist[i - 1] + 3);
      if (y > 0) {
        d = Math.min(d, dist[i - W] + 3);
        if (x > 0) d = Math.min(d, dist[i - W - 1] + 4);
        if (x < W - 1) d = Math.min(d, dist[i - W + 1] + 4);
      } else d = Math.min(d, 3);
      if (x === 0 || x === W - 1 || y === H - 1) d = Math.min(d, 3);
      dist[i] = d;
    }
  for (let y = H - 1; y >= 0; y--)
    for (let x = W - 1; x >= 0; x--) {
      const i = y * W + x;
      if (!dist[i]) continue;
      let d = dist[i];
      if (x < W - 1) d = Math.min(d, dist[i + 1] + 3);
      if (y < H - 1) {
        d = Math.min(d, dist[i + W] + 3);
        if (x < W - 1) d = Math.min(d, dist[i + W + 1] + 4);
        if (x > 0) d = Math.min(d, dist[i + W - 1] + 4);
      }
      dist[i] = d;
    }
  const core = Math.max(3, 0.0032 * W) * 3,
    largest = (0.012 * W) ** 2 * Math.PI;
  const seen = new Uint8Array(W * H);
  const dots: Point[] = [];
  for (let i = 0; i < dist.length; i++) {
    if (dist[i] < core || seen[i]) continue;
    const queue = [i];
    seen[i] = 1;
    let sx = 0,
      sy = 0,
      n = 0,
      x0 = W,
      x1 = 0,
      y0 = H,
      y1 = 0;
    while (queue.length) {
      const j = queue.pop()!,
        x = j % W,
        y = (j - x) / W;
      sx += x;
      sy += y;
      n++;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
      for (const k of [j - 1, j + 1, j - W, j + W])
        if (
          k >= 0 &&
          k < dist.length &&
          !seen[k] &&
          dist[k] >= core &&
          Math.abs((k % W) - x) <= 1
        ) {
          seen[k] = 1;
          queue.push(k);
        }
    }
    const w = x1 - x0 + 1,
      h = y1 - y0 + 1;
    // Round and small: a dot's core, not a filled shape or a thick bar.
    if (n <= largest && Math.max(w, h) <= Math.min(w, h) * 2 + 2)
      dots.push({ x: sx / n, y: sy / n });
  }
  // Each node takes its nearest dot when no other dot is nearly as near; each dot serves one
  // node. A second round re-estimates the unmatched nodes from the first round's matches.
  const reach = 0.13 * W;
  let estimate = (p: Point) => p;
  let pairs: { nodeId: string; from: Point; to: Point }[] = [];
  for (let round = 0; round < 2; round++) {
    const taken = new Set(pairs.map((p) => `${p.to.x},${p.to.y}`));
    const fresh = layout.nodes
      .filter((node) => !pairs.some((p) => p.nodeId === node.nodeId))
      .map((node) => {
        const at = estimate(px(node));
        const near = dots
          .filter((d) => !taken.has(`${d.x},${d.y}`))
          .map((d) => ({ d, distance: Math.hypot(d.x - at.x, d.y - at.y) }))
          .sort((a, b) => a.distance - b.distance);
        const best = near[0];
        if (
          !best ||
          best.distance > reach ||
          (near[1] && near[1].distance < best.distance * 1.6 + 0.01 * W)
        )
          return null;
        return { nodeId: node.nodeId, from: px(node), to: best.d, distance: best.distance };
      })
      .filter((m): m is NonNullable<typeof m> => m !== null)
      .sort((a, b) => a.distance - b.distance);
    for (const m of fresh)
      if (!pairs.some((p) => p.to === m.to))
        pairs.push({ nodeId: m.nodeId, from: m.from, to: m.to });
    estimate = fit(pairs) ?? estimate;
  }
  const snappedNodes = layout.nodes.map(
    (node) => pairs.find((p) => p.nodeId === node.nodeId) ?? null,
  );
  const correct = fit(pairs) ?? ((p: Point) => p);
  // A correction that stretches the drawing implausibly is not trusted.
  const probe = [correct({ x: 0, y: 0 }), correct({ x: W, y: H })];
  const sane =
    Math.abs(probe[1].x - probe[0].x) / W > 0.5 &&
    Math.abs(probe[1].x - probe[0].x) / W < 1.6 &&
    Math.abs(probe[1].y - probe[0].y) / H > 0.5 &&
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
      for (let v = 1; v <= 0.04 * W; v++)
        if (at(u, bestLine + v) || at(u, bestLine - v)) spread = v;
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
      .sort(
        (x, y) => Math.abs((x[0] + x[1]) / 2 - centre) - Math.abs((y[0] + y[1]) / 2 - centre),
      )[0];
    let ends: [Point, Point];
    const point = (u: number, v: number): Point => (horizontal ? { x: u, y: v } : { x: v, y: u });
    if (
      body &&
      Math.abs((body[0] + body[1]) / 2 - centre) <= length * 0.9 &&
      body[1] - body[0] <= length * 2.2
    ) {
      refined++;
      const first = along(a) <= along(b);
      ends = first
        ? [point(body[0], bestLine), point(body[1], bestLine)]
        : [point(body[1], bestLine), point(body[0], bestLine)];
    } else
      ends = [
        point(along(a), bestInk > 0 ? bestLine : across(a)),
        point(along(b), bestInk > 0 ? bestLine : across(b)),
      ];
    return {
      componentId: part.componentId,
      x1: clamp(ends[0].x / W),
      y1: clamp(ends[0].y / H),
      x2: clamp(ends[1].x / W),
      y2: clamp(ends[1].y / H),
    };
  });
  return {
    layout: { nodes, components },
    snappedNodes: pairs.length,
    refinedParts: refined,
    corrected: sane && pairs.length > 0,
  };
}
const clamp = (v: number) => Math.min(1, Math.max(0, v));
