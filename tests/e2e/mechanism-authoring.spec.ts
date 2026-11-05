import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test, expect, type Page } from '@playwright/test';
test.use({ launchOptions: { args: ['--enable-unsafe-swiftshader'] } });
// Retired November 2: the journal's Examples group no longer offers the geometry-authoring
// example or the mechanism recording (the Lab engine took their place). The tests that start
// from those buttons are skipped, kept for when an entry point returns.
const retired = test.skip;
const gatePaths = (page: Page) => page.locator('g[data-anatomy-object="gate"] .anatomy-fill');
const drawing = (page: Page) =>
  gatePaths(page).evaluateAll((paths) => paths.map((p) => p.getAttribute('d')).join(' '));
async function open(page: Page) {
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Open geometry authoring example', exact: true }).click();
  await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-rendered', 'true');
  await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveValue('0');
}

retired(
  'custom geometry follows explanation poses, supports a shared manual override, and reopens exactly',
  async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const original = (await (await page.request.get('/api/explore')).json()).active;
    expect(original.generation.calls).toBe(0);
    expect(original.spec.assumptions.join(' ')).toContain('not a Muse generation');
    const closed = await drawing(page);
    await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveValue(
      '0.45',
    );
    expect(await drawing(page)).not.toBe(closed);
    await page.getByRole('slider', { name: 'Gate opening', exact: true }).fill('0.6');
    const custom = await drawing(page);
    await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveAttribute(
      'aria-valuetext',
      '60 percent, your setting',
    );
    await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveValue(
      '0.6',
    );
    expect(await drawing(page)).toBe(custom);
    await page.getByRole('button', { name: 'Side by side', exact: true }).click();
    await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('button', { name: 'Hinged gate', exact: true }).click();
    await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
    await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
    await expect(
      page.getByText('Saved this version and your exact experiment state.', { exact: true }),
    ).toBeVisible();
    const { active } = await (await page.request.get('/api/explore')).json();
    expect(active.spec).toEqual(original.spec);
    expect(active.source).toEqual(original.source);
    expect(active.state).toMatchObject({
      explanationStep: 2,
      selectedObjectId: 'gate',
      spatial: { renderer: 'anatomy', parameters: { opening: 0.6 } },
    });
    await page.reload();
    await page.locator('.exploration-library button').first().click();
    await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveValue(
      '0.6',
    );
    await expect(
      page.getByRole('button', { name: 'Anatomy illustration', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await page.getByRole('button', { name: 'Follow explanation motion', exact: true }).click();
    await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveValue('1');
    expect(await drawing(page)).not.toBe(custom);
    expect(errors).toEqual([]);
  },
);

retired(
  'keyboard control, reduced motion and responsive geometry retain visible, reachable controls',
  async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await open(page);
    const slider = page.getByRole('slider', { name: 'Gate opening', exact: true });
    await slider.focus();
    await page.keyboard.press('ArrowRight');
    await expect(slider).toHaveValue('0.01');
    await page.keyboard.press('End');
    await expect(slider).toHaveValue('1');
    await page.getByRole('button', { name: 'Side by side', exact: true }).click();
    for (const width of [1440, 620, 375]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.anatomy-canvas')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect((await slider.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page
        .locator('.spatial-comparison')
        .screenshot({ path: `.local/pm113/mechanism-${width}.png` });
    }
  },
);

retired(
  'explanation motion interpolates a rigid hinge; manual takeover is immediate and stops',
  async ({ page }) => {
    await page.addInitScript(() => {
      const original = requestAnimationFrame;
      (window as unknown as { frames: number }).frames = 0;
      window.requestAnimationFrame = (callback) => {
        (window as unknown as { frames: number }).frames++;
        return original(callback);
      };
    });
    await open(page);
    // The existing card-entry explanation animation has its own bounded 2.4s clock.
    await page.waitForTimeout(2600);
    await page.locator('.anatomy-canvas').evaluate((element) => {
      const states: string[] = [];
      new MutationObserver(() =>
        states.push(
          [...element.querySelectorAll('[data-anatomy-object="gate"] .anatomy-fill')]
            .map((p) => p.getAttribute('d'))
            .join(' '),
        ),
      ).observe(element, { subtree: true, attributes: true, attributeFilter: ['d'] });
      (window as unknown as { states: string[] }).states = states;
    });
    await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
    await page.waitForTimeout(500);
    expect(
      await page.evaluate(() => new Set((window as unknown as { states: string[] }).states).size),
    ).toBeGreaterThan(2);
    // Begin another authored transition, then reverse it with direct manipulation.
    await page.getByRole('button', { name: 'Next explanation', exact: true }).click();
    await page.getByRole('slider', { name: 'Gate opening', exact: true }).fill('0.17');
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const manual = await drawing(page);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('slider', { name: 'Gate opening', exact: true }).fill('0.83');
    await page.getByRole('slider', { name: 'Gate opening', exact: true }).fill('0.17');
    expect(await drawing(page)).toBe(manual);
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    const settled = await drawing(page);
    await page.waitForTimeout(450);
    expect(await drawing(page)).toBe(settled);
    // Stepping also restarts the separate, bounded 2.4s narration/card clock.
    await page.waitForTimeout(2200);
    const before = await page.evaluate(() => (window as unknown as { frames: number }).frames);
    await page.waitForTimeout(450);
    expect(await drawing(page)).toBe(settled);
    expect(await page.evaluate(() => (window as unknown as { frames: number }).frames)).toBe(
      before,
    );
  },
);

retired(
  'foreign and out-of-range saved mechanism parameters are rejected atomically',
  async ({ page }) => {
    await open(page);
    const { active } = await (await page.request.get('/api/explore')).json();
    const valid = await page.request.patch('/api/explore', {
      headers: { origin: new URL(page.url()).origin },
      data: { action: 'save', artifactId: active.id, version: active.version, state: active.state },
    });
    expect(valid.status()).toBe(200);
    for (const parameters of [{ foreign: 0.2 }, { opening: 1.1 }]) {
      const response = await page.request.patch('/api/explore', {
        headers: { origin: new URL(page.url()).origin },
        data: {
          action: 'save',
          artifactId: active.id,
          version: active.version,
          state: { ...active.state, spatial: { ...active.state.spatial, parameters } },
        },
      });
      expect(response.status()).toBe(400);
    }
    expect((await (await page.request.get('/api/explore')).json()).active.state).toEqual(
      active.state,
    );
  },
);

retired(
  'authored geometry remains inspectable in 2D and when WebGL is unavailable',
  async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        kind: string,
        ...args: unknown[]
      ) {
        if (/webgl/i.test(kind)) return null;
        return original.apply(this, [kind, ...args] as Parameters<typeof original>);
      } as typeof original;
    });
    await open(page);
    await page.getByRole('button', { name: 'Current 3D', exact: true }).click();
    await expect(
      page.getByText('3D is unavailable on this device.', { exact: false }),
    ).toBeVisible();
    await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-rendered', 'true');
    const before = await drawing(page);
    await page.getByRole('slider', { name: 'Gate opening', exact: true }).fill('1');
    await expect.poll(() => drawing(page)).not.toBe(before);
    await page.getByRole('button', { name: '2D view', exact: true }).click();
    await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '3');
    await expect(page.getByRole('slider', { name: 'Gate opening', exact: true })).toHaveValue('1');
  },
);

retired(
  'actual recorded Muse mechanism is inspectable in both renderers and labels replay provenance',
  async ({ page }) => {
    await page.goto('/explore');
    await page.getByRole('button', { name: 'Open Muse mechanism recording', exact: true }).click();
    await expect(
      page.getByText('Recorded Spark/Wonder run on an original synthetic screenshot.', {
        exact: false,
      }),
    ).toBeVisible();
    await expect(page.locator('.anatomy-canvas')).toHaveAttribute('data-object-count', '4');
    await page.getByRole('slider', { name: 'Opening', exact: true }).fill('0.6');
    await page.getByRole('button', { name: 'Side by side', exact: true }).click();
    await expect(page.locator('.spatial-canvas canvas')).toHaveAttribute('data-rendered', 'true');
    await page.getByRole('button', { name: 'Gate', exact: true }).click();
    await expect(page.locator('.anatomy-selected-label')).toContainText('Gate');
    await page
      .locator('.spatial-comparison')
      .screenshot({ path: '.local/pm113/actual-muse-comparison.png' });
    await page.getByRole('button', { name: 'Anatomy illustration', exact: true }).click();
    await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
    await expect(
      page.getByText('Saved this version and your exact experiment state.', { exact: true }),
    ).toBeVisible();
    await page.reload();
    await page.locator('.exploration-library button').first().click();
    await expect(page.getByRole('slider', { name: 'Opening', exact: true })).toHaveValue('0.6');
    const { active } = await (await page.request.get('/api/explore')).json();
    expect(active.recording.id).toBe('mechanism-2026-10-30');
    expect(active.generation.calls).toBe(5);
  },
);

// Render-only replay of the real opt-in provider test's two saved versions.
for (const version of ['first', 'next'])
  for (const renderer of ['three', 'anatomy'])
    test(`renders actual Muse mechanism ${version} with ${renderer}`, async ({ page }) => {
      test.skip(
        !process.env.SOMA_MECHANISM_REPLAY,
        'Requires original synthetic actual-provider artifacts.',
      );
      const directory = process.env.SOMA_MECHANISM_REPLAY!,
        artifact = JSON.parse(readFileSync(join(directory, `${version}-artifact.json`), 'utf8'));
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(e.message));
      await page.route(/\/api\/explore(?:\?.*)?$/, async (route) => {
        if (route.request().method() === 'GET')
          return route.fulfill({
            json: { active: artifact, artifacts: [artifact], versions: [], liveEnabled: false },
          });
        return route.fallback();
      });
      await page.goto('/explore');
      await page.locator('.exploration-library button').first().click();
      await page
        .getByRole('button', {
          name: renderer === 'three' ? 'Current 3D' : 'Anatomy illustration',
          exact: true,
        })
        .click();
      await expect(
        page.locator(renderer === 'three' ? '.spatial-canvas canvas' : '.anatomy-canvas'),
      ).toHaveAttribute('data-rendered', 'true');
      await expect(page.getByRole('slider', { name: 'Opening', exact: true })).toHaveValue(
        version === 'first' ? '0' : '0.6',
      );
      await page
        .locator('.spatial-workspace')
        .screenshot({ path: join(directory, `${version}-${renderer}-render.png`) });
      expect(errors).toEqual([]);
    });
