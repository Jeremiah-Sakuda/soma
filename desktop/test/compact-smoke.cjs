// Real Electron shell + synthetic page: the compact ask bar's window, guards and controls.
// No OS capture and no provider calls.
const { _electron: electron } = require('../../node_modules/playwright-core');
const http = require('node:http');
const assert = require('node:assert/strict');
const path = require('node:path');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  const fixture = `<!doctype html><title>Soma fixture</title><textarea id="exploration-question"></textarea><script>
    window.compactEvents = [];
    window.addEventListener('soma:compact', (e) => compactEvents.push(e.detail));
  </script>`;
  const server = http.createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end(fixture);
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  let app;
  try {
    app = await electron.launch({
      args: [path.resolve(__dirname, '..')],
      executablePath: process.env.SOMA_TEST_EXECUTABLE || require('electron'),
      env: { ...process.env, SOMA_DESKTOP_URL: `http://127.0.0.1:${server.address().port}` },
    });
    let toolbar;
    for (let i = 0; i < 100 && !toolbar; i++) {
      toolbar = app.windows().find((p) => p.url().endsWith('/toolbar.html'));
      if (!toolbar) await wait(100);
    }
    assert.ok(toolbar, 'Native toolbar loaded');
    await toolbar.waitForSelector('#compact');
    await app.evaluate(async ({ BrowserWindow }) => {
      const v = BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('toolbar.html')).contentView.children[0];
      if (v.webContents.isLoading()) await new Promise((r) => v.webContents.once('did-finish-load', r));
    });
    const windows = () =>
      app.evaluate(({ BrowserWindow }) => {
        const all = BrowserWindow.getAllWindows();
        const panel = all.find((w) => w.webContents.getURL().endsWith('toolbar.html'));
        const bar = all.find((w) => w.webContents.getURL().endsWith('compact.html'));
        return { panel: panel.isVisible(), bar: Boolean(bar?.isVisible()) };
      });
    await toolbar.click('#compact');
    let bar;
    for (let i = 0; i < 50 && !bar; i++) {
      bar = app.windows().find((p) => p.url().endsWith('/compact.html'));
      if (!bar) await wait(100);
    }
    assert.ok(bar, 'Ask bar opened');
    await bar.waitForSelector('#question');
    await wait(200);
    assert.deepEqual(await windows(), { panel: false, bar: true }, 'the bar replaces the panel');
    const safety = await app.evaluate(({ BrowserWindow }) => {
      const w = BrowserWindow.getAllWindows().find((x) => x.webContents.getURL().endsWith('compact.html'));
      const p = w.webContents.getLastWebPreferences();
      return { top: w.isAlwaysOnTop(), node: p.nodeIntegration, sandbox: p.sandbox, isolation: p.contextIsolation };
    });
    assert.deepEqual(safety, { top: true, node: false, sandbox: true, isolation: true });
    assert.equal(await bar.evaluate(() => typeof require + typeof process), 'undefinedundefined');
    // An empty question is refused locally; nothing is captured.
    await bar.press('#question', 'Enter');
    assert.equal(await bar.textContent('#status'), 'Type a question first.');
    // The page claims a visual, but nothing is drawn on screen: no steps, no Test it, no follow-up mode.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('toolbar.html')).contentView.children[0].webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('soma:compact-state',{detail:{busy:false,visual:true,step:0,steps:5,playing:false,investigable:true,message:''}}))`,
      ),
    );
    await wait(200);
    const ui = await bar.evaluate(() => ({
      steps: document.getElementById('steps').hidden,
      test: document.getElementById('test').hidden,
      fresh: document.getElementById('fresh').hidden,
      placeholder: document.getElementById('question').placeholder,
    }));
    assert.deepEqual(ui, { steps: true, test: true, fresh: true, placeholder: 'Ask about your screen…' });
    // A busy page refuses a new question instead of racing it.
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('toolbar.html')).contentView.children[0].webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('soma:compact-state',{detail:{busy:true,visual:false,step:null,steps:null,playing:false,investigable:false,message:''}}))`,
      ),
    );
    await wait(200);
    await bar.fill('#question', 'Why not the direct edge?');
    await bar.press('#question', 'Enter');
    assert.equal(await bar.textContent('#status'), 'Muse is still working on your last question.');
    assert.equal(await bar.inputValue('#question'), 'Why not the direct edge?', 'the refused question is kept');
    assert.equal(await bar.evaluate(() => document.getElementById('bar').getAttribute('aria-busy')), 'true');
    // Expand returns to the panel; the page's error state reaches the bar on reopening.
    await bar.click('#expand');
    await wait(200);
    assert.deepEqual(await windows(), { panel: true, bar: false });
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('toolbar.html')).contentView.children[0].webContents.executeJavaScript(
        `window.dispatchEvent(new CustomEvent('soma:compact-state',{detail:{busy:false,visual:false,step:null,steps:null,playing:false,investigable:false,message:'Muse could not read that screen.'}}))`,
      ),
    );
    await toolbar.click('#compact');
    await wait(300);
    assert.deepEqual(await windows(), { panel: false, bar: true });
    assert.equal(await bar.textContent('#status'), 'Muse could not read that screen.');
    // The dock icon (activate) brings back the bar, not the panel, while compact mode lasts.
    await app.evaluate(({ app }) => app.emit('activate'));
    await wait(200);
    assert.deepEqual(await windows(), { panel: false, bar: true });
    // Escape hides the bar and leaves the panel closed.
    await bar.press('#question', 'Escape');
    await wait(200);
    assert.deepEqual(await windows(), { panel: false, bar: false });
    assert.deepEqual(await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows().find((w) => w.webContents.getURL().endsWith('toolbar.html')).contentView.children[0].webContents.executeJavaScript('window.compactEvents')), []);
    console.log(JSON.stringify({ passed: true, checks: ['bar replaces panel', 'bar sandbox/isolation', 'empty question refused', 'undrawn visual hides steps and follow-ups', 'busy refusal keeps the question', 'expand restores panel', 'state synced on reopen', 'activate shows bar in compact mode', 'Escape hides bar'], osCapture: 'not exercised', providerCalls: 0 }));
  } finally {
    if (app) await app.close();
    await new Promise((r) => server.close(r));
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
