'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Mic,Square} from 'lucide-react';
import {encodeVoiceWav,MAX_VOICE_SECONDS,VOICE_SAMPLE_RATE} from '@/lib/domain/voice-audio';

type Phase='idle'|'permission'|'recording'|'converting'|'transcribing';
export function ExplorationVoice({turnKey,onTranscript,disabled=false,onInterrupt}:{turnKey:string;onTranscript:(text:string)=>void;disabled?:boolean;onInterrupt?:()=>void}){
 const [phase,setPhase]=useState<Phase>('idle'),[notice,setNotice]=useState(''),[microphone,setMicrophone]=useState(false);
 const sequence=useRef(0),stream=useRef<MediaStream|null>(null),recorder=useRef<MediaRecorder|null>(null),pending=useRef<AbortController|null>(null),timer=useRef<ReturnType<typeof setTimeout>|null>(null),decoder=useRef<AudioContext|null>(null),transcriptCallback=useRef(onTranscript);
 transcriptCallback.current=onTranscript;
 const cancel=useCallback(()=>{
  sequence.current++;pending.current?.abort();pending.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;
  const recording=recorder.current;recorder.current=null;if(recording&&recording.state!=='inactive')try{recording.stop();}catch{/* Already stopped. */}
  for(const track of stream.current?.getTracks()??[])track.stop();stream.current=null;
  if(decoder.current){void decoder.current.close().catch(()=>{});decoder.current=null;}
 },[]);
 useEffect(()=>{setMicrophone(Boolean(typeof navigator.mediaDevices?.getUserMedia==='function'&&typeof MediaRecorder!=='undefined'&&typeof window.AudioContext==='function'&&typeof window.OfflineAudioContext==='function'));},[]);
 useEffect(()=>{cancel();setPhase('idle');setNotice('');return cancel;},[turnKey,disabled,cancel]);
 const stop=()=>{const current=recorder.current;if(current?.state==='recording')current.stop();for(const track of stream.current?.getTracks()??[])track.stop();stream.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;};
 async function startRecording(){
  onInterrupt?.();cancel();const generation=sequence.current;setNotice('');setPhase('permission');
  const current=()=>generation===sequence.current;
  try{
   const selected=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});
   if(!current()){for(const track of selected.getTracks())track.stop();return;}stream.current=selected;
   const type=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(value=>MediaRecorder.isTypeSupported(value));
   const recording=new MediaRecorder(selected,{...(type?{mimeType:type}:{}),audioBitsPerSecond:96_000});recorder.current=recording;
   const chunks:Blob[]=[];let size=0;
   recording.ondataavailable=event=>{if(!current()||!event.data.size)return;size+=event.data.size;if(size>1_500_000){cancel();setPhase('idle');setNotice('The recording was too large. Try a shorter question or type it.');return;}chunks.push(event.data);};
   recording.onerror=()=>{if(!current())return;cancel();setPhase('idle');setNotice('Recording stopped. You can type your question instead.');};
   recording.onstop=()=>{
    if(!current())return;recorder.current=null;for(const track of stream.current?.getTracks()??[])track.stop();stream.current=null;if(timer.current)clearTimeout(timer.current);timer.current=null;
    void(async()=>{
     try{
      if(!chunks.length)throw Error();setPhase('converting');
      const encoded=new Blob(chunks,{type:recording.mimeType});chunks.length=0;const audio=new AudioContext();decoder.current=audio;
      const decoded=await audio.decodeAudioData(await encoded.arrayBuffer());if(!current())return;
      if(!Number.isFinite(decoded.duration)||decoded.duration<=0||decoded.duration>MAX_VOICE_SECONDS+1)throw Error();
      const offline=new OfflineAudioContext(1,Math.min(MAX_VOICE_SECONDS*VOICE_SAMPLE_RATE,Math.ceil(decoded.duration*VOICE_SAMPLE_RATE)),VOICE_SAMPLE_RATE),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();
      const mono=await offline.startRendering();if(!current())return;const wav=encodeVoiceWav(mono.getChannelData(0));await audio.close();decoder.current=null;if(!current())return;
      const controller=new AbortController();pending.current=controller;setPhase('transcribing');
      const response=await fetch('/api/explore/transcribe',{method:'POST',headers:{'content-type':'audio/wav'},body:new Uint8Array(wav),signal:controller.signal});
      const result=await response.json() as{transcript?:unknown};if(!current())return;
      if(!response.ok||typeof result.transcript!=='string'||!result.transcript.trim()||result.transcript.length>2000)throw Error();
      pending.current=null;setPhase('idle');setNotice('Question transcribed. Review it, then press Ask Soma.');transcriptCallback.current(result.transcript.trim());
     }catch{if(current()){cancel();setPhase('idle');setNotice('Voice transcription is unavailable. Please type your question.');}}
    })();
   };
   recording.start(250);setPhase('recording');setNotice('Recording your question. Stops after 30 seconds.');timer.current=setTimeout(stop,MAX_VOICE_SECONDS*1000);
  }catch{if(current()){cancel();setPhase('idle');setNotice('Microphone access is unavailable. You can type your question instead.');}}
 }
 const busy=['permission','converting','transcribing'].includes(phase),active=phase!=='idle';
 return <section className="exploration-voice" aria-label="Voice question" aria-busy={busy}>
  <div className="exploration-ask-actions">
   <button type="button" className="secondary-button" aria-pressed={phase==='recording'} disabled={disabled||!microphone||busy} onClick={()=>phase==='recording'?stop():void startRecording()}><Mic size={16} aria-hidden="true"/>{phase==='recording'?'Stop and transcribe':'Record question'}</button>

   {active&&<button type="button" className="secondary-button" onClick={()=>{cancel();setPhase('idle');setNotice('Voice stopped. Your explanation is unchanged.');}}><Square size={14} aria-hidden="true"/>Cancel voice</button>}
  </div>
  <p className="meta">Your recording goes to Meta for transcription. Type or record in the same question area.</p>
  <p className="meta" role="status" aria-live="polite" aria-atomic="true">{notice||(phase==='permission'?'Waiting for microphone permission…':phase==='converting'?'Preparing your recording…':phase==='transcribing'?'Transcribing your question…':!microphone?'Microphone recording is unavailable here. Typed questions work.':'')}</p>
 </section>;
}
