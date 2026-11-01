import { z } from 'zod';
import {
  explorationSpecSchema,
  type ExplorationSpec,
  type BfsInput,
} from '../domain/exploration';

const explanatory = explorationSpecSchema.options[1].shape;
/** Only narration/emphasis is authored here. Source, diagram geometry, controls
 * and computations stay application-bound. Full composition remains available. */
export const explorationContinuationSchema = z.strictObject({
  mode: z.literal('continue'),
  title: explanatory.title,
  objective: explanatory.objective,
  assumptions: explanatory.assumptions,
  steps: explorationSpecSchema.options[0].shape.steps.max(6),
  followups: explanatory.followups.max(3),
});

/** A fast checked reply must be heard on the snapshot the person is looking at,
 * rather than silently waiting for a later trace state. */
export function continuationSchemaFor(
  spec: Exclude<ExplorationSpec, { mode: 'clarify' }>,
  currentStep: number,
) {
  return spec.mode === 'explanation'
    ? explorationContinuationSchema.extend({ steps: explanatory.steps.max(6) })
    : explorationContinuationSchema.extend({
        steps: z
          .array(
            explorationSpecSchema.options[0].shape.steps.element.extend({
              execution: z.literal('primary'),
              executionStep: z.literal(currentStep),
            }),
          )
          .length(1),
      });
}

export function continueExploration(
  previous: Exclude<ExplorationSpec, { mode: 'clarify' }>,
  proposal: unknown,
  binding: { id: string; version: number; input: BfsInput | null; comparison: BfsInput | null },
): ExplorationSpec {
  const copy = explorationContinuationSchema.parse(proposal),
    spec = structuredClone(previous);
  spec.id = binding.id;
  spec.version = binding.version;
  spec.title = copy.title;
  spec.objective = copy.objective;
  spec.assumptions = copy.assumptions;
  Object.assign(spec, { steps: copy.steps });
  spec.followups = copy.followups;
  if (spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') {
    if (!binding.input) throw new Error('Checked continuation requires current input');
    spec.input = structuredClone(binding.input);
    if (spec.comparison) {
      if (!binding.comparison)
        throw new Error('Comparison continuation requires current input');
      spec.comparison.input = structuredClone(binding.comparison);
    }
  }
  // Caller must still run all normal validation, binding checks and review.
  return explorationSpecSchema.parse(spec);
}
