import {createHash} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {describe,it,expect,vi} from 'vitest';
import {getServerApp,getServerFirestore} from '../../src/lib/server/firebase-config';
import {verifyWorkerAccount} from '../../src/lib/server/account';
import {verifyWorkerRequest} from '../../src/lib/server/worker-auth';
import {refreshBrowser,withBrowserRead} from '../../src/lib/server/connectors/browser';
import {readBlackboardJson} from '../../src/lib/server/connectors/blackboard-api';
import {collectBlackboardMaterials} from '../../src/lib/server/connectors/blackboard-materials';
import * as policy from '../../src/lib/domain/blackboard-navigation';
import {readAccountWorkspace} from '../../src/lib/server/account-store';
import {auditedSourceCollection} from '../../src/lib/server/source-audit';
import {queueCollectedPreparation} from '../../src/lib/server/connectors/preparation';
import {blackboardStatus,discoverBlackboardCourses} from '../../src/lib/server/connectors/blackboard';

describe.skipIf(process.env.SOMA_BLACKBOARD_LIVE_TEST!=='true')('authorized Blackboard saved-session discovery',()=>{
 it('discovers course metadata in a fresh context without model calls or login observation',async()=>{
  if(!process.env.SOMA_BLACKBOARD_OWNER_EMAIL)throw new Error('Explicit owner scope is required.');
  const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_BLACKBOARD_OWNER_EMAIL),rootId=createHash('sha256').update(user.uid).digest('hex');
  const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
  const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
  const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);if(!account)throw new Error('Explicit account unavailable.');
  const denied=new Set<string>(),original=policy.isAllowedBlackboardRequest;
  const spy=vi.spyOn(policy,'isAllowedBlackboardRequest').mockImplementation((request,ids,mode)=>{
   const allowed=original(request,ids,mode);
   if(!allowed){try{const url=new URL(request.url);denied.add(`${request.method} ${request.resourceType} ${url.origin}${url.pathname.replace(/_\d+_\d+/g,'[course]').replace(/\b\d{4,}\b/g,'[id]')}`);}catch{}}
   return allowed;
  });
  try{const result=await discoverBlackboardCourses(account);expect(result.catalog.courses.length).toBeGreaterThan(0);process.stdout.write(JSON.stringify({courses:result.catalog.courses.length,complete:result.catalog.complete,modelCalls:0})+'\n');}
  finally{spy.mockRestore();if(denied.size)console.log(JSON.stringify({blockedReadRoutes:[...denied].slice(0,25)}));}
 },120_000);
 it.skipIf(!process.env.SOMA_BLACKBOARD_TEST_COURSE_QUERY)('reads one explicitly scoped course text slice without persistence or inference',async()=>{
  const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_BLACKBOARD_OWNER_EMAIL!),rootId=createHash('sha256').update(user.uid).digest('hex');
  const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
  const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
  const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);if(!account)throw new Error('Explicit account unavailable.');
  const status=await blackboardStatus(account),course=status.catalog.courses.find(item=>new RegExp(process.env.SOMA_BLACKBOARD_TEST_COURSE_QUERY!,'i').test(item.code+' '+item.title));if(!course)throw new Error('The explicitly requested course is not in the verified catalog.');
  const result=await withBrowserRead(account,'blackboard',request=>policy.isAllowedBlackboardRequest(request,[course.id],'collect'),async({page,deadline})=>{
   if(process.env.SOMA_BLACKBOARD_READ_DIAGNOSTICS==='true'){
    const raw=await readBlackboardJson(page.request,`/learn/api/v1/courses/${course.id}/contents?limit=20`,{courseIds:[course.id]},deadline) as {paging?:{nextPage?:string};results?:{contentHandler?:{id?:string}}[]};
    const next=raw.paging?.nextPage,parsed=next?new URL(next,'https://learn.bu.edu'):undefined;
    console.log(JSON.stringify({pagingKeys:Object.keys(raw.paging??{}),nextShape:parsed?{origin:parsed.origin,path:parsed.pathname.replace(/_[A-Za-z0-9]+_[A-Za-z0-9]+/g,'[id]'),queryKeys:[...parsed.searchParams.keys()],absolute:next?.startsWith('http'),leadingSlash:next?.startsWith('/')}:null,handlers:[...new Set(raw.results?.map(item=>{const value=item.contentHandler;return typeof value==='string'&&/^[A-Za-z0-9_+\/-]{1,80}$/.test(value)?value:typeof value}))],itemShapes:raw.results?.slice(0,3).map(item=>Object.fromEntries(Object.entries(item).filter(([key])=>['body','contentDetail','contentHandler'].includes(key)).map(([key,value])=>[key,{type:typeof value,keys:value&&typeof value==='object'?Object.keys(value):[]}])) )}));
   }
   let result=await collectBlackboardMaterials(page,course.id,undefined,deadline);
   for(let pass=1;pass<3&&result.cursor&&!result.records.length;pass++){const next=await collectBlackboardMaterials(page,course.id,result.cursor,deadline);result={...next,warnings:result.warnings+next.warnings};}
   return {value:result};
  });
  process.stdout.write(JSON.stringify({textItems:result.records.length,complete:result.complete,warnings:result.warnings,pendingPages:result.cursor?.pending.length??0,modelCalls:0,persistedMaterial:0})+'\n');
  expect(result.records.length).toBeGreaterThan(0);
 },120_000);

 it.skipIf(process.env.SOMA_BLACKBOARD_SELECTED_READ!=='true')('publishes one explicitly selected semester slice and verifies saved observations',async()=>{
  if(!process.env.SOMA_BLACKBOARD_OWNER_EMAIL||!process.env.SOMA_BLACKBOARD_SEMESTER_PREFIX)throw new Error('Explicit owner and semester scope required.');
  const user=await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_BLACKBOARD_OWNER_EMAIL),rootId=createHash('sha256').update(user.uid).digest('hex');
  const metadata=(await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
  const capability=verifyWorkerRequest(new Request('https://soma.example/api/internal/worker',{headers:{authorization:`Bearer ${process.env.SOMA_WORKER_SECRET}`}}));
  const account=await verifyWorkerAccount(capability,rootId,metadata?.workspaceId);if(!account)throw new Error('Explicit account unavailable.');
  const status=await blackboardStatus(account),expected=status.catalog.courses.filter(course=>course.code?.startsWith(process.env.SOMA_BLACKBOARD_SEMESTER_PREFIX!)).map(course=>course.id).sort();
  expect(expected.length).toBeGreaterThan(0);expect(status.selected.map(choice=>choice.id).sort()).toEqual(expected);
  let phase='audit';
  try{
   const collected=await auditedSourceCollection(account,'blackboard',()=>{phase='collection';return refreshBrowser(account,'blackboard');},result=>result.workspace);
   phase='readback';const saved=await readAccountWorkspace(account);expect(saved).toBeTruthy();
   expect(saved!.sources).toEqual(collected.value.workspace.sources);
   if(collected.auditComplete){phase='handoff';await queueCollectedPreparation(account,collected.value.workspace,'blackboard:browser-blackboard:');}
   console.log(JSON.stringify({selectedCourses:status.selected.length,notice:collected.value.notice,auditComplete:collected.auditComplete,savedBlackboardVersions:saved!.sources.filter(source=>source.kind==='blackboard'&&source.origin==='live').length,modelCalls:0}));
  }catch(error){
   const e=error as {name?:string;code?:string|number;status?:number;stack?:string};
   const frames=e.stack?.split('\n').filter(line=>/^\s+at /.test(line)).slice(0,5).map(line=>line.replace(/(?:https?|wss):\/\/\S+/g,'[location]').replace(/\([^)]*\)/g,'(location withheld)'));
   throw new Error(JSON.stringify({phase,name:e.name,code:e.code,status:e.status,frames}));
  }
 },120_000);

});
