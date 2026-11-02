// Held-out 3D evaluation: each case is an original lecture slide and a learner's question
// that the developer did not choose. Each runs live against a Soma server in headless
// Chromium: upload the slide, ask, open the answer in 3D, and keep screenshots of the model at
// the first and last step with the published specification, for independent scoring.
// Costs one live exploration per case (plus a 3D model where the answer needs one).
// Run: SOMA_URL=http://127.0.0.1:3211 node scripts/eval-3d.cjs <casesDir> <outDir> [id ...]
const { chromium } = require('playwright-core');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SOMA_URL || 'http://127.0.0.1:3211';
const casesDir = path.resolve(process.argv[2] || '.local/eval-3d/cases');
const out = path.resolve(process.argv[3] || '.local/eval-3d/run');
const only = process.argv.slice(4);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function until(label, predicate, timeout) {
  const start = Date.now();
  for (;;) {
    if (await predicate()) return Date.now() - start;
    if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
    await wait(500);
  }
}

async function slidePng(browser, id) {
  const png = path.join(casesDir, id, 'slide.png');
  if (fs.existsSync(png)) return png;
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto('file://' + path.join(casesDir, id, 'slide.html'));
  await page.screenshot({ path: png });
  await page.close();
  return png;
}

async function runCase(browser, item) {
  const dir = path.join(out, item.id);
  fs.mkdirSync(dir, { recursive: true });
  const result = { id: item.id, question: item.question, ok: false, notes: [] };
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  const errors = [];
  let artifact = null;
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
  // Answers stream; read the published artifact back from the session afterwards.
  const latest = async () => {
    const body = await page.evaluate(async () => (await fetch('/api/explore')).json());
    return body.active ?? null;
  };
  const text = () => page.evaluate(() => document.body.innerText);
  try {
    await page.goto(base + '/explore');
    await page.waitForSelector('#exploration-question');
    await page.setInputFiles('input[aria-label="Upload a PNG or JPEG screenshot"]', await slidePng(browser, item.id));
    await page.fill('#exploration-question', item.question);
    const ask = page.getByRole('button', { name: 'Ask Soma', exact: true });
    await until('the question to be accepted', async () => !(await ask.isDisabled()), 30000);
    const started = Date.now();
    await ask.click();
    const settle = async (label, done) =>
      until(label, async () => {
        const t = await text();
        const head = t.split(/YOUR STUDY JOURNAL|Muse Spark generated/)[0];
        if (/could not validate|could not prepare|did not finish|is busy|limit|could not finish/i.test(head))
          throw new Error(`${label} failed: ${head.split('\n').filter(Boolean).slice(2, 3).join(' ').slice(0, 200)}`);
        return done.test(t) && !/Cancel request/.test(t);
      }, 300000);
    await settle('the answer', /New visual card ready/);
    artifact = await latest();
    result.answerSeconds = Math.round((Date.now() - started) / 1000);
    await wait(1500);
    await page.screenshot({ path: path.join(dir, 'answer.png') });
    result.mode = artifact.spec.mode;
    result.panels = artifact.spec.mode === 'clarify' ? [] : artifact.spec.scene.panels.map((p) => p.kind);
    if (artifact.spec.mode === 'clarify') {
      result.notes.push(`clarify: ${artifact.spec.question}`);
      return result;
    }
    // Open the answer in 3D however the page offers it.
    const open3d = page.getByRole('button', { name: /^(3D workspace|See it in 3D|Build it in 3D|Show in 3D)$/ }).first();
    if (await open3d.isVisible().catch(() => false)) {
      const before = artifact.version, started3d = Date.now();
      const building = /See it in 3D/.test((await open3d.textContent()) ?? '');
      await open3d.click();
      try {
        if (building) await settle('the 3D model', /The 3D model is ready/);
        await until('the 3D stage', async () => (await page.locator('.spatial-stage canvas, .spatial-stage svg').count()) > 0, 30000);
      } catch (e) {
        result.notes.push(String(e.message));
      }
      result.modelSeconds = Math.round((Date.now() - started3d) / 1000);
      artifact = (await latest()) ?? artifact;
      if (artifact.version !== before) result.notes.push(`3D model authored as version ${artifact.version}`);
      await wait(2500);
    } else result.notes.push('no 3D control offered');
    const stage = page.locator('.spatial-stage').first();
    const shoot = async (name) => {
      if (await stage.isVisible().catch(() => false)) {
        await stage.scrollIntoViewIfNeeded();
        await stage.screenshot({ path: path.join(dir, `${name}.png`) });
      } else await page.screenshot({ path: path.join(dir, `${name}.png`) });
    };
    await shoot('3d-first');
    for (let i = 0; i < 12; i++) {
      const next = page.getByRole('button', { name: /^Next (explanation|step)$/ }).first();
      if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
      await next.click();
      await wait(700);
    }
    await wait(1500);
    await shoot('3d-last');
    await page.screenshot({ path: path.join(dir, 'page-last.png'), fullPage: true });
    if (process.env.EVAL_FOLLOWUP) {
      // The learner asks for the model in words, as a follow-up.
      const before = artifact.version;
      await page.fill('#exploration-question', process.env.EVAL_FOLLOWUP);
      await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
      await settle('the follow-up', /New visual card ready/).catch((e) => result.notes.push(`follow-up: ${e.message}`));
      artifact = (await latest()) ?? artifact;
      result.followupPanels = artifact.spec.mode === 'clarify' ? [] : artifact.spec.scene.panels.map((p) => p.kind);
      const toggle = page.getByRole('button', { name: '3D workspace', exact: true });
      if (await toggle.isVisible().catch(() => false) && (await toggle.getAttribute('aria-pressed')) !== 'true') await toggle.click();
      await wait(3000);
      await shoot('followup-3d');
      fs.writeFileSync(path.join(dir, 'followup.json'), JSON.stringify({ spec: artifact.spec }, null, 2));
    }
    result.spatialPanel = artifact.spec.scene.panels.some((p) => p.kind === 'spatial');
    result.ok = true;
    return result;
  } catch (error) {
    result.notes.push(String(error.message).slice(0, 300));
    await page.screenshot({ path: path.join(dir, 'FAIL.png') }).catch(() => {});
    fs.writeFileSync(path.join(dir, 'FAIL-page.txt'), await text().catch(() => ''));
    return result;
  } finally {
    if (artifact) fs.writeFileSync(path.join(dir, 'artifact.json'), JSON.stringify({ spec: artifact.spec, state: artifact.state, generation: artifact.generation }, null, 2));
    result.errors = errors;
    fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify(result, null, 2));
    await context.close();
  }
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const cases = JSON.parse(fs.readFileSync(path.join(casesDir, 'cases.json'), 'utf8')).filter((c) => !only.length || only.includes(c.id));
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const results = [];
  const queue = [...cases];
  // Two at a time: the server is shared and each answer takes a model round trip.
  await Promise.all(
    [0, 1].map(async () => {
      while (queue.length) {
        const item = queue.shift();
        log('start', item.id);
        const r = await runCase(browser, item);
        results.push(r);
        log(r.ok ? 'done' : 'FAIL', item.id, r.mode ?? '', (r.panels ?? []).join(','), r.notes.join(' | ').slice(0, 200));
      }
    }),
  );
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ ok: results.filter((r) => r.ok).length, of: results.length }));
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
