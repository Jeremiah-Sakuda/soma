import type { MechanismPiece } from './mechanism-schema';
import type { SpatialScene } from './spatial-exploration';
import type { SourceOverlayModel } from './source-overlay-model';

type Region = { x: number; y: number; width: number; height: number };
type Vec = { x: number; y: number; z: number };
export type LiftSceneObject = {
  id: string;
  label: string;
  /** One short line for the part's chip: its role, or its checked value. */
  detail: string;
  shape: 'sphere' | 'box' | 'cylinder' | 'torus' | 'arrow' | 'tube' | 'sheet';
  rotation?: Vec;
  path?: Vec[];
  renderStyle: string | null;
  color: 'clay' | 'sage' | 'blue' | 'gold' | 'violet';
  /** Model units, y up, centred on the sheet. */
  position: Vec;
  size: Vec;
  parentId: string | null;
  /** Holds other parts: drawn see-through. */
  shell?: boolean;
  visible: boolean;
  highlighted: boolean;
  /** Picked by the learner, on the page or on screen. */
  selected?: boolean;
  geometry?: MechanismPiece[];
  parameterValues?: Record<string, number>;
  /** Where the part's name sits, when not above its top (an assembly's inner parts). */
  labelAt?: Vec;
  /** Where the part stands on the capture (normalized), when it was read from the source. */
  anchor?: { x: number; y: number };
};
/** A 3D scene the companion lifts off the learner's screen: any answer's spatial view, in a
 * bounded, plain shape the native side can check. Presentation only. */
export type LiftScene = {
  /** model: an illustrative model of an explanation; height: a checked quantity as height. */
  kind: 'model' | 'height';
  title: string;
  /** What the shapes, or the heights, mean. */
  note: string;
  /** The part of the capture the sheet lifts from (normalized). */
  region: Region;
  objects: LiftSceneObject[];
  connections: { id: string; from: string; to: string; label: string; directed: boolean; active: boolean; highlighted: boolean }[];
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/** The region a model stands on: the learner's circled or pointed area, widened so a model
 * has room, or the middle of the capture. */
const WORDS_ON_A_SLIDE = /list|bullet|steps|text|title|heading|caption|note|callout|box|equation|formula/i;
/** What an explanation lifts from: where the learner pointed; for a question that pointed at
 * nothing (a typed question's focus is the whole display), the drawing on the source, grown from
 * the located part its steps return to most over every part beside it; else nothing, which
 * leaves the middle of the screen. */
export function liftFocus(
  focus: Region | null | undefined,
  anchors: readonly { id: string; label: string; region: Region }[] | null | undefined,
  steps: readonly { sourceHighlightIds?: readonly string[] | null }[],
): Region | undefined {
  if (focus && (focus.width < 0.9 || focus.height < 0.9)) return focus;
  const parts = (anchors ?? []).filter((a) => !WORDS_ON_A_SLIDE.test(`${a.id} ${a.label}`));
  const score = (a: (typeof parts)[number]) =>
    (steps.filter((s) => s.sourceHighlightIds?.includes(a.id)).length + 0.5) * Math.sqrt(a.region.width * a.region.height);
  const best = [...parts].sort((a, b) => score(b) - score(a))[0];
  if (!best) return undefined;
  let u = { x0: best.region.x, y0: best.region.y, x1: best.region.x + best.region.width, y1: best.region.y + best.region.height };
  for (let grown = true; grown; ) {
    grown = false;
    for (const { region: r } of parts) {
      const gapX = Math.max(u.x0 - (r.x + r.width), r.x - u.x1), gapY = Math.max(u.y0 - (r.y + r.height), r.y - u.y1);
      const inside = r.x >= u.x0 && r.y >= u.y0 && r.x + r.width <= u.x1 && r.y + r.height <= u.y1;
      if (inside || gapX > 0.05 || gapY > 0.05) continue;
      u = { x0: Math.min(u.x0, r.x), y0: Math.min(u.y0, r.y), x1: Math.max(u.x1, r.x + r.width), y1: Math.max(u.y1, r.y + r.height) };
      grown = true;
    }
  }
  const area = (u.x1 - u.x0) * (u.y1 - u.y0);
  if (area < 0.04 || area > 0.8) return undefined;
  // Room for the drawing's own labels, which a located region tends to clip: more at the sides
  // and below, hardly any above, where a slide's title sits. Kept on the display.
  const x = Math.max(0, u.x0 - 0.04), y = Math.max(0, u.y0 - 0.005);
  return { x, y, width: Math.min(1 - x, u.x1 + 0.04 - x), height: Math.min(1 - y, u.y1 + 0.05 - y) };
}

/** A coarse map of where a capture has anything on it, row by row from the top left. */
export type InkGrid = { width: number; height: number; ink: Uint8Array };
/** Moves each edge of a region outward to the nearest blank line of the capture, and over any
 * label just beyond it, so a lift never slices a label in half or leaves one stranded. It reaches
 * further sideways and below than above, where a slide's title sits. A line drawn across the whole
 * span, such as a title's rule, stops an edge; an edge with no blank line in reach stays put. */
export function clearOfInk(region: Region, grid: InkGrid | null | undefined): Region {
  if (!grid?.width || !grid.height) return region;
  const { width: W, height: H, ink } = grid;
  let x0 = Math.floor(region.x * W), x1 = Math.ceil((region.x + region.width) * W) - 1;
  let y0 = Math.floor(region.y * H), y1 = Math.ceil((region.y + region.height) * H) - 1;
  const share = (from: number, to: number, at: (i: number) => number) => {
    let n = 0;
    for (let i = from; i <= to; i++) n += ink[at(i)];
    return n / Math.max(1, to - from + 1);
  };
  const column = (x: number) => share(Math.max(0, y0), Math.min(H - 1, y1), (y) => y * W + x);
  const row = (y: number) => share(Math.max(0, x0), Math.min(W - 1, x1), (x) => y * W + x);
  const grow = (start: number, step: number, size: number, limit: number, gap: number, line: (at: number) => number) => {
    const inReach = (at: number) => at >= 0 && at < size && Math.abs(at - start) <= limit;
    const blankFrom = (from: number): number | null => {
      for (let at = from; inReach(at); at += step) {
        const s = line(at);
        if (s === 0) return at;
        if (s >= 0.85) return null;
      }
      return null;
    };
    const first = blankFrom(start);
    if (first === null) return start;
    let edge = first;
    for (;;) {
      let label: number | null = null;
      for (let d = 1; d <= gap && inReach(edge + step * d); d++) {
        const s = line(edge + step * d);
        if (s >= 0.85) break;
        if (s > 0) { label = edge + step * d; break; }
      }
      const past: number | null = label === null ? null : blankFrom(label);
      if (past === null) return edge;
      edge = past;
    }
  };
  const side = Math.ceil(W * 0.12), below = Math.ceil(H * 0.12), above = Math.ceil(H * 0.08);
  const gapX = Math.ceil(W * 0.035), gapY = Math.ceil(H * 0.04);
  for (let pass = 0; pass < 2; pass++) {
    x0 = grow(x0, -1, W, side, gapX, column);
    x1 = grow(x1, 1, W, side, gapX, column);
    y0 = grow(y0, -1, H, above, gapY, row);
    y1 = grow(y1, 1, H, below, gapY, row);
  }
  return { x: x0 / W, y: y0 / H, width: (x1 + 1 - x0) / W, height: (y1 + 1 - y0) / H };
}

export function liftRegion(focus: Region | null | undefined, aspect: number): Region {
  const minW = 0.42, minH = Math.min(1, (minW * 0.62) / Math.max(0.2, aspect));
  const base = focus ?? { x: 0.2, y: 0.2, width: 0.6, height: 0.6 };
  const width = Math.min(1, Math.max(minW, base.width)),
    height = Math.min(1, Math.max(minH, base.height));
  const cx = base.x + base.width / 2,
    cy = base.y + base.height / 2;
  const x = Math.max(0, Math.min(1 - width, cx - width / 2)),
    y = Math.max(0, Math.min(1 - height, cy - height / 2));
  return { x, y, width, height };
}

/** Projects any answer's spatial scene for the companion. Hidden parts stay in the scene so
 * they can reappear in place; geometry travels only with its own bounded pieces. */
export function liftScene(scene: SpatialScene, region: Region, anchors?: Map<string, { x: number; y: number }>, selectedId?: string | null): LiftScene {
  const objects = scene.objects.slice(0, 24).map((o): LiftSceneObject => ({
    id: o.id,
    label: clip(o.label, 60),
    detail: clip(o.description, 120),
    shape: o.shape,
    renderStyle: o.renderStyle ?? null,
    color: o.color,
    position: { ...o.position },
    size: { ...o.size },
    parentId: o.parentId,
    ...(o.shell ? { shell: true } : {}),
    visible: o.visible,
    highlighted: o.highlighted,
    ...(selectedId && o.id === selectedId ? { selected: true } : {}),
    ...(o.path?.length ? { path: o.path.map((p) => ({ ...p })) } : {}),
    ...(o.rotation ? { rotation: { ...o.rotation } } : {}),
    ...(o.geometry?.length ? { geometry: o.geometry, parameterValues: o.parameterValues ?? {} } : o.parameterValues ? { parameterValues: { ...o.parameterValues } } : {}),
    ...(o.labelAt ? { labelAt: { ...o.labelAt } } : {}),
    ...(anchors?.has(o.id) ? { anchor: anchors.get(o.id)! } : {}),
  }));
  const ids = new Set(objects.map((o) => o.id));
  return {
    kind: scene.assurance === 'checked' ? 'height' : 'model',
    title: clip(scene.title, 80),
    note: clip(
      scene.assurance === 'checked'
        ? scene.heightNote ?? 'Height is the checked value.'
        : 'An illustrative 3D model of this explanation: shapes and motion are schematic, not measured.',
      240,
    ),
    region,
    objects,
    connections: scene.connections
      .filter((c) => ids.has(c.from) && ids.has(c.to))
      .slice(0, 24)
      .map((c) => ({ id: c.id, from: c.from, to: c.to, label: clip(c.label, 60), directed: c.directed, active: c.active, highlighted: c.highlighted })),
  };
}

/** The companion's drawing for an answer with no drawing read from the source: only its
 * caption flat on the slide, and the 3D scene to lift. */
export function sceneOverlayModel(scene: LiftScene, caption: { text: string; stepLabel: string } | null): SourceOverlayModel {
  const r = scene.region;
  return {
    final: true,
    radius: 0.012,
    font: 0.014,
    nodes: [],
    edges: [],
    weights: [],
    tags: [],
    callouts: [],
    caption: caption
      ? { text: clip(caption.text, 400), stepLabel: clip(caption.stepLabel, 60), x: r.x, y: Math.min(1, r.y + r.height), anchor: 'top', font: 0.014 }
      : null,
    scene,
  };
}
