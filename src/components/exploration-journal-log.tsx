'use client';
import type { ExplorationSpec } from '@/lib/domain/exploration';
import {
  circuitQuantity,
  circuitSolution,
  explorationExecution,
  explorationInputsChanged,
  explorationStepCaption,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';

type Mark = 'settled' | 'now' | 'waiting' | 'unreached';
const signifier: Record<Mark, string> = { settled: '×', now: '→', waiting: '•', unreached: '○' };

/** The left page of the journal: a printed log of the checked search state, the
 * current explanation in handwriting, and a key. The log is derived from the
 * same checked trace the diagram draws; it never invents values. */
export function ExplorationJournalLog({
  spec,
  state,
  provenance,
}: {
  spec: ExplorationSpec;
  state: ExplorationViewState;
  provenance: 'muse' | 'prepared' | 'recorded';
}) {
  if (spec.mode === 'clarify') return null;
  const changed = explorationInputsChanged(spec, state);
  const authored =
    spec.mode === 'explanation'
      ? spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)]
      : changed
        ? undefined
        : spec.steps.find(
            (item) => item.execution === 'primary' && item.executionStep === state.step,
          );
  const note = authored ? authored.narration || authored.caption : null;
  // Without an explanation written for this exact step, the step is told once, in print.
  const printed = !note && !changed && spec.mode !== 'explanation' ? explorationStepCaption(spec, state) : null;
  const execution = explorationExecution(spec, state);
  const step = execution?.steps[Math.min(state.step, execution.steps.length - 1)];
  const previous = execution?.steps[Math.max(0, Math.min(state.step, execution.steps.length - 1) - 1)];
  const weighted = execution?.modelId === 'dijkstra-nonnegative';
  const finished = step && step.status !== 'searching' && step.status !== 'ready';
  const rows =
    execution && step
      ? [
          ...step.expanded.filter((id) => id !== step.current).map((id) => ({ id, mark: 'settled' as Mark })),
          ...(step.current ? [{ id: step.current, mark: 'now' as Mark }] : []),
          ...step.queue
            .filter((id) => id !== step.current && !step.expanded.includes(id))
            .map((id) => ({ id, mark: 'waiting' as Mark })),
          ...execution.input.nodes
            .map((node) => node.id)
            .filter(
              (id) => id !== step.current && !step.expanded.includes(id) && !step.queue.includes(id),
            )
            .map((id) => ({ id, mark: 'unreached' as Mark })),
        ]
      : [];
  const name = (id: string) => execution?.input.nodes.find((node) => node.id === id)?.label ?? id;
  const value = (id: string, mark: Mark) => {
    const current = step?.distances[id];
    if (current === undefined)
      return mark === 'unreached' && finished ? 'unreached' : '—';
    const before = previous?.distances[id];
    return before !== undefined && before !== current && state.step > 0 ? (
      <>
        <s>{before}</s> {current}
      </>
    ) : (
      current
    );
  };
  // A circuit's log: each node's checked voltage and each part's current, as the steps reveal them.
  const circuit = circuitSolution(spec, state);
  const cstep = circuit?.status === 'solved' ? circuit.steps[Math.min(state.step, circuit.steps.length - 1)] : null;
  const circuitRows =
    circuit && cstep && spec.mode === 'checked-circuit'
      ? [
          ...spec.input.nodes.map((n) => {
            const v = circuit.voltages[n.id];
            const mark: Mark = v === null ? 'unreached' : cstep.node === n.id ? 'now' : cstep.revealedNodes.includes(n.id) ? 'settled' : 'waiting';
            return { id: n.id, name: n.label, mark, value: mark === 'settled' || mark === 'now' ? circuitQuantity(v!, 'V') : mark === 'unreached' ? 'cut off' : '—' };
          }),
          ...spec.input.components
            .filter((c) => cstep.revealedComponents.includes(c.id))
            .map((c) => ({
              id: c.id,
              name: c.label,
              mark: 'settled' as Mark,
              value: circuit.state.open.includes(c.id) ? 'open' : circuitQuantity(Math.abs(circuit.currents[c.id]), 'A'),
            })),
        ]
      : [];
  const writer =
    provenance === 'prepared' ? 'the example’s author' : provenance === 'recorded' ? 'Muse (recorded run)' : 'Muse';
  return (
    <div className="journal-log">
      {circuitRows.length > 0 && (
        <section aria-labelledby="journal-log-title">
          <h3 id="journal-log-title" className="journal-log-title">
            Circuit log
            <span className="meta">Nodal analysis · exact</span>
          </h3>
          <ul className="journal-log-rows">
            {circuitRows.map((row) => (
              <li key={row.id} className={`journal-log-row is-${row.mark}`}>
                <span className="journal-signifier" aria-hidden="true">
                  {signifier[row.mark]}
                </span>
                <span className="sr-only">
                  {row.mark === 'now' ? 'Now:' : row.mark === 'settled' ? 'Known:' : row.mark === 'waiting' ? 'Not yet:' : 'Cut off:'}
                </span>
                <span className="journal-log-name">{row.name}</span>
                <span className="journal-log-leader" aria-hidden="true" />
                <span className="journal-log-value">{row.value}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {execution && step && (
        <section aria-labelledby="journal-log-title">
          <h3 id="journal-log-title" className="journal-log-title">
            Search log
            <span className="meta">
              {weighted ? 'Dijkstra · lowest cost first' : 'BFS · first in, first out'}
            </span>
          </h3>
          <ul className="journal-log-rows">
            {rows.map((row) => (
              <li key={row.id} className={`journal-log-row is-${row.mark}`}>
                <span className="journal-signifier" aria-hidden="true">
                  {signifier[row.mark]}
                </span>
                <span className="sr-only">
                  {row.mark === 'now'
                    ? 'Now:'
                    : row.mark === 'settled'
                      ? weighted
                        ? 'Settled:'
                        : 'Done:'
                      : row.mark === 'waiting'
                        ? 'Waiting:'
                        : 'Not reached:'}
                </span>
                <span className="journal-log-name">{name(row.id)}</span>
                <span className="journal-log-leader" aria-hidden="true" />
                <span className="journal-log-value">
                  {value(row.id, row.mark)}
                  {!weighted && step.distances[row.id] !== undefined && (
                    <span className="sr-only"> hops</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {note ? (
        <p className="journal-note">
          <span className="sr-only">Explanation by {writer}: </span>
          {note}
        </p>
      ) : printed ? (
        <p className="journal-note-printed">{printed}</p>
      ) : changed ? (
        <p className="journal-note-printed">
          You changed the experiment. The log and diagram show the recomputed{' '}
          {circuit ? 'circuit' : 'search'}; the written notes pause until you ask about it.
        </p>
      ) : null}
      <details className="journal-key">
        <summary>
          {circuit ? (
            <>
              <span>
                <b aria-hidden="true">×</b> known
              </span>
              <span>
                <b aria-hidden="true">→</b> now
              </span>
              <span>
                <b aria-hidden="true">•</b> not yet
              </span>
              <span>
                <b aria-hidden="true">○</b> cut off
              </span>
            </>
          ) : execution ? (
            <>
              <span>
                <b aria-hidden="true">×</b> {weighted ? 'settled' : 'done'}
              </span>
              <span>
                <b aria-hidden="true">→</b> now
              </span>
              <span>
                <b aria-hidden="true">•</b> waiting
              </span>
              <span>
                <b aria-hidden="true">○</b> not reached
              </span>
            </>
          ) : (
            <span>Key</span>
          )}
        </summary>
        <p>
          {execution || circuit ? 'Printed values are checked by Soma. ' : ''}
          <span className="journal-key-hand">Handwriting is the explanation.</span>
        </p>
      </details>
    </div>
  );
}
