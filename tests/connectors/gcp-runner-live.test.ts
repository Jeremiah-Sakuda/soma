import {randomUUID,createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {describe,it,expect} from 'vitest';
import {chromium} from 'playwright-core';

/** Original synthetic browser state only. No course account or Meta call. */
describe.skipIf(process.env.SOMA_GCP_RUNNER_LIVE_TEST!=='true')('GCP deployed browser runtime',()=>{
 it('proves private invocation, browser sandbox startup, CDP, encrypted restart and metadata denial',async()=>{
  const origin=process.env.SOMA_GCP_BROWSER_URL,projectId=process.env.SOMA_GCP_BROWSER_PROJECT_ID;
  if(!origin||!projectId)throw new Error('Explicit deployed runner scope required.');
  const control=readFileSync('.local/gcp-browser-secrets/control','utf8');
  const identity=execFileSync('gcloud',['auth','print-identity-token','--quiet'],{encoding:'utf8'}).trim();
  const owner=createHash('sha256').update('synthetic-gcp:'+randomUUID()).digest('hex');
  const headers={Authorization:'Bearer '+control,'X-Serverless-Authorization':'Bearer '+identity,'X-Soma-Owner':owner,'Content-Type':'application/json'};
  const call=async(path:string,method='GET',body?:unknown)=>fetch(origin+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(65000),redirect:'error'});
  const anonymous=await fetch(origin+'/healthz',{signal:AbortSignal.timeout(15000)});expect([401,403]).toContain(anonymous.status);
  expect((await call('/healthz')).status).toBe(200);
  const contextResponse=await call('/v1/contexts','POST',{projectId,userMetadata:{somaOwner:owner}});expect(contextResponse.status).toBe(201);
  const context=await contextResponse.json() as {id:string};let sessionId:string|undefined,browser:Awaited<ReturnType<typeof chromium.connectOverCDP>>|undefined;
  const start=async()=>{
   const response=await call('/v1/sessions','POST',{projectId,timeout:180,keepAlive:true,browserSettings:{context:{id:context.id,persist:true},recordSession:false,logSession:false,solveCaptchas:false},userMetadata:{somaOwner:owner}});
   if(response.status!==201){const body=await response.json() as {code?:string};throw new Error(`Synthetic runner start failed: ${response.status}/${body.code??'unknown'}`);}
   const session=await response.json() as {id:string;connectUrl:string};sessionId=session.id;
   browser=await chromium.connectOverCDP(session.connectUrl,{headers,timeout:20000});return browser.contexts()[0];
  };
  const release=async()=>{if(browser){await browser.close();browser=undefined;}if(sessionId){const response=await call('/v1/sessions/'+sessionId,'POST',{status:'REQUEST_RELEASE'});expect(response.status).toBe(200);sessionId=undefined;}};
  try{
   let contextBrowser=await start(),page=await contextBrowser.newPage();
   await page.goto('https://example.com/',{waitUntil:'domcontentloaded',timeout:25000});
   await contextBrowser.addCookies([{name:'soma_synthetic',value:'original-synthetic-state',domain:'example.com',path:'/',secure:true,httpOnly:true,sameSite:'Lax'}]);
   await page.evaluate(async()=>{localStorage.setItem('soma-synthetic','retained');await new Promise<void>((resolve,reject)=>{const request=indexedDB.open('soma-synthetic',1);request.onupgradeneeded=()=>request.result.createObjectStore('values');request.onerror=()=>reject(new Error('Synthetic database unavailable.'));request.onsuccess=()=>{const db=request.result,transaction=db.transaction('values','readwrite');transaction.objectStore('values').put('retained','key');transaction.oncomplete=()=>{db.close();resolve();};transaction.onerror=()=>reject(new Error('Synthetic write failed.'));};});});
   const blocked=await contextBrowser.newPage();const response=await blocked.goto('http://169.254.169.254/computeMetadata/v1/',{timeout:10000});expect(response?.status()).toBe(403);await blocked.close();
   await release();contextBrowser=await start();page=await contextBrowser.newPage();await page.goto('https://example.com/',{waitUntil:'domcontentloaded',timeout:25000});
   expect((await contextBrowser.cookies('https://example.com')).some(cookie=>cookie.name==='soma_synthetic'&&cookie.value==='original-synthetic-state')).toBe(true);
   expect(await page.evaluate(()=>localStorage.getItem('soma-synthetic'))).toBe('retained');
   expect(await page.evaluate(()=>new Promise((resolve,reject)=>{const request=indexedDB.open('soma-synthetic',1);request.onerror=()=>reject(new Error('Synthetic restore failed.'));request.onsuccess=()=>{const db=request.result,get=db.transaction('values').objectStore('values').get('key');get.onsuccess=()=>{db.close();resolve(get.result);};get.onerror=()=>reject(new Error('Synthetic restore failed.'));};}))).toBe('retained');
   await release();expect((await call('/v1/contexts/'+context.id,'DELETE')).status).toBe(204);expect((await call('/v1/contexts/'+context.id)).status).toBe(404);
   process.stdout.write(JSON.stringify({syntheticGcpRuntime:true,anonymousDenied:true,stateRestored:['cookies','localStorage','IndexedDB'],metadataDenied:true,contextDeleted:true,modelCalls:0})+'\n');
  }finally{if(browser)await browser.close().catch(()=>undefined);if(sessionId)await call('/v1/sessions/'+sessionId,'POST',{status:'REQUEST_RELEASE'}).catch(()=>undefined);await call('/v1/contexts/'+context.id,'DELETE').catch(()=>undefined);}
 },150000);
});
