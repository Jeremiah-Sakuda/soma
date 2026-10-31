import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Play, Pause, RotateCcw, ArrowDownToLine, ArrowUpRight, Volume2, Eye } from 'lucide-react';
import { EngineScene } from '../lib/EngineScene';
import { enginePose, validateEngine } from '../lib/engine';
import raw from '../film.json';
import './style.css';
const film=validateEngine(raw);
function App(){
 const [degrees,setDegrees]=useState(0),[playing,setPlaying]=useState(false),[voice,setVoice]=useState(true),[labels,setLabels]=useState(true),[reduced,setReduced]=useState(false),[notice,setNotice]=useState(''),[compact,setCompact]=useState(false);
 const current=useRef(0),raf=useRef(0),audio=useRef<HTMLAudioElement>(null),op=useRef(0);
 const move=(n:number)=>{current.current=Math.max(0,Math.min(720,n));setDegrees(current.current);};
 const stop=()=>{op.current++;cancelAnimationFrame(raf.current);audio.current?.pause();setPlaying(false);};
 const seek=(n:number)=>{stop();move(n);setNotice('');};
 useEffect(()=>{const m=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!playing)return;const token=++op.current,start=performance.now(),from=current.current,media=audio.current!;
  if(voice){media.currentTime=from/30;void media.play().catch(()=>{if(op.current===token){setVoice(false);setNotice('Voice unavailable. The captioned film continues.');}});}
  const tick=(now:number)=>{if(token!==op.current)return;const n=voice?media.currentTime*30:from+(now-start)*.03;move(n);if(n>=719.99||(voice&&media.ended)){move(720);setPlaying(false);return;}raf.current=requestAnimationFrame(tick);};raf.current=requestAnimationFrame(tick);
  return()=>{op.current++;cancelAnimationFrame(raf.current);media.pause();};
 },[playing,voice]);
 useEffect(()=>()=>{op.current++;cancelAnimationFrame(raf.current);},[]);
 useEffect(()=>{const m=matchMedia('(max-width: 680px)'),update=()=>setCompact(m.matches);update();m.addEventListener('change',update);return()=>m.removeEventListener('change',update);},[]);
 const p=enginePose(degrees),s=film.strokes[p.phase],renderDegrees=reduced&&playing?p.phase*180+90:degrees;
 const color=[film.palette.intake,film.palette.compression,film.palette.power,film.palette.exhaust][p.phase];
 const play=()=>{setNotice('');if(current.current>=720)move(0);setPlaying(true);};
 return <main style={{'--phase':color} as React.CSSProperties}>
  <header><a className="brand" href="#">soma<span>/ motion studies</span></a><a className="compare" href="http://localhost:41912">Earlier comparison <ArrowUpRight size={15} aria-hidden="true"/></a></header>
  <section className="intro"><p className="eyebrow">An idea you can put in motion</p><h1>Inside the engine.</h1><p>Four strokes. Two turns. One continuous story.</p></section>
  <section className="demo" aria-label="Interactive four-stroke engine">
   <div className="drawing"><div className="drawing-top"><span><i/>Single-cylinder cutaway</span><button aria-pressed={labels} onClick={()=>setLabels(!labels)}><Eye size={16} aria-hidden="true"/>Labels</button></div><EngineScene film={film} degrees={renderDegrees} labels={labels} compact={compact}/>{compact&&labels&&<div className="part-key"><span><b>1</b>Piston</span><span><b>2</b>Connecting rod</span><span><b>3</b>Crankshaft</span></div>}<div className="drawing-bottom"><span>Idealized four-stroke cycle</span><span>SVG / Muse-authored artwork</span></div></div>
   <aside className="story"><div className="chapter-top"><span className="eyebrow">The working cycle</span><span className="index">0{p.phase+1} / 04</span></div><div className="steps" role="group" aria-label="Engine strokes">{film.strokes.map((stroke,i)=><button key={stroke.name} aria-pressed={p.phase===i} onClick={()=>seek(i*180)}><span className="step-number">0{i+1}</span>{stroke.name}<span className="step-arrow">{i===0||i===2?'↓':'↑'}</span></button>)}</div>
   <div className="explanation" aria-live={playing?'off':'polite'}><span className="eyebrow">{s.verb}</span><h2>{s.name}.</h2><p>{s.caption}</p></div>
   <div className="mechanism-state"><div><span>Piston</span><strong>{degrees%180===0?'At turn':p.phase===0||p.phase===2?'Moving down':'Moving up'}</strong></div><div><span>Intake</span><strong>{p.intakeLift>.01?'Open':'Closed'}</strong></div><div><span>Exhaust</span><strong>{p.exhaustLift>.01?'Open':'Closed'}</strong></div></div>
   <div className="transport"><button className="primary" onClick={()=>playing?stop():play()}>{playing?<Pause size={17} aria-hidden="true"/>:<Play size={17} aria-hidden="true"/>}{playing?'Pause film':degrees>=720?'Play again':'Play the cycle'}</button><button className="reset" aria-label="Restart cycle" onClick={()=>seek(0)}><RotateCcw size={18} aria-hidden="true"/></button></div><label className="voice"><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/><Volume2 size={15} aria-hidden="true"/>Narration<span>24 sec</span></label>
   </aside>
   <div className="scrub"><div><label htmlFor="crank">Take the crank.</label><output aria-live="off" aria-label="Crank angle">{Math.round(degrees)}<span>° / 720°</span></output></div><input id="crank" aria-label="Crank angle" aria-valuetext={`${Math.round(degrees)} degrees, ${s.name}`} type="range" min="0" max="720" step="1" value={degrees} onPointerDown={stop} onKeyDown={e=>{if(['Home','End','ArrowLeft','ArrowRight','PageUp','PageDown'].includes(e.key))stop();}} onChange={e=>seek(Number(e.target.value))}/><div className="scale"><span>0°</span><span>180°</span><span>360°</span><span>540°</span><span>720°</span></div><p>Drag to feel how the piston, rod and crank stay connected.</p></div>
  </section>
  {(notice||reduced)&&<p className="notice" role="status">{notice||'Reduced motion: playback shows a still pose for each stroke. The crank control remains direct.'}</p>}
  <div className="below"><span><i/>Recorded Muse generation · playback makes no model calls</span><a href="/engine-film.mp4" download><ArrowDownToLine size={16} aria-hidden="true"/>Save the film</a></div>
  <details><summary>Behind this illustration</summary><div className="notes"><div><h3>Designed by Muse. Connected by Soma.</h3><p>Muse Spark authored the engine’s vector paths, palette, captions and narration script. Soma supplies the constrained crank-and-rod geometry, valve timing, gas and spark visualization, callouts and playback. Mac Samantha provides the prepared voice.</p><p>This is a recorded local prototype. The engine is an idealized explanation, with no calculated pressure, force or efficiency. It does not save a learning record.</p><a href="/source.png">Original synthetic teaching source</a> · <a href="https://www.grc.nasa.gov/WWW/K-12/BGP/engopt.html">NASA Glenn reference</a></div><div><h3>Illustrative assumptions</h3><ul>{film.assumptions.map(a=><li key={a}>{a}</li>)}</ul><details><summary>Read the narration</summary>{film.strokes.map(st=><p key={st.name}><strong>{st.name}.</strong> {st.narration}</p>)}</details></div></div></details>
  <footer>Soma / an explanation you can explore.</footer><audio ref={audio} src="/narration.wav" preload="metadata"/>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
