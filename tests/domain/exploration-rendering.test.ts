import {it,expect} from 'vitest';
import React from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ExplorationSearchStage} from '../../src/components/exploration-search-stage';
import {createExampleExploration,runBfs,type BfsInput} from '../../src/lib/domain/exploration';
const panel={id:'graph',kind:'graph' as const,title:'Original graph',execution:'primary' as const,placement:{column:1 as const,row:1,columnSpan:2 as const},positions:[{nodeId:'s',x:.2,y:.5},{nodeId:'g',x:.8,y:.5}]};
const render=(input:BfsInput,index=1)=>{const execution=runBfs(input);return renderToStaticMarkup(React.createElement(ExplorationSearchStage,{panel:input.nodes.length===2?panel:{...panel,positions:input.nodes.map((n,i)=>({nodeId:n.id,x:i/6,y:i%2}))},execution,index,selected:null,onSelect:()=>{},highlights:[],progress:.3}));};
it('renders identical motion for implicit BFS, explicit BFS and explicit unit weights',()=>{
 const spec=createExampleExploration();if(spec.mode!=='checked-bfs')throw Error();
 for(const input of [spec.input,{...spec.input,algorithm:'bfs' as const},{...spec.input,algorithm:'bfs' as const,edges:spec.input.edges.map(e=>({...e,weight:1}))}])expect(render(input)).toContain('data-motion-progress="0.300"');
});
it('draws undirected reverse-traversed weighted paths without arrowheads',()=>{
 const input:BfsInput={algorithm:'dijkstra',nodes:[{id:'s',label:'Start'},{id:'g',label:'Goal'}],edges:[{id:'back',from:'g',to:'s',weight:2}],directed:false,start:'s',goal:'g',neighborOrder:['s','g']};
 const html=render(input,2);expect(html).toContain('data-edge="back" data-in-path="true"');expect(html).not.toContain('data-arrowhead');expect(html).toContain('total cost 2');
 expect(render({...input,directed:true},2)).toContain('data-arrowhead="back"');
});
it('renders a weighted self-loop as a visible curve',()=>{
 const input:BfsInput={algorithm:'dijkstra',nodes:[{id:'s',label:'Start'},{id:'g',label:'Goal'}],edges:[{id:'loop',from:'s',to:'s',weight:0},{id:'sg',from:'s',to:'g',weight:2}],directed:false,start:'s',goal:'g',neighborOrder:['s','g']};
 expect(render(input)).toMatch(/data-edge="loop"[^>]*><path d="[^"]* C /);
});
