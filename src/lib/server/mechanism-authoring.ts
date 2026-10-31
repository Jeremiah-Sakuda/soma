import { z } from 'zod';
import { sceneIdSchema } from '../domain/graph-search';
import { mechanismParameterSchema, mechanismPieceSchema } from '../domain/mechanism-schema';
import { spatialPanelSchema, spatialVectorSchema } from '../domain/spatial-schema';
import type { ExplorationSpec } from '../domain/exploration';

// Keep the provider wire shape below Meta's ten-level nesting limit. The full
// domain specification is assembled and validated before review/publication.
export const spatialAuthorPanelSchema = spatialPanelSchema.omit({ parameters: true, parameterPoses: true }).extend({
  objects: z.array(spatialPanelSchema.shape.objects.element.omit({ geometry: true })).min(1).max(16),
});
export const mechanismAuthoringSchema = z.strictObject({
  panelId: sceneIdSchema,
  frame: z.strictObject({ position: spatialVectorSchema, scale: z.number().finite().min(.1).max(4) }),
  parts: z.array(z.strictObject({ objectId: sceneIdSchema, pieces: z.array(mechanismPieceSchema).min(1).max(12) })).min(1).max(16),
  parameters: z.array(mechanismParameterSchema).max(3),
  parameterPoses: z.array(z.strictObject({ stepId: sceneIdSchema, parameterId: sceneIdSchema, value: z.number().finite().min(0).max(1) })).max(24),
});
export function bindMechanismAuthoring(spec: ExplorationSpec, mechanism: z.infer<typeof mechanismAuthoringSchema> | null | undefined) {
  if (!mechanism) return;
  if (spec.mode !== 'explanation') throw new Error('Custom mechanisms require explanation mode.');
  const panel = spec.scene.panels.find(p => p.id === mechanism.panelId && p.kind === 'spatial');
  if (panel?.kind !== 'spatial') throw new Error('Mechanism must reference a local spatial panel.');
  const seen = new Set<string>();
  for (const part of mechanism.parts) {
    const object = panel.objects.find(o => o.id === part.objectId);
    if (!object || seen.has(part.objectId)) throw new Error('Mechanism parts require unique local objects.');
    seen.add(part.objectId); object.geometry = part.pieces;
    object.position = { ...mechanism.frame.position }; object.size = { x: mechanism.frame.scale, y: mechanism.frame.scale, z: mechanism.frame.scale };
  }
  panel.parameters = mechanism.parameters; panel.parameterPoses = mechanism.parameterPoses;
}
export const MECHANISM_AUTHORING = 'Custom mechanisms: ROOT mechanism={panelId,frame:{position,scale},parts:[{objectId,pieces}],parameters,parameterPoses}; name spatial objects in spec, put pieces only in mechanism. Other scenes mechanism:null. Forms: convex prism outline{x,z}/height, lathe profile{radius,y}, tube path{x,y,z}/radius. Local form/position range +/-0.5; piece transforms use ONE shared assembly coordinate frame; frame uniformly scales/translates all parts. Coupled pieces use identical drivers. Each piece needs purpose. Aim6-10pieces; caps64pieces/4096faces and16KB per spec. Custom parts use renderStyle:null. Up to3 parameters in0..1; parameterPoses bind steps. Driver: rotate resting piece about pivot by value*rotation(degrees), then add value*translation. Motion/dimensions are illustrative, not checked physics or recovered facts. On unchanged follow-ups mechanism:null retains construction and controls; new construction needs a fresh source.';
