import { expect, it } from 'vitest';
import { z } from 'zod';
import { bindMechanismAuthoring, mechanismAuthoringSchema, spatialAuthorPanelSchema } from '../../src/lib/server/mechanism-authoring';
import { explanationAuthorSceneSchema, providerSchema } from '../../src/lib/server/exploration';
import { explorationSpecSchema, checkExploration } from '../../src/lib/domain/exploration';
import { createMechanismExample } from '../../src/lib/domain/mechanism-example';

/** Count expanded object/array levels, resolving local references as the provider does. */
function schemaDepth(value: unknown, root = value, depth = 0): number {
  if (!value || typeof value !== 'object') return depth;
  const n = value as Record<string, unknown>;
  if (typeof n.$ref === 'string') return schemaDepth(n.$ref.slice(2).split('/').reduce<unknown>((v, key) => (v as Record<string, unknown>)[key.replaceAll('~1', '/').replaceAll('~0', '~')], root), root, depth);
  const next = depth + (n.type === 'object' || n.type === 'array' ? 1 : 0);
  return Math.max(next, ...Object.values(n.properties ?? {}).map(v => schemaDepth(v, root, next)), schemaDepth(n.items, root, next), ...(n.anyOf as unknown[] ?? []).map(v => schemaDepth(v, root, depth)));
}

it('keeps the full Muse mechanism response contract within the documented ten-level provider limit', () => {
  const spec = explorationSpecSchema.options[1].extend({ scene: explanationAuthorSceneSchema });
  const wire = providerSchema(z.toJSONSchema(z.strictObject({ spec, mechanism: mechanismAuthoringSchema.nullable() }), { target: 'draft-7', io: 'input' }));
  expect(schemaDepth(wire)).toBeLessThanOrEqual(10);
  expect(spatialAuthorPanelSchema.shape.objects.element.shape).not.toHaveProperty('geometry');
  expect(spatialAuthorPanelSchema.shape).not.toHaveProperty('parameters');
});

it('assembles the shallow wire representation losslessly before full domain validation', () => {
  const expected = createMechanismExample(), spec = structuredClone(expected);
  if (spec.mode !== 'explanation' || spec.scene.panels[0].kind !== 'spatial') throw new Error('fixture');
  const panel = spec.scene.panels[0], wire = mechanismAuthoringSchema.parse({ panelId: panel.id, frame: { position: { x: 0, y: 0, z: 0 }, scale: 3 }, parts: panel.objects.map(o => ({ objectId: o.id, pieces: o.geometry })), parameters: panel.parameters, parameterPoses: panel.parameterPoses });
  for (const object of panel.objects) delete object.geometry;
  delete panel.parameters; delete panel.parameterPoses;
  bindMechanismAuthoring(spec, wire);
  expect(checkExploration(spec).spec).toEqual(expected);
  expect(() => bindMechanismAuthoring(spec, { ...wire, panelId: 'foreign' })).toThrow(/local spatial/);
  expect(() => bindMechanismAuthoring(spec, { ...wire, parts: [...wire.parts, wire.parts[0]] })).toThrow(/unique local/);
  expect(() => bindMechanismAuthoring(spec, { ...wire, parts: [{ ...wire.parts[0], objectId: 'foreign' }] })).toThrow(/unique local/);
});
