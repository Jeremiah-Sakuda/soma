// Lifts Soma's checked search off the learner's slide in 3D, drawn over the real display.
// The graph's region of the learner's own capture peels up as a sheet hinged on its bottom
// edge; each node rises on a pillar to its checked distance and each connection becomes a
// string as long as its cost (taut on shortest routes, slack by the difference elsewhere).
// A ruler at the back of the sheet reads off the heights. Bundled into point-overlay-3d.js;
// exposes window.SomaLift.
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  SphereGeometry,
  CylinderGeometry,
  ConeGeometry,
  TorusGeometry,
  RingGeometry,
  CircleGeometry,
  PlaneGeometry,
  TubeGeometry,
  BufferGeometry,
  Float32BufferAttribute,
  CatmullRomCurve3,
  Vector3,
  Quaternion,
  Color,
  MeshPhysicalMaterial,
  MeshBasicMaterial,
  LineBasicMaterial,
  LineDashedMaterial,
  Line,
  LineLoop,
  HemisphereLight,
  DirectionalLight,
  CanvasTexture,
  TextureLoader,
  SRGBColorSpace,
  DoubleSide,
} from 'three';
import {
  cameraDistance,
  liftLayout,
  sagDepth,
  stringPoints,
  easeInOut,
  clamp01,
  riseAt,
  approach,
  fmt,
  separateLabels,
} from './lift-geometry.mjs';

const FOV = 28;
// Steep enough that height on screen reads as height, not as depth into the slide: the
// sheet foreshortens to about a third of its height while a node's rise keeps nearly all.
const TILT = (70 * Math.PI) / 180;
// Turned once lifted, so a near node does not hide one behind it on the slide.
const BASE_YAW = -0.26;
const ENTER_MS = 2400;
const EXIT_MS = 1000;
// A slow turn shows the depth, then stops so the scene can rest (and stop rendering).
const SWAY_MS = 9000;
// A test harness may drive the clock to capture exact frames.
const clock = () => (typeof window.__liftNow === 'function' ? window.__liftNow() : performance.now());
const COLOR = {
  source: 0xf2b632,
  settled: 0x1f9e78,
  current: 0xff7a3d,
  waiting: 0x9fb4c4,
  path: 0xff5a3c,
  taut: 0xf2a93b,
  slack: 0x8a94a6,
  tentative: 0xa9b8c6,
  pull: 0xd63bd1,
  cut: 0xe03b2c,
  ruler: 0x6f685c,
  ghost: 0x64748b,
  removed: 0xb45454,
};
// How long a changed distance keeps its old height on show.
const CHANGE_S = 2.5;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let s = null;

function radialTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, inner);
  grad.addColorStop(1, outer);
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
/** Alpha map with softened edges, so the lifted sheet has no hard seam. */
function vignette() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.filter = 'blur(10px)';
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(18, 18, 220, 220, 26);
  g.fill();
  return new CanvasTexture(c);
}
/** The slide's paper colour, from the brightest corner of the captured region. */
function paperColour(image) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(image, 0, 0, 16, 16);
    const data = g.getImageData(0, 0, 16, 16).data;
    const corners = [0, 15, 240, 255].map((i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2], data[i * 4 + 3]]).filter((p) => p[3] > 200);
    if (!corners.length) return new Color(0xffffff);
    const best = corners.sort((a, b) => b[0] + b[1] + b[2] - (a[0] + a[1] + a[2]))[0];
    return new Color().setRGB(best[0] / 255, best[1] / 255, best[2] / 255, SRGBColorSpace);
  } catch {
    return new Color(0xffffff);
  }
}
function tag(className) {
  const el = document.createElement('div');
  el.className = `lift-tag ${className}`;
  s.labels.appendChild(el);
  return el;
}
function material(color, extra = {}) {
  return new MeshPhysicalMaterial({ color, roughness: 0.3, metalness: 0.05, clearcoat: 0.85, clearcoatRoughness: 0.18, transparent: true, ...extra });
}
/** A node keeps its colour; being current is shown by a halo, not a recolour. */
function nodeColor(n) {
  if (n.source) return COLOR.source;
  if (n.tentative) return COLOR.waiting;
  return COLOR.settled;
}
function disposeObject(o) {
  o.parent?.remove(o);
  o.geometry?.dispose();
  if (o.material) {
    // The shadow texture is shared by every node; it goes with the scene.
    if (o.material.map !== s?.shadowTex) o.material.map?.dispose();
    o.material.alphaMap?.dispose();
    o.material.dispose();
  }
}

function build(frame) {
  const canvas = document.createElement('canvas');
  canvas.id = 'lift-canvas';
  const labels = document.createElement('div');
  labels.id = 'lift-labels';
  // The panel carries the same steps in words; these labels are visual only.
  labels.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
    // Full-display transparent canvas: skip multisampling where the pixel ratio already
    // smooths edges, and cap very large surfaces.
    const dpr = Math.min(2, devicePixelRatio || 1);
    const ratio = frame.width * frame.height * dpr * dpr > 9e6 ? Math.max(1, Math.sqrt(9e6 / (frame.width * frame.height))) : dpr;
    renderer = new WebGLRenderer({ canvas, alpha: true, antialias: ratio < 1.75, premultipliedAlpha: true, powerPreference: 'low-power' });
    renderer.setPixelRatio(ratio);
  } catch (error) {
    canvas.remove();
    throw error;
  }
  document.body.append(canvas, labels);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 100000);
  scene.add(new HemisphereLight(0xffffff, 0x6d6252, 1.5));
  const key = new DirectionalLight(0xffffff, 1.7);
  const rim = new DirectionalLight(0xffe2c4, 0.7);
  scene.add(key, rim);
  const hinge = new Group(), yaw = new Group(), content = new Group();
  hinge.add(yaw);
  yaw.add(content);
  scene.add(hinge);
  s = {
    canvas, labels, renderer, scene, camera, key, rim, hinge, yaw, content,
    nodes: new Map(), edges: new Map(), ticks: [],
    shadowTex: radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'),
    t: 0, mode: 'enter', started: clock(), last: clock(), idleSince: null, sway: 0, pending: [],
    frame: null, layout: null, model: null, sheet: null, sheetKey: null, sheetReady: false, onExit: null, raf: 0, compiled: false,
  };
  s.onLost = (event) => {
    event.preventDefault();
    fail();
  };
  canvas.addEventListener('webglcontextlost', s.onLost);
  resize(frame);
}
function resize(frame) {
  if (s.frame && s.frame.width === frame.width && s.frame.height === frame.height && s.frame.dx === frame.dx && s.frame.dy === frame.dy) return;
  s.frame = { ...frame };
  Object.assign(s.canvas.style, { left: frame.dx + 'px', top: frame.dy + 'px', width: frame.width + 'px', height: frame.height + 'px' });
  s.renderer.setSize(frame.width, frame.height, false);
  const d = cameraDistance(frame.height, FOV);
  s.camera.aspect = frame.width / frame.height;
  s.camera.near = d * 0.05;
  s.camera.far = d * 6;
  s.camera.position.set(0, 0, d);
  s.camera.updateProjectionMatrix();
  s.key.position.set(-frame.width * 0.4, frame.height * 0.7, d);
  s.rim.position.set(frame.width * 0.5, -frame.height * 0.3, d * 0.3);
  s.sheetKey = null;
}

/** The sheet, the paper-coloured cover where it came from, its shadow and the ruler. */
function placeSheet(layout, sheet) {
  const key = `${sheet ? `${sheet.dataUrl.length}:${sheet.dataUrl.slice(-48)}` : 'none'}:${s.frame.width}x${s.frame.height}`;
  if (s.sheetKey === key) return;
  if (s.sheet) for (const o of Object.values(s.sheet)) disposeObject(o);
  for (const t of s.ticks) {
    disposeObject(t.mesh);
    t.label.remove();
  }
  s.ticks = [];
  s.tickKey = null;
  s.sheetKey = key;
  s.sheetReady = false;
  // Placed where the learner's slide shows this exact region, so a flat sheet is the slide
  // itself and only reveals itself as it lifts.
  const region = sheet?.region ?? layout.region;
  const r = layout.radius;
  const f = s.frame,
    w = region.width * f.width,
    h = region.height * f.height,
    x = region.x * f.width + w / 2 - f.width / 2,
    y = f.height / 2 - (region.y * f.height + h / 2);
  const paper = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: DoubleSide, alphaMap: vignette(), opacity: 0 });
  const coverMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  if (sheet) {
    new TextureLoader().load(
      sheet.dataUrl,
      (texture) => {
        // Disposed or replaced while loading.
        if (!s || s.sheet?.paper.material !== paper) return texture.dispose();
        texture.colorSpace = SRGBColorSpace;
        paper.map = texture;
        paper.needsUpdate = true;
        coverMat.color.copy(paperColour(texture.image));
        s.sheetReady = true;
        wake();
      },
      undefined,
      // Without the slide's own region nothing can cover the original honestly: stay flat.
      () => {
        if (s && s.sheet?.paper.material === paper) fail('sheet');
      },
    );
  } else {
    // No capture to lift: a plain sheet, and nothing painted over the slide.
    paper.color = new Color(0xf7f3ea);
    s.sheetReady = true;
  }
  s.hasCover = Boolean(sheet);
  const plane = new Mesh(new PlaneGeometry(w, h), paper);
  plane.position.set(x, y, 0);
  const edge = new LineLoop(
    new BufferGeometry().setFromPoints([
      new Vector3(x - w / 2, y - h / 2, 0.5), new Vector3(x + w / 2, y - h / 2, 0.5),
      new Vector3(x + w / 2, y + h / 2, 0.5), new Vector3(x - w / 2, y + h / 2, 0.5),
    ]),
    new LineBasicMaterial({ color: 0x8c8577, transparent: true, opacity: 0 }),
  );
  // The cover hides the original graph only once the sheet carrying it is ready.
  const cover = new Mesh(new PlaneGeometry(w, h), coverMat);
  cover.position.set(x, y, -2);
  cover.renderOrder = -2;
  // A tight shadow just below and right of the lifted sheet, not a haze across the slide.
  const floor = new Mesh(new PlaneGeometry(w * 0.95, h * 0.45), new MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.5)', 'rgba(0,0,0,0)'), transparent: true, opacity: 0, depthWrite: false }));
  floor.position.set(x + r * 0.4, y - h * 0.42, -1);
  floor.renderOrder = -1;
  // A ruler at the front-left corner of the sheet reads off each node's height. At the
  // front it stands lowest on screen, so even the tallest estimate keeps clear of the slide
  // above the graph.
  const rulerAt = { x: x - w / 2 + r * 1.2, y: y - h / 2 + r * 1.2 };
  const ruler = new Mesh(new CylinderGeometry(r * 0.05, r * 0.05, 1, 8), new MeshBasicMaterial({ color: COLOR.ruler, transparent: true, opacity: 0 }));
  ruler.rotation.x = Math.PI / 2;
  ruler.position.set(rulerAt.x, rulerAt.y, 0);
  const level = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]), new LineDashedMaterial({ color: COLOR.current, dashSize: r * 0.35, gapSize: r * 0.25, transparent: true, opacity: 0 }));
  s.scene.add(cover, floor);
  s.content.add(plane, edge, ruler, level);
  s.sheet = { paper: plane, edge, cover, floor, ruler, level };
  s.rulerAt = rulerAt;
  s.hinge.position.set(x, y - h / 2, 0);
  s.content.position.set(-x, -(y - h / 2), 0);
}

/** Even steps for the ruler (1, 2, 5, 10, …) giving at most about twelve ticks. */
function tickStep(top) {
  const raw = Math.max(1, top) / 12, power = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].map((m) => m * power).find((step) => step >= raw);
}
/** Evenly spaced ticks over the whole search's range, the same at every step, so the ruler
 * reads as a fixed scale from the first step. */
function syncTicks(layout) {
  const shown = layout.maxDistance;
  const step = tickStep(shown), values = [];
  for (let value = 0; value <= shown + 1e-9; value += step) values.push(Number(value.toFixed(6)));
  const key = values.join(',');
  if (s.tickKey === key) return;
  s.tickKey = key;
  for (const t of s.ticks) {
    disposeObject(t.mesh);
    t.label.remove();
  }
  const r = layout.radius;
  s.ticks = values.map((value) => {
    const mesh = new Mesh(new CylinderGeometry(r * 0.04, r * 0.04, r * 0.7, 6), new MeshBasicMaterial({ color: COLOR.ruler, transparent: true, opacity: 0 }));
    mesh.rotation.z = Math.PI / 2;
    s.content.add(mesh);
    const label = tag('is-tick');
    label.textContent = fmt(value);
    return { value, mesh, label };
  });
}

function syncNodes(layout) {
  // A new step (any distance or status changed) retires old change labels it did not cause.
  const signature = layout.nodes.map((n) => `${n.id}:${n.distance}:${n.status}`).join('|');
  const newStep = signature !== s.signature;
  s.signature = signature;
  const r = layout.radius;
  const seen = new Set();
  const now = clock();
  for (const n of layout.nodes) {
    seen.add(n.id);
    let v = s.nodes.get(n.id);
    if (!v) {
      const sphere = new Mesh(new SphereGeometry(r * 0.78, 40, 24), material(nodeColor(n), { emissive: new Color(COLOR.current), emissiveIntensity: 0 }));
      const halo = new Mesh(new TorusGeometry(r * 1.12, r * 0.09, 12, 48), new MeshBasicMaterial({ color: COLOR.current, transparent: true, opacity: 0 }));
      // An outline where the node was, turned to face the viewer: "was here", not a second node.
      const ghost = new Mesh(new TorusGeometry(r * 0.78, r * 0.05, 8, 40), new MeshBasicMaterial({ color: COLOR.ghost, transparent: true, opacity: 0, depthWrite: false }));
      // From the old height to the new while a distance changes.
      const trail = new Line(new BufferGeometry().setFromPoints([new Vector3(), new Vector3()]), new LineDashedMaterial({ color: COLOR.ghost, dashSize: r * 0.25, gapSize: r * 0.18, transparent: true, opacity: 0 }));
      const pillar = new Mesh(new CylinderGeometry(r * 0.055, r * 0.055, 1, 10), new MeshBasicMaterial({ color: nodeColor(n), transparent: true, opacity: 0.6 }));
      pillar.rotation.x = Math.PI / 2;
      const foot = new Mesh(new RingGeometry(r * 0.95, r * 1.15, 48), new MeshBasicMaterial({ color: nodeColor(n), transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }));
      const shadow = new Mesh(new CircleGeometry(r * 1.2, 32), new MeshBasicMaterial({ map: s.shadowTex, transparent: true, opacity: 0, depthWrite: false }));
      for (const o of [shadow, foot, pillar, ghost, trail, sphere, halo]) s.content.add(o);
      sphere.renderOrder = pillar.renderOrder = halo.renderOrder = 3;
      v = { sphere, halo, ghost, trail, pillar, foot, shadow, notches: [], label: tag('is-node'), h: 0, target: 0, change: null, pulseAt: -Infinity, data: null };
      s.nodes.set(n.id, v);
    }
    // A distance that changes (an estimate coming down, or a cut raising a route) leaves a
    // ghost at the old height, so the change reads.
    if (v.data && v.data.distance !== null && n.distance !== null && Math.abs(n.distance - v.data.distance) > 1e-9)
      v.change = { from: v.data.distance, sign: v.data.tentative ? '≤' : '=', height: v.h, at: now };
    // Settled now: its label says so at once rather than replaying the last change.
    else if (v.data?.tentative && !n.tentative) v.change = null;
    else if (newStep) v.change = null;
    // The node this step settles pulses once.
    if (n.status === 'current' && v.data?.status !== 'current') v.pulseAt = now;
    v.data = n;
    v.target = n.height;
    const color = nodeColor(n);
    v.sphere.material.color.setHex(color);
    v.pillar.material.color.setHex(color);
    v.foot.material.color.setHex(n.status === 'current' ? COLOR.current : color);
    for (const o of [v.sphere, v.halo, v.ghost, v.pillar, v.foot, v.shadow]) o.position.set(n.x, n.y, o.position.z);
    if (n.distance === null) v.change = null;
    v.foot.position.z = 0.6;
    v.shadow.position.z = 0.3;
    const lifted = n.distance !== null;
    v.sphere.visible = v.pillar.visible = lifted;
    // A notch on the stem at each whole unit, so a height can be counted where perspective
    // makes a near, tall node look no higher than a far, short one.
    const units = lifted && layout.maxDistance <= 20 && layout.scale >= 9 ? Math.floor(Math.min(n.distance, layout.maxDistance) + 1e-9) : 0;
    notchGeometry ??= new TorusGeometry(r * 0.13, r * 0.03, 6, 20);
    while (v.notches.length < units) {
      const m = new Mesh(notchGeometry, new MeshBasicMaterial({ color, transparent: true, opacity: 0 }));
      m.userData.sharedGeometry = true;
      m.renderOrder = 3;
      s.content.add(m);
      v.notches.push(m);
    }
    while (v.notches.length > units) {
      const m = v.notches.pop();
      s.content.remove(m);
      m.material.dispose();
    }
    v.notches.forEach((m, i) => {
      m.userData.z = layout.base + (i + 1) * layout.scale;
      m.position.set(n.x, n.y, m.userData.z);
      m.material.color.setHex(color);
    });
    // Styled as an estimate only when it is one: the start's 0 is exact while still queued.
    const look = n.status === 'waiting' && !n.tentative ? 'settled' : n.status;
    v.label.className = `lift-tag is-node is-${look}${n.source ? ' is-source' : ''}${n.goal ? ' is-goal' : ''}`;
  }
  for (const [id, v] of s.nodes)
    if (!seen.has(id)) {
      for (const o of [v.sphere, v.halo, v.ghost, v.trail, v.pillar, v.foot, v.shadow]) disposeObject(o);
      for (const m of v.notches) {
        s.content.remove(m);
        m.material.dispose();
      }
      v.label.remove();
      s.nodes.delete(id);
    }
}

/** Moves a two-point dashed line in place (no new GPU buffers per frame). */
function setSegment(line, a, b) {
  const geo = line.geometry, pos = geo.attributes.position;
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  let dist = geo.attributes.lineDistance;
  if (!dist) geo.setAttribute('lineDistance', (dist = new Float32BufferAttribute([0, 0], 1)));
  dist.setX(1, Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z));
  dist.needsUpdate = true;
  geo.computeBoundingSphere();
}

function caption(model, layout) {
  let box = document.getElementById('lift-caption');
  if (!box) {
    box = document.createElement('div');
    box.id = 'lift-caption';
    box.setAttribute('aria-hidden', 'true');
    const legend = document.createElement('div');
    legend.className = 'lift-legend';
    for (const [cls, text] of [['start', ''], ['path', 'shortest route'], ['taut', 'taut: also shortest'], ['slack', 'slack: longer by n'], ['estimate', 'estimate, may drop'], ['ghost', 'old height']]) {
      const item = document.createElement('span');
      const swatch = document.createElement('i');
      swatch.className = `is-${cls}`;
      item.append(swatch, text);
      if (cls === 'start') box.startItem = item;
      legend.appendChild(item);
    }
    box.append(document.createElement('strong'), document.createElement('span'), document.createElement('small'), legend);
    document.body.appendChild(box);
  }
  const [title, body, note] = box.children;
  const source = layout.nodes.find((n) => n.source)?.label ?? 'the start';
  // A follow-up can start from another node.
  box.startItem.lastChild.textContent = `start (${source})`;
  title.textContent = model.caption?.stepLabel ?? 'Lifted off your slide';
  body.textContent = model.caption?.text ?? '';
  note.textContent = `Height is the checked ${layout.unit === 'edges' ? 'number of edges' : 'distance'} from ${source}.`;
  // Anchored like the flat caption, by the edge it grows away from, so a longer caption
  // never makes the card jump between steps.
  const f = s.frame, c = model.caption;
  box.style.left = Math.max(8, Math.min((c ? c.x * f.width : 24) + f.dx - 20, innerWidth - box.offsetWidth - 8)) + 'px';
  if (c && c.anchor === 'top') {
    box.style.bottom = '';
    box.style.top = Math.max(8, Math.min(c.y * f.height + f.dy, innerHeight - box.offsetHeight - 12)) + 'px';
  } else {
    box.style.top = '';
    box.style.bottom = Math.max(12, innerHeight - (f.dy + f.height) + 12) + 'px';
  }
}

function project(local, out = new Vector3()) {
  out.copy(local);
  s.content.localToWorld(out);
  out.project(s.camera);
  return { x: ((out.x + 1) / 2) * s.frame.width + s.frame.dx, y: ((1 - out.y) / 2) * s.frame.height + s.frame.dy, behind: out.z > 1 };
}
const scratch = new Vector3();
/** Queues a label: `bottom` sits above its point; `side` sits beside a string, off its line. */
function placeLabel(el, local, opacity, priority, side = null, edge = false) {
  const p = project(local, scratch);
  let { x, y } = p;
  if (side) {
    const a = project(side[0], new Vector3()), b = project(side[1], new Vector3());
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    x += nx * 14;
    y += ny * 14 + 9;
  }
  s.pending.push({ el, x, y, opacity: p.behind ? 0 : opacity, priority, edge });
}
/** Writes this frame's label positions, nudging overlapping ones apart. */
function flushLabels() {
  const shown = s.pending.filter((l) => l.opacity > 0.05 && l.el.textContent);
  for (const l of s.pending) if (!shown.includes(l)) l.el.style.opacity = 0;
  for (const l of shown)
    if (l.el._text !== l.el.textContent || l.el._class !== l.el.className) {
      l.el._text = l.el.textContent;
      l.el._class = l.el.className;
      l.el._w = l.el.offsetWidth;
      l.el._h = l.el.offsetHeight;
    }
  const ys = separateLabels(shown.map((l) => ({ x: l.x, y: l.y, w: l.el._w, h: l.el._h, priority: l.priority })));
  shown.forEach((l, i) => {
    // A string's label pushed far from its string would read as another's: hide it instead.
    const strayed = l.edge && Math.abs(ys[i] - l.y) > 26;
    l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${ys[i].toFixed(1)}px) translate(-50%, -100%)`;
    l.el.style.opacity = strayed ? '0' : String(l.opacity);
  });
  s.pending = [];
}

/** The point along a string (by index) for its label: the middle, or the nearest point to it
 * whose label would not sit on a node. */
function labelIndex(points, el) {
  const obstacles = s.obstacles ?? [];
  const w = el._w || 60, h = el._h || 22;
  for (const i of [12, 9, 15, 7, 17, 5, 19]) {
    // Where placeLabel would put this label's box, beside the string.
    const a = project(points[i - 3], new Vector3()), b = project(points[i + 3], new Vector3()), p = project(points[i], scratch);
    let nx = -(b.y - a.y), ny = b.x - a.x;
    const len = Math.hypot(nx, ny) || 1;
    if (ny > 0) [nx, ny] = [-nx, -ny];
    const cx = p.x + (nx / len) * 14, bottom = p.y + (ny / len) * 14 + 9;
    const clear = obstacles.every((o) => {
      const dx = Math.max(cx - w / 2 - o.x, 0, o.x - (cx + w / 2)), dy = Math.max(bottom - h - o.y, 0, o.y - bottom);
      return Math.hypot(dx, dy) > o.r + 3;
    });
    if (clear) return i;
  }
  return 12;
}
function edgeMaterial(kind, tone) {
  if (kind === 'cut') return new MeshBasicMaterial({ color: COLOR.removed, transparent: true });
  if (kind === 'pull') return material(COLOR.pull, { emissive: new Color(COLOR.pull), emissiveIntensity: 0.3 });
  if (tone === 'path') return material(COLOR.path, { emissive: new Color(COLOR.path), emissiveIntensity: 0.35 });
  if (kind === 'tentative') return material(COLOR.tentative, { roughness: 0.6, clearcoat: 0.2, opacity: 0.45 });
  if (kind === 'taut') return material(COLOR.taut, { emissive: new Color(COLOR.taut), emissiveIntensity: 0.12 });
  return material(COLOR.slack, { roughness: 0.55, clearcoat: 0.3, opacity: 0.9 });
}
function tubeGeometry(points, radius) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(p.x, p.y, p.z)));
  return new TubeGeometry(curve, Math.max(8, points.length * 2), radius, 10, false);
}
function tube(points, radius, mat) {
  const mesh = new Mesh(tubeGeometry(points, radius), mat);
  mesh.renderOrder = 2;
  return mesh;
}
/** Reshapes a string's tube without reallocating its GPU buffers (same segment count). */
function reshape(mesh, points, radius) {
  const next = tubeGeometry(points, radius), geo = mesh.geometry;
  for (const name of ['position', 'normal']) {
    geo.attributes[name].array.set(next.attributes[name].array);
    geo.attributes[name].needsUpdate = true;
  }
  geo.computeBoundingSphere();
  next.dispose();
}
const coneGeometry = new Map();
let notchGeometry = null;
/** A small arrowhead near the end of a directed string, pointing along it. */
function arrow(points, radius, mat) {
  if (!coneGeometry.has(radius)) coneGeometry.set(radius, new ConeGeometry(radius * 2.6, radius * 6, 12));
  const cone = new Mesh(coneGeometry.get(radius), mat);
  cone.userData.shared = true;
  return pointArrow(cone, points);
}
function pointArrow(cone, points) {
  const i = Math.floor(points.length * 0.82), p = points[i], q = points[Math.min(points.length - 1, i + 1)];
  cone.position.set(p.x, p.y, p.z);
  cone.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), new Vector3(q.x - p.x, q.y - p.y, q.z - p.z).normalize());
  return cone;
}

/** Strings follow the animated node heights; each is rebuilt only when its shape changes. */
function drawEdges(rise, sheetT) {
  const r = s.layout.radius;
  // During an experiment, strings to nodes off the checked route step back with them.
  const experiment = s.layout.edges.some((e) => e.kind === 'cut');
  const onRoute = new Set(s.layout.edges.filter((e) => e.tone === 'path').flatMap((e) => [e.from, e.to]));
  const keep = new Set();
  for (const e of s.layout.edges) {
    keep.add(e.id);
    let v = s.edges.get(e.id);
    if (!v) {
      v = { meshes: [], label: tag('is-edge'), mat: null, key: '', shape: '' };
      s.edges.set(e.id, v);
    }
    const key = `${e.kind}:${e.tone}`;
    if (v.key !== key) {
      v.mat?.dispose();
      v.mat = edgeMaterial(e.kind, e.tone);
      v.baseOpacity = v.mat.opacity;
      v.key = key;
      // Its meshes carry the old material: build them afresh.
      clearMeshes(v);
      v.label.className = `lift-tag is-edge is-${e.kind}${e.tone === 'path' ? ' is-path' : ''}`;
    }
    const A = s.nodes.get(e.from), B = s.nodes.get(e.to);
    const ra = A.data.distance === null ? 0 : rise(e.from), rb = B.data.distance === null ? 0 : rise(e.to);
    const a = { x: A.data.x, y: A.data.y, z: A.h * ra }, b = { x: B.data.x, y: B.data.y, z: B.h * rb };
    const k = Math.min(ra, rb);
    if (e.kind === 'flat') {
      // Not settled at either end: the connection stays as printed on the sheet.
      clearMeshes(v);
      v.label.textContent = '';
      v.label.style.opacity = 0;
      continue;
    }
    let labelAt, side = null, opacity;
    if (e.kind === 'cut') {
      // Removed: a dashed line on the sheet between the two printed circles.
      if (v.shape !== 'cut') {
        clearMeshes(v);
        const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
        const from = r * 0.95, to = len - r * 0.95, dash = r * 0.4, gap = r * 0.25;
        for (let d = from; d < to; d += dash + gap) {
          const e2 = Math.min(to, d + dash);
          v.meshes.push(tube([{ x: a.x + (dx * d) / len, y: a.y + (dy * d) / len, z: 1 }, { x: a.x + (dx * e2) / len, y: a.y + (dy * e2) / len, z: 1 }], r * 0.07, v.mat));
        }
        for (const m of v.meshes) s.content.add(m);
        v.shape = 'cut';
      }
      v.mat.opacity = sheetT;
      v.label.textContent = `✕ ${A.data.label}–${B.data.label} removed`;
      labelAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: 2 };
      opacity = sheetT;
    } else {
      // Slack hangs by its amount; a string too slack for its height rests on the sheet.
      const sag = sagDepth(Math.max(0, e.slack ?? 0), s.layout.scale, s.layout.tallest, r * 0.45) * k;
      const points = stringPoints(a, b, sag, 24, r * 0.12);
      const shape = `${a.z.toFixed(1)}:${b.z.toFixed(1)}:${sag.toFixed(1)}`;
      if (shape !== v.shape) {
        const radius = r * (e.tone === 'path' ? 0.17 : e.kind === 'taut' || e.kind === 'pull' ? 0.11 : 0.042);
        // While heights glide, the same tube is reshaped in place; a new kind rebuilds it.
        if (v.meshes.length && v.radius === radius && v.directed === e.directed) {
          reshape(v.meshes[0], points, radius);
          if (e.directed) pointArrow(v.meshes[1], points);
        } else {
          clearMeshes(v);
          v.meshes.push(tube(points, radius, v.mat));
          if (e.directed) v.meshes.push(arrow(points, radius, v.mat));
          for (const m of v.meshes) s.content.add(m);
        }
        v.radius = radius;
        v.directed = e.directed;
        v.shape = shape;
      }
      // A string appears as its nodes leave the sheet, so the slide is untouched at first.
      const dim = experiment && e.tone !== 'path' && !(onRoute.has(e.from) && onRoute.has(e.to)) ? 0.35 : 1;
      v.mat.opacity = v.baseOpacity * clamp01(k * 2.5) * dim;
      v.label.textContent = e.label;
      const i = labelIndex(points, v.label);
      labelAt = points[i];
      side = [new Vector3(points[i - 3].x, points[i - 3].y, points[i - 3].z), new Vector3(points[i + 3].x, points[i + 3].y, points[i + 3].z)];
      opacity = clamp01((k - 0.6) / 0.4) * (e.kind === 'tentative' ? 0.8 : 1) * (dim < 1 ? 0.5 : 1);
    }
    const priority = e.kind === 'cut' || e.kind === 'pull' || e.tone === 'path' ? 2 : e.kind === 'slack' ? 1.5 : 1;
    placeLabel(v.label, new Vector3(labelAt.x, labelAt.y, labelAt.z), opacity, priority, side, true);
  }
  for (const [id, v] of s.edges)
    if (!keep.has(id)) {
      clearMeshes(v);
      v.mat?.dispose();
      v.label.remove();
      s.edges.delete(id);
    }
}
function clearMeshes(v) {
  for (const m of v.meshes) {
    s.content.remove(m);
    if (!m.userData.shared) m.geometry.dispose();
  }
  v.meshes = [];
  v.shape = '';
}

function frameLoop() {
  s.raf = 0;
  try {
    if (renderFrame()) s.raf = requestAnimationFrame(frameLoop);
  } catch (error) {
    console.error('Soma 3D lift stopped:', error);
    fail();
  }
}
/** Draws one frame; returns whether anything is still moving. */
function renderFrame() {
  const now = clock();
  const dt = Math.min(0.05, Math.max(0, (now - s.last) / 1000));
  s.last = now;
  const quick = reducedMotion.matches;
  // Reduced motion: no tilt or rise to watch; the lifted scene simply appears.
  if (s.mode === 'enter') s.t = quick ? 1 : clamp01((now - s.started) / ENTER_MS);
  else if (s.mode === 'exit') s.t = quick ? 0 : 1 - clamp01((now - s.started) / EXIT_MS);
  if (s.mode === 'enter' && s.t >= 1) {
    s.mode = 'idle';
    s.idleSince = now;
  }
  const t = s.t;
  // The sheet tilts back with a slight settle past its angle.
  const tiltPhase = clamp01(t / 0.55);
  const tilt = easeInOut(tiltPhase) + (s.mode === 'exit' ? 0 : 0.035 * Math.sin(Math.PI * clamp01((tiltPhase - 0.7) / 0.3)));
  s.hinge.rotation.x = -TILT * tilt;
  s.hinge.rotation.z = BASE_YAW * tilt;
  s.hinge.position.z = s.frame.height * 0.035 * tilt;
  const swaying = s.mode === 'idle' && !quick && now - s.idleSince < SWAY_MS;
  s.sway = approach(s.sway, swaying ? 1 : 0, dt, 0.9);
  s.yaw.rotation.z = Math.sin((now - (s.idleSince ?? now)) / 2000) * 0.11 * s.sway;
  const sheetT = clamp01(t / 0.35);
  const sh = s.sheet;
  if (sh) {
    const ready = s.sheetReady;
    // Until the capture's texture is ready, nothing covers the slide.
    // Lifted, the printed graph fades back so the strings and spheres carry the reading.
    sh.paper.material.opacity = ready ? 1 - 0.55 * sheetT : 0;
    sh.cover.material.opacity = ready && s.hasCover ? clamp01(t / 0.06) : 0;
    sh.edge.material.opacity = 0.18 * sheetT;
    sh.floor.material.opacity = 0.3 * tilt;
  }
  // Nodes leave the sheet in order of distance; a change of distance glides.
  const lifted = [...s.nodes.values()].filter((v) => v.data.distance !== null).sort((x, y) => x.data.distance - y.data.distance);
  const rank = new Map(lifted.map((v, i) => [v.data.id, i]));
  const rise = (id) => (quick ? t : clamp01(riseAt(t, rank.get(id) ?? 0, lifted.length)));
  const r = s.layout.radius;
  let moving = s.mode !== 'idle' || s.sway > 0.002;
  const experiment = s.layout.edges.some((e) => e.kind === 'cut');
  const onRoute = new Set(s.layout.edges.filter((e) => e.tone === 'path').flatMap((e) => [e.from, e.to]));
  // Content-space rotation that faces the camera, for outlines drawn flat to the viewer.
  s.content.updateWorldMatrix(true, false);
  const facing = s.content.getWorldQuaternion(new Quaternion()).invert().multiply(s.camera.quaternion);
  let current = null;
  for (const v of s.nodes.values()) {
    v.h = quick ? v.target : approach(v.h, v.target, dt, 0.5);
    if (Math.abs(v.h - v.target) > 0.3) moving = true;
    const k = v.data.distance === null ? 0 : rise(v.data.id);
    const z = Math.max(0, v.h * k);
    v.sphere.position.z = z;
    // A node grows out of its printed circle as it rises, and pulses once as it settles.
    const pulseAge = (now - v.pulseAt) / 400;
    const pulse = !quick && pulseAge >= 0 && pulseAge < 1 ? 0.15 * Math.sin(Math.PI * pulseAge) : 0;
    if (!quick && pulseAge >= 0 && pulseAge < 2.5) moving = true;
    // During an experiment, nodes off the checked route step back so the route reads.
    const dim = experiment && !onRoute.has(v.data.id) ? 0.4 : 1;
    v.sphere.scale.setScalar(Math.max(0.001, clamp01(k * 1.6)) * (1 + pulse));
    v.pillar.scale.y = Math.max(0.001, z);
    v.pillar.position.z = z / 2;
    for (const m of v.notches) {
      // Notches ride up with the node and never show above it while its height glides.
      m.position.z = m.userData.z * k;
      m.visible = m.position.z <= z + 0.5;
      m.scale.setScalar(Math.max(0.001, k));
      m.material.opacity = (v.data.tentative ? 0.4 : 0.85) * clamp01((k - 0.7) / 0.3) * dim;
    }
    v.sphere.material.opacity = (v.data.tentative ? 0.55 : 1) * dim;
    v.pillar.material.opacity = (v.data.tentative ? 0.3 : 0.6) * dim;
    // The node this step settles flashes warm for a moment.
    const flash = !quick && pulseAge >= 0 && pulseAge < 2.5 ? Math.sin((Math.PI * pulseAge) / 2.5) : 0;
    v.sphere.material.emissiveIntensity = 0.55 * flash;
    v.foot.material.opacity = (v.data.distance === null ? 0.25 : 0.7) * sheetT;
    v.shadow.material.opacity = 0.75 * Math.min(1, k) * (1 - Math.min(0.45, z / (s.layout.tallest * 2.5))) * dim;
    const isCurrent = v.data.status === 'current';
    v.halo.position.z = z;
    v.halo.material.opacity = isCurrent ? clamp01(k * 1.6) * (quick ? 0.9 : 0.65 + 0.3 * Math.sin(now / 220) * s.sway + 0.2 * (1 - s.sway)) : 0;
    if (isCurrent) current = { v, z };
    let changing = false;
    if (v.change) {
      const age = (now - v.change.at) / 1000;
      if (age < CHANGE_S) {
        changing = true;
        moving = true;
        const fade = clamp01((CHANGE_S - age) / 0.5);
        v.ghost.position.z = v.change.height * k;
        v.ghost.quaternion.copy(facing);
        v.ghost.material.opacity = 0.6 * fade;
        setSegment(v.trail, { x: v.data.x, y: v.data.y, z: v.change.height * k }, { x: v.data.x, y: v.data.y, z });
        v.trail.material.opacity = 0.9 * fade;
      } else v.change = null;
    }
    if (!changing) v.ghost.material.opacity = v.trail.material.opacity = 0;
    const n = v.data;
    v.label.textContent =
      n.distance === null ? '' : changing ? `${n.label} ${v.change.sign} ${fmt(v.change.from)} → ${fmt(n.distance)}` : `${n.label} ${n.tentative ? '≤' : '='} ${fmt(n.distance)}`;
    v.label.classList.toggle('is-drop', changing);
    const priority = isCurrent || n.goal || changing ? 4 : 3;
    placeLabel(v.label, new Vector3(n.x, n.y, z + r * 1.05), (n.distance === null ? 0 : clamp01((k - 0.5) / 0.5)) * (dim < 1 ? 0.6 : 1), priority);
  }
  // Where each sphere sits on screen, so string labels can keep off them.
  s.obstacles = [...s.nodes.values()]
    .filter((v) => v.sphere.visible && v.sphere.scale.x > 0.2)
    .map((v) => {
      const c = project(v.sphere.position, new Vector3()), e = project(new Vector3(v.sphere.position.x + r * 0.78, v.sphere.position.y, v.sphere.position.z), new Vector3());
      return { x: c.x, y: c.y, r: Math.hypot(e.x - c.x, e.y - c.y) * v.sphere.scale.x };
    });
  // Ruler: appears once the sheet has mostly tilted, ticks at settled heights, and a level
  // line to the current node.
  if (sh) {
    const at = s.rulerAt;
    const top = s.layout.base + s.layout.maxDistance * s.layout.scale + r * 0.6;
    const rulerT = clamp01((t - 0.4) / 0.15);
    sh.ruler.material.opacity = 0.7 * rulerT;
    sh.ruler.scale.y = Math.max(0.001, top);
    sh.ruler.position.set(at.x, at.y, top / 2);
    for (const tick of s.ticks) {
      const z = s.layout.base + tick.value * s.layout.scale;
      tick.mesh.position.set(at.x - r * 0.35, at.y, z);
      tick.mesh.material.opacity = 0.7 * rulerT;
      placeLabel(tick.label, new Vector3(at.x - r * 0.9, at.y, z - r * 0.25), clamp01((t - 0.55) / 0.3), 0.5);
    }
    if (current && current.v.data.distance !== null) {
      setSegment(sh.level, { x: current.v.data.x, y: current.v.data.y, z: current.z }, { x: at.x, y: at.y, z: current.z });
      sh.level.material.opacity = 0.95 * clamp01((t - 0.7) / 0.3);
    } else sh.level.material.opacity = 0;
  }
  drawEdges(rise, sheetT);
  flushLabels();
  if (!s.compiled) {
    s.renderer.compile(s.scene, s.camera);
    s.compiled = true;
  }
  s.renderer.render(s.scene, s.camera);
  if (s.mode === 'exit' && s.t <= 0) {
    const done = s.onExit;
    dispose();
    done?.();
    return false;
  }
  return moving;
}
/** Resumes drawing after a change; the loop stops by itself once the scene is still. */
function wake() {
  if (s && !s.raf) s.raf = requestAnimationFrame(frameLoop);
}

function show(model, sheet, frame) {
  if (!s) {
    build(frame);
    s.started = s.last = clock();
  } else if (s.mode === 'exit') {
    // Turned back on mid-landing: rise again from where it is.
    s.mode = 'enter';
    s.started = clock() - s.t * ENTER_MS;
    s.onExit = null;
  }
  update(model, frame, sheet);
}
function update(model, frame, sheet) {
  if (!s) return;
  resize(frame);
  const layout = liftLayout(model, s.frame);
  s.layout = layout;
  s.model = model;
  if (sheet || !s.sheet || !s.sheetKey) placeSheet(layout, sheet ?? s.lastSheet ?? null);
  if (sheet) s.lastSheet = sheet;
  syncNodes(layout);
  syncTicks(layout);
  caption(model, layout);
  wake();
}
function hide(done) {
  if (!s) return done?.();
  // Landing: old heights from the last change no longer apply.
  for (const v of s.nodes.values()) v.change = null;
  if (s.mode !== 'exit') {
    s.mode = 'exit';
    s.started = clock() - (1 - s.t) * EXIT_MS;
  }
  s.onExit = done;
  wake();
}
/** WebGL failed after starting (context lost, or an error mid-frame): stop and report. */
function fail(reason = 'webgl') {
  dispose();
  window.SomaLift.onFail?.(reason);
}
function dispose() {
  if (!s) return;
  if (s.raf) cancelAnimationFrame(s.raf);
  s.scene.traverse((o) => {
    if (o.userData.shared) return;
    if (!o.userData.sharedGeometry) o.geometry?.dispose();
    if (o.material) {
      if (o.material.map !== s.shadowTex) o.material.map?.dispose();
      o.material.alphaMap?.dispose();
      o.material.dispose();
    }
  });
  for (const v of s.edges.values()) v.mat?.dispose();
  for (const g of coneGeometry.values()) g.dispose();
  coneGeometry.clear();
  notchGeometry?.dispose();
  notchGeometry = null;
  s.shadowTex.dispose();
  // Releasing the context on purpose is not a failure.
  s.canvas.removeEventListener('webglcontextlost', s.onLost);
  s.renderer.dispose();
  s.renderer.forceContextLoss?.();
  s.canvas.remove();
  s.labels.remove();
  document.getElementById('lift-caption')?.remove();
  s = null;
}

window.SomaLift = {
  show,
  update,
  hide,
  dispose,
  onFail: null,
  get active() {
    return Boolean(s);
  },
  // For the test harness only (it drives the clock): the live scene state.
  get debug() {
    return typeof window.__liftNow === 'function' ? s : null;
  },
};
