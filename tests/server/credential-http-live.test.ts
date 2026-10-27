import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {getAuth} from 'firebase-admin/auth';
import {describe,expect,it} from 'vitest';
import {getServerApp,getServerFirestore} from '../../src/lib/server/firebase-config';

describe.skipIf(process.env.SOMA_CREDENTIAL_HTTP_TEST!=='true')('hosted credential request checks',()=>{
 it('verifies cookies, origin, body limits and deletion without material or provider login',async()=>{
  const base=new URL(process.env.SOMA_PRODUCTION_BASE_URL||'https://soma-woad-beta.vercel.app').origin;
  if(!base.startsWith('https://'))throw new Error('Hosted credential check requires HTTPS.');
  const email=`soma-credential-http-${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url');
  const user=await getAuth(getServerApp()).createUser({email,password});let cookie='';
  const call=(path:string,method='GET',body?:string,origin=base)=>fetch(base+path,{method,headers:{...(cookie?{cookie}:{}),...(method!=='GET'?{origin,'content-type':'application/json'}:{})},...(body!==undefined?{body}:{}),redirect:'error',signal:AbortSignal.timeout(30_000)});
  try{
   expect((await call('/api/connectors/browser')).status).toBe(401);
   const login=await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email,password,returnSecureToken:true}),signal:AbortSignal.timeout(20_000)});
   if(!login.ok)throw new Error('Synthetic hosted sign-in failed.');
   const exchange=await call('/api/auth/session','POST',JSON.stringify({idToken:(await login.json()).idToken}));
   expect(exchange.status).toBe(200);const header=exchange.headers.get('set-cookie')||'';
   expect(/httponly/i.test(header)&&/secure/i.test(header)&&/samesite=lax/i.test(header)).toBe(true);
   const token=/soma_account=([^;]+)/.exec(header)?.[1];if(!token)throw new Error('Hosted account cookie missing.');cookie=`soma_account=${token}`;
   const workspace=await call('/api/workspace');expect(workspace.status).toBe(200);expect((await workspace.json()).workspace.sources).toHaveLength(0);
   expect(workspace.headers.get('cache-control')).toContain('no-store');
   const invalid=JSON.stringify({provider:'blackboard',action:'start',password:'original-synthetic-canary'});
   expect((await call('/api/connectors/browser','POST',invalid,'https://other.example')).status).toBe(403);
   expect((await call('/api/connectors/browser','POST',invalid,`http://${new URL(base).host}`)).status).toBe(403);
   expect((await call('/api/connectors/browser','POST',invalid)).status).toBe(400);
   const oversized=await call('/api/connectors/browser','POST',JSON.stringify({provider:'blackboard',action:'start',password:'界'.repeat(6000)}));
   expect(oversized.status).toBe(413);expect((await oversized.text()).includes('界')).toBe(false);
   const status=await call('/api/connectors/browser');expect(status.status).toBe(200);expect(status.headers.get('cache-control')).toContain('no-store');
   expect((await status.json()).providers.every((item:{connection?:unknown})=>!item.connection)).toBe(true);
   const oauth=await call('/api/connectors/google/start','POST',JSON.stringify({provider:'gmail'}));expect(oauth.status).toBe(200);
   const authorization=new URL((await oauth.json()).authorizationUrl);expect(authorization.origin).toBe('https://accounts.google.com');expect(authorization.searchParams.has('client_secret')).toBe(false);expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
   const deleted=await call('/api/workspace','DELETE');expect(deleted.status).toBe(200);expect((await deleted.json()).deleted).toBe(true);
  }finally{
   const cleanup=await call('/api/workspace','DELETE');
   if(!cleanup.ok)throw new Error('Hosted synthetic cleanup did not finish; protected account retained for recovery.');
   await getServerFirestore().recursiveDelete(getServerFirestore().collection('somaAccounts').doc(createHash('sha256').update(user.uid).digest('hex')));await getAuth(getServerApp()).deleteUser(user.uid);
  }
 },120_000);
});
