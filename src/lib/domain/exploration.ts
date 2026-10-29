import {z} from 'zod';
import {bfsInputSchema,runBfs,sceneIdSchema,BFS_MODEL_ID,BFS_MODEL_VERSION,type BfsExecution,type BfsInput} from './graph-search';
export {bfsInputSchema,runBfs,BFS_MODEL_ID,BFS_MODEL_VERSION} from './graph-search';
export type {BfsInput,BfsExecution,BfsStep} from './graph-search';

const text=z.string().trim().min(1).max(360),short=z.string().trim().min(1).max(100);
const point=z.strictObject({x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1)});
const region=z.strictObject({x:z.number().finite().min(0).max(1),y:z.number().finite().min(0).max(1),width:z.number().finite().positive().max(1),height:z.number().finite().positive().max(1)}).refine(value=>value.x+value.width<=1&&value.y+value.height<=1,'Source region must stay inside the capture.');
export const sourceObservationRefSchema=z.strictObject({observationId:sceneIdSchema,version:z.number().int().positive(),region:region.nullable()});
const placement=z.strictObject({column:z.union([z.literal(1),z.literal(2)]),row:z.number().int().min(1).max(4),columnSpan:z.union([z.literal(1),z.literal(2)])});
const panelBase={id:sceneIdSchema,title:short,placement};
const execution=z.enum(['primary','comparison']);
export const diagramObjectSchema=z.discriminatedUnion('kind',[
 z.strictObject({id:sceneIdSchema,kind:z.literal('node'),label:short,position:point}),
 z.strictObject({id:sceneIdSchema,kind:z.literal('edge'),from:sceneIdSchema,to:sceneIdSchema,label:z.string().max(80),directed:z.boolean()}),
 z.strictObject({id:sceneIdSchema,kind:z.literal('text'),text,position:point}),
]);
export const explorationPanelSchema=z.discriminatedUnion('kind',[
 z.strictObject({...panelBase,kind:z.literal('graph'),execution,positions:z.array(z.strictObject({nodeId:sceneIdSchema,...point.shape})).min(1).max(12)}),
 z.strictObject({...panelBase,kind:z.literal('frontier'),execution}),
 z.strictObject({...panelBase,kind:z.literal('state-table'),execution}),
 z.strictObject({...panelBase,kind:z.literal('steps')}),
 z.strictObject({...panelBase,kind:z.literal('text'),text}),
 z.strictObject({...panelBase,kind:z.literal('diagram'),objects:z.array(diagramObjectSchema).min(1).max(30)}),
]);
const scene=z.strictObject({layout:z.enum(['diagram-sidebar','comparison','stack']),panels:z.array(explorationPanelSchema).min(1).max(6)});
const step=z.strictObject({id:sceneIdSchema,caption:text,narration:text.nullable(),highlightIds:z.array(sceneIdSchema).max(24),execution:execution.nullable(),executionStep:z.number().int().min(0).max(12).nullable()});
const common={schemaVersion:z.literal('exploration-v1'),id:sceneIdSchema,version:z.number().int().positive(),title:short,objective:text,sources:z.array(sourceObservationRefSchema).min(1).max(4),assumptions:z.array(text).max(6),uncertainty:z.array(text).max(6),unsupportedClaims:z.array(text).max(6)};
export const explorationSpecSchema=z.discriminatedUnion('mode',[
 z.strictObject({...common,mode:z.literal('checked-bfs'),modelId:z.literal(BFS_MODEL_ID),modelVersion:z.literal(BFS_MODEL_VERSION),input:bfsInputSchema,comparison:z.strictObject({label:short,input:bfsInputSchema}).nullable(),scene,steps:z.array(step).min(1).max(12),controls:z.array(z.enum(['step','replay','set-start','set-goal','toggle-edge','reverse-neighbor-order'])).min(1).max(6),followups:z.array(text).max(4)}),
 z.strictObject({...common,mode:z.literal('explanation'),scene,steps:z.array(step).min(1).max(12),followups:z.array(text).max(4)}),
 z.strictObject({...common,mode:z.literal('clarify'),question:text}),
]);
export type ExplorationSpec=z.infer<typeof explorationSpecSchema>;
export type ExplorationPanel=z.infer<typeof explorationPanelSchema>;
export type SourceObservationRef=z.infer<typeof sourceObservationRefSchema>;
export type CheckedExploration={spec:ExplorationSpec;validation:{assurance:'checked-bfs'|'explanation-only'|'needs-clarification';modelVersion:typeof BFS_MODEL_VERSION|null;checks:string[]};executions:{primary:BfsExecution;comparison?:BfsExecution}|null};
/** Structural + cross-reference checks; server must separately bind every
 * source observation/version to the caller and current authorized turn. */
export function validateExplorationSpec(raw:unknown):ExplorationSpec{
 const spec=explorationSpecSchema.parse(raw);
 const reject=(message:string):never=>{throw new Error(message);};
 if(new TextEncoder().encode(JSON.stringify(spec)).byteLength>16_384)reject('Exploration payload exceeds the supported bound.');
 const sources=new Set<string>();for(const ref of spec.sources){const id=`${ref.observationId}:${ref.version}`;if(sources.has(id))reject('Source references must be unique.');sources.add(id);}
 if(spec.mode==='clarify')return spec;
 const ids=new Set<string>(),objects=new Map<string,string>(),occupied=new Set<string>();
 const addId=(id:string)=>{if(ids.has(id))reject('Scene object IDs must be unique.');ids.add(id);};
 const graphInputs:{primary:BfsInput;comparison?:BfsInput}|null=spec.mode==='checked-bfs'?{primary:spec.input,...(spec.comparison?{comparison:spec.comparison.input}:{})}:null;
 if(graphInputs)for(const input of Object.values(graphInputs)){
  for(const node of input.nodes){const identity=JSON.stringify(['node',node.label]);if(objects.has(node.id)&&objects.get(node.id)!==identity)reject('Stable graph IDs must retain their meaning.');objects.set(node.id,identity);}
  for(const edge of input.edges){const identity=JSON.stringify(['edge',edge.from,edge.to]);if(objects.has(edge.id)&&objects.get(edge.id)!==identity)reject('Stable graph IDs must retain their meaning.');objects.set(edge.id,identity);}
 }
 for(const id of objects.keys())addId(id);
 const executions:{primary:BfsExecution;comparison?:BfsExecution}|null=spec.mode==='checked-bfs'?{primary:runBfs(spec.input),...(spec.comparison?{comparison:runBfs(spec.comparison.input)}:{})}:null;
 for(const panel of spec.scene.panels){
  addId(panel.id);const {column,row,columnSpan}=panel.placement;
  if(column+columnSpan>3)reject('Panel placement exceeds the approved grid.');
  if(spec.scene.layout==='stack'&&(column!==1||columnSpan!==2))reject('Stack panels must fill one bounded row.');
  for(let col=column;col<column+columnSpan;col++){const cell=`${row}:${col}`;if(occupied.has(cell))reject('Panel placements overlap.');occupied.add(cell);}
  if('execution' in panel){
   if(!graphInputs||!Object.hasOwn(graphInputs,panel.execution))reject('Panel references an unavailable execution.');
   if(panel.kind==='graph'){
    const input=graphInputs![panel.execution]!;
    const positions=panel.positions.map(position=>position.nodeId);
    if(positions.length!==input.nodes.length||new Set(positions).size!==positions.length||input.nodes.some(node=>!positions.includes(node.id)))reject('Every graph node requires one approved position.');
    for(let i=0;i<panel.positions.length;i++)for(let j=i+1;j<panel.positions.length;j++)if(Math.hypot(panel.positions[i].x-panel.positions[j].x,panel.positions[i].y-panel.positions[j].y)<.08)reject('Graph node positions must remain distinguishable.');
   }
  }
  if(panel.kind==='diagram'){
   for(const object of panel.objects)addId(object.id);
   const localNodes=new Set(panel.objects.filter(object=>object.kind==='node').map(object=>object.id));
   for(const object of panel.objects)if(object.kind==='edge'&&(!localNodes.has(object.from)||!localNodes.has(object.to)))reject('Diagram edges must reference nodes in their own panel.');
  }
 }
 if(spec.mode==='checked-bfs'){
  if(new Set(spec.controls).size!==spec.controls.length)reject('Controls must be unique.');
  if(!spec.scene.panels.some(panel=>panel.kind==='graph'&&panel.execution==='primary'))reject('A checked experiment requires its primary graph.');
  if(!spec.scene.panels.some(panel=>panel.kind==='frontier'||panel.kind==='state-table'))reject('A checked graph requires visible algorithm state.');
  if(spec.comparison&&!spec.scene.panels.some(panel=>panel.kind==='graph'&&panel.execution==='comparison'))reject('A checked comparison requires its visible graph.');
  if(spec.scene.layout==='comparison'&&!spec.comparison)reject('Comparison layout requires both checked graphs.');
 }
 for(const item of spec.steps){
  addId(item.id);
  if((item.execution===null)!==(item.executionStep===null))reject('A step binding requires both execution and trace index.');
  if(item.execution!==null&&(!executions||!Object.hasOwn(executions,item.execution)||item.executionStep!>=executions[item.execution]!.steps.length))reject('Step references an unavailable checked state.');
 }
 for(const item of spec.steps)if(item.highlightIds.some(id=>!ids.has(id)))reject('Highlight references an unknown scene object.');
 return spec;
}
/** The application computes this envelope. Model-supplied validation/results
 * fields are rejected by the strict spec schema and cannot grant assurance. */
export function checkExploration(raw:unknown):CheckedExploration{
 const spec=validateExplorationSpec(raw);
 if(spec.mode==='clarify')return {spec,validation:{assurance:'needs-clarification',modelVersion:null,checks:['schema','references']},executions:null};
 if(spec.mode==='explanation')return {spec,validation:{assurance:'explanation-only',modelVersion:null,checks:['schema','references']},executions:null};
 return {spec,validation:{assurance:'checked-bfs',modelVersion:BFS_MODEL_VERSION,checks:['schema','references','bfs-input','deterministic-trace']},executions:{primary:runBfs(spec.input),...(spec.comparison?{comparison:runBfs(spec.comparison.input)}:{})}};
}

/** Original authored development example; it is never live generation or an
 * actual course observation. The caller supplies its authoritative source ref. */
export function createExampleExploration(sourceRef:SourceObservationRef={observationId:'original-bfs-example',version:1,region:null},layout:'diagram-sidebar'|'comparison'='diagram-sidebar'):ExplorationSpec{
 const input:BfsInput={nodes:[{id:'s',label:'S'},{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'},{id:'g',label:'Goal'},{id:'x',label:'Unconnected X'}],edges:[{id:'sa',from:'s',to:'a'},{id:'sb',from:'s',to:'b'},{id:'ag',from:'a',to:'g'},{id:'bg',from:'b',to:'g'},{id:'ac',from:'a',to:'c'},{id:'cs',from:'c',to:'s'}],directed:true,start:'s',goal:'g',neighborOrder:['s','a','b','c','g','x']};
 const positions=[{nodeId:'s',x:.12,y:.45},{nodeId:'a',x:.43,y:.2},{nodeId:'b',x:.43,y:.75},{nodeId:'c',x:.72,y:.15},{nodeId:'g',x:.82,y:.65},{nodeId:'x',x:.12,y:.88}];
 const panels:ExplorationPanel[]=layout==='comparison'?[
  {id:'graph-primary',kind:'graph',title:'A before B',execution:'primary',placement:{column:1,row:1,columnSpan:1},positions},
  {id:'graph-comparison',kind:'graph',title:'B before A',execution:'comparison',placement:{column:2,row:1,columnSpan:1},positions},
  {id:'queue-primary',kind:'frontier',title:'Original FIFO frontier',execution:'primary',placement:{column:1,row:2,columnSpan:1}},
  {id:'queue-comparison',kind:'frontier',title:'Changed FIFO frontier',execution:'comparison',placement:{column:2,row:2,columnSpan:1}},
  {id:'explanation-steps',kind:'steps',title:'What changes?',placement:{column:1,row:3,columnSpan:2}},
 ]:[
  {id:'graph-primary',kind:'graph',title:'An original unweighted graph',execution:'primary',placement:{column:1,row:1,columnSpan:1},positions},
  {id:'queue-primary',kind:'frontier',title:'First in, first out',execution:'primary',placement:{column:2,row:1,columnSpan:1}},
  {id:'explanation-steps',kind:'steps',title:'Why this node next?',placement:{column:1,row:2,columnSpan:2}},
 ];
 return validateExplorationSpec({schemaVersion:'exploration-v1',id:'original-bfs-exploration',version:1,mode:'checked-bfs',title:layout==='comparison'?'Same shortest distance, different tie order':'Why does A come before B?',objective:'Inspect how a FIFO frontier and explicit neighbor order determine breadth-first traversal.',sources:[sourceRef],assumptions:['Every edge has equal cost.','The graph is directed; arrows define permitted travel.','A node is marked visited when enqueued; the goal stops the search when dequeued.'],uncertainty:['This is an original synthetic example, not a reading of your coursework.'],unsupportedClaims:['This model does not solve weighted shortest paths or prove understanding.'],modelId:BFS_MODEL_ID,modelVersion:BFS_MODEL_VERSION,input,comparison:layout==='comparison'?{label:'Reverse neighbor order',input:{...input,neighborOrder:[...input.neighborOrder].reverse()}}:null,scene:{layout,panels},steps:[
  {id:'step-initial',caption:'The frontier starts with S. No node has been expanded.',narration:null,highlightIds:['s'],execution:'primary',executionStep:0},
  {id:'step-neighbors',caption:'After S is removed, A and B join the frontier in the declared neighbor order.',narration:null,highlightIds:['s','a','b','sa','sb'],execution:'primary',executionStep:1},
  {id:'step-first',caption:'A is removed next because it entered the FIFO frontier before B, regardless of its position on the drawing.',narration:null,highlightIds:['a','queue-primary'],execution:'primary',executionStep:2},
 ],controls:['step','replay','set-start','set-goal','toggle-edge','reverse-neighbor-order'],followups:['Show the same graph with a different starting node.','Compare the opposite neighbor order.']});
}
