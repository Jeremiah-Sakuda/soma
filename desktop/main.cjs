const { app, BrowserWindow, WebContentsView, ipcMain, globalShortcut, Menu, screen, desktopCapturer, systemPreferences, shell, dialog } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { appOrigin, trustedPage, safeExternal, panelBounds, captureSource } = require('./policy.cjs');
const origin = appOrigin(process.env.SOMA_DESKTOP_URL, app.isPackaged);
const toolbarURL = pathToFileURL(path.join(__dirname, 'toolbar.html')).href;
let win, view, quitting = false, capturing = false, revision = 0, shortcutOK = false;
const locked = {nodeIntegration:false, contextIsolation:true, sandbox:true, webSecurity:true};
function status(message) { if (win && !win.isDestroyed()) win.webContents.send('desktop:status', message); }
function pause() { view?.webContents.send('desktop:pause'); }
function show() { win.show(); win.focus(); }
function dismiss() { revision++; pause(); view.webContents.setAudioMuted(true); win.hide(); }
function trusted(event, toolbar = false) {
  return toolbar ? event.sender === win.webContents && event.senderFrame === win.webContents.mainFrame && event.senderFrame.url === toolbarURL : event.sender === view.webContents && event.senderFrame === view.webContents.mainFrame && trustedPage(event.senderFrame.url, origin);
}
async function capture() {
  if (capturing) return;
  if (!trustedPage(view.webContents.getURL(), origin)) { status('Open the Soma exploration page before capturing.'); return; }
  capturing = true; const ticket = ++revision;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  pause(); status('Capturing one snapshot…');
  const wasVisible = win.isVisible();
  try {
    if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'denied') throw new Error('Allow Soma in System Settings → Privacy & Security → Screen & System Audio Recording, then quit and reopen Soma.');
    win.hide();
    // Let the compositor remove Soma before taking a snapshot. No claim of OS exclusion.
    await new Promise(r => setTimeout(r, 250));
    const sources = await desktopCapturer.getSources({types:['screen'], thumbnailSize:{width:1600,height:1600}, fetchWindowIcons:false});
    if (ticket !== revision) return;
    const selected = captureSource(sources, display.id);
    if (!selected || selected.thumbnail.isEmpty()) throw new Error('The display could not be captured. Check screen-recording permission and try again.');
    let image = selected.thumbnail;
    let data = image.toJPEG(78);
    for (let i = 0; data.length > 490000 && i < 4; i++) {
      const size = image.getSize(); image = image.resize({width:Math.round(size.width*.78),height:Math.round(size.height*.78)}); data = image.toJPEG(76);
    }
    if (data.length > 490000) throw new Error('The snapshot is too large. Try uploading a cropped screenshot.');
    if (!trustedPage(view.webContents.getURL(), origin)) throw new Error('Soma navigated away; snapshot discarded.');
    win.setBounds(panelBounds(display.workArea));
    show(); view.webContents.setAudioMuted(false);
    view.webContents.send('desktop:snapshot', {dataUrl:`data:image/jpeg;base64,${data.toString('base64')}`, name:'Current display.jpg'});
    status('Preparing your snapshot preview…');
  } catch (e) {
    if (ticket === revision) { show(); status(e.message || 'Screen capture failed.'); }
  } finally {
    if (ticket === revision && wasVisible && !win.isVisible()) show();
    capturing = false;
  }
}
app.setName('Soma');
if (!app.requestSingleInstanceLock()) app.quit();
else {
app.on('second-instance', () => win && show());
app.whenReady().then(() => {
  win = new BrowserWindow({...panelBounds(screen.getPrimaryDisplay().workArea), minWidth:420,minHeight:500,title:'Soma',backgroundColor:'#f5f0e5',alwaysOnTop:true,show:false,webPreferences:{...locked,preload:path.join(__dirname,'toolbar-preload.cjs')}});
  win.setVisibleOnAllWorkspaces(true, {visibleOnFullScreen:true});
  view = new WebContentsView({webPreferences:{...locked,preload:path.join(__dirname,'capture-preload.cjs'),partition:'persist:soma-desktop'}});
  win.contentView.addChildView(view);
  const layout = () => { const [width,height] = win.getContentSize(); view.setBounds({x:0,y:96,width,height:Math.max(0,height-96)}); };
  win.on('resize',layout); layout();
  for (const contents of [win.webContents, view.webContents]) {
    contents.setWindowOpenHandler(() => ({action:'deny'}));
    contents.on('will-attach-webview', event => event.preventDefault());
  }
  win.webContents.on('will-navigate', event => event.preventDefault());
  view.webContents.on('will-navigate', (event,url) => {
    if (new URL(url).origin !== origin) { event.preventDefault(); if (safeExternal(url)) void shell.openExternal(url); }
  });
  view.webContents.on('will-redirect', (event,url) => { if (new URL(url).origin !== origin) event.preventDefault(); });
  const ses = view.webContents.session;
  ses.setPermissionCheckHandler((contents, permission, requestingOrigin, details) => contents === view.webContents && requestingOrigin === origin && permission === 'media' && details.mediaType === 'audio');
  ses.setPermissionRequestHandler((contents, permission, callback, details) => {
    const allowed = contents === view.webContents && trustedPage(details.requestingUrl, origin) && permission === 'media' && details.mediaTypes?.length > 0 && details.mediaTypes.every(type => type === 'audio');
    callback(Boolean(allowed));
  });
  ses.setDisplayMediaRequestHandler((_request, callback) => callback({}));
  ses.on('will-download', event => event.preventDefault());
  view.webContents.on('did-fail-load', (_e,code,_description,_url,main) => { if (main && code !== -3) status('Soma could not load. Check your connection, then choose Reload.'); });
  win.on('close', event => { if (!quitting) {event.preventDefault(); dismiss();} });
  win.on('minimize', () => { pause(); view.webContents.setAudioMuted(true); });
  win.on('restore', () => view.webContents.setAudioMuted(false));
  ipcMain.handle('desktop:action', async (event, action) => {
    if (!trusted(event,true)) throw new Error('Untrusted desktop control.');
    if (action === 'capture') await capture();
    else if (action === 'hide') dismiss();
    else if (action === 'reload') {revision++;pause();view.webContents.reload();}
    else if (action === 'settings') await shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture');
    else if (action === 'pin') {win.setAlwaysOnTop(!win.isAlwaysOnTop());return win.isAlwaysOnTop();}
    else if (action === 'ready') return {shortcutOK, platform:process.platform};
    else throw new Error('Unknown desktop control.');
  });
  ipcMain.on('desktop:received', (event, ok) => {if (trusted(event)) status(ok ? 'Snapshot ready. Review it, then ask Soma. Nothing sent yet.' : 'Soma is still loading or busy. Wait, then capture again.');});
  shortcutOK = globalShortcut.register('CommandOrControl+Shift+Space', () => void capture());
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    {label:'Soma',submenu:[{label:'Show Soma',click:()=>{show();view.webContents.setAudioMuted(false);}},{label:'Capture current display',click:()=>void capture()},{label:'Screen recording permission…',click:()=>void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture')},{type:'separator'},{role:'quit'}]},
    {role:'editMenu'}, {label:'View',submenu:[{label:'Reload Soma',click:()=>view.webContents.reload()},{label:'Hide Soma',accelerator:'Escape',click:dismiss},{role:'togglefullscreen'}]}
  ]));
  win.loadURL(toolbarURL);
  view.webContents.loadURL(`${origin}/explore`);
  win.once('ready-to-show',show);
  app.on('activate',()=>{show();view.webContents.setAudioMuted(false);});
});
app.on('before-quit',()=>{quitting=true;revision++;});
app.on('will-quit',()=>globalShortcut.unregisterAll());
}
