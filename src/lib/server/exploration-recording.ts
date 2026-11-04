import { randomUUID } from 'node:crypto';
import { checkExploration, type ExplorationSpec } from '../domain/exploration';
import { initialExplorationState, type ExplorationViewState } from '../domain/exploration-view';
import type { ExplorationArtifact, ExplorationSource } from './exploration-types';
import { publicDemoSource } from './public-demo-source';

/** An allowlisted export of an actual completed run on original public demo material.
 * This removes ownership/evidence fields, not private prose inside a source: only reviewed
 * original synthetic sources may be exported as public recordings. */
export type RecordedExplorationFixture = Pick<
  ExplorationArtifact,
  'spec' | 'question' | 'source' | 'generation' | 'createdAt'
> & Partial<Pick<ExplorationArtifact, 'updatedAt' | 'state' | 'experiment' | 'circuitExperiment'>>;

export function recordedFixtureFromArtifact(artifact: RecordedExplorationFixture): RecordedExplorationFixture {
  if (artifact.generation.mode !== 'live' || artifact.generation.provider !== 'meta')
    throw new Error('A recording must retain an actual completed Meta generation.');
  const s = artifact.source;
  const source: ExplorationSource = {
    observationId: s.observationId,
    version: s.version,
    kind: s.kind,
    label: s.label,
    capturedAt: s.capturedAt,
    summary: s.summary,
    uncertainty: structuredClone(s.uncertainty),
  };
  for (const field of ['imageSha256', 'anchors', 'layout', 'detailRegion', 'readingCheck', 'circuitReadingCheck'] as const) {
    if (s[field] !== undefined) Object.assign(source, { [field]: structuredClone(s[field]) });
  }
  const g = artifact.generation;
  return {
    spec: structuredClone(artifact.spec),
    question: artifact.question,
    source,
    generation: {
      mode: g.mode,
      provider: g.provider,
      model: g.model,
      calls: g.calls,
      usage: { input_tokens: g.usage.input_tokens, output_tokens: g.usage.output_tokens },
      costUsd: g.costUsd,
      elapsedMs: g.elapsedMs,
      checks: [...g.checks],
      audit: g.audit.map(({ event, call, detail }) => ({ event, call, detail })),
      ...(g.timings ? { timings: g.timings.map(({ call, stage, durationMs }) => ({ call, stage, durationMs })) } : {}),
    },
    createdAt: artifact.createdAt,
    ...(artifact.updatedAt ? { updatedAt: artifact.updatedAt } : {}),
    ...(artifact.state ? { state: structuredClone(artifact.state) } : {}),
    ...(artifact.experiment ? { experiment: structuredClone(artifact.experiment) } : {}),
    ...(artifact.circuitExperiment ? { circuitExperiment: structuredClone(artifact.circuitExperiment) } : {}),
  };
}

/** Each replay is a new owned artifact. Original source/model facts remain recorded;
 * computation is checked again, and controls operate on the new local copy. No provider,
 * budget or external source calls belong in this path. */
export function createRecordedExploration(
  recorded: RecordedExplorationFixture,
  recording: Pick<NonNullable<ExplorationArtifact['recording']>, 'id' | 'sourceImage'>,
  validateState: (spec: ExplorationSpec, raw: unknown) => ExplorationViewState,
  options: {
    now?: string;
    state?: ExplorationViewState;
    presentation?: NonNullable<ExplorationArtifact['recording']>['presentation'];
  } = {},
): ExplorationArtifact {
  const fixture = recordedFixtureFromArtifact(recorded);
  if (options.presentation && (
    (options.presentation.kind === 'circuit-drawing-alignment-v1'
      ? fixture.spec.mode !== 'checked-circuit'
      : !['checked-bfs', 'checked-dijkstra'].includes(fixture.spec.mode)) ||
    options.presentation.sourceImageSha256 !== fixture.source.imageSha256
  )) throw new Error('Replay presentation must match its recorded source.');
  const publicDemo = publicDemoSource(recording, fixture.source, options.presentation);
  const id = randomUUID();
  const now = options.now ?? new Date().toISOString();
  const source: ExplorationSource = {
    ...fixture.source,
    observationId: `capture_${randomUUID().replaceAll('-', '')}`,
    publicDemo,
  };
  const raw = structuredClone(fixture.spec);
  raw.id = `explore_${id.replaceAll('-', '')}`;
  raw.version = 1;
  raw.sources = raw.sources.map((reference) => ({
    ...reference,
    observationId: source.observationId,
    version: source.version,
  }));
  const checked = checkExploration(raw);
  const state = validateState(checked.spec, options.state ?? fixture.state ?? initialExplorationState(checked.spec));
  return {
    ...checked,
    id,
    version: 1,
    createdAt: now,
    updatedAt: now,
    question: fixture.question,
    source,
    generation: fixture.generation,
    ...(fixture.experiment ? { experiment: fixture.experiment } : {}),
    ...(fixture.circuitExperiment ? { circuitExperiment: fixture.circuitExperiment } : {}),
    recording: {
      ...recording,
      generatedAt: fixture.updatedAt ?? fixture.createdAt,
      ...(publicDemo.presentation ? { presentation: structuredClone(publicDemo.presentation) } : {}),
    },
    state,
    saved: false,
  };
}
