import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { budgetLimit, reserveInference, settleInference, usageCost } from '../../src/lib/server/budget';
const original = { ...process.env }; const directories: string[] = [];
afterEach(() => { process.env = { ...original }; directories.splice(0).forEach(d => rmSync(d, { recursive: true, force: true })); });
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
    const reservations = await Promise.allSettled(['a', 'b', 'c'].map(reserveInference));
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
  it('fails closed when allocation is unknown', async () => {
    configure(); delete process.env.META_ALLOCATION_USD;
    await expect(reserveInference('a')).rejects.toThrow(/configured allocation/);
  });
});
