import {describe,it,expect} from 'vitest';
import {strokePreview,displayedAngle} from '../../docs/examples/pm125/learning-state';
import {enginePose,validateEngine} from '../../docs/examples/pm121/lib/engine';
import {presentFilm,validatePresentation} from '../../docs/examples/pm123/presentation';
import baseRaw from '../../docs/examples/pm121/film.json';
import presentationRaw from '../../docs/examples/pm123/presentation.json';
import refinement from '../../docs/examples/pm123/refinement-author.json';
import copy from '../../docs/examples/pm123/copy-author.json';
const base=validateEngine(baseRaw),film=validateEngine(presentFilm(base,validatePresentation(presentationRaw,base)));
describe('review-driven engine exploration',()=>{
 it('proof contour and quoted caption are exact recorded Muse outputs',()=>{expect(film.art.find(a=>a.id==='piston-skirt')!.d).toBe(refinement.structured.refinements.find(a=>a.id==='piston-skirt')!.d);expect(film.strokes[1].caption).toBe(copy.structured.strokes.find(a=>a.name==='Compression')!.caption);});
 it('inspection poses show open inlet/exhaust and a visible ignition without dead centers',()=>{const poses=[0,1,2,3].map(i=>enginePose(strokePreview(i)));expect(poses.map(p=>p.phase)).toEqual([0,1,2,3]);expect(poses[0].intakeLift).toBe(9);expect(poses[1].intakeLift+poses[1].exhaustLift).toBe(0);expect(poses[2].spark).toBeGreaterThan(.99);expect(poses[3].exhaustLift).toBe(9);});
 it('paired linkage geometry matches while valves differ',()=>{for(const [a,b] of [[90,450],[270,630]]){const x=enginePose(a),y=enginePose(b);for(const key of ['pinX','pinY','pistonY','rodAngle'] as const)expect(x[key]).toBeCloseTo(y[key],9);expect([x.intakeLift,x.exhaustLift]).not.toEqual([y.intakeLift,y.exhaustLift]);}});
 it('snapshot selection handles transitions and preserves exact manual angles',()=>{for(const a of [0,1,179.9,180,359.9,360,539.9,540,720]){expect(enginePose(displayedAngle(a,true)).phase).toBe(enginePose(a).phase);expect(displayedAngle(a,false)).toBe(a);}});
});

import rejected from '../../docs/examples/pm121/base-author.json';
import repair from '../../docs/examples/pm121/path-repair-author.json';
import receipt from '../../docs/examples/pm121/generation-receipt.json';
it('repair proof retains the actual rejected stem and exactly applied Muse path',()=>{const before=rejected.structured.art.find(a=>a.id==='exhaust-valve-stem')!,after=repair.structured.updates.find(a=>a.id===before.id)!;expect(before.d).not.toBe(after.d);expect(after.d).toBe(base.art.find(a=>a.id===before.id)!.d);expect(receipt.advisoryReviews.find(r=>r.run===3&&r.review==='review-2.json')!.verdict).toEqual({approved:false,issues:[expect.stringContaining('no matching valve head')]});});
