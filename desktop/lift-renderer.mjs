// Lifts Soma's checked search off the learner's slide in 3D, drawn over the real display.
// The graph's region of the learner's own capture peels up as a sheet hinged on its bottom
// edge; each node rises on a pillar to its checked distance and each connection becomes a
// string as long as its cost (taut on shortest routes, slack by the difference elsewhere).
// Bundled into point-overlay-3d.js; exposes window.SomaLift.
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  SphereGeometry,
  CylinderGeometry,
  RingGeometry,
  CircleGeometry,
  PlaneGeometry,
  TubeGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Vector3,
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
import { cameraDistance, liftLayout, sagDepth, stringPoints, easeInOut, clamp01, riseAt, approach, fmt, separateLabels } from './lift-geometry.mjs';

const FOV = 28;
const TILT = (48 * Math.PI) / 180;
// Turned a little once lifted, so nodes that share a column on the slide separate.
const BASE_YAW = -0.26;
// A test harness may drive the clock to capture exact frames.
const clock = () => (typeof window.__liftNow === 'function' ? window.__liftNow() : performance.now());
const ENTER_MS = 1700;
const EXIT_MS = 950;
const COLOR = {
  source: 0xf2b632,
  settled: 0x1f9e78,
  current: 0xff7a3d,
  waiting: 0x8fb5a8,
  path: 0xff5a3c,
  taut: 0xf2a93b,
  slack: 0x7f8c99,
  tentative: 0xe7b86a,
  flat: 0x9a968e,
  cut: 0xe03b2c,
};
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
/** Alpha map with softened edges, so the lifted sheet has no hard seam against the slide. */
function vignette(inset = 18, blur = 10) {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#000';
  g.fillRect(0, 0, 256, 256);
  g.filter = `blur(${blur}px)`;
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(inset, inset, 256 - inset * 2, 256 - inset * 2, 26);
  g.fill();
  return new CanvasTexture(c);
}
/** The slide's paper colour, from the corners of the captured region. */
function paperColour(image) {
  try {
    const c = document.createElement('canvas');
    c.width = c.height = 16;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(image, 0, 0, 16, 16);
    const data = g.getImageData(0, 0, 16, 16).data;
    // The brightest corner pixels are the paper; marks near the edge are darker.
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
function nodeColor(n) {
  if (n.status === 'current') return COLOR.current;
  if (n.tentative) return COLOR.waiting;
  return n.source ? COLOR.source : COLOR.settled;
}

function build(frame) {
  const canvas = document.createElement('canvas');
  canvas.id = 'lift-canvas';
  document.body.appendChild(canvas);
  const labels = document.createElement('div');
  labels.id = 'lift-labels';
  document.body.appendChild(labels);
  const renderer = new WebGLRenderer({ canvas, alpha: true, antialias: true, premultipliedAlpha: true });
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 10, 100000);
  scene.add(new HemisphereLight(0xffffff, 0x6d6252, 1.5));
  const key = new DirectionalLight(0xffffff, 1.7);
  scene.add(key);
  const rim = new DirectionalLight(0xffe2c4, 0.7);
  scene.add(rim);
  const hinge = new Group(), yaw = new Group(), content = new Group();
  hinge.add(yaw);
  yaw.add(content);
  scene.add(hinge);
  s = {
    canvas, labels, renderer, scene, camera, key, rim, hinge, yaw, content,
    nodes: new Map(), edges: new Map(), flat: new Map(),
    shadowTex: radialTexture('rgba(0,0,0,0.55)', 'rgba(0,0,0,0)'),
    t: 0, mode: 'enter', started: clock(), last: clock(), sway: 0, pending: [],
    frame: null, layout: null, model: null, sheetMesh: null, sheetKey: null, onExit: null,
  };
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
}

function placeSheet(layout, sheet) {
  const key = sheet ? `${sheet.dataUrl.length}:${sheet.dataUrl.slice(-48)}` : 'none';
  if (s.sheetKey === key && s.sheetMesh) return;
  if (s.sheetMesh) {
    for (const o of [s.sheetMesh, s.sheetEdge, s.cover, s.floorShadow]) {
      o.parent.remove(o);
      o.geometry.dispose();
      o.material.map?.dispose();
      o.material.alphaMap?.dispose();
      o.material.dispose();
    }
  }
  s.sheetKey = key;
  // Place the sheet where the learner's slide shows this exact region, so a flat sheet is
  // the slide itself and only reveals itself as it lifts.
  const region = sheet?.region ?? layout.region;
  const f = s.frame,
    w = region.width * f.width,
    h = region.height * f.height,
    x = region.x * f.width + w / 2 - f.width / 2,
    y = f.height / 2 - (region.y * f.height + h / 2);
  const mat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: DoubleSide, alphaMap: vignette() });
  // Where the sheet came from, the slide shows blank paper of its own colour while lifted.
  // The slide's own paper colour, so its hard edge does not show.
  const coverMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  if (sheet) {
    new TextureLoader().load(sheet.dataUrl, (texture) => {
      texture.colorSpace = SRGBColorSpace;
      mat.map = texture;
      mat.needsUpdate = true;
      coverMat.color.copy(paperColour(texture.image));
    });
  } else {
    mat.color = new Color(0xf7f3ea);
    mat.opacity = 0;
  }
  s.sheetMesh = new Mesh(new PlaneGeometry(w, h), mat);
  s.sheetMesh.position.set(x, y, 0);
  s.sheetMesh.renderOrder = 0;
  const edge = new BufferGeometry().setFromPoints([
    new Vector3(x - w / 2, y - h / 2, 0.5), new Vector3(x + w / 2, y - h / 2, 0.5),
    new Vector3(x + w / 2, y + h / 2, 0.5), new Vector3(x - w / 2, y + h / 2, 0.5),
  ]);
  s.sheetEdge = new LineLoop(edge, new LineBasicMaterial({ color: 0x8c8577, transparent: true, opacity: 0 }));
  s.cover = new Mesh(new PlaneGeometry(w, h), coverMat);
  s.cover.position.set(x, y, -2);
  s.cover.renderOrder = -2;
  // A soft shadow on the slide beneath the lifted sheet.
  s.floorShadow = new Mesh(new PlaneGeometry(w * 1.15, h * 0.85), new MeshBasicMaterial({ map: radialTexture('rgba(0,0,0,0.45)', 'rgba(0,0,0,0)'), transparent: true, opacity: 0, depthWrite: false }));
  s.floorShadow.position.set(x, y - h * 0.12, -1);
  s.floorShadow.renderOrder = -1;
  s.scene.add(s.cover, s.floorShadow);
  s.content.add(s.sheetMesh, s.sheetEdge);
  s.hinge.position.set(x, y - h / 2, 0);
  s.content.position.set(-x, -(y - h / 2), 0);
}

function syncNodes(layout) {
  const r = layout.radius;
  const seen = new Set();
  for (const n of layout.nodes) {
    seen.add(n.id);
    let v = s.nodes.get(n.id);
    if (!v) {
      const sphere = new Mesh(new SphereGeometry(r * 0.78, 40, 24), material(nodeColor(n)));
      const pillar = new Mesh(new CylinderGeometry(r * 0.055, r * 0.055, 1, 10), new MeshBasicMaterial({ color: nodeColor(n), transparent: true, opacity: 0.6 }));
      pillar.rotation.x = Math.PI / 2;
      const foot = new Mesh(new RingGeometry(r * 0.95, r * 1.15, 48), new MeshBasicMaterial({ color: nodeColor(n), transparent: true, opacity: 0, side: DoubleSide, depthWrite: false }));
      const shadow = new Mesh(new CircleGeometry(r * 1.2, 32), new MeshBasicMaterial({ map: s.shadowTex, transparent: true, opacity: 0, depthWrite: false }));
      for (const o of [shadow, foot, pillar, sphere]) s.content.add(o);
      sphere.renderOrder = pillar.renderOrder = 3;
      v = { sphere, pillar, foot, shadow, label: tag('is-node'), h: 0, target: 0 };
      s.nodes.set(n.id, v);
    }
    v.data = n;
    v.target = n.height;
    const color = nodeColor(n);
    v.sphere.material.color.setHex(color);
    v.sphere.material.emissive.setHex(n.status === 'current' ? color : 0x000000);
    v.sphere.material.opacity = n.tentative ? 0.5 : 1;
    v.pillar.material.color.setHex(color);
    v.pillar.material.opacity = n.tentative ? 0.3 : 0.6;
    v.foot.material.color.setHex(color);
    v.sphere.position.x = v.pillar.position.x = v.foot.position.x = v.shadow.position.x = n.x;
    v.sphere.position.y = v.pillar.position.y = v.foot.position.y = v.shadow.position.y = n.y;
    v.foot.position.z = 0.6;
    v.shadow.position.z = 0.3;
    const lifted = n.distance !== null;
    v.sphere.visible = v.pillar.visible = lifted;
    v.label.textContent = lifted ? `${n.label} ${n.tentative ? '≤' : '='} ${fmt(n.distance)}` : '';
    v.label.className = `lift-tag is-node is-${n.status}${n.source ? ' is-source' : ''}${n.goal ? ' is-goal' : ''}`;
  }
  for (const [id, v] of s.nodes)
    if (!seen.has(id)) {
      for (const o of [v.sphere, v.pillar, v.foot, v.shadow]) {
        s.content.remove(o);
        o.geometry.dispose();
        o.material.dispose();
      }
      v.label.remove();
      s.nodes.delete(id);
    }
}

function caption(model, layout) {
  let box = document.getElementById('lift-caption');
  if (!box) {
    box = document.createElement('div');
    box.id = 'lift-caption';
    box.append(document.createElement('strong'), document.createElement('span'), document.createElement('small'));
    document.body.appendChild(box);
  }
  const [title, body, legend] = box.children;
  const source = layout.nodes.find((n) => n.source)?.label ?? 'the start';
  title.textContent = model.caption?.stepLabel ?? 'Lifted off your slide';
  body.textContent = model.caption?.text ?? '';
  legend.textContent = `Height is the checked ${layout.unit === 'edges' ? 'number of edges' : 'distance'} from ${source}. Shortest routes pull their strings taut; a slack string is longer by the number shown.`;
  const f = s.frame, c = model.caption;
  box.style.left = (c ? c.x * f.width : 24) + f.dx + 'px';
  box.style.top = box.style.bottom = '';
  if (!c || c.anchor === 'top') box.style.top = (c ? c.y * f.height : f.height * 0.7) + f.dy + 'px';
  else box.style.bottom = innerHeight - (c.y * f.height + f.dy) + 'px';
}

function project(local, out = new Vector3()) {
  out.copy(local);
  s.content.localToWorld(out);
  out.project(s.camera);
  return { x: ((out.x + 1) / 2) * s.frame.width + s.frame.dx, y: ((1 - out.y) / 2) * s.frame.height + s.frame.dy, behind: out.z > 1 };
}
const scratch = new Vector3();
function placeLabel(el, local, opacity, priority) {
  const p = project(local, scratch);
  s.pending.push({ el, x: p.x, y: p.y, opacity: p.behind ? 0 : opacity, priority });
}
/** Writes this frame's label positions, nudging overlapping ones apart. */
function flushLabels() {
  const shown = s.pending.filter((l) => l.opacity > 0.05 && l.el.textContent);
  for (const l of s.pending) if (!shown.includes(l)) l.el.style.opacity = 0;
  for (const l of shown)
    if (l.el._text !== l.el.textContent) {
      l.el._text = l.el.textContent;
      l.el._w = l.el.offsetWidth;
      l.el._h = l.el.offsetHeight;
    }
  const ys = separateLabels(shown.map((l) => ({ x: l.x, y: l.y, w: l.el._w, h: l.el._h, priority: l.priority })));
  shown.forEach((l, i) => {
    l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${ys[i].toFixed(1)}px) translate(-50%, -100%)`;
    l.el.style.opacity = String(l.opacity);
  });
  s.pending = [];
}

function edgeMaterial(kind, tone) {
  if (kind === 'cut') return material(COLOR.cut, { roughness: 0.5, clearcoat: 0.2 });
  if (tone === 'path') return material(COLOR.path, { emissive: new Color(COLOR.path), emissiveIntensity: 0.35 });
  if (kind === 'tentative') return material(COLOR.tentative, { roughness: 0.5, clearcoat: 0.3, opacity: 0.6 });
  if (kind === 'taut') return material(COLOR.taut, { emissive: new Color(COLOR.taut), emissiveIntensity: 0.12 });
  return material(COLOR.slack, { roughness: 0.55, clearcoat: 0.3, opacity: 0.9 });
}
function tube(points, radius, mat) {
  const curve = new CatmullRomCurve3(points.map((p) => new Vector3(p.x, p.y, p.z)));
  const mesh = new Mesh(new TubeGeometry(curve, Math.max(8, points.length * 2), radius, 10, false), mat);
  mesh.renderOrder = 2;
  return mesh;
}

/** Strings are rebuilt each frame from the animated node heights. */
function drawEdges(rise) {
  const r = s.layout.radius;
  const keep = new Set();
  for (const e of s.layout.edges) {
    keep.add(e.id);
    let v = s.edges.get(e.id);
    if (!v) {
      v = { meshes: [], label: tag('is-edge'), mat: null, key: '' };
      s.edges.set(e.id, v);
    }
    const key = `${e.kind}:${e.tone}`;
    if (v.key !== key) {
      v.mat?.dispose();
      v.mat = edgeMaterial(e.kind, e.tone);
      v.baseOpacity = v.mat.opacity;
      v.key = key;
      v.label.className = `lift-tag is-edge is-${e.kind}${e.tone === 'path' ? ' is-path' : ''}`;
    }
    for (const m of v.meshes) {
      s.content.remove(m);
      m.geometry.dispose();
    }
    v.meshes = [];
    const A = s.nodes.get(e.from), B = s.nodes.get(e.to);
    const ra = A.data.distance === null ? 0 : rise(e.from), rb = B.data.distance === null ? 0 : rise(e.to);
    const a = { x: A.data.x, y: A.data.y, z: A.h * ra }, b = { x: B.data.x, y: B.data.y, z: B.h * rb };
    let labelAt = null, opacity = 0;
    // A string appears as its nodes leave the sheet, so the slide is untouched at first.
    v.mat.opacity = v.baseOpacity * clamp01(Math.min(ra, rb) * 2.5);
    if (e.kind === 'flat') {
      // Not yet reached at both ends: the connection stays drawn on the sheet.
      v.label.textContent = '';
      v.label.style.opacity = 0;
      continue;
    } else if (e.kind === 'cut') {
      // A cut string: two ends dangling toward each other.
      const k = Math.min(ra, rb);
      for (const [p, q] of [[a, b], [b, a]]) {
        const end = { x: p.x + (q.x - p.x) * 0.28, y: p.y + (q.y - p.y) * 0.28, z: Math.max(0, p.z - r * 3.5 * k) };
        const mid = { x: (p.x + end.x) / 2, y: (p.y + end.y) / 2, z: (p.z + end.z) / 2 + r * 0.4 };
        v.meshes.push(tube([p, mid, end], r * 0.08, v.mat));
      }
      v.label.textContent = '✕ cut';
      labelAt = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: Math.max(a.z, b.z) * 0.5 };
      opacity = k;
    } else {
      const k = Math.min(ra, rb);
      const sag = sagDepth(e.slack, s.layout.scale, s.layout.tallest) * k;
      const points = stringPoints(a, b, sag, 24);
      const radius = r * (e.tone === 'path' ? 0.17 : e.kind === 'taut' ? 0.11 : e.kind === 'tentative' ? 0.065 : 0.075);
      v.meshes.push(tube(points, radius, v.mat));
      v.label.textContent = e.label;
      labelAt = points[12];
      opacity = clamp01((k - 0.6) / 0.4);
    }
    for (const m of v.meshes) s.content.add(m);
    const priority = e.kind === 'cut' || e.tone === 'path' ? 2 : e.kind === 'slack' ? 1.5 : 1;
    if (labelAt) placeLabel(v.label, new Vector3(labelAt.x, labelAt.y, labelAt.z - r * 0.4), opacity, priority);
  }
  for (const [id, v] of s.edges)
    if (!keep.has(id)) {
      for (const m of v.meshes) {
        s.content.remove(m);
        m.geometry.dispose();
      }
      v.mat?.dispose();
      v.label.remove();
      s.edges.delete(id);
    }
}

function frameLoop() {
  if (!s) return;
  const now = clock();
  const dt = Math.min(0.05, (now - s.last) / 1000);
  s.last = now;
  const quick = reducedMotion.matches;
  if (s.mode === 'enter') s.t = clamp01((now - s.started) / (quick ? 300 : ENTER_MS));
  else if (s.mode === 'exit') s.t = 1 - clamp01((now - s.started) / (quick ? 250 : EXIT_MS));
  if (s.mode === 'enter' && s.t >= 1) s.mode = 'idle';
  const t = s.t;
  const tilt = easeInOut(clamp01(t / 0.55));
  s.hinge.rotation.x = -TILT * tilt;
  s.hinge.rotation.z = BASE_YAW * tilt;
  s.hinge.position.z = s.frame.height * 0.035 * tilt;
  // A slow turn once lifted, so the depth reads without anyone touching it.
  s.sway = approach(s.sway, s.mode === 'idle' && !quick ? 1 : 0, dt, 0.8);
  s.yaw.rotation.z = Math.sin(now / 2600) * 0.08 * s.sway;
  const sheetT = clamp01(t / 0.4);
  if (s.sheetMesh) {
    s.sheetMesh.material.opacity = s.sheetMesh.material.map ? 1 - 0.12 * sheetT : 0.5 * sheetT;
    s.sheetMesh.material.color.lerpColors(new Color(0xffffff), new Color(0xf1ece1), sheetT);
    s.sheetEdge.material.opacity = 0.75 * sheetT;
    s.cover.material.opacity = sheetT;
    s.floorShadow.material.opacity = 0.4 * tilt;
  }
  // Nodes leave the sheet in order of distance; a change of distance glides.
  const lifted = [...s.nodes.values()].filter((v) => v.data.distance !== null).sort((x, y) => x.data.distance - y.data.distance);
  const rank = new Map(lifted.map((v, i) => [v.data.id, i]));
  const rise = (id) => (quick ? t : clamp01(riseAt(t, rank.get(id) ?? 0, lifted.length)));
  const r = s.layout.radius;
  for (const v of s.nodes.values()) {
    v.h = approach(v.h, v.target, dt, 0.28);
    const k = v.data.distance === null ? 0 : rise(v.data.id);
    const z = Math.max(0, v.h * k);
    v.sphere.position.z = z;
    // A node grows out of its printed circle as it rises.
    v.sphere.scale.setScalar(Math.max(0.001, clamp01(k * 1.6)));
    v.pillar.scale.y = Math.max(0.001, z);
    v.pillar.position.z = z / 2;
    v.foot.material.opacity = (v.data.distance === null ? 0.25 : 0.7) * sheetT;
    v.shadow.material.opacity = 0.5 * Math.min(1, k) * (1 - Math.min(0.6, z / (s.layout.tallest * 2)));
    if (v.data.status === 'current') v.sphere.material.emissiveIntensity = 0.25 + 0.18 * Math.sin(now / 160);
    const important = v.data.status === 'current' || v.data.goal ? 4 : 3;
    placeLabel(v.label, new Vector3(v.data.x, v.data.y, z + r * 1.05), v.data.distance === null ? 0 : clamp01((k - 0.5) / 0.5), important);
  }
  drawEdges(rise);
  flushLabels();
  s.renderer.render(s.scene, s.camera);
  if (s.mode === 'exit' && s.t <= 0) {
    const done = s.onExit;
    dispose();
    done?.();
    return;
  }
  s.raf = requestAnimationFrame(frameLoop);
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
  if (!s.raf) s.raf = requestAnimationFrame(frameLoop);
}
function update(model, frame, sheet) {
  if (!s) return;
  resize(frame);
  const layout = liftLayout(model, s.frame);
  s.layout = layout;
  s.model = model;
  if (sheet || !s.sheetMesh) placeSheet(layout, sheet ?? null);
  syncNodes(layout);
  caption(model, layout);
}
function hide(done) {
  if (!s) return done?.();
  if (s.mode !== 'exit') {
    s.mode = 'exit';
    s.started = clock() - (1 - s.t) * EXIT_MS;
  }
  s.onExit = done;
}
function dispose() {
  if (!s) return;
  cancelAnimationFrame(s.raf);
  s.scene.traverse((o) => {
    o.geometry?.dispose();
    if (o.material) {
      o.material.map?.dispose();
      o.material.alphaMap?.dispose();
      o.material.dispose();
    }
  });
  s.shadowTex.dispose();
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
  get active() {
    return Boolean(s);
  },
  // For the test harness only (it drives the clock): the live scene state.
  get debug() {
    return typeof window.__liftNow === 'function' ? s : null;
  },
};
