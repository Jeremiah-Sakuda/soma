// The demo video's journey, live on the real display, through the panel as recorded: Point &
// ask on the Lecture 14 slide (typed question in place of speech, scripted hold helper),
// the checked search drawn on screen, a connection cut on the slide, the tipping-point
// investigation, a follow-up, save and reopen, a fresh example and the 3D lift, plus Gemini
// narration. Each beat is checked against the script's verified facts and screenshotted.
// Costs one live exploration, an investigation, a follow-up and a fresh example.
// Run: SOMA_DESKTOP_URL=http://127.0.0.1:3210 node test/demo-live.cjs [outDir]
const { _electron: electron } = require('../../node_modules/playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync, spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../../.local/demo-live'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const helper = path.join(__dirname, 'fixtures/fake-hold-shortcut.cjs');
const warp = process.env.WARP_CURSOR;
const beats = [];
let onFail = async () => {};
const beat = async (name, fn) => {
  const started = Date.now();
  try {
    const note = await fn();
    beats.push({ name, ok: true, s: Math.round((Date.now() - started) / 1000), note });
    log('PASS', name, note ?? '');
  } catch (error) {
    beats.push({ name, ok: false, s: Math.round((Date.now() - started) / 1000), error: String(error.message || error).slice(0, 400) });
    await onFail(name).catch(() => {});
    log('FAIL', name, String(error.message || error).slice(0, 400));
    throw error;
  }
};
(async () => {
  assert.ok(process.env.SOMA_DESKTOP_URL, 'Set SOMA_DESKTOP_URL to a running Soma server.');
  assert.ok(warp && fs.existsSync(warp), 'Set WARP_CURSOR to a built warp-cursor binary.');
  fs.mkdirSync(out, { recursive: true });
  const slide = pathToFileURL(path.resolve(__dirname, '../../docs/examples/hero-dijkstra/lecture-14-dijkstra.png')).href;
  const app = await electron.launch({
    args: [path.resolve(__dirname, '..')],
    executablePath: require('electron'),
    env: { ...process.env, SOMA_TEST_HOLD_HELPER: helper },
  });
  const speech = [];
  const consoleErrors = [];
  try {
    let toolbar;
    for (let i = 0; i < 100 && !toolbar; i++) {
      toolbar = app.windows().find((p) => p.url().endsWith('/toolbar.html'));
      if (!toolbar) await wait(100);
    }
    assert.ok(toolbar, 'toolbar loaded');
    // The hosted page is a view inside the panel; reach it through the browser context.
    let page;
    for (let i = 0; i < 200 && !page; i++) {
      page = app.context().pages().find((p) => /\/explore/.test(p.url()));
      if (!page) await wait(150);
    }
    assert.ok(page, 'hosted exploration page reachable');
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text().slice(0, 300)));
    page.on('pageerror', (e) => consoleErrors.push('pageerror: ' + String(e.message).slice(0, 300)));
    page.on('response', (r) => {
      if (r.url().includes('/api/explore/speech')) speech.push({ status: r.status(), model: r.headers()['x-soma-voice-model'] });
    });
    await page.waitForSelector('#exploration-question', { timeout: 60000 });
    // The slide fills the display as Preview would, behind the panel.
    const viewer = path.join(out, 'slide-view.html');
    fs.writeFileSync(viewer, `<!doctype html><body style="margin:0;background:#fff;height:100vh;overflow:hidden"><img src="${slide}" style="display:block;width:100%;height:100vh;object-fit:contain;object-position:left top"></body>`);
    const slideBounds = await app.evaluate(async ({ BrowserWindow, screen }, url) => {
      const d = screen.getPrimaryDisplay();
      const w = new BrowserWindow({ ...d.workArea, frame: false, backgroundColor: '#ffffff', title: 'Slide', show: false });
      await w.loadURL(url);
      w.show();
      globalThis.__slide = w;
      return w.getBounds();
    }, pathToFileURL(viewer).href);
    await wait(1500);
    const overlayPage = () => app.windows().find((p) => p.url().endsWith('point-overlay.html'));
    const shot = async (name) => {
      const png = await app.evaluate(async ({ desktopCapturer, screen }) => {
        const d = screen.getPrimaryDisplay();
        const sources = await desktopCapturer.getSources({ types: ['screen'], thumbnailSize: { width: d.size.width, height: d.size.height } });
        return (sources.find((x) => x.display_id === String(d.id)) ?? sources[0]).thumbnail.toPNG().toString('base64');
      });
      fs.writeFileSync(path.join(out, `${name}.png`), Buffer.from(png, 'base64'));
      await page.screenshot({ path: path.join(out, `${name}-panel.png`) }).catch(() => {});
    };
    const pageText = () => page.evaluate(() => document.body.innerText);
    onFail = async (name) => {
      await shot('FAIL-' + name.split(' ')[0]);
      fs.writeFileSync(path.join(out, 'FAIL-page.txt'), await pageText());
    };
    const until = async (label, predicate, timeout = 180000) => {
      const start = Date.now();
      for (;;) {
        const v = await predicate();
        if (v) return v;
        if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
        await wait(500);
      }
    };
    // Mirror of the model the page sends to the overlay, for edge ids and checked values.
    await page.evaluate(() => window.addEventListener('soma:screen-overlay', (e) => (window.__overlay = e.detail?.model ?? null)));
    const model = () => page.evaluate(() => window.__overlay);
    const ask = async (text, button) => {
      await page.fill('#exploration-question', text);
      if (button) await page.getByRole('button', { name: button, exact: true }).click();
      else await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
    };

    // Keep the slide in front (Stage Manager or a call can bring other windows forward).
    const front = () => app.evaluate(() => { globalThis.__slide.show(); globalThis.__slide.moveTop(); });
    await beat('1 · Point & ask on the slide', async () => {
      await front();
      await toolbar.click('#point');
      await until('Point & ask on', async () => /Point & ask on/.test(await toolbar.textContent('#status')), 15000);
      await page.fill('#exploration-question', 'Why doesn’t it just take the direct A-to-F edge?');
      const pid = execFileSync('pgrep', ['-f', 'fake-hold-shortcut']).toString().trim().split('\n')[0];
      // Hold, circle the graph (the slide's left two thirds), release.
      const img = { w: slideBounds.width, h: Math.min(slideBounds.height, (slideBounds.width * 900) / 1600) };
      const cx = slideBounds.x + img.w * 0.36, cy = slideBounds.y + img.h * 0.47, rx = img.w * 0.25, ry = img.h * 0.24;
      process.kill(Number(pid), 'SIGUSR1');
      await wait(200);
      const pts = [];
      for (let a = 0; a <= Math.PI * 2.1; a += 0.12) pts.push(String(Math.round(cx + rx * Math.cos(a))), String(Math.round(cy + ry * Math.sin(a))));
      spawnSync(warp, pts);
      await wait(200);
      process.kill(Number(pid), 'SIGUSR2');
      const t0 = Date.now();
      await until('the drawing on screen', async () => /Drawn on your screen|Lifted off your slide/.test(await pageText()) && overlayPage(), 240000);
      const m = await model();
      assert.ok(m?.lift, 'the drawn model carries checked distances');
      return `drawn in ${Math.round((Date.now() - t0) / 1000)} s`;
    });

    await beat('2 · checked search on the slide', async () => {
      // Pause narration, then step to the end of the search.
      const pause = page.getByRole('button', { name: 'Pause explanation', exact: true });
      if (await pause.isVisible().catch(() => false)) await pause.click();
      for (let i = 0; i < 12; i++) {
        const next = page.getByRole('button', { name: 'Next step', exact: true });
        if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
        await next.click();
        await wait(500);
      }
      await wait(1500);
      const m = await model();
      const dist = Object.fromEntries(m.nodes.map((n) => [n.label, n.distance]));
      assert.equal(dist.F, 7, `F settles at 7 (got ${dist.F})`);
      assert.equal(dist.B, 3, 'B at 3');
      const overlayText = await overlayPage().evaluate(() => document.getElementById('graph-layer')?.textContent ?? '');
      await shot('2-search-drawn');
      return `distances ${JSON.stringify(dist)}; overlay shows ${overlayText.replace(/\s+/g, ' ').slice(0, 120)}`;
    });

    await beat('3 · cut D–F on the slide', async () => {
      const m = await model();
      const d = m.nodes.find((n) => n.label === 'D')?.id, f = m.nodes.find((n) => n.label === 'F')?.id;
      const edge = m.edges.find((e) => (e.fromId === d && e.toId === f) || (e.fromId === f && e.toId === d));
      assert.ok(edge, 'the D–F connection is drawn');
      await overlayPage().locator(`[data-edge="${edge.id}"]`).first().click({ force: true });
      await until('the cut route', async () => /A → C → E → F/.test(await pageText()), 30000);
      const text = await pageText();
      assert.match(text, /cost 9/, 'the cut route costs 9');
      await shot('3-cut-DF');
      // Restore it for the investigation.
      await overlayPage().locator(`[data-edge="${edge.id}"]`).first().click({ force: true });
      await until('D–F restored', async () => !/You cut D–F/.test(await pageText()), 30000);
      return 'A → C → E → F, cost 9; restored';
    });

    await beat('4 · investigate: the tipping point', async () => {
      // As in the take: D–F is restored and nothing on the slide is selected.
      const clear = page.getByRole('button', { name: 'Clear selected object', exact: true });
      if (await clear.isVisible().catch(() => false)) await clear.click();
      await ask('Would the direct A-to-F edge ever be the better route?', 'Investigate my question');
      await until('the investigation', async () => /Why this connection/.test(await pageText()) || /could not|try again/i.test(await page.locator('[role=alert], .exploration-error').allInnerTexts().then((t) => t.join(' ')).catch(() => '')), 180000);
      assert.match(await pageText(), /Why this connection/, 'the investigation finished');
      const text = await pageText();
      assert.match(text, /A[–-]F/, 'Muse chose A–F');
      assert.match(text, /\b7\b/, 'the tie at 7 is shown');
      await shot('4-investigated');
      return (text.match(/Why this connection:[^\n]*/) ?? [''])[0].slice(0, 160);
    });

    await beat('5 · follow-up and provenance', async () => {
      const version = async () => Number(((await pageText()).match(/Version (\d+)/) ?? [0, 0])[1]);
      const before = await version();
      await ask('Why does it only win once it costs seven or less?');
      await until('the follow-up answer', async () => (await version()) > before || /could not validate/i.test(await pageText()), 180000);
      await wait(1500);
      const text = await pageText();
      assert.doesNotMatch(text, /could not validate/i, 'the follow-up was accepted');
      assert.match(text, /Spark read|Wonder/, 'the provenance line is visible');
      await shot('5-follow-up');
      return (text.match(/Wonder[^\n]{0,80}/) ?? [''])[0];
    });

    await beat('6 · save and reopen', async () => {
      await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
      await until('saved', async () => /Saved this version/.test(await pageText()), 30000);
      await page.reload();
      await page.waitForSelector('#exploration-question', { timeout: 60000 });
      const resume = page.locator('.exploration-library button').first();
      await resume.click();
      await until('reopened', async () => /Saved/.test(await pageText()), 30000);
      await shot('6-reopened');
      return 'saved and reopened from the library';
    });

    await beat('7 · try a fresh example', async () => {
      const fresh = page.getByRole('button', { name: 'Try a fresh example', exact: true });
      await fresh.scrollIntoViewIfNeeded();
      await fresh.click();
      await until('a fresh problem', async () => /Resume fresh practice|predict|Your answer|fresh/i.test(await page.locator('.exploration-application').innerText()), 180000);
      await shot('7-fresh-example');
      return (await page.locator('.exploration-application').innerText()).replace(/\s+/g, ' ').slice(0, 160);
    });

    await beat('8 · Lift into 3D from the panel', async () => {
      // Back to the slide's exploration: a new Point & ask draws it again.
      await page.fill('#exploration-question', 'Why doesn’t it just take the direct A-to-F edge?');
      await front();
      const pid = execFileSync('pgrep', ['-f', 'fake-hold-shortcut']).toString().trim().split('\n')[0];
      process.kill(Number(pid), 'SIGUSR1');
      await wait(400);
      process.kill(Number(pid), 'SIGUSR2');
      await until('drawn again', async () => /Drawn on your screen/.test(await pageText()), 240000);
      const pause = page.getByRole('button', { name: 'Pause explanation', exact: true });
      if (await pause.isVisible().catch(() => false)) await pause.click();
      for (let i = 0; i < 12; i++) {
        const next = page.getByRole('button', { name: 'Next step', exact: true });
        if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
        await next.click();
        await wait(400);
      }
      await page.getByRole('button', { name: 'Lift into 3D', exact: true }).click();
      await wait(3500);
      const lift = await overlayPage().evaluate(() => ({ active: Boolean(window.SomaLift?.active), labels: document.getElementById('lift-labels')?.innerText ?? '' }));
      assert.ok(lift.active, 'the overlay is drawing in 3D');
      assert.match(lift.labels, /F = 7/, 'F rises to 7');
      assert.match(lift.labels, /11 · slack 4/, 'A–F hangs with slack 4');
      assert.match(await pageText(), /Lifted off your slide in 3D/);
      await shot('8-lifted');
      await page.getByRole('button', { name: 'Lift into 3D', exact: true }).click();
      await wait(1500);
      return lift.labels.replace(/\s+/g, ' ').slice(0, 160);
    });

    await beat('9 · narration voice', async () => {
      const play = page.getByRole('button', { name: /^Play/ }).first();
      if (!speech.length && (await play.isVisible().catch(() => false))) {
        await play.click();
        await until('narration audio', async () => speech.length > 0, 60000);
      }
      assert.ok(speech.length, 'narration was requested');
      assert.ok(speech.some((s) => s.status === 200 && s.model === 'gemini-3.1-flash-tts-preview'), `Gemini 3.1 narration served (${JSON.stringify(speech)})`);
      return `${speech.filter((s) => s.status === 200).length}/${speech.length} narration requests served by ${speech[0]?.model}`;
    });
  } finally {
    fs.writeFileSync(path.join(out, 'beats.json'), JSON.stringify({ beats, speech, consoleErrors }, null, 2));
    if (consoleErrors.length) log('page console errors', JSON.stringify(consoleErrors).slice(0, 1200));
    console.log(JSON.stringify({ passed: beats.length === 9 && beats.every((b) => b.ok), beats: beats.map((b) => `${b.ok ? 'ok' : 'FAIL'} ${b.name}`), out }));
    await app.evaluate(() => globalThis.__slide?.destroy()).catch(() => {});
    await app.close().catch(() => {});
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
