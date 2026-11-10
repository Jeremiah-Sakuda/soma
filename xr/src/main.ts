/**
 * Soma Lab: a seated study desk. The Lecture 14 slide hangs in front; its graph lifts off the slide and stands
 * over the desk within reach. Poke or pinch an edge to cut it; grab the bead on the probe edge's rail and slide it
 * to change that cost. Everything drawn comes from a LabState; the scene never computes a route or a caption.
 */
import { PokeInteractable, RayInteractable, World, createSystem } from '@iwsdk/core';
import type {} from '@pmndrs/pointer-events';
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Plane,
  PlaneGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TextureLoader,
  Vector3,
} from 'three';
import type { LabState } from '../../src/lib/xr-lab/contract';
import { LAB_COST_RANGE } from '../../src/lib/xr-lab/contract';
import { openRecordedGraphLab } from '../../src/lib/xr-lab/recorded-graph-lab';
import { textPanel } from './text';
import { circuitQuantity } from '../../src/lib/domain/exploration-view';
import { createCircuitScene } from './circuit-scene';
import { readFinding, saveFinding, studyButton } from './study-controls';
import {
  circuitRecipe,
  graphRecipe,
  replayFinding,
  type Finding,
  type LabId,
} from './finding-replay';
import { createFrameSampler, type FrameSampleReport } from './frame-sample';
import './desk.css';

const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id)! as T;
const status = element('desk-status');
const controls = element('controls');
const controlsButton = element<HTMLButtonElement>('desk-controls');
controlsButton.addEventListener('click', () => {
  controls.hidden = !controls.hidden;
  controlsButton.setAttribute('aria-expanded', String(!controls.hidden));
});
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

const SEATED_EYE = 1.15;
const DESK_TOP = 0.74;
/** The graph stands 0.14 m over the desk, centred 0.45 m ahead: about 50 degrees wide, inside a seated two-foot reach. */
const GRAPH = { width: 0.42, depth: 0.26, centre: new Vector3(0, DESK_TOP + 0.14, -0.45) };
/** The probe rail: 10 cm of travel maps onto the full cost range. */
const RAIL = { length: 0.1 };

const world = await World.create(document.getElementById('app')!, {
  xr: { offer: 'always', features: { handTracking: { required: true } } },
  render: { camera: { position: [0, SEATED_EYE, 0], lookAt: [0, DESK_TOP + 0.17, -0.55] } },
  features: { grabbing: { useHandPinchForGrab: true }, spatialUI: true },
}).catch((error: unknown) => {
  status.textContent = 'The 3D desk could not start. This browser needs WebGL to render it.';
  element<HTMLButtonElement>('desk-controls').disabled = true;
  throw error;
});

const enter = element<HTMLButtonElement>('enter-vr');
if (navigator.xr) {
  void navigator.xr
    .isSessionSupported('immersive-vr')
    .then((supported) => {
      enter.hidden = !supported;
      if (supported)
        status.textContent = 'Sit comfortably and switch to hand tracking before entering VR.';
    })
    .catch(() => {});
}
enter.addEventListener('click', () => world.launchXR());
world.renderer.xr.addEventListener('sessionstart', () => {
  enter.disabled = true;
});
world.renderer.xr.addEventListener('sessionend', () => {
  enter.disabled = false;
});
status.textContent = 'Try D–F, or open Desk controls for keyboard access.';

world.scene.background = new Color(0x101819);
world.scene.add(new HemisphereLight(0xdfe8ff, 0x2a2420, 1.1));
const key = new DirectionalLight(0xfff1dc, 1.5);
key.position.set(0.6, 2.2, 0.8);
world.scene.add(key);

const desk = new Mesh(
  new BoxGeometry(1.4, 0.04, 0.75),
  new MeshStandardMaterial({ color: 0x4f3d2f, roughness: 0.85 }),
);
desk.position.set(0, DESK_TOP - 0.02, -0.5);
world.scene.add(desk);
const loader = new TextureLoader();
const slideTexture = loader.load('./lecture-14-dijkstra.png');
const circuitTexture = loader.load('./lecture-09-bridge.png');
slideTexture.colorSpace = circuitTexture.colorSpace = SRGBColorSpace;
const slideMaterial = new MeshBasicMaterial({ map: slideTexture });
const slide = new Mesh(new PlaneGeometry(0.53, 0.298125), slideMaterial);
slide.position.set(-0.3, 1.014, -1.03);
slide.lookAt(slide.position.x, SEATED_EYE, 0);
world.scene.add(slide);
const graphRoot = new Group();
const circuitRoot = new Group();
circuitRoot.visible = false;
const deskUI = new Group();
const graphEntity = world.createTransformEntity(graphRoot);
const deskEntity = world.createTransformEntity(deskUI);
let activeLab: LabId = 'graph';
let message = '';
const pinned = { graph: readFinding('graph'), circuit: readFinding('circuit') };
const replayable = {
  graph: replayFinding('graph', pinned.graph?.replay),
  circuit: replayFinding('circuit', pinned.circuit?.replay),
};
const sampler =
  new URLSearchParams(location.search).get('diagnostics') === '1' ? createFrameSampler() : null;
const samples: FrameSampleReport[] = [];

let lab = openRecordedGraphLab();
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
  graphRoot.add(ball);
  nodeMeshes.set(node.id, ball);
  const label = textPanel(0.06, 0.036, { font: 190 });
  label.set([node.label]);
  label.mesh.position.copy(ball.position).add(new Vector3(0, 0.05, 0));
  graphRoot.add(label.mesh);
}

// Edges: a thin rod to see, a thick invisible sleeve to poke or point at, and a cost tag.
const referenceInk = new MeshBasicMaterial({ color: 0x9dd9d4 });
type EdgeView = { rod: Mesh; tag: ReturnType<typeof textPanel>; reference: Group };
const edgeViews = new Map<string, EdgeView>();
const pressedEdges = new Map<number, string>();
for (const edge of state.edges) {
  const a = at.get(edge.from)!,
    b = at.get(edge.to)!;
  const middle = a.clone().add(b).multiplyScalar(0.5);
  const up = new Vector3(0, 1, 0),
    along = b.clone().sub(a).normalize();
  const rod = new Mesh(new CylinderGeometry(0.004, 0.004, a.distanceTo(b), 10), ink);
  rod.position.copy(middle);
  rod.quaternion.setFromUnitVectors(up, along);
  graphRoot.add(rod);
  const sleeve = new Mesh(new CylinderGeometry(0.016, 0.016, a.distanceTo(b) * 0.7, 10), hitbox);
  sleeve.position.copy(middle);
  sleeve.quaternion.copy(rod.quaternion);
  const entity = world.createTransformEntity(sleeve, graphEntity);
  entity.addComponent(RayInteractable);
  entity.addComponent(PokeInteractable);
  // A press commits on release over the same edge: a poke, a pinch along the hand's ray, or a mouse on desktop.
  graphRoot.add(sleeve);
  sleeve.pointerEventsType = () => graphRoot.visible;
  sleeve.addEventListener('pointerdown', ({ pointerId }) => pressedEdges.set(pointerId, edge.id));
  const cancel = ({ pointerId }: { pointerId: number }) => {
    if (pressedEdges.get(pointerId) === edge.id) pressedEdges.delete(pointerId);
  };
  sleeve.addEventListener('pointerleave', cancel);
  sleeve.addEventListener('pointercancel', cancel);
  sleeve.addEventListener('pointerup', ({ pointerId }) => {
    if (activeLab === 'graph' && pressedEdges.get(pointerId) === edge.id)
      render(lab.toggleEdge(edge.id));
    pressedEdges.delete(pointerId);
  });
  const tag = textPanel(0.04, 0.026, { font: 150, background: 'rgba(16,20,24,0.85)' });
  tag.mesh.position.copy(middle).add(new Vector3(0, 0.02, 0));
  graphRoot.add(tag.mesh);
  const reference = new Group();
  reference.visible = false;
  const geometry = new CylinderGeometry(0.0026, 0.0026, a.distanceTo(b) / 7, 8);
  for (const offset of [0.23, 0.5, 0.77]) {
    const dash = new Mesh(geometry, referenceInk);
    dash.position.lerpVectors(a, b, offset).y += 0.013;
    dash.quaternion.copy(rod.quaternion);
    reference.add(dash);
  }
  graphRoot.add(reference);
  edgeViews.set(edge.id, { rod, tag, reference });
}

// The probe: a vertical rail above the probe edge, and a bead to slide along it.
const probe = state.edges.find((e) => e.id === state.probe.edgeId)!;
const railBase = at
  .get(probe.from)!
  .clone()
  .add(at.get(probe.to)!)
  .multiplyScalar(0.5)
  .add(new Vector3(0, 0.05, 0));
const rail = new Mesh(new CylinderGeometry(0.0025, 0.0025, RAIL.length, 8), probeInk);
rail.position.copy(railBase).add(new Vector3(0, RAIL.length / 2, 0));
graphRoot.add(rail);
const bead = new Mesh(new SphereGeometry(0.016, 20, 14), probeInk);
const costToY = (cost: number) => railBase.y + (cost / LAB_COST_RANGE.max) * RAIL.length;
bead.position.set(railBase.x, costToY(probe.cost), railBase.z);
const beadEntity = world.createTransformEntity(bead, graphEntity);
beadEntity.addComponent(RayInteractable);
beadEntity.addComponent(PokeInteractable);
graphRoot.add(bead);
bead.pointerEventsType = () => graphRoot.visible;
// A larger invisible grip makes the bead easy to catch with a ray or a fingertip.
bead.add(new Mesh(new SphereGeometry(0.035, 12, 8), hitbox));
// Press the bead and move: the pointer is captured, and its ray is projected onto the rail's vertical plane.
let dragPointer: number | null = null;
const railPlane = new Plane();
const hit = new Vector3();
bead.addEventListener('pointerdown', (event) => {
  if (activeLab !== 'graph' || dragPointer !== null) return;
  dragPointer = event.pointerId;
  bead.setPointerCapture(event.pointerId);
});
bead.addEventListener('pointermove', (event) => {
  if (activeLab !== 'graph' || dragPointer !== event.pointerId) return;
  const facing = event.ray.origin.clone().sub(railBase).setY(0);
  if (facing.lengthSq() < 1e-6) return;
  railPlane.setFromNormalAndCoplanarPoint(facing.normalize(), railBase);
  if (!event.ray.intersectPlane(railPlane, hit)) return;
  const height = Math.min(Math.max(hit.y - railBase.y, 0), RAIL.length);
  const cost = Math.round((height / RAIL.length) * LAB_COST_RANGE.max);
  if (cost !== state.edges.find((e) => e.id === state.probe.edgeId)!.cost)
    render(lab.setCost(state.probe.edgeId, cost));
});
const endDrag = (event: { pointerId: number }) => {
  if (dragPointer !== event.pointerId) return;
  dragPointer = null;
  if (bead.hasPointerCapture(event.pointerId)) bead.releasePointerCapture(event.pointerId);
};
bead.addEventListener('pointerup', endDrag);
bead.addEventListener('pointercancel', endDrag);
// The caption board between the graph and the slide: the computed result and where the experiment came from.
// It stands just behind the graph and tilts toward the seated eye, so it reads while looking down at the graph,
// and its lower edge stays above the line of sight to the farthest nodes.
const board = textPanel(0.56, 0.21, { background: '#1b2b2c', align: 'left', font: 49 });
board.mesh.position.set(0.31, 1.035, -1.03);
board.mesh.lookAt(board.mesh.position.x, SEATED_EYE, 0);
world.scene.add(board.mesh);

// The recorded experiment's turning point, marked on the rail.
const tick = new Mesh(new CylinderGeometry(0.009, 0.009, 0.002, 20), routeInk);
tick.position.set(railBase.x, costToY(state.probe.criticalCost), railBase.z);
graphRoot.add(tick);
// Keep navigation and the experiment's result in the same seated view.
studyButton(world, deskEntity, 'Routes', [-0.21, 0.944, -0.66], 0.12, () => selectLab('graph'));
studyButton(world, deskEntity, 'Circuit', [-0.07, 0.944, -0.66], 0.12, () => selectLab('circuit'));
const findingButton = studyButton(
  world,
  deskEntity,
  'Pin finding',
  [0.08, 0.944, -0.66],
  0.15,
  findingAction,
);
studyButton(world, deskEntity, 'Reset', [0.27, 0.944, -0.66], 0.11, resetLab);
studyButton(world, graphEntity, '− D–F', [-0.08, 0.89, -0.287], 0.106, () => stepCost(-1));
studyButton(world, graphEntity, '+ D–F', [0.08, 0.89, -0.287], 0.106, () => stepCost(1));

// A bright pulse runs along the route whenever it changes, so the eye follows the consequence.
const pulse = new Mesh(
  new SphereGeometry(0.012, 16, 12),
  new MeshBasicMaterial({ color: 0xfff1c4 }),
);
pulse.visible = false;
graphRoot.add(pulse);
let pulseRoute: Vector3[] = [];
let pulseT = 0;

function render(next: LabState) {
  const previous = state.path?.join('>');
  state = next;
  if (!reducedMotion.matches && next.path && next.path.join('>') !== previous) {
    pulseRoute = next.path.map((id) => at.get(id)!);
    pulseT = 0;
  }
  for (const node of next.nodes)
    nodeMeshes.get(node.id)!.material = next.path?.includes(node.id) ? routeInk : ink;
  for (const edge of next.edges) {
    const view = edgeViews.get(edge.id)!;
    view.rod.material = !edge.enabled
      ? cutInk
      : edge.onPath
        ? routeInk
        : edge.id === next.probe.edgeId
          ? probeInk
          : ink;
    view.tag.set([edge.enabled ? String(edge.cost) : '✕']);
  }

  if (activeLab === 'graph') {
    message = '';
    refreshDesk();
  }
}

const circuit = createCircuitScene(world, circuitRoot, () => {
  if (activeLab === 'circuit') {
    message = '';
    refreshDesk();
  }
});
const initialCircuit = circuit.state();
const graphSummary = (s: LabState) =>
  s.path ? `${s.path.join(' → ')} · cost ${s.totalCost}` : 'No route to the goal';
const initialGraph = lab.state();
const initialGraphSummary = graphSummary(initialGraph);
const circuitSummary = (s: typeof initialCircuit) => {
  const r4 = s.parts.find(({ id }) => id === 'R4')!;
  const r5 = s.parts.find(({ id }) => id === 'R5')!;
  const current = r5.current;
  const value = r4.open ? 'R4 open' : `R4 ${r4.value} Ω`;
  const flow =
    current === null
      ? 'unavailable'
      : current === 0
        ? '0 A'
        : `${circuitQuantity(Math.abs(current), 'A')} ${current > 0 ? 'B → C' : 'C → B'}`;
  return `${value} · R5 ${flow}`;
};

function currentFinding(): Finding {
  const cs = activeLab === 'circuit' ? circuit.state() : null;
  return !cs
    ? { baseline: initialGraphSummary, result: graphSummary(state), caption: state.caption }
    : { baseline: circuitSummary(initialCircuit), result: circuitSummary(cs), caption: cs.caption };
}
function refreshDesk() {
  const graph = activeLab === 'graph';
  if (enter.hidden)
    status.textContent = graph
      ? 'Try D–F, or open Desk controls for keyboard access.'
      : 'Try 4, 8 or 16 Ω. Watch the current through R5.';
  const finding = currentFinding();
  const saved = pinned[activeLab];
  const savedLab = replayable[activeLab];
  const edited = hasExperiment();
  const canReopen = !edited && savedLab !== null;
  findingButton.setLabel(canReopen ? 'Reopen pin' : 'Pin finding');
  const webFindingButton = element<HTMLButtonElement>('pin-finding');
  webFindingButton.textContent = canReopen ? 'Reopen pin' : 'Pin finding';
  webFindingButton.disabled = !edited && !canReopen;
  const savedGraph = savedLab?.id === 'graph' ? savedLab.lab.state() : null;
  const pinnedRoute = savedGraph && savedGraph.path?.join('>') !== state.path?.join('>');
  const reference = pinnedRoute ? savedGraph : initialGraph;
  let hasReferenceRoute = false;
  if (graph) {
    for (const edge of state.edges) {
      const visible =
        !edge.onPath && reference.edges.some((prior) => prior.id === edge.id && prior.onPath);
      edgeViews.get(edge.id)!.reference.visible = visible;
      hasReferenceRoute ||= visible;
    }
  } else {
    circuit.compare(savedLab?.id === 'circuit' ? savedLab.lab.state() : null);
  }
  const tip = graph
    ? `D–F costs ${state.edges.find((edge) => edge.id === state.probe.edgeId)!.cost} · Recorded tie at ${state.probe.criticalCost} · Pinch or tap + / −`
    : 'What happens to R5 either side of 8 Ω?';
  const note = saved ? `Pinned: ${saved.result}` : 'Pin a finding to see it on your next visit.';
  board.set([
    graph ? 'Shortest routes' : 'Bridge circuit',
    tip,
    `Start: ${finding.baseline}`,
    `Now: ${finding.result}`,
    message || note,
    hasReferenceRoute
      ? `Amber now · Dashed ${pinnedRoute ? 'pinned' : 'start'}`
      : 'Recorded Muse probe · computed by Soma',
  ]);
  element('desk-result').textContent = `${finding.result}. ${finding.caption}`;
  element('desk-note').textContent =
    message || (saved ? `${note}. Started at ${saved.baseline}. ${saved.caption}` : note);
  element('pick-graph').setAttribute('aria-pressed', String(graph));
  element('pick-circuit').setAttribute('aria-pressed', String(!graph));
  element('graph-actions').hidden = !graph;
  element('circuit-actions').hidden = graph;
}
function cancelGraphInput() {
  if (dragPointer !== null) endDrag({ pointerId: dragPointer });
  pressedEdges.clear();
}
function selectLab(id: LabId) {
  if (activeLab === id) return;
  cancelGraphInput();
  if (sampler && world.renderer.xr.getSession()) finishSample();
  activeLab = id;
  if (sampler && world.renderer.xr.getSession()) startSample();
  message = '';
  graphRoot.visible = id === 'graph';
  circuitRoot.visible = id === 'circuit';
  slideMaterial.map = id === 'graph' ? slideTexture : circuitTexture;
  refreshDesk();
}
function stepCost(delta: number) {
  const cost = state.edges.find((edge) => edge.id === state.probe.edgeId)!.cost;
  render(lab.setCost(state.probe.edgeId, cost + delta));
}
function hasExperiment() {
  if (activeLab === 'graph') {
    return state.edges.some(
      (edge, i) =>
        edge.enabled !== initialGraph.edges[i].enabled || edge.cost !== initialGraph.edges[i].cost,
    );
  }
  return circuit
    .state()
    .parts.some(
      (part, i) =>
        part.open !== initialCircuit.parts[i].open || part.value !== initialCircuit.parts[i].value,
    );
}
function findingAction() {
  if (!hasExperiment()) {
    const reopened = replayFinding(activeLab, pinned[activeLab]?.replay);
    if (!reopened) {
      message = 'Change something before pinning a finding.';
    } else {
      if (reopened.id === 'graph') {
        cancelGraphInput();
        lab = reopened.lab;
        render(lab.state());
      } else {
        circuit.restore(reopened.lab);
      }
      message = 'Pin reopened · recomputed from saved controls';
    }
  } else {
    const replay =
      activeLab === 'graph'
        ? graphRecipe(initialGraph, state)
        : circuitRecipe(initialCircuit, circuit.state());
    const finding = { ...currentFinding(), replay };
    if (saveFinding(activeLab, finding)) {
      pinned[activeLab] = finding;
      replayable[activeLab] = replayFinding(activeLab, replay);
      message = `Pinned: ${finding.result}`;
    } else {
      message = 'This browser could not save the finding.';
    }
  }
  refreshDesk();
}
function resetLab() {
  if (activeLab === 'graph') {
    cancelGraphInput();
    render(lab.reset());
  } else circuit.reset();
}
element('pick-graph').onclick = () => selectLab('graph');
element('pick-circuit').onclick = () => selectLab('circuit');
element('toggle-bd').onclick = () => render(lab.toggleEdge('e_BD'));
element('less-cost').onclick = () => stepCost(-1);
element('more-cost').onclick = () => stepCost(1);
element('toggle-r4').onclick = () => circuit.togglePart('R4');
for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-resistance]')) {
  button.onclick = () => circuit.setValue('R4', Number(button.dataset.resistance));
}
element('pin-finding').onclick = findingAction;
element('reset-lab').onclick = resetLab;
render(state);

function startSample() {
  sampler?.start(activeLab);
  if (world.renderer.xr.getSession()?.visibilityState !== 'visible') sampler?.pause();
}
function finishSample() {
  if (!sampler) return;
  sampler.stop();
  const report = sampler.report();
  if (report.sampleCount === 0) return;
  samples.push(report);
  if (samples.length > 12) samples.shift();
  element('frame-report').textContent = JSON.stringify(samples, null, 2);
}
function sampleVisibility() {
  if (world.renderer.xr.getSession()?.visibilityState === 'visible') sampler?.resume();
  else sampler?.pause();
}
if (sampler) {
  element('frame-diagnostics').hidden = false;
  world.renderer.xr.addEventListener('sessionstart', () => {
    startSample();
    world.renderer.xr.getSession()?.addEventListener('visibilitychange', sampleVisibility);
  });
  world.renderer.xr.addEventListener('sessionend', finishSample);
}

// The bead always shows the current probe cost: it moves in whole steps while dragged and follows a reset.
class LabSystem extends createSystem({}) {
  delta = 0;
  update(delta: number) {
    sampler?.tick();
    this.delta = delta;
    const current = state.edges.find((e) => e.id === state.probe.edgeId)!.cost;
    bead.position.set(railBase.x, costToY(current), railBase.z);
    // The pulse crosses one route segment every 0.35 s, then rests.
    if (
      !reducedMotion.matches &&
      activeLab === 'graph' &&
      pulseRoute.length > 1 &&
      pulseT < pulseRoute.length - 1
    ) {
      pulseT = Math.min(pulseRoute.length - 1, pulseT + this.delta / 0.35);
      const i = Math.min(Math.floor(pulseT), pulseRoute.length - 2);
      pulse.position
        .lerpVectors(pulseRoute[i], pulseRoute[i + 1], pulseT - i)
        .add(new Vector3(0, 0.004, 0));
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
    root.dataset.somaDesk = JSON.stringify({
      lab: activeLab,
      ...currentFinding(),
      pinned: pinned[activeLab],
      referenceEdges: [...edgeViews]
        .filter(([, view]) => activeLab === 'graph' && view.reference.visible)
        .map(([id]) => id),
    });
    root.dataset.somaBead = JSON.stringify(bead.getWorldPosition(new Vector3()).toArray());
    root.dataset.somaRail = JSON.stringify(railBase.toArray());
    root.dataset.somaResult = JSON.stringify({
      path: state.path,
      cost: state.totalCost,
      probe: state.edges.find((e) => e.id === state.probe.edgeId)?.cost,
      caption: state.caption,
    });
  }, 200);
}
