import { z } from 'zod';
import { sceneIdSchema } from './graph-search';

export const spatialVectorSchema = z.strictObject({
  x: z.number().finite().min(-6).max(6),
  y: z.number().finite().min(-6).max(6),
  z: z.number().finite().min(-6).max(6),
});
const size = z.number().finite().min(0.1).max(4);
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
    renderStyle: z.enum(['housing', 'chip', 'sensor', 'indicator', 'marker']).nullable().optional(),
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
