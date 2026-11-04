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
  const { overlayFor, circuitOverlay } = require(bundle);
  // "circuit" renders the Lecture 9 bridge's voltage lift instead of a saved explanation.
  const circuit = artifactPath === 'circuit';
  const { spec, state } = circuit ? { spec: { mode: 'checked-circuit' }, state: {} } : JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
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
      window.somaPointOverlay = { onDraw: (cb) => (window.__draw = cb), hover: (on) => (window.__hover = on), toggleEdge() {}, select: (id) => (window.__selected = id), liftFailed: (r) => (window.__liftFailed = r ?? true) };
    });
    await page.goto(pathToFileURL(path.join(__dirname, '../point-overlay.html')).href);
    await page.addStyleTag({ content: `html{background:#fff url(data:image/png;base64,${slide}) 0 0/100% 100% no-repeat}` });
    const display = { x: 0, y: 0, width: W, height: H };
    // FOCUS=x,y,w,h (fractions of the slide) stands in for the region the learner pointed at.
    const focus = process.env.FOCUS ? (([x, y, width, height]) => ({ x, y, width, height }))(process.env.FOCUS.split(',').map(Number)) : undefined;
    const at = (i) => (circuit ? circuitOverlay(i, H / W) : overlayFor(spec, state, i, H / W, focus));
    const first = at(0);
    const steps = circuit ? first?.steps ?? 0 : spec.mode === 'explanation' ? spec.steps.length : 0;
    if (!first) throw new Error('This answer has no 3D scene.');
    // The companion cuts the drawing's own region when it has one, the scene's otherwise.
    const region = first.nodes.length ? (() => { const xs = first.nodes.map((n) => n.x), ys = first.nodes.map((n) => n.y), pad = first.radius * 1.8; const x = Math.max(0, Math.min(...xs) - pad), y = Math.max(0, Math.min(...ys) - pad); return { x, y, width: Math.min(1, Math.max(...xs) + pad) - x, height: Math.min(1, Math.max(...ys) + pad) - y }; })() : first.scene.region;
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
      await draw(at(i), '3d');
      await advance(1600);
      // ALL=1 keeps every step's frame.
      if (process.env.ALL) await shot(`screen-step${i + 1}`);
      if (i === steps - 1) await shot('screen-last');
    }
    // SECOND=1 steps back to the start and through again, reading the crank's readout at each stop.
    if (process.env.SECOND) {
      const readout = () => page.evaluate(() => document.getElementById('lift-turn-text')?.textContent ?? '');
      const pass = { first: [], back: [], again: [] };
      for (let i = 0; i < steps; i++) { await draw(at(i), '3d'); await advance(3200); pass.first.push(await readout()); }
      for (let i = steps - 2; i >= 0; i--) { await draw(at(i), '3d'); await advance(3200); pass.back.push(await readout()); }
      for (let i = 1; i < steps; i++) {
        await draw(at(i), '3d');
        await advance(500);
        const midway = await readout();
        await advance(2700);
        pass.again.push([midway, await readout()]);
      }
      console.log(JSON.stringify(pass, null, 1));
    }
    // Interaction: point at a part, pick it, then turn the model by dragging.
    let interaction = null;
    if (process.env.INTERACT) {
      const target = await page.evaluate(() => {
        const s = window.SomaModel.debug;
        const v = [...s.parts.values()].find((p) => p.data.visible && p.data.shape !== 'sheet');
        const p = v.mesh.position.clone();
        p.y += (v.extent.min.y + v.extent.max.y) / 2;
        p.x += (v.extent.min.x + v.extent.max.x) / 2;
        p.z += (v.extent.min.z + v.extent.max.z) / 2;
        s.model.localToWorld(p);
        p.project(s.camera);
        return { id: v.id, x: ((p.x + 1) / 2) * s.frame.width + s.frame.dx, y: ((1 - p.y) / 2) * s.frame.height + s.frame.dy };
      });
      await page.mouse.move(target.x, target.y);
      await advance(100);
      const hovered = await page.evaluate(() => window.__hover);
      await page.mouse.down();
      await page.mouse.up();
      const picked = await page.evaluate(() => window.__selected ?? null);
      // The page answers a pick by sending the scene back with the part selected.
      const last = at(steps - 1);
      last.scene.objects = last.scene.objects.map((o) => (o.id === picked ? { ...o, selected: true } : o));
      await draw(last, '3d');
      await advance(600);
      await shot('screen-picked');
      await page.mouse.move(target.x, target.y);
      await page.mouse.down();
      for (let i = 1; i <= 10; i++) await page.mouse.move(target.x + i * 22, target.y + i * 4);
      await page.mouse.up();
      await advance(400);
      const turned = await page.evaluate(() => window.SomaModel.debug.turn);
      await shot('screen-turned');
      interaction = { part: target.id, hovered, picked, turned: Number(turned.toFixed(2)) };
    }
    const failed = await page.evaluate(() => window.__liftFailed ?? null);
    console.log(JSON.stringify({ steps, failed, errors, ...(interaction ? { interaction } : {}) }));
    if (failed || errors.length) process.exitCode = 1;
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
