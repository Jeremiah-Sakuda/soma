import type { ExplorationSpec } from './exploration';
import { comparisonExecution, explorationExecution, type ExplorationViewState } from './exploration-view';
import { defaultSpatialView, type SpatialPanel, type SpatialVector } from './spatial-schema';
import type { MechanismParameter } from './mechanism-schema';

export type SpatialObject = SpatialPanel['objects'][number] & {
  visible: boolean; highlighted: boolean; status: string;
  parameterValues?: Record<string, number>;
};
export type SpatialConnection = SpatialPanel['connections'][number] & { active: boolean; highlighted: boolean };
export type SpatialScene = {
  title: string; assurance: 'checked' | 'schematic';
  objects: SpatialObject[]; connections: SpatialConnection[];
  annotations?: string[];
  parameters?: (MechanismParameter & { value: number; overridden: boolean })[];
};
export function supportsSpatial(spec: ExplorationSpec) {
  return spec.mode !== 'clarify' && (spec.mode !== 'explanation' || spec.scene.panels.some((p) => p.kind === 'spatial' || (p.kind === 'diagram' && p.objects.some((o) => o.kind === 'node' || o.kind === 'block'))));
}

/** Apply a newly authored, validated presentation request once at publication, never on reopen. */
export function applySpatialViewAction(spec: ExplorationSpec, state: ExplorationViewState): ExplorationViewState {
  if (spec.mode !== 'explanation') return state;
  const panel = spec.scene.panels.find((p) => p.kind === 'spatial');
  if (panel?.kind !== 'spatial' || !panel.viewAction) return state;
  const action = panel.viewAction, view = { ...(state.spatial ?? defaultSpatialView()) };
  if (action.camera) {
    const [azimuth, elevation] = { perspective: [35, 25], front: [0, 0], above: [0, 85], side: [90, 0] }[action.camera];
    Object.assign(view, { azimuth, elevation, zoom: 1 });
  }
  if (action.spread !== null) view.spread = action.spread;
  if (action.slice !== null) view.slice = action.slice;
  const selectedObjectId = action.focusObjectId ?? state.selectedObjectId;
  if (action.isolate !== null) view.isolate = action.isolate && panel.objects.some((o) => o.id === selectedObjectId);
  return { ...state, selectedObjectId, spatial: view };
}

/** Projection of validated data. Never executes generated instructions or changes the solver. */
export function spatialScene(spec: ExplorationSpec, state: ExplorationViewState, which: 'primary' | 'comparison' = 'primary'): SpatialScene | null {
  if (spec.mode === 'clarify') return null;
  if (spec.mode !== 'explanation') {
    const execution = which === 'comparison' ? comparisonExecution(spec, state) : explorationExecution(spec, state);
    if (!execution) return null;
    const graph = spec.scene.panels.find((p) => p.kind === 'graph' && p.execution === which);
    if (!graph || graph.kind !== 'graph') return null;
    const step = execution.steps[Math.min(state.step, execution.steps.length - 1)];
    // Tentative costs can be much larger than their eventual settled values.
    // One scale over the complete trace keeps every frame bounded and comparable.
    const max = Math.max(1, ...execution.steps.flatMap((s) => Object.values(s.distances)).filter(Number.isFinite));
    const path = step.status === 'found' ? execution.path ?? [] : [];
    const input = which === 'comparison' ? spec.comparison!.input : spec.input;
    return {
      title: graph.title, assurance: 'checked',
      objects: input.nodes.map((node) => {
        const position = graph.positions.find((p) => p.nodeId === node.id)!;
        const distance = step.distances[node.id];
        const reached = typeof distance === 'number' && Number.isFinite(distance);
        const status = node.id === step.current ? 'Current' : step.expanded.includes(node.id) ? 'Expanded' : step.queue.includes(node.id) ? 'Frontier' : 'Not reached';
        return {
          id: node.id, label: node.label, description: `${status} · ${reached ? `distance ${distance}` : 'distance unknown'}`,
          shape: 'sphere', color: node.id === step.current ? 'clay' : path.includes(node.id) ? 'sage' : step.queue.includes(node.id) ? 'gold' : 'blue',
          position: { x: (position.x - 0.5) * 7, y: reached ? (distance / max) * 3 : 0, z: (position.y - 0.5) * 5 },
          size: { x: 0.5, y: 0.5, z: 0.5 }, parentId: null,
          visible: true, highlighted: node.id === step.current || path.includes(node.id), status,
        };
      }),
      connections: input.edges.map((edge) => {
        const current = execution.input.edges.find((e) => e.id === edge.id);
        const onPath = path.some((node, index) => index > 0 && ((path[index - 1] === edge.from && node === edge.to) || (!input.directed && path[index - 1] === edge.to && node === edge.from)));
        return { ...edge, label: spec.mode === 'checked-dijkstra' ? String(current?.weight ?? state.edgeWeights?.[edge.id] ?? edge.weight ?? 1) : '', directed: input.directed, active: Boolean(current), highlighted: onPath };
      }),
    };
  }
  const spatial = spec.scene.panels.find((panel) => panel.kind === 'spatial');
  const stepIndex = Math.min(state.explanationStep, spec.steps.length - 1);
  const highlights = spec.steps[stepIndex].highlightIds;
  const parameterValues = Object.fromEntries((spatial?.kind === 'spatial' ? spatial.parameters ?? [] : []).map(p => [p.id, p.initial]));
  if (spatial?.kind === 'spatial') {
    for (const step of spec.steps.slice(0, stepIndex + 1)) for (const pose of spatial.parameterPoses ?? []) if (pose.stepId === step.id) parameterValues[pose.parameterId] = pose.value;
    Object.assign(parameterValues, state.spatial?.parameters ?? {});
  }
  if (spatial?.kind === 'spatial') return {
    title: spatial.title, assurance: 'schematic',
    parameters: (spatial.parameters ?? []).map(p => ({ ...p, value: parameterValues[p.id], overridden: state.spatial?.parameters?.[p.id] !== undefined })),
    objects: spatial.objects.map((object) => {
      let position = object.position, visible = true;
      for (const step of spec.steps.slice(0, stepIndex + 1)) {
        const pose = spatial.poses.find((p) => p.stepId === step.id && p.objectId === object.id);
        if (pose) { position = pose.position; visible = pose.visible; }
      }
      return { ...object, position, ...(object.geometry?.length ? { parameterValues } : {}), visible, highlighted: highlights.includes(object.id), status: visible ? 'Visible' : 'Hidden at this step' };
    }),
    connections: spatial.connections.map((edge) => ({ ...edge, active: true, highlighted: highlights.includes(edge.id) })),
  };
  const diagram = spec.scene.panels.find((panel) => panel.kind === 'diagram');
  if (diagram?.kind !== 'diagram') return null;
  return {
    title: diagram.title, assurance: 'schematic',
    annotations: diagram.objects.filter((o) => o.kind === 'text').map((o) => o.text),
    objects: diagram.objects.filter((o) => o.kind === 'node' || o.kind === 'block').map((o) => ({
      id: o.id, label: o.label, description: 'Spatial arrangement of the original explanatory diagram.',
      shape: o.kind === 'node' ? 'sphere' : 'box', color: 'sage',
      position: { x: (o.position.x - 0.5) * 7, y: 0, z: (o.position.y - 0.5) * 5 },
      size: { x: 0.8, y: 0.6, z: 0.6 }, parentId: null, visible: true,
      highlighted: highlights.includes(o.id), status: 'Visible',
    })),
    connections: diagram.objects.filter((o) => o.kind === 'edge').map((o) => ({ ...o, active: true, highlighted: highlights.includes(o.id) })),
  };
}

export function spatialPresentation(scene: SpatialScene, state: ExplorationViewState): SpatialScene {
  const view = state.spatial ?? defaultSpatialView();
  const selected = scene.objects.find((o) => o.id === state.selectedObjectId);
  const related = new Set<string>(selected ? [selected.id] : []);
  if (selected) {
    // Isolation retains its contained parts; links never float without endpoints.
    for (let depth = 0; depth < scene.objects.length; depth++)
      for (const object of scene.objects) if (object.parentId && related.has(object.parentId)) related.add(object.id);
  }
  const objects = scene.objects.map((object) => {
    // Presentation must remain attached to identity across model reordering/additions.
    let hash = 2166136261;
    for (const character of object.id) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0;
    const angle = (hash / 4294967296) * Math.PI * 2;
    const offset = view.spread * (object.parentId ? 2 : 0.8);
    // Educational parts separate along an intentional assembly axis. A moving
    // marker follows the nearest part's presentation offset, never a new fact.
    const role = object.renderStyle === 'marker'
      ? scene.objects.filter((o) => o.renderStyle && o.renderStyle !== 'marker' && o.renderStyle !== 'housing')
        .sort((a, b) => Math.hypot(a.position.x - object.position.x, a.position.z - object.position.z) - Math.hypot(b.position.x - object.position.x, b.position.z - object.position.z))[0]?.renderStyle
      : object.renderStyle;
    const lift = role === 'housing' ? 0 : role === 'chip' ? 1.5 : role === 'sensor' || role === 'indicator' ? 0.65 : null;
    const position: SpatialVector = {
      x: object.position.x + (lift === null ? Math.cos(angle) * offset : 0),
      y: object.position.y + (scene.assurance === 'checked' ? 0 : view.spread * (lift ?? (hash >>> 16) / 65535 * 2.25)),
      z: object.position.z + (lift === null ? Math.sin(angle) * offset : 0),
    };
    return { ...object, position, visible: object.visible && (!view.isolate || !selected || related.has(object.id)) };
  });
  const visible = new Set(objects.filter((o) => o.visible).map((o) => o.id));
  return { ...scene, objects, connections: scene.connections.filter((e) => visible.has(e.from) && visible.has(e.to)) };
}
