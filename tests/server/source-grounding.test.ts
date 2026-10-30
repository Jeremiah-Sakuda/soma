import { it, expect, vi, beforeEach, afterEach } from 'vitest';
import sharp from 'sharp';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { imageRegionSchema, sourceAnchorsSchema } from '../../src/lib/domain/source-grounding';
import { cropSourceDetail } from '../../src/lib/server/source-detail';
import { createExplorationService } from '../../src/lib/server/exploration';
import { createExampleExploration } from '../../src/lib/domain/exploration';
import {
  explorationStore,
  closeExplorationStore,
} from '../../src/lib/server/exploration-store';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
const owner: ExplorationPrincipal = {
  kind: 'guest',
  id: 'a'.repeat(64),
  workspaceId: 'a'.repeat(64),
  generation: 'a'.repeat(64),
  key: 'guest-' + 'a'.repeat(64),
};
let dir: string;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'soma-grounding-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(dir, 'data.sqlite'));
  vi.stubEnv('VERCEL', '');
});
afterEach(() => {
  closeExplorationStore();
  vi.unstubAllEnvs();
  rmSync(dir, { recursive: true, force: true });
});
const anchor = {
  id: 'source_a',
  label: 'A',
  region: { x: 0.1, y: 0.2, width: 0.2, height: 0.3 },
};
const answer = (name: string, args: any): any => ({
  status: 'completed',
  tools: [
    {
      type: 'function_call',
      call_id: randomUUID(),
      name,
      arguments: JSON.stringify(args),
      parsedArguments: args,
    },
  ],
  usage: { input_tokens: 100, output_tokens: 100 },
});
const image = async (color: string) =>
  'data:image/png;base64,' +
  (
    await sharp({ create: { width: 100, height: 80, channels: 3, background: color } })
      .png()
      .toBuffer()
  ).toString('base64');
function service({ crop = false, badAnchor = false, badChange = false } = {}) {
  let inspections = 0;
  const seen: any[] = [];
  const request = vi.fn(async (args) => {
    seen.push(args);
    const c = JSON.parse(
      (args.input[0] as any).content[0]?.text ?? (args.input[0] as any).content,
    );
    if (!args.instructions.includes('Required spec id=')) {
      inspections++;
      if (crop && inspections === 1)
        return answer('request_source_detail', {
          region: { x: 0.5, y: 0, width: 0.5, height: 1 },
          reason: 'Read the selected label.',
        });
      const s = createExampleExploration();
      return answer('inspect_source', {
        summary: 'Original synthetic graph; application-boundary test only.',
        uncertainty: [],
        graph: s.mode === 'checked-bfs' ? s.input : null,
        anchors: [anchor],
        change: c.previous?.imageProvided
          ? {
              relationship: 'same-material',
              summary: 'The image color changed.',
              changed: ['Background color'],
              uncertainty: [],
            }
          : 'null',
      });
    }
    const match = /Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;
    const s = createExampleExploration();
    s.id = match[1];
    s.version = Number(match[2]);
    s.sources = [
      { observationId: c.source.observationId, version: c.source.version, region: null },
    ];
    if (s.mode !== 'clarify')
      s.steps[0].sourceHighlightIds = [badAnchor ? 'absent' : anchor.id];
    return answer('compose_exploration', { spec: s });
  });
  return {
    seen,
    request,
    service: createExplorationService({
      request,
      enabled: () => true,
      reviewEnabled: () => false,
      upperBound: () => 0.001,
      reserve: async () => randomUUID(),
      settle: vi.fn(),
      revalidate: async () => {},
    }),
  };
}
const input = (dataUrl: string) => ({
  action: 'generate',
  requestId: randomUUID(),
  question: 'Explain the selected source.',
  source: {
    kind: 'screenshot',
    label: 'Original synthetic boundary image',
    capturedAt: new Date().toISOString(),
    dataUrl,
  },
});
it('rejects out-of-image, nonfinite and duplicate locations', () => {
  expect(imageRegionSchema.safeParse({ x: 0.9, y: 0, width: 0.2, height: 1 }).success).toBe(
    false,
  );
  expect(imageRegionSchema.safeParse({ x: NaN, y: 0, width: 1, height: 1 }).success).toBe(
    false,
  );
  expect(sourceAnchorsSchema.safeParse([anchor, anchor]).success).toBe(false);
});
it('crops the actual selected pixels, rejects oversize/tiny regions and external URLs', async () => {
  const left = await sharp({
    create: { width: 100, height: 80, channels: 3, background: 'red' },
  })
    .png()
    .toBuffer();
  const right = await sharp({
    create: { width: 50, height: 80, channels: 3, background: 'blue' },
  })
    .png()
    .toBuffer();
  const both = await sharp(left)
    .composite([{ input: right, left: 50, top: 0 }])
    .png()
    .toBuffer();
  const c = await cropSourceDetail('data:image/png;base64,' + both.toString('base64'), {
    x: 0.5,
    y: 0,
    width: 0.5,
    height: 1,
  });
  const p = await sharp(Buffer.from(c.dataUrl.split(',')[1], 'base64'))
    .raw()
    .toBuffer();
  expect(p[2]).toBeGreaterThan(240);
  expect(p[0]).toBeLessThan(10);
  await expect(
    cropSourceDetail('https://example.org/image.png', anchor.region),
  ).rejects.toThrow();
  await expect(
    cropSourceDetail(await image('red'), { x: 0, y: 0, width: 1, height: 1 }),
  ).rejects.toThrow();
});
it('allows one actual frozen-image detail request, binds step regions, persists metadata without pixels', async () => {
  const h = service({ crop: true });
  await h.service.initialize(owner);
  const pixels = await image('red'),
    a = (await h.service.generate(owner, input(pixels))).artifact;
  expect(h.request).toHaveBeenCalledTimes(3);
  expect(a.source.anchors).toEqual([anchor]);
  expect(a.source.detailRegion).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
  expect(a.generation.audit.some((e) => e.event === 'source-detail-requested')).toBe(true);
  await h.service.save(owner, a.id, a.version, a.state);
  const reopened = (await h.service.read(owner, a.id)).active!;
  expect(reopened.source).toEqual(a.source);
  expect(JSON.stringify(await explorationStore.read(owner))).not.toContain(pixels);
});
it('rejects invented source references instead of presenting false pointing', async () => {
  const h = service({ badAnchor: true });
  await h.service.initialize(owner);
  await expect(h.service.generate(owner, input(await image('red')))).rejects.toMatchObject({
    code: 'generation_invalid',
  });
});
it('binds before/after images to the exact owned prior source and retains immutable earlier versions', async () => {
  const h = service();
  await h.service.initialize(owner);
  const red = await image('red'),
    blue = await image('blue'),
    a = (await h.service.generate(owner, input(red))).artifact;
  const b = (
    await h.service.generate(owner, {
      ...input(blue),
      artifactId: a.id,
      baseVersion: a.version,
      previousImage: red,
      state: a.state,
    })
  ).artifact;
  expect(b.version).toBe(2);
  expect(b.source.change?.fromObservationId).toBe(a.source.observationId);
  expect((await h.service.read(owner, a.id, 1)).active).toEqual(a);
  expect(
    (h.seen[2].input[0] as any).content.filter((v: any) => v.type === 'input_image'),
  ).toHaveLength(2);
  const calls = h.request.mock.calls.length;
  await expect(
    h.service.generate(owner, {
      ...input(red),
      artifactId: b.id,
      baseVersion: b.version,
      previousImage: red,
    }),
  ).rejects.toMatchObject({ code: 'invalid_request' });
  expect(h.request).toHaveBeenCalledTimes(calls);
});
