import sharp from 'sharp';

type Position = { nodeId: string; x: number; y: number };

/** Moves each estimated node centre onto the drawn node nearby by searching for the circle
 * itself: around the estimate, the centre and radius whose ring is darkest while its inside
 * stays light. Text and lines do not form rings, so a nearby text column cannot pull a node
 * away. Deterministic, no model call. A node without a convincing ring keeps its estimate. */
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
  const dark = (x: number, y: number) => {
    const ix = Math.round(x),
      iy = Math.round(y);
    return ix < 0 || iy < 0 || ix >= W || iy >= H ? 0 : (255 - data[iy * W + ix]) / 255;
  };
  const SAMPLES = 40;
  const ring = (cx: number, cy: number, r: number) => {
    let sum = 0;
    for (let k = 0; k < SAMPLES; k++) {
      const t = (k / SAMPLES) * Math.PI * 2;
      // Best of three nearby radii tolerates anti-aliasing and stroke width.
      sum += Math.max(dark(cx + Math.cos(t) * r, cy + Math.sin(t) * r), dark(cx + Math.cos(t) * (r - 1.5), cy + Math.sin(t) * (r - 1.5)), dark(cx + Math.cos(t) * (r + 1.5), cy + Math.sin(t) * (r + 1.5)));
    }
    return sum / SAMPLES;
  };
  const pts = positions.map((p) => ({ ...p, px: p.x * W, py: p.y * H }));
  const gap = Math.min(...pts.flatMap((a, i) => pts.slice(i + 1).map((b) => Math.hypot(a.px - b.px, a.py - b.py))));
  const reach = gap * 0.45;
  const radii = [0.12, 0.15, 0.18, 0.21, 0.24].map((f) => gap * f).filter((r) => r >= 5);
  let moved = 0;
  const out = pts.map((p) => {
    let best = { score: 0, x: p.px, y: p.py };
    const search = (x0: number, y0: number, span: number, step: number) => {
      for (let dy = -span; dy <= span; dy += step)
        for (let dx = -span; dx <= span; dx += step) {
          const x = x0 + dx,
            y = y0 + dy;
          if (Math.hypot(x - p.px, y - p.py) > reach) continue;
          for (const r of radii) {
            const score = ring(x, y, r) - 0.6 * ring(x, y, r * 0.55);
            if (score > best.score) best = { score, x, y };
          }
        }
    };
    search(p.px, p.py, reach, Math.max(2, reach / 14));
    search(best.x, best.y, Math.max(3, reach / 14), 1);
    if (best.score < 0.3) return { nodeId: p.nodeId, x: p.x, y: p.y };
    if (Math.hypot(best.x - p.px, best.y - p.py) >= 1) moved++;
    return { nodeId: p.nodeId, x: best.x / W, y: best.y / H };
  });
  // Snapping must keep nodes distinguishable.
  const ok = out.every((a, i) => out.slice(i + 1).every((b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) > gap * 0.5));
  return ok ? { positions: out, moved } : { positions, moved: 0 };
}
