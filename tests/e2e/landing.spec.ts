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

test('an expired account deep link offers sign-in without creating a demo', async ({ page }) => {
  let workspaceRequests = 0;
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: false, accountWorkspaceAvailable: true } }));
  await page.route('**/api/workspace', route => { workspaceRequests++; return route.fulfill({ status: 401, json: { error: 'Please sign in again.' } }); });
  await page.goto('/?view=study&lesson=private-expired');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Your account session expired.');
  await expect(page).toHaveURL(/lesson=private-expired/);
  expect(workspaceRequests).toBe(1);
});

test('deleting workspace data returns to the entrance without fetching a synthetic workspace', async ({ page }) => {
  const workspace = { ...seedWorkspace('original-delete-account'), mode: 'account' as const };
  let reads = 0, deleted = false;
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: !deleted, accountWorkspaceAvailable: true } }));
  await page.route('**/api/workspace', route => { if (route.request().method() === 'DELETE') { deleted = true; return route.fulfill({ json: { deleted: true } }); } reads++; return route.fulfill({ json: { workspace, capabilities: { spark: false, persistence: 'local-synthetic', liveSources: [] } } }); });
  await page.route('**/api/jobs', route => route.fulfill({ json: { jobs: [] } }));
  await page.goto('/');
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.locator('summary').filter({ hasText: 'Delete workspace data' }).click();
  await page.getByLabel('Delete my current workspace records', { exact: true }).check();
  await page.getByRole('button', { name: 'Delete workspace data', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  expect(deleted).toBe(true); expect(reads).toBe(1);
  await expect(page).toHaveURL(/\/$/);
});

test('signing into another account discards delayed investigation output and queued old saves', async ({ page }) => {
  const first = { ...seedWorkspace('original-delayed-account-a'), mode: 'account' as const };
  const second = { ...seedWorkspace('original-delayed-account-b'), mode: 'account' as const };
  first.lessons[0].diagnosticInvestigationId = 'synthetic-pending-investigation';
  second.lessons[0].title = 'Account B private lesson';
  let account: 'a' | 'b' | null = 'a', actions = 0, started = false, reads = 0, heldRead = false, importStarted = false;
  let finish!: () => void; const held = new Promise<void>(resolve => { finish = resolve; });
  const capabilities = { spark: true, persistence: 'local-synthetic', liveSources: [] };
  await page.route('https://identitytoolkit.googleapis.com/**', route => route.fulfill({ json: { idToken: 'synthetic-test-token-never-valid' } }));
  await page.route('**/api/auth/session', route => { if (route.request().method() === 'DELETE') account = null; if (route.request().method() === 'POST') account = 'b'; return route.fulfill({ json: { authenticated: !!account, accountWorkspaceAvailable: true } }); });
  await page.route('**/api/workspace', async route => { const workspace = account === 'b' ? second : first; if (++reads === 2) { heldRead = true; await held; } await route.fulfill({ json: { workspace, capabilities } }); });
  await page.route('**/api/imports', async route => { importStarted = true; await held; await route.fulfill({ json: { workspace: first, capabilities } }); });
  await page.route('**/api/jobs', route => route.fulfill({ json: { jobs: [] } }));
  await page.route('**/api/investigations', async route => { started = true; await held; await route.fulfill({ json: { workspace: first, capabilities, selectedLessonId: first.lessons[0].id, notice: 'Old account response must stay hidden.' } }); });
  await page.route('**/api/actions', route => { actions++; return route.fulfill({ json: { workspace: first, capabilities } }); });
  await page.goto('/?view=courses');
  await page.getByRole('button', { name: 'Investigate course update', exact: true }).first().click();
  await expect.poll(() => started).toBe(true);
  // Opening sources queues a diagnostic-help save behind the held investigation.
  await page.getByRole('button', { name: 'Inspect sources', exact: true }).click();
  // Also hold a reload and a child component's import callback from account A.
  await page.evaluate(() => window.dispatchEvent(new PopStateEvent('popstate')));
  await expect.poll(() => heldRead).toBe(true);
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.locator('summary').filter({ hasText: /^Add selected source material$/ }).click();
  await page.getByLabel('Stable source key', { exact: true }).fill('synthetic-held-import');
  await page.getByLabel('Source title', { exact: true }).fill('Original synthetic source');
  await page.getByLabel('Course ID', { exact: true }).fill('circuits');
  await page.getByLabel('Course code', { exact: true }).fill('EE 201');
  await page.getByLabel('Course title', { exact: true }).fill('Synthetic Circuits');
  await page.getByLabel('Selected source text', { exact: true }).fill('Original synthetic course material for a held import.');
  await page.getByRole('button', { name: 'Import selected source', exact: true }).click();
  await expect.poll(() => importStarted).toBe(true);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Study what matters next.', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await page.getByLabel('Email', { exact: true }).fill('synthetic-b@example.test');
  await page.getByLabel('Password', { exact: true }).fill('synthetic-fixture-password');
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Your private account' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Today', exact: true }).click();
  await expect(page.getByRole('heading', { name: second.lessons[0].title, exact: true })).toBeVisible();
  const responseFinished = page.waitForResponse('**/api/investigations'); finish(); await responseFinished;
  // A subsequent browser request gives the response continuation and abandoned queue time to settle.
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await expect(page.getByRole('heading', { name: 'Your private account' })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.getByRole('heading', { name: second.lessons[0].title, exact: true })).toBeVisible();
  await expect(page.getByText('Old account response must stay hidden.', { exact: true })).toHaveCount(0);
  await expect(page).toHaveURL(/view=today/); expect(actions).toBe(0);
});
