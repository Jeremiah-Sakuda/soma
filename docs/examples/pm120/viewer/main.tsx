import { useEffect, useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import Anatomy from '@/components/anatomy-canvas';
import { spatialScene } from '@/lib/domain/spatial-exploration';
import { defaultSpatialView } from '@/lib/domain/spatial-schema';
import type { ExplorationArtifact } from '@/lib/server/exploration-types';
import { MotionScene } from '../lib/MotionScene';
import { filmFrame, validateFilm } from '../lib/motion-film';
import rawFilm from '../film.json';
import receipt from '../generation-receipt.json';
import pairs from '../../pm117/comparisons.json';
import '@/components/exploration.css';
import './style.css';
const film = validateFilm(rawFilm);
const baseline = pairs.find(p => p.id === 'piston')!.after as unknown as ExplorationArtifact;
const format = (n: number) => `${Math.floor(n / 60)}:${String(Math.floor(n % 60)).padStart(2, '0')}`;
function Comparison() {
  const [time, setTime] = useState(0), [playing, setPlaying] = useState(false), [sound, setSound] = useState(true), [manual, setManual] = useState<number | null>(null), [reduced, setReduced] = useState(false), [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<string | null>(null), [view, setView] = useState(defaultSpatialView);
  const audio = useRef<HTMLAudioElement>(null), frame = useRef(0), operation = useRef(0), currentTime = useRef(0);
  const move = (value: number) => { const n = Math.max(0, Math.min(film.duration, value)); currentTime.current = n; setTime(n); };
  const stop = () => { operation.current++; cancelAnimationFrame(frame.current); audio.current?.pause(); setPlaying(false); };
  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)'), update = () => setReduced(media.matches);
    update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (!playing) return;
    const token = ++operation.current, from = currentTime.current, start = performance.now(), media = audio.current!;
    if (sound) {
      media.currentTime = from;
      void media.play().catch(() => { if (token !== operation.current) return; setSound(false); setNotice('Narration unavailable. Continuing with captions.'); });
    }
    const tick = (now: number) => {
      if (operation.current !== token) return;
      const next = sound ? media.currentTime : from + (now - start) / 1000;
      move(next);
      if (next >= film.duration - .025 || (sound && media.ended)) { move(film.duration); setPlaying(false); return; }
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => { operation.current++; cancelAnimationFrame(frame.current); media.pause(); };
  }, [playing, sound]);
  useEffect(() => () => { operation.current++; cancelAnimationFrame(frame.current); }, []);
  const chapterIndex = Math.max(0, film.chapters.findLastIndex(c => c.at <= time)), chapter = film.chapters[chapterIndex];
  const renderTime = reduced ? Math.min(film.duration, (film.chapters[chapterIndex + 1]?.at ?? film.duration) - .001) : time;
  const pose = useMemo(() => filmFrame(film, renderTime, manual), [renderTime, manual]);
  const scene = useMemo(() => spatialScene(baseline.spec, { ...baseline.state, selectedObjectId: selected, explanationStep: pose.compression > .75 ? 2 : pose.compression > .1 ? 1 : 0, spatial: { ...view, parameters: { compress: pose.compression } } }), [pose.compression, selected, view]);
  const seek = (t: number) => { stop(); setManual(null); move(t); setNotice(''); };
  const start = () => { setManual(null); setNotice(''); if (time >= film.duration - .025) move(0); setPlaying(true); };
  const experiment = (compression: number) => { stop(); move(film.experimentAt); setManual(compression); setNotice(''); };
  return <main>
    <header className="masthead"><a href="http://localhost:41908/#piston">Soma <span>/ visual experiments</span></a><span className="recording-tag">Actual Muse recording</span></header>
    <section className="intro"><span className="eyebrow">A different canvas</span><h1>Anatomy, meet motion.</h1><p>One piston source. Anatomy beside a film composed by Muse.</p></section>
    <div className="comparison-grid">
      <article className="plate baseline"><header><span className="eyebrow">Current approach</span><h2>Anatomy illustration</h2><p>Muse-authored 3D geometry, projected into SVG</p></header><div className="stage baseline-stage">{scene && <Anatomy scene={scene} view={view} selected={selected} onSelect={setSelected} onView={v => setView(old => ({ ...old, ...v }))} />}</div><div className="plate-foot"><span>Shared compression</span><strong>{Math.round(pose.compression * 100)}%</strong><button onClick={() => setView(defaultSpatialView())}>Reset camera</button></div></article>
      <article className="plate film"><header><span className="eyebrow">New approach</span><h2>Muse motion film</h2><p>Muse-authored artwork, labels and choreography</p></header><div className="stage film-stage"><MotionScene film={film} time={renderTime} compression={manual} /></div><div className="plate-foot"><span>{manual !== null ? 'Your experiment' : `Scene ${chapterIndex + 1} of ${film.chapters.length}`}</span><strong>{manual !== null ? 'Paused' : chapter.title}</strong></div></article>
    </div>
    <section className="player" aria-label="Film playback">
      <div className="transport"><button className="primary" onClick={() => playing ? stop() : start()}>{playing ? 'Pause film' : time >= film.duration ? 'Play again' : manual !== null ? 'Resume film' : 'Play film'}</button><button onClick={() => seek(0)}>Restart</button><label className="sound"><input type="checkbox" checked={sound} onChange={e => setSound(e.target.checked)} />Narration</label><output aria-label="Film time" aria-live="off">{format(time)} / {format(film.duration)}</output><a className="download" href="/piston-film.mp4" download>Download film</a></div>
      <label className="scrubber"><span className="sr-only">Film timeline</span><input aria-label="Film timeline" aria-valuetext={`${time.toFixed(1)} seconds of ${film.duration}`} type="range" min="0" max={film.duration} step="0.01" value={time} onChange={e => seek(Number(e.target.value))} /></label>
      <div className="chapters" role="group" aria-label="Film chapters">{film.chapters.map((c, i) => <button key={c.id} aria-pressed={chapter.id === c.id && manual === null} onClick={() => seek(c.at)}><span>0{i + 1}</span>{c.title}</button>)}</div>
      <p className="narration" aria-live={playing ? 'off' : 'polite'}>{manual !== null ? 'You are moving the connected assembly. The guide stays fixed.' : chapter.caption}</p>
      <div className="experiment"><label><span>{film.parameter.label}<output aria-live="off">{Math.round(pose.compression * 100)}%</output></span><input aria-label="Shared compression" onPointerDown={() => experiment(pose.compression)} onKeyDown={e => { if (['ArrowLeft','ArrowRight','Home','End','PageUp','PageDown'].includes(e.key)) experiment(pose.compression); }} aria-valuetext={`${Math.round(pose.compression * 100)} percent${manual === null ? ', film' : ', your setting'}`} type="range" min="0" max="1" step="0.01" value={pose.compression} onChange={e => experiment(Number(e.target.value))} /></label>{manual !== null ? <button onClick={() => seek(film.experimentAt)}>Follow film</button> : <p>Pause the story. Try the mechanism.</p>}</div>
      {(reduced || notice) && <p className="status" role="status">{notice || 'Reduced motion: settled chapter frames. Manual controls still work.'}</p>}
    </section>
    <details className="provenance"><summary>Source, authorship & comparison notes</summary><div className="source-details"><img src="/source.png" alt="Original synthetic sliding-piston teaching source supplied to Muse for both approaches" /><div><h3>Same source, different authoring freedom</h3><p>The film is an actual Muse Spark output with Wonder advisory review. Muse chose the vector shapes, positions, typography, colors, labels, captions, narration and animation tracks. Soma supplies the validated renderer, chapter-heading and subtitle layout, controls and media clock. Voice is prepared locally with a Mac system voice; it is not Muse speech synthesis.</p><p>The Anatomy recording is the corrected PM118 piston. It follows the same compression value; its camera is independent. These are separately generated outputs, not a controlled quality benchmark.</p><p>Across {receipt.runCount} development runs: {receipt.calls} original calls · ${receipt.costUsd.toFixed(4)} · {(receipt.elapsedMs / 1000).toFixed(1)} seconds in bounded generation operations, including rejected outputs. Playback and controls make no model calls.</p><h3>Illustrative assumptions</h3><ul>{film.assumptions.map(a => <li key={a}>{a}</li>)}</ul><p>{film.summary}</p></div></div><details><summary>Read the complete narration</summary><ol>{film.chapters.map(c => <li key={c.id}><strong>{c.title}.</strong> {c.narration}</li>)}</ol></details></details>
    <footer>Original synthetic source · illustrative movement, not checked physics · local comparison</footer>
    <audio ref={audio} src="/narration.wav" preload="metadata" />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Comparison />);
