'use client';
import type { CostProbe } from '@/lib/domain/cost-probe';
import { routeCost, probeEdgeCost } from '@/lib/domain/cost-probe';
import { runBfs, runDijkstra, type BfsInput } from '@/lib/domain/graph-search';
export function ExplorationCostProbe({
  probe,
  input,
  value,
  disabled,
  onChange,
}: {
  probe: CostProbe;
  input: BfsInput;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const edge = input.edges.find((e) => e.id === probe.edgeId);
  if (!edge || !input.goal)
    return (
      <p className="meta">
        Choose a goal and enable the selected edge to resume this cost experiment.
      </p>
    );
  probe = probeEdgeCost(input, probe.edgeId);
  const changed = {
      ...input,
      edges: input.edges.map((e) => (e.id === edge.id ? { ...e, weight: value } : e)),
    },
    bfs = runBfs({ ...changed, algorithm: 'bfs' }),
    dijkstra = runDijkstra(changed);
  const max = Math.max(
      probe.originalCost,
      probe.criticalCost ?? 0,
      ...probe.cases.map((c) => c.value),
      1,
    ),
    largest = Math.max(...probe.cases.flatMap((c) => [c.bfsCost ?? 0, c.dijkstraCost ?? 0]), 1);
  const name = (id: string) => input.nodes.find((n) => n.id === id)?.label ?? id;
  return (
    <section className="exploration-cost-probe" aria-label="Checked cost experiment">
      <span className="overline">Muse chose an experiment · checked by Soma</span>
      <h3>Where does the cheapest route change?</h3>
      <p>
        Change only {name(edge.from)} → {name(edge.to)}. The graph and both searches recompute from
        the same cost.
      </p>
      <label htmlFor="probe-cost">
        Edge cost: <strong>{value}</strong>
      </label>
      <input
        id="probe-cost"
        type="range"
        min="0"
        max={max}
        step="any"
        value={value}
        onKeyDown={(e) => {
          if (
            e.key === 'ArrowLeft' ||
            e.key === 'ArrowDown' ||
            e.key === 'ArrowRight' ||
            e.key === 'ArrowUp'
          ) {
            e.preventDefault();
            const direction = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1;
            onChange(
              Math.max(
                0,
                Math.min(max, Number((value + direction * (e.shiftKey ? 1 : 0.1)).toFixed(10))),
              ),
            );
          }
        }}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <div className="action-row" role="status">
        <span>
          BFS route cost: <strong>{routeCost(changed, bfs.path) ?? 'Unreachable'}</strong>
        </span>
        <span>
          Dijkstra route cost: <strong>{routeCost(changed, dijkstra.path) ?? 'Unreachable'}</strong>
        </span>
      </div>
      <details>
        <summary>See the checked samples</summary>
        <svg
          viewBox="0 0 480 160"
          role="img"
          aria-label="Checked cost samples. Purple is BFS route cost; green is Dijkstra route cost."
        >
          <line x1="35" y1="130" x2="460" y2="130" stroke="#b5b1a8" />
          {probe.cases.map((c, i) => {
            const x = 45 + (i * 390) / Math.max(probe.cases.length - 1, 1);
            return (
              <g key={c.value}>
                <line
                  x1={x - 4}
                  y1="130"
                  x2={x - 4}
                  y2={130 - (100 * (c.bfsCost ?? 0)) / largest}
                  stroke="#6554e8"
                  strokeWidth="7"
                />
                <line
                  x1={x + 5}
                  y1="130"
                  x2={x + 5}
                  y2={130 - (100 * (c.dijkstraCost ?? 0)) / largest}
                  stroke="#15803d"
                  strokeWidth="7"
                />
                <text x={x} y="151" textAnchor="middle" fontSize="12">
                  {c.value}
                </text>
              </g>
            );
          })}
        </svg>
        <p className="meta">
          Purple: BFS route cost · green: Dijkstra route cost · numbers below bars: changed edge
          cost. Discrete checked samples.
        </p>
      </details>
      {probe.criticalCost !== null && (
        <button
          type="button"
          className="secondary-button"
          disabled={disabled}
          onClick={() => onChange(probe.criticalCost!)}
        >
          Try the tie at {probe.criticalCost}
        </button>
      )}
      <p>{probe.note}</p>
      <p className="meta">
        Hypothetical intervention on this captured graph. Your source is unchanged.
      </p>
    </section>
  );
}
