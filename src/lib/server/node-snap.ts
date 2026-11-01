import sharp from 'sharp';

type Position = { nodeId: string; x: number; y: number };

const SAMPLES = 36;
const COS = Array.from({ length: SAMPLES }, (_, k) => Math.cos((k / SAMPLES) * Math.PI * 2));
const SIN = Array.from({ length: SAMPLES }, (_, k) => Math.sin((k / SAMPLES) * Math.PI * 2));

/** Moves each estimated node centre onto the drawn node nearby by searching for the circle
 * itself: the centre and radius whose ring stands out from both its inside and its outside.
 * Text, lines and flat areas do not form such rings. Works on light or dark slides.
 * Deterministic, no model call. A node without a ring that clearly beats its estimate keeps
 * the estimate, as does one with a second strong ring within reach. */
export async function snapNodesToDrawing(dataUrl: string, positions: Position[]) {
  if (positions.length < 2) return { positions, moved: 0 };
  const { data, info } = await sharp(Buffer.from(dataUrl.split(',')[1], 'base64'), {
    limitInputPixels: 1600 * 1600,
    failOn: 'error',
  })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = info.width,
    H = info.height;
  const pts = positions.map((p) => ({ ...p, px: p.x * W, py: p.y * H }));
  const gap = Math.min(...pts.flatMap((a, i) => pts.slice(i + 1).map((b) => Math.hypot(a.px - b.px, a.py - b.py))));
  // Ink is whichever is rarer around the graph: dark strokes on light slides, light on dark.
  let sum = 0,
    count = 0;
  for (const p of pts)
    for (let dy = -gap * 0.4; dy <= gap * 0.4; dy += 4)
      for (let dx = -gap * 0.4; dx <= gap * 0.4; dx += 4) {
        const ix = Math.round(p.px + dx),
          iy = Math.round(p.py + dy);
        if (ix >= 0 && iy >= 0 && ix < W && iy < H) {
          sum += data[iy * W + ix];
          count++;
        }
      }
  const lightBackground = !count || sum / count >= 128;
  const ink = (x: number, y: number) => {
    const ix = Math.round(x),
      iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= W || iy >= H) return 0;
    const v = data[iy * W + ix] / 255;
    return lightBackground ? 1 - v : v;
  };
  const ring = (cx: number, cy: number, r: number) => {
    let total = 0;
    for (let k = 0; k < SAMPLES; k++)
      total += Math.max(ink(cx + COS[k] * r, cy + SIN[k] * r), ink(cx + COS[k] * (r - 1.5), cy + SIN[k] * (r - 1.5)), ink(cx + COS[k] * (r + 1.5), cy + SIN[k] * (r + 1.5)));
    return total / SAMPLES;
  };
  const score = (x: number, y: number, r: number) => ring(x, y, r) - Math.max(ring(x, y, r * 0.55), ring(x, y, r * 1.45));
  const reach = Math.min(gap * 0.45, 90);
  const radii = [0.08, 0.1, 0.12, 0.15, 0.18, 0.21, 0.24, 0.28, 0.32]
    .map((f) => Math.min(80, gap * f))
    .filter((r, i, all) => r >= 5 && all.indexOf(r) === i);
  let moved = 0;
  const out = pts.map((p) => {
    const atEstimate = Math.max(...radii.map((r) => score(p.px, p.py, r)));
    let best = { value: -Infinity, x: p.px, y: p.py, r: radii[0] };
    const step = Math.max(2, reach / 12);
    const grid: { value: number; x: number; y: number }[] = [];
    for (let dy = -reach; dy <= reach; dy += step)
      for (let dx = -reach; dx <= reach; dx += step) {
        if (dx * dx + dy * dy > reach * reach) continue;
        let here = -Infinity;
        for (const r of radii) {
          const value = score(p.px + dx, p.py + dy, r);
          here = Math.max(here, value);
          if (value > best.value) best = { value, x: p.px + dx, y: p.py + dy, r };
        }
        grid.push({ value: here, x: p.px + dx, y: p.py + dy });
      }
    // Another strong ring within reach (a letter O, a neighbouring node) makes the match ambiguous.
    const rival = Math.max(-Infinity, ...grid.filter((g) => Math.hypot(g.x - best.x, g.y - best.y) > best.r).map((g) => g.value));
    // Refine within the coarse step, at the best radius only.
    const span = Math.min(6, Math.ceil(step));
    const coarse = best;
    for (let dy = -span; dy <= span; dy++)
      for (let dx = -span; dx <= span; dx++) {
        const value = score(coarse.x + dx, coarse.y + dy, coarse.r);
        if (value > best.value) best = { ...best, value, x: coarse.x + dx, y: coarse.y + dy };
      }
    const convincing =
      best.value >= 0.25 &&
      best.value > atEstimate + 0.08 &&
      !(rival >= 0.25 && rival > best.value - 0.12) &&
      // The estimate should fall on or near the drawn node it is moved onto.
      Math.hypot(best.x - p.px, best.y - p.py) <= best.r * 1.8;
    if (!convincing) return { nodeId: p.nodeId, x: p.x, y: p.y };
    if (Math.hypot(best.x - p.px, best.y - p.py) >= 1) moved++;
    return { nodeId: p.nodeId, x: best.x / W, y: best.y / H };
  });
  // Snapping must keep nodes distinguishable.
  const ok = out.every((a, i) => out.slice(i + 1).every((b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) > gap * 0.5));
  return ok ? { positions: out, moved } : { positions, moved: 0 };
}
