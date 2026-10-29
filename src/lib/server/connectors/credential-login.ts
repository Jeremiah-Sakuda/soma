import {credentialServiceSettings,credentialAutofillConfigured,credentialAutofillUidAllowed,validateCredentialLoginUrl} from './credential-settings';
export {credentialServiceSettings,credentialAutofillConfigured,credentialAutofillUidAllowed,validateCredentialLoginUrl} from './credential-settings';
import {createHash,randomUUID} from 'node:crypto';
import {z} from 'zod';
import {assertVerifiedAccount,type VerifiedAccount} from '../account';
import {WorkspaceStoreError} from '../store';
import {configureBrowser,resolveBrowserProjectId,recoverExpiredManualBrowserSession,type BrowserProvider,type Configuration} from './browser';
import {browserControlRequest,recordedBrowserBackend} from './browser-hosting';
import {acquireConnectionLease,checkpointConnectionLease,readConnection,releaseConnectionLease,type Connection} from './store';
import {clearCredentialAuthorizationReference,createCredentialAuthorization,revokeCredentialAuthorization,type CredentialGrant} from './credential-grants';

export type CredentialSession={authorizationId:string;sessionId:string;expiresAt:string};
export type CredentialBrowserSecret={backend?:'gcp'|'browserbase';version?:1;contextId?:string;sessionId?:string;sessionExpiresAt?:string;credentialLogin?:CredentialSession;credentialVault?:true;day?:string;starts?:number};
type Saved=Connection<CredentialBrowserSecret,Configuration>;
const fail=(message='Secure autofill is unavailable. You can still use the manual sign-in window.',status=503)=>new WorkspaceStoreError(message,status,'credential_service');
const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
const owner=(connection:Pick<Saved,'id'|'workspaceId'>)=>digest(`${connection.workspaceId}:${connection.id}`);
async function control(connection:Pick<Saved,'id'|'workspaceId'>,path:string,method='GET',body?:unknown){
  if(!/^\/v1\/(?:grants|credentials|sessions\/[a-f0-9-]{36}(?:\/release)?)$/.test(path))throw fail();
  const config=credentialServiceSettings(false);
  try{
    const response=await fetch(config.origin+path,{method,headers:{authorization:`Bearer ${config.key}`,'X-Soma-Owner':owner(connection),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(60000)});
    if(!response.ok)throw fail();if(response.status===204)return undefined;
    const text=await response.text();if(text.length>16384)throw fail();return JSON.parse(text) as unknown;
  }catch{throw fail('The secure sign-in service did not confirm the operation. Saved cleanup references were retained; retry or cancel.');}
}
export async function credentialLoginStatus(account:VerifiedAccount){
  assertVerifiedAccount(account);const configured=credentialAutofillConfigured(account.uid);
  const saved=await readConnection<CredentialBrowserSecret,Configuration>(account,'browser-blackboard');
  return {configured,...(configured?{origin:credentialServiceSettings().origin}:{}),providers:[{provider:'blackboard' as const,available:configured,stored:!!saved?.secret.credentialVault,...(saved?.secret.credentialLogin?{active:{expiresAt:saved.secret.credentialLogin.expiresAt}}:{})}]};
}
function withoutCredentialSession(secret:CredentialBrowserSecret){const {credentialLogin:_,...rest}=secret;return rest;}
/** Revoke first, then clean up; the caller holds the normal connection lease. */
export async function cancelCredentialSession(account:VerifiedAccount,connection:Saved){
  const ref=connection.secret.credentialLogin;if(!ref)return;
  await revokeCredentialAuthorization(account,connection.workspaceId,ref.authorizationId);
  await control(connection,`/v1/sessions/${ref.sessionId}`,'DELETE',{contextId:connection.secret.contextId});
  await clearCredentialAuthorizationReference(account,connection.workspaceId,ref.authorizationId);
  connection.secret=withoutCredentialSession(connection.secret);
}
export async function openCredentialLogin(account:VerifiedAccount,provider:BrowserProvider,recentAuthAt:number){
  assertVerifiedAccount(account);credentialServiceSettings();if(!credentialAutofillUidAllowed(account.uid))throw fail('Secure autofill is not available for this account. You can still use manual sign-in.',403);if(provider!=='blackboard')throw fail('Secure autofill is currently available only for BU Blackboard.',400);
  const id=`browser-${provider}`;
  const existing=await readConnection(account,id);
  if(!existing||existing.status==='disconnected')await configureBrowser(account,provider,[]);
  const {connection,leaseId}=await acquireConnectionLease<CredentialBrowserSecret,Configuration>(account,id,'credential-login',120000);
  try{
    if(connection.secret.credentialLogin)throw fail('Finish or cancel the existing secure sign-in before opening another.',409);
    if(recordedBrowserBackend(connection.secret)!=='gcp'){
      if(connection.secret.contextId||connection.secret.sessionId)throw fail('Reconnect this provider with the Google Cloud browser before setting up secure autofill.',409);
      connection.secret={...connection.secret,backend:'gcp',version:1};
    }
    // Reconcile only expired references confirmed absent by their own runner.
    // Active, early-missing, foreign and uncertain sessions remain untouched.
    if(connection.secret.sessionId)await recoverExpiredManualBrowserSession(account,connection,leaseId);
    if(!connection.secret.contextId){
      const data=z.object({id:z.string().uuid()}).parse(await browserControlRequest('gcp',owner(connection),'/contexts','POST',{projectId:await resolveBrowserProjectId('gcp'),userMetadata:{somaOwner:owner(connection)}}));
      connection.secret={...connection.secret,contextId:data.id};
      if(!await checkpointConnectionLease(account,id,leaseId,{secret:connection.secret}))throw fail('Source authorization changed. Reconnect to retry.',409);
    }
    const day=new Date().toISOString().slice(0,10),starts=connection.secret.day===day?connection.secret.starts??0:0;
    if(starts>=24)throw fail('This provider has reached today’s browser-session limit.',429);
    const authorizationId=randomUUID(),expiresAt=new Date(Date.now()+1800000).toISOString();
    connection.secret={...connection.secret,day,starts:starts+1,credentialVault:true,credentialLogin:{authorizationId,sessionId:authorizationId,expiresAt}};
    if(!await checkpointConnectionLease(account,id,leaseId,{secret:connection.secret}))throw fail('Source authorization changed. Reconnect to retry.',409);
    const grant:CredentialGrant={authorizationId,uid:account.uid,owner:owner(connection),workspaceId:connection.workspaceId,workspaceGeneration:connection.workspaceId,provider,contextId:connection.secret.contextId!,connectionVersion:connection.version,recentAuthAt};
    await createCredentialAuthorization(account,grant,leaseId);
    const {owner:_owner,...grantBody}=grant;
    const raw=await control(connection,'/v1/grants','POST',grantBody);
    const result=z.object({sessionId:z.string().uuid(),loginUrl:z.string().url(),expiresAt:z.string().datetime()}).parse(raw);
    // Service allocation follows its authorization round-trip. Its later local
    // clock cannot extend the original durable app grant, checked on every use.
    if(result.sessionId!==authorizationId||Date.parse(result.expiresAt)>Date.parse(expiresAt)+60000||Date.parse(result.expiresAt)<=Date.now())throw fail();
    const loginUrl=validateCredentialLoginUrl(result.loginUrl,authorizationId);
    connection.secret.credentialLogin!.expiresAt=result.expiresAt;
    if(!await releaseConnectionLease(account,id,leaseId,{secret:connection.secret,status:'connecting',notice:'Secure sign-in is open. Complete MFA, then save the session in Soma.'}))throw fail('Source authorization changed. Cancel secure sign-in and retry.',409);
    return {loginUrl,expiresAt:result.expiresAt,notice:'Open the separate secure sign-in service. Storing a password is optional and requires your consent there. MFA remains yours to complete.'};
  }catch(error){await releaseConnectionLease(account,id,leaseId,{secret:connection.secret,notice:'Secure sign-in did not finish. Cancel to confirm cleanup before trying again.'});throw error;}
}
export async function finishCredentialLogin(account:VerifiedAccount,provider:BrowserProvider,cancel=false){
  if(provider!=='blackboard')throw fail('Unsupported secure sign-in provider.',400);
  const {connection,leaseId}=await acquireConnectionLease<CredentialBrowserSecret,Configuration>(account,`browser-${provider}`,cancel?'credential-cancel':'credential-complete');
  try{
    const ref=connection.secret.credentialLogin;if(!ref)throw fail('No secure sign-in is pending.',409);
    if(cancel)await cancelCredentialSession(account,connection);
    else{
      await control(connection,`/v1/sessions/${ref.sessionId}/release`,'POST',{});
      await revokeCredentialAuthorization(account,connection.workspaceId,ref.authorizationId);
      await clearCredentialAuthorizationReference(account,connection.workspaceId,ref.authorizationId);
      connection.secret=withoutCredentialSession(connection.secret);
    }
    if(!await releaseConnectionLease(account,connection.id,leaseId,{secret:connection.secret,status:cancel?'login-required':'connected',notice:cancel?'Secure sign-in cancelled. Stored password, if any, is separate; forget it in the secure vault.':'Saved browser authorization. Refresh to verify access to selected courses.'}))throw fail('Source authorization changed. Retry cleanup.',409);
    return {notice:cancel?'Secure sign-in cancelled. Existing saved authorization and any stored password are separate.':'Saved browser authorization. Selected-course access is not verified until Refresh succeeds.'};
  }catch(error){await releaseConnectionLease(account,connection.id,leaseId,{secret:connection.secret});throw error;}
}
/** Workspace deletion also removes this generation's optional vault record. */
export async function forgetCredentialVault(account:VerifiedAccount,connection:Saved){
  if(!connection.secret.credentialVault&&!connection.secret.credentialLogin)return;
  if(connection.secret.credentialLogin)await cancelCredentialSession(account,connection);
  await control(connection,'/v1/credentials','DELETE',{owner:owner(connection),workspaceId:connection.workspaceId,workspaceGeneration:connection.workspaceId,provider:'blackboard',origin:'https://shib.bu.edu'});
  const {credentialVault:_,...rest}=connection.secret;connection.secret=rest;
}
export async function forgetStoredCredential(account:VerifiedAccount){
  const {connection,leaseId}=await acquireConnectionLease<CredentialBrowserSecret,Configuration>(account,'browser-blackboard','credential-forget');
  try{
    await forgetCredentialVault(account,connection);
    if(!await releaseConnectionLease(account,connection.id,leaseId,{secret:connection.secret,notice:'Stored sign-in forgotten. Existing provider authorization is separate; disconnect to remove that too.'}))throw fail('Source authorization changed. Retry cleanup.',409);
    return {notice:'Stored sign-in forgotten. Existing provider authorization is separate; disconnect to remove that too.'};
  }catch(error){await releaseConnectionLease(account,connection.id,leaseId,{secret:connection.secret});throw error;}
}
