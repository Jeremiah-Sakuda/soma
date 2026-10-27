import { evaluateDiagnosticExperiment, validateDiagnosticPlan } from './diagnostics';
import { withLessonMetadata } from './prediction';
import type { WorkspaceState } from './types';

/** An authored starting artifact, not a model run or a real learner record. */
export function prepareLearningGraphPreview(state: WorkspaceState, now: string): WorkspaceState {
  if (state.mode !== 'demo') throw new Error('The original synthetic graph preview belongs only to a demo workspace.');
  const id='graph-preview-parallel', investigationId='graph-preview-investigation';
  if (state.lessons.some(lesson=>lesson.id===id)) { state.recommendedLessonId=id; return state; }
  const base=state.lessons.find(lesson=>lesson.courseId==='circuits'&&lesson.kind==='circuit');
  if(!base) throw new Error('The synthetic circuit course is unavailable.');
  const source={id:'graph-preview-note',courseId:base.courseId,title:'Original synthetic returned-work observation and reference',version:1,status:'current' as const,kind:'synthetic' as const,origin:'synthetic' as const,retrievedAt:now,
    body:'Ideal resistors connected in parallel share both endpoint nodes and equal voltage. Each branch current is voltage divided by its resistance. A change to one branch at fixed source voltage leaves the other branch current unchanged. In series, current is common and voltage drops depend on resistance. Fictional returned work says both parallel branches get equal current. Fictional marking asks which nodes each resistor connects to. This authored transcription is not image extraction, actual instructor feedback or a real learner response.'};
  state.sources.push(source);
  const hypotheses=[{hypothesisId:'diagram-reading',claim:'The fictional response may reflect misreading connectivity despite knowing the branch current relationship.',predictionForm:'checked-model'}, {hypothesisId:'equal-current',claim:'The fictional response may reflect splitting total current equally between unequal parallel branches.',predictionForm:'equal-branch-current'}];
  const experiment=evaluateDiagnosticExperiment({baseline:{topology:'parallel',voltage:12,r1:6,r2:3},change:{parameter:'r1',value:12},observable:'current1',predictions:hypotheses});
  const evidence=[{sourceId:source.id,version:1,quote:source.body.slice(0,250)}];
  const plan=validateDiagnosticPlan({kind:'circuit-experiment',experimentRunId:experiment.id,hypotheses:hypotheses.map(item=>({id:item.hypothesisId,claim:item.claim,evidence,attemptIds:[]})),question:experiment.diagnosticQuestion,options:experiment.diagnosticOptions,predictions:experiment.optionMappings,rationale:'This authored comparison separates the predictions of two provisional explanations, without claiming either is an established learner belief.',nextActivity:'Use the saved response or correction to choose a different supported condition; uncertainty may remain.'},state,base.courseId,new Map([[source.id,{version:1,body:source.body}]]),new Map([[experiment.id,experiment]]));
  const lesson=withLessonMetadata({...base,id,title:'What changes when one branch changes?',objective:'Parallel branch current and resistance',description:'An authored synthetic diagnostic for inspecting connected evidence. Independent scientific and instructional review remain pending.',reason:'Prepared from original fictional returned work for this simulated course.',circuit:experiment.input.baseline,sourceIds:[source.id],sourceVersions:{[source.id]:1},question:plan.question,options:plan.options,answerIndex:0,explanation:'The checked ideal DC model supports the comparison. The explanation of a learner response remains provisional.',hint:'Name the two endpoint nodes and the observable before making a prediction.',diagnosticInvestigationId:investigationId,diagnosticExperiment:{input:experiment.input},supportingPassages:evidence,examEligible:false,mode:'prepared',state:'ready',exposure:'lab'});
  state.lessons.unshift(lesson);state.recommendedLessonId=id;
  state.investigations??=[];state.investigations.push({id:investigationId,workspaceId:state.id,courseId:base.courseId,createdAt:now,mode:'synthetic',decision:'revise-session',reason:'Authored synthetic comparison prepared for exploration; no model call or source collection occurred.',sourceRefs:evidence,assessmentId:null,applicability:'course',conflicts:[],selectedLessonId:id,diagnosticLessonId:id,diagnosticPlan:plan});
  return state;
}
