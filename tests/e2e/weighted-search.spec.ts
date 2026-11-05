import { openMoreExamples } from './example-navigation';
import { test, expect } from '@playwright/test';
test('weighted comparison uses real routes, shows distinct cost/path outcomes and resumes controls', async ({
  page,
}) => {
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Compare weighted paths', exact: true }).click();
  await expect(page.getByText('Checked Dijkstra computation', { exact: true })).toBeVisible();
  for (let i = 0; i < 5; i++) {
    const next = page.getByRole('button', { name: 'Next step', exact: true });
    if (await next.isEnabled()) await next.click();
  }
  await expect(page.getByRole('status').filter({ hasText: 'total cost 3' })).toContainText(
    '3 edges',
  );
  await expect(page.getByRole('status').filter({ hasText: 'total cost 10' })).toContainText(
    '1 edge',
  );
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await expect(page.getByRole('status').filter({ hasText: 'total cost 3' })).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/weighted-phone.png', fullPage: true });
});
