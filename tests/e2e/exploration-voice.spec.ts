import {test,expect,type Page,type Route} from '@playwright/test';
import {checkExploration,createExampleExploration} from '../../src/lib/domain/exploration';
import {inspectVoiceWav} from '../../src/lib/domain/voice-audio';
import {initialExplorationState} from '../../src/components/exploration-scene';

// Original synthetic codec/microphone/speech doubles exercise cancellation and
// actual React controls. They do not establish live ASR or audible speech quality.
async function setup(page:Page,options:{deny?:boolean;pendingMicrophone?:boolean;delayTranscript?:boolean;nativeAudio?:boolean}={}){
 await page.addInitScript(({deny,pendingMicrophone,nativeAudio})=>{
  const spy=(window as any).__voice={stops:0,cancels:0,spoken:[] as string[],last:null as any,resolveMicrophone:null as any,native:[] as unknown[],chunks:[] as number[]};
  const stream={getTracks:()=>[{stop:()=>{spy.stops++;}}]};
  Object.defineProperty(navigator,'mediaDevices',{configurable:true,value:{getUserMedia:async()=>{if(deny)throw new DOMException('Original synthetic denial','NotAllowedError');if(pendingMicrophone)return new Promise(resolve=>{spy.resolveMicrophone=()=>resolve(stream);});if(nativeAudio){const audio=new AudioContext(),oscillator=audio.createOscillator(),destination=audio.createMediaStreamDestination();oscillator.frequency.value=440;oscillator.connect(destination);oscillator.start();await audio.resume();for(const track of destination.stream.getTracks()){const stop=track.stop.bind(track);Object.defineProperty(track,'stop',{value:()=>{spy.stops++;oscillator.stop();void audio.close();stop();}});}return destination.stream;}return stream;}}});
  if(nativeAudio){
   const NativeRecorder=window.MediaRecorder;
   Object.defineProperty(window,'MediaRecorder',{configurable:true,value:class extends NativeRecorder{constructor(stream:MediaStream,options?:MediaRecorderOptions){super(stream,options);this.addEventListener('dataavailable',event=>spy.chunks.push(event.data.size));}}});
   const decode=AudioContext.prototype.decodeAudioData;
   (AudioContext.prototype as any).decodeAudioData=function(data:ArrayBuffer){spy.native.push({stage:'decode',bytes:data.byteLength});return decode.call(this,data).then(buffer=>{spy.native.push({stage:'decoded',duration:buffer.duration});return buffer;},error=>{spy.native.push({stage:'decode-error',name:error.name});throw error;});};
   const render=OfflineAudioContext.prototype.startRendering;
   OfflineAudioContext.prototype.startRendering=function(){spy.native.push({stage:'render'});return render.call(this).then(buffer=>{spy.native.push({stage:'rendered',duration:buffer.duration});return buffer;});};
  }
  class Recorder{static isTypeSupported(){return true;}state='inactive';mimeType='audio/webm';ondataavailable:any=null;onstop:any=null;onerror:any=null;start(){this.state='recording';}stop(){if(this.state==='inactive')return;this.state='inactive';this.ondataavailable?.({data:new Blob(['original-synthetic-encoded-audio'])});this.onstop?.();}}
  if(!nativeAudio){
  Object.defineProperty(window,'MediaRecorder',{configurable:true,value:Recorder});
  Object.defineProperty(window,'AudioContext',{configurable:true,value:class{async decodeAudioData(){return{duration:1};}async close(){}}});
  Object.defineProperty(window,'OfflineAudioContext',{configurable:true,value:class{destination={};createBufferSource(){return{buffer:null,connect(){},start(){}};}async startRendering(){return{getChannelData:()=>new Float32Array(24000)};}}});
  }
  Object.defineProperty(window,'SpeechSynthesisUtterance',{configurable:true,value:class{onend:any=null;onerror:any=null;constructor(public text:string){}}});
  Object.defineProperty(window,'speechSynthesis',{configurable:true,value:{cancel(){spy.cancels++;},speak(utterance:any){spy.spoken.push(utterance.text);spy.last=utterance;}}});
 },options);
 const checked=checkExploration(createExampleExploration()),now='2026-10-29T15:00:00.000Z';
 const artifact={...checked,id:'629cdb47-2131-4c92-9e22-6900e87cba15',version:1,createdAt:now,updatedAt:now,question:'Why is this node next?',source:{observationId:checked.spec.sources[0].observationId,version:1,kind:'example',label:'Original BFS example',capturedAt:now,summary:'Original synthetic graph.',uncertainty:[]},generation:{mode:'prepared-example',provider:'none',model:null,calls:0,costUsd:0,elapsedMs:0},state:initialExplorationState(checked.spec),saved:false};
 const requests:{path:string;method:string;type:string|null;body:Buffer|null}[]=[];let pending:Route|undefined;
 await page.route('**/api/explore**',async route=>{
  const request=route.request(),path=new URL(request.url()).pathname;
  requests.push({path,method:request.method(),type:request.headers()['content-type']??null,body:request.postDataBuffer()});
  if(path.endsWith('/transcribe')){if(options.delayTranscript){pending=route;return;}return route.fulfill({json:{transcript:'Why does A leave the queue before B?',audioDurationMs:1000,provider:'meta',model:'muse-voice-transcribe-1.0'}});}
  if(request.method()==='GET')return route.fulfill({json:{artifacts:[],active:null,liveEnabled:true}});
  const body=request.postDataJSON();if(body.action==='example')return route.fulfill({json:{artifact}});
  return route.fulfill({status:500,json:{error:'No generated operation belongs in this voice fixture.'}});
 });
 await page.goto('/explore');await expect(page.getByRole('button',{name:'Record question',exact:true})).toBeEnabled();
 return{requests,example:async()=>{await page.getByRole('button',{name:'Try the original example',exact:true}).first().click();await expect(page.getByRole('button',{name:'Read step',exact:true})).toBeEnabled();},finish:async()=>{if(pending)await pending.fulfill({json:{transcript:'Original late transcript',audioDurationMs:1000,turns:[]}}).catch(()=>{});}};
}

test('explicit recording posts bounded WAV and inserts editable text without submitting a question or a screenshot',async({page})=>{
 const h=await setup(page);await page.getByRole('button',{name:'Record question',exact:true}).click();await expect(page.getByRole('button',{name:'Stop and transcribe',exact:true})).toBeVisible();await page.getByRole('button',{name:'Stop and transcribe',exact:true}).click();
 await expect(page.locator('#exploration-question')).toHaveValue('Why does A leave the queue before B?');
 const calls=h.requests.filter(request=>request.path.endsWith('/transcribe'));expect(calls).toHaveLength(1);expect(calls[0].type).toBe('audio/wav');expect(calls[0].body?.subarray(0,4).toString()).toBe('RIFF');expect(calls[0].body?.length).toBe(48044);
 expect(h.requests.filter(request=>request.method==='POST'&&!request.path.endsWith('/transcribe'))).toHaveLength(0);expect(await page.evaluate(()=>(window as any).__voice.stops)).toBeGreaterThan(0);
});

test('native Chromium recording decodes, downmixes and resamples an original synthetic signal to checked PCM WAV',async({page})=>{
 const h=await setup(page,{nativeAudio:true});await page.getByRole('button',{name:'Record question',exact:true}).click();await expect(page.getByRole('button',{name:'Stop and transcribe',exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>(window as any).__voice.chunks.some((size:number)=>size>0))).toBe(true);await page.getByRole('button',{name:'Stop and transcribe',exact:true}).click();
 await expect.poll(async()=>({value:await page.locator('#exploration-question').inputValue(),native:await page.evaluate(()=>(window as any).__voice.native)})).toMatchObject({value:'Why does A leave the queue before B?'});
 const call=h.requests.find(request=>request.path.endsWith('/transcribe'));expect(call?.body).toBeTruthy();const audio=inspectVoiceWav(new Uint8Array(call!.body!));expect(audio.sampleRate).toBe(24000);expect(audio.durationMs).toBeGreaterThan(100);expect(audio.durationMs).toBeLessThan(5000);expect(call!.body!.subarray(44).some(value=>value!==0)).toBe(true);
});

test('denied microphone permission preserves the typed path and sends no audio',async({page})=>{
 const h=await setup(page,{deny:true});await page.getByRole('button',{name:'Record question',exact:true}).click();await expect(page.getByText('Microphone access is unavailable. You can type your question instead.',{exact:true})).toBeVisible();await page.locator('#exploration-question').fill('Typed questions still work.');expect(h.requests.some(request=>request.path.endsWith('/transcribe'))).toBe(false);
});

test('cancelling a pending microphone request stops a late returned track without recording or uploading',async({page})=>{
 const h=await setup(page,{pendingMicrophone:true});await page.getByRole('button',{name:'Record question',exact:true}).click();await page.getByRole('button',{name:'Cancel voice',exact:true}).click();await page.evaluate(()=>(window as any).__voice.resolveMicrophone());await expect.poll(()=>page.evaluate(()=>(window as any).__voice.stops)).toBe(1);expect(h.requests.some(request=>request.path.endsWith('/transcribe'))).toBe(false);
});

test('cancelling an in-flight transcript rejects its late text and leaves the original question intact',async({page})=>{
 const h=await setup(page,{delayTranscript:true});await page.locator('#exploration-question').fill('Keep this typed question.');await page.getByRole('button',{name:'Record question',exact:true}).click();await page.getByRole('button',{name:'Stop and transcribe',exact:true}).click();await expect.poll(()=>h.requests.filter(request=>request.path.endsWith('/transcribe')).length).toBe(1);await page.getByRole('button',{name:'Cancel voice',exact:true}).click();await h.finish();await expect(page.locator('#exploration-question')).toHaveValue('Keep this typed question.');
});

test('step changes and recording immediately stop old browser narration; stale playback events cannot replace the new voice state',async({page})=>{
 const h=await setup(page);await h.example();await page.getByRole('button',{name:'Read step',exact:true}).click();await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toBeVisible();const first=await page.evaluate(()=>(window as any).__voice.spoken[0]);expect(first).toContain('starts in the queue');
 const cancels=await page.evaluate(()=>(window as any).__voice.cancels);await page.getByRole('button',{name:'Next step',exact:true}).click();await expect(page.getByRole('button',{name:'Stop reading',exact:true})).toHaveCount(0);expect(await page.evaluate(()=>(window as any).__voice.cancels)).toBeGreaterThan(cancels);
 await page.getByRole('button',{name:'Read step',exact:true}).click();await page.getByRole('button',{name:'Record question',exact:true}).click();await page.evaluate(()=>(window as any).__voice.last.onend?.());await expect(page.getByRole('button',{name:'Stop and transcribe',exact:true})).toBeVisible();await page.getByRole('button',{name:'Cancel voice',exact:true}).click();expect(h.requests.some(request=>request.path.endsWith('/transcribe'))).toBe(false);
});
