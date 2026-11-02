import { describe, expect, it } from 'vitest';
import { mergeModelScene } from '../../src/lib/server/model-authoring';
import { parseExplorationReview } from '../../src/lib/server/exploration-review';
import { checkExploration, type ExplorationSpec } from '../../src/lib/domain/exploration';

const previous = {
  schemaVersion: 'exploration-v1', id: 'explore_x', version: 1, mode: 'explanation',
  title: 'Why the loop dips', objective: 'Explain the loop of Henle.',
  sources: [{ observationId: 'capture_1', version: 1, region: null }],
  assumptions: ['Schematic only.'], uncertainty: [], unsupportedClaims: [],
  scene: { layout: 'diagram-sidebar', panels: [
    { id: 'diagram', kind: 'diagram', title: 'Path', placement: { column: 1, row: 1, columnSpan: 2 }, objects: [
      { id: 'loop', kind: 'node', label: 'Loop', position: { x: 0.3, y: 0.5 } },
      { id: 'duct', kind: 'node', label: 'Duct', position: { x: 0.7, y: 0.5 } },
      { id: 'e1', kind: 'edge', from: 'loop', to: 'duct', label: 'to duct', directed: true },
    ] },
    { id: 'note', kind: 'text', title: 'Key', placement: { column: 1, row: 2, columnSpan: 2 }, text: 'The medulla gets saltier with depth.' },
  ] },
  steps: [
    { id: 's1', caption: 'Filtrate enters the loop.', narration: null, highlightIds: ['loop'], execution: null, executionStep: null },
    { id: 's2', caption: 'Water leaves into the salty medulla.', narration: null, highlightIds: ['loop', 'e1'], execution: null, executionStep: null },
  ],
  followups: ['What does the duct do?'],
} as unknown as ExplorationSpec;
const authored = {
  ...previous, title: 'Something else',
  scene: { layout: 'diagram-sidebar', panels: [{
    id: 'model', kind: 'spatial', title: 'Nephron in 3D', placement: { column: 1, row: 1, columnSpan: 2 },
    objects: [
      { id: 'loop_3d', label: 'Loop of Henle', description: 'One tube down and back up.', shape: 'tube', color: 'sage', position: { x: 0, y: 1, z: 0 }, size: { x: 0.2, y: 0.2, z: 0.2 }, parentId: null, path: [{ x: -1, y: 2, z: 0 }, { x: 0, y: 0.3, z: 0 }, { x: 1, y: 2, z: 0 }] },
      { id: 'medulla', label: 'Medulla', description: 'Saltier with depth.', shape: 'box', color: 'gold', position: { x: 0, y: 1, z: 0 }, size: { x: 3, y: 2, z: 1 }, parentId: null },
    ],
    connections: [],
    poses: [{ stepId: 's2', objectId: 'medulla', position: { x: 0, y: 1, z: 0 }, visible: true }, { stepId: 'gone', objectId: 'medulla', position: { x: 0, y: 1, z: 0 }, visible: true }],
  }] },
  steps: [
    { id: 's1', caption: 'Rewritten.', narration: null, highlightIds: ['medulla', 'unknown'], execution: null, executionStep: null },
    { id: 's2', caption: 'Rewritten too.', narration: null, highlightIds: [], execution: null, executionStep: null },
  ],
};

describe('a model built for an explanation', () => {
  it('sits beside the published diagram and words, bound to the same steps', () => {
    const merged = mergeModelScene(authored, previous) as ExplorationSpec;
    const { spec } = checkExploration(merged);
    if (spec.mode !== 'explanation') throw new Error('explanation expected');
    expect(spec.title).toBe(previous.title);
    expect(spec.scene.panels.map((p) => p.kind)).toEqual(['diagram', 'text', 'spatial']);
    expect(spec.scene.panels[2].placement).toEqual({ column: 1, row: 3, columnSpan: 2 });
    expect(spec.steps.map((s) => s.caption)).toEqual(previous.steps.map((s) => s.caption));
    // The diagram's part lights its model twin; unknown ids are dropped.
    expect(spec.steps[0].highlightIds).toEqual(['loop', 'loop_3d', 'medulla']);
    const model = spec.scene.panels[2];
    if (model.kind !== 'spatial') throw new Error('spatial expected');
    expect(model.poses.map((p) => p.stepId)).toEqual(['s2']);
  });
});

describe('a review verdict', () => {
  const result = (structured: unknown) => ({ status: 'completed', tools: [], structured, usage: { input_tokens: 0, output_tokens: 0 } }) as never;
  it('keeps a clear verdict with a loose shape', () => {
    expect(parseExplorationReview(result({ verdict: 'Revise', findings: ['a', 'b', 'c', 'd'], note: 'extra' }))).toEqual({ verdict: 'revise', findings: ['a', 'b', 'c'] });
    expect(parseExplorationReview(result({ verdict: 'approve' }))).toEqual({ verdict: 'approve', findings: [] });
  });
  it('still refuses an unclear one', () => {
    expect(() => parseExplorationReview(result({ verdict: 'maybe', findings: [] }))).toThrow();
    expect(() => parseExplorationReview(result({ findings: ['x'] }))).toThrow();
  });
});
