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

const SHAPES = ['sphere', 'box', 'cylinder', 'torus', 'arrow', 'tube', 'sheet'];
const COLORS = ['clay', 'sage', 'blue', 'gold', 'violet'];
const vec = (v, lo, hi) => v && [v.x, v.y, v.z].every((n) => Number.isFinite(n) && n >= lo && n <= hi);
const region = (r) =>
  r && [r.x, r.y, r.width, r.height].every(Number.isFinite) && r.x >= 0 && r.y >= 0 && r.width > 0 && r.height > 0 && r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001;
/** Every number a renderer reads is finite and bounded; custom pieces are bounded in count
 * and size. The overlay page builds meshes only from these values. */
function validScene(sc) {
  return Boolean(
    sc &&
      typeof sc === 'object' &&
      ['model', 'height'].includes(sc.kind) &&
      text(sc.title, 80) &&
      text(sc.note, 240) &&
      region(sc.region) &&
      Array.isArray(sc.objects) &&
      sc.objects.length >= 1 &&
      sc.objects.length <= 24 &&
      new Set(sc.objects.map((o) => o?.id)).size === sc.objects.length &&
      sc.objects.every(
        (o) =>
          id(o?.id) &&
          text(o.label, 60) &&
          text(o.detail, 120) &&
          SHAPES.includes(o.shape) &&
          (o.renderStyle === null || (typeof o.renderStyle === 'string' && /^[a-z][a-z-]{0,23}$/.test(o.renderStyle))) &&
          COLORS.includes(o.color) &&
          vec(o.position, -6, 6) &&
          vec(o.size, 0.05, 4.5) &&
          (o.parentId === null || id(o.parentId)) &&
          (o.shell === undefined || typeof o.shell === 'boolean') &&
          (o.rotation === undefined || vec(o.rotation, -180, 180)) &&
          typeof o.visible === 'boolean' &&
          typeof o.highlighted === 'boolean' &&
          (o.selected === undefined || typeof o.selected === 'boolean') &&
          (o.anchor === undefined || point(o.anchor)) &&
          (o.labelAt === undefined || vec(o.labelAt, -8, 8)) &&
          (o.path === undefined || (Array.isArray(o.path) && o.path.length >= 2 && o.path.length <= 12 && o.path.every((p) => vec(p, -6, 6)))) &&
          (o.geometry === undefined || (Array.isArray(o.geometry) && o.geometry.length <= 12 && JSON.stringify(o.geometry).length <= 24000)) &&
          (o.parameterValues === undefined ||
            (o.parameterValues && typeof o.parameterValues === 'object' && Object.values(o.parameterValues).every((n) => Number.isFinite(n) && n >= 0 && n <= 1))),
      ) &&
      Array.isArray(sc.connections) &&
      sc.connections.length <= 24 &&
      sc.connections.every(
        (c) =>
          id(c?.id) &&
          id(c.from) &&
          id(c.to) &&
          c.from !== c.to &&
          sc.objects.some((o) => o.id === c.from) &&
          sc.objects.some((o) => o.id === c.to) &&
          text(c.label, 60) &&
          ['directed', 'active', 'highlighted'].every((k) => typeof c[k] === 'boolean'),
      ),
  );
}

function validOverlayModel(m) {
  return Boolean(
    m &&
      typeof m === 'object' &&
      typeof m.final === 'boolean' &&
      Number.isFinite(m.radius) &&
      m.radius > 0 &&
      m.radius <= 0.06 &&
      (m.aspect === undefined || (Number.isFinite(m.aspect) && m.aspect >= 1 / 1600 && m.aspect <= 1600)) &&
      Number.isFinite(m.font) &&
      m.font > 0 &&
      m.font <= 0.05 &&
      Array.isArray(m.nodes) &&
      // An answer with no drawing read from the source carries only a 3D scene.
      (m.nodes.length >= 2 || (m.nodes.length === 0 && m.scene !== undefined)) &&
      (m.scene === undefined || validScene(m.scene)) &&
      m.nodes.length <= 12 &&
      m.nodes.every(
        (n) =>
          id(n?.id) &&
          text(n.label, 80) &&
          point(n) &&
          STATUS.includes(n.status) &&
          (n.distance === null || (Number.isFinite(n.distance) && n.distance >= 0 && n.distance <= 11e6)),
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
          (e.fromId === undefined || id(e.fromId)) &&
          (e.toId === undefined || id(e.toId)) &&
          (e.weight === undefined || (Number.isFinite(e.weight) && e.weight >= 0 && e.weight <= 1e6)) &&
          TONE.includes(e.tone),
      ) &&
      // Ids key the drawing (and the 3D scene's objects), so each must be distinct.
      new Set(m.nodes.map((n) => n.id)).size === m.nodes.length &&
      new Set(m.edges.map((e) => e.id)).size === m.edges.length &&
      m.edges.every((e) => e.fromId === undefined || e.fromId !== e.toId) &&
      (m.lift === undefined || (typeof m.lift === 'object' && m.lift !== null && m.nodes.some((n) => n.id === m.lift.source))) &&
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
      (m.lift === undefined ||
        (m.lift &&
          typeof m.lift === 'object' &&
          typeof m.lift.directed === 'boolean' &&
          id(m.lift.source) &&
          (m.lift.goal === null || id(m.lift.goal)) &&
          Number.isFinite(m.lift.maxDistance) &&
          m.lift.maxDistance >= 1e-300 &&
          m.lift.maxDistance <= 11e6 &&
          ['cost', 'edges'].includes(m.lift.unit))) &&
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

/** Normalized source region including nodes and arc/cost centers, padded in capture pixels. */
function overlayRegion(m) {
  // A scene-only model's region is the area its sheet lifts from.
  if (!m.nodes.length) return m.scene.region;
  const xs = [...m.nodes.map((n) => n.x), ...m.edges.map((e) => e.center.x)],
    ys = [...m.nodes.map((n) => n.y), ...m.edges.map((e) => e.center.y)],
    padX = m.radius * 1.5, padY = padX / (m.aspect ?? 1);
  const x = Math.max(0, Math.min(...xs) - padX),
    y = Math.max(0, Math.min(...ys) - padY);
  return {
    x,
    y,
    width: Math.min(1, Math.max(...xs) + padX) - x,
    height: Math.min(1, Math.max(...ys) + padY) - y,
  };
}

/** True when the graph region of a fresh capture still matches the original snapshot.
 * Compares decoded pixels only inside the region, so a changing clock or a moved panel
 * elsewhere on the display does not block the overlay; a scrolled or changed slide does. */
function regionMatches(nativeImage, originalDataUrl, freshDataUrl, region, tolerance = 6) {
  const a = nativeImage.createFromDataURL(originalDataUrl);
  let b = nativeImage.createFromDataURL(freshDataUrl);
  const sa = a.getSize();
  let sb = b.getSize();
  if (!sa.width || !sb.width) return false;
  // A capture can land on the other side of the snapshot size limit and be scaled once more
  // than the original; compare at the original's size if the shape is the same.
  if ((sa.width !== sb.width || sa.height !== sb.height) && Math.abs(sa.width / sa.height - sb.width / sb.height) < 0.01) {
    b = b.resize({ width: sa.width, height: sa.height });
    sb = b.getSize();
  }
  if (sa.width !== sb.width || sa.height !== sb.height) return false;
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

/** Region of the slide that lifts as a sheet in 3D: the nodes and the drawn arcs, padded to
 * include the printed node circles. Mirrors sheetRegion in lift-geometry.mjs. */
function sheetRegion(m) {
  if (m.scene && !m.nodes.length) return m.scene.region;
  const nodePad = m.radius * 1.8;
  const edgePad = m.aspect === undefined ? nodePad : Math.max(m.font * 1.5, m.radius * 0.6);
  const aspect = m.aspect ?? 1;
  const xs = [...m.nodes.flatMap((n) => [n.x - nodePad, n.x + nodePad]), ...m.edges.flatMap((e) => [e.center.x - edgePad, e.center.x + edgePad])];
  const ys = [...m.nodes.flatMap((n) => [n.y - nodePad / aspect, n.y + nodePad / aspect]), ...m.edges.flatMap((e) => [e.center.y - edgePad / aspect, e.center.y + edgePad / aspect])];
  const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys));
  return { x, y, width: Math.min(1, Math.max(...xs)) - x, height: Math.min(1, Math.max(...ys)) - y };
}

/** Crops a capture to a normalized region, as a JPEG data URL for the 3D sheet. */
function cropCapture(nativeImage, dataUrl, region) {
  const image = nativeImage.createFromDataURL(dataUrl), size = image.getSize();
  if (!size.width || !size.height) throw Error('Empty capture');
  const rect = {
    x: Math.floor(region.x * size.width),
    y: Math.floor(region.y * size.height),
    width: Math.max(1, Math.floor(region.width * size.width)),
    height: Math.max(1, Math.floor(region.height * size.height)),
  };
  return `data:image/jpeg;base64,${image.crop(rect).toJPEG(88).toString('base64')}`;
}

module.exports = { validOverlayModel, overlayRegion, regionMatches, sheetRegion, cropCapture };
