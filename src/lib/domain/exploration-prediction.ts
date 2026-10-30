import { explorationExecution, type ExplorationViewState } from './exploration-view';
import type { ExplorationSpec } from './exploration';

/** Supported, diagram-visible practice; never an independent-understanding claim. */
export type ExplorationPrediction = {
  id: string;
  artifactId: string;
  version: number;
  sourceObservationId: string;
  sourceVersion: number;
  modelVersion: string;
  state: ExplorationViewState;
  createdAt: string;
  prompt: string;
  options: { id: string; label: string }[];
  expectedNodeId: string;
  answer: { nodeId: string; reason: string; recordedAt: string; matches: boolean } | null;
  revealedAt: string | null;
  exposure: 'diagram-visible-practice';
};
export function predictionQuestion(spec: ExplorationSpec, state: ExplorationViewState) {
  const execution = explorationExecution(spec, state);
  if (!execution || state.step + 1 >= execution.steps.length) return null;
  const expected = execution.steps[state.step + 1].current;
  if (!expected) return null;
  return {
    prompt: 'Which node leaves the queue next?',
    options: execution.input.nodes.map((n) => ({ id: n.id, label: n.label })),
    expectedNodeId: expected,
    modelVersion: execution.modelVersion,
  };
}
