const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { randomUUID } = require('node:crypto');
const { selectFocus, pointPanelBounds } = require('./point-geometry.cjs');
/** Native coordination only. Remote content cannot request capture or inject locations. */
function createPointAsk({
  BrowserWindow,
  screen,
  globalShortcut,
  locked,
  helperPath,
  send,
  status,
  hidePanel,
  showPanel,
  captureImage,
  available,
  spawnShortcut = spawn,
  enabledChange = () => {},
  platform = process.platform,
}) {
  let child = null,
    overlay = null,
    enabled = false,
    current = null,
    tracking = null,
    limit = null,
    hideTimer = null;
  function clearTimers() {
    clearInterval(tracking);
    clearTimeout(limit);
    clearTimeout(hideTimer);
    tracking = limit = hideTimer = null;
    globalShortcut.unregister('Escape');
  }
  function hideOverlay() {
    overlay?.hide();
  }
  function draw(payload) {
    if (overlay && !overlay.isDestroyed()) overlay.webContents.send('point:draw', payload);
  }
  function overlayFor(display) {
    if (!overlay) {
      overlay = new BrowserWindow({
        transparent: true,
        frame: false,
        show: false,
        focusable: false,
        skipTaskbar: true,
        hasShadow: false,
        alwaysOnTop: true,
        webPreferences: { ...locked, preload: path.join(__dirname, 'point-preload.cjs') },
      });
      overlay.setIgnoreMouseEvents(true);
      overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      overlay.webContents.on('will-navigate', (e) => e.preventDefault());
      overlay.loadFile(path.join(__dirname, 'point-overlay.html'));
    }
    overlay.setBounds(display.bounds);
    overlay.showInactive();
  }
  function stop(reason = 'Point & ask stopped.', show = false) {
    const previous = current;
    current = null;
    clearTimers();
    hideOverlay();
    if (previous) send({ type: 'cancel', id: previous.id, message: reason });
    if (show) showPanel();
    status(reason);
  }
  function sample() {
    const s = current;
    if (!s || s.phase !== 'holding') return;
    const p = screen.getCursorScreenPoint(),
      b = s.display.bounds;
    if (p.x < b.x || p.y < b.y || p.x > b.x + b.width || p.y > b.y + b.height) {
      stop('Keep the gesture on one display, then try again.', true);
      return;
    }
    const last = s.points.at(-1);
    if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= 2) {
      if (s.points.length >= 192) s.points.shift();
      s.points.push(p);
      const selected = selectFocus(s.points, b);
      if (selected.kind === 'circle') s.selection = selected;
    }
    draw({
      type: 'tracking',
      x: p.x - b.x,
      y: p.y - b.y,
      path: s.points.map((q) => ({ x: q.x - b.x, y: q.y - b.y })),
      text: s.text || 'Preparing microphone · keep holding',
    });
  }
  function begin() {
    if (!enabled || !available()) {
      status('Open Soma exploration and wait for it to load.');
      return;
    }
    if (current?.phase === 'holding') return;
    if (current) stop('', false);
    const display = screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const s = { id: randomUUID(), display, phase: 'holding', points: [] };
    current = s;
    hidePanel();
    overlayFor(display);
    send({ type: 'begin', id: s.id });
    sample();
    tracking = setInterval(sample, 32);
    limit = setTimeout(() => void finish(), 30000);
    globalShortcut.register('Escape', () =>
      stop('Point & ask cancelled. Your previous visual is kept.', true),
    );
    status('Listening · circle or point, then release Control–Option–Space.');
  }
  async function finish() {
    const s = current;
    if (!s || s.phase !== 'holding') return;
    sample();
    if (current !== s) return;
    s.phase = 'finishing';
    clearInterval(tracking);
    clearTimeout(limit);
    tracking = limit = null;
    send({ type: 'end', id: s.id });
    hideOverlay();
    try {
      const focus = s.selection ?? selectFocus(s.points, s.display.bounds);
      s.points = [];
      await new Promise((resolve) => setTimeout(resolve, 120));
      if (current !== s) return;
      const snapshot = await captureImage(s.display);
      if (current !== s) return;
      // Coordinates belong to this exact display snapshot, not to a later screen state.
      s.phase = 'preparing';
      showPanel(pointPanelBounds(s.display.workArea, focus));
      send({ type: 'source', id: s.id, ...snapshot, focus });
      status('Question and selected region are being prepared.');
      overlayFor(s.display);
      draw({
        type: 'focus',
        region: focus.region,
        text: focus.kind === 'circle' ? 'Selected circle' : 'Selected point',
      });
      hideTimer = setTimeout(hideOverlay, 1500);
    } catch {
      if (current === s)
        stop(
          'Capture failed. Your previous visual is kept; try Capture display or upload.',
          true,
        );
    }
  }
  async function enable() {
    if (enabled) {
      disable();
      return { enabled: false };
    }
    if (platform !== 'darwin')
      throw Error('Point & ask currently requires macOS. Capture display still works.');
    return new Promise((resolve, reject) => {
      const processChild = spawnShortcut(helperPath, [], {
        stdio: ['ignore', 'pipe', 'ignore'],
      });
      child = processChild;
      let ready = false;
      const timeout = setTimeout(() => {
        if (!ready) {
          disable();
          reject(Error('The shortcut helper did not start.'));
        }
      }, 5000);
      const lines = createInterface({ input: processChild.stdout });
      lines.on('line', (line) => {
        if (line.length > 200 || child !== processChild) return;
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.type === 'ready' && !ready) {
          clearTimeout(timeout);
          ready = true;
          if (!event.available) {
            disable();
            reject(Error('Control–Option–Space is unavailable. Capture display still works.'));
            return;
          }
          enabled = true;
          enabledChange(true);
          status('Point & ask on · hold Control–Option–Space to speak.');
          resolve({ enabled: true });
        } else if (enabled && event.type === 'pressed') begin();
        else if (enabled && event.type === 'released') void finish();
      });
      const failed = () => {
        clearTimeout(timeout);
        if (child === processChild) {
          child = null;
          enabled = false;
          enabledChange(false);
          stop('Point & ask stopped. Capture display remains available.');
        }
        if (!ready) {
          ready = true;
          reject(Error('Build or reinstall the native shortcut helper.'));
        }
      };
      processChild.on('error', failed);
      processChild.on('exit', failed);
    });
  }
  function disable() {
    enabled = false;
    enabledChange(false);
    const previous = child;
    child = null;
    previous?.kill();
    stop('Point & ask off.');
  }
  function feedback(event) {
    if (!current || event.id !== current.id) return;
    if (['error', 'cancelled'].includes(event.state)) {
      stop(event.message || 'Point & ask stopped. Your previous visual is kept.', true);
      return;
    }
    if (event.state === 'ready') {
      clearTimers();
      hideOverlay();
      current = null;
      status('Visual ready. Explore it or ask a follow-up.');
    } else if (event.state === 'recording') {
      current.text = 'Listening · release to ask';
      status('Listening · release Control–Option–Space to ask.');
    } else if (event.state === 'transcribing') status('Transcribing your question…');
    else if (event.state === 'generating')
      status('Muse is preparing the selected explanation…');
  }
  function dispose() {
    disable();
    overlay?.destroy();
    overlay = null;
  }
  return {
    enable,
    disable,
    stop,
    feedback,
    dispose,
    get enabled() {
      return enabled;
    },
  };
}
module.exports = { createPointAsk };
