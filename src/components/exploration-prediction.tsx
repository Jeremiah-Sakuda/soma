'use client';
import {useState} from 'react';
import {predictionQuestion,type ExplorationPrediction} from '@/lib/domain/exploration-prediction';
import type {ExplorationSpec} from '@/lib/domain/exploration';
import type {ExplorationViewState} from '@/lib/domain/exploration-view';

type Props={artifactId:string;version:number;spec:ExplorationSpec;state:ExplorationViewState;history:ExplorationPrediction[];disabled:boolean;canAdapt:boolean;onPause:()=>void;onAdapt:(id:string)=>void};
export function ExplorationPredictionCard({artifactId,version,spec,state,history,disabled,canAdapt,onPause,onAdapt}:Props){
 const [record,setRecord]=useState<ExplorationPrediction|null>(()=>history.filter(p=>p.artifactId===artifactId&&p.version===version&&JSON.stringify(p.state)===JSON.stringify(state)).at(-1)??null),[choice,setChoice]=useState(''),[reason,setReason]=useState(''),[working,setWorking]=useState(false),[error,setError]=useState('');
 const [id]=useState(()=>crypto.randomUUID());
 const question=predictionQuestion(spec,state);if(!question)return null;
 async function send(operation:'start'|'answer'|'reveal'){
  onPause();setWorking(true);setError('');
  try{
   const response=await fetch('/api/explore',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'prediction',id:record?.id??id,artifactId,version,state,operation,...(operation==='answer'?{nodeId:choice,reason}:{})})});
   const result=await response.json();if(!response.ok)throw new Error(result.error??'Could not save this prediction.');setRecord(result.prediction);
  }catch(e){setError(e instanceof Error?e.message:'Could not save this prediction.');}finally{setWorking(false);}
 }
 const unavailable=disabled||working;
 return <section className="exploration-prediction" aria-label="Optional prediction"><div className="section-heading"><h3>Try a prediction</h3><span className="meta">Optional · diagram visible</span></div>
 {!record?<><p>Before advancing, predict the next move. You can keep exploring without answering.</p><button type="button" className="secondary-button" disabled={unavailable} onClick={()=>void send('start')}>Predict the next node</button></>:<>
 <p><strong>{record.prompt}</strong></p>
 {!record.answer&&!record.revealedAt?<><fieldset disabled={unavailable}><legend>Your prediction</legend><div className="action-row">{record.options.map(option=><label key={option.id}><input type="radio" name={`prediction-${id}`} value={option.id} checked={choice===option.id} onChange={()=>setChoice(option.id)}/> {option.label}</label>)}</div></fieldset><label htmlFor={`reason-${id}`}>Why? <span className="meta">Optional</span></label><textarea id={`reason-${id}`} rows={2} maxLength={800} value={reason} onChange={e=>setReason(e.target.value)} disabled={unavailable}/><div className="action-row"><button type="button" className="primary-button" disabled={unavailable||!choice} onClick={()=>void send('answer')}>Check my prediction</button><button type="button" className="text-button" disabled={unavailable} onClick={()=>void send('reveal')}>Show me instead</button></div></>:<>
 <p role="status">{record.answer?`${record.answer.matches?'Your prediction matches this step.':'This step takes a different node.'} You chose ${record.options.find(o=>o.id===record.answer!.nodeId)?.label}. `:'Revealed without a prediction. '}{record.options.find(o=>o.id===record.expectedNodeId)?.label} leaves the front next.</p>
 {record.answer?.reason&&<p>Your explanation: {record.answer.reason}</p>}
 {record.answer&&<button type="button" className="secondary-button" disabled={unavailable||!canAdapt} onClick={()=>{onPause();onAdapt(record.id);}}>Build a visual from my answer</button>}
 </>}
 <p className="meta">Saved as practice with the diagram visible. This does not establish independent understanding.</p>
 </>}{error&&<p role="alert">{error}</p>}</section>;
}
