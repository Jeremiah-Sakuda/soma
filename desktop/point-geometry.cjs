// Pure geometry in display points. No screenshots, pointer paths or raw positions are persisted.
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function selectFocus(samples, bounds) {
  if (
    !Array.isArray(samples) ||
    !samples.length ||
    !bounds ||
    !Number.isFinite(bounds.width) ||
    !Number.isFinite(bounds.height) ||
    bounds.width <= 0 ||
    bounds.height <= 0
  )
    throw Error('No pointing context');
  const points = samples
    .slice(-192)
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (
    !points.length ||
    points.some(
      (p) =>
        p.x < bounds.x ||
        p.y < bounds.y ||
        p.x > bounds.x + bounds.width ||
        p.y > bounds.y + bounds.height,
    )
  )
    throw Error('Keep the gesture on one display');
  const last = points.at(-1);
  let chosen = null;
  for (let begin = Math.max(0, points.length - 128); begin <= points.length - 8; begin++) {
    const path = points.slice(begin),
      xs = path.map((p) => p.x),
      ys = path.map((p) => p.y),
      x = Math.min(...xs),
      y = Math.min(...ys),
      width = Math.max(...xs) - x,
      height = Math.max(...ys) - y;
    if (width < 24 || height < 24) continue;
    const diagonal = Math.hypot(width, height),
      closed =
        Math.hypot(path[0].x - last.x, path[0].y - last.y) <= Math.max(16, diagonal * 0.25);
    let area = 0,
      length = 0;
    for (let i = 0; i < path.length; i++) {
      const a = path[i],
        b = path[(i + 1) % path.length];
      area += a.x * b.y - b.x * a.y;
      if (i + 1 < path.length) length += Math.hypot(a.x - b.x, a.y - b.y);
    }
    if (
      closed &&
      Math.abs(area) / 2 >= width * height * 0.35 &&
      length >= diagonal * 1.8 &&
      (!chosen || width * height > chosen.width * chosen.height)
    )
      chosen = { x, y, width, height };
  }
  const box = chosen ?? { x: last.x - 42, y: last.y - 32, width: 84, height: 64 },
    pad = chosen ? Math.max(6, Math.min(box.width, box.height) * 0.06) : 0;
  const left = clamp(box.x - pad, bounds.x, bounds.x + bounds.width - 1),
    top = clamp(box.y - pad, bounds.y, bounds.y + bounds.height - 1),
    right = clamp(box.x + box.width + pad, left + 1, bounds.x + bounds.width),
    bottom = clamp(box.y + box.height + pad, top + 1, bounds.y + bounds.height);
  return {
    kind: chosen ? 'circle' : 'point',
    region: {
      x: (left - bounds.x) / bounds.width,
      y: (top - bounds.y) / bounds.height,
      width: (right - left) / bounds.width,
      height: (bottom - top) / bounds.height,
    },
  };
}
function pointPanelBounds(area, focus) {
  const width = Math.min(620, area.width),
    height = Math.min(900, area.height);
  return {
    x: focus.region.x + focus.region.width / 2 > 0.5 ? area.x : area.x + area.width - width,
    y: area.y,
    width,
    height,
  };
}
module.exports = { selectFocus, pointPanelBounds };
