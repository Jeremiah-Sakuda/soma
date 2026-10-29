import {describe,it,expect,vi} from 'vitest';
import {PreparedAudio} from '../../src/lib/client/prepared-audio';

describe('ephemeral narration preparation',()=>{
 it('joins in-flight preparation and reuses completed audio',async()=>{
  const buffer=new PreparedAudio();let resolve!:(blob:Blob)=>void;
  const load=vi.fn(()=>new Promise<Blob>(done=>{resolve=done;}));
  const ahead=buffer.get('next',load),active=buffer.get('next',load);
  expect(active).toBe(ahead);expect(load).toHaveBeenCalledTimes(1);
  const blob=new Blob(['audio']);resolve(blob);expect(await active).toBe(blob);
  expect(await buffer.get('next',load)).toBe(blob);expect(load).toHaveBeenCalledTimes(1);
 });
 it('cancels pending work and withholds a late result while retaining finished replay',async()=>{
  const buffer=new PreparedAudio(),saved=new Blob(['saved']);await buffer.get('saved',async()=>saved);
  let signal!:AbortSignal,resolve!:(blob:Blob)=>void;
  const old=buffer.get('next',s=>{signal=s;return new Promise<Blob>(done=>{resolve=done;});});
  buffer.cancel();expect(signal.aborted).toBe(true);
  const fresh=new Blob(['fresh']);await buffer.get('next',async()=>fresh);
  resolve(new Blob(['late']));await expect(old).rejects.toMatchObject({name:'AbortError'});
  expect(await buffer.get('next',async()=>{throw Error('unexpected');})).toBe(fresh);
  expect(await buffer.get('saved',async()=>{throw Error('unexpected');})).toBe(saved);
 });
 it('does not silently retry failed speculative synthesis on demand',async()=>{
  const buffer=new PreparedAudio(),load=vi.fn(async()=>{throw Error('capacity');});
  await expect(buffer.get('next',load)).rejects.toThrow('capacity');
  await expect(buffer.get('next',load)).rejects.toThrow('capacity');expect(load).toHaveBeenCalledTimes(1);
  buffer.cancel();await expect(buffer.get('next',load)).rejects.toThrow('capacity');expect(load).toHaveBeenCalledTimes(2);
 });
 it('bounds replay retention and clears it on an artifact change',async()=>{
  const buffer=new PreparedAudio(),load=vi.fn(async()=>new Blob(['audio']));
  for(let i=0;i<13;i++)await buffer.get(String(i),load);
  await buffer.get('1',load);expect(load).toHaveBeenCalledTimes(13);
  await buffer.get('0',load);expect(load).toHaveBeenCalledTimes(14);
  buffer.clear();await buffer.get('0',load);expect(load).toHaveBeenCalledTimes(15);
 });
});
