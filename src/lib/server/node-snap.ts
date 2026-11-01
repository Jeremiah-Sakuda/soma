import sharp from 'sharp';

type Position = { nodeId: string; x: number; y: number };

/** Moves each estimated node centre onto the drawn node nearby: a few mean-shift steps over
 * dark pixels (outline and letter) in a window about the node's size. Deterministic, no model
 * call. A point that would move further than its window, or into another node, keeps its
 * estimate. Returns the refined positions and how many moved. */
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
  const radius = Math.max(6, gap * 0.32);
  let moved = 0;
  const out = pts.map((p) => {
    let x = p.px,
      y = p.py;
    for (let iteration = 0; iteration < 6; iteration++) {
      let sx = 0,
        sy = 0,
        n = 0;
      const r = Math.ceil(radius);
      for (let dy = -r; dy <= r; dy++)
        for (let dx = -r; dx <= r; dx++) {
          if (dx * dx + dy * dy > radius * radius) continue;
          const ix = Math.round(x + dx),
            iy = Math.round(y + dy);
          if (ix < 0 || iy < 0 || ix >= W || iy >= H) continue;
          const dark = 255 - data[iy * W + ix];
          if (dark < 110) continue;
          sx += ix * dark;
          sy += iy * dark;
          n += dark;
        }
      if (!n) break;
      const nx = sx / n,
        ny = sy / n;
      const step = Math.hypot(nx - x, ny - y);
      x = nx;
      y = ny;
      if (step < 0.5) break;
    }
    const distance = Math.hypot(x - p.px, y - p.py);
    if (distance > radius * 1.2 || distance < 1) return { nodeId: p.nodeId, x: p.x, y: p.y };
    moved++;
    return { nodeId: p.nodeId, x: x / W, y: y / H };
  });
  // Snapping must keep nodes distinguishable.
  const ok = out.every((a, i) => out.slice(i + 1).every((b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) > gap * 0.5));
  return ok ? { positions: out, moved } : { positions, moved: 0 };
}
