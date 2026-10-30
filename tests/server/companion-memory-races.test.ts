import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createCompanionAnalysis } from '../../src/lib/server/companion-analysis';
import { createExplorationService } from '../../src/lib/server/exploration';
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
import { applyCompanionMemoryCommand } from '../../src/lib/server/companion-memory';
import { ExplorationError, type ExplorationPrincipal } from '../../src/lib/server/exploration-types';
import type { MetaResult } from '../../src/lib/server/meta-client';
const principal: ExplorationPrincipal = { kind:'guest', id:'a'.repeat(64), workspaceId:'a'.repeat(64), generation:'a'.repeat(64), key:`guest-${'a'.repeat(64)}` };
let directory: string;
beforeEach(() => { directory = mkdtempSync(join(tmpdir(), 'soma-memory-races-')); vi.stubEnv('SOMA_PERSISTENCE','local-synthetic'); vi.stubEnv('VERCEL',''); vi.stubEnv('SOMA_EXPLORATION_DB_PATH',join(directory,'state.sqlite')); });
afterEach(() => { closeExplorationStore(); vi.unstubAllEnvs(); rmSync(directory,{recursive:true,force:true}); });
function result(name: string, value: unknown): MetaResult { return { status:'completed',tools:[{type:'function_call',name,call_id:randomUUID(),arguments:JSON.stringify(value),parsedArguments:value as Record<string,unknown>}],usage:{input_tokens:30,output_tokens:30} }; }
async function fixture() {
  const service=createExplorationService(); await service.initialize(principal);
  const {artifact}=await service.example(principal); await service.save(principal,artifact.id,1,artifact.state);
  const input={artifactId:artifact.id,version:1,revision:0,requestId:randomUUID()};
  const proposal={concepts:[{id:'frontier',label:'Frontier',summary:'FIFO layers',uncertainty:[],refs:[{artifactId:artifact.id,version:1}]}],relationships:[]};
  let calls=0;
  const request=vi.fn(async()=>++calls===1?result('select_memories',{refs:[],reason:'Current'}):result('propose_memory',proposal));
  return {input,request,proposal};
}
it('ownership revocation before publication prevents writes and retains billing facts',async()=>{
  const f=await fixture();let valid=true;
  const request=vi.fn(async()=>{const result=await f.request();if(request.mock.calls.length===2)valid=false;return result;});
  const settle=vi.fn(async()=>{});
  const run=createCompanionAnalysis({request,upperBound:()=>.01,enabled:()=>true,reserve:async()=>randomUUID(),settle,revalidate:async()=>{if(!valid)throw new ExplorationError('forbidden');}});
  await expect(run(principal,f.input)).rejects.toMatchObject({code:'forbidden'});
  expect((await explorationStore.read(principal))?.memory).toBeUndefined();expect(settle).toHaveBeenCalledWith(expect.any(String),expect.any(Number),true);
});
it('ownership revoked during budget settlement prevents returning saved private data',async()=>{
  const f=await fixture();let valid=true;
  const run=createCompanionAnalysis({request:f.request,upperBound:()=>.01,enabled:()=>true,reserve:async()=>randomUUID(),settle:async()=>{valid=false;},revalidate:async()=>{if(!valid)throw new ExplorationError('forbidden');}});
  await expect(run(principal,f.input)).rejects.toMatchObject({code:'forbidden'});
});
it('reset during selection blocks both composition and any interpretation resurrection',async()=>{
  const f=await fixture();const request=vi.fn(async()=>{await explorationStore.mutate(principal,s=>applyCompanionMemoryCommand(s,{action:'reset',revision:0}));return result('select_memories',{refs:[],reason:'Current'});});
  const run=createCompanionAnalysis({request,upperBound:()=>.01,enabled:()=>true,reserve:async()=>randomUUID(),settle:async()=>{},revalidate:async()=>{}});
  await expect(run(principal,f.input)).rejects.toMatchObject({code:'revision_conflict'});expect(request).toHaveBeenCalledTimes(1);
  expect((await explorationStore.read(principal))?.memory).toMatchObject({revision:1,concepts:[]});
});
