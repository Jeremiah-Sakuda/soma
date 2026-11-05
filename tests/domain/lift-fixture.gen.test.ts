// Writes the hero overlay models used by the desktop 3D lift harness. Run on demand.
import { writeFileSync } from 'node:fs';
import { test } from 'vitest';
import { runDijkstra } from '../../src/lib/domain/graph-search';
import { sourceOverlayModel } from '../../src/lib/domain/source-overlay-model';
const layout = {
  nodes: [
    { nodeId: 'A', x: 0.1070625, y: 0.5440555555555555 },
    { nodeId: 'B', x: 0.226525, y: 0.41436111111111107 },
    { nodeId: 'C', x: 0.226525, y: 0.7017222222222221 },
    { nodeId: 'D', x: 0.4145125, y: 0.41436111111111107 },
    { nodeId: 'E', x: 0.4145125, y: 0.7017222222222221 },
    { nodeId: 'F', x: 0.533825, y: 0.5440555555555555 },
  ],
  edgeLabels: [
    { edgeId: 'AB', x: 0.16745, y: 0.42444444444444446 },
    { edgeId: 'AC', x: 0.16745, y: 0.5808444444444444 },
    { edgeId: 'AF', x: 0.3213, y: 0.27739444444444444 },
    { edgeId: 'BD', x: 0.3315, y: 0.34794444444444445 },
    { edgeId: 'BC', x: 0.24905, y: 0.5077444444444444 },
    { edgeId: 'CE', x: 0.3315, y: 0.7032444444444444 },
    { edgeId: 'DF', x: 0.49215, y: 0.41339444444444445 },
    { edgeId: 'DE', x: 0.4488, y: 0.5068944444444444 },
    { edgeId: 'EF', x: 0.50405, y: 0.5740444444444444 },
  ],
};
const graph = {
  nodes: [
    { id: 'A', label: 'A' },
    { id: 'B', label: 'B' },
    { id: 'C', label: 'C' },
    { id: 'D', label: 'D' },
    { id: 'E', label: 'E' },
    { id: 'F', label: 'F' },
  ],
  edges: [
    { id: 'AB', from: 'A', to: 'B', weight: 4 },
    { id: 'AC', from: 'A', to: 'C', weight: 1 },
    { id: 'AF', from: 'A', to: 'F', weight: 11 },
    { id: 'BD', from: 'B', to: 'D', weight: 1 },
    { id: 'BC', from: 'B', to: 'C', weight: 2 },
    { id: 'CE', from: 'C', to: 'E', weight: 5 },
    { id: 'DF', from: 'D', to: 'F', weight: 3 },
    { id: 'DE', from: 'D', to: 'E', weight: 3 },
    { id: 'EF', from: 'E', to: 'F', weight: 3 },
  ],
  directed: false,
  start: 'A',
  goal: 'F',
  neighborOrder: ['A', 'B', 'C', 'D', 'E', 'F'],
  algorithm: 'dijkstra',
};
test.skipIf(!process.env.SOMA_WRITE_LIFT_FIXTURE)('write lift fixture', () => {
  const { algorithm: _a, ...input } = graph as typeof graph & { algorithm?: string };
  const execution = runDijkstra(input);
  const models = execution.steps.map((_, index) =>
    sourceOverlayModel({
      layout,
      graph: input as never,
      execution,
      index,
      disabledEdgeIds: [],
      caption: `Step ${index + 1}`,
      stepLabel: `Round ${index + 1} of ${execution.steps.length}`,
      aspect: 9 / 16,
    }),
  );
  const cutInput = { ...input, edges: input.edges.filter((e) => e.id !== 'DF') };
  const cutExecution = runDijkstra(cutInput);
  const cut = sourceOverlayModel({
    layout,
    graph: input as never,
    execution: cutExecution,
    index: cutExecution.steps.length - 1,
    disabledEdgeIds: ['DF'],
    caption: 'You cut D–F. Checked route: A → C → E → F, cost 9.',
    stepLabel: 'Your experiment',
    aspect: 9 / 16,
  });
  writeFileSync(process.env.SOMA_WRITE_LIFT_FIXTURE!, JSON.stringify({ models, cut }));
});
