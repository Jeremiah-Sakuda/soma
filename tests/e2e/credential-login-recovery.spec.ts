import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const capability = 'k'.repeat(43),
  version = '69d51382-5482-402e-bc98-0d0a989b2f10';
const syntheticPassword = 'original-synthetic-login-recovery-canary';
async function setup(
  page: Page,
  options: { code?: string; bootstrapFailure?: boolean; saved?: boolean; abortFill?: boolean } = {},
) {
  const requests: { action: string; body: Record<string, unknown> }[] = [];
  const root = resolve('services/credential-runner');
  await page.route('**/assets/*', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    if (!['login.js', 'login.css', 'mfa.js'].includes(name))
      throw new Error('Unexpected synthetic credential asset.');
    await route.fulfill({
      body: await readFile(resolve(root, name)),
      contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css',
    });
  });
  await page.route('**/credential-login-test', async (route) =>
    route.fulfill({ body: await readFile(resolve(root, 'login.html')), contentType: 'text/html' }),
  );
  await page.route('**/credential-login-test/*', async (route) => {
    const action = new URL(route.request().url()).pathname.split('/').pop()!;
    requests.push({ action, body: route.request().postDataJSON() });
    if ((action === 'bootstrap' || action === 'status') && !options.bootstrapFailure) {
      return route.fulfill({
        json: {
          phase: 'ready',
          credential: options.saved
            ? { version, status: 'active' }
            : { version: null, status: 'absent' },
        },
      });
    }
    if (options.abortFill) return route.abort();
    return route.fulfill({
      status: 409,
      json: {
        code: options.code ?? 'form_not_reviewed',
        error: `Unreviewed upstream message: ${syntheticPassword}`,
      },
    });
  });
  await page.goto(`/credential-login-test#${capability}`);
  return requests;
}

test('failed save-and-fill explains retained password uncertainty and offers explicit manual recovery without another fill', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const requests = await setup(page);
  await expect(page.getByRole('status')).toContainText('No password has been filled');
  await page.getByLabel('BU username or BU email').fill('original-synthetic@bu.edu');
  await page.getByLabel('BU password', { exact: true }).fill(syntheticPassword);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Save encrypted password and sign in' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('alert')).toContainText(
    'Soma stopped rather than fill an unreviewed page',
  );
  await expect(page.getByRole('alert')).toBeFocused();
  await expect(page.getByRole('heading', { name: 'Recover your sign-in' })).toBeVisible();
  await expect(
    page.getByText('Your encrypted password may still be stored', { exact: false }),
  ).toBeVisible();
  await expect(page.getByText('For manual sign-in', { exact: false })).toContainText(
    'Cancel secure sign-in',
  );
  await expect(page.getByText('For manual sign-in', { exact: false })).toContainText(
    'Reconnect BU Blackboard',
  );
  await expect(page.locator('#password')).toHaveValue('');
  await expect(page.locator('#identifier')).toHaveValue('');
  await expect(page.locator('#entry')).toBeHidden();
  await expect(page.locator('#mfa')).toBeHidden();
  await expect(page.locator('body')).not.toContainText(syntheticPassword);
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(syntheticPassword);
  expect(new URL(page.url()).hash).toBe('');
  // Even a second DOM submit cannot turn a failed one-use action into a retry.
  await page
    .locator('#credential-form')
    .evaluate((form) =>
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })),
    );
  expect(requests.map((item) => item.action)).toEqual(['bootstrap', 'save-fill']);
  await expect(page.getByRole('link', { name: 'Return to Soma' })).toHaveAttribute(
    'rel',
    'noreferrer',
  );
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Return to Soma' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: '.local/screenshots/credential-login-recovery-375.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

for (const [code, message] of [
  ['entry_token', 'This secure link expired or was already used'],
  ['credential_authorization', 'Soma could not confirm permission'],
  ['identity_mismatch', 'does not match the BU identity'],
  ['session_ended', 'This secure window has ended'],
  ['credential_unavailable', 'This page cannot confirm that the BU login completed'],
  ['credential_submit_status', 'BU did not return a supported sign-in response'],
  ['CONFLICT', 'This page cannot confirm that the BU login completed'],
  ['frame_guard', 'This page cannot confirm that the BU login completed'],
  ['unreviewed_secret_error', 'This page cannot confirm that the BU login completed'],
]) {
  test(`isolated login uses fixed recovery copy for ${code} without displaying upstream details`, async ({
    page,
  }) => {
    const requests = await setup(page, { code, bootstrapFailure: true });
    await expect(page.getByRole('alert')).toContainText(message);
    await expect(page.getByRole('alert')).toBeFocused();
    await expect(page.locator('body')).not.toContainText(syntheticPassword);
    await expect(page.getByRole('heading', { name: 'Recover your sign-in' })).toBeVisible();
    await expect(page.locator('#entry')).toBeHidden();
    expect(requests.map((item) => item.action)).toEqual(['bootstrap']);
  });
}

test('saved-password fill remains one use and unsupported layout never opens the MFA display', async ({
  page,
}) => {
  const requests = await setup(page, { saved: true, code: 'credential_frame_guard' });
  await page.getByRole('button', { name: 'Use my saved password once' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'page layout this login service does not support',
  );
  await expect(page.locator('#mfa')).toBeHidden();
  expect(requests.find((item) => item.action === 'fill')?.body).toEqual({ version });
  await page.locator('#fill').evaluate((button) => (button as HTMLButtonElement).click());
  expect(requests.filter((item) => item.action === 'fill')).toHaveLength(1);
  expect(requests.filter((item) => item.action === 'forget')).toHaveLength(0);
});

test('network failure after a fill request does not imply the credential was never saved', async ({
  page,
}) => {
  const requests = await setup(page, { saved: true, abortFill: true });
  await page.getByRole('button', { name: 'Use my saved password once' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'This page cannot confirm that the BU login completed',
  );
  await expect(
    page.getByText('Your encrypted password may still be stored', { exact: false }),
  ).toBeVisible();
  expect(requests.map((item) => item.action)).toEqual(['bootstrap', 'fill']);
});
