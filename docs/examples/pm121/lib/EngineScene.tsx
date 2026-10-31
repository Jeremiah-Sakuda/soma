import type { EngineFilm } from './engine';
import { enginePose } from './engine';
export function EngineScene({film,degrees,labels=true,captions=false,compact=false}:{film:EngineFilm;degrees:number;labels?:boolean;captions?:boolean;compact?:boolean}) {
  const p=enginePose(degrees), palette=film.palette, active=[palette.intake,palette.compression,palette.power,palette.exhaust][p.phase];
  const paths=(role:string)=>film.art.filter(a=>a.role===role).map(a=><path key={a.id} data-art={a.id} d={a.d} fill={a.fill} stroke={a.stroke} strokeWidth={a.strokeWidth} strokeLinejoin="round" strokeLinecap="round"/>);
  const bearing=(x:number,y:number,r=10)=><g><circle cx={x} cy={y} r={r} fill="#f7f6f3" stroke={palette.edge} strokeWidth="2"/><circle cx={x} cy={y} r={r*.38} fill={palette.edge}/></g>;
  const phaseNames=['Intake','Compression','Power','Exhaust'];
  const callout=(name:string,x:number,y:number,px:number,py:number,side:'left'|'right')=><g fill="none" stroke="#a8aaa4" strokeWidth="1"><path d={side==='left'?`M${x+116} ${y-5} H${px-20} L${px} ${py}`:`M${x-12} ${y-5} H${px+20} L${px} ${py}`}/><circle cx={px} cy={py} r="3" fill="#f7f6f3"/><text x={x} y={y} fill="#45454f" stroke="none" fontFamily="Arial, sans-serif" fontSize="17">{name}</text></g>;
  return <svg data-engine data-phase={p.phase} data-degrees={p.degrees} viewBox={compact?"235 60 330 510":"0 0 800 600"} role="img" aria-label={`Four-stroke cutaway: ${phaseNames[p.phase]}, crank ${Math.round(p.degrees)} degrees`}>
    <title>{film.title}</title><desc>{film.strokes[p.phase].caption} Idealized timing; not a thermodynamic simulation.</desc>
    <defs><pattern id="engine-hatch" width="6" height="6" patternUnits="userSpaceOnUse"><path d="M-1 1 L1 -1 M0 6 L6 0 M5 7 L7 5" stroke="#c7cdc5" strokeWidth=".7"/></pattern><clipPath id="engine-chamber"><rect x="333" y="144" width="134" height={Math.max(0,p.pistonTop-144)}/></clipPath><radialGradient id="ignition"><stop stopColor="#fff6b7"/><stop offset=".5" stopColor={palette.power}/><stop offset="1" stopColor={palette.power} stopOpacity="0"/></radialGradient></defs>
    <rect width="800" height="600" fill="#fbfaf7"/>
    {captions&&<text x="32" y="37" fill="#17171c" fontFamily="Arial" fontSize="25" fontWeight="700">{String(p.phase+1).padStart(2,'0')} / {phaseNames[p.phase]}</text>}
    <ellipse cx="400" cy="561" rx="130" ry="7" fill="#17171c" opacity=".05"/>
    <path d="M400 73 V545" stroke="#c7ccc6" strokeWidth="1" strokeDasharray="3 7"/>
    <g data-role="housing">{paths('housing')}</g>
    <g clipPath="url(#engine-chamber)"><rect x="333" y="144" width="134" height="220" fill={active} opacity={p.phase===1?.12+.16*p.fraction:p.phase===2?.28-.12*p.fraction:.12}/>{Array.from({length:24},(_,i)=>{const x=342+(i%6)*22, height=p.pistonTop-151, y=151+((Math.floor(i/6)/4+p.fraction*.26)%1)*height;return <circle key={i} cx={x} cy={y} r={p.phase===1?2.8:2.3} fill={active} opacity=".62"/>;})}</g>
    <g data-role="ports">{paths('ports')}</g><g data-role="head">{paths('head')}</g><g data-role="detail">{paths('detail')}</g>
    <g data-role="crank" transform={`translate(400 450) rotate(${p.degrees})`}>{paths('crank')}</g>
    <g data-role="rod" transform={`translate(${p.pinX} ${p.pinY}) rotate(${p.rodAngle})`}>{paths('rod')}</g>
    <g data-role="piston" transform={`translate(400 ${p.pistonY})`}>{paths('piston')}</g>
    {bearing(p.pinX,p.pinY,13)}{bearing(400,p.pistonY,9)}{bearing(400,450,17)}
    <g data-role="intake-valve" transform={`translate(360 ${136+p.intakeLift})`}>{paths('intake-valve')}</g><g data-role="exhaust-valve" transform={`translate(440 ${136+p.exhaustLift})`}>{paths('exhaust-valve')}</g>
    <g aria-hidden="true"><path d="M393 83 H407 V111 H403 V127 L400 133 L397 127 V111 H393Z" fill="#efede7" stroke={palette.edge} strokeWidth="2"/><path d="M397 84 V73 H403 V84 M398 116 H402 M398 121 H402" stroke={palette.edge} strokeWidth="2"/>
    {p.spark>0&&<g opacity={p.spark}><circle cx="400" cy="153" r="38" fill="url(#ignition)"/><path d="M402 133 L394 148 H404 L397 163" stroke="#e6a62c" fill="none" strokeWidth="3"/></g>}</g>
    {(p.phase===0||p.phase===3)&&<g fill="none" stroke={active} strokeWidth="3" strokeLinecap="round" opacity={Math.sin(Math.PI*p.fraction)}><path d={p.phase===0?'M254 122 H318 Q355 122 360 160':'M440 160 Q445 122 482 122 H547'} strokeDasharray="4 11" strokeDashoffset={-p.fraction*90}/><path d={p.phase===0?'M354 151 L360 163 L367 152':'M537 116 L549 122 L537 128'}/></g>}
    {labels&&!compact&&<g data-labels>{callout('Air + fuel',60,124,262,122,'left')}{callout('Intake valve',60,180,360,140+p.intakeLift,'left')}{callout('Piston',60,275,335,p.pistonY-12,'left')}{callout('Connecting rod',60,374,(400+p.pinX)/2,(p.pistonY+p.pinY)/2,'left')}{callout('Spark plug',603,82,403,84,'right')}{callout('Exhaust',603,133,543,122,'right')}{callout('Crankshaft',603,454,420,450,'right')}</g>}
    {compact&&labels&&<g data-compact-labels fontFamily="Arial" fontSize="13" textAnchor="middle" fill="#45454f">{[[1,510,p.pistonY-12],[2,510,(p.pistonY+p.pinY)/2],[3,540,450]].map(([n,x,y])=><g key={n}><circle cx={x} cy={y} r="11" fill="#fbfaf7" stroke="#a8aaa4"/><text x={x} y={y+4}>{n}</text></g>)}</g>}
    <g transform="translate(400 450)" aria-hidden="true"><circle r="95" fill="none" stroke="#bec5bb" strokeWidth="1" strokeDasharray="1 8"/><path d="M-82 -53 A98 98 0 0 1 -58 -79 M-58 -79 L-68 -79 M-58 -79 L-60 -69" fill="none" stroke="#6b7669" strokeWidth="1.5"/></g>
    {captions&&<text x="400" y="590" textAnchor="middle" fill="#45454f" fontFamily="Arial" fontSize="16">{film.strokes[p.phase].caption}</text>}
  </svg>;
}
