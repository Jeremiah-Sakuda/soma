import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Anatomy from '@/components/anatomy-canvas';
import { spatialScene } from '@/lib/domain/spatial-exploration';
import { defaultSpatialView, type SpatialView } from '@/lib/domain/spatial-schema';
import type { ExplorationArtifact } from '@/lib/server/exploration-types';
import pairsData from '../comparisons.json';
import '@/components/exploration.css';
import './style.css';
const Three = lazy(() => import('@/components/spatial-canvas'));
type Pair = { id: string; label: string; source: string; before: ExplorationArtifact; after: ExplorationArtifact; reusedAfter: boolean };
const pairs = pairsData as Pair[];

function Plate({ artifact, variant, phase, view, onView, renderer, overrides, onParameter }: { artifact: ExplorationArtifact; variant: 'before' | 'after'; phase: number; view: SpatialView; onView: (v: Partial<SpatialView>) => void; renderer: string; overrides: Record<string, number>; onParameter: (values: Record<string, number>) => void }) {
  const [selected, setSelected] = useState<string | null>(null), [failed, setFailed] = useState(false);
  const spec = artifact.spec;
  const state = useMemo(() => ({ ...artifact.state, selectedObjectId: selected, explanationStep: spec.mode === 'explanation' ? Math.round(phase * (spec.steps.length - 1)) : 0, spatial: { ...view, parameters: variant === 'after' ? overrides : {} } }), [artifact, phase, view, selected, overrides, variant, spec]);
  const scene = useMemo(() => spatialScene(spec, state), [spec, state]);
  if (!scene || spec.mode !== 'explanation') return <p>Unavailable example. No substitute output has been invented.</p>;
  const pieces = scene.objects.reduce((sum, o) => sum + (o.geometry?.length ?? 0), 0), manual = Object.keys(overrides).length > 0 && variant === 'after';
  return <article className={`plate ${variant}`} data-variant={variant}>
    <header><span className="eyebrow">{variant === 'before' ? 'Before' : 'After'}</span><h2>{variant === 'before' ? 'Fixed parts' : 'Muse-built geometry'}</h2><span className="plate-count">{pieces ? `${pieces} shapes · ${scene.parameters?.length ?? 0} motion control` : `${scene.objects.length} parts · step poses`}</span></header>
    <div className="comparison-stage">
      {renderer === 'three' && !failed ? <Suspense fallback={<p className="loading">Opening 3D…</p>}><Three scene={scene} view={view} selected={selected} onSelect={setSelected} onView={onView} onFailure={() => setFailed(true)} /></Suspense>
        : <Anatomy scene={scene} view={view} selected={selected} onSelect={setSelected} onView={onView} />}
    </div>
    {failed && renderer === 'three' && <p className="small" role="status">3D unavailable here. Showing the illustration.</p>}
    <p className="caption" aria-live="polite">{manual ? 'Your custom pose. Use “Follow steps” to return to the authored motion.' : spec.steps[state.explanationStep].caption}</p>
    {variant === 'after' && !!scene.parameters?.length && <div className="motion-controls">{scene.parameters.map(p => <label key={p.id}><span>{p.label}<output>{Math.round(p.value * 100)}%</output></span><input aria-label={p.label} aria-valuetext={`${Math.round(p.value * 100)} percent, illustrative movement`} type="range" min="0" max="1" step=".01" value={p.value} onChange={e => onParameter({ ...overrides, [p.id]: Number(e.target.value) })} /></label>)}{manual && <button className="quiet" onClick={() => onParameter({})}>Follow steps</button>}</div>}
    <details className="parts"><summary>Inspect parts</summary><div className="part-buttons">{scene.objects.map((o, index) => <button key={o.id} aria-pressed={selected === o.id} onClick={() => setSelected(selected === o.id ? null : o.id)}>{index + 1}. {o.label}</button>)}</div>{selected && <p>{scene.objects.find(o => o.id === selected)?.description}</p>}</details>
  </article>;
}
function Gallery() {
  const [caseId, setCase] = useState(location.hash.slice(1) || pairs[0].id), [phase, setPhase] = useState(.5), [view, setView] = useState(defaultSpatialView), [renderer, setRenderer] = useState('anatomy'), [overrides, setOverrides] = useState<Record<string, number>>({});
  useEffect(() => {
    const sync = () => { const id = location.hash.slice(1); if (pairs.some(p => p.id === id)) { setCase(id); setOverrides({}); setPhase(.5); setView(defaultSpatialView()); } };
    addEventListener('hashchange', sync); return () => removeEventListener('hashchange', sync);
  }, []);
  const pair = pairs.find(p => p.id === caseId) ?? pairs[0];
  const updateView = (v: Partial<SpatialView>) => setView(old => ({ ...old, ...v }));
  const choose = (id: string) => { setCase(id); location.hash = id; setOverrides({}); setPhase(.5); setView(defaultSpatialView()); };
  return <main>
    <header className="masthead"><a href="http://localhost:41906/explore">Soma <span>/ visual experiments</span></a><span className="recording-tag">Actual Muse recordings</span></header>
    <div className="intro"><div><h1>More room for Muse.</h1><p>Same source. Same renderer. Before and after geometry authoring.</p></div><div className="renderer-switch" role="group" aria-label="Renderer"><button aria-pressed={renderer === 'anatomy'} onClick={() => setRenderer('anatomy')}>Illustration</button><button aria-pressed={renderer === 'three'} onClick={() => setRenderer('three')}>3D</button></div></div>
    <nav className="case-switch" aria-label="Examples">{pairs.map((p, i) => <button key={p.id} aria-pressed={pair.id === p.id} onClick={() => choose(p.id)}><span>0{i + 1}</span>{p.label}</button>)}</nav>
    <section aria-label={`${pair.label} comparison`}>
      <div className="comparison-toolbar"><div className="steps" role="group" aria-label="Explanation stage">{[['Start', 0], ['Middle', .5], ['End', 1]].map(([label, value]) => <button key={label} aria-pressed={phase === value} onClick={() => { setPhase(Number(value)); setOverrides({}); }}>{label}</button>)}</div><div className="cameras" role="group" aria-label="Shared camera"><button onClick={() => updateView({ azimuth: 35, elevation: 25 })}>Perspective</button><button onClick={() => updateView({ azimuth: 0, elevation: 0 })}>Front</button><button onClick={() => updateView({ azimuth: 35, elevation: 85 })}>Above</button><button aria-label="Rotate both left" onClick={() => updateView({ azimuth: ((view.azimuth - 25 + 540) % 360) - 180 })}>↶</button><button aria-label="Rotate both right" onClick={() => updateView({ azimuth: ((view.azimuth + 25 + 540) % 360) - 180 })}>↷</button></div></div>
      <p className="comparison-note">{pair.id === 'gate' ? 'Before approximates a hinge with shifted parts. After defines a pivot and coupled rotation.' : pair.id === 'piston' ? 'After builds the guide, head, rod and grip separately, with one shared movement control.' : 'Before has a source mismatch: each “blade” uses a complete turbine preset. Original outputs are shown unchanged.'}</p>
      <div className="plates">{(['before', 'after'] as const).map(variant => <Plate key={`${pair.id}-${variant}-${renderer}`} artifact={pair[variant]} variant={variant} phase={phase} view={view} onView={updateView} renderer={renderer} overrides={overrides} onParameter={setOverrides} />)}</div>
    </section>
    <details className="provenance"><summary>Source & generation details</summary><div className="source-details"><img src={pair.source} alt={`Original synthetic ${pair.label.toLowerCase()} source shown to both models`} /><div><h3>One source, two contracts</h3><p>Before: Muse selected from the previous catalog and basic shapes. After: Muse constructed bounded shapes and movement. Both use the same current renderer and camera, fitted separately to the viewport.</p><p>These are independent generations, not a controlled quality benchmark. Only the spatial panel is shown; complete accepted responses are preserved.</p>{pair.id === 'rotor' && <p>After needed a second generation attempt. The failed first attempt remains charged at $0.0526; the figures below describe the accepted attempt.</p>}{(['before', 'after'] as const).map(v => <p key={v}><strong>{v === 'before' ? 'Before' : 'After'}</strong> · {pair[v].generation.calls} original calls · ${pair[v].generation.costUsd.toFixed(4)} · {(pair[v].generation.elapsedMs / 1000).toFixed(1)}s · {new Date(pair[v].createdAt).toLocaleString()}{v === 'after' && pair.reusedAfter ? ' · reused accepted gate run' : ''}</p>)}</div></div></details>
    <footer>Original synthetic sources · illustrative motion, not checked physics · no inference on replay</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<Gallery />);
