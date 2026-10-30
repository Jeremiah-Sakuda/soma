import {describe,it,expect} from 'vitest';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createGeminiSpeaker,GEMINI_TTS_MODEL} from '../../src/lib/server/gemini-speech';
import {createExplorationService} from '../../src/lib/server/exploration';
import {inspectVoiceWav} from '../../src/lib/domain/voice-audio';
import type {ExplorationPrincipal} from '../../src/lib/server/exploration-types';

describe.skipIf(process.env.SOMA_GEMINI_SPEECH_LIVE!=='true')('actual Gemini playback',()=>{
 it('synthesizes an owned original example through the configured Soma billing project',async()=>{
  const id=randomBytes(32).toString('hex'),principal:ExplorationPrincipal={kind:'guest',id,workspaceId:id,generation:id,key:`guest-${id}`},service=createExplorationService();
  await service.initialize(principal);const {artifact}=await service.example(principal);const started=Date.now();
  const speak=createGeminiSpeaker({fetch:async(...args)=>{const response=await fetch(...args);if(!response.ok){const raw=await response.clone().json().catch(()=>null);console.error('Gemini request status',response.status,raw?.error?.status,raw?.error?.message?.slice(0,500),JSON.stringify(raw?.error?.details));}return response;}});
  try{const audio=await speak(principal,{artifactId:artifact.id,version:1,state:artifact.state});const info=inspectVoiceWav(audio);expect(info.durationMs).toBeGreaterThan(1000);expect(audio.subarray(44).some(value=>value!==0)).toBe(true);mkdirSync('.local/pm042',{recursive:true});writeFileSync('.local/pm042/original-example.wav',audio);writeFileSync('.local/pm042/live-result.json',JSON.stringify({model:GEMINI_TTS_MODEL,...info,elapsedMs:Date.now()-started,reservedUsd:.03},null,2)+'\n');}
  finally{await service.remove(principal);}
 },60_000);
});
