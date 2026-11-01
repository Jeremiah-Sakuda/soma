import { describe, expect, it } from 'vitest';
import { createExampleExploration, createWeightedExample } from '@/lib/domain/exploration';
import {
  explorationExecution,
  explorationVisibleCaption,
  initialExplorationState,
} from '@/lib/domain/exploration-view';

const ref = { observationId: 'original', version: 1, region: null };

describe('journal step caption', () => {
  it('names both searches and reports a cheaper route to a waiting node', () => {
    const spec = createWeightedExample(ref);
    const state = initialExplorationState(spec);
    const execution = explorationExecution(spec, state)!;
    // Find the checked step where Goal's tentative cost falls below the direct edge.
    const index = execution.steps.findIndex(
      (step, i) =>
        i > 0 &&
        execution.steps[i - 1].distances.g !== undefined &&
        step.distances.g < execution.steps[i - 1].distances.g,
    );
    expect(index).toBeGreaterThan(0);
    const before = execution.steps[index - 1].distances.g,
      after = execution.steps[index].distances.g;
    const caption = explorationVisibleCaption(spec, { ...state, step: index });
    expect(caption.startsWith('Dijkstra: ')).toBe(true);
    expect(caption).toContain(' BFS: ');
    expect(caption).toContain(`Goal drops from ${before} to ${after}.`);
    expect(caption).not.toMatch(/Primary|Comparison:/);
  });

  it('keeps the plain wording when nothing becomes cheaper', () => {
    const spec = createExampleExploration(ref);
    const caption = explorationVisibleCaption(spec, { ...initialExplorationState(spec), step: 1 });
    expect(caption).not.toContain('drops from');
  });
});
