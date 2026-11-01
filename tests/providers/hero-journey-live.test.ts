import { it, expect } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createExplorationService } from '../../src/lib/server/exploration';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import { explorationExecution } from '../../src/lib/domain/exploration-view';
import { routeCost } from '../../src/lib/domain/cost-probe';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

// PM132 hero rehearsal: the original Lecture 14 Dijkstra slide, asked the way the demo asks it.
// Opt-in, real provider, bounded by the application's own spend cap.
const expectedWeights: Record<string, number> = {
  'A-B': 4, 'A-C': 1, 'B-C': 2, 'B-D': 1, 'C-E': 5, 'D-E': 3, 'D-F': 3, 'E-F': 3, 'A-F': 11,
};

it.skipIf(process.env.SOMA_HERO_JOURNEY_LIVE !== 'true')(
  'reads the hero slide exactly, survives an intervention, probes the tipping point and reopens',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(40);
    const folder = process.env.SOMA_HERO_JOURNEY_OUTPUT || '.local/pm132/hero-live';
    mkdirSync(folder, { recursive: true });
    const id = randomBytes(32).toString('hex'),
      principal: ExplorationPrincipal = { kind: 'guest', id, workspaceId: id, generation: id, key: 'guest-' + id };
    let calls = 0;
    const records: unknown[] = [],
      started = Date.now(),
      ledger = async () => Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0),
      save = () => writeFileSync(folder + '/results.json', JSON.stringify(records, null, 2)),
      dump = (name: string, value: unknown) => writeFileSync(`${folder}/${name}.json`, JSON.stringify(value, null, 2));
    const service = createExplorationService({
      reviewEnabled: () => true,
      request: async (args) => {
        const r = await requestMetaVisionResponse(args);
        dump(`author-${++calls}`, r);
        return r;
      },
      review: async (args) => {
        const r = await requestMetaResponse(args);
        dump(`review-${++calls}`, r);
        return r;
      },
    });
    // The app's capture path sends at most 1600 px per side; mirror that bound.
    const png = await sharp(readFileSync('docs/examples/hero-dijkstra/lecture-14-dijkstra.png')).resize({ width: 1600 }).png().toBuffer();
    records.push({
      phase: 'preflight',
      at: new Date().toISOString(),
      before: await ledger(),
      cap: Number(process.env.META_APP_SPEND_CAP_USD),
      sourceSha256: createHash('sha256').update(png).digest('hex'),
      scope: 'original hero slide, real-provider service journey; not hosted UI or held-out evidence',
    });
    save();
    try {
      await service.initialize(principal);
      const question =
        process.env.SOMA_HERO_QUESTION ||
        'Walk me through Dijkstra on this slide. Why doesn’t it just take the direct A to F edge?';
      const { artifact: first } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        question,
        source: {
          kind: 'screenshot',
          label: 'Lecture 14 · Dijkstra worked example (original demo slide)',
          capturedAt: new Date().toISOString(),
          dataUrl: 'data:image/png;base64,' + png.toString('base64'),
        },
      });
      dump('first', first);
      records.push({ phase: 'generate', question, mode: first.spec.mode, calls: first.generation.calls, costUsd: first.generation.costUsd, elapsedMs: first.generation.elapsedMs });
      save();
      expect(first.spec.mode).toBe('checked-dijkstra');
      if (first.spec.mode !== 'checked-dijkstra') return;

      const labels = new Map(first.spec.input.nodes.map((n) => [n.id, n.label.toUpperCase().trim()])),
        label = (n: string) => labels.get(n)!,
        pair = (e: { from: string; to: string }) => [label(e.from), label(e.to)].sort().join('-'),
        named = (p: string[] | null | undefined) => p?.map(label);
      const weights = Object.fromEntries(first.spec.input.edges.map((e) => [pair(e), e.weight ?? 1]));
      records.push({ phase: 'reading', labels: [...labels.values()].sort(), weights, directed: first.spec.input.directed, start: label(first.spec.input.start), goal: first.spec.input.goal && label(first.spec.input.goal) });
      save();
      expect([...labels.values()].sort()).toEqual(['A', 'B', 'C', 'D', 'E', 'F']);
      expect(weights).toEqual(expectedWeights);
      expect(first.spec.input.directed).toBe(false);
      const run = explorationExecution(first.spec, first.state)!;
      expect(named(run.path)).toEqual(['A', 'C', 'B', 'D', 'F']);
      expect(routeCost(run.input, run.path)).toBe(7);

      const df = first.spec.input.edges.find((e) => pair(e) === 'D-F')!;
      const cut = { ...first.state, disabledEdgeIds: [df.id], selectedObjectId: df.id, step: 0 };
      const rerouted = explorationExecution(first.spec, cut)!;
      expect(named(rerouted.path)).toEqual(['A', 'C', 'E', 'F']);
      expect(routeCost(rerouted.input, rerouted.path)).toBe(9);
      await service.save(principal, first.id, first.version, cut);
      records.push({ phase: 'intervention', disabled: 'D-F', path: named(rerouted.path), cost: 9, providerCalls: 0 });
      save();

      const { artifact: probe } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        intent: 'investigate',
        artifactId: first.id,
        baseVersion: first.version,
        state: first.state,
        question:
          'Choose an informative edge and investigate where fewest edges and lowest cost agree or diverge. Use the checked intervention results to explain the boundary, preserve the original graph and expose a hypothetical cost control.',
      });
      dump('probe', probe);
      const audit = JSON.stringify(probe).match(/Application checked [^"]*/)?.[0] ?? null;
      records.push({ phase: 'tipping-point', mode: probe.spec.mode, audit, calls: probe.generation.calls, costUsd: probe.generation.costUsd, elapsedMs: probe.generation.elapsedMs });
      save();

      expect(probe.experiment?.edgeId && pair(probe.spec.mode === 'checked-dijkstra' ? probe.spec.input.edges.find((e) => e.id === probe.experiment!.edgeId)! : { from: '', to: '' })).toBe('A-F');
      expect(probe.experiment?.criticalCost).toBe(7);

      const followQuestion =
        process.env.SOMA_HERO_FOLLOWUP || 'Why does the direct A to F edge only win once it costs 7 or less?';
      const { artifact: next } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: probe.id,
        baseVersion: probe.version,
        state: probe.state,
        question: followQuestion,
      });
      dump('next', next);
      const nextRun = next.spec.mode === 'checked-dijkstra' ? explorationExecution(next.spec, next.state) : null;
      records.push({ phase: 'follow-up', question: followQuestion, mode: next.spec.mode, path: nextRun && named(nextRun.path), experiment: next.experiment?.criticalCost ?? null, version: next.version, calls: next.generation.calls, costUsd: next.generation.costUsd, elapsedMs: next.generation.elapsedMs });
      save();
      expect(next.spec.mode).toBe('checked-dijkstra');
      expect(next.version).toBe(3);
      expect(nextRun && named(nextRun.path)).toEqual(['A', 'C', 'B', 'D', 'F']);
      expect(next.source).toEqual(first.source);

      await service.save(principal, next.id, next.version, next.state);
      const beforeRead = calls,
        reopened = (await service.read(principal, next.id, next.version)).active!;
      expect(reopened.spec).toEqual(next.spec);
      expect(reopened.state).toEqual(next.state);
      expect(calls).toBe(beforeRead);
      records.push({ phase: 'verified', exactReopen: true, noProviderCallsOnReopen: true });
    } catch (e) {
      records.push({ phase: 'failed', code: (e as { code?: string }).code ?? (e as Error).message });
      throw e;
    } finally {
      await service.remove(principal).catch(() => {});
      records.push({ phase: 'final', at: new Date().toISOString(), after: await ledger(), elapsedMs: Date.now() - started, observedProviderCalls: calls });
      save();
    }
  },
  300000,
);
