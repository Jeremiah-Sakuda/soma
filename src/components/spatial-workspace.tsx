'use client';

import dynamic from 'next/dynamic.js';
import { RotateCcw, RotateCw } from 'lucide-react';
import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { crankTweenMs, easeCrank, engineCrank, poseEngineParts } from '@/lib/domain/engine-kinematics';
import type { ExplorationSpec } from '@/lib/domain/exploration';
import type { ExplorationViewState } from '@/lib/domain/exploration-view';
import { spatialScene, spatialPresentation, type SpatialScene } from '@/lib/domain/spatial-exploration';
import { defaultSpatialView, type SpatialView } from '@/lib/domain/spatial-schema';
import SpatialHeightReadout from './spatial-height-readout';

const Canvas = dynamic(() => import('./spatial-canvas'), { ssr: false, loading: () => <p role="status" className="spatial-loading">Opening the spatial view…</p> });
const Anatomy = dynamic(() => import('./anatomy-canvas'), { ssr: false, loading: () => <p role="status" className="spatial-loading">Drawing the Anatomy illustration…</p> });
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
    <defs><marker id="spatial-flat-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto"><path d="M1 1L9 5L1 9z" fill="context-stroke" /></marker></defs>
    {scene.connections.map((edge) => {
      const from = visible.find((o) => o.id === edge.from), to = visible.find((o) => o.id === edge.to);
      if (!from || !to) return null;
      const a = project(from.position.x, from.position.y), b = project(to.position.x, to.position.y);
      return <line key={edge.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={edge.highlighted ? '#52775f' : '#a3aa9f'} strokeWidth="3" strokeDasharray={edge.active ? undefined : '5 5'} />;
    })}
    {visible.map((object) => {
      const p = project(object.position.x, object.position.y), shell = scene.objects.some((o) => o.parentId === object.id);
      return <g key={object.id} data-spatial-object={object.id} data-position={JSON.stringify(object.position)}>
        {object.shape === 'sheet' && object.path?.length ? <polygon points={object.path.map((q) => { const r = project(q.x, q.y); return `${r.x},${r.y}`; }).join(' ')} fill={palette[object.color]} fillOpacity="0.35" stroke={palette[object.color]} strokeWidth={object.highlighted ? 3 : 2} />
        : object.path?.length ? <polyline points={object.path.map((q) => { const r = project(q.x, q.y); return `${r.x},${r.y}`; }).join(' ')} fill="none" stroke={palette[object.color]} strokeWidth={object.highlighted ? 6 : 4} strokeLinecap="round" markerEnd={object.shape === 'arrow' ? 'url(#spatial-flat-arrow)' : undefined} />
        : object.shape === 'sphere' || object.shape === 'torus'
          ? <ellipse cx={p.x} cy={p.y} rx={Math.max(7, object.size.x / extent * 105)} ry={Math.max(7, object.size.y / extent * 55)} fill={object.shape === 'torus' ? 'none' : palette[object.color]} fillOpacity={shell ? 0.1 : 0.8} stroke={palette[object.color]} strokeWidth={object.highlighted ? 4 : 2} />
          : <rect x={p.x - object.size.x / extent * 105} y={p.y - object.size.y / extent * 55} width={object.size.x / extent * 210} height={object.size.y / extent * 110} rx="8" fill={palette[object.color]} fillOpacity={shell ? 0.1 : 0.8} stroke={palette[object.color]} strokeWidth={object.highlighted ? 4 : 2} />}
      </g>;
    })}
  </svg>;
}

/** The crank angle to show: a step's new angle is reached by turning, unless the learner is
 * dragging the control themself or prefers reduced motion. */
function useCrankMotion(base: SpatialScene | null) {
  const target = base ? engineCrank(base.objects) : undefined;
  const dragging = base?.parameters?.some((p) => p.id === 'crank' && p.overridden) ?? false;
  const [shown, setShown] = useState(target);
  const current = useRef(target);
  useEffect(() => {
    if (target === undefined) return;
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = current.current;
    if (dragging || reduced || from === undefined || Math.abs(target - from) < 0.004) {
      current.current = target;
      setShown(target);
      return;
    }
    const began = performance.now(), ms = crankTweenMs(target - from);
    let frame = requestAnimationFrame(function turn(now) {
      const p = Math.min(1, (now - began) / ms);
      current.current = from + (target - from) * easeCrank(p);
      setShown(current.current);
      if (p < 1) frame = requestAnimationFrame(turn);
    });
    return () => cancelAnimationFrame(frame);
  }, [target, dragging]);
  return target === undefined ? undefined : shown;
}

export default function SpatialWorkspace({ spec, state, onChange, which = 'primary' }: {
  spec: ExplorationSpec; state: ExplorationViewState; onChange: (state: ExplorationViewState) => void; which?: 'primary' | 'comparison';
}) {
  const [failed, setFailed] = useState(false), [attempt, setAttempt] = useState(0);
  const [compare, setCompare] = useState(false);
  const view = state.spatial ?? defaultSpatialView();
  const { spatial: _view, selectedObjectId: _selection, ...computation } = state;
  const parameterKey = JSON.stringify(view.parameters ?? {});
  const computationKey = JSON.stringify(computation);
  const authoredBase = useMemo(() => spatialScene(spec, state, which), [spec, computationKey, parameterKey, which]);
  const crank = useCrankMotion(authoredBase);
  const base = useMemo(() => authoredBase && crank !== undefined && crank !== engineCrank(authoredBase.objects)
    ? { ...authoredBase, objects: poseEngineParts(authoredBase.objects, crank), parameters: authoredBase.parameters?.map((p) => (p.id === 'crank' ? { ...p, value: crank } : p)) }
    : authoredBase, [authoredBase, crank]);
  const scene = useMemo(() => base ? spatialPresentation(base, state) : null, [base, view.spread, view.isolate, state.selectedObjectId]);
  if (!scene || !base) return null;
  const update = (change: Partial<SpatialView>) => onChange({ ...state, spatial: { ...view, ...change } });
  const select = (id: string) => onChange({ ...state, selectedObjectId: id });
  const selected = scene.objects.find((object) => object.id === state.selectedObjectId);
  const selectedEdge = base.connections.find((edge) => edge.id === state.selectedObjectId);
  const rotate = (amount: number) => update({ azimuth: ((view.azimuth + amount + 180) % 360 + 360) % 360 - 180 });
  const spatial3d = view.mode === '3d';
  const anatomy = view.renderer === 'anatomy';
  const hasEnclosure = base.objects.some(object => object.renderStyle === 'housing');
  const authored = base.objects.some(object => object.geometry?.length);
  const stage = (renderer: 'three' | 'anatomy') => <div className="spatial-stage" data-spatial-mode={spatial3d && (renderer === 'anatomy' || !failed) ? '3d' : '2d'} data-renderer={renderer}>
    {spatial3d && renderer === 'anatomy' ? <Anatomy scene={scene} view={view} selected={state.selectedObjectId} onSelect={select} onView={update} />
      : spatial3d && !failed ? <CanvasBoundary key={attempt} onFailure={() => setFailed(true)}>
        <Canvas scene={scene} view={view} selected={state.selectedObjectId} onSelect={select} onView={update} onFailure={() => setFailed(true)} />
      </CanvasBoundary> : authored ? <Anatomy scene={scene} view={{ ...view, azimuth: 0, elevation: 0 }} selected={state.selectedObjectId} onSelect={select} onView={update} /> : <FlatScene scene={scene} />}
    <span className="spatial-stage-note" aria-hidden="true">{spatial3d && renderer === 'anatomy' ? 'Drag to rotate · numbered parts below' : spatial3d && !failed ? 'Drag to orbit · select a part' : 'Front projection · select a part below'}</span>
  </div>;
  return <section className="spatial-workspace" aria-label="Spatial workspace">
    <div className="spatial-heading">
      <div><span className="overline">{scene.assurance === 'checked' ? scene.checkedLabel ?? 'Checked search · spatial view' : '3D schematic · explanation only'}</span><h3>{scene.title}</h3></div>
      <span className="spatial-state-label">{view.spread > 0 ? 'Separated' : 'Assembled'}{view.slice > 0 && spatial3d ? ' · Cutaway' : ''}</span>
    </div>
    <p className="meta spatial-assurance">{scene.assurance === 'checked'
      ? scene.heightNote ?? 'Height represents the current computed distance. Unreached nodes have unknown distance. Camera and separation never change the search.'
      : 'Shapes, depth and motion illustrate the explanation. They are not recovered geometry or a checked physical simulation.'}</p>
    {scene.annotations?.map((text, index) => <p className="meta" key={index}>{text}</p>)}
    {spatial3d && <div className="spatial-renderer-switch" role="group" aria-label="Compare rendering approaches">
      <button type="button" aria-pressed={!anatomy && !compare} onClick={() => { setCompare(false); update({ renderer: 'three' }); }}>Current 3D</button>
      <button type="button" aria-pressed={anatomy && !compare} onClick={() => { setCompare(false); update({ renderer: 'anatomy' }); }}>Anatomy illustration</button>
      <button type="button" aria-pressed={compare} onClick={() => setCompare(!compare)}>Side by side</button>
    </div>}
    {compare && spatial3d ? <div className="spatial-comparison">
      <figure><figcaption>Current 3D <span>Perspective meshes</span></figcaption>{stage('three')}</figure>
      <figure><figcaption>Anatomy <span>Isometric illustration</span></figcaption>{stage('anatomy')}</figure>
    </div> : stage(anatomy ? 'anatomy' : 'three')}
    <SpatialHeightReadout spec={spec} state={state} which={which} />
    {compare && spatial3d && <p className="spatial-detail-note">Same scene, step and selected part. Controls below update both views.</p>}
    {anatomy && spatial3d && <p className="spatial-detail-note">{hasEnclosure ? 'Cutaway opens enclosure walls in the illustration.' : authored ? 'Use separation and isolation to inspect this drawing.' : 'This illustration has no enclosure to cut away.'}{view.elevation < 0 ? ' Below-ground camera angles use ground level.' : ''}</p>}
    {authored && <p className="spatial-detail-note">Custom geometry specification · motion is illustrative, not a checked physical model</p>}
    {!!scene.parameters?.length && <div className="mechanism-controls" role="group" aria-label="Mechanism controls">
      {scene.parameters.map(parameter => <label key={parameter.id}><span>{parameter.label} <output>{Math.round(parameter.value * 100)}%{parameter.overridden ? ' · Your setting' : ' · Explanation'}</output></span>
        <input type="range" aria-label={parameter.label} aria-valuetext={`${Math.round(parameter.value * 100)} percent, ${parameter.overridden ? 'your setting' : 'explanation step'}`} min="0" max="1" step="0.01" value={parameter.value} onChange={event => update({ parameters: { ...view.parameters, [parameter.id]: Number(event.target.value) } })} />
        <span className="meta">{parameter.description}</span></label>)}
      {scene.parameters.some(p => p.overridden) && <><p className="meta">Your controls override the explanation’s motion. Follow explanation motion to match each step.</p><button type="button" onClick={() => update({ parameters: {} })}>Follow explanation motion</button></>}
    </div>}
    {failed && spatial3d && (!anatomy || compare) && <div className="spatial-fallback" role="status">3D is unavailable on this device. Your scene and controls are preserved in the front projection. <button type="button" onClick={() => { setFailed(false); setAttempt(attempt + 1); }}>Retry 3D</button></div>}
    {base.objects.some((object) => object.renderStyle) && <p className="spatial-detail-note">Illustrative parts · geometry and detail are schematic</p>}
    <div className="spatial-toolbar" aria-label="Spatial view controls">
      {spatial3d && <>
        <div className="spatial-camera-buttons" role="group" aria-label="Camera views">
          <button type="button" aria-pressed={view.azimuth === 35 && view.elevation === 25} onClick={() => update({ azimuth: 35, elevation: 25, zoom: 1 })}>Perspective</button>
          <button type="button" aria-pressed={view.azimuth === 0 && view.elevation === 0} onClick={() => update({ azimuth: 0, elevation: 0, zoom: 1 })}>Front</button>
          <button type="button" aria-pressed={view.azimuth === 0 && view.elevation === 85} onClick={() => update({ azimuth: 0, elevation: 85, zoom: 1 })}>Above</button>
          <button type="button" aria-pressed={view.azimuth === 90 && view.elevation === 0} onClick={() => update({ azimuth: 90, elevation: 0, zoom: 1 })}>Side</button>
          <button type="button" aria-label="Rotate left" onClick={() => rotate(-20)}><RotateCcw size={17} aria-hidden="true" /></button>
          <button type="button" aria-label="Rotate right" onClick={() => rotate(20)}><RotateCw size={17} aria-hidden="true" /></button>
        </div>
        <label>Zoom<input aria-label="Spatial zoom" type="range" min="0.65" max="2" step="0.05" value={view.zoom} onChange={(event) => update({ zoom: Number(event.target.value) })} /></label>
      </>}
      <label>Separate parts<input aria-label="Separate parts" type="range" min="0" max="1" step="0.05" value={view.spread} onChange={(event) => update({ spread: Number(event.target.value) })} /></label>
      {spatial3d && (!failed || anatomy || compare) && <label>Cutaway<input aria-label="Cutaway" type="range" min="0" max="1" step="0.05" disabled={anatomy && !compare && !hasEnclosure} value={view.slice} onChange={(event) => update({ slice: Number(event.target.value) })} /></label>}
      <div className="spatial-camera-buttons">
        <button type="button" disabled={!selected && !view.isolate} aria-pressed={view.isolate} onClick={() => update({ isolate: !view.isolate })}>{view.isolate ? 'Show all parts' : 'Isolate selected'}</button>
        <button type="button" onClick={() => update({ ...defaultSpatialView(), mode: view.mode })}>Reset view</button>
      </div>
    </div>
    <div className="spatial-object-buttons" role="group" aria-label="Select a spatial object">
      {base.objects.map((object, index) => <button key={object.id} type="button" aria-pressed={state.selectedObjectId === object.id} onClick={() => select(object.id)}>{spatial3d && (anatomy || compare) ? <b className="anatomy-object-number" aria-hidden="true">{index + 1}</b> : <span style={{ background: palette[object.color] }} aria-hidden="true" />}{object.label}</button>)}
    </div>
    {(selected || selectedEdge) && <div className="spatial-inspector" role="status">
      <span className="overline">Inspecting</span><strong>{selected?.label ?? selectedEdge?.label}</strong>
      <p>{selected ? selected.description : `${base.objects.find((o) => o.id === selectedEdge!.from)?.label} ${selectedEdge!.directed ? '→' : '—'} ${base.objects.find((o) => o.id === selectedEdge!.to)?.label}`}</p>
      {selected && !selected.visible && <p>This part is hidden at the current step or by isolation.</p>}
      <span className="meta">Selected for your next question. Source facts remain unchanged.</span>
    </div>}
    <details className="spatial-description"><summary>Objects, connections & spatial state</summary>
      {authored && <p>Custom geometry is stored with this version. Each surface has a stated purpose; the application validates its format and bounds.</p>}
      <ul>{base.objects.map((object) => <li key={object.id}><strong>{object.label}</strong> — {object.description} {object.parentId ? `Inside ${base.objects.find((o) => o.id === object.parentId)?.label}. ` : ''}{object.status}. Position ({object.position.x}, {object.position.y}, {object.position.z}).</li>)}</ul>
      {authored && <ul>{base.objects.flatMap(object => (object.geometry ?? []).map(piece => <li key={`${object.id}:${piece.id}`}><strong>{object.label} / {piece.id}</strong> · {piece.form.kind} — {piece.purpose}{piece.driver ? ` Motion follows ${scene.parameters?.find(p => p.id === piece.driver!.parameterId)?.label}.` : ''}</li>))}</ul>}
      <ul>{base.connections.map((edge) => <li key={edge.id}><button type="button" aria-pressed={state.selectedObjectId === edge.id} onClick={() => select(edge.id)}>{base.objects.find((o) => o.id === edge.from)?.label} {edge.directed ? '→' : '—'} {base.objects.find((o) => o.id === edge.to)?.label}{edge.label ? `: ${edge.label}` : ''}{edge.active ? '' : ' (disabled)'}</button></li>)}</ul>
    </details>
  </section>;
}
