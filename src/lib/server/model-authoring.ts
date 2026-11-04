import type { ExplorationSpec } from '../domain/exploration';
import { expandEngine } from '../domain/engine-kinematics';
import type { SpatialPanel } from '../domain/spatial-schema';

/** How Muse builds the 3D model of an existing explanation, for any subject. */
export const MODEL_AUTHORING =
  'BUILD THE 3D MODEL of the previous explanation (previous.spec): return mode="explanation" with exactly one spatial panel. ' +
  'First decide what the learner must SEE to get the answer to their question (the concept the question turns on: a gradient, a force balance, an offset distance, an inversion, a missing link), and make that a visible part, arrow or motion; then add only the parts needed around it. ' +
  'Physical subjects keep their real arrangement, relative sizes and containment (an organ and its parts, a molecule, plates and mantle, a machine, a cell). Abstract subjects (markets, protocols, algorithms, proofs) become one concrete spatial metaphor with the explanation\'s structure: two parties facing each other for an exchange with messages as arrows between them, stations along a path for a sequence, stacked layers for layers, heights for quantities; name the metaphor in a part description. ' +
  'Assembly rules: parts that touch in reality touch in the model (a car sits on its road, a rod ends exactly at the pin it joins, a plant stands on the soil); nothing floats unless it really flies. One continuous thing is ONE part: use shape="tube" with a path through its points for any continuous tube, wire, loop, river, string, bent slab or route (a nephron loop is one tube down, round the bend and up). ' +
  'Use shape="arrow" with a 2-point path [tail, tip] for every force, velocity, vector, flow, signal or attack the explanation names; root its tail on the part it acts on or comes from. size.x of an arrow or tube is its thickness (0.08-0.3). ' +
  'Use shape="sheet" with a path of 3-8 corners for any flat region: a parallelogram spanned by two vectors (corners exactly at their shared tail, a, a+b and b), a triangle or wedge (a deadweight-loss triangle), a plane through a crystal or a cross-section. A frame, cage or cell outline is tubes along its edges with atoms at its corners, never a solid box. ' +
  'Any plain part can be turned with rotation {x,y,z} in degrees: a banked road is a box rotated about its long axis by the bank angle, a dipping slab is a box rotated down toward where it sinks. A gradient is 3-4 stacked slabs from light to dark of one color, each named. A cycle is arrows chained head to tail back to where it started. ' +
  'Molecules are ball-and-stick: atoms are spheres sized by element (H 0.35, C 0.6, O 0.55, N 0.55, Br or Cl 0.8), bonds are tubes from atom centre to atom centre, with the true geometry (tetrahedral about 109 degrees, planar 120 degrees). Vectors share their tail point. A crystal cell has every atom at its true site (simple cubic 8 corners, BCC plus the body centre, FCC plus the 6 face centres) joined by edge tubes. Two cases being compared stand side by side, each named. Use 4-24 parts, as few as tell the story. ' +
  'Name each part with the source\'s own words and a one-sentence description of its role. For a part that matches a previous diagram object, its ID is that object\'s ID followed by _3d (diagram id heart -> heart_3d); other parts get new IDs. ' +
  'Coordinates: x left-right, y up, z toward the viewer; the floor is y=0; keep x,z in [-4,4] and y in [0,4]; sizes 0.3-3 (a part\'s size is its full width, height and depth). A part inside another uses parentId (its container is drawn as a translucent shell). Spread separate parts so each is visible from a front-left view. Example: a block resting on the floor is a box at {x:0,y:0.5,z:0} with size 1; its weight is an arrow pointing down just beside it, path [{x:0.75,y:0.9,z:0},{x:0.75,y:0.1,z:0}]. ' +
  'Use connections only for named relations without a direction of travel; draw anything that moves or acts as an arrow part instead. ' +
  'Animate the explanation, and make every step change something visible: poses move or reveal parts at the step where they act, so stepping through shows the process happening (a message travelling between parties, a part produced, a car sliding up the bank). A part that only appears later has visible=false in the poses of earlier steps. A pose of an arrow, tube or sheet may give that step\'s new path, so a rod tilts as the crank turns, a force arrow grows, a string bends into a new shape, while staying attached to the parts it joins. ' +
  'Keep previous.spec step ids, captions and narration exactly; set each step\'s highlightIds to the parts that step is about. Keep the title. ' +
  'A PISTON ENGINE (four-stroke, Otto cycle, internal combustion, a car or motorcycle engine): use Soma\'s built-in cutaway instead of building one. Add exactly ONE part {id:"engine", renderStyle:"engine", shape:"box", color:"blue", position {x:0,y:2.2,z:0}, size {x:4,y:4.4,z:4}, parentId:null}; Soma expands it into engine_block, engine_piston, engine_rod, engine_crank, engine_intake_valve, engine_exhaust_valve, engine_intake_cam, engine_exhaust_cam, engine_spark_plug, engine_timing_belt (2:1 sprockets), engine_charge (the gas), engine_spark, engine_intake_flow and engine_exhaust_flow, exactly assembled and moving together. Never build those parts yourself and never use an engine-* renderStyle. Add parameter {id:"crank", label:"Crankshaft angle", description:"0 to 720 degrees: two crankshaft turns, one four-stroke cycle.", initial:0} and, for EVERY step, one parameterPose {stepId, parameterId:"crank", value} where value = the crank angle that step is about / 720: 0 top before intake, 0.125 mid-intake (intake valve open, mixture flowing in), 0.25 bottom after intake, 0.375 mid-compression, 0.5 top of compression (spark), 0.56 early power, 0.75 bottom after power, 0.875 mid-exhaust (exhaust valve open), 1 end of the second turn. Choose the angles that show the learner\'s question (for two turns: stop at 0.5 to show one turn done with the cycle half finished). Set each step\'s highlightIds to the engine parts it is about (engine_intake_valve, engine_spark_plug, engine_crank...). Add other parts only if the explanation needs something the engine lacks. ' +
  'Choose renderStyle from the catalog only when the part literally is that thing; otherwise renderStyle=null and a plain shape whose silhouette fits (sphere for atoms, cells, planets; cylinder for vessels and columns; box for blocks, slabs, layers, devices; torus for rings). One color per role. ' +
  'viewAction camera="perspective", other fields null. mechanism=null. Add one assumption saying the model is illustrative.';

/** For the built-in engine: which part a diagram part or a step's words are about. */
const ENGINE_WORDS: [RegExp, string[]][] = [
  [/intake|inlet/i, ['intake_valve']],
  [/exhaust/i, ['exhaust_valve']],
  [/spark|ignit|plug/i, ['spark_plug']],
  [/piston/i, ['piston']],
  [/\brod\b|connecting/i, ['rod']],
  [/crank/i, ['crank']],
  [/cam\b|camshaft/i, ['intake_cam', 'exhaust_cam']],
  [/belt|timing|chain|sprocket/i, ['timing_belt']],
  [/mixture|charge|fuel|gas\b|air\b/i, ['charge']],
];
/** The crank angle a step's words point at, as a fraction of two turns. A step that ends a turn
 * stops at that turn's end; otherwise it stops in the middle of the last stroke it names, where
 * that stroke's valve and gas are visible; the explanation's own order never turns it backwards. */
export function crankFromWords(text: string): number | null {
  const turn = '(crank(shaft)? )?(turn|revolution|rotation)';
  if (new RegExp(`\\b720\\b|two (full )?(crank(shaft)? )?(turns|revolutions|rotations)|(finish|complet|end)\\w* (the )?second|second (full )?${turn}s? (is )?(done|complete|finished|over)|cycle (repeats|ends|is complete)|four half`, 'i').test(text)) return 1;
  if (new RegExp(`(finish|complet|end)\\w* (the )?first|first (full )?${turn}|one (full )?${turn}\\b|\\b360\\b`, 'i').test(text)) return 0.5;
  const strokes: [RegExp, number][] = [[/intake|draws? in|drawn in|takes? in|suck/gi, 0.125], [/compress|squeez/gi, 0.375], [/spark|ignit/gi, 0.5], [/power|expan|burn|combust/gi, 0.62], [/exhaust/gi, 0.875]];
  let last: [number, number] | null = null;
  for (const [re, value] of strokes) for (const m of text.matchAll(re)) if (!last || m.index! >= last[0]) last = [m.index!, value];
  if (last) return last[1];
  if (/half a turn|half-turn|\b180\b/i.test(text)) return 0.25;
  return null;
}
/** Binds the built-in engine to the explanation it illustrates: every step gets a crank angle
 * (Muse's when given, else read from the step's own words, else spread evenly), never turning
 * backwards, and diagram highlights light the matching engine parts. */
function bindEngine(spatial: Panel & { objects?: { id?: unknown; renderStyle?: unknown }[] }, previous: Extract<ExplorationSpec, { mode: 'explanation' }>) {
  const block = spatial.objects?.find((o) => o?.renderStyle === 'engine-block');
  if (typeof block?.id !== 'string') return null;
  const prefix = block.id.replace(/_block$/, '');
  const given = new Map((spatial.parameterPoses ?? []).filter((p) => (p as { parameterId?: unknown }).parameterId === 'crank').map((p) => [p.stepId, (p as unknown as { value: number }).value]));
  let last = 0;
  spatial.parameterPoses = previous.steps.map((step, i) => {
    // The caption says what the step shows; the narration only if the caption names no stroke.
    const chosen = given.get(step.id) ?? crankFromWords(step.caption) ?? crankFromWords(step.narration ?? '') ?? (i + 1) / previous.steps.length;
    last = Math.max(last, Math.min(1, Math.max(0, chosen)));
    return { stepId: step.id, parameterId: 'crank', value: last };
  }) as Panel['parameterPoses'];
  const diagramText = new Map(
    previous.scene.panels.flatMap((p) => (p.kind === 'diagram' ? p.objects.map((o) => [o.id, `${o.id} ${'label' in o ? o.label : ''} ${'text' in o ? o.text : ''}`] as const) : [])),
  );
  const partsFor = (text: string) => ENGINE_WORDS.flatMap(([re, roles]) => (re.test(text) ? roles.map((r) => `${prefix}_${r}`) : []));
  return (step: Extract<ExplorationSpec, { mode: 'explanation' }>['steps'][number]) => [...new Set(step.highlightIds.flatMap((id) => partsFor(diagramText.get(id) ?? id)))];
}

export const ENGINE_ASSUMPTION = 'The engine cutaway is Soma’s built-in illustration: its parts, layout, proportions and motion are illustrative, not read from the source.';

type Raw = Record<string, unknown> & { scene?: { layout?: unknown; panels?: unknown[] }; steps?: unknown[]; assumptions?: unknown };
type Panel = { id: string; kind: string; placement: { column: number; row: number; columnSpan: number }; poses?: { stepId: string }[]; parameterPoses?: { stepId: string }[] | null };

/** Puts the authored model beside the explanation it illustrates: the previous panels, words
 * and steps stay as published; the model's poses bind to those steps, and each step also
 * highlights the model's parts it names. The result is validated as a whole afterwards. */
export function mergeModelScene(raw: unknown, previous: ExplorationSpec): unknown {
  if (previous.mode !== 'explanation' || !raw || typeof raw !== 'object') return raw;
  const spec = raw as Raw;
  let spatial = (spec.scene?.panels ?? []).find((p): p is Panel => !!p && typeof p === 'object' && (p as Panel).kind === 'spatial');
  if (!spatial) return raw;
  // The built-in engine becomes its named parts before anything refers to them.
  if (Array.isArray((spatial as unknown as SpatialPanel).objects) && Array.isArray((spatial as unknown as SpatialPanel).poses)) {
    const expanded = expandEngine(spatial as unknown as SpatialPanel) as unknown as Panel;
    spec.scene!.panels = spec.scene!.panels!.map((p) => (p === spatial ? expanded : p));
    spatial = expanded;
  }
  const kept = previous.scene.panels.filter((p) => p.kind !== 'spatial').map((p) => structuredClone(p));
  // The model spans both columns on the first free row; a full grid gives up its last row.
  const used = new Set(kept.map((p) => p.placement.row));
  let row = [1, 2, 3, 4].find((r) => !used.has(r) && r > Math.max(0, ...used)) ?? [1, 2, 3, 4].find((r) => !used.has(r));
  const panels: unknown[] = row === undefined ? kept.filter((p) => p.placement.row !== 4) : kept;
  row ??= 4;
  spatial.placement = { column: 1, row, columnSpan: 2 };
  // A model part named like a diagram part (or a panel) is renamed, with every reference.
  const taken = new Set<string>(kept.flatMap((p) => [p.id, ...(p.kind === 'diagram' ? p.objects.map((o) => o.id) : [])]));
  const renamed = new Map<string, string>();
  const sp = spatial as unknown as {
    id: string;
    objects?: { id?: unknown; parentId?: unknown }[];
    connections?: { id?: unknown; from?: unknown; to?: unknown }[];
    poses?: { objectId?: unknown }[];
    viewAction?: { focusObjectId?: unknown } | null;
  };
  for (const item of [...(sp.objects ?? []), ...(sp.connections ?? [])]) {
    if (typeof item?.id !== 'string' || !taken.has(item.id)) {
      if (typeof item?.id === 'string') taken.add(item.id);
      continue;
    }
    let next = `${item.id}_3d`.slice(0, 48);
    for (let n = 2; taken.has(next); n++) next = `${item.id.slice(0, 40)}_3d${n}`;
    renamed.set(item.id, next);
    taken.add(next);
    item.id = next;
  }
  if (taken.has(sp.id)) sp.id = `${sp.id}_model`.slice(0, 48);
  const rename = (v: unknown) => (typeof v === 'string' ? renamed.get(v) ?? v : v);
  for (const o of sp.objects ?? []) o.parentId = rename(o.parentId);
  for (const c of sp.connections ?? []) {
    c.from = rename(c.from);
    c.to = rename(c.to);
  }
  for (const pose of sp.poses ?? []) pose.objectId = rename(pose.objectId);
  if (sp.viewAction) sp.viewAction.focusObjectId = rename(sp.viewAction.focusObjectId);
  const stepIds = new Set(previous.steps.map((s) => s.id));
  const engineParts = bindEngine(spatial, previous);
  if (Array.isArray(spatial.poses)) spatial.poses = spatial.poses.filter((p) => stepIds.has(p.stepId));
  if (Array.isArray(spatial.parameterPoses)) spatial.parameterPoses = spatial.parameterPoses.filter((p) => stepIds.has(p.stepId));
  const known = new Set<string>([
    ...(Array.isArray((spatial as { objects?: unknown }).objects) ? ((spatial as unknown as { objects: { id?: unknown }[] }).objects.map((o) => o?.id)) : []),
    ...(Array.isArray((spatial as { connections?: unknown }).connections) ? ((spatial as unknown as { connections: { id?: unknown }[] }).connections.map((c) => c?.id)) : []),
  ].filter((id): id is string => typeof id === 'string'));
  const authored = new Map(
    (spec.steps ?? [])
      .filter((s): s is { id: string; highlightIds?: unknown } => !!s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string')
      .map((s) => [s.id, Array.isArray(s.highlightIds) ? s.highlightIds.map(rename).filter((id): id is string => typeof id === 'string' && known.has(id)) : []]),
  );
  const assumptions = [
    ...previous.assumptions,
    // Soma's own cutaway says what it adds beyond the source.
    ...(engineParts ? [ENGINE_ASSUMPTION] : []),
    ...(Array.isArray(spec.assumptions) ? spec.assumptions.filter((a): a is string => typeof a === 'string' && !previous.assumptions.includes(a)) : []),
  ].slice(0, 6);
  return {
    ...spec,
    title: previous.title,
    objective: previous.objective,
    sources: previous.sources,
    uncertainty: previous.uncertainty,
    unsupportedClaims: previous.unsupportedClaims,
    followups: previous.followups,
    assumptions,
    scene: { layout: previous.scene.layout, panels: [...panels, spatial] },
    steps: previous.steps.map((step) => ({
      ...structuredClone(step),
      // A diagram part's model twin (id_3d) lights up with it.
      highlightIds: [...new Set([...step.highlightIds, ...step.highlightIds.map((id) => `${id}_3d`).filter((id) => known.has(id)), ...(engineParts?.(step) ?? []), ...(authored.get(step.id) ?? [])])].slice(0, 24),
    })),
  };
}
