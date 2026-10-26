import { describe, expect, it } from 'vitest';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { collectedPreparationScopes } from '../../src/lib/server/connectors/preparation';

it('partitions a semester of collected sources into bounded jobs without losing observations or mixing courses', () => {
  const workspace = seedWorkspace('semester'); workspace.sources = [];
  for (let index = 0; index < 65; index++) workspace.sources.push({
    id: `source-${String(index).padStart(3, '0')}`, courseId: index < 61 ? 'probability' : 'circuits', title: 'Original synthetic source', body: 'Original synthetic notes', version: 1,
    origin: 'live', kind: 'email', retrievedAt: workspace.createdAt, status: 'current',
    provenance: { origin: 'live-google', sourceKey: `gmail:google-gmail:message-${index}`, contentHash: String(index), importedAt: workspace.createdAt },
  });
  const before = structuredClone(workspace);
  const scopes = collectedPreparationScopes(workspace, 'gmail:google-gmail:');
  expect(scopes.map(scope => [scope.courseId, scope.sources.length])).toEqual([['probability', 20], ['probability', 20], ['probability', 20], ['probability', 1], ['circuits', 4]]);
  expect(new Set(scopes.flatMap(scope => scope.sources.map(source => source.id))).size).toBe(65);
  expect(workspace).toEqual(before);
  expect(collectedPreparationScopes({ ...workspace, sources: [...workspace.sources].reverse() }, 'gmail:google-gmail:').find(scope => scope.courseId === 'probability')?.sources.map(source => source.id)).toEqual(scopes[0].sources.map(source => source.id));
  expect(collectedPreparationScopes({ ...workspace, sources: workspace.sources.map(source => ({ ...source, status: 'stale' })) }, 'gmail:google-gmail:')).toEqual([]);
  expect(collectedPreparationScopes(workspace, 'blackboard:browser-blackboard:')).toEqual([]);
});
