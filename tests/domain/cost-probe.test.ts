import {it,expect} from 'vitest';
import { runDijkstra, type BfsInput } from '../../src/lib/domain/graph-search';
import {createWeightedExample} from '../../src/lib/domain/exploration';import {probeEdgeCost} from '../../src/lib/domain/cost-probe';import {comparisonExecution,explorationExecution,initialExplorationState} from '../../src/lib/domain/exploration-view';
const source={observationId:'original',version:1,region:null};
it('finds and checks both sides of the exact direct-route tie',()=>{const spec=createWeightedExample(source);if(spec.mode!=='checked-dijkstra')throw Error();const p=probeEdgeCost(spec.input,'sg');expect(p.criticalCost).toBe(3);expect(p.cases.find(c=>c.value===2)).toMatchObject({bfsCost:2,dijkstraCost:2});expect(p.cases.find(c=>c.value===4)).toMatchObject({bfsCost:4,dijkstraCost:3});expect(spec.input.edges[0].weight).toBe(10);});
it('finds the exact boundary for an internal connection, but none without an alternative',()=>{const spec=createWeightedExample(source);if(spec.mode!=='checked-dijkstra')throw Error();const ab=probeEdgeCost(spec.input,'ab');expect(ab.criticalCost).toBe(6);expect(ab.cases.find(c=>c.value===5)!.dijkstraCost).toBe(7);expect(ab.cases.find(c=>c.value===7)!.dijkstraCost).toBe(8);expect(probeEdgeCost(spec.input,'cg').criticalCost).toBe(1);expect(probeEdgeCost({...spec.input,edges:[spec.input.edges[0]]},'sg').criticalCost).toBeNull();expect(()=>probeEdgeCost(spec.input,'foreign')).toThrow();});
it('applies the same persistent intervention to both algorithms without mutating source input',()=>{const spec=createWeightedExample(source);const state={...initialExplorationState(spec),edgeWeights:{sg:2}};const a=explorationExecution(spec,state)!,b=comparisonExecution(spec,state)!;expect(a.path).toEqual(['s','g']);expect(a.steps.at(-1)!.distances.g).toBe(2);expect(b.path).toEqual(['s','g']);expect(b.input.edges.find(e=>e.id==='sg')!.weight).toBe(2);});

it('keeps a same-graph cost comparison on the current goal and enabled connections',()=>{const spec=createWeightedExample(source),state={...initialExplorationState(spec),goal:'a',disabledEdgeIds:['sg'],edgeWeights:{sg:2}};expect(comparisonExecution(spec,state)!.input.goal).toBe('a');expect(comparisonExecution(spec,state)!.input.edges.some(e=>e.id==='sg')).toBe(false);});

it('labels the prepared weighted priority frontier separately from FIFO',()=>{const spec=createWeightedExample(source);if(spec.mode!=='checked-dijkstra')throw Error();const frontiers=spec.scene.panels.filter(p=>p.kind==='frontier');expect(frontiers.find(p=>p.kind==='frontier'&&p.execution==='primary')!.title).toContain('Priority');expect(frontiers.find(p=>p.kind==='frontier'&&p.execution==='comparison')!.title).toContain('FIFO');});

it('describes a connection whose current cost is exactly the tie and a boundary past the control',()=>{
 const E=(id:string,from:string,to:string,weight:number)=>({id,from,to,weight});
 const base={nodes:['s','a','b','g'].map(id=>({id,label:id.toUpperCase()})),directed:false,start:'s',goal:'g',neighborOrder:['s','a','b','g']};
 const tie=probeEdgeCost({...base,edges:[E('sg','s','g',5),E('sa','s','a',2),E('ag','a','g',3)]},'sg');
 expect(tie.criticalCost).toBe(5);expect(tie.note).toContain('At its current cost, a route through S–G ties the best route avoiding it; any cheaper');
 const zero=probeEdgeCost({...base,edges:[E('sa','s','a',0),E('ag','a','g',5),E('sb','s','b',2),E('bg','b','g',3)]},'sa');
 expect(zero.criticalCost).toBe(0);expect(zero.note).not.toContain('less than 0');
 const far=probeEdgeCost({...base,edges:[E('sg','s','g',5),E('sa','s','a',1e6),E('ag','a','g',1e6)]},'sg');
 expect(far.criticalCost).toBeNull();expect(far.note).toContain('at every cost up to 1,000,000');
});

const precisionGraph = (ab: number, ac: number, bc = 1): BfsInput => ({
  algorithm: 'dijkstra', directed: true, start: 'a', goal: 'c',
  nodes: ['a', 'b', 'c'].map(id => ({ id, label: id.toUpperCase() })),
  neighborOrder: ['a', 'b', 'c'],
  edges: [
    { id: 'ab', from: 'a', to: 'b', weight: ab },
    { id: 'bc', from: 'b', to: 'c', weight: bc },
    { id: 'ac', from: 'a', to: 'c', weight: ac },
  ],
});

it('preserves a sub-micro-unit positive boundary and the strictly cheaper zero-cost route', () => {
  const input = precisionGraph(1, 1.0000004);
  const probe = probeEdgeCost(input, 'bc');
  expect(probe.criticalCost).toBeGreaterThan(0);
  expect(probe.criticalCost).toBeCloseTo(4e-7, 15);
  expect(probe.alternativeCost).toBe(1.0000004);
  expect(probe.cases.find(sample => sample.value === 0)).toMatchObject({
    bfsCost: 1.0000004, dijkstraCost: 1, bfsPath: ['a', 'c'], dijkstraPath: ['a', 'b', 'c'],
  });
  const tie = probe.cases.find(sample => sample.value === probe.criticalCost)!;
  expect(tie.bfsCost).toBe(1.0000004);
  expect(tie.dijkstraCost).toBe(1.0000004);
  expect(probe.note).not.toContain('Even at cost 0');
  expect(runDijkstra(precisionGraph(1, 1.0000004, 1e-7)).path).toEqual(['a', 'b', 'c']);
  expect(runDijkstra(precisionGraph(1, 1.0000004, 8e-7)).path).toEqual(['a', 'c']);
  expect(input.edges[1].weight).toBe(1);
});

it('does not clamp a small negative boundary into an attainable zero-cost tie', () => {
  const probe = probeEdgeCost(precisionGraph(1.0000000004, 1), 'bc');
  expect(probe.criticalCost).toBeNull();
  expect(probe.cases.find(sample => sample.value === 0)).toMatchObject({
    bfsCost: 1, dijkstraCost: 1, dijkstraPath: ['a', 'c'],
  });
  expect(probe.note).toContain('Even at cost 0, a route through B–C costs more');
  expect(probe.note).not.toContain('only ties');
});

it('keeps representable small route costs and decimal sums identical to their checked traces', () => {
  const tiny = probeEdgeCost(precisionGraph(0, 4e-10, 2e-10), 'bc');
  expect(tiny.criticalCost).toBe(4e-10);
  expect(tiny.alternativeCost).toBe(4e-10);
  expect(tiny.cases.find(sample => sample.value === 2e-10)).toMatchObject({
    bfsCost: 4e-10, dijkstraCost: 2e-10,
  });
  const input = precisionGraph(0.1, 0.3, 0.2);
  const decimal = probeEdgeCost(input, 'ac');
  expect(decimal.criticalCost).toBe(0.30000000000000004);
  expect(decimal.alternativeCost).toBe(0.30000000000000004);
  expect(decimal.cases.find(sample => sample.value === 0.3)?.dijkstraCost).toBe(0.3);
  expect(decimal.cases.find(sample => sample.value === decimal.criticalCost)?.dijkstraCost)
    .toBe(decimal.alternativeCost);
  expect(decimal.note).not.toContain('At its current cost');
});

