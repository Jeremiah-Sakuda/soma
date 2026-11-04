import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const fake = vi.hoisted(() => ({ records: new Map<string, Record<string, unknown>>(), reads: [] as string[], fail: false }));
vi.mock('../../src/lib/server/firebase-config', () => {
  const ref = (path: string) => ({ path, firestore: database, collection: (name: string) => collection(`${path}/${name}`) });
  const collection = (path: string) => ({ doc: (id: string) => ref(`${path}/${id}`) });
  const database = {
      doc: ref, collection,
      runTransaction: async (fn: (tx: unknown) => unknown) => fn({
        get: async ({ path }: { path: string }) => {
          if (fake.fail) throw new Error('private database details');
          fake.reads.push(path);
          const value = fake.records.get(path);
          return { exists: value !== undefined, data: () => value, get: (key: string) => value?.[key] };
        },
        // Unexpected writes are errors: account lookup must not create a workspace.
        set: () => { throw new Error('Unexpected write'); },
      }),
    };
  return { getServerApp: () => ({}), getServerFirestore: () => database };
});
vi.mock('firebase-admin/auth', () => ({ getAuth: () => ({ verifySessionCookie: async () => ({ uid: 'synthetic-account', auth_time: 1 }) }) }));
import { GET } from '../../src/app/api/explore/allowance/route';
import { closeExplorationStore, explorationStore, resolveExplorationPrincipal } from '../../src/lib/server/exploration-store';
import { readExplorationAllowance } from '../../src/lib/server/exploration-allowance';
import { reserveInference, settleInference } from '../../src/lib/server/budget';
import { ACCOUNT_SESSION_COOKIE } from '../../src/lib/server/account';

let directory: string;
const token = 'a'.repeat(64), id = createHash('sha256').update(token).digest('hex');
const cookie = `soma_explore=${token}`;
const req = (cookies = cookie) => new Request('https://soma.example/api/explore/allowance', { headers: { cookie: cookies } });
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'allowance-'));
  for (const [key, value] of Object.entries({ SOMA_PERSISTENCE: 'local-synthetic', VERCEL: '', SOMA_LIVE_INFERENCE: 'true', MODEL_API_KEY: 'synthetic-unused', META_ALLOCATION_USD: '150', META_APP_SPEND_CAP_USD: '5', FIREBASE_PROJECT_ID: 'synthetic', SOMA_EXPLORATION_DB_PATH: join(directory, 'explore.sqlite'), SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite') })) vi.stubEnv(key, value);
  fake.records.clear(); fake.reads.length = 0; fake.fail = false;
  vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-11-04T23:59:00Z'));
});
afterEach(() => { closeExplorationStore(); vi.useRealTimers(); vi.unstubAllEnvs(); rmSync(directory, { recursive: true, force: true }); });
async function guest() {
  const { principal } = await resolveExplorationPrincipal(req());
  await explorationStore.mutate(principal, () => {}, { create: true });
  return principal;
}
function managedSession(owner: string, workspaceId = owner) {
  return { owner, workspaceId, generation: workspaceId, expiresAt: '2100-01-01T00:00:00Z', artifacts: [], runs: [] };
}
it('does not initialize missing identities, sessions, cookies or database files', async () => {
  for (const cookies of ['', cookie, 'soma_explore=invalid', `${cookie}; ${cookie}`, `${ACCOUNT_SESSION_COOKIE}=bad; ${cookie}`]) {
    const response = await GET(req(cookies));
    expect(response.status).toBe(401);
    expect(response.headers.get('set-cookie')).toBeNull();
  }
  expect(existsSync(process.env.SOMA_EXPLORATION_DB_PATH!)).toBe(false);
  expect(existsSync(process.env.SOMA_BUDGET_DB_PATH!)).toBe(false);
});
it('reads actual guest reservations independently of other guests and paid profiles without changing the ledger', async () => {
  const p = await guest();
  const reservation = await reserveInference(p.key, 'exploration'); await settleInference(reservation, .03, true);
  await reserveInference('guest-other', 'exploration'); await reserveInference(p.key, 'voice');
  const before = readFileSync(process.env.SOMA_BUDGET_DB_PATH!);
  const response = await GET(req()), body = await response.json();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(response.headers.get('vary')).toBe('Cookie');
  expect(response.headers.get('set-cookie')).toBeNull();
  expect(body).toEqual({ kind: 'guest', dailyLimit: 12, used: 1, remaining: 11, checkedAt: '2026-11-04T23:59:00.000Z', resetsAt: '2026-11-05T00:00:00.000Z', liveEnabled: true, sharedBudgetAvailable: true, budgetEligible: true });
  expect(readFileSync(process.env.SOMA_BUDGET_DB_PATH!)).toEqual(before);
});
it('reads a missing budget as unused without creating it; rejects expired guests', async () => {
  await guest(); expect((await (await GET(req())).json()).remaining).toBe(12);
  expect(existsSync(process.env.SOMA_BUDGET_DB_PATH!)).toBe(false);
  vi.setSystemTime(new Date('2026-11-06T00:00:00Z'));
  expect((await GET(req())).status).toBe(401);
});
it('rolls daily slots over at UTC midnight while preserving shared consumption', async () => {
  const p = await guest(); vi.stubEnv('META_APP_SPEND_CAP_USD', '.4');
  await reserveInference(p.key, 'exploration');
  vi.setSystemTime(new Date('2026-11-05T00:00:00Z'));
  expect(await readExplorationAllowance(p.key)).toMatchObject({ used: 0, remaining: 12, resetsAt: '2026-11-06T00:00:00.000Z', sharedBudgetAvailable: false, budgetEligible: false });
});
it('agrees with reservation admission at twelve and does not treat settlement as a refunded daily slot', async () => {
  const p = await guest();
  for (let i = 0; i < 12; i++) { const r = await reserveInference(p.key, 'exploration'); await settleInference(r, 0, true); }
  expect((await (await GET(req())).json())).toMatchObject({ used: 12, remaining: 0, sharedBudgetAvailable: true, budgetEligible: false });
  await expect(reserveInference(p.key, 'exploration')).rejects.toMatchObject({ reason: 'daily' });
});
it('uses the existing account workspace rather than the accompanying guest identity and performs no writes', async () => {
  vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
  const accountId = createHash('sha256').update('synthetic-account').digest('hex'), root = `somaAccounts/${accountId}`;
  fake.records.set(root, { ownerId: 'synthetic-account', workspaceId: 'workspace-one', summary: { id: 'workspace-one' }, groups: {} });
  fake.records.set(`${root}/explorations/session`, { state: managedSession(accountId, 'workspace-one') });
  fake.records.set(`somaBudgetDays/account-${accountId}-workspace-one-2026-11-04-exploration`, { count: 2 });
  fake.records.set('somaBudget/global', { consumed: 1 });
  const recordsBefore = structuredClone([...fake.records]);
  const accountCookie = `${ACCOUNT_SESSION_COOKIE}=aaa.bbb.ccc; ${cookie}`;
  const response = await GET(req(accountCookie));
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ kind: 'account', used: 2, remaining: 10 });
  expect(fake.reads.some(path => path.includes(`guest-${id}`))).toBe(false);
  expect([...fake.records]).toEqual(recordsBefore);
  fake.records.set(root, { ...fake.records.get(root), ownerId: 'another-account' });
  expect((await GET(req(accountCookie))).status).toBe(403);
  fake.records.delete(root);
  expect((await GET(req(accountCookie))).status).toBe(401);
  expect(fake.records.has(root)).toBe(false);
});
it('rejects a managed session with mismatched ownership or workspace before reading allowance', async () => {
  vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
  for (const state of [managedSession('other-owner'), managedSession(id, 'other-workspace')]) {
    fake.records.set(`somaExploreGuests/${id}`, { state });
    expect((await GET(req())).status).toBe(403);
    expect(fake.reads.some(path => path.startsWith('somaBudget'))).toBe(false);
  }
});
it('honors managed legacy missing count and refuses malformed or inaccessible ledgers', async () => {
  vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
  fake.records.set(`somaExploreGuests/${id}`, { state: managedSession(id) });
  const daily = `somaBudgetDays/guest-${id}-2026-11-04-exploration`;
  fake.records.set(daily, { reservationId: 'legacy' });
  expect(await (await GET(req())).json()).toMatchObject({ used: 1, remaining: 11 });
  for (const count of [-1, 1.2, '2', NaN]) {
    fake.records.set(daily, { count }); expect((await GET(req())).status).toBe(503);
  }
  fake.records.set(daily, { count: 0 }); fake.records.set('somaBudget/global', {});
  expect((await GET(req())).status).toBe(503);
  fake.fail = true;
  const failed = await GET(req()); expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('private database');
});
it('fails closed for bad configuration and corrupt local storage', async () => {
  await guest(); vi.stubEnv('META_ALLOCATION_USD', 'unknown');
  expect(await (await GET(req())).json()).toMatchObject({ budgetEligible: false, liveEnabled: false, sharedBudgetAvailable: false });
  writeFileSync(process.env.SOMA_BUDGET_DB_PATH!, 'not sqlite');
  expect((await GET(req())).status).toBe(503);
  rmSync(process.env.SOMA_BUDGET_DB_PATH!);
  const db = new DatabaseSync(process.env.SOMA_BUDGET_DB_PATH!); db.close();
  expect((await GET(req())).status).toBe(503);
});
