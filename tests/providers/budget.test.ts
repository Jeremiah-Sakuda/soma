import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { InferenceBudgetError, budgetLimit, reserveInference, settleInference, usageCost } from '../../src/lib/server/budget';
const original = { ...process.env }; const directories: string[] = [];
afterEach(() => { vi.useRealTimers(); process.env = { ...original }; directories.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })); });
function configure(cap = '0.4') {
  const directory = mkdtempSync(join(tmpdir(), 'soma-budget-')); directories.push(directory);
  Object.assign(process.env, { SOMA_PERSISTENCE: 'local-synthetic', SOMA_LIVE_INFERENCE: 'true', MODEL_API_KEY: 'test-only-never-sent', META_ALLOCATION_USD: '1', META_APP_SPEND_CAP_USD: cap, SOMA_BUDGET_DB_PATH: join(directory, 'budget.sqlite') });
}
describe('application-enforced inference budget', () => {
  it('preserves twenty percent and honors a smaller explicit cap', () => {
    expect(budgetLimit(150, 200)).toBe(120); expect(budgetLimit(150, 1)).toBe(1);
    expect(budgetLimit(NaN, 1)).toBe(0); expect(budgetLimit(-1, 1)).toBe(0);
  });
  it('counts all output including reasoning, with no assumed cache discount', () => {
    expect(usageCost(1_000_000, 1_000_000)).toBe(5.5);
    expect(() => usageCost(2, -1)).toThrow();
  });
  it('reserves before concurrency, retains unknown costs and limits one daily job per workspace', async () => {
    configure();
    const reservations = await Promise.allSettled(['a', 'b', 'c'].map(id => reserveInference(id)));
    expect(reservations.filter(r => r.status === 'fulfilled')).toHaveLength(2);
    await expect(reserveInference('a')).rejects.toThrow();
    const first = reservations.find(r => r.status === 'fulfilled') as PromiseFulfilledResult<string>;
    await settleInference(first.value, 0, false);
    await expect(reserveInference('d')).rejects.toThrow();
    await settleInference(first.value, 0.001, true);
    // Less than a full reservation is available: costs cannot overshoot the cap.
    await expect(reserveInference('d')).rejects.toThrow();
    // Reconciliation is idempotent.
    await settleInference(first.value, 0, true);
    await expect(reserveInference('d')).rejects.toThrow();
  });
  it('identifies preflight daily/global denials without spending or losing next-day eligibility', async () => {
    configure('0.4');
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-28T23:59:00Z'));
    const first = await reserveInference('same-workspace');
    await settleInference(first, 0, true);
    await expect(reserveInference('same-workspace')).rejects.toMatchObject({ name: 'InferenceBudgetError', reason: 'daily', status: 429 });
    await reserveInference('second-workspace');
    await reserveInference('third-workspace');
    const globalError = await reserveInference('fourth-workspace').catch(error => error);
    expect(globalError).toBeInstanceOf(InferenceBudgetError);
    expect(globalError.reason).toBe('global');
    // A rejected reservation added no charge; settlement opens one slot for tomorrow.
    const db = new (await import('node:sqlite')).DatabaseSync(process.env.SOMA_BUDGET_DB_PATH!);
    expect(db.prepare('SELECT COUNT(*) AS count FROM reservations').get()?.count).toBe(3);
    const second = db.prepare('SELECT id FROM reservations WHERE workspace=?').get('second-workspace') as { id: string };
    db.close(); await settleInference(second.id, 0, true);
    vi.setSystemTime(new Date('2026-10-29T00:01:00Z'));
    await expect(reserveInference('same-workspace')).resolves.toEqual(expect.any(String));
  });
  it('fails closed when allocation is unknown', async () => {
    configure(); delete process.env.META_ALLOCATION_USD;
    await expect(reserveInference('a')).rejects.toMatchObject({ name: 'InferenceBudgetError', reason: 'configured', status: 503, message: expect.stringContaining('configured allocation') });
  });
  it('reserves enough for deeper investigation and bounds three reconsiderations separately', async () => {
    configure('0.8');
    const first = await reserveInference('learner', 'investigation');
    await settleInference(first, 0.01, true);
    const second = await reserveInference('learner', 'investigation');
    await settleInference(second, 0.01, true);
    const third = await reserveInference('learner', 'investigation');
    await settleInference(third, 0.01, true);
    await expect(reserveInference('learner', 'investigation')).rejects.toMatchObject({ reason: 'daily' });
    const standard = await reserveInference('learner');
    await settleInference(standard, 0.01, true);
    expect(8 * usageCost(24000, 2048)).toBeLessThan(0.35);
  });

});
