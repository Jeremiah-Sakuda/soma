'use client';

import dynamic from 'next/dynamic.js';
import { Component, useMemo, useState, type ReactNode } from 'react';
import type { ExplorationSpec } from '@/lib/domain/exploration';
import type { ExplorationViewState } from '@/lib/domain/exploration-view';
import { spatialScene, spatialPresentation, type SpatialScene } from '@/lib/domain/spatial-exploration';
import { defaultSpatialView, type SpatialView } from '@/lib/domain/spatial-schema';

const Canvas = dynamic(() => import('./spatial-canvas'), { ssr: false, loading: () => <p role="status" className="spatial-loading">Opening the spatial view…</p> });
class CanvasBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
const palette = { clay: '#bc704f', sage: '#688674', blue: '#698aa1', gold: '#b58f43', violet: '#8a77a5' };
function FlatScene({ scene }: { scene: SpatialScene }) {
  const visible = scene.objects.filter((object) => object.visible);
  const extent = Math.max(3, ...scene.objects.flatMap((o) => [Math.abs(o.position.x) + o.size.x / 2, Math.abs(o.position.y) + o.size.y / 2]));
  const project = (x: number, y: number) => ({ x: 320 + (x / extent) * 210, y: 160 - (y / extent) * 110 });
  return <svg className="spatial-flat" viewBox="0 0 640 320" role="img" aria-label={`${scene.title}, front projection. Inspect each object using the list below.`}>
    {scene.connections.map((edge) => {
      const from = visible.find((o) => o.id === edge.from), to = visible.find((o) => o.id === edge.to);
      if (!from || !to) return null;
      const a = project(from.position.x, from.position.y), b = project(to.position.x, to.position.y);
      return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edge.highlighted ? '#52775f' : '#a3aa9f'} strokeWidth="3" strokeDasharray={edge.active ? undefined : '5 5'} />;
    })}
    {visible.map((object) => {
      const p = project(object.position.x, object.position.y), shell = scene.objects.some((o) => o.parentId === object.id);
      return <g key={object.id} data-spatial-object={object.id} data-position={JSON.stringify(object.position)}>
        {object.shape === 'sphere' || object.shape === 'torus'
          ? <ellipse cx={p.x} cy={p.y} rx={Math.max(7, object.size.x / extent * 105)} ry={Math.max(7, object.size.y / extent * 55)} fill={object.shape === 'torus' ? 'none' : palette[object.color]} fillOpacity={shell ? 0.1 : 0.8} stroke={palette[object.color]} strokeWidth={object.highlighted ? 4 : 2} />
          : <rect x={p.x - object.size.x / extent * 105} y={p.y - object.size.y / extent * 55} width={object.size.x / extent * 210} height={object.size.y / extent * 110} rx="8" fill={palette[object.color]} fillOpacity={shell ? 0.1 : 0.8} stroke={palette[object.color]} strokeWidth={object.highlighted ? 4 : 2} />}
      </g>;
    })}
  </svg>;
}

export default function SpatialWorkspace({ spec, state, onChange, which = 'primary' }: {
  spec: ExplorationSpec; state: ExplorationViewState; onChange: (state: ExplorationViewState) => void; which?: 'primary' | 'comparison';
}) {
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const view = state.spatial ?? defaultSpatialView();
  const { spatial: _view, selectedObjectId: _selection, ...computation } = state;
  const computationKey = JSON.stringify(computation);
  const base = useMemo(() => spatialScene(spec, state, which), [spec, computationKey, which]);
  const scene = useMemo(() => base ? spatialPresentation(base, state) : null, [base, view.spread, view.isolate, state.selectedObjectId]);
  if (!scene || !base) return null;
  const update = (change: Partial<SpatialView>) => onChange({ ...state, spatial: { ...view, ...change } });
  const select = (id: string) => onChange({ ...state, selectedObjectId: id });
  const selected = scene.objects.find((object) => object.id === state.selectedObjectId);
  const selectedEdge = base.connections.find((edge) => edge.id === state.selectedObjectId);
  const rotate = (amount: number) => update({ azimuth: ((view.azimuth + amount + 180) % 360 + 360) % 360 - 180 });
  const spatial3d = view.mode === '3d';
  return <section className="spatial-workspace" aria-label="Spatial workspace">
    <div className="spatial-heading">
      <div><span className="overline">{scene.assurance === 'checked' ? 'Checked search · spatial view' : '3D schematic · explanation only'}</span><h3>{scene.title}</h3></div>
      <span className="spatial-state-label">{view.spread > 0 ? 'Separated' : 'Assembled'}{view.slice > 0 && spatial3d ? ' · Cutaway' : ''}</span>
    </div>
    <p className="meta spatial-assurance">{scene.assurance === 'checked'
      ? 'Height represents the current computed distance. Unreached nodes have unknown distance. Camera and separation never change the search.'
      : 'Shapes, depth and motion illustrate the explanation. They are not recovered geometry or a checked physical simulation.'}</p>
    <div className="spatial-stage" data-spatial-mode={spatial3d && !failed ? '3d' : '2d'}>
      {spatial3d && !failed ? <CanvasBoundary key={attempt} onFailure={() => setFailed(true)}>
        <Canvas scene={scene} view={view} selected={state.selectedObjectId} onSelect={select} onView={(next) => update(next)} onFailure={() => setFailed(true)} />
      </CanvasBoundary> : <FlatScene scene={scene} />}
      <span className="spatial-stage-note" aria-hidden="true">{spatial3d && !failed ? 'Drag to orbit · select a part' : 'Front projection · select a part below'}</span>
    </div>
    {failed && spatial3d && <div className="spatial-fallback" role="status">3D is unavailable on this device. Your scene and controls are preserved in the front projection. <button type="button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry 3D</button></div>}
    <div className="spatial-toolbar" aria-label="Spatial view controls">
      {spatial3d && <>
        <div className="spatial-camera-buttons" role="group" aria-label="Camera views">
          <button type="button" onClick={() => update({ azimuth: 35, elevation: 25, zoom: 1 })}>Perspective</button>
          <button type="button" onClick={() => update({ azimuth: 0, elevation: 0, zoom: 1 })}>Front</button>
          <button type="button" onClick={() => update({ azimuth: 0, elevation: 85, zoom: 1 })}>Above</button>
          <button type="button" onClick={() => update({ azimuth: 90, elevation: 0, zoom: 1 })}>Side</button>
          <button type="button" aria-label="Rotate left" onClick={() => rotate(-20)}>↶</button>
          <button type="button" aria-label="Rotate right" onClick={() => rotate(20)}>↷</button>
        </div>
        <label>Zoom<input aria-label="Spatial zoom" type="range" min="0.65" max="2" step="0.05" value={view.zoom} onChange={(event) => update({ zoom: Number(event.target.value) })} /></label>
      </>}
      <label>Separate parts<input aria-label="Separate parts" type="range" min="0" max="1" step="0.05" value={view.spread} onChange={(event) => update({ spread: Number(event.target.value) })} /></label>
      {spatial3d && !failed && <label>Cutaway<input aria-label="Cutaway" type="range" min="0" max="1" step="0.05" value={view.slice} onChange={(event) => update({ slice: Number(event.target.value) })} /></label>}
      <div className="spatial-camera-buttons">
        <button type="button" disabled={!selected && !view.isolate} aria-pressed={view.isolate} onClick={() => update({ isolate: !view.isolate })}>{view.isolate ? 'Show all parts' : 'Isolate selected'}</button>
        <button type="button" onClick={() => update({ ...defaultSpatialView(), mode: view.mode })}>Reset view</button>
      </div>
    </div>
    <div className="spatial-object-buttons" role="group" aria-label="Select a spatial object">
      {base.objects.map((object) => <button key={object.id} type="button" aria-pressed={state.selectedObjectId === object.id} onClick={() => select(object.id)}><span style={{ background: palette[object.color] }} aria-hidden="true" />{object.label}</button>)}
    </div>
    {(selected || selectedEdge) && <div className="spatial-inspector" role="status">
      <strong>{selected?.label ?? selectedEdge?.label}</strong>
      <p>{selected ? selected.description : `${base.objects.find((o) => o.id === selectedEdge!.from)?.label} ${selectedEdge!.directed ? '→' : '—'} ${base.objects.find((o) => o.id === selectedEdge!.to)?.label}`}</p>
      {selected && !selected.visible && <p>This part is hidden at the current step or by isolation.</p>}
      <span className="meta">Selected for your next question. Source facts remain unchanged.</span>
    </div>}
    <details className="spatial-description"><summary>Objects, connections & spatial state</summary>
      <ul>{base.objects.map((object) => <li key={object.id}><strong>{object.label}</strong> — {object.description} {object.parentId ? `Inside ${base.objects.find((o) => o.id === object.parentId)?.label}. ` : ''}{object.status}. Position ({object.position.x}, {object.position.y}, {object.position.z}).</li>)}</ul>
      <ul>{base.connections.map((edge) => <li key={edge.id}><button type="button" aria-pressed={state.selectedObjectId === edge.id} onClick={() => select(edge.id)}>{base.objects.find((o) => o.id === edge.from)?.label} {edge.directed ? '→' : '—'} {base.objects.find((o) => o.id === edge.to)?.label}{edge.label ? `: ${edge.label}` : ''}{edge.active ? '' : ' (disabled)'}</button></li>)}</ul>
    </details>
  </section>;
}
