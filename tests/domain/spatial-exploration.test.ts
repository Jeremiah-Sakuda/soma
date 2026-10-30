import { describe, it, expect } from 'vitest';
import { checkExploration, createWeightedExample, createExampleExploration } from '../../src/lib/domain/exploration';
import { createSpatialExample } from '../../src/lib/domain/spatial-example';
import { spatialScene, spatialPresentation, supportsSpatial } from '../../src/lib/domain/spatial-exploration';
import { spatialViewSchema, defaultSpatialView } from '../../src/lib/domain/spatial-schema';
import { initialExplorationState, explorationExecution } from '../../src/lib/domain/exploration-view';
import { arrangeExplanationPanels } from '../../src/lib/domain/exploration-layout';

function candidate() {
  const spec = createSpatialExample();
  if (spec.mode !== 'explanation') throw new Error('fixture');
  const panel = spec.scene.panels[0];
  if (panel.kind !== 'spatial') throw new Error('fixture');
  return { spec, panel };
}
describe('bounded spatial contracts', () => {
  it('reflows a spatial panel without narrowing it or changing its contents', () => {
    const { spec, panel } = candidate(), original = structuredClone(panel);
    spec.scene.panels.unshift({ id: 'context', kind: 'text', title: 'Context', text: 'Original teaching schematic', placement: { column: 1, row: 1, columnSpan: 1 } });
    const result = arrangeExplanationPanels(spec);
    expect(result.changed).toBe(true);
    expect(() => checkExploration(result.spec)).not.toThrow();
    if (result.spec.mode !== 'explanation') throw new Error('fixture');
    expect(result.spec.scene.panels[1]).toEqual({ ...original, placement: { column: 1, row: 2, columnSpan: 2 } });
    expect(panel).toEqual(original);
  });
  it('retains explanation-only assurance and accepts legacy scenes', () => {
    expect(checkExploration(createSpatialExample()).validation.assurance).toBe('explanation-only');
    expect(checkExploration(createExampleExploration()).validation.assurance).toBe('checked-bfs');
    expect(checkExploration(createWeightedExample({ observationId: 'test-source', version: 1, region: null })).validation.assurance).toBe('checked-dijkstra');
  });
  it.each(['cycle', 'missing parent', 'duplicate object', 'foreign edge', 'duplicate edge', 'foreign pose', 'unknown step', 'duplicate pose', 'nonfinite', 'oversize', 'code', 'too many', 'duplicate panel', 'unknown highlight', 'foreign focus', 'bad view'])('rejects %s before rendering or publication', (fault) => {
    const { spec, panel } = candidate();
    if (fault === 'cycle') panel.objects[0].parentId = panel.objects[1].id;
    if (fault === 'missing parent') panel.objects[0].parentId = 'missing';
    if (fault === 'duplicate object') panel.objects[1].id = panel.objects[0].id;
    if (fault === 'foreign edge') panel.connections[0].to = 'outside';
    if (fault === 'duplicate edge') panel.connections[0].id = panel.objects[0].id;
    if (fault === 'foreign pose') panel.poses[0].objectId = 'outside';
    if (fault === 'unknown step') panel.poses[0].stepId = 'outside';
    if (fault === 'duplicate pose') panel.poses.push(panel.poses[0]);
    if (fault === 'nonfinite') panel.objects[0].position.x = Infinity;
    if (fault === 'oversize') panel.objects[0].size.y = 1000;
    if (fault === 'code') Object.assign(panel.objects[0], { onClick: 'fetch(secret)' });
    if (fault === 'too many') panel.objects = Array.from({ length: 17 }, (_, i) => ({ ...panel.objects[0], id: `obj${i}` }));
    if (fault === 'duplicate panel') spec.scene.panels.push({ ...panel, id: 'other' });
    if (fault === 'unknown highlight') spec.steps[0].highlightIds.push('outside');
    if (fault === 'foreign focus') panel.viewAction = { camera: null, focusObjectId: 'outside', isolate: true, spread: null, slice: null };
    if (fault === 'bad view') panel.viewAction = { camera: null, focusObjectId: null, isolate: null, spread: 50, slice: null };
    expect(() => checkExploration(spec)).toThrow();
  });
  it('does not allow an explanatory spatial panel to inherit checked assurance', () => {
    const spec = createExampleExploration();
    if (spec.mode === 'clarify') throw new Error('fixture');
    spec.scene.panels = [candidate().panel];
    expect(() => checkExploration(spec)).toThrow('explanation-only');
  });
  it.each([{ azimuth: 999 }, { elevation: -86 }, { slice: NaN }, { zoom: 0 }, { spread: 2 }, { url: 'https://untrusted.invalid/mesh' }])('rejects unbounded view data %j', (invalid) => {
    expect(spatialViewSchema.safeParse({ ...defaultSpatialView(), ...invalid }).success).toBe(false);
  });
});
describe('spatial projection and presentation', () => {
  it('bounds tentative distance heights even when a large initial cost is later improved', () => {
    const spec = createWeightedExample({ observationId: 'test-source', version: 1, region: null });
    if (spec.mode !== 'checked-dijkstra') throw new Error('fixture');
    const direct = spec.input.edges.find((e) => e.from === spec.input.start && e.to === spec.input.goal)!;
    const state = { ...initialExplorationState(spec), edgeWeights: { [direct.id]: 1000000 } };
    const run = explorationExecution(spec, state)!;
    expect(run.steps.at(-1)!.distances[spec.input.goal!]).toBe(3);
    for (let step = 0; step < run.steps.length; step++) {
      const scene = spatialScene(spec, { ...state, step })!;
      for (const object of scene.objects) { expect(object.position.y).toBeGreaterThanOrEqual(0); expect(object.position.y).toBeLessThanOrEqual(3); }
      const spread = spatialPresentation(scene, { ...state, spatial: { ...defaultSpatialView(), spread: 1 } });
      expect(spread.objects.map((o) => o.position.y)).toEqual(scene.objects.map((o) => o.position.y));
    }
  });
  it('keeps separated part positions stable when a revision reorders or adds objects', () => {
    const { spec } = candidate(), state = { ...initialExplorationState(spec), spatial: { ...defaultSpatialView(), spread: 0.8 } };
    const scene = spatialScene(spec, state)!, before = spatialPresentation(scene, state);
    const next = { ...scene, objects: [...scene.objects].reverse().concat([{ ...scene.objects[0], id: 'new_part' }]) };
    const after = spatialPresentation(next, state);
    for (const part of before.objects) expect(after.objects.find((o) => o.id === part.id)!.position).toEqual(part.position);
  });
  it('does not offer an empty 3D view for a text-only diagram', () => {
    const { spec } = candidate();
    spec.scene.panels = [{ id: 'text_diagram', kind: 'diagram', title: 'Annotation', placement: { column: 1, row: 1, columnSpan: 2 }, objects: [{ id: 'annotation', kind: 'text', text: 'No spatial entities here', position: { x: 0.5, y: 0.5 } }] }];
    spec.steps = [{ ...spec.steps[0], highlightIds: ['annotation'] }];
    expect(checkExploration(spec).validation.assurance).toBe('explanation-only');
    expect(supportsSpatial(spec)).toBe(false);
    const panel = spec.scene.panels[0];
    if (panel.kind !== 'diagram') throw new Error('fixture');
    panel.objects.push({ id: 'part', kind: 'block', label: 'A part', position: { x: 0.5, y: 0.5 } });
    expect(supportsSpatial(spec)).toBe(true);
    expect(spatialScene(spec, initialExplorationState(spec))!.annotations).toEqual(['No spatial entities here']);
  });
  it('scrubs poses reversibly without modifying the original scene', () => {
    const { spec } = candidate(), state = initialExplorationState(spec);
    const original = structuredClone(spec);
    expect(spatialScene(spec, state)!.objects.find((o) => o.id === 'signal')!.position.x).toBe(-1.3);
    expect(spatialScene(spec, { ...state, explanationStep: 2 })!.objects.find((o) => o.id === 'signal')!.position.x).toBe(1.3);
    expect(spatialScene(spec, { ...state, explanationStep: 1 })!.objects.find((o) => o.id === 'signal')!.position.x).toBe(0);
    expect(spec).toEqual(original);
  });
  it('hidden poses persist until changed, while reverse scrubbing restores visibility', () => {
    const { spec, panel } = candidate(), state = initialExplorationState(spec);
    panel.poses[1].visible = false; panel.poses.pop();
    expect(spatialScene(spec, { ...state, explanationStep: 2 })!.objects.find((o) => o.id === 'signal')!.visible).toBe(false);
    expect(spatialScene(spec, state)!.objects.find((o) => o.id === 'signal')!.visible).toBe(true);
  });
  it('separates and isolates presentation while preserving the underlying geometry', () => {
    const { spec } = candidate(), state = initialExplorationState(spec), base = spatialScene(spec, state)!;
    const original = structuredClone(base);
    const presented = spatialPresentation(base, { ...state, selectedObjectId: 'processor', spatial: { ...defaultSpatialView(), spread: 1, isolate: true } });
    expect(presented.objects.filter((o) => o.visible).map((o) => o.id)).toEqual(['processor']);
    expect(presented.connections).toEqual([]);
    expect(presented.objects.find((o) => o.id === 'processor')!.position).not.toEqual(base.objects.find((o) => o.id === 'processor')!.position);
    expect(base).toEqual(original);
    const shell = spatialPresentation(base, { ...state, selectedObjectId: 'enclosure', spatial: { ...defaultSpatialView(), isolate: true } });
    expect(shell.objects.every((o) => o.visible)).toBe(true);
  });
  it('shows unknown distances honestly and does not reveal future paths', () => {
    const spec = createExampleExploration(), state = initialExplorationState(spec), scene = spatialScene(spec, state)!;
    expect(scene.objects.find((o) => o.id === 'x')!.description).toContain('distance unknown');
    expect(scene.connections.some((e) => e.highlighted)).toBe(false);
    const run = explorationExecution(spec, state)!;
    const final = spatialScene(spec, { ...state, step: run.steps.length - 1 })!;
    expect(final.connections.filter((e) => e.highlighted).map((e) => e.id)).toEqual(['sa', 'ag']);
  });
  it('reflects weights, direction and disabled edges from current computation, with no presentation influence', () => {
    const spec = createWeightedExample({ observationId: 'test-source', version: 1, region: null });
    if (spec.mode !== 'checked-dijkstra') throw new Error('fixture');
    const base = initialExplorationState(spec), edge = spec.input.edges[0];
    const state = { ...base, edgeWeights: { [edge.id]: 0 }, spatial: { ...defaultSpatialView(), spread: 1, slice: 0.7 } };
    expect(explorationExecution(spec, state)).toEqual(explorationExecution(spec, { ...state, spatial: undefined }));
    expect(spatialScene(spec, state)!.connections.find((e) => e.id === edge.id)!.label).toBe('0');
    const disabled = { ...state, disabledEdgeIds: [edge.id] };
    expect(spatialScene(spec, disabled)!.connections.find((e) => e.id === edge.id)!.active).toBe(false);
    expect(spatialScene(spec, state)!.connections.every((e) => e.directed === spec.input.directed)).toBe(true);
  });
  it('projects every supported bounded trace including ties, zero weights and unreachable nodes', () => {
    for (const weight of [0, 1, 3, 1000000]) {
      const spec = createWeightedExample({ observationId: 'test-source', version: 1, region: null });
      if (spec.mode !== 'checked-dijkstra') throw new Error('fixture');
      const state = { ...initialExplorationState(spec), edgeWeights: Object.fromEntries(spec.input.edges.map((e) => [e.id, weight])) };
      for (const disabledEdgeIds of [[], spec.input.edges.map((e) => e.id)]) {
        const run = explorationExecution(spec, { ...state, disabledEdgeIds })!;
        for (let i = 0; i < run.steps.length; i++) {
          const scene = spatialScene(spec, { ...state, disabledEdgeIds, step: i })!;
          for (const object of scene.objects) {
            expect(Object.values(object.position).every(Number.isFinite)).toBe(true);
            const distance = run.steps[i].distances[object.id];
            expect(object.description).toContain(typeof distance === 'number' ? `distance ${distance}` : 'distance unknown');
          }
        }
      }
    }
  });
});
