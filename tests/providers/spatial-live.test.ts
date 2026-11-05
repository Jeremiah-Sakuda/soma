import { it, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createExplorationService } from '../../src/lib/server/exploration';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

it.skipIf(process.env.SOMA_SPATIAL_LIVE !== 'true')(
  'actual Muse authors a source-grounded 3D schematic, applies a contextual view request and saves exact state',
  async () => {
    // Original synthetic development source. Shared real application budget, no reset or mock billing.
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
    const id = randomBytes(32).toString('hex'),
      principal: ExplorationPrincipal = {
        kind: 'guest',
        id,
        workspaceId: id,
        generation: id,
        key: `guest-${id}`,
      };
    const run = `${process.env.SOMA_SPATIAL_ARTIFACT_ROOT ?? '.local/pm096'}/live-${Date.now()}`;
    mkdirSync(run, { recursive: true });
    const records: unknown[] = [];
    const write = () => writeFileSync(`${run}/results.json`, JSON.stringify(records, null, 2));
    let call = 0;
    const service = createExplorationService({
      reviewEnabled: () => true,
      request: async (args) => {
        const response = await requestMetaVisionResponse(args);
        writeFileSync(
          `${run}/author-${++call}.json`,
          JSON.stringify(
            {
              status: response.status,
              structured: response.structured,
              tools: response.tools.map((t) => ({ name: t.name, value: t.parsedArguments })),
              usage: response.usage,
            },
            null,
            2,
          ),
        );
        return response;
      },
      review: async (args) => {
        const response = await requestMetaResponse(args);
        writeFileSync(
          `${run}/review-${++call}.json`,
          JSON.stringify(
            {
              status: response.status,
              structured: response.structured,
              tools: response.tools.map((t) => ({ name: t.name, value: t.parsedArguments })),
              usage: response.usage,
            },
            null,
            2,
          ),
        );
        return response;
      },
    });
    const ledger = async () =>
      Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0);
    records.push({
      phase: 'preflight',
      consumed: await ledger(),
      cap: Number(process.env.META_APP_SPEND_CAP_USD),
    });
    write();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="460"><rect width="960" height="460" fill="#f5f2e9"/><text x="45" y="55" font-family="Arial" font-size="28">A three-stage signal unit — original teaching schematic</text><rect x="35" y="95" width="890" height="290" rx="30" fill="#e4ebe4" stroke="#667769" stroke-width="3"/><text x="55" y="125" font-family="Arial" font-size="18">Enclosure</text><circle cx="200" cy="240" r="65" fill="#89aa94"/><rect x="405" y="175" width="145" height="130" rx="12" fill="#dca27f"/><circle cx="770" cy="240" r="65" fill="#e4c478"/><path d="M270 240H395M560 240H695" stroke="#304b39" stroke-width="8"/><path d="m380 226 18 14-18 14m300-28 18 14-18 14" fill="none" stroke="#304b39" stroke-width="6"/><g fill="#17271c" font-family="Arial" font-size="22" text-anchor="middle"><text x="200" y="247">Sensor</text><text x="477" y="247">Processor</text><text x="770" y="247">Indicator</text></g><text x="45" y="420" font-family="Arial" font-size="20">Signal enters sensor → processor transforms it → indicator receives output.</text></svg>`;
    const png = await sharp(Buffer.from(svg)).png().toBuffer();
    writeFileSync(`${run}/source.png`, png);
    try {
      await service.initialize(principal);
      const { artifact: first } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        question:
          'Open this up as a 3D schematic. Show the enclosure and its three internal parts as a spatial panel, with connections and three brief explanation stages. Geometry is illustrative, not a physical simulation or a search algorithm.',
        source: {
          kind: 'screenshot',
          label: 'Original signal-unit schematic',
          capturedAt: new Date().toISOString(),
          dataUrl: `data:image/png;base64,${png.toString('base64')}`,
        },
      });
      writeFileSync(`${run}/first-artifact.json`, JSON.stringify(first, null, 2));
      records.push({
        phase: 'first',
        mode: first.spec.mode,
        calls: first.generation.calls,
        elapsedMs: first.generation.elapsedMs,
        costUsd: first.generation.costUsd,
        assurance: first.validation.assurance,
      });
      write();
      expect(first.spec.mode).toBe('explanation');
      if (first.spec.mode !== 'explanation') throw new Error('Expected a spatial explanation');
      const panel = first.spec.scene.panels.find((p) => p.kind === 'spatial');
      expect(panel?.kind).toBe('spatial');
      if (panel?.kind !== 'spatial') throw new Error('No generated spatial panel');
      const processor = panel.objects.find((o) => /processor/i.test(o.label));
      expect(processor).toBeDefined();
      const state = {
        ...first.state,
        selectedObjectId: processor!.id,
        spatial: {
          ...first.state.spatial!,
          renderer: 'anatomy' as const,
          spread: 0.55,
          slice: 0.2,
        },
      };
      await service.save(principal, first.id, first.version, state);
      const { artifact: next } = await service.generate(principal, {
        action: 'generate',
        requestId: randomUUID(),
        artifactId: first.id,
        baseVersion: 1,
        state,
        selectedObjectId: processor!.id,
        question:
          'Keep this 3D world and its current separation and cutaway. Show the selected processor from the side using the camera, and explain its role in one short sentence. Keep all part names and geometry unchanged.',
      });
      writeFileSync(`${run}/next-artifact.json`, JSON.stringify(next, null, 2));
      records.push({
        phase: 'followup',
        mode: next.spec.mode,
        calls: next.generation.calls,
        elapsedMs: next.generation.elapsedMs,
        costUsd: next.generation.costUsd,
        state: next.state,
      });
      write();
      expect(next.spec.mode).toBe('explanation');
      expect(next.state.spatial).toMatchObject({
        renderer: 'anatomy',
        azimuth: 90,
        spread: 0.55,
        slice: 0.2,
      });
      expect(next.state.selectedObjectId).toBe(processor!.id);
      if (next.spec.mode !== 'explanation')
        throw new Error('Expected continued spatial explanation');
      const after = next.spec.scene.panels.find((p) => p.kind === 'spatial');
      expect(after?.kind).toBe('spatial');
      if (after?.kind !== 'spatial') throw new Error('Missing spatial continuation');
      for (const object of panel.objects) {
        const retained = after.objects.find((o) => o.id === object.id);
        expect(retained).toBeDefined();
        expect(retained!.position).toEqual(object.position);
        expect(retained!.size).toEqual(object.size);
      }
      await service.save(principal, next.id, next.version, next.state);
      expect((await service.read(principal, next.id, next.version)).active!.state).toEqual(
        next.state,
      );
      expect((await service.read(principal, first.id, 1)).active!.spec).toEqual(first.spec);
      records.push({
        phase: 'verified',
        sourcePreserved: JSON.stringify(next.source) === JSON.stringify(first.source),
        exactReopen: true,
      });
    } catch (error) {
      records.push({
        phase: 'failed',
        code: (error as { code?: string }).code ?? 'assertion-or-transport',
      });
      throw error;
    } finally {
      await service.remove(principal).catch(() => {});
      records.push({
        phase: 'final',
        consumed: await ledger(),
        cap: Number(process.env.META_APP_SPEND_CAP_USD),
      });
      write();
    }
  },
  240000,
);
