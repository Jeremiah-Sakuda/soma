import * as THREE from 'three';
import type { SpatialObject } from '@/lib/domain/spatial-exploration';
import { ENGINE, camCentre, crankDegrees, engineRoleOf, enginePose, pistonPin, sparkGlow, strokeAt, type EngineRole } from '@/lib/domain/engine-kinematics';

/** Soma's built-in four-stroke cutaway, one named part at a time. Each part is built in
 * nominal engine units about its own pivot (the pose in engine-kinematics), scaled by the
 * part's size and turned by its rotation, so the assembly stays joined at every crank angle. */
const metal = (color: number, roughness = 0.38, metalness = 0.42) => new THREE.MeshStandardMaterial({ color, roughness, metalness, side: THREE.DoubleSide });
const COLORS = {
  aluminium: 0xc6cbd1, section: 0x6f8399, port: 0x3b4047, liner: 0x949ca5, piston: 0xdde0e4, ring: 0x4a5058,
  rod: 0x7f8995, crank: 0x6a737e, valve: 0xb3bac2, intakeSpring: 0x4f7fc8, exhaustSpring: 0xd26b3a,
  cam: 0x5d6671, bronze: 0xc59a46, belt: 0x2c2e33, ceramic: 0xf3f0e7, steel: 0x9aa1a9,
};
// The cam drive runs behind the engine's back wall, so it never crosses the cutaway.
const DRIVE_Z = -0.86;
const CHARGE: Record<string, number> = { intake: 0x6fb6ff, compression: 0x3f8ff0, power: 0xff7a2a, exhaust: 0x8f857a };

function shape(points: [number, number][]) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  return s;
}
/** A section of the block: the outline extruded back from the cut plane (z = 0), cut face red. */
function section(outline: [number, number][], holes: [number, number][][], back: number, materials: THREE.Material[]) {
  const s = shape(outline);
  for (const h of holes) s.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))));
  const g = new THREE.ExtrudeGeometry(s, { depth: back, bevelEnabled: false, curveSegments: 24 });
  g.translate(0, 0, -back);
  return new THREE.Mesh(g, materials);
}
function gear(radius: number, teeth: number, depth: number, material: THREE.Material) {
  const s = new THREE.Shape();
  for (let i = 0; i <= teeth * 4; i++) {
    const a = (i / (teeth * 4)) * Math.PI * 2, r = i % 4 === 1 || i % 4 === 2 ? radius : radius * 0.9;
    if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    else s.moveTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const hub = new THREE.Path();
  hub.absarc(0, 0, radius * 0.18, 0, Math.PI * 2, true);
  s.holes.push(hub);
  // Spokes leave windows, so a turn is easy to see.
  for (let k = 0; k < 5; k++) {
    const a0 = (k / 5) * Math.PI * 2 + 0.22, a1 = ((k + 1) / 5) * Math.PI * 2 - 0.22, w = new THREE.Path();
    w.absarc(0, 0, radius * 0.68, a0, a1, false);
    w.absarc(0, 0, radius * 0.34, a1, a0, true);
    s.holes.push(w);
  }
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: depth * 0.15, bevelSize: radius * 0.02, bevelSegments: 2, curveSegments: 18 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, material);
}
function mark(radius: number, at: number, z: number) {
  const dot = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 0.02, 20), new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.4 }));
  dot.rotation.x = Math.PI / 2;
  dot.position.set(0, at, z);
  return dot;
}
function cylinderZ(radius: number, from: number, to: number, material: THREE.Material, x = 0, y = 0, segments = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, Math.abs(to - from), segments), material);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, (from + to) / 2);
  return m;
}
function tubeThrough(points: THREE.Vector3[], radius: number, material: THREE.Material, closed = false) {
  return new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed, 'centripetal'), points.length * 12, radius, 10, closed), material);
}
function flowArrow(points: THREE.Vector3[], color: number, open: number) {
  const g = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.6, transparent: true, opacity: 0.55 + 0.4 * open, roughness: 0.45, depthWrite: false });
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
  const head = 0.24, length = curve.getLength(), end = 1 - head / length;
  const shaft = curve.getSpacedPoints(48).slice(0, Math.floor(48 * end));
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(shaft), 48, 0.06, 12, false), material));
  const tip = curve.getPoint(1), dir = curve.getTangent(1).normalize();
  const cone = new THREE.Mesh(new THREE.ConeGeometry(0.13, head, 20), material);
  cone.position.copy(tip).sub(dir.clone().multiplyScalar(head / 2));
  cone.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
  g.add(cone);
  return g;
}

function block(): THREE.Object3D {
  const g = new THREE.Group();
  const cut = new THREE.MeshStandardMaterial({ color: COLORS.section, roughness: 0.62, metalness: 0.05 });
  const body = metal(COLORS.aluminium, 0.46, 0.35);
  // The back half of the engine, cut through the cylinder's axis: crankcase, block and head.
  const outline: [number, number][] = [
    [-0.92, -1.02], [0.92, -1.02], [1.12, -0.62], [1.12, 0.86], [0.86, 1.24], [0.86, 2.75], [1.0, 2.75], [1.0, 3.42],
    [-1.0, 3.42], [-1.0, 2.75], [-0.86, 2.75], [-0.86, 1.24], [-1.12, 0.86], [-1.12, -0.62],
  ];
  const hollow: [number, number][] = [
    [-0.98, -0.9], [0.98, -0.9], [0.98, 0.82], [0.5, 1.16], [0.5, ENGINE.deck], [0.06, ENGINE.roof], [-0.06, ENGINE.roof], [-0.5, ENGINE.deck], [-0.5, 1.16], [-0.98, 0.82],
  ];
  g.add(section(outline, [hollow], 0.62, [cut, body]));
  // The back wall closes the section, so the cavity reads as the inside of the engine.
  const wall = new THREE.Mesh(new THREE.ExtrudeGeometry(shape(outline), { depth: 0.1, bevelEnabled: false }), body);
  wall.position.z = -0.72;
  g.add(wall);
  // The bore: a smooth half liner the piston slides in.
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, ENGINE.deck - 1.16, 48, 1, true, Math.PI / 2, Math.PI), metal(COLORS.liner, 0.3, 0.55));
  liner.position.y = (ENGINE.deck + 1.16) / 2;
  g.add(liner);
  // Ports through the head: dark channels on the cut face, from each valve seat to the side.
  const portMaterial = new THREE.MeshStandardMaterial({ color: COLORS.port, roughness: 0.8 });
  for (const side of [-1, 1] as const) {
    const sx = side * ENGINE.valveSeatX;
    const port = shape([
      [sx - 0.15, ENGINE.seatY + 0.04 * side], [sx + 0.15, ENGINE.seatY - 0.04 * side], [side * 1.0, 3.28], [side * 1.0, 3.04],
    ].map(([x, y]) => [x, y]) as [number, number][]);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(port), portMaterial);
    m.position.z = 0.004;
    g.add(m);
  }
  // Bearings the crank and camshafts turn in, set into the back wall.
  g.add(cylinderZ(0.2, -0.72, -0.6, metal(COLORS.steel)));
  for (const side of [-1, 1] as const) {
    const c = camCentre(side);
    const tower = new THREE.Mesh(new THREE.BoxGeometry(0.34, c.y - 3.42 + 0.02, 0.18), body);
    tower.position.set(c.x, (c.y + 3.42) / 2 - 0.01, -0.5);
    g.add(tower);
  }
  return g;
}

function piston(): THREE.Object3D {
  const g = new THREE.Group();
  const body = metal(COLORS.piston, 0.3, 0.5);
  const profile = [
    new THREE.Vector2(0, -ENGINE.pinToSkirt + 0.12), new THREE.Vector2(0.47, -ENGINE.pinToSkirt), new THREE.Vector2(0.485, -ENGINE.pinToSkirt + 0.02),
    new THREE.Vector2(0.485, ENGINE.pinToCrown - 0.03), new THREE.Vector2(0.47, ENGINE.pinToCrown), new THREE.Vector2(0, ENGINE.pinToCrown),
  ];
  g.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 64), body));
  const ring = metal(COLORS.ring, 0.5, 0.3);
  for (const y of [0.25, 0.19, 0.13]) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.487, 0.008, 6, 64), ring);
    r.rotation.x = Math.PI / 2;
    r.position.y = y;
    g.add(r);
  }
  return g;
}

function rod(): THREE.Object3D {
  const g = new THREE.Group();
  const m = metal(COLORS.rod, 0.34, 0.55);
  const big = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 12, 40), m);
  big.scale.z = 2.2;
  g.add(big);
  const small = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.035, 10, 32), m);
  small.scale.z = 2.2;
  small.position.y = ENGINE.rod;
  g.add(small);
  // An I-beam shank, tapering toward the piston.
  const beam = shape([[-0.085, 0.16], [0.085, 0.16], [0.055, ENGINE.rod - 0.1], [-0.055, ENGINE.rod - 0.1]]);
  const shank = new THREE.Mesh(new THREE.ExtrudeGeometry(beam, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 }), m);
  shank.position.z = -0.05;
  g.add(shank);
  return g;
}

function crank(): THREE.Object3D {
  const g = new THREE.Group();
  const m = metal(COLORS.crank, 0.32, 0.6);
  g.add(cylinderZ(0.14, DRIVE_Z, 0.28, m));
  g.add(cylinderZ(0.12, -0.13, 0.13, m, 0, ENGINE.crank));
  // Two webs, each a counterweight opposite the pin.
  const web = new THREE.Shape();
  web.moveTo(-0.16, ENGINE.crank);
  web.absarc(0, ENGINE.crank, 0.17, Math.PI, 0, true);
  web.lineTo(0.2, 0);
  web.absarc(0, 0, 0.56, -0.25, Math.PI + 0.25, true);
  web.lineTo(-0.16, ENGINE.crank);
  for (const z of [-0.2, 0.13]) {
    const w = new THREE.Mesh(new THREE.ExtrudeGeometry(web, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 24 }), m);
    w.position.z = z;
    g.add(w);
  }
  // The small crank sprocket of the 2 : 1 timing drive, with its timing mark.
  const sprocket = gear(0.24, 18, 0.06, metal(COLORS.bronze, 0.35, 0.6));
  sprocket.position.z = DRIVE_Z;
  g.add(sprocket);
  return g;
}

function valve(side: -1 | 1): THREE.Object3D {
  const g = new THREE.Group();
  const m = metal(COLORS.valve, 0.3, 0.55);
  const head = new THREE.LatheGeometry([new THREE.Vector2(0, -0.02), new THREE.Vector2(0.17, -0.02), new THREE.Vector2(0.17, 0.0), new THREE.Vector2(0.05, 0.1), new THREE.Vector2(0.034, 0.16), new THREE.Vector2(0.034, ENGINE.stem), new THREE.Vector2(0, ENGINE.stem)], 40);
  g.add(new THREE.Mesh(head, m));
  // Its spring, coloured for which valve it is: blue lets the charge in, orange lets exhaust out.
  const spring = metal(side < 0 ? COLORS.intakeSpring : COLORS.exhaustSpring, 0.4, 0.3);
  const coil = Array.from({ length: 97 }, (_, i) => {
    const t = i / 96, a = t * Math.PI * 2 * 5.5;
    return new THREE.Vector3(Math.cos(a) * 0.1, 0.62 + t * 0.34, Math.sin(a) * 0.1);
  });
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 192, 0.016, 6, false), spring));
  const retainer = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.04, 28), m);
  retainer.position.y = 0.98;
  g.add(retainer);
  return g;
}

function cam(): THREE.Object3D {
  const g = new THREE.Group();
  const m = metal(COLORS.cam, 0.3, 0.6);
  // The lobe: a base circle with a nose that lifts the valve over a quarter turn of the cam.
  const lobe = new THREE.Shape();
  for (let i = 0; i <= 96; i++) {
    const phi = (i / 96) * Math.PI * 2, off = Math.atan2(Math.sin(phi), Math.cos(phi));
    const lift = Math.abs(off) < Math.PI / 4 ? ENGINE.valveLift * Math.cos(off * 2) ** 2 : 0;
    const r = ENGINE.camBase + lift, x = Math.sin(phi) * r, y = -Math.cos(phi) * r;
    if (i) lobe.lineTo(x, y);
    else lobe.moveTo(x, y);
  }
  const l = new THREE.Mesh(new THREE.ExtrudeGeometry(lobe, { depth: 0.2, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.012, bevelSegments: 2 }), m);
  l.position.z = -0.1;
  g.add(l);
  g.add(cylinderZ(0.07, DRIVE_Z, 0.2, m));
  // The big cam sprocket, behind the cam: twice the crank's, so the cam turns once per two
  // crank turns. Its bright mark shows how far it has turned.
  const sprocket = gear(0.46, 36, 0.06, metal(COLORS.bronze, 0.35, 0.6));
  sprocket.position.z = DRIVE_Z;
  g.add(sprocket);
  g.add(mark(0.07, 0.34, DRIVE_Z + 0.04));
  return g;
}

function plug(): THREE.Object3D {
  const g = new THREE.Group();
  const steel = metal(COLORS.steel, 0.35, 0.6);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.08, 8).translate(0, 0.02, 0), steel));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.42, 24).translate(0, 0.27, 0), steel));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 6).translate(0, 0.54, 0), metal(0x8a9199, 0.32, 0.6)));
  const insulator = new THREE.LatheGeometry([new THREE.Vector2(0.1, 0.6), new THREE.Vector2(0.095, 0.7), new THREE.Vector2(0.075, 0.74), new THREE.Vector2(0.075, 0.98), new THREE.Vector2(0.0, 0.98)], 32);
  g.add(new THREE.Mesh(insulator, new THREE.MeshStandardMaterial({ color: COLORS.ceramic, roughness: 0.25, metalness: 0 })));
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16).translate(0, 1.02, 0), steel));
  return g;
}

function belt(): THREE.Object3D {
  // A closed belt round the crank sprocket and both cam sprockets, on the front of the engine.
  const [l, r] = [camCentre(-1), camCentre(1)];
  const around = (cx: number, cy: number, radius: number, from: number, to: number, n: number) =>
    Array.from({ length: n }, (_, i) => {
      const a = ((from + ((to - from) * i) / (n - 1)) * Math.PI) / 180;
      return new THREE.Vector3(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius, DRIVE_Z);
    });
  const points = [
    ...around(0, 0, 0.27, 200, 340, 6),
    ...around(r.x, r.y, 0.49, -20, 95, 7),
    ...around(l.x, l.y, 0.49, 85, 200, 7),
  ];
  return tubeThrough(points, 0.03, new THREE.MeshStandardMaterial({ color: COLORS.belt, roughness: 0.7, metalness: 0.05 }), true);
}

function charge(theta: number): THREE.Object3D {
  const g = new THREE.Group();
  const stroke = strokeAt(theta), crown = pistonPin(theta) + ENGINE.pinToCrown;
  const gap = Math.max(0.02, ENGINE.deck - crown - 0.012);
  const heat = stroke === 'power' ? Math.max(0.25, 1 - (theta - 360) / 200) : 0;
  const color = CHARGE[stroke];
  const material = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: stroke === 'power' ? 0.5 + heat : stroke === 'compression' ? 0.25 + 0.3 * ((theta - 180) / 180) : 0.15,
    transparent: true, opacity: stroke === 'power' ? 0.6 + 0.25 * heat : 0.58, roughness: 0.9, depthWrite: false, side: THREE.DoubleSide,
  });
  // The gas fills the cut-away half of the cylinder above the crown, and the pent roof.
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, gap, 40, 1, false, Math.PI / 2, Math.PI), material);
  body.position.y = 0.012 + gap / 2;
  g.add(body);
  const roof = new THREE.Shape();
  roof.moveTo(-0.49, 0);
  roof.lineTo(0.49, 0);
  roof.lineTo(0.06, ENGINE.roof - ENGINE.deck);
  roof.lineTo(-0.06, ENGINE.roof - ENGINE.deck);
  roof.closePath();
  const cap = new THREE.Mesh(new THREE.ExtrudeGeometry(roof, { depth: 0.49, bevelEnabled: false }), material);
  cap.position.set(0, 0.012 + gap, -0.49);
  g.add(cap);
  return g;
}

function spark(theta: number): THREE.Object3D {
  const g = new THREE.Group(), glow = sparkGlow(theta);
  const core = new THREE.MeshStandardMaterial({ color: 0xfff6c8, emissive: 0xffe48a, emissiveIntensity: 2.2 * glow + 0.6, transparent: true, opacity: 0.4 + 0.6 * glow, depthWrite: false });
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.08 + 0.1 * glow, 20, 14), core));
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2, ray = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.003, 0.22 + 0.2 * glow, 6), core);
    ray.position.set(Math.cos(a) * 0.16, -0.03 + Math.sin(a) * 0.1, 0.1);
    ray.rotation.z = a - Math.PI / 2;
    g.add(ray);
  }
  return g;
}

function flow(which: 'intake' | 'exhaust', theta: number): THREE.Object3D {
  const open = enginePose(which === 'intake' ? 'intake_flow' : 'exhaust_flow', theta).open;
  const side = which === 'intake' ? -1 : 1;
  const points = [
    new THREE.Vector3(side * 1.45, 3.18, 0.14), new THREE.Vector3(side * 0.75, 3.06, 0.14),
    new THREE.Vector3(side * 0.34, 2.8, 0.14), new THREE.Vector3(side * 0.22, 2.58, 0.14),
  ];
  return flowArrow(which === 'intake' ? points : [...points].reverse(), which === 'intake' ? 0x6fb3ff : 0xc0703e, open);
}

function build(role: EngineRole, theta: number): THREE.Object3D {
  switch (role) {
    case 'block': return block();
    case 'piston': return piston();
    case 'rod': return rod();
    case 'crank': return crank();
    case 'intake_valve': return valve(-1);
    case 'exhaust_valve': return valve(1);
    case 'intake_cam': case 'exhaust_cam': return cam();
    case 'spark_plug': return plug();
    case 'timing_belt': return belt();
    case 'charge': return charge(theta);
    case 'spark': return spark(theta);
    case 'intake_flow': return flow('intake', theta);
    case 'exhaust_flow': return flow('exhaust', theta);
  }
}

/** Parts whose shape changes with the angle; every other part is the same mesh, turned or moved. */
export const engineChangesShape = (renderStyle: string | null | undefined) => {
  const role = engineRoleOf(renderStyle);
  return role === 'charge' || role === 'spark' || role === 'intake_flow' || role === 'exhaust_flow';
};
// Built once per page: a turning crank reuses the meshes, with materials of its own.
const templates = new Map<EngineRole, THREE.Object3D>();
function instance(role: EngineRole, theta: number) {
  if (role === 'charge' || role === 'spark' || role === 'intake_flow' || role === 'exhaust_flow') return build(role, theta);
  let template = templates.get(role);
  if (!template) templates.set(role, (template = build(role, 0)));
  const copy = template.clone(true);
  copy.traverse((item) => {
    if (item instanceof THREE.Mesh) item.material = Array.isArray(item.material) ? item.material.map((m) => m.clone()) : item.material.clone();
  });
  return copy;
}

/** One engine part, or null when the object is not one. Highlighted parts glow faintly in their
 * own colour; a picked part glows in the selection colour. */
export function createEnginePart(object: SpatialObject, selected: boolean): THREE.Group | null {
  const role = engineRoleOf(object.renderStyle);
  if (!role) return null;
  const theta = crankDegrees(object.parameterValues?.crank ?? 0);
  const root = new THREE.Group(), inner = instance(role, theta);
  root.add(inner);
  root.traverse((item) => {
    if (!(item instanceof THREE.Mesh)) return;
    item.userData.objectId = object.id;
    item.castShadow = role !== 'charge' && role !== 'spark' && role !== 'intake_flow' && role !== 'exhaust_flow';
    item.receiveShadow = true;
    const materials = Array.isArray(item.material) ? item.material : [item.material];
    for (const m of materials)
      if (m instanceof THREE.MeshStandardMaterial && (selected || object.highlighted) && role !== 'spark' && role !== 'charge') {
        m.emissive = new THREE.Color(selected ? 0x5551f5 : m.color.getHex());
        m.emissiveIntensity = selected ? 0.35 : 0.22;
      }
  });
  root.scale.setScalar(object.size.x);
  root.position.set(object.position.x, object.position.y, object.position.z);
  if (object.rotation) root.rotation.set(0, 0, (object.rotation.z * Math.PI) / 180);
  return root;
}
