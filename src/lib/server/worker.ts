import { auditedSourceCollection } from './source-audit';
import { AuditStoreError } from './audit-store';
import { createHash, randomBytes } from 'node:crypto';
import { FieldPath, type DocumentSnapshot } from 'firebase-admin/firestore';
import { assertTrustedWorker, type TrustedWorker } from './worker-auth';
import { verifyWorkerAccount, revalidateWorkerAccount, type VerifiedAccount } from './account';
import { getServerFirestore } from './firebase-config';
import { listConnections, type PublicConnection } from './connectors/store';
import { googleConfigured, refreshGoogleConnection, type GoogleProvider } from './connectors/google';
import { browserConfigured, refreshBrowser, type BrowserProvider } from './connectors/browser';
import { queueCollectedPreparation } from './connectors/preparation';
import { listNextPreparationJob, runPreparationJob, reconcilePreparationOutbox } from './jobs';
import { listNextAdaptationJob, runAdaptationJob } from './adaptation-jobs';
import { readAccountWorkspace } from './account-store';
import { InferenceBudgetError } from './budget';

export const SOURCE_REFRESH_MS = 6 * 60 * 60_000;
const GLOBAL_LEASE_MS = 150_000;
const MAX_SCAN_ACCOUNTS = 8;
const SCAN_MS = 15_000;
type Kind = 'refresh' | 'preparation' | 'adaptation';
type Schedule = { workspaceId: string; nextKind?: Kind; outboxCursor?: string; cooldowns?: Partial<Record<Kind, number>>; connections?: Record<string, { scope: string; nextAt: number; failures: number; lastAttemptAt: string; outcome: string }> };
export type WorkerResult = { status: 'busy' | 'idle' | 'processed' | 'deferred'; scanned: number; kind?: Kind; outcome?: string; cycleComplete?: boolean };

/** Internal dependency boundaries allow live-database tests without collecting real services. */
export type WorkerDependencies = {
  scan: (cursor: string, limit: number) => Promise<DocumentSnapshot[]>;
  refresh: (account: VerifiedAccount, connection: PublicConnection) => Promise<void>;
  nextPreparation: typeof listNextPreparationJob;
  runPreparation: typeof runPreparationJob;
  nextAdaptation: typeof listNextAdaptationJob;
  runAdaptation: typeof runAdaptationJob;
  providerConfigured: (provider: string) => boolean;
};
async function scan(cursor: string, limit: number): Promise<DocumentSnapshot[]> {
  let query = getServerFirestore().collection('somaAccounts').orderBy(FieldPath.documentId()).limit(limit);
  if (cursor) query = query.startAfter(cursor);
  return (await query.get()).docs;
}
async function refresh(account: VerifiedAccount, connection: PublicConnection): Promise<void> {
  const provider = connection.provider;
  const collected = await auditedSourceCollection(account, provider, async () => provider === 'gmail' || provider === 'calendar'
    ? await refreshGoogleConnection(account, provider as GoogleProvider)
    : (await refreshBrowser(account, provider as BrowserProvider)).workspace, value => value);
  const workspace = collected.value;
  if (!collected.auditComplete) throw new AuditStoreError('Source observations were saved but audit completion is unavailable.', 503, 'audit_storage_failed');
  await queueCollectedPreparation(account, workspace, `${provider}:${connection.id}:`);
}
const defaults: WorkerDependencies = {
  scan, refresh, nextPreparation: listNextPreparationJob, runPreparation: runPreparationJob,
  nextAdaptation: listNextAdaptationJob, runAdaptation: runAdaptationJob,
  providerConfigured: provider => ['gmail', 'calendar'].includes(provider) ? googleConfigured() : ['blackboard', 'gradescope', 'piazza'].includes(provider) && browserConfigured(),
};

export function connectionScopeFingerprint(connection: PublicConnection): string {
  const { nextQueryIndex: _rotation, ...retainedConfiguration } = connection.configuration;
  const bb=retainedConfiguration.blackboard as {mode?:string;selected?:{id:string;courseId:string}[]}|undefined;
  const configuration=connection.provider==='blackboard'&&bb?.mode==='courses'?{blackboard:{mode:'courses',selected:[...(bb.selected??[])].sort((a,b)=>a.id.localeCompare(b.id))}}:retainedConfiguration;
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical) : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value;
  return createHash('sha256').update(JSON.stringify({ provider: connection.provider, configuration: canonical(configuration) })).digest('hex');
}
/** Gmail targets six hours per query. Blackboard reserves daily browser starts for login/manual checks; large selections rotate more slowly. */
export function connectionRefreshInterval(connection: PublicConnection): number {
  const bb=connection.configuration.blackboard as {mode?:string;selected?:unknown[]}|undefined;
  if(connection.provider==='blackboard'&&bb?.mode==='courses')return SOURCE_REFRESH_MS/Math.max(1,Math.min(4,bb.selected?.length??0));
  const count = connection.provider === 'gmail' && Array.isArray(connection.configuration.queries) ? Math.max(1, Math.min(20, connection.configuration.queries.length)) : 1;
  return SOURCE_REFRESH_MS / count;
}
export function connectionDue(connection: PublicConnection, schedule: Schedule['connections'], now = Date.now()): boolean {
  if (!['connected', 'current', 'stale', 'error'].includes(connection.status)) return false;
  const config = connection.configuration;
  const bb=config.blackboard as {mode?:string;selected?:unknown[]}|undefined;
  const hasScope = connection.provider==='blackboard'&&bb?.mode==='courses'?Array.isArray(bb.selected)&&bb.selected.length>0:connection.provider === 'gmail' ? Array.isArray(config.queries) && config.queries.length > 0
    : connection.provider === 'calendar' ? Array.isArray(config.calendarIds) && config.calendarIds.length > 0
    : ['blackboard', 'gradescope', 'piazza'].includes(connection.provider) && Array.isArray(config.targets) && config.targets.length > 0;
  if (!hasScope) return false;
  const saved = schedule?.[connection.id];
  // A changed selection invalidates the old scope's scheduling timestamp.
  if (saved && saved.scope !== connectionScopeFingerprint(connection)) return true;
  const lastSuccess = Date.parse(connection.lastSuccessAt ?? '') || 0;
  if (saved) {
    const manualSuccessAfterSchedule = lastSuccess > Date.parse(saved.lastAttemptAt);
    return Math.max(saved.nextAt, manualSuccessAfterSchedule ? lastSuccess + connectionRefreshInterval(connection) : 0) <= now;
  }
  return !lastSuccess || lastSuccess + connectionRefreshInterval(connection) <= now;
}
function nextKind(kind: Kind): Kind { return kind === 'refresh' ? 'preparation' : kind === 'preparation' ? 'adaptation' : 'refresh'; }
function workOrder(first: Kind): Kind[] { return [first, nextKind(first), nextKind(nextKind(first))]; }
export function retryDelayMs(failures: number): number { return Math.min(SOURCE_REFRESH_MS, 15 * 60_000 * 2 ** Math.min(5, Math.max(0, failures - 1))); }

/** Global overlap lease + durable cursor avoid duplicate cron work and account starvation. */
export async function runWorkerTick(capability: TrustedWorker, options: { controlId?: string; dependencies?: Partial<WorkerDependencies> } = {}): Promise<WorkerResult> {
  assertTrustedWorker(capability);
  const db = getServerFirestore(), controlId = options.controlId ?? 'scheduled';
  if (!/^[a-zA-Z0-9_-]{1,100}$/.test(controlId)) throw new Error('Invalid worker control ID.');
  const control = db.collection('somaWorker').doc(controlId), leaseId = randomBytes(24).toString('hex'), started = Date.now();
  const lease = await db.runTransaction(async tx => {
    const data = (await tx.get(control)).data();
    if ((data?.leaseUntil ?? 0) > Date.now()) return null;
    tx.set(control, { cursor: data?.cursor ?? '', leaseId, leaseUntil: Date.now() + GLOBAL_LEASE_MS, lastStartedAt: new Date().toISOString() }, { merge: true });
    return { cursor: String(data?.cursor ?? '') };
  });
  if (!lease) return { status: 'busy', scanned: 0 };
  const dependencies = { ...defaults, ...options.dependencies };
  let scanned = 0;
  let finalResult: WorkerResult = { status: 'idle', scanned: 0 };
  let finalError = '';
  const finish = (result: WorkerResult) => { finalResult = result; return result; };
  async function checkpoint(cursor: string) {
    await db.runTransaction(async tx => {
      const data = (await tx.get(control)).data();
      if (data?.leaseId !== leaseId || data.leaseUntil <= Date.now()) throw new Error('Worker lease changed.');
      tx.update(control, { cursor });
    });
  }
  try {
    const page = await dependencies.scan(lease.cursor, MAX_SCAN_ACCOUNTS);
    if (!page.length) { await checkpoint(''); return finish({ status: 'idle', scanned, cycleComplete: true }); }
    for (const document of page) {
      if (Date.now() - started >= SCAN_MS) break;
      assertTrustedWorker(capability);
      await checkpoint(document.id); scanned++;
      const data = document.data();
      if (!data || data.deleted || typeof data.workspaceId !== 'string') continue;
      const account = await verifyWorkerAccount(capability, document.id, data.workspaceId);
      if (!account) continue;
      const root = db.collection('somaAccounts').doc(createHash('sha256').update(account.uid).digest('hex'));
      const stateRef = root.collection('workerState').doc('schedule');
      const raw = (await stateRef.get()).data() as Schedule | undefined;
      const schedule: Schedule = raw?.workspaceId === data.workspaceId ? raw : { workspaceId: data.workspaceId };
      const workspace = await readAccountWorkspace(account);
      if (!workspace) continue;
      const recovered = await reconcilePreparationOutbox(account, workspace, schedule.outboxCursor);
      schedule.outboxCursor = recovered.cursor;
      await db.runTransaction(async tx => {
        const current = await tx.get(root), worker = await tx.get(control);
        if (!current.exists || current.get('deleted') || current.get('ownerId') !== account.uid || current.get('workspaceId') !== data.workspaceId || worker.get('leaseId') !== leaseId || worker.get('leaseUntil') <= Date.now()) return;
        tx.set(stateRef, { workspaceId: data.workspaceId, outboxCursor: recovered.cursor }, { merge: true });
      });
      const connections = await listConnections(account);
      for (const kind of workOrder(schedule.nextKind ?? 'refresh')) {
        if ((schedule.cooldowns?.[kind] ?? 0) > Date.now()) continue;
        const connection = kind === 'refresh' ? connections.filter(item => dependencies.providerConfigured(item.provider) && connectionDue(item, schedule.connections)).sort((a, b) => (schedule.connections?.[a.id]?.nextAt ?? 0) - (schedule.connections?.[b.id]?.nextAt ?? 0) || a.id.localeCompare(b.id))[0] : undefined;
        const job = kind === 'preparation' ? await dependencies.nextPreparation(account) : kind === 'adaptation' ? await dependencies.nextAdaptation(account) : null;
        if (!connection && !job) continue;
        await revalidateWorkerAccount(account);
        if (Date.now() - started >= SCAN_MS) return finish({ status: 'deferred', scanned, outcome: 'discovery-time-budget' });
        let outcome = 'completed', deferred = false;
        try {
          if (connection) await dependencies.refresh(account, connection);
          else if (kind === 'preparation') await dependencies.runPreparation(account, job!.id);
          else await dependencies.runAdaptation(account, job!.id);
        } catch (error) {
          // No provider bodies, identities, source text, or credentials enter scheduler output.
          deferred = true;
          const code = (error as { code?: string }).code;
          outcome = error instanceof InferenceBudgetError || code === 'inference_unavailable' ? 'budget-pending'
            : code === 'browser_login_required' || code === 'worker_account_inactive' ? 'authorization-required'
            : code === 'worker_workspace_changed' || (error as { status?: number }).status === 409 ? 'context-changed' : 'retry-pending';
        }
        await db.runTransaction(async tx => {
          const [currentRoot, currentState, worker] = await Promise.all([tx.get(root), tx.get(stateRef), tx.get(control)]);
          if (!currentRoot.exists || currentRoot.get('deleted') || currentRoot.get('ownerId') !== account.uid || currentRoot.get('workspaceId') !== data.workspaceId || worker.get('leaseId') !== leaseId || worker.get('leaseUntil') <= Date.now()) return;
          const previous = currentState.data() as Schedule | undefined;
          const next: Schedule = previous && previous.workspaceId === data.workspaceId ? previous : { workspaceId: data.workspaceId };
          next.nextKind = nextKind(kind);
          next.cooldowns = { ...next.cooldowns, [kind]: deferred && !connection ? Date.now() + 60 * 60_000 : 0 };
          if (connection) {
            const old = next.connections?.[connection.id], failures = deferred ? (old?.failures ?? 0) + 1 : 0;
            next.connections = { ...next.connections, [connection.id]: { scope: connectionScopeFingerprint(connection), failures, nextAt: Date.now() + (deferred ? retryDelayMs(failures) : connectionRefreshInterval(connection)), lastAttemptAt: new Date().toISOString(), outcome } };
          }
          tx.set(stateRef, next);
        });
        return finish({ status: deferred ? 'deferred' : 'processed', scanned, kind, outcome });
      }
    }
    return finish({ status: 'idle', scanned });
  } catch (error) {
    const code = (error as { code?: string }).code;
    finalError = code === 'worker_workspace_changed' ? 'context-changed' : code === 'worker_account_unavailable' ? 'account-check-unavailable' : 'worker-unavailable';
    throw error;
  } finally {
    await db.runTransaction(async tx => {
      const current = await tx.get(control);
      if (current.get('leaseId') === leaseId) tx.update(control, { leaseUntil: 0, lastCompletedAt: new Date().toISOString(), completedTicks: Number(current.get('completedTicks') || 0) + 1,
        processedWork: Number(current.get('processedWork') || 0) + (finalResult.status === 'processed' ? 1 : 0),
        deferredWork: Number(current.get('deferredWork') || 0) + (finalResult.status === 'deferred' ? 1 : 0),
        errorTicks: Number(current.get('errorTicks') || 0) + (finalError ? 1 : 0), lastOutcome: finalError || finalResult.outcome || finalResult.status, lastScanned: scanned });
    });
  }
}
