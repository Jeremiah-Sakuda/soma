import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import graph from '../../src/lib/fixtures/recorded-graph.json';
import circuit from '../../src/lib/fixtures/recorded-circuit.json';
import presentation from '../../src/lib/fixtures/recorded-circuit-presentation.json';
import graphPresentation from '../../src/lib/fixtures/recorded-graph-presentation.json';
import { checkExploration } from '../../src/lib/domain/exploration';
import { probeEdgeCost } from '../../src/lib/domain/cost-probe';
import { probeDcValue } from '../../src/lib/domain/dc-circuit';
import {
  createRecordedExploration,
  recordedFixtureFromArtifact,
  type RecordedExplorationFixture,
} from '../../src/lib/server/exploration-recording';
import { validateExplorationViewState } from '../../src/lib/server/exploration';
import { snapCircuitToDrawing } from '../../src/lib/server/circuit-snap';
import { snapNodesToDrawing } from '../../src/lib/server/node-snap';
import { heroCircuitLayout } from '../fixtures/hero-circuit';
import type { ExplorationArtifact } from '../../src/lib/server/exploration-types';

const digest = (path: string) => createHash('sha256').update(readFileSync(path)).digest('hex');

describe('reviewed original synthetic recorded fixtures', () => {
  it.each([
    {
      name: 'graph',
      fixture: graph,
      image: 'recorded-lecture-14.png',
      digest: '439afbcc09ccbf7ef6c9355b069113131a8de80be6bce32634324b0d26371c28',
    },
    {
      name: 'circuit',
      fixture: circuit,
      image: 'recorded-lecture-9.png',
      digest: '85e3e89f7073117786388867e327d101b3191b9b9ca99136433d90ea70b7a32b',
    },
  ])('keeps the approved $name receipt and exact submitted source bytes', (record) => {
    // These digests pin the complete manually reviewed export, including prose, receipts,
    // model-selected investigations and missing fields. A new run needs a new review.
    expect(digest(`src/lib/fixtures/recorded-${record.name}.json`)).toBe(record.digest);
    expect(digest(`public/synthetic/${record.image}`)).toBe(record.fixture.source.imageSha256);
    expect(recordedFixtureFromArtifact(record.fixture as RecordedExplorationFixture)).toEqual(
      record.fixture,
    );
    expect(Object.keys(record.fixture).sort()).toEqual(
      [
        'createdAt',
        record.name === 'graph' ? 'experiment' : 'circuitExperiment',
        'generation',
        'question',
        'source',
        'spec',
        'state',
        'updatedAt',
      ].sort(),
    );
    expect(record.fixture.source.label).toContain('original demo slide');
    expect(JSON.stringify(record.fixture)).not.toMatch(
      /(?:data:image|file:\/\/|\/Users\/|Bearer |soma_account|soma_explore|api[_-]?key|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b)/i,
    );
    expect(record.fixture.generation).toMatchObject({
      mode: 'live',
      provider: 'meta',
      model: 'muse-spark-1.3',
      calls: 3,
    });
    expect(record.fixture.generation.audit[0].event).toBe('source-reused');
    expect(record.fixture.generation.timings.map((t) => t.call)).toEqual([1, 2, 3]);
  });

  it('rechecks every recorded graph intervention and retains this investigation’s actual receipt', () => {
    const checked = checkExploration(graph.spec);
    expect(checked.executions!.primary.path).toEqual(['A', 'C', 'B', 'D', 'F']);
    if (checked.spec.mode !== 'checked-dijkstra') throw new Error('Expected the recorded graph');
    const probe = probeEdgeCost(
      checked.spec.input,
      graph.experiment.edgeId,
      graph.experiment.rationale,
    );
    expect(probe).toEqual(graph.experiment);
    expect(graph.source.readingCheck).toMatchObject({
      model: 'muse-wonder-1.0',
      status: 'confirmed',
      nodes: 6,
      edges: 9,
    });
    expect(graph.updatedAt).toBe('2026-11-04T03:14:33.839Z');
    expect(graph.generation).toMatchObject({
      costUsd: 0.05105125,
      elapsedMs: 47589,
      usage: { input_tokens: 13745, output_tokens: 3776 },
    });
  });

  it('rechecks every circuit intervention and retains its actual image check and rationale', () => {
    const checked = checkExploration(circuit.spec);
    if (checked.spec.mode !== 'checked-circuit') throw new Error('Expected the recorded circuit');
    const p = circuit.circuitExperiment;
    const probe = probeDcValue(
      checked.spec.input,
      undefined,
      p.componentId,
      { kind: 'current', componentId: p.observe.componentId },
      'zero',
      p.rationale,
    );
    expect(probe.cases).toEqual(p.cases);
    expect(probe).toMatchObject({
      criticalExact: '8',
      criticalValue: 8,
      verified: true,
      rationale:
        'Varying R4 unbalances the bridge and shows how direction through R5 flips around balance.',
    });
    expect(circuit.source.circuitReadingCheck).toEqual({
      model: 'muse-wonder-1.0',
      status: 'confirmed',
      components: 6,
      corrections: [],
      disputes: [],
    });
    // This receipt describes the follow-up: the inherited image check is a source fact.
    expect(circuit.generation.audit.some((a) => a.event.startsWith('reading-'))).toBe(false);
    expect(circuit.updatedAt).toBe('2026-11-04T03:16:39.831Z');
    expect(circuit.generation).toMatchObject({
      costUsd: 0.041424,
      elapsedMs: 36578,
      usage: { input_tokens: 11793, output_tokens: 3230 },
    });
  });

  it('reproduces the separate circuit presentation from source pixels and preserves the original receipt', async () => {
    const dataUrl =
      'data:image/png;base64,' +
      readFileSync('public/synthetic/recorded-lecture-9.png').toString('base64');
    const aligned = await snapCircuitToDrawing(dataUrl, circuit.source.layout);
    expect(presentation).toEqual({
      kind: 'circuit-drawing-alignment-v1',
      sourceImageSha256: circuit.source.imageSha256,
      layout: { ...aligned.layout, edgeLabels: [] },
      snappedNodes: aligned.snappedNodes,
      refinedParts: aligned.refinedParts,
    });
    const pixels = (a: { x: number; y: number }, b: { x: number; y: number }) =>
      Math.hypot((a.x - b.x) * 1600, (a.y - b.y) * 900);
    const mid = (p: { x1: number; x2: number; y1: number; y2: number }) => ({
      x: (p.x1 + p.x2) / 2,
      y: (p.y1 + p.y2) / 2,
    });
    for (const truth of heroCircuitLayout.nodes)
      expect(
        pixels(
          aligned.layout.nodes.find((n) => n.nodeId === truth.nodeId)!,
          truth,
        ),
      ).toBeLessThan(1);
    for (const truth of heroCircuitLayout.components) {
      const id =
        truth.componentId === 'V1'
          ? circuit.spec.input.components.find((p) => p.kind === 'voltage-source')!.id
          : truth.componentId;
      expect(
        pixels(mid(aligned.layout.components.find((p) => p.componentId === id)!), mid(truth)),
      ).toBeLessThan(9);
    }
    const metadata = presentation as NonNullable<ExplorationArtifact['recording']>['presentation'];
    const artifact = createRecordedExploration(
      circuit as RecordedExplorationFixture,
      { id: 'lecture-9-2026-11-04', sourceImage: '/synthetic/recorded-lecture-9.png' },
      validateExplorationViewState,
      { presentation: metadata },
    );
    expect(artifact.source.layout).toEqual(circuit.source.layout);
    expect(artifact.generation).toEqual(circuit.generation);
    expect(artifact.circuitExperiment).toEqual(circuit.circuitExperiment);
    expect(artifact.recording?.presentation).toEqual(presentation);
    expect(artifact.recording?.presentation?.layout).not.toEqual(artifact.source.layout);
    expect(() =>
      createRecordedExploration(
        circuit as RecordedExplorationFixture,
        { id: 'wrong-source', sourceImage: '/synthetic/recorded-lecture-9.png' },
        validateExplorationViewState,
        { presentation: { ...metadata!, sourceImageSha256: 'wrong' } },
      ),
    ).toThrow('match');
  });

  it('reproduces the separate graph alignment from the approved image and recorded topology', async () => {
    const dataUrl =
      'data:image/png;base64,' +
      readFileSync('public/synthetic/recorded-lecture-14.png').toString('base64');
    const checked = checkExploration(graph.spec);
    if (checked.spec.mode !== 'checked-dijkstra') throw new Error('Expected the recorded graph');
    const snapped = await snapNodesToDrawing(
      dataUrl,
      graph.source.layout.nodes,
      checked.spec.input,
    );
    expect(graphPresentation).toEqual({
      kind: 'graph-drawing-alignment-v1',
      sourceImageSha256: graph.source.imageSha256,
      layout: { nodes: snapped.positions, edgeLabels: graph.source.layout.edgeLabels },
      snappedNodes: snapped.moved,
      refinedParts: 0,
    });
    expect(snapped.moved).toBe(5);
    // Original source drawing centres, independently measured in its 1600×900 pixels.
    for (const [id, x, y] of [
      ['D', 663, 373],
      ['F', 854, 490],
    ] as const) {
      const point = snapped.positions.find((p) => p.nodeId === id)!;
      expect(Math.hypot(point.x * 1600 - x, point.y * 900 - y)).toBeLessThan(3);
    }
    const artifact = createRecordedExploration(
      graph as RecordedExplorationFixture,
      { id: 'lecture-14-2026-11-04', sourceImage: '/synthetic/recorded-lecture-14.png' },
      validateExplorationViewState,
      {
        presentation: graphPresentation as NonNullable<
          ExplorationArtifact['recording']
        >['presentation'],
      },
    );
    expect(artifact.source.layout).toEqual(graph.source.layout);
    expect(artifact.source.uncertainty).toEqual(graph.source.uncertainty);
    expect(artifact.generation).toEqual(graph.generation);
    expect(artifact.recording?.presentation).toEqual(graphPresentation);
  });
});
