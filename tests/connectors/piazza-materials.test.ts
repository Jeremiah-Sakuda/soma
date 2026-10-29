import {describe,expect,it,vi} from 'vitest';
import type {Page} from 'playwright-core';
import {readPiazzaCatalog,readPiazzaFeedPreviews} from '../../src/lib/server/connectors/piazza-materials';
const origin='https://piazza.com',url=origin+'/class/synthetic_1',target={courseId:'owned-synthetic-course',url};
const deadline=()=>Date.now()+30000;
const forbidden=()=>{throw new Error('Private, status, author, payload or body access is forbidden');};
type CatalogRow={id?:string;code?:string;title?:string;term?:string;missing?:string};
type FeedRow={id?:string;title?:string;snippet?:string;note?:boolean;instructor?:boolean;private?:boolean;section?:boolean;graded?:boolean;missing?:string;dataId?:string;action?:string;actions?:number;volatile?:string};
function catalogRow(input:CatalogRow={}){
 const fields:Record<string,string>={'.course_number':input.code??'SYN 440','.font-weight-normal':input.title??'Synthetic Algorithms','.term':input.term??'Fall 2026'};
 return {id:input.id??'network_synthetic_1',get textContent(){return forbidden();},querySelectorAll:(selector:string)=>{
  expect(selector).toBe('.piazza-class-button');
  return [{querySelectorAll:(selector:string)=>{if(!(selector in fields))return forbidden();return input.missing===selector?[]:[{textContent:fields[selector]}];}}];
 }};
}
function feedRow(input:FeedRow={}){
 const excluded=input.private||input.section||input.graded||input.note===false||input.instructor===false;
 return {
  get id(){if(excluded)return forbidden();return input.id??'postA_item';},
  get textContent(){return forbidden();},
  getAttribute:(name:string)=>{if(excluded||name!=='data-id')return forbidden();return input.dataId??'post_group_item';},
  classList:{contains:(name:string)=>{expect(name).toBe('note');return input.note!==false;}},
  querySelector:(selector:string)=>{
   if(selector==='[data-id="icon_private"], .private-icon-indicator.private, .private-icon-indicator.sections, .private-icon.graded')return input.private||input.section||input.graded?{}:null;
   if(selector==='[id$="_iconInstr"] .inst-note')return input.instructor!==false?{}:null;
   return forbidden();
  },
  querySelectorAll:(selector:string)=>{
   if(excluded)return forbidden();
   if(selector==='.title_text')return input.missing===selector?[]:[{textContent:input.title??'Synthetic instructor announcement'}];
   if(selector==='.snippet')return input.missing===selector?[]:[{textContent:input.snippet??'Original synthetic visible preview.'}];
   if(selector==='button[aria-label^="Feed Item Actions for Post "]')return Array.from({length:input.actions??(input.action?1:0)},()=>({getAttribute:(name:string)=>{expect(name).toBe('aria-label');return input.action;}}));
   return forbidden();
  },
 };
}
function fixture(options:{pageUrl?:string;catalog?:CatalogRow[];feed?:FeedRow[];password?:number;gear?:number;picker?:number;label?:string;opened?:boolean;feedCount?:number;afterFeedUrl?:string;afterFeedLabel?:string}={}){
 let opened=options.opened??false;
 let extracted=false;
 const click=vi.fn(async()=>{opened=true;});
 const classes=(options.catalog??[{}]).map(catalogRow);
 const locator=vi.fn((selector:string)=>{
  if(selector==='input[type="password"]')return {count:async()=>options.password??0};
  if(selector==='button#gear_menu_id')return {count:async()=>options.gear??1,getAttribute:forbidden,click:forbidden};
  if(selector==='button#classDropdownMenuId')return {count:async()=>options.picker??1,click,getAttribute:async(name:string)=>{expect(name).toBe('aria-label');return extracted&&options.afterFeedLabel?options.afterFeedLabel:options.label??'Class selection - SYN 440';}};
  if(selector==='[data-pats="classes_dropdown_item"][id^="network_"]')return {count:async()=>opened?classes.length:0,first:()=>({waitFor:vi.fn(async()=>undefined)}),evaluateAll:async(fn:(rows:unknown)=>unknown)=>fn(classes)};
  if(selector==='#feed_list li.feed_item')return {count:async()=>options.feedCount??(options.feed??[{}]).length,evaluateAll:async(fn:(rows:unknown,arg:unknown)=>unknown,arg:unknown)=>{const result=fn((options.feed??[{}]).map(feedRow),arg);extracted=true;return result;}};
  return forbidden();
 });
 return {page:{url:()=>extracted&&options.afterFeedUrl?options.afterFeedUrl:options.pageUrl??url,locator} as unknown as Pick<Page,'locator'|'url'>,click,locator};
}
describe('Piazza observed catalog extraction',()=>{
 it('opens only the class picker and extracts class IDs, course labels and explicit terms',async()=>{
  const {page,click}=fixture({catalog:[{}, {id:'network_synthetic_2',code:'SYN 226',title:'Synthetic Mathematics',term:'Spring 2026'}]});
  expect(await readPiazzaCatalog(page,deadline())).toEqual([
   {id:'synthetic_1',url,title:'SYN 440 · Synthetic Algorithms',term:'Fall 2026'},
   {id:'synthetic_2',url:origin+'/class/synthetic_2',title:'SYN 226 · Synthetic Mathematics',term:'Spring 2026'},
  ]);
  expect(click).toHaveBeenCalledOnce();
 });
 it('does not toggle an already rendered picker closed',async()=>{
  const {page,click}=fixture({opened:true});await readPiazzaCatalog(page,deadline());expect(click).not.toHaveBeenCalled();
 });
 it.each([{password:1},{gear:0},{picker:0}])('requires authenticated page controls',async options=>{
  const {page,click}=fixture(options);await expect(readPiazzaCatalog(page,deadline())).rejects.toMatchObject({code:'browser_login_required'});expect(click).not.toHaveBeenCalled();
 });
 it.each([{id:'network_../unsafe'},{code:''},{term:''},{missing:'.term'},{code:'Code\u0000bad'}])('fails closed on malformed class metadata',async row=>{
  await expect(readPiazzaCatalog(fixture({catalog:[row]}).page,deadline())).rejects.toMatchObject({code:'piazza_read_structure'});
 });
 it('rejects duplicate conflicting class IDs and catalog overflow without truncation',async()=>{
  await expect(readPiazzaCatalog(fixture({catalog:[{}, {title:'Contradictory synthetic title'}]}).page,deadline())).rejects.toMatchObject({code:'piazza_catalog_conflict'});
  await expect(readPiazzaCatalog(fixture({catalog:Array.from({length:1001},(_,i)=>({id:`network_synthetic_${i}`}))}).page,deadline())).rejects.toMatchObject({code:'piazza_catalog_overflow'});
 });
});
describe('Piazza partial instructor-note feed previews',()=>{
 it('extracts safe note fields and optional post citation number without opening a post',async()=>{
  const {page,click}=fixture({feed:[{action:'Feed Item Actions for Post 42'}]});
  const result=await readPiazzaFeedPreviews(page,target,deadline());
  expect(result).toMatchObject({id:url,url,courseId:target.courseId,kind:'piazza',title:'Piazza instructor-note previews'});
  expect(result.body).toContain('"previewId":"postA","title":"Synthetic instructor announcement","snippet":"Original synthetic visible preview.","postNumber":"42"');
  expect(result.body).toContain('not a complete feed');expect(result.body).toContain('No post was opened');expect(click).toHaveBeenCalledOnce();
 });
 it('excludes private, section, graded, student and non-note rows before reading any identity or content',async()=>{
  const {page}=fixture({feed:[{private:true},{section:true},{graded:true},{instructor:false},{note:false}]});
  const result=await readPiazzaFeedPreviews(page,target,deadline());
  expect(result.body).toContain('No eligible instructor-note previews were observed');expect(result.body).not.toContain('"previewId"');
 });
 it('does not mistake a generic instructor-looking marker on a graded post for a public instructor note',async()=>{
  const result=await readPiazzaFeedPreviews(fixture({feed:[{graded:true,instructor:true}]}).page,target,deadline());
  expect(result.body).not.toContain('"previewId"');
 });
 it('sorts by stable post identity and ignores ordering and volatile flags',async()=>{
  const first=await readPiazzaFeedPreviews(fixture({feed:[{id:'postB_item',volatile:'unread yesterday'},{id:'postA_item',volatile:'read today'}]}).page,target,deadline());
  const second=await readPiazzaFeedPreviews(fixture({feed:[{id:'postA_item',volatile:'unread now'},{id:'postB_item',volatile:'read last week'}]}).page,target,deadline());
  expect(first).toEqual(second);expect(first.body.indexOf('postA')).toBeLessThan(first.body.indexOf('postB'));
 });
 it.each([url+'?cid=42',url+'#post',origin+'/class/another','https://evil.example/class/synthetic_1'])('rejects foreign or noncanonical selected page: %s',async pageUrl=>{
  const {page,click}=fixture({pageUrl});await expect(readPiazzaFeedPreviews(page,target,deadline())).rejects.toMatchObject({code:'piazza_read_scope'});expect(click).not.toHaveBeenCalled();
 });
 it('requires selected-class membership and matching selected course code',async()=>{
  await expect(readPiazzaFeedPreviews(fixture({catalog:[{id:'network_other'}]}).page,target,deadline())).rejects.toMatchObject({code:'piazza_read_scope'});
  await expect(readPiazzaFeedPreviews(fixture({label:'Class selection - Different course'}).page,target,deadline())).rejects.toMatchObject({code:'piazza_read_scope'});
 });
 it.each([{afterFeedUrl:origin+'/class/another'},{afterFeedLabel:'Class selection - Different course'}])('withholds a preview if class context changes during extraction',async options=>{
  await expect(readPiazzaFeedPreviews(fixture(options).page,target,deadline())).rejects.toMatchObject({code:'piazza_read_scope'});
 });
 it.each([{id:'../bad_item'},{id:'postA'},{dataId:'another_item'},{missing:'.title_text'},{missing:'.snippet'},{title:''},{title:'x'.repeat(301)},{snippet:'x'.repeat(4001)},{title:'Bad\u0000title'},{action:'Feed Item Actions for Post 0'},{action:'Feed Item Actions for Post 4 trailing'},{action:'Feed Item Actions for Post 4',actions:2}])('rejects malformed eligible previews without broad extraction',async row=>{
  await expect(readPiazzaFeedPreviews(fixture({feed:[row]}).page,target,deadline())).rejects.toMatchObject({code:'piazza_read_structure'});
 });
 it('rejects duplicate stable post identities rather than inventing separate evidence',async()=>{
  await expect(readPiazzaFeedPreviews(fixture({feed:[{},{}]}).page,target,deadline())).rejects.toMatchObject({code:'piazza_preview_conflict'});
 });
 it('refuses an empty loading shell without an observed authenticated empty-feed completion signal',async()=>{
  await expect(readPiazzaFeedPreviews(fixture({feed:[]}).page,target,deadline())).rejects.toMatchObject({code:'piazza_read_structure'});
  await expect(readPiazzaFeedPreviews(fixture({feedCount:1,feed:[]}).page,target,deadline())).rejects.toMatchObject({code:'piazza_read_structure'});
 });
 it('fails explicitly on visible-item, eligible-preview and final source capacity overflow',async()=>{
  await expect(readPiazzaFeedPreviews(fixture({feedCount:201}).page,target,deadline())).rejects.toMatchObject({code:'piazza_visible_overflow'});
  const rows=Array.from({length:41},(_,i)=>({id:`post${i}_item`}));
  await expect(readPiazzaFeedPreviews(fixture({feed:rows}).page,target,deadline())).rejects.toMatchObject({code:'piazza_preview_overflow'});
  await expect(readPiazzaFeedPreviews(fixture({feed:rows.slice(0,40).map(row=>({...row,snippet:'x'.repeat(4000)}))}).page,target,deadline())).rejects.toMatchObject({code:'piazza_preview_capacity'});
 });
 it('rejects an expired deadline before any DOM extraction',async()=>{
  const {page,locator}=fixture();await expect(readPiazzaFeedPreviews(page,target,Date.now()-1)).rejects.toMatchObject({code:'browser_timeout'});expect(locator).not.toHaveBeenCalled();
 });
 it.each([Number.NaN,Number.POSITIVE_INFINITY,Number.NEGATIVE_INFINITY])('rejects nonfinite deadline %s before catalog or preview DOM access',async invalidDeadline=>{
  for(const read of [readPiazzaCatalog,(page:Pick<Page,'locator'|'url'>,value:number)=>readPiazzaFeedPreviews(page,target,value)]){
   const {page,locator}=fixture();await expect(read(page,invalidDeadline)).rejects.toMatchObject({code:'browser_timeout'});expect(locator).not.toHaveBeenCalled();
  }
 });
});
