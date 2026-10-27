'use client';
import {useState} from 'react';

/** Recovery needs no readable workspace or stored provider credentials in the client. */
export function WorkspaceDeletionRecovery({onDone,onSessionExpired}:{onDone:()=>void;onSessionExpired:()=>void}) {
 const [busy,setBusy]=useState(''),[error,setError]=useState('');
 async function finish(path:string,action:string){
  setBusy(action);setError('');
  try{
   const response=await fetch(path,{method:'DELETE'});
   if(response.status===401){onSessionExpired();return;}
   if(!response.ok)throw new Error(action==='cleanup'?'Cleanup could not finish. Your workspace remains locked and its protected cleanup references are retained. Try again shortly.':'Could not sign out. Please try again.');
   onDone();
  }catch(err){setError(err instanceof Error?err.message:'The request could not finish. Please retry.');}
  finally{setBusy('');}
 }
 return <main className="main-container" style={{maxWidth:680}}>
  <a className="wordmark" href="/">Soma<span aria-hidden="true">.</span></a>
  <section className="card" style={{marginTop:32}} aria-labelledby="deletion-recovery-title">
   <span className="overline">Deletion in progress</span><h1 id="deletion-recovery-title">Finish deleting your workspace</h1>
   <p>Your earlier deletion request is saved. Soma has locked this workspace while saved browser access is cleaned up. Retrying resumes the deletion you already confirmed.</p>
   <p className="meta">If cleanup failed, encrypted references remain available for retry. This removes workspace records and saved browser access; it does not delete your sign-in account.</p>
   <div className="action-row" style={{marginTop:20}}>
    <button className="primary-button" disabled={!!busy} onClick={()=>void finish('/api/workspace','cleanup')}>{busy==='cleanup'?'Finishing cleanup…':'Retry cleanup and deletion'}</button>
    <button className="secondary-button" disabled={!!busy} onClick={()=>void finish('/api/auth/session','signout')}>Sign out</button>
   </div>
   {busy&&<p role="status">{busy==='cleanup'?'Checking saved browser cleanup…':'Signing out…'}</p>}
   {error&&<p role="alert" className="inline-error">{error}</p>}
  </section>
 </main>;
}
