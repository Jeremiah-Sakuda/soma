const path=require('node:path');
const {pathToFileURL}=require('node:url');
const {execFile}=require('node:child_process');
const {createTask,assertLive,validateObservation,validateAction}=require('./computer-policy.cjs');
function createComputerControl({BrowserWindow,ipcMain,globalShortcut,session,origin,helperPath,stopPoint,status,accessibility=()=>true,native}) {
  const url=pathToFileURL(path.join(__dirname,'computer-control.html')).href;
  let window,task,controller,child,busy=false,epoch=0;
  function state(extra={}) { if(window&&!window.isDestroyed()) window.webContents.send('computer:state',{app:task?.observation.app||'',controls:task?.observation.controls||[],plan:task?.plan||null,steps:task?.steps||0,history:task?.history||[],...extra}); }
  function stop(message='Computer task stopped.') {epoch++;controller?.abort();child?.kill();task=null;busy=false;globalShortcut.unregister('Escape');state({message});status(message);}
  function helper(input) {if(native)return native(input);return new Promise((resolve,reject)=>{const process=execFile(helperPath,[],{timeout:5000,maxBuffer:40000,encoding:'utf8'},(error,out)=>{if(child===process)child=null;try{const value=JSON.parse(out);if(error||value.error)reject(Error(value.error||'Native action failed.'));else resolve(value);}catch{reject(Error('Native helper unavailable. Build Soma and grant Accessibility permission.'));}});child=process;child.stdin.end(JSON.stringify(input));});}
  function trusted(event) {return window&&!window.isDestroyed()&&event.sender===window.webContents&&event.senderFrame===window.webContents.mainFrame&&event.senderFrame.url===url;}
  async function start() {
    if(busy)return;stop('');stopPoint();busy=true;const ticket=epoch;
    try {
      if(!accessibility())throw Error('Allow Soma in System Settings → Privacy & Security → Accessibility, then try again.');
      const observed=await helper({command:'observe'});if(ticket!==epoch)return;
      task=createTask(observed);
      if(!globalShortcut.register('Escape',()=>stop()))throw Error('Escape unavailable; task control cannot start.');
      if(!window||window.isDestroyed()) {
        window=new BrowserWindow({width:600,height:700,minWidth:440,minHeight:500,title:'Soma · Apply to selected app',alwaysOnTop:true,webPreferences:{preload:path.join(__dirname,'computer-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});
        window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());window.webContents.on('will-attach-webview',e=>e.preventDefault());window.on('closed',()=>stop());
        await window.loadURL(url);
      }
      if(ticket!==epoch)return;window.show();window.focus();state({message:'Review the selected app and controls. Nothing has been sent to Muse. Each task lasts two minutes and allows five separately approved actions.'});
    }catch(error){stop(error.message);}finally{if(ticket===epoch)busy=false;}
  }
  ipcMain.handle('computer:command',async(event,command,value)=>{
    if(!trusted(event))throw Error('Untrusted computer control.');
    if(command==='stop'){stop();return;}
    if(command==='ready'){state();return;}
    if(busy)throw Error('Wait for the current step or stop.');assertLive(task);busy=true;const ticket=epoch;const active=task;
    try {
      if(command==='plan'){
        if(typeof value!=='string'||!value.trim()||value.length>1000)throw Error('Enter a task of at most 1,000 characters.');
        active.plan=null;state({message:'Muse is proposing one action. No control is active.'});controller=new AbortController();
        const response=await session.fetch(`${origin}/api/explore/computer`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({goal:value.trim(),app:active.observation.app,controls:active.observation.controls,history:active.history}),signal:controller.signal,redirect:'error'});
        const text=await response.text();if(text.length>10000)throw Error('Action response too large.');const body=JSON.parse(text);if(ticket!==epoch)return;if(!response.ok)throw Error(body.error||'Open Soma first to initialize your session.');assertLive(active);
        active.plan=validateAction(body.plan,active.observation);state({message:'Review Muse’s proposed effect and the exact target/value before executing.',audit:body.audit});
      }else if(command==='execute'){
        if(value!==true)throw Error('Explicit approval is required.');
        if(!active.plan||['clarify','done'].includes(active.plan.kind))throw Error('Request a concrete action first.');
        // User must approve the exact stored proposal; renderer cannot supply a different plan.
        const plan=validateAction(active.plan,active.observation);active.plan=null;state({message:'Executing one approved action. Escape stops pending work.'});window.hide();
        const before=validateObservation(await helper({command:'observe',pid:active.observation.pid,activate:active.observation.pid}));
        if(ticket!==epoch)return;assertLive(active);if(before.fingerprint!==active.observation.fingerprint)throw Error('The target window or controls changed. Select the app again.');
        const result=await helper({command:'execute',pid:before.pid,fingerprint:before.fingerprint,kind:plan.kind,target:plan.target,text:plan.text});
        if(ticket!==epoch)return;active.steps++;active.history.push({kind:plan.kind,label:before.controls[plan.target].label,text:plan.text,outcome:result.valueConfirmed?'value-confirmed':'press-accepted'});assertLive({...active,steps:active.steps-1});
        const after=validateObservation(await helper({command:'observe',pid:before.pid}));if(ticket!==epoch)return;active.observation=after;
        window.show();window.focus();state({message:result.valueConfirmed?'The field value was read back and matched. Review the app; request another action if needed.':'The control accepted the press. The control list was refreshed; verify the app result before continuing. This does not prove submission succeeded.',lastAction:{kind:plan.kind,target:plan.target,valueConfirmed:result.valueConfirmed,screenChanged:before.fingerprint!==after.fingerprint}});
      }else throw Error('Unknown action.');
    }catch(error){if(ticket===epoch){active.plan=null;window?.show();window?.focus();state({message:error.message});}}
    finally{if(ticket===epoch)busy=false;}
  });
  globalShortcut.register('CommandOrControl+Shift+A',()=>void start());
  return {start,stop,dispose(){stop();window?.destroy();globalShortcut.unregister('CommandOrControl+Shift+A');ipcMain.removeHandler('computer:command');}};
}
module.exports={createComputerControl};
