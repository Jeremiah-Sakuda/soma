import {enginePose} from '../pm121/lib/engine';
/** Forward-cycle cues, not measured velocity, force or thermodynamics. */
export function motionGuides(degrees:number){
 const p=enginePose(degrees),start=p.phase*180,from=start*Math.PI/180,to=p.degrees*Math.PI/180;
 const point=(angle:number)=>({x:400+94*Math.sin(angle),y:450-94*Math.cos(angle)});
 const a=point(from),b=point(to),span=p.degrees-start;
 return {phase:p.phase,direction:p.phase===0||p.phase===2?'down':'up',atTurn:Math.abs(Math.sin(p.degrees*Math.PI/180))<1e-8,strokeFraction:p.fraction,travelTop:180,travelBottom:308,travelY:p.pistonTop,
  arc:span<.001?'':`M${a.x} ${a.y} A94 94 0 ${span>180?1:0} 1 ${b.x} ${b.y}`,
  intakeOpen:p.intakeLift>.01,exhaustOpen:p.exhaustLift>.01};
}
export function playbackDegrees(elapsedMs:number,from:number,rate:number,loop:boolean){
 const n=Math.max(0,Number.isFinite(from)?from:0)+Math.max(0,Number.isFinite(elapsedMs)?elapsedMs:0)*.03*(rate===.5?.5:1);
 return loop?n%720:Math.min(720,n);
}
