import { it, expect } from 'vitest';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
import { demoSources } from '../fixtures/demo-material/sources';
import { createDemoMaterialStore } from '../fixtures/demo-material/isolated-store';
import { createExplorationService, validateExplorationViewState } from '../../src/lib/server/exploration';
import { checkExploration } from '../../src/lib/domain/exploration';
import { explorationStore } from '../../src/lib/server/exploration-store';
import { explorationExecution } from '../../src/lib/domain/exploration-view';
import { defaultSpatialView } from '../../src/lib/domain/spatial-schema';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { requestMetaVisionResponse } from '../../src/lib/server/meta-vision';
import { requestMetaResponse } from '../../src/lib/server/meta-client';
import type { ExplorationArtifact, ExplorationPrincipal } from '../../src/lib/server/exploration-types';

it.skipIf(process.env.SOMA_DEMO_MATERIAL_LIVE !== 'true')('rehearses three original demo sources through actual Muse, persistence and contextual followups', async () => {
 expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
 expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(15);
 const root=process.env.SOMA_DEMO_ARTIFACT_ROOT ?? `.local/demo-material/run-${Date.now()}`;
 mkdirSync(root,{recursive:true});
 const records:any[]=[]; let current='preflight',call=0;
 const write=()=>writeFileSync(`${root}/results.json`,JSON.stringify(records,null,2));
 const ledger=async()=>Number((await getServerFirestore().doc('somaBudget/global').get()).data()?.consumed??0);
 const capture=(r:any)=>{writeFileSync(`${root}/${current}-call-${++call}.json`,JSON.stringify({status:r.status,structured:r.structured,tools:r.tools.map((t:any)=>({name:t.name,value:t.parsedArguments})),usage:r.usage},null,2));return r;};
 const isolated=process.env.SOMA_DEMO_ISOLATED_STORE==='true';
 const reuseInitial=process.env.SOMA_DEMO_REUSE_INITIAL;
 if(reuseInitial&&!isolated) throw Error('Retained synthetic artifacts require the isolated test store.');
 if(isolated){
  const selected=process.env.SOMA_DEMO_CASES?.split(',')??[];
  expect(selected.length).toBeGreaterThan(0);expect(selected.length).toBeLessThanOrEqual(2);
  expect(new Set(selected).size).toBe(selected.length);
  expect(selected.every(id=>['dsa','speaker'].includes(id))).toBe(true);
 }
 const storageMode=isolated?'isolated-synthetic-memory-with-real-shared-firestore-budget':'production-firestore';
 const testStore=isolated?createDemoMaterialStore():explorationStore;
 const service=createExplorationService({...(isolated?{store:testStore}:{}),reviewEnabled:()=>true,request:async args=>capture(await requestMetaVisionResponse(args)),review:async args=>capture(await requestMetaResponse(args))});
 records.push({phase:'preflight',storageMode,consumed:await ledger(),cap:Number(process.env.META_APP_SPEND_CAP_USD)});write();
 const summary=(phase:string,a:ExplorationArtifact)=>{records.push({case:current,phase,storageMode,mode:a.spec.mode,calls:a.generation.calls,elapsedMs:a.generation.elapsedMs,costUsd:a.generation.costUsd,assurance:a.validation.assurance,audit:a.generation.audit});writeFileSync(`${root}/${current}-${phase}.json`,JSON.stringify(a,null,2));write();};
 for(const c of demoSources){
  if(process.env.SOMA_DEMO_CASES&&!process.env.SOMA_DEMO_CASES.split(',').includes(c.id))continue;
  current=c.id; const id=randomBytes(32).toString('hex');
  const principal:ExplorationPrincipal={kind:'guest',id,workspaceId:id,generation:id,key:`guest-${id}`};
  try{
   const png=await sharp(Buffer.from(c.svg)).png().toBuffer();writeFileSync(`${root}/${c.id}-source.png`,png);
   await service.initialize(principal);
   let first:ExplorationArtifact;
   if(reuseInitial){
    first=JSON.parse(readFileSync(join(reuseInitial,`${c.id}-first.json`),'utf8')) as ExplorationArtifact;
    // Only the original synthetic case may be resumed. Validate its scene/state;
    // retain its original source/version lineage and never claim a fresh extraction.
    expect(first.source.label).toBe(c.label);expect(first.source.kind).toBe('screenshot');
    expect(first.version).toBe(1);expect(first.spec.version).toBe(first.version);
    expect(first.spec.id).toBe(`explore_${first.id.replaceAll('-','')}`);
    expect(first.spec.sources.every(ref=>ref.observationId===first.source.observationId&&ref.version===first.source.version)).toBe(true);
    checkExploration(first.spec);validateExplorationViewState(first.spec,first.state);
    await testStore.mutate(principal,session=>{session.artifacts.push(structuredClone(first));});
    records.push({case:current,phase:'reused-initial',storageMode,originalArtifactId:first.id,version:first.version,calls:0,costUsd:0,meaning:'Previously generated original synthetic artifact; historical generation/cost fields are retained in the artifact but not charged or counted as fresh evidence.'});
    writeFileSync(`${root}/${current}-first.json`,JSON.stringify(first,null,2));write();
   }else{
    first=(await service.generate(principal,{action:'generate',requestId:randomUUID(),question:c.question,source:{kind:'screenshot',label:c.label,capturedAt:new Date().toISOString(),dataUrl:`data:image/png;base64,${png.toString('base64')}`}})).artifact;
    summary('first',first);
   }
   expect(first.spec.mode).not.toBe('clarify');
   await service.save(principal,first.id,first.version,first.state);
   expect((await service.read(principal,first.id,first.version)).active!.spec).toEqual(first.spec);
   if(c.id==='dsa'){
    expect(first.spec.mode).toBe('checked-dijkstra');if(first.spec.mode!=='checked-dijkstra')throw Error('Wrong computational family');
    const input=first.spec.input; const labels=new Map(input.nodes.map(n=>[n.id,n.label.trim().toUpperCase()]));
    const edges=input.edges.map(e=>`${labels.get(e.from)}>${labels.get(e.to)}:${e.weight}`).sort();
    expect(edges).toEqual(['A>B:8','A>C:2','C>B:1','B>D:2','C>D:9'].sort());expect(input.directed).toBe(true);
    const before=explorationExecution(first.spec,first.state)!;
    expect(before.path?.map(id=>labels.get(id))).toEqual(['A','C','B','D']);
    const bd=input.edges.find(e=>labels.get(e.from)==='B'&&labels.get(e.to)==='D')!;
    const state={...first.state,disabledEdgeIds:[bd.id],spatial:defaultSpatialView()};
    const changed=explorationExecution(first.spec,state)!;
    expect(changed.path?.map(id=>labels.get(id))).toEqual(['A','C','D']);
    const {artifact:next}=await service.generate(principal,{action:'generate',requestId:randomUUID(),artifactId:first.id,baseVersion:first.version,state,question:'I disabled the connection from B to D. Explain why the best route changes. Preserve this changed experiment and distinguish the removed hypothetical connection from the original source.'});summary('next',next);
    expect(explorationExecution(next.spec,next.state)!.path?.map(id=>labels.get(id))).toEqual(['A','C','D']);
    expect(explorationExecution(next.spec,next.state)!.input.edges.some(e=>e.id===bd.id)).toBe(false);
    await service.save(principal,next.id,next.version,next.state);expect((await service.read(principal,next.id,next.version)).active!.state).toEqual(next.state);
   } else if(c.id==='speaker'){
    expect(first.spec.mode).toBe('explanation');if(first.spec.mode!=='explanation')throw Error('Wrong spatial assurance');
    const panel=first.spec.scene.panels.find(p=>p.kind==='spatial');expect(panel?.kind).toBe('spatial');if(panel?.kind!=='spatial')throw Error('Missing 3D panel');
    for(const name of ['coil','magnet','diaphragm'])expect(panel.objects.some(o=>new RegExp(name,'i').test(o.label))).toBe(true);
    const coil=panel.objects.find(o=>/coil/i.test(o.label))!;
    const state={...first.state,selectedObjectId:coil.id,spatial:{...defaultSpatialView(),spread:0.55,slice:0.2}};
    await service.save(principal,first.id,first.version,state);
    const {artifact:next}=await service.generate(principal,{action:'generate',requestId:randomUUID(),artifactId:first.id,baseVersion:first.version,state,selectedObjectId:coil.id,question:'Keep the parts, their geometry, the current separation and cutaway. Show the selected voice coil from the side and explain why it moves while the magnet stays fixed.'});summary('next',next);
    expect(next.state.spatial).toMatchObject({azimuth:90,spread:0.55,slice:0.2});expect(next.state.selectedObjectId).toBe(coil.id);
    if(next.spec.mode!=='explanation')throw Error('Lost spatial explanation');const after=next.spec.scene.panels.find(p=>p.kind==='spatial');if(after?.kind!=='spatial')throw Error('Lost spatial panel');
    for(const o of panel.objects){const other=after.objects.find(n=>n.id===o.id);expect(other?.position).toEqual(o.position);expect(other?.size).toEqual(o.size);}
    await service.save(principal,next.id,next.version,next.state);expect((await service.read(principal,next.id,next.version)).active!.state).toEqual(next.state);
   } else {
    expect(first.spec.mode).toBe('explanation');
    records.push({case:c.id,phase:'capability-boundary',audioSynthesisTested:false,frequencySliderImplemented:false,meaning:'This tests visual explanation of the music source; it is not an audible beat simulator.'});
   }
   expect((await service.read(principal,first.id,first.version)).active!.spec).toEqual(first.spec);
   records.push({case:c.id,phase:'verified',exactReopen:true});write();
  }catch(error){
   const failedSession=await testStore.read(principal).catch(()=>null);
   const run=failedSession?.runs.at(-1);
   records.push({case:c.id,phase:'failed',storageMode,code:(error as any).code??'assertion-or-transport',message:String((error as Error).message).slice(0,700),run:run?{status:run.status,code:run.code,failure:run.failure,calls:run.calls,costUsd:run.costUsd,usageCertain:run.usageCertain}:null});write();
  }
  finally{await service.remove(principal).catch(()=>{});records.push({case:c.id,phase:'settled',consumed:await ledger()});write();}
 }
 console.log(JSON.stringify({root,records:records.filter(r=>!r.audit)}));
 expect(records.filter(r=>r.phase==='failed')).toEqual([]);
},360000);
