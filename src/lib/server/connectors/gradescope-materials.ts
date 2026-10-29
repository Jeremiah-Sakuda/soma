import type {Page} from 'playwright-core';
import {normalizeGradescopeCatalog,parseGradescopeCourseUrl,type GradescopeCatalogCourse} from '../../domain/gradescope-navigation';
import {WorkspaceStoreError} from '../store';
import type {BrowserTarget} from './browser';
import type {CollectedSource} from './ingest';

export const GRADESCOPE_ASSIGNMENT_LIMIT=200;
const AUTH='a[href*="logout"], a[href*="signout"], form[action*="logout"]';
type ReadPage=Pick<Page,'locator'|'url'>;
const fail=(code='gradescope_read_structure',status=422)=>new WorkspaceStoreError('Gradescope metadata could not be verified within the supported read-only scope. Previous material was retained.',status,code);
function timeout(deadline:number){const remaining=deadline-Date.now();if(remaining<=0)throw fail('browser_timeout',408);return Math.min(remaining,8000);}
async function authenticated(page:ReadPage,deadline:number){
 timeout(deadline);
 if(await page.locator('input[type="password"]').count()||!await page.locator(AUTH).count())throw fail('browser_login_required',409);
 timeout(deadline);
}
/** Read only explicitly identified assignment metadata. Never read a status cell or entire page/table. */
export async function readGradescopeAssignmentMetadata(page:ReadPage,target:BrowserTarget,deadline:number):Promise<CollectedSource>{
 const selected=parseGradescopeCourseUrl(target.url),actual=parseGradescopeCourseUrl(page.url());
 if(!selected||target.url!==selected.url||!actual||actual.url!==selected.url||!target.courseId)throw fail('gradescope_read_scope');
 await authenticated(page,deadline);
 const table=page.locator('table#assignments-student-table');
 if(await table.count()!==1)throw fail();
 const snapshot=await table.evaluate((table,input)=>{
  const clean=(value:string|null)=> (value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const headers=Array.from(table.querySelectorAll('thead th')).map(cell=>clean(cell.textContent));
  if(headers.length!==5||headers[0]!=='Name'||headers[1]!=='Status'||headers[3]!=='Release Date'||headers[4]!=='Due Date'
   ||!/^ReleasedDue(?:\([A-Z]{2,5}\))?$/.test(headers[2].replace(/\s/g,'')))return {error:'structure' as const};
  const bodies=table.querySelectorAll('tbody');if(bodies.length!==1)return {error:'structure' as const};
  const rows=Array.from(bodies[0].querySelectorAll('tr'));
  if(rows.length>input.limit)return {error:'overflow' as const};
  const assignments:{id:string|null;name:string;release:string;due:string}[]=[];
  for(const row of rows){
   const cells=Array.from(row.children);
   if(cells.length!==5||cells[0].tagName!=='TH'||!cells[0].classList.contains('table--primaryLink')||cells[3].tagName!=='TD'||cells[4].tagName!=='TD')return {error:'structure' as const};
   const controls=cells[0].querySelectorAll('a, button');if(controls.length!==1)return {error:'structure' as const};
   const control=controls[0];let id:string|null=null;
   if(control.tagName==='A'){
    const raw=control.getAttribute('href')??'';
    if(!raw||/[\u0000-\u0020\u007f\\%?#]/.test(raw)||raw.startsWith('//')||/(?:^|\/)\.{1,2}(?:\/|$)/.test(raw))return {error:'scope' as const};
    let url:URL;try{url=new URL(raw,input.origin);}catch{return {error:'scope' as const};}
    if(url.origin!==input.origin||url.username||url.password||url.search||url.hash||url.port)return {error:'scope' as const};
    // Submission suffixes are inspected only to recover the assignment identity. They never leave the browser.
    // `/submissions/new` is a synthetic compatibility case; the observed enrolled-course link ends in a numeric submission ID.
    const match=/^\/courses\/([1-9][0-9]{0,31})\/assignments\/([1-9][0-9]{0,31})(?:\/submissions\/(?:[1-9][0-9]{0,31}|new))?\/?$/.exec(url.pathname);
    if(!match||match[1]!==input.courseId)return {error:'scope' as const};
    id=match[2];
   }else if(control.tagName!=='BUTTON')return {error:'structure' as const};
   // A non-linked assignment button is an observed provider state. Read its name only; never inspect action attributes or click it.
   const name=clean(control.textContent),release=clean(cells[3].textContent),due=clean(cells[4].textContent);
   if(!name||name.length>300||release.length>300||due.length>300||[name,release,due].some(value=>/[\u0000-\u001f\u007f]/.test(value)))return {error:'structure' as const};
   assignments.push({id,name,release,due});
  }
  return {assignments,dateHeaderDisplayed:headers[2]};
 },{courseId:selected.id,origin:'https://www.gradescope.com',limit:GRADESCOPE_ASSIGNMENT_LIMIT},{timeout:timeout(deadline)});
 timeout(deadline);
 if('error' in snapshot)throw fail(snapshot.error==='overflow'?'gradescope_assignment_overflow':snapshot.error==='scope'?'gradescope_read_scope':'gradescope_read_structure');
 const seen=new Set<string>();
 for(const row of snapshot.assignments){if(row.id===null)continue;if(seen.has(row.id))throw fail('gradescope_assignment_conflict');seen.add(row.id);}
 const dateContext=`Displayed date column: ${JSON.stringify(snapshot.dateHeaderDisplayed)}. Dates and timezone labels are retained exactly as displayed after whitespace normalization; no conversion or interpretation has been applied.`;
 const body=snapshot.assignments.length
  ?`Gradescope assignment metadata. ${dateContext}\n${snapshot.assignments.map(row=>JSON.stringify({assignmentId:row.id,...(row.id===null?{identity:'unavailable from displayed assignment button'}:{}),name:row.name,releaseDisplayed:row.release||null,dueDisplayed:row.due||null})).join('\n')}`
  :`Gradescope assignment metadata: the verified assignment table currently contains no assignments. ${dateContext}`;
 if(body.length>48000)throw fail('gradescope_assignment_capacity',413);
 return {id:selected.url,title:'Gradescope assignment overview',body,courseId:target.courseId,url:selected.url,kind:'gradescope',...(target.context?{context:target.context}:{})};
}

/** Extract term labels separately from course names. This discovers metadata, never selects a course. */
export async function readGradescopeCatalog(page:ReadPage,deadline:number):Promise<GradescopeCatalogCourse[]>{
 if(!['https://www.gradescope.com/','https://www.gradescope.com/account','https://www.gradescope.com/account/'].includes(page.url()))throw fail('gradescope_read_scope');
 await authenticated(page,deadline);
 const terms=page.locator('.courseList--term'),termCount=await terms.count();
 if(!termCount)throw fail();if(termCount>1000)throw fail('gradescope_catalog_overflow');
 const snapshot=await terms.evaluateAll((terms,limit)=>{
  const rows:{url:string;title:string;term:string}[]=[];
  for(const term of terms){
   const list=term.nextElementSibling;
   if(!list?.classList.contains('courseList--coursesForTerm'))return {error:'structure' as const};
   const label=(term.textContent??'').trim().replace(/\s+/g,' ');if(!label)return {error:'structure' as const};
   for(const anchor of list.querySelectorAll('a[href]')){
    if(rows.length>=limit)return {error:'overflow' as const};
    const raw=anchor.getAttribute('href')??'';
    // Resolve only a root-relative course path; unknown URLs are rejected by the domain parser.
    rows.push({url:raw.startsWith('/')&&!raw.startsWith('//')?'https://www.gradescope.com'+raw:raw,title:(anchor.textContent??'').trim().replace(/\s+/g,' '),term:label});
   }
  }
  return {rows};
 },1000);
 timeout(deadline);
 if('error' in snapshot)throw fail(snapshot.error==='overflow'?'gradescope_catalog_overflow':'gradescope_read_structure');
 try{return normalizeGradescopeCatalog(snapshot.rows);}catch{throw fail('gradescope_read_structure');}
}
