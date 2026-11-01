const {
  app,
  BrowserWindow,
  WebContentsView,
  ipcMain,
  globalShortcut,
  Menu,
  screen,
  desktopCapturer,
  systemPreferences,
  shell,
  dialog,
} = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createComputerControl } = require('./computer-control.cjs');
const { createPointAsk } = require('./point-ask.cjs');
const {
  appOrigin,
  trustedPage,
  safeExternal,
  panelBounds,
  captureSource,
} = require('./policy.cjs');
const origin = appOrigin(process.env.SOMA_DESKTOP_URL, app.isPackaged);
const toolbarURL = pathToFileURL(path.join(__dirname, 'toolbar.html')).href;
const compactURL = pathToFileURL(path.join(__dirname, 'compact.html')).href;
let bar = null,
  compactShortcut = null;
let win,
  view,
  quitting = false,
  capturing = false,
  revision = 0,
  shortcutOK = false,
  pointAsk,
  computerControl;
const locked = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
};
function status(message) {
  if (win && !win.isDestroyed()) win.webContents.send('desktop:status', message);
  if (bar && !bar.isDestroyed()) bar.webContents.send('compact:status', message);
}
/** Compact mode: a small translucent ask bar instead of the panel. Questions are typed;
 * the checked search is drawn over the screen by the existing overlay. The hosted page
 * keeps running in the hidden panel. */
function compactBar() {
  if (bar && !bar.isDestroyed()) return bar;
  bar = new BrowserWindow({
    width: 680,
    height: 86,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: true,
    show: false,
    title: 'Soma ask bar',
    webPreferences: { ...locked, preload: path.join(__dirname, 'compact-preload.cjs') },
  });
  bar.setAlwaysOnTop(true, 'floating');
  bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  bar.webContents.on('will-navigate', (event) => event.preventDefault());
  bar.on('closed', () => {
    bar = null;
  });
  // Leaving the bar for another app may change the slide; the next drawn step re-checks it.
  bar.on('blur', () => pointAsk?.markStale());
  void bar.loadURL(compactURL);
  return bar;
}
function enterCompact() {
  const b = compactBar();
  const wa = screen.getDisplayNearestPoint(screen.getCursorScreenPoint()).workArea;
  const { width, height } = b.getBounds();
  b.setBounds({ x: Math.round(wa.x + (wa.width - width) / 2), y: Math.round(wa.y + wa.height - height - 28), width, height });
  if (win.isVisible()) win.hide();
  // The page keeps working while hidden; its narration stays audible in compact mode.
  view.webContents.setAudioMuted(false);
  b.show();
  b.focus();
  b.webContents.send('compact:focus');
}
function leaveCompact() {
  bar?.hide();
  show();
  view.webContents.setAudioMuted(false);
}
function trustedBar(event) {
  return Boolean(bar && !bar.isDestroyed() && event.sender === bar.webContents && event.senderFrame?.url === compactURL);
}
function pause() {
  view?.webContents.send('desktop:pause');
}
function show() {
  win.show();
  win.focus();
}
function dismiss() {
  pointAsk?.stop('Point & ask cancelled.');
  revision++;
  pause();
  view.webContents.setAudioMuted(true);
  win.hide();
}
function trusted(event, toolbar = false) {
  return toolbar
    ? event.sender === win.webContents &&
        event.senderFrame === win.webContents.mainFrame &&
        event.senderFrame.url === toolbarURL
    : event.sender === view.webContents &&
        event.senderFrame === view.webContents.mainFrame &&
        trustedPage(event.senderFrame.url, origin);
}
async function snapshotDisplay(display) {
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: { width: 1600, height: 1600 },
    fetchWindowIcons: false,
  });
  const selected = captureSource(sources, display.id);
  if (!selected || selected.thumbnail.isEmpty()) throw Error('Display unavailable');
  let image = selected.thumbnail,
    data = image.toJPEG(78);
  for (let i = 0; data.length > 490000 && i < 4; i++) {
    const size = image.getSize();
    image = image.resize({
      width: Math.round(size.width * 0.78),
      height: Math.round(size.height * 0.78),
    });
    data = image.toJPEG(76);
  }
  if (data.length > 490000) throw Error('Snapshot too large');
  return {
    dataUrl: `data:image/jpeg;base64,${data.toString('base64')}`,
    capturedAt: new Date().toISOString(),
  };
}
async function capture() {
  computerControl?.stop('Computer task ended.');
  if (capturing) return;
  bar?.hide();
  // Never photograph Soma's own drawing as part of the next slide.
  pointAsk?.clearScreenOverlay();
  if (!trustedPage(view.webContents.getURL(), origin)) {
    status('Open the Soma exploration page before capturing.');
    return;
  }
  capturing = true;
  const ticket = ++revision;
  const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  pause();
  status('Capturing one snapshot…');
  const wasVisible = win.isVisible();
  try {
    if (
      process.platform === 'darwin' &&
      systemPreferences.getMediaAccessStatus('screen') === 'denied'
    )
      throw new Error(
        'Allow Soma in System Settings → Privacy & Security → Screen & System Audio Recording, then quit and reopen Soma.',
      );
    win.hide();
    // Let the compositor remove Soma before taking a snapshot. No claim of OS exclusion.
    await new Promise((r) => setTimeout(r, 250));
    const snapshot = await snapshotDisplay(display);
    if (ticket !== revision) return;
    if (!trustedPage(view.webContents.getURL(), origin))
      throw new Error('Soma navigated away; snapshot discarded.');
    win.setBounds(panelBounds(display.workArea));
    show();
    view.webContents.setAudioMuted(false);
    view.webContents.send('desktop:snapshot', { ...snapshot, name: 'Current display.jpg' });
    status('Preparing your snapshot preview…');
  } catch (e) {
    if (ticket === revision) {
      show();
      status(e.message || 'Screen capture failed.');
    }
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
    win = new BrowserWindow({
      ...panelBounds(screen.getPrimaryDisplay().workArea),
      minWidth: 420,
      minHeight: 500,
      title: 'Soma',
      // Translucent: macOS vibrancy shows the learner's screen through the journal.
      backgroundColor: '#00000000',
      vibrancy: 'under-window',
      visualEffectState: 'active',
      alwaysOnTop: true,
      show: false,
      webPreferences: { ...locked, preload: path.join(__dirname, 'toolbar-preload.cjs') },
    });
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    view = new WebContentsView({
      webPreferences: {
        ...locked,
        preload: path.join(__dirname, 'capture-preload.cjs'),
        partition: 'persist:soma-desktop',
      },
    });
    view.setBackgroundColor('#00000000');
    win.contentView.addChildView(view);
    const layout = () => {
      const [width, height] = win.getContentSize();
      view.setBounds({ x: 0, y: 96, width, height: Math.max(0, height - 96) });
    };
    win.on('resize', layout);
    layout();
    for (const contents of [win.webContents, view.webContents]) {
      contents.setWindowOpenHandler(() => ({ action: 'deny' }));
      contents.on('will-attach-webview', (event) => event.preventDefault());
    }
    win.webContents.on('will-navigate', (event) => event.preventDefault());
    view.webContents.on('will-navigate', (event, url) => {
      if (new URL(url).origin !== origin) {
        event.preventDefault();
        if (safeExternal(url)) void shell.openExternal(url);
      }
    });
    view.webContents.on('will-redirect', (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    const ses = view.webContents.session;
    ses.setPermissionCheckHandler(
      (contents, permission, requestingOrigin, details) =>
        contents === view.webContents &&
        requestingOrigin === origin &&
        permission === 'media' &&
        details.mediaType === 'audio',
    );
    ses.setPermissionRequestHandler((contents, permission, callback, details) => {
      const allowed =
        contents === view.webContents &&
        trustedPage(details.requestingUrl, origin) &&
        permission === 'media' &&
        details.mediaTypes?.length > 0 &&
        details.mediaTypes.every((type) => type === 'audio');
      callback(Boolean(allowed));
    });
    ses.setDisplayMediaRequestHandler((_request, callback) => callback({}));
    ses.on('will-download', (event) => event.preventDefault());
    view.webContents.on('did-fail-load', (_e, code, _description, _url, main) => {
      if (main && code !== -3)
        status('Soma could not load. Check your connection, then choose Reload.');
    });
    win.on('close', (event) => {
      if (!quitting) {
        event.preventDefault();
        dismiss();
      }
    });
    win.on('minimize', () => {
      pause();
      view.webContents.setAudioMuted(true);
    });
    win.on('restore', () => view.webContents.setAudioMuted(false));
    // The learner may now change the slide by hand; the next drawn step re-checks it.
    win.on('blur', () => pointAsk?.markStale());
    pointAsk = createPointAsk({
      BrowserWindow,
      screen,
      globalShortcut,
      locked,
      helperPath: app.isPackaged
        ? path.join(process.resourcesPath, 'hold-shortcut')
        : path.join(__dirname, 'node_modules/.cache/soma/hold-shortcut'),
      available: () => trustedPage(view.webContents.getURL(), origin),
      send: (payload) => view.webContents.send('desktop:point-ask', payload),
      status,
      hidePanel: () => {
        pause();
        view.webContents.setAudioMuted(true);
        win.hide();
      },
      showPanel: (bounds) => {
        if (bounds) win.setBounds(bounds);
        win.showInactive();
        view.webContents.setAudioMuted(false);
      },
      hideForHighlight: () => win.hide(),
      // Leaves the panel out of a check's capture without hiding it from the learner.
      excludePanel: async (fn) => {
        const windows = [win, bar].filter((w) => w && !w.isDestroyed());
        for (const w of windows) w.setContentProtection(true);
        try {
          return await fn();
        } finally {
          for (const w of windows) if (!w.isDestroyed()) w.setContentProtection(false);
        }
      },
      highlightResult: (payload) =>
        view.webContents.send('desktop:source-highlight-result', payload),
      captureImage: snapshotDisplay,
      enabledChange: (value) => win.webContents.send('desktop:point-enabled', value),
      overlayResult: (payload) => view.webContents.send('desktop:screen-overlay-result', payload),
      overlayAction: (payload) => view.webContents.send('desktop:screen-overlay-action', payload),
    });
    ipcMain.on('desktop:screen-overlay', (event, payload) => {
      if (trusted(event)) void pointAsk.screenOverlay(payload);
    });
    ipcMain.on('overlay:hover', (event, active) => pointAsk.overlayHover(event, active));
    ipcMain.on('overlay:toggle-edge', (event, edgeId) => pointAsk.overlayToggle(event, edgeId));
    computerControl = createComputerControl({BrowserWindow,ipcMain,globalShortcut,session:ses,origin,
      helperPath: app.isPackaged ? path.join(process.resourcesPath,'computer-control') : path.join(__dirname,'node_modules/.cache/soma/computer-control'),
      stopPoint:()=>pointAsk.disable(),status,accessibility:()=>process.platform==='darwin'&&systemPreferences.isTrustedAccessibilityClient(true),
      // After a completed plan the local control page may request the existing
      // single-snapshot capture; hosted content gets no capture or execution bridge.
      capture:()=>{pointAsk.stop('');return capture();}});
    ipcMain.on('desktop:source-highlight', (event, payload) => {
      if (trusted(event)) void pointAsk.highlight(payload);
    });
    ipcMain.on('desktop:point-feedback', (event, payload) => {
      if (
        trusted(event) &&
        payload &&
        typeof payload.id === 'string' &&
        [
          'recording',
          'transcribing',
          'generating',
          'ready',
          'error',
          'cancelled',
          'partial',
        ].includes(payload.state)
      )
        pointAsk.feedback({
          id: payload.id,
          state: payload.state,
          ...(payload.state === 'partial' && typeof payload.text === 'string'
            ? { text: payload.text.slice(0, 240) }
            : {}),
        });
    });
    ipcMain.handle('compact:ask', async (event, payload) => {
      if (!trustedBar(event)) throw new Error('Untrusted ask bar.');
      const text = typeof payload?.text === 'string' ? payload.text.trim().slice(0, 1000) : '';
      if (!trustedPage(view.webContents.getURL(), origin))
        return { ok: false, message: 'Soma is still loading. Try again in a moment.' };
      computerControl?.stop('Computer task ended.');
      if (payload?.mode === 'snapshot') {
        if (!text) return { ok: false, message: 'Type a question first.' };
        if (process.platform === 'darwin' && systemPreferences.getMediaAccessStatus('screen') === 'denied')
          return { ok: false, message: 'Allow Soma under Screen & System Audio Recording, then reopen Soma.' };
        const ok = await pointAsk.askTyped(text);
        return { ok, message: ok ? 'Muse is reading your screen…' : 'Soma could not take a snapshot. Try again.' };
      }
      if (payload?.mode === 'investigate' || payload?.mode === 'followup') {
        if (payload.mode === 'followup' && !text) return { ok: false, message: 'Type a question first.' };
        view.webContents.send('desktop:compact', { action: payload.mode === 'investigate' ? 'investigate' : 'ask', text });
        return { ok: true, message: payload.mode === 'investigate' ? 'Muse is choosing what to test…' : 'Muse is answering…' };
      }
      throw new Error('Unknown ask mode.');
    });
    ipcMain.handle('compact:control', async (event, action) => {
      if (!trustedBar(event)) throw new Error('Untrusted ask bar.');
      if (['previous', 'next', 'play'].includes(action)) view.webContents.send('desktop:compact', { action });
      else if (action === 'hide') bar?.hide();
      else if (action === 'expand') leaveCompact();
      else throw new Error('Unknown control.');
      return true;
    });
    ipcMain.on('desktop:compact-state', (event, payload) => {
      if (!trusted(event) || !bar || bar.isDestroyed() || !payload || typeof payload !== 'object') return;
      bar.webContents.send('compact:state', {
        busy: payload.busy === true,
        visual: payload.visual === true,
        step: Number.isInteger(payload.step) ? payload.step : null,
        steps: Number.isInteger(payload.steps) ? payload.steps : null,
        playing: payload.playing === true,
        investigable: payload.investigable === true,
        message: typeof payload.message === 'string' ? payload.message.slice(0, 240) : '',
      });
    });
    ipcMain.handle('desktop:action', async (event, action) => {
      if (!trusted(event, true)) throw new Error('Untrusted desktop control.');
      if (['point','capture','hide','reload'].includes(action)) computerControl?.stop('Computer task ended.');
      if (action === 'point') {
        if (!pointAsk.enabled && process.platform === 'darwin') {
          if (systemPreferences.getMediaAccessStatus('screen') === 'denied')
            throw Error('Allow Soma in Screen & System Audio Recording, then reopen it.');
          if (
            systemPreferences.getMediaAccessStatus('microphone') !== 'granted' &&
            !(await systemPreferences.askForMediaAccess('microphone'))
          )
            throw Error(
              'Allow Soma microphone access in System Settings, or use typed questions.',
            );
        }
        return pointAsk.enable();
      } else if (action === 'capture') {
        pointAsk.stop('');
        await capture();
      } else if (action === 'hide') dismiss();
      else if (action === 'compact') enterCompact();
      else if (action === 'reload') {
        pointAsk.stop('Point & ask cancelled.');
        revision++;
        pause();
        view.webContents.reload();
      } else if (action === 'settings')
        await shell.openExternal(
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
        );
      else if (action === 'pin') {
        win.setAlwaysOnTop(!win.isAlwaysOnTop());
        return win.isAlwaysOnTop();
      } else if (action === 'ready') return { shortcutOK, platform: process.platform };
      else throw new Error('Unknown desktop control.');
    });
    ipcMain.on('desktop:received', (event, ok) => {
      if (trusted(event))
        status(
          ok
            ? 'Snapshot ready. Review it, then ask Soma. Nothing sent yet.'
            : 'Soma is still loading or busy. Wait, then capture again.',
        );
    });
    shortcutOK = globalShortcut.register('CommandOrControl+Shift+Space', () => void capture());
    // Option-Space toggles the ask bar; fall back if another launcher already owns it.
    const toggleBar = () => {
      if (bar?.isVisible() && bar.isFocused()) bar.hide();
      else enterCompact();
    };
    for (const accelerator of ['Alt+Space', 'CommandOrControl+Alt+Space'])
      if (globalShortcut.register(accelerator, toggleBar)) {
        compactShortcut = accelerator;
        break;
      }
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: 'Soma',
          submenu: [
            {
              label: 'Show Soma',
              click: () => {
                show();
                view.webContents.setAudioMuted(false);
              },
            },
            { label: 'Apply to selected app (⌘⇧A)', click: () => void computerControl.start() },
            { label: 'Capture current display', click: () => void capture() },
            {
              label: `Compact ask bar${compactShortcut === 'Alt+Space' ? ' (⌥Space)' : compactShortcut ? ' (⌘⌥Space)' : ''}`,
              click: () => enterCompact(),
            },
            {
              label: 'Screen recording permission…',
              click: () =>
                void shell.openExternal(
                  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture',
                ),
            },
            { type: 'separator' },
            { role: 'quit' },
          ],
        },
        { role: 'editMenu' },
        {
          label: 'View',
          submenu: [
            { label: 'Reload Soma', click: () => view.webContents.reload() },
            { label: 'Hide Soma', accelerator: 'Escape', click: dismiss },
            { role: 'togglefullscreen' },
          ],
        },
      ]),
    );
    win.loadURL(toolbarURL);
    view.webContents.loadURL(`${origin}/explore`);
    win.once('ready-to-show', show);
    app.on('activate', () => {
      show();
      view.webContents.setAudioMuted(false);
    });
  });
  app.on('before-quit', () => {
    quitting = true;
    revision++;
    computerControl?.dispose();
    pointAsk?.dispose();
  });
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
