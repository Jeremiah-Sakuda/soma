import {describe,it,expect} from 'vitest';
import {randomBytes,randomUUID} from 'node:crypto';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createExplorationService} from '../../src/lib/server/exploration';
import {requestMetaVisionResponse} from '../../src/lib/server/meta-vision';
import type {ExplorationPrincipal} from '../../src/lib/server/exploration-types';

describe.skipIf(process.env.SOMA_EXPLORATION_PRESENTATION_LIVE!=='true')('actual Spark presentation follow-up',()=>{
 it('reuses original synthetic context and generates narration plus richer explanatory panels',async()=>{
  mkdirSync('.local/pm040',{recursive:true});let call=0;
  const id=randomBytes(32).toString('hex'),principal:ExplorationPrincipal={kind:'guest',id,workspaceId:id,generation:id,key:`guest-${id}`},service=createExplorationService({request:async args=>{
   // This opt-in case uses original synthetic material only. Retain structured
   // outputs and bounded repair facts locally, never raw provider reasoning.
   const result=await requestMetaVisionResponse(args);call++;
   writeFileSync(`.local/pm040/synthetic-call-${call}.json`,JSON.stringify({status:result.status,tools:result.tools,repair:args.input.filter(item=>typeof item==='object'&&item!==null&&'type' in item&&item.type==='function_call_output')},null,2)+'\n');return result;
  }});
  await service.initialize(principal);const original=(await service.example(principal)).artifact;
  try{
   const {artifact}=await service.generate(principal,{action:'generate',requestId:randomUUID(),artifactId:original.id,baseVersion:1,intent:'focus',question:'Explain why A leaves the queue next. Keep this exact graph and current step. Add a sequence panel showing the two queued nodes A then B, and a short key-idea callout. Include natural spoken narration bound to this step.',state:{...original.state,step:1,selectedObjectId:'a'}});
   mkdirSync('.local/pm040',{recursive:true});writeFileSync('.local/pm040/live-presentation.json',JSON.stringify({generation:artifact.generation,validation:artifact.validation,spec:artifact.spec,state:artifact.state},null,2)+'\n');
   expect(artifact.spec.mode).toBe('checked-bfs');if(artifact.spec.mode!=='checked-bfs'||original.spec.mode!=='checked-bfs')throw Error('Expected checked example');
   expect(artifact.spec.input).toEqual(original.spec.input);expect(artifact.state.step).toBe(1);expect(artifact.generation.audit[0].event).toBe('source-reused');expect(artifact.generation.calls).toBeLessThanOrEqual(2);expect(artifact.spec.scene.panels.some(p=>p.kind==='sequence')).toBe(true);expect(artifact.spec.steps.some(s=>s.executionStep===1&&s.narration)).toBe(true);
  }finally{await service.remove(principal);}
 },100_000);
});
