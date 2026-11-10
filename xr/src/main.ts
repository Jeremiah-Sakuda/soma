/**
 * Soma Lab: a seated study desk. The Lecture 14 slide hangs in front; its graph lifts off the slide and stands
 * over the desk within reach. Poke or pinch an edge to cut it; grab the bead on the probe edge's rail and slide it
 * to change that cost. Everything drawn comes from a LabState; the scene never computes a route or a caption.
 */
import { PokeInteractable, RayInteractable, World, createSystem } from '@iwsdk/core';
import type {} from '@pmndrs/pointer-events';
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, Plane, PlaneGeometry, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3,
} from 'three';
import type { LabState } from '../../src/lib/xr-lab/contract';
import { LAB_COST_RANGE } from '../../src/lib/xr-lab/contract';
import { openRecordedGraphLab } from '../../src/lib/xr-lab/recorded-graph-lab';
import { textPanel } from './text';


const SEATED_EYE = 1.15;
const DESK_TOP = 0.74;
/** The graph stands 0.14 m over the desk, centred 0.45 m ahead: about 50 degrees wide, inside a seated two-foot reach. */
const GRAPH = { width: 0.42, depth: 0.26, centre: new Vector3(0, DESK_TOP + 0.14, -0.45) };
/** The probe rail: 10 cm of travel maps onto the full cost range. */
const RAIL = { length: 0.1 };

const world = await World.create(document.getElementById('app')!, {
  xr: { offer: 'always' },
  render: { camera: { position: [0, SEATED_EYE, 0], lookAt: [0, DESK_TOP + 0.12, -0.55] } },
  features: { grabbing: { useHandPinchForGrab: true }, spatialUI: true },
});

world.scene.background = new Color(0x0f1316);
world.scene.add(new HemisphereLight(0xdfe8ff, 0x2a2420, 1.1));
const key = new DirectionalLight(0xfff1dc, 1.5);
key.position.set(0.6, 2.2, 0.8);
world.scene.add(key);

const desk = new Mesh(new BoxGeometry(1.4, 0.04, 0.75), new MeshStandardMaterial({ color: 0x4f3d2f, roughness: 0.85 }));
desk.position.set(0, DESK_TOP - 0.02, -0.5);
world.scene.add(desk);
const slideTexture = new TextureLoader().load('./lecture-14-dijkstra.png');
slideTexture.colorSpace = SRGBColorSpace;
const slide = new Mesh(new PlaneGeometry(1.6, 0.9), new MeshBasicMaterial({ map: slideTexture }));
slide.position.set(0, 1.5, -1.3);
world.scene.add(slide);

const lab = openRecordedGraphLab();
let state = lab.state();

/** Slide coordinates (0..1) onto the desk. The slide's graph occupies roughly x 0.1–0.55, y 0.4–0.72. */
function place(x: number, y: number): Vector3 {
  return new Vector3(
    GRAPH.centre.x + ((x - 0.32) / 0.45) * GRAPH.width,
    GRAPH.centre.y,
    GRAPH.centre.z + ((y - 0.56) / 0.3) * GRAPH.depth,
  );
}
const at = new Map(state.nodes.map((n) => [n.id, place(n.x, n.y)]));

const ink = new MeshStandardMaterial({ color: 0xd8dde4, roughness: 0.6 });
const routeInk = new MeshStandardMaterial({ color: 0xffb54a, emissive: 0x7a4300, roughness: 0.4 });
const cutInk = new MeshStandardMaterial({ color: 0x5a6068, transparent: true, opacity: 0.3 });
const probeInk = new MeshStandardMaterial({ color: 0x7fd3ff, emissive: 0x0c3a52, roughness: 0.4 });
const hitbox = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

// Nodes with labels.
const nodeMeshes = new Map<string, Mesh>();
for (const node of state.nodes) {
  const ball = new Mesh(new SphereGeometry(0.02, 24, 16), ink);
  ball.position.copy(at.get(node.id)!);
  world.scene.add(ball);
  nodeMeshes.set(node.id, ball);
  const label = textPanel(0.06, 0.036, { font: 190 });
  label.set([node.label]);
  label.mesh.position.copy(ball.position).add(new Vector3(0, 0.05, 0));
  world.scene.add(label.mesh);
}

// Edges: a thin rod to see, a thick invisible sleeve to poke or point at, and a cost tag.
type EdgeView = { rod: Mesh; tag: ReturnType<typeof textPanel> };
const edgeViews = new Map<string, EdgeView>();
let pressedEdge: string | null = null;
for (const edge of state.edges) {
  const a = at.get(edge.from)!, b = at.get(edge.to)!;
  const middle = a.clone().add(b).multiplyScalar(0.5);
  const up = new Vector3(0, 1, 0), along = b.clone().sub(a).normalize();
  const rod = new Mesh(new CylinderGeometry(0.004, 0.004, a.distanceTo(b), 10), ink);
  rod.position.copy(middle);
  rod.quaternion.setFromUnitVectors(up, along);
  world.scene.add(rod);
  const sleeve = new Mesh(new CylinderGeometry(0.016, 0.016, a.distanceTo(b) * 0.7, 10), hitbox);
  sleeve.position.copy(middle);
  sleeve.quaternion.copy(rod.quaternion);
  const entity = world.createTransformEntity(sleeve);
  entity.addComponent(RayInteractable);
  entity.addComponent(PokeInteractable);
  // A press commits on release over the same edge: a poke, a pinch along the hand's ray, or a mouse on desktop.
  sleeve.addEventListener('pointerdown', () => (pressedEdge = edge.id));
  sleeve.addEventListener('pointerup', () => {
    if (pressedEdge === edge.id) render(lab.toggleEdge(edge.id));
    pressedEdge = null;
  });
  const tag = textPanel(0.04, 0.026, { font: 150, background: 'rgba(16,20,24,0.85)' });
  tag.mesh.position.copy(middle).add(new Vector3(0, 0.02, 0));
  world.scene.add(tag.mesh);
  edgeViews.set(edge.id, { rod, tag });
}

// The probe: a vertical rail above the probe edge, and a bead to slide along it.
const probe = state.edges.find((e) => e.id === state.probe.edgeId)!;
const railBase = at.get(probe.from)!.clone().add(at.get(probe.to)!).multiplyScalar(0.5).add(new Vector3(0, 0.05, 0));
const rail = new Mesh(new CylinderGeometry(0.0025, 0.0025, RAIL.length, 8), probeInk);
rail.position.copy(railBase).add(new Vector3(0, RAIL.length / 2, 0));
world.scene.add(rail);
const bead = new Mesh(new SphereGeometry(0.016, 20, 14), probeInk);
const costToY = (cost: number) => railBase.y + (cost / LAB_COST_RANGE.max) * RAIL.length;
bead.position.set(railBase.x, costToY(probe.cost), railBase.z);
const beadEntity = world.createTransformEntity(bead);
beadEntity.addComponent(RayInteractable);
beadEntity.addComponent(PokeInteractable);
// A larger invisible grip makes the bead easy to catch with a ray or a fingertip.
bead.add(new Mesh(new SphereGeometry(0.035, 12, 8), hitbox));
// Press the bead and move: the pointer is captured, and its ray is projected onto the rail's vertical plane.
let dragging = false;
const railPlane = new Plane();
const hit = new Vector3();
bead.addEventListener('pointerdown', (event) => {
  dragging = true;
  bead.setPointerCapture(event.pointerId);
});
bead.addEventListener('pointermove', (event) => {
  if (!dragging) return;
  const facing = event.ray.origin.clone().sub(railBase).setY(0);
  if (facing.lengthSq() < 1e-6) return;
  railPlane.setFromNormalAndCoplanarPoint(facing.normalize(), railBase);
  if (!event.ray.intersectPlane(railPlane, hit)) return;
  const height = Math.min(Math.max(hit.y - railBase.y, 0), RAIL.length);
  const cost = Math.round((height / RAIL.length) * LAB_COST_RANGE.max);
  if (cost !== state.edges.find((e) => e.id === state.probe.edgeId)!.cost) render(lab.setCost(state.probe.edgeId, cost));
});
const endDrag = (event: { pointerId: number }) => {
  dragging = false;
  if (bead.hasPointerCapture(event.pointerId)) bead.releasePointerCapture(event.pointerId);
};
bead.addEventListener('pointerup', endDrag);
bead.addEventListener('pointercancel', endDrag);
const railTag = textPanel(0.13, 0.03, { font: 120, align: 'left' });
railTag.set([`Drag to change ${probe.from}–${probe.to}`]);
railTag.mesh.position.copy(railBase).add(new Vector3(0.1, RAIL.length * 0.85, 0));
world.scene.add(railTag.mesh);

// The caption board between the graph and the slide: the computed result and where the experiment came from.
// It stands just behind the graph and tilts toward the seated eye, so it reads while looking down at the graph,
// and its lower edge stays above the line of sight to the farthest nodes.
const board = textPanel(0.8, 0.14, { background: 'rgba(16,20,24,0.9)', align: 'left', font: 46 });
board.mesh.position.set(0, DESK_TOP + 0.29, -0.8);
board.mesh.lookAt(0, SEATED_EYE, 0);
world.scene.add(board.mesh);

// The recorded experiment's turning point, marked on the rail.
const tick = new Mesh(new CylinderGeometry(0.009, 0.009, 0.002, 20), routeInk);
tick.position.set(railBase.x, costToY(state.probe.criticalCost), railBase.z);
world.scene.add(tick);
const tickTag = textPanel(0.07, 0.022, { font: 120, align: 'left' });
tickTag.set([`turns at ${state.probe.criticalCost}`]);
tickTag.mesh.position.set(railBase.x + 0.05, costToY(state.probe.criticalCost), railBase.z);
world.scene.add(tickTag.mesh);

// Reset, within reach at the front of the desk.
const resetPlaque = textPanel(0.09, 0.035, { font: 150, background: 'rgba(40,46,54,0.95)' });
resetPlaque.set(['Reset']);
resetPlaque.mesh.position.set(-0.3, DESK_TOP + 0.03, -0.28);
resetPlaque.mesh.lookAt(0, SEATED_EYE, 0);
const resetEntity = world.createTransformEntity(resetPlaque.mesh);
resetEntity.addComponent(RayInteractable);
resetEntity.addComponent(PokeInteractable);
let resetPressed = false;
resetPlaque.mesh.addEventListener('pointerdown', () => (resetPressed = true));
resetPlaque.mesh.addEventListener('pointerup', () => {
  if (resetPressed) render(lab.reset());
  resetPressed = false;
});

// A bright pulse runs along the route whenever it changes, so the eye follows the consequence.
const pulse = new Mesh(new SphereGeometry(0.012, 16, 12), new MeshBasicMaterial({ color: 0xfff1c4 }));
pulse.visible = false;
world.scene.add(pulse);
let pulseRoute: Vector3[] = [];
let pulseT = 0;

function render(next: LabState) {
  const previous = state.path?.join('>');
  state = next;
  if (next.path && next.path.join('>') !== previous) {
    pulseRoute = next.path.map((id) => at.get(id)!);
    pulseT = 0;
  }
  for (const node of next.nodes) nodeMeshes.get(node.id)!.material = next.path?.includes(node.id) ? routeInk : ink;
  for (const edge of next.edges) {
    const view = edgeViews.get(edge.id)!;
    view.rod.material = !edge.enabled ? cutInk : edge.onPath ? routeInk : edge.id === next.probe.edgeId ? probeInk : ink;
    view.tag.set([edge.enabled ? String(edge.cost) : '✕']);
  }
  const route = next.path ? `Route ${next.path.join(' → ')} · cost ${next.totalCost}` : 'No route to the goal';
  board.set([route, next.caption, `Experiment chosen in a ${next.provenance.label}; results computed now by Soma's Dijkstra.`]);
}
render(state);
// A release anywhere else abandons the press.
window.addEventListener('pointerup', () => queueMicrotask(() => (pressedEdge = null)));

// The bead always shows the current probe cost: it moves in whole steps while dragged and follows a reset.
class LabSystem extends createSystem({}) {
  delta = 0;
  update(delta: number) {
    this.delta = delta;
    const current = state.edges.find((e) => e.id === state.probe.edgeId)!.cost;
    bead.position.set(railBase.x, costToY(current), railBase.z);
    // The pulse crosses one route segment every 0.35 s, then rests.
    if (pulseRoute.length > 1 && pulseT < pulseRoute.length - 1) {
      pulseT = Math.min(pulseRoute.length - 1, pulseT + this.delta / 0.35);
      const i = Math.min(Math.floor(pulseT), pulseRoute.length - 2);
      pulse.position.lerpVectors(pulseRoute[i], pulseRoute[i + 1], pulseT - i).add(new Vector3(0, 0.004, 0));
      pulse.visible = pulseT < pulseRoute.length - 1;
    } else pulse.visible = false;
  }
}
world.registerSystem(LabSystem);

// Local checks only: publish the bead's position and the lab result as page attributes, which emulator tests read.
// Never set on a hosted page.
if (['127.0.0.1', 'localhost'].includes(location.hostname)) {
  const root = document.documentElement;
  setInterval(() => {
    root.dataset.somaBead = JSON.stringify(bead.getWorldPosition(new Vector3()).toArray());
    root.dataset.somaRail = JSON.stringify(railBase.toArray());
    root.dataset.somaResult = JSON.stringify({ path: state.path, cost: state.totalCost, probe: state.edges.find((e) => e.id === state.probe.edgeId)?.cost, caption: state.caption });
  }, 200);
}
