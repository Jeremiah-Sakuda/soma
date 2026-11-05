// The demo video's page beats, live against a running Soma server in headless Chromium: the
// Lecture 14 slide uploaded as the source, the checked answer, a connection cut on the
// source, the tipping-point investigation, a follow-up, save and reopen, a fresh example and
// Gemini narration. The native on-screen beats are covered by desktop/test/demo-live.cjs.
// Costs one live exploration, an investigation, a follow-up and a fresh example.
// Run: SOMA_URL=http://127.0.0.1:3210 node scripts/demo-page-live.cjs [outDir]
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.SOMA_URL || 'http://127.0.0.1:3210';
const out = path.resolve(process.argv[2] || '.local/demo-page-live');
const slide = path.resolve('docs/examples/hero-dijkstra/lecture-14-dijkstra.png');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch();
  const beats = [],
    speech = [],
    errors = [];
  const page = await (
    await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  ).newPage();
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 300)));
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/hmr|WebSocket/.test(m.text()) &&
      errors.push(m.text().slice(0, 300)),
  );
  page.on(
    'response',
    (r) =>
      r.url().includes('/api/explore/speech') &&
      speech.push({ status: r.status(), model: r.headers()['x-soma-voice-model'] }),
  );
  const text = () => page.evaluate(() => document.body.innerText);
  const until = async (label, predicate, timeout = 180000) => {
    const start = Date.now();
    for (;;) {
      if (await predicate()) return Date.now() - start;
      if (Date.now() - start > timeout) throw new Error(`Timed out waiting for ${label}`);
      await wait(500);
    }
  };
  const beat = async (name, fn) => {
    const started = Date.now();
    try {
      const note = await fn();
      beats.push({ name, ok: true, s: Math.round((Date.now() - started) / 1000), note });
      log('PASS', name, note ?? '');
      await page.screenshot({ path: path.join(out, `${name.split(' ')[0]}.png`), fullPage: false });
    } catch (error) {
      beats.push({ name, ok: false, error: String(error.message).slice(0, 300) });
      log('FAIL', name, String(error.message).slice(0, 300));
      await page
        .screenshot({ path: path.join(out, `FAIL-${name.split(' ')[0]}.png`) })
        .catch(() => {});
      fs.writeFileSync(path.join(out, 'FAIL-page.txt'), await text().catch(() => ''));
      throw error;
    }
  };
  const ask = async (q, button) => {
    await page.fill('#exploration-question', q);
    if (button) await page.getByRole('button', { name: button, exact: true }).click();
    else await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  };
  const toEnd = async () => {
    const pause = page.getByRole('button', { name: 'Pause explanation', exact: true });
    if (await pause.isVisible().catch(() => false)) await pause.click();
    for (let i = 0; i < 12; i++) {
      const next = page.getByRole('button', { name: 'Next step', exact: true });
      if (!(await next.isVisible().catch(() => false)) || (await next.isDisabled())) break;
      await next.click();
      await wait(300);
    }
  };
  try {
    await page.goto(base + '/explore');
    await page.waitForSelector('#exploration-question');
    await beat('1 · slide in, checked answer out', async () => {
      await page.setInputFiles('input[aria-label="Upload a PNG or JPEG screenshot"]', slide);
      await page.fill('#exploration-question', 'Why doesn’t it just take the direct A-to-F edge?');
      await until(
        'the question to be accepted',
        async () =>
          !(await page.getByRole('button', { name: 'Ask Soma', exact: true }).isDisabled()),
        30000,
      );
      await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
      const ms = await until(
        'the answer',
        async () =>
          /Checked Dijkstra computation/.test(await text()) && !/Cancel request/.test(await text()),
        240000,
      );
      await toEnd();
      const t = await text();
      assert.match(t, /A → C → B → D → F = 7/, 'cheapest route A → C → B → D → F, cost 7');
      assert.match(t, /4 \+ 3 = 7 < 11/, 'the equation tag');
      return `answered in ${Math.round(ms / 1000)} s; route 7 and "4 + 3 = 7 < 11" shown`;
    });
    await beat('2 · cut D–F on the source', async () => {
      const cut = page
        .locator('[aria-label^="Cut connection D–F"], [aria-label^="Cut connection F–D"]')
        .first();
      await cut.click({ force: true });
      await until('the cut route', async () => /A → C → E → F/.test(await text()), 30000);
      assert.match(await text(), /cost 9/);
      await page
        .locator('[aria-label*="D–F"], [aria-label*="F–D"]')
        .filter({ hasText: '' })
        .first()
        .click({ force: true })
        .catch(() => {});
      const restore = page.getByRole('button', { name: /Restore/ }).first();
      if (/You cut D–F/.test(await text()) && (await restore.isVisible().catch(() => false)))
        await restore.click();
      await until('restored', async () => !/You cut D–F/.test(await text()), 30000).catch(() => {});
      return 'A → C → E → F, cost 9';
    });
    await beat('3 · investigate: the tipping point', async () => {
      const clear = page.getByRole('button', { name: 'Clear selected object', exact: true });
      if (await clear.isVisible().catch(() => false)) await clear.click();
      await ask(
        'Would the direct A-to-F edge ever be the better route?',
        'Investigate my question',
      );
      const ms = await until(
        'the investigation',
        async () => /Why this connection/.test(await text()),
        240000,
      );
      const t = await text();
      assert.match(t, /A[–-]F/, 'Muse chose A–F');
      return `in ${Math.round(ms / 1000)} s: ${(t.match(/Why this connection:[^\n]*/) ?? [''])[0].slice(0, 140)} | tie: ${(t.match(/[^\n]*\b7\b[^\n]*tie[^\n]*|[^\n]*tie[^\n]*\b7\b[^\n]*/i) ?? ['(no tie line)'])[0].slice(0, 120)}`;
    });
    await beat('4 · follow-up and provenance', async () => {
      const version = async () => Number(((await text()).match(/Version (\d+)/) ?? [0, 0])[1]);
      const before = await version();
      await ask('Why does it only win once it costs seven or less?');
      const ms = await until(
        'the follow-up',
        async () => (await version()) > before || /could not validate/i.test(await text()),
        240000,
      );
      log('follow-up answered in', Math.round(ms / 1000), 's');
      await wait(1500);
      const t = await text();
      assert.doesNotMatch(t, /could not validate/i, 'the follow-up was accepted');
      assert.match(t, /Wonder/);
      return (t.match(/Wonder[^\n]{0,90}/) ?? [''])[0];
    });
    await beat('5 · save and reopen', async () => {
      await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
      await until('saved', async () => /Saved this version/.test(await text()), 30000);
      await page.reload();
      await page.waitForSelector('#exploration-question');
      await page.locator('.exploration-library button').first().click();
      await until('reopened', async () => /Saved/.test(await text()), 30000);
      return 'saved, reloaded, reopened from the library';
    });
    await beat('6 · try a fresh example', async () => {
      const fresh = page.getByRole('button', { name: 'Try a fresh example', exact: true });
      await fresh.scrollIntoViewIfNeeded();
      await fresh.click();
      await until(
        'a fresh problem',
        async () => (await page.locator('.exploration-application').innerText()).length > 200,
        240000,
      );
      return (await page.locator('.exploration-application').innerText())
        .replace(/\s+/g, ' ')
        .slice(0, 200);
    });
    await beat('7 · narration voice', async () => {
      await page.getByRole('button', { name: 'Play explanation', exact: true }).first().click();
      await until('narration audio', async () => speech.some((s) => s.status === 200), 90000);
      assert.ok(speech.some((s) => s.model === 'gemini-3.1-flash-tts-preview'));
      return JSON.stringify(speech.slice(0, 3));
    });
  } finally {
    fs.writeFileSync(
      path.join(out, 'beats.json'),
      JSON.stringify({ beats, speech, errors }, null, 2),
    );
    if (errors.length) log('page errors', JSON.stringify(errors).slice(0, 800));
    console.log(
      JSON.stringify({
        passed: beats.length === 7 && beats.every((b) => b.ok),
        beats: beats.map((b) => `${b.ok ? 'ok' : 'FAIL'} ${b.name}`),
      }),
    );
    await browser.close();
  }
})().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
