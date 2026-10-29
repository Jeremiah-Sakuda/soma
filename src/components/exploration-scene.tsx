'use client';

import { useId } from 'react';
import { runBfs, type BfsInput, type BfsExecution, type BfsStep, type ExplorationPanel, type ExplorationSpec } from '@/lib/domain/exploration';

export type ExplorationViewState = { step: number; explanationStep: number; start: string | null; goal: string | null; disabledEdgeIds: string[]; reversed: boolean; selectedObjectId: string | null };
export function initialExplorationState(spec: ExplorationSpec): ExplorationViewState {
  return { step: 0, explanationStep: 0, start: spec.mode === 'checked-bfs' ? spec.input.start : null, goal: spec.mode === 'checked-bfs' ? spec.input.goal : null, disabledEdgeIds: [], reversed: false, selectedObjectId: null };
}
export function explorationExecution(spec: ExplorationSpec, state: ExplorationViewState): BfsExecution | null {
  if (spec.mode !== 'checked-bfs') return null;
  return runBfs({ ...spec.input, start: state.start ?? spec.input.start, goal: state.goal, edges: spec.input.edges.filter(edge => !state.disabledEdgeIds.includes(edge.id)), neighborOrder: state.reversed ? [...spec.input.neighborOrder].reverse() : spec.input.neighborOrder });
}
export function explorationInputsChanged(spec: ExplorationSpec, state: ExplorationViewState) {
  return spec.mode === 'checked-bfs' && ((state.start ?? spec.input.start) !== spec.input.start || state.goal !== spec.input.goal || state.disabledEdgeIds.length > 0 || state.reversed);
}
function executionCaption(execution:BfsExecution,index:number) {
  const step=execution.steps[Math.min(index,execution.steps.length-1)];
  if(!step.current)return `${nodeName(execution.input,execution.input.start)} starts in the queue. No node has been expanded yet.`;
  return `${nodeName(execution.input,step.current)} leaves the front of the queue.${step.discovered.length?` Added ${step.discovered.map(id=>nodeName(execution.input,id)).join(', ')}.`:' No new nodes added.'}${step.status==='found'?' Goal reached.':step.status==='unreachable'?' The queue is empty; the goal is unreachable with these connections.':step.status==='complete'?' All reachable nodes have been explored.':''}`;
}
export function explorationVisibleCaption(spec: ExplorationSpec, state: ExplorationViewState): string {
  if (spec.mode === 'clarify') return spec.question;
  const execution = explorationExecution(spec, state);
  if (!execution) return spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)].caption;
  if(spec.mode==='checked-bfs'&&spec.comparison)return `Primary: ${executionCaption(execution,state.step)} Comparison: ${executionCaption(runBfs(spec.comparison.input),state.step)}`;
  return executionCaption(execution,state.step);
}

const nodeName = (input: BfsInput, id: string | null) => input.nodes.find(node => node.id === id)?.label ?? 'None';

function GraphPanel({ panel, execution, index, selected, onSelect, highlights }: { panel: Extract<ExplorationPanel, { kind: 'graph' }>; execution: BfsExecution; index: number; selected: string | null; onSelect: (id: string) => void; highlights: string[] }) {
  const markerId = useId().replace(/[^a-z0-9]/gi, ''), step = execution.steps[Math.min(index, execution.steps.length - 1)];
  const position = (id: string) => { const point = panel.positions.find(point => point.nodeId === id)!; return { x: 48 + point.x * 424, y: 42 + point.y * 256 }; };
  const points = execution.input.nodes.map(node => position(node.id));
  const separation = points.flatMap((point, i) => points.slice(i + 1).map(other => Math.hypot(point.x - other.x, point.y - other.y)));
  const radius = Math.max(10, Math.min(26, (Math.min(...separation, 100) - 8) / 2));
  return <>
    <p className="exploration-graph-configuration">Start: {nodeName(execution.input,execution.input.start)} · Goal: {execution.input.goal===null?'All reachable nodes':nodeName(execution.input,execution.input.goal)}</p>
    <p className="exploration-graph-order">Neighbor order: {execution.input.neighborOrder.map(id=>nodeName(execution.input,id)).join(' → ')}</p>
    <svg className="exploration-graph" viewBox="0 0 520 340" role="img" aria-label={`${panel.title}. ${step.current ? `Current node ${nodeName(execution.input, step.current)}.` : 'Search not started.'} Select an object using the buttons below.`}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
      {execution.input.edges.map(edge => { const from = position(edge.from), to = position(edge.to), distance = Math.hypot(to.x - from.x, to.y - from.y), offset = (radius + 4) / (distance || 1), loop = from.y < 100 ? 1 : -1; const props = { className: `exploration-edge ${selected === edge.id || highlights.includes(edge.id) ? 'is-selected' : ''}`, markerEnd: execution.input.directed ? `url(#${markerId})` : undefined }; return distance === 0 ? <path key={edge.id} {...props} fill="none" d={`M ${from.x-radius*.7} ${from.y+loop*radius*.7} C ${from.x-60} ${from.y+loop*70}, ${from.x+60} ${from.y+loop*70}, ${from.x+radius*.7} ${from.y+loop*radius*.7}`} /> : <line key={edge.id} {...props} x1={from.x + (to.x - from.x) * offset} y1={from.y + (to.y - from.y) * offset} x2={to.x - (to.x - from.x) * offset} y2={to.y - (to.y - from.y) * offset} />; })}
      {execution.input.nodes.map(node => { const point = position(node.id), current = step.current === node.id, queued = step.queue.includes(node.id), visited = step.expanded.includes(node.id); return <g key={node.id} transform={`translate(${point.x},${point.y})`} className={`exploration-node ${current ? 'is-current' : queued ? 'is-queued' : visited ? 'is-visited' : ''} ${selected === node.id || highlights.includes(node.id) ? 'is-selected' : ''}`} onClick={() => onSelect(node.id)}>
        <circle r={radius} /><text y="1" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: radius < 20 ? 11 : 15 }}><title>{node.label}</title>{node.label.length > (radius < 20 ? 2 : 6) ? `${node.label.slice(0,radius < 20 ? 1 : 4)}…` : node.label}</text>
        <text className="exploration-node-state" y="45" textAnchor="middle">{current ? 'Current' : queued ? 'In queue' : visited ? 'Expanded' : ''}</text>
      </g>; })}
    </svg>
    <div className="exploration-object-buttons" aria-label="Select a graph object">{execution.input.nodes.map(node => <button type="button" key={node.id} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}>Node {node.label}</button>)}</div>
  </>;
}

function DiagramPanel({ panel, selected, onSelect, highlights }: { panel: Extract<ExplorationPanel, { kind: 'diagram' }>; selected: string | null; onSelect: (id: string) => void; highlights: string[] }) {
  const markerId = useId().replace(/[^a-z0-9]/gi, '');
  const nodes = panel.objects.filter(object => object.kind === 'node');
  const pos = (id: string) => { const item = nodes.find(node => node.id === id)!; return { x: 45 + item.position.x * 430, y: 40 + item.position.y * 260 }; };
  return <>
    <svg className="exploration-graph" viewBox="0 0 520 340" role="img" aria-label={`${panel.title}. Select labeled objects below to ask a follow-up.`}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX="22" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
      {panel.objects.filter(object => object.kind === 'edge').map(edge => { const from = pos(edge.from), to = pos(edge.to); return <g key={edge.id}><line className="exploration-edge" x1={from.x} y1={from.y} x2={to.x} y2={to.y} markerEnd={edge.directed ? `url(#${markerId})` : undefined} />{edge.label && <text x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 9} textAnchor="middle">{edge.label}</text>}</g>; })}
      {nodes.map(node => { const point = pos(node.id); return <g key={node.id} transform={`translate(${point.x},${point.y})`} className={`exploration-node ${selected === node.id || highlights.includes(node.id) ? 'is-selected' : ''}`} onClick={() => onSelect(node.id)}><circle r="28" /><text textAnchor="middle" dominantBaseline="middle">{node.label}</text></g>; })}
      {panel.objects.filter(object => object.kind === 'text').map(object => <text key={object.id} x={45 + object.position.x * 430} y={40 + object.position.y * 260} textAnchor="middle">{object.text}</text>)}
    </svg>
    <div className="exploration-object-buttons" aria-label="Select a diagram object">{nodes.map(node => <button type="button" key={node.id} aria-pressed={selected === node.id} onClick={() => onSelect(node.id)}>{node.label}</button>)}</div>
    <details><summary>Diagram in words</summary><ul>{panel.objects.map(object => <li key={object.id}>{object.kind === 'node' ? object.label : object.kind === 'text' ? object.text : `${nodes.find(node => node.id === object.from)?.label} ${object.directed ? 'points to' : 'connects to'} ${nodes.find(node => node.id === object.to)?.label}${object.label ? `: ${object.label}` : ''}`}</li>)}</ul></details>
  </>;
}

function StateTable({ execution, step }: { execution: BfsExecution; step: BfsStep }) {
  return <div className="exploration-table-scroll"><table className="exploration-state-table"><caption>State after step {step.index}</caption><thead><tr><th scope="col">Node</th><th scope="col">State</th><th scope="col">Distance</th><th scope="col">Parent</th></tr></thead><tbody>{execution.input.nodes.map(node => <tr key={node.id}><th scope="row">{node.label}</th><td>{step.current === node.id ? 'Current' : step.queue.includes(node.id) ? 'In queue' : step.expanded.includes(node.id) ? 'Expanded' : 'Not reached'}</td><td>{step.distances[node.id] ?? '—'}</td><td>{nodeName(execution.input, step.parents[node.id] ?? null)}</td></tr>)}</tbody></table></div>;
}

export function ExplorationScene({ spec, state, onChange }: { spec: ExplorationSpec; state: ExplorationViewState; onChange: (next: ExplorationViewState) => void }) {
  if (spec.mode === 'clarify') return <div className="exploration-clarify"><h3>A little more context</h3><p>{spec.question}</p></div>;
  const execution = explorationExecution(spec, state), comparison = spec.mode === 'checked-bfs' && spec.comparison ? runBfs(spec.comparison.input) : null;
  const step = execution?.steps[Math.min(state.step, execution.steps.length - 1)], explanation = spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)];
  const changed = explorationInputsChanged(spec, state), highlights = changed ? [] : (spec.steps.find(item=>item.execution==='primary'&&item.executionStep===state.step)?.highlightIds ?? explanation.highlightIds);
  const authoredStep = !changed ? spec.steps.find(item => item.execution === 'primary' && item.executionStep === state.step) : undefined;
  const finalStep=Math.max(execution?.steps.length??1,comparison?.steps.length??1)-1;
  const select = (selectedObjectId: string) => onChange({ ...state, selectedObjectId });
  const panels = spec.scene.panels;
  return <>
    {spec.mode === 'checked-bfs' && execution && spec.controls.includes('step') && <div className="exploration-step-bar"><div className="action-row"><button className="secondary-button" type="button" disabled={state.step <= 0} onClick={() => onChange({ ...state, step: Math.max(0, state.step - 1) })}>Previous step</button><button className="primary-button" type="button" disabled={state.step >= finalStep} onClick={() => onChange({ ...state, step: state.step + 1 })}>Next step</button><span className="meta">Step {Math.min(state.step, finalStep)} / {finalStep}</span></div></div>}
    <div className={`exploration-scene exploration-layout-${spec.scene.layout}`} aria-label="Generated visual composition">{panels.map(panel => {
      const computation = panel.kind === 'graph' || panel.kind === 'frontier' || panel.kind === 'state-table' ? panel.execution === 'comparison' ? comparison : execution : null;
      const current = computation?.steps[Math.min(state.step, computation.steps.length - 1)];
      return <section key={panel.id} className={`exploration-panel exploration-panel-${panel.kind}`} style={{ gridColumn: `${panel.placement.column} / span ${panel.placement.columnSpan}`, gridRow: panel.placement.row }} aria-label={panel.title}>
        <h3>{panel.title}</h3>
        {panel.kind === 'graph' && computation && <GraphPanel panel={panel} execution={computation} index={state.step} selected={state.selectedObjectId} onSelect={select} highlights={highlights} />}
        {panel.kind === 'diagram' && <DiagramPanel panel={panel} selected={state.selectedObjectId} onSelect={select} highlights={highlights} />}
        {panel.kind === 'frontier' && computation && current && <><p className="meta">First in → first out</p><ol className="exploration-frontier" aria-label={`${panel.title} queue`}>{current.queue.map((id, index) => <li key={id}><span>{index === 0 ? 'Next' : index + 1}</span><strong>{nodeName(computation.input, id)}</strong></li>)}</ol>{!current.queue.length && <p>Queue empty</p>}</>}
        {panel.kind === 'state-table' && computation && current && <StateTable execution={computation} step={current} />}
        {panel.kind === 'text' && <p>{panel.text}</p>}
        {panel.kind === 'steps' && (changed ? <p>The inputs changed. The queue and captions now show the recomputed search; the original authored steps are paused.</p> : <ol className="exploration-explanation-steps">{spec.steps.map((item, index) => <li key={item.id}><button type="button" aria-current={state.explanationStep === index ? 'step' : undefined} onClick={() => onChange({ ...state, explanationStep: index, ...(item.executionStep !== null ? { step: item.executionStep } : {}) })}>{item.caption}</button></li>)}</ol>)}
      </section>;
    })}</div>
    <div className="exploration-caption" aria-live="polite"><span className="overline">{execution ? `Search step ${step?.index ?? 0}` : `Explanation ${state.explanationStep + 1} of ${spec.steps.length}`}</span><p>{explorationVisibleCaption(spec, state)}</p>{authoredStep && <p className="exploration-authored-caption">Soma’s explanation: {authoredStep.caption}</p>}</div>
    {spec.mode === 'checked-bfs' && execution && <div className="exploration-controls" aria-label="Search controls">
      {spec.controls.includes('replay') && <button className="text-button" type="button" onClick={() => onChange({ ...state, step: 0, explanationStep: 0 })}>Restart search</button>}
      <div className="exploration-inputs">{spec.controls.includes('set-start') && <label>Start node<select value={state.start ?? spec.input.start} onChange={event => onChange({ ...state, start: event.target.value, step: 0 })}>{spec.input.nodes.map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>}{spec.controls.includes('set-goal') && <label>Goal node<select value={state.goal ?? ''} onChange={event => onChange({ ...state, goal: event.target.value || null, step: 0 })}><option value="">Explore every reachable node</option>{spec.input.nodes.map(node => <option key={node.id} value={node.id}>{node.label}</option>)}</select></label>}</div>
      {spec.controls.includes('reverse-neighbor-order') && <button className="secondary-button" type="button" aria-pressed={state.reversed} onClick={() => onChange({ ...state, reversed: !state.reversed, step: 0 })}>Reverse neighbor order</button>}
      {spec.controls.includes('toggle-edge') && <details><summary>Change a connection</summary><p className="meta">Recomputes this experiment. Your source stays unchanged.</p><div className="exploration-edge-controls">{spec.input.edges.map(edge => <label key={edge.id}><input type="checkbox" checked={!state.disabledEdgeIds.includes(edge.id)} onChange={() => onChange({ ...state, step: 0, disabledEdgeIds: state.disabledEdgeIds.includes(edge.id) ? state.disabledEdgeIds.filter(id => id !== edge.id) : [...state.disabledEdgeIds, edge.id] })} />{nodeName(spec.input, edge.from)} {spec.input.directed ? '→' : '—'} {nodeName(spec.input, edge.to)}</label>)}</div></details>}
      <details><summary>Search state in a table</summary><StateTable execution={execution} step={step!} /></details>
      <p className="meta">Unweighted {spec.input.directed ? 'directed' : 'undirected'} graph · visited when added to queue · stops when the goal leaves the queue.</p>
    </div>}
    {spec.mode === 'explanation' && <div className="action-row"><button className="secondary-button" type="button" disabled={state.explanationStep <= 0} onClick={() => onChange({ ...state, explanationStep: state.explanationStep - 1 })}>Previous explanation</button><button className="primary-button" type="button" disabled={state.explanationStep >= spec.steps.length - 1} onClick={() => onChange({ ...state, explanationStep: state.explanationStep + 1 })}>Next explanation</button></div>}
  </>;
}
