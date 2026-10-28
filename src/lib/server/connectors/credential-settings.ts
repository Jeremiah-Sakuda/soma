import {WorkspaceStoreError} from '../store';
import {browserHostingSettings,configuredBrowserBackend} from './browser-hosting';
const fail=()=>new WorkspaceStoreError('Secure autofill is unavailable. You can still use manual sign-in.',503,'credential_service');
function browserConfigured(){try{if(!process.env.SOMA_CONNECTOR_ENCRYPTION_KEY)return false;browserHostingSettings(configuredBrowserBackend());return true;}catch{return false;}}
export function credentialServiceSettings(requireEnabled=true){
  let url:URL;try{url=new URL(process.env.SOMA_CREDENTIAL_RUNNER_URL??'');}catch{throw fail();}
  const key=process.env.SOMA_CREDENTIAL_RUNNER_CONTROL_KEY,authorizationKey=process.env.SOMA_CREDENTIAL_AUTHORIZATION_KEY;
  if((requireEnabled&&process.env.SOMA_CREDENTIAL_AUTOFILL_ENABLED!=='true')||configuredBrowserBackend()!=='gcp'||!browserConfigured()||url.protocol!=='https:'||url.origin!==process.env.SOMA_CREDENTIAL_RUNNER_URL||!url.hostname.endsWith('.run.app')||url.username||url.password||url.port||url.origin===process.env.SOMA_GCP_BROWSER_URL||!key||!/^[A-Za-z0-9_-]{40,256}$/.test(key)||!authorizationKey||!/^[A-Za-z0-9_-]{40,256}$/.test(authorizationKey)||key===authorizationKey||key===process.env.SOMA_GCP_BROWSER_CONTROL_KEY||authorizationKey===process.env.SOMA_GCP_BROWSER_CONTROL_KEY)throw fail();
  return {origin:url.origin,key,authorizationKey};
}
export function credentialAutofillConfigured(){try{credentialServiceSettings();return true;}catch{return false;}}
export function validateCredentialLoginUrl(raw:string,sessionId:string){
  let url:URL;try{url=new URL(raw);}catch{throw fail();}
  if(url.origin!==credentialServiceSettings().origin||url.pathname!==`/login/${sessionId}`||url.username||url.password||url.search||!/^#[A-Za-z0-9_-]{43}$/.test(url.hash))throw fail();return url.href;
}
