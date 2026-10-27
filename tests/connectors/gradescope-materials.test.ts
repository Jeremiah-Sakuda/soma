import {describe,expect,it,vi} from 'vitest';
import type {Page} from 'playwright-core';
import {readGradescopeAssignmentMetadata,readGradescopeCatalog} from '../../src/lib/server/connectors/gradescope-materials';
const origin='https://www.gradescope.com',courseUrl=origin+'/courses/42';
const deadline=()=>Date.now()+30000;
const target={courseId:'synthetic-workspace-course',url:courseUrl};
type Assignment={href?:string;name?:string;release?:string;due?:string;cellCount?:number;linkCount?:number;tag?:string;controlTag?:string};
const forbidden=()=>{throw new Error('Sensitive body/status content must never be accessed');};
function row(input:Assignment={}){
 const link={tagName:input.controlTag??'A',textContent:input.name??'Synthetic Assignment',getAttribute:(name:string)=>{if(input.controlTag==='BUTTON')return forbidden();expect(name).toBe('href');return input.href??'/courses/42/assignments/7/submissions/99';},click:forbidden};
 const cells=[
  {tagName:input.tag??'TH',classList:{contains:(name:string)=>name==='table--primaryLink'},querySelectorAll:(selector:string)=>{expect(selector).toBe('a, button');return Array(input.linkCount??1).fill(link);}},
  {tagName:'TD',get textContent(){return forbidden();}},
  {tagName:'TD',get textContent(){return forbidden();}},
  {tagName:'TD',textContent:input.release??'Oct 26, 2026 12:00 PM'},
  {tagName:'TD',textContent:input.due??'Nov 4, 2026 9:00 PM'},
 ];
 return {children:cells.slice(0,input.cellCount??5),get textContent(){return forbidden();}};
}
function fixture(options:{url?:string;rows?:Assignment[];headers?:string[];password?:number;auth?:number;tables?:number;bodyCount?:number;catalog?:{term:string;rows:{href:string;title:string}[];validSibling?:boolean}[]}={}){
 const table={
  get textContent(){return forbidden();},
  querySelectorAll:(selector:string)=>{
   if(selector==='thead th')return (options.headers??['Name','Status','ReleasedDue (EDT)','Release Date','Due Date']).map(textContent=>({textContent}));
   if(selector==='tbody')return Array.from({length:options.bodyCount??1},()=>({querySelectorAll:(selector:string)=>{expect(selector).toBe('tr');return (options.rows??[{}]).map(row);}}));
   throw new Error('Unexpected table selector: '+selector);
  },
 };
 const terms=(options.catalog??[]).map(group=>({
  textContent:group.term,
  nextElementSibling:{
   classList:{contains:(name:string)=>name==='courseList--coursesForTerm'&&group.validSibling!==false},
   querySelectorAll:(selector:string)=>{
    expect(selector).toBe('a[href]');
    return group.rows.map(item=>({textContent:item.title,getAttribute:(name:string)=>{expect(name).toBe('href');return item.href;}}));
   },
  },
 }));
 const locator=vi.fn((selector:string)=>{
  if(selector==='input[type="password"]')return {count:async()=>options.password??0};
  if(selector==='a[href*="logout"], a[href*="signout"], form[action*="logout"]')return {count:async()=>options.auth??1};
  if(selector==='table#assignments-student-table')return {count:async()=>options.tables??1,evaluate:async(fn:(node:unknown,arg:unknown)=>unknown,arg:unknown)=>fn(table,arg)};
  if(selector==='.courseList--term')return {count:async()=>terms.length,evaluateAll:async(fn:(nodes:unknown,arg:unknown)=>unknown,arg:unknown)=>fn(terms,arg)};
  throw new Error('Unexpected or sensitive page selector: '+selector);
 });
 return {locator,page:{url:()=>options.url??courseUrl,locator} as unknown as Pick<Page,'locator'|'url'>};
}
describe('Gradescope bounded assignment metadata collector',()=>{
 it('executes selective DOM extraction and discards submission links and scores',async()=>{
  const {page,locator}=fixture();
  const result=await readGradescopeAssignmentMetadata(page,target,deadline());
  expect(result).toMatchObject({id:courseUrl,url:courseUrl,courseId:target.courseId,title:'Gradescope assignment overview',kind:'gradescope'});
  expect(result.body).toContain('"assignmentId":"7"');expect(result.body).toContain('Synthetic Assignment');
  expect(result.body).toContain('"releaseDisplayed":"Oct 26, 2026 12:00 PM"');
  expect(result.body).toContain('"dueDisplayed":"Nov 4, 2026 9:00 PM"');
  expect(result.body).toContain('Displayed date column: "ReleasedDue (EDT)"');
  expect(result.body).not.toMatch(/submissions|\/99|score|status/i);
  expect(locator.mock.calls.map(call=>call[0])).toEqual(['input[type="password"]','a[href*="logout"], a[href*="signout"], form[action*="logout"]','table#assignments-student-table']);
 });
 it('retains a changed displayed timezone without converting dates',async()=>{
  const {page}=fixture({headers:['Name','Status','ReleasedDue (EST)','Release Date','Due Date']});
  const result=await readGradescopeAssignmentMetadata(page,target,deadline());
  expect(result.body).toContain('Displayed date column: "ReleasedDue (EST)"');
  expect(result.body).not.toContain('(EDT)');expect(result.body).toContain('"dueDisplayed":"Nov 4, 2026 9:00 PM"');
 });
 it('retains displayed dates without inferring timezone, deadlines or missing values',async()=>{
  const {page}=fixture({rows:[{href:'/courses/42/assignments/7',release:'',due:'No due date'}]});
  expect((await readGradescopeAssignmentMetadata(page,target,deadline())).body).toContain('"releaseDisplayed":null,"dueDisplayed":"No due date"');
 });
 it('parses the synthetic unsubmitted-link variant without retaining it or navigating',async()=>{
  const {page}=fixture({rows:[{href:'/courses/42/assignments/7/submissions/new'}]});
  const result=await readGradescopeAssignmentMetadata(page,target,deadline());
  expect(result.body).toContain('"assignmentId":"7"');expect(result.body).not.toContain('/submissions');
 });
 it('honestly describes a verified empty assignment table',async()=>{
  const {page}=fixture({rows:[]});
  expect((await readGradescopeAssignmentMetadata(page,target,deadline())).body).toContain('currently contains no assignments');
 });
 it('retains observed assignment-button names and dates without inspecting button payload or inventing identity',async()=>{
  const {page}=fixture({rows:[{}, {controlTag:'BUTTON',name:'Synthetic future assignment'}, {controlTag:'BUTTON',name:'Synthetic second future assignment'}]});
  const result=await readGradescopeAssignmentMetadata(page,target,deadline());
  expect(result.body).toContain('"assignmentId":null,"identity":"unavailable from displayed assignment button","name":"Synthetic future assignment"');
  expect(result.body).toContain('Synthetic second future assignment');expect(result.body).toContain('"assignmentId":"7"');
  expect(result.body.match(/"assignmentId":null/g)).toHaveLength(2);
 });
 it.each([{password:1},{auth:0}])('rejects missing authenticated access before table extraction',async options=>{
  const {page,locator}=fixture(options);
  await expect(readGradescopeAssignmentMetadata(page,target,deadline())).rejects.toMatchObject({code:'browser_login_required'});
  expect(locator.mock.calls.some(call=>call[0].startsWith('table'))).toBe(false);
 });
 it.each([origin+'/courses/43',origin+'/courses/42?foo=bar','https://evil.example/courses/42',origin+'/courses/42#fragment'])('rejects wrong final scope %s',async url=>{
  const {page,locator}=fixture({url});
  await expect(readGradescopeAssignmentMetadata(page,target,deadline())).rejects.toMatchObject({code:'gradescope_read_scope'});
  expect(locator).not.toHaveBeenCalled();
 });
 it('rejects noncanonical selected target and expired deadlines before DOM reads',async()=>{
  const {page,locator}=fixture();
  await expect(readGradescopeAssignmentMetadata(page,{...target,url:courseUrl+'/'},deadline())).rejects.toMatchObject({code:'gradescope_read_scope'});
  await expect(readGradescopeAssignmentMetadata(page,target,Date.now()-1)).rejects.toMatchObject({code:'browser_timeout'});
  expect(locator).not.toHaveBeenCalled();
 });
 it.each([{tables:0},{tables:2},{bodyCount:0},{bodyCount:2},{headers:['Name','Status','Unknown','Release Date','Due Date']},{headers:['Name','Status','ReleasedDue (EDT)','Due Date','Release Date']}])('fails closed on unknown table structure',async options=>{
  const {page}=fixture(options);await expect(readGradescopeAssignmentMetadata(page,target,deadline())).rejects.toMatchObject({code:'gradescope_read_structure'});
 });
 it.each([{cellCount:4},{linkCount:0},{linkCount:2},{tag:'TD'},{controlTag:'SPAN'},{name:''},{name:'x'.repeat(301)},{due:'x'.repeat(301)},{name:'Unsafe\u0000name'},{release:'Date\u0000invalid'},{due:'Date\u007finvalid'}])('fails closed on unknown assignment row structure',async row=>{
  const {page}=fixture({rows:[row]});await expect(readGradescopeAssignmentMetadata(page,target,deadline())).rejects.toMatchObject({code:'gradescope_read_structure'});
 });
 it.each([
  '/courses/43/assignments/7/submissions/99','https://evil.example/courses/42/assignments/7/submissions/99',
  '//www.gradescope.com/courses/42/assignments/7','/courses/42/assignments/7?token=secret',
  '/courses/42/assignments/7#fragment','/courses/42/assignments/7/submissions/non-numeric',
  '/courses/42/assignments/7/submissions/99/edit','/courses/42/assignments/7/../8',
  '/courses/42/assignments/%37','/courses/42/assignments/7\\submissions/99',
  'https://user:secret@www.gradescope.com/courses/42/assignments/7','/courses/42/assignments/07',
 ])('rejects unknown or foreign assignment link %s',async href=>{
  const {page}=fixture({rows:[{href}]});await expect(readGradescopeAssignmentMetadata(page,target,deadline())).rejects.toMatchObject({code:'gradescope_read_scope'});
 });
 it('rejects duplicate stable assignment identities',async()=>{
  const {page}=fixture({rows:[{},{}]});await expect(readGradescopeAssignmentMetadata(page,target,deadline())).rejects.toMatchObject({code:'gradescope_assignment_conflict'});
 });
 it('rejects overflow without partial publication and bounds final source length',async()=>{
  const rows=Array.from({length:201},(_,index)=>({href:`/courses/42/assignments/${index+1}`}));
  await expect(readGradescopeAssignmentMetadata(fixture({rows}).page,target,deadline())).rejects.toMatchObject({code:'gradescope_assignment_overflow'});
  await expect(readGradescopeAssignmentMetadata(fixture({rows:rows.slice(0,200).map(row=>({...row,name:'x'.repeat(300),release:'r'.repeat(300),due:'d'.repeat(300)}))}).page,target,deadline())).rejects.toMatchObject({code:'gradescope_assignment_capacity'});
 });
});
describe('Gradescope term-aware catalog DOM extraction',()=>{
 it('uses the separately rendered term label and never reads page body',async()=>{
  const {page}=fixture({url:origin+'/account',catalog:[
   {term:'Fall 2026',rows:[{href:'/courses/42',title:'Synthetic Algorithms: 4 assignments'}]},
   {term:'Fall 2025',rows:[{href:'/courses/43',title:'Fall 2026 in the course title'}]},
  ]});
  expect(await readGradescopeCatalog(page,deadline())).toEqual([
   {id:'42',url:origin+'/courses/42',title:'Synthetic Algorithms: 4 assignments',term:'Fall 2026'},
   {id:'43',url:origin+'/courses/43',title:'Fall 2026 in the course title',term:'Fall 2025'},
  ]);
 });
 it.each([{catalog:[]},{catalog:[{term:'Fall 2026',rows:[],validSibling:false}]},{catalog:[{term:'',rows:[]}]}])('rejects missing or unknown term wrappers',async options=>{
  await expect(readGradescopeCatalog(fixture({url:origin+'/',...options}).page,deadline())).rejects.toMatchObject({code:'gradescope_read_structure'});
 });
 it('rejects foreign links and explicit catalog overflow',async()=>{
  await expect(readGradescopeCatalog(fixture({url:origin+'/',catalog:[{term:'Fall 2026',rows:[{href:'https://evil.example/courses/42',title:'Synthetic'}]}]}).page,deadline())).rejects.toMatchObject({code:'gradescope_read_structure'});
  const rows=Array.from({length:1001},(_,index)=>({href:`/courses/${index+1}`,title:'Synthetic'}));
  await expect(readGradescopeCatalog(fixture({url:origin+'/',catalog:[{term:'Fall 2026',rows}]}).page,deadline())).rejects.toMatchObject({code:'gradescope_catalog_overflow'});
 });
});
