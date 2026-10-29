import { expect, test } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';
import type { AuditRunView, AuditEventView } from '../../src/lib/domain/audit';

const at = '2026-10-26T16:00:00.000Z';
function event(seq:number,summary:string,extra:Partial<AuditEventView>={}):AuditEventView{return{seq,at,actor:'application',kind:'observation',summary,visibility:'public',protected:false,rationaleStatus:'unrecorded',...extra};}
function run(workspaceId:string,extra:Partial<AuditRunView>={}):AuditRunView{return{id:'11111111-1111-4111-8111-111111111111',workspaceId,kind:'investigation',trigger:'An assessment announcement changed',mode:'live',status:'running',contextRevision:1,sourceRefs:[{sourceId:'synthetic-announcement',version:2}],model:'synthetic-spark-test',engineVersion:'test-v1',promptVersion:'test-p1',startedAt:at,updatedAt:at,journalRevision:1,events:[event(1,'Checking the current source version.')],...extra};}

async function routes(page:import('@playwright/test').Page,workspace:ReturnType<typeof seedWorkspace>){
  await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
  await page.route('**/api/workspace',route=>route.fulfill({json:{workspace,capabilities:{spark:true,persistence:'local-synthetic',liveSources:[]}}}));
  await page.route('**/api/jobs',route=>route.fulfill({json:{jobs:[]}}));
  await page.route('**/api/adaptations',route=>route.fulfill({json:{jobs:[]}}));
}

test('read-only live journal shows repair then publication while workspace revision is unchanged',async({page})=>{
  const workspace={...seedWorkspace('synthetic-audit-progress'),mode:'account' as const};let stage=0,posts=0;
  await routes(page,workspace);
  await page.route('**/api/audit**',route=>{if(route.request().method()!=='GET')posts++;const events=[event(1,'Checking the current source version.'),...(stage>=1?[event(2,'The proposal failed reference checks. A repair was requested.',{kind:'validation'})]:[]),...(stage>=2?[event(3,'The revised activity passed checks and was saved.',{kind:'publication'}),event(4,'The newer update explicitly supersedes the syllabus.',{actor:'model',kind:'decision',rationale:'The explicit supersession applies to this assessment.',rationaleStatus:'recorded'}),event(5,'Usage reconciled.',{kind:'usage',usage:{calls:3,costUsd:0.01234,elapsedMs:4500}})]:[])];return route.fulfill({json:{workspaceId:workspace.id,runs:[run(workspace.id,{status:stage>=2?'published':'running',journalRevision:stage+1,events})]}});});
  await page.emulateMedia({reducedMotion:'reduce'});await page.setViewportSize({width:390,height:844});
  await page.goto('/?view=today');
  const history=page.getByRole('region',{name:'Soma decision history'});
  await expect(history.getByRole('status')).toHaveText('Checking the current source version.');
  await history.locator('summary').first().focus();await page.keyboard.press('Enter');
  await expect(history).toContainText('Application record · observation');
  stage=1;await expect(history).toContainText('A repair was requested.',{timeout:10000});
  stage=2;await expect(history).toContainText('The revised activity passed checks and was saved.',{timeout:10000});
  await expect(history).toContainText('Model’s stated rationale:');
  await expect(history).toContainText('estimated $0.01234');
  await expect(history).toContainText('synthetic-announcement · v2');
  expect(posts).toBe(0);expect(workspace.revision).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.local/screenshots/audit-mobile.png',fullPage:true});
  await page.setViewportSize({width:1440,height:900});
  await page.screenshot({path:'.local/screenshots/audit-desktop.png',fullPage:true});
});

test('protected diagnostic details stay withheld in view and owner-checked export; failures remain inspectable',async({page})=>{
  const workspace={...seedWorkspace('synthetic-audit-protection'),mode:'account' as const};await routes(page,workspace);
  const protectedRun=run(workspace.id,{status:'failed',events:[event(1,'Model detail protected until this activity is attempted or help is recorded.',{actor:'model',kind:'proposal',protected:true,rationaleStatus:'protected'}),event(2,'The source changed during preparation. No activity was published.',{kind:'stopped'}),event(3,'A model decision had no recorded explanation.',{actor:'model',kind:'decision',rationaleStatus:'unrecorded'})]});
  await page.route('**/api/audit**',route=>new URL(route.request().url()).searchParams.has('format')?route.fulfill({headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="soma-audit.json"'},body:JSON.stringify({run:protectedRun})}):route.fulfill({json:{workspaceId:workspace.id,runs:[protectedRun]}}));
  await page.goto('/?view=today');const history=page.getByRole('region',{name:'Soma decision history'});await history.locator('summary').first().click();await history.locator('.audit-run > summary').click();
  await expect(history).toContainText('No activity was published.');await expect(history).toContainText('Rationale not recorded.');await expect(history).toContainText('Details are withheld until an attempt or help is recorded');
  await expect(history.getByRole('link',{name:'Export this record'})).toHaveAttribute('href',`/api/audit?runId=${protectedRun.id}&format=json`);
  const [download]=await Promise.all([page.waitForEvent('download'),history.getByRole('link',{name:'Export this record'}).click()]);
  expect(download.suggestedFilename()).toMatch(/\.json$/);
  const exported=await page.evaluate(async url=>(await fetch(url)).json(),`/api/audit?runId=${protectedRun.id}&format=json`);
  expect(exported.run.events[0].rationaleStatus).toBe('protected');expect(JSON.stringify(exported)).not.toContain('secret diagnostic answer');
});

test('a delayed journal from the old account cannot appear after sign-in to another account',async({page})=>{
  const first={...seedWorkspace('synthetic-audit-account-a'),mode:'account' as const},second={...seedWorkspace('synthetic-audit-account-b'),mode:'account' as const};
  let account:'a'|'b'|null='a',heldRead=false;let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});
  await routes(page,first);
  await page.route('https://identitytoolkit.googleapis.com/**',route=>route.fulfill({json:{idToken:'synthetic-test-token-never-valid'}}));
  await page.route('**/api/auth/session',route=>{if(route.request().method()==='DELETE')account=null;if(route.request().method()==='POST')account='b';return route.fulfill({json:{authenticated:!!account,accountWorkspaceAvailable:true}});});
  await page.route('**/api/workspace',route=>route.fulfill({json:{workspace:account==='b'?second:first,capabilities:{spark:false,persistence:'local-synthetic',liveSources:[]}}}));
  await page.route('**/api/audit**',async route=>{const previous=account==='a';if(previous){heldRead=true;await hold;}await route.fulfill({json:{workspaceId:previous?first.id:second.id,runs:[run(previous?first.id:second.id,{trigger:previous?'Old account private audit':'New account audit',status:'unchanged'})]}}).catch(()=>{});});
  await page.goto('/?view=today');await expect.poll(()=>heldRead).toBe(true);
  await page.getByRole('button',{name:'Workspace menu'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('synthetic-b@example.test');await page.getByLabel('Password',{exact:true}).fill('synthetic-fixture-password');await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
  await expect(page.getByRole('heading',{name:'Your private account'})).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  release();const history=page.getByRole('region',{name:'Soma decision history'});await history.locator('summary').first().click();await expect(history).toContainText('New account audit');await expect(page.getByText('Old account private audit',{exact:true})).toHaveCount(0);
});

test('older pages remain visible during live refresh and reset on an account change',async({page})=>{
  const first={...seedWorkspace('synthetic-audit-pages-a'),mode:'account' as const},second={...seedWorkspace('synthetic-audit-pages-b'),mode:'account' as const};
  let account:'a'|'b'|null='a',newest=false,pageReads=0;
  await routes(page,first);
  await page.route('https://identitytoolkit.googleapis.com/**',route=>route.fulfill({json:{idToken:'synthetic-test-token-never-valid'}}));
  await page.route('**/api/auth/session',route=>{if(route.request().method()==='DELETE')account=null;if(route.request().method()==='POST')account='b';return route.fulfill({json:{authenticated:!!account,accountWorkspaceAvailable:true}});});
  await page.route('**/api/workspace',route=>route.fulfill({json:{workspace:account==='b'?second:first,capabilities:{spark:false,persistence:'local-synthetic',liveSources:[]}}}));
  await page.route('**/api/audit**',route=>{
    const cursor=new URL(route.request().url()).searchParams.get('cursor');if(cursor)pageReads++;
    const owner=account==='b'?second:first;
    const record=run(owner.id,{id:cursor?'33333333-3333-4333-8333-333333333333':newest?'22222222-2222-4222-8222-222222222222':'11111111-1111-4111-8111-111111111111',trigger:account==='b'?'Only account B history':cursor?'Older account A history':newest?'Newly saved account A history':'Latest account A history',status:'unchanged',startedAt:cursor?'2026-10-25T12:00:00.000Z':newest?'2026-10-26T17:00:00.000Z':at});
    return route.fulfill({json:{workspaceId:owner.id,runs:[record],...(!cursor&&account==='a'?{nextCursor:'synthetic-owned-cursor'}:{})}});
  });
  await page.goto('/?view=today');let history=page.getByRole('region',{name:'Soma decision history'});
  await history.locator('summary').first().click();await history.getByRole('button',{name:'Load older runs',exact:true}).click();
  await expect(history).toContainText('Older account A history');newest=true;
  await history.getByRole('button',{name:'Refresh activity',exact:true}).click();
  await expect(history).toContainText('Newly saved account A history');await expect(history).toContainText('Older account A history');await expect(history).toContainText('Latest account A history');expect(pageReads).toBe(1);
  await expect(history.getByRole('link',{name:'Export latest 30 runs'})).toHaveAttribute('href','/api/audit?format=json');
  await page.getByRole('button',{name:'Workspace menu'}).click();await page.getByRole('button',{name:'Sign out',exact:true}).click();
  await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.getByLabel('Email',{exact:true}).fill('synthetic-b@example.test');await page.getByLabel('Password',{exact:true}).fill('synthetic-fixture-password');await page.getByRole('button',{name:'Sign in',exact:true}).last().click();
  await expect(page.getByRole('heading',{name:'Your private account'})).toBeVisible();await page.getByRole('button',{name:'Close dialog',exact:true}).click();
  history=page.getByRole('region',{name:'Soma decision history'});await history.locator('summary').first().click();await expect(history).toContainText('Only account B history');await expect(history.getByRole('button',{name:'Load older runs',exact:true})).toHaveCount(0);await expect(page.getByText('Older account A history',{exact:true})).toHaveCount(0);
});
