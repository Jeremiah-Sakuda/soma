import {createServer} from 'node:http';
import {randomUUID} from 'node:crypto';
import {afterEach,describe,it,expect,vi} from 'vitest';
import {createCredentialRunner} from '../../services/credential-runner/server.mjs';
import {checkFormFacts,allowedOrigin,allowedUrl} from '../../services/credential-runner/policy.mjs';
const cleanup:Array<()=>Promise<void>>=[];
afterEach(async()=>{for(const close of cleanup.splice(0))await close();});
const owner='a'.repeat(64),other='b'.repeat(64),key='k'.repeat(48),origin='https://credential.example.com';
function deferred(){let resolve!:(value?:unknown)=>void;const promise=new Promise(r=>resolve=r);return{promise,resolve};}
async function harness(options:{holdDecrypt?:ReturnType<typeof deferred>,secretCookie?:string}={}){
 let active:any=null,authorized=true,clock=Date.now(),version='v1',closed=0,saved:any=null;
 const consumed=new Set<string>();
 const store={inspect:vi.fn(async()=>({active})),claim:vi.fn(async(_id:string,_owner:string,id:string,expiresAt:number)=>{if(active)throw Error('busy');active={id,expiresAt};return {storageState:null};}),abandon:vi.fn(async()=>{active=null;}),finish:vi.fn(async(_id:string,_owner:string,_session:string,state:any)=>{saved=state;active=null;})};
 const vault={metadata:vi.fn(async()=>({status:'active',version})),save:vi.fn(async()=>({status:'active',version})),decrypt:vi.fn(async()=>{await options.holdDecrypt?.promise;return {identifier:'student@bu.edu',password:'sensitive-canary'};}),forget:vi.fn(async()=>{version='forgotten';return {status:'forgotten',version};})};
 const browser={inspect:vi.fn(async()=>({reviewed:true})),fill:vi.fn(async(_secret:any,recheck:()=>Promise<void>)=>{await recheck();}),safeForViewer:vi.fn(async()=>true),snapshot:vi.fn(async()=>({cookies:options.secretCookie?[{value:options.secretCookie}]:[],origins:[]})),close:vi.fn(async()=>{closed++;}),view:vi.fn(async()=>{})};
 const runner=createCredentialRunner({store,vault,grantStore:{consume:async(id:string)=>{if(consumed.has(id))throw Object.assign(Error('replay'),{code:'grant_replayed',status:409});consumed.add(id);}},engine:{start:async()=>browser},authorize:async()=>{if(!authorized)throw Object.assign(Error('revoked'),{code:'revoked',status:403});return {identifier:'student@bu.edu'};},controlKey:key,publicOrigin:origin,proxyUrl:'http://127.0.0.1:1',now:()=>clock});
 await new Promise<void>((resolve,reject)=>{runner.server.once('error',reject);runner.server.listen(0,'127.0.0.1',resolve);});const port=(runner.server.address() as any).port;
 cleanup.push(()=>runner.close());
 const request=async(path:string,data?:any,{human=false,cookie='',ownerOverride=owner,method=data===undefined?'GET':'POST'}={})=>{const headers:any={'content-type':'application/json'};if(human){headers.origin=origin;if(cookie)headers.cookie=cookie;}else{headers.authorization='Bearer '+key;headers['x-soma-owner']=ownerOverride;}return fetch(`http://127.0.0.1:${port}${path}`,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});};
 const grant={uid:'firebase-user',workspaceId:'workspace',workspaceGeneration:'workspace',provider:'blackboard',contextId:randomUUID(),connectionVersion:1,recentAuthAt:Math.floor(clock/1000),authorizationId:randomUUID()};
 const create=async()=>{const response=await request('/v1/grants',grant);expect(response.status).toBe(201);return response.json();};
 const bootstrap=async(session:any)=>{const response=await request(`/login/${session.sessionId}/bootstrap`,{token:new URL(session.loginUrl).hash.slice(1)},{human:true});expect(response.status).toBe(200);return response.headers.get('set-cookie')!.split(';')[0];};
 return{request,grant,create,bootstrap,browser,vault,store,get saved(){return saved;},get closed(){return closed;},revoke:()=>{authorized=false;},rotate:()=>{version='v2';},expire:()=>{clock+=31*60_000;}};
}
describe('isolated credential login boundary',()=>{
 it('one-use fragment becomes scoped HttpOnly cookie, blocks replay and owner crossover',async()=>{
  const h=await harness(),session=await h.create();expect(session.sessionId).toBe(h.grant.authorizationId);expect(session).not.toHaveProperty('connectUrl');
  const cookie=await h.bootstrap(session);expect(cookie).toContain('__Secure-soma_credential=');
  const replay=await h.request(`/login/${session.sessionId}/bootstrap`,{token:new URL(session.loginUrl).hash.slice(1)},{human:true});expect(replay.status).toBe(401);
  expect((await h.request(`/v1/sessions/${session.sessionId}`,undefined,{ownerOverride:other})).status).toBe(404);
  expect((await h.request('/cdp/'+session.sessionId)).status).toBe(404);
 });
 it('fills once, emits no plaintext, exports auth only, and rejects durable grant reuse',async()=>{
  const h=await harness(),session=await h.create(),cookie=await h.bootstrap(session);
  const response=await h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie});expect(response.status).toBe(200);expect(await response.text()).not.toContain('sensitive-canary');expect(h.browser.fill).toHaveBeenCalledTimes(1);
  expect((await h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie})).status).toBe(409);
  expect((await h.request(`/v1/sessions/${session.sessionId}/release`,{})).status).toBe(200);expect(h.saved).toEqual({cookies:[],origins:[]});
  expect((await h.request('/v1/grants',h.grant)).status).toBe(409);
 });
 it('only the app broker may persist the authenticated browser handoff',async()=>{
  const h=await harness(),session=await h.create(),cookie=await h.bootstrap(session);
  expect((await h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie})).status).toBe(200);
  expect((await h.request(`/login/${session.sessionId}/release`,{}, {human:true,cookie})).status).toBe(404);expect(h.store.finish).not.toHaveBeenCalled();
 });
 it('a failed browser close can be retried without overwriting the saved context',async()=>{
  const h=await harness(),session=await h.create(),cookie=await h.bootstrap(session);
  expect((await h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie})).status).toBe(200);
  h.browser.close.mockRejectedValueOnce(new Error('synthetic close failure'));
  expect((await h.request(`/v1/sessions/${session.sessionId}/release`,{})).status).toBe(503);expect(h.store.finish).toHaveBeenCalledTimes(1);
  expect((await h.request(`/v1/sessions/${session.sessionId}`,{}, {method:'DELETE'})).status).toBe(204);expect(h.store.finish).toHaveBeenCalledTimes(1);expect(h.browser.close).toHaveBeenCalledTimes(2);
 });
 it('revocation during KMS unwrap prevents any browser fill',async()=>{
  const hold=deferred(),h=await harness({holdDecrypt:hold}),session=await h.create(),cookie=await h.bootstrap(session);
  const pending=h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie});await vi.waitFor(()=>expect(h.vault.decrypt).toHaveBeenCalled());h.revoke();hold.resolve();expect((await pending).status).toBe(403);expect(h.browser.fill).not.toHaveBeenCalled();expect(h.closed).toBe(1);
 });
 it('concurrent redemption consumes only one fill and origin spoofing has no cookie bypass',async()=>{
  const hold=deferred(),h=await harness({holdDecrypt:hold}),session=await h.create(),cookie=await h.bootstrap(session);
  const pending=h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie});await vi.waitFor(()=>expect(h.vault.decrypt).toHaveBeenCalled());
  expect((await h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie})).status).toBe(409);
  expect((await h.request(`/login/${session.sessionId}/status`,{}, {cookie})).status).toBe(403);
  hold.resolve();expect((await pending).status).toBe(200);expect(h.browser.fill).toHaveBeenCalledTimes(1);
 });
 it('session expiry during unwrap closes the browser before any fill',async()=>{
  const hold=deferred(),h=await harness({holdDecrypt:hold}),session=await h.create(),cookie=await h.bootstrap(session);
  const pending=h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie});await vi.waitFor(()=>expect(h.vault.decrypt).toHaveBeenCalled());h.expire();hold.resolve();expect((await pending).status).toBe(404);expect(h.browser.fill).not.toHaveBeenCalled();
 });
 it('credential rotation during unwrap prevents fill',async()=>{
  const hold=deferred(),h=await harness({holdDecrypt:hold}),session=await h.create(),cookie=await h.bootstrap(session);
  const pending=h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie});await vi.waitFor(()=>expect(h.vault.decrypt).toHaveBeenCalled());h.rotate();hold.resolve();expect((await pending).status).toBe(409);expect(h.browser.fill).not.toHaveBeenCalled();
 });
 it('cookie-prefix escaped and encoded secret canaries cannot enter handoff',async()=>{
  for(const secretCookie of ['prefix:sensitive-canary:suffix',encodeURIComponent('prefix:sensitive-canary'),Buffer.from('sensitive-canary').toString('base64')]){
   const h=await harness({secretCookie}),session=await h.create(),cookie=await h.bootstrap(session);expect((await h.request(`/login/${session.sessionId}/fill`,{version:'v1'},{human:true,cookie})).status).toBe(200);
   const release=await h.request(`/v1/sessions/${session.sessionId}/release`,{});expect(release.status).toBe(503);expect(h.saved).toBeNull();
  }
 });
 it('explicit enrollment requires opt-in and exact verified BU identity',async()=>{
  const h=await harness(),session=await h.create(),cookie=await h.bootstrap(session);
  const response=await h.request(`/login/${session.sessionId}/save-fill`,{identifier:'foreign@bu.edu',password:'not-a-real-password',consent:true,version:'v1'},{human:true,cookie});expect(response.status).toBe(403);expect(h.vault.save).not.toHaveBeenCalled();expect(h.browser.fill).not.toHaveBeenCalled();
 });
 it('destructive control cleanup forgets even without live owner authorization',async()=>{
  const h=await harness();await h.create();h.revoke();const response=await h.request('/v1/credentials',{owner,workspaceId:'workspace',workspaceGeneration:'workspace',provider:'blackboard',origin:'https://shib.bu.edu'},{method:'DELETE'});expect(response.status).toBe(200);expect(h.vault.forget).toHaveBeenCalled();expect(h.closed).toBe(1);
 });
 it('expired auth cannot create grants; no CORS entry or arbitrary paths',async()=>{
  const h=await harness();h.expire();expect((await h.request('/v1/grants',h.grant)).status).toBe(400);const response=await h.request('/health');expect(response.headers.get('access-control-allow-origin')).toBeNull();expect((await h.request('/v1/control')).status).toBe(404);
 });
});
it('reviewed form and network policy reject lookalikes, frames, GET and external targets',()=>{
 const valid={topOrigin:'https://shib.bu.edu',frameCount:1,pageCount:1,forms:1,passwords:1,identifiers:1,method:'post',target:'',actionOrigin:'https://shib.bu.edu',actionPath:'/idp/profile/SAML2/Redirect/SSO',identifierType:'text',passwordType:'password',submitters:1};
 expect(checkFormFacts(valid)).toBe(true);for(const change of [{frameCount:2},{method:'get'},{target:'_blank'},{actionOrigin:'https://shib.bu.edu.evil.com'}])expect(()=>checkFormFacts({...valid,...change})).toThrow();
 expect(allowedUrl('https://shib.bu.edu/idp')).toBe(true);for(const url of ['http://shib.bu.edu/idp','https://shib.bu.edu:8443/idp','https://shib.bu.edu.evil.com/','https://127.0.0.1/','https://shib.bu.edu@evil.com/'])expect(allowedUrl(url)).toBe(false);expect(allowedOrigin('piazza','https://shib.bu.edu')).toBe(false);
});
