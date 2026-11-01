import {z} from 'zod';
import {enginePose} from '../pm121/lib/engine';
import receipt from '../pm124/render-receipt.json';
import generation from '../pm121/generation-receipt.json';
export const identity={sourceSha256:generation.sourceSha256,filmSha256:receipt.filmSha256};
export const preparedQuestions=[
 {id:'two-turns',degrees:90,question:'The piston returns after one turn. Why is the cycle not finished?'},
 {id:'two-upstrokes',degrees:270,question:'Compression and exhaust both move up. What makes their jobs different?'},
 {id:'connected-motion',degrees:450,question:'Which part carries motion between the piston and the turning crank?'}
] as const;
export const sourceQuotes=['One cycle = four piston strokes = two crankshaft turns (720°).','Connecting rod joins piston pin to crank pin throughout.','2. Compression: piston up; both valves closed.','4. Exhaust: piston up; exhaust open; burnt gas leaves.'] as const;
export const investigationSchema=z.strictObject({sourceSha256:z.string(),filmSha256:z.string(),investigations:z.array(z.strictObject({id:z.enum(['two-turns','two-upstrokes','connected-motion']),observedDegrees:z.number().int().min(0).max(720),title:z.string().min(1).max(65),action:z.enum(['compare-turns','inspect-part']),targetDegrees:z.number().int().min(0).max(720),part:z.enum(['piston','rod','crank']).nullable(),objective:z.string().min(1).max(140),explanation:z.string().min(1).max(340),sourceQuote:z.enum(sourceQuotes)})).length(3)});
export type Investigation=z.infer<typeof investigationSchema>['investigations'][number];
export function validateInvestigations(raw:unknown){
 const data=investigationSchema.parse(raw);if(data.sourceSha256!==identity.sourceSha256||data.filmSha256!==identity.filmSha256)throw Error('Stale investigation source or film');
 if(new Set(data.investigations.map(a=>a.id)).size!==3)throw Error('Duplicate investigation');
 for(const p of data.investigations){const context=preparedQuestions.find(a=>a.id===p.id)!;if(p.observedDegrees!==context.degrees)throw Error('Incorrect recorded context');if(p.action==='compare-turns'){if(Math.abs(p.targetDegrees-p.observedDegrees)!==360||p.part!==null)throw Error('Comparison must be one revolution apart');const a=enginePose(p.observedDegrees),b=enginePose(p.targetDegrees);for(const k of ['pinX','pinY','pistonY','rodAngle'] as const)if(Math.abs(a[k]-b[k])>1e-7)throw Error('Comparison geometry mismatch');}else if(!p.part)throw Error('Missing inspected part');}
 return data;
}

import type {EngineFilm} from '../pm121/lib/engine';
import {assertRecordedFilm} from './recorded-film';
export function validateRecordedInvestigation(plan:unknown,author:unknown,review:unknown,film:EngineFilm){
 assertRecordedFilm(film);const a=z.object({status:z.literal('completed'),structured:z.unknown()}).parse(author),r=z.object({status:z.literal('completed'),structured:z.object({approved:z.literal(true),issues:z.array(z.string())})}).parse(review);
 const original=validateInvestigations(a.structured),data=validateInvestigations(plan);if(JSON.stringify(original)!==JSON.stringify(data))throw Error('Investigation differs from recorded author');
 void r;return data;
}
