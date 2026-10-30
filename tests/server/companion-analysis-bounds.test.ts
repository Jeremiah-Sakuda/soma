import { expect, it, vi } from "vitest";
import { randomUUID } from "node:crypto";
import { createExampleExploration, checkExploration } from "../../src/lib/domain/exploration";
import { createCompanionAnalysis } from "../../src/lib/server/companion-analysis";
import { visionRequestUpperBoundUsd, type MetaVisionRequest } from "../../src/lib/server/meta-vision";
import type { ExplorationArtifact, ExplorationPrincipal, ExplorationSession, ExplorationStore } from "../../src/lib/server/exploration-types";
import type { MetaResult } from "../../src/lib/server/meta-client";

it("encodes near-capacity memory as bounded source-preserving excerpts for both Meta calls", async () => {
  const now = new Date().toISOString();
  const source = { observationId: "original_source", version: 1, kind: "example" as const, label: "Original source", capturedAt: now, summary: "Long original context. ".repeat(100), uncertainty: ["Uncertain source detail. ".repeat(12)] };
  const base: ExplorationArtifact = { ...checkExploration(createExampleExploration({observationId:source.observationId,version:1,region:null})),id:randomUUID(),version:1,createdAt:now,updatedAt:now,question:"Explain these connections",source,generation:{mode:"prepared-example",provider:"none",model:null,calls:0,usage:{input_tokens:0,output_tokens:0},costUsd:0,elapsedMs:0,checks:[],audit:[]},state:{step:0,explanationStep:0,reversed:false,disabledEdgeIds:[],start:"s",goal:"g",selectedObjectId:null},saved:true };
  let state: ExplorationSession = {schemaVersion:1,owner:"a",workspaceId:"a",generation:"a",createdAt:now,expiresAt:"2100-01-01T00:00:00Z",revision:0,activeRequestId:null,runs:[],artifacts:Array.from({length:24},()=>({...structuredClone(base),id:randomUUID()}))};
  const refs = [{artifactId:state.artifacts[0].id,version:1,observationId:source.observationId,sourceVersion:1}];
  state.memory = {schemaVersion:1,revision:0,goals:Array.from({length:12},(_,i)=>({id:`goal_${i}`,revision:1,kind:"goal",text:"x"+String.fromCharCode(0).repeat(499),createdAt:now,provenance:"self-report"})),concepts:Array.from({length:32},(_,i)=>({id:`concept_${i}`,revision:1,label:`Concept ${i}`,summary:"An interpretation. ".repeat(25),uncertainty:[],refs,createdAt:now,provenance:"model-proposal"})),relationships:Array.from({length:48},(_,i)=>({id:`rel_${i}`,revision:1,from:`concept_${i%32}`,to:`concept_${(i+1)%32}`,kind:"related",reason:"A tentative connection. ".repeat(16),refs,createdAt:now,provenance:"model-proposal"}))};
  state.predictions=Array.from({length:48},(_,i)=>({id:`prediction_${i}`,artifactId:state.artifacts[0].id,version:1,sourceObservationId:source.observationId,sourceVersion:1,modelVersion:"bfs-unweighted-v1",state:base.state,createdAt:now,prompt:"Which node next?",options:[],expectedNodeId:"a",revealedAt:null,exposure:"diagram-visible-practice",answer:{nodeId:"a",reason:"An original long learner explanation. ".repeat(20),recordedAt:now,matches:true}}));
  expect(JSON.stringify(state).length).toBeLessThan(768*1024);
  const store: ExplorationStore={read:async()=>structuredClone(state),mutate:async(_principal,change)=>{const next=structuredClone(state);change(next);next.revision++;state=next;return structuredClone(state);}};
  const principal: ExplorationPrincipal={kind:"guest",id:"a".repeat(64),workspaceId:"a".repeat(64),generation:"a".repeat(64),key:`guest-${"a".repeat(64)}`};
  const requests:MetaVisionRequest[]=[];
  const request=vi.fn(async(args:MetaVisionRequest):Promise<MetaResult>=>{
    requests.push(args);
    // The real production encoder validates the 32,768 character message bound,
    // tool schema and aggregate budget estimate. No permissive fake preflight.
    expect(Number.isFinite(visionRequestUpperBoundUsd(args))).toBe(true);
    const name=requests.length===1?"select_memories":"propose_memory";
    const value=requests.length===1?{refs:state.artifacts.slice(1,4).map(a=>({artifactId:a.id,version:a.version})),reason:"Inspect these relevant original examples."}:{concepts:[],relationships:[],nextActivity:null};
    return {status:"completed",tools:[{type:"function_call",name,call_id:randomUUID(),arguments:JSON.stringify(value),parsedArguments:value}],usage:{input_tokens:100,output_tokens:100}};
  });
  const run=createCompanionAnalysis({store,request,enabled:()=>true,revalidate:async()=>{},reserve:async()=>randomUUID(),settle:async()=>{}});
  await run(principal,{artifactId:state.artifacts[0].id,version:1,revision:0,requestId:randomUUID()});
  expect(requests).toHaveLength(2);
  const contexts=requests.map(r=>JSON.parse((r.input[0] as {content:string}).content));
  for(const r of requests)expect((r.input[0] as {content:string}).content.length).toBeLessThanOrEqual(28000);
  expect(contexts[0].catalog).toHaveLength(24);
  expect(contexts[1].experiences).toHaveLength(4);
  expect(contexts[1].experiences.map((e:{ref:{artifactId:string}})=>e.ref.artifactId)).toEqual(state.artifacts.slice(0,4).map(a=>a.id));
  expect(contexts[1].existingConcepts.length).toBeLessThanOrEqual(6);
  expect(contexts[1].evidence).toHaveLength(6);
  expect(contexts[1].evidence[0]).toMatchObject({exposure:"diagram-visible-practice",assistance:"diagram-visible",matches:true});
  expect(contexts[1].excerpts).toBe(true);
  const ids=new Set(contexts[1].existingConcepts.map((c:{id:string})=>c.id));
  expect(contexts[1].existingRelationships.every((r:{from:string;to:string})=>ids.has(r.from)&&ids.has(r.to))).toBe(true);
});
