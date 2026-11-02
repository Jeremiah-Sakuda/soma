// Renders the real overlay page lifting an explanation's 3D model off its slide, in headless
// Chromium, from a saved artifact (an eval run's artifact.json). No Electron, capture or
// model calls. Usage: node desktop/test/model-harness.cjs <artifact.json> <slide.png> <outDir>
const { chromium } = require('../../node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
const [artifactPath, slidePath, outArg] = process.argv.slice(2);
const out = path.resolve(outArg || '.local/model-harness');
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { build } = await import(require.resolve('rolldown', { paths: [path.resolve(__dirname, '../..')] }));
  const bundle = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'soma-scene-')), 'scene.cjs');
  await build({ input: path.join(__dirname, 'scene-from-artifact.ts'), resolve: { alias: { '@': path.resolve(__dirname, '../../src') } }, output: { file: bundle, format: 'cjs' }, logLevel: 'silent' });
  const { overlayFor } = require(bundle);
  const { spec, state } = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
  const slide = fs.readFileSync(slidePath).toString('base64');
  const W = Number(process.env.W || 1280), H = Number(process.env.H || 720);
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const page = await (await browser.newContext({ viewport: { width: W, height: H }, bypassCSP: true })).newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => {
      window.__virtual = 0;
      window.__liftNow = () => window.__virtual;
      window.__advance = async (ms) => {
        for (let t = 0; t < ms; t += 16) {
          window.__virtual += 16;
          await new Promise((r) => requestAnimationFrame(r));
        }
      };
      window.somaPointOverlay = { onDraw: (cb) => (window.__draw = cb), hover() {}, toggleEdge() {}, liftFailed: (r) => (window.__liftFailed = r ?? true) };
    });
    await page.goto(pathToFileURL(path.join(__dirname, '../point-overlay.html')).href);
    await page.addStyleTag({ content: `html{background:#fff url(data:image/png;base64,${slide}) 0 0/100% 100% no-repeat}` });
    const display = { x: 0, y: 0, width: W, height: H };
    const steps = spec.mode === 'explanation' ? spec.steps.length : 0;
    const first = overlayFor(spec, state, 0, H / W);
    if (!first) throw new Error('This answer has no 3D scene.');
    const region = first.scene.region;
    const sheet = await page.evaluate(async ({ src, region }) => {
      const img = new Image();
      img.src = src;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = Math.round(region.width * img.naturalWidth);
      c.height = Math.round(region.height * img.naturalHeight);
      c.getContext('2d').drawImage(img, region.x * img.naturalWidth, region.y * img.naturalHeight, c.width, c.height, 0, 0, c.width, c.height);
      return { dataUrl: c.toDataURL('image/jpeg', 0.9), region };
    }, { src: `data:image/png;base64,${slide}`, region });
    const draw = (model, view, withSheet) => page.evaluate((e) => window.__draw(e), { type: 'graph', model, display, view, ...(withSheet ? { sheet } : {}) });
    const advance = (ms) => page.evaluate((v) => window.__advance(v), ms);
    const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });
    await draw(first, '2d');
    await draw(first, '3d', true);
    await advance(700);
    await shot('screen-rising');
    await advance(2600);
    await shot('screen-step1');
    for (let i = 1; i < steps; i++) {
      await draw(overlayFor(spec, state, i, H / W), '3d');
      await advance(1600);
      if (i === steps - 1) await shot('screen-last');
    }
    const failed = await page.evaluate(() => window.__liftFailed ?? null);
    console.log(JSON.stringify({ steps, failed, errors }));
    if (failed || errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
