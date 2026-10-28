/** The login worker has no Firebase admin or source database privileges. */
export function createAppAuthorizer({url,key,fetchImpl=fetch}){
 const target=new URL(url);
 if(target.protocol!=='https:'||target.origin+target.pathname!==url||target.pathname!=='/api/connectors/credentials/authorize'||target.username||target.password||target.port||target.search||target.hash||!target.hostname.endsWith('.vercel.app')||typeof key!=='string'||!/^[A-Za-z0-9_-]{40,256}$/.test(key))throw new Error('Credential authorization configuration unavailable.');
 return async(grant,{purpose='credential'}={})=>{
  try{
   if(!['credential','session'].includes(purpose))throw new Error();
   const {authorizationId,uid,owner,workspaceId,workspaceGeneration,provider,contextId,connectionVersion,recentAuthAt}=grant;
   const response=await fetchImpl(url,{method:'POST',headers:{authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify({authorizationId,uid,owner,workspaceId,workspaceGeneration,provider,contextId,connectionVersion,recentAuthAt,purpose}),redirect:'error',cache:'no-store',signal:AbortSignal.timeout(10000)});
   if(!response.ok)throw new Error();
   const text=await response.text();if(text.length>1024)throw new Error();
   const value=JSON.parse(text);if(!value||Object.keys(value).length!==1||typeof value.identifier!=='string'||!/^[-a-z0-9._+]+@bu\.edu$/i.test(value.identifier))throw new Error();
   return {identifier:value.identifier.toLowerCase()};
  }catch{throw Object.assign(new Error('Secure sign-in authorization is unavailable.'),{code:'credential_authorization',status:403});}
 };
}
