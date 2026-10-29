'use strict';
const base=location.pathname;
const status=document.querySelector('#status'),entry=document.querySelector('#entry'),mfa=document.querySelector('#mfa'),recovery=document.querySelector('#recovery');
let version=null,phase='loading',busy=false,attempted=false;
const failures=Object.freeze({
 form_not_reviewed:'BU’s current sign-in form was not recognized. Soma stopped rather than fill an unreviewed page.',
 credential_form_guard:'BU’s current sign-in form was not recognized. Soma stopped rather than fill an unreviewed page.',
 credential_form_fields:'BU’s sign-in fields do not match the reviewed form. Soma stopped instead of filling unfamiliar fields.',
 credential_page_guard:'BU’s sign-in page changed during this attempt. Soma stopped instead of continuing on a changed page.',
 credential_frame_guard:'BU displayed a page layout this login service does not support. Use manual sign-in for this flow.',
 credential_submit_transport:'Soma could not confirm BU received the sign-in submission. This page cannot confirm that sign-in completed.',
 credential_submit_status:'BU did not return a supported sign-in response. This page cannot confirm that sign-in completed.',
 credential_submit_redirect:'BU redirected to a destination this login service has not approved. Use manual sign-in for this flow.',
 credential_submit_reflection:'BU’s response did not pass the login service’s safety check. The remote display remains closed.',
 credential_submit_not_sent:'The reviewed sign-in submission was not sent. Cancel this attempt in Soma before using manual sign-in.',
 credential_post_password:'BU is still showing a password-entry page. This service will not submit your password again in this window.',
 credential_display_guard:'Soma could not confirm that it was safe to show the BU window. The remote display remains closed.',
 credential_viewer_guard:'Soma could not confirm the remote BU display was isolated safely. It remains closed.',
 credential_snapshot_guard:'Soma could not safely save the browser state. This attempt did not confirm a safe session handoff.',
 credential_submit_authorization:'Sign-in permission changed before submission. Soma stopped this attempt; return to Soma to reconnect.',
 credential_browser_start:'The protected BU browser could not start. This window will not retry automatically.',
 identity_mismatch:'This BU username does not match the BU identity on your Soma account. Review the account email before starting again.',
 identity_unavailable:'Soma could not verify the BU identity for this account. Review your Soma account email or use manual sign-in.',
 credential_authorization:'Soma could not confirm permission for this sign-in. Sign in to Soma again before opening a fresh secure window.',
 credential_authorization_unavailable:'Soma could not reach its permission check. This page cannot confirm that sign-in completed; return to Soma to check the pending window.',
 entry_token:'This secure link expired or was already used. Return to Soma to cancel the pending attempt and open a fresh window.',
 session_ended:'This secure window has ended. Return to Soma to cancel the pending attempt and open a fresh window.',
 credential_changed:'Stored sign-in changed during this attempt. Soma stopped to protect the updated version.',
 fill_consumed:'This window has already used its one sign-in attempt. Return to Soma to start a fresh window.',
 credential_unavailable:'Sign-in stopped. This page cannot confirm that the BU login completed.',
});
const api=async(action,data={})=>{
 let response,result;try{response=await fetch(base+'/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),credentials:'same-origin',cache:'no-store'});result=await response.json();}catch{throw {code:'credential_unavailable'};}
 if(!response.ok)throw {code:typeof result?.code==='string'&&Object.hasOwn(failures,result.code)?result.code:'credential_unavailable'};
 return result;
};
function render(data){phase=data.phase;version=data.credential?.version??version;entry.hidden=phase!=='ready';mfa.hidden=phase!=='mfa';recovery.hidden=true;document.querySelector('#fill').hidden=data.credential?.status!=='active';document.querySelector('#forget').hidden=!version;status.setAttribute('role','status');status.setAttribute('aria-live','polite');status.textContent=phase==='ready'?'Secure window ready. No password has been filled.':phase==='mfa'?'Password entry finished. Complete your remaining BU sign-in steps.':'This sign-in window has ended.';if(phase==='mfa')window.startSomaMfa?.(base);}
async function action(run,secretAttempt=false){if(busy||(secretAttempt&&attempted))return;if(secretAttempt)attempted=true;busy=true;document.querySelectorAll('button').forEach(button=>button.disabled=true);try{await run();}catch(error){status.textContent=typeof error?.code==='string'&&Object.hasOwn(failures,error.code)?failures[error.code]:failures.credential_unavailable;status.setAttribute('role','alert');status.setAttribute('aria-live','assertive');entry.hidden=true;mfa.hidden=true;recovery.hidden=false;document.querySelector('#password').value='';document.querySelector('#identifier').value='';window.stopSomaMfa?.();status.focus();}finally{busy=false;document.querySelectorAll('button').forEach(button=>button.disabled=false);}}
document.querySelector('#show').addEventListener('click',()=>{const input=document.querySelector('#password'),shown=input.type==='password';input.type=shown?'text':'password';document.querySelector('#show').textContent=shown?'Hide':'Show';document.querySelector('#show').setAttribute('aria-pressed',String(shown));});
document.querySelector('#credential-form').addEventListener('submit',event=>{event.preventDefault();void action(async()=>{const input=document.querySelector('#password');const data={identifier:document.querySelector('#identifier').value.trim(),password:input.value,consent:document.querySelector('#consent').checked,version};input.value='';try{render(await api('save-fill',data));}finally{data.password='';}},true);});
document.querySelector('#fill').addEventListener('click',()=>void action(async()=>render(await api('fill',{version})),true));
document.querySelector('#forget').addEventListener('click',()=>void action(async()=>{await api('forget',{version});entry.hidden=true;status.textContent='Saved password forgotten. Existing BU sessions are separate.';}));
document.querySelector('#release').addEventListener('click',()=>{window.stopSomaMfa?.();mfa.hidden=true;status.textContent='Return to Soma and choose “Save sign-in session” to save browser authorization. This window has not saved it yet.';});
void action(async()=>{const token=location.hash.slice(1);history.replaceState(null,'',base);render(await api(token?'bootstrap':'status',token?{token}:{}));});
