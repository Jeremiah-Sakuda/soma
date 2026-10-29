export const VOICE_SAMPLE_RATE=24_000;
export const MAX_VOICE_SECONDS=30;
export const MAX_VOICE_WAV_BYTES=44+VOICE_SAMPLE_RATE*MAX_VOICE_SECONDS*2;
export class VoiceAudioError extends Error{constructor(){super('Use a mono 16-bit PCM WAV recording of at most 30 seconds.');}}
const fail=():never=>{throw new VoiceAudioError();};
const fourCC=(bytes:Uint8Array,offset:number)=>String.fromCharCode(...bytes.subarray(offset,offset+4));
/** Canonical, metadata-free PCM RIFF/WAVE only. Reject embedded artwork,
 * unknown chunks, trailing data, stereo, duration lies and unsupported formats. */
export function inspectVoiceWav(bytes:Uint8Array):{sampleRate:16_000|24_000;frames:number;durationMs:number;byteLength:number}{
 if(!(bytes instanceof Uint8Array)||bytes.byteLength<46||bytes.byteLength>MAX_VOICE_WAV_BYTES)fail();
 const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),rate=view.getUint32(24,true),size=view.getUint32(40,true);
 if(fourCC(bytes,0)!=='RIFF'||fourCC(bytes,8)!=='WAVE'||fourCC(bytes,12)!=='fmt '||fourCC(bytes,36)!=='data'||view.getUint32(4,true)!==bytes.byteLength-8||view.getUint32(16,true)!==16||view.getUint16(20,true)!==1||view.getUint16(22,true)!==1||![16_000,24_000].includes(rate)||view.getUint32(28,true)!==rate*2||view.getUint16(32,true)!==2||view.getUint16(34,true)!==16||size!==bytes.byteLength-44||size%2!==0||size<2||size/2>rate*MAX_VOICE_SECONDS)fail();
 return{sampleRate:rate as 16_000|24_000,frames:size/2,durationMs:size/2/rate*1000,byteLength:bytes.byteLength};
}
/** Inputs are downmixed/resampled by the browser's reviewed audio API first. */
export function encodeVoiceWav(samples:Float32Array,sampleRate:16_000|24_000=VOICE_SAMPLE_RATE):Uint8Array{
 if(!(samples instanceof Float32Array)||![16_000,24_000].includes(sampleRate)||samples.length<1||samples.length>sampleRate*MAX_VOICE_SECONDS)fail();
 const bytes=new Uint8Array(44+samples.length*2),view=new DataView(bytes.buffer);
 const text=(offset:number,value:string)=>{for(let i=0;i<value.length;i++)bytes[offset+i]=value.charCodeAt(i);};
 text(0,'RIFF');view.setUint32(4,bytes.length-8,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);text(36,'data');view.setUint32(40,samples.length*2,true);
 for(let i=0;i<samples.length;i++){if(!Number.isFinite(samples[i]))fail();const sample=Math.min(1,Math.max(-1,samples[i]));view.setInt16(44+i*2,Math.round(sample*(sample<0?32768:32767)),true);}
 return bytes;
}
