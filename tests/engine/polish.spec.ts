import {test,expect} from '@playwright/test';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readFileSync} from 'node:fs';
import {EngineFilmFrame} from '../../docs/examples/pm123/EngineFilmFrame';
import {presentFilm,validatePresentation} from '../../docs/examples/pm123/presentation';
import {validateEngine} from '../../docs/examples/pm121/lib/engine';
const base=validateEngine(JSON.parse(readFileSync('docs/examples/pm121/film.json','utf8'))),presentation=validatePresentation(JSON.parse(readFileSync('docs/examples/pm123/presentation.json','utf8')),base),film=validateEngine(presentFilm(base,presentation));
test('direct crank dragging unwraps two full turns, reverses and stops exactly',async({page})=>{
 await page.goto('/');const project=async(a:number)=>page.locator('[data-engine]').evaluate((svg,a)=>{const q=new DOMPoint(400+94*Math.sin(a*Math.PI/180),450-94*Math.cos(a*Math.PI/180)).matrixTransform((svg as SVGSVGElement).getScreenCTM()!);return {x:q.x,y:q.y};},a);
 const start=await project(0);await page.mouse.move(start.x,start.y);await page.mouse.down();
 for(let a=30;a<=720;a+=30){const q=await project(a);await page.mouse.move(q.x,q.y);expect(Number(await page.getByRole('slider').inputValue())).toBeCloseTo(a,0);}
 for(const a of [690,660,630]){const q=await project(a);await page.mouse.move(q.x,q.y);expect(Number(await page.getByRole('slider').inputValue())).toBeCloseTo(a,0);}
 await page.mouse.up();await page.waitForTimeout(120);await expect(page.getByRole('slider')).toHaveValue('630');await expect(page.locator('h2')).toHaveText('Exhaust.');
});
test('part inspection interrupts voice, preserves pose and restores keyboard focus',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:/Play the cycle|Resume film/}).click();await expect.poll(()=>page.locator('audio').evaluate((e:HTMLAudioElement)=>e.currentTime)).toBeGreaterThan(.15);
 await page.getByRole('button',{name:'02 Connecting Rod',exact:true}).click();await expect(page.locator('h2')).toHaveText('Connecting Rod');expect(await page.locator('audio').evaluate((e:HTMLAudioElement)=>e.paused)).toBe(true);
 const before=await page.getByRole('slider').inputValue();await page.waitForTimeout(120);await expect(page.getByRole('slider')).toHaveValue(before);await page.getByRole('slider').fill('450');await expect(page.locator('[data-engine]')).toHaveAttribute('data-selected','rod');
 await page.getByRole('button',{name:'Back to cycle',exact:true}).click();await expect(page.locator('h2')).toHaveText('Power.');await expect(page.locator('#part-rod')).toBeFocused();
 await page.locator('#part-piston').click();await page.keyboard.press('Escape');await expect(page.locator('#part-piston')).toBeFocused();await expect(page.locator('[data-engine]')).toHaveAttribute('data-selected','none');
});
test('space shortcut respects focused controls and source disclosure opens directly',async({page})=>{
 await page.goto('/');await page.getByRole('checkbox',{name:'Narration'}).uncheck();await page.locator('h1').click();await page.keyboard.press('Space');await expect(page.getByRole('button',{name:'Pause film'})).toBeVisible();await page.keyboard.press('Space');await expect(page.getByRole('button',{name:/Play the cycle|Resume film/})).toBeVisible();
 await page.getByRole('slider').focus();const value=await page.getByRole('slider').inputValue();await page.keyboard.press('Space');await expect(page.getByRole('slider')).toHaveValue(value);await expect(page.getByRole('button',{name:/Play the cycle|Resume film/})).toBeVisible();
 await page.getByRole('link',{name:'About this study'}).click();await expect(page.locator('#about')).toHaveAttribute('open','');await expect(page.locator('#about>summary')).toBeFocused();
});
test('full-HD film typography stays in frame for all four strokes',async({page})=>{
 await page.setViewportSize({width:1920,height:1080});for(const a of [90,270,450,630]){
  await page.setContent(renderToStaticMarkup(createElement(EngineFilmFrame,{film,degrees:a})));const errors=await page.locator('svg').first().evaluate(svg=>Array.from(svg.querySelectorAll('text')).flatMap(e=>{const b=e.getBoundingClientRect();return b.x<20||b.y<15||b.right>1900||b.bottom>1065?[e.textContent]:[];}));expect(errors).toEqual([]);
 }
});
test('primary desktop controls fit the target viewport and phone crank sits next to the drawing',async({page})=>{
 for(const [width,height]of [[1280,800],[1440,900],[620,900],[375,900]]){
  await page.setViewportSize({width,height});await page.goto('/');const box=(await page.getByRole('slider').boundingBox())!;expect(box.y+box.height).toBeLessThan(height);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('slider').fill('425');await page.screenshot({path:`.local/pm123/final-${width}.png`,fullPage:true});
 }
});
test('small interface text retains readable contrast in each stroke',async({page})=>{
 await page.goto('/');for(const name of ['Intake','Compression','Power','Exhaust']){
  await page.getByRole('group',{name:'Engine strokes'}).getByRole('button',{name:new RegExp(name)}).click();
  const failures=await page.evaluate(()=>{
   const rgb=(value:string)=>{const n=value.match(/[\d.]+/g)?.map(Number)??[];return {v:n.slice(0,3),a:n[3]??1};};
   const lum=(v:number[])=>v.map(c=>{const s=c/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;}).reduce((sum,c,i)=>sum+c*[.2126,.7152,.0722][i],0);
   return Array.from(document.querySelectorAll('.eyebrow,.phase-verb,.steps button,.parts-bar button,.parts-bar button span,.voice,.intro>p,.drawing-title,.label-toggle,.drawing-bottom span,.step-number,.parts-hint,.recording,.key-hint')).flatMap(e=>{
    if(!(e as HTMLElement).getBoundingClientRect().height)return [];const fg=rgb(getComputedStyle(e).color);let p:Element|null=e,bg={v:[247,246,242],a:1};while(p){const c=rgb(getComputedStyle(p).backgroundColor);if(c.a===1){bg=c;break;}p=p.parentElement;}
    const a=lum(fg.v),b=lum(bg.v),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);return ratio<4.5?[{text:e.textContent?.trim(),ratio}]:[];
   });
  });expect(failures).toEqual([]);
 }
});
