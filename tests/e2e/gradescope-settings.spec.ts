import {test,expect} from '@playwright/test';
import {seedEmptyAccountWorkspace} from '../../src/lib/domain/seed';

test('a full course load can save six owned Gradescope overviews with honest read limits',async({page})=>{
 const workspace=seedEmptyAccountWorkspace('synthetic-gradescope-settings');
 workspace.courses=Array.from({length:6},(_,index)=>({id:`course-${index+1}`,code:`SYN ${index+1}`,title:`Synthetic course ${index+1}`,instructor:'',color:'blue',nextEvent:'',deadline:''}));
 let targets:{courseId:string;url:string}[]=[];let saved:unknown;
 await page.route('**/api/auth/session',route=>route.fulfill({json:{authenticated:true,accountWorkspaceAvailable:true}}));
 await page.route('**/api/workspace',route=>route.fulfill({json:{workspace,capabilities:{spark:false,persistence:'firestore',liveSources:[]}}}));
 await page.route('**/api/audit**',route=>route.fulfill({json:{workspaceId:workspace.id,runs:[]}}));
 await page.route('**/api/jobs',route=>route.fulfill({json:{jobs:[]}}));
 await page.route('**/api/adaptations',route=>route.fulfill({json:{jobs:[]}}));
 await page.route('**/api/connectors/google/status',route=>route.fulfill({json:{configured:false,providers:{gmail:false,calendar:false},connections:[]}}));
 await page.route('**/api/connectors/browser',async route=>{
  if(route.request().method()==='POST'){saved=route.request().postDataJSON();targets=(saved as {targets:typeof targets}).targets;await route.fulfill({json:{notice:'Synthetic selections saved.'}});return;}
  await route.fulfill({json:{configured:true,providers:[{provider:'gradescope',label:'Gradescope',homeUrl:'https://www.gradescope.com/',connection:{status:'connected',configuration:{targets}}}]}});
 });
 await page.goto('/');await page.getByRole('button',{name:'Workspace menu'}).click();
 await page.getByText('Connect course sites, Gmail and Calendar',{exact:true}).click();
 const region=page.getByRole('region',{name:'Gradescope connection'});
 await expect(region).toContainText('scores, responses and returned-work files are excluded');
 await expect(region.getByRole('button',{name:'Refresh saved pages'})).toBeDisabled();
 for(let index=0;index<6;index++){
  if(index)await region.getByRole('button',{name:'Add another course page'}).click();
  await region.locator(`#gradescope-course-${index}`).selectOption(workspace.courses[index].id);
  await region.locator(`#gradescope-url-${index}`).fill(`https://www.gradescope.com/courses/${index+1}`);
 }
 await region.getByRole('button',{name:'Save selected pages'}).click();
 await expect(region.getByRole('button',{name:'Refresh saved pages'})).toBeEnabled();
 expect(saved).toEqual({provider:'gradescope',action:'configure',targets:workspace.courses.map((course,index)=>({courseId:course.id,url:`https://www.gradescope.com/courses/${index+1}`}))});
});
