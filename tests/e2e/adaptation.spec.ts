import { expect, test } from '@playwright/test';
import { adaptationFixture } from '../fixtures/adaptation';
import { applyAction } from '../../src/lib/domain/learning';
import type { AdaptationSummary } from '../../src/lib/server/adaptation-jobs';

test('saved diagnostic queues automatic follow-up, survives reload, and offers the published activity without a reconsider click', async ({ page }) => {
  let workspace = adaptationFixture('browser-automatic-follow-up'), jobs: AdaptationSummary[] = [], investigations = 0;
  const capabilities = { spark: true, persistence: 'local-synthetic', liveSources: [] };
  const reply = () => ({ workspace, capabilities });
  await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
  await page.route('**/api/audit**', route => route.fulfill({ json: { workspaceId: workspace.id, runs: [] } }));
  await page.route('**/api/workspace',route=>route.fulfill({json:reply()}));
  await page.route('**/api/jobs',route=>route.fulfill({json:{jobs:[]}}));
  await page.route('**/api/adaptations',route=>route.fulfill({json:{jobs}}));
  await page.route('**/api/investigations',route=>{investigations++;return route.fulfill({status:500,json:{error:'The browser must not trigger inference.'}});});
  await page.route('**/api/actions',route=>{
    const action=route.request().postDataJSON(); workspace=applyAction(workspace,action);
    if(action.type==='attempt'){const attempt=workspace.attempts.at(-1)!;jobs=[{id:'a'.repeat(64),attemptId:attempt.id,lessonId:attempt.lessonId,status:'queued',createdAt:attempt.createdAt,updatedAt:attempt.createdAt}];}
    return route.fulfill({json:reply()});
  });
  await page.emulateMedia({reducedMotion:'reduce'}); await page.setViewportSize({width:390,height:844});
  await page.goto('/?view=study&lesson=original-adaptive-question');
  await page.locator('.answer-options input').first().focus(); await page.keyboard.press('Space');
  await page.getByRole('button',{name:'Check my thinking',exact:true}).click();
  await expect(page.getByRole('region',{name:'Automatic follow-up'})).toContainText('queued automatically');
  expect(investigations).toBe(0); const original=structuredClone(workspace.attempts[0]);
  await page.reload(); await expect(page.getByRole('region',{name:'Automatic follow-up'})).toContainText('queued automatically');
  // Synthetic worker publication; browser transports are stubbed, reducer evidence is actual.
  const next={...workspace.lessons[0],id:'worker-next-activity',title:'A new source-supported comparison',diagnosticInvestigationId:'worker-reconsideration'};
  workspace={...workspace,revision:workspace.revision+1,lessons:[next,...workspace.lessons],recommendedLessonId:next.id,investigations:[...workspace.investigations!,{...workspace.investigations![0],id:'worker-reconsideration',supersedesId:workspace.investigations![0].id,attemptIds:[original.id],diagnosticLessonId:undefined,diagnosticPlan:undefined}]};
  jobs=[{...jobs[0],status:'ready',selectedLessonId:next.id,notice:'Soma reconsidered your response. A supported next activity is ready.'}];
  await expect(page.getByRole('button',{name:'Open next activity',exact:true})).toBeVisible({timeout:10000});
  await page.getByRole('button',{name:'Today',exact:true}).click();
  await expect(page.locator('.ready-card')).toContainText(next.title);
  await page.getByRole('button',{name:'Open next activity',exact:true}).click();
  await expect(page).toHaveURL(/lesson=worker-next-activity/);
  expect(workspace.attempts[0]).toEqual(original); expect(investigations).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

for(const origin of ['reload','adaptation'] as const){
  test(`a delayed ${origin} workspace response cannot replace a newer saved preference`,async({page})=>{
    let workspace=adaptationFixture(`monotonic-${origin}`),reads=0,heldRead=false,delayedReturned=false;
    const capabilities={spark:true,persistence:'local-synthetic',liveSources:[]};
    let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});
    await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
    await page.route('**/api/jobs',route=>route.fulfill({json:{jobs:[]}}));
    await page.route('**/api/adaptations',route=>route.fulfill({json:{jobs:origin==='adaptation'?[{id:'a'.repeat(64),attemptId:'pending-old-result',lessonId:workspace.lessons[0].id,status:'ready'}]:[]}}));
    await page.route('**/api/audit**', route => route.fulfill({ json: { workspaceId: workspace.id, runs: [] } }));
    await page.route('**/api/workspace',async route=>{
      const snapshot=structuredClone(workspace);
      const delayed=++reads===2;if(delayed){heldRead=true;await held;}
      await route.fulfill({json:{workspace:snapshot,capabilities}});if(delayed)delayedReturned=true;
    });
    await page.route('**/api/actions',route=>{workspace=applyAction(workspace,route.request().postDataJSON());return route.fulfill({json:{workspace,capabilities}});});
    await page.goto('/?view=today');
    await expect(page.getByRole('button',{name:'Workspace menu'})).toBeVisible();
    if(origin==='reload')await page.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate')));
    await expect.poll(()=>heldRead).toBe(true);
    await page.getByRole('button',{name:'Workspace menu'}).click();
    await page.getByRole('button',{name:'Your preferences',exact:true}).click();
    const preference=page.getByLabel('Preferred session length');
    await preference.selectOption('45');await expect(preference).toHaveValue('45');
    const latest=workspace.revision;release();
    await expect.poll(()=>delayedReturned).toBe(true);
    await page.evaluate(()=>new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve()))));
    await page.getByRole('button',{name:'Close dialog',exact:true}).click();
    await page.getByRole('button',{name:'Workspace menu'}).click();
    await page.getByRole('button',{name:'Your preferences',exact:true}).click();
    await expect(preference).toHaveValue('45');expect(workspace.revision).toBe(latest);
  });
}
