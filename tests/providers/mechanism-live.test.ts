import { it, expect, vi } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import sharp from 'sharp';
import { createExplorationService } from '../../src/lib/server/exploration';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { mechanismMeshes } from '../../src/lib/domain/mechanism-geometry';
import { spatialScene } from '../../src/lib/domain/spatial-exploration';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

it.skipIf(process.env.SOMA_MECHANISM_LIVE !== 'true')('actual Muse constructs custom surfaces and coupled motion from an original source, then preserves them through review and reopening', async () => {
  expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
  expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(20);
  const id = randomBytes(32).toString('hex'), principal: ExplorationPrincipal = { kind: 'guest', id, workspaceId: id, generation: id, key: `guest-${id}` };
  const run = `.local/pm113/live-${Date.now()}`; mkdirSync(run, { recursive: true });
  const records: unknown[] = []; const write = () => writeFileSync(`${run}/results.json`, JSON.stringify(records, null, 2));
  let call = 0;
  const originalFetch = globalThis.fetch;
  const observedFetch = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url, init) => {
    const response = await originalFetch(url, init);
    if (String(url) === 'https://api.meta.ai/v1/responses' && !response.ok) {
      const payload = await response.clone().json().catch(() => ({})) as { error?: { code?: string; message?: string; type?: string; param?: string } };
      records.push({ phase: 'provider-http-error', status: response.status, error: payload.error }); write();
    }
    return response;
  });
  const service = createExplorationService({
    reviewEnabled: () => true,
    request: async args => {
      writeFileSync(`${run}/request-${call + 1}.json`, JSON.stringify({ instructions: args.instructions, input: args.input, tools: args.tools, structuredOutput: args.structuredOutput }, null, 2));
      const response = await requestMetaVisionResponse(args).catch(error => { records.push({ phase: 'provider-author-error', code: error.code, requestSent: error.requestSent, usage: error.usage }); write(); throw error; });
      writeFileSync(`${run}/author-${++call}.json`, JSON.stringify({ status: response.status, structured: response.structured, tools: response.tools.map(t => ({ name: t.name, value: t.parsedArguments })), usage: response.usage }, null, 2)); return response;
    },
    review: async args => {
      const response = await requestMetaResponse(args);
      writeFileSync(`${run}/review-${++call}.json`, JSON.stringify({ status: response.status, structured: response.structured, tools: response.tools.map(t => ({ name: t.name, value: t.parsedArguments })), usage: response.usage }, null, 2)); return response;
    },
  });
  const ledger = async () => Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed ?? 0);
  records.push({ phase: 'preflight', at: new Date().toISOString(), consumed: await ledger(), cap: Number(process.env.META_APP_SPEND_CAP_USD) }); write();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="580"><rect width="1000" height="580" fill="#f4f1e7"/><g font-family="Arial" fill="#263c36"><text x="35" y="45" font-size="28">Original teaching schematic: a hinged passage</text><text x="35" y="88" font-size="20">Fixed frame. Gate and handle rotate together about the left vertical hinge.</text><text x="35" y="125" font-size="18">Illustrative dimensions and motion only; no forces, rates or engineering tolerances.</text></g><path d="M200 465V180H640V465" fill="none" stroke="#628575" stroke-width="35"/><rect x="226" y="200" width="382" height="260" fill="#ad6447" stroke="#3e514d" stroke-width="4"/><path d="M225 195V465" stroke="#aab5ad" stroke-width="15"/><path d="M540 305h25v55h-25" fill="none" stroke="#e6c365" stroke-width="9"/><g font-family="Arial" fill="#263c36" font-size="22"><text x="680" y="220">Frame stays fixed</text><text x="680" y="280">Left hinge is the axis</text><text x="680" y="340">Gate opens outward</text><text x="680" y="400">Handle stays attached</text><text x="35" y="535">Closed → partly open → open. Use one opening control for gate and handle.</text></g></svg>`;
  const png = await sharp(Buffer.from(svg)).png().toBuffer(); writeFileSync(`${run}/source.png`, png);
  try {
    await service.initialize(principal);
    const { artifact: first } = await service.generate(principal, { action: 'generate', requestId: randomUUID(), question: 'Build this as a spatial mechanism using custom geometry, not catalog renderStyle meshes. Design the open rectangular frame, a thin gate, hinge pin and bent handle using prism, lathe and tube forms. Use one opening parameter coupled to both the gate and attached handle around the same left hinge. Give three explanation steps with parameterPoses for closed, partial and open. Preserve source roles; label chosen dimensions and angle as illustrative assumptions. Keep the construction concise enough to finish.', source: { kind: 'screenshot', label: 'Original synthetic hinged passage schematic', capturedAt: new Date().toISOString(), dataUrl: `data:image/png;base64,${png.toString('base64')}` } });
    writeFileSync(`${run}/first-artifact.json`, JSON.stringify(first, null, 2));
    records.push({ phase: 'first', mode: first.spec.mode, calls: first.generation.calls, costUsd: first.generation.costUsd, elapsedMs: first.generation.elapsedMs }); write();
    if (first.spec.mode !== 'explanation') throw new Error('Expected a custom mechanism');
    const panel = first.spec.scene.panels.find(p => p.kind === 'spatial');
    if (panel?.kind !== 'spatial') throw new Error('No spatial panel');
    const pieces = panel.objects.flatMap(o => o.geometry ?? []);
    expect(pieces.length).toBeGreaterThanOrEqual(5);
    expect(new Set(pieces.map(p => p.form.kind)).size).toBeGreaterThanOrEqual(2);
    expect(pieces.filter(p => p.driver).length).toBeGreaterThanOrEqual(2);
    expect(panel.parameters?.length).toBeGreaterThan(0); expect(panel.parameterPoses?.length).toBeGreaterThanOrEqual(3);
    const parameter = panel.parameters![0], gate = panel.objects.find(o => /gate/i.test(o.label)), handle = panel.objects.find(o => /handle/i.test(o.label)); expect(gate).toBeDefined(); expect(handle).toBeDefined();
    const movingVertex = (object: typeof panel.objects[number], value: number) => {
      const piece = object.geometry!.find(p => p.driver)!;
      const vertex = mechanismMeshes({ ...object, geometry: [piece], parameterValues: { [parameter.id]: value } })[0].vertices[0];
      return vertex.map((v, i) => v + [object.position.x, object.position.y, object.position.z][i]);
    };
    const distance = (value: number) => Math.hypot(...movingVertex(gate!, value).map((n, i) => n - movingVertex(handle!, value)[i]));
    for (const value of [.25, .5, .75, 1]) expect(distance(value)).toBeCloseTo(distance(0), 8);
    const state = { ...first.state, selectedObjectId: gate!.id, spatial: { ...first.state.spatial!, renderer: 'anatomy' as const, parameters: { [parameter.id]: .6 } } };
    await service.save(principal, first.id, first.version, state);
    const { artifact: next } = await service.generate(principal, { action: 'generate', requestId: randomUUID(), artifactId: first.id, baseVersion: 1, state, selectedObjectId: gate!.id, question: 'Explain why the handle stays attached at my current opening. Keep all custom geometry, coupled drivers, parameter names and my slider setting unchanged. One concise contextual explanation.' });
    writeFileSync(`${run}/next-artifact.json`, JSON.stringify(next, null, 2));
    records.push({ phase: 'followup', calls: next.generation.calls, costUsd: next.generation.costUsd, elapsedMs: next.generation.elapsedMs }); write();
    const before = spatialScene(first.spec, state)!, after = spatialScene(next.spec, next.state)!;
    expect(after.parameters).toEqual(before.parameters);
    for (const object of before.objects) expect(after.objects.find(o => o.id === object.id)).toMatchObject({ geometry: object.geometry, parameterValues: object.parameterValues });
    await service.save(principal, next.id, next.version, next.state);
    expect((await service.read(principal, next.id, next.version)).active!.state).toEqual(next.state);
    expect((await service.read(principal, first.id, 1)).active!.spec).toEqual(first.spec);
    records.push({ phase: 'verified', exactReopen: true, sourcePreserved: JSON.stringify(next.source) === JSON.stringify(first.source), forms: [...new Set(pieces.map(p => p.form.kind))], pieces: pieces.length });
  } catch (error) { writeFileSync(`${run}/run-audit.json`, JSON.stringify((await explorationStore.read(principal))?.runs, null, 2)); records.push({ phase: 'failed', code: (error as { code?: string }).code ?? 'assertion-or-transport' }); throw error; }
  finally { observedFetch.mockRestore(); await service.remove(principal).catch(() => {}); records.push({ phase: 'final', consumed: await ledger(), cap: Number(process.env.META_APP_SPEND_CAP_USD) }); write(); }
}, 240000);
