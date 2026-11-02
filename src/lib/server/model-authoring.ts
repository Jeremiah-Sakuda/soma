import type { ExplorationSpec } from '../domain/exploration';

/** How Muse builds the 3D model of an existing explanation, for any subject. */
export const MODEL_AUTHORING =
  'BUILD THE 3D MODEL of the previous explanation (previous.spec): return mode="explanation" with exactly one spatial panel. ' +
  'Model the thing the explanation is about, as a learner would picture it: physical subjects keep their real arrangement, relative sizes and containment (an organ and its parts, a molecule\'s atoms, plates and mantle, a machine\'s parts, a cell and its organelles); ' +
  'abstract subjects (markets, protocols, algorithms, proofs) become one concrete spatial metaphor that keeps the explanation\'s structure: stations along a path for a sequence, stacked layers for layers, two parties facing each other for an exchange, a surface where height is a quantity; say which metaphor in a part description. ' +
  'Use 4-10 parts, each named with the source\'s own words and a one-sentence description of its role. For a part that matches a previous diagram object, its ID is that object\'s ID followed by _3d (diagram id heart -> heart_3d); other parts get new IDs. ' +
  'Coordinates: x left-right, y up, z toward the viewer; the floor is y=0 and parts rest on it or on their container unless they really float; keep every part within x,z in [-4,4] and y in [0,4]; sizes 0.3-3; parts never interpenetrate except a part inside its parentId container (a translucent shell). Spread parts so each is visible from a front-left view; the most important part near the centre. ' +
  'Use connections for flows, forces, signals or transfers named in the explanation, each with a 1-3 word label and the right direction. ' +
  'Animate the explanation: poses move or reveal parts at the step where they act, so stepping through shows the process happening (an object travelling along a path, a part appearing when produced, a part moving when pushed). Hide a part (visible=false) before the step that introduces it only when it does not exist yet. ' +
  'Keep previous.spec step ids, captions and narration exactly; set each step\'s highlightIds to the parts and connections that step is about. Keep the title. ' +
  'Choose renderStyle from the catalog only when it is literally that thing; otherwise renderStyle=null with a plain shape whose silhouette fits (sphere for atoms, cells, planets; cylinder for vessels, pipes, columns; box for blocks, layers, devices; torus for rings). Use colors to separate roles, one color per role. ' +
  'viewAction camera="perspective", other fields null. mechanism=null unless a moving machine needs custom pieces. Add one assumption saying the model is illustrative.';

type Raw = Record<string, unknown> & { scene?: { layout?: unknown; panels?: unknown[] }; steps?: unknown[]; assumptions?: unknown };
type Panel = { id: string; kind: string; placement: { column: number; row: number; columnSpan: number }; poses?: { stepId: string }[]; parameterPoses?: { stepId: string }[] | null };

/** Puts the authored model beside the explanation it illustrates: the previous panels, words
 * and steps stay as published; the model's poses bind to those steps, and each step also
 * highlights the model's parts it names. The result is validated as a whole afterwards. */
export function mergeModelScene(raw: unknown, previous: ExplorationSpec): unknown {
  if (previous.mode !== 'explanation' || !raw || typeof raw !== 'object') return raw;
  const spec = raw as Raw;
  const spatial = (spec.scene?.panels ?? []).find((p): p is Panel => !!p && typeof p === 'object' && (p as Panel).kind === 'spatial');
  if (!spatial) return raw;
  const kept = previous.scene.panels.filter((p) => p.kind !== 'spatial').map((p) => structuredClone(p));
  // The model spans both columns on the first free row; a full grid gives up its last row.
  const used = new Set(kept.map((p) => p.placement.row));
  let row = [1, 2, 3, 4].find((r) => !used.has(r) && r > Math.max(0, ...used)) ?? [1, 2, 3, 4].find((r) => !used.has(r));
  const panels: unknown[] = row === undefined ? kept.filter((p) => p.placement.row !== 4) : kept;
  row ??= 4;
  spatial.placement = { column: 1, row, columnSpan: 2 };
  const stepIds = new Set(previous.steps.map((s) => s.id));
  if (Array.isArray(spatial.poses)) spatial.poses = spatial.poses.filter((p) => stepIds.has(p.stepId));
  if (Array.isArray(spatial.parameterPoses)) spatial.parameterPoses = spatial.parameterPoses.filter((p) => stepIds.has(p.stepId));
  const known = new Set<string>([
    ...(Array.isArray((spatial as { objects?: unknown }).objects) ? ((spatial as unknown as { objects: { id?: unknown }[] }).objects.map((o) => o?.id)) : []),
    ...(Array.isArray((spatial as { connections?: unknown }).connections) ? ((spatial as unknown as { connections: { id?: unknown }[] }).connections.map((c) => c?.id)) : []),
  ].filter((id): id is string => typeof id === 'string'));
  const authored = new Map(
    (spec.steps ?? [])
      .filter((s): s is { id: string; highlightIds?: unknown } => !!s && typeof s === 'object' && typeof (s as { id?: unknown }).id === 'string')
      .map((s) => [s.id, Array.isArray(s.highlightIds) ? s.highlightIds.filter((id): id is string => typeof id === 'string' && known.has(id)) : []]),
  );
  const assumptions = [
    ...previous.assumptions,
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
      highlightIds: [...new Set([...step.highlightIds, ...step.highlightIds.map((id) => `${id}_3d`).filter((id) => known.has(id)), ...(authored.get(step.id) ?? [])])].slice(0, 24),
    })),
  };
}
