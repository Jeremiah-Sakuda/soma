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
  geometry?: MechanismPiece[];
  parameterValues?: Record<string, number>;
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
export function liftScene(scene: SpatialScene, region: Region, anchors?: Map<string, { x: number; y: number }>): LiftScene {
  const objects = scene.objects.slice(0, 16).map((o): LiftSceneObject => ({
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
    ...(o.path?.length ? { path: o.path.map((p) => ({ ...p })) } : {}),
    ...(o.rotation ? { rotation: { ...o.rotation } } : {}),
    ...(o.geometry?.length ? { geometry: o.geometry, parameterValues: o.parameterValues ?? {} } : {}),
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
