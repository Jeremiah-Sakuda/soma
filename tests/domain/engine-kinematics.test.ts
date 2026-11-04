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

describe('reading a step for the crank angle it is about', () => {
  it('ends a turn at the turn, otherwise stops mid-way through the last stroke named', async () => {
    const { crankFromWords } = await import('@/lib/server/model-authoring');
    const cases: [string, number | null][] = [
      ['First turn does intake and compression.', 0.5],
      ['Second turn does power and exhaust.', 0.875],
      ['Four strokes equal 720 degrees, so two revolutions.', 1],
      ['Intake moves the piston down, turning the crank about half a turn.', 0.125],
      ['Compression moves the piston back up for the second half-turn.', 0.375],
      ['Power pushes the piston down again, starting the second revolution.', 0.62],
      ['Exhaust pushes the piston up, finishing 720 deg or 2 turns.', 1],
      ['Each up or down piston move is one stroke and turns the crank about half a turn.', 0.25],
      ['Power drives the piston down after the spark, then exhaust pushes it back up.', 0.875],
      ['Intake down plus compression up complete the first full crankshaft revolution.', 0.5],
      ['The valves are drawn larger here.', null],
    ];
    for (const [text, value] of cases) expect([text, crankFromWords(text)]).toEqual([text, value]);
  });
});

describe('naming the stroke at its boundary', () => {
  it('names the stroke that is finishing, not the next one', () => {
    expect(strokeAt(0)).toBe('intake');
    expect(strokeAt(180)).toBe('intake');
    expect(strokeAt(181)).toBe('compression');
    expect(strokeAt(360)).toBe('compression');
    expect(strokeAt(361)).toBe('power');
    expect(strokeAt(540)).toBe('power');
    expect(strokeAt(720)).toBe('exhaust');
  });
});

describe('where an explanation lifts from', () => {
  const anchors = [
    { id: 'steps', label: 'Numbered steps', region: { x: 0.54, y: 0.3, width: 0.42, height: 0.4 } },
    { id: 'diagram', label: 'Engine diagram', region: { x: 0.05, y: 0.15, width: 0.42, height: 0.8 } },
    { id: 'title', label: 'Title', region: { x: 0, y: 0, width: 0.5, height: 0.08 } },
  ];
  const steps = [{ sourceHighlightIds: ['diagram', 'steps'] }, { sourceHighlightIds: ['steps'] }, { sourceHighlightIds: ['diagram'] }];
  it('grows from one located part over the parts beside it, not across to the words', async () => {
    const { liftFocus } = await import('@/lib/domain/scene-lift');
    const region = liftFocus(
      { x: 0, y: 0, width: 1, height: 1 },
      [
        { id: 'piston', label: 'Piston', region: { x: 0.12, y: 0.5, width: 0.2, height: 0.15 } },
        { id: 'head', label: 'Cylinder head', region: { x: 0.1, y: 0.25, width: 0.26, height: 0.22 } },
        { id: 'crank', label: 'Crank', region: { x: 0.14, y: 0.68, width: 0.2, height: 0.2 } },
        { id: 'callout', label: 'Callout: one cycle', region: { x: 0.54, y: 0.2, width: 0.42, height: 0.2 } },
      ],
      [{ sourceHighlightIds: ['piston'] }],
    )!;
    expect(region.y).toBeCloseTo(0.245);
    expect(region.x + region.width).toBeLessThan(0.45);
    expect(region.y + region.height).toBeCloseTo(0.93);
  });
  it('keeps where the learner pointed', async () => {
    const { liftFocus } = await import('@/lib/domain/scene-lift');
    const pointed = { x: 0.1, y: 0.1, width: 0.3, height: 0.3 };
    expect(liftFocus(pointed, anchors, steps)).toEqual(pointed);
  });
  it('treats a typed question, whose focus is the whole display, as pointing at the drawing its steps return to', async () => {
    const { liftFocus } = await import('@/lib/domain/scene-lift');
    const region = liftFocus({ x: 0, y: 0, width: 1, height: 1 }, anchors, steps)!;
    expect(region.x).toBeCloseTo(0.01);
    expect(region.width).toBeCloseTo(0.5);
    expect(region.y).toBeCloseTo(0.145);
    // Nothing but words located, or nothing at all: the middle of the screen, never the whole of it.
    expect(liftFocus({ x: 0, y: 0, width: 1, height: 1 }, [], steps)).toBeUndefined();
    expect(liftFocus({ x: 0, y: 0, width: 1, height: 1 }, anchors.filter((a) => a.id !== 'diagram'), steps)).toBeUndefined();
  });
});

describe('keeping a lift clear of what is on the slide', () => {
  // 20 by 10 cells: a label sits across x = 4..7 on row 4, a title across the top rows.
  const grid = (() => {
    const width = 20, height = 10, ink = new Uint8Array(width * height);
    for (let x = 4; x <= 7; x++) ink[4 * width + x] = 1;
    for (let x = 0; x < 20; x++) ink[0 * width + x] = 1;
    return { width, height, ink };
  })();
  it('moves an edge that would slice a label out to the next blank line', async () => {
    const { clearOfInk } = await import('@/lib/domain/scene-lift');
    const r = clearOfInk({ x: 0.3, y: 0.2, width: 0.4, height: 0.6 }, grid);
    expect(r.x).toBeCloseTo(0.15);
    expect(r.x + r.width).toBeCloseTo(0.7);
  });
  it('leaves a clean edge, and an edge with no blank line in reach, where it was', async () => {
    const { clearOfInk } = await import('@/lib/domain/scene-lift');
    expect(clearOfInk({ x: 0.5, y: 0.2, width: 0.3, height: 0.6 }, grid)).toEqual({ x: 0.5, y: 0.2, width: 0.3, height: 0.6 });
    const solid = { width: 20, height: 10, ink: new Uint8Array(200).fill(1) };
    expect(clearOfInk({ x: 0.5, y: 0.2, width: 0.3, height: 0.6 }, solid)).toEqual({ x: 0.5, y: 0.2, width: 0.3, height: 0.6 });
    expect(clearOfInk({ x: 0.5, y: 0.2, width: 0.3, height: 0.6 }, null)).toEqual({ x: 0.5, y: 0.2, width: 0.3, height: 0.6 });
  });
});

describe('where each step stops the crank', () => {
  const steps = (...captions: string[]) => captions.map((caption, i) => ({ id: `s${i}`, caption }));
  it('does not start at the answer when the first caption states it', async () => {
    const { crankStops } = await import('@/lib/server/model-authoring');
    expect(crankStops(steps('It takes two full crankshaft turns.', 'The first turn does intake and compression.', 'The second turn adds power and exhaust.', 'Four strokes make 720 degrees.'))).toEqual([0, 0.5, 0.875, 1]);
  });
  it('spreads steps that name no stroke evenly, and keeps Muse\'s own stops', async () => {
    const { crankStops } = await import('@/lib/server/model-authoring');
    crankStops(steps('It needs four separate moves.', 'A move is one stroke.', 'Each one is half a crank circle.', 'So here is the whole cycle.')).forEach((v, i) => expect(v).toBeCloseTo(i / 3));
    expect(crankStops(steps('a', 'b'), new Map([['s0', 0.25], ['s1', 0.1]]))).toEqual([0.25, 0.25]);
  });
});

describe('taking in a drawing\'s labels', () => {
  const W = 40, H = 40;
  const make = (paint: (set: (x: number, y: number) => void) => void) => {
    const ink = new Uint8Array(W * H);
    paint((x, y) => { ink[y * W + x] = 1; });
    return { width: W, height: H, ink };
  };
  it('takes in a label just beyond a clean edge', async () => {
    const { clearOfInk } = await import('@/lib/domain/scene-lift');
    const grid = make((set) => { for (let x = 12; x <= 18; x++) set(x, 12); });
    const r = clearOfInk({ x: 0.25, y: 0.35, width: 0.4, height: 0.4 }, grid);
    expect(r.y).toBeCloseTo(11 / 40);
  });
  it('stops at a rule across the whole span, and leaves the words beyond it', async () => {
    const { clearOfInk } = await import('@/lib/domain/scene-lift');
    const grid = make((set) => { for (let x = 0; x < W; x++) set(x, 12); for (let x = 12; x <= 18; x++) set(x, 10); });
    const r = clearOfInk({ x: 0.25, y: 0.35, width: 0.4, height: 0.4 }, grid);
    expect(r.y).toBeCloseTo(0.35);
  });
});
