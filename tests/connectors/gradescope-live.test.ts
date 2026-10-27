import {createHash} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {describe,expect,it} from 'vitest';
import {getServerApp,getServerFirestore} from '../../src/lib/server/firebase-config';
import {verifyWorkerAccount} from '../../src/lib/server/account';
import {verifyWorkerRequest} from '../../src/lib/server/worker-auth';
import {withBrowserRead,remainingReadTime} from '../../src/lib/server/connectors/browser';

/** Explicitly opted-in access proof, never a fixture of private course material.
 * No publication, inference, submission, feedback or grade extraction occurs here. */
describe.skipIf(process.env.SOMA_GRADESCOPE_LIVE_TEST!=='true')('authorized Gradescope saved-session access',()=>{
 it('reopens the saved context and discovers enrolled course links read only',async()=>{
  if(!process.env.SOMA_GRADESCOPE_OWNER_EMAIL)throw new Error('Explicit owner scope required.');
  const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_GRADESCOPE_OWNER_EMAIL);
  const rootId=createHash('sha256').update(user.uid).digest('hex');
  const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
  const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
  const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);
  if(!account)throw new Error('Explicit account unavailable.');
  const result=await withBrowserRead(account,'gradescope',request=>{
   try{
    const url=new URL(request.url);
    return request.method==='GET'&&url.protocol==='https:'&&!url.username&&!url.password&&!url.search
     &&['gradescope.com','www.gradescope.com'].includes(url.hostname)&&(!url.port||url.port==='443')
     &&request.resourceType==='document'&&['/','/account','/account/'].includes(url.pathname);
   }catch{return false;}
  },async({page,deadline})=>{
   const response=await page.goto('https://www.gradescope.com/',{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
   expect(response?.ok()).toBe(true);
   expect(new URL(page.url()).pathname).toMatch(/^\/(?:account\/?)?$/);
   expect(await page.locator('input[type="password"]').count()).toBe(0);
   expect(await page.locator('a[href*="logout"], a[href*="signout"], form[action*="logout"]').count()).toBeGreaterThan(0);
   const courses=await page.locator('a[href]').evaluateAll(anchors=>anchors.flatMap(anchor=>{
    let url:URL;try{url=new URL(anchor.getAttribute('href')??'',location.href);}catch{return [];}
    return url.origin===location.origin&&/^\/courses\/\d+\/?$/.test(url.pathname)&&!url.search
     ?[{path:url.pathname,title:(anchor.textContent??'').trim().slice(0,300)}]:[];
   }));
   expect(courses.length).toBeGreaterThan(0);
   const headings=await page.locator('h1,h2,h3,h4').allTextContents();
   const structure=await page.locator('a[href^="/courses/"]').first().evaluate(anchor=>[anchor.parentElement,anchor.parentElement?.parentElement,anchor.parentElement?.parentElement?.parentElement].map(element=>element?{tag:element.tagName,class:element.className}:null));
   return {value:{courses,headings,structure},notice:'Saved Gradescope sign-in reopened successfully. Course list verified; no assignment pages collected.'};
  });
  // Deliberately print counts only. Course identifiers/titles and session material stay private.
  process.stdout.write(JSON.stringify({enrolledCourseLinks:result.courses.length,modelCalls:0,persistedMaterial:0,...(process.env.SOMA_GRADESCOPE_COURSE_METADATA==='true'?{courses:result.courses,headings:result.headings,structure:result.structure}:{})})+'\n');
 },120_000);
 it.skipIf(!process.env.SOMA_GRADESCOPE_TEST_COURSE_ID)('inspects one explicitly scoped assignment table without grades or publication',async()=>{
  const courseId=process.env.SOMA_GRADESCOPE_TEST_COURSE_ID!;
  if(!/^\d{1,20}$/.test(courseId)||!process.env.SOMA_GRADESCOPE_OWNER_EMAIL)throw new Error('Explicit owner and course scope required.');
  const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_GRADESCOPE_OWNER_EMAIL),rootId=createHash('sha256').update(user.uid).digest('hex');
  const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
  const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
  const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);if(!account)throw new Error('Explicit account unavailable.');
  const path=`/courses/${courseId}`;
  const result=await withBrowserRead(account,'gradescope',request=>{
   try{const url=new URL(request.url);return request.method==='GET'&&url.origin==='https://www.gradescope.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&[path,'/','/account','/account/'].includes(url.pathname)&&request.resourceType==='document';}catch{return false;}
  },async({page,deadline})=>{
   await page.goto('https://www.gradescope.com/',{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
   const terms=await page.locator('.courseList').evaluateAll(lists=>lists.map(list=>Array.from(list.children).map(child=>({tag:child.tagName,class:child.className,...(!child.classList.contains('courseList--coursesForTerm')?{label:child.textContent?.trim().slice(0,100)}:{})}))));
   const response=await page.goto('https://www.gradescope.com'+path,{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
   expect(response?.ok()).toBe(true);expect(new URL(page.url()).pathname).toBe(path);
   expect(await page.locator('input[type="password"]').count()).toBe(0);
   expect(await page.locator('a[href*="logout"], a[href*="signout"], form[action*="logout"]').count()).toBeGreaterThan(0);
   const tables=await page.locator('table').evaluateAll(tables=>tables.map(table=>({
    id:table.id,linkShapes:Array.from(table.querySelectorAll('tbody th a[href]')).slice(0,2).map(anchor=>(anchor.getAttribute('href')??'').replace(/\d+/g,'[id]')),headers:Array.from(table.querySelectorAll('thead th')).map(cell=>cell.textContent?.trim()),
    rows:table.querySelectorAll('tbody tr').length,
    firstRowShape:Array.from(table.querySelector('tbody tr')?.children??[]).map(cell=>({tag:cell.tagName,class:cell.className,children:Array.from(cell.children).map(child=>({tag:child.tagName,class:child.className,attributes:Array.from(child.attributes).map(attribute=>attribute.name)}))}))
   })));
   expect(tables.length).toBeGreaterThan(0);
   return {value:{tables,terms},notice:'Selected Gradescope assignment table inspected read only; no grades, student responses or material collected.'};
  });
  process.stdout.write(JSON.stringify(result)+'\n');
 },120_000);
});
