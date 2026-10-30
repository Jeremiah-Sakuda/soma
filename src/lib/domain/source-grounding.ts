import { z } from 'zod';
export const imageRegionSchema = z
  .strictObject({
    x: z.number().finite().min(0).max(1),
    y: z.number().finite().min(0).max(1),
    width: z.number().finite().positive().max(1),
    height: z.number().finite().positive().max(1),
  })
  .refine(
    (r) => r.x + r.width <= 1.000001 && r.y + r.height <= 1.000001,
    'Region must be inside the image.',
  );
export const sourceAnchorSchema = z.strictObject({
  id: z.string().regex(/^[a-zA-Z0-9_-]{1,48}$/),
  label: z.string().trim().min(1).max(100),
  region: imageRegionSchema,
});
export const sourceAnchorsSchema = z
  .array(sourceAnchorSchema)
  .max(6)
  .refine((a) => new Set(a.map((v) => v.id)).size === a.length, 'Duplicate source anchor.');
export const sourceChangeSchema = z.strictObject({
  relationship: z.enum(['same-material', 'different-material', 'uncertain']),
  summary: z.string().trim().min(1).max(700),
  changed: z.array(z.string().trim().min(1).max(240)).max(5),
  uncertainty: z.array(z.string().trim().min(1).max(240)).max(4),
});
export type ImageRegion = z.infer<typeof imageRegionSchema>;
export type SourceAnchor = z.infer<typeof sourceAnchorSchema>;
export type SourceChange = z.infer<typeof sourceChangeSchema>;

/** Optional source locations must never invalidate otherwise legible facts.
 * Keep identity/count rules strict; omit an invalid region rather than clamp it
 * into a plausible-looking highlight. Detail crops still require valid bounds. */
export function inspectSourceAnchors(value: unknown) {
  const candidates = z
    .array(sourceAnchorSchema.extend({ region: z.unknown() }))
    .max(6)
    .refine((a) => new Set(a.map((v) => v.id)).size === a.length, 'Duplicate source anchor.')
    .parse(value);
  const anchors: SourceAnchor[] = [];
  for (const candidate of candidates) {
    const region = imageRegionSchema.safeParse(candidate.region);
    if (region.success) anchors.push({ ...candidate, region: region.data });
  }
  return { anchors, omitted: candidates.length - anchors.length };
}
