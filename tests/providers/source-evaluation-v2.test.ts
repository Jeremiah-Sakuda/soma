import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { solveDc, type DcInput } from '../../src/lib/domain/dc-circuit';
import type { BfsInput } from '../../src/lib/domain/graph-search';
import { scoreCircuit, scoreGraph, type Case } from './source-evaluation-v2-score';

// The answer key must be self-consistent and the scorer must accept a faithful reading and reject
// a wrong one, before any provider call is spent on the frozen set.
const cases = JSON.parse(
  readFileSync('tests/fixtures/source-evaluation-v2/cases.json', 'utf8'),
) as Case[];
const sub = (label: string) => label.replace(/\d/g, (d) => String.fromCharCode(0x2080 + Number(d)));

function faithfulCircuit(c: Extract<Case, { subject: 'circuit' }>): DcInput {
  if (c.expected.outcome !== 'checked-circuit') throw new Error('declined case');
  return {
    nodes: c.expected.nodes.map((n) => ({ id: `n_${n}`, label: n })),
    ground: `n_${c.expected.ground}`,
    components: c.expected.components.map((p, i) => ({
      id: `p${i}`,
      label: p.label ? sub(p.label) : `${p.value} V`,
      kind: p.kind,
      // Resistors may be read in either orientation.
      from: `n_${p.ends ? p.ends[1] : p.from}`,
      to: `n_${p.ends ? p.ends[0] : p.to}`,
      value: p.value,
    })),
  };
}
function faithfulGraph(c: Extract<Case, { subject: 'graph' }>): BfsInput {
  const e = c.expected;
  return {
    nodes: e.nodes.map((n) => ({ id: `n_${n}`, label: n })),
    edges: e.edges.map(([a, b, w], i) => ({
      id: `e${i}`,
      from: `n_${a}`,
      to: `n_${b}`,
      ...(w !== undefined ? { weight: w } : {}),
    })),
    ...(e.algorithm === 'dijkstra' ? { algorithm: 'dijkstra' as const } : {}),
    directed: e.directed,
    start: `n_${e.start}`,
    goal: `n_${e.goal}`,
    neighborOrder: e.nodes.map((n) => `n_${n}`),
  };
}

describe('second fresh source evaluation key', () => {
  it('covers six solvable circuits, one declined circuit and five larger graphs', () => {
    expect(
      cases.filter((c) => c.subject === 'circuit' && c.expected.outcome === 'checked-circuit'),
    ).toHaveLength(6);
    expect(
      cases.filter((c) => c.subject === 'circuit' && c.expected.outcome === 'declined'),
    ).toHaveLength(1);
    const graphs = cases.filter((c) => c.subject === 'graph');
    expect(graphs.map((g) => g.subject === 'graph' && g.expected.nodes.length)).toEqual([
      8, 7, 10, 9, 12,
    ]);
  });

  for (const c of cases) {
    if (c.subject === 'circuit' && c.expected.outcome === 'checked-circuit') {
      it(`${c.id}: the key solves, a faithful reading passes and wrong readings fail`, () => {
        const read = faithfulCircuit(c);
        expect(solveDc(read).status).toBe('solved');
        expect(scoreCircuit(c, { mode: 'checked-circuit', input: read })).toMatchObject({
          passed: true,
          mismatches: [],
        });
        const source = read.components.findIndex((p) => p.kind !== 'resistor');
        const flipped = structuredClone(read);
        [flipped.components[source].from, flipped.components[source].to] = [
          flipped.components[source].to,
          flipped.components[source].from,
        ];
        expect(scoreCircuit(c, { mode: 'checked-circuit', input: flipped }).passed).toBe(false);
        const misread = structuredClone(read);
        misread.components[read.components.length - 1].value *= 10;
        expect(scoreCircuit(c, { mode: 'checked-circuit', input: misread }).passed).toBe(false);
        expect(scoreCircuit(c, { mode: 'explanation' }).passed).toBe(false);
      });
    }
    if (c.subject === 'circuit' && c.expected.outcome === 'declined') {
      it(`${c.id}: only a non-circuit answer passes`, () => {
        expect(scoreCircuit(c, { mode: 'explanation' }).passed).toBe(true);
        expect(scoreCircuit(c, { mode: 'clarify' }).passed).toBe(true);
        expect(scoreCircuit(c, { mode: 'checked-circuit', input: {} }).passed).toBe(false);
      });
    }
  }

  it('the two-source key gives V_B = 48/9 V', () => {
    const c = cases.find((x) => x.id === 'circuit-two-sources') as Extract<
      Case,
      { subject: 'circuit' }
    >;
    expect(solveDc(faithfulCircuit(c)).exact.voltages.n_B).toBe('16/3');
  });

  it('the ground-on-plus key puts A at −15 V', () => {
    const c = cases.find((x) => x.id === 'circuit-ground-on-plus') as Extract<
      Case,
      { subject: 'circuit' }
    >;
    expect(solveDc(faithfulCircuit(c)).voltages.n_A).toBe(-15);
  });

  const costs: Record<string, number> = {
    'graph-undirected-8': 18,
    'graph-directed-7': 15,
    'graph-decimal-10': 12,
    'graph-bfs-9': 3,
    'graph-undirected-12': 16,
  };
  for (const c of cases) {
    if (c.subject !== 'graph') continue;
    it(`${c.id}: hand-checked goal cost ${costs[c.id]}; a faithful reading passes and a wrong one fails`, () => {
      const read = faithfulGraph(c);
      expect(
        scoreGraph(c, {
          mode: c.expected.algorithm === 'bfs' ? 'checked-bfs' : 'checked-dijkstra',
          input: read,
        }),
      ).toMatchObject({
        passed: true,
        costMatches: true,
        wantCost: costs[c.id],
        mismatches: [],
      });
      const wrong = structuredClone(read);
      wrong.edges.pop();
      expect(
        scoreGraph(c, {
          mode: c.expected.algorithm === 'bfs' ? 'checked-bfs' : 'checked-dijkstra',
          input: wrong,
        }).passed,
      ).toBe(false);
    });
  }
});
