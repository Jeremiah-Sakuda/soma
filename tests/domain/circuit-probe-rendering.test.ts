import { expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExplorationCircuitProbe } from '../../src/components/exploration-circuit-probe';
import { probeDcValue, solveDc, type DcInput } from '../../src/lib/domain/dc-circuit';

const input: DcInput = {
  nodes: ['G', 'A'].map((id) => ({ id, label: id })),
  ground: 'G',
  components: [
    { id: 'V1', label: 'V1', kind: 'voltage-source', from: 'G', to: 'A', value: 0.1 },
    { id: 'R1', label: 'R1', kind: 'resistor', from: 'A', to: 'G', value: 1e9 },
  ],
};

it('distinguishes exact zero from small positive and negative currents in the rendered probe', () => {
  const probe = probeDcValue(input, undefined, 'V1', { kind: 'current', componentId: 'R1' }, 'zero');
  expect(solveDc(input).exact.currents.R1).toBe('1/10000000000');
  const status = (value: number) => renderToStaticMarkup(createElement(ExplorationCircuitProbe, {
    probe, input, state: { open: [], shorted: [], values: {} }, value, disabled: false, onChange() {},
  })).match(/<p role="status">(.*?)<\/p>/)?.[1];
  expect(status(0.1)).toContain('1e−10 A, from A to G');
  expect(status(-0.1)).toContain('1e−10 A, from G to A');
  expect(status(0)).toContain('exactly 0 A');
});

it('does not reuse a saved boundary when changed values exceed the checked numeric range', () => {
  const probe = probeDcValue(input, undefined, 'V1', { kind: 'power', componentId: 'R1' }, 'zero');
  const html = renderToStaticMarkup(createElement(ExplorationCircuitProbe, {
    probe, input, state: { open: [], shorted: [], values: { R1: 1e-310 } }, value: 0.1, disabled: false, onChange() {},
  }));
  expect(html).toContain('cannot be checked at the current component values');
  expect(html).not.toContain('Verified:');
});
