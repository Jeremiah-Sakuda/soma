import { z } from 'zod';
import { sceneIdSchema } from '../domain/graph-search';
import {
  mechanismParameterSchema,
  mechanismPieceSchema,
  validateMechanism,
  type MechanismPiece,
} from '../domain/mechanism-schema';
import { spatialPanelSchema, spatialVectorSchema } from '../domain/spatial-schema';
import type { ExplorationSpec } from '../domain/exploration';

// Keep the provider wire shape below Meta's ten-level nesting limit. The full
// domain specification is assembled and validated before review/publication.
export const spatialAuthorPanelSchema = spatialPanelSchema
  .omit({ parameters: true, parameterPoses: true })
  .extend({
    objects: z
      .array(spatialPanelSchema.shape.objects.element.omit({ geometry: true }))
      .min(1)
      .max(24),
  });
export const mechanismAuthoringSchema = z.strictObject({
  panelId: sceneIdSchema,
  frame: z.strictObject({
    position: spatialVectorSchema,
    scale: z.number().finite().min(0.1).max(4),
  }),
  parts: z
    .array(
      z.strictObject({
        objectId: sceneIdSchema,
        pieces: z.array(mechanismPieceSchema).min(1).max(12),
      }),
    )
    .min(1)
    .max(16),
  parameters: z.array(mechanismParameterSchema).max(3),
  parameterPoses: z
    .array(
      z.strictObject({
        stepId: sceneIdSchema,
        parameterId: sceneIdSchema,
        value: z.number().finite().min(0).max(1),
      }),
    )
    .max(24),
});
export function bindMechanismAuthoring(
  spec: ExplorationSpec,
  mechanism: z.infer<typeof mechanismAuthoringSchema> | null | undefined,
) {
  if (!mechanism) return;
  if (spec.mode !== 'explanation') throw new Error('Custom mechanisms require explanation mode.');
  const panel = spec.scene.panels.find((p) => p.id === mechanism.panelId && p.kind === 'spatial');
  if (panel?.kind !== 'spatial') throw new Error('Mechanism must reference a local spatial panel.');
  const seen = new Set<string>();
  for (const part of mechanism.parts) {
    const object = panel.objects.find((o) => o.id === part.objectId);
    if (!object || seen.has(part.objectId))
      throw new Error('Mechanism parts require unique local objects.');
    seen.add(part.objectId);
    object.geometry = repairPieces(part.pieces);
    // Nothing left to build: the part keeps its plain shape.
    if (!object.geometry.length) {
      delete object.geometry;
      continue;
    }
    // Authored pieces replace a catalog illustration the author also named.
    if (object.renderStyle) object.renderStyle = null;
    object.position = { ...mechanism.frame.position };
    object.size = { x: mechanism.frame.scale, y: mechanism.frame.scale, z: mechanism.frame.scale };
  }
  // A control whose moving pieces were left out has nothing to move.
  const pieces = panel.objects.flatMap((o) => o.geometry ?? []);
  const moves = (id: string) =>
    pieces.some(
      (p) =>
        p.driver?.parameterId === id &&
        [...Object.values(p.driver.rotation), ...Object.values(p.driver.translation)].some(
          (v) => v !== 0,
        ),
    );
  panel.parameters = mechanism.parameters.filter((p) => moves(p.id));
  const kept = new Set(panel.parameters.map((p) => p.id));
  for (const piece of pieces)
    if (piece.driver && !kept.has(piece.driver.parameterId)) piece.driver = null;
  panel.parameterPoses = mechanism.parameterPoses.filter((p) => kept.has(p.parameterId));
}
export const MECHANISM_AUTHORING =
  'Custom mechanisms: ROOT mechanism={panelId,frame:{position,scale},parts:[{objectId,pieces}],parameters,parameterPoses}; name spatial objects in spec, put pieces only in mechanism. Other scenes mechanism:null. Forms: convex prism outline{x,z}/height, lathe profile{radius,y}, tube path{x,y,z}/radius. Local form/position range +/-0.5; piece transforms use ONE shared assembly coordinate frame; frame uniformly scales/translates all parts. Coupled pieces use identical drivers. Each piece needs purpose. Aim6-10pieces; caps64pieces/4096faces and16KB per spec. Custom parts use renderStyle:null. Up to3 parameters in0..1; parameterPoses bind steps. Driver: rotate resting piece about pivot by value*rotation(degrees), then add value*translation. Motion/dimensions are illustrative, not checked physics or recovered facts. On unchanged follow-ups mechanism:null retains construction and controls; new construction needs a fresh source.';

const hull = (points: { x: number; z: number }[]) => {
  const sorted = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const cross = (
    o: { x: number; z: number },
    a: { x: number; z: number },
    b: { x: number; z: number },
  ) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
  const half = (list: typeof sorted) => {
    const out: typeof sorted = [];
    for (const p of list) {
      while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 1e-9)
        out.pop();
      out.push(p);
    }
    return out.slice(0, -1);
  };
  return [...half(sorted), ...half([...sorted].reverse())];
};
/** Mends authored pieces the way a draughtsman would (a prism's outline becomes its convex
 * hull, a lathe profile is ordered by height, repeated tube points drop) and leaves out any
 * piece that still cannot be built, rather than refusing the whole explanation. */
export function repairPieces(pieces: readonly MechanismPiece[]): MechanismPiece[] {
  const out: MechanismPiece[] = [];
  for (const original of pieces) {
    const piece = structuredClone(original),
      f = piece.form;
    if (f.kind === 'prism') {
      const ring = hull(f.outline).filter(
        (p, i, all) =>
          Math.hypot(p.x - all[(i + 1) % all.length].x, p.z - all[(i + 1) % all.length].z) >= 0.005,
      );
      if (ring.length < 3) continue;
      f.outline = ring.slice(0, 12);
    } else if (f.kind === 'lathe') {
      const profile = [...f.profile]
        .sort((a, b) => a.y - b.y)
        .filter((p, i, all) => i === 0 || p.y - all[i - 1].y >= 0.005);
      if (profile.length < 2) continue;
      f.profile = profile;
    } else {
      f.path = f.path.filter(
        (p, i, all) =>
          i === 0 || Math.hypot(p.x - all[i - 1].x, p.y - all[i - 1].y, p.z - all[i - 1].z) >= 0.02,
      );
      if (f.path.length < 2) continue;
    }
    try {
      // Drivers are checked against the panel's parameters later; here, only the shape.
      validateMechanism([{ ...piece, driver: null }], []);
      out.push(piece);
    } catch {
      // Still not buildable: leave it out.
    }
  }
  return out;
}
