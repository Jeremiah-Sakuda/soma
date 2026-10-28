import type {Page} from 'playwright-core';
import {isAllowedPiazzaRequest,parsePiazzaCourseUrl,parsePiazzaRenderedCourseUrl} from '../../domain/piazza-navigation';
import {WorkspaceStoreError} from '../store';

const fail=(code='piazza_read_structure',status=422)=>new WorkspaceStoreError('Piazza’s selected class could not be verified within the supported read-only view.',status,code);
function remaining(deadline:number,maximum:number){const value=deadline-Date.now();if(!Number.isFinite(value)||value<=0)throw fail('browser_timeout',408);return Math.min(value,maximum);}

/** The initial selected-class document is loaded with scripts blocked. Only its
 * explicit first-party application assets may run on the subsequent reload.
 * The caller's context policy continues to block every API, write and socket. */
export async function renderPiazzaCourse(page:Page,deadline:number,authorize:(paths:readonly string[])=>void){
 const course=parsePiazzaCourseUrl(page.url());if(!course)throw fail('piazza_read_scope');
 remaining(deadline,1);
 if(await page.locator('input[type="password"]').count())throw fail('browser_login_required',409);
 const inventory=await page.locator('script[src]').evaluateAll(scripts=>scripts.flatMap(script=>{
  const raw=script.getAttribute('src')??'';
  if(/[\u0000-\u0020\u007f\\%?#]/.test(raw)||raw.startsWith('//')||/(?:^|\/)\.{1,2}(?:\/|$)/.test(raw))return [];
  let url:URL;try{url=new URL(raw,location.href);}catch{return [];}
  if(url.origin!=='https://piazza.com'||url.username||url.password||url.port||url.search||url.hash)return [];
  // Observed class application bundles and display dependencies. Messaging-worker,
  // third-party editors, tracking and other resources remain blocked.
  return /^\/packs\/js\/[A-Za-z0-9_~.-]+\.js$/.test(url.pathname)
   ||['/javascripts/pushstream.js','/javascripts/highlightjs/highlight.pack.js'].includes(url.pathname)?[url.pathname]:[];
 }));
 const paths=[...new Set(inventory)];
 if(paths.length>100)throw fail('piazza_script_capacity',413);
 if(!paths.some(path=>/^\/packs\/js\/qa-[A-Za-z0-9_-]+\.chunk\.js$/.test(path)))throw fail();
 if(!paths.every(path=>isAllowedPiazzaRequest({url:'https://piazza.com'+path,method:'GET',resourceType:'script',topLevel:false},[course.id],'collect',paths)))throw fail('piazza_read_scope');
 remaining(deadline,1);authorize(paths);
 const response=await page.reload({waitUntil:'domcontentloaded',timeout:remaining(deadline,20_000)});
 if(!response?.ok()||parsePiazzaRenderedCourseUrl(page.url())?.id!==course.id)throw fail('browser_login_required',409);
 if(await page.locator('input[type="password"]').count())throw fail('browser_login_required',409);
 await page.locator('#classDropdownMenuId').waitFor({state:'attached',timeout:remaining(deadline,8_000)}).catch(()=>{remaining(deadline,1);throw fail();});
 await page.locator('#feed_list li.feed_item').first().waitFor({state:'attached',timeout:remaining(deadline,8_000)}).catch(()=>{remaining(deadline,1);throw fail();});
 remaining(deadline,1);
 if(parsePiazzaRenderedCourseUrl(page.url())?.id!==course.id)throw fail('browser_login_required',409);
}
