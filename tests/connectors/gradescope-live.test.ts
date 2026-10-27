import {createHash} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {describe,expect,it} from 'vitest';
import {getServerApp,getServerFirestore} from '../../src/lib/server/firebase-config';
import {verifyWorkerAccount} from '../../src/lib/server/account';
import {verifyWorkerRequest} from '../../src/lib/server/worker-auth';
import {withBrowserRead,remainingReadTime} from '../../src/lib/server/connectors/browser';
import {readGradescopeCatalog,readGradescopeAssignmentMetadata} from '../../src/lib/server/connectors/gradescope-materials';
import {isAllowedGradescopeRequest,filterGradescopeFall2026,canonicalGradescopeCourseUrl} from '../../src/lib/domain/gradescope-navigation';

async function scopedAccount(){
 if(!process.env.SOMA_GRADESCOPE_OWNER_EMAIL)throw new Error('Explicit owner scope required.');
 const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_GRADESCOPE_OWNER_EMAIL);
 const rootId=createHash('sha256').update(user.uid).digest('hex');
 const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
 const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
 const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);
 if(!account)throw new Error('Explicit account unavailable.');
 return account;
}

/** Explicitly opted-in access proof; no private fixtures, material publication or inference. */
describe.skipIf(process.env.SOMA_GRADESCOPE_LIVE_TEST!=='true')('authorized Gradescope saved-session access',()=>{
 it('reopens the saved context and discovers explicit semester metadata read only',async()=>{
  const result=await withBrowserRead(await scopedAccount(),'gradescope',request=>isAllowedGradescopeRequest(request,[],'catalog'),async({page,deadline})=>{
   const response=await page.goto('https://www.gradescope.com/',{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
   expect(response?.ok()).toBe(true);
   const courses=await readGradescopeCatalog(page,deadline);expect(courses.length).toBeGreaterThan(0);
   return {value:{courses},notice:'Saved Gradescope sign-in reopened successfully. Course list verified; no assignment pages collected.'};
  });
  process.stdout.write(JSON.stringify({enrolledCourses:result.courses.length,fall2026Courses:filterGradescopeFall2026(result.courses).length,modelCalls:0,persistedMaterial:0})+'\n');
 },120_000);
 it.skipIf(!process.env.SOMA_GRADESCOPE_TEST_COURSE_ID)('reads one explicitly scoped assignment overview without grades or publication',async()=>{
  const url=canonicalGradescopeCourseUrl(process.env.SOMA_GRADESCOPE_TEST_COURSE_ID!);
  const result=await withBrowserRead(await scopedAccount(),'gradescope',request=>isAllowedGradescopeRequest(request,[process.env.SOMA_GRADESCOPE_TEST_COURSE_ID!],'collect'),async({page,deadline})=>{
   const response=await page.goto(url,{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});
   expect(response?.ok()).toBe(true);
   let source;
   try{source=await readGradescopeAssignmentMetadata(page,{url,courseId:'private-access-probe'},deadline);}
   catch(error){
    if(process.env.SOMA_GRADESCOPE_READ_DIAGNOSTICS==='true'){
     const shapes=await page.locator('table#assignments-student-table').evaluate(table=>({
      headers:Array.from(table.querySelectorAll('thead th')).map(cell=>cell.textContent?.trim()),
      rows:Array.from(table.querySelectorAll('tbody tr')).map(row=>({attributes:Array.from(row.attributes).map(attribute=>attribute.name),cells:Array.from(row.children).map(cell=>({tag:cell.tagName,class:cell.className,childTags:Array.from(cell.children).map(child=>child.tagName)})),links:Array.from(row.querySelectorAll('th a[href]')).map(anchor=>({path:(anchor.getAttribute('href')??'').replace(/\d+/g,'[id]'),nameLength:anchor.textContent?.trim().length})),dateLengths:[3,4].map(index=>row.children[index]?.textContent?.trim().length)}))
     }));
     process.stdout.write(JSON.stringify({code:(error as {code?:string}).code,shapes})+'\n');
    }
    throw error;
   }
   expect(source.kind).toBe('gradescope');expect(source.body.length).toBeGreaterThan(0);
   expect(source.url).toBe(url);expect(source.body).not.toContain('/submissions/');
   return {value:{bodyLength:source.body.length},notice:'Selected Gradescope assignment metadata verified read only; no material collected.'};
  });
  process.stdout.write(JSON.stringify({...result,modelCalls:0,persistedMaterial:0})+'\n');
 },120_000);
 it.skipIf(process.env.SOMA_GRADESCOPE_SEMESTER_READ!=='Fall 2026')('verifies current-semester assignment metadata with no publication or inference',async()=>{
  let mode:'catalog'|'collect'='catalog';let selectedIds:string[]=[];
  const result=await withBrowserRead(await scopedAccount(),'gradescope',request=>isAllowedGradescopeRequest(request,selectedIds,mode),async({page,deadline})=>{
   const response=await page.goto('https://www.gradescope.com/',{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});expect(response?.ok()).toBe(true);
   const selected=filterGradescopeFall2026(await readGradescopeCatalog(page,deadline));expect(selected.length).toBeGreaterThan(0);
   // Access proof is a single bounded slice, not an unbounded semester collector.
   if(selected.length>4)throw new Error('Select an explicit smaller access-proof slice.');
   selectedIds=selected.map(course=>course.id);mode='collect';let assignmentRows=0;
   for(const course of selected){
    const loaded=await page.goto(course.url,{waitUntil:'domcontentloaded',timeout:remainingReadTime(deadline,20_000)});expect(loaded?.ok()).toBe(true);
    const source=await readGradescopeAssignmentMetadata(page,{url:course.url,courseId:'private-access-probe'},deadline);
    expect(source.body).not.toContain('/submissions/');expect(source.kind).toBe('gradescope');
    assignmentRows+=await page.locator('table#assignments-student-table tbody tr').count();
   }
   return {value:{verifiedOverviews:selected.length,assignmentRows},notice:'Current-semester Gradescope assignment metadata verified. No grades, responses, files or material publication in this access probe.'};
  });
  process.stdout.write(JSON.stringify({...result,modelCalls:0,persistedMaterial:0})+'\n');
 },120_000);
});
