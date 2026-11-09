/**
 * Soma Lab: a seated study desk. The Lecture 14 slide hangs in front; its graph lifts off the slide and stands
 * over the desk within reach. Poke or pinch an edge to cut it; grab the bead on the probe edge's rail and slide it
 * to change that cost. Everything drawn comes from a LabState; the scene never computes a route or a caption.
 */
import { Grabbed, OneHandGrabbable, PokeInteractable, Pressed, RayInteractable, World, createSystem, type Entity } from '@iwsdk/core';
import {
  BoxGeometry, Color, CylinderGeometry, DirectionalLight, HemisphereLight, Mesh, MeshBasicMaterial,
  MeshStandardMaterial, PlaneGeometry, SphereGeometry, SRGBColorSpace, TextureLoader, Vector3,
} from 'three';
import type { LabState } from '../../src/lib/xr-lab/contract';
import { LAB_COST_RANGE } from '../../src/lib/xr-lab/contract';
import { openRecordedGraphLab } from '../../src/lib/xr-lab/recorded-graph-lab';
import { textPanel } from './text';

const SEATED_EYE = 1.15;
const DESK_TOP = 0.74;
/** The graph stands 0.16 m over the desk, centred 0.42 m ahead: inside a seated two-foot reach. */
const GRAPH = { width: 0.62, depth: 0.4, centre: new Vector3(0, DESK_TOP + 0.16, -0.42) };
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
  const label = textPanel(0.05, 0.03, { font: 150 });
  label.set([node.label]);
  label.mesh.position.copy(ball.position).add(new Vector3(0, 0.045, 0));
  world.scene.add(label.mesh);
}

// Edges: a thin rod to see, a thick invisible sleeve to poke or point at, and a cost tag.
type EdgeView = { rod: Mesh; entity: Entity; tag: ReturnType<typeof textPanel>; wasPressed: boolean };
const edgeViews = new Map<string, EdgeView>();
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
  const tag = textPanel(0.04, 0.026, { font: 150, background: 'rgba(16,20,24,0.85)' });
  tag.mesh.position.copy(middle).add(new Vector3(0, 0.02, 0));
  world.scene.add(tag.mesh);
  edgeViews.set(edge.id, { rod, entity, tag, wasPressed: false });
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
beadEntity.addComponent(OneHandGrabbable, {
  rotate: false,
  translate: true,
  translateMin: [railBase.x, railBase.y, railBase.z],
  translateMax: [railBase.x, railBase.y + RAIL.length, railBase.z],
});
const railTag = textPanel(0.13, 0.03, { font: 120 });
railTag.set([`Slide to change ${probe.from}–${probe.to}`]);
railTag.mesh.position.copy(railBase).add(new Vector3(0, RAIL.length + 0.035, 0));
world.scene.add(railTag.mesh);

// The caption board between the graph and the slide: the computed result and where the experiment came from.
const board = textPanel(0.9, 0.16, { background: 'rgba(16,20,24,0.9)', align: 'left', font: 46 });
board.mesh.position.set(0, DESK_TOP + 0.36, -0.78);
world.scene.add(board.mesh);

function render(next: LabState) {
  state = next;
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

// Hands: a press on an edge sleeve cuts or restores it; a grabbed bead sets the probe cost by its height.
class LabSystem extends createSystem({}) {
  update() {
    for (const [id, view] of edgeViews) {
      const pressed = view.entity.hasComponent(Pressed);
      if (pressed && !view.wasPressed) render(lab.toggleEdge(id));
      view.wasPressed = pressed;
    }
    const height = Math.min(Math.max(bead.position.y - railBase.y, 0), RAIL.length);
    const cost = Math.round((height / RAIL.length) * LAB_COST_RANGE.max);
    const current = state.edges.find((e) => e.id === state.probe.edgeId)!.cost;
    if (beadEntity.hasComponent(Grabbed)) {
      if (cost !== current) render(lab.setCost(state.probe.edgeId, cost));
    } else {
      bead.position.set(railBase.x, costToY(current), railBase.z);
    }
  }
}
world.registerSystem(LabSystem);
