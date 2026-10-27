import {createHash} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {describe,expect,it} from 'vitest';
import {getServerApp,getServerFirestore} from '../../src/lib/server/firebase-config';
import {verifyWorkerAccount} from '../../src/lib/server/account';
import {verifyWorkerRequest} from '../../src/lib/server/worker-auth';
import {withBrowserRead,remainingReadTime} from '../../src/lib/server/connectors/browser';

async function scopedAccount(){
 if(!process.env.SOMA_PIAZZA_OWNER_EMAIL)throw new Error('Explicit owner scope required.');
 const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_PIAZZA_OWNER_EMAIL),rootId=createHash('sha256').update(user.uid).digest('hex');
 const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
 const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
 const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);if(!account)throw new Error('Explicit account unavailable.');
 return account;
}

/** Explicit saved-context access proof. No post bodies, model calls or publication. */
describe.skipIf(process.env.SOMA_PIAZZA_LIVE_TEST!=='true')('authorized Piazza saved-session access',()=>{
 it('inspects a fresh server-rendered course shell without executing scripts or writes',async()=>{
  const blockedNavigation=new Set<string>(),scriptPaths=new Set<string>(),rpcShapes=new Map<string,unknown>();
  const render=process.env.SOMA_PIAZZA_RENDER_PROBE==='true';
  const result=await withBrowserRead(await scopedAccount(),'piazza',request=>{
   try{
    const url=new URL(request.url);
    const allowed=request.method==='GET'&&request.resourceType==='document'&&request.topLevel&&url.origin==='https://piazza.com'&&!url.username&&!url.password&&!url.search&&!url.hash
     &&(url.pathname==='/'||/^\/class\/[A-Za-z0-9_-]{1,160}\/?$/.test(url.pathname));
    if(render&&request.method==='GET'&&request.resourceType==='script'&&url.origin==='https://piazza.com'&&!url.search&&!url.hash&&scriptPaths.has(url.pathname))return true;
    if(!allowed&&request.topLevel)blockedNavigation.add(['/main','/class','/login','/account_login','/signup'].includes(url.pathname)?url.pathname:'[unsupported document]');
    return allowed;
   }catch{return false;}
  },async({page,deadline})=>{
   const response=await page.goto('https://piazza.com/',{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
   expect(response?.ok()).toBe(true);
   if(await page.locator('input[type="password"]').count())throw new Error('Piazza requests sign-in; login DOM was not inspected.');
   if(render){
    const paths=await page.locator('script[src]').evaluateAll(scripts=>scripts.flatMap(script=>{try{const url=new URL(script.getAttribute('src')??'',location.href);return url.origin===location.origin&&!url.search&&!url.hash&&/^\/(?:javascripts|modules|packs)\/.+\.js$/.test(url.pathname)?[url.pathname]:[];}catch{return [];}}));
    paths.forEach(path=>scriptPaths.add(path));
    page.on('request',request=>{
     if(!['xhr','fetch'].includes(request.resourceType()))return;
     const url=new URL(request.url());if(url.origin!=='https://piazza.com')return;
     const shape=url.pathname.replace(/[A-Za-z0-9_-]{16,}/g,'[id]');rpcShapes.set(request.method()+shape,{http:request.method(),path:shape,queryKeys:[...url.searchParams.keys()].filter(key=>/^[a-z_]{1,40}$/.test(key))});
     if(request.method()!=='POST'||!['/logic','/logic/api'].includes(url.pathname))return;
     const raw=request.postData();if(!raw||raw.length>16384)return;
     try{const data=JSON.parse(raw);const method=typeof data.method==='string'&&/^(?:user|network|content|course)\.[a-z_]{1,60}$/.test(data.method)?data.method:'[unsupported method]';rpcShapes.set(method,{method,keys:Object.keys(data).filter(key=>['method','params','id'].includes(key)),paramKeys:data.params&&typeof data.params==='object'?Object.keys(data.params).filter(key=>/^[a-z_]{1,40}$/.test(key)):[]});}catch{rpcShapes.set('[non-JSON]',{encoding:'non-JSON'});}
    });
    await page.reload({waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
    await page.locator('a[href*="/class/"]').first().waitFor({state:'attached',timeout:remainingReadTime(deadline,8000)}).catch(()=>undefined);
   }
   const courses=await page.locator('a[href]').evaluateAll(anchors=>anchors.flatMap(anchor=>{
    let url:URL;try{url=new URL(anchor.getAttribute('href')??'',location.href);}catch{return [];}
    return url.origin===location.origin&&/^\/class\/[A-Za-z0-9_-]{1,160}\/?$/.test(url.pathname)&&!url.search
     ?[{url:url.origin+url.pathname,label:(anchor.textContent??'').trim().slice(0,300),structure:[anchor.parentElement,anchor.parentElement?.parentElement].map(element=>element?{tag:element.tagName,class:element.className}:null)}]:[];
   }));
   let classMenuStructure:unknown=null,feedStructure:unknown=null;
   if(render&&process.env.SOMA_PIAZZA_COURSE_METADATA==='true'){
    const picker=page.locator('#classDropdownMenuId');if(await picker.count()===1){await picker.click({timeout:remainingReadTime(deadline,3000)});classMenuStructure=await picker.evaluate(button=>{const wrapper=button.parentElement;return {tag:wrapper?.tagName,class:wrapper?.className,text:wrapper?.textContent?.trim().slice(0,5000),children:Array.from(wrapper?.children??[]).map(child=>({tag:child.tagName,class:child.className,attributes:Array.from(child.attributes).map(attribute=>attribute.name)}))};});}
    feedStructure=await page.locator('#feed_list').evaluate(feed=>Array.from(feed.children).slice(0,12).map(item=>({tag:item.tagName,id:item.id,class:item.className,attributes:Array.from(item.attributes).map(attribute=>attribute.name),children:Array.from(item.querySelectorAll('*')).slice(0,35).map(child=>({tag:child.tagName,class:child.className,attributes:Array.from(child.attributes).map(attribute=>attribute.name)}))})));
   }
   const controls=await page.locator('button,[role=button]').evaluateAll(nodes=>nodes.slice(0,35).map(node=>({tag:node.tagName,id:node.id,class:node.className,label:(node.getAttribute('aria-label')??node.textContent??'').trim().slice(0,60)})));
   const contentStructure=await page.locator('[id]').evaluateAll(nodes=>nodes.filter(node=>/^(?:content|post|feed|network|class|account|user)/i.test(node.id)).slice(0,60).map(node=>({tag:node.tagName,id:node.id,class:node.className})));
   const authMarkers=await page.locator('a[href*="logout"], a[href*="signout"], form[action*="logout"]').count();
   const scripts=await page.locator('script[src]').evaluateAll(scripts=>scripts.map(script=>{
    try{const url=new URL(script.getAttribute('src')??'',location.href);return {sameOrigin:url.origin===location.origin,pathShape:url.pathname.replace(/[A-Za-z0-9_-]{16,}/g,'[asset]')};}catch{return {sameOrigin:false,pathShape:'[invalid]'};}
   }));
   return {value:{courses,authMarkers,scripts,controls,contentStructure,classMenuStructure,feedStructure,finalPath:new URL(page.url()).pathname.startsWith('/class/')?'/class/[id]':new URL(page.url()).pathname},notice:'Piazza browser context saved; course collection remains unverified.'};
  });
  process.stdout.write(JSON.stringify({courseLinks:result.courses.length,...(process.env.SOMA_PIAZZA_COURSE_METADATA==='true'?{courses:result.courses,classMenuStructure:result.classMenuStructure,feedStructure:result.feedStructure}:{}),finalPath:result.finalPath,rpcShapes:[...rpcShapes.values()],authenticatedMarkers:result.authMarkers,scripts:result.scripts,blockedNavigation:[...blockedNavigation],modelCalls:0,persistedMaterial:0})+'\n');
 },120_000);
});
