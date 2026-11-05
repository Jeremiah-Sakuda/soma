import { expect, type Page } from '@playwright/test';

/** Follow the same disclosure path as a user before choosing a secondary example. */
export async function openMoreExamples(page: Page) {
  const disclosure = page.locator('.journal-more-examples:visible').first();
  await expect(disclosure).toBeVisible();
  if ((await disclosure.getAttribute('open')) === null) {
    await disclosure.locator('summary').click();
  }
  await expect(disclosure).toHaveAttribute('open', '');
}
