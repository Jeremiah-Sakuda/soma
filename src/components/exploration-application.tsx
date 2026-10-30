'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { PublicExplorationApplication } from '@/lib/domain/exploration-application';
import { applicationHint } from '@/lib/domain/exploration-application';
import type { BfsInput, ExplorationPanel } from '@/lib/domain/exploration';
import { weightedGraphLayout } from '@/lib/domain/weighted-graph-layout';

function ProblemGraph({ input }: { input: BfsInput }) {
  const marker = useId().replace(/[^a-z0-9]/gi, '');
  const container = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(580);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setWidth(Math.max(280, Math.min(580, Math.round(entries[0].contentRect.width)))),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const panel: Extract<ExplorationPanel, { kind: 'graph' }> = {
    id: 'fresh-graph',
    kind: 'graph',
    title: 'Fresh practice problem',
    execution: 'primary',
    placement: { column: 1, row: 1, columnSpan: 1 },
    positions: input.nodes.map((node, i) => ({
      nodeId: node.id,
      x: i === 0 ? 0.1 : i === input.nodes.length - 1 ? 0.9 : 0.35 + ((i - 1) % 2) * 0.3,
      y: i === 0 || i === input.nodes.length - 1 ? 0.5 : 0.2 + Math.floor((i - 1) / 2) * 0.55,
    })),
  };
  const layout = weightedGraphLayout(panel, input, width);
  const name = (id: string) => input.nodes.find((n) => n.id === id)!.label;
  return (
    <div ref={container}>
      <svg
        className="exploration-graph fresh-problem-graph"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        role="img"
        aria-label={`Fresh ${input.directed ? 'directed' : 'undirected'} graph. No solution shown. Connections are listed below.`}
      >
        <defs>
          <marker
            id={marker}
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--ink-2)" />
          </marker>
        </defs>
        {layout.edges.map((e) => (
          <path
            key={e.id}
            d={e.path}
            fill="none"
            stroke="var(--ink-2)"
            strokeWidth="2"
            markerEnd={input.directed ? `url(#${marker})` : undefined}
          />
        ))}
        {input.algorithm === 'dijkstra' &&
          layout.labels
            .filter((l) => !l.legend)
            .map((l) => (
              <g key={l.id}>
                <rect
                  x={l.x - l.width / 2}
                  y={l.y - 11}
                  width={l.width}
                  height="22"
                  rx="7"
                  fill="var(--surface)"
                  stroke="var(--border)"
                />
                <text x={l.x} y={l.y} textAnchor="middle" dominantBaseline="central">
                  {l.text}
                </text>
              </g>
            ))}
        {layout.nodes.map((n) => (
          <g key={n.id}>
            <rect
              x={n.x - n.width / 2}
              y={n.y - 20}
              width={n.width}
              height="40"
              rx="12"
              fill="var(--surface)"
              stroke="var(--ink-2)"
            />
            <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central">
              {n.label}
              {n.id === input.start ? ' · Start' : n.id === input.goal ? ' · Goal' : ''}
            </text>
          </g>
        ))}
      </svg>
      <details className="fresh-connections">
        <summary>Read the connections</summary>
        <p>
          {input.directed
            ? 'Arrows permit travel in one direction.'
            : 'Connections permit travel in both directions.'}{' '}
          {input.algorithm === 'dijkstra'
            ? 'Numbers are connection costs.'
            : 'Every connection counts as one step.'}
        </p>
        <ul>
          {input.edges.map((e) => (
            <li key={e.id}>
              {name(e.from)} {input.directed ? '→' : '↔'} {name(e.to)}
              {input.algorithm === 'dijkstra' ? `: cost ${e.weight}` : ''}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
const time = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
export function ExplorationApplicationCard({
  artifactId,
  version,
  history,
  disabled,
  canAdapt,
  onPause,
  onOpen,
}: {
  artifactId: string;
  version: number;
  history: PublicExplorationApplication[];
  disabled: boolean;
  canAdapt: boolean;
  onPause: () => void;
  onOpen: (applicationId: string, explain: boolean) => Promise<void>;
}) {
  const [record, setRecord] = useState<PublicExplorationApplication | null>(
    () =>
      history.filter((item) => item.artifactId === artifactId && item.version === version).at(-1) ??
      null,
  );
  const [records, setRecords] = useState(() =>
    history.filter((item) => item.artifactId === artifactId && item.version === version),
  );
  const [expanded, setExpanded] = useState(false),
    [value, setValue] = useState(''),
    [reason, setReason] = useState('');
  const [working, setWorking] = useState(false),
    [error, setError] = useState('');
  const requestId = useRef<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  async function send(operation: 'start' | 'answer' | 'hint' | 'reveal', fresh = false) {
    if (working || disabled) return;
    onPause();
    setWorking(true);
    setError('');
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const id = fresh || !record ? requestId.current : record.id;
    try {
      const response = await fetch('/api/explore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'application',
          id,
          artifactId,
          version,
          operation,
          ...(operation === 'answer' ? { value: Number(value), reason } : {}),
        }),
      });
      const body = await response.json();
      if (!response.ok)
        throw new Error(body.error ?? 'Could not save this practice. Your answer is still here.');
      if (operation === 'start') requestId.current = null;
      setRecord(body.application);
      setRecords((current) => [
        ...current.filter((item) => item.id !== body.application.id),
        body.application,
      ]);
      setExpanded(true);
      if (operation === 'start') {
        setValue('');
        setReason('');
        heading.current?.focus();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this practice. Try again.');
    } finally {
      setWorking(false);
    }
  }
  async function open(explain: boolean) {
    if (!record || working || disabled) return;
    onPause();
    setWorking(true);
    setError('');
    try {
      await onOpen(record.id, explain);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : 'Could not open this example. Your attempt is kept.',
      );
    } finally {
      setWorking(false);
    }
  }
  const unavailable = disabled || working;
  return (
    <section className="exploration-application" aria-label="Fresh practice">
      <h3 ref={heading} tabIndex={-1}>
        Try it on a fresh example
      </h3>
      {!expanded ? (
        <>
          <p>Same idea, different problem. Try it before seeing the solution.</p>
          <button
            type="button"
            className="secondary-button"
            disabled={unavailable}
            onClick={() => (record ? (onPause(), setExpanded(true)) : void send('start'))}
          >
            {record ? 'Resume fresh practice' : 'Try a fresh example'}
          </button>
        </>
      ) : (
        record && (
          <>
            <p className="meta">
              Original practice variation · solution hidden until checked or revealed
            </p>
            <p>
              <strong>{record.prompt}</strong>
            </p>
            <ProblemGraph input={record.input} />
            {!record.answer && !record.revealedAt ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (value.trim() && Number.isFinite(Number(value))) void send('answer');
                }}
              >
                <label htmlFor={`${formId}-value`}>
                  {record.unit === 'cost' ? 'Lowest total cost' : 'Fewest connections'}
                </label>
                <input
                  id={`${formId}-value`}
                  type="number"
                  min="0"
                  max="10000000"
                  step="any"
                  required
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  disabled={unavailable}
                />
                <label htmlFor={`${formId}-reason`}>
                  How did you decide? <span className="meta">Optional</span>
                </label>
                <textarea
                  id={`${formId}-reason`}
                  rows={2}
                  maxLength={800}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  disabled={unavailable}
                />
                {record.hintedAt && <p className="fresh-hint">{applicationHint(record)}</p>}
                <div className="action-row">
                  <button
                    className="primary-button"
                    type="submit"
                    disabled={unavailable || !value.trim()}
                  >
                    Check my answer
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={unavailable || !!record.hintedAt}
                    onClick={() => void send('hint')}
                  >
                    Give me a hint
                  </button>
                  <button
                    className="text-button"
                    type="button"
                    disabled={unavailable}
                    onClick={() => void send('reveal')}
                  >
                    Show the solution
                  </button>
                </div>
              </form>
            ) : (
              <>
                <p role="status">
                  {record.answer
                    ? record.answer.matches
                      ? 'Your answer matches the checked result.'
                      : 'Your answer differs from the checked result.'
                    : 'Solution revealed without an answer.'}{' '}
                  {record.answer && `You answered ${record.answer.value}. `}
                  Checked {record.unit}: {record.solution?.value}.
                </p>
                <p>
                  One checked route:{' '}
                  {record.solution?.path
                    .map((id) => record.input.nodes.find((n) => n.id === id)!.label)
                    .join(' → ')}
                  .
                </p>
                {record.answer?.reason && <p>Your explanation: {record.answer.reason}</p>}
                <p className="meta">
                  {record.answer
                    ? `${record.answer.assistance === 'hint' ? 'Answered after a hint' : 'Answered before this solution was shown'} · ${time(record.answer.recordedAt)}`
                    : `Revealed ${time(record.revealedAt!)}`}
                  .{' '}
                  {record.previousAttemptAt &&
                    `Previous fresh answer: ${time(record.previousAttemptAt)}.`}
                </p>
                <div className="action-row">
                  <button
                    className="secondary-button"
                    type="button"
                    disabled={unavailable}
                    onClick={() => void open(false)}
                  >
                    Explore this example
                  </button>
                  {record.answer && (
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={unavailable || !canAdapt}
                      onClick={() => void open(true)}
                    >
                      Explain my answer with Muse
                    </button>
                  )}
                  <button
                    className="text-button"
                    type="button"
                    disabled={unavailable}
                    onClick={() => void send('start', true)}
                  >
                    Try another example
                  </button>
                </div>
              </>
            )}
            <p className="meta">
              Saved {time(record.savedAt)} · practice started {time(record.createdAt)}. Your
              reference exploration remains available. This is practice, not a mastery score.
            </p>
            <button
              type="button"
              className="text-button"
              disabled={working}
              onClick={() => setExpanded(false)}
            >
              Close practice
            </button>
          </>
        )
      )}
      {records.length > 1 && (
        <details className="fresh-history">
          <summary>Earlier fresh practice ({records.length - 1})</summary>
          <ul>
            {records
              .filter((item) => item.id !== record?.id)
              .map((item) => (
                <li key={item.id}>
                  {time(item.createdAt)} ·{' '}
                  {item.answer
                    ? `Answered ${item.answer.value}${item.answer.assistance === 'hint' ? ' after a hint' : ' before solution reveal'}; checked result ${item.solution?.value}.`
                    : item.revealedAt
                      ? 'Revealed without an answer.'
                      : 'Not answered.'}
                  {item.answer?.reason && <p>Your explanation: {item.answer.reason}</p>}
                </li>
              ))}
          </ul>
        </details>
      )}
      {working && <p role="status">Saving practice…</p>}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
