/** Native guards for drawing Soma's checked search over the real display. Hosted content
 * may only describe shapes in normalized capture coordinates; it cannot capture, move
 * windows or address another display. */
const unit = (n) => Number.isFinite(n) && n >= -0.05 && n <= 1.05;
const point = (p) => p && unit(p.x) && unit(p.y);
// An arc's control point can sit well outside the capture when its label is near an edge.
const control = (p) => p && [p.x, p.y].every((n) => Number.isFinite(n) && n >= -1 && n <= 2);
const text = (s, max) => typeof s === 'string' && s.length <= max;
const id = (s) => typeof s === 'string' && /^[A-Za-z0-9_.:-]{1,48}$/.test(s);
const STATUS = ['current', 'settled', 'waiting', 'unreached'];
const TONE = ['path', 'relaxed', 'tree', 'struck', 'cut', 'idle'];
const TAG_TONE = ['settled', 'current', 'tentative', 'equation', 'route'];

function validOverlayModel(m) {
  return Boolean(
    m &&
      typeof m === 'object' &&
      typeof m.final === 'boolean' &&
      Number.isFinite(m.radius) &&
      m.radius > 0 &&
      m.radius <= 0.06 &&
      Number.isFinite(m.font) &&
      m.font > 0 &&
      m.font <= 0.05 &&
      Array.isArray(m.nodes) &&
      m.nodes.length >= 2 &&
      m.nodes.length <= 12 &&
      m.nodes.every(
        (n) =>
          id(n?.id) &&
          text(n.label, 80) &&
          point(n) &&
          STATUS.includes(n.status) &&
          (n.distance === null || (Number.isFinite(n.distance) && Math.abs(n.distance) <= 1e7)),
      ) &&
      Array.isArray(m.edges) &&
      m.edges.length <= 24 &&
      m.edges.every(
        (e) =>
          id(e?.id) &&
          text(e.label, 220) &&
          point(e.from) &&
          control(e.control) &&
          point(e.to) &&
          point(e.center) &&
          (e.strike === undefined || point(e.strike)) &&
          TONE.includes(e.tone),
      ) &&
      Array.isArray(m.weights) &&
      m.weights.length <= 24 &&
      m.weights.every((w) => id(w?.edgeId) && point(w) && text(w.text, 24)) &&
      Array.isArray(m.tags) &&
      m.tags.length <= 12 &&
      m.tags.every(
        (t) => text(t?.id, 60) && text(t.text, 200) && TAG_TONE.includes(t.tone) && point(t) && point(t.anchor) && typeof t.curved === 'boolean' && (t.quiet === undefined || typeof t.quiet === 'boolean'),
      ) &&
      Array.isArray(m.callouts) &&
      m.callouts.length <= 6 &&
      m.callouts.every(
        (c) =>
          id(c?.id) &&
          text(c.label, 100) &&
          [c.x, c.y, c.width, c.height].every(Number.isFinite) &&
          c.x >= 0 &&
          c.y >= 0 &&
          c.width > 0 &&
          c.height > 0 &&
          c.x + c.width <= 1.000001 &&
          c.y + c.height <= 1.000001,
      ) &&
      (m.caption === null ||
        (m.caption &&
          text(m.caption.text, 400) &&
          text(m.caption.stepLabel, 60) &&
          point(m.caption) &&
          Number.isFinite(m.caption.font) &&
          m.caption.font > 0 &&
          m.caption.font <= 0.05 &&
          ['top', 'bottom'].includes(m.caption.anchor))),
  );
}

/** Normalized bounding box of the drawn graph, padded by the ring radius. */
function overlayRegion(m) {
  const xs = m.nodes.map((n) => n.x),
    ys = m.nodes.map((n) => n.y),
    pad = m.radius * 1.5;
  const x = Math.max(0, Math.min(...xs) - pad),
    y = Math.max(0, Math.min(...ys) - pad);
  return {
    x,
    y,
    width: Math.min(1, Math.max(...xs) + pad) - x,
    height: Math.min(1, Math.max(...ys) + pad) - y,
  };
}

/** True when the graph region of a fresh capture still matches the original snapshot.
 * Compares decoded pixels only inside the region, so a changing clock or a moved panel
 * elsewhere on the display does not block the overlay; a scrolled or changed slide does. */
function regionMatches(nativeImage, originalDataUrl, freshDataUrl, region, tolerance = 6) {
  const a = nativeImage.createFromDataURL(originalDataUrl),
    b = nativeImage.createFromDataURL(freshDataUrl);
  const sa = a.getSize(),
    sb = b.getSize();
  if (!sa.width || sa.width !== sb.width || sa.height !== sb.height) return false;
  const rect = {
    x: Math.floor(region.x * sa.width),
    y: Math.floor(region.y * sa.height),
    width: Math.max(1, Math.floor(region.width * sa.width)),
    height: Math.max(1, Math.floor(region.height * sa.height)),
  };
  const pa = a.crop(rect).toBitmap(),
    pb = b.crop(rect).toBitmap();
  if (pa.length !== pb.length || !pa.length) return false;
  let total = 0;
  for (let i = 0; i < pa.length; i += 4)
    total += Math.abs(pa[i] - pb[i]) + Math.abs(pa[i + 1] - pb[i + 1]) + Math.abs(pa[i + 2] - pb[i + 2]);
  return total / ((pa.length / 4) * 3) <= tolerance;
}

module.exports = { validOverlayModel, overlayRegion, regionMatches };
