import { z } from 'zod';

export const explorationProgressSchema = z.strictObject({
  phase: z.enum([
    'reading-source',
    'reading-detail',
    'building-visual',
    'checking-visual',
    'reviewing-visual',
    'repairing-visual',
    'saving-visual',
  ]),
  elapsedMs: z.number().int().min(0).max(120_000),
});
export type ExplorationProgress = z.infer<typeof explorationProgressSchema>;

export const explorationProgressLabel: Record<ExplorationProgress['phase'], string> = {
  'reading-source': 'Muse Spark is reading your selected source…',
  'reading-detail': 'Muse Spark is reading a closer crop…',
  'building-visual': 'Muse Spark is building your visual explanation…',
  'checking-visual': 'Checking the scene and its references…',
  'reviewing-visual': 'Muse Wonder is reviewing the explanation…',
  'repairing-visual': 'Muse Spark is correcting a check that did not pass…',
  'saving-visual': 'Publishing the checked visual revision…',
};
