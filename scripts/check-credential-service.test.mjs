import test from 'node:test';
import assert from 'node:assert/strict';
import {checkCredentialService} from './check-credential-service.mjs';
const origin='https://original-synthetic-credential.run.app',key='k'.repeat(48);
function fixture(override={}){
 const calls=[];const sockets=[];
 const fetchImpl=async(raw,options)=>{
  const url=new URL(raw);calls.push({path:url.pathname,options});let status=401,data={error:'fixed'};
  if(url.pathname==='/health'){status=200;data={status:'ok',protocol:'credential-login-v1'};}
  else if(url.pathname==='/v1/grants'&&options.headers.authorization){status=403;data={code:'credential_authorization'};}
  else if(url.pathname.startsWith('/v1/sessions/')&&options.headers.authorization)status=404;
  else if(url.pathname.startsWith('/cdp/')&&options.headers.authorization)status=404;
  else if(url.pathname.endsWith('/bootstrap'))status=404;
  if(override[url.pathname])({status,data}=override[url.pathname]);
  return new Response(JSON.stringify(data),{status});
 };
 const upgradeImpl=async(raw,path,headers)=>{assert.equal(raw,origin);sockets.push({path,headers});};
 return {calls,sockets,fetchImpl,upgradeImpl};
}
test('hosted verification is bounded and exposes neither keys nor synthetic principal facts',async()=>{
 const fake=fixture();const result=await checkCredentialService({origin,controlKey:key,brokerDenial:true,...fake});assert.equal(result.checks,11);assert.equal(fake.calls.length,8);assert.equal(fake.sockets.length,3);
 assert(!JSON.stringify(result).includes(key));assert(!JSON.stringify(result).includes('original-synthetic-hosted-credential-check'));
 const grant=fake.calls.find(call=>call.path==='/v1/grants'&&call.options.headers.authorization);const body=JSON.parse(grant.options.body);assert.equal(body.workspaceGeneration,body.workspaceId);assert.equal(body.provider,'blackboard');assert(!Object.hasOwn(body,'password'));assert(!Object.hasOwn(body,'owner'));
 assert(fake.calls.every(call=>!call.path.includes('credentials')&&!call.path.includes('contexts')));
});
test('a generic browser health response fails before sending further checks',async()=>{
 const fake=fixture({'/health':{status:200,data:{status:'ok'}}});await assert.rejects(checkCredentialService({origin,...fake}),/response contract failed/);assert.equal(fake.calls.length,1);
});
test('an accepted unauthorized broker request fails the check',async()=>{
 const fake=fixture({'/v1/grants':{status:200,data:{status:'unexpected'}}});await assert.rejects(checkCredentialService({origin,...fake}),/unexpected HTTP status 200/);assert.equal(fake.calls.length,2);
});
test('HTTP and noncanonical service origins cannot receive a control key',async()=>{
 for(const value of ['http://original-synthetic-credential.run.app','https://original-synthetic-credential.run.app/','https://untrusted.example.com']){const fake=fixture();await assert.rejects(checkCredentialService({origin:value,controlKey:key,brokerDenial:true,...fake}));assert.equal(fake.calls.length,0);}
});
