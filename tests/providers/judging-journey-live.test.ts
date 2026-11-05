import { it, expect } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createExplorationService } from '../../src/lib/server/exploration';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { explorationExecution } from '../../src/lib/domain/exploration-view';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
it.skipIf(process.env.SOMA_JUDGING_JOURNEY_LIVE !== 'true')(
  'verifies a fresh original synthetic canonical service generation, changed-state revision and exact reopening',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
    const folder = process.env.SOMA_JUDGING_JOURNEY_OUTPUT || '.local/pm126/canonical';
    mkdirSync(folder, { recursive: true });
    const id = randomBytes(32).toString('hex'),
      principal: ExplorationPrincipal = {
        kind: 'guest',
        id,
        workspaceId: id,
        generation: id,
        key: 'guest-' + id,
      };
    let calls = 0;
    const records: unknown[] = [],
      started = Date.now(),
      ledger = async () =>
        Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0),
      save = () => writeFileSync(folder + '/results.json', JSON.stringify(records, null, 2));
    const service = createExplorationService({
      reviewEnabled: () => true,
      request: async (args) => {
        const r = await requestMetaVisionResponse(args);
        writeFileSync(folder + `/author-${++calls}.json`, JSON.stringify(r, null, 2));
        return r;
      },
      review: async (args) => {
        const r = await requestMetaResponse(args);
        writeFileSync(folder + `/review-${++calls}.json`, JSON.stringify(r, null, 2));
        return r;
      },
    });
    const sourceSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="640"><rect width="1000" height="640" fill="white"/><g font-family="Arial" fill="#203b34"><text x="40" y="50" font-size="28">Original synthetic BFS teaching worksheet / PM126</text><text x="40" y="100" font-size="22">Unweighted undirected graph. Start S. Goal T.</text><text x="40" y="145" font-size="22">Neighbor order: S, M, N, T. Discover on enqueue; stop on goal dequeue.</text><path d="M200 330L450 240L700 330L450 430Z" fill="none" stroke="#354f48" stroke-width="4"/><g font-size="28" text-anchor="middle"><circle cx="200" cy="330" r="32" fill="#dceadc"/><text x="200" y="340">S</text><circle cx="450" cy="240" r="32" fill="#dceadc"/><text x="450" y="250">M</text><circle cx="450" cy="430" r="32" fill="#dceadc"/><text x="450" y="440">N</text><circle cx="700" cy="330" r="32" fill="#dceadc"/><text x="700" y="340">T</text></g><text x="40" y="540" font-size="23">Nodes S, M, N, T. Edges S-M, S-N, M-T, N-T.</text><text x="40" y="585" font-size="20">All edges unweighted. No other nodes or edges. Original development material.</text></g></svg>';
    const png = await sharp(Buffer.from(sourceSvg)).png().toBuffer();
    writeFileSync(folder + '/source.png', png);
    records.push({
      phase: 'preflight',
      at: new Date().toISOString(),
      before: await ledger(),
      cap: 20,
      sourceSha256: createHash('sha256').update(png).digest('hex'),
      scope: 'fresh original synthetic real-provider service journey, not held-out or hosted UI',
    });
    save();
    try {
      await service.initialize(principal);
      const { artifact: first } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        question:
          'Explain breadth-first search on this exact unweighted graph. Show the frontier and let me disable an edge. Use the provided start S, goal T, nodes and neighbor order exactly.',
        source: {
          kind: 'screenshot',
          label: 'Original synthetic PM126 BFS worksheet',
          capturedAt: new Date().toISOString(),
          dataUrl: 'data:image/png;base64,' + png.toString('base64'),
        },
      });
      writeFileSync(folder + '/first.json', JSON.stringify(first, null, 2));
      records.push({
        phase: 'generate',
        mode: first.spec.mode,
        calls: first.generation.calls,
        costUsd: first.generation.costUsd,
        elapsedMs: first.generation.elapsedMs,
      });
      save();
      if (first.spec.mode !== 'checked-bfs') throw Error('Expected checked BFS source fit');
      const labels = new Map(
        first.spec.input.nodes.map((n) => [n.id, n.label.toUpperCase().trim()]),
      );
      expect([...labels.values()].sort()).toEqual(['M', 'N', 'S', 'T']);
      const label = (n: string) => labels.get(n),
        path = (p: string[] | null | undefined) => p?.map(label);
      expect(path(explorationExecution(first.spec, first.state)?.path)).toEqual(['S', 'M', 'T']);
      const edge = first.spec.input.edges.find(
        (e) => [label(e.from), label(e.to)].sort().join('-') === 'M-T',
      )!;
      expect(edge).toBeDefined();
      const state = {
        ...first.state,
        disabledEdgeIds: [edge.id],
        selectedObjectId: edge.id,
        step: 0,
      };
      expect(path(explorationExecution(first.spec, state)?.path)).toEqual(['S', 'N', 'T']);
      await service.save(principal, first.id, first.version, state);
      const { artifact: next } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: first.id,
        baseVersion: first.version,
        state,
        selectedObjectId: edge.id,
        question:
          'Explain why the route now goes through N after I disabled the M-T edge. Preserve my disabled edge, current start S, goal T, full source graph and neighbor order. Keep this checked exploration; do not add or enable edges.',
      });
      writeFileSync(folder + '/next.json', JSON.stringify(next, null, 2));
      records.push({
        phase: 'revision',
        mode: next.spec.mode,
        calls: next.generation.calls,
        costUsd: next.generation.costUsd,
        elapsedMs: next.generation.elapsedMs,
      });
      save();
      expect(next.spec.mode).toBe('checked-bfs');
      expect(next.version).toBe(2);
      expect(next.source).toEqual(first.source);
      expect(
        next.spec.mode === 'checked-bfs' && next.spec.input.edges.some((e) => e.id === edge.id),
      ).toBe(false);
      expect(path(explorationExecution(next.spec, next.state)?.path)).toEqual(['S', 'N', 'T']);
      if (next.spec.mode === 'checked-bfs')
        expect(next.spec.input).toEqual({
          ...first.spec.input,
          edges: first.spec.input.edges.filter((e) => e.id !== edge.id),
        });
      await service.save(principal, next.id, next.version, next.state);
      const beforeRead = calls,
        reopened = (await service.read(principal, next.id, next.version)).active!;
      expect(reopened.spec).toEqual(next.spec);
      expect(reopened.state).toEqual(next.state);
      const original = (await service.read(principal, first.id, first.version)).active!;
      expect(original.spec).toEqual(first.spec);
      expect(original.state).toEqual(state);
      expect(calls).toBe(beforeRead);
      records.push({
        phase: 'verified',
        exactReopen: true,
        originalRevisionPreserved: true,
        sourcePreserved: true,
        disabledEdgePreserved: true,
        noProviderCallsOnReopen: true,
      });
    } catch (e) {
      writeFileSync(
        folder + '/failed-runs.json',
        JSON.stringify((await explorationStore.read(principal))?.runs, null, 2),
      );
      records.push({
        phase: 'failed',
        code: (e as { code?: string }).code ?? (e as Error).message,
      });
      throw e;
    } finally {
      await service.remove(principal).catch(() => {});
      records.push({
        phase: 'final',
        at: new Date().toISOString(),
        after: await ledger(),
        elapsedMs: Date.now() - started,
        observedProviderCalls: calls,
      });
      save();
    }
  },
  220000,
);
