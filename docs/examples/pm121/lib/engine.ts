import { z } from 'zod';
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
const role = z.enum(['housing','head','ports','piston','rod','crank','intake-valve','exhaust-valve','detail']);
export const engineSchema = z.strictObject({
  schemaVersion: z.literal('engine-film-v1'), title: z.string().min(1).max(65), summary: z.string().min(1).max(240),
  palette: z.strictObject({ metal: color, edge: color, piston: color, rod: color, crank: color, intake: color, compression: color, power: color, exhaust: color }),
  art: z.array(z.strictObject({ id: z.string().regex(/^[a-z][a-z0-9-]{0,30}$/), role, d: z.string().min(3).max(1600).regex(/^[MmLlHhVvCcSsQqTtAaZz0-9.,+eE\s-]+$/), fill: z.union([color,z.literal('none')]), stroke: z.union([color,z.literal('none')]), strokeWidth: z.number().min(0).max(5) })).min(12).max(40),
  strokes: z.array(z.strictObject({ name: z.enum(['Intake','Compression','Power','Exhaust']), verb: z.string().min(1).max(22), caption: z.string().min(1).max(110), narration: z.string().min(1).max(160) })).length(4),
  assumptions: z.array(z.string().min(1).max(180)).min(2).max(5),
});
export type EngineFilm = z.infer<typeof engineSchema>;
export function validateEngine(raw: unknown) {
  if (JSON.stringify(raw).length > 26000) throw Error('Engine specification too large');
  const f = engineSchema.parse(raw);
  if (new Set(f.art.map(p=>p.id)).size!==f.art.length) throw Error('Duplicate art ID');
  for (const r of ['housing','head','ports','piston','rod','crank','intake-valve','exhaust-valve']) if(!f.art.some(p=>p.role===r)) throw Error('Missing engine role '+r);
  if(f.strokes.map(s=>s.name).join(',')!=='Intake,Compression,Power,Exhaust') throw Error('Incorrect stroke order');
  for(const p of f.art) if(!/^[Mm]/.test(p.d.trim()) || (p.d.match(/[-+]?(?:\d*\.)?\d+(?:[eE][-+]?\d+)?/g)??[]).some(v=>!Number.isFinite(Number(v))||Math.abs(Number(v))>1200))throw Error('Invalid art coordinates');
  return f;
}
export const ENGINE = Object.freeze({ cx:400, cy:450, crankRadius:64, rodLength:170, boreLeft:332, boreRight:468, roof:144, pistonTopOffset:36, duration:24 });
/** Idealized geometry only. Valves follow four non-overlapping illustrative strokes. */
export function enginePose(value: number) {
  const degrees=Number.isFinite(value)?Math.max(0,Math.min(720,value)):0;
  const theta=degrees*Math.PI/180, {cx,cy,crankRadius:r,rodLength:l}=ENGINE;
  const pinX=cx+r*Math.sin(theta), pinY=cy-r*Math.cos(theta);
  const pistonY=pinY-Math.sqrt(l*l-(pinX-cx)**2);
  const phase=degrees===720?3:Math.floor(degrees/180), fraction=(degrees-phase*180)/180;
  const lift=9*Math.sin(Math.PI*fraction)**2;
  return {degrees,phase,fraction,pinX,pinY,pistonY,pistonTop:pistonY-36,rodAngle:Math.atan2(cx-pinX,pinY-pistonY)*180/Math.PI,intakeLift:phase===0?lift:0,exhaustLift:phase===3?lift:0,spark:degrees>=360&&degrees<377?Math.sin((degrees-360)/17*Math.PI):0};
}
