import type { BfsExecution } from './graph-search';

export const clampProgress = (value: number) =>
  Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
export const beatProgress = (value: number, start: number, end: number) =>
  clampProgress((value - start) / (end - start));
export const easeMotion = (value: number) => {
  const p = clampProgress(value);
  return p * p * (3 - 2 * p);
};

/** A replay of one checked transition, never a second search implementation.
 * Only newly discovered nodes get an enqueue/edge cue; cycles cannot fabricate
 * an arrival. Goal paths are revealed only at the actual terminal snapshot. */
export function searchChoreography(execution: BfsExecution, index: number) {
  const step = execution.steps[Math.max(0, Math.min(index, execution.steps.length - 1))];
  const previous = execution.steps[Math.max(0, step.index - 1)];
  const before = step.index === 0 ? [] : previous.queue;
  const departing = step.index === 0 ? null : step.current;
  const retained = before.filter((id) => id !== departing);
  const added = step.index === 0 ? [execution.input.start] : step.discovered;
  const arrivals = added.map((id, i) => {
    const start = step.index === 0 ? 0.1 : 0.32 + i * (0.6 / Math.max(added.length, 1));
    const end = step.index === 0 ? 0.85 : 0.32 + (i + 1) * (0.6 / Math.max(added.length, 1));
    const edge = departing
      ? execution.input.edges.find(
          (edge) =>
            (edge.from === departing && edge.to === id) ||
            (!execution.input.directed && edge.to === departing && edge.from === id),
        )
      : null;
    return {
      id,
      edgeId: edge?.id ?? null,
      from: departing,
      start,
      traceEnd: start + (end - start) * 0.45,
      end,
      slot: retained.length + i,
    };
  });
  return {
    step,
    before,
    retained,
    departing,
    arrivals,
    path: step.status === 'found' ? (execution.path ?? []) : [],
  };
}
export function searchMotionFrame(execution: BfsExecution, index: number, rawProgress: number) {
  const p = clampProgress(rawProgress),
    plan = searchChoreography(execution, index);
  const name = (id: string) => execution.input.nodes.find((node) => node.id === id)?.label ?? id;
  const arrival = plan.arrivals.find((item) => p >= item.start && p < item.end);
  let caption =
    plan.step.status === 'found'
      ? 'Goal reached. Follow the discovered path.'
      : plan.step.queue.length
        ? `${name(plan.step.queue[0])} is next in the queue.`
        : 'The queue is empty.';
  if (plan.step.index === 0 && p < 0.85)
    caption = `Add ${name(execution.input.start)} to the queue.`;
  else if (plan.departing && p < 0.3) caption = `Take ${name(plan.departing)} from the front.`;
  else if (arrival)
    caption =
      p < arrival.traceEnd && arrival.from
        ? `Discover ${name(arrival.id)} from ${name(arrival.from)}.`
        : `Add ${name(arrival.id)} to the back.`;
  const queue =
    p >= 1
      ? [...plan.step.queue]
      : [...plan.retained, ...plan.arrivals.filter((item) => p >= item.end).map((item) => item.id)];
  return { plan, progress: p, caption, queue, arrival, departProgress: beatProgress(p, 0, 0.28) };
}

/** Replay recorded weighted snapshots. A cheaper tentative route can update a
 * node already in the priority queue, so discovery alone is not a relaxation.
 * No arithmetic is interpolated or recomputed here. */
export function weightedMotionFrame(execution: BfsExecution, index: number, rawProgress: number) {
  const progress = clampProgress(rawProgress);
  const step = execution.steps[Math.max(0, Math.min(index, execution.steps.length - 1))];
  const previous = execution.steps[Math.max(0, step.index - 1)];
  const changes =
    step.index === 0
      ? []
      : execution.input.nodes.filter((n) => step.distances[n.id] !== previous.distances[n.id]);
  const cues = changes.map((node, i) => ({
    id: node.id,
    from: step.parents[node.id],
    start: 0.28 + (i * 0.55) / Math.max(changes.length, 1),
    end: 0.28 + ((i + 1) * 0.55) / Math.max(changes.length, 1),
  }));
  const distances = { ...previous.distances };
  for (const cue of cues) if (progress >= cue.end) distances[cue.id] = step.distances[cue.id];
  const settled = progress >= 0.25 || step.index === 0;
  const name = (id: string) => execution.input.nodes.find((n) => n.id === id)?.label ?? id;
  const active = cues.find((c) => progress >= c.start && progress < c.end);
  let caption =
    step.status === 'found'
      ? 'Goal reached. Reveal the checked route.'
      : step.queue.length
        ? `${name(step.queue[0])} is next.`
        : 'No nodes remain in the frontier.';
  if (step.index === 0) caption = `Start with ${name(execution.input.start)} at cost 0.`;
  else if (!settled && step.current)
    caption =
      execution.modelId === 'dijkstra-nonnegative'
        ? `Settle ${name(step.current)} at cost ${step.distances[step.current]}.`
        : `Take ${name(step.current)} from the front.`;
  else if (active)
    caption =
      execution.modelId === 'dijkstra-nonnegative'
        ? `Update ${name(active.id)} to cost ${step.distances[active.id]} via ${name(active.from!)}.`
        : `Discover ${name(active.id)} via ${name(active.from!)}.`;
  return {
    step,
    previous,
    progress,
    cues,
    distances: progress >= 1 ? step.distances : distances,
    current: settled ? step.current : null,
    expanded: settled ? step.expanded : previous.expanded,
    caption,
    path: step.status === 'found' && progress >= 0.85 ? execution.path : null,
  };
}
