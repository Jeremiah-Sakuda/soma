import { test, expect } from '@playwright/test';

async function saved(page: import('@playwright/test').Page, weighted = true) {
  await page.goto('/explore');
  await page
    .getByRole('button', {
      name: weighted ? 'Compare weighted paths' : 'Try the original example',
      exact: true,
    })
    .first()
    .click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  const panel = page.getByRole('region', { name: 'Fresh practice', exact: true });
  await expect(
    panel.getByRole('button', { name: 'Try a fresh example', exact: true }),
  ).toBeVisible();
  return panel;
}
test('fresh weighted answer stays hidden, records hint and answer, resumes and opens a new interactive problem', async ({
  page,
}) => {
  const panel = await saved(page);
  const started = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/explore') &&
      r.request().method() === 'POST' &&
      r.request().postDataJSON().action === 'application',
  );
  await panel.getByRole('button', { name: 'Try a fresh example', exact: true }).click();
  const initial = (await (await started).json()).application;
  expect(initial.solution).toBeUndefined();
  expect(initial.expected).toBeUndefined();
  expect(initial.path).toBeUndefined();
  await expect(panel.getByRole('img')).toHaveAccessibleName(/No solution shown/);
  await expect(panel).not.toContainText('One checked route:');
  await panel.getByRole('button', { name: 'Give me a hint' }).click();
  await expect(panel).toContainText('Add the costs along each complete route.');
  await panel.getByLabel('Lowest total cost', { exact: true }).fill('999');
  await panel.getByLabel('How did you decide?').fill('Fewer connections seems cheaper.');
  await panel.getByRole('button', { name: 'Check my answer' }).click();
  await expect(panel.getByRole('status')).toContainText('Your answer differs');
  await expect(panel).toContainText('Answered after a hint');
  await expect(panel.getByRole('button', { name: 'Explain my answer with Muse' })).toBeDisabled();
  await page.reload();
  await page.locator('.exploration-library button').first().click();
  await panel.getByRole('button', { name: 'Resume fresh practice' }).click();
  await expect(panel).toContainText('You answered 999.');
  await expect(panel).toContainText('Fewer connections seems cheaper.');
  await panel.getByRole('button', { name: 'Explore this example', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Explore your fresh example', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next step', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Back to original exploration' }).click();
  await panel.getByRole('button', { name: 'Resume fresh practice' }).click();
  await expect(panel).toContainText('You answered 999.');
});
for (const viewport of [
  { width: 620, height: 704 },
  { width: 375, height: 812 },
]) {
  test(`fresh BFS reveal and keyboard form fit at ${viewport.width} with reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const panel = await saved(page, false);
    await panel.getByRole('button', { name: 'Try a fresh example', exact: true }).focus();
    await page.keyboard.press('Enter');
    const input = panel.getByLabel('Fewest connections', { exact: true });
    await expect(input).toBeVisible();
    const nodeLabel = await panel.locator('.fresh-problem-graph text').last().boundingBox();
    expect(nodeLabel!.height).toBeGreaterThanOrEqual(12);
    await input.focus();
    await page.keyboard.type('1');
    await expect(input).toHaveValue('1');
    await panel.getByRole('button', { name: 'Show the solution', exact: true }).click();
    await expect(panel).toContainText('Solution revealed without an answer.');
    await expect(input).toHaveCount(0);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await panel.screenshot({ path: `test-results/fresh-${viewport.width}.png` });
    await panel.getByRole('button', { name: 'Try another example' }).click();
    await expect(input).toHaveValue('');
    await expect(
      panel.getByRole('button', { name: 'Show the solution', exact: true }),
    ).toBeEnabled();
  });
}
test('a failed answer save keeps the draft and allows a retry without showing the solution', async ({
  page,
}) => {
  const panel = await saved(page, false);
  await panel.getByRole('button', { name: 'Try a fresh example', exact: true }).click();
  await panel.getByLabel('Fewest connections', { exact: true }).fill('2');
  await panel.getByLabel('How did you decide?').fill('Two links through a middle node.');
  let fail = true;
  await page.route('**/api/explore', async (route) => {
    const data = route.request().postDataJSON();
    if (data?.action === 'application' && data.operation === 'answer' && fail) {
      fail = false;
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Synthetic save failure; please retry.' }),
      });
    } else await route.continue();
  });
  await panel.getByRole('button', { name: 'Check my answer' }).click();
  await expect(panel.getByRole('alert')).toContainText('please retry');
  await expect(panel.getByLabel('Fewest connections', { exact: true })).toHaveValue('2');
  await expect(panel.getByLabel('How did you decide?')).toHaveValue(
    'Two links through a middle node.',
  );
  await expect(panel).not.toContainText('One checked route:');
  await panel.getByRole('button', { name: 'Check my answer' }).click();
  await expect(panel.getByRole('status')).toContainText('checked result');
});
