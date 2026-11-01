import {test,expect} from '@playwright/test';
import {readFileSync} from 'node:fs';
const film=JSON.parse(readFileSync('docs/examples/pm121/film.json','utf8'));
test('four strokes drive distinct valve and piston states, with exact manual interruption',async({page})=>{
 await page.goto('/');const slider=page.getByRole('slider',{name:'Crank angle'});
 for(const [i,name]of ['Intake','Compression','Power','Exhaust'].entries()){await page.getByRole('button',{name:new RegExp(name)}).click();await expect(slider).toHaveValue(String([90,270,368,630][i]));await expect(page.locator('h2')).toHaveText(name+'.');}
 await slider.fill('90');await expect(page.locator('.mechanism-state')).toContainText('Open');await slider.fill('270');await expect(page.locator('.mechanism-state')).not.toContainText('Open');
 await page.getByRole('checkbox',{name:'Narration'}).uncheck();await page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/}).click();await expect.poll(async()=>Number(await slider.inputValue())).toBeGreaterThan(272);
 await slider.press('End');await expect(slider).toHaveValue('720');await expect(page.getByRole('button',{name:'Play again'})).toBeVisible();await page.waitForTimeout(100);await expect(slider).toHaveValue('720');await slider.press('Home');await slider.press('ArrowRight');await expect(slider).toHaveValue('1');
});
test('rendered transformed rod and crank joints remain attached across both complete turns',async({page})=>{
 await page.goto('/');const slider=page.getByRole('slider',{name:'Crank angle'});
 for(let a=0;a<=720;a+=3){if(a===0){await slider.fill('1');}await slider.fill(String(a));const joints=await page.locator('[data-engine]').evaluate(svg=>{const p=(s:string,x:number,y:number)=>{const el=svg.querySelector(s) as SVGGraphicsElement;const q=new DOMPoint(x,y).matrixTransform(el.getCTM()!);return {x:q.x,y:q.y};};return {rodTop:p('[data-role=rod]',0,-170),piston:p('[data-role=piston]',0,0),rodBottom:p('[data-role=rod]',0,0),crankPin:p('[data-role=crank]',0,-64)};});expect(Math.hypot(joints.rodTop.x-joints.piston.x,joints.rodTop.y-joints.piston.y)).toBeLessThan(.001);expect(Math.hypot(joints.rodBottom.x-joints.crankPin.x,joints.rodBottom.y-joints.crankPin.y)).toBeLessThan(.001);}
});
test('actual media clock controls voice playback, seek, end and idle',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/}).click();await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>e.currentTime)).toBeGreaterThan(.3);
 const v=await page.evaluate(()=>({a:document.querySelector('audio')!.currentTime,d:Number(document.querySelector('[data-engine]')!.getAttribute('data-degrees'))}));expect(Math.abs(v.a*30-v.d)).toBeLessThan(3);
 await page.getByRole('button',{name:'Pause film'}).click();const from=Number(await page.getByRole('slider').inputValue());await page.waitForTimeout(150);expect(Number(await page.getByRole('slider').inputValue())).toBe(from);
 await page.getByRole('slider').fill('710');await page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/}).click();await expect(page.getByRole('button',{name:'Play again'})).toBeVisible();await expect(page.getByRole('slider')).toHaveValue('720');
});
test('missing voice continues with caption clock',async({page})=>{
 await page.route('**/narration.wav',r=>r.abort());await page.goto('/');await page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/}).click();await expect(page.getByRole('status').filter({hasText:'Voice unavailable'})).toBeVisible();await expect.poll(async()=>Number(await page.getByRole('slider').inputValue())).toBeGreaterThan(3);await page.getByRole('button',{name:'Pause film'}).click();
});
test('visible paths and labels fit canvas and labels stay inside the canvas',async({page})=>{
 await page.goto('/');for(const a of [0,90,180,270,368,450,540,630,720]){await page.getByRole('slider').fill(String(a===0?1:a));const errors=await page.locator('[data-engine]').evaluate(svg=>{
  const bbox=(e:SVGGraphicsElement)=>{const b=e.getBBox(),m=e.getCTM()!,inv=(svg as SVGSVGElement).getCTM()!.inverse();const mat=inv.multiply(m);const points=[[b.x,b.y],[b.x+b.width,b.y],[b.x,b.y+b.height],[b.x+b.width,b.y+b.height]].map(([x,y])=>new DOMPoint(x,y).matrixTransform(mat));return {x:Math.min(...points.map(p=>p.x)),y:Math.min(...points.map(p=>p.y)),r:Math.max(...points.map(p=>p.x)),b:Math.max(...points.map(p=>p.y))};};const bad:string[]=[];for(const e of svg.querySelectorAll('[data-art], [data-labels] text')){const b=bbox(e as SVGGraphicsElement);if(b.x<20||b.r>780||b.y<50||b.b>565)bad.push(e.getAttribute('data-art')??e.textContent??'');}const labels=Array.from(svg.querySelectorAll('[data-labels] text')).map(e=>bbox(e as SVGGraphicsElement));for(let i=0;i<labels.length;i++){const b=labels[i];if(b.x<560&&b.r>240&&b.y<558&&b.b>70)bad.push('label crosses engine envelope');for(let j=i+1;j<labels.length;j++){const c=labels[j];if(b.x<c.r&&b.r>c.x&&b.y<c.b&&b.b>c.y)bad.push('label collision');}}return bad;});expect(errors).toEqual([]);}
 await page.getByRole('button',{name:'Labels',exact:true}).click();await expect(page.locator('[data-labels]')).toHaveCount(0);
});
test('keyboard, reduced motion and phone layouts remain usable',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});for(const width of [1440,900,620,375]){await page.setViewportSize({width,height:900});await page.goto('/');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.getByRole('slider')).toBeVisible();for(const b of await page.getByRole('button').all()){const box=await b.boundingBox();expect(box!.height).toBeGreaterThanOrEqual(44);}for(const icon of await page.locator('button:visible svg').all()){const b=await icon.boundingBox();expect(b!.width).toBeLessThanOrEqual(24);expect(b!.height).toBeLessThanOrEqual(24);}await page.screenshot({path:`.local/pm121/layout-${width}.png`,fullPage:true});if(width<681){await expect(page.locator('.parts-bar')).toBeVisible();const sliderBox=await page.getByRole('slider').boundingBox();expect(sliderBox!.y+sliderBox!.height).toBeLessThan(900);await expect(page.locator('[data-engine]')).toHaveAttribute('viewBox','235 60 330 510');}}
 await page.getByRole('checkbox',{name:'Narration'}).uncheck();await page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/}).click();await expect(page.locator('[data-engine]')).toHaveAttribute('data-degrees','90');await page.getByRole('slider').press('End');await expect(page.getByRole('slider')).toHaveValue('720');await expect(page.locator('[data-engine]')).toHaveAttribute('data-degrees','720');
});
test('replay exposes no API or source workspace and serves bounded media',async({page,request})=>{
 const requests:string[]=[];page.on('request',r=>requests.push(r.url()));await page.goto('/');await expect(page.locator('h1')).toHaveText('Inside the engine.');expect(requests.every(u=>u.startsWith('http://127.0.0.1:41914/'))).toBe(true);for(const path of ['/.env.local','/api/explore','/docs/PRD.md'])expect((await request.get(path)).status()).toBe(404);expect((await request.post('/')).status()).toBe(405);const r=await request.get('/engine-film.mp4',{headers:{range:'bytes=0-99'}});expect(r.status()).toBe(206);expect(r.headers()['content-type']).toBe('video/mp4');expect((await r.body()).length).toBe(100);expect(film.strokes).toHaveLength(4);
});

test('held pointer reversals render immediately without a settling tail',async({page})=>{
 await page.goto('/');await page.getByRole('checkbox',{name:'Narration'}).uncheck();await page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/}).click();const slider=page.getByRole('slider'),b=(await slider.boundingBox())!;
 await page.mouse.move(b.x+b.width*.7,b.y+b.height/2);await page.mouse.down();
 for(const fraction of [.8,.2,.6,.1]){await page.mouse.move(b.x+b.width*fraction,b.y+b.height/2);const v=Number(await slider.inputValue());expect(Math.abs(v-720*fraction)).toBeLessThan(12);await expect(page.locator('[data-engine]')).toHaveAttribute('data-degrees',String(v));}
 await page.mouse.up();const end=await slider.inputValue();await page.waitForTimeout(200);await expect(slider).toHaveValue(end);await expect(page.getByRole('button',{name:/Play the cycle|Resume film|Play this stroke/})).toBeVisible();
});
test('both model-drawn poppets visibly meet the same closed seating plane',async({page})=>{
 await page.goto('/');await page.getByRole('slider').fill('270');const result=await page.locator('[data-engine]').evaluate(svg=>['intake-valve','exhaust-valve'].map(role=>{const el=svg.querySelector(`[data-role="${role}"]`)! as SVGGraphicsElement,b=el.getBBox(),m=el.transform.baseVal.consolidate()!.matrix;return {width:b.width,bottom:b.y+b.height+m.f};}));
 for(const valve of result){expect(valve.width).toBe(30);expect(valve.bottom).toBe(144);}
});

test('the counterweight and web visibly contain their shared crankshaft hub',async({page})=>{
 await page.goto('/');const connected=await page.locator('[data-engine]').evaluate(svg=>['crank-counterweight','crank-web'].map(id=>{const e=svg.querySelector(`[data-art="${id}"]`) as SVGGeometryElement;return e.isPointInFill(new DOMPoint(0,0))&&e.isPointInFill(new DOMPoint(0,10));}));expect(connected).toEqual([true,true]);
});
