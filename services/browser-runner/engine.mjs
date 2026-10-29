import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';

/** Browser subprocesses never inherit the broker's credentials or signing keys. */
export function browserEnvironment(){return {PATH:'/usr/local/bin:/usr/bin:/bin',HOME:'/tmp',LANG:'C.UTF-8',TZ:'UTC'};}
export function createChromiumEngine(runtime=chromium){
 return {async start({state,proxyUrl}){
  const directory=await mkdtemp(join(tmpdir(),'soma-browser-'));
  let context;
  try{
   context=await runtime.launchPersistentContext(directory,{headless:true,chromiumSandbox:true,env:browserEnvironment(),acceptDownloads:false,serviceWorkers:'block',viewport:{width:1280,height:800},deviceScaleFactor:1,args:[
    '--remote-debugging-port=0','--remote-debugging-address=127.0.0.1',`--proxy-server=${proxyUrl}`,'--proxy-bypass-list=<-loopback>',
    '--disable-quic','--force-webrtc-ip-handling-policy=disable_non_proxied_udp','--disable-background-networking','--disable-component-update','--disable-sync','--disable-breakpad','--disable-crash-reporter','--password-store=basic',
   ]});
   if(state)await context.setStorageState(state);
   const [port,path]=(await readFile(join(directory,'DevToolsActivePort'),'utf8')).trim().split('\n');
   if(!/^\d{1,5}$/.test(port)||!/^\/devtools\/browser\/[a-zA-Z0-9-]+$/.test(path))throw new Error('Browser control unavailable.');
   const pages=async()=>Promise.all(context.pages().filter(page=>!page.isClosed()).map(async page=>{
    const cdp=await context.newCDPSession(page);try{const info=await cdp.send('Target.getTargetInfo');return {id:info.targetInfo.targetId,page};}finally{await cdp.detach();}
   }));
   return {context,connectUrl:`ws://127.0.0.1:${port}${path}`,pages,
    snapshot:()=>context.storageState({indexedDB:true}),
    async close(){await context.close();await rm(directory,{recursive:true,force:true});},
    async view(pageId,socket){
     let cdp,timer,alive=true;
     const attached=new Set();
     const live=()=>alive&&socket.readyState===1;
     const cleanup=()=>{if(!alive)return;alive=false;clearInterval(timer);for(const session of attached){void session.send('Page.stopScreencast').catch(()=>undefined);void session.detach().catch(()=>undefined);}attached.clear();};
     // Install before the first await: revocation can occur while attaching CDP.
     socket.once('close',cleanup);socket.once('error',cleanup);
     async function select(id){
      if(!live())throw new Error('Viewer ended.');
      const found=(await pages()).find(item=>item.id===id);if(!found)throw new Error('Page unavailable.');
      if(!live())throw new Error('Viewer ended.');
      if(cdp){const old=cdp;cdp=undefined;await old.send('Page.stopScreencast').catch(()=>undefined);await old.detach().catch(()=>undefined);attached.delete(old);}
      if(!live())throw new Error('Viewer ended.');
      const selected=await context.newCDPSession(found.page);attached.add(selected);
      if(!live()){await selected.detach().catch(()=>undefined);attached.delete(selected);throw new Error('Viewer ended.');}
      cdp=selected;await selected.send('Page.enable');
      if(!live())throw new Error('Viewer ended.');
      selected.on('Page.screencastFrame',frame=>{if(live()&&cdp===selected&&socket.bufferedAmount<2_000_000)socket.send(JSON.stringify({type:'frame',data:frame.data}));void selected.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>undefined);});
      await selected.send('Page.startScreencast',{format:'jpeg',quality:75,maxWidth:1280,maxHeight:800,everyNthFrame:1});
      return found;
     }
     try{await select(pageId);}catch(error){cleanup();throw error;}
     let processing=Promise.resolve(),queued=0;
     const emitTabs=async()=>{if(!live())return;const current=await pages();if(!live())return;if(current.length>100||socket.bufferedAmount>2_000_000){socket.close(1009);cleanup();return;}socket.send(JSON.stringify({type:'tabs',pages:current.map(item=>{let origin='New tab';try{origin=new URL(item.page.url()).origin;}catch{}return {id:item.id,origin};})}));};
     if(!live())return;
     timer=setInterval(()=>void emitTabs().catch(()=>undefined),1500);timer.unref();
     try{await emitTabs();}catch(error){cleanup();throw error;}
     if(!live())return;
     socket.on('message',buffer=>{
      if(!live())return;
      if(buffer.length>8192||queued>=40){socket.close(1008);return;}queued++;
      processing=processing.then(async()=>{
       if(!live())return;
       const data=JSON.parse(buffer.toString());
       if(data.type==='text'&&typeof data.text==='string'&&data.text.length<=4096)await cdp.send('Input.insertText',{text:data.text});
       else if(data.type==='mouse'&&['mouseMoved','mousePressed','mouseReleased'].includes(data.event)&&Number.isFinite(data.x)&&Number.isFinite(data.y)&&data.x>=0&&data.x<=1280&&data.y>=0&&data.y<=800)await cdp.send('Input.dispatchMouseEvent',{type:data.event,x:data.x,y:data.y,button:data.event==='mouseMoved'?'none':'left',clickCount:1});
       else if(data.type==='wheel'&&Number.isFinite(data.deltaY)&&Math.abs(data.deltaY)<=5000)await cdp.send('Input.dispatchMouseEvent',{type:'mouseWheel',x:640,y:400,deltaX:0,deltaY:data.deltaY});
       else if(data.type==='key'&&['keyDown','keyUp'].includes(data.event)&&typeof data.key==='string'&&data.key.length<=64&&typeof data.code==='string'&&data.code.length<=64&&Number.isInteger(data.keyCode)&&data.keyCode>=0&&data.keyCode<=255&&Number.isInteger(data.modifiers)&&data.modifiers>=0&&data.modifiers<=15)await cdp.send('Input.dispatchKeyEvent',{type:data.event,key:data.key,code:data.code,windowsVirtualKeyCode:data.keyCode,modifiers:data.modifiers});
       else if(data.type==='select'&&typeof data.id==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(data.id))await select(data.id);
       else throw new Error('Unsupported viewer input.');
      }).catch(()=>socket.close(1008)).finally(()=>{queued--;});
     });
    },
   };
  }catch{if(context)await context.close().catch(()=>undefined);await rm(directory,{recursive:true,force:true});throw new Error('Browser startup failed.');}
 }};
}
