import { test, expect, type Page } from '@playwright/test';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';

const origin = 'https://synthetic-login.example';
const path = '/login/69d51382-5482-402e-bc98-0d0a989b2f10';
const token = 'a'.repeat(43);
async function setup(page: Page, options: { configured?: boolean; loginUrl?: string; denied?: boolean; recoverActive?: boolean } = {}) {
  const workspace = seedEmptyAccountWorkspace('synthetic-secure-autofill');
  const requests: Record<string, string>[] = [];
  let active = options.recoverActive ? { expiresAt: new Date(Date.now() + 1800000).toISOString() } : undefined;
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: true, accountWorkspaceAvailable: true } }));
  await page.route('**/api/workspace', route => route.fulfill({ json: { workspace, capabilities: { spark: false, persistence: 'firestore', liveSources: [] } } }));
  await page.route('**/api/audit**', route => route.fulfill({ json: { runs: [] } }));
  await page.route('**/api/jobs', route => route.fulfill({ json: { jobs: [] } }));
  await page.route('**/api/adaptations', route => route.fulfill({ json: { jobs: [] } }));
  await page.route('**/api/connectors/google/status', route => route.fulfill({ json: { configured: false, providers: { gmail: false, calendar: false }, connections: [] } }));
  await page.route('**/api/connectors/browser', route => route.fulfill({ json: { configured: true, hosting: 'gcp', providers: [
    { provider: 'blackboard', label: 'BU Blackboard', homeUrl: 'https://learn.bu.edu/' },
    { provider: 'gradescope', label: 'Gradescope', homeUrl: 'https://www.gradescope.com/' },
  ] } }));
  await page.route('**/api/connectors/credentials', route => {
    if (route.request().method() === 'GET') return route.fulfill({ json: { configured: options.configured ?? true, origin, providers: [{ provider: 'blackboard', available: options.configured ?? true, active }] } });
    const body = route.request().postDataJSON(); requests.push(body);
    if (options.denied) return route.fulfill({ status: 401, json: { error: 'Synthetic private provider details must not be reflected.' } });
    if (body.action !== 'open') active = undefined;
    return route.fulfill({ json: body.action === 'open' ? { loginUrl: options.loginUrl ?? `${origin}${path}#${token}`, expiresAt: new Date(Date.now() + 1800000).toISOString() } : { notice: 'Synthetic result.' } });
  });
  await page.goto('/'); await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByText('Connect course sites, Gmail and Calendar', { exact: true }).click();
  const region = page.getByRole('region', { name: 'Optional Blackboard credential autofill' });
  await expect(region).toBeVisible();
  return { region, requests };
}

test('secure autofill is opt in, configuration gated and has no app password fields', async ({ page }) => {
  const { region, requests } = await setup(page, { configured: false });
  await expect(region.getByRole('button', { name: 'Set up secure autofill' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect BU Blackboard', exact: true })).toBeEnabled();
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(region).toContainText('You still complete MFA yourself');
  await expect(page.getByRole('region', { name: 'Gradescope connection' }).getByText('Optional secure autofill')).toHaveCount(0);
  expect(requests).toEqual([]);
});

test('separate service link stays transient and session save makes no access claim', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.emulateMedia({ reducedMotion: 'reduce' });
  const { region, requests } = await setup(page);
  await region.getByRole('button', { name: 'Set up secure autofill' }).focus(); await page.keyboard.press('Enter');
  const link = region.getByRole('link', { name: 'Open isolated sign-in service' });
  await expect(link).toHaveAttribute('href', `${origin}${path}#${token}`);
  await expect(link).toHaveAttribute('target', '_blank'); await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  await expect(link).toHaveAttribute('referrerpolicy', 'no-referrer');
  await expect(page.getByRole('button', { name: 'Connect BU Blackboard', exact: true })).toBeDisabled();
  expect(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }))).not.toContain(token);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await region.getByRole('button', { name: 'Save sign-in session' }).click();
  await expect(region.getByRole('status').filter({ hasText: 'Sign-in session saved.' })).toContainText('does not verify course access');
  await expect(link).toHaveCount(0); await expect(page.getByRole('button', { name: 'Connect BU Blackboard', exact: true })).toBeEnabled();
  expect(requests).toEqual([{ action: 'open', provider: 'blackboard' }, { action: 'complete', provider: 'blackboard' }]);
  await region.getByRole('button', { name: 'Set up secure autofill' }).click();
  await region.getByRole('button', { name: 'Cancel secure sign-in' }).click();
  await expect(region.getByRole('status').filter({ hasText: 'Secure sign-in cancelled.' })).toContainText('does not forget a password already saved');
  expect(requests.at(-1)).toEqual({ action: 'cancel', provider: 'blackboard' });
  await page.screenshot({ path: '.local/screenshots/credential-autofill-375.png', fullPage: true });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('untrusted login URLs fail closed before a credential-entry link is exposed', async ({ page }) => {
  const { region } = await setup(page, { loginUrl: `https://unexpected.example${path}#${token}` });
  await region.getByRole('button', { name: 'Set up secure autofill' }).click();
  await expect(region.getByRole('alert')).toContainText('isolated sign-in address was not available');
  await expect(region.getByRole('link')).toHaveCount(0);
});

test('recent sign-in denial shows recovery without reflecting a provider error', async ({ page }) => {
  const { region } = await setup(page, { denied: true });
  await region.getByRole('button', { name: 'Set up secure autofill' }).click();
  await expect(region.getByRole('alert')).toContainText('sign out of Soma and sign in again');
  await expect(region).not.toContainText('Synthetic private provider details');
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
});

test('an interrupted secure flow recovers completion and cancellation without retaining its one-use link', async ({ page }) => {
  const { region, requests } = await setup(page, { recoverActive: true });
  await expect(region).toContainText('A secure sign-in window was opened earlier');
  await expect(region.getByRole('link')).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Set up secure autofill' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Connect BU Blackboard', exact: true })).toBeDisabled();
  await region.getByRole('button', { name: 'Cancel secure sign-in' }).focus(); await page.keyboard.press('Enter');
  await expect(region.getByRole('button', { name: 'Set up secure autofill' })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Connect BU Blackboard', exact: true })).toBeEnabled();
  expect(requests).toEqual([{ action: 'cancel', provider: 'blackboard' }]);
});

test('forgetting stored sign-in is explicit and clears a pending secure flow', async ({ page }) => {
  const { region, requests } = await setup(page, { recoverActive: true, configured: false });
  await expect(region.getByRole('button', { name: 'Forget stored sign-in', exact: true })).toBeEnabled();
  expect(requests).toEqual([]);
  await region.getByRole('button', { name: 'Forget stored sign-in', exact: true }).focus(); await page.keyboard.press('Enter');
  await expect(region.getByRole('status').filter({ hasText: 'Optional stored sign-in removed' })).toContainText('does not sign you out of BU');
  await expect(region.getByRole('button', { name: 'Save sign-in session' })).toHaveCount(0);
  await expect(region.getByRole('button', { name: 'Set up secure autofill' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Connect BU Blackboard', exact: true })).toBeEnabled();
  expect(requests).toEqual([{ action: 'forget', provider: 'blackboard' }]);
});
