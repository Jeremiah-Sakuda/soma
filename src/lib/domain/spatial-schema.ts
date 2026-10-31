import { z } from 'zod';
import { sceneIdSchema } from './graph-search';
import { mechanismParameterSchema, mechanismPieceSchema, validateMechanism } from './mechanism-schema';

export const spatialVectorSchema = z.strictObject({
  x: z.number().finite().min(-6).max(6),
  y: z.number().finite().min(-6).max(6),
  z: z.number().finite().min(-6).max(6),
});
const size = z.number().finite().min(0.1).max(4);
export const spatialRenderStyles = [
  'housing', 'chip', 'sensor', 'indicator', 'marker',
  'battery', 'coil', 'gear', 'piston', 'turbine', 'pipe', 'vessel',
  'lens', 'membrane', 'nucleus', 'helix', 'speaker',
] as const;
export const spatialPanelSchema = z.strictObject({
  id: sceneIdSchema,
  kind: z.literal('spatial'),
  title: z.string().trim().min(1).max(100),
  placement: z.strictObject({ column: z.literal(1), row: z.number().int().min(1).max(4), columnSpan: z.literal(2) }),
  objects: z.array(z.strictObject({
    id: sceneIdSchema,
    label: z.string().trim().min(1).max(100),
    description: z.string().trim().min(1).max(240),
    shape: z.enum(['sphere', 'box', 'cylinder', 'torus']),
    // Application-owned illustrative meshes; never external assets or measured geometry.
    renderStyle: z.enum(spatialRenderStyles).nullable().optional(),
    geometry: z.array(mechanismPieceSchema).min(1).max(12).nullable().optional(),
    color: z.enum(['clay', 'sage', 'blue', 'gold', 'violet']),
    position: spatialVectorSchema,
    size: z.strictObject({ x: size, y: size, z: size }),
    parentId: sceneIdSchema.nullable(),
  })).min(1).max(16),
  connections: z.array(z.strictObject({
    id: sceneIdSchema, from: sceneIdSchema, to: sceneIdSchema,
    label: z.string().trim().min(1).max(100), directed: z.boolean(),
  })).max(24),
  poses: z.array(z.strictObject({
    stepId: sceneIdSchema, objectId: sceneIdSchema,
    position: spatialVectorSchema, visible: z.boolean(),
  })).max(48),
  parameters: z.array(mechanismParameterSchema).max(3).nullable().optional(),
  parameterPoses: z.array(z.strictObject({ stepId: sceneIdSchema, parameterId: sceneIdSchema, value: z.number().finite().min(0).max(1) })).max(24).nullable().optional(),
  viewAction: z.strictObject({
    camera: z.enum(['perspective', 'front', 'above', 'side']).nullable(),
    focusObjectId: sceneIdSchema.nullable(),
    isolate: z.boolean().nullable(),
    spread: z.number().finite().min(0).max(1).nullable(),
    slice: z.number().finite().min(0).max(1).nullable(),
  }).nullable().optional(),
});
export type SpatialPanel = z.infer<typeof spatialPanelSchema>;
export type SpatialVector = z.infer<typeof spatialVectorSchema>;

// Presentation only: these controls never mutate source or computational input.
export const spatialViewSchema = z.strictObject({
  mode: z.enum(['2d', '3d']),
  // Optional for backward-compatible saved revisions. Both render the same scene.
  renderer: z.enum(['three', 'anatomy']).optional(),
  parameters: z.record(sceneIdSchema, z.number().finite().min(0).max(1)).refine(p => Object.keys(p).length <= 3).optional(),
  azimuth: z.number().finite().min(-180).max(180),
  elevation: z.number().finite().min(-85).max(85),
  zoom: z.number().finite().min(0.65).max(2),
  spread: z.number().finite().min(0).max(1),
  slice: z.number().finite().min(0).max(1),
  isolate: z.boolean(),
});
export type SpatialView = z.infer<typeof spatialViewSchema>;
export const defaultSpatialView = (): SpatialView => ({
  mode: '3d', azimuth: 35, elevation: 25, zoom: 1, spread: 0, slice: 0, isolate: false,
});

export function validateSpatialPanel(panel: SpatialPanel, steps: readonly { id: string }[]) {
  const objects = new Map(panel.objects.map((object) => [object.id, object]));
  if (objects.size !== panel.objects.length) throw new Error('Spatial object IDs must be unique.');
  const parameters = panel.parameters ?? [], parameterIds = new Set(parameters.map(p => p.id));
  if (parameterIds.size !== parameters.length) throw new Error('Mechanism parameter IDs must be unique.');
  let pieces = 0, faces = 0;
  for (const object of panel.objects) {
    if (object.geometry?.length && object.renderStyle) throw new Error('Choose authored geometry or a catalog style for a part.');
    pieces += object.geometry?.length ?? 0;
    faces += validateMechanism(object.geometry ?? [], parameters);
  }
  if (pieces > 64 || faces > 4096) throw new Error('Mechanism exceeds the 64-piece or 4096-face budget.');
  for (const parameter of parameters) {
    if (!panel.objects.some(object => object.geometry?.some(piece => piece.driver?.parameterId === parameter.id && [...Object.values(piece.driver.rotation), ...Object.values(piece.driver.translation)].some(value => value !== 0))))
      throw new Error('Mechanism controls must drive at least one moving piece.');
  }
  const frames = new Set<string>();
  for (const pose of panel.parameterPoses ?? []) {
    const key = `${pose.stepId}:${pose.parameterId}`;
    if (!parameterIds.has(pose.parameterId) || !steps.some(s => s.id === pose.stepId) || frames.has(key)) throw new Error('Mechanism poses need unique local step/parameter references.');
    frames.add(key);
  }
  if (panel.viewAction?.focusObjectId && !objects.has(panel.viewAction.focusObjectId))
    throw new Error('Spatial focus must reference a local object.');
  for (const object of panel.objects) {
    const visited = new Set([object.id]);
    let parent = object.parentId;
    while (parent !== null) {
      if (!objects.has(parent) || visited.has(parent))
        throw new Error('Spatial parents must be local and acyclic.');
      visited.add(parent);
      parent = objects.get(parent)!.parentId;
    }
  }
  for (const connection of panel.connections)
    if (!objects.has(connection.from) || !objects.has(connection.to) || connection.from === connection.to)
      throw new Error('Spatial connections must join distinct local objects.');
  const poses = new Set<string>();
  for (const pose of panel.poses) {
    const key = `${pose.stepId}:${pose.objectId}`;
    if (!objects.has(pose.objectId) || !steps.some((step) => step.id === pose.stepId) || poses.has(key))
      throw new Error('Spatial poses require unique object and step bindings.');
    poses.add(key);
  }
}
