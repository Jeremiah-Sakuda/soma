import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createExampleExploration } from '../../src/lib/domain/exploration';
import { createCompanionAnalysis } from '../../src/lib/server/companion-analysis';
import { createExplorationService } from '../../src/lib/server/exploration';
import { explorationStore,closeExplorationStore } from '../../src/lib/server/exploration-store';
import { applyCompanionMemoryCommand,projectCompanionMemory } from '../../src/lib/server/companion-memory';
import { MetaClientError,type MetaResult } from '../../src/lib/server/meta-client';
import type { ExplorationPrincipal } from '../../src/lib/server/exploration-types';
const principal=(char='a'):ExplorationPrincipal=>({kind:'guest',id:char.repeat(64),workspaceId:char.repeat(64),generation:char.repeat(64),key:`guest-${char.repeat(64)}`});
let dir:string;
beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'soma-memory-analysis-'));vi.stubEnv('SOMA_PERSISTENCE','local-synthetic');vi.stubEnv('SOMA_EXPLORATION_DB_PATH',join(dir,'explore.sqlite'));vi.stubEnv('VERCEL','');});
afterEach(()=>{closeExplorationStore();vi.unstubAllEnvs();rmSync(dir,{recursive:true,force:true});});
function result(name:string,value:unknown):MetaResult{return {status:'completed',tools:[{type:'function_call',name,arguments:JSON.stringify(value),call_id:randomUUID(),parsedArguments:value as Record<string,unknown>}],usage:{input_tokens:200,output_tokens:100}};}
async function fixture(){const service=createExplorationService({enabled:()=>true});await service.initialize(principal());const {artifact}=await service.example(principal());await service.save(principal(),artifact.id,artifact.version,artifact.state);return {service,artifact,input:{artifactId:artifact.id,version:artifact.version,revision:0,requestId:randomUUID()}};}
function proposal(raw:{artifactId:string;version:number}){const ref={artifactId:raw.artifactId,version:raw.version};return {concepts:[{id:'breadth',label:'Breadth-first exploration',summary:'FIFO explores successive layers.',uncertainty:['Only one source observed.'],refs:[ref]}],relationships:[],nextActivity:{question:'How does a cycle change the need to track visited nodes?',reason:'Investigate a related idea without assuming mastery.',conceptIds:['breadth'],refs:[ref]}};}
function harness(ref:{artifactId:string;version:number},override:Parameters<typeof createCompanionAnalysis>[0]={}){const request=vi.fn(async(args:any)=>args.tools[0].name==='select_memories'?result('select_memories',{refs:[],reason:'Start with the selected source.'}):result('propose_memory',proposal(ref)));const reserve=vi.fn(async()=>randomUUID()),settle=vi.fn(async()=>{});return {request,reserve,settle,run:createCompanionAnalysis({request,upperBound:()=>.02,reserve,settle,enabled:()=>true,revalidate:async()=>{},...override})};}
it('uses two real service stages, persists evidence-linked proposal and accounts usage',async()=>{const {input}=await fixture();const h=harness(input);const out=await h.run(principal(),input);expect(h.request).toHaveBeenCalledTimes(2);expect(out.memory.concepts[0].provenance).toBe('model-proposal');expect(out.memory.nextActivity?.conceptIds).toEqual(['breadth']);expect(out.audit.calls).toBe(2);expect(h.settle).toHaveBeenCalledWith(expect.any(String),expect.any(Number),true);const session=await explorationStore.read(principal());expect(session?.runs.at(-1)?.status).toBe('published');expect(session?.activeRequestId).toBeNull();});
it('cannot connect a foreign account artifact and spends nothing',async()=>{const {input}=await fixture();await createExplorationService().initialize(principal('b'));const h=harness(input);await expect(h.run(principal('b'),input)).rejects.toMatchObject({code:'not_found'});expect(h.reserve).not.toHaveBeenCalled();});
it('requires a saved source, not merely a visible draft',async()=>{const {input}=await fixture();await explorationStore.mutate(principal(),s=>{s.artifacts[0].saved=false;});const h=harness(input);await expect(h.run(principal(),input)).rejects.toMatchObject({code:'not_found'});expect(h.reserve).not.toHaveBeenCalled();});
it('rejects invented memory retrieval references before composition',async()=>{const {input}=await fixture();const request=vi.fn(async()=>result('select_memories',{refs:[{artifactId:randomUUID(),version:1}],reason:'Forged'}));const h=harness(input,{request});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'generation_invalid'});expect(request).toHaveBeenCalledTimes(1);expect((await explorationStore.read(principal()))?.memory).toBeUndefined();});
it('rejects publishing after a goal edit during the model call',async()=>{const {input}=await fixture();const request=vi.fn(async()=>{await explorationStore.mutate(principal(),s=>{applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:0,kind:'goal',text:'Learn biology'});});return result('select_memories',{refs:[],reason:'Read current'});});const h=harness(input,{request});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'revision_conflict'});expect((await explorationStore.read(principal()))?.memory?.concepts).toEqual([]);});
it('source deletion during composition cannot republish the deleted interpretation',async()=>{const {input,service}=await fixture();let n=0;const request=vi.fn(async()=>{if(++n===1)return result('select_memories',{refs:[],reason:'Current'});await service.remove(principal(),input.artifactId);return result('propose_memory',proposal(input));});const h=harness(input,{request});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'cancelled'});expect((await explorationStore.read(principal()))?.artifacts).toEqual([]);});
it('rejects proposals that cite owned but uninspected sources',async()=>{const {input,service}=await fixture();const second=await service.example(principal());await service.save(principal(),second.artifact.id,1,second.artifact.state);let n=0;const h=harness(input,{request:async()=>++n===1?result('select_memories',{refs:[],reason:'Only current'}):result('propose_memory',proposal({artifactId:second.artifact.id,version:1}))});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'generation_invalid'});});
it('retains reservation on unknown provider usage and records failure facts',async()=>{const {input}=await fixture();const h=harness(input,{request:async()=>{throw new MetaClientError('timeout',null,true);}});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'timeout'});expect(h.settle).toHaveBeenCalledWith(expect.any(String),0,false);expect((await explorationStore.read(principal()))?.runs.at(-1)?.usageCertain).toBe(false);});
it('preflight rejects a request that exceeds remaining reservation',async()=>{const {input}=await fixture();const h=harness(input,{upperBound:()=>1});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'capacity'});expect(h.request).not.toHaveBeenCalled();expect(h.settle).toHaveBeenCalledWith(expect.any(String),0,true);});
it('deduplicates request ids before reserving again',async()=>{const {input}=await fixture();const h=harness(input);await h.run(principal(),input);await expect(h.run(principal(),input)).rejects.toMatchObject({code:'revision_conflict'});expect(h.reserve).toHaveBeenCalledTimes(1);});
it('cancellation during provider work prevents interpretation writes and settles actual usage',async()=>{const {input}=await fixture();const controller=new AbortController();const h=harness(input,{request:async()=>{controller.abort();return result('select_memories',{refs:[],reason:'Current'});}});await expect(h.run(principal(),input,controller.signal)).rejects.toMatchObject({code:'cancelled'});expect(h.settle).toHaveBeenCalledWith(expect.any(String),expect.any(Number),true);expect((await explorationStore.read(principal()))?.runs.at(-1)?.status).toBe('cancelled');});
it('deleting a saved source physically prunes linked concepts and its next activity',async()=>{const {input,service}=await fixture();await harness(input).run(principal(),input);await service.remove(principal(),input.artifactId);const s=(await explorationStore.read(principal()))!;expect(s.memory?.concepts).toEqual([]);expect(projectCompanionMemory(s).nextActivity).toBeUndefined();});

it('forgetting memory during settlement suppresses the already-published response',async()=>{const {input}=await fixture();const h=harness(input,{settle:async()=>{await explorationStore.mutate(principal(),s=>{applyCompanionMemoryCommand(s,{action:'reset',revision:1});});}});await expect(h.run(principal(),input)).rejects.toMatchObject({code:'revision_conflict'});expect((await explorationStore.read(principal()))?.memory?.concepts).toEqual([]);});

it('future generation receives prior goals and concept evidence, with an inspectable audit',async()=>{
 const {input}=await fixture();await harness(input).run(principal(),input);
 await explorationStore.mutate(principal(),s=>{applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:1,kind:'goal',text:'Understand systems across subjects'});});
 const contexts:any[]=[];
 const request=vi.fn(async(args:any)=>{
   const context=JSON.parse(args.input[0].content);contexts.push(context);
   if(!args.instructions.includes('Required spec id=')){const example=createExampleExploration();return result('inspect_source',{summary:'Original directed graph',uncertainty:[],graph:example.mode==='checked-bfs'?example.input:null});}
   const spec=createExampleExploration({observationId:context.source.observationId,version:context.source.version,region:null});
   const binding=/Required spec id=([^ ]+) and version=(\d+)/.exec(args.instructions)!;spec.id=binding[1];spec.version=Number(binding[2]);return result('compose_exploration',{spec});
 });
 const service=createExplorationService({request,upperBound:()=>.02,enabled:()=>true,reserve:async()=>randomUUID(),settle:async()=>{},revalidate:async()=>{}});
 const out=await service.generate(principal(),{action:'generate',requestId:randomUUID(),question:'How does breadth-first order relate to my prior exploration?',source:{kind:'example',label:'Original example',capturedAt:new Date().toISOString()}});
 expect(contexts[0].personalContext.goals[0].text).toBe('Understand systems across subjects');
 expect(contexts[1].personalContext.concepts[0].id).toBe('breadth');
 expect(out.artifact.generation.audit.some(e=>e.detail.includes('Personal context revision'))).toBe(true);
});
it('forgetting goals while a new visual is preparing prevents stale personalized publication',async()=>{
 const {input}=await fixture();await harness(input).run(principal(),input);
 const request=vi.fn(async()=>{await explorationStore.mutate(principal(),s=>{applyCompanionMemoryCommand(s,{action:'reset',revision:1});});const example=createExampleExploration();return result('inspect_source',{summary:'Original graph',uncertainty:[],graph:example.mode==='checked-bfs'?example.input:null});});
 const service=createExplorationService({request,upperBound:()=>.02,enabled:()=>true,reserve:async()=>randomUUID(),settle:async()=>{},revalidate:async()=>{}});
 await expect(service.generate(principal(),{action:'generate',requestId:randomUUID(),question:'Explain my next idea',source:{kind:'example',label:'Original example',capturedAt:new Date().toISOString()}})).rejects.toMatchObject({code:'revision_conflict'});
 expect((await explorationStore.read(principal()))?.artifacts).toHaveLength(1);
});
