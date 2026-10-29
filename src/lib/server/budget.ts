import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, chmodSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { getServerFirestore } from './firebase-config';

// Text-only standard Spark pricing verified 2026-10-26. No built-in paid tools.
export const INPUT_USD_PER_MILLION = 1.25;
export const OUTPUT_USD_PER_MILLION = 4.25;
export const JOB_RESERVATION_USD = 0.20;
export const MAX_CALLS = 4;
export const INVESTIGATION_RESERVATION_USD = 0.35;
export const MAX_INVESTIGATION_CALLS = 8;
export const MAX_OUTPUT_TOKENS = 2048;
export const MAX_REQUEST_BYTES = 24000;
export const EXPLORATION_RESERVATION_USD = 0.35;

/** A denied reservation is preflight-only: no provider request has been authorized. */
export class InferenceBudgetError extends Error {
  readonly status: 429 | 503;
  readonly code: string;
  constructor(public readonly reason: 'configured' | 'daily' | 'global') {
    super(reason === 'configured' ? 'Live inference requires configured allocation and application budgets.' : 'Inference allowance reached. Prepared lessons remain available.');
    this.name = 'InferenceBudgetError';
    this.status = reason === 'configured' ? 503 : 429;
    this.code = `inference_budget_${reason}`;
  }
}

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
  const path = resolve(/* turbopackIgnore: true */ process.env.SOMA_BUDGET_DB_PATH || '.local/budget.sqlite');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const db = new DatabaseSync(path);
  chmodSync(path, 0o600);
  db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS reservations (id TEXT PRIMARY KEY, workspace TEXT NOT NULL, day TEXT NOT NULL, reserved REAL NOT NULL, charged REAL, created_at TEXT NOT NULL);');
  return db;
}

export async function reserveInference(workspaceId: string, profile: 'lesson' | 'investigation' | 'exploration' | 'voice' = 'lesson'): Promise<string> {
  if (!inferenceEnabled()) throw new InferenceBudgetError('configured');
  const limit = budgetLimit(Number(process.env.META_ALLOCATION_USD), Number(process.env.META_APP_SPEND_CAP_USD || '1'));
  const now = new Date(); const day = now.toISOString().slice(0, 10) + (profile === 'lesson' ? '' : `-${profile}`); const id = randomUUID();
  const reservationUsd = profile === 'investigation' ? INVESTIGATION_RESERVATION_USD : profile === 'exploration' ? EXPLORATION_RESERVATION_USD : profile === 'voice' ? 0.01 : JOB_RESERVATION_USD;
  const dailyLimit = profile === 'investigation' ? 3 : profile === 'exploration' || profile === 'voice' ? 12 : 1;
  if (process.env.SOMA_PERSISTENCE === 'firestore') {
    const db = getServerFirestore();
    const global = db.doc('somaBudget/global'); const daily = db.doc(`somaBudgetDays/${workspaceId}-${day}`);
    await db.runTransaction(async tx => {
      const [g, d] = await Promise.all([tx.get(global), tx.get(daily)]);
      const consumed = Number(g.data()?.consumed || 0);
      if (Number(d.data()?.count ?? (d.exists ? 1 : 0)) >= dailyLimit) throw new InferenceBudgetError('daily');
      if (consumed + reservationUsd > limit) throw new InferenceBudgetError('global');
      tx.set(global, { consumed: consumed + reservationUsd });
      tx.set(daily, { reservationId: id, count: Number(d.data()?.count ?? (d.exists ? 1 : 0)) + 1, createdAt: now.toISOString() });
      tx.create(db.doc(`somaBudgetReservations/${id}`), { reserved: reservationUsd, workspaceId, createdAt: now.toISOString(), charged: null });
    });
  } else {
    const db = database();
    try {
      db.exec('BEGIN IMMEDIATE');
      const total = Number((db.prepare('SELECT COALESCE(SUM(COALESCE(charged, reserved)), 0) AS total FROM reservations').get() as { total: number }).total);
      if (Number((db.prepare('SELECT COUNT(*) AS count FROM reservations WHERE workspace=? AND day=?').get(workspaceId, day) as { count: number }).count) >= dailyLimit) throw new InferenceBudgetError('daily');
      if (total + reservationUsd > limit) throw new InferenceBudgetError('global');
      db.prepare('INSERT INTO reservations VALUES (?,?,?,?,NULL,?)').run(id, workspaceId, day, reservationUsd, now.toISOString());
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
    const db = getServerFirestore();
    await db.runTransaction(async tx => {
      const ref = db.doc(`somaBudgetReservations/${id}`); const global = db.doc('somaBudget/global');
      const [r, g] = await Promise.all([tx.get(ref), tx.get(global)]);
      if (!r.exists || r.data()?.charged !== null) return;
      tx.update(ref, { charged: cost });
      tx.update(global, { consumed: Math.max(0, Number(g.data()?.consumed || 0) - Number(r.data()?.reserved || JOB_RESERVATION_USD) + cost) });
    });
  } else {
    const db = database();
    try { db.prepare('UPDATE reservations SET charged=? WHERE id=? AND charged IS NULL').run(cost, id); }
    finally { db.close(); }
  }
}
