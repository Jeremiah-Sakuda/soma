import {chromium} from 'playwright-core';
import {createChromiumEngine} from '../browser-runner/engine.mjs';
import {allowedUrl,checkFormFacts,START_URL,LOGIN_ORIGIN} from './policy.mjs';
function containsSecretUrl(value,canaries){let decoded=value;for(let count=0;count<4;count++){if(canaries.some(secret=>decoded.includes(secret)))return true;try{const next=decodeURIComponent(decoded.replace(/\+/g,' '));if(next===decoded)break;decoded=next;}catch{break;}}return false;}
const unavailable=()=>{throw Object.assign(new Error('Reviewed login form unavailable.'),{code:'form_not_reviewed',status:409});};
function defaultEngine(){return createChromiumEngine({async launchPersistentContext(directory,options){
 const proxyUrl=options.args.find(argument=>argument.startsWith('--proxy-server='))?.slice('--proxy-server='.length);if(!proxyUrl)unavailable();
 // APIRequestContext (route.fetch) must use the same strict proxy as Chromium.
 return chromium.launchPersistentContext(directory,{...options,proxy:{server:proxyUrl}});
}});}
export function createLoginEngine(engine=defaultEngine()) {
 return { async start(options) {
  // Credential enrollment starts a fresh SSO request. Existing authorization
  // remains encrypted in its claimed GCS context and is preserved on cancellation.
  const browser=await engine.start({...options,state:null}),context=browser.context;
  let invalid=false,submission=null;
  const guard=page=>{
   page.on('popup',()=>{invalid=true;});
   page.on('framenavigated',frame=>{if(frame===page.mainFrame()&&!allowedUrl(frame.url()))invalid=true;});
   page.on('dialog',dialog=>void dialog.dismiss());
  };
  for(const page of context.pages())guard(page);
  context.on('page',page=>{if(context.pages().length>1)invalid=true;guard(page);});
  // This second guard backs the exact-host proxy. No third-party resources,
  // arbitrary schemes or remote data URLs are permitted during login.
  await context.route('**/*',async route=>{
   try{
   const request=route.request();
   if(!allowedUrl(request.url()))return route.abort('blockedbyclient');
   if(submission){
    if(containsSecretUrl(request.url(),submission.canary))return route.abort('blockedbyclient');
    if(!request.isNavigationRequest()||request.frame()!==page.mainFrame())return route.abort('blockedbyclient');
    if(!submission.sent&&request.url()===submission.action&&request.method()==='GET'){
     submission.sent=true;
     await submission.recheck();
     const response=await route.fetch({method:'POST',postData:submission.body,headers:{...request.headers(),'content-type':'application/x-www-form-urlencoded'},maxRedirects:0,timeout:15_000});
     const status=response.status(),headers=response.headers();
     if(Object.values(headers).some(value=>containsSecretUrl(value,submission.canary)))return route.abort('blockedbyclient');
     const responseBody=await response.body();if(responseBody.length>512*1024||containsSecretUrl(responseBody.toString('utf8'),submission.canary))return route.abort('blockedbyclient');
     if([301,307,308].includes(status))return route.abort('blockedbyclient');
     if([302,303].includes(status)){
      const location=response.headers().location;let target;try{target=new URL(location,submission.action).href;}catch{return route.abort('blockedbyclient');}
      if(!location||!allowedUrl(target)||containsSecretUrl(target,submission.canary))return route.abort('blockedbyclient');
      // 303 explicitly drops the credential POST body on the redirect hop.
      return route.fulfill({response,status:303,headers:{...response.headers(),location:target}});
     }
     if(status<200||status>=300)return route.abort('blockedbyclient');
     return route.fulfill({response});
    }
    if(request.method()!=='GET')return route.abort('blockedbyclient');
   }
   return route.continue();
   }catch{await route.abort('blockedbyclient').catch(()=>undefined);}
  });
  let page=context.pages()[0];if(!page)page=await context.newPage();
  const onlyPage=()=>{if(invalid||context.pages().length!==1||page.frames().length!==1)unavailable();};
  try {await page.goto(START_URL,{waitUntil:'domcontentloaded',timeout:30_000});}
  catch {await browser.close();unavailable();}
  async function facts() {
   onlyPage();
   const result=await page.evaluate(()=>{
    const forms=[...document.forms].filter(form=>form.querySelector('input[name="j_password"]'));
    const form=forms[0],user=form?.querySelector('input[name="j_username"]'),password=form?.querySelector('input[name="j_password"]');
    const action=form?new URL(form.getAttribute('action')||location.href,location.href):null;
    const hidden=form?[...form.querySelectorAll('input[type="hidden"]')].map(input=>({name:input.name,value:input.value})):[];
    return {actionUrl:action?.href,hidden,topOrigin:location.origin,forms:forms.length,passwords:document.querySelectorAll('input[type="password"]').length,identifiers:form?.querySelectorAll('input[name="j_username"]').length,method:form?.method.toLowerCase(),target:form?.target,actionOrigin:action?.origin,actionPath:action?.pathname,identifierType:user?.type,passwordType:password?.type,overrides:form?[...form.querySelectorAll('button[name="_eventId_proceed"],input[name="_eventId_proceed"]')].some(button=>['formaction','formmethod','formtarget','formenctype'].some(name=>button.hasAttribute(name))):true,submitters:form?.querySelectorAll('button[name="_eventId_proceed"],input[name="_eventId_proceed"]').length};
   });
   onlyPage();checkFormFacts({...result,pageCount:context.pages().length,frameCount:page.frames().length});if(result.overrides||!Array.isArray(result.hidden)||result.hidden.length>20||result.hidden.some(input=>!['csrf_token','execution','_eventId_proceed'].includes(input.name)||typeof input.value!=='string'||input.value.length>4096))unavailable();return {url:page.url(),action:result.actionUrl,hidden:result.hidden};
  }
  return {
   async inspect(){return {reviewed:await facts().then(()=>true).catch(()=>false)};},
   async fill(secret,recheck){
    const contract=await facts();await recheck();onlyPage();
    if(page.url()!==contract.url)unavailable();
    const parameters=new URLSearchParams(contract.hidden.map(input=>[input.name,input.value]));
    parameters.set('j_username',secret.identifier);parameters.set('j_password',secret.password);parameters.set('_eventId_proceed','');
    submission={action:contract.action,body:parameters.toString(),sent:false,recheck,canary:[secret.password,JSON.stringify(secret.password).slice(1,-1),encodeURIComponent(secret.password),new URLSearchParams({value:secret.password}).toString().slice(6),Buffer.from(secret.password).toString('base64')]};
    // Native navigation with a one-use request override bypasses page input,
    // submit listeners and submitter overrides entirely. The only outgoing
    // credential request is this exact top-level HTTPS POST.
    try{await page.goto(contract.action,{waitUntil:'domcontentloaded',timeout:20_000});if(!submission.sent)unavailable();}
    finally{submission.body='';}
    // No viewer exists yet. Keep it unavailable on an unchanged login page or
    // navigation failure; one attempt only, with no hidden password retry.
    await page.waitForFunction(({origin})=>location.origin!==origin || !document.querySelector('input[type="password"]'),{origin:LOGIN_ORIGIN},{timeout:20_000}).catch(()=>unavailable());
    onlyPage();if(!allowedUrl(page.url()))unavailable();
    await page.evaluate(()=>{for(const input of document.querySelectorAll('input[type="password"],input[name="j_username"]'))input.value='';});
    if(await page.locator('input[type="password"]').count())unavailable();
    const displayed=await page.evaluate(()=>{const text=document.documentElement.textContent??'';const attributes=[...document.querySelectorAll('*')].flatMap(element=>[...element.attributes].map(attribute=>attribute.value));return [text,...attributes];});
    if(!Array.isArray(displayed)||displayed.some(value=>typeof value!=='string')||displayed.reduce((total,value)=>total+value.length,0)>512*1024||displayed.some(value=>containsSecretUrl(value,submission.canary)))unavailable();submission.canary=[];submission=null;
   },
   async safeForViewer(){onlyPage();if(!allowedUrl(page.url())||await page.locator('input[type="password"]').count())unavailable();return true;},
   async view(socket){await this.safeForViewer();const pages=await browser.pages();return browser.view(pages[0].id,socket);},
   async snapshot(){
    await this.safeForViewer();
    if(new URL(page.url()).origin!=='https://learn.bu.edu')unavailable();
    const authenticated=await page.evaluate(async()=>{try{const response=await fetch('/learn/api/v1/users/me',{credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(5000)});if(!response.ok||!response.headers.get('content-type')?.includes('application/json'))return false;const text=await response.text();if(text.length>16384)return false;const value=JSON.parse(text);return typeof value?.id==='string'&&/^[A-Za-z0-9_-]{1,160}$/.test(value.id);}catch{return false;}});
    onlyPage();if(!authenticated||new URL(page.url()).origin!=='https://learn.bu.edu')unavailable();const state=await browser.snapshot();
    // Only auth cookies transfer to collection. Never persist provider local
    // storage, IndexedDB, form state, traces or the temporary Chromium profile.
    return {cookies:state.cookies.filter(cookie=>cookie.secure&&cookie.httpOnly&&cookie.value.length<=4096&&cookie.domain.replace(/^\./,'')==='learn.bu.edu'),origins:[]};
   },
   close:()=>browser.close(),
  };
 }};
}
