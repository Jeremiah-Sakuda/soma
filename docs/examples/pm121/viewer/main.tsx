import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';
import {Play,Pause,RotateCcw,ArrowDownToLine,ArrowUpRight,Volume2,Eye,X,ArrowLeft,Info,Maximize2,Minimize2,Repeat2} from 'lucide-react';
import {EngineScene} from '../lib/EngineScene';
import {enginePose,validateEngine} from '../lib/engine';
import {presentFilm,validatePresentation,type PartId} from '../../pm123/presentation';
import raw from '../film.json';
import presentationRaw from '../../pm123/presentation.json';
import {playbackDegrees} from '../../pm124/motion-guides';
import './style.css';
const base=validateEngine(raw),presentation=validatePresentation(presentationRaw,base),film=validateEngine(presentFilm(base,presentation));
function App(){
 const [degrees,setDegrees]=useState(0),[playing,setPlaying]=useState(false),[voice,setVoice]=useState(true),[labels,setLabels]=useState(true),[reduced,setReduced]=useState(false),[notice,setNotice]=useState(''),[compact,setCompact]=useState(false),[selected,setSelected]=useState<PartId|null>(null),[rate,setRate]=useState(1),[loop,setLoop]=useState(false),[presenting,setPresenting]=useState(false);
 const current=useRef(0),raf=useRef(0),audio=useRef<HTMLAudioElement>(null),op=useRef(0);
 const move=(n:number)=>{current.current=Math.max(0,Math.min(720,n));setDegrees(current.current);};
 const stop=()=>{op.current++;cancelAnimationFrame(raf.current);audio.current?.pause();setPlaying(false);};
 const seek=(n:number)=>{stop();move(n);setNotice('');};
 const phaseSeek=(n:number)=>{setSelected(null);seek(n);};
 const pick=(id:PartId)=>{stop();setSelected(old=>old===id?null:id);};
 const closePart=()=>{const id=selected;setSelected(null);if(id)document.getElementById('part-'+id)?.focus();};
 const play=()=>{setSelected(null);setNotice('');if(current.current>=720)move(0);setPlaying(true);};
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)'),update=()=>setReduced(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{const media=matchMedia('(max-width: 680px)'),update=()=>setCompact(media.matches);update();media.addEventListener('change',update);return()=>media.removeEventListener('change',update);},[]);
 useEffect(()=>{if(!playing)return;const token=++op.current,start=performance.now(),from=current.current,media=audio.current!;
  media.playbackRate=rate;media.preservesPitch=true;media.loop=loop;
  if(voice){media.currentTime=from/30;void media.play().catch(()=>{if(op.current===token){setVoice(false);setNotice('Voice unavailable. The captioned film continues.');}});}
  const tick=(now:number)=>{if(token!==op.current)return;const n=voice?media.currentTime*30:playbackDegrees(now-start,from,rate,loop);move(n);if(!loop&&(n>=719.99||(voice&&media.ended))){move(720);setPlaying(false);return;}raf.current=requestAnimationFrame(tick);};raf.current=requestAnimationFrame(tick);
  return()=>{op.current++;cancelAnimationFrame(raf.current);media.pause();};
 },[playing,voice,rate,loop]);
 useEffect(()=>()=>{op.current++;cancelAnimationFrame(raf.current);},[]);
 useEffect(()=>{const key=(e:KeyboardEvent)=>{const target=e.target as HTMLElement;if(e.key==='Escape'){if(selected)closePart();else if(presenting)setPresenting(false);return;}if(target.closest('input,button,a,summary,select,textarea,[contenteditable=true]'))return;if(e.code==='Space'){e.preventDefault();if(playing)stop();else play();}};const hide=()=>{if(document.hidden)stop();};window.addEventListener('keydown',key);document.addEventListener('visibilitychange',hide);return()=>{window.removeEventListener('keydown',key);document.removeEventListener('visibilitychange',hide);};},[playing,selected,presenting]);
 useEffect(()=>{if(!presenting)return;const previous=document.body.style.overflow;document.body.style.overflow='hidden';return()=>{document.body.style.overflow=previous;};},[presenting]);
 const p=enginePose(degrees),s=film.strokes[p.phase],renderDegrees=reduced&&playing?p.phase*180+90:degrees,part=presentation.parts.find(a=>a.id===selected);
 const color=['#39798a','#78652c','#9f5130','#657281'][p.phase];
 const time=Math.min(24,degrees/30),clock=(t:number)=>`0:${Math.floor(t).toString().padStart(2,'0')}`;
 return <main data-presenting={presenting} style={{'--phase':color,'--progress':`${degrees/720*100}%`} as CSSProperties}>
  <header className="site-header"><a className="brand" href="#">soma<span>A little more understandable.</span></a><div className="header-actions"><span className="recording"><i/>Muse recording</span><a className="about-link" href="#about" onClick={e=>{e.preventDefault();const details=document.getElementById('about') as HTMLDetailsElement;details.open=true;details.scrollIntoView({block:'start',behavior:reduced?'instant':'smooth'});details.querySelector('summary')?.focus({preventScroll:true});}}><Info size={15} aria-hidden="true"/>About this study</a></div></header>
  <section className="intro"><div><p className="eyebrow">Motion study / 001</p><h1>Inside the engine.</h1></div><p>{presentation.subtitle}</p></section>
  <section className="demo" aria-label="Interactive four-stroke engine">
   <div className="drawing"><div className="drawing-top"><span className="drawing-title"><span className="section-mark"/>Four-stroke cutaway<span className="present-recording"> · Muse recording</span></span><div className="drawing-tools"><button className="label-toggle" aria-pressed={labels} onClick={()=>setLabels(!labels)}><Eye size={15} aria-hidden="true"/>Labels</button><button className="presentation-toggle" aria-label={presenting?'Exit presentation':'Presentation view'} aria-pressed={presenting} title={presenting?'Exit presentation (Escape)':'Presentation view'} onClick={()=>setPresenting(!presenting)}>{presenting?<Minimize2 size={15} aria-hidden="true"/>:<Maximize2 size={15} aria-hidden="true"/>}</button></div></div>
    <EngineScene film={film} degrees={renderDegrees} labels={labels} compact={compact} selected={selected} onSelect={pick} onCrankStart={stop} onCrankChange={seek}/>
    <div className="parts-bar" role="group" aria-label="Inspect engine parts"><span className="parts-hint">Look closer</span>{presentation.parts.map((a,i)=><button id={'part-'+a.id} key={a.id} aria-pressed={selected===a.id} onClick={()=>pick(a.id)}><span>0{i+1}</span>{a.name}</button>)}</div>
    {compact&&labels&&<div className="part-key" aria-hidden="true"><span>1 Piston</span><span>2 Connecting rod</span><span>3 Crankshaft</span></div>}
    <div className="drawing-bottom"><span>Idealized mechanics</span><span>Grab the copper dot to turn the crank <span aria-hidden="true">↻</span></span></div>
   </div>
   <aside className="story"><div className="chapter-top"><span className="eyebrow">{part?'A closer look':'The working cycle'}</span>{part?<button className="icon-button close-part" onClick={closePart} aria-label="Back to cycle"><X size={16} aria-hidden="true"/></button>:<span className="phase-index">0{p.phase+1}<span>/ 04</span></span>}</div>
    <div className="explanation" aria-live={playing?'off':'polite'}><span className="phase-verb">{part?'Connected by design':s.verb}</span><h2>{part?part.name:s.name+'.'}</h2><p>{part?part.description:s.caption}</p></div>
    {part?<div className="observation"><span className="eyebrow">Try this</span><p>{part.cue}</p><button onClick={closePart}><ArrowLeft size={13} aria-hidden="true"/>Back to the cycle</button></div>:<div className="mechanism-state"><div><span>Piston</span><strong>{degrees%180===0?'At turn':p.phase===0||p.phase===2?'Downstroke':'Upstroke'}<span aria-hidden="true">{degrees%180===0?'—':p.phase===0||p.phase===2?'↓':'↑'}</span></strong></div><div><span>Intake valve</span><strong><i className={p.intakeLift>.01?'open':''}/>{p.intakeLift>.01?'Open':'Closed'}</strong></div><div><span>Exhaust valve</span><strong><i className={p.exhaustLift>.01?'open':''}/>{p.exhaustLift>.01?'Open':'Closed'}</strong></div></div>}
    <div className="playback"><div className="transport"><button className="primary" onClick={()=>playing?stop():play()}>{playing?<Pause size={16} aria-hidden="true"/>:<Play size={16} aria-hidden="true"/>}{playing?'Pause film':degrees>=720?'Play again':degrees>0?'Resume film':'Play the cycle'}<span>{clock(time)} / 0:24</span></button><button className="icon-button reset" aria-label="Restart cycle" onClick={()=>phaseSeek(0)}><RotateCcw size={17} aria-hidden="true"/></button></div><div className="playback-meta"><label className="voice"><input type="checkbox" checked={voice} onChange={e=>setVoice(e.target.checked)}/><Volume2 size={14} aria-hidden="true"/>Narration</label><div className="playback-options"><select aria-label="Playback speed" value={rate} onChange={e=>setRate(Number(e.target.value))}><option value="0.5">0.5×</option><option value="1">1×</option></select><button aria-label="Loop cycle" aria-pressed={loop} title="Repeat the cycle" onClick={()=>setLoop(!loop)}><Repeat2 size={16} aria-hidden="true"/></button></div></div></div>
   </aside>
   <div className="scrub"><div className="scrub-top"><label htmlFor="crank">Take the crank.<span>One cycle. Two full turns.</span></label><output aria-live="off" aria-label="Crank angle">{Math.round(degrees)}<span>° <b>/ 720°</b></span></output></div><div className="range-wrap"><div className="cycle-segments" aria-hidden="true">{['intake','compression','power','exhaust'].map(a=><span key={a} className={a}/>)}</div><input id="crank" aria-label="Crank angle" aria-valuetext={`${Math.round(degrees)} degrees, ${s.name}`} type="range" min="0" max="720" step="1" value={degrees} onPointerDown={stop} onKeyDown={e=>{if(['Home','End','ArrowLeft','ArrowRight','PageUp','PageDown'].includes(e.key))stop();}} onChange={e=>seek(Number(e.target.value))}/></div>
   <div className="steps" role="group" aria-label="Engine strokes">{film.strokes.map((stroke,i)=><button key={stroke.name} aria-pressed={p.phase===i&&!part} onClick={()=>phaseSeek(i*180)}><span className="step-number">0{i+1}</span><span>{stroke.name}</span><small>{i*180}°</small></button>)}</div></div>
  </section>
  {(notice||reduced)&&<p className="notice" role="status">{notice||'Reduced motion: playback shows a still pose for each stroke. The crank control remains direct.'}</p>}
  <div className="below"><span>Generated artwork. A mechanism you can touch.</span><a href="/engine-film.mp4" download><ArrowDownToLine size={15} aria-hidden="true"/>Save the 24-second film</a></div>
  <details id="about" className="provenance"><summary>Source & authorship</summary><div className="notes"><div><h3>Designed by Muse. Connected by Soma.</h3><p>Muse Spark authored the vector paths, their recorded refinements and the teaching copy. Soma adds material finishes, constrained motion, gas visualization, forward-stroke motion guides, part callouts and playback. Mac Samantha provides the prepared voice. This is recorded generation; playback makes no model calls.</p><p>Original synthetic source. Illustrative dimensions and idealized timing, with no calculated pressure, force or efficiency. Exploration does not create a learning record.</p><a href="/source.png">View the teaching source</a> · <a href="https://www.grc.nasa.gov/WWW/K-12/BGP/engopt.html">NASA Glenn reference</a><p><a href="http://localhost:41912">Earlier Anatomy comparison <ArrowUpRight size={12} aria-hidden="true"/></a></p></div><div><h3>Illustrative assumptions</h3><ul>{film.assumptions.map(a=><li key={a}>{a}</li>)}</ul><details><summary>Read the narration</summary>{film.strokes.map(a=><p key={a.name}><strong>{a.name}.</strong> {a.narration}</p>)}</details></div></div></details>
  <footer><span>soma</span>Make the hard part visible.</footer><audio ref={audio} src="/narration.wav" preload="metadata"/>
 </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
