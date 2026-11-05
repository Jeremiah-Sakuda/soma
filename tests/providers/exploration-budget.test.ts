import { afterEach, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { reserveInference, settleInference } from '../../src/lib/server/budget';
const env = { ...process.env };
let directory = '';
afterEach(() => {
  process.env = { ...env };
  if (directory) rmSync(directory, { recursive: true, force: true });
});
function setup(cap = '5') {
  directory = mkdtempSync(join(tmpdir(), 'explore-budget-'));
  Object.assign(process.env, {
    SOMA_PERSISTENCE: 'local-synthetic',
    SOMA_LIVE_INFERENCE: 'true',
    MODEL_API_KEY: 'test-only',
    META_ALLOCATION_USD: '150',
    META_APP_SPEND_CAP_USD: cap,
    SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite'),
  });
}
it('bounds twelve exploratory turns separately while sharing the existing global ledger and not resetting consumption', async () => {
  setup();
  for (let i = 0; i < 12; i++) {
    const id = await reserveInference('same', 'exploration');
    await settleInference(id, 0.02, true);
  }
  await expect(reserveInference('same', 'exploration')).rejects.toMatchObject({ reason: 'daily' });
  const lesson = await reserveInference('same');
  await settleInference(lesson, 0.01, true);
  await expect(reserveInference('same')).rejects.toMatchObject({ reason: 'daily' });
  const db = new DatabaseSync(process.env.SOMA_BUDGET_DB_PATH!);
  expect(
    db.prepare('SELECT SUM(COALESCE(charged,reserved)) total FROM reservations').get()?.total,
  ).toBeCloseTo(0.25);
  db.close();
});
it('retains interrupted visual reservation and denies concurrency across profiles before cap overshoot', async () => {
  setup('.4');
  const visual = await reserveInference('one', 'exploration');
  await settleInference(visual, 0, false);
  await expect(reserveInference('two')).rejects.toMatchObject({ reason: 'global' });
  const audio = await reserveInference('two', 'voice');
  await settleInference(audio, 0.001, true);
  process.env.META_APP_SPEND_CAP_USD = '5';
  const next = await reserveInference('two', 'exploration');
  await settleInference(next, 0.02, true);
  const db = new DatabaseSync(process.env.SOMA_BUDGET_DB_PATH!);
  expect(
    db.prepare('SELECT SUM(COALESCE(charged,reserved)) total FROM reservations').get()?.total,
  ).toBeCloseTo(0.371);
  db.close();
});
it('Gemini playback uses the existing spend cap and preserves reservations without requiring a Meta key', async () => {
  setup('.055');
  process.env.SOMA_GEMINI_TTS = 'true';
  delete process.env.MODEL_API_KEY;
  const id = await reserveInference('same', 'tts');
  await settleInference(id, 0.03, true);
  await expect(reserveInference('another', 'tts')).rejects.toMatchObject({ reason: 'global' });
  process.env.SOMA_GEMINI_TTS = 'false';
  await expect(reserveInference('same', 'tts')).rejects.toMatchObject({ reason: 'configured' });
});
it('raising the cumulative allowance from15 to20 retains previous charges and unknown reservations', async () => {
  setup('15');
  const old = await reserveInference('previous', 'exploration');
  await settleInference(old, 14.8, true);
  const unknown = await reserveInference('interrupted', 'voice');
  await settleInference(unknown, 0, false);
  await expect(reserveInference('new', 'exploration')).rejects.toMatchObject({ reason: 'global' });
  process.env.META_APP_SPEND_CAP_USD = '20';
  await reserveInference('new', 'exploration');
  const db = new DatabaseSync(process.env.SOMA_BUDGET_DB_PATH!);
  expect(db.prepare('SELECT COUNT(*) count FROM reservations').get()?.count).toBe(3);
  expect(
    db.prepare('SELECT SUM(COALESCE(charged,reserved)) total FROM reservations').get()?.total,
  ).toBeCloseTo(15.16);
  db.close();
});
