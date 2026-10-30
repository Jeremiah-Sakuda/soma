import { describe, it, expect } from 'vitest';
import { runBfs, createExampleExploration } from '../../src/lib/domain/exploration';
import {
  searchChoreography,
  searchMotionFrame,
  weightedMotionFrame,
  beatProgress,
  easeMotion,
} from '../../src/lib/domain/exploration-motion';
import { createWeightedExample } from '../../src/lib/domain/exploration';
const source = createExampleExploration();
if (source.mode !== 'checked-bfs') throw Error('fixture');
const input = source.input;
describe('checked transition choreography', () => {
  it('dequeues the head and enqueues only newly discovered neighbors in checked order', () => {
    const execution = runBfs(input),
      plan = searchChoreography(execution, 1);
    expect(plan.before).toEqual(['s']);
    expect(plan.departing).toBe('s');
    expect(plan.arrivals.map((a) => a.id)).toEqual(['a', 'b']);
    expect(plan.arrivals[0].end).toBeLessThanOrEqual(plan.arrivals[1].start);
    for (const arrival of plan.arrivals) {
      const edge = input.edges.find((edge) => edge.id === arrival.edgeId)!;
      expect(edge.from).toBe('s');
      expect(edge.to).toBe(arrival.id);
    }
  });
  it('settles to every checked queue, preserves input and never invents a cycle arrival', () => {
    const execution = runBfs({ ...input, goal: null }),
      before = JSON.stringify(execution);
    for (const step of execution.steps) {
      const plan = searchChoreography(execution, step.index),
        end = searchMotionFrame(execution, step.index, 1);
      expect(end.queue).toEqual(step.queue);
      expect(plan.arrivals.map((a) => a.id)).toEqual(
        step.index === 0 ? [input.start] : step.discovered,
      );
      expect(new Set([...plan.retained, ...plan.arrivals.map((a) => a.id)]).size).toBe(
        step.queue.length,
      );
    }
    expect(JSON.stringify(execution)).toBe(before);
  });
  it('recomputes discovery order and paths for changed inputs, including reverse undirected edges', () => {
    const execution = runBfs({ ...input, neighborOrder: [...input.neighborOrder].reverse() });
    expect(searchChoreography(execution, 1).arrivals.map((a) => a.id)).toEqual(['b', 'a']);
    const back = runBfs({
      nodes: [
        { id: 'a', label: 'A' },
        { id: 'b', label: 'B' },
      ],
      edges: [{ id: 'e', from: 'a', to: 'b' }],
      start: 'b',
      goal: 'a',
      directed: false,
      neighborOrder: ['a', 'b'],
    });
    expect(searchChoreography(back, 1).arrivals[0]).toMatchObject({
      id: 'a',
      edgeId: 'e',
      from: 'b',
    });
    expect(searchChoreography(back, 1).path).toEqual([]);
    expect(searchChoreography(back, 2).path).toEqual(['b', 'a']);
  });
  it('handles start=goal and unreachable goals without invented discoveries or paths', () => {
    const same = runBfs({ ...input, goal: input.start });
    expect(searchChoreography(same, 1).arrivals).toEqual([]);
    expect(searchChoreography(same, 1).path).toEqual(['s']);
    const isolated = runBfs({ ...input, edges: [] });
    const end = searchMotionFrame(isolated, 1, 1);
    expect(end.queue).toEqual([]);
    expect(end.plan.path).toEqual([]);
    expect(end.caption).toBe('The queue is empty.');
  });
  it('has continuous bounded interpolation and distinct discovery then enqueue phases', () => {
    const execution = runBfs(input),
      arrival = searchChoreography(execution, 1).arrivals[0];
    expect(searchMotionFrame(execution, 1, (arrival.start + arrival.traceEnd) / 2).caption).toBe(
      'Discover A from S.',
    );
    expect(searchMotionFrame(execution, 1, (arrival.traceEnd + arrival.end) / 2).caption).toBe(
      'Add A to the back.',
    );
    expect(searchMotionFrame(execution, 1, arrival.end).queue).toEqual(['a']);
    for (let i = 0; i < 1000; i++)
      expect(Math.abs(easeMotion((i + 1) / 1000) - easeMotion(i / 1000))).toBeLessThan(0.002);
    expect(beatProgress(-2, 0.2, 0.8)).toBe(0);
    expect(beatProgress(2, 0.2, 0.8)).toBe(1);
  });
});

describe('weighted snapshot replay', () => {
  it('animates cheaper tentative costs for an already queued node and settles to the exact trace', () => {
    const spec = createWeightedExample({ observationId: 'synthetic', version: 1, region: null });
    if (spec.mode !== 'checked-dijkstra') throw Error();
    const execution = runBfs(spec.input),
      original = structuredClone(execution);
    const improved = execution.steps.find((step) => step.distances.g === 3)!;
    const before = weightedMotionFrame(execution, improved.index, 0),
      after = weightedMotionFrame(execution, improved.index, 1);
    expect(before.distances.g).toBe(10);
    expect(after.distances.g).toBe(3);
    expect(before.cues).toContainEqual(expect.objectContaining({ id: 'g', from: 'b' }));
    expect(improved.discovered).not.toContain('g');
    for (const step of execution.steps) {
      const end = weightedMotionFrame(execution, step.index, 1);
      expect(end.distances).toEqual(step.distances);
      expect(end.expanded).toEqual(step.expanded);
      expect(end.current).toBe(step.current);
      expect(end.path).toEqual(step.status === 'found' ? execution.path : null);
    }
    expect(weightedMotionFrame(execution, execution.steps.length - 1, 0.3).path).toBeNull();
    expect(execution).toEqual(original);
  });
  it('does not reveal a path for an unreachable goal or invent another node at start=goal', () => {
    const spec = createWeightedExample({ observationId: 'synthetic', version: 1, region: null });
    if (spec.mode !== 'checked-dijkstra') throw Error();
    const unreachable = runBfs({ ...spec.input, goal: 'x' }),
      same = runBfs({ ...spec.input, goal: 's' });
    expect(weightedMotionFrame(unreachable, 99, 1).path).toBeNull();
    expect(weightedMotionFrame(same, 99, 1).path).toEqual(['s']);
    expect(weightedMotionFrame(same, 99, 1).cues).toEqual([]);
  });
});
