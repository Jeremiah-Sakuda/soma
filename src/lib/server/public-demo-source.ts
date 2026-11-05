import { isDeepStrictEqual } from 'node:util';
import { z } from 'zod';
import detour from '../fixtures/recorded-exploration.json';
import mechanism from '../fixtures/recorded-mechanism.json';
import graph from '../fixtures/recorded-graph.json';
import circuit from '../fixtures/recorded-circuit.json';
import { circuitLayoutReadSchema } from './circuit-authoring';
import type { ExplorationSource, PublicDemoImage, RecordedPresentation } from './exploration-types';

/** Server-owned public assets only. An uploaded image matching a hash is never promoted. */
const approved: Record<PublicDemoImage, { id: string; source: unknown; sha256: string }> = {
  '/synthetic/recorded-detour.png': {
    id: 'detour-2026-10-29',
    source: detour.source,
    sha256: '56a5b33d217dbea6e2a826ebefd171683c1fdc404d601baaeff79d8252e93da1',
  },
  '/synthetic/recorded-mechanism.png': {
    id: 'mechanism-2026-10-30',
    source: mechanism.source,
    sha256: 'ab2f14a4429e11327d2f2e326f4b10fd1e4ab0ecee066de48bab4fc85f36f36d',
  },
  '/synthetic/recorded-lecture-14.png': {
    id: 'lecture-14-2026-11-04',
    source: graph.source,
    sha256: '515f4259b058a6b08465aa0f8e4d7e9b23838eb0240a99d3e945c586c894f918',
  },
  '/synthetic/recorded-lecture-9.png': {
    id: 'lecture-9-2026-11-04',
    source: circuit.source,
    sha256: 'fae05fdd937999d33d47b8129fae8b2410b827ba6352ee36c5e9274f4a7fb59f',
  },
};
const circuitPresentationSchema = z.strictObject({
  kind: z.literal('circuit-drawing-alignment-v1'),
  sourceImageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  layout: circuitLayoutReadSchema.extend({ edgeLabels: z.array(z.never()).max(0) }),
  snappedNodes: z.number().int().min(0).max(10),
  refinedParts: z.number().int().min(0).max(16),
});
const unit = z.number().finite().min(0).max(1);
const graphPresentationSchema = z.strictObject({
  kind: z.literal('graph-drawing-alignment-v1'),
  sourceImageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  layout: z.strictObject({
    nodes: z.array(z.strictObject({ nodeId: z.string().min(1).max(48), x: unit, y: unit })).max(12),
    edgeLabels: z
      .array(z.strictObject({ edgeId: z.string().min(1).max(48), x: unit, y: unit }))
      .max(24),
    components: z.array(z.never()).max(0).optional(),
  }),
  snappedNodes: z.number().int().min(0).max(12),
  refinedParts: z.literal(0),
});
const presentationSchema = z.discriminatedUnion('kind', [
  circuitPresentationSchema,
  graphPresentationSchema,
]);
const sameIds = (first: string[], second: string[]) =>
  new Set(first).size === first.length && isDeepStrictEqual([...first].sort(), [...second].sort());

/** Called only by the approved recording factory, before ownership rebinding. The legacy
 * detour has no historical image hash, so exact original-source equality also binds it
 * without adding a fabricated historical field. Never copies a caller's publicDemo. */
export function publicDemoSource(
  recording: { id: string; sourceImage: PublicDemoImage },
  source: ExplorationSource,
  presentation?: RecordedPresentation,
): NonNullable<ExplorationSource['publicDemo']> {
  const expected = Object.hasOwn(approved, recording.sourceImage)
    ? approved[recording.sourceImage]
    : undefined;
  if (
    !expected ||
    recording.id !== expected.id ||
    !isDeepStrictEqual(source, expected.source) ||
    (source.imageSha256 !== undefined && source.imageSha256 !== expected.sha256)
  )
    throw new Error('Only the matching approved public recording may retain a demo image.');
  if (!presentation) return { image: recording.sourceImage };
  const checked = presentationSchema.parse(presentation);
  if (
    checked.sourceImageSha256 !== expected.sha256 ||
    !sameIds(
      checked.layout.nodes.map((node) => node.nodeId),
      source.layout?.nodes.map((node) => node.nodeId) ?? [],
    ) ||
    checked.snappedNodes > checked.layout.nodes.length
  )
    throw new Error('Replay alignment must describe the matching public source image.');
  if (checked.kind === 'circuit-drawing-alignment-v1') {
    if (
      recording.sourceImage !== '/synthetic/recorded-lecture-9.png' ||
      !sameIds(
        checked.layout.components.map((part) => part.componentId),
        source.layout?.components?.map((part) => part.componentId) ?? [],
      ) ||
      checked.refinedParts > checked.layout.components.length
    )
      throw new Error('Replay alignment must describe the matching public circuit image.');
  } else if (
    recording.sourceImage !== '/synthetic/recorded-lecture-14.png' ||
    !isDeepStrictEqual(checked.layout.edgeLabels, source.layout?.edgeLabels)
  ) {
    // Node snapping does not reinterpret or reposition printed edge weights.
    throw new Error('Replay alignment must preserve the matching public graph edge labels.');
  }
  return { image: recording.sourceImage, presentation: checked };
}
