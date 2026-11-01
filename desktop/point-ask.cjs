const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { randomUUID } = require('node:crypto');
const { selectFocus, pointPanelBounds } = require('./point-geometry.cjs');
const { validOverlayModel, overlayRegion, regionMatches } = require('./screen-overlay.cjs');
const OVERLAY_RETENTION_MS = 20 * 60 * 1000;
// With no update for this long the learner has likely moved on; stop drawing over the screen.
const OVERLAY_IDLE_MS = 3 * 60 * 1000;
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
  hideForHighlight = hidePanel,
  highlightResult = () => {},
  showPanel,
  captureImage,
  available,
  spawnShortcut = spawn,
  enabledChange = () => {},
  platform = process.platform,
  overlayResult = () => {},
  overlayAction = () => {},
  // Runs a capture with Soma's panel left out of it; the default hides the panel.
  excludePanel = async (fn) => {
    hidePanel();
    return fn();
  },
  compareRegion = (original, fresh, region) =>
    regionMatches(require('electron').nativeImage, original, fresh, region),
}) {
  // The checked search drawn over the real display: bound to one Point & ask capture,
  // shown only after its region still matches, cleared by Escape or the next gesture.
  let overlayCapture = null,
    graph = null,
    verifying = false,
    refused = null,
    idleTimer = null;
  let lastCapture = null,
    lastCaptureTimer = null,
    highlightBusy = false;
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
    if (graph?.verified && overlay && !overlay.isDestroyed()) {
      draw({ type: 'graph', model: graph.model });
      return;
    }
    overlay?.hide();
  }
  // Set when the learner may have changed the screen by hand (Soma's panel lost focus).
  let stale = false,
    lastCheck = 0;
  function markStale() {
    if (graph?.verified) stale = true;
  }
  /** Captures the display without Soma's own windows in it, so a check or a new snapshot
   * never reads Soma's drawing as slide content. */
  async function captureClean(display) {
    const o = overlay && !overlay.isDestroyed() ? overlay : null;
    o?.setContentProtection?.(true);
    try {
      return await excludePanel(() => captureImage(display));
    } finally {
      if (o && !o.isDestroyed()) o.setContentProtection?.(false);
    }
  }
  /** A new snapshot is about to be taken: the drawing belongs to the previous one. */
  function clearScreenOverlay() {
    const id = graph?.id;
    overlayCapture = null;
    clearGraph();
    overlay?.hide();
    if (id) overlayResult({ id, shown: false, dismissed: true });
  }
  function clearGraph() {
    const had = graph?.verified;
    graph = null;
    clearTimeout(idleTimer);
    if (overlay && !overlay.isDestroyed()) {
      overlay.setIgnoreMouseEvents(true);
      draw({ type: 'graph-clear' });
      if (had) {
        globalShortcut.unregister('Escape');
        overlay.hide();
      }
    }
  }
  let overlayDisplay = null;
  function draw(payload) {
    if (!overlay || overlay.isDestroyed()) return;
    // macOS may keep the window off the menu bar or otherwise clamp it, so report where it
    // actually sits relative to the captured display; the renderer compensates.
    const d = overlayDisplay?.bounds;
    overlay.webContents.send(
      'point:draw',
      d ? { ...payload, display: { x: d.x, y: d.y, width: d.width, height: d.height } } : payload,
    );
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
        enableLargerThanScreen: true,
        webPreferences: { ...locked, preload: path.join(__dirname, 'point-preload.cjs') },
      });
      overlay.setIgnoreMouseEvents(true);
      overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
      overlay.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      overlay.webContents.on('will-navigate', (e) => e.preventDefault());
      overlay.loadFile(path.join(__dirname, 'point-overlay.html'));
    }
    overlayDisplay = display;
    overlay.setAlwaysOnTop?.(true, 'screen-saver');
    overlay.setBounds(display.bounds);
    overlay.showInactive();
  }
  function stop(reason = 'Point & ask stopped.', show = false) {
    const previous = current;
    current = null;
    lastCapture = null;
    if (previous) {
      overlayCapture = null;
      clearGraph();
    }
    clearTimeout(lastCaptureTimer);
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
      text: s.text || 'Preparing voice · keep holding',
    });
  }
  function begin() {
    if (!enabled || !available()) {
      status('Open Soma exploration and wait for it to load.');
      return;
    }
    if (current?.phase === 'holding') return;
    stop('', false);
    overlayCapture = null;
    refused = null;
    clearGraph();
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
      lastCapture = { id: s.id, snapshot, display: s.display, expires: Date.now() + 120000 };
      overlayCapture = { ...lastCapture, expires: Date.now() + OVERLAY_RETENTION_MS };
      const held = lastCapture;
      lastCaptureTimer = setTimeout(() => {
        if (lastCapture === held) lastCapture = null;
      }, 120000);
      showPanel(pointPanelBounds(s.display.workArea, focus));
      send({ type: 'source', id: s.id, ...snapshot, focus, canPointBack: true });
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
    overlayCapture = null;
    refused = null;
    clearGraph();
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
    if (event.state === 'partial' && typeof event.text === 'string') {
      current.text = 'Heard: ' + event.text.slice(0, 240);
      status(current.text);
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
  async function highlight(event) {
    const c = lastCapture;
    // The drawn search would appear in the comparison capture and own Escape; skip.
    if (graph?.verified) {
      highlightResult({ id: event?.id, shown: false });
      return;
    }
    const valid =
      event &&
      typeof event.id === 'string' &&
      Array.isArray(event.anchors) &&
      event.anchors.length > 0 &&
      event.anchors.length <= 6 &&
      event.anchors.every(
        (a) =>
          a &&
          typeof a.label === 'string' &&
          a.label.length <= 100 &&
          a.region &&
          ['x', 'y', 'width', 'height'].every((k) => Number.isFinite(a.region[k])) &&
          a.region.x >= 0 &&
          a.region.y >= 0 &&
          a.region.width > 0 &&
          a.region.height > 0 &&
          a.region.x + a.region.width <= 1.000001 &&
          a.region.y + a.region.height <= 1.000001,
      );
    if (
      highlightBusy ||
      !valid ||
      !c ||
      c.id !== event.id ||
      Date.now() > c.expires ||
      current
    ) {
      highlightResult({ id: event?.id, shown: false });
      return;
    }
    highlightBusy = true;
    globalShortcut.register('Escape', () => {
      stop('Source highlight cancelled.', true);
      highlightResult({ id: c.id, shown: false });
    });
    hideForHighlight();
    try {
      await new Promise((r) => setTimeout(r, 120));
      if (lastCapture !== c) return;
      const fresh = await captureImage(c.display);
      if (lastCapture !== c) return;
      // Exact match is intentionally conservative: a changed screen must never
      // receive a confident overlay at stale coordinates. No tracking claim.
      const match = fresh.dataUrl === c.snapshot.dataUrl;
      showPanel();
      if (match) {
        overlayFor(c.display);
        draw({
          type: 'annotations',
          anchors: event.anchors.map((a) => ({ label: a.label, region: a.region })),
          text: 'Soma · source reference',
        });
        hideTimer = setTimeout(() => {
          hideOverlay();
          globalShortcut.unregister('Escape');
        }, 4500);
      }
      if (!match) globalShortcut.unregister('Escape');
      highlightResult({ id: c.id, shown: match });
    } catch {
      if (lastCapture === c) {
        globalShortcut.unregister('Escape');
        showPanel();
        highlightResult({ id: c.id, shown: false });
      }
    } finally {
      highlightBusy = false;
    }
  }
  async function screenOverlay(event) {
    const c = overlayCapture;
    if (!event || typeof event.id !== 'string' || !c || c.id !== event.id) return;
    if (event.model === null || Date.now() > c.expires) {
      if (graph?.id === c.id) clearGraph();
      return;
    }
    // A capture whose screen changed, or that the learner dismissed, stays down until the
    // next gesture, so the page cannot trigger repeated captures.
    if (refused === c.id || current || highlightBusy) return;
    if (!validOverlayModel(event.model)) {
      if (graph?.id === c.id) clearGraph();
      overlayResult({ id: c.id, shown: false });
      return;
    }
    const verified = graph?.id === c.id && graph.verified;
    graph = { id: c.id, model: event.model, verified };
    // After the learner used another app, check the slide is still the one drawn on before
    // drawing the next step. Soma's windows are left out of that capture, without hiding.
    if (verified && stale && !verifying && Date.now() - lastCheck > 3000) {
      verifying = true;
      stale = false;
      let ok = false;
      try {
        const fresh = await captureClean(c.display);
        ok = compareRegion(c.snapshot.dataUrl, fresh.dataUrl, overlayRegion(graph.model));
      } catch {
        ok = false;
      } finally {
        verifying = false;
        lastCheck = Date.now();
      }
      if (overlayCapture !== c || graph?.id !== c.id) return;
      if (!ok) {
        clearGraph();
        refused = c.id;
        overlayResult({ id: c.id, shown: false });
        return;
      }
    }
    if (!verified) {
      if (verifying) return; // the latest model is drawn once verification finishes
      verifying = true;
      let ok = false;
      hideForHighlight();
      try {
        await new Promise((r) => setTimeout(r, 120));
        const fresh = await captureImage(c.display);
        ok = compareRegion(c.snapshot.dataUrl, fresh.dataUrl, overlayRegion(graph.model));
      } catch {
        ok = false;
      } finally {
        verifying = false;
        if (overlayCapture === c && !current) showPanel();
      }
      if (overlayCapture !== c || graph?.id !== c.id) return;
      if (!ok) {
        graph = null;
        refused = c.id;
        overlayResult({ id: c.id, shown: false });
        return;
      }
      graph.verified = true;
      overlayResult({ id: c.id, shown: true });
      globalShortcut.register('Escape', () => {
        const hidden = graph?.id;
        clearGraph();
        if (hidden) {
          refused = hidden;
          overlayResult({ id: hidden, shown: false, dismissed: true });
        }
      });
    }
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (graph?.id !== c.id) return;
      clearGraph();
      overlayResult({ id: c.id, shown: false, dismissed: true });
    }, Math.min(OVERLAY_IDLE_MS, c.expires - Date.now()));
    clearTimeout(hideTimer);
    overlayFor(c.display);
    overlay.setIgnoreMouseEvents(true, { forward: true });
    draw({ type: 'graph', model: graph.model });
  }
  function fromOverlay(event) {
    return Boolean(overlay && !overlay.isDestroyed() && event?.sender === overlay.webContents);
  }
  function overlayHover(event, active) {
    if (!fromOverlay(event) || !graph?.verified) return;
    overlay.setIgnoreMouseEvents(active !== true, { forward: true });
  }
  function overlayToggle(event, edgeId) {
    if (!fromOverlay(event) || !graph?.verified || typeof edgeId !== 'string') return;
    if (!graph.model.edges.some((e) => e.id === edgeId)) return;
    overlayAction({ id: graph.id, type: 'toggle-edge', edgeId });
  }
  function dispose() {
    disable();
    overlay?.destroy();
    overlay = null;
  }
  return {
    enable,
    disable,
    clearScreenOverlay,
    markStale,
    stop,
    feedback,
    highlight,
    screenOverlay,
    overlayHover,
    overlayToggle,
    dispose,
    get enabled() {
      return enabled;
    },
  };
}
module.exports = { createPointAsk };
