import { test, expect } from '@playwright/test';

test('a recorded real Muse run is inspectable, manipulable and saved without live generation', async ({
  page,
}) => {
  const actions: string[] = [];
  page.on('request', (r) => {
    if (r.url().endsWith('/api/explore') && r.method() === 'POST')
      actions.push(r.postDataJSON().action);
  });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Watch a recorded Muse run', exact: true }).click();
  await expect(page.getByText('Recorded Muse Spark run', { exact: true })).toBeVisible();
  const pipeline = page.locator('.exploration-pipeline');
  await expect(pipeline).toContainText('Wonder reviewed');
  await pipeline.locator('summary').click();
  await expect(pipeline).toContainText('Spark read the source');
  await pipeline.getByRole('link', { name: 'Inspect recorded calls and timing' }).click();
  await expect(page.locator('#exploration-audit')).toContainText(
    'Muse Wonder advisory review: approve',
  );
  await expect(page.getByText('no inference on replay.', { exact: false })).toBeVisible();
  expect(actions).toEqual(['recording']);
  await pipeline.locator('summary').click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved this version' })).toBeVisible();
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await expect(page.getByText('Recorded Muse Spark run', { exact: true })).toBeVisible();
  await page.getByText('Source & sharing', { exact: true }).click();
  await expect(page.getByRole('img', { name: /Original synthetic screenshot used/ })).toBeVisible();
  expect(actions).toEqual(['recording']);
});

test('weighted graph costs and full node names remain separate on desktop, companion and phone', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/explore');
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  for (const width of [1280, 620, 375]) {
    await page.setViewportSize({ width, height: width === 620 ? 704 : 900 });
    const graph = page.locator('.exploration-weighted-stage').first();
    await expect(graph).toBeVisible();
    await expect(graph.locator('[data-cost-label]')).toHaveCount(6);
    await expect(graph.locator('[data-weighted-node="x"] strong')).toHaveText('Unconnected X');
    const issues = await graph.evaluate((svg) => {
      const bad: string[] = [];
      const overlaps = (a: DOMRect, b: DOMRect) =>
        a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const labels = [...svg.querySelectorAll('[data-cost-label] rect')],
        nodes = [...svg.querySelectorAll('[data-weighted-node] rect')];
      labels.forEach((label, i) => {
        const box = label.getBoundingClientRect();
        if (nodes.some((n) => overlaps(box, n.getBoundingClientRect())))
          bad.push('cost overlaps node');
        if (labels.slice(i + 1).some((n) => overlaps(box, n.getBoundingClientRect())))
          bad.push('cost overlaps cost');
      });
      for (const label of svg.querySelectorAll('.exploration-weighted-node-label'))
        if (
          label.scrollHeight > label.clientHeight + 1 ||
          label.scrollWidth > label.clientWidth + 1
        )
          bad.push('clipped node label');
      return bad;
    });
    expect(issues).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await graph.screenshot({ path: `.local/pm069/weighted-${width}.png` });
  }
});
