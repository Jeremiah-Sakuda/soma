import { describe, expect, it } from 'vitest';
import { ENGINE, camCentre, crankPin, enginePose, expandEngine, pistonPin, poseEngineParts, strokeAt, valveLift } from '@/lib/domain/engine-kinematics';
import { spatialPanelSchema, validateSpatialPanel } from '@/lib/domain/spatial-schema';
import { tidySpatialPanel } from '@/lib/domain/spatial-tidy';

const angles = Array.from({ length: 145 }, (_, i) => i * 5);

describe('built-in engine kinematics', () => {
  it('keeps the connecting rod its own length at every crank angle', () => {
    for (const theta of angles) {
      const pin = crankPin(theta);
      expect(Math.hypot(pin.x, pistonPin(theta) - pin.y)).toBeCloseTo(ENGINE.rod, 9);
      const rod = enginePose('rod', theta), up = ((rod.rotZ * Math.PI) / 180);
      // The rod's frame points from the crank pin straight at the piston pin.
      expect(rod.x - Math.sin(up) * ENGINE.rod).toBeCloseTo(0, 9);
      expect(rod.y + Math.cos(up) * ENGINE.rod).toBeCloseTo(pistonPin(theta), 9);
    }
  });

  it('runs one cycle in two turns: four strokes, each valve open on its own stroke only', () => {
    expect([0, 180, 360, 540].map((t) => strokeAt(t + 90))).toEqual(['intake', 'compression', 'power', 'exhaust']);
    for (const theta of angles) {
      const stroke = strokeAt(Math.min(theta, 719.9));
      if (valveLift('intake', theta) > 1e-9) expect(stroke).toBe('intake');
      if (valveLift('exhaust', theta) > 1e-9) expect(stroke).toBe('exhaust');
    }
    expect(pistonPin(0)).toBeCloseTo(ENGINE.crank + ENGINE.rod, 9);
    expect(pistonPin(180)).toBeCloseTo(ENGINE.rod - ENGINE.crank, 9);
    expect(pistonPin(360)).toBeCloseTo(pistonPin(0), 9);
  });

  it('never lets an open valve reach the piston crown', () => {
    for (const theta of angles)
      for (const role of ['intake_valve', 'exhaust_valve'] as const) {
        const valve = enginePose(role, theta), crown = pistonPin(theta) + ENGINE.pinToCrown;
        // The valve head's lowest edge, 0.02 below its seat face.
        expect(valve.y - 0.02 - crown).toBeGreaterThan(0.05);
      }
  });

  it('turns each cam at half crank speed with its lobe meeting the valve exactly', () => {
    for (const theta of angles)
      for (const [cam, valve, which, side] of [['intake_cam', 'intake_valve', 'intake', -1], ['exhaust_cam', 'exhaust_valve', 'exhaust', 1]] as const) {
        const c = enginePose(cam, theta), v = enginePose(valve, theta);
        expect(c.x).toBeCloseTo(camCentre(side).x, 9);
        // The lobe's offset from the valve axis, in cam degrees, is half the crank's.
        const offset = Math.abs((((c.rotZ - v.rotZ) % 360) + 540) % 360 - 180);
        const profile = offset < 45 ? ENGINE.valveLift * Math.cos((offset * 2 * Math.PI) / 180) ** 2 : 0;
        expect(profile).toBeCloseTo(valveLift(which, theta), 9);
      }
  });
});

describe('expanding and posing the engine', () => {
  const authored = {
    id: 'engine_model', kind: 'spatial', title: 'Engine', placement: { column: 1, row: 1, columnSpan: 2 },
    objects: [{ id: 'engine', label: 'Engine', description: 'A four-stroke engine.', shape: 'box', renderStyle: 'engine', color: 'blue', position: { x: 0, y: 2.2, z: 0 }, size: { x: 4, y: 4.4, z: 4 }, parentId: null }],
    connections: [], poses: [],
    parameterPoses: [{ stepId: 'a', parameterId: 'crank', value: 0.5 }],
    viewAction: null,
  } as const;

  it('becomes named, highlightable parts with a crank control, valid and tidy as one assembly', () => {
    const panel = tidySpatialPanel(spatialPanelSchema.parse(expandEngine(authored as never)));
    expect(panel.objects.map((o) => o.id)).toContain('engine_piston');
    expect(panel.objects.map((o) => o.id)).toContain('engine_intake_valve');
    expect(panel.objects).toHaveLength(14);
    expect(panel.parameters?.map((p) => p.id)).toEqual(['crank']);
    expect(() => validateSpatialPanel(panel, [{ id: 'a' }])).not.toThrow();
    // One uniform scale for every part, so the assembly stays joined.
    expect(new Set(panel.objects.map((o) => o.size.x)).size).toBe(1);
  });

  it('poses every part from the block at the crank value, keeping joints exact', () => {
    const panel = spatialPanelSchema.parse(expandEngine(authored as never));
    const objects = panel.objects.map((o) => ({ ...o, visible: true }));
    const posed = poseEngineParts(objects, 0.25);
    const block = posed.find((o) => o.id === 'engine_block')!, piston = posed.find((o) => o.id === 'engine_piston')!;
    const s = block.size.x;
    expect(piston.position.y - block.position.y).toBeCloseTo(s * pistonPin(180), 9);
    // Transient parts show only while they act: no mixture flowing in at bottom dead centre.
    expect(posed.find((o) => o.id === 'engine_intake_flow')!.visible).toBe(false);
    expect(poseEngineParts(objects, 0.125).find((o) => o.id === 'engine_intake_flow')!.visible).toBe(true);
    for (const o of posed) expect(Math.abs(o.rotation!.z)).toBeLessThanOrEqual(180);
  });
});

describe('binding the engine to an explanation', () => {
  it('stops each step at the stroke its caption names, never backwards, and lights matching parts', async () => {
    const { mergeModelScene } = await import('@/lib/server/model-authoring');
    const step = (id: string, caption: string, highlightIds: string[]) => ({ id, caption, narration: caption, highlightIds, sourceHighlightIds: [], execution: null, executionStep: null });
    const previous = {
      schemaVersion: 'exploration-v1', id: 'x', version: 1, mode: 'explanation', title: 'Two turns', objective: 'Why', sources: [], assumptions: [], uncertainty: [], unsupportedClaims: [], followups: [],
      scene: { layout: 'diagram-sidebar', panels: [{ id: 'd', kind: 'diagram', title: 'Engine', placement: { column: 1, row: 1, columnSpan: 2 }, objects: [{ id: 'iv', kind: 'node', label: 'Intake valve', position: { x: 0.2, y: 0.2 } }, { id: 'pl', kind: 'node', label: 'Spark plug', position: { x: 0.5, y: 0.2 } }] }] },
      steps: [step('a', 'Intake: the valve opens and mixture flows in.', ['iv']), step('b', 'The spark fires after one turn.', ['pl']), step('c', 'Back to intake again, for comparison.', []), step('d', 'Two full turns: the cycle is complete.', [])],
    };
    const raw = { mode: 'explanation', scene: { panels: [{ id: 'm', kind: 'spatial', title: 'Engine', placement: { column: 1, row: 2, columnSpan: 2 }, objects: [{ id: 'engine', label: 'Engine', description: 'Engine.', shape: 'box', renderStyle: 'engine', color: 'blue', position: { x: 0, y: 2.2, z: 0 }, size: { x: 4, y: 4.4, z: 4 }, parentId: null }], connections: [], poses: [], parameterPoses: [] }] }, steps: [] };
    const merged = mergeModelScene(raw, previous as never) as { scene: { panels: { kind: string; parameterPoses?: { value: number }[] }[] }; steps: { highlightIds: string[] }[] };
    const spatial = merged.scene.panels.find((p) => p.kind === 'spatial')!;
    expect(spatial.parameterPoses!.map((p) => p.value)).toEqual([0.125, 0.5, 0.5, 1]);
    expect(merged.steps[0].highlightIds).toContain('engine_intake_valve');
    expect(merged.steps[1].highlightIds).toContain('engine_spark_plug');
  });
});
