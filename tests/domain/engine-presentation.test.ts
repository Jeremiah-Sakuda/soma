import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {validateEngine} from '../../docs/examples/pm121/lib/engine';
import {validatePresentation,presentFilm} from '../../docs/examples/pm123/presentation';
const read=(p:string)=>JSON.parse(readFileSync(p,'utf8'));
const base=validateEngine(read('docs/examples/pm121/film.json'));
const raw=()=>read('docs/examples/pm123/presentation.json');
describe('Muse presentation boundary',()=>{
 it('compiles recorded refinements without changing base, joints, roles or unselected artwork',()=>{
  const original=createHash('sha256').update(JSON.stringify(base)).digest('hex'),p=validatePresentation(raw(),base),f=validateEngine(presentFilm(base,p));
  expect(f.art.length).toBe(base.art.length);expect(f.strokes).toEqual(p.strokes);
  for(const a of base.art){const b=f.art.find(n=>n.id===a.id)!;expect(b.role).toBe(a.role);if(!p.refinements.some(n=>n.id===a.id))expect(b).toEqual(a);}
  expect(createHash('sha256').update(JSON.stringify(base)).digest('hex')).toBe(original);
 });
 it('keeps every part selectable exactly once and every phase in source order',()=>{
  const p=validatePresentation(raw(),base);expect(new Set(p.parts.map(a=>a.id))).toEqual(new Set(['piston','rod','crank']));expect(p.strokes.map(a=>a.name)).toEqual(base.strokes.map(a=>a.name));
 });
 it.each(['head-deck','exhaust-valve-stem','not-a-source-part'])('refuses refinement outside the approved surface %s',id=>{const p=raw();p.refinements[0].id=id;expect(()=>validatePresentation(p,base)).toThrow();});
 it.each(['M1e999 0','M0 0 <script>','M0 0 url(https://bad)'])('refuses executable or nonfinite path data %s',d=>{const p=raw();p.refinements[0].d=d;expect(()=>validatePresentation(p,base)).toThrow();});
 it('refuses duplicate refinements, duplicate parts and unexpected generated fields',()=>{let p=raw();p.refinements.push(p.refinements[0]);expect(()=>validatePresentation(p,base)).toThrow();p=raw();p.parts[1].id='piston';expect(()=>validatePresentation(p,base)).toThrow();p=raw();p.code='run';expect(()=>validatePresentation(p,base)).toThrow();});
});

it('reproduces final copy exactly from recorded Muse output while preserving art and narration',()=>{
 const baseCopy=read('docs/examples/pm123/copy-base.json'),author=read('docs/examples/pm123/refinement-author.json');expect(baseCopy).toEqual(author.structured);
 const patch=read('docs/examples/pm123/copy-author.json').structured;
 expect(raw()).toEqual({...baseCopy,subtitle:patch.subtitle,strokes:baseCopy.strokes.map((s:Record<string,unknown>,i:number)=>({...s,...patch.strokes[i]}))});
});
