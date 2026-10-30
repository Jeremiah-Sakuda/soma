import { z } from 'zod';
/** An explicit pointing observation, never evidence of understanding. Fractions
 * refer to the complete captured display image with its top-left origin. */
export const pointFocusSchema = z
  .strictObject({
    kind: z.enum(['point', 'circle']),
    region: z.strictObject({
      x: z.number().finite().min(0).max(1),
      y: z.number().finite().min(0).max(1),
      width: z.number().finite().positive().max(1),
      height: z.number().finite().positive().max(1),
    }),
  })
  .superRefine(({ region }, ctx) => {
    if (region.x + region.width > 1.000001 || region.y + region.height > 1.000001)
      ctx.addIssue({
        code: 'custom',
        message: 'The selected region must stay inside its source image.',
      });
  });
export type PointFocus = z.infer<typeof pointFocusSchema>;
