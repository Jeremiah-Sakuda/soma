'use client';
import {useEffect,useId,useState} from 'react';
import type {BfsExecution,ExplorationPanel} from '@/lib/domain/exploration';
import {beatProgress,easeMotion,searchMotionFrame} from '@/lib/domain/exploration-motion';

type Point={x:number;y:number};
const mix=(from:Point,to:Point,p:number)=>({x:from.x+(to.x-from.x)*easeMotion(p),y:from.y+(to.y-from.y)*easeMotion(p)});
export function ExplorationSearchStage({panel,execution,index,selected,onSelect,highlights,progress}:{panel:Extract<ExplorationPanel,{kind:'graph'}>;execution:BfsExecution;index:number;selected:string|null;onSelect:(id:string)=>void;highlights:string[];progress:number}){
 const [compact,setCompact]=useState(false);
 useEffect(()=>{const query=matchMedia('(max-width: 760px)');const update=()=>setCompact(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update);},[]);
 const width=compact?380:640,columns=compact?4:8;
 const marker=useId().replace(/[^a-z0-9]/gi,''),frame=searchMotionFrame(execution,index,progress),{plan}=frame;
 if(execution.modelId==='dijkstra-nonnegative'||execution.input.edges.some(e=>(e.weight??1)!==1))return <WeightedStage panel={panel} execution={execution} index={index} selected={selected} onSelect={onSelect} width={width}/>;
 const xs=panel.positions.map(p=>p.x),ys=panel.positions.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const point=(id:string)=>{const p=panel.positions.find(p=>p.nodeId===id)!;return{x:55+(maxX===minX?.5:(p.x-minX)/(maxX-minX))*(width-110),y:48+(maxY===minY?.5:(p.y-minY)/(maxY-minY))*190};};
 const name=(id:string)=>execution.input.nodes.find(node=>node.id===id)?.label??id;
 const short=(id:string)=>name(id).length>6?name(id).slice(0,4)+'…':name(id);
 const slot=(i:number)=>({x:34+(i%columns)*(width-40)/columns,y:354+Math.floor(i/columns)*58});
 const points=execution.input.nodes.map(node=>point(node.id));
 const distances=points.flatMap((p,i)=>points.slice(i+1).map(q=>Math.hypot(p.x-q.x,p.y-q.y)));
 const radius=Math.max(10,Math.min(25,(Math.min(...distances,100)-8)/2));
 const token=(id:string,position:Point,opacity=1,kind='queue')=><g key={`${kind}-${id}`} className={`exploration-moving-token ${kind}`} transform={`translate(${position.x},${position.y})`} opacity={opacity} data-token={id} data-motion={kind}><rect x="-28" y="-20" width="56" height="40" rx="12"/><text textAnchor="middle" dominantBaseline="middle"><title>{name(id)}</title>{short(id)}</text></g>;
 const queuedTokens=plan.retained.map((id,i)=>token(id,mix(slot(plan.before.indexOf(id)),slot(i),frame.departProgress)));
 const arrivals=plan.arrivals.map(item=>{const p=beatProgress(progress,item.traceEnd,item.end);return token(item.id,mix(point(item.id),slot(item.slot),p),progress<item.traceEnd?0:1,'arrival');});
 const height=332+Math.max(1,Math.ceil(Math.max(plan.step.queue.length,plan.before.length)/columns))*58;
 return <>
  <div className="exploration-stage-heading"><span className="overline">{panel.execution==='comparison'?'Comparison':'Search in motion'}</span><span className="meta">{progress<1?'Replaying this step':'Checked state'}</span></div>
  <p className="exploration-motion-caption" aria-live="off">{frame.caption}</p>
  <svg className="exploration-graph exploration-search-stage" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${panel.title}. ${frame.caption} Use the object buttons to select a node.`} data-motion-progress={progress.toFixed(3)}>
   <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
   {execution.input.edges.map(edge=>{
    const from=point(edge.from),to=point(edge.to),length=Math.hypot(to.x-from.x,to.y-from.y),offset=(radius+5)/(length||1);
    const start={x:from.x+(to.x-from.x)*offset,y:from.y+(to.y-from.y)*offset},end={x:to.x-(to.x-from.x)*offset,y:to.y-(to.y-from.y)*offset};
    const loop=from.y<100?1:-1;
    const d=length===0?`M ${from.x-12} ${from.y+loop*18} C ${from.x-58} ${from.y+loop*65},${from.x+58} ${from.y+loop*65},${from.x+12} ${from.y+loop*18}`:`M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const arrival=plan.arrivals.find(item=>item.edgeId===edge.id),reverse=arrival&&edge.to===arrival.from;
    const pathIndex=plan.path.findIndex((id,i)=>i<plan.path.length-1&&((edge.from===id&&edge.to===plan.path[i+1])||(!execution.input.directed&&edge.to===id&&edge.from===plan.path[i+1])));
    const trace=arrival?beatProgress(progress,arrival.start,arrival.traceEnd):pathIndex>=0?beatProgress(progress,.32+pathIndex*.5/Math.max(plan.path.length-1,1),.32+(pathIndex+1)*.5/Math.max(plan.path.length-1,1)):0;
    const traceD=(reverse||(pathIndex>=0&&edge.to===plan.path[pathIndex]))?`M ${end.x} ${end.y} L ${start.x} ${start.y}`:d;
    return <g key={edge.id}><path d={d} className={`exploration-edge ${selected===edge.id||highlights.includes(edge.id)?'is-selected':''}`} markerEnd={execution.input.directed?`url(#${marker})`:undefined}/>{trace>0&&<path d={traceD} pathLength="1" strokeDasharray="1" strokeDashoffset={1-trace} className={`exploration-trace ${pathIndex>=0?'is-path':''}`} data-trace={edge.id}/>}</g>;
   })}
   {execution.input.nodes.map(node=>{
    const position=point(node.id),current=plan.departing===node.id&&frame.departProgress>.7,queued=frame.queue.includes(node.id),visited=plan.step.expanded.includes(node.id)&&node.id!==plan.departing;
    return <g key={node.id} transform={`translate(${position.x},${position.y})`} className={`exploration-node ${current?'is-current':queued?'is-queued':visited?'is-visited':''} ${selected===node.id||highlights.includes(node.id)?'is-selected':''}`} onClick={()=>onSelect(node.id)}>
     {current&&<circle className="exploration-focus-ring" r={radius+8}/>}
     <circle r={radius}/><text textAnchor="middle" dominantBaseline="middle" style={{fontSize:radius<20?10:14}}><title>{name(node.id)}</title>{radius<20?name(node.id).slice(0,2):short(node.id)}</text>
     <text className="exploration-node-state" y={radius+20} textAnchor="middle">{current?(plan.step.status==='found'?'Goal':progress<1?'Expanding':'Expanded'):queued?'Queued':visited?'Expanded':''}</text>
    </g>;
   })}
   <rect className="exploration-queue-track" x="5" y="298" width={width-10} height={height-303} rx="18"/>
   <text className="exploration-queue-label" x="16" y="320">FRONT OF QUEUE</text><text className="exploration-queue-label" x={width-16} y="320" textAnchor="end">{compact?'JOIN AT BACK':'NEW NODES JOIN AT THE BACK'}</text>
   {queuedTokens}{arrivals}
   {plan.departing&&frame.departProgress<1&&token(plan.departing,mix(slot(0),point(plan.departing),frame.departProgress),1-beatProgress(frame.departProgress,.85,1),'departure')}
   {progress>=1&&plan.step.queue.length===0&&<text x={width/2} y="360" textAnchor="middle" className="exploration-empty-queue">Queue empty</text>}
  </svg>
  <details className="exploration-graph-details" open={!compact}><summary>Select a node & inspect graph</summary><div className="exploration-object-buttons" aria-label="Select a graph object">{execution.input.nodes.map(node=><button type="button" key={node.id} aria-pressed={selected===node.id} onClick={()=>onSelect(node.id)}>Node {node.label}</button>)}</div>
  <p className="exploration-graph-configuration">Start: {name(execution.input.start)} · Goal: {execution.input.goal?name(execution.input.goal):'All reachable nodes'}</p>
  <p className="exploration-graph-order">Neighbor order: {execution.input.neighborOrder.map(name).join(' → ')}</p></details>
 </>;
}

function WeightedStage({panel,execution,index,selected,onSelect,width}:{panel:Extract<ExplorationPanel,{kind:'graph'}>;execution:BfsExecution;index:number;selected:string|null;onSelect:(id:string)=>void;width:number}){
 const step=execution.steps[Math.min(index,execution.steps.length-1)],weighted=execution.modelId==='dijkstra-nonnegative';
 const xs=panel.positions.map(p=>p.x),ys=panel.positions.map(p=>p.y),minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 const pos=(id:string)=>{const p=panel.positions.find(p=>p.nodeId===id)!;return {x:38+(maxX===minX?.5:(p.x-minX)/(maxX-minX))*(width-76),y:35+(maxY===minY?.5:(p.y-minY)/(maxY-minY))*145};};
 const label=(id:string)=>execution.input.nodes.find(n=>n.id===id)?.label??id;
 const cost=execution.path?.slice(1).reduce((total,id,i)=>total+(execution.input.edges.find(e=>e.from===execution.path![i]&&e.to===id||!execution.input.directed&&e.to===execution.path![i]&&e.from===id)?.weight??1),0);
 return <><svg className="exploration-graph" viewBox={`0 0 ${width} 235`} role="img" aria-label={`${panel.title}. ${weighted?'Lowest tentative cost':'FIFO ignoring weights'}.`}>
 {execution.input.edges.map(e=>{
  const a=pos(e.from),b=pos(e.to),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),ux=dx/(length||1),uy=dy/(length||1);
  const inPath=step.status==='found'&&execution.path?.some((id,i)=>i<execution.path!.length-1&&((id===e.from&&execution.path![i+1]===e.to)||(!execution.input.directed&&id===e.to&&execution.path![i+1]===e.from)));
  const end={x:b.x-ux*27,y:b.y-uy*27},start={x:a.x+ux*27,y:a.y+uy*27};
  const d=length===0?`M ${a.x-16} ${a.y-18} C ${a.x-65} ${a.y-75}, ${a.x+65} ${a.y-75}, ${a.x+16} ${a.y-18}`:`M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  return <g key={e.id} data-edge={e.id} data-in-path={Boolean(inPath)}><path d={d} fill="none" stroke={inPath?'var(--success-fg)':'var(--control-border)'} strokeWidth={inPath?4:2}/>{execution.input.directed&&<path data-arrowhead={e.id} d={length===0?`M ${a.x+16} ${a.y-18} l 3 -12 l 9 7 Z`:`M ${end.x} ${end.y} l ${-ux*10+uy*5} ${-uy*10-ux*5} l ${-uy*10} ${ux*10} Z`} fill={inPath?'var(--success-fg)':'var(--control-border)'}/>}<text x={length===0?a.x:(a.x+b.x)/2} y={length===0?a.y-60:(a.y+b.y)/2-8} textAnchor="middle" paintOrder="stroke" stroke="var(--surface)" strokeWidth="5" fill="var(--ink)" fontSize="16">{e.weight??1}</text></g>;
 })}
 {execution.input.nodes.map(n=>{const p=pos(n.id);return <g key={n.id} onClick={()=>onSelect(n.id)}><circle cx={p.x} cy={p.y} r="24" fill={step.current===n.id?'#6554e8':step.expanded.includes(n.id)?'#d6eadc':'#fffdf8'} stroke={selected===n.id?'#6554e8':'#aaa'} strokeWidth="2"/><text x={p.x} y={p.y+5} textAnchor="middle" fill={step.current===n.id?'white':'#252827'} fontSize="14"><title>{n.label}</title>{n.label.length>6?n.label.slice(0,4)+"…":n.label}</text><text x={p.x} y={p.y+40} textAnchor="middle" fontSize="13">{weighted?'cost':'hops'}: {step.distances[n.id]??'∞'}</text></g>;})}
 </svg><p className="meta exploration-queue-kind">{weighted?'Priority queue · lowest tentative cost first':'FIFO queue · ignores costs'}</p><ol className="exploration-frontier" aria-label={`${panel.title} queue`}>{step.queue.map(id=><li key={id}><strong>{label(id)}</strong><span>{weighted?step.distances[id]:''}</span></li>)}</ol>{step.status==='found'&&<p role="status" className="exploration-stage-route">Route: {execution.path?.map(label).join(' → ')} · total cost {cost} · {execution.path!.length-1} edges</p>}<details className="exploration-graph-details" open={width>380}><summary>Select a node</summary><div className="exploration-object-buttons">{execution.input.nodes.map(n=><button type="button" key={n.id} onClick={()=>onSelect(n.id)}>Node {n.label}</button>)}</div></details></>;
}
