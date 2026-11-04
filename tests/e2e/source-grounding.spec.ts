import { test, expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import sharp from 'sharp';
import type { SourceGroundingFixtureProps } from '../fixtures/source-grounding-client';

let client: string;
let originalImage: string;
let replacementImage: string;
const anchors = [
  { id: 'connection', label: 'Original connection', region: { x: 0.1, y: 0.1, width: 0.3, height: 0.3 } },
  { id: 'other', label: 'Other source region', region: { x: 0.6, y: 0.6, width: 0.2, height: 0.2 } },
];

test.beforeAll(async () => {
  const bundle = await rolldown({
    input: resolve('tests/fixtures/source-grounding-client.tsx'), platform: 'browser',
    transform: { jsx: 'react-jsx', define: { 'process.env.NODE_ENV': '"production"' } },
  });
  try {
    const { output } = await bundle.generate({ format: 'iife' });
    if (output[0].type !== 'chunk') throw new Error('Expected the local component fixture.');
    client = output[0].code;
  } finally {
    await bundle.close();
  }
  const image = async (background: string) => 'data:image/jpeg;base64,' + (await sharp({
    create: { width: 120, height: 80, channels: 3, background },
  }).jpeg().toBuffer()).toString('base64');
  originalImage = await image('#f4e7d2');
  replacementImage = await image('#d2e7f4');
});

function capture(overrides: Partial<NonNullable<SourceGroundingFixtureProps['capture']>> = {}) {
  return {
    kind: 'capture' as const, label: 'Original synthetic capture', capturedAt: '2026-11-04T05:00:00Z',
    mimeType: 'image/jpeg' as const, dataUrl: originalImage, width: 120, height: 80,
    nativeId: 'synthetic-screen-one', nativeHighlight: true, ...overrides,
  };
}

async function fixture(page: Page, overrides: Partial<SourceGroundingFixtureProps> = {}) {
  // Only this fulfilled local document and its inline component bundle run. Media,
  // application APIs, provider calls and the native companion are not involved.
  await page.route('**/api/**', (route) => route.abort());
  await page.route('**/__source-grounding-fixture', (route) => route.fulfill({
    contentType: 'text/html', body: '<!doctype html><div id="root"></div>',
  }));
  await page.addInitScript((props) => { window.__groundingInitial = props; }, {
    sourceKey: 'synthetic-source:1', capture: capture(), anchors, activeIds: ['connection'], ...overrides,
  });
  await page.goto('/__source-grounding-fixture');
  await page.addScriptTag({ content: client });
  await expect.poll(() => page.evaluate(() => typeof window.__setGroundingProps)).toBe('function');
  await page.getByText('See on source · 2 model-located regions', { exact: true }).click();
}

async function update(page: Page, next: Partial<SourceGroundingFixtureProps>) {
  await page.evaluate((props) => window.__setGroundingProps(props), next);
}

test('a manual source region and stale-screen notice survive unrelated explanation steps', async ({ page }) => {
  await fixture(page);
  const original = page.getByRole('button', { name: 'Original connection', exact: true });
  await original.click();
  await expect(original).toHaveAttribute('aria-pressed', 'true');
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('soma:source-highlight-result', {
    detail: { id: 'synthetic-screen-one', shown: false },
  })));
  const notice = page.getByText('The screen changed or this capture expired. Use the captured source below or capture again.', { exact: true });
  await expect(notice).toBeVisible();

  await update(page, { activeIds: ['other'] });
  await expect(original).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByRole('img', { name: 'Region 1: Original connection', exact: true })).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Region 2: Other source region', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Point on screen', exact: true })).toBeEnabled();
  await expect(notice).toBeVisible();

  // Re-selecting the manually pressed button resumes the current automatic regions.
  await original.click();
  await expect(original).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByRole('img', { name: 'Region 2: Other source region', exact: true })).toHaveCount(1);
  await expect(page.getByRole('img', { name: 'Region 1: Original connection', exact: true })).toHaveCount(0);
  await update(page, { activeIds: [] });
  await expect(page.getByRole('button', { name: 'Point on screen', exact: true })).toBeDisabled();
});

test('manual regions reset for changed capture identity, pixels, and actual anchor definitions', async ({ page }) => {
  await fixture(page, { activeIds: [] });
  const original = page.getByRole('button', { name: 'Original connection', exact: true });
  const point = page.getByRole('button', { name: 'Point on screen', exact: true });
  for (const next of [
    { capture: capture({ capturedAt: '2026-11-04T05:01:00Z' }) },
    { capture: capture({ capturedAt: '2026-11-04T05:01:00Z', nativeId: 'synthetic-screen-two' }) },
    { capture: capture({ capturedAt: '2026-11-04T05:01:00Z', nativeId: 'synthetic-screen-two', dataUrl: replacementImage }) },
    { anchors: anchors.map((anchor) => anchor.id === 'connection' ? { ...anchor, region: { ...anchor.region, x: 0.2 } } : anchor) },
    { anchors: [anchors[1]] },
  ]) {
    await original.click();
    await expect(point).toBeEnabled();
    await update(page, next);
    await expect(point).toBeDisabled();
    await expect(page.locator('.exploration-grounding-region')).toHaveCount(0);
  }
});

test('source ownership resets without pixels and equivalent anchor objects do not erase a manual choice', async ({ page }) => {
  await fixture(page, { capture: undefined, activeIds: [] });
  const original = page.getByRole('button', { name: 'Original connection', exact: true });
  await original.click();
  await update(page, {
    anchors: anchors.map(({ id, label, region }) => ({
      region: { height: region.height, width: region.width, y: region.y, x: region.x }, label, id,
    })),
    activeIds: ['other'],
  });
  await expect(original).toHaveAttribute('aria-pressed', 'true');
  await update(page, { sourceKey: 'another-synthetic-source:1' });
  await page.getByText('See on source · 2 model-located regions', { exact: true }).click();
  await expect(original).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByText('Source pixels were not saved. Capture again to inspect these locations.', { exact: true })).toBeVisible();
});

test('pointing feedback belongs to the current capture and clears on replacement', async ({ page }) => {
  await fixture(page, { activeIds: [] });
  await page.getByRole('button', { name: 'Original connection', exact: true }).click();
  const expired = page.getByText('The screen changed or this capture expired. Use the captured source below or capture again.', { exact: true });
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('soma:source-highlight-result', {
    detail: { id: 'synthetic-screen-one', shown: false },
  })));
  await expect(expired).toBeVisible();
  await update(page, { capture: capture({ nativeId: 'synthetic-screen-two' }) });
  await expect(expired).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Point on screen', exact: true })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('soma:source-highlight-result', {
    detail: { id: 'synthetic-screen-one', shown: false },
  })));
  await expect(expired).toHaveCount(0);
  await page.evaluate(() => window.dispatchEvent(new CustomEvent('soma:source-highlight-result', {
    detail: { id: 'synthetic-screen-two', shown: true },
  })));
  const pointing = page.getByText('Pointing at the captured source on your screen.', { exact: true });
  await expect(pointing).toBeVisible();
  await update(page, { activeIds: ['other'] });
  await expect(pointing).toBeVisible();
});
