import { describe, expect, it } from 'vitest';
import { routeSequence } from '../../src/lib/domain/source-overlay-model';

const edge = (id: string, fromId: string, toId: string, tone = 'path') =>
  ({ id, fromId, toId, tone }) as never;
describe('routeSequence', () => {
  it('walks the route from the start, each connection in its direction of travel', () => {
    const order = routeSequence({
      lift: { source: 'a' } as never,
      edges: [
        edge('bd', 'b', 'd'),
        edge('ac', 'a', 'c'),
        edge('df', 'f', 'd'),
        edge('cb', 'c', 'b'),
        edge('af', 'a', 'f', 'tree'),
      ],
    });
    expect([...order.entries()]).toEqual([
      ['ac', { index: 0, reverse: false }],
      ['cb', { index: 1, reverse: false }],
      ['bd', { index: 2, reverse: false }],
      ['df', { index: 3, reverse: true }],
    ]);
  });
  it('falls back to drawing at once when the route does not connect to the start', () => {
    expect(
      routeSequence({ lift: { source: 'x' } as never, edges: [edge('ac', 'a', 'c')] }).size,
    ).toBe(0);
    expect(routeSequence({ edges: [edge('ac', 'a', 'c')] }).size).toBe(0);
  });
});
