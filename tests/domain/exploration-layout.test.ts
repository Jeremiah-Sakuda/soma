import {it,expect} from 'vitest';import {diagramLayout} from '../../src/lib/domain/exploration-layout';import type {ExplorationPanel} from '../../src/lib/domain/exploration';
const panel=(count:number):Extract<ExplorationPanel,{kind:'diagram'}>=>({id:'process',kind:'diagram',title:'Dense process',placement:{column:1,row:1,columnSpan:2},objects:[...Array.from({length:count},(_,i)=>({id:`stage${i}`,kind:'block' as const,label:`Processing stage ${i}`,position:{x:.4+i*.001,y:.5}})),{id:'note',kind:'text',text:'A full explanation remains visible below the mechanism.',position:{x:.5,y:.5}}]});
it.each([false,true])('lays out 2–29 crowded cards without intersections or clipped bounds, compact=%s',compact=>{
 for(let n=2;n<=29;n++){const p=panel(n),before=structuredClone(p),layout=diagramLayout(p,compact);expect(layout.crowded).toBe(true);expect(p).toEqual(before);
  for(const [i,a]of layout.positions.entries()){expect(a.x-layout.cardWidth/2).toBeGreaterThanOrEqual(0);expect(a.x+layout.cardWidth/2).toBeLessThanOrEqual(layout.width);expect(a.y-layout.cardHeight/2).toBeGreaterThanOrEqual(0);expect(a.y+layout.cardHeight/2).toBeLessThan(layout.notes[0].y);for(const b of layout.positions.slice(i+1))expect(Math.abs(a.x-b.x)>=layout.cardWidth||Math.abs(a.y-b.y)>=layout.cardHeight).toBe(true);}
  expect(layout.notes[0].y+layout.notes[0].height).toBeLessThanOrEqual(layout.height);
 }
});
it('keeps distinct authored positions and semantic identities stable',()=>{const p=panel(2);for(const [i,o]of p.objects.entries())if(o.kind==='block')o.position={x:i,y:i};const layout=diagramLayout(p,false);expect(layout.crowded).toBe(false);expect(layout.positions.map(p=>p.id)).toEqual(['stage0','stage1']);expect(diagramLayout(p,false)).toEqual(layout);});

it('reserves headroom for a visible self-loop above the first card',()=>{const p=panel(2);p.objects.push({id:'again',kind:'edge',from:'stage0',to:'stage0',directed:true,label:'retry'});expect(diagramLayout(p,true).positions[0].y-82).toBeGreaterThanOrEqual(0);});
