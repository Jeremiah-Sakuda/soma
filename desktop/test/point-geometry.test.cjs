const {test}=require('node:test');const assert=require('node:assert/strict');const {selectFocus,pointPanelBounds}=require('../point-geometry.cjs');
const circle=(cx,cy,rx,ry)=>Array.from({length:65},(_,i)=>({x:cx+Math.cos(i/64*Math.PI*2)*rx,y:cy+Math.sin(i/64*Math.PI*2)*ry}));
test('closed gesture selects the actual circled area across negative-origin and scaled displays',()=>{
 for(const bounds of [{x:0,y:0,width:1440,height:900},{x:-1920,y:-1080,width:1920,height:1080}]){
  const points=circle(bounds.x+bounds.width*.6,bounds.y+bounds.height*.4,90,60),copy=structuredClone(points),focus=selectFocus(points,bounds);
  assert.equal(focus.kind,'circle');assert(Math.abs(focus.region.x+focus.region.width/2-.6)<.00001);assert(Math.abs(focus.region.y+focus.region.height/2-.4)<.00001);
  for(const scale of [1,2]){const x=focus.region.x*bounds.width*scale;assert(x<bounds.width*.6*scale);assert((focus.region.x+focus.region.width)*bounds.width*scale>bounds.width*.6*scale);}assert.deepEqual(points,copy);
 }
});
test('a cursor move, tiny shake or nearly closed line stays a point instead of a fabricated circle',()=>{
 for(const points of [[{x:1,y:1}],circle(400,300,5,5),Array.from({length:70},(_,i)=>({x:200+i*2,y:200+i*2}))]){const f=selectFocus(points,{x:0,y:0,width:1000,height:800});assert.equal(f.kind,'point');assert(f.region.x>=0&&f.region.y>=0);assert(f.region.x+f.region.width<=1&&f.region.y+f.region.height<=1);}
});
test('a lead-in movement does not prevent recognizing the final intentional loop',()=>{const f=selectFocus([{x:20,y:20},...circle(500,350,80,50)],{x:0,y:0,width:1200,height:800});assert.equal(f.kind,'circle');assert(f.region.width<.2);});
test('empty, malformed and cross-display pointing is rejected rather than silently retargeted',()=>{const bounds={x:-1000,y:0,width:1000,height:700};for(const p of [[],[{x:Infinity,y:1}],[{x:-500,y:100},{x:100,y:200}]])assert.throws(()=>selectFocus(p,bounds));});
test('the panel uses the opposite display edge from the selected region',()=>{const area={x:-1920,y:24,width:1920,height:1056};assert.equal(pointPanelBounds(area,{region:{x:.8,width:.1}}).x,-1920);assert.equal(pointPanelBounds(area,{region:{x:.1,width:.1}}).x,-620);});
