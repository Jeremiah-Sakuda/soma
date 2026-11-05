import { test, expect, type Page } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const twoFrames = (p: Page) =>
  p.evaluate(
    () => new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))),
  );
const drawing = (p: Page) => p.locator('.motion-scene').innerHTML();
const boxes = (p: Page) =>
  p.locator('.motion-scene').evaluate((svg) => {
    const root = svg as SVGSVGElement;
    return [...root.querySelectorAll<SVGGraphicsElement>('[data-role]')]
      .filter((n) => ['base', 'head', 'rod', 'grip', 'guide'].includes(n.dataset.role!))
      .map((n) => {
        const b = n.getBBox(),
          m = root.getCTM()!.inverse().multiply(n.getCTM()!);
        const points = [
          [b.x, b.y],
          [b.x + b.width, b.y],
          [b.x, b.y + b.height],
          [b.x + b.width, b.y + b.height],
        ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
        return {
          role: n.dataset.role!,
          id: n.dataset.filmNode!,
          left: Math.min(...points.map((p) => p.x)),
          right: Math.max(...points.map((p) => p.x)),
          top: Math.min(...points.map((p) => p.y)),
          bottom: Math.max(...points.map((p) => p.y)),
        };
      });
  });
test('shows both actual outputs, matching original source and inspectable generation/voice provenance', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.locator('.motion-scene')).toHaveAttribute('data-time', '0.000');
  await page.getByText('Source, authorship & comparison notes', { exact: true }).click();
  await expect(
    page.getByText(
      'Voice is prepared locally with a Mac system voice; it is not Muse speech synthesis.',
      { exact: false },
    ),
  ).toBeVisible();
  const response = await page.request.get('/source.png');
  expect(
    createHash('sha256')
      .update(await response.body())
      .digest('hex'),
  ).toBe(
    createHash('sha256')
      .update(readFileSync('docs/examples/pm117/public/sources/piston.png'))
      .digest('hex'),
  );
  expect(errors).toEqual([]);
});
test('every manual setting keeps actual rendered geometry attached, inside the guide and above its base', async ({
  page,
}) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Shared compression', exact: true });
  let fixed: unknown;
  for (let i = 0; i <= 100; i++) {
    await slider.fill(String(i / 100));
    await twoFrames(page);
    const bs = await boxes(page),
      head = bs.find((b) => b.role === 'head')!,
      rod = bs.find((b) => b.role === 'rod')!,
      grip = bs.find((b) => b.role === 'grip')!,
      base = bs.find((b) => b.role === 'base')!,
      guides = bs.filter((b) => b.role === 'guide').sort((a, b) => a.left - b.left);
    expect(head.bottom).toBeLessThan(base.top - 3);
    expect(Math.abs(rod.bottom - head.top)).toBeLessThan(2);
    expect(Math.abs(rod.top - grip.bottom)).toBeLessThan(2);
    expect(head.left).toBeGreaterThan(guides[0].right + 1);
    expect(head.right).toBeLessThan(guides.at(-1)!.left - 1);
    for (const guide of guides) expect(Math.abs(guide.bottom - base.top)).toBeLessThan(2);
    const supports = bs.filter((b) => ['guide', 'base'].includes(b.role));
    if (i === 0) fixed = supports;
    else expect(supports).toEqual(fixed);
    await expect(page.locator('.baseline .plate-foot strong')).toHaveText(`${i}%`);
  }
});
test('continuous dragging and reversals show exact SVG poses without a trailing animation', async ({
  page,
}) => {
  await page.goto('/');
  const slider = page.getByRole('slider', { name: 'Shared compression', exact: true });
  await slider.fill('1');
  const targets = new Map<number, string>();
  for (const v of [0, 0.17, 0.83, 0.25, 1, 0.65]) {
    await slider.fill(String(v));
    await twoFrames(page);
    targets.set(v, await drawing(page));
  }
  for (const [v, d] of targets) {
    await slider.fill(String(v));
    await twoFrames(page);
    expect(await drawing(page)).toBe(d);
  }
  const rect = (await slider.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.65, rect.y + 22);
  await page.mouse.down();
  for (const f of [0.9, 0.1, 0.8, 0.2]) {
    await page.mouse.move(rect.x + 8 + (rect.width - 16) * f, rect.y + 22, { steps: 8 });
    await twoFrames(page);
    expect(
      Number(await page.locator('.motion-scene').getAttribute('data-compression')),
    ).toBeCloseTo(Number(await slider.inputValue()), 3);
  }
  await page.mouse.up();
  const final = await drawing(page);
  await page.waitForTimeout(450);
  expect(await drawing(page)).toBe(final);
});
test('real prepared audio drives film time, pause/resume/seek and natural completion; idle work stops', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = requestAnimationFrame;
    (window as unknown as { frames: number }).frames = 0;
    window.requestAnimationFrame = (cb) => {
      (window as unknown as { frames: number }).frames++;
      return original(cb);
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause film', exact: true })).toBeVisible();
  await page.waitForTimeout(850);
  const actual = await page.locator('audio').evaluate((a: HTMLAudioElement) => a.currentTime);
  expect(actual).toBeGreaterThan(0.3);
  expect(Number(await page.locator('.motion-scene').getAttribute('data-time'))).toBeCloseTo(
    actual,
    1,
  );
  await page.getByRole('button', { name: 'Pause film', exact: true }).click();
  const paused = Number(
    await page.getByRole('slider', { name: 'Film timeline', exact: true }).inputValue(),
  );
  await page.waitForTimeout(350);
  expect(
    Number(await page.getByRole('slider', { name: 'Film timeline', exact: true }).inputValue()),
  ).toBe(paused);
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await page.waitForTimeout(350);
  expect(
    Number(await page.getByRole('slider', { name: 'Film timeline', exact: true }).inputValue()),
  ).toBeGreaterThan(paused + 0.1);
  await page.getByRole('slider', { name: 'Film timeline', exact: true }).fill('23.4');
  await expect(page.getByRole('button', { name: 'Play film', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play again', exact: true })).toBeVisible();
  await expect(page.locator('.motion-scene')).toHaveAttribute('data-time', '24.000');
  await page.waitForTimeout(450);
  const count = await page.evaluate(() => (window as unknown as { frames: number }).frames);
  await page.waitForTimeout(350);
  expect(await page.evaluate(() => (window as unknown as { frames: number }).frames)).toBe(count);
});
test('interrupting playback with an experiment cancels voice, preserves the exact pose and resumes the authored story', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await page.getByRole('slider', { name: 'Shared compression', exact: true }).fill('0.17');
  await twoFrames(page);
  await expect(page.getByRole('button', { name: 'Resume film', exact: true })).toBeVisible();
  expect(await page.locator('audio').evaluate((a: HTMLAudioElement) => a.paused)).toBe(true);
  const d = await drawing(page);
  await page.waitForTimeout(350);
  expect(await drawing(page)).toBe(d);
  await page.getByRole('button', { name: 'Follow film', exact: true }).click();
  await expect(page.locator('.motion-scene')).toHaveAttribute('data-compression', '1.0000');
  await page.getByRole('slider', { name: 'Film timeline', exact: true }).fill('7.25');
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.waitForTimeout(250);
  await expect(page.locator('.motion-scene')).toHaveAttribute('data-time', '0.000');
});
test('blocked narration falls back to working silent playback and captions', async ({ page }) => {
  await page.route('**/narration.wav', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await expect(page.locator('.status[role=status]')).toContainText('Continuing with captions');
  await expect
    .poll(async () =>
      Number(await page.getByRole('slider', { name: 'Film timeline', exact: true }).inputValue()),
    )
    .toBeGreaterThan(0.2);
  await page.getByRole('button', { name: 'Pause film', exact: true }).click();
  expect(await page.locator('.narration').innerText()).not.toBe('');
});
test('all visible authored labels and paths fit the canvas and labels do not collide', async ({
  page,
}) => {
  await page.goto('/');
  for (const t of [0, 1.5, 5.9, 6, 7.5, 11.9, 12, 13.5, 16, 18, 20, 24]) {
    await page.getByRole('slider', { name: 'Film timeline', exact: true }).fill(String(t));
    await twoFrames(page);
    const layout = await page.locator('.motion-scene').evaluate((svg) => {
      const root = svg as SVGSVGElement,
        visible = (n: Element) => {
          let e: Element | null = n;
          while (e && e !== root) {
            if (Number(e.getAttribute('opacity') ?? 1) < 0.9) return false;
            e = e.parentElement;
          }
          return true;
        };
      return [...root.querySelectorAll<SVGGraphicsElement>('[data-film-node]')]
        .filter(visible)
        .map((n) => {
          const b = n.getBBox(),
            m = root.getCTM()!.inverse().multiply(n.getCTM()!),
            p = new DOMPoint(b.x, b.y).matrixTransform(m),
            q = new DOMPoint(b.x + b.width, b.y + b.height).matrixTransform(m);
          return {
            id: n.dataset.filmNode!,
            text: !!n.querySelector('text'),
            x: p.x,
            y: p.y,
            right: q.x,
            bottom: q.y,
          };
        });
    });
    for (const b of layout) {
      expect(b.x, `${b.id} at ${t}`).toBeGreaterThanOrEqual(12);
      expect(b.right, `${b.id} at ${t}`).toBeLessThanOrEqual(628);
      expect(b.y).toBeGreaterThanOrEqual(12);
      expect(b.bottom).toBeLessThanOrEqual(448);
    }
    const labels = layout.filter((b) => b.text),
      parts = await boxes(page);
    for (const label of labels)
      for (const part of parts)
        expect(
          label.right <= part.left ||
            part.right <= label.x ||
            label.bottom <= part.top ||
            part.bottom <= label.y,
          `${label.id} covers ${part.id} at ${t}`,
        ).toBe(true);
    for (let i = 0; i < labels.length; i++)
      for (let j = i + 1; j < labels.length; j++) {
        const a = labels[i],
          b = labels[j];
        expect(
          a.right <= b.x || b.right <= a.x || a.bottom + 2 <= b.y || b.bottom + 2 <= a.y,
          `${a.id}/${b.id} at ${t}`,
        ).toBe(true);
      }
  }
});
test('keyboard and reduced motion remain usable at desktop, companion and phone widths', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.status[role=status]')).toContainText('Reduced motion');
  const slider = page.getByRole('slider', { name: 'Shared compression', exact: true });
  await slider.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveValue('1');
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue('0.01');
  for (const width of [1440, 620, 375]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await page.screenshot({ path: `.local/pm120/comparison-${width}.png`, fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1050 });
  await page.getByRole('checkbox', { name: 'Narration', exact: true }).uncheck();
  await page.getByRole('button', { name: 'Resume film', exact: true }).click();
  await page.waitForTimeout(500);
  const d = await drawing(page);
  await page.waitForTimeout(500);
  expect(await drawing(page)).toBe(d);
  await page.getByRole('button', { name: 'Pause film', exact: true }).click();
});
test('local replay has no APIs or workspace access and video/audio use proper media and byte ranges', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/');
  for (const url of requests) expect(new URL(url).origin).toBe('http://127.0.0.1:41912');
  expect(requests.some((u) => u.includes('/api/'))).toBe(false);
  for (const path of ['/api/explore', '/.env.local', '/src/lib/server/budget.ts'])
    expect((await page.request.get(path)).status()).toBe(404);
  expect((await page.request.post('/')).status()).toBe(405);
  const video = await page.request.head('/piston-film.mp4');
  expect(video.status()).toBe(200);
  expect(video.headers()['content-type']).toBe('video/mp4');
  const audio = await page.request.get('/narration.wav', { headers: { range: 'bytes=0-43' } });
  expect(audio.status()).toBe(206);
  expect((await audio.body()).length).toBe(44);
  expect(audio.headers()['content-type']).toBe('audio/wav');
  expect(
    (await page.request.get('/narration.wav', { headers: { range: 'bytes=999999999-' } })).status(),
  ).toBe(416);
  expect((await page.request.get('/')).headers()['content-security-policy']).toContain(
    "connect-src 'none'",
  );
});
