import { expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SourceOverlay } from '../../src/components/source-overlay';
import { circuitOverlayModel } from '../../src/lib/domain/circuit-overlay-model';
import { solveDc } from '../../src/lib/domain/dc-circuit';
import { heroCircuit, heroCircuitLayout } from '../fixtures/hero-circuit';

// Represent the image's completed onLoad state without a browser, screen reader, or audio.
vi.mock('react', async (original) => ({
  ...await original<typeof import('react')>(),
  useState: () => [0.5625, () => {}],
}));

function render(family?: 'graph' | 'circuit', open: string[] = []) {
  const solution = solveDc(heroCircuit, { open });
  return renderToStaticMarkup(createElement(SourceOverlay, {
    image: 'data:image/png;base64,AAAA', family,
    build: (aspect: number) => circuitOverlayModel({ layout: heroCircuitLayout, solution, index: 99, caption: null, stepLabel: 'Final step', aspect }),
    canToggle: false, selected: null, stepLabel: 'Final step', onToggleEdge() {}, onSelect() {},
  }));
}

it('names a circuit overlay and its revealed/floating voltages without graph-search terminology', () => {
  const html = render('circuit');
  expect(html).toContain('checked circuit drawn over it');
  expect(html).toContain('aria-label="Checked circuit over your source. Final step"');
  expect(html).toContain('aria-label="A: voltage shown"');
  expect(html).not.toMatch(/aria-label="[^"]*(?:search|settled|distance)/);
  expect(render('circuit', ['R1', 'R2', 'R5'])).toContain('aria-label="B: voltage undefined relative to ground"');
});

it('retains graph-search accessible wording by default', () => {
  const html = render();
  expect(html).toContain('checked search drawn over it');
  expect(html).toContain('aria-label="Checked search over your source. Final step"');
  expect(html).toContain('aria-label="A: settled"');
});
