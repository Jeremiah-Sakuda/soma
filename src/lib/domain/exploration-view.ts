import {runBfs,type BfsInput,type BfsExecution,type ExplorationSpec} from './exploration';

export type ExplorationViewState = { step: number; explanationStep: number; start: string | null; goal: string | null; disabledEdgeIds: string[]; reversed: boolean; selectedObjectId: string | null; edgeWeights?:Record<string,number> };
export function initialExplorationState(spec: ExplorationSpec): ExplorationViewState {
  return { step: 0, explanationStep: 0, start: (spec.mode==='checked-bfs'||spec.mode==='checked-dijkstra') ? spec.input.start : null, goal: (spec.mode==='checked-bfs'||spec.mode==='checked-dijkstra') ? spec.input.goal : null, disabledEdgeIds: [], reversed: false, selectedObjectId: null };
}
export function explorationExecution(spec: ExplorationSpec, state: ExplorationViewState): BfsExecution | null {
  if ((spec.mode!=='checked-bfs'&&spec.mode!=='checked-dijkstra')) return null;
  return runBfs({ ...spec.input, start: state.start ?? spec.input.start, goal: state.goal, edges: spec.input.edges.filter(edge => !state.disabledEdgeIds.includes(edge.id)).map(edge=>state.edgeWeights?.[edge.id]!==undefined?{...edge,weight:state.edgeWeights[edge.id]}:edge), neighborOrder: state.reversed ? [...spec.input.neighborOrder].reverse() : spec.input.neighborOrder });
}
export function explorationInputsChanged(spec: ExplorationSpec, state: ExplorationViewState) {
  return (spec.mode==='checked-bfs'||spec.mode==='checked-dijkstra') && ((state.start ?? spec.input.start) !== spec.input.start || state.goal !== spec.input.goal || state.disabledEdgeIds.length > 0 || state.reversed || Object.keys(state.edgeWeights??{}).length>0);
}
function executionCaption(execution:BfsExecution,index:number) {
  const step=execution.steps[Math.min(index,execution.steps.length-1)];
  if(!step.current)return `${nodeName(execution.input,execution.input.start)} starts in the queue. No node has been expanded yet.`;
  return `${nodeName(execution.input,step.current)} ${execution.modelId==='dijkstra-nonnegative'?`is settled at cost ${step.distances[step.current]}`:'leaves the front of the queue'}.${step.discovered.length?` Added ${step.discovered.map(id=>nodeName(execution.input,id)).join(', ')}.`:' No new nodes added.'}${step.status==='found'?' Goal reached.':step.status==='unreachable'?' The queue is empty; the goal is unreachable with these connections.':step.status==='complete'?' All reachable nodes have been explored.':''}`;
}
export function explorationVisibleCaption(spec: ExplorationSpec, state: ExplorationViewState): string {
  if (spec.mode === 'clarify') return spec.question;
  const execution = explorationExecution(spec, state);
  if (!execution) return spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)].caption;
  if((spec.mode==='checked-bfs'||spec.mode==='checked-dijkstra')&&spec.comparison)return `Primary: ${executionCaption(execution,state.step)} Comparison: ${executionCaption(comparisonExecution(spec,state)!,state.step)}`;
  return executionCaption(execution,state.step);
}

const nodeName = (input: BfsInput, id: string | null) => input.nodes.find(node => node.id === id)?.label ?? 'None';

export function explorationNarration(spec:ExplorationSpec,state:ExplorationViewState):string {
  if(spec.mode==='clarify')return spec.question;
  const authored=spec.mode==='explanation'?spec.steps[state.explanationStep]:!explorationInputsChanged(spec,state)?spec.steps.find(step=>step.execution==='primary'&&step.executionStep===state.step):undefined;
  return authored?.narration || explorationVisibleCaption(spec,state);
}
export function nextPlaybackState(spec:ExplorationSpec,state:ExplorationViewState):ExplorationViewState|null {
  if(spec.mode==='clarify')return null;
  if(spec.mode==='explanation')return state.explanationStep+1<spec.steps.length?{...state,explanationStep:state.explanationStep+1}:null;
  const execution=explorationExecution(spec,state)!;
  if(state.step+1>=Math.max(execution.steps.length,spec.comparison?comparisonExecution(spec,state)!.steps.length:0))return null;
  const step=state.step+1, authored=spec.steps.findIndex(item=>item.execution==='primary'&&item.executionStep===step);
  return {...state,step,...(authored>=0?{explanationStep:authored}:{})};
}

export function comparisonExecution(spec:ExplorationSpec,state:ExplorationViewState):BfsExecution|null{
 if((spec.mode!=='checked-bfs'&&spec.mode!=='checked-dijkstra')||!spec.comparison)return null;
 const sameWeightedGraph=spec.mode==='checked-dijkstra'&&JSON.stringify({...spec.comparison.input,algorithm:spec.input.algorithm})===JSON.stringify(spec.input);
 const input=spec.comparison.input;
 return runBfs({...input,...(sameWeightedGraph?{start:state.start??input.start,goal:state.goal,neighborOrder:state.reversed?[...input.neighborOrder].reverse():input.neighborOrder}:{}),edges:input.edges.filter(e=>!sameWeightedGraph||!state.disabledEdgeIds.includes(e.id)).map(e=>state.edgeWeights?.[e.id]!==undefined?{...e,weight:state.edgeWeights[e.id]}:e)});
}
