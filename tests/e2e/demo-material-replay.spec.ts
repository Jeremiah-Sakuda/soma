import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { ExplorationArtifact } from '../../src/lib/server/exploration-types';
// Actual retained model output rendered without a new inference call. Persistence is verified separately by the live harness.
test.use({launchOptions:{args:['--enable-unsafe-swiftshader']}});
const directory=process.env.SOMA_DEMO_REPLAY;
test.skip(!directory,'Requires private actual demo outputs.');
for(const name of ['dsa-first','dsa-next','speaker-first','speaker-next','music-first'])for(const width of [1280,620,375])test(`${name} actual output at ${width}px`,async({page},info)=>{
 const file=join(directory??'',`${name}.json`);test.skip(!existsSync(file),'This candidate did not publish; no substitute artifact.');
 const artifact=JSON.parse(readFileSync(file,'utf8')) as ExplorationArtifact;
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:width===620?704:900});await page.emulateMedia({reducedMotion:'reduce'});
 await page.route(/\/api\/explore(?:\?.*)?$/,route=>route.request().method()==='GET'?route.fulfill({json:{active:artifact,artifacts:[artifact],versions:[],liveEnabled:false}}):route.fallback());
 await page.goto('/explore');await page.locator('.exploration-library button').first().click();
 await expect(page.locator('#exploration-card')).toBeVisible();
 await page.locator('#exploration-card').screenshot({path:info.outputPath(`${name}-${width}-initial.png`)});
 if(name.startsWith('speaker')){
  await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered','true');
  await page.getByRole('slider',{name:'Separate parts',exact:true}).fill('0.55');
  await page.getByRole('slider',{name:'Cutaway',exact:true}).fill('0.2');
  await page.getByRole('button',{name:'Side',exact:true}).click();
 }
 if(name.startsWith('dsa')){
  await page.getByRole('button',{name:'Next step',exact:true}).click();
  await page.getByRole('button',{name:'Next step',exact:true}).click();
  await page.locator('#exploration-card').screenshot({path:info.outputPath(`${name}-${width}-step2-2d.png`)});
  await page.getByRole('button',{name:'3D workspace',exact:true}).click();
  await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered','true');
 }
 await page.locator('#exploration-card').screenshot({path:info.outputPath(`${name}-${width}.png`)});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
 expect(errors).toEqual([]);
});
