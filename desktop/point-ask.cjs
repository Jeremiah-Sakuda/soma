const path = require('node:path');
const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const { randomUUID } = require('node:crypto');
const { selectFocus, pointPanelBounds } = require('./point-geometry.cjs');
const { validOverlayModel, overlayRegion, regionMatches, sheetRegion, cropCapture } = require('./screen-overlay.cjs');
const OVERLAY_RETENTION_MS = 20 * 60 * 1000;
// With no update for this long the learner has likely moved on; stop drawing over the screen.
const OVERLAY_IDLE_MS = 3 * 60 * 1000;
// While lifted, how often the slide under the sheet is checked against the capture.
const LIFT_CHECK_MS = 5000;
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
  cropImage = (dataUrl, region) => cropCapture(require('electron').nativeImage, dataUrl, region),
}) {
  // The checked search drawn over the real display: bound to one Point & ask capture,
  // shown only after its region still matches, cleared by Escape or the next gesture.
  let overlayCapture = null,
    graph = null,
    verifying = false,
    activeRecheck = null,
    refused = null,
    idleTimer = null,
    // The drawing as a flat sketch on the slide, or lifted off it in 3D.
    view = '2d',
    sheet = null,
    viewChanged = 0,
    liftWatch = null,
    // A lift requested after the learner left Soma waits for a fresh source check.
    // Exact request/capture/model ownership prevents its late result lifting a new scene.
    liftRequest = null;
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
      drawGraph();
      return;
    }
    overlay?.hide();
  }
  /** The capture and region a sheet was cut for: a follow-up that moves the graph needs a new one. */
  function sheetKey() {
    const r = sheetRegion(graph.model);
    return JSON.stringify([graph.id, r.x, r.y, r.width, r.height]);
  }
  function restartIdle(c) {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (graph?.id !== c.id) return;
      // A lifted scene is being looked at, not forgotten: keep it until the capture expires.
      if (view === '3d' && Date.now() < c.expires) return restartIdle(c);
      clearGraph();
      overlayResult({ id: c.id, shown: false, dismissed: true });
    }, Math.min(OVERLAY_IDLE_MS, c.expires - Date.now()));
  }
  /** Draws the verified graph in the current view. Every 3D draw carries the sheet (the
   * capture's graph region), so a scene rebuilt for any reason still covers the slide; the
   * renderer reuses it when unchanged. */
  function drawGraph() {
    let failure = null;
    // A follow-up that moved the graph needs its own region of the slide, or stays flat.
    if (view === '3d' && sheet?.key !== sheetKey() && !cutSheet(overlayCapture)) {
      view = '2d';
      clearInterval(liftWatch);
      liftWatch = null;
      overlay?.setIgnoreMouseEvents(true, { forward: true });
      overlayResult({ id: graph.id, shown: true, view, reason: 'sheet' });
      failure = 'sheet';
    }
    draw({
      type: 'graph',
      model: graph.model,
      view,
      ...(view === '3d' && sheet?.key === sheetKey() && sheet.data ? { sheet: sheet.data } : {}),
    });
    return failure;
  }
  /** Cuts the graph's region from the capture as the 3D sheet. Without it nothing can
   * honestly cover the original, so a failure keeps the drawing flat. */
  function cutSheet(c) {
    try {
      const region = sheetRegion(graph.model);
      sheet = { id: graph.id, key: sheetKey(), data: { dataUrl: cropImage(c.snapshot.dataUrl, region), region } };
      return true;
    } catch {
      return false;
    }
  }
  /** Lifts the drawing off the slide in 3D, or sets it back down. Only a drawing that is
   * verified and on screen can change view. Returns the view now shown. */
  function setView(next, id) {
    if (!['2d', '3d'].includes(next)) return view;
    const c = overlayCapture;
    if (!graph?.verified || !c || graph.id !== c.id || (id && id !== graph.id) || !overlay || overlay.isDestroyed()) return view;
    // Setting the already-flat view must also cancel a lift that is still checking.
    if (next === '2d' && liftRequest) {
      liftRequest = null;
      if (view === '2d') overlayResult({ id: graph.id, shown: true, view });
    }
    if (next === view || !(graph.model.lift || graph.model.scene)) return view;
    if (Date.now() >= c.expires) {
      clearGraph();
      overlayResult({ id: c.id, shown: false, reason: 'cleared' });
      return view;
    }
    if (next === '3d' && (stale || verifying)) {
      overlayResult({ id: graph.id, shown: true, view: '2d', reason: 'checking' });
      if (liftRequest) return view;
      const preceding = activeRecheck?.capture === c ? activeRecheck.done : null;
      // A first-publication check cannot own a verified drawing, but refuse explicitly if
      // an adapter ever reaches that state rather than leaving a checking notice behind.
      if (verifying && !preceding) {
        overlayResult({ id: c.id, shown: true, view: '2d' });
        return view;
      }
      const request = { capture: c, graph };
      liftRequest = request;
      void (async () => {
        // Let an existing owned re-check finish, then verify the entire sheet that will
        // cover the source. No overlapping captures, extra polling or stale lift.
        if (preceding) await preceding;
        if (liftRequest !== request || overlayCapture !== c || graph !== request.graph || !graph.verified) return;
        if (preceding) overlayResult({ id: c.id, shown: true, view: '2d', reason: 'checking' });
        const ok = await recheck(c, sheetRegion(request.graph.model));
        if (liftRequest !== request) return;
        liftRequest = null;
        if (!ok || overlayCapture !== c || graph !== request.graph || !graph.verified || Date.now() >= c.expires) return;
        // Another blur during the capture requires another deliberate lift request.
        if (stale) {
          overlayResult({ id: c.id, shown: true, view: '2d' });
          return;
        }
        if (setView('3d', c.id) !== '3d')
          overlayResult({ id: c.id, shown: true, view: '2d' });
      })();
      return view;
    }
    // Rapid toggles would resend the sheet each time.
    if (Date.now() - viewChanged < 350) return view;
    if (next === '3d' && sheet?.key !== sheetKey() && !cutSheet(c)) {
      overlayResult({ id: graph.id, shown: true, view, reason: 'sheet' });
      return view;
    }
    viewChanged = Date.now();
    view = next;
    liftMisses = 0;
    // Toggling the view is use: the drawing is not idle.
    restartIdle(c);
    clearInterval(liftWatch);
    liftWatch = null;
    // Lifted, the copy of the capture covers the live slide; once the learner has used
    // another app, check within a few seconds and take the drawing down if the slide
    // changed. Not on a timer regardless: each check briefly protects Soma's windows, which
    // screen recorders and shares honour, so a recorded demo would blink.
    if (view === '3d') liftWatch = setInterval(() => void watchLifted(c), LIFT_CHECK_MS);
    // Pointer moves reach the drawing in either view: flat, its connections can be cut; lifted,
    // a model can be turned and its parts picked. Clicks pass through until it is hovered.
    overlay.setIgnoreMouseEvents(true, { forward: true });
    drawGraph();
    overlayResult({ id: graph.id, shown: true, view });
    return view;
  }
  /** The overlay could not draw in 3D (WebGL, or the sheet would not load): stay flat and say so. */
  function liftFailed(event, reason) {
    if (!fromOverlay(event) || view !== '3d' || !graph?.verified) return;
    view = '2d';
    clearInterval(liftWatch);
    liftWatch = null;
    overlay.setIgnoreMouseEvents(true, { forward: true });
    // A 3D draw may already be on its way; redraw flat so both sides agree.
    drawGraph();
    overlayResult({ id: graph.id, shown: true, view, reason: reason === 'sheet' ? 'sheet' : 'webgl' });
  }
  // Set when the learner may have changed the screen by hand (Soma's panel lost focus).
  let stale = false,
    lastCheck = 0;
  function markStale() {
    if (graph?.verified) stale = true;
  }
  /** Captures the display without Soma's own windows in it, so a check or a new snapshot
   * never reads Soma's drawing as slide content. */
  let shielding = 0;
  async function captureClean(display) {
    // Overlapping captures share the protection; the last one to finish removes it.
    const o = overlay && !overlay.isDestroyed() ? overlay : null;
    if (shielding++ === 0) o?.setContentProtection?.(true);
    try {
      // A capture that never returns must not leave Soma's windows protected or the bar busy.
      let timer;
      try {
        return await excludePanel(() =>
          Promise.race([
            captureImage(display),
            new Promise((_resolve, reject) => {
              timer = setTimeout(() => reject(Error('Capture timed out')), 15000);
            }),
          ]),
        );
      } finally {
        clearTimeout(timer);
      }
    } finally {
      if (--shielding === 0 && overlay && !overlay.isDestroyed()) overlay.setContentProtection?.(false);
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
    liftRequest = null;
    graph = null;
    view = '2d';
    sheet = null;
    clearInterval(liftWatch);
    liftWatch = null;
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
      // If the overlay page dies, its drawing is gone: say so rather than keep watching it.
      overlay.webContents.on('render-process-gone', () => {
        const id = graph?.id;
        clearGraph();
        if (id) overlayResult({ id, shown: false, dismissed: true });
        if (overlay && !overlay.isDestroyed()) overlay.webContents.reload();
      });
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
    // A compact-mode question keeps the panel hidden; its status goes to the ask bar.
    if (show && !previous?.compact) showPanel();
    status(reason);
  }
  /** Compact mode: one snapshot of the display the pointer is on, sent with a typed question.
   * Soma's own windows are left out of the snapshot; the panel stays hidden and the checked
   * search is drawn over the screen as usual. */
  async function askTyped(text, onDisplay) {
    const question = typeof text === 'string' ? text.trim().slice(0, 1000) : '';
    if (!question) return { ok: false, message: 'Type a question first.' };
    if (!available()) return { ok: false, message: 'Soma is still loading. Try again in a moment.' };
    if (current) return { ok: false, message: 'Muse is still working on your last question.' };
    stop('', false);
    overlayCapture = null;
    refused = null;
    clearGraph();
    overlay?.hide();
    const display = onDisplay ?? screen.getDisplayNearestPoint(screen.getCursorScreenPoint());
    const s = { id: randomUUID(), display, phase: 'preparing', points: [], compact: true };
    current = s;
    send({ type: 'begin', id: s.id, text: question });
    status('Taking one snapshot of this screen…');
    try {
      await new Promise((resolve) => setTimeout(resolve, 80));
      const snapshot = await captureClean(display);
      // The page refused the question (not ready, or busy) or something else cancelled it;
      // the caller reports the page's own reason when it has one.
      if (current !== s) return { ok: false, message: null };
      lastCapture = { id: s.id, snapshot, display, expires: Date.now() + 120000, compact: true };
      overlayCapture = { ...lastCapture, expires: Date.now() + OVERLAY_RETENTION_MS };
      const held = lastCapture;
      clearTimeout(lastCaptureTimer);
      lastCaptureTimer = setTimeout(() => {
        if (lastCapture === held) lastCapture = null;
      }, 120000);
      send({
        type: 'source',
        id: s.id,
        ...snapshot,
        focus: { kind: 'circle', region: { x: 0, y: 0, width: 1, height: 1 } },
        canPointBack: true,
      });
      send({ type: 'end', id: s.id });
      // Never leave the bar waiting on an answer that is not coming.
      clearTimeout(limit);
      limit = setTimeout(() => {
        if (current === s) stop('Soma did not hear back in time. Ask again.', false);
      }, 180000);
      return { ok: true, message: 'Muse is reading your screen…' };
    } catch {
      // Refused by the page while capturing: the page's reason is the useful one.
      if (current !== s) return { ok: false, message: null };
      const message = 'Capture failed. Check Screen Recording permission for Soma.';
      stop(message, false);
      return { ok: false, message };
    }
  }
  /** True while a checked search is drawn over the screen. */
  function hasDrawing() {
    return Boolean(graph?.verified);
  }
  /** True while a typed compact-mode question is being prepared. */
  function compactActive() {
    return Boolean(current?.compact);
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
      // Leaves the compact ask bar, if shown, out of the snapshot too.
      const snapshot = await captureClean(s.display);
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
      stop(
        event.message ||
          (current.compact ? 'That question did not go through. Try again.' : 'Point & ask stopped. Your previous visual is kept.'),
        true,
      );
      return;
    }
    if (event.state === 'partial' && typeof event.text === 'string') {
      current.text = 'Heard: ' + event.text.slice(0, 240);
      status(current.text);
      return;
    }
    if (event.state === 'ready') {
      const answered = current;
      clearTimers();
      hideOverlay();
      current = null;
      if (answered.compact) {
        // With the panel closed, an answer that is not drawn would otherwise go unseen.
        status('Muse answered. Drawing it on your screen…');
        setTimeout(() => {
          if (overlayCapture?.id === answered.id && graph?.id !== answered.id && refused !== answered.id && !current)
            status('This answer can’t be drawn on your screen. Open it with ⤢.');
        }, 8000);
      } else status('Visual ready. Explore it or ask a follow-up.');
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
      if (graph?.id === c.id) {
        clearGraph();
        overlayResult({ id: c.id, shown: false, reason: 'cleared' });
      }
      return;
    }
    // A capture whose screen changed, or that the learner dismissed, stays down until the
    // next gesture, so the page cannot trigger repeated captures.
    if (refused === c.id || current || highlightBusy) return;
    if (!validOverlayModel(event.model)) {
      if (graph?.id === c.id) clearGraph();
      overlayResult({ id: c.id, shown: false, reason: 'invalid' });
      return;
    }
    const verified = graph?.id === c.id && graph.verified;
    // A model update replaces the scene a pending lift was checked for.
    liftRequest = null;
    graph = { id: c.id, model: event.model, verified };
    if (view === '3d' && !graph.model.lift) {
      view = '2d';
      sheet = null;
      clearInterval(liftWatch);
      liftWatch = null;
    }
    // After the learner used another app, check the slide is still the one drawn on before
    // drawing the next step. Soma's windows are left out of that capture, without hiding.
    if (verified && stale && !verifying && Date.now() - lastCheck > 3000) {
      // Lifted, the same two-miss rule and covered region as the lifted watch.
      if (view === '3d') {
        if (!(await checkLifted(c)) && graph?.id !== c.id) return;
      } else if (!(await recheck(c))) return;
    }
    if (!verified) {
      if (verifying) return; // the latest model is drawn once verification finishes
      verifying = true;
      let ok = false;
      // Snapshots leave Soma's windows out; check the same way. A compact-mode check keeps
      // the panel unopened.
      if (!c.compact) hideForHighlight();
      try {
        await new Promise((r) => setTimeout(r, 120));
        const fresh = await captureClean(c.display);
        ok = compareRegion(c.snapshot.dataUrl, fresh.dataUrl, overlayRegion(graph.model));
      } catch {
        ok = false;
      } finally {
        verifying = false;
        if (overlayCapture === c && !current && !c.compact) showPanel();
      }
      if (overlayCapture !== c || graph?.id !== c.id) return;
      if (!ok) {
        graph = null;
        refused = c.id;
        overlayResult({ id: c.id, shown: false, reason: 'moved' });
        return;
      }
      graph.verified = true;
      globalShortcut.register('Escape', () => {
        const hidden = graph?.id;
        clearGraph();
        if (hidden) {
          refused = hidden;
          overlayResult({ id: hidden, shown: false, dismissed: true });
        }
      });
    }
    restartIdle(c);
    clearTimeout(hideTimer);
    overlayFor(c.display);
    // Lifted or flat, pointer moves reach the drawing; clicks pass through until it is hovered.
    overlay.setIgnoreMouseEvents(true, { forward: true });
    const failure = drawGraph();
    overlayResult({ id: c.id, shown: true, view, ...(failure ? { reason: failure } : liftRequest && view === '2d' ? { reason: 'checking' } : {}) });
  }
  /** Re-checks the slide behind a drawing after the learner may have changed it. Takes the
   * drawing down and returns false if the graph's region no longer matches. */
  async function recheck(c, region = overlayRegion(graph.model), tolerateOnce = false) {
    let resolveDone;
    const check = { capture: c, done: new Promise((resolve) => { resolveDone = resolve; }) };
    activeRecheck = check;
    verifying = true;
    stale = false;
    let ok = false;
    try {
      const fresh = await captureClean(c.display);
      ok = compareRegion(c.snapshot.dataUrl, fresh.dataUrl, region);
    } catch {
      ok = false;
    } finally {
      verifying = false;
      lastCheck = Date.now();
      if (activeRecheck === check) activeRecheck = null;
      resolveDone();
    }
    // A newer capture's first model arrived while this check ran; verify it now.
    if (graph && !graph.verified && overlayCapture && graph.id === overlayCapture.id && graph.id !== c.id)
      void screenOverlay({ id: graph.id, model: graph.model });
    if (overlayCapture !== c || graph?.id !== c.id) return false;
    if (!ok && tolerateOnce) return false;
    if (!ok) {
      clearGraph();
      refused = c.id;
      overlayResult({ id: c.id, shown: false, reason: 'changed' });
    }
    return ok;
  }
  // A passing banner or tooltip can differ for one check; a changed slide differs for two.
  let liftMisses = 0;
  async function watchLifted(c) {
    if (view !== '3d' || !stale || verifying || current || overlayCapture !== c || graph?.id !== c.id || !graph.verified) return;
    await checkLifted(c);
  }
  /** Checks the whole covered region; a single miss is tolerated. Returns whether it matched. */
  async function checkLifted(c) {
    const since = viewChanged;
    const ok = await recheck(c, sheetRegion(graph.model), liftMisses === 0);
    // A view change during the check reset the count; this result is for the old view.
    if (viewChanged === since && graph?.id === c.id) {
      liftMisses = ok ? 0 : liftMisses + 1;
      // A miss leaves the question open: look again on the next tick.
      if (!ok) stale = true;
    }
    return ok;
  }
  function fromOverlay(event) {
    return Boolean(overlay && !overlay.isDestroyed() && event?.sender === overlay.webContents);
  }
  function overlayHover(event, active) {
    if (!fromOverlay(event) || !graph?.verified) return;
    // Lifted, only a model (not a search's strings) can be held and turned.
    if (view === '3d' && active === true && !graph.model.scene) return;
    overlay.setIgnoreMouseEvents(active !== true, { forward: true });
  }
  /** A part of the lifted model was picked: the page selects it for the next question. */
  function overlaySelect(event, objectId) {
    if (!fromOverlay(event) || !graph?.verified || view !== '3d' || typeof objectId !== 'string') return;
    if (!graph.model.scene?.objects.some((o) => o.id === objectId)) return;
    overlayAction({ id: graph.id, type: 'select', objectId });
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
    overlaySelect,
    askTyped,
    hasDrawing,
    compactActive,
    setView,
    liftFailed,
    get view() {
      return view;
    },
    /** Whether the drawing on screen can lift into 3D: a checked graph search, or any answer's 3D scene. */
    get liftable() {
      return Boolean(graph?.verified && (graph.model.lift || graph.model.scene));
    },
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
