import {randomUUID} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {encodeVoiceWav,MAX_VOICE_WAV_BYTES} from '../../src/lib/domain/voice-audio';
import {createVoiceTranscriber,readVoiceBody,VOICE_ENDPOINT,VOICE_MODEL} from '../../src/lib/server/voice-transcribe';
import {ExplorationError,type ExplorationPrincipal} from '../../src/lib/server/exploration-types';
const principal:ExplorationPrincipal={kind:'guest',id:'a'.repeat(64),workspaceId:'a'.repeat(64),generation:'a'.repeat(64),key:'original-voice-guest'};
const wav=()=>encodeVoiceWav(new Float32Array(24000));
const response=(value:unknown={transcript:'Why does that node come next?',audioDurationMs:1000,turns:[]})=>Response.json(value);
afterEach(()=>vi.restoreAllMocks());
function harness(){
 const store={read:vi.fn(async()=>({})),mutate:vi.fn(async(_principal:unknown,_change:unknown,_options:unknown)=>({}))},revalidate=vi.fn(async()=>{}),reserve=vi.fn(async()=>randomUUID()),settle=vi.fn(async()=>{}),fetch=vi.fn(async()=>response());
 const transcribe=createVoiceTranscriber({store:store as never,revalidate,reserve,settle,fetch:fetch as never,enabled:()=>true,key:()=> 'original-private-test-key'});
 return{transcribe,store,revalidate,reserve,settle,fetch};
}
describe('bounded optional Meta voice transcription',()=>{
 it('sends only canonical audio and fixed push-to-talk config, retaining no audio or transcript in storage',async()=>{
  const h=harness();const result=await h.transcribe(principal,wav());expect(result).toEqual({transcript:'Why does that node come next?',audioDurationMs:1000,provider:'meta',model:VOICE_MODEL});
  const [target,options]=h.fetch.mock.calls[0] as unknown as[string,RequestInit];expect(target).toBe(VOICE_ENDPOINT);expect(options.redirect).toBe('error');expect(options.headers).toEqual({authorization:'Bearer original-private-test-key',accept:'application/json'});
  const body=options.body as FormData;expect(JSON.parse(await (body.get('request') as Blob).text())).toEqual({mode:'PUSH_TO_TALK',model:VOICE_MODEL,audioEncoding:'WAV'});expect(new Uint8Array(await (body.get('audio') as Blob).arrayBuffer())).toEqual(wav());
  expect(h.store.mutate).toHaveBeenCalledTimes(2);expect(h.store.mutate.mock.calls[0][2]).toHaveProperty('acquire');expect(h.store.mutate.mock.calls[1][2]).toHaveProperty('release');
  expect(h.settle).toHaveBeenCalledWith(expect.any(String),.00005,true);expect(h.revalidate).toHaveBeenCalledTimes(5);
 });
 it('rounds known processed duration down to whole seconds',async()=>{const h=harness();h.fetch.mockResolvedValue(response({transcript:'Original synthetic question',audioDurationMs:1999,turns:[]}));await h.transcribe(principal,wav());expect(h.settle).toHaveBeenCalledWith(expect.any(String),.00005,true);});
 it.each([null,{transcript:'Question',turns:[]},{transcript:'Question',audioDurationMs:Infinity,turns:[]}])('retains full reservation if post-send usage is unknown %#',async value=>{const h=harness();h.fetch.mockResolvedValue(response(value));await expect(h.transcribe(principal,wav())).rejects.toMatchObject({code:'response_invalid'});expect(h.settle).toHaveBeenCalledWith(expect.any(String),0,false);});
 it('retains full reservation on sent network failure and sanitizes provider details',async()=>{const h=harness();h.fetch.mockRejectedValue(new Error('original-private-test-key private audio error'));await expect(h.transcribe(principal,wav())).rejects.toMatchObject({code:'unavailable',message:'Voice transcription is unavailable. Please type your question.'});expect(h.settle).toHaveBeenCalledWith(expect.any(String),0,false);});
 it('validates format and session ownership before paying or sending any audio',async()=>{const h=harness();await expect(h.transcribe(principal,new Uint8Array(46))).rejects.toMatchObject({code:'invalid_audio'});expect(h.reserve).not.toHaveBeenCalled();h.store.read.mockResolvedValue(null as never);await expect(h.transcribe(principal,wav())).rejects.toMatchObject({code:'session_expired'});expect(h.fetch).not.toHaveBeenCalled();});
 it('blocks publication if the account or workspace generation changes during transcription',async()=>{const h=harness();h.fetch.mockImplementation(async()=>{h.revalidate.mockRejectedValue(new ExplorationError('forbidden'));return response();});await expect(h.transcribe(principal,wav())).rejects.toMatchObject({code:'forbidden'});expect(h.settle).toHaveBeenCalledWith(expect.any(String),.00005,true);});
 it('withholds a transcript revoked while budget settlement awaits',async()=>{
  const h=harness();let finish!:()=>void;h.settle.mockImplementation(()=>new Promise<void>(resolve=>{finish=resolve;}));
  const work=h.transcribe(principal,wav());await vi.waitFor(()=>expect(h.settle).toHaveBeenCalled());h.revalidate.mockRejectedValue(new ExplorationError('forbidden'));finish();
  await expect(work).rejects.toMatchObject({code:'forbidden'});expect(h.store.mutate).toHaveBeenCalledTimes(2);
 });
 it('cancels late transcripts without early shared-slot release',async()=>{
  const h=harness(),controller=new AbortController();let finish!:(response:Response)=>void;h.fetch.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
  const work=h.transcribe(principal,wav(),controller.signal);await vi.waitFor(()=>expect(h.fetch).toHaveBeenCalled());controller.abort();expect(h.store.mutate).toHaveBeenCalledTimes(1);
  finish(response());await expect(work).rejects.toMatchObject({code:'cancelled'});expect(h.store.mutate).toHaveBeenCalledTimes(2);expect(h.settle).toHaveBeenCalledWith(expect.any(String),0,false);
 });
 it('settles a failed transcript with known duration without persisting provider errors',async()=>{const h=harness();h.fetch.mockResolvedValue(response({transcript:'',audioDurationMs:1000,turns:[]}));await expect(h.transcribe(principal,wav())).rejects.toMatchObject({code:'no_speech'});expect(h.settle).toHaveBeenCalledWith(expect.any(String),.00005,true);});
 it('rejects too-large streamed audio even when content length is absent or false',async()=>{
  for(const declared of [undefined,'1']){const request=new Request('https://soma.example/api/explore/transcribe',{method:'POST',headers:{'content-type':'audio/wav',...(declared?{'content-length':declared}:{})},body:new Uint8Array(MAX_VOICE_WAV_BYTES+1)});await expect(readVoiceBody(request)).rejects.toMatchObject({code:'body_size'});}
 });
 it('requires exact audio media type and rejects declared oversize before reading',async()=>{await expect(readVoiceBody(new Request('https://soma.example',{method:'POST',headers:{'content-type':'audio/webm'},body:new Uint8Array(wav())}))).rejects.toMatchObject({code:'content_type'});await expect(readVoiceBody(new Request('https://soma.example',{method:'POST',headers:{'content-type':'audio/wav','content-length':String(MAX_VOICE_WAV_BYTES+1)},body:new Uint8Array(wav())}))).rejects.toMatchObject({code:'body_size'});});
});
