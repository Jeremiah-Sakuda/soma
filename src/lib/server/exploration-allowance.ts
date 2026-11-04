import { statSync } from 'node:fs';
import { resolve } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { budgetLimit, EXPLORATION_RESERVATION_USD, inferenceEnabled } from './budget';
import { getServerFirestore } from './firebase-config';
import { getPersistenceMode } from './store';

/** Snapshot only: this neither reserves a turn nor promises future admission. */
export async function readExplorationAllowance(principalKey: string) {
  const now = new Date(), date = now.toISOString().slice(0, 10), day = `${date}-exploration`;
  let used = 0, consumed = 0;
  if (getPersistenceMode() === 'firestore') {
    const db = getServerFirestore();
    ({ used, consumed } = await db.runTransaction(async tx => {
      const [daily, global] = await Promise.all([
        tx.get(db.doc(`somaBudgetDays/${principalKey}-${day}`)),
        tx.get(db.doc('somaBudget/global')),
      ]);
      return {
        // Legacy daily documents represent one reservation even without a count.
        used: daily.data()?.count ?? (daily.exists ? 1 : 0),
        consumed: global.exists ? global.data()?.consumed : 0,
      };
    }, { readOnly: true }));
  } else {
    const path = resolve(/* turbopackIgnore: true */ process.env.SOMA_BUDGET_DB_PATH || '.local/budget.sqlite');
    let exists = true;
    try { statSync(path); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      exists = false;
    }
    if (exists) {
      const db = new DatabaseSync(path, { readOnly: true });
      try {
        db.exec('BEGIN');
        used = (db.prepare('SELECT COUNT(*) AS count FROM reservations WHERE workspace=? AND day=?').get(principalKey, day) as { count: number }).count;
        consumed = (db.prepare('SELECT COALESCE(SUM(COALESCE(charged,reserved)),0) AS total FROM reservations').get() as { total: number }).total;
      } finally { db.close(); }
    }
  }
  if (!Number.isSafeInteger(used) || used < 0 || !Number.isFinite(consumed) || consumed < 0)
    throw new Error('Invalid allowance ledger.');
  const dailyLimit = 12, remaining = Math.max(0, dailyLimit - used);
  const liveEnabled = inferenceEnabled();
  const sharedBudgetAvailable = consumed + EXPLORATION_RESERVATION_USD <=
    budgetLimit(Number(process.env.META_ALLOCATION_USD), Number(process.env.META_APP_SPEND_CAP_USD || '1'));
  return {
    dailyLimit, used, remaining, checkedAt: now.toISOString(),
    resetsAt: new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString(),
    liveEnabled, sharedBudgetAvailable,
    budgetEligible: liveEnabled && sharedBudgetAvailable && remaining > 0,
  };
}
