import type {ExplorationPanel} from './exploration';
type Diagram=Extract<ExplorationPanel,{kind:'diagram'}>;
/** Presentation-only layout. Preserve IDs, labels and connections; use authored
 * positions when cards fit, otherwise space them in stable reading order.
 * Coordinates never become learner evidence or scientific measurements. */
export function diagramLayout(panel:Diagram,compact:boolean){
 const width=compact?400:600,cardWidth=150,cardHeight=76;
 const nodes=panel.objects.filter(o=>o.kind==='node'||o.kind==='block');
 let positions=nodes.map(o=>({id:o.id,x:90+o.position.x*(width-180),y:55+o.position.y*210}));
 const crowded=positions.some((p,i)=>positions.slice(i+1).some(q=>Math.abs(p.x-q.x)<cardWidth+16&&Math.abs(p.y-q.y)<cardHeight+16));
 if(crowded){const ordered=[...nodes].sort((a,b)=>a.position.y-b.position.y||a.position.x-b.position.x||a.id.localeCompare(b.id)),columns=compact?2:3;
  positions=ordered.map((o,i)=>({id:o.id,x:90+(i%columns)*(width-180)/(columns-1),y:55+Math.floor(i/columns)*116}));
 }
 if(panel.objects.some(o=>o.kind==='edge'&&o.from===o.to))positions=positions.map(p=>({...p,y:p.y+40}));
 let bottom=Math.max(115,...positions.map(p=>p.y+cardHeight/2+24));
 const notes=panel.objects.filter(o=>o.kind==='text').map(o=>{const y=bottom,height=Math.max(42,Math.ceil(o.text.length/Math.floor((width-48)/7))*20+16);bottom+=height;return {...o,y,height};});
 return{width,height:bottom,positions,notes,crowded,cardWidth,cardHeight};
}
