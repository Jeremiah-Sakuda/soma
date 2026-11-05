import { describe, it, expect } from 'vitest';
import {
  createExampleExploration,
  validateExplorationSpec,
} from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/components/exploration-scene';
import { explorationNarration, nextPlaybackState } from '../../src/components/exploration-playback';

describe('explanation playback and bounded richer primitives', () => {
  it('uses authored narration only for matching input state and switches to computed facts after a control change', () => {
    const spec = createExampleExploration();
    if (spec.mode !== 'checked-bfs') throw Error();
    spec.steps[0].narration = 'Watch the frontier: S is waiting at its head.';
    const state = initialExplorationState(spec);
    expect(explorationNarration(spec, state)).toContain('Watch the frontier');
    expect(explorationNarration(spec, { ...state, start: 'b' })).toContain('B starts');
    expect(explorationNarration(spec, { ...state, start: 'b' })).not.toContain('S is waiting');
  });
  it('advances actual computed state and terminates at the final step', () => {
    const spec = createExampleExploration();
    let state = initialExplorationState(spec);
    const seen: number[] = [];
    for (let i = 0; i < 20; i++) {
      seen.push(state.step);
      const next = nextPlaybackState(spec, state);
      if (!next) break;
      state = next;
    }
    expect(seen).toEqual([0, 1, 2, 3, 4, 5]);
    expect(nextPlaybackState(spec, state)).toBeNull();
  });
  it('supports sequence, matrix, callout and connected blocks without granting checked assurance', () => {
    const base = createExampleExploration();
    const common = {
      schemaVersion: base.schemaVersion,
      id: base.id,
      version: 1,
      title: base.title,
      objective: base.objective,
      sources: base.sources,
      assumptions: [],
      uncertainty: [],
      unsupportedClaims: [],
    };
    const spec = {
      ...common,
      mode: 'explanation',
      scene: {
        layout: 'stack',
        panels: [
          {
            id: 'pipeline',
            kind: 'diagram',
            title: 'Processing stages',
            placement: { column: 1, columnSpan: 2, row: 1 },
            objects: [
              {
                id: 'input',
                kind: 'block',
                label: 'Training examples',
                position: { x: 0, y: 0.5 },
              },
              { id: 'output', kind: 'block', label: 'Predictions', position: { x: 1, y: 0.5 } },
              {
                id: 'arrow',
                kind: 'edge',
                from: 'input',
                to: 'output',
                label: 'process',
                directed: true,
              },
            ],
          },
          {
            id: 'tokens',
            kind: 'sequence',
            title: 'Input sequence',
            placement: { column: 1, columnSpan: 2, row: 2 },
            items: [
              { id: 'token-a', label: 'The' },
              { id: 'token-b', label: 'sky' },
            ],
          },
          {
            id: 'weights',
            kind: 'matrix',
            title: 'Example values',
            placement: { column: 1, columnSpan: 2, row: 3 },
            rows: [
              ['1', '2'],
              ['3', '4'],
            ],
          },
          {
            id: 'idea',
            kind: 'callout',
            title: 'One idea',
            placement: { column: 1, columnSpan: 2, row: 4 },
            tone: 'idea',
            text: 'These are explanatory example values.',
          },
        ],
      },
      steps: [
        {
          id: 'explain',
          caption: 'Inspect the sequence.',
          narration: 'Read the two input tokens.',
          highlightIds: ['token-a'],
          execution: null,
          executionStep: null,
        },
      ],
      followups: [],
    };
    expect(validateExplorationSpec(spec).mode).toBe('explanation');
    expect(() =>
      validateExplorationSpec({
        ...spec,
        scene: {
          ...spec.scene,
          panels: spec.scene.panels.map((p) =>
            p.kind === 'matrix' ? { ...p, rows: [['1'], ['2', '3']] } : p,
          ),
        },
      }),
    ).toThrow('equal length');
    expect(() =>
      validateExplorationSpec({
        ...spec,
        scene: {
          ...spec.scene,
          panels: spec.scene.panels.map((p) =>
            p.kind === 'sequence' ? { ...p, items: [{ id: 'input', label: 'Duplicate' }] } : p,
          ),
        },
      }),
    ).toThrow('unique');
  });
});
