import { test, expect, type Page } from '@playwright/test';
const controls = { gate: 'Opening', piston: 'Compression control', rotor: 'Turning control' };
const drawing = (page: Page, variant = 'after') => page.locator(`.${variant} .anatomy-fill`).evaluateAll(paths => paths.map(p => p.getAttribute('d')).join(' '));
const twoFrames = (page: Page) => page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
for (const id of ['gate', 'piston', 'rotor'] as const) {
  test(`${id}: scrubbing and reversal show the exact pose within two frames, with no easing tail`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(`/#${id}`);
    const slider = page.getByRole('slider', { name: controls[id], exact: true });
    const targets = new Map<number, string>();
    for (const value of [0, .17, .83, .25, 1, .02, .65]) {
      await slider.fill(String(value)); await twoFrames(page); targets.set(value, await drawing(page));
    }
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const before = await drawing(page, 'before');
    for (const [value, target] of targets) {
      await slider.fill(String(value)); await twoFrames(page);
      expect(await drawing(page), `visible geometry at ${value}`).toBe(target);
    }
    const final = await drawing(page); await page.waitForTimeout(450);
    expect(await drawing(page)).toBe(final); expect(await drawing(page, 'before')).toBe(before);
  });

  test(`${id}: a held pointer drag follows both directions and stops exactly at release`, async ({ page, context }) => {
    const reference = await context.newPage(); await reference.emulateMedia({ reducedMotion: 'reduce' }); await reference.goto(`/#${id}`);
    await page.goto(`/#${id}`); const slider = page.getByRole('slider', { name: controls[id], exact: true });
    const rect = (await slider.boundingBox())!, y = rect.y + rect.height / 2;
    await page.mouse.move(rect.x + rect.width / 2, y); await page.mouse.down();
    for (const fraction of [.8, .95, .6, .15, .4, .05, .9]) {
      await page.mouse.move(rect.x + 8 + (rect.width - 16) * fraction, y, { steps: 5 }); await twoFrames(page);
      const value = await slider.inputValue();
      await reference.getByRole('slider', { name: controls[id], exact: true }).fill(value); await twoFrames(reference);
      expect(await drawing(page), `pointer pose ${value}`).toBe(await drawing(reference));
    }
    await page.mouse.up(); const final = await drawing(page); await page.waitForTimeout(450); expect(await drawing(page)).toBe(final);
    await reference.close();
  });
}
