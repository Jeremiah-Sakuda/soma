import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import recorded from '../../src/lib/fixtures/recorded-exploration.json';
import recordedGraph from '../../src/lib/fixtures/recorded-graph.json';
import recordedCircuit from '../../src/lib/fixtures/recorded-circuit.json';
import recordedMechanism from '../../src/lib/fixtures/recorded-mechanism.json';
import circuitPresentation from '../../src/lib/fixtures/recorded-circuit-presentation.json';
import {
  createRecordedExploration,
  recordedFixtureFromArtifact,
  type RecordedExplorationFixture,
} from '../../src/lib/server/exploration-recording';
import { validateExplorationViewState } from '../../src/lib/server/exploration';
import type {
  ExplorationArtifact,
  PublicDemoImage,
  RecordedPresentation,
} from '../../src/lib/server/exploration-types';
import { snapNodesToDrawing } from '../../src/lib/server/node-snap';

const fixture = recorded as RecordedExplorationFixture;
const metadata = {
  id: 'detour-2026-10-29',
  sourceImage: '/synthetic/recorded-detour.png' as const,
};

describe('actual recorded artifact rebinding', () => {
  it('rechecks computation and gives independent copies the original exact model provenance', () => {
    const before = structuredClone(fixture);
    const a = createRecordedExploration(fixture, metadata, validateExplorationViewState);
    const b = createRecordedExploration(fixture, metadata, validateExplorationViewState);
    expect(a.id).not.toBe(b.id);
    expect(a.source.observationId).not.toBe(b.source.observationId);
    expect(a.spec.sources[0].observationId).toBe(a.source.observationId);
    expect(a.source.label).toBe(fixture.source.label);
    expect(a.source.capturedAt).toBe(fixture.source.capturedAt);
    expect(a.executions!.primary.path).toEqual(['P', 'Q', 'R']);
    expect(a.generation).toEqual(fixture.generation);
    expect(a.recording?.generatedAt).toBe(fixture.createdAt);
    a.generation.audit[0].detail = 'Only this owned replay changed.';
    a.state.step = 2;
    expect(b.generation).toEqual(fixture.generation);
    expect(b.state.step).toBe(0);
    expect(fixture).toEqual(before);
  });

  it('omits ownership, raw source pixels, native focus, and learner evidence from fixture exports', () => {
    const artifact = createRecordedExploration(fixture, metadata, validateExplorationViewState);
    const privateArtifact = {
      ...artifact,
      owner: 'synthetic-owner-must-not-export',
      learningContext: { reason: 'synthetic learner record must not export' },
      practiceOrigin: { applicationId: 'synthetic-attempt' },
      source: {
        ...artifact.source,
        dataUrl: 'synthetic-image-must-not-export',
        nativeId: 'synthetic-screen-reference',
        focus: { kind: 'pointer' },
      },
      generation: { ...artifact.generation, rawResponse: 'synthetic-private-provider-response' },
    } as unknown as ExplorationArtifact;
    const exported = recordedFixtureFromArtifact(privateArtifact);
    const serialized = JSON.stringify(exported);
    expect(serialized).not.toMatch(
      /synthetic-owner|synthetic learner|synthetic-attempt|synthetic-image|synthetic-screen|synthetic-private/,
    );
    expect(exported).not.toHaveProperty('recording');
    expect(exported).not.toHaveProperty('validation');
    expect(exported.source).not.toHaveProperty('publicDemo');
    expect(exported.generation).toEqual(fixture.generation);
  });

  it.each([
    { fixture: recorded, id: 'detour-2026-10-29', image: '/synthetic/recorded-detour.png' },
    {
      fixture: recordedMechanism,
      id: 'mechanism-2026-10-30',
      image: '/synthetic/recorded-mechanism.png',
    },
    {
      fixture: recordedGraph,
      id: 'lecture-14-2026-11-04',
      image: '/synthetic/recorded-lecture-14.png',
    },
    {
      fixture: recordedCircuit,
      id: 'lecture-9-2026-11-04',
      image: '/synthetic/recorded-lecture-9.png',
    },
  ])(
    'retains only the approved public image for $id without changing historical source/model data',
    ({ fixture, id, image }) => {
      const before = structuredClone(fixture);
      const artifact = createRecordedExploration(
        fixture as RecordedExplorationFixture,
        { id, sourceImage: image as PublicDemoImage },
        validateExplorationViewState,
      );
      expect(artifact.source.publicDemo).toEqual({ image });
      expect(artifact.source.layout).toEqual((fixture as RecordedExplorationFixture).source.layout);
      expect(artifact.generation).toEqual(fixture.generation);
      const hash = createHash('sha256')
        .update(readFileSync(`public${image}`))
        .digest('hex');
      if ('imageSha256' in fixture.source) expect(hash).toBe(fixture.source.imageSha256);
      expect(fixture).toEqual(before);
    },
  );

  it('keeps validated current alignment separate from immutable source layout and model provenance', () => {
    const fixture = recordedCircuit as RecordedExplorationFixture;
    const before = structuredClone(fixture);
    const artifact = createRecordedExploration(
      fixture,
      { id: 'lecture-9-2026-11-04', sourceImage: '/synthetic/recorded-lecture-9.png' },
      validateExplorationViewState,
      { presentation: circuitPresentation as RecordedPresentation },
    );
    expect(artifact.source.publicDemo?.presentation).toEqual(circuitPresentation);
    expect(artifact.source.layout).toEqual(fixture.source.layout);
    expect(artifact.generation).toEqual(fixture.generation);
    artifact.source.publicDemo!.presentation!.layout.nodes[0].x = 0;
    expect(artifact.recording?.presentation).toEqual(circuitPresentation);
    expect(fixture).toEqual(before);
  });

  it('accepts only hash-bound graph-node alignment and keeps original edge labels, reading and receipts', async () => {
    const fixture = recordedGraph as RecordedExplorationFixture;
    const before = structuredClone(fixture);
    const image =
      'data:image/png;base64,' +
      readFileSync('public/synthetic/recorded-lecture-14.png').toString('base64');
    const snapped = await snapNodesToDrawing(
      image,
      recordedGraph.source.layout.nodes,
      recordedGraph.spec.input,
    );
    const presentation: RecordedPresentation = {
      kind: 'graph-drawing-alignment-v1',
      sourceImageSha256: recordedGraph.source.imageSha256,
      layout: {
        nodes: snapped.positions,
        edgeLabels: structuredClone(recordedGraph.source.layout.edgeLabels),
      },
      snappedNodes: snapped.moved,
      refinedParts: 0,
    };
    const metadata = {
      id: 'lecture-14-2026-11-04',
      sourceImage: '/synthetic/recorded-lecture-14.png' as const,
    };
    const artifact = createRecordedExploration(fixture, metadata, validateExplorationViewState, {
      presentation,
    });
    expect(artifact.source.publicDemo?.presentation).toEqual(presentation);
    expect(artifact.source.layout).toEqual(fixture.source.layout);
    expect(artifact.source.uncertainty).toEqual(fixture.source.uncertainty);
    expect(artifact.generation).toEqual(fixture.generation);
    expect(fixture).toEqual(before);
    for (const mutate of [
      (value: RecordedPresentation) => {
        value.layout.edgeLabels[0].edgeId = 'foreign';
      },
      (value: RecordedPresentation) => {
        value.layout.edgeLabels[0].x += 0.01;
      },
      (value: RecordedPresentation) => {
        value.sourceImageSha256 = 'a'.repeat(64);
      },
      (value: RecordedPresentation) => {
        value.refinedParts = 1;
      },
      (value: RecordedPresentation) => {
        value.kind = 'circuit-drawing-alignment-v1';
      },
    ]) {
      const invalid = structuredClone(presentation);
      mutate(invalid);
      expect(() =>
        createRecordedExploration(fixture, metadata, validateExplorationViewState, {
          presentation: invalid,
        }),
      ).toThrow();
    }
  });

  it('refuses private or mismatched sources even when supplied with an approved image path or hash', () => {
    const fixture = recordedCircuit as RecordedExplorationFixture;
    const metadata = {
      id: 'lecture-9-2026-11-04',
      sourceImage: '/synthetic/recorded-lecture-9.png' as const,
    };
    for (const mutate of [
      (value: RecordedExplorationFixture) => {
        value.source.observationId = 'private_capture';
      },
      (value: RecordedExplorationFixture) => {
        value.source.summary = 'A synthetic private capture, not an approved recording.';
      },
      (value: RecordedExplorationFixture) => {
        value.source.imageSha256 = 'a'.repeat(64);
      },
    ]) {
      const privateFixture = structuredClone(fixture);
      mutate(privateFixture);
      expect(() =>
        createRecordedExploration(privateFixture, metadata, validateExplorationViewState),
      ).toThrow('approved public recording');
    }
    expect(() =>
      createRecordedExploration(
        fixture,
        { ...metadata, sourceImage: '/private/source.png' as PublicDemoImage },
        validateExplorationViewState,
      ),
    ).toThrow('approved public recording');
    expect(() =>
      createRecordedExploration(
        fixture,
        { ...metadata, sourceImage: '/synthetic/recorded-lecture-14.png' },
        validateExplorationViewState,
      ),
    ).toThrow('approved public recording');
  });

  it('refuses an alignment with a wrong source hash, altered IDs or invalid coordinates', () => {
    for (const mutate of [
      (value: RecordedPresentation) => {
        value.sourceImageSha256 = 'a'.repeat(64);
      },
      (value: RecordedPresentation) => {
        value.layout.nodes[0].nodeId = 'foreign';
      },
      (value: RecordedPresentation) => {
        value.layout.nodes[0].x = 2;
      },
    ]) {
      const presentation = structuredClone(circuitPresentation) as RecordedPresentation;
      mutate(presentation);
      expect(() =>
        createRecordedExploration(
          recordedCircuit as RecordedExplorationFixture,
          { id: 'lecture-9-2026-11-04', sourceImage: '/synthetic/recorded-lecture-9.png' },
          validateExplorationViewState,
          { presentation },
        ),
      ).toThrow();
    }
  });

  it('refuses prepared output and invalid controls rather than calling them recorded live results', () => {
    const prepared = structuredClone(fixture);
    prepared.generation.mode = 'prepared-example';
    prepared.generation.provider = 'none';
    expect(() =>
      createRecordedExploration(prepared, metadata, validateExplorationViewState),
    ).toThrow('actual completed Meta');
    const wrongState = createRecordedExploration(
      fixture,
      metadata,
      validateExplorationViewState,
    ).state;
    wrongState.disabledEdgeIds = ['invented-edge'];
    expect(() =>
      createRecordedExploration(fixture, metadata, validateExplorationViewState, {
        state: wrongState,
      }),
    ).toThrow();
  });
});
