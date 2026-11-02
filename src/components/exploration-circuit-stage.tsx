'use client';

import { useState, type MutableRefObject, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import SpatialWorkspace from './spatial-workspace';
import { spatialScene } from '@/lib/domain/spatial-exploration';
import { liftScene } from '@/lib/domain/scene-lift';
import { SourceOverlay, type SourceGraphLayout } from './source-overlay';
import { defaultSpatialView } from '@/lib/domain/spatial-schema';
import { circuitOverlayModel } from '@/lib/domain/circuit-overlay-model';
import { DC_UNITS, dcValueAllowed, type DcSolution } from '@/lib/domain/dc-circuit';
import type { ExplorationSpec } from '@/lib/domain/exploration';
import type { SourceOverlayModel } from '@/lib/domain/source-overlay-model';
import type { SourceAnchor } from '@/lib/domain/source-grounding';
import {
  captionIsGrounded,
  circuitCaption,
  circuitQuantity,
  circuitSolution,
  explorationInputsChanged,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';

type CircuitSpec = Extract<ExplorationSpec, { mode: 'checked-circuit' }>;
type Layout = SourceGraphLayout & {
  components?: { componentId: string; x1: number; y1: number; x2: number; y2: number }[];
};
const value = (n: number) => String(Number(n.toPrecision(4)));

/** A number field that lets a learner type through partial values ("0.", "-") and applies
 * only allowed ones; it shows the applied value again when it loses focus. */
function ValueField({
  label,
  current,
  disabled,
  allowed,
  onApply,
}: {
  label: string;
  current: number;
  disabled: boolean;
  allowed: (v: number) => boolean;
  onApply: (v: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <input
      type="text"
      inputMode="decimal"
      aria-label={label}
      disabled={disabled}
      value={draft ?? String(current)}
      onFocus={() => setDraft(String(current))}
      onBlur={() => setDraft(null)}
      onChange={(event) => {
        setDraft(event.target.value);
        const v = Number(event.target.value);
        if (event.target.value.trim() !== '' && Number.isFinite(v) && allowed(v)) onApply(v);
      }}
    />
  );
}

/** The circuit as a plain diagram, at the positions where the source drew its nodes. Used
 * when the capture is not in memory, or by choice. Every number comes from the solution. */
function CircuitDiagram({ spec, solution, index }: { spec: CircuitSpec; solution: DcSolution; index: number }) {
  const panel = spec.scene.panels.find((p) => p.kind === 'circuit');
  if (panel?.kind !== 'circuit') return null;
  const xs = panel.positions.map((p) => p.x),
    ys = panel.positions.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const W = 640,
    H = 380,
    pad = 70;
  const at = (id: string) => {
    const p = panel.positions.find((x) => x.nodeId === id)!;
    return {
      x: pad + ((p.x - minX) / Math.max(1e-6, maxX - minX)) * (W - 2 * pad),
      y: pad + ((p.y - minY) / Math.max(1e-6, maxY - minY)) * (H - 2 * pad),
    };
  };
  const step = solution.steps[Math.min(index, solution.steps.length - 1)];
  const seen = new Map<string, number>();
  return (
    <svg className="circuit-diagram" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Checked circuit diagram">
      {spec.input.components.map((c) => {
        const a = at(c.from),
          b = at(c.to),
          key = [c.from, c.to].sort().join('|'),
          k = seen.get(key) ?? 0;
        seen.set(key, k + 1);
        // Parallel parts between the same two nodes bow apart so each stays visible.
        const bow = k === 0 ? 0 : (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 46;
        const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const mid = { x: (a.x + b.x) / 2 + (-(b.y - a.y) / len) * bow, y: (a.y + b.y) / 2 + ((b.x - a.x) / len) * bow };
        const open = solution.state.open.includes(c.id),
          shown = step?.revealedComponents.includes(c.id) && !open;
        const current = solution.currents[c.id] ?? 0;
        return (
          <g key={c.id} className={`circuit-part is-${c.kind}${open ? ' is-open' : ''}${shown && current !== 0 ? ' is-carrying' : ''}`}>
            <path d={`M ${a.x} ${a.y} Q ${2 * mid.x - (a.x + b.x) / 2} ${2 * mid.y - (a.y + b.y) / 2} ${b.x} ${b.y}`} />
            <text x={mid.x} y={mid.y - 10} textAnchor="middle">
              {c.label} · {value(solution.state.values[c.id] ?? c.value)} {DC_UNITS[c.kind]}
            </text>
            {shown && (
              <text x={mid.x} y={mid.y + 18} textAnchor="middle" className="circuit-current">
                {current === 0 ? '0 A' : circuitQuantity(Math.abs(current), 'A')}
              </text>
            )}
            {open && (
              <text x={mid.x} y={mid.y + 18} textAnchor="middle" className="circuit-open">
                open
              </text>
            )}
          </g>
        );
      })}
      {spec.input.nodes.map((n) => {
        const p = at(n.id),
          v = solution.voltages[n.id];
        const shown = step?.revealedNodes.includes(n.id) && v !== null && v !== undefined;
        return (
          <g key={n.id} className={`circuit-node${step?.node === n.id ? ' is-current' : ''}`}>
            <circle cx={p.x} cy={p.y} r={7} />
            <text x={p.x + 12} y={p.y - 10}>
              {n.label}
              {shown ? ` = ${circuitQuantity(v, 'V')}` : ''}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function ExplorationCircuitStage({
  spec,
  state,
  onChange,
  overlay,
  mirror,
  onScreen,
  screenNotice,
  compact,
  experiment,
  toggleRef,
  lift,
}: {
  /** Lifting the on-screen drawing into 3D, when the companion can. */
  lift?: { liftable: boolean; lifted: boolean; toggle: () => void };
  spec: CircuitSpec;
  state: ExplorationViewState;
  onChange: (next: ExplorationViewState) => void;
  overlay?: { image: string; layout: Layout; anchors?: SourceAnchor[]; nativeId?: string };
  mirror: (model: SourceOverlayModel | null) => void;
  onScreen: boolean;
  screenNotice: string;
  compact: boolean;
  experiment?: ReactNode;
  /** Receives the open/reconnect action for clicks on the companion's drawing. */
  toggleRef: MutableRefObject<(id: string) => void>;
}) {
  const [view, setView] = useState<'source' | 'diagram'>('source');
  const solution = circuitSolution(spec, state)!;
  const solved = solution.status === 'solved';
  const finalStep = Math.max(0, solution.steps.length - 1);
  const changed = explorationInputsChanged(spec, state);
  const name = (id: string) => spec.input.components.find((c) => c.id === id)?.label ?? id;
  const authored = !changed
    ? spec.steps.find((item) => item.execution === 'primary' && item.executionStep === state.step)
    : undefined;
  const computed = circuitCaption(solution, state.step);
  // The experiment, described against the circuit as read, whenever one is set up.
  const experimenting = state.disabledEdgeIds.length > 0 || Object.keys(state.edgeWeights ?? {}).length > 0;
  const lead = experimenting
    ? [
        state.disabledEdgeIds.length ? `You opened ${state.disabledEdgeIds.map(name).join(', ')}.` : '',
        ...Object.entries(state.edgeWeights ?? {}).map(([id, v]) => {
          const c = spec.input.components.find((x) => x.id === id)!;
          return `${c.label} is now ${value(v)} ${DC_UNITS[c.kind]} (was ${value(c.value)}).`;
        }),
      ]
        .filter(Boolean)
        .join(' ')
    : '';
  const grounded = authored && captionIsGrounded(authored.caption, [], solution) ? authored.caption : null;
  const computedLine = `${lead ? `${lead} ` : ''}${computed}`;
  // The drawing carries Muse's sentence when every number in it is the solver's.
  const caption = grounded ?? computedLine;
  const stepLabel =
    changed && experimenting ? 'Your experiment' : `${changed ? 'The circuit as read · ' : ''}Step ${Math.min(state.step, finalStep) + 1} of ${finalStep + 1}`;
  const layout = overlay?.layout;
  const drawable = Boolean(overlay && layout?.components?.length && spec.input.nodes.every((n) => layout.nodes.some((p) => p.nodeId === n.id)));
  const spatial = state.spatial?.mode === '3d';
  const toggle = (id: string) => {
    if (!spec.controls.includes('open-component')) return;
    const open = state.disabledEdgeIds.includes(id);
    const next = {
      ...state,
      selectedObjectId: id,
      disabledEdgeIds: open ? state.disabledEdgeIds.filter((x) => x !== id) : [...state.disabledEdgeIds, id],
    };
    // Show the checked consequence at once: every node revealed.
    onChange({ ...next, step: Math.max(0, (circuitSolution(spec, next)?.steps.length ?? 1) - 1) });
  };
  toggleRef.current = (id: string) => {
    if (spec.input.components.some((c) => c.id === id)) toggle(id);
  };
  const setValue = (id: string, v: number) => {
    const c = spec.input.components.find((x) => x.id === id)!;
    if (!dcValueAllowed(c.kind, v)) return;
    const weights = { ...(state.edgeWeights ?? {}) };
    if (v === c.value) delete weights[id];
    else weights[id] = v;
    const next = { ...state, edgeWeights: weights };
    onChange({ ...next, step: Math.max(0, (circuitSolution(spec, next)?.steps.length ?? 1) - 1) });
  };
  return (
    <>
      {spec.controls.includes('step') && solved && (
        <div className="exploration-step-bar">
          <div className="action-row">
            <button
              className="secondary-button"
              type="button"
              disabled={state.step <= 0}
              onClick={() => onChange({ ...state, step: Math.max(0, state.step - 1) })}
            >
              <ChevronLeft size={16} aria-hidden="true" /> Previous step
            </button>
            <button
              className="primary-button"
              type="button"
              disabled={state.step >= finalStep}
              onClick={() => onChange({ ...state, step: state.step + 1 })}
            >
              Next step <ChevronRight size={16} aria-hidden="true" />
            </button>
            <span className="meta journal-page-number">
              Step {Math.min(state.step, finalStep) + 1} of {finalStep + 1}
            </span>
          </div>
        </div>
      )}
      <div className="exploration-scene exploration-layout-diagram-sidebar" aria-label="Checked circuit">
        {spatial ? (
          <SpatialWorkspace spec={spec} state={state} onChange={onChange} which="primary" />
        ) : (
          <section className="exploration-panel exploration-panel-circuit" style={{ gridColumn: '1 / span 2' }} aria-label="Checked circuit">
            {drawable && (
              <div className="source-overlay-switch" role="group" aria-label="Where to draw the circuit">
                <button type="button" aria-pressed={view === 'source'} onClick={() => setView('source')}>
                  On your source
                </button>
                <button type="button" aria-pressed={view === 'diagram'} onClick={() => setView('diagram')}>
                  Diagram
                </button>
              </div>
            )}
            {screenNotice && (
              <p className="source-overlay-onscreen" role="status">
                {screenNotice}
              </p>
            )}
            {onScreen && (
              <div className="source-overlay-onscreen">
                <p role="status">
                  {lift?.lifted
                    ? 'Lifted off your slide in 3D: each node stands at its checked voltage, so current runs downhill.'
                    : `Drawn on your screen, over the window you captured.${spec.controls.includes('open-component') ? ' Click a part there to open it;' : ''}`}{' '}
                  Esc hides it.
                </p>
                {lift?.liftable && (
                  <button type="button" className="source-overlay-lift" aria-pressed={lift.lifted} onClick={lift.toggle}>
                    Lift into 3D
                  </button>
                )}
              </div>
            )}
            {drawable && view === 'source' ? (
              <SourceOverlay
                image={overlay!.image}
                build={(aspect) => {
                  const drawn = circuitOverlayModel({
                    layout: { nodes: layout!.nodes, components: layout!.components ?? [] },
                    solution,
                    index: state.step,
                    caption,
                    stepLabel,
                    aspect,
                    obstacles: (overlay!.anchors ?? []).map((a) => a.region),
                  });
                  // The companion can lift it: each node rises from where it is printed to its
                  // checked voltage.
                  const scene = drawn && spatialScene(spec, state);
                  if (!drawn || !scene) return drawn;
                  const anchors = new Map(layout!.nodes.map((n) => [n.nodeId, { x: n.x, y: n.y }]));
                  const xs = layout!.nodes.map((n) => n.x), ys = layout!.nodes.map((n) => n.y), pad = 0.06;
                  const x = Math.max(0, Math.min(...xs) - pad), y = Math.max(0, Math.min(...ys) - pad);
                  const region = { x, y, width: Math.min(1, Math.max(...xs) + pad) - x, height: Math.min(1, Math.max(...ys) + pad) - y };
                  return { ...drawn, scene: liftScene(scene, region, anchors) };
                }}
                canToggle={spec.controls.includes('open-component')}
                selected={state.selectedObjectId}
                stepLabel={stepLabel}
                onModel={mirror}
                onToggleEdge={toggle}
                onSelect={(id) => onChange({ ...state, selectedObjectId: id })}
                compact={onScreen}
              />
            ) : (
              <>
                {drawable === false && !overlay && <h3>{spec.scene.panels.find((p) => p.kind === 'circuit')?.title}</h3>}
                <CircuitDiagram spec={spec} solution={solution} index={state.step} />
              </>
            )}
          </section>
        )}
        {experiment && <div className="exploration-experiment-slot">{experiment}</div>}
      </div>
      <div className="spatial-mode-switch" role="group" aria-label="Visual representation">
        <button
          type="button"
          aria-pressed={!spatial}
          onClick={() => onChange({ ...state, spatial: { ...(state.spatial ?? defaultSpatialView()), mode: '2d' } })}
        >
          2D view
        </button>
        <button
          type="button"
          aria-pressed={spatial}
          onClick={() => onChange({ ...state, spatial: { ...(state.spatial ?? defaultSpatialView()), mode: '3d' } })}
        >
          Voltage as height
        </button>
      </div>
      <div className="exploration-caption" aria-live="polite">
        <span className="overline">{stepLabel}</span>
        <p>{solved ? computedLine : `${lead ? `${lead} ` : ''}${solution.reason}`}</p>
        {grounded && <p className="exploration-authored-caption">Soma’s explanation: {grounded}</p>}
      </div>
      <details className="exploration-controls-disclosure" open={!compact}>
        <summary>Change the experiment</summary>
        <div className="exploration-controls" aria-label="Circuit controls">
          <p className="meta">Soma re-solves the circuit for every change, with no model call. Your source stays unchanged.</p>
          <div className="circuit-controls">
            {spec.input.components.map((c) => {
              const open = state.disabledEdgeIds.includes(c.id);
              const current = state.edgeWeights?.[c.id] ?? c.value;
              return (
                <div key={c.id} className={`circuit-control${open ? ' is-open' : ''}`}>
                  {spec.controls.includes('open-component') && (
                    <label>
                      <input type="checkbox" checked={!open} onChange={() => toggle(c.id)} /> {c.label}
                    </label>
                  )}
                  {spec.controls.includes('set-value') && (
                    <label>
                      <ValueField
                        label={`${c.label} value in ${DC_UNITS[c.kind]}`}
                        current={current}
                        disabled={open}
                        allowed={(v) => dcValueAllowed(c.kind, v)}
                        onApply={(v) => setValue(c.id, v)}
                      />{' '}
                      {DC_UNITS[c.kind]}
                    </label>
                  )}
                </div>
              );
            })}
          </div>
          {experimenting && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => {
                const asRead = { ...state, disabledEdgeIds: [], edgeWeights: {} };
                onChange({ ...asRead, step: Math.max(0, (circuitSolution(spec, asRead)?.steps.length ?? 1) - 1) });
              }}
            >
              Back to the circuit as read
            </button>
          )}
          {solved && (
            <details>
              <summary>Checked values in a table</summary>
              <div className="exploration-table-scroll">
                <table className="exploration-state-table circuit-readings">
                  <thead>
                    <tr>
                      <th scope="col">Part</th>
                      <th scope="col">Value</th>
                      <th scope="col">Current</th>
                      <th scope="col">Voltage across</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spec.input.components.map((c) => {
                      const i = solution.currents[c.id] ?? 0;
                      const [a, b] = i >= 0 ? [c.from, c.to] : [c.to, c.from];
                      const node = (id: string) => spec.input.nodes.find((n) => n.id === id)?.label ?? id;
                      return (
                        <tr key={c.id}>
                          <th scope="row">{c.label}</th>
                          <td>
                            {solution.state.open.includes(c.id)
                              ? 'open'
                              : `${value(solution.state.values[c.id] ?? c.value)} ${DC_UNITS[c.kind]}`}
                          </td>
                          <td>{i === 0 ? '0 A' : `${circuitQuantity(Math.abs(i), 'A')}, ${node(a)} → ${node(b)}`}</td>
                          <td>
                            {solution.drops[c.id] === null
                              ? 'not fixed (its ends are cut apart)'
                              : circuitQuantity(Math.abs(solution.drops[c.id] ?? 0), 'V')}
                          </td>
                        </tr>
                      );
                    })}
                    {spec.input.nodes.map((n) => (
                      <tr key={n.id}>
                        <th scope="row">Node {n.label}</th>
                        <td colSpan={3}>
                          {solution.voltages[n.id] === null
                            ? 'Cut off from ground'
                            : circuitQuantity(solution.voltages[n.id]!, 'V')}
                          {n.id === spec.input.ground ? ' (ground)' : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
          <p className="meta">
            Ideal DC circuit · exact nodal analysis · Kirchhoff’s current law and every source voltage checked exactly.
          </p>
        </div>
      </details>
    </>
  );
}
