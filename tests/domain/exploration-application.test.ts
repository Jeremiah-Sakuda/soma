import { describe, expect, it } from 'vitest';
import {
  createExampleExploration,
  createWeightedExample,
  type BfsInput,
} from '../../src/lib/domain/exploration';
import {
  freshApplicationQuestion,
  applicationExploration,
  publicApplication,
  type ExplorationApplication,
} from '../../src/lib/domain/exploration-application';

// Independent all-pairs relaxation, deliberately not the search implementation.
function reference(input: BfsInput) {
  const d = new Map(input.nodes.map((n) => [n.id, n.id === input.start ? 0 : Infinity]));
  for (let pass = 0; pass < input.nodes.length - 1; pass++)
    for (const e of input.edges) {
      const cost = input.algorithm === 'dijkstra' ? e.weight! : 1;
      d.set(e.to, Math.min(d.get(e.to)!, d.get(e.from)! + cost));
      if (!input.directed) d.set(e.from, Math.min(d.get(e.from)!, d.get(e.to)! + cost));
    }
  return d.get(input.goal!)!;
}
const ref = { observationId: 'original-source', version: 1, region: null };
describe('fresh application variations and hidden solutions', () => {
  it('checks diverse weighted and unweighted directed/undirected variations against independent shortest distances', () => {
    for (const weighted of [false, true])
      for (const directed of [false, true]) {
        const spec = weighted ? createWeightedExample(ref) : createExampleExploration(ref);
        if (spec.mode !== 'checked-bfs' && spec.mode !== 'checked-dijkstra') throw Error();
        spec.input.directed = directed;
        const distinct = new Set();
        for (let i = 0; i < 75; i++) {
          const q = freshApplicationQuestion(spec, `unseen-seed-${i}`)!;
          expect(q.expected).toBe(reference(q.input));
          expect(q.input.directed).toBe(directed);
          expect(q.input.algorithm).toBe(weighted ? 'dijkstra' : 'bfs');
          expect(q.path[0]).toBe(q.input.start);
          expect(q.path.at(-1)).toBe(q.input.goal);
          expect(q.input).not.toEqual(spec.input);
          distinct.add(JSON.stringify(q.input));
        }
        expect(distinct.size).toBeGreaterThan(25);
      }
  });
  it('keeps expected value/path out of the public unanswered record and builds a valid post-attempt scene', () => {
    for (const weighted of [false, true]) {
      const q = freshApplicationQuestion(
        weighted ? createWeightedExample(ref) : createExampleExploration(ref),
        'new',
      )!;
      const record = {
        ...q,
        id: '18fbefc9-e1f6-42db-b099-3a51b9a3f975',
        answer: null,
        revealedAt: null,
      } as ExplorationApplication;
      const hidden = publicApplication(record);
      expect(hidden).not.toHaveProperty('expected');
      expect(hidden).not.toHaveProperty('path');
      expect(hidden).not.toHaveProperty('solution');
      const revealed = publicApplication({ ...record, revealedAt: '2026-10-30T12:00:00.000Z' });
      expect(revealed.solution?.value).toBe(reference(q.input));
      const scene = applicationExploration(record, ref);
      expect(scene.mode).toBe(weighted ? 'checked-dijkstra' : 'checked-bfs');
    }
  });
  it('does not offer checked practice for explanation-only material', () => {
    expect(freshApplicationQuestion({ mode: 'explanation' } as never, 'test')).toBeNull();
  });
});
