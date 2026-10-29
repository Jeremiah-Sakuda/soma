import {runBfs,runDijkstra,bfsInputSchema,type BfsInput} from './graph-search';
export type CostProbe={version:'cost-probe-v1';edgeId:string;originalCost:number;criticalCost:number|null;note:string;cases:{value:number;bfsCost:number|null;dijkstraCost:number|null;bfsPath:string[]|null;dijkstraPath:string[]|null}[]};
export function routeCost(input:BfsInput,path:string[]|null):number|null{
 if(!path)return null;return path.slice(1).reduce((sum,to,i)=>{const from=path[i],edge=input.edges.find(e=>e.from===from&&e.to===to||!input.directed&&e.to===from&&e.from===to);if(!edge)throw new Error('Path edge missing');return sum+(edge.weight??1);},0);
}
/** Finite, checked cost interventions. Exact threshold only for a direct start-goal edge. */
export function probeEdgeCost(raw:unknown,edgeId:string):CostProbe{
 const input=bfsInputSchema.parse(raw),edge=input.edges.find(e=>e.id===edgeId);if(!edge||!input.goal)throw new Error('Select an existing edge and goal.');
 const originalCost=edge.weight??1,direct=edge.from===input.start&&edge.to===input.goal||!input.directed&&edge.to===input.start&&edge.from===input.goal;
 const alternative=runDijkstra({...input,algorithm:'dijkstra',edges:input.edges.filter(e=>e.id!==edgeId)}),alternativeCost=routeCost(alternative.input,alternative.path);
 const criticalCost=direct&&alternativeCost!==null&&alternativeCost<=1000000?alternativeCost:null;
 const values=[0,originalCost,Math.min(1000000,originalCost*2+1),...(criticalCost!==null?[Math.max(0,criticalCost-1),criticalCost,Math.min(1000000,criticalCost+1)]:[])];
 const cases=[...new Set(values)].sort((a,b)=>a-b).map(value=>{const changed={...input,edges:input.edges.map(e=>e.id===edgeId?{...e,weight:value}:e)};const bfs=runBfs({...changed,algorithm:'bfs'}),dijkstra=runDijkstra({...changed,algorithm:'dijkstra'});return {value,bfsCost:routeCost(changed,bfs.path),dijkstraCost:routeCost(changed,dijkstra.path),bfsPath:bfs.path,dijkstraPath:dijkstra.path};});
 return {version:'cost-probe-v1',edgeId,originalCost,criticalCost,note:criticalCost!==null?'For this direct route, its cost ties the best route avoiding it at this value. Ties can choose different equal-cost paths.':'These are checked interventions, not a proof of a global tipping point. No exact threshold is claimed.',cases};
}
