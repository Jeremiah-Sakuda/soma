import { test, expect, type Page } from '@playwright/test';
import type { WebSocketRoute } from 'playwright-core';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const capability = 's'.repeat(43);
async function setupViewer(page: Page, bootstrapStatus = 200) {
  const messages: Array<Record<string, unknown>> = [],
    sockets: WebSocketRoute[] = [];
  const state = { bootstrapCount: 0, resumeCount: 0, resumeStatus: 200 };
  const root = resolve('services/browser-runner');
  await page.route('**/assets/viewer.*', async (route) => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    await route.fulfill({
      body: await readFile(resolve(root, name)),
      contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css',
    });
  });
  await page.route('**/gcp-viewer-test', async (route) => {
    await route.fulfill({
      body: await readFile(resolve(root, 'viewer.html')),
      contentType: 'text/html',
    });
  });
  await page.route('**/gcp-viewer-test/bootstrap', async (route) => {
    state.bootstrapCount++;
    expect(route.request().postDataJSON()).toEqual({ token: capability });
    await route.fulfill({ status: bootstrapStatus, json: { ready: true, remainingMs: 1800000 } });
  });
  await page.route('**/gcp-viewer-test/resume', async (route) => {
    state.resumeCount++;
    expect(route.request().postDataJSON()).toEqual({});
    await route.fulfill({
      status: state.resumeStatus,
      json: { ready: true, remainingMs: 1800000 },
    });
  });
  await page.routeWebSocket('**/gcp-viewer-test/socket', (socket) => {
    sockets.push(socket);
    socket.onMessage((message) => messages.push(JSON.parse(String(message))));
    socket.send(
      JSON.stringify({
        type: 'tabs',
        pages: [{ id: 'synthetic-page', origin: 'https://example.com' }],
      }),
    );
  });
  return { messages, sockets, state };
}

test('private login viewer forwards input without retaining pasted credentials', async ({
  page,
}) => {
  const { messages } = await setupViewer(page);
  await page.goto(`/gcp-viewer-test#${capability}`);
  await expect(page.getByRole('status')).toContainText('Connected.');
  expect(new URL(page.url()).hash).toBe('');
  const screen = page.locator('#screen');
  await screen.click();
  await page.keyboard.type('test');
  await page.keyboard.press('Tab');
  await expect
    .poll(() =>
      messages
        .filter((item) => item.type === 'text')
        .map((item) => item.text)
        .join(''),
    )
    .toBe('test');
  expect(
    messages.some((item) => item.type === 'key' && item.event === 'keyDown' && item.key === 'Tab'),
  ).toBe(true);
  await expect(screen).toBeFocused();

  // Native paste must remain available to password managers and clipboard users.
  const nativePasteAllowed = await screen.evaluate((element) =>
    element.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'v',
        code: 'KeyV',
        ctrlKey: true,
        cancelable: true,
        bubbles: true,
      }),
    ),
  );
  expect(nativePasteAllowed).toBe(true);
  await screen.evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text', 'original-synthetic-login-value');
    element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, cancelable: true, bubbles: true }),
    );
  });
  await expect
    .poll(() =>
      messages.some(
        (item) => item.type === 'text' && item.text === 'original-synthetic-login-value',
      ),
    )
    .toBe(true);
  await expect(screen).toHaveText('');
  expect(await page.locator('body').textContent()).not.toContain('original-synthetic-login-value');
  await page.keyboard.press('Escape');
  await expect(screen).not.toBeFocused();
});

test('viewer reload resumes with its cookie and never reuses an empty entry token', async ({
  page,
}) => {
  const { state } = await setupViewer(page);
  await page.goto(`/gcp-viewer-test#${capability}`);
  await expect(page.getByRole('status')).toContainText('Connected.');
  await page.reload();
  await expect(page.getByRole('status')).toContainText('Connected.');
  expect(state.bootstrapCount).toBe(1);
  expect(state.resumeCount).toBe(1);
});

test('a dropped stream resumes without replaying offline input or restarting its countdown', async ({
  page,
}) => {
  await page.clock.install();
  const { state, sockets, messages } = await setupViewer(page);
  await page.goto(`/gcp-viewer-test#${capability}`);
  await expect(page.getByRole('status')).toContainText('Connected.');
  await page.clock.runFor(2000);
  const before = await page.locator('#expiry').textContent();
  await sockets[0].close({ code: 1001, reason: 'Original synthetic network drop' });
  await expect(page.locator('#screen')).toHaveAttribute('aria-disabled', 'true');
  const blocked = await page.locator('#screen').evaluate((element) => {
    const data = new DataTransfer();
    data.setData('text', 'synthetic-offline-canary');
    return !element.dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: data, cancelable: true, bubbles: true }),
    );
  });
  expect(blocked).toBe(true);
  await page.clock.runFor(2000);
  await expect(page.getByRole('status')).toContainText('Connected.');
  expect(sockets.length).toBe(2);
  expect(state.resumeCount).toBe(1);
  expect(state.bootstrapCount).toBe(1);
  expect(messages.some((message) => message.text === 'synthetic-offline-canary')).toBe(false);
  await expect(page.locator('#screen')).toHaveText('');
  expect(await page.locator('#expiry').textContent()).not.toBe(before);
  await page.clock.setSystemTime(new Date('2040-01-01T00:00:00Z'));
  await expect(page.getByRole('status')).toContainText('Connected.');
  await page.clock.runFor(1800000);
  await expect(page.getByRole('status')).toContainText('session expired');
  await expect(page.locator('#screen')).toHaveAttribute('contenteditable', 'false');
  const attempts = state.resumeCount;
  await page.clock.runFor(60000);
  expect(state.resumeCount).toBe(attempts);
});

test('failed authentication blocks local editing and never falls back to a cookie', async ({
  page,
}) => {
  const { state, messages } = await setupViewer(page, 401);
  await page.goto(`/gcp-viewer-test#${capability}`);
  await expect(page.getByRole('status')).toContainText('link expired or was already opened');
  await expect(page.locator('#screen')).toHaveAttribute('contenteditable', 'false');
  expect(
    await page.locator('#screen').evaluate(
      (element) =>
        !element.dispatchEvent(
          new InputEvent('beforeinput', {
            data: 'synthetic-local-canary',
            inputType: 'insertText',
            cancelable: true,
            bubbles: true,
          }),
        ),
    ),
  ).toBe(true);
  await expect(page.locator('#screen')).toHaveText('');
  expect(messages).toEqual([]);
  expect(state.resumeCount).toBe(0);
});

test('automatic network retries stop after five attempts and manual retry stays within the original deadline', async ({
  page,
}) => {
  await page.clock.install();
  const { state, sockets } = await setupViewer(page);
  await page.goto(`/gcp-viewer-test#${capability}`);
  await expect(page.getByRole('status')).toContainText('Connected.');
  state.resumeStatus = 503;
  await sockets[0].close({ code: 1001 });
  await page.clock.runFor(60000);
  await expect.poll(() => state.resumeCount).toBe(5);
  await expect(page.getByRole('button', { name: 'Retry connection', exact: true })).toBeVisible();
  await page.clock.runFor(60000);
  expect(state.resumeCount).toBe(5);
  state.resumeStatus = 200;
  await page.getByRole('button', { name: 'Retry connection', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('Connected.');
  expect(state.resumeCount).toBe(6);
  expect(state.bootstrapCount).toBe(1);
  await expect(page.locator('#expiry')).not.toHaveText('Sign-in time remaining: 30:00');
});
