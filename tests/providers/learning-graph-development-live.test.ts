import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { investigateWithSpark, publishInvestigation } from '../../src/lib/server/investigator';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { budgetLimit, INVESTIGATION_RESERVATION_USD } from '../../src/lib/server/budget';

/** Development only: actual Spark choices, synthetic inputs. Never a held-out or learning-effect claim. */
describe.skipIf(process.env.SOMA_GRAPH_DEVELOPMENT_LIVE !== 'true')('five synthetic graph development requests with actual Spark', () => {
  it('records the existing 4/5 gate without rerunning failures or resetting the ledger', {timeout: 600_000}, async () => {
    expect(process.env.SOMA_PERSISTENCE).toBe('firestore');
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeFalsy();
    expect(Number(process.env.META_APP_SPEND_CAP_USD)).toBeLessThanOrEqual(2);
    const metrics: { index:number; status:string; calls?:number; costUsd?:number; elapsedMs:number }[]=[];
    const limit=budgetLimit(Number(process.env.META_ALLOCATION_USD),Number(process.env.META_APP_SPEND_CAP_USD));
    const db=getServerFirestore();
    const cases=[[12,6,3],[9,9,3],[18,6,9],[10,10,5],[24,8,4]];
    for(const [index,[voltage,r1,r2]] of cases.entries()){
      const started=Date.now();
      const consumed=Number((await db.doc('somaBudget/global').get()).get('consumed')??0);
      if(consumed+INVESTIGATION_RESERVATION_USD>limit){metrics.push({index,status:'budget-pending',elapsedMs:Date.now()-started});continue;}
      const state=seedEmptyAccountWorkspace(`graph-development-${randomUUID()}`), courseId='synthetic-network-course';
      state.courses=[{id:courseId,code:'SYN',title:'Fictional network course',instructor:'',color:'#245683',deadline:'',nextEvent:''}];
      state.sources=[{id:'synthetic-course-note',courseId,title:'Original synthetic ideal resistor lesson',body:'Ideal two-resistor parallel circuits share both endpoint nodes and equal voltage; each branch current is the source voltage divided by its branch resistance. Changing one branch resistance at fixed source voltage leaves the other branch current unchanged. In series both resistors carry one current, equal to source voltage divided by the sum of resistances. Each series voltage drop is current times that resistance. The placement of wires on a page does not change node connectivity. Treat a proposed explanation of a response as provisional; the same error may have multiple explanations.',version:1,status:'current',kind:'synthetic',origin:'synthetic',retrievedAt:state.createdAt},
      {id:'synthetic-returned-observation',courseId,title:'Original fictional returned work',body:`Fictional returned work: A ${voltage} V ideal source spans parallel ${r1} ohm and ${r2} ohm resistors. The fictional student wrote that both branches carry the same current because they are parallel. Fictional marking asks which nodes each resistor connects to and how each current was calculated. This text is an authored observation, not image extraction or a real learner response.`,version:1,status:'current',kind:'synthetic',origin:'synthetic',retrievedAt:state.createdAt}];
      try{
        const result=await investigateWithSpark(state,{courseId,initialSourceIds:state.sources.map(s=>s.id),goal:'Read the fictional course evidence and returned work. Propose defensible competing explanations and a source-grounded optional resistor experiment distinguishing their predictions. Select the validated activity when useful; preserve uncertainty when evidence is insufficient.'});
        const published=publishInvestigation(state,result);
        const passed=result.lesson?.kind==='circuit' && !!result.lesson.diagnosticExperiment && result.record.diagnosticPlan?.kind==='circuit-experiment' && result.record.diagnosticPlan?.kind==='circuit-experiment' && published.recommendedLessonId===result.lesson.id;
        metrics.push({index,status:passed?'passed':'not-interactive',calls:result.record.usage?.calls,costUsd:result.record.usage?.costUsd,elapsedMs:Date.now()-started});
      }catch(error){metrics.push({index,status:(error as {code?:string}).code?.startsWith('inference_budget')?'budget-pending':'failed',elapsedMs:Date.now()-started});}
      console.info(JSON.stringify({label:'actual-Spark/synthetic-data/development',...metrics.at(-1)}));
    }
    const consumed=Number((await db.doc('somaBudget/global').get()).get('consumed')??0);
    mkdirSync('.local',{recursive:true,mode:0o700});
    writeFileSync('.local/learning-graph-development-live.json',JSON.stringify({at:new Date().toISOString(),mode:'actual-Spark/synthetic-development',metrics,consumedUsd:consumed,capUsd:limit,passed:metrics.filter(m=>m.status==='passed').length,denominator:5,notIndependentReview:true},null,2),{mode:0o600});
    expect(metrics.filter(m=>m.status==='passed').length,'Existing 4/5 development gate; failures retained, no repeat tuning').toBeGreaterThanOrEqual(4);
  });
});
