import { RayInteractable, type World } from '@iwsdk/core';
import type {} from '@pmndrs/pointer-events';
import {
  ArrowHelper,
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three';
import { circuitQuantity } from '../../src/lib/domain/exploration-view';
import presentation from '../../src/lib/fixtures/recorded-circuit-presentation.json';
import type { CircuitLab, CircuitLabState } from '../../src/lib/xr-lab/circuit-contract';
import { openRecordedCircuitLab } from '../../src/lib/xr-lab/recorded-circuit-lab';
import { textPanel } from './text';

const SURFACE = 0.88;
const EYE = new Vector3(0, 1.15, 0);
const UP = new Vector3(0, 1, 0);
const PRESETS = [4, 8, 16] as const;
const PANEL_BG = 'rgba(27,31,34,0.96)';
const INK = '#f8f2e8';
const CYAN = '#a9e2f1';

// Presentation offsets in metres keep the camera-facing readouts clear of each other
// and of the probe targets. The source-aligned bodies and wires stay in place.
const NODE_LABEL_OFFSETS: Record<string, [number, number, number]> = {
  A: [0, 0.055, 0],
  B: [-0.048, 0.037, 0],
  C: [0.0165, 0.052, 0],
  D: [0, 0.05, 0.005],
};
const PART_LABEL_OFFSETS: Record<string, [number, number, number]> = {
  VS1: [-0.016, 0.04, 0],
  R1: [-0.095, 0.05, 0],
  R2: [-0.127, 0.025, 0.002],
  R3: [-0.065, 0.073, 0],
  R4: [-0.072, 0.02, 0.018],
  R5: [-0.008, 0.043, 0.024],
};

// Preserve the source alignment while fitting the recorded bridge inside the seated tray.
function place(x: number, y: number) {
  return new Vector3(x - 0.303, SURFACE, -0.58 + ((y - 0.2975) / 0.482) * 0.26);
}

export function createCircuitScene(
  world: World,
  root: Group,
  onChange: (state: CircuitLabState) => void,
) {
  const rootEntity = world.createTransformEntity(root);
  let lab = openRecordedCircuitLab();
  const initial = lab.state();
  const observed = initial.probe.observe;
  if (observed.kind !== 'current')
    throw new Error('The bridge tray expects a recorded current probe.');
  const probeId = initial.probe.componentId;
  const observedId = observed.componentId;
  const nodePoints = new Map(initial.nodes.map((node) => [node.id, place(node.x, node.y)]));
  const wireInk = new MeshBasicMaterial({ color: 0x4c4840 });
  const bodyInk = new MeshStandardMaterial({ color: 0x9f662e, roughness: 0.52 });
  const probeInk = new MeshStandardMaterial({ color: 0x4b9cb0, roughness: 0.55 });
  const sourceInk = new MeshStandardMaterial({ color: 0xe8b26c, roughness: 0.48 });
  const openInk = new MeshBasicMaterial({ color: 0xa86b3d });
  const hitInk = new MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false });

  const paper = new Mesh(
    new BoxGeometry(0.438, 0.006, 0.284),
    new MeshStandardMaterial({ color: 0xe3d1b6, roughness: 0.96 }),
  );
  paper.position.set(0, SURFACE - 0.012, -0.45);
  root.add(paper);

  function rod(a: Vector3, b: Vector3, radius: number, material = wireInk) {
    const length = a.distanceTo(b);
    if (length < 0.00001) return;
    const mesh = new Mesh(new CylinderGeometry(radius, radius, length, 8), material);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(UP, b.clone().sub(a).normalize());
    root.add(mesh);
    return mesh;
  }

  function label(point: Vector3, width: number, height: number, colour = INK) {
    const panel = textPanel(width, height, { px: 320, background: PANEL_BG, colour });
    panel.mesh.position.copy(point);
    panel.mesh.lookAt(EYE);
    root.add(panel.mesh);
    return panel;
  }

  function action(mesh: Mesh, run: () => void) {
    world.createTransformEntity(mesh, rootEntity).addComponent(RayInteractable);
    // IWSDK indexes interactables directly, without filtering hidden ancestor groups.
    const raycast = mesh.raycast;
    mesh.raycast = function (...args) {
      if (root.visible) raycast.apply(this, args);
    };
    const presses = new Set<number>();
    mesh.addEventListener('pointerdown', (event) => {
      if (root.visible) presses.add(event.pointerId);
    });
    mesh.addEventListener('pointerleave', (event) => presses.delete(event.pointerId));
    mesh.addEventListener('pointercancel', (event) => presses.delete(event.pointerId));
    mesh.addEventListener('pointerup', (event) => {
      if (presses.delete(event.pointerId) && root.visible) run();
    });
  }

  function lead(node: Vector3, terminal: Vector3, vertical: boolean) {
    const bend = vertical
      ? new Vector3(terminal.x, SURFACE, node.z)
      : new Vector3(node.x, SURFACE, terminal.z);
    rod(node, bend, 0.0035);
    rod(bend, terminal, 0.0035);
  }

  const nodeLabels = new Map(
    initial.nodes.map((node) => {
      const offset = NODE_LABEL_OFFSETS[node.id] ?? [0, 0.034, 0];
      const point = nodePoints
        .get(node.id)!
        .clone()
        .add(new Vector3(...offset));
      const post = new Mesh(new CylinderGeometry(0.008, 0.008, 0.012, 14), wireInk);
      post.position.copy(nodePoints.get(node.id)!);
      root.add(post);
      return [node.id, label(point, 0.061, 0.024)] as const;
    }),
  );

  const partViews = new Map(
    initial.parts.map((part) => {
      const body = presentation.layout.components.find(
        ({ componentId }) => componentId === part.id,
      )!;
      const a = place(body.x1, body.y1);
      const b = place(body.x2, body.y2);
      const from = nodePoints.get(part.from)!;
      const to = nodePoints.get(part.to)!;
      const forward =
        a.distanceToSquared(from) + b.distanceToSquared(to) <=
        a.distanceToSquared(to) + b.distanceToSquared(from);
      const start = forward ? a : b;
      const end = forward ? b : a;
      const along = end.clone().sub(start).normalize();
      const vertical = Math.abs(along.z) > Math.abs(along.x);
      lead(from, start, vertical);
      lead(to, end, vertical);

      const midpoint = start.clone().add(end).multiplyScalar(0.5);
      const length = start.distanceTo(end);
      const isResistor = part.kind === 'resistor';
      const partInk = part.id === probeId ? probeInk : bodyInk;
      const solid = isResistor
        ? new Mesh(new BoxGeometry(0.022, length, 0.022), partInk)
        : new Mesh(new CylinderGeometry(0.02, 0.02, 0.016, 24), sourceInk);
      solid.position.copy(midpoint);
      if (isResistor) solid.quaternion.setFromUnitVectors(UP, along);
      root.add(solid);

      const leverTip = start
        .clone()
        .lerp(end, 0.72)
        .add(new Vector3(0, 0.024, 0));
      const lever = isResistor ? rod(start, leverTip, 0.0035, openInk) : undefined;
      if (lever) lever.visible = false;

      if (isResistor) {
        const target = new Mesh(new BoxGeometry(0.036, length + 0.012, 0.035), hitInk);
        target.position.copy(midpoint);
        target.quaternion.copy(solid.quaternion);
        action(target, () => togglePart(part.id));
      }

      // Show both the resistance and the live signed current near their own component.
      const offset = PART_LABEL_OFFSETS[part.id] ?? [0, 0.042, 0];
      const labelPoint = place(part.labelX, part.labelY).add(new Vector3(...offset));
      const observedPart = part.id === observedId;
      const tag = label(
        labelPoint,
        observedPart ? 0.11 : 0.061,
        observedPart ? 0.038 : 0.035,
        observedPart ? CYAN : INK,
      );
      return [part.id, { solid, lever, tag, midpoint, along }] as const;
    }),
  );

  const bridge = partViews.get(observedId)!;
  const arrow = new ArrowHelper(bridge.along, bridge.midpoint, 0.09, 0x468da7, 0.015, 0.012);
  root.add(arrow);
  const presetControls = PRESETS.map((value, index) => {
    const centre = new Vector3(-0.1 + 0.1 * index, SURFACE, -0.275);
    const button = label(centre, 0.068, 0.036, CYAN);
    action(button.mesh, () => setValue(probeId, value));
    return { value, button };
  });
  const presetHint = label(new Vector3(0, SURFACE + 0.016, -0.307), 0.12, 0.022, CYAN);
  presetHint.set([`${probeId} · Choose resistance`]);

  function render(state: CircuitLabState) {
    for (const node of state.nodes) {
      nodeLabels
        .get(node.id)!
        .set([
          node.voltage === null
            ? `${node.label} · ${state.status === 'solved' ? 'Floating' : 'Unknown'}`
            : `${node.label} · ${circuitQuantity(node.voltage, 'V')}`,
        ]);
    }
    for (const part of state.parts) {
      const view = partViews.get(part.id)!;
      view.solid.visible = !part.open;
      if (view.lever) view.lever.visible = part.open;
      const title = `${part.kind === 'resistor' ? `${part.id} · ` : ''}${circuitQuantity(part.value, part.unit)}`;
      if (part.current === null) {
        view.tag.set([title, 'Current unavailable']);
      } else if (part.open) {
        view.tag.set([title, 'Open · 0 A']);
      } else if (part.id === observedId && part.current !== 0) {
        const direction =
          part.current > 0 ? `${part.from} → ${part.to}` : `${part.to} → ${part.from}`;
        view.tag.set([title, `${circuitQuantity(Math.abs(part.current), 'A')} · ${direction}`]);
      } else {
        view.tag.set([title, circuitQuantity(part.current, 'A')]);
      }
    }
    const current = state.parts.find(({ id }) => id === observedId)!.current;
    arrow.visible = current !== null && current !== 0;
    if (current !== null && current !== 0) {
      const direction = bridge.along.clone().multiplyScalar(current > 0 ? 1 : -1);
      arrow.setDirection(direction);
      arrow.position.copy(bridge.midpoint).addScaledVector(direction, -0.045);
      arrow.position.y += 0.02;
      arrow.position.z += 0.025;
    }
    const resistance = state.parts.find(({ id }) => id === probeId)!;
    for (const { value, button } of presetControls) {
      const selected = value === resistance.value;
      button.set([`${value} Ω`, selected ? 'Selected' : '']);
    }
  }

  function update(state: CircuitLabState) {
    render(state);
    onChange(state);
  }

  function togglePart(id: string) {
    update(lab.togglePart(id));
  }

  function setValue(id: string, value: number) {
    update(lab.setValue(id, value));
  }

  render(initial);
  return {
    state: () => lab.state(),
    reset: () => update(lab.reset()),
    restore(next: CircuitLab) {
      lab = next;
      update(lab.state());
    },
    togglePart,
    setValue,
  };
}
