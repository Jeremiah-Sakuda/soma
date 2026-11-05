import { it, expect } from 'vitest';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createExplorationService } from '../../src/lib/server/exploration';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import { solveDc } from '../../src/lib/domain/dc-circuit';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
import { heroCircuitLayout } from '../fixtures/hero-circuit';

// The original Lecture 9 bridge slide, asked the way a student would. Opt-in, real provider,
// bounded by the application's own spend cap.
const plain = (label: string) =>
  label
    .replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080))
    .replace(/\s+/g, '')
    .toUpperCase();
const expected: Record<string, { ends: [string, string]; value: number }> = {
  R1: { ends: ['A', 'B'], value: 2 },
  R2: { ends: ['B', 'D'], value: 4 },
  R3: { ends: ['A', 'C'], value: 4 },
  R4: { ends: ['C', 'D'], value: 8 },
  R5: { ends: ['B', 'C'], value: 5 },
};

it.skipIf(process.env.SOMA_CIRCUIT_LIVE !== 'true')(
  'reads the bridge slide as a checked circuit, solves it exactly and places it on the slide',
  async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(40);
    const folder = process.env.SOMA_CIRCUIT_OUTPUT || '.local/circuit/live';
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
    const records: Record<string, unknown>[] = [],
      ledger = async () =>
        Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0),
      save = () => writeFileSync(folder + '/results.json', JSON.stringify(records, null, 2)),
      dump = (name: string, value: unknown) =>
        writeFileSync(`${folder}/${name}.json`, JSON.stringify(value, null, 2));
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
    const png = await sharp(readFileSync('docs/examples/hero-circuit/lecture-9-bridge.png'))
      .resize({ width: 1600 })
      .png()
      .toBuffer();
    records.push({
      phase: 'preflight',
      at: new Date().toISOString(),
      before: await ledger(),
      cap: Number(process.env.META_APP_SPEND_CAP_USD),
      sourceSha256: createHash('sha256').update(png).digest('hex'),
      scope:
        'original circuit slide, real-provider service run; not hosted UI or held-out evidence',
    });
    save();
    try {
      await service.initialize(principal);
      const question = process.env.SOMA_CIRCUIT_QUESTION || 'Why is there no current through R5?';
      const { artifact } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        question,
        source: {
          kind: 'screenshot',
          label: 'Lecture 9 · Wheatstone bridge (original demo slide)',
          capturedAt: new Date().toISOString(),
          dataUrl: 'data:image/png;base64,' + png.toString('base64'),
        },
      });
      dump('artifact', artifact);
      const reading: Record<string, unknown> = {
        phase: 'generate',
        question,
        mode: artifact.spec.mode,
        calls: artifact.generation.calls,
        costUsd: artifact.generation.costUsd,
        elapsedMs: artifact.generation.elapsedMs,
        audit: artifact.generation.audit.map((a) => `${a.event}: ${a.detail}`),
      };
      records.push(reading);
      save();
      expect(artifact.spec.mode).toBe('checked-circuit');
      if (artifact.spec.mode !== 'checked-circuit') return;
      const input = artifact.spec.input;
      const node = (id: string) => plain(input.nodes.find((n) => n.id === id)?.label ?? id);
      const mismatches: string[] = [];
      for (const [label, want] of Object.entries(expected)) {
        const part = input.components.find((c) => plain(c.label) === label);
        if (!part) mismatches.push(`${label} missing`);
        else {
          if (part.kind !== 'resistor' || part.value !== want.value)
            mismatches.push(`${label} read as ${part.kind} ${part.value}`);
          if ([node(part.from), node(part.to)].sort().join() !== [...want.ends].sort().join())
            mismatches.push(`${label} joins ${node(part.from)}–${node(part.to)}`);
        }
      }
      const battery = input.components.filter((c) => c.kind === 'voltage-source');
      if (
        battery.length !== 1 ||
        battery[0].value !== 12 ||
        node(battery[0].to) !== 'A' ||
        node(battery[0].from) !== 'D'
      )
        mismatches.push(`battery read as ${JSON.stringify(battery)}`);
      if (input.components.length !== 6) mismatches.push(`${input.components.length} parts`);
      if (node(input.ground) !== 'D') mismatches.push(`ground ${node(input.ground)}`);
      const solution = solveDc(input);
      // Placement error, in pixels of the 1920-wide slide, against the measured drawing.
      const layout = artifact.source.layout;
      const error = (a: { x: number; y: number }, b: { x: number; y: number }) =>
        Math.round(Math.hypot((a.x - b.x) * 1920, (a.y - b.y) * 1080));
      const nodeErrors = Object.fromEntries(
        heroCircuitLayout.nodes.map((m) => {
          const read = layout?.nodes.find((p) => node(p.nodeId) === m.nodeId);
          return [m.nodeId, read ? error(read, m) : null];
        }),
      );
      const partErrors = Object.fromEntries(
        heroCircuitLayout.components.map((m) => {
          const part = input.components.find((c) =>
            m.componentId === 'V1' ? c.kind === 'voltage-source' : plain(c.label) === m.componentId,
          );
          const read = part && layout?.components?.find((p) => p.componentId === part.id);
          if (!read) return [m.componentId, null];
          const mid = (p: { x1: number; y1: number; x2: number; y2: number }) => ({
            x: (p.x1 + p.x2) / 2,
            y: (p.y1 + p.y2) / 2,
          });
          return [m.componentId, error(mid(read), mid(m))];
        }),
      );
      Object.assign(reading, {
        mismatches,
        voltages: solution.voltages,
        currents: solution.currents,
        nodeErrorsPx: nodeErrors,
        partCentreErrorsPx: partErrors,
        steps: artifact.spec.steps.map((s) => `${s.executionStep}: ${s.caption}`),
      });
      records.push({ phase: 'after', ledger: await ledger() });
      save();
      // Muse chooses the experiment for a new question; Soma computes and verifies it.
      if (process.env.SOMA_CIRCUIT_INVESTIGATE === 'true') {
        const investigateQuestion = 'When would current flow through R5, and which way?';
        const { artifact: probed } = await service.generate(principal, {
          action: 'generate',
          requestId: randomUUID(),
          question: investigateQuestion,
          intent: 'investigate',
          artifactId: artifact.id,
          baseVersion: artifact.version,
          state: artifact.state,
        });
        dump('investigate', probed);
        records.push({
          phase: 'investigate',
          question: investigateQuestion,
          calls: probed.generation.calls,
          costUsd: probed.generation.costUsd,
          elapsedMs: probed.generation.elapsedMs,
          experiment: probed.circuitExperiment ?? null,
          steps:
            probed.spec.mode === 'checked-circuit'
              ? probed.spec.steps.map((s) => `${s.executionStep}: ${s.caption}`)
              : [],
          audit: probed.generation.audit.map((a) => `${a.event}: ${a.detail}`),
        });
        save();
      }
      records.push({ phase: 'final', ledger: await ledger() });
      save();
      expect(mismatches).toEqual([]);
      expect(
        solution.exact.currents[input.components.find((c) => plain(c.label) === 'R5')!.id],
      ).toBe('0');
    } finally {
      save();
    }
  },
  180_000,
);
