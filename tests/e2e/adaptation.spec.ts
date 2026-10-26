import { expect, test } from '@playwright/test';
import { adaptationFixture } from '../fixtures/adaptation';
import { applyAction } from '../../src/lib/domain/learning';
import type { AdaptationSummary } from '../../src/lib/server/adaptation-jobs';

test('saved diagnostic queues automatic follow-up, survives reload, and offers the published activity without a reconsider click', async ({ page }) => {
  let workspace = adaptationFixture('browser-automatic-follow-up'), jobs: AdaptationSummary[] = [], investigations = 0;
  const capabilities = { spark: true, persistence: 'local-synthetic', liveSources: [] };
  const reply = () => ({ workspace, capabilities });
  await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
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
