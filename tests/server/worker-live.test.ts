import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { verifyWorkerAccount, type VerifiedAccount } from '../../src/lib/server/account';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { circuitCandidate } from '../../src/lib/domain/lessons';
import type { WorkspaceState } from '../../src/lib/domain/types';
import { encodeAccountRecords, readAccountWorkspace, updateAccountWorkspace, deleteAccountWorkspace } from '../../src/lib/server/account-store';
import { saveConnection, acquireConnectionLease, releaseConnectionLease, connectionPublicationGuard, listConnections } from '../../src/lib/server/connectors/store';
import { enqueuePreparation, claimPreparationJob, listPreparationJobs, runPreparationJob, mayClaimJob } from '../../src/lib/server/jobs';
import { runWorkerTick, connectionScopeFingerprint, SOURCE_REFRESH_MS, type WorkerDependencies } from '../../src/lib/server/worker';
import { readAuditRuns } from '../../src/lib/server/audit-store';
import { InferenceBudgetError } from '../../src/lib/server/budget';

const providerBoundary = vi.hoisted(() => ({ before: undefined as undefined | ((workspace: WorkspaceState) => Promise<void>), calls: 0 }));
vi.mock('../../src/lib/server/meta', async importOriginal => ({ ...await importOriginal<typeof import('../../src/lib/server/meta')>(), prepareWithSpark: async (state: WorkspaceState, courseId: string) => {
  providerBoundary.calls++;
  await providerBoundary.before?.(state);
  return { lesson: { ...circuitCandidate(courseId, state.sources, 'parallel'), mode: 'prepared' as const }, run: { id: `run-${randomUUID()}`, mode: 'synthetic' as const, status: 'completed' as const, trigger: 'Original synthetic worker boundary', createdAt: new Date().toISOString(), sourceIds: state.sources.map(source => source.id), steps: ['Synthetic provider boundary; no hosted model call.'], effect: 'Verified durable worker publication.' } };
} }));
vi.mock('../../src/lib/server/investigator', async importOriginal => ({ ...await importOriginal<typeof import('../../src/lib/server/investigator')>(), investigateWithSpark: async (state: WorkspaceState) => {
  providerBoundary.calls++;
  await providerBoundary.before?.(state);
  throw new Error('A synthetic investigation boundary must supply its explicit outcome.');
} }));

// Real Firebase ownership, transactions, leases and persistence; external collection
// and model execution alone are synthetic boundaries. No private users or sources.
describe.skipIf(process.env.SOMA_LIVE_WORKER_TEST !== 'true')('live scheduled worker without a UI session', () => {
  it('persists fair dispatch, overlap exclusion, retries, source races and owner deletion', async () => {
    if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Real Firebase is required.');
    const db = getServerFirestore(), created: { uid: string; rootId: string; workspace: WorkspaceState }[] = [];
    const controlId = `synthetic-${randomUUID()}`, control = db.collection('somaWorker').doc(controlId);
    const budgetBefore = (await db.doc('somaBudget/global').get()).get('consumed');
    const secret = randomBytes(32).toString('hex');
    vi.stubEnv('SOMA_WORKER_ENABLED', 'true'); vi.stubEnv('SOMA_WORKER_SECRET', secret);
    vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', '11'.repeat(32));
    const capability = () => verifyWorkerRequest(new Request('https://soma.example/api/internal/worker', { headers: { authorization: `Bearer ${secret}` } }));
    const accountFor = async (item: typeof created[number]) => {
      const account = await verifyWorkerAccount(capability(), item.rootId, item.workspace.id);
      if (!account) throw new Error('Synthetic worker account could not be verified.');
      return account;
    };
    const writeFixture = async (uid: string, state: WorkspaceState) => {
      const root = db.collection('somaAccounts').doc(createHash('sha256').update(uid).digest('hex'));
      const encoded = encodeAccountRecords(state), batch = db.batch();
      batch.set(root, { ownerId: uid, workspaceId: state.id, revision: state.revision, summary: encoded.summary, groups: Object.fromEntries(Object.entries(encoded.groups).map(([name, group]) => [name, group.kind])) });
      for (const [name, group] of Object.entries(encoded.groups)) for (const [id, record] of Object.entries(group.records)) batch.set(root.collection(name).doc(id), { ...record, ownerId: uid, workspaceId: state.id });
      await batch.commit();
    };
    const originalFetch = globalThis.fetch;
    const noMeta = vi.spyOn(globalThis, 'fetch').mockImplementation((input, init) => {
      if ((input instanceof Request ? input.url : String(input)).startsWith('https://api.meta.ai/')) throw new Error('Hosted model calls are forbidden in worker persistence tests.');
      return originalFetch(input, init);
    });
    try {
      for (let index = 0; index < 2; index++) {
        const user = await getAuth(getServerApp()).createUser({ email: `worker-integration-${randomUUID()}@example.invalid` });
        const state = seedEmptyAccountWorkspace(randomUUID());
        state.courses = [{ id: 'fixture-course', code: 'SYN', title: 'Original worker fixture', instructor: '', color: '#234567', deadline: '', nextEvent: '' }];
        const item = { uid: user.uid, rootId: createHash('sha256').update(user.uid).digest('hex'), workspace: state }; created.push(item);
        await writeFixture(item.uid, state);
        await saveConnection(await accountFor(item), state.id, 'google-gmail', { provider: 'gmail', status: 'connected', secret: { accessToken: 'original-synthetic-token-not-a-credential' }, configuration: { queries: [{ courseId: 'fixture-course', query: 'subject:synthetic' }] } });
      }
      created.sort((a, b) => a.rootId.localeCompare(b.rootId));
      const [a, b] = created, accountA = await accountFor(a), accountB = await accountFor(b);
      expect(await verifyWorkerAccount(capability(), a.rootId, b.workspace.id)).toBeNull();
      await getAuth(getServerApp()).updateUser(b.uid, { disabled: true });
      expect(await verifyWorkerAccount(capability(), b.rootId, b.workspace.id)).toBeNull();
      await getAuth(getServerApp()).updateUser(b.uid, { disabled: false });

      let entered!: () => void, unblock!: () => void;
      const started = new Promise<void>(resolve => { entered = resolve; }), gate = new Promise<void>(resolve => { unblock = resolve; });
      const refreshCalls: string[] = []; let pause = true, failRefresh = false;
      const dependencies: Partial<WorkerDependencies> = {
        scan: async (cursor, limit) => (await Promise.all(created.filter(item => !cursor || item.rootId > cursor).slice(0, limit).map(item => db.collection('somaAccounts').doc(item.rootId).get()))),
        providerConfigured: () => true, nextAdaptation: async () => null,
        refresh: async (account, connection) => {
          refreshCalls.push(account.uid);
          const leased = await acquireConnectionLease(account, connection.id, 'synthetic-scheduled-read');
          try {
            if (pause) { pause = false; entered(); await gate; }
            if (failRefresh) throw new Error('Original synthetic temporary provider failure.');
            const saved = await updateAccountWorkspace(account, state => {
              if (!state.sources.length) state.sources.push({ id: 'fixture-source', version: 1, courseId: 'fixture-course', title: 'Original resistor source', body: 'Original synthetic ideal parallel resistor material for persistence verification.', kind: 'synthetic', origin: 'synthetic', status: 'current', retrievedAt: new Date().toISOString(), provenance: { automaticPreparation: true, origin: 'manual-course', sourceKey: 'original-synthetic-worker-fixture', contentHash: 'synthetic', importedAt: new Date().toISOString() } });
              return state;
            }, undefined, connectionPublicationGuard(account, connection.id, leased.leaseId));
            await enqueuePreparation(account, saved, 'fixture-course', [{ sourceId: 'fixture-source', version: 1 }], 'Original synthetic ideal parallel resistors', 0);
            await releaseConnectionLease(account, connection.id, leased.leaseId, { status: 'current', lastSuccessAt: new Date().toISOString(), configuration: { ...connection.configuration, nextQueryIndex: 1 } });
          } catch (error) { await releaseConnectionLease(account, connection.id, leased.leaseId, { status: 'stale' }); throw error; }
        },
      };
      const tick = () => runWorkerTick(capability(), { controlId, dependencies });
      const pending = tick(); await started;
      expect(await tick()).toEqual({ status: 'busy', scanned: 0 });
      await expect(acquireConnectionLease(accountA, 'google-gmail', 'duplicate')).rejects.toMatchObject({ code: 'connection_busy' });
      unblock(); expect(await pending).toMatchObject({ status: 'processed', kind: 'refresh' });
      expect((await readAccountWorkspace(accountB))?.sources).toHaveLength(0);
      expect(await tick()).toMatchObject({ status: 'processed', kind: 'refresh' });
      expect(refreshCalls).toEqual([a.uid, b.uid]);
      expect(await tick()).toMatchObject({ cycleComplete: true });
      expect(await tick()).toMatchObject({ status: 'processed', kind: 'preparation' });
      expect((await readAccountWorkspace(accountA))?.lessons).toHaveLength(1);
      expect((await readAccountWorkspace(accountB))?.lessons).toHaveLength(0);
      expect(refreshCalls).toHaveLength(2); // Release/rotation did not schedule another refresh.
      const audits=async(account:VerifiedAccount)=>readAuditRuns({kind:'account',account},(await readAccountWorkspace(account))!);
      const preparedAudit=(await audits(accountA))[0];expect(preparedAudit).toMatchObject({kind:'lesson-preparation',trigger:'source-change',status:'published'});
      expect(preparedAudit.events.some(event=>event.kind==='publication')).toBe(true);
      expect(await audits(accountB)).toEqual([]);

      const bState = (await readAccountWorkspace(accountB))!, jobB = (await listPreparationJobs(accountB))[0];
      const interrupted = await claimPreparationJob(accountB, bState, jobB.id);
      const jobRef = db.collection('somaAccounts').doc(b.rootId).collection('jobs').doc(jobB.id);
      await jobRef.update({ leaseUntil: 0 });
      providerBoundary.before = async () => { await updateAccountWorkspace(accountB, state => { state.sources[0].status = 'stale'; state.sources.push({ ...state.sources[0], version: 2, status: 'current' }); return state; }); };
      expect(await tick()).toMatchObject({ status: 'deferred', kind: 'preparation', outcome: 'context-changed' });
      expect((await jobRef.get()).data()).toMatchObject({ status: 'stale', attempts: interrupted!.attempts + 1 });
      expect((await readAccountWorkspace(accountB))?.lessons).toHaveLength(0);
      providerBoundary.before = undefined;
      const racedAudit=(await audits(accountB))[0];expect(racedAudit.status).toBe('failed');
      expect(racedAudit.events.some(event=>event.kind==='publication')).toBe(false);

      // The source was saved without enqueue. Reconciliation discovers that gap.
      await control.update({ cursor: a.rootId });
      await db.collection('somaAccounts').doc(b.rootId).collection('workerState').doc('schedule').set({ cooldowns: { preparation: 0 } }, { merge: true });
      // Recovery uses investigate-change. A boundary replacement avoids hosted inference.
      dependencies.runPreparation = async (account, id) => {
        providerBoundary.before = async () => { throw new InferenceBudgetError('global'); };
        try { return await runPreparationJob(account, id); } finally { providerBoundary.before = undefined; }
      };
      expect(await tick()).toMatchObject({ status: 'deferred', outcome: 'budget-pending' });
      const recovered = (await listPreparationJobs(accountB)).find(job => job.sourceRefs.some(ref => ref.version === 2));
      expect(recovered).toMatchObject({ status: 'queued', attempts: 0 });
      expect((await audits(accountB))[0]).toMatchObject({kind:'investigation',status:'blocked'});
      const beforeDenied = providerBoundary.calls;
      await control.update({ cursor: a.rootId });
      expect(await tick()).toMatchObject({ status: 'idle' });
      expect(providerBoundary.calls).toBe(beforeDenied);

      // Actual persistent backoff: a transient collection failure cannot monopolize ticks.
      const stateRef = db.collection('somaAccounts').doc(a.rootId).collection('workerState').doc('schedule');
      const currentConnection = (await listConnections(accountA))[0];
      await stateRef.set({ nextKind: 'refresh', connections: { [currentConnection.id]: { scope: connectionScopeFingerprint(currentConnection), nextAt: 0, failures: 0, lastAttemptAt: new Date().toISOString(), outcome: 'test-due' } } }, { merge: true });
      await control.update({ cursor: '' }); failRefresh = true;
      expect(await tick()).toMatchObject({ status: 'deferred', kind: 'refresh', outcome: 'retry-pending' });
      const failedSchedule = (await stateRef.get()).get('connections.google-gmail');
      expect(failedSchedule.failures).toBe(1); expect(failedSchedule.nextAt).toBeGreaterThan(Date.now());
      const attempts = refreshCalls.length;
      await control.update({ cursor: '' }); await tick(); expect(refreshCalls).toHaveLength(attempts);
      failRefresh = false;
      const unchangedJobs = (await listPreparationJobs(accountA)).map(job => job.id);
      const unchangedProviderCalls = providerBoundary.calls;
      await stateRef.update({ 'connections.google-gmail.nextAt': 0 }); await control.update({ cursor: '' });
      expect(await tick()).toMatchObject({ status: 'processed', kind: 'refresh' });
      expect((await stateRef.get()).get('connections.google-gmail.nextAt')).toBeGreaterThan(Date.now() + SOURCE_REFRESH_MS - 10_000);
      expect((await listPreparationJobs(accountA)).map(job => job.id)).toEqual(unchangedJobs);
      expect(providerBoundary.calls).toBe(unchangedProviderCalls);

      // Exhausted interrupted work is terminalized without another provider attempt.
      const exhausted = await enqueuePreparation(accountA, (await readAccountWorkspace(accountA))!, 'fixture-course', [{ sourceId: 'fixture-source', version: 1 }], 'Original synthetic exhausted lease', 0);
      const exhaustedRef = db.collection('somaAccounts').doc(a.rootId).collection('jobs').doc(exhausted.id);
      await exhaustedRef.update({ status: 'generating', attempts: 3, leaseUntil: 0, leaseId: 'expired-synthetic-lease' });
      expect(mayClaimJob({ ...exhausted, status: 'generating', attempts: 3, leaseUntil: 0 })).toBe(false);
      await control.update({ cursor: '' });
      expect(await tick()).toMatchObject({ status: 'processed', kind: 'preparation' });
      expect((await exhaustedRef.get()).get('status')).toBe('failed');
      expect(providerBoundary.calls).toBe(unchangedProviderCalls);
      expect((await db.doc('somaBudget/global').get()).get('consumed')).toBe(budgetBefore);

      // A deleted/recreated root invalidates the old scheduled capability.
      await deleteAccountWorkspace(accountA);
      const replacement = seedEmptyAccountWorkspace(randomUUID());
      await writeFixture(a.uid, replacement);
      await expect(readAccountWorkspace(accountA)).rejects.toMatchObject({ code: 'worker_workspace_changed' });
      expect(await verifyWorkerAccount(capability(), a.rootId, a.workspace.id)).toBeNull();
      expect((await readAccountWorkspace(accountB))?.id).toBe(b.workspace.id);
      const operations = (await control.get()).data()!;
      expect(operations.completedTicks).toBeGreaterThan(5); expect(operations.processedWork).toBeGreaterThan(2);
      expect(Object.keys(operations)).not.toContain('ownerId');
    } finally {
      providerBoundary.before = undefined; noMeta.mockRestore();
      for (const item of created) { await db.recursiveDelete(db.collection('somaAccounts').doc(item.rootId)); await getAuth(getServerApp()).deleteUser(item.uid); }
      await control.delete(); vi.unstubAllEnvs();
    }
  }, 180_000);
});
