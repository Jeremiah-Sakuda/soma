import { test, expect, type Page } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';
async function scenario(page:Page,label:string){await page.getByRole('button',{name:'Workspace menu'}).click();await page.getByRole('button',{name:'Try a synthetic change',exact:true}).click();await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();}
test('a reused request opens the selected saved lesson even behind a newer lesson', async ({ page }) => {
 const workspace=seedWorkspace('cached-navigation');
 workspace.lessons.unshift({...workspace.lessons[0],id:'newer-parallel',title:'A different saved parallel lesson'});
 const result={workspace,capabilities:{spark:true,persistence:'local-synthetic',liveSources:[]},selectedLessonId:'parallel-nodes'};
 // Isolate the API response contract: this case must not call a model provider.
 await page.route('**/api/audit**', route => route.fulfill({ json: { workspaceId: workspace.id, runs: [] } }));
 await page.route('**/api/workspace',route=>route.fulfill({json:result}));
 await page.route('**/api/actions',route=>route.fulfill({json:result}));
 await page.goto('/?demo=1');await page.getByRole('button',{name:'Request a lesson',exact:true}).click();
 await page.getByLabel('What would you like to explore?').fill('Explain parallel branch currents');
 await page.getByRole('button',{name:'Prepare a lesson',exact:true}).click();
 await expect(page).toHaveURL(/lesson=parallel-nodes/);
 await expect(page.getByRole('heading',{name:'Same voltage. Different currents.',exact:true})).toBeVisible();
});
test('Ready Card prediction, deterministic controls, fresh attempt and revisit persist',async({page})=>{
 await page.setViewportSize({width:1440,height:900});await page.goto('/?demo=1');
 const open=page.getByRole('button',{name:'Open lesson',exact:true});await expect(open).toBeVisible();expect((await open.boundingBox())!.y).toBeLessThan(850);
 await page.screenshot({path:'.local/screenshots/ready-today-desktop.png',fullPage:true});await open.click();
 await expect(page.getByRole('table')).toBeVisible();await expect(page.getByText('Preview, not checked')).toBeVisible();
 await page.locator('.predict-options').getByRole('radio').nth(1).check();await page.getByRole('button',{name:'Save prediction',exact:true}).click();await expect(page.getByText('Your original prediction')).toBeVisible();
 await page.getByRole('button',{name:'Double R₂ and see'}).click();await expect(page.getByText('Your prediction matched.')).toBeVisible();await expect(page.getByRole('spinbutton',{name:'Resistance R₂'})).toHaveValue('6');
 await page.getByRole('spinbutton',{name:'Supply voltage'}).fill('18');await expect(page.getByText('Saving your circuit…')).toHaveCount(0);await expect(page.getByRole('table').getByRole('row').nth(1)).toContainText('3 A');
 await page.screenshot({path:'.local/screenshots/ready-study-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Try a fresh question',exact:true}).click();await expect(page.getByText('Fresh application · no diagram')).toBeVisible();await expect(page.getByRole('table')).toHaveCount(0);
 await page.locator('.answer-options').getByRole('radio').first().check();await page.getByRole('button',{name:'Check my thinking'}).click();await expect(page.locator('.feedback-box')).toBeVisible();
 await page.reload();await page.getByText(/Your learning record · 1 response/).click();await expect(page.getByText('Your response:',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Good',exact:true}).click();await expect(page.getByText(/Rated “Good”/)).toBeVisible();
 await page.goto('/?view=study&lesson=parallel-nodes');await expect(page.getByRole('spinbutton',{name:'Supply voltage'})).toHaveValue('18');await page.getByRole('spinbutton',{name:'Supply voltage'}).fill('19');await page.getByRole('button',{name:'Pause & save'}).click();await open.click();await expect(page.getByRole('spinbutton',{name:'Supply voltage'})).toHaveValue('19');
});
test('commitments change session contents, preserve sources and allow internal correction',async({page})=>{
 await page.goto('/?demo=1');await scenario(page,'An interview overlaps your focus window');await expect(page.getByRole('button',{name:'20 min',exact:true})).toHaveAttribute('aria-pressed','true');
 await expect(page.getByText('25 minutes remain for another session:',{exact:false})).toBeVisible();await page.getByRole('button',{name:'45 min',exact:true}).click();await expect(page.getByText('This choice is longer than the 20 available minutes.',{exact:false})).toBeVisible();
 await page.locator('.change-entry').first().locator('summary').click();await expect(page.getByRole('heading',{name:'Before',exact:true})).toBeVisible();await page.getByRole('button',{name:/Correct .*interview/i}).first().click();await page.getByLabel('Status',{exact:true}).selectOption('cancelled');await page.getByLabel('What needs correcting?').fill('This interview was cancelled by the organizer.');await page.getByRole('button',{name:'Save correction',exact:true}).click();await expect(page.getByText('Corrected Soma’s internal commitment.',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Request a lesson',exact:true}).click();await page.getByLabel('What would you like to explore?').fill('How does a series resistor circuit work?');await page.getByRole('button',{name:'Prepare a lesson',exact:true}).click();await expect(page).toHaveURL(/lesson=series-contrast/);
 await scenario(page,'A source is corrected');await expect(page.getByText('Source context changed.',{exact:false})).toBeVisible();await scenario(page,'A source becomes unavailable');await expect(page.getByRole('button',{name:/stale source/})).toBeVisible();await scenario(page,'Source access returns');await expect(page.getByRole('button',{name:/stale source/})).toHaveCount(0);
});
test('separate sessions isolate attempts and reject ownership and cross-origin injection',async({browser,baseURL})=>{
 const first=await browser.newContext(),second=await browser.newContext();const a=first.request,b=second.request;
 const one=await(await a.get(`${baseURL}/api/workspace`)).json(),two=await(await b.get(`${baseURL}/api/workspace`)).json();expect(one.workspace.id).not.toBe(two.workspace.id);
 expect((await a.post(`${baseURL}/api/actions`,{headers:{Origin:baseURL!},data:{type:'attempt',lessonId:'parallel-nodes',optionIndex:0}})).status()).toBe(200);expect((await(await b.get(`${baseURL}/api/workspace`)).json()).workspace.attempts).toHaveLength(0);
 expect((await a.post(`${baseURL}/api/actions`,{headers:{Origin:baseURL!},data:{type:'preference',workspaceId:two.workspace.id,sessionMinutes:45}})).status()).toBe(400);
 expect((await a.post(`${baseURL}/api/actions`,{headers:{Origin:'https://outside.example'},data:{type:'preference',sessionMinutes:45}})).status()).toBe(403);await first.close();await second.close();
});
test('mobile keyboard, source disclosure and reduced-motion layout remain usable',async({page})=>{
 await page.setViewportSize({width:360,height:800});await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/?view=study&lesson=parallel-nodes');
 const slider=page.getByRole('slider',{name:'Supply voltage slider'});await slider.focus();await page.keyboard.press('ArrowRight');await expect(page.getByRole('spinbutton',{name:'Supply voltage'})).toHaveValue('13');
 await page.getByRole('button',{name:'Series',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('button',{name:'Series',exact:true})).toHaveAttribute('aria-pressed','true');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.screenshot({path:'.local/screenshots/ready-study-mobile.png',fullPage:true});await page.getByRole('button',{name:'Workspace menu'}).focus();await page.keyboard.press('Enter');await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('button',{name:'Your sources',exact:true}).click();await expect(page.getByRole('heading',{name:'Your sources',exact:true})).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.getByRole('button',{name:'Back to today'}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);await page.screenshot({path:'.local/screenshots/ready-today-mobile.png',fullPage:true});
 for(const size of [{width:390,height:844},{width:844,height:390}]){await page.setViewportSize(size);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);}
});
test('changing other inputs preserves the original prediction without judging it',async({page})=>{
 await page.goto('/?view=study&lesson=parallel-nodes');await page.locator('.predict-options').getByRole('radio').nth(1).check();await page.getByRole('button',{name:'Save prediction',exact:true}).click();await page.getByRole('spinbutton',{name:'Supply voltage'}).fill('18');await page.getByRole('spinbutton',{name:'Resistance R₂'}).fill('6');await expect(page.getByText('Other inputs changed',{exact:true})).toBeVisible();await expect(page.getByText('Your prediction matched.')).toHaveCount(0);await expect(page.getByText('Your original prediction')).toBeVisible();await page.getByRole('button',{name:'Leave it for later'}).click();await expect(page.getByText('Fresh question saved for later.')).toBeVisible();await page.getByRole('button',{name:'Courses',exact:true}).click();await page.locator('.lesson-row').filter({hasText:'Fresh question'}).first().click();await expect(page.getByText('Fresh application · no diagram')).toBeVisible();await page.locator('.answer-options').getByRole('radio').first().check();await page.getByRole('button',{name:'Check my thinking'}).click();await expect(page.locator('.feedback-box')).toBeVisible();
});
