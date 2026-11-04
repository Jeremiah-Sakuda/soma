// For the model harness: the same overlay model the page mirrors to the companion for an
// explanation, at a given step.
import { spatialScene } from '../../src/lib/domain/spatial-exploration';
import { clearOfInk, liftRegion, liftScene, sceneOverlayModel, type InkGrid } from '../../src/lib/domain/scene-lift';
import type { ExplorationSpec } from '../../src/lib/domain/exploration';
import type { ExplorationViewState } from '../../src/lib/domain/exploration-view';

export function overlayFor(spec: ExplorationSpec, state: ExplorationViewState, step: number, aspect: number, focus?: { x: number; y: number; width: number; height: number }, ink?: InkGrid) {
  if (spec.mode !== 'explanation') return null;
  const at = Math.min(step, spec.steps.length - 1);
  const scene = spatialScene(spec, { ...state, explanationStep: at });
  if (!scene?.objects.length) return null;
  return sceneOverlayModel(liftScene(scene, clearOfInk(liftRegion(focus, aspect), ink)), { text: spec.steps[at].caption, stepLabel: `Step ${at + 1} of ${spec.steps.length}` });
}

import { circuitOverlayModel } from '../../src/lib/domain/circuit-overlay-model';
import { circuitSolution } from '../../src/lib/domain/exploration-view';
import { heroCircuit, heroCircuitLayout } from '../../tests/fixtures/hero-circuit';
/** The Lecture 9 bridge, solved, as the circuit stage mirrors it with its voltage scene. */
export function circuitOverlay(step: number, aspect: number) {
  const spec = {
    schemaVersion: 'exploration-v1', id: 'explore_circuit', version: 1, mode: 'checked-circuit', modelId: 'dc-nodal', modelVersion: 'dc-nodal-v1',
    title: 'Bridge', objective: 'Voltages', sources: [], assumptions: [], uncertainty: [], unsupportedClaims: [], input: heroCircuit,
    scene: { layout: 'diagram-sidebar', panels: [{ id: 'circuit', kind: 'circuit', title: 'Bridge', execution: 'primary', placement: { column: 1, row: 1, columnSpan: 2 }, positions: heroCircuitLayout.nodes }] },
    steps: [], controls: ['step'], followups: [],
  } as unknown as ExplorationSpec;
  const state = { step, explanationStep: 0, start: null, goal: null, disabledEdgeIds: [], reversed: false, selectedObjectId: null } as unknown as ExplorationViewState;
  const solution = circuitSolution(spec, state)!;
  const drawn = circuitOverlayModel({ layout: heroCircuitLayout, solution, index: step, caption: 'Each node rises to its checked voltage.', stepLabel: `Step ${step + 1}`, aspect });
  const scene = spatialScene(spec, state);
  if (!drawn || !scene) return null;
  const xs = heroCircuitLayout.nodes.map((n) => n.x), ys = heroCircuitLayout.nodes.map((n) => n.y);
  const region = { x: Math.min(...xs) - 0.06, y: Math.min(...ys) - 0.06, width: Math.max(...xs) - Math.min(...xs) + 0.12, height: Math.max(...ys) - Math.min(...ys) + 0.12 };
  return { ...drawn, scene: liftScene(scene, region, new Map(heroCircuitLayout.nodes.map((n) => [n.nodeId, { x: n.x, y: n.y }]))), steps: solution.status === 'solved' ? solution.steps.length : 1 };
}
