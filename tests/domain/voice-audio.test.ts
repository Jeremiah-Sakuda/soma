import {describe,it,expect} from 'vitest';
import {encodeVoiceWav,inspectVoiceWav,MAX_VOICE_WAV_BYTES,VoiceAudioError} from '../../src/lib/domain/voice-audio';
describe('bounded canonical voice WAV',()=>{
 it('writes independently checked RIFF/PCM header and signed little-endian samples',()=>{
  const bytes=encodeVoiceWav(new Float32Array([-1,-.5,0,.5,1,2,-2]));const view=new DataView(bytes.buffer);
  expect(new TextDecoder().decode(bytes.slice(0,4))).toBe('RIFF');expect(new TextDecoder().decode(bytes.slice(8,16))).toBe('WAVEfmt ');
  expect(view.getUint32(4,true)).toBe(50);expect(view.getUint32(16,true)).toBe(16);expect(view.getUint16(20,true)).toBe(1);expect(view.getUint16(22,true)).toBe(1);
  expect(view.getUint32(24,true)).toBe(24000);expect(view.getUint32(28,true)).toBe(48000);expect(view.getUint16(32,true)).toBe(2);expect(view.getUint16(34,true)).toBe(16);
  expect(Array.from({length:7},(_,i)=>view.getInt16(44+i*2,true))).toEqual([-32768,-16384,0,16384,32767,32767,-32768]);
 });
 it.each([16000,24000] as const)('accepts exactly 30 seconds at %s Hz and honors typed-array offsets',rate=>{
  const bytes=encodeVoiceWav(new Float32Array(rate*30),rate),container=new Uint8Array(bytes.length+20);container.set(bytes,10);
  expect(inspectVoiceWav(container.subarray(10,10+bytes.length))).toEqual({sampleRate:rate,frames:rate*30,durationMs:30000,byteLength:bytes.length});
  expect(bytes.length).toBeLessThanOrEqual(MAX_VOICE_WAV_BYTES);expect(()=>encodeVoiceWav(new Float32Array(rate*30+1),rate)).toThrow(VoiceAudioError);
 });
 it.each([NaN,Infinity,-Infinity])('rejects a nonfinite input sample %s',value=>{expect(()=>encodeVoiceWav(new Float32Array([value]))).toThrow(VoiceAudioError);});
 it.each([
  (v:DataView)=>v.setUint32(4,99,true),(v:DataView)=>v.setUint16(20,3,true),(v:DataView)=>v.setUint16(22,2,true),
  (v:DataView)=>v.setUint32(24,44100,true),(v:DataView)=>v.setUint32(28,1,true),(v:DataView)=>v.setUint16(32,4,true),
  (v:DataView)=>v.setUint16(34,24,true),(v:DataView)=>v.setUint32(40,3,true),(v:DataView)=>v.setUint32(16,18,true),
 ])('rejects corrupted, compressed or dishonest header %#',change=>{const bytes=encodeVoiceWav(new Float32Array(24000));change(new DataView(bytes.buffer));expect(()=>inspectVoiceWav(bytes)).toThrow(VoiceAudioError);});
 it('rejects metadata chunks, trailing payload, empty and oversized input',()=>{
  const valid=encodeVoiceWav(new Float32Array(24000));const metadata=valid.slice();metadata.set(new TextEncoder().encode('LIST'),36);expect(()=>inspectVoiceWav(metadata)).toThrow();
  const trailer=new Uint8Array(valid.length+2);trailer.set(valid);expect(()=>inspectVoiceWav(trailer)).toThrow();
  expect(()=>inspectVoiceWav(new Uint8Array())).toThrow();expect(()=>encodeVoiceWav(new Float32Array())).toThrow();expect(()=>inspectVoiceWav(new Uint8Array(MAX_VOICE_WAV_BYTES+1))).toThrow();
 });
});
