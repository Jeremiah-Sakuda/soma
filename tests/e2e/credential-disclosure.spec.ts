import {test,expect} from '@playwright/test';
import {seedEmptyAccountWorkspace} from '../../src/lib/domain/seed';

test('hosted browser trust is explained before credential entry and login links stay transient',async({page})=>{
 const workspace=seedEmptyAccountWorkspace('synthetic-credential-disclosure');let starts=0;
 await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
 await page.route('**/api/workspace',route=>route.fulfill({json:{workspace,capabilities:{spark:false,persistence:'firestore',liveSources:[]}}}));
 await page.route('**/api/audit**',route=>route.fulfill({json:{workspaceId:workspace.id,runs:[]}}));
 await page.route('**/api/jobs',route=>route.fulfill({json:{jobs:[]}}));
 await page.route('**/api/adaptations',route=>route.fulfill({json:{jobs:[]}}));
 await page.route('**/api/connectors/google/status',route=>route.fulfill({json:{configured:false,providers:{gmail:false,calendar:false},connections:[]}}));
 await page.route('**/api/connectors/browser',route=>{
  if(route.request().method()==='POST'){starts++;return route.fulfill({json:{loginUrl:'https://www.browserbase.com/synthetic-control-link',expiresAt:'2026-10-28T12:00:00Z'}});}
  return route.fulfill({json:{configured:true,providers:[{provider:'blackboard',label:'BU Blackboard',homeUrl:'https://learn.bu.edu/'}]}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Workspace menu'}).click();
 await page.locator('summary').filter({hasText:'Connect course sites, Gmail and Calendar'}).click();
 await expect(page.getByText('Sign in through a browser hosted by Browserbase, separate from your everyday browser.',{exact:false})).toBeVisible();
 await expect(page.getByText('Browserbase retains sensitive browser state, including cookies and site storage.',{exact:false})).toBeVisible();
 expect(starts).toBe(0);
 await page.getByRole('button',{name:'Connect BU Blackboard',exact:true}).click();
 const link=page.getByRole('link',{name:'Open secure login window',exact:true});
 await expect(link).toHaveAttribute('rel','noopener noreferrer');
 await expect(link).toHaveAttribute('target','_blank');
 expect(await page.evaluate(()=>JSON.stringify({...localStorage,...sessionStorage}))).not.toContain('synthetic-control-link');
 await page.reload();await page.getByRole('button',{name:'Workspace menu'}).click();
 await expect(page.locator('a[href*="synthetic-control-link"]')).toHaveCount(0);
});

 test('an interrupted deletion can resume after refresh without opening a new workspace',async({page})=>{
  let reads=0,deletions=0;
  await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
  await page.route('**/api/workspace',route=>{
   if(route.request().method()==='DELETE'){deletions++;return route.fulfill(deletions===1?{status:503,json:{error:'Temporary cleanup failure'}}:{json:{deleted:true}});}
   reads++;return route.fulfill({status:409,json:{error:'Workspace deletion is still in progress.',code:'deletion_pending'}});
  });
  await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/');await expect(page.getByRole('heading',{name:'Finish deleting your workspace'})).toBeVisible();
  await page.getByRole('button',{name:'Retry cleanup and deletion'}).focus();await page.keyboard.press('Enter');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('protected cleanup references are retained');
  await page.reload();await expect(page.getByRole('heading',{name:'Finish deleting your workspace'})).toBeVisible();
  expect(reads).toBe(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:'.local/screenshots/credential-deletion-recovery-390.png',fullPage:true});
  await page.getByRole('button',{name:'Retry cleanup and deletion'}).click();
  await expect(page.getByRole('heading',{name:"Understand what's on your screen.",exact:true})).toBeVisible();
  expect(reads).toBe(2);expect(deletions).toBe(2);
 });
