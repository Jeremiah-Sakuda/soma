import sharp from 'sharp';

type Position = { nodeId: string; x: number; y: number };
type DrawnGraph = { readonly edges: readonly { readonly from: string; readonly to: string }[] };

const SAMPLES = 36;
const COS = Array.from({ length: SAMPLES }, (_, k) => Math.cos((k / SAMPLES) * Math.PI * 2));
const SIN = Array.from({ length: SAMPLES }, (_, k) => Math.sin((k / SAMPLES) * Math.PI * 2));

/** Moves each estimated node centre onto the drawn node nearby by searching for the circle
 * itself: the centre and radius whose ring stands out from both its inside and its outside.
 * Text, lines and flat areas do not form such rings. Works on light or dark slides.
 * Deterministic, no model call. A node without a ring that clearly beats its estimate keeps
 * the estimate, as does one with a second strong ring within reach. */
export async function snapNodesToDrawing(
  dataUrl: string,
  positions: Position[],
  graph?: DrawnGraph,
) {
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
  const gap = Math.min(
    ...pts.flatMap((a, i) => pts.slice(i + 1).map((b) => Math.hypot(a.px - b.px, a.py - b.py))),
  );
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
      total += Math.max(
        ink(cx + COS[k] * r, cy + SIN[k] * r),
        ink(cx + COS[k] * (r - 1.5), cy + SIN[k] * (r - 1.5)),
        ink(cx + COS[k] * (r + 1.5), cy + SIN[k] * (r + 1.5)),
      );
    return total / SAMPLES;
  };
  const score = (x: number, y: number, r: number) =>
    ring(x, y, r) - Math.max(ring(x, y, r * 0.55), ring(x, y, r * 1.45));
  const reach = Math.min(gap * 0.45, 90);
  const radii = [0.08, 0.1, 0.12, 0.15, 0.18, 0.21, 0.24, 0.28, 0.32]
    .map((f) => Math.min(80, gap * f))
    .filter((r, i, all) => r >= 5 && all.indexOf(r) === i);
  const candidates = pts.map((p) => {
    const atEstimate = Math.max(...radii.map((r) => score(p.px, p.py, r)));
    let best = { value: -Infinity, x: p.px, y: p.py, r: radii[0] };
    const step = Math.max(2, reach / 12);
    const grid: { value: number; x: number; y: number; r: number }[] = [];
    for (let dy = -reach; dy <= reach; dy += step)
      for (let dx = -reach; dx <= reach; dx += step) {
        if (dx * dx + dy * dy > reach * reach) continue;
        let here = -Infinity,
          hereRadius = radii[0];
        for (const r of radii) {
          const value = score(p.px + dx, p.py + dy, r);
          if (value > here) {
            here = value;
            hereRadius = r;
          }
          if (value > best.value) best = { value, x: p.px + dx, y: p.py + dy, r };
        }
        grid.push({ value: here, x: p.px + dx, y: p.py + dy, r: hereRadius });
      }
    // Another strong ring within reach (a letter O, a neighbouring node) makes the match ambiguous.
    const rival = Math.max(
      -Infinity,
      ...grid.filter((g) => Math.hypot(g.x - best.x, g.y - best.y) > best.r).map((g) => g.value),
    );
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
    const distance = Math.hypot(best.x - p.px, best.y - p.py);
    let corroborationRival = rival;
    if (graph) {
      // Compare equally refined rings. A coarse competitor can otherwise look weak
      // merely because its centre falls between grid samples. This stricter rival
      // check belongs only to the optional corroboration path.
      const peaks: typeof grid = [];
      for (const point of grid
        .filter((g) => g.value >= 0.25 && Math.hypot(g.x - best.x, g.y - best.y) > best.r)
        .sort((a, b) => b.value - a.value)) {
        if (peaks.some((peak) => Math.hypot(peak.x - point.x, peak.y - point.y) <= peak.r))
          continue;
        peaks.push(point);
        for (let dy = -span; dy <= span; dy++)
          for (let dx = -span; dx <= span; dx++)
            corroborationRival = Math.max(
              corroborationRival,
              score(point.x + dx, point.y + dy, point.r),
            );
        if (peaks.length === 3) break;
      }
    }
    return { p, best, rival, corroborationRival, atEstimate, distance, convincing };
  });
  const accepted = new Set(candidates.filter((candidate) => candidate.convincing));
  if (graph) {
    // A separate, stricter path for a distant estimate. It never changes the local
    // distance gate: circles must agree with three reliable anchors AND with the
    // pixels of two distinct incident straight edges in the supplied checked graph.
    const fullRing = (candidate: (typeof candidates)[number]) => {
      const { best } = candidate;
      const coverage =
        COS.filter(
          (c, k) =>
            Math.max(
              ink(best.x + c * best.r, best.y + SIN[k] * best.r),
              ink(best.x + c * (best.r - 1.5), best.y + SIN[k] * (best.r - 1.5)),
              ink(best.x + c * (best.r + 1.5), best.y + SIN[k] * (best.r + 1.5)),
            ) >= 0.45,
        ).length / SAMPLES;
      return (
        best.value >= 0.5 && coverage >= 0.8 && best.value - candidate.corroborationRival >= 0.2
      );
    };
    const strong = candidates.filter(fullRing);
    const anchors = strong.filter(
      (candidate) =>
        candidate.convincing ||
        (candidate.distance <= Math.max(2, candidate.best.r * 0.12) &&
          candidate.atEstimate >= 0.45),
    );
    const sizes = anchors.map((candidate) => candidate.best.r).sort((a, b) => a - b);
    const radius = sizes[Math.floor(sizes.length / 2)];
    const sameSize = (candidate: (typeof candidates)[number]) =>
      Math.abs(candidate.best.r - radius) <= radius * 0.15;
    const trusted = new Map(
      anchors.filter(sameSize).map((candidate) => [candidate.p.nodeId, candidate]),
    );
    if (trusted.size >= 3) {
      const straightInk = (a: (typeof candidates)[number], b: (typeof candidates)[number]) => {
        const dx = b.best.x - a.best.x,
          dy = b.best.y - a.best.y,
          length = Math.hypot(dx, dy);
        const from = Math.max(a.best.r + 4, length * 0.18);
        const to = Math.min(length - b.best.r - 4, length * 0.82);
        if (to - from < radius) return false;
        const samples = Math.max(24, Math.min(80, Math.ceil((to - from) / 3)));
        const width = Math.max(1, Math.min(3, radius * 0.08));
        let hits = 0;
        for (let k = 0; k < samples; k++) {
          const t = (from + ((to - from) * k) / (samples - 1)) / length;
          const x = a.best.x + dx * t,
            y = a.best.y + dy * t;
          if (
            Math.max(
              ink(x, y),
              ink(x - (dy / length) * width, y + (dx / length) * width),
              ink(x + (dy / length) * width, y - (dx / length) * width),
            ) >= 0.45
          )
            hits++;
        }
        return hits / samples >= 0.78;
      };
      // Two bounded passes permit a newly corroborated node to support its neighbor;
      // no candidate can certify itself, and every added node requires two prior anchors.
      for (let round = 0; round < 2; round++) {
        const additions: typeof candidates = [];
        for (const candidate of strong) {
          if (
            accepted.has(candidate) ||
            trusted.has(candidate.p.nodeId) ||
            !sameSize(candidate) ||
            candidate.distance <= candidate.best.r * 1.8 ||
            candidate.distance > reach ||
            candidate.best.value <= candidate.atEstimate + 0.08 ||
            strong.some(
              (other) =>
                other !== candidate &&
                Math.hypot(other.best.x - candidate.best.x, other.best.y - candidate.best.y) <
                  radius * 1.2,
            )
          )
            continue;
          const incident = new Set(
            graph.edges.flatMap((edge) =>
              edge.from === candidate.p.nodeId
                ? [edge.to]
                : edge.to === candidate.p.nodeId
                  ? [edge.from]
                  : [],
            ),
          );
          const neighbors = [...incident].flatMap((id) => {
            const neighbor = trusted.get(id);
            return neighbor && straightInk(candidate, neighbor) ? [neighbor] : [];
          });
          const separated = neighbors.some((a, i) =>
            neighbors.slice(i + 1).some((b) => {
              const ax = a.best.x - candidate.best.x,
                ay = a.best.y - candidate.best.y;
              const bx = b.best.x - candidate.best.x,
                by = b.best.y - candidate.best.y;
              return (
                (ax * bx + ay * by) / (Math.hypot(ax, ay) * Math.hypot(bx, by)) <=
                Math.cos(Math.PI / 9)
              );
            }),
          );
          if (separated) additions.push(candidate);
        }
        if (!additions.length) break;
        for (const candidate of additions) {
          accepted.add(candidate);
          trusted.set(candidate.p.nodeId, candidate);
        }
      }
    }
  }
  let moved = 0;
  const out = candidates.map((candidate) => {
    if (!accepted.has(candidate))
      return { nodeId: candidate.p.nodeId, x: candidate.p.x, y: candidate.p.y };
    if (candidate.distance >= 1) moved++;
    return { nodeId: candidate.p.nodeId, x: candidate.best.x / W, y: candidate.best.y / H };
  });
  // Snapping must keep nodes distinguishable.
  const ok = out.every((a, i) =>
    out.slice(i + 1).every((b) => Math.hypot((a.x - b.x) * W, (a.y - b.y) * H) > gap * 0.5),
  );
  return ok ? { positions: out, moved } : { positions, moved: 0 };
}
