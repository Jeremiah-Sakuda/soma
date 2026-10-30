import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import { applyCompanionMemoryCommand, applyCompanionMemoryProposal, projectCompanionMemory, companionMemoryContext, mutateCompanionMemory, pruneCompanionMemory } from '../../src/lib/server/companion-memory';
import { closeExplorationStore, explorationStore } from '../../src/lib/server/exploration-store';
import type { ExplorationArtifact, ExplorationSession, ExplorationPrincipal } from '../../src/lib/server/exploration-types';

const now = '2026-10-30T12:00:00.000Z';
function artifact(id = 'source_a', version = 1): ExplorationArtifact {
  const source = { observationId: `obs_${id}`, version: 1, kind: 'example' as const, label: 'Original example', capturedAt: now, summary: 'A graph', uncertainty: [] };
  return { ...checkExploration(createExampleExploration({ observationId: source.observationId, version: 1, region: null })), id, version, createdAt: now, updatedAt: now, question: 'Explain this', source,
    generation: { mode: 'prepared-example', provider: 'none', model: null, calls: 0, usage: {input_tokens:0,output_tokens:0}, costUsd:0,elapsedMs:0,checks:[],audit:[] },
    state: {step:0,explanationStep:0,selectedObjectId:null,start:'S',goal:'G',disabledEdgeIds:[],reversed:false}, saved:true } as ExplorationArtifact;
}
function session(): ExplorationSession { return {schemaVersion:1,owner:'a',workspaceId:'a',generation:'a',createdAt:now,expiresAt:'2100-01-01T00:00:00Z',revision:0,artifacts:[artifact()],runs:[],activeRequestId:null}; }
const refs = [{artifactId:'source_a',version:1}];
function proposal() { return structuredClone({ concepts:[{id:'frontier',label:'Frontier',summary:'Queue order',uncertainty:['Interpretation'],refs},{id:'paths',label:'Paths',summary:'Shortest connections',uncertainty:[],refs}],relationships:[{id:'frontier_paths',from:'frontier',to:'paths',kind:'related',reason:'Queue order affects discovery',refs}],nextActivity:{question:'Compare two routes',reason:'Investigate the connection',conceptIds:['frontier'],refs}}); }

describe('companion memory facts and interpretations', () => {
  it('keeps self-reports distinct, revisions immutable, and stale edits atomic', () => {
    const s=session(); const first=applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:0,kind:'goal',text:'Understand music theory'}); const id=first.goals[0].id;
    applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:1,id,kind:'preference',text:'Use visual explanations'});
    expect(s.memory!.goals.map(g=>g.text)).toEqual(['Understand music theory','Use visual explanations']);
    expect(projectCompanionMemory(s).goals).toMatchObject([{id,revision:2,provenance:'self-report'}]);
    const before=JSON.stringify(s);expect(()=>applyCompanionMemoryCommand(s,{action:'delete-goal',revision:1,id})).toThrow(); expect(JSON.stringify(s)).toBe(before);
    applyCompanionMemoryCommand(s,{action:'delete-goal',revision:2,id});expect(s.memory!.goals).toEqual([]);
  });
  it('binds proposed concepts and connections to exact saved sources', () => {
    const s=session(); const view=applyCompanionMemoryProposal(s,proposal(),{revision:0,now});
    expect(view.concepts[0]).toMatchObject({id:'frontier',revision:1,provenance:'model-proposal',refs:[{observationId:'obs_source_a',sourceVersion:1}]});
    expect(view.nextActivity?.conceptIds).toEqual(['frontier']);expect(view.evidence).toEqual([]);
    expect(JSON.stringify(view)).not.toContain('mastery');
  });
  it.each(['foreign','stale-version','unsaved','invented-mastery','foreign-concept','self-link','duplicates'])('rejects %s proposals with no partial update', which=>{
    const s=session();const p=proposal();
    if(which==='foreign') p.concepts[1].refs=[{artifactId:'other_account',version:1}];
    if(which==='stale-version') p.concepts[1].refs=[{artifactId:'source_a',version:2}];
    if(which==='unsaved')s.artifacts[0].saved=false;
    if(which==='invented-mastery')Object.assign(p.concepts[1],{mastery:1});
    if(which==='foreign-concept')p.relationships[0].to='other';
    if(which==='self-link')p.relationships[0].to='frontier';
    if(which==='duplicates')p.concepts[1].id='frontier';
    expect(()=>applyCompanionMemoryProposal(s,p,{revision:0})).toThrow();expect(s.memory).toBeUndefined();
  });
  it('retains prior interpretations while projecting only latest, and protects human corrections',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});
    const p=proposal();p.concepts[0].summary='Changed interpretation';applyCompanionMemoryProposal(s,p,{revision:1});
    expect(s.memory!.concepts.filter(c=>c.id==='frontier')).toHaveLength(2);
    applyCompanionMemoryCommand(s,{action:'correct-concept',revision:2,id:'frontier',label:'My correction',summary:'I meant a different concept'});
    expect(projectCompanionMemory(s).concepts[0].provenance).toBe('user-correction');expect(projectCompanionMemory(s).relationships).toEqual([]);
    expect(projectCompanionMemory(s).nextActivity).toBeUndefined();
    expect(()=>applyCompanionMemoryProposal(s,p,{revision:3})).toThrow();
  });
  it('removes entire claims after a source deletion, including private summary and old revisions',()=>{
    const s=session();s.artifacts.push(artifact('source_b'));const p=proposal();p.concepts[0].summary='Private deleted concept';p.concepts[0].refs=[...p.concepts[0].refs,{artifactId:'source_b',version:1}];
    applyCompanionMemoryProposal(s,p,{revision:0});s.artifacts=s.artifacts.filter(a=>a.id!=='source_b');
    expect(projectCompanionMemory(s).concepts.map(c=>c.id)).toEqual(['paths']);
    expect(JSON.stringify(companionMemoryContext(s))).not.toContain('Private deleted');expect(projectCompanionMemory(s).nextActivity).toBeUndefined();
    applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:1,kind:'goal',text:'Another goal'});
    expect(JSON.stringify(s.memory)).not.toContain('Private deleted');
  });
  it('does not resurrect an older interpretation when the newest source is removed',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});s.artifacts.push(artifact('source_b'));
    const p=proposal();p.concepts[0].refs=[{artifactId:'source_b',version:1}];applyCompanionMemoryProposal(s,p,{revision:1});s.artifacts=s.artifacts.filter(a=>a.id!=='source_b');
    expect(projectCompanionMemory(s).concepts.map(c=>c.id)).toEqual(['paths']);
    applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:2,kind:'goal',text:'New goal'});expect(projectCompanionMemory(s).concepts.map(c=>c.id)).toEqual(['paths']);
  });
  it('persistently prunes source-dependent data and fences pending analyses once',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});s.artifacts=[];
    pruneCompanionMemory(s);expect(s.memory).toMatchObject({revision:2,concepts:[],relationships:[]});
    expect(s.memory!.nextActivity).toBeUndefined();pruneCompanionMemory(s);expect(s.memory!.revision).toBe(2);
  });
  it('rejects changed source lineage and keeps exact retained historical versions',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});s.artifacts.push(artifact('source_a',2));expect(projectCompanionMemory(s).concepts).toHaveLength(2);
    s.artifacts[0].source.version=2;expect(projectCompanionMemory(s).concepts).toEqual([]);
  });
  it('projects only real answered records and preserves help and reveal exposure',()=>{
    const s=session();const common={id:'attempt',artifactId:'source_a',version:1,sourceObservationId:'obs_source_a',sourceVersion:1,modelVersion:'bfs-unweighted-v1',state:s.artifacts[0].state,createdAt:now,prompt:'Predict',options:[],expectedNodeId:'G',revealedAt:now,exposure:'diagram-visible-practice' as const};
    s.predictions=[{...common,answer:null}];expect(projectCompanionMemory(s).evidence).toEqual([]);
    s.predictions[0].answer={nodeId:'G',reason:'My reason',recordedAt:now,matches:true};expect(projectCompanionMemory(s).evidence[0]).toMatchObject({assistance:'diagram-visible',matches:true,revealedBeforeAnswer:true,reason:'My reason'});
    const before=JSON.stringify(s.predictions);applyCompanionMemoryProposal(s,proposal(),{revision:0});expect(JSON.stringify(s.predictions)).toBe(before);
    s.predictions[0].sourceVersion=99;expect(projectCompanionMemory(s).evidence).toEqual([]);
  });
  it('reset purges memory and maintains monotonic concurrency fencing',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});applyCompanionMemoryCommand(s,{action:'reset',revision:1});
    expect(projectCompanionMemory(s)).toEqual({revision:2,goals:[],concepts:[],relationships:[],evidence:[]});expect(()=>applyCompanionMemoryProposal(s,proposal(),{revision:0})).toThrow();
  });
  it('ranks relevant concepts and returns a bounded data context, not old goal revisions',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});const context=companionMemoryContext(s,{query:'shortest connections',limit:1});
    expect(context.concepts.map(c=>c.id)).toEqual(['paths']);expect(context.relationships).toEqual([]);expect(JSON.stringify(context).length).toBeLessThan(14001);
  });
  it('bounds escaped user text without malformed output or dangling relationships',()=>{
    const s=session();for(let i=0;i<12;i++)applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:i,kind:'goal',text:'x'+String.fromCharCode(0).repeat(499)});
    applyCompanionMemoryProposal(s,proposal(),{revision:12});const context=companionMemoryContext(s);
    expect(JSON.stringify(context).length).toBeLessThanOrEqual(14000);expect(context.goals.length).toBeLessThan(12);
    expect(context.relationships.every(r=>context.concepts.some(c=>c.id===r.from)&&context.concepts.some(c=>c.id===r.to))).toBe(true);
  });
  it('does not resurrect old relationship text when the latest citation disappears',()=>{
    const s=session();applyCompanionMemoryProposal(s,proposal(),{revision:0});s.artifacts.push(artifact('source_b'));
    const p=proposal();p.relationships[0].refs=[{artifactId:'source_b',version:1}];applyCompanionMemoryProposal(s,p,{revision:1});
    s.artifacts=s.artifacts.filter(a=>a.id!=='source_b');expect(projectCompanionMemory(s).relationships).toEqual([]);
    pruneCompanionMemory(s);expect(projectCompanionMemory(s).relationships).toEqual([]);
  });
  it('bounds goals and rejects invalid commands',()=>{
    const s=session();for(let i=0;i<12;i++)applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:i,kind:'goal',text:`Goal ${i}`});
    expect(()=>applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:12,kind:'goal',text:'Overflow'})).toThrow();expect(projectCompanionMemory(s).goals).toHaveLength(12);
    expect(()=>applyCompanionMemoryCommand(s,{action:'upsert-goal',revision:12,kind:'goal',text:'',mastery:1})).toThrow();
  });
});

describe('owned durable memory transactions',()=>{
  let dir:string;const principal=(id:string):ExplorationPrincipal=>({kind:'guest',id:id.repeat(64),workspaceId:id.repeat(64),generation:id.repeat(64),key:`guest-${id.repeat(64)}`});
  beforeEach(()=>{dir=mkdtempSync(join(tmpdir(),'soma-memory-'));vi.stubEnv('SOMA_PERSISTENCE','local-synthetic');vi.stubEnv('SOMA_EXPLORATION_DB_PATH',join(dir,'memory.sqlite'));});
  afterEach(()=>{closeExplorationStore();vi.unstubAllEnvs();rmSync(dir,{recursive:true,force:true});});
  it('isolates owners, survives database reopen and rejects concurrent stale writes',async()=>{
    await explorationStore.mutate(principal('a'),()=>{}, {create:true});
    await mutateCompanionMemory(principal('a'),{action:'upsert-goal',revision:0,kind:'goal',text:'Private goal'});
    await explorationStore.mutate(principal('b'),()=>{}, {create:true});
    await mutateCompanionMemory(principal('b'),{action:'upsert-goal',revision:0,kind:'goal',text:'Other goal'});
    closeExplorationStore();expect(projectCompanionMemory((await explorationStore.read(principal('a')))! ).goals[0].text).toBe('Private goal');
    expect(JSON.stringify(await explorationStore.read(principal('b')))).not.toContain('Private goal');
    const results=await Promise.allSettled([mutateCompanionMemory(principal('a'),{action:'upsert-goal',revision:1,kind:'goal',text:'first'}),mutateCompanionMemory(principal('a'),{action:'upsert-goal',revision:1,kind:'goal',text:'second'})]);
    expect(results.map(r=>r.status).sort()).toEqual(['fulfilled','rejected']);
  });
  it('does not recreate a missing session implicitly',async()=>{
    await expect(mutateCompanionMemory(principal('a'),{action:'reset',revision:0})).rejects.toThrow();
  });
  it('does not accept a principal with another workspace generation',async()=>{
    await explorationStore.mutate(principal('a'),()=>{}, {create:true});
    await mutateCompanionMemory(principal('a'),{action:'upsert-goal',revision:0,kind:'goal',text:'Private'});
    await expect(mutateCompanionMemory({...principal('a'),generation:'wrong'},{action:'reset',revision:1})).rejects.toThrow();
  });
});
