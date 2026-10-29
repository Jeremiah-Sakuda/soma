import type {Page} from 'playwright-core';
import {canonicalPiazzaCourseUrl,normalizePiazzaCatalog,parsePiazzaCourseUrl,parsePiazzaRenderedCourseUrl,type PiazzaCatalogCourse} from '../../domain/piazza-navigation';
import {WorkspaceStoreError} from '../store';
import type {BrowserTarget} from './browser';
import type {CollectedSource} from './ingest';

type ReadPage=Pick<Page,'locator'|'url'>;
export const PIAZZA_VISIBLE_ITEM_LIMIT=200;
export const PIAZZA_PREVIEW_LIMIT=40;
const CATALOG='[data-pats="classes_dropdown_item"][id^="network_"]';
const fail=(code='piazza_read_structure',status=422)=>new WorkspaceStoreError('Piazza previews could not be verified within the supported read-only scope. Previous material was retained.',status,code);
function timeout(deadline:number){const left=deadline-Date.now();if(!Number.isFinite(left)||left<=0)throw fail('browser_timeout',408);return Math.min(left,8000);}
async function authenticated(page:ReadPage,deadline:number){
 timeout(deadline);
 if(await page.locator('input[type="password"]').count()||await page.locator('button#gear_menu_id').count()!==1||await page.locator('button#classDropdownMenuId').count()!==1)throw fail('browser_login_required',409);
 timeout(deadline);
}
function location(page:ReadPage){const actual=parsePiazzaRenderedCourseUrl(page.url());if(!actual)throw fail('piazza_read_scope');return actual;}
async function catalog(page:ReadPage,deadline:number){
 location(page);await authenticated(page,deadline);
 const items=page.locator(CATALOG);
 if(!await items.count())await page.locator('button#classDropdownMenuId').click({timeout:timeout(deadline)});
 await items.first().waitFor({state:'attached',timeout:timeout(deadline)}).catch(()=>undefined);
 timeout(deadline);
 const count=await items.count();if(!count)throw fail();if(count>1000)throw fail('piazza_catalog_overflow');
 const result=await items.evaluateAll(items=>{
  const clean=(value:string|null)=>(value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const rows:{id:string;code:string;title:string;term:string}[]=[];
  for(const item of items){
   const match=/^network_([A-Za-z0-9_-]{1,160})$/.exec(item.id);if(!match)return {error:true as const};
   const buttons=item.querySelectorAll('.piazza-class-button');if(buttons.length!==1)return {error:true as const};
   const button=buttons[0],codes=button.querySelectorAll('.course_number'),titles=button.querySelectorAll('.font-weight-normal'),terms=button.querySelectorAll('.term');
   if(codes.length!==1||titles.length!==1||terms.length!==1)return {error:true as const};
   const code=clean(codes[0].textContent),title=clean(titles[0].textContent),term=clean(terms[0].textContent);
   if(!code||!title||!term||code.length>100||title.length>300||term.length>160||[code,title,term].some(value=>/[\u0000-\u001f\u007f]/.test(value)))return {error:true as const};
   rows.push({id:match[1],code,title,term});
  }
  return {rows};
 });
 timeout(deadline);if('error' in result)throw fail();
 let courses:PiazzaCatalogCourse[];
 try{courses=normalizePiazzaCatalog(result.rows.map(row=>({url:canonicalPiazzaCourseUrl(row.id),title:`${row.code} · ${row.title}`,term:row.term})));}
 catch{throw fail('piazza_catalog_conflict');}
 return {courses,rows:result.rows};
}
/** Only the class picker may be opened. Class entries and posts are never clicked. */
export async function readPiazzaCatalog(page:ReadPage,deadline:number):Promise<PiazzaCatalogCourse[]>{return (await catalog(page,deadline)).courses;}

/** Partial instructor-note previews from the current rendered feed, never a complete class export. */
export async function readPiazzaFeedPreviews(page:ReadPage,target:BrowserTarget,deadline:number):Promise<CollectedSource>{
 const selected=parsePiazzaCourseUrl(target.url),actual=location(page);
 if(!selected||selected.url!==target.url||selected.id!==actual.id||!target.courseId)throw fail('piazza_read_scope');
 const inventory=await catalog(page,deadline),matching=inventory.rows.find(row=>row.id===selected.id);
 if(!matching||!inventory.courses.some(course=>course.id===selected.id))throw fail('piazza_read_scope');
 const label=await page.locator('button#classDropdownMenuId').getAttribute('aria-label',{timeout:timeout(deadline)});
 if(label?.trim().replace(/\s+/g,' ')!==`Class selection - ${matching.code}`)throw fail('piazza_read_scope');
 // Opening the picker must not have changed the selected class or destination.
 if(location(page).id!==selected.id)throw fail('piazza_read_scope');
 const feed=page.locator('#feed_list li.feed_item'),visibleCount=await feed.count();
 if(!visibleCount)throw fail('piazza_read_structure');
 if(visibleCount>PIAZZA_VISIBLE_ITEM_LIMIT)throw fail('piazza_visible_overflow');
 const result=await feed.evaluateAll((items,limits)=>{
  const clean=(value:string|null)=>(value??'').replace(/\u00a0/g,' ').replace(/\s+/g,' ').trim();
  const previews:{id:string;title:string;snippet:string;postNumber?:string}[]=[];
  if(!items.length)return {error:'structure' as const};
  if(items.length>limits.visible)return {error:'visible-overflow' as const};
  for(const item of items){
   // Exclude before accessing identifiers, titles, snippets, status, authors or action metadata.
   if(item.querySelector('[data-id="icon_private"], .private-icon-indicator.private, .private-icon-indicator.sections, .private-icon.graded')
    ||!item.classList.contains('note')||!item.querySelector('[id$="_iconInstr"] .inst-note'))continue;
   if(previews.length>=limits.previews)return {error:'preview-overflow' as const};
   if(item.getAttribute('data-id')!=='post_group_item')return {error:'structure' as const};
   const identity=/^([A-Za-z0-9_-]{1,160})_item$/.exec(item.id);if(!identity)return {error:'structure' as const};
   const titles=item.querySelectorAll('.title_text'),snippets=item.querySelectorAll('.snippet');
   if(titles.length!==1||snippets.length!==1)return {error:'structure' as const};
   const title=clean(titles[0].textContent),snippet=clean(snippets[0].textContent);
   if(!title||title.length>300||snippet.length>4000||[title,snippet].some(value=>/[\u0000-\u001f\u007f]/.test(value)))return {error:'structure' as const};
   const actions=item.querySelectorAll('button[aria-label^="Feed Item Actions for Post "]');if(actions.length>1)return {error:'structure' as const};
   let postNumber:string|undefined;
   if(actions.length){const match=/^Feed Item Actions for Post ([1-9][0-9]{0,31})$/.exec(actions[0].getAttribute('aria-label')??'');if(!match)return {error:'structure' as const};postNumber=match[1];}
   previews.push({id:identity[1],title,snippet,...(postNumber?{postNumber}:{})});
  }
  return {previews};
 },{visible:PIAZZA_VISIBLE_ITEM_LIMIT,previews:PIAZZA_PREVIEW_LIMIT});
 timeout(deadline);if('error' in result)throw fail(result.error==='visible-overflow'?'piazza_visible_overflow':result.error==='preview-overflow'?'piazza_preview_overflow':'piazza_read_structure');
 const finalLabel=await page.locator('button#classDropdownMenuId').getAttribute('aria-label',{timeout:timeout(deadline)});
 if(location(page).id!==selected.id||finalLabel?.trim().replace(/\s+/g,' ')!==`Class selection - ${matching.code}`)throw fail('piazza_read_scope');
 const seen=new Set<string>();
 for(const preview of result.previews){if(seen.has(preview.id))throw fail('piazza_preview_conflict');seen.add(preview.id);}
 result.previews.sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0);
 const body='Piazza partial visible-feed instructor-note previews only. This is not a complete feed or full-post read. Full posts, replies, private and section/group posts, graded content, grades and attachments are excluded. No post was opened.\n'
  +(result.previews.length?result.previews.map(preview=>JSON.stringify({previewId:preview.id,title:preview.title,snippet:preview.snippet,...(preview.postNumber?{postNumber:preview.postNumber}:{})})).join('\n'):'No eligible instructor-note previews were observed in the current visible feed; this does not establish that the class has no posts.');
 if(body.length>48000)throw fail('piazza_preview_capacity',413);
 return {id:selected.url,title:'Piazza instructor-note previews',body,courseId:target.courseId,url:selected.url,kind:'piazza',...(target.context?{context:target.context}:{})};
}
