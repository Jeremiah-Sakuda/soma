import { z } from 'zod';
import type { EngineFilm } from '../pm121/lib/engine';
const color = z.string().regex(/^#[a-fA-F0-9]{6}$/);
export const presentationSchema = z.strictObject({
  title: z.string().min(1).max(55),
  subtitle: z.string().min(1).max(110),
  strokes: z
    .array(
      z.strictObject({
        name: z.enum(['Intake', 'Compression', 'Power', 'Exhaust']),
        verb: z.string().min(1).max(26),
        caption: z.string().min(1).max(100),
        narration: z.string().min(1).max(150),
      }),
    )
    .length(4),
  parts: z
    .array(
      z.strictObject({
        id: z.enum(['piston', 'rod', 'crank']),
        name: z.string().min(1).max(24),
        description: z.string().min(1).max(155),
        cue: z.string().min(1).max(85),
      }),
    )
    .length(3),
  refinements: z
    .array(
      z.strictObject({
        id: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/),
        d: z
          .string()
          .min(3)
          .max(1600)
          .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9.,+eE\s-]+$/),
        fill: z.union([color, z.literal('none')]),
        strokeWidth: z.number().min(0.5).max(2),
      }),
    )
    .max(6),
});
export type Presentation = z.infer<typeof presentationSchema>;
export function validatePresentation(raw: unknown, film: EngineFilm) {
  if (JSON.stringify(raw).length > 16000) throw Error('Presentation size exceeded');
  const p = presentationSchema.parse(raw);
  if (
    p.strokes.map((s) => s.name).join(',') !== 'Intake,Compression,Power,Exhaust' ||
    p.parts
      .map((s) => s.id)
      .sort()
      .join(',') !== 'crank,piston,rod'
  )
    throw Error('Invalid presentation order or parts');
  const allowed = new Set([
    'piston-skirt',
    'rod-beam',
    'crank-counterweight',
    'housing-rounded-base',
    'head-fin-upper-left',
    'head-fin-upper-right',
  ]);
  if (
    new Set(p.refinements.map((a) => a.id)).size !== p.refinements.length ||
    p.refinements.some((a) => !allowed.has(a.id) || !film.art.some((b) => b.id === a.id))
  )
    throw Error('Invalid refinement scope');
  for (const a of p.refinements)
    if (
      !/^[Mm]/.test(a.d.trim()) ||
      (a.d.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g) ?? []).some(
        (x) => !Number.isFinite(Number(x)) || Math.abs(Number(x)) > 1200,
      )
    )
      throw Error('Invalid refinement coordinates');
  return p;
}
export function presentFilm(film: EngineFilm, p: Presentation): EngineFilm {
  return {
    ...film,
    title: p.title,
    strokes: p.strokes,
    art: film.art.map((a) => ({ ...a, ...p.refinements.find((b) => b.id === a.id) })),
  };
}
export type PartId = 'piston' | 'rod' | 'crank';
