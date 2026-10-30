import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExplorationService, needsExplorationReview, validateExplorationViewState } from '../../src/lib/server/exploration';
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
import { checkExploration } from '../../src/lib/domain/exploration';
import { visionRequestUpperBoundUsd } from '../../src/lib/server/meta-vision';
import { defaultSpatialView } from '../../src/lib/domain/spatial-schema';
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

function harness(options: { foreignSource?: boolean; renamedObject?: boolean; invalid?: boolean; clarify?: boolean; view?: boolean; review?: boolean; droppedPart?: boolean; newSteps?: boolean } = {}) {
  const request = vi.fn(async (req: { instructions: string; input: { content: string }[] }) => {
    const context = JSON.parse(req.input[0].content);
    const spec = createSpatialExample({ observationId: options.foreignSource ? 'outside' : context.source.observationId, version: context.source.version, region: null });
    const binding = /Required spec id=([^ ]+) and version=(\d+)/.exec(req.instructions)!;
    spec.id = binding[1]; spec.version = Number(binding[2]);
    if (spec.mode !== 'explanation' || spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
    if (options.view) spec.scene.panels[0].viewAction = { camera: 'side', focusObjectId: 'processor', isolate: true, spread: 0.6, slice: null };
    spec.scene.panels[0].objects[2].position.x = 5; // The service must preserve an existing world's geometry.
    if (options.renamedObject) spec.scene.panels[0].objects[2].label = 'Different meaning';
    if (options.invalid) spec.scene.panels[0].poses[0].objectId = 'foreign';
    if (options.newSteps) {
      for (const step of spec.steps) step.id = `revised_${step.id}`;
      for (const pose of spec.scene.panels[0].poses) pose.stepId = `revised_${pose.stepId}`;
    }
    if (options.droppedPart) {
      spec.scene.panels[0].objects = spec.scene.panels[0].objects.filter((o) => o.id !== 'signal');
      spec.scene.panels[0].poses = spec.scene.panels[0].poses.filter((o) => o.objectId !== 'signal');
      for (const step of spec.steps) step.highlightIds = step.highlightIds.filter((id) => id !== 'signal');
    }
    const output = options.clarify ? { ...spec, mode: 'clarify', question: 'Which source region do you mean?' } as Record<string, unknown> : spec;
    if (options.clarify) { delete (output as Record<string, unknown>).scene; delete (output as Record<string, unknown>).steps; delete (output as Record<string, unknown>).followups; }
    return { status: 'completed', tools: [], structured: { spec: output }, usage: { input_tokens: 100, output_tokens: 200 } };
  });
  const review = vi.fn(async () => ({ status: 'completed' as const, tools: [], structured: { verdict: 'approve', findings: [] }, usage: { input_tokens: 50, output_tokens: 20 } }));
  const service = createExplorationService({ review, request: request as never, enabled: () => true, reviewEnabled: () => !!options.review, revalidate: async () => {}, reserve: async () => randomUUID(), settle: async () => {}, upperBound: visionRequestUpperBoundUsd });
  return { service, request, review };
}

it('persists complete spatial state, isolates accounts and rejects injected view data atomically', async () => {
  const { service, request } = harness(), owner = principal();
  await service.initialize(owner); await service.initialize(principal('b'));
  const { artifact } = await service.example(owner, false, true);
  expect(artifact.validation.assurance).toBe('explanation-only');
  expect(artifact.generation.calls).toBe(0);
  expect(needsExplorationReview(artifact.spec)).toBe(true);
  const state = { ...artifact.state, explanationStep: 2, selectedObjectId: 'processor', spatial: { ...defaultSpatialView(), azimuth: -90, elevation: 45, spread: 0.65, slice: 0.4, isolate: true } };
  await service.save(owner, artifact.id, 1, state);
  closeExplorationStore();
  expect((await service.read(owner, artifact.id, 1)).active!.state).toEqual(state);
  await expect(service.read(principal('b'), artifact.id)).rejects.toMatchObject({ code: 'not_found' });
  await expect(service.save(principal('b'), artifact.id, 1, state)).rejects.toMatchObject({ code: 'not_found' });
  for (const invalid of [{ ...state, selectedObjectId: 'outside' }, { ...state, spatial: { ...state.spatial, spread: 1.1 } }, { ...state, spatial: { ...state.spatial, script: 'run()' } }])
    await expect(service.save(owner, artifact.id, 1, invalid)).rejects.toMatchObject({ code: 'invalid_request' });
  expect((await service.read(owner, artifact.id, 1)).active!.state).toEqual(state);
  expect(request).not.toHaveBeenCalled();
});

it('preserves scene geometry, camera, selection and step across a real service revision and leaves the original untouched', async () => {
  const { service, request, review } = harness({ review: true }), owner = principal(); await service.initialize(owner);
  const { artifact } = await service.example(owner, false, true);
  const state = { ...artifact.state, explanationStep: 1, selectedObjectId: 'processor', spatial: { ...defaultSpatialView(), spread: 0.8, slice: 0.25, azimuth: 90 } };
  await service.save(owner, artifact.id, 1, state);
  const { artifact: next } = await service.generate(owner, { action: 'generate', requestId: randomUUID(), artifactId: artifact.id, baseVersion: 1, state, question: 'Explain the processor using this 3D world.' });
  const reviewed = JSON.parse((review.mock.calls[0] as unknown as [{ input: { content: string }[] }])[0].input[0].content);
  expect(reviewed.checked.spatialPresentation.view).toEqual(state.spatial);
  expect(reviewed.spec.scene.panels[0].objects[2].position.x).toBe(0);
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
