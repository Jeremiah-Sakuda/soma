// Live circuit journey on the real display: the original Lecture 9 bridge slide is shown in a
// plain window, the ask bar takes a typed question, Muse answers through the running app, and
// the checked circuit is drawn over the slide. Opening R₂ goes through the overlay's own click
// handler; Test it asks Muse to choose the experiment. Costs one live exploration and one
// investigation. Run: SOMA_DESKTOP_URL=http://127.0.0.1:3210 node test/circuit-live.cjs [outDir]
const { _electron: electron } = require('../../node_modules/playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../../.local/circuit-native'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  assert.ok(process.env.SOMA_DESKTOP_URL, 'Set SOMA_DESKTOP_URL to a running Soma server.');
  fs.mkdirSync(out, { recursive: true });
  const slide = pathToFileURL(
    path.resolve(__dirname, '../../docs/examples/hero-circuit/lecture-9-bridge.png'),
  ).href;
  const app = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    executablePath: require('electron'),
    env: process.env,
  });
  try {
    let toolbar;
    for (let i = 0; i < 100 && !toolbar; i++) {
      toolbar = app.windows().find((p) => p.url().endsWith('/toolbar.html'));
      if (!toolbar) await wait(100);
    }
    assert.ok(toolbar, 'toolbar loaded');
    const screens = await app.evaluate(
      async ({ desktopCapturer }) =>
        (
          await desktopCapturer.getSources({
            types: ['screen'],
            thumbnailSize: { width: 16, height: 16 },
          })
        ).length,
    );
    assert.ok(
      screens > 0,
      'macOS returned no screens to capture: unlock the screen and allow Screen Recording.',
    );
    for (let i = 0; i < 120; i++) {
      const ready = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0]
          .contentView.children[0].webContents.executeJavaScript(
            `!!document.querySelector('#exploration-question') && ![...document.querySelectorAll('button')].every(b => b.disabled)`,
          )
          .catch(() => false),
      );
      if (ready) break;
      await wait(500);
    }
    const viewer = path.join(out, 'slide-view.html');
    fs.writeFileSync(
      viewer,
      `<!doctype html><body style="margin:0;background:#fff;height:100vh"><img src="${slide}" style="display:block;width:100%;height:calc(100vh - 150px);object-fit:contain;object-position:top"></body>`,
    );
    await app.evaluate(({ BrowserWindow, screen }, url) => {
      const d = screen.getPrimaryDisplay();
      const w = new BrowserWindow({
        ...d.workArea,
        frame: false,
        backgroundColor: '#ffffff',
        title: 'Slide',
        show: false,
      });
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
    const overlayModel = () =>
      app.evaluate(async ({ BrowserWindow }) => {
        const o = BrowserWindow.getAllWindows().find((w) =>
          w.webContents.getURL().endsWith('point-overlay.html'),
        );
        if (!o || !o.isVisible()) return null;
        return o.webContents.executeJavaScript(
          `({ tags: [...document.querySelectorAll('.graph-tag:not([visibility]) text')].map(t => t.textContent), cut: [...document.querySelectorAll('.graph-edge.is-cut .graph-hit')].map(h => h.dataset.edge), parts: [...document.querySelectorAll('.graph-hit')].map(h => h.dataset.edge) })`,
        );
      });
    const barState = () =>
      bar.evaluate(() => ({
        status: document.getElementById('status').textContent,
        busy: document.body.classList.contains('busy'),
        step: document.getElementById('steps').hidden
          ? null
          : document.getElementById('step').textContent,
        test: !document.getElementById('test').hidden,
        lift: !document.getElementById('lift').hidden,
      }));
    const shot = async (name) => {
      const file = path.join(out, `${name}.png`);
      const png = await app.evaluate(async ({ desktopCapturer, screen }) => {
        const d = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: d.size.width, height: d.size.height },
        });
        const s = sources.find((x) => x.display_id === String(d.id)) ?? sources[0];
        return s.thumbnail.toPNG().toString('base64');
      });
      fs.writeFileSync(file, Buffer.from(png, 'base64'));
      log('screenshot', file);
    };
    const until = async (label, predicate, timeout = 180000) => {
      const start = Date.now();
      let last = '';
      while (Date.now() - start < timeout) {
        const m = await overlayModel(),
          b = await barState();
        const line = JSON.stringify({ tags: m?.tags?.length ?? null, cut: m?.cut, ...b });
        if (line !== last) log(label, line);
        last = line;
        if (predicate(m, b)) return { m, b, ms: Date.now() - start };
        await wait(400);
      }
      throw new Error(`Timed out: ${label} ${last}`);
    };
    // 1. Ask about the slide; the checked circuit is drawn over it.
    await bar.fill('#question', 'Why is there no current through R5?');
    await bar.press('#question', 'Enter');
    const drawn = await until('first answer', (m, b) => m && !b.busy && b.step !== null);
    log('drawn in', drawn.ms, 'ms');
    if (
      await bar.evaluate(() =>
        document.getElementById('play').getAttribute('aria-label').startsWith('Pause'),
      )
    )
      await bar.click('#play');
    await wait(1500);
    // Show the whole solution: step to the end.
    for (let i = 0; i < 6; i++) {
      const s = (await barState()).step;
      const [k, n] = (s ?? '0 / 0').split(' / ').map(Number);
      if (k >= n) break;
      await bar.click('#next');
      await wait(500);
    }
    await wait(800);
    const final = await overlayModel();
    log('final tags', JSON.stringify(final.tags));
    assert.ok(
      final.tags.some((t) => /^B = 8 V$/.test(t)),
      'B is drawn at 8 V',
    );
    assert.ok(
      final.tags.some((t) => /^C = 8 V$/.test(t)),
      'C is drawn at 8 V',
    );
    assert.ok(
      final.tags.some((t) => /R.*5.*: 0 A$/.test(t)),
      'R5 carries no current',
    );
    assert.equal(
      (await barState()).lift,
      false,
      'a circuit drawing offers no 3D lift on the screen',
    );
    await shot('1-solved');
    // 2. Open R₂ by its own click handler on the overlay.
    const r2 = final.parts.find((id) => /2/.test(id) && !/5/.test(id));
    assert.ok(r2, 'R2 is clickable on the overlay');
    await app.evaluate(({ BrowserWindow }, id) => {
      const o = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('point-overlay.html'),
      );
      return o.webContents.executeJavaScript(
        `document.querySelector('[data-edge="${id}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`,
      );
    }, r2);
    const opened = await until('opened R2', (m) => m && m.cut.includes(r2), 20000);
    log('opened tags', JSON.stringify(opened.m.tags));
    assert.ok(
      opened.m.tags.some((t) => /R.*5.*0\.4138 A →$/.test(t)),
      'current crosses R5 from B to C',
    );
    await shot('2-opened-r2');
    // Reconnect it the same way, then let Muse choose an experiment.
    await app.evaluate(({ BrowserWindow }, id) => {
      const o = BrowserWindow.getAllWindows().find((w) =>
        w.webContents.getURL().endsWith('point-overlay.html'),
      );
      return o.webContents.executeJavaScript(
        `document.querySelector('[data-edge="${id}"]').dispatchEvent(new MouseEvent('click', { bubbles: true }))`,
      );
    }, r2);
    await until('reconnected R2', (m) => m && !m.cut.includes(r2), 20000);
    assert.ok((await barState()).test, 'Test it is offered for a checked circuit');
    if (process.env.CIRCUIT_INVESTIGATE !== 'false') {
      await bar.fill('#question', 'When would current flow through R5?');
      await bar.click('#test');
      await until('investigating', (m, b) => b.busy, 15000).catch(() => null);
      await until('investigated', (m, b) => !b.busy, 180000);
      const experiment = await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(
          `document.querySelector('[aria-label="Checked circuit experiment"]')?.innerText ?? ''`,
        ),
      );
      log('experiment panel', JSON.stringify(experiment));
      assert.match(experiment, /exactly zero when/, 'Soma computed where the current in R5 tips');
      await wait(800);
      await shot('3-investigated');
    }
    log('circuit live journey passed');
  } finally {
    await app.close().catch(() => {});
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
