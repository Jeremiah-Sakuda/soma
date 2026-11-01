import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService, needsExplorationReview, validateExplorationViewState } from '../../src/lib/server/exploration';
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
import { checkExploration } from '../../src/lib/domain/exploration';
import { defaultSpatialView, spatialRenderStyles } from '../../src/lib/domain/spatial-schema';
import { createMechanismExample } from '../../src/lib/domain/mechanism-example';
import { createSpatialExample } from '../../src/lib/domain/spatial-example';
import { spatialScene } from '../../src/lib/domain/spatial-exploration';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';

let directory: string;
const principal = (letter = 'a'): ExplorationPrincipal => ({ kind: 'guest', id: letter.repeat(64), workspaceId: letter.repeat(64), generation: letter.repeat(64), key: `guest-${letter.repeat(64)}` });
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'soma-spatial-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic'); vi.stubEnv('SOMA_EXPLORATION_DB_PATH', join(directory, 'explore.sqlite')); vi.stubEnv('VERCEL', '');
});
afterEach(() => { closeExplorationStore(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });

function harness(options: { foreignSource?: boolean; renamedObject?: boolean; invalid?: boolean; clarify?: boolean; view?: boolean; review?: boolean; droppedPart?: boolean; newSteps?: boolean; mechanism?: boolean } = {}) {
  const request = vi.fn(async (req: { instructions: string; input: { content: string }[] }) => {
    const context = JSON.parse(req.input[0].content);
    const spec = (options.mechanism ? createMechanismExample : createSpatialExample)({ observationId: options.foreignSource ? 'outside' : context.source.observationId, version: context.source.version, region: null });
    const binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(req.instructions)!;
    spec.id = binding[1]; spec.version = Number(binding[2]);
    if (spec.mode !== 'explanation' || spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    if (options.view) spec.scene.panels[0].viewAction = { camera: 'side', focusObjectId: 'processor', isolate: true, spread: 0.6, slice: null };
    if (!options.mechanism) spec.scene.panels[0].objects[2].renderStyle = 'sensor'; // Existing part identity includes its bounded styling.
    spec.scene.panels[0].objects[2].position.x = 5; // The service must preserve an existing world's geometry.
    if (options.renamedObject) spec.scene.panels[0].objects[2].label = 'Different meaning';
    if (options.invalid) spec.scene.panels[0].poses[0].objectId = 'foreign';
    if (options.newSteps) {
      for (const step of spec.steps) step.id = `revised_${step.id}`;
      for (const pose of spec.scene.panels[0].poses) pose.stepId = `revised_${pose.stepId}`;
      for (const pose of spec.scene.panels[0].parameterPoses ?? []) pose.stepId = `revised_${pose.stepId}`;
    }
    if (options.droppedPart) {
      spec.scene.panels[0].objects = spec.scene.panels[0].objects.filter((o) => o.id !== 'signal');
      spec.scene.panels[0].poses = spec.scene.panels[0].poses.filter((o) => o.objectId !== 'signal');
      for (const step of spec.steps) step.highlightIds = step.highlightIds.filter((id) => id !== 'signal');
    }
    const output = options.clarify ? { ...spec, mode: 'clarify', question: 'Which source region do you mean?' } as Record<string, unknown> : spec;
    if (options.clarify) { delete (output as Record<string, unknown>).scene; delete (output as Record<string, unknown>).steps; delete (output as Record<string, unknown>).followups; }
    let mechanism;
    if (options.mechanism && spec.mode === 'explanation' && spec.scene.panels[0].kind === 'spatial') {
      const p = spec.scene.panels[0];
      mechanism = { panelId: p.id, frame: { position: { x: 0, y: 0, z: 0 }, scale: 3 }, parts: p.objects.map(o => ({ objectId: o.id, pieces: o.geometry! })), parameters: p.parameters, parameterPoses: p.parameterPoses };
      for (const object of p.objects) delete object.geometry;
      delete p.parameters; delete p.parameterPoses;
    }
    return { status: 'completed', tools: [], structured: { spec: output, ...(mechanism ? { mechanism } : {}) }, usage: { input_tokens: 100, output_tokens: 200 } };
  });
  const review = vi.fn(async () => ({ status: 'completed' as const, tools: [], structured: { verdict: 'approve', findings: [] }, usage: { input_tokens: 50, output_tokens: 20 } }));
  const service = createExplorationService({ review, request: request as never, enabled: () => true, reviewEnabled: () => !!options.review, revalidate: async () => {}, reserve: async () => randomUUID(), settle: async () => {} });
  return { service, request, review };
}

it('persists complete spatial state, isolates accounts and rejects injected view data atomically', async () => {
  const { service, request } = harness(), owner = principal();
  await service.initialize(owner); await service.initialize(principal('b'));
  const { artifact } = await service.example(owner, false, true);
  expect(artifact.validation.assurance).toBe('explanation-only');
  expect(artifact.generation.calls).toBe(0);
  expect(needsExplorationReview(artifact.spec)).toBe(true);
  const state = { ...artifact.state, explanationStep: 2, selectedObjectId: 'processor', spatial: { ...defaultSpatialView(), renderer: 'anatomy' as const, azimuth: -90, elevation: 45, spread: 0.65, slice: 0.4, isolate: true } };
  await service.save(owner, artifact.id, 1, state);
  closeExplorationStore();
  expect((await service.read(owner, artifact.id, 1)).active!.state).toEqual(state);
  await expect(service.read(principal('b'), artifact.id)).rejects.toMatchObject({ code: 'not_found' });
  await expect(service.save(principal('b'), artifact.id, 1, state)).rejects.toMatchObject({ code: 'not_found' });
  for (const invalid of [{ ...state, selectedObjectId: 'outside' }, { ...state, spatial: { ...state.spatial, spread: 1.1 } }, { ...state, spatial: { ...state.spatial, renderer: 'unapproved' } }, { ...state, spatial: { ...state.spatial, script: 'run()' } }])
    await expect(service.save(owner, artifact.id, 1, invalid)).rejects.toMatchObject({ code: 'invalid_request' });
  expect((await service.read(owner, artifact.id, 1)).active!.state).toEqual(state);
  expect(request).not.toHaveBeenCalled();
});

it('preserves scene geometry, camera, selection and step across a real service revision and leaves the original untouched', async () => {
  const { service, request, review } = harness({ review: true }), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  const state = { ...artifact.state, explanationStep: 1, selectedObjectId: 'processor', spatial: { ...defaultSpatialView(), renderer: 'anatomy' as const, spread: 0.8, slice: 0.25, azimuth: 90 } };
  await service.save(owner, artifact.id, 1, state);
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state, question: 'Explain the processor using this 3D world.' });
  const reviewed = JSON.parse((review.mock.calls[0] as unknown as [{ input: { content: string }[] }])[0].input[0].content);
  expect(reviewed.checked.spatialPresentation.view).toEqual(state.spatial);
  expect(reviewed.spec.scene.panels[0].objects[2].position.x).toBe(0);
  expect(reviewed.spec.scene.panels[0].objects[2].renderStyle).toBe('chip');
  expect(next.state).toEqual(state);
  expect(next.source).toEqual(artifact.source);
  expect(next.version).toBe(2);
  if (next.spec.mode !== 'explanation' || next.spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
  expect(next.spec.scene.panels[0].objects[2].position.x).toBe(0);
  expect((await service.read(owner, artifact.id, 1)).active!.spec).toEqual(artifact.spec);
  expect(JSON.parse(request.mock.calls[0][0].input[0].content).previous.state.spatial).toEqual(state.spatial);
  await service.save(owner, next.id, 2, next.state); closeExplorationStore();
  expect((await service.read(owner, next.id, 2)).active!.state).toEqual(state);
});

it.each([{ foreignSource: true }, { renamedObject: true }, { invalid: true }, { droppedPart: true }])('rejects malformed or unbound spatial revisions %j while retaining original', async (options) => {
  const { service } = harness(options), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  await expect(service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state: artifact.state, question: 'Explain this in 3D.' })).rejects.toMatchObject({ code: 'generation_invalid' });
  expect((await service.read(owner, artifact.id)).versions).toHaveLength(1);
  expect((await service.read(owner, artifact.id)).active!.spec).toEqual(artifact.spec);
});

it('drops spatial presentation state on a clarification without inventing a world', async () => {
  const { service } = harness({ clarify: true }), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state: artifact.state, question: 'Explain the missing part.' });
  expect(next.spec.mode).toBe('clarify'); expect(next.state.spatial).toBeUndefined();
  expect(() => validateExplorationViewState(next.spec, { ...next.state, spatial: defaultSpatialView() })).toThrow();
});

it('can lift an existing explanatory diagram into spatial objects while retaining semantic IDs', async () => {
  const { service } = harness(), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  const spec = structuredClone(artifact.spec);
  if (spec.mode !== 'explanation' || spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
  const panel = spec.scene.panels[0];
  spec.scene.panels = [{ id: panel.id, kind: 'diagram', title: panel.title, placement: panel.placement, objects: [
    ...panel.objects.map((o, i) => ({ id: o.id, kind: 'block' as const, label: o.label, position: { x: (i + 1) / 6, y: 0.5 } })),
    ...panel.connections.map((edge) => ({ ...edge, kind: 'edge' as const })),
  ] }];
  const state = { ...artifact.state, spatial: undefined, selectedObjectId: 'processor' };
  // Original synthetic persisted 2D fixture; provider remains scripted for this contract test.
  await explorationStore.mutate(owner, (session) => { Object.assign(session.artifacts[0], checkExploration(spec), { state }); });
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state, question: 'Turn this same diagram into a 3D schematic, preserving its named parts.' });
  expect(next.spec.mode).toBe('explanation');
  expect(next.state.selectedObjectId).toBe('processor');
  expect(next.state.spatial?.mode).toBe('3d');
  expect((await service.read(owner, artifact.id, 1)).active!.spec).toEqual(spec);
});

it('preserves the inspected pose when a contextual explanation replaces the step IDs', async () => {
  const { service, review } = harness({ newSteps: true, review: true }), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  const state = { ...artifact.state, explanationStep: 2, selectedObjectId: 'signal', spatial: { ...defaultSpatialView(), spread: 0.6 } };
  const before = spatialScene(artifact.spec, state)!;
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state, question: 'Explain the signal in this current state using a fresh explanation.' });
  const after = spatialScene(next.spec, next.state)!;
  for (const part of before.objects) expect(after.objects.find((o) => o.id === part.id)).toMatchObject({ position: part.position, visible: part.visible });
  const reviewed = JSON.parse((review.mock.calls[0] as unknown as [{ input: { content: string }[] }])[0].input[0].content);
  expect(spatialScene(reviewed.spec, next.state)).toEqual(after);
  expect((await service.read(owner, artifact.id, 1)).active!.spec).toEqual(artifact.spec);
});


it('applies a bounded Muse view request once and preserves subsequent manual changes on reopen', async () => {
  const { service } = harness({ view: true }), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state: artifact.state, question: 'Show the processor from the side, isolate it and separate the parts.' });
  expect(next.state.spatial).toMatchObject({ azimuth: 90, elevation: 0, spread: 0.6, isolate: true });
  expect(next.state.selectedObjectId).toBe('processor');
  const manual = { ...next.state, spatial: { ...next.state.spatial!, azimuth: -45, spread: 0.2 } };
  await service.save(owner, next.id, 2, manual); closeExplorationStore();
  expect((await service.read(owner, next.id, 2)).active!.state).toEqual(manual);
});

it('retains every new component style through review, revision, persistence and reopening', async () => {
  const { service, request, review } = harness({ review: true }), owner = principal();
  await service.initialize(owner);
  const styles = spatialRenderStyles.slice(5);
  for (let batch = 0; batch < styles.length; batch += 5) {
    const { artifact } = await service.example(owner, false, true);
    const spec = structuredClone(artifact.spec);
    if (spec.mode !== 'explanation' || spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    for (const [index, part] of spec.scene.panels[0].objects.entries()) part.renderStyle = styles[(batch + index) % styles.length];
    await explorationStore.mutate(owner, (session) => {
      Object.assign(session.artifacts.find((a) => a.id === artifact.id)!, checkExploration(spec));
    });
    const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state: artifact.state, question: 'Keep each illustrative component and explain this selected world.' });
    if (next.spec.mode !== 'explanation' || next.spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    const expected = spec.scene.panels[0].objects.map((o) => o.renderStyle);
    expect(next.spec.scene.panels[0].objects.map((o) => o.renderStyle)).toEqual(expected);
    const reviewed = JSON.parse((review.mock.calls.at(-1) as unknown as [{ input: { content: string }[] }])[0].input[0].content);
    expect(reviewed.spec.scene.panels[0].objects.map((o: { renderStyle: string }) => o.renderStyle)).toEqual(expected);
    await service.save(owner, next.id, next.version, next.state); closeExplorationStore();
    expect((await service.read(owner, next.id, next.version)).active!.spec).toEqual(next.spec);
    expect((await service.read(owner, artifact.id, 1)).active!.spec).toEqual(spec);
    // The real request encoder/estimator also runs in this harness before the
    // scripted author. Leave headroom under its 8,000-character instructions cap.
    expect(request.mock.calls.at(-1)![0].instructions.length).toBeLessThan(11_800);
    for (const style of styles) expect(request.mock.calls.at(-1)![0].instructions).toContain(style);
  }
});


it('retains authored surfaces, coupled drivers and explanation defaults separately from manual controls through review and reopening', async () => {
  const { service, request, review } = harness({ mechanism: true, newSteps: true, review: true }), owner = principal();
  await service.initialize(owner); await service.initialize(principal('b'));
  const { artifact } = await service.example(owner, false, false, true);
  expect(artifact.generation.calls).toBe(0); expect(artifact.state.spatial?.renderer).toBe('anatomy');
  const state = { ...artifact.state, explanationStep: 1, selectedObjectId: 'gate', spatial: { ...artifact.state.spatial!, parameters: { opening: .6 } } };
  await service.save(owner, artifact.id, 1, state);
  for (const parameters of [{ foreign: .5 }, { opening: 1.1 }, { opening: -.1 }, { opening: 'run()' }])
    await expect(service.save(owner, artifact.id, 1, { ...state, spatial: { ...state.spatial, parameters } })).rejects.toMatchObject({ code: 'invalid_request' });
  await expect(service.read(principal('b'), artifact.id)).rejects.toMatchObject({ code: 'not_found' });
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state, question: 'Explain this gate while preserving my current opening and all custom geometry.' });
  const before = spatialScene(artifact.spec, state)!, after = spatialScene(next.spec, next.state)!;
  expect(after.parameters).toEqual(before.parameters);
  for (const object of before.objects) expect(after.objects.find(o => o.id === object.id)).toMatchObject({ geometry: object.geometry, parameterValues: object.parameterValues, position: object.position });
  const baseline = spatialScene(next.spec, { ...next.state, spatial: { ...next.state.spatial!, parameters: {} } })!;
  expect(baseline.parameters![0].value).toBe(.45); // Never bake the manual .6 into the explanation.
  const reviewed = JSON.parse((review.mock.calls[0] as unknown as [{ input: { content: string }[] }])[0].input[0].content);
  expect(reviewed.checked.spatialPresentation.view.parameters).toEqual({ opening: .6 });
  expect(spatialScene(reviewed.spec, next.state)).toEqual(after);
  expect(request.mock.calls[0][0].instructions.length).toBeLessThan(11_800);
  expect(request.mock.calls[0][0].instructions).toContain('lathe');
  expect(Buffer.byteLength((review.mock.calls[0] as unknown as [{ input: { content: string }[] }])[0].input[0].content)).toBeLessThan(20000);
  await service.save(owner, next.id, next.version, next.state); closeExplorationStore();
  expect((await service.read(owner, next.id, next.version)).active!.state).toEqual(next.state);
  expect((await service.read(owner, artifact.id, 1)).active!.spec).toEqual(artifact.spec);
});

it('replays the actual Muse mechanism honestly without inference and rebinds ownership before saving', async () => {
  const { service, request, review } = harness(), owner = principal(); await service.initialize(owner); await service.initialize(principal('b'));
  const { artifact } = await service.recording(owner, true);
  expect(artifact.recording).toMatchObject({ id: 'mechanism-2026-10-30', sourceImage: '/synthetic/recorded-mechanism.png' });
  expect(artifact.generation.mode).toBe('live'); expect(artifact.generation.calls).toBe(5); // Original run, not replay billing.
  expect(artifact.generation.audit.some(e => e.event === 'review-rejected' && e.detail.includes('gateLeaf'))).toBe(true);
  expect(artifact.source.observationId).toBe(artifact.spec.sources[0].observationId);
  expect(spatialScene(artifact.spec, artifact.state)!.parameters).toHaveLength(1);
  await service.save(owner, artifact.id, 1, artifact.state); closeExplorationStore();
  expect((await service.read(owner, artifact.id, 1)).active!.spec).toEqual(artifact.spec);
  await expect(service.read(principal('b'), artifact.id)).rejects.toMatchObject({ code: 'not_found' });
  expect(request).not.toHaveBeenCalled(); expect(review).not.toHaveBeenCalled();
});
