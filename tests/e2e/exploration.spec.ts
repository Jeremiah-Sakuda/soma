import { test, expect, type Page, type Route } from '@playwright/test';
import { checkExploration, createExampleExploration, type ExplorationSpec } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/components/exploration-scene';

// Original synthetic scenes and scripted API responses verify the actual browser
// renderer/capture lifecycle. These checks do not establish live model quality.
const firstId = '629cdb47-2131-4c92-9e22-6900e87cba15';
function fixture(options: { id?: string; version?: number; comparison?: boolean; sourceKind?: 'example' | 'screenshot'; label?: string; longComparison?: boolean } = {}) {
  const spec = createExampleExploration(undefined, options.comparison ? 'comparison' : 'diagram-sidebar');
  if (options.longComparison && spec.mode === 'checked-bfs') { spec.input.start='g'; if(spec.comparison)spec.comparison.input.goal=null; spec.title='Compare short and complete searches.'; spec.steps=[{id:'inspect-late-comparison',caption:'Inspect the comparison after the primary search has ended.',narration:null,highlightIds:['g'],execution:'comparison',executionStep:5}]; }
  const checked = checkExploration(spec);
  const now = '2026-10-29T15:00:00.000Z';
  return { ...checked, id: options.id ?? firstId, version: options.version ?? 1, createdAt: now, updatedAt: now, question: 'Why is this node next?',
    source: { observationId: checked.spec.sources[0].observationId, version: 1, kind: options.sourceKind ?? 'example', label: options.label ?? 'Original BFS example', capturedAt: now, summary: 'Original synthetic six-node directed graph; no coursework or provider data.', uncertainty: [] as string[] },
    generation: { mode: options.comparison ? 'live' : 'prepared-example', provider: options.comparison ? 'meta' : 'none', model: options.comparison ? 'muse-spark-1.3' : null, calls: options.comparison ? 2 : 0, costUsd: 0, elapsedMs: 20, audit: options.comparison ? [{event:'source-interpreted',call:1,detail:'Original synthetic API fixture interpreted its graph.'},{event:'scene-validated',call:2,detail:'Typed scene and deterministic trace checked.'}] : [] },
    state: initialExplorationState(checked.spec), saved: false };
}
async function setup(page: Page, options: { live?: boolean; delay?: boolean; failGeneration?: boolean; longComparison?: boolean; delayResume?:boolean; uncertainSource?:boolean; delayInit?:boolean } = {}) {
  let artifacts: ReturnType<typeof fixture>[] = [], pending: Route | undefined;
  let pendingResume:{route:Route;response:unknown}|undefined;
  const initialRequests:{route:Route;response:unknown}[]=[];
  const requests: Record<string, any>[] = [];
  await page.route('**/api/explore**', async route => {
    const method = route.request().method(), url = new URL(route.request().url());
    if (method === 'GET') {
      const id = url.searchParams.get('artifactId');
      const version=url.searchParams.get('version');
      const versions=artifacts.filter(item=>item.id===id).sort((a,b)=>b.version-a.version);
      const latest=[...new Set(artifacts.map(item=>item.id))].map(id=>artifacts.filter(item=>item.id===id).sort((a,b)=>b.version-a.version)[0]);
      const response={ artifacts:latest, active: id ? version?versions.find(item=>item.version===Number(version)):versions[0] : null, versions:versions.map(item=>({id:item.id,version:item.version,title:item.spec.title,saved:item.saved,updatedAt:item.updatedAt,generationMode:item.generation.mode})), liveEnabled: options.live ?? true };
      if(!id&&options.delayInit){initialRequests.push({route,response});return;}
      if(id&&options.delayResume){pendingResume={route,response};return;}
      return route.fulfill({json:response});
    }
    const body = route.request().postDataJSON(); requests.push(body);
    if(method==='DELETE'){artifacts=artifacts.filter(item=>item.id!==body.artifactId);return route.fulfill({json:{deleted:true}});}
    if (method === 'PATCH') { const artifact = artifacts.find(item => item.id === body.artifactId&&item.version===body.version)!; artifact.state = body.state; artifact.saved = true; return route.fulfill({ json: { artifact } }); }
    if (body.action === 'cancel') return route.fulfill({ json: { cancelled: true } });
    if (body.action === 'example') { const artifact = fixture(); if(options.uncertainSource)artifact.source.uncertainty=['The arrow between A and Goal is unclear in this synthetic source.'];artifacts = [artifact]; return route.fulfill({ json: { artifact } }); }
    if (options.failGeneration) return route.fulfill({ status: 422, json: { error: 'Synthetic invalid candidate.', code: 'generation_invalid' } });
    const artifact = fixture({ id: body.artifactId ?? 'fdaf8628-6b10-4ae6-8759-74cff5d2ecb8', version: body.baseVersion ? body.baseVersion + 1 : 1, comparison: true, sourceKind: body.source ? 'screenshot' : 'example', label: body.source?.label, longComparison:options.longComparison });
    if (options.delay) { pending = route; return; }
    artifacts = [artifact, ...artifacts.filter(item => item.id !== artifact.id||item.version!==artifact.version)];
    return route.fulfill({ json: { artifact } });
  });
  await page.goto('/explore');
  await expect(page.getByRole('heading', { name: 'Make the idea visible.' })).toBeVisible();
  return { requests,completeInitialization:async()=>{await expect.poll(()=>initialRequests.length).toBeGreaterThan(0);await Promise.all(initialRequests.splice(0).map(item=>item.route.fulfill({json:item.response})));}, completeResume:async()=>{if(pendingResume)await pendingResume.route.fulfill({json:pendingResume.response});},completeDelayed: async () => { if (pending) await pending.fulfill({ json: { artifact: fixture({ comparison: true, version: 2 }) } }).catch(() => undefined); } };
}
async function example(page: Page) {
  await page.getByRole('button', { name: 'Try the original example', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Why does A come before B?', exact: true })).toBeVisible();
}
async function syntheticPng(page: Page) {
  const base64 = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 480; canvas.height = 280;
    const context = canvas.getContext('2d')!; context.fillStyle = '#ffffff'; context.fillRect(0, 0, 480, 280);
    context.fillStyle = '#17171c'; context.font = '24px sans-serif'; context.fillText('Original synthetic graph: S → A → G', 20, 100);
    return canvas.toDataURL('image/png').split(',')[1];
  });
  return { name: 'original-synthetic-graph.png', mimeType: 'image/png', buffer: Buffer.from(base64, 'base64') };
}

test('original example runs actual BFS controls, saves exact state and resumes without model inference', async ({ page }) => {
  const { requests } = await setup(page, { live: false }); await example(page);
  await expect(page.getByText('Prepared original example', { exact: true }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Next step', exact: true }).focus(); await page.keyboard.press('Enter');
  const frontier = page.getByRole('list', { name: 'First in, first out queue' });
  await expect(frontier.locator('li')).toHaveText(['NextA', '2B']);
  await page.getByRole('button', { name: 'Reverse neighbor order' }).click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(frontier.locator('li')).toHaveText(['NextB', '2A']);
  await expect(page.getByText('The inputs changed.', { exact: false })).toBeVisible();
  await page.getByText('Change a connection', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'S → A', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(frontier.locator('li')).toHaveText(['NextB']);
  await page.getByRole('button', { name: 'Node B', exact: true }).click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  const saved = requests.find(item => item.action === 'save')!;
  expect(saved.state).toMatchObject({ step: 1, reversed: true, disabledEdgeIds: ['sa'], selectedObjectId: 'b' });
  expect(requests.some(item => item.action === 'generate')).toBe(false);
  await page.reload(); await page.getByRole('button', { name: 'Why does A come before B? Version 1 · Saved' }).click();
  await expect(page.getByRole('button', { name: 'Reverse neighbor order' })).toHaveAttribute('aria-pressed', 'true');
  await expect(frontier.locator('li')).toHaveText(['NextB']);
  await expect(page.getByText('Asking about: B')).toBeVisible();
});

test('follow-up submits selected object and current experiment state and renders a distinct generated composition', async ({ page }) => {
  const { requests } = await setup(page); await example(page);
  await page.getByRole('button', { name: 'Node A', exact: true }).click();
  await page.getByRole('combobox', { name: 'Start node', exact: true }).selectOption('b');
  await page.getByLabel('Where would you like to go next?').fill('Compare the opposite neighbor order.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Same shortest distance, different tie order', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'A before B', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'B before A', exact: true })).toBeVisible();
  expect(requests.find(item => item.action === 'generate')).toMatchObject({ artifactId: firstId, baseVersion: 1, selectedObjectId: 'a', state: { start: 'b', selectedObjectId: 'a' } });
  await expect(page.getByRole('article', { name: 'Visual exploration card' }).getByText('Version 2', { exact: true })).toBeVisible();
  await page.getByText('How this card was prepared', { exact: true }).click();
  await expect(page.getByText('Typed scene and deterministic trace checked.', {exact:true})).toBeVisible();
  await expect(page.getByText('muse-spark-1.3', {exact:true})).toBeVisible();
});

test('upload stays local until Ask and transmits a bounded labeled screenshot without browser persistence', async ({ page }) => {
  const { requests } = await setup(page);
  await page.getByLabel('Upload a PNG or JPEG screenshot').setInputFiles(await syntheticPng(page));
  await expect(page.getByAltText('Your selected screenshot; captured only when requested')).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByLabel('What would you like to understand?').fill('Explain the queue in this graph.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Same shortest distance, different tie order', exact: true })).toBeVisible();
  const sent = requests.find(item => item.action === 'generate')!;
  expect(sent.source).toMatchObject({ kind: 'screenshot', label: 'Uploaded screenshot: original-synthetic-graph.png' });
  expect(sent.source.dataUrl).toMatch(/^data:image\/jpeg;base64,/); expect(sent.source.dataUrl.length).toBeLessThan(680001);
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain('data:image');
});

test('source change cancels an older request and preserves the last valid artifact', async ({ page }) => {
  const { requests, completeDelayed } = await setup(page, { delay: true }); await example(page);
  await page.getByLabel('Where would you like to go next?').fill('Compare the queue.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cancel request' })).toBeVisible();
  await page.getByLabel('Upload a PNG or JPEG screenshot').setInputFiles(await syntheticPng(page));
  await expect(page.getByText('Previous context', { exact: true })).toBeVisible();
  await completeDelayed();
  await expect(page.getByRole('heading', { name: 'Why does A come before B?', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Same shortest distance, different tie order', exact: true })).toHaveCount(0);
  await expect.poll(() => requests.filter(item => item.action === 'cancel').length).toBe(1);
  await expect(page.getByRole('button', { name: 'Explore new context', exact: true })).toBeEnabled();
});

test('an invalid generation keeps the last valid card and has a keyboard reachable recovery path', async ({ page }) => {
  await setup(page, { failGeneration: true }); await example(page);
  await page.getByLabel('Where would you like to go next?').fill('Explain that differently.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Why does A come before B?', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled();
});

test('desktop and phone preserve the diagram, text alternative, keyboard path and reduced-motion layout', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await setup(page); await example(page);
  await expect(page.getByRole('img', { name: /An original unweighted graph/ })).toBeVisible();
  await page.screenshot({ path: '.local/screenshots/exploration-desktop-1440.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.locator('#exploration-card').scrollIntoViewIfNeeded();await page.getByText('Select a node & inspect graph',{exact:true}).click();
  expect((await page.getByRole('button', { name: 'Next step', exact: true }).boundingBox())!.y).toBeLessThan(700);
  await page.getByRole('button', { name: 'Node B', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(page.getByText('Asking about: B')).toBeVisible();
  await page.getByText('Change the experiment',{exact:true}).click();await page.getByText('Search state in a table', { exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/exploration-phone-375.png', fullPage: true });
});

test('selected-window sharing sends only an explicit snapshot and Stop sharing releases the browser stream', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: async () => {
      const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 400;
      const context = canvas.getContext('2d')!; context.fillStyle = '#fff'; context.fillRect(0, 0, 640, 400);
      context.fillStyle = '#17171c'; context.font = '28px sans-serif'; context.fillText('Original synthetic shared graph S → A', 20, 100);
      const stream = canvas.captureStream(3); (window as unknown as { syntheticShare: MediaStream }).syntheticShare = stream;
      return stream;
    } });
  });
  const { requests } = await setup(page);
  await page.getByRole('button', { name: 'Share a window', exact: true }).click();
  await expect(page.getByText('Sharing selected window', { exact: true })).toBeVisible();
  expect(requests).toEqual([]);
  await page.getByLabel('What would you like to understand?').fill('Show the frontier.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Same shortest distance, different tie order', exact: true })).toBeVisible();
  expect(requests.filter(item => item.action === 'generate')).toHaveLength(1);
  expect(requests.find(item => item.action === 'generate')!.source.label).toMatch(/^Selected-window capture:/);
  expect(requests.find(item => item.action === 'generate')!.source.dataUrl).toMatch(/^data:image\/jpeg;base64,/);
  await page.getByRole('button', { name: 'Stop sharing', exact: true }).click();
  await expect(page.getByText('Sharing selected window', { exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { syntheticShare: MediaStream }).syntheticShare.getTracks().every(track => track.readyState === 'ended'))).toBe(true);
  expect(requests.filter(item => item.action === 'generate')).toHaveLength(1);
});

test('window-sharing denial keeps the typed upload path available without sending a screenshot', async ({ page }) => {
  await page.addInitScript(() => { Object.defineProperty(navigator.mediaDevices, 'getDisplayMedia', { value: async () => { throw new DOMException('Synthetic permission denial', 'NotAllowedError'); } }); });
  const { requests } = await setup(page);
  await page.getByRole('button', { name: 'Share a window', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('upload a screenshot instead');
  await expect(page.getByRole('button', { name: 'Upload screenshot', exact: true })).toBeEnabled();
  expect(requests).toEqual([]);
});

test('saved older versions remain resumable without silently replacing their exact experiment state', async ({ page }) => {
  await setup(page); await example(page);
  await page.getByRole('button',{name:'Next step',exact:true}).click();
  await page.getByRole('button',{name:'Save exploration',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved this version'})).toBeVisible();
  await page.getByLabel('Where would you like to go next?').fill('Compare a different order.');
  await page.getByRole('button',{name:'Ask Soma',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Same shortest distance, different tie order',exact:true})).toBeVisible();
  await page.getByLabel('Version history',{exact:true}).selectOption('1');
  await expect(page.getByRole('heading',{name:'Why does A come before B?',exact:true})).toBeVisible();
  await expect(page.getByRole('list',{name:'First in, first out queue'}).locator('li')).toHaveText(['NextA','2B']);
  await expect(page.getByText('You are viewing an earlier version.',{exact:false})).toBeVisible();
  await page.getByLabel('Upload a PNG or JPEG screenshot').setInputFiles(await syntheticPng(page));
  await page.getByLabel('What would you like to understand?').fill('Start a separate exploration from this screenshot.');
  await expect(page.getByRole('button',{name:'Explore new context',exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Open the latest version',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Same shortest distance, different tie order',exact:true})).toBeVisible();
});

test('comparison can advance and save beyond a shorter primary trace', async ({ page }) => {
  const {requests}=await setup(page,{longComparison:true}); await example(page);
  await page.getByLabel('Where would you like to go next?').fill('Compare a longer search.');
  await page.getByRole('button',{name:'Ask Soma',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Compare short and complete searches.',exact:true})).toBeVisible();
  for(let i=0;i<5;i++)await page.getByRole('button',{name:'Next step',exact:true}).click();
  await expect(page.getByRole('button',{name:'Next step',exact:true})).toBeDisabled();
  await expect(page.getByText('Step 5 / 5',{exact:true})).toBeVisible();
  await expect(page.getByRole('region',{name:'A before B',exact:true})).toContainText('Start: Goal · Goal: Goal');
  await expect(page.getByRole('region',{name:'B before A',exact:true})).toContainText('Start: S · Goal: All reachable nodes');
  await page.getByRole('button',{name:'Save exploration',exact:true}).click();
  await expect(page.getByRole('status').filter({hasText:'Saved this version'})).toBeVisible();
  expect(requests.find(item=>item.action==='save')!.state.step).toBe(5);
});

test('late window permission is released if an earlier sharing session is stopped before it resolves', async ({ page }) => {
  await page.addInitScript(()=>{
    let calls=0;const make=()=>{const canvas=document.createElement('canvas');canvas.width=320;canvas.height=200;canvas.getContext('2d')!.fillRect(0,0,320,200);return canvas.captureStream(1);};
    Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{
      calls++;if(calls===1)return make();
      return new Promise<MediaStream>(resolve=>{(window as any).resolveSyntheticShare=()=>{const stream=make();(window as any).lateSyntheticShare=stream;resolve(stream);};});
    }});
  });
  const {requests}=await setup(page);
  await page.getByRole('button',{name:'Share a window',exact:true}).click();
  await expect(page.getByText('Sharing selected window',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Choose another window',exact:true}).click();
  await page.getByRole('button',{name:'Stop sharing',exact:true}).click();
  await page.evaluate(()=>(window as any).resolveSyntheticShare());
  await expect.poll(()=>page.evaluate(()=>(window as any).lateSyntheticShare.getTracks().every((track:MediaStreamTrack)=>track.readyState==='ended'))).toBe(true);
  await expect(page.getByText('Sharing selected window',{exact:true})).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('exploration deletion requires explicit confirmation and clears its versions without another inference',async({page})=>{
  const {requests}=await setup(page);await example(page);
  await page.getByRole('button',{name:'Delete exploration',exact:true}).click();
  expect(requests.filter(item=>item.artifactId&&Object.keys(item).length===1)).toHaveLength(0);
  await page.getByRole('button',{name:'Keep exploration',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Why does A come before B?',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Delete exploration',exact:true}).click();
  await page.getByRole('button',{name:'Delete all versions',exact:true}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('status').filter({hasText:'Deleted this exploration'})).toBeVisible();
  await expect(page.getByRole('article',{name:'Visual exploration card'})).toHaveCount(0);
  await expect(page.getByRole('heading',{name:'A question can become an experiment.',exact:true})).toBeVisible();
  expect(requests.some(item=>item.action==='generate')).toBe(false);
});

test('a delayed resume cannot overwrite experiment controls changed while it was loading',async({page})=>{
  const {completeResume}=await setup(page,{delayResume:true});await example(page);
  await page.getByRole('button',{name:'Why does A come before B? Version 1',exact:true}).click();
  await page.getByRole('button',{name:'Next step',exact:true}).click();
  await completeResume();
  await expect(page.getByRole('status').filter({hasText:'Kept your newer experiment controls'})).toBeVisible();
  await expect(page.getByRole('list',{name:'First in, first out queue'}).locator('li')).toHaveText(['NextA','2B']);
  await expect(page.getByRole('button',{name:'Why does A come before B? Version 1',exact:true})).toBeEnabled();
});

test('source-reading uncertainty remains inspectable even when the generated explanation omits that uncertainty',async({page})=>{
  await setup(page,{uncertainSource:true});await example(page);
  await expect(page.getByText('Some source details need review.',{exact:false})).toBeVisible();
  await page.getByText('Source & assumptions',{exact:true}).click();
  await expect(page.getByRole('heading',{name:'Source reading uncertainty',exact:true})).toBeVisible();
  await expect(page.getByText('The arrow between A and Goal is unclear in this synthetic source.',{exact:true})).toBeVisible();
});

test('server actions wait for guest-session initialization while local screenshot selection stays usable',async({page})=>{
  const {requests,completeInitialization}=await setup(page,{delayInit:true});
  const exampleButton=page.getByRole('button',{name:'Try the original example',exact:true}).first();
  await expect(exampleButton).toBeDisabled();
  await exampleButton.dispatchEvent('click');
  await page.getByLabel('Upload a PNG or JPEG screenshot').setInputFiles(await syntheticPng(page));
  await expect(page.getByAltText('Your selected screenshot; captured only when requested')).toBeVisible();
  await page.getByLabel('What would you like to understand?').fill('Explain this graph.');
  await expect(page.getByRole('button',{name:'Ask Soma',exact:true})).toBeDisabled();
  expect(requests).toEqual([]);
  await completeInitialization();
  await expect(exampleButton).toBeEnabled();
  await exampleButton.click();
  await expect(page.getByRole('heading',{name:'Why does A come before B?',exact:true})).toBeVisible();
  expect(requests.map(item=>item.action)).toEqual(['example']);
});

test('diagram and question share the desktop viewport and automatic follow-ups retain the selected object',async({page})=>{
 await page.setViewportSize({width:1280,height:720});const h=await setup(page);await example(page);await page.evaluate(()=>window.scrollTo(0,0));
 const graph=await page.locator('.exploration-graph').first().boundingBox(),composer=await page.locator('.exploration-ask-card').boundingBox();expect(graph!.y).toBeLessThan(600);expect(composer!.y).toBeLessThan(250);expect(composer!.x).toBeLessThan(graph!.x);
 await page.getByRole('button',{name:'Node A',exact:true}).click();await expect(page.getByRole('combobox',{name:'Follow-up action'})).toHaveCount(0);
 await page.locator('#exploration-question').fill('Why is this next?');await page.getByRole('button',{name:'Ask Soma',exact:true}).click();await expect.poll(()=>h.requests.filter(item=>item.action==='generate').length).toBe(1);expect(h.requests.find(item=>item.action==='generate')!.intent).toBe('auto');expect(h.requests.find(item=>item.action==='generate')!.selectedObjectId).toBe('a');
});

test('bounded explanation panels render, highlight and remain usable by keyboard on desktop and phone',async({page})=>{
 await setup(page);
 const artifact=fixture(),base=artifact.spec;
 const spec:ExplorationSpec={schemaVersion:base.schemaVersion,id:base.id,version:1,title:'From examples to predictions',objective:'An illustrative processing pipeline, not a numerical simulation.',sources:base.sources,assumptions:[],uncertainty:[],unsupportedClaims:['Example values are illustrative.'],mode:'explanation',scene:{layout:'diagram-sidebar',panels:[
  {id:'pipeline',kind:'diagram',title:'Processing stages',placement:{column:1,row:1,columnSpan:2},objects:[{id:'examples',kind:'block',label:'Training examples',position:{x:0,y:.5}},{id:'predictions',kind:'block',label:'Predictions',position:{x:1,y:.5}},{id:'process',kind:'edge',from:'examples',to:'predictions',directed:true,label:'learn a relationship'}]},
  {id:'tokens',kind:'sequence',title:'Input sequence',placement:{column:1,row:2,columnSpan:1},items:[{id:'token1',label:'The'},{id:'token2',label:'sky'}]},
  {id:'matrix',kind:'matrix',title:'Example values',placement:{column:2,row:2,columnSpan:1},rows:[['1','2'],['3','4']]},
  {id:'idea',kind:'callout',title:'What to notice',placement:{column:1,row:3,columnSpan:2},text:'The model learns patterns from examples.',tone:'idea'},
 ]},steps:[{id:'first',caption:'Start with examples.',narration:'First inspect the training examples.',highlightIds:['examples'],execution:null,executionStep:null},{id:'second',caption:'Follow the relationship.',narration:'Next follow the relationship toward predictions.',highlightIds:['process','predictions','token2'],execution:null,executionStep:null}],followups:[]};
 const rich={...artifact,...checkExploration(spec),state:initialExplorationState(spec)};
 await page.route('**/api/explore',async route=>{if(route.request().method()==='POST'&&route.request().postDataJSON().action==='example')return route.fulfill({json:{artifact:rich}});return route.fallback();});
 await page.setViewportSize({width:1280,height:720});await page.getByRole('button',{name:'Try the original example',exact:true}).first().click();
 await expect(page.getByRole('heading',{name:spec.title,exact:true})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));
 await page.screenshot({path:'.local/pm040/richer-desktop.png',fullPage:true});
 await page.getByRole('button',{name:'Next explanation',exact:true}).focus();await page.keyboard.press('Enter');
 await expect(page.locator('.exploration-edge.is-highlighted')).toHaveCount(1);
 await page.getByRole('button',{name:'sky',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.getByText('Asking about: token2')).toBeVisible();
 await page.setViewportSize({width:375,height:812});await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#exploration-card').scrollIntoViewIfNeeded();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.locator('.exploration-node').first().evaluate(el=>getComputedStyle(el).transitionDuration)).toBe('0s');
 await expect(page.getByRole('table',{name:'Example values'})).toBeVisible();
 await page.screenshot({path:'.local/pm040/richer-phone.png',fullPage:true});
});
