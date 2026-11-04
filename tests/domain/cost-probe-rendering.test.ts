import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExplorationCostProbe } from '../../src/components/exploration-cost-probe';
import { probeEdgeCost } from '../../src/lib/domain/cost-probe';
import type { BfsInput } from '../../src/lib/domain/graph-search';

it('shows the actual nonzero intervention and tie value for a small checked cost', () => {
  const input: BfsInput = {
    algorithm: 'dijkstra', directed: true, start: 'a', goal: 'c',
    nodes: ['a', 'b', 'c'].map(id => ({ id, label: id.toUpperCase() })),
    neighborOrder: ['a', 'b', 'c'],
    edges: [
      { id: 'ab', from: 'a', to: 'b', weight: 0 },
      { id: 'bc', from: 'b', to: 'c', weight: 2e-7 },
      { id: 'ac', from: 'a', to: 'c', weight: 4e-7 },
    ],
  };
  const html = renderToStaticMarkup(createElement(ExplorationCostProbe, {
    probe: probeEdgeCost(input, 'bc'), input, value: 2e-7, disabled: false, onChange() {},
  }));
  expect(html).toContain('Connection cost: <strong>2e-7</strong>');
  expect(html).toContain('Try the tie at 4e-7</button>');
  expect(html).toContain('BFS route cost: <strong>4e-7</strong>');
  expect(html).toContain('Dijkstra route cost: <strong>2e-7</strong>');
});
