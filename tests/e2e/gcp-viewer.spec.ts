import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

test('private login viewer forwards input without retaining pasted credentials', async ({ page }) => {
  const messages: Array<Record<string, unknown>> = [];
  const capability = 's'.repeat(43);
  const root = resolve('services/browser-runner');
  await page.route('**/assets/viewer.*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').pop()!;
    await route.fulfill({ body: await readFile(resolve(root, name)), contentType: name.endsWith('.js') ? 'text/javascript' : 'text/css' });
  });
  await page.route('**/gcp-viewer-test', async route => {
    await route.fulfill({ body: await readFile(resolve(root, 'viewer.html')), contentType: 'text/html' });
  });
  await page.route('**/gcp-viewer-test/bootstrap', async route => {
    expect(route.request().postDataJSON()).toEqual({ token: capability });
    await route.fulfill({ json: { ok: true } });
  });
  await page.routeWebSocket('**/gcp-viewer-test/socket', socket => {
    socket.onMessage(message => messages.push(JSON.parse(String(message))));
    socket.send(JSON.stringify({ type: 'tabs', pages: [{ id: 'synthetic-page', origin: 'https://example.com' }] }));
  });
  await page.goto(`/gcp-viewer-test#${capability}`);
  await expect(page.getByRole('status')).toContainText('Connected.');
  expect(new URL(page.url()).hash).toBe('');
  const screen = page.locator('#screen');
  await screen.click();
  await page.keyboard.type('test');
  await page.keyboard.press('Tab');
  await expect.poll(() => messages.filter(item => item.type === 'text').map(item => item.text).join('')).toBe('test');
  expect(messages.some(item => item.type === 'key' && item.event === 'keyDown' && item.key === 'Tab')).toBe(true);
  await expect(screen).toBeFocused();

  // Native paste must remain available to password managers and clipboard users.
  const nativePasteAllowed = await screen.evaluate(element => element.dispatchEvent(new KeyboardEvent('keydown', {
    key: 'v', code: 'KeyV', ctrlKey: true, cancelable: true, bubbles: true,
  })));
  expect(nativePasteAllowed).toBe(true);
  await screen.evaluate(element => {
    const data = new DataTransfer();
    data.setData('text', 'original-synthetic-login-value');
    element.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, cancelable: true, bubbles: true }));
  });
  await expect.poll(() => messages.some(item => item.type === 'text' && item.text === 'original-synthetic-login-value')).toBe(true);
  await expect(screen).toHaveText('');
  expect(await page.locator('body').textContent()).not.toContain('original-synthetic-login-value');
  await page.keyboard.press('Escape');
  await expect(screen).not.toBeFocused();
});
