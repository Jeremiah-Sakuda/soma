// Lifts any answer's 3D model off the learner's slide, drawn over the real display. The
// region of the capture the learner pointed at peels up as a sheet hinged on its bottom edge,
// and the model of the explanation stands on it: the same parts the page draws, named where
// they are, with flows as arrows. Stepping through the explanation moves, reveals and lights
// up the parts each step is about. Bundled into point-overlay-3d.js; exposes window.SomaModel.
import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  Group,
  Mesh,
  PlaneGeometry,
  CylinderGeometry,
  ConeGeometry,
  TubeGeometry,
  QuadraticBezierCurve3,
  MeshBasicMaterial,
  MeshStandardMaterial,
  HemisphereLight,
  DirectionalLight,
  CanvasTexture,
  TextureLoader,
  SRGBColorSpace,
  DoubleSide,
  Vector3,
  Box3,
  Color,
  Raycaster,
  Vector2,
} from 'three';
import { createSpatialPart } from '../src/components/spatial-parts';
import { cameraDistance, easeInOut, clamp01, riseAt, approach, separateLabels } from './lift-geometry.mjs';

const FOV = 28;
// Tilted back less than the search lift: a model needs its front, not just its height.
const TILT = (62 * Math.PI) / 180;
const BASE_YAW = -0.32;
const ENTER_MS = 2600;
const EXIT_MS = 900;
const SWAY_MS = 9000;
const clock = () => (typeof window.__liftNow === 'function' ? window.__liftNow() : performance.now());
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const ACCENT = 0xd8572a;
// A part the learner picked.
const PICKED = 0x5551f5;
// How far a drag can turn the model, and tip it toward or away from the viewer (radians).
const TURN_LIMIT = Math.PI;
const TIP_LIMIT = 0.35;
let s = null;

function shadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  grad.addColorStop(0, 'rgba(0,0,0,0.45)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}

function build(frame) {
  const canvas = document.createElement('canvas');
  canvas.id = 'lift-canvas';
  const labels = document.createElement('div');
  labels.id = 'lift-labels';
  labels.setAttribute('aria-hidden', 'true');
  let renderer;
  try {
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
  scene.add(new HemisphereLight(0xffffff, 0x7a6f5e, 2.1));
  const key = new DirectionalLight(0xfff3dd, 2.4);
  const fill = new DirectionalLight(0xbad9ec, 0.9);
  scene.add(key, fill);
  // table: a turntable on the sheet, so a drag turns the model about its own upright axis.
  const hinge = new Group(), yaw = new Group(), content = new Group(), table = new Group(), model = new Group();
  hinge.add(yaw);
  yaw.add(content);
  content.add(table);
  table.add(model);
  scene.add(hinge);
  s = {
    canvas, labels, renderer, scene, camera, key, fill, hinge, yaw, content, table, model,
    parts: new Map(), links: new Map(), shadowTex: shadowTexture(), pending: [],
    // The learner's own turn and tip of the model, from dragging it.
    turn: 0, tip: 0, held: false,
    t: 0, mode: 'enter', started: clock(), last: clock(), idleSince: null, sway: 0,
    frame: null, data: null, sheet: null, sheetKey: null, sheetReady: false, onExit: null, raf: 0,
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
  s.key.position.set(-frame.width * 0.35, frame.height * 0.8, d);
  s.fill.position.set(frame.width * 0.5, -frame.height * 0.2, d * 0.4);
  s.sheetKey = null;
}

/** The region of the slide as a sheet where it is on screen, a cover where it came from, and
 * a soft shadow; the model's frame is fitted to the sheet. */
function placeSheet(data, sheet) {
  const key = `${sheet ? `${sheet.dataUrl.length}:${sheet.dataUrl.slice(-48)}` : 'none'}:${s.frame.width}x${s.frame.height}:${JSON.stringify(data.region)}`;
  if (s.sheetKey === key) return;
  if (s.sheet) for (const o of Object.values(s.sheet)) dispose3d(o);
  s.sheetKey = key;
  s.sheetReady = false;
  const region = sheet?.region ?? data.region, f = s.frame;
  const w = region.width * f.width, h = region.height * f.height;
  const x = region.x * f.width + w / 2 - f.width / 2, y = f.height / 2 - (region.y * f.height + h / 2);
  const paper = new MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: DoubleSide, opacity: 0 });
  const coverMat = new MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
  if (sheet)
    new TextureLoader().load(
      sheet.dataUrl,
      (texture) => {
        if (!s || s.sheet?.paper.material !== paper) return texture.dispose();
        texture.colorSpace = SRGBColorSpace;
        paper.map = texture;
        paper.needsUpdate = true;
        coverMat.color.set(0xf6f3ec);
        s.sheetReady = true;
        wake();
      },
      undefined,
      () => {
        if (s && s.sheet?.paper.material === paper) fail('sheet');
      },
    );
  else {
    paper.color = new Color(0xf7f3ea);
    s.sheetReady = true;
  }
  s.hasCover = Boolean(sheet);
  const plane = new Mesh(new PlaneGeometry(w, h), paper);
  plane.position.set(x, y, 0);
  const cover = new Mesh(new PlaneGeometry(w, h), coverMat);
  cover.position.set(x, y, -2);
  cover.renderOrder = -2;
  const floor = new Mesh(new PlaneGeometry(w * 0.95, h * 0.5), new MeshBasicMaterial({ map: s.shadowTex, transparent: true, opacity: 0, depthWrite: false }));
  floor.position.set(x + w * 0.02, y - h * 0.4, -1);
  floor.renderOrder = -1;
  s.scene.add(cover, floor);
  s.content.add(plane);
  s.sheet = { paper: plane, cover, floor };
  s.hinge.position.set(x, y - h / 2, 0);
  s.content.position.set(-x, -(y - h / 2), 0);
  s.sheetBox = { x, y, w, h };
}

/** Model units to sheet pixels: the model spans most of the sheet's width, kept short enough
 * to stand on screen, and stands on the sheet's middle. The model's y is up, out of the sheet. */
/** A checked quantity as height: each part stands where it is printed on the slide and rises
 * to its value, so the model's x and z come from the slide, not from the scene. */
function anchored(data) {
  return data.kind === 'height' && data.objects.length > 0 && data.objects.every((o) => o.anchor);
}
function fitAnchored(data) {
  const f = s.frame;
  const top = Math.max(1e-3, ...data.objects.map((o) => o.position.y));
  const unit = (f.height * 0.3) / top;
  s.unit = unit;
  s.model.rotation.x = Math.PI / 2;
  s.model.scale.setScalar(unit);
  // Turns about the middle of the drawing.
  s.table.position.set(s.sheetBox.x, s.sheetBox.y, 0);
  s.model.position.set(-s.sheetBox.x, -s.sheetBox.y, 2);
  s.floorY = 0;
  s.anchors = new Map(
    data.objects.map((o) => [o.id, { x: (o.anchor.x * f.width - f.width / 2) / unit, z: -(f.height / 2 - o.anchor.y * f.height) / unit }]),
  );
}
function fitModel() {
  // The parts' real extents: custom pieces carry their own layout inside the part.
  const box = new Box3();
  for (const v of s.parts.values()) box.union(v.extent.clone().translate(v.target));
  const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  const { x, y, w, h } = s.sheetBox;
  const unit = Math.min((w * 0.86) / Math.max(1e-3, size.x), (h * 1.7) / Math.max(1e-3, size.z), (s.frame.height * 0.42) / Math.max(1e-3, size.y));
  s.unit = unit;
  // Rotating about x by +90° turns the model's y (up) into the sheet's normal.
  s.model.rotation.x = Math.PI / 2;
  s.model.scale.setScalar(unit);
  // The turntable sits under the model's middle; the model stands on it.
  const cy = y + center.z * unit * 0.25;
  s.table.position.set(x, cy, 0);
  s.model.position.set(-center.x * unit, 0, -box.min.y * unit + 2);
  s.floorY = box.min.y;
}

function tag(className) {
  const el = document.createElement('div');
  el.className = `lift-tag ${className}`;
  s.labels.appendChild(el);
  return el;
}

function dispose3d(o) {
  o.parent?.remove(o);
  o.traverse?.((m) => {
    if (m.userData?.shared) return;
    m.geometry?.dispose();
    const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
    for (const mat of mats) {
      if (mat.map && mat.map !== s?.shadowTex) mat.map.dispose();
      mat.dispose();
    }
  });
}

/** Parts keyed by id: a part rebuilt only when its look changes, moved when its pose does. */
function syncParts(data) {
  const seen = new Set();
  data.objects.forEach((o, index) => {
    seen.add(o.id);
    const shellNow = Boolean(o.shell) || data.objects.some((c) => c.parentId === o.id);
    const look = JSON.stringify([o.shape, o.renderStyle, o.color, o.size, o.path ?? null, o.geometry ?? null, o.parameterValues ?? null, shellNow]);
    let v = s.parts.get(o.id);
    if (v && v.look !== look) {
      dispose3d(v.mesh);
      v.mesh = null;
    }
    if (!v) {
      v = { id: o.id, label: tag('is-node is-part'), look: '', mesh: null, at: new Vector3(o.position.x, o.position.y, o.position.z), fade: 0, pulseAt: -1e9, index };
      s.parts.set(o.id, v);
    }
    if (!v.mesh) {
      const shell = shellNow;
      // Built where it stands (paths and pieces are laid out about the part's position), then
      // drawn from the holder's origin, which carries the position and any pose.
      const part = createSpatialPart(o, false, shell);
      part.position.set(0, 0, 0);
      const holder = new Group(), inner = new Group();
      inner.add(part);
      holder.add(inner);
      part.traverse((m) => {
        if (!m.isMesh) return;
        const mats = Array.isArray(m.material) ? m.material : [m.material];
        for (const mat of mats) {
          mat.transparent = true;
          mat.userData.baseOpacity = mat.opacity;
        }
      });
      const shadow = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: s.shadowTex, transparent: true, depthWrite: false, opacity: 0 }));
      shadow.rotation.x = -Math.PI / 2;
      shadow.userData.isShadow = true;
      holder.add(shadow);
      s.model.add(holder);
      v.mesh = holder;
      v.inner = inner;
      v.shadow = shadow;
      v.look = look;
      part.updateMatrixWorld(true);
      v.extent = new Box3().setFromObject(part);
    }
    if (v.data && v.data.highlighted !== o.highlighted && o.highlighted) v.pulseAt = clock();
    if (v.data && !v.data.visible && o.visible) v.pulseAt = clock();
    v.data = o;
    v.index = index;
    const pin = s.anchors?.get(o.id);
    v.target = pin ? new Vector3(pin.x, o.position.y, pin.z) : new Vector3(o.position.x, o.position.y, o.position.z);
    // A checked height reads with its value: "B 8.394 V".
    // A picked part says what it does.
    v.label.textContent = s.pinned && o.visible ? `${o.label} ${o.detail}` : o.selected ? `${o.label} — ${o.detail}` : o.label;
    v.label.classList.toggle('is-selected', Boolean(o.selected));
    if (s.pinned && !v.stem) {
      v.stem = new Mesh(new CylinderGeometry(0.04, 0.04, 1, 8), new MeshBasicMaterial({ color: 0x8a8f86, transparent: true, opacity: 0 }));
      s.model.add(v.stem);
    }
    v.label.classList.toggle('is-current', o.highlighted);
  });
  for (const [key, v] of s.parts)
    if (!seen.has(key)) {
      dispose3d(v.mesh);
      v.label.remove();
      s.parts.delete(key);
    }
}

function arc(a, b, lift) {
  const mid = a.clone().add(b).multiplyScalar(0.5);
  mid.y += lift;
  return new QuadraticBezierCurve3(a, mid, b);
}
function syncLinks(data) {
  const seen = new Set();
  for (const c of data.connections) {
    seen.add(c.id);
    let v = s.links.get(c.id);
    if (!v) {
      const mat = new MeshStandardMaterial({ color: 0x8a8f86, roughness: 0.5, transparent: true, opacity: 0 });
      const head = new Mesh(new ConeGeometry(1, 2.4, 14), mat);
      s.model.add(head);
      v = { id: c.id, mat, tube: null, head, label: tag('is-edge'), key: '' };
      s.links.set(c.id, v);
    }
    v.data = c;
    v.label.textContent = c.highlighted || data.kind === 'height' ? c.label : '';
  }
  for (const [key, v] of s.links)
    if (!seen.has(key)) {
      dispose3d(v.head);
      if (v.tube) dispose3d(v.tube);
      v.mat.dispose();
      v.label.remove();
      s.links.delete(key);
    }
}

function project(local) {
  const out = local.clone();
  s.model.localToWorld(out);
  out.project(s.camera);
  return { x: ((out.x + 1) / 2) * s.frame.width + s.frame.dx, y: ((1 - out.y) / 2) * s.frame.height + s.frame.dy, behind: out.z > 1 };
}
function placeLabel(el, local, opacity, priority) {
  const p = project(local);
  s.pending.push({ el, x: p.x, y: p.y, opacity: p.behind ? 0 : opacity, priority });
}
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
    // A name pushed far from its part would read as another part's: only the parts this step
    // is about keep theirs; the rest wait for a clear spot.
    const strayed = l.priority < 4 && Math.abs(ys[i] - l.y) > 30;
    l.el.style.transform = `translate(${l.x.toFixed(1)}px, ${ys[i].toFixed(1)}px) translate(-50%, -100%)`;
    l.el.style.opacity = strayed ? '0' : String(l.opacity);
  });
  s.pending = [];
}

function caption(data) {
  let box = document.getElementById('lift-caption');
  if (!box) {
    box = document.createElement('div');
    box.id = 'lift-caption';
    box.setAttribute('aria-hidden', 'true');
    box.append(document.createElement('strong'), document.createElement('span'), document.createElement('small'));
    document.body.appendChild(box);
  }
  const [title, body, note] = box.children;
  title.textContent = data.caption?.stepLabel ?? data.title;
  body.textContent = data.caption?.text ?? '';
  note.textContent = data.note;
  const f = s.frame, r = data.region;
  box.style.left = Math.max(8, Math.min(r.x * f.width + f.dx, innerWidth - box.offsetWidth - 8)) + 'px';
  box.style.bottom = '';
  box.style.top = Math.max(8, Math.min((r.y + r.height) * f.height + f.dy + 12, innerHeight - box.offsetHeight - 12)) + 'px';
}

function frameLoop() {
  s.raf = 0;
  try {
    if (renderFrame()) s.raf = requestAnimationFrame(frameLoop);
  } catch (error) {
    console.error('Soma 3D model stopped:', error);
    fail();
  }
}
function renderFrame() {
  const now = clock();
  const dt = Math.min(0.05, Math.max(0, (now - s.last) / 1000));
  s.last = now;
  const quick = reducedMotion.matches;
  if (s.mode === 'enter') s.t = quick ? 1 : clamp01((now - s.started) / ENTER_MS);
  else if (s.mode === 'exit') s.t = quick ? 0 : 1 - clamp01((now - s.started) / EXIT_MS);
  if (s.mode === 'enter' && s.t >= 1) {
    s.mode = 'idle';
    s.idleSince = now;
  }
  const t = s.t;
  const tiltPhase = clamp01(t / 0.5);
  const tilt = easeInOut(tiltPhase) + (s.mode === 'exit' ? 0 : 0.03 * Math.sin(Math.PI * clamp01((tiltPhase - 0.7) / 0.3)));
  s.hinge.rotation.x = -TILT * tilt + s.tip * tilt;
  s.hinge.rotation.z = BASE_YAW * tilt;
  s.hinge.position.z = s.frame.height * 0.035 * tilt;
  // Once the learner has turned it, the model holds still where they left it.
  const swaying = s.mode === 'idle' && !quick && !s.touched && now - s.idleSince < SWAY_MS;
  s.sway = approach(s.sway, swaying ? 1 : 0, dt, 0.9);
  s.yaw.rotation.z = Math.sin((now - (s.idleSince ?? now)) / 2200) * 0.14 * s.sway;
  s.table.rotation.z = s.turn * tilt;
  let moving = s.mode !== 'idle' || s.sway > 0.002;
  const sheetT = clamp01(t / 0.3), sh = s.sheet;
  if (sh) {
    const ready = s.sheetReady;
    sh.paper.material.opacity = ready ? 1 - 0.5 * sheetT : 0;
    sh.cover.material.opacity = ready && s.hasCover ? clamp01(t / 0.06) : 0;
    sh.floor.material.opacity = 0.3 * tilt;
  }
  const parts = [...s.parts.values()];
  const anyLit = parts.some((v) => v.data.highlighted && v.data.visible);
  for (const v of parts) {
    const k = quick ? t : clamp01(riseAt(t, v.index, parts.length));
    // Poses glide between steps; a part appears or leaves by fading where it stands.
    v.at.set(approach(v.at.x, v.target.x, dt, 0.35), approach(v.at.y, v.target.y, dt, 0.35), approach(v.at.z, v.target.z, dt, 0.35));
    if (v.at.distanceTo(v.target) > 0.002) moving = true;
    v.fade = quick ? (v.data.visible ? 1 : 0) : approach(v.fade, v.data.visible ? 1 : 0, dt, 0.25);
    if (Math.abs(v.fade - (v.data.visible ? 1 : 0)) > 0.01) moving = true;
    const pulseAge = (now - v.pulseAt) / 600;
    const pulse = !quick && pulseAge >= 0 && pulseAge < 1 ? 0.12 * Math.sin(Math.PI * pulseAge) : 0;
    if (!quick && pulseAge >= 0 && pulseAge < 1.5) moving = true;
    // Rising out of the sheet on entry: from the floor up to where the part stands.
    const rise = s.floorY + (v.at.y - s.floorY) * k;
    v.mesh.position.set(v.at.x, rise, v.at.z);
    v.inner.scale.setScalar(Math.max(0.001, clamp01(k * 1.4) * (1 + pulse)));
    const dim = anyLit && !v.data.highlighted && !v.data.selected ? 0.55 : 1;
    v.inner.traverse((m) => {
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        mat.opacity = (mat.userData.baseOpacity ?? 1) * v.fade * dim;
        mat.depthWrite = mat.opacity > 0.95;
        if ('emissiveIntensity' in mat) {
          const lit = v.data.selected || v.data.highlighted || v.hover;
          if (lit && mat.emissive) mat.emissive.set(v.data.selected || v.hover ? PICKED : ACCENT);
          mat.emissiveIntensity = v.data.selected ? 0.3 : v.hover ? 0.18 : v.data.highlighted ? 0.18 + 0.25 * (pulse / 0.12) : 0;
        }
      }
    });
    // A soft contact shadow under what stands on the floor; floating parts cast a fainter one.
    const e = v.extent, ex = e.max.x - e.min.x, ez = e.max.z - e.min.z;
    v.shadow.scale.set(ex * 1.25, ez * 1.25, 1);
    v.shadow.position.set((e.min.x + e.max.x) / 2, s.floorY - rise + 0.01, (e.min.z + e.max.z) / 2);
    const height = rise + e.min.y - s.floorY;
    v.shadow.material.opacity = 0.32 * v.fade * clamp01(k) * clamp01(1 - height / 3) * (v.data.parentId ? 0 : 1);
    if (v.stem) {
      // A stem from the slide up to the part reads its height.
      const tall = Math.max(0.001, rise - s.floorY);
      v.stem.scale.set(1, tall, 1);
      v.stem.position.set(v.at.x, s.floorY + tall / 2, v.at.z);
      v.stem.material.opacity = 0.6 * v.fade * clamp01(k);
    }
    // An arrow is named at its tip, a tube or sheet at its middle; anything else above its top.
    const path = v.data.path;
    const ref = path?.length ? (v.data.shape === 'arrow' ? path[path.length - 1] : path[Math.floor(path.length / 2)]) : null;
    const lift = rise - v.at.y;
    const top = ref
      ? new Vector3(ref.x, ref.y + lift + 0.15, ref.z)
      : new Vector3(v.at.x + (e.min.x + e.max.x) / 2, rise + e.max.y + 0.12, v.at.z + (e.min.z + e.max.z) / 2);
    placeLabel(v.label, top, clamp01((k - 0.6) / 0.4) * v.fade * (anyLit && !v.data.highlighted && !v.data.selected && !v.hover ? 0.75 : 1), v.data.selected || v.hover ? 5 : v.data.highlighted ? 4 : 2);
  }
  // Flows arc between the parts they join, drawn once both have risen.
  for (const v of s.links.values()) {
    const a = s.parts.get(v.data.from), b = s.parts.get(v.data.to);
    if (!a || !b) continue;
    const centre = (v) => v.mesh.position.clone().add(v.extent.getCenter(new Vector3()));
    const reach = (v) => Math.min(...v.extent.getSize(new Vector3()).toArray()) * 0.5;
    const pa = centre(a), pb = centre(b);
    const span = pa.distanceTo(pb);
    const ra = reach(a), rb = reach(b);
    if (span < ra + rb + 0.05) {
      v.mat.opacity = 0;
      if (v.tube) v.tube.visible = false;
      continue;
    }
    // From surface to surface, not centre to centre.
    const dir = pb.clone().sub(pa).normalize();
    const from = pa.clone().add(dir.clone().multiplyScalar(ra * 0.9)), to = pb.clone().sub(dir.clone().multiplyScalar(rb * 1.05));
    // A checked quantity's links are straight ramps between heights; a model's flows arc.
    const curve = arc(from, to, s.pinned ? 0 : Math.min(1.2, span * 0.22));
    const radius = (v.data.highlighted ? 0.05 : 0.03) * Math.max(1, span / 4);
    const key = [from, to].map((p) => p.toArray().map((n) => n.toFixed(2)).join(',')).join(';') + radius.toFixed(3);
    if (key !== v.key) {
      if (v.tube) dispose3d(v.tube);
      v.tube = new Mesh(new TubeGeometry(curve, 24, radius, 8, false), v.mat);
      v.tube.userData.sharedMaterial = true;
      s.model.add(v.tube);
      v.key = key;
    }
    v.tube.visible = true;
    const shown = Math.min(a.fade, b.fade) * clamp01((t - 0.75) / 0.25);
    v.mat.color.set(v.data.highlighted ? ACCENT : 0x8a8f86);
    v.mat.opacity = (v.data.active ? 0.9 : 0.3) * shown;
    v.head.visible = v.data.directed;
    if (v.data.directed) {
      const end = curve.getPoint(1), tangent = curve.getTangent(1).normalize();
      v.head.scale.setScalar(radius * 2.4);
      v.head.position.copy(end);
      v.head.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), tangent);
    }
    placeLabel(v.label, curve.getPoint(0.5).add(new Vector3(0, 0.15, 0)), shown, 3);
  }
  flushLabels();
  s.renderer.render(s.scene, s.camera);
  if (s.mode === 'exit' && s.t <= 0) {
    const done = s.onExit;
    dispose();
    done?.();
    return false;
  }
  return moving;
}
function wake() {
  if (s && !s.raf) s.raf = requestAnimationFrame(frameLoop);
}

/** scene: a validated LiftScene, plus the step caption to show beside it. */
function show(data, sheet, frame) {
  if (!s) {
    build(frame);
    s.started = s.last = clock();
  } else if (s.mode === 'exit') {
    s.mode = 'enter';
    s.started = clock() - s.t * ENTER_MS;
    s.onExit = null;
  }
  update(data, frame, sheet);
}
function update(data, frame, sheet) {
  if (!s) return;
  resize(frame);
  s.data = data;
  if (sheet || !s.sheet || !s.sheetKey) placeSheet(data, sheet ?? s.lastSheet ?? null);
  if (sheet) s.lastSheet = sheet;
  // Refit only when the set of parts changes, so a step's motion is not rescaled away.
  s.pinned = anchored(data);
  if (s.pinned) fitAnchored(data);
  else s.anchors = null;
  syncParts(data);
  const fitKey = data.objects.map((o) => o.id).join(',') + s.sheetKey;
  if (!s.pinned && fitKey !== s.fitKey) {
    fitModel();
    s.fitKey = fitKey;
  }
  syncLinks(data);
  caption(data);
  wake();
}
function hide(done) {
  if (!s) return done?.();
  if (s.mode !== 'exit') {
    s.mode = 'exit';
    s.started = clock() - (1 - s.t) * EXIT_MS;
  }
  s.onExit = done;
  wake();
}
function fail(reason = 'webgl') {
  dispose();
  window.SomaModel.onFail?.(reason);
}
function dispose() {
  if (!s) return;
  if (s.raf) cancelAnimationFrame(s.raf);
  for (const v of s.links.values()) v.mat.dispose();
  s.scene.traverse((o) => {
    if (o.userData.shared) return;
    o.geometry?.dispose();
    if (o.material && !o.userData.sharedMaterial) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mat of mats) {
        if (mat.map && mat.map !== s.shadowTex) mat.map.dispose();
        mat.dispose();
      }
    }
  });
  s.shadowTex.dispose();
  s.canvas.removeEventListener('webglcontextlost', s.onLost);
  s.renderer.dispose();
  s.renderer.forceContextLoss?.();
  s.canvas.remove();
  s.labels.remove();
  document.getElementById('lift-caption')?.remove();
  s = null;
}

const ray = new Raycaster();
/** What is under a screen point: a part's id, 'sheet' for the lifted slide, or null. */
function hit(clientX, clientY) {
  if (!s || s.mode === 'exit' || s.t < 0.6) return null;
  const f = s.frame;
  ray.setFromCamera(new Vector2(((clientX - f.dx) / f.width) * 2 - 1, -((clientY - f.dy) / f.height) * 2 + 1), s.camera);
  const parts = [...s.parts.values()].filter((v) => v.data.visible && v.mesh);
  const meshes = [];
  for (const v of parts) v.inner.traverse((m) => m.isMesh && meshes.push([m, v.id]));
  const first = ray.intersectObjects(meshes.map(([m]) => m), false)[0];
  if (first) return meshes.find(([m]) => m === first.object)[1];
  return s.sheet && ray.intersectObject(s.sheet.paper, false).length ? 'sheet' : null;
}
/** Hovering a part lights it and names its role. */
function hover(id) {
  if (!s) return;
  for (const v of s.parts.values()) v.hover = v.id === id;
  wake();
}
/** Turns the model by a drag of dx, dy pixels; it stays where the learner leaves it. */
function drag(dx, dy) {
  if (!s) return;
  s.touched = true;
  s.turn = Math.max(-TURN_LIMIT, Math.min(TURN_LIMIT, s.turn + dx * 0.008));
  s.tip = Math.max(-TIP_LIMIT, Math.min(TIP_LIMIT, s.tip + dy * 0.004));
  wake();
}
/** Back to the view it lifted into. */
function resetView() {
  if (!s) return;
  s.turn = s.tip = 0;
  s.touched = false;
  s.idleSince = clock();
  wake();
}

window.SomaModel = {
  show,
  update,
  hide,
  dispose,
  hit,
  hover,
  drag,
  resetView,
  onFail: null,
  get active() {
    return Boolean(s);
  },
  get debug() {
    return typeof window.__liftNow === 'function' || window.__liftDebug === true ? s : null;
  },
};
