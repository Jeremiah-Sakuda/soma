// Packaged-app hosted check. Synthetic screenshot only; never calls desktopCapturer.
const { _electron: electron } = require('../../node_modules/playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
(async () => {
  const executablePath = path.resolve(
    __dirname,
    '../../.local/desktop-dist/Soma-darwin-arm64/Soma.app/Contents/MacOS/Soma',
  );
  let app;
  try {
    app = await electron.launch({ executablePath, env: { ...process.env, SOMA_DESKTOP_URL: '' } });
    let toolbar;
    for (let i = 0; i < 100; i++) {
      toolbar = app.windows().find((p) => p.url().endsWith('/toolbar.html'));
      if (toolbar) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(toolbar, 'Native toolbar loaded');
    await toolbar.waitForSelector('#capture');
    // Hosted page rendering may take longer than the control bar.
    let ready = false;
    for (let i = 0; i < 60; i++) {
      ready = await app.evaluate(async ({ BrowserWindow }) => {
        const v = BrowserWindow.getAllWindows()[0].contentView.children[0];
        return v.webContents
          .executeJavaScript(
            `!!document.querySelector('input[type="file"][aria-label="Upload a PNG or JPEG screenshot"]')`,
          )
          .catch(() => false);
      });
      if (ready) break;
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(ready, 'Hosted upload surface loaded');
    const generated = await app.evaluate(async ({ BrowserWindow }) => {
      const v = BrowserWindow.getAllWindows()[0].contentView.children[0];
      const url = await v.webContents.executeJavaScript(
        `(()=>{const c=document.createElement('canvas');c.width=800;c.height=480;const x=c.getContext('2d');x.fillStyle='#fffdf8';x.fillRect(0,0,800,480);x.fillStyle='#252827';x.font='28px sans-serif';x.fillText('Original synthetic desktop test',50,80);x.font='22px sans-serif';x.fillText('Breadth-first search: S → A, B',50,140);x.fillText('No private screen capture. No model request.',50,200);return c.toDataURL('image/jpeg');})()`,
      );
      v.webContents.send('desktop:snapshot', { dataUrl: url });
      return url.length;
    });
    assert.ok(generated > 1000);
    let preview = false;
    for (let i = 0; i < 20; i++) {
      preview = await app.evaluate(async ({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.executeJavaScript(
          `!!document.querySelector('img.exploration-source-image') && document.activeElement.id === 'exploration-question'`,
        ),
      );
      if (preview) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(preview, 'Real hosted React upload handler prepared source and focused question');
    const result = await app.evaluate(async ({ BrowserWindow, app }) => {
      const w = BrowserWindow.getAllWindows()[0],
        v = w.contentView.children[0];
      return {
        packaged: app.isPackaged,
        url: v.webContents.getURL(),
        viewport: await v.webContents.executeJavaScript(
          `({width:innerWidth,overflow:document.documentElement.scrollWidth>innerWidth})`,
        ),
      };
    });
    assert.equal(result.packaged, true);
    assert.equal(new URL(result.url).origin, 'https://soma-woad-beta.vercel.app');
    assert.equal(result.viewport.overflow, false);
    const image = await app.evaluate(async ({ BrowserWindow }) =>
      (
        await BrowserWindow.getAllWindows()[0].contentView.children[0].webContents.capturePage()
      ).toDataURL(),
    );
    await fs.mkdir(path.resolve(__dirname, '../../.local/pm049'), { recursive: true });
    await fs.writeFile(
      path.resolve(__dirname, '../../.local/pm049/hosted.png'),
      Buffer.from(image.split(',')[1], 'base64'),
    );
    console.log(
      JSON.stringify({
        passed: true,
        ...result,
        checks: [
          'packaged native launch',
          'production origin',
          'hosted React snapshot preview',
          'composer focus',
          'no horizontal overflow',
        ],
        osCapture: 'not exercised',
        providerCalls: 0,
      }),
    );
  } finally {
    if (app) await app.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
