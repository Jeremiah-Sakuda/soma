// Renders the real overlay page with the 3D lift over the Lecture 14 slide in headless
// Chromium, from solver-generated models, and saves frames for review. No Electron, no
// capture, no model calls. Usage: node desktop/test/lift-harness.cjs <outDir>
const { chromium } = require('../../node_modules/playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const out = path.resolve(process.argv[2] || path.join(__dirname, '../../.local/lift-harness'));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const { sheetRegion } = await import(pathToFileURL(path.join(__dirname, '../lift-geometry.mjs')).href);
  const { models, cut } = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/hero-lift.json'), 'utf8'));
  const slide = fs.readFileSync(path.join(__dirname, '../../docs/examples/hero-dijkstra/lecture-14-dijkstra.png')).toString('base64');
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const errors = [];
  try {
    const W = Number(process.env.W || 1600), H = Number(process.env.H || 900);
    const context = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: Number(process.env.DPR || 1), bypassCSP: true, reducedMotion: process.env.REDUCED ? 'reduce' : 'no-preference' });
    const page = await context.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => {
      // Virtual time, advanced frame by frame, so each saved frame is at an exact moment.
      window.__virtual = 0;
      window.__liftNow = () => window.__virtual;
      window.__advance = async (ms) => {
        for (let t = 0; t < ms; t += 16) {
          window.__virtual += 16;
          await new Promise((r) => requestAnimationFrame(r));
        }
      };
      window.somaPointOverlay = {
        onDraw: (cb) => (window.__draw = cb),
        hover() {},
        toggleEdge() {},
        liftFailed: () => (window.__liftFailed = true),
      };
    });
    await page.goto(pathToFileURL(path.join(__dirname, '../point-overlay.html')).href);
    // The slide stands in for the learner's screen behind the transparent overlay.
    await page.addStyleTag({ content: `html{background:#fff url(data:image/png;base64,${slide}) 0 0/100% 100% no-repeat}` });
    const sheetFor = (model) =>
      page.evaluate(async ({ src, region }) => {
        const img = new Image();
        img.src = src;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = Math.round(region.width * img.naturalWidth);
        c.height = Math.round(region.height * img.naturalHeight);
        c.getContext('2d').drawImage(img, region.x * img.naturalWidth, region.y * img.naturalHeight, c.width, c.height, 0, 0, c.width, c.height);
        return { dataUrl: c.toDataURL('image/jpeg', 0.9), region };
      }, { src: `data:image/png;base64,${slide}`, region: sheetRegion(model) });
    const display = { x: 0, y: 0, width: W, height: H };
    const draw = (model, view, sheet) => page.evaluate((e) => window.__draw(e), { type: 'graph', model, display, view, ...(sheet ? { sheet } : {}) });
    const advance = (ms) => page.evaluate((v) => window.__advance(v), ms);
    const shot = async (name) => {
      await page.screenshot({ path: path.join(out, `${name}.png`) });
      console.log('saved', name);
    };
    const final = models.at(-1);
    await draw(final, '2d');
    await wait(1500);
    await shot('00-flat-2d');
    const sheet = await sheetFor(final);
    await draw(final, '3d', sheet);
    for (const [ms, name] of [[48, '01-lift-start'], [450, '02-lift-tilting'], [500, '03-lift-rising'], [900, '04-lifted'], [2600, '05-lifted-sway']]) {
      await advance(ms);
      await shot(name);
    }
    // Step through the search in 3D: B drops from 4 to 3 when C settles.
    for (let i = 0; i < models.length; i++) {
      await draw(models[i], '3d');
      await advance(1200);
      await shot(`10-step-${i + 1}`);
    }
    await draw(cut, '3d');
    await advance(1500);
    await shot('20-cut-DF');
    await draw(final, '3d');
    await advance(1500);
    await draw(final, '2d');
    await advance(450);
    await shot('30-landing');
    await advance(900);
    await wait(500);
    await shot('31-landed-2d');
    const failed = await page.evaluate(() => Boolean(window.__liftFailed));
    console.log(JSON.stringify({ out, errors, liftFailed: failed }));
    // A check, not only a camera: any page error or fallback fails the run.
    if (errors.length || failed) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
