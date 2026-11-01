import {useEffect,useRef,useState} from 'react';
import {X,ArrowUpRight} from 'lucide-react';
import {EngineScene} from '../pm121/lib/EngineScene';
import {enginePose,type EngineFilm} from '../pm121/lib/engine';
import refinement from '../pm123/refinement-author.json';
import copy from '../pm123/copy-author.json';
import review from '../pm123/accepted-review.json';
import rejected from '../pm121/base-author.json';
import repair from '../pm121/path-repair-author.json';
import receipt from '../pm121/generation-receipt.json';
import {turnAngle,comparisonStates,poseObservation} from '../pm126/comparison';
import {downloadStudySnapshot} from '../pm126/StudySnapshot';
export function useModal(onClose:()=>void){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;dialog.showModal();return()=>{if(dialog.open)dialog.close();};},[]);
 const close=()=>{ref.current?.close();onClose();};
 return {ref,close};
}
export function MuseProof({film,onClose,onInvestigation}:{film:EngineFilm;onClose:()=>void;onInvestigation?:()=>void}){
 const {ref,close}=useModal(onClose),skirt=film.art.find(a=>a.id==='piston-skirt')!,before=rejected.structured.art.find(a=>a.id==='exhaust-valve-stem')!,after=repair.structured.updates.find(a=>a.id===before.id)!,finding=receipt.advisoryReviews.find(r=>r.run===3&&r.review==='review-2.json')!.verdict.issues[0];
 return <dialog ref={ref} className="review-dialog proof-dialog" aria-labelledby="proof-heading" onCancel={e=>{e.preventDefault();close();}}>
  <header><div><p className="eyebrow">Actual recorded model output</p><h2 id="proof-heading">How Muse made this.</h2></div><button className="icon-button" aria-label="Close model evidence" onClick={close}><X size={18} aria-hidden="true"/></button></header>
  <div className="proof-grid"><section><span className="proof-step">01 / The source</span><h3>A teaching card.</h3><img src="/source.png" alt="Original synthetic teaching card describing the four strokes, two crank turns and connected rod"/><a href="/source.png" target="_blank" rel="noreferrer">Open the full teaching card <ArrowUpRight size={13} aria-hidden="true"/></a><p>This original synthetic source was supplied to Muse. It is not a real course capture.</p></section>
  <section><span className="proof-step">02 / Muse’s contribution</span><h3>The shapes and explanation.</h3><svg className="authored-shape" viewBox="-70 -42 140 80" role="img" aria-label="Recorded Muse-authored piston skirt contour"><path d={skirt.d} fill={skirt.fill} stroke={skirt.stroke} strokeWidth={skirt.strokeWidth}/></svg><blockquote>{film.strokes[1].caption}</blockquote><p>Muse Spark authored these vector paths, refinements, captions and part explanations. The quoted caption and contour are from the recorded responses.</p></section></div>
  <div className="proof-ownership"><strong>03 / Soma connects the motion.</strong><p>Soma validates the data and supplies the linkage, material finish, controls and motion guides. Wonder provided an advisory review. The prepared Mac voice speaks Muse’s script. Playback is a replay, with no new model calls.</p></div>
  {onInvestigation&&<button className="discovery-return" onClick={()=>{close();onInvestigation();}}>Explore recorded Muse investigations</button>}
  <details className="repair-proof"><summary>See a real rejected shape and Muse’s repair</summary><p>Wonder flagged a missing exhaust-valve head in an earlier recorded candidate. Muse’s bounded path repair added the head; Soma applied that exact path and checked the closed seating plane.</p><div className="repair-grid">{[{label:'Rejected recorded candidate',d:before.d},{label:'Recorded Muse repair',d:after.d}].map(a=><figure key={a.label}><svg viewBox="-25 -50 50 65" role="img" aria-label={a.label}><path d={a.d} fill={before.fill} stroke={before.stroke} strokeWidth={before.strokeWidth}/><path d="M-22 8H22" stroke="#677367" strokeDasharray="2 2" strokeWidth=".5"/></svg><figcaption>{a.label}</figcaption></figure>)}</div><blockquote>{finding}</blockquote><p>Run3 / review2 rejected this candidate. Subsequent path-repair and counterweight operations received advisory approval. Human inspection still found issues after earlier approvals; this is not certification of the mechanism.</p></details>
  <details><summary>Inspect the recorded output</summary><p>Refinement author: <code>muse-spark-1.3</code> · advisory reviewer: <code>muse-wonder-1.0</code> · recorded verdict: {review.structured.approved?'approved':'not approved'}</p><pre>{JSON.stringify({pistonContour:refinement.structured.refinements.find(a=>a.id==='piston-skirt'),compressionCaption:copy.structured.strokes.find(a=>a.name==='Compression')},null,2)}</pre></details>
  <footer className="prototype-bridge"><div><strong>This engine is a recorded local prototype.</strong><p>Try Soma’s existing screenshot-to-visual app separately. Engine generation and saving are not integrated there.</p></div><a href="https://soma-woad-beta.vercel.app/explore" target="_blank" rel="noreferrer">Open Soma <ArrowUpRight size={14} aria-hidden="true"/></a></footer>
 </dialog>;
}
export function CycleDiscovery({film,onClose,initialDegrees=90}:{film:EngineFilm;onClose:()=>void;initialDegrees?:number}){
 const {ref,close}=useModal(onClose),[exportError,setExportError]=useState(''),[angle,setAngle]=useState(()=>turnAngle(initialDegrees)),angles=comparisonStates(angle).map(p=>p.degrees);
 return <dialog ref={ref} className="review-dialog discovery-dialog" aria-labelledby="discovery-heading" onCancel={e=>{e.preventDefault();close();}}>
  <header><div><p className="eyebrow">A small discovery</p><h2 id="discovery-heading">Same position. Different job.</h2></div><button className="icon-button" aria-label="Close cycle comparison" onClick={close}><X size={18} aria-hidden="true"/></button></header>
  <p className="discovery-intro">One turn brings the piston back to the same position. The valves give the next turn a different job.</p>
  <div className="discovery-options" role="group" aria-label="Compare matching strokes"><button aria-pressed={angle===90} onClick={()=>setAngle(90)}>Two downstrokes</button><button aria-pressed={angle===270} onClick={()=>setAngle(270)}>Two upstrokes</button></div>
  <label className="comparison-control">Turn both cranks together <output>{Number(angle.toFixed(1))}° / 360°</output><input aria-label="Shared crank angle" type="range" min="0" max="360" step="any" value={angle} onKeyDown={e=>{if(['Home','End','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();setAngle(e.key==='Home'?0:e.key==='End'?360:Math.max(0,Math.min(360,angle+(e.key==='ArrowRight'?1:-1))));}}} onChange={e=>setAngle(Number(e.target.value))}/><small>One revolution later: the same linkage position. 360° returns to 0°.</small></label>
  <div className="discovery-grid">{angles.map((angle,slot)=><section key={slot}><div><strong>{film.strokes[Math.floor(angle/180)].name}</strong><span>{Number(angle.toFixed(1))}°</span></div><EngineScene film={film} degrees={angle} compact labels={false}/><div className="discovery-valves"><span>Intake: <strong>{enginePose(angle).intakeLift>.01?'Open':'Closed'}</strong></span><span>Exhaust: <strong>{enginePose(angle).exhaustLift>.01?'Open':'Closed'}</strong></span></div><p>{poseObservation(angle)}</p></section>)}</div>
  <p className="discovery-takeaway">Same piston, rod and crank positions. Different stroke roles; valve states can differ. At the exact boundaries, both valves are seated. That is why the full cycle takes <strong>two turns</strong>.</p><p className="discovery-scope">Illustrative forward-cycle comparison · optional exploration, not an assessment</p>
  <button className="discovery-return snapshot-export" onClick={()=>{try{downloadStudySnapshot(film,angle);setExportError('');}catch{setExportError('Snapshot unavailable: the recorded film has changed. Manual exploration remains available.');}}}>Save study snapshot</button>
  {exportError&&<p role="alert">{exportError}</p>}
  <button className="discovery-return" onClick={close}>Back to my engine</button>
 </dialog>;
}
