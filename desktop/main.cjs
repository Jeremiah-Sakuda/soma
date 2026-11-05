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
  session,
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
  compactShortcut = null,
  // True while the ask bar replaces the panel; nothing reopens the panel until it ends.
  compactMode = false,
  compactAsking = false,
  // A follow-up or investigation handed to the page, until the page reports it busy then idle.
  compactPending = null,
  // The page's last one-line state, kept so a newly shown bar starts in sync.
  compactState = null;
let win,
  view,
  quitting = false,
  capturing = false,
  revision = 0,
  shortcutOK = false,
  pointAsk,
  computerControl,
  lastDrawing = null;
const locked = {
  nodeIntegration: false,
  contextIsolation: true,
  sandbox: true,
  webSecurity: true,
};
function status(message) {
  if (win && !win.isDestroyed()) win.webContents.send('desktop:status', message);
  if (bar && !bar.isDestroyed()) bar.webContents.send('compact:status', message);
  // Point & ask reports through status when its question ends; keep the bar's busy state current.
  sendCompactState();
}
/** Compact mode: a small translucent ask bar instead of the panel. Questions are typed;
 * the checked search is drawn over the screen by the existing overlay. The hosted page
 * keeps running in the hidden panel. */
function compactBar() {
  if (bar && !bar.isDestroyed()) return bar;
  bar = new BrowserWindow({
    width: 700,
    height: 104,
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
  // Above the on-screen drawing, whose window sits at the screen-saver level.
  bar.setAlwaysOnTop(true, 'screen-saver', 1);
  bar.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  bar.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  bar.webContents.on('will-navigate', (event) => event.preventDefault());
  bar.on('closed', () => {
    bar = null;
  });
  // Leaving the bar for another app may change the slide; the next drawn step re-checks it.
  bar.on('blur', () => pointAsk?.markStale());
  bar.webContents.on('did-finish-load', sendCompactState);
  void bar.loadURL(compactURL);
  return bar;
}
/** The bar's view of the exploration: the page's state, with "visual" meaning a checked
 * search is actually drawn on screen, so follow-ups never go to an undrawn card. */
function sendCompactState() {
  if (!bar || bar.isDestroyed()) return;
  const s = compactState ?? {
    busy: false,
    visual: false,
    step: null,
    steps: null,
    playing: false,
    investigable: false,
    message: '',
  };
  bar.webContents.send('compact:state', {
    ...s,
    busy: s.busy || compactAsking || Boolean(compactPending) || Boolean(pointAsk?.compactActive()),
    view: pointAsk?.view ?? '2d',
    liftable: Boolean(pointAsk?.liftable),
    // Whether the page itself is working, as distinct from a request still on its way.
    pageBusy: s.busy,
    visual: s.visual && Boolean(pointAsk?.hasDrawing()),
  });
}
/** The page's narration waits for something to look at, so it needs to know the panel is closed. */
function syncCompactMode() {
  if (view && !view.webContents.isDestroyed())
    view.webContents.send('desktop:compact', { action: 'mode', on: compactMode });
}
function enterCompact() {
  if (capturing || !win) return;
  const b = compactBar();
  const { width, height } = b.getBounds();
  const cursor = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
  // Keep where the learner dragged the bar unless it is on another display or not shown yet.
  if (
    !b.isVisible() &&
    (!compactMode || screen.getDisplayMatching(b.getBounds()).id !== cursor.id)
  ) {
    const wa = cursor.workArea;
    b.setBounds({
      x: Math.round(wa.x + (wa.width - width) / 2),
      y: Math.round(wa.y + wa.height - height - 28),
      width,
      height,
    });
  }
  compactMode = true;
  syncCompactMode();
  if (win.isVisible()) win.hide();
  // The page keeps working while hidden; its narration stays audible in compact mode.
  view.webContents.setAudioMuted(false);
  if (process.platform === 'darwin') app.focus({ steal: true });
  b.show();
  b.focus();
  b.webContents.send('compact:focus');
  sendCompactState();
}
/** Hides the bar and ends what it started: the question in flight, the drawing, narration. */
function hideCompact() {
  if (pointAsk?.compactActive()) pointAsk.stop('');
  pointAsk?.clearScreenOverlay();
  pause();
  bar?.hide();
  // Hand the keyboard back to the app the learner was using. Not while Point & ask is on:
  // a hidden app could not show its hold-gesture trail or drawing.
  if (
    process.platform === 'darwin' &&
    !pointAsk?.enabled &&
    !BrowserWindow.getAllWindows().some((w) => w !== bar && w.isVisible())
  )
    app.hide();
}
function leaveCompact() {
  compactMode = false;
  syncCompactMode();
  bar?.hide();
  show();
  view.webContents.setAudioMuted(false);
}
function trustedBar(event) {
  return Boolean(
    bar &&
    !bar.isDestroyed() &&
    event.sender === bar.webContents &&
    event.senderFrame === bar.webContents.mainFrame &&
    event.senderFrame.url === compactURL,
  );
}
/** Why the hosted page cannot take a compact question right now, or null when it can. */
function explorationUnavailable() {
  try {
    if (view.webContents.isLoading()) return 'Soma is still loading. Try again in a moment.';
    const url = new URL(view.webContents.getURL());
    if (!trustedPage(url.href, origin)) return 'Soma is still loading. Try again in a moment.';
    if (url.pathname === '/explore' || url.pathname.startsWith('/explore/')) return null;
    return 'Open the exploration page with ⤢, then ask again.';
  } catch {
    return 'Soma is still loading. Try again in a moment.';
  }
}
// Content protection leaves Soma's windows out of a capture; overlapping captures share it,
// so it is only switched off when the last one finishes.
let excluding = 0;
async function excludeWindows(fn) {
  if (excluding++ === 0) {
    for (const w of [win, bar]) if (w && !w.isDestroyed()) w.setContentProtection(true);
    // Give the window server a moment to apply protection (here and on the drawing, which
    // Point & ask protects just before) before the frame is read.
    await new Promise((r) => setTimeout(r, 100));
  }
  try {
    return await fn();
  } finally {
    if (--excluding === 0)
      for (const w of [win, bar]) if (w && !w.isDestroyed()) w.setContentProtection(false);
  }
}
function pause() {
  view?.webContents.send('desktop:pause');
}
function show() {
  // In compact mode the bar stands in for the panel.
  if (compactMode && bar && !bar.isDestroyed()) {
    bar.show();
    bar.focus();
    return;
  }
  win.show();
  win.focus();
}
function dismiss() {
  if (compactMode && bar?.isFocused()) {
    hideCompact();
    return;
  }
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
  if (!trustedPage(view.webContents.getURL(), origin)) {
    status('Open the Soma exploration page before capturing.');
    return;
  }
  // Capturing the display opens its preview in the panel, so compact mode ends.
  compactMode = false;
  syncCompactMode();
  bar?.hide();
  // Never photograph Soma's own drawing as part of the next slide.
  pointAsk?.clearScreenOverlay();
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
    // A reload or navigation ends whatever the old page was doing for the ask bar.
    view.webContents.on('did-start-navigation', (details) => {
      if (!details.isMainFrame || details.isSameDocument) return;
      if (pointAsk?.compactActive()) pointAsk.stop('');
      // The new page has no card behind the old drawing.
      pointAsk?.clearScreenOverlay();
      clearTimeout(compactPending?.timer);
      compactPending = null;
      compactState = null;
      sendCompactState();
    });
    view.webContents.on('will-redirect', (event, url) => {
      if (new URL(url).origin !== origin) event.preventDefault();
    });
    // Soma's local windows (toolbar, ask bar, overlay) use the default session and need no
    // device or other permissions.
    session.defaultSession.setPermissionCheckHandler(() => false);
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    );
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
      // A development run may substitute a scripted helper for live end-to-end tests; a
      // packaged app always uses its own signed helper.
      helperPath: app.isPackaged
        ? path.join(process.resourcesPath, 'hold-shortcut')
        : process.env.SOMA_TEST_HOLD_HELPER ||
          path.join(__dirname, 'node_modules/.cache/soma/hold-shortcut'),
      available: () => trustedPage(view.webContents.getURL(), origin),
      send: (payload) => view.webContents.send('desktop:point-ask', payload),
      status,
      hidePanel: () => {
        pause();
        view.webContents.setAudioMuted(true);
        win.hide();
      },
      showPanel: (bounds) => {
        // In compact mode the answer is drawn on screen and narrated; the panel stays closed.
        if (compactMode) {
          view.webContents.setAudioMuted(false);
          // A hold gesture after the bar was hidden still needs somewhere to report.
          if (bar && !bar.isDestroyed() && !bar.isVisible()) bar.showInactive();
          return;
        }
        if (bounds) win.setBounds(bounds);
        win.showInactive();
        view.webContents.setAudioMuted(false);
      },
      hideForHighlight: () => win.hide(),
      // Leaves the panel out of a check's capture without hiding it from the learner.
      excludePanel: excludeWindows,
      highlightResult: (payload) =>
        view.webContents.send('desktop:source-highlight-result', payload),
      captureImage: snapshotDisplay,
      enabledChange: (value) => win.webContents.send('desktop:point-enabled', value),
      overlayResult: (payload) => {
        const wasLifted = lastDrawing?.id === payload.id && lastDrawing.view === '3d';
        lastDrawing = payload.shown ? { id: payload.id, view: payload.view ?? '2d' } : null;
        view.webContents.send('desktop:screen-overlay-result', {
          id: payload.id,
          shown: payload.shown,
          ...(payload.dismissed ? { dismissed: true } : {}),
          ...(payload.view ? { view: payload.view } : {}),
          ...(payload.reason ? { reason: payload.reason } : {}),
        });
        if (compactMode && bar?.isVisible()) {
          if (payload.reason === 'checking')
            status('Checking that your slide is still the same before lifting…');
          else if (payload.reason === 'cleared')
            status('Drawing cleared. Return asks with a new snapshot; Esc hides the bar.');
          else if (payload.reason === 'webgl')
            status('This Mac could not draw in 3D, so the drawing stays flat on your slide.');
          else if (payload.reason === 'sheet')
            status('Soma could not lift this drawing, so it stays flat on your slide.');
          else if (payload.view === '3d')
            status(
              pointAsk.liftKind === 'model'
                ? 'Lifted as an illustrative 3D model. Drag to turn it, click a part to pick it, double-click to reset.'
                : pointAsk.liftKind === 'circuit'
                  ? 'Lifted off your slide. Height is each node’s checked voltage.'
                  : 'Lifted off your slide. Height is the checked distance from the start; taut strings are shortest routes.',
            );
          else if (payload.view === '2d' && wasLifted) status('Back on your slide.');
          else if (payload.shown && pointAsk.liftKind === 'model')
            // An explanation draws nothing flat; its picture is the model 3D builds.
            status(
              'Answered. Press 3D to see it as a model lifted off your slide; ask a follow-up, or Esc to clear.',
            );
          else if (payload.shown)
            status(
              `Drawn on your screen. Ask a follow-up${compactState?.investigable ? ', ⌘↩ tests it' : ''}, Esc clears.`,
            );
          else if (payload.dismissed)
            status('Cleared. Return asks with a new snapshot; Esc hides the bar.');
          else if (payload.reason === 'invalid')
            status('This answer can’t be drawn on your screen. Open it with ⤢.');
          else if (payload.reason === 'changed')
            status(
              'Your slide changed, so Soma took the drawing down. Press Return for a new snapshot.',
            );
          else
            status('Your screen changed before Soma could draw. Press Return for a new snapshot.');
          sendCompactState();
        }
      },
      overlayAction: (payload) => view.webContents.send('desktop:screen-overlay-action', payload),
    });
    ipcMain.on('desktop:screen-overlay', (event, payload) => {
      if (trusted(event)) void pointAsk.screenOverlay(payload);
    });
    ipcMain.on('overlay:hover', (event, active) => pointAsk.overlayHover(event, active));
    ipcMain.on('overlay:lift-failed', (event, reason) => {
      pointAsk.liftFailed(event, reason);
      sendCompactState();
    });
    // The page asks to lift its drawing into 3D or set it back down.
    ipcMain.on('desktop:screen-overlay-view', (event, payload) => {
      if (
        trusted(event) &&
        payload &&
        typeof payload.id === 'string' &&
        ['2d', '3d'].includes(payload.view)
      ) {
        pointAsk.setView(payload.view, payload.id);
        sendCompactState();
      }
    });
    ipcMain.on('overlay:toggle-edge', (event, edgeId) => pointAsk.overlayToggle(event, edgeId));
    ipcMain.on('overlay:select', (event, objectId) => pointAsk.overlaySelect(event, objectId));
    computerControl = createComputerControl({
      BrowserWindow,
      ipcMain,
      globalShortcut,
      session: ses,
      origin,
      helperPath: app.isPackaged
        ? path.join(process.resourcesPath, 'computer-control')
        : path.join(__dirname, 'node_modules/.cache/soma/computer-control'),
      stopPoint: () => pointAsk.disable(),
      status,
      accessibility: () =>
        process.platform === 'darwin' && systemPreferences.isTrustedAccessibilityClient(true),
      // After a completed plan the local control page may request the existing
      // single-snapshot capture; hosted content gets no capture or execution bridge.
      capture: () => {
        pointAsk.stop('');
        return capture();
      },
    });
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
      const mode = payload?.mode;
      if (!['snapshot', 'followup', 'investigate'].includes(mode))
        throw new Error('Unknown ask mode.');
      const unavailable = explorationUnavailable();
      if (unavailable) return { ok: false, message: unavailable };
      // One question at a time: a second Return must not cancel or race the first.
      if (compactAsking || compactPending || compactState?.busy || pointAsk.compactActive())
        return { ok: false, message: 'Muse is still working on your last question.' };
      if (mode !== 'investigate' && !text) return { ok: false, message: 'Type a question first.' };
      computerControl?.stop('Computer task ended.');
      if (mode === 'snapshot') {
        if (
          process.platform === 'darwin' &&
          systemPreferences.getMediaAccessStatus('screen') === 'denied'
        )
          return {
            ok: false,
            message: 'Allow Soma under Screen & System Audio Recording, then reopen Soma.',
          };
        compactAsking = true;
        // A page that reloaded since the bar opened still needs to know.
        syncCompactMode();
        sendCompactState();
        try {
          // The snapshot is of the display the bar is on, where the learner is looking.
          const display =
            bar && !bar.isDestroyed() ? screen.getDisplayMatching(bar.getBounds()) : undefined;
          const result = await pointAsk.askTyped(text, display);
          // Hiding the bar cancelled it; nothing to report.
          if (!result.ok && !bar?.isVisible()) return { ok: false, message: '' };
          // When the page refused the question, its own reason is the useful one.
          return result.message
            ? result
            : {
                ok: false,
                message: compactState?.message || 'That question did not go through. Try again.',
              };
        } finally {
          compactAsking = false;
          sendCompactState();
        }
      }
      // Follow-ups and investigations need the checked search to be on screen.
      if (!pointAsk.hasDrawing())
        return {
          ok: false,
          message: 'Nothing is drawn right now. Press Return to ask with a new snapshot.',
        };
      if (mode === 'investigate' && !compactState?.investigable)
        return {
          ok: false,
          message: 'Test it works on a checked shortest-path graph with a goal.',
        };
      view.webContents.send('desktop:compact', {
        action: mode === 'investigate' ? 'investigate' : 'ask',
        text,
      });
      // Until the page reports the request, a second Return is refused here.
      compactPending = {
        started: false,
        message: compactState?.message ?? '',
        timer: setTimeout(() => endPending(), 8000),
      };
      sendCompactState();
      return {
        ok: true,
        message: mode === 'investigate' ? 'Muse is choosing what to test…' : 'Muse is answering…',
      };
    });
    ipcMain.handle('compact:control', async (event, action) => {
      if (!trustedBar(event)) throw new Error('Untrusted ask bar.');
      if (['previous', 'next', 'play'].includes(action))
        view.webContents.send('desktop:compact', { action });
      else if (action === 'lift') {
        if (!pointAsk.hasDrawing()) return false;
        // An explanation with no model yet: the page asks Muse to build one, then lifts it.
        if (pointAsk.view === '2d' && compactState?.buildsModel) {
          if (compactState.busy) return false;
          view.webContents.send('desktop:compact', { action: 'lift' });
          status('Muse is building a 3D model of this explanation…');
          return true;
        }
        const shown = pointAsk.setView(pointAsk.view === '3d' ? '2d' : '3d');
        sendCompactState();
        return shown;
      } else if (action === 'hide') hideCompact();
      else if (action === 'expand') leaveCompact();
      else throw new Error('Unknown control.');
      return true;
    });
    const endPending = () => {
      clearTimeout(compactPending?.timer);
      compactPending = null;
      sendCompactState();
    };
    ipcMain.on('desktop:compact-state', (event, payload) => {
      if (!trusted(event) || !payload || typeof payload !== 'object') return;
      if (compactPending) {
        if (payload.busy === true) {
          // The page took the request; its own busy state now guards it.
          compactPending.started = true;
          clearTimeout(compactPending.timer);
          compactPending.timer = setTimeout(endPending, 300000);
        } else if (
          compactPending.started ||
          (typeof payload.message === 'string' &&
            payload.message &&
            payload.message !== compactPending.message)
        ) {
          // Finished, or refused with an error before it ever started.
          clearTimeout(compactPending.timer);
          compactPending = null;
        }
      }
      compactState = {
        busy: payload.busy === true,
        visual: payload.visual === true,
        step: Number.isInteger(payload.step) ? payload.step : null,
        steps: Number.isInteger(payload.steps) ? payload.steps : null,
        playing: payload.playing === true,
        investigable: payload.investigable === true,
        buildsModel: payload.buildsModel === true,
        explanation: payload.explanation === true,
        message: typeof payload.message === 'string' ? payload.message.slice(0, 240) : '',
      };
      sendCompactState();
    });
    ipcMain.handle('desktop:action', async (event, action) => {
      if (!trusted(event, true)) throw new Error('Untrusted desktop control.');
      if (['point', 'capture', 'hide', 'reload'].includes(action))
        computerControl?.stop('Computer task ended.');
      if (action === 'point') {
        if (!pointAsk.enabled && process.platform === 'darwin') {
          if (systemPreferences.getMediaAccessStatus('screen') === 'denied')
            throw Error('Allow Soma in Screen & System Audio Recording, then reopen it.');
          if (
            systemPreferences.getMediaAccessStatus('microphone') !== 'granted' &&
            !(await systemPreferences.askForMediaAccess('microphone'))
          )
            throw Error('Allow Soma microphone access in System Settings, or use typed questions.');
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
      if (bar?.isVisible() && bar.isFocused()) hideCompact();
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
              click: () => leaveCompact(),
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
