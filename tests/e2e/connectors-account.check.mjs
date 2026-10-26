/** Opt-in live account/browser check. Never authorizes or calls an external source provider. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { initializeApp, applicationDefault, cert, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { chromium, expect } from '@playwright/test';
import { mkdir, writeFile, rm } from 'node:fs/promises';

if (process.env.SOMA_LIVE_CONNECTOR_UI_TEST !== 'true') throw new Error('Set SOMA_LIVE_CONNECTOR_UI_TEST=true to run this disposable-account check.');
const googleConfigured = process.env.SOMA_EXPECT_GOOGLE_CONFIGURED === 'true';
const baseURL = process.env.SOMA_CONNECTOR_UI_BASE_URL || 'http://127.0.0.1:3106';
if (!['127.0.0.1', 'localhost'].includes(new URL(baseURL).hostname)) throw new Error('This check targets a local development server only.');
const projectId = process.env.FIREBASE_PROJECT_ID;
if (!projectId || !process.env.NEXT_PUBLIC_FIREBASE_API_KEY) throw new Error('Firebase account configuration is required.');
const credential = process.env.FIREBASE_SERVICE_ACCOUNT_JSON ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)) : applicationDefault();
const app = initializeApp({ projectId, credential }, 'soma-connector-ui-check');
const db = getFirestore(app);
let uid, browser, context;
const journal = '.local/connector-ui-cleanup.json';
try {
  const email = `soma-connector-ui-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  uid = (await getAuth(app).createUser({ email, password })).uid;
  await mkdir('.local/screenshots', { recursive: true });
  await writeFile(journal, JSON.stringify({ uid, purpose: 'Disposable synthetic connector UI check' }), { mode: 0o600 });
  browser = await chromium.launch(); context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  await page.goto(baseURL);
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Your private account' })).toBeVisible({ timeout: 30000 });
  await page.getByText('Connect course sites, Gmail and Calendar', { exact: true }).click();
  if (googleConfigured) await expect(page.getByText('Google OAuth is not configured', { exact: false })).toHaveCount(0);
  else await expect(page.getByText('Google OAuth is not configured', { exact: false })).toBeVisible();
  await expect(page.getByText('Persistent browser access is not configured', { exact: false })).toBeVisible();
  const connectButtons = page.getByRole('button', { name: /^Connect / });
  await expect(connectButtons).toHaveCount(5);
  for (const button of await connectButtons.all()) {
    if (googleConfigured && /Google Calendar|Gmail/.test(await button.innerText())) await expect(button).toBeEnabled();
    else await expect(button).toBeDisabled();
  }
  await expect(page.getByText('No successful live read recorded yet.', { exact: true })).toHaveCount(5);
  await expect(page.getByRole('link', { name: 'Open secure login window' })).toHaveCount(0);
  for (const path of ['/api/connectors/google/status', '/api/connectors/browser']) {
    const response = await context.request.get(`${baseURL}${path}`);
    assert.equal(response.status(), 200);
    const body = await response.json(); assert.equal(body.configured, path.includes('google') ? googleConfigured : false);
    assert.doesNotMatch(JSON.stringify(body), /"(?:secret|encryptedSecret|refreshToken|accessToken|contextId|sessionId|leaseId)"/);
  }
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await page.getByRole('region', { name: 'Google Calendar connection', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/screenshots/connectors-account-mobile.png' });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByText('Connect course sites, Gmail and Calendar', { exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: '.local/screenshots/connectors-account-desktop.png' });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  console.log('Connector account UI passed: real sign-in, provider configuration controls, honest unread status, sanitized metadata, mobile layout and Escape. No provider session was started.');
} finally {
  if (context) {
    const demo = (await context.cookies()).find(cookie => cookie.name === 'soma_session');
    if (demo) await db.collection('somaDemoSessions').doc(createHash('sha256').update(demo.value).digest('hex')).delete();
  }
  await context?.close(); await browser?.close();
  if (uid) {
    await db.recursiveDelete(db.collection('somaAccounts').doc(createHash('sha256').update(uid).digest('hex')));
    await getAuth(app).deleteUser(uid);
    await rm(journal, { force: true });
    console.log('Disposable Firebase account and workspace records deleted.');
  }
  await db.terminate(); await deleteApp(app);
}
