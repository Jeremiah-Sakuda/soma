import { expect, test } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';

test('new visitors see the product before explicitly opening the synthetic demo', async ({ page, context }) => {
  let workspaceRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/workspace') workspaceRequests++; });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  await expect(page.getByText('The quick demo uses original synthetic courses. No sign-in or connected accounts needed.', { exact: true })).toBeVisible();
  expect(workspaceRequests).toBe(0);
  expect((await context.cookies()).filter(cookie => cookie.name.includes('soma'))).toHaveLength(0);
  await page.screenshot({ path: '.local/screenshots/entrance-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Try quick demo', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Open lesson', exact: true })).toBeVisible();
  await expect(page.locator('.mode-chip')).toHaveText('Synthetic demo');
  expect(workspaceRequests).toBeGreaterThan(0);
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  const countAfterDemo = workspaceRequests;
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  expect(workspaceRequests).toBe(countAfterDemo);
});

test('create account and sign in reuse the accessible account form without fetching a demo', async ({ page }) => {
  let workspaceRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/workspace') workspaceRequests++; });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: false, accountWorkspaceAvailable: true } }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.getByRole('button', { name: 'Create account', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Create your Soma account', exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'new-password');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(workspaceRequests).toBe(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Create account', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Welcome back', exact: true })).toBeVisible();
  await expect(page.getByLabel('Password', { exact: true })).toHaveAttribute('autocomplete', 'current-password');
  await page.getByRole('button', { name: 'Close account dialog', exact: true }).click();
  await page.screenshot({ path: '.local/screenshots/entrance-mobile.png', fullPage: true });
  for (const viewport of [{ width: 360, height: 800 }, { width: 844, height: 390 }, { width: 768, height: 1024 }]) {
    await page.setViewportSize(viewport);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  expect(workspaceRequests).toBe(0);
});

test('an authenticated visitor opens their account directly and logout returns to the entrance', async ({ page }) => {
  const workspace = { ...seedWorkspace('original-account-entrance'), mode: 'account' as const };
  let authenticated = true, workspaceRequests = 0;
  await page.route('**/api/auth/session', route => {
    if (route.request().method() === 'DELETE') authenticated = false;
    return route.fulfill({ json: { authenticated, accountWorkspaceAvailable: true } });
  });
  await page.route('**/api/workspace', route => { workspaceRequests++; return route.fulfill({ json: { workspace, capabilities: { spark: false, persistence: 'local-synthetic', liveSources: [] } } }); });
  await page.route('**/api/jobs', route => route.fulfill({ json: { jobs: [] } }));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Open lesson', exact: true })).toBeVisible();
  await expect(page.locator('.mode-chip')).toHaveText('Your account');
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toHaveCount(0);
  expect(workspaceRequests).toBe(1);
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  expect(workspaceRequests).toBe(1);
});

test('a failed account check cannot silently create a demo workspace', async ({ page }) => {
  let checks = 0, workspaceRequests = 0;
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/workspace') workspaceRequests++; });
  await page.route('**/api/auth/session', route => route.fulfill(++checks === 1 ? { status: 503, json: { error: 'Temporary synthetic failure.' } } : { json: { authenticated: false, accountWorkspaceAvailable: false } }));
  await page.goto('/');
  await expect(page.getByText('Could not check your account session. Please retry.', { exact: true })).toBeVisible();
  expect(workspaceRequests).toBe(0);
  await page.getByRole('button', { name: 'Retry account check', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  expect(checks).toBe(2);
  expect(workspaceRequests).toBe(0);
});
