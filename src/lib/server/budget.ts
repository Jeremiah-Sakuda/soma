import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';

// Text-only standard Spark pricing verified 2026-10-26. No built-in paid tools.
export const INPUT_USD_PER_MILLION = 1.25;
export const OUTPUT_USD_PER_MILLION = 4.25;
export const JOB_RESERVATION_USD = 0.20;
export const MAX_CALLS = 4;
export const MAX_OUTPUT_TOKENS = 2048;
export const MAX_REQUEST_BYTES = 24000;

export function budgetLimit(allocation: number, cap: number) {
  if (!Number.isFinite(allocation) || allocation <= 0 || !Number.isFinite(cap) || cap <= 0) return 0;
  return Math.min(allocation * 0.8, cap);
}
export function inferenceEnabled() {
  return process.env.SOMA_LIVE_INFERENCE === 'true' && Boolean(process.env.MODEL_API_KEY) &&
    budgetLimit(Number(process.env.META_ALLOCATION_USD), Number(process.env.META_APP_SPEND_CAP_USD || '1')) >= JOB_RESERVATION_USD;
}
export function usageCost(input: number, output: number) {
  if (![input, output].every(n => Number.isSafeInteger(n) && n >= 0)) throw new Error('Invalid provider usage.');
  return (input * INPUT_USD_PER_MILLION + output * OUTPUT_USD_PER_MILLION) / 1_000_000;
}

function database() {
  const path = resolve(process.env.SOMA_BUDGET_DB_PATH || '.local/budget.sqlite');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, day TEXT NOT NULL, reserved REAL NOT NULL, charged REAL, created_at TEXT NOT NULL);');
  return db;
}

export async function reserveInference(workspaceId: string): Promise<string> {
  if (!inferenceEnabled()) throw new Error('Live inference requires configured allocation and application budgets.');
  const limit = budgetLimit(Number(process.env.META_ALLOCATION_USD), Number(process.env.META_APP_SPEND_CAP_USD || '1'));
  const now = new Date(); const day = now.toISOString().slice(0, 10); const id = randomUUID();
  if (process.env.SOMA_PERSISTENCE === 'firestore') {
    const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const app = getApps().find(a => a.name === 'soma-budget') || initializeApp({ credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID }, 'soma-budget');
    const db = getFirestore(app);
    const global = db.doc('somaBudget/global'); const daily = db.doc(`somaBudgetDays/${workspaceId}-${day}`);
    await db.runTransaction(async tx => {
      const [g, d] = await Promise.all([tx.get(global), tx.get(daily)]);
      const consumed = Number(g.data()?.consumed || 0);
      if (d.exists || consumed + JOB_RESERVATION_USD > limit) throw new Error('Inference allowance reached. Prepared lessons remain available.');
      tx.set(global, { consumed: consumed + JOB_RESERVATION_USD });
      tx.create(daily, { reservationId: id, createdAt: now.toISOString() });
      tx.create(db.doc(`somaBudgetReservations/${id}`), { reserved: JOB_RESERVATION_USD, workspaceId, createdAt: now.toISOString(), charged: null });
    });
  } else {
    const db = database();
    try {
      db.exec('BEGIN IMMEDIATE');
      const total = Number((db.prepare('SELECT COALESCE(SUM(COALESCE(charged, reserved)), 0) AS total FROM reservations').get() as { total: number }).total);
      if (db.prepare('SELECT id FROM reservations WHERE workspace=? AND day=?').get(workspaceId, day) || total + JOB_RESERVATION_USD > limit) throw new Error('Inference allowance reached. Prepared lessons remain available.');
      db.prepare('INSERT INTO reservations VALUES (?,?,?,?,NULL,?)').run(id, workspaceId, day, JOB_RESERVATION_USD, now.toISOString());
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    finally { db.close(); }
  }
  return id;
}

/** Unknown or interrupted usage retains the full reservation, including after restart. */
export async function settleInference(id: string, cost: number, certain: boolean) {
  if (!certain || !Number.isFinite(cost) || cost < 0) return;
  if (process.env.SOMA_PERSISTENCE === 'firestore') {
    const { getApp } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore(getApp('soma-budget'));
    await db.runTransaction(async tx => {
      const ref = db.doc(`somaBudgetReservations/${id}`); const global = db.doc('somaBudget/global');
      const [r, g] = await Promise.all([tx.get(ref), tx.get(global)]);
      if (!r.exists || r.data()?.charged !== null) return;
      tx.update(ref, { charged: cost });
      tx.update(global, { consumed: Math.max(0, Number(g.data()?.consumed || 0) - JOB_RESERVATION_USD + cost) });
    });
  } else {
    const db = database();
    try { db.prepare('UPDATE reservations SET charged=? WHERE id=? AND charged IS NULL').run(cost, id); }
    finally { db.close(); }
  }
}
