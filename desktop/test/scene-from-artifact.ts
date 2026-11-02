// For the model harness: the same overlay model the page mirrors to the companion for an
// explanation, at a given step.
import { spatialScene } from '../../src/lib/domain/spatial-exploration';
import { liftRegion, liftScene, sceneOverlayModel } from '../../src/lib/domain/scene-lift';
import type { ExplorationSpec } from '../../src/lib/domain/exploration';
import type { ExplorationViewState } from '../../src/lib/domain/exploration-view';

export function overlayFor(spec: ExplorationSpec, state: ExplorationViewState, step: number, aspect: number, focus?: { x: number; y: number; width: number; height: number }) {
  if (spec.mode !== 'explanation') return null;
  const at = Math.min(step, spec.steps.length - 1);
  const scene = spatialScene(spec, { ...state, explanationStep: at });
  if (!scene?.objects.length) return null;
  return sceneOverlayModel(liftScene(scene, liftRegion(focus, aspect)), { text: spec.steps[at].caption, stepLabel: `Step ${at + 1} of ${spec.steps.length}` });
}
