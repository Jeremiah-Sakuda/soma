import { expect, test } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { prepareLearningGraphPreview } from '../../src/lib/domain/learning-preview';
import { reconcileLearningGraph } from '../../src/lib/domain/learning-graph';
import { applyAction } from '../../src/lib/domain/learning';

for (const width of [1440, 390]) test(`linked learning inspection saves support before disclosure at ${width}px`, async ({ page }) => {
  const before = seedWorkspace(`inspection-${width}`);
  let workspace = reconcileLearningGraph(before, prepareLearningGraphPreview(structuredClone(before), '2026-10-27T16:00:00.000Z'));
  const id = 'graph-preview-parallel', initial = workspace.investigations![0], claim = initial.diagnosticPlan!.hypotheses[0].claim;
  let rejectSupport = true;
  const reply = () => ({ workspace, capabilities: { spark: false, persistence: 'local-synthetic', liveSources: [] } });
  await page.route('**/api/audit**', route => route.fulfill({json:{workspaceId:workspace.id,runs:[]}}));
  await page.route('**/api/workspace', route => route.fulfill({json:reply()}));
  await page.route('**/api/actions', route => {
    const action = route.request().postDataJSON();
    if (action.type === 'assistance' && rejectSupport) return route.fulfill({status:503,json:{error:'Synthetic support save unavailable.'}});
    workspace = applyAction(workspace, action);
    return route.fulfill({json:reply()});
  });
  await page.emulateMedia({reducedMotion:'reduce'}); await page.setViewportSize({width,height:900});
  await page.goto(`/?view=study&lesson=${id}`);
  const panel = page.getByRole('region',{name:'What Soma is checking'});
  await expect(panel).toBeVisible(); await expect(panel.getByText(claim,{exact:true})).toHaveCount(0);
  const inspect = panel.getByRole('button',{name:'Inspect explanations and evidence'});
  await inspect.focus(); await page.keyboard.press('Enter');
  await expect(panel.getByRole('alert')).toContainText('remain closed');
  await expect(panel.getByText(claim,{exact:true})).toHaveCount(0);
  expect(workspace.assistance[id] ?? []).toHaveLength(0);
  rejectSupport = false; await inspect.focus(); await page.keyboard.press('Enter');
  await expect(panel.getByRole('heading',{name:claim,exact:true})).toBeVisible();
  expect(workspace.assistance[id].some(item=>item.includes('explanation'))).toBe(true);
  await expect(panel.getByRole('table')).toContainText('1 A');
  const evidence = panel.locator('summary').filter({hasText:'Supporting evidence:'}).first();
  await evidence.focus(); await page.keyboard.press('Enter');
  await expect(panel.getByRole('blockquote').first()).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:`.local/screenshots/learning-inspection-${width}.png`,fullPage:true});
  await page.reload();
  await expect(panel.getByText(claim,{exact:true})).toHaveCount(0);
  await page.getByText('Disagree or correct an observation',{exact:true}).click();
  await page.getByLabel('What should Soma reconsider?').fill('The handwritten label names voltage; the transcription says current.');
  await page.getByRole('button',{name:'Save learning correction',exact:true}).click();
  await expect(page.getByText('Correction saved. Reconsideration can use this new observation.',{exact:true})).toBeVisible();
  expect(workspace.attempts.at(-1)).toMatchObject({responseKind:'correction',correct:null,novel:false,assisted:true});
  await page.reload(); await page.locator('.evidence-record summary').click();
  await expect(page.locator('.evidence-record')).toContainText('Student correction');
  await page.setViewportSize({width:844,height:390});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('learning graph preview is reachable through the demo controls', async ({page})=>{
  await page.goto('/?demo=1');
  await page.getByRole('button',{name:'Workspace menu'}).click();
  await page.getByRole('button',{name:'Try a synthetic change',exact:true}).click();
  await page.getByRole('button',{name:'Explore learning graph',exact:true}).click();
  await expect(page).toHaveURL(/lesson=graph-preview-parallel/);
  await expect(page.getByRole('region',{name:'What Soma is checking'})).toContainText('Prepared synthetic investigation');
});

test('local inspection links a saved reconsideration to its materially different fresh activity',async({page})=>{
  const before=seedWorkspace('inspection-revision');
  let workspace=prepareLearningGraphPreview(structuredClone(before),'2026-10-27T16:00:00.000Z');
  const id='graph-preview-parallel', initial=workspace.investigations![0];
  workspace=applyAction(workspace,{type:'attempt',lessonId:id,optionIndex:1},'2026-10-27T16:03:00.000Z');
  const original=structuredClone(workspace.attempts[0]);
  const next={...workspace.lessons[0],id:'new-condition',title:'A different condition',question:'At a new 9 V condition, which branch relationship applies?',exposure:'fresh-no-diagram' as const,kind:'practice' as const,diagnosticInvestigationId:'reconsidered-condition'};
  workspace.lessons.push(next);workspace.investigations!.push({...initial,id:'reconsidered-condition',supersedesId:initial.id,createdAt:'2026-10-27T16:04:00.000Z',attemptIds:[original.id],diagnosticLessonId:undefined,diagnosticPlan:undefined,selectedLessonId:next.id,reason:'The saved response leaves the cause uncertain, so a different condition can clarify it.',hypothesisRevisions:[{hypothesisId:'diagram-reading',status:'unresolved',reason:'Support exposure limits this observation.'}]});
  const reply=()=>({workspace,capabilities:{spark:false,persistence:'local-synthetic',liveSources:[]}});
  await page.route('**/api/workspace',route=>route.fulfill({json:reply()}));
  await page.route('**/api/audit**',route=>route.fulfill({json:{workspaceId:workspace.id,runs:[]}}));
  await page.route('**/api/actions',route=>{workspace=applyAction(workspace,route.request().postDataJSON());return route.fulfill({json:reply()});});
  await page.goto(`/?view=study&lesson=${id}`);
  const panel=page.getByRole('region',{name:'What Soma is checking'});
  await panel.getByRole('button',{name:'Inspect explanations and evidence'}).click();
  await expect(panel.getByRole('heading',{name:'What changed after your response'})).toBeVisible();
  await expect(panel).toContainText(next.question);
  expect(workspace.attempts[0]).toEqual(original);
  await panel.getByRole('button',{name:'Open fresh application',exact:true}).click();
  await expect(page).toHaveURL(/lesson=new-condition/);
  await expect(page.getByRole('table')).toHaveCount(0);
});

test('a later worker artifact closes an open inspection before its new activity is exposed',async({page})=>{
  const before=seedWorkspace('inspection-context-change');
  let workspace=prepareLearningGraphPreview(structuredClone(before),'2026-10-27T16:00:00.000Z');
  const id='graph-preview-parallel', initial=workspace.investigations![0];
  // A stale historical sibling must not block disclosure of current material.
  workspace.lessons.push({...workspace.lessons[0],id:'historical-sibling',state:'stale'});
  let supportSaves=0, staleSupportSaves=0;
  const reply=()=>({workspace,capabilities:{spark:false,persistence:'local-synthetic',liveSources:[]}});
  await page.route('**/api/workspace',route=>route.fulfill({json:reply()}));
  await page.route('**/api/audit**',route=>route.fulfill({json:{workspaceId:workspace.id,runs:[]}}));
  await page.route('**/api/actions',route=>{
    const action=route.request().postDataJSON();
    if(action.type==='assistance'){supportSaves++;if(action.lessonId==='historical-sibling'){staleSupportSaves++;return route.fulfill({status:422,json:{error:'Historical activity unavailable.'}});}}
    workspace=applyAction(workspace,action);return route.fulfill({json:reply()});
  });
  await page.goto(`/?view=study&lesson=${id}`);
  const panel=page.getByRole('region',{name:'What Soma is checking'});
  await panel.getByRole('button',{name:'Inspect explanations and evidence'}).click();
  await expect(panel.getByRole('heading',{name:'Two provisional explanations'})).toBeVisible();
  const beforeSaves=supportSaves;expect(staleSupportSaves).toBe(0);
  const next={...workspace.lessons[0],id:'arriving-condition',title:'A later condition',question:'A previously unseen new condition chosen by the worker.',exposure:'fresh-no-diagram' as const,kind:'practice' as const,diagnosticInvestigationId:'arriving-investigation'};
  workspace={...workspace,revision:workspace.revision+1,lessons:[...workspace.lessons,next],investigations:[...workspace.investigations!,{...initial,id:'arriving-investigation',supersedesId:initial.id,createdAt:'2026-10-27T16:10:00.000Z',diagnosticLessonId:undefined,diagnosticPlan:undefined,selectedLessonId:next.id,reason:'A newly published rationale must wait for saved support.',hypothesisRevisions:[{hypothesisId:'diagram-reading',status:'supported',reason:'Provisional only.'}]}]};
  await page.evaluate(()=>window.dispatchEvent(new PopStateEvent('popstate')));
  await expect(panel.getByRole('button',{name:'Inspect explanations and evidence'})).toBeVisible();
  await expect(panel.getByText(next.question,{exact:true})).toHaveCount(0);
  await expect(panel.getByText('A newly published rationale must wait for saved support.',{exact:true})).toHaveCount(0);
  expect(supportSaves).toBe(beforeSaves);expect(workspace.assistance[next.id]??[]).toHaveLength(0);
  await panel.getByRole('button',{name:'Inspect explanations and evidence'}).click();
  await expect(panel.getByText(next.question,{exact:true})).toBeVisible();
  await expect(panel.getByText('Provisionally supported',{exact:true})).toBeVisible();
  expect(workspace.assistance[next.id].some(item=>item.includes('explanation'))).toBe(true);
  expect(staleSupportSaves).toBe(0);
});

test('a new diagnostic cannot inherit the revised status of a different explanation sharing its ID',async({page})=>{
  const before=seedWorkspace('inspection-distinct-hypotheses');
  let workspace=prepareLearningGraphPreview(structuredClone(before),'2026-10-27T16:00:00Z');
  const initial=workspace.investigations![0],lesson=workspace.lessons[0];
  workspace=reconcileLearningGraph({...workspace,investigations:[]},workspace);
  const original=structuredClone(workspace);
  const plan=structuredClone(initial.diagnosticPlan!);plan.hypotheses[0].claim='A distinct new explanation sharing a short identifier.';
  const fresh={...lesson,id:'distinct-hypothesis-activity',kind:'practice' as const,exposure:'fresh-no-diagram' as const,objective:'A fresh representation',question:'Which two endpoint nodes establish the branch voltage?',diagnosticInvestigationId:'new-diagnostic',diagnosticExperiment:undefined};
  workspace.lessons.push(fresh);workspace.investigations!.push({...initial,id:'new-diagnostic',supersedesId:initial.id,createdAt:'2026-10-27T16:03:00Z',diagnosticPlan:plan,diagnosticLessonId:fresh.id,selectedLessonId:fresh.id,hypothesisRevisions:[{hypothesisId:plan.hypotheses[0].id,status:'weakened',reason:'The previous explanation was weakened; the new claim is separate.'},{hypothesisId:plan.hypotheses[1].id,status:'unresolved',reason:'The previous alternative remains uncertain.'}]});
  workspace=reconcileLearningGraph(original,workspace);
  const reply=()=>({workspace,capabilities:{spark:false,persistence:'local-synthetic',liveSources:[]}});
  await page.route('**/api/workspace',route=>route.fulfill({json:reply()}));
  await page.route('**/api/audit**',route=>route.fulfill({json:{workspaceId:workspace.id,runs:[]}}));
  await page.route('**/api/actions',route=>{workspace=applyAction(workspace,route.request().postDataJSON());return route.fulfill({json:reply()});});
  await page.goto(`/?view=study&lesson=${lesson.id}`);
  const panel=page.getByRole('region',{name:'What Soma is checking'});
  await panel.getByRole('button',{name:'Inspect explanations and evidence'}).click();
  const oldCard=panel.locator('.evidence-card').filter({has:page.getByRole('heading',{name:initial.diagnosticPlan!.hypotheses[0].claim,exact:true})});
  await expect(oldCard).toContainText('Weakened');
  await panel.getByRole('button',{name:'Open fresh application',exact:true}).click();
  await panel.getByRole('button',{name:'Inspect explanations and evidence'}).click();
  const newCard=panel.locator('.evidence-card').filter({has:page.getByRole('heading',{name:plan.hypotheses[0].claim,exact:true})});
  await expect(newCard).toContainText('Plausible');await expect(newCard).not.toContainText('Weakened');
});
