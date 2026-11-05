import { z } from 'zod';
import { sceneIdSchema } from './graph-search';

const finite = (min: number, max: number) => z.number().finite().min(min).max(max);
export const localPointSchema = z.strictObject({
  x: finite(-0.5, 0.5),
  y: finite(-0.5, 0.5),
  z: finite(-0.5, 0.5),
});
const rotation = z.strictObject({
  x: finite(-180, 180),
  y: finite(-180, 180),
  z: finite(-180, 180),
});
export const geometryColors = [
  'clay',
  'sage',
  'blue',
  'gold',
  'violet',
  'graphite',
  'ivory',
  'metal',
] as const;
export const mechanismParameterSchema = z.strictObject({
  id: sceneIdSchema,
  label: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(180),
  initial: finite(0, 1),
});
export const mechanismPieceSchema = z.strictObject({
  id: sceneIdSchema,
  purpose: z.string().trim().min(1).max(120),
  form: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('prism'),
      outline: z
        .array(z.strictObject({ x: finite(-0.5, 0.5), z: finite(-0.5, 0.5) }))
        .min(3)
        .max(12),
      height: finite(0.02, 1),
    }),
    z.strictObject({
      kind: z.literal('lathe'),
      profile: z
        .array(z.strictObject({ radius: finite(0, 0.5), y: finite(-0.5, 0.5) }))
        .min(2)
        .max(12),
    }),
    z.strictObject({
      kind: z.literal('tube'),
      path: z.array(localPointSchema).min(2).max(16),
      radius: finite(0.01, 0.2),
    }),
  ]),
  position: localPointSchema,
  rotation,
  scale: z.strictObject({ x: finite(0.02, 1), y: finite(0.02, 1), z: finite(0.02, 1) }),
  color: z.enum(geometryColors),
  driver: z
    .strictObject({
      parameterId: sceneIdSchema,
      pivot: localPointSchema,
      translation: localPointSchema,
      rotation,
    })
    .nullable(),
});
export type MechanismPiece = z.infer<typeof mechanismPieceSchema>;
export type MechanismParameter = z.infer<typeof mechanismParameterSchema>;

/** Topology and cost bounds, independent of either renderer. */
export function validateMechanism(
  pieces: readonly MechanismPiece[],
  parameters: readonly MechanismParameter[],
) {
  const parameterIds = new Set(parameters.map((p) => p.id)),
    ids = new Set<string>();
  let faces = 0;
  for (const piece of pieces) {
    if (ids.has(piece.id)) throw new Error('Geometry piece IDs must be unique within a part.');
    ids.add(piece.id);
    if (piece.driver && !parameterIds.has(piece.driver.parameterId))
      throw new Error('Geometry drivers must reference a local parameter.');
    const f = piece.form;
    if (f.kind === 'prism') {
      let sign = 0,
        area = 0;
      for (let i = 0; i < f.outline.length; i++) {
        const a = f.outline[i],
          b = f.outline[(i + 1) % f.outline.length],
          c = f.outline[(i + 2) % f.outline.length];
        if (Math.hypot(a.x - b.x, a.z - b.z) < 0.005)
          throw new Error('Prism edges must have positive length.');
        const cross = (b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x);
        if (Math.abs(cross) > 1e-8) {
          if (sign && Math.sign(cross) !== sign) throw new Error('Prism outlines must be convex.');
          sign = Math.sign(cross);
        }
        area += a.x * b.z - b.x * a.z;
      }
      if (Math.abs(area) < 0.002 || !sign) throw new Error('Prism outlines must enclose an area.');
      // Convex turns alone do not rule out wound/self-intersecting polygons.
      for (let i = 0; i < f.outline.length; i++)
        for (let j = i + 2; j < f.outline.length; j++) {
          if (i === 0 && j === f.outline.length - 1) continue;
          const a = f.outline[i],
            b = f.outline[(i + 1) % f.outline.length],
            c = f.outline[j],
            d = f.outline[(j + 1) % f.outline.length];
          const cross = (p: typeof a, q: typeof a, r: typeof a) =>
            (q.x - p.x) * (r.z - p.z) - (q.z - p.z) * (r.x - p.x);
          const overlaps =
            Math.max(Math.min(a.x, b.x), Math.min(c.x, d.x)) <=
              Math.min(Math.max(a.x, b.x), Math.max(c.x, d.x)) &&
            Math.max(Math.min(a.z, b.z), Math.min(c.z, d.z)) <=
              Math.min(Math.max(a.z, b.z), Math.max(c.z, d.z));
          if (
            overlaps &&
            cross(a, b, c) * cross(a, b, d) <= 0 &&
            cross(c, d, a) * cross(c, d, b) <= 0
          )
            throw new Error('Prism outlines cannot intersect.');
        }
      faces += f.outline.length + 2;
    } else if (f.kind === 'lathe') {
      if (
        !f.profile.some((p) => p.radius >= 0.02) ||
        f.profile.some((p, i) => i > 0 && p.y - f.profile[i - 1].y < 0.005)
      )
        throw new Error('Lathe profiles need increasing heights and a positive radius.');
      faces += (f.profile.length - 1) * 12 + 2;
    } else {
      if (
        f.path.some(
          (p, i) =>
            i > 0 &&
            Math.hypot(p.x - f.path[i - 1].x, p.y - f.path[i - 1].y, p.z - f.path[i - 1].z) < 0.02,
        )
      )
        throw new Error('Tube segments must have positive length.');
      faces += (f.path.length - 1) * 10;
    }
  }
  return faces;
}
