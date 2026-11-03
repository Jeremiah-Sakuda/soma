import { it, expect } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createExplorationService } from '../../src/lib/server/exploration';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import { scoreCircuit, scoreGraph, type Case } from './source-evaluation-v2-score';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

// Second fresh source evaluation: original slides rendered by scripts/render-source-evaluation-v2.mjs,
// frozen (cases.json + images hashed) before any provider call. Each case is one outer request on a
// fresh guest; the answer key is never sent. Opt-in, real provider, bounded by the app's spend cap.
const dir = 'tests/fixtures/source-evaluation-v2';

it.skipIf(process.env.SOMA_EVAL_V2_LIVE !== 'true')(
  'reads fresh original circuit and larger graph slides exactly',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(40);
    const cases = JSON.parse(readFileSync(`${dir}/cases.json`, 'utf8')) as Case[];
    const freeze = createHash('sha256');
    for (const file of ['cases.json', ...cases.map((c) => `${c.id}.png`)]) freeze.update(readFileSync(`${dir}/${file}`));
    const only = process.env.SOMA_EVAL_V2_ONLY?.split(',');
    const local = '.local/source-eval-v2';
    mkdirSync(local, { recursive: true });
    const fs = getServerFirestore();
    const ledger = async () => Number((await fs.doc('somaBudget/global').get()).data()?.consumed ?? 0);
    const turns = async () => (await fs.doc('somaServiceLimits/exploration-global').get()).data() as { day?: string; turns?: number } | undefined;
    const results: Record<string, unknown>[] = [];
    const save = () => writeFileSync(`${dir}/results.json`, JSON.stringify(results, null, 1) + '\n');
    results.push({ phase: 'preflight', at: new Date().toISOString(), freezeSha256: freeze.digest('hex'), ledger: await ledger(), turns: await turns() });
    save();
    for (const c of cases) {
      if (only && !only.includes(c.id)) continue;
      // Stop well inside the cap and the day's turns so the live demo keeps headroom. As in the
      // store, a count from an earlier UTC day is stale until the next turn resets it.
      const today = await turns();
      const used = today?.day === new Date().toISOString().slice(0, 10) ? Number(today.turns ?? 0) : 0;
      if ((await ledger()) > 37.5 || used > 150) {
        results.push({ id: c.id, status: 'not-run', reason: 'headroom guard' });
        save();
        continue;
      }
      const id = randomBytes(32).toString('hex'),
        principal: ExplorationPrincipal = { kind: 'guest', id, workspaceId: id, generation: id, key: 'guest-' + id };
      const service = createExplorationService({ reviewEnabled: () => true, request: requestMetaVisionResponse, review: requestMetaResponse });
      const png = await sharp(readFileSync(`${dir}/${c.id}.png`)).resize({ width: 1600 }).png().toBuffer();
      const started = Date.now();
      try {
        await service.initialize(principal);
        const { artifact } = await service.generate(principal, {
          action: 'generate',
          requestId: randomUUID(),
          question: c.question,
          source: { kind: 'screenshot', label: 'Lecture slide (original test slide)', capturedAt: new Date().toISOString(), dataUrl: 'data:image/png;base64,' + png.toString('base64') },
        });
        writeFileSync(`${local}/${c.id}.json`, JSON.stringify(artifact, null, 2));
        const spec = artifact.spec as { mode: string; input?: unknown };
        const score = c.subject === 'circuit' ? scoreCircuit(c, spec) : scoreGraph(c, spec);
        results.push({
          id: c.id,
          subject: c.subject,
          status: 'published',
          mode: spec.mode,
          ...score,
          elapsedMs: artifact.generation.elapsedMs,
          calls: artifact.generation.calls,
          costUsd: artifact.generation.costUsd,
          audit: artifact.generation.audit.map((a) => `${a.event}: ${a.detail}`).slice(0, 12),
        });
      } catch (error) {
        results.push({ id: c.id, subject: c.subject, status: 'failed', passed: false, elapsedMs: Date.now() - started, error: String((error as Error).message ?? error).slice(0, 300) });
      }
      save();
    }
    results.push({ phase: 'final', at: new Date().toISOString(), ledger: await ledger(), turns: await turns() });
    save();
  },
  1_800_000,
);
