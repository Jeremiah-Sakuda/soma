// Live compact-mode journey on the real display: the Lecture 14 slide is shown in a plain
// window, the ask bar takes a typed question, Muse answers through the hosted app, and the
// checked search is drawn over the slide. Costs one live exploration plus a follow-up and
// an investigation. Run: SOMA_DESKTOP_URL=http://127.0.0.1:3210 node test/compact-live.cjs [outDir]
const { _electron: electron } = require('../../node_modules/playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../../.local/compact-live'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  assert.ok(process.env.SOMA_DESKTOP_URL, 'Set SOMA_DESKTOP_URL to a running Soma server.');
  fs.mkdirSync(out, { recursive: true });
  const slide = pathToFileURL(path.resolve(__dirname, '../../docs/examples/hero-dijkstra/lecture-14-dijkstra.png')).href;
  const app = await electron.launch({ args: [path.resolve(__dirname, '..')], executablePath: require('electron'), env: process.env });
  const panelSeen = [];
  try {
    let toolbar;
    for (let i = 0; i < 100 && !toolbar; i++) {
      toolbar = app.windows().find((p) => p.url().endsWith('/toolbar.html'));
      if (!toolbar) await wait(100);
    }
    assert.ok(toolbar, 'toolbar loaded');
    const screens = await app.evaluate(async ({ desktopCapturer }) => (await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: 16, height: 16 } })).length);
    assert.ok(screens > 0, 'macOS returned no screens to capture: unlock the screen and allow Screen Recording.');
    // The page must be initialized before Point & ask accepts a question.
    for (let i = 0; i < 120; i++) {
      const ready = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children[0].webContents
          .executeJavaScript(`!!document.querySelector('#exploration-question') && ![...document.querySelectorAll('button')].every(b => b.disabled)`)
          .catch(() => false),
      );
      if (ready) break;
      await wait(500);
    }
    // A plain window showing the slide, like Preview would, covering the work area.
    const viewer = path.join(out, 'slide-view.html');
    fs.writeFileSync(viewer, `<!doctype html><body style="margin:0;background:#fff;height:100vh;display:grid;place-items:center"><img src="${slide}" style="width:100%;height:100vh;object-fit:contain"></body>`);
    await app.evaluate(({ BrowserWindow, screen }, url) => {
      const d = screen.getPrimaryDisplay();
      const w = new BrowserWindow({ ...d.workArea, frame: false, backgroundColor: '#ffffff', title: 'Slide', show: false });
      w.loadURL(url);
      w.once('ready-to-show', () => w.show());
      globalThis.__slide = w;
    }, pathToFileURL(viewer).href);
    await wait(1500);
    await toolbar.locator('#compact').click();
    let bar;
    for (let i = 0; i < 50 && !bar; i++) {
      bar = app.windows().find((p) => p.url().endsWith('/compact.html'));
      if (!bar) await wait(100);
    }
    assert.ok(bar, 'ask bar opened');
    await bar.waitForSelector('#question');
    const native = () =>
      app.evaluate(({ BrowserWindow }) => {
        const all = BrowserWindow.getAllWindows();
        const panel = all.find((w) => w.webContents.getURL().endsWith('toolbar.html'));
        const overlay = all.find((w) => w.webContents.getURL().endsWith('point-overlay.html'));
        const askBar = all.find((w) => w.webContents.getURL().endsWith('compact.html'));
        return { panel: panel.isVisible(), overlay: Boolean(overlay?.isVisible()), bar: Boolean(askBar?.isVisible()) };
      });
    const barState = () =>
      bar.evaluate(() => ({
        status: document.getElementById('status').textContent,
        busy: document.body.classList.contains('busy'),
        step: document.getElementById('steps').hidden ? null : document.getElementById('step').textContent,
        test: !document.getElementById('test').hidden,
        fresh: !document.getElementById('fresh').hidden,
        placeholder: document.getElementById('question').placeholder,
      }));
    const shot = async (name) => {
      const file = path.join(out, `${name}.png`);
      const png = await app.evaluate(async ({ desktopCapturer, screen }) => {
        const d = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: d.size.width, height: d.size.height } });
        const s = sources.find((x) => x.display_id === String(d.id)) ?? sources[0];
        return s.thumbnail.toPNG().toString('base64');
      });
      fs.writeFileSync(file, Buffer.from(png, 'base64'));
      log('screenshot', file);
    };
    const until = async (label, predicate, timeout = 120000) => {
      const start = Date.now();
      let last = '';
      while (Date.now() - start < timeout) {
        const n = await native(), b = await barState();
        if (n.panel) panelSeen.push(label);
        const line = JSON.stringify({ ...n, ...b });
        if (line !== last) log(label, line);
        last = line;
        if (predicate(n, b)) return { n, b, ms: Date.now() - start };
        await wait(400);
      }
      throw new Error(`Timed out: ${label} ${last}`);
    };
    const initial = await barState();
    assert.equal(initial.step, null);
    assert.equal(initial.fresh, false);
    // 1. Ask with a snapshot; a second Return while it works is refused, not raced.
    await bar.fill('#question', 'Why doesn’t it just take the direct A-to-F edge?');
    await bar.press('#question', 'Enter');
    await wait(30);
    await bar.fill('#question', 'A second question');
    await bar.press('#question', 'Enter');
    const refused = await barState();
    log('double return', refused.status);
    assert.match(refused.status, /still working|Taking one snapshot|reading your screen/);
    await bar.fill('#question', '');
    const drawn = await until('first answer', (n, b) => n.overlay && !b.busy && b.step !== null, 180000);
    log('first answer drawn in', drawn.ms, 'ms');
    await shot('1-drawn');
    // 2. Step controls.
    const before = drawn.b.step;
    await bar.click('#previous');
    await wait(600);
    const after = (await barState()).step;
    log('step', before, '->', after);
    assert.notEqual(before, after, 'step changes');
    assert.match(after, /^\d+ \/ \d+$/);
    await bar.click('#next');
    await wait(600);
    // 3. A follow-up stays on the same snapshot and keeps the drawing.
    await bar.fill('#question', 'What if D–F weren’t there?');
    await bar.press('#question', 'Enter');
    await until('follow-up started', (_n, b) => b.busy, 20000).catch(() => null);
    const followed = await until('follow-up answered', (n, b) => !b.busy && n.overlay, 180000);
    log('follow-up in', followed.ms, 'ms', followed.b.status);
    await shot('2-follow-up');
    // 4. Test it: Muse picks the connection; Soma computes the boundary.
    if (followed.b.test) {
      await bar.fill('#question', 'Would the direct A-to-F edge ever be the better route?');
      await bar.click('#test');
      await until('investigation started', (_n, b) => b.busy, 20000).catch(() => null);
      const tested = await until('investigation answered', (n, b) => !b.busy && n.overlay, 180000);
      log('investigation in', tested.ms, 'ms', tested.b.status);
      await shot('3-investigated');
    } else log('Test it not offered after the follow-up');
    // 5. Escape hides the bar and clears the drawing.
    await bar.press('#question', 'Escape');
    const hidden = await until('hidden', (n) => !n.bar, 5000);
    assert.equal(hidden.n.overlay, false, 'drawing cleared with the bar');
    assert.deepEqual(panelSeen, [], 'the panel never opened during the compact journey');
    console.log(JSON.stringify({ passed: true, out }));
  } finally {
    await app.evaluate(() => globalThis.__slide?.destroy()).catch(() => {});
    await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
