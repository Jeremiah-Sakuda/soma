import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExplorationScene } from '../../src/components/exploration-scene';
import { checkExploration } from '../../src/lib/domain/exploration';
import { explorationExecution, initialExplorationState } from '../../src/lib/domain/exploration-view';
import recordedGraph from '../../src/lib/fixtures/recorded-graph.json';

it('names the retained graph by its current endpoints and restores authored titles on reset', () => {
  const spec = checkExploration(recordedGraph.spec).spec;
  const original = JSON.stringify(spec);
  const reset = initialExplorationState(spec);
  const changed = { ...reset, start: 'C', goal: 'E' };
  const execution = explorationExecution(spec, changed)!;
  expect(execution.path).toEqual(['C', 'E']);
  const html = renderToStaticMarkup(createElement(ExplorationScene, {
    spec, state: { ...changed, step: execution.steps.length - 1 }, onChange() {},
  }));

  expect(html).toContain('<h3>Current graph: start C, goal E</h3>');
  expect(html).toContain('aria-label="Current graph: start C, goal E"');
  expect(html).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Current graph: start C, goal E\./);
  expect(html).toContain('Route: C → E · total cost 5 · 1 edge');
  expect(html).toContain('<h3>Current node costs</h3>');
  expect(html).not.toContain('Lecture graph: start A, goal F');

  const restored = renderToStaticMarkup(createElement(ExplorationScene, {
    spec, state: reset, onChange() {},
  }));
  expect(restored).toContain('<h3>Lecture graph: start A, goal F</h3>');
  expect(restored).toMatch(/<svg[^>]*role="img"[^>]*aria-label="Lecture graph: start A, goal F\./);
  expect(restored).toContain('<h3>Settled distances</h3>');
  expect(JSON.stringify(spec)).toBe(original);
});
