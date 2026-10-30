// Real Electron shell + original synthetic upload fixture. No OS capture/provider calls.
const { _electron: electron } = require('../../node_modules/playwright-core');
const http = require('node:http'); const assert = require('node:assert/strict'); const path = require('node:path');
(async()=>{
const fixture=`<!doctype html><title>Soma fixture</title><input type="file" aria-label="Upload a PNG or JPEG screenshot"><textarea id="exploration-question"></textarea><button id="pause">Pause explanation</button><output></output><script>window.addEventListener('soma:surface', e => {document.body.dataset.surface=e.detail.surface});document.querySelector('input').onchange=e=>{document.querySelector('output').textContent=e.target.files[0].name};document.querySelector('#pause').onclick=e=>{e.target.textContent='Play explanation'};</script>`;
const server=http.createServer((_req,res)=>{res.setHeader('Content-Type','text/html');res.end(fixture);});await new Promise(r=>server.listen(0,'127.0.0.1',r));
let app;
try {
 app=await electron.launch({args:[path.resolve(__dirname,'..')],executablePath:process.env.SOMA_TEST_EXECUTABLE || require('electron'),env:{...process.env,SOMA_DESKTOP_URL:`http://127.0.0.1:${server.address().port}`}});
 let toolbar; for(let i=0;i<100;i++){toolbar=app.windows().find(p=>p.url().endsWith('/toolbar.html'));if(toolbar)break;await new Promise(r=>setTimeout(r,100));} assert.ok(toolbar,'Native toolbar loaded');await toolbar.waitForSelector('#capture');
 await app.evaluate(async ({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];const v=w.contentView.children[0];if(v.webContents.isLoading())await new Promise(r=>v.webContents.once('did-finish-load',r));});
 const safety=await app.evaluate(({BrowserWindow})=>{
  const w=BrowserWindow.getAllWindows()[0], v=w.contentView.children[0],p=v.webContents.getLastWebPreferences();
  return {isPinned:w.isAlwaysOnTop(),node:p.nodeIntegration,sandbox:p.sandbox,isolation:p.contextIsolation,resizable:w.isResizable(),min:w.getMinimumSize()};
 });assert.deepEqual(safety,{isPinned:true,node:false,sandbox:true,isolation:true,resizable:true,min:[380,460]});
 // A real remote draft and WebContents identity must survive both surface transitions.
 const initial = await app.evaluate(async ({BrowserWindow})=>{
   const w=BrowserWindow.getAllWindows()[0],v=w.contentView.children[0];
   await v.webContents.executeJavaScript(`document.querySelector('textarea').value='Unsaved explanation question'`);
   return {id:v.webContents.id,bounds:w.getBounds()};
 });
 await toolbar.getByRole('button',{name:'Explore further in app',exact:true}).focus();
 await toolbar.keyboard.press('Enter');
 await toolbar.getByRole('button',{name:'Return to compact window',exact:true}).waitFor();
 const expanded = await app.evaluate(async ({BrowserWindow})=>{
   const w=BrowserWindow.getAllWindows()[0],v=w.contentView.children[0];
   return {id:v.webContents.id,pinned:w.isAlwaysOnTop(),draft:await v.webContents.executeJavaScript(`document.querySelector('textarea').value`)};
 });
 assert.deepEqual(expanded,{id:initial.id,pinned:false,draft:'Unsaved explanation question'});
 await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`document.body.dataset.surface='unknown';window.dispatchEvent(new Event('soma:surface-ready'))`));
 await new Promise(r=>setTimeout(r,150));
 assert.equal(await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`document.body.dataset.surface`)),'workspace');
 await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('soma:surface-request',{detail:{surface:'companion'}}))`));
 await toolbar.getByRole('button',{name:'Explore further in app',exact:true}).waitFor();
 assert.deepEqual(await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {bounds:w.getBounds(),pinned:w.isAlwaysOnTop()};}),{bounds:initial.bounds,pinned:true});
 // Unknown surface payloads cannot resize or navigate.
 await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('soma:surface-request',{detail:{surface:'https://evil.test'}}))`));
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);

 const pixel='data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2Q==';
 await app.evaluate(({BrowserWindow},dataUrl)=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.send('desktop:snapshot',{dataUrl}),pixel);
 await new Promise(r=>setTimeout(r,400));
 const upload=await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`({name:document.querySelector('output').textContent,focus:document.activeElement.id,node:typeof process,bridge:typeof somaControls})`));
 assert.deepEqual(upload,{name:'Current display.jpg',focus:'exploration-question',node:'undefined',bridge:'undefined'});
 await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.send('desktop:pause'));
 await new Promise(r=>setTimeout(r,150));
 assert.equal(await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`document.querySelector('#pause').textContent`)),'Play explanation');
 await app.evaluate(async ({BrowserWindow})=>{const v=BrowserWindow.getAllWindows()[0].contentView.children[0];await v.webContents.loadURL(v.webContents.getURL().replace('/explore','/login'));v.webContents.send('desktop:snapshot',{dataUrl:'data:image/jpeg;base64,AAAA'});await v.webContents.executeJavaScript(`window.dispatchEvent(new CustomEvent('soma:surface-request',{detail:{surface:'workspace'}}))`);});
 await new Promise(r=>setTimeout(r,100));assert.equal(await app.evaluate(async ({BrowserWindow})=>BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(`document.querySelector('output').textContent`)),'');
 assert.equal(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isAlwaysOnTop()),true);
 await toolbar.getByRole('button',{name:'Hide Soma',exact:true}).click(); await new Promise(r=>setTimeout(r,100));assert.deepEqual(await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];return {visible:w.isVisible(),muted:w.contentView.children[0].webContents.isAudioMuted()};}),{visible:false,muted:true});
 console.log(JSON.stringify({passed:true,checks:['real Electron window','sandbox/isolation','keyboard expansion','same WebContents and unsaved draft preserved','compact bounds and pin restored','invalid and non-explore mode rejected','native snapshot-to-upload bridge','question focus','pause on hide bridge','no native API in remote page','non-explore delivery rejected','hide mutes and dismisses panel'],osCapture:'not exercised',providerCalls:0}));
}finally{if(app)await app.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
