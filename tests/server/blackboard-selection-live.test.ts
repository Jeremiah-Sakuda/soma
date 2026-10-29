import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { DocumentReference } from 'firebase-admin/firestore';
import { describe, expect, it, vi } from 'vitest';
import { graphFixture } from '../helpers/learning-graph';
import type { Source, WorkspaceState } from '../../src/lib/domain/types';
import type { VerifiedAccount } from '../../src/lib/server/account';
import { verifyWorkerAccount } from '../../src/lib/server/account';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { encodeAccountRecords, readAccountWorkspace, updateAccountWorkspace } from '../../src/lib/server/account-store';
import { acquireConnectionLease, readConnection, releaseConnectionLease, saveConnection } from '../../src/lib/server/connectors/store';
import { blackboardStatus, selectBlackboardCourses } from '../../src/lib/server/connectors/blackboard';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const catalogEpoch = 'original-synthetic-catalog-epoch';
const catalog = [
  { id: '_synthetic_ecology_1', title: 'Original Synthetic Ecology', code: 'SYN BIO 101', url: 'https://learn.bu.edu/ultra/courses/_synthetic_ecology_1/outline' },
  { id: '_synthetic_algorithms_1', title: 'Original Synthetic Algorithms', url: 'https://learn.bu.edu/ultra/courses/_synthetic_algorithms_1/outline' },
];

async function fixture(run: (context: { account: VerifiedAccount; root: DocumentReference; state: WorkspaceState }) => Promise<void>) {
  if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Requires managed Firebase.');
  vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
  vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
  vi.stubEnv('SOMA_WORKER_SECRET', randomBytes(32).toString('hex'));
  vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY', randomBytes(32).toString('hex'));
  vi.stubEnv('SOMA_CONNECTOR_ENCRYPTION_KEY_ID', 'synthetic-selection');
  vi.stubEnv('SOMA_CONNECTOR_DECRYPTION_KEYS', '{}');
  vi.stubEnv('SOMA_CONNECTOR_WRITE_FORMAT', 'v2');
  vi.stubEnv('SOMA_LIVE_INFERENCE', 'false');
  let uid: string | undefined;
  try {
    const user = await getAuth(getServerApp()).createUser({ email: `soma-blackboard-selection-${randomUUID()}@example.invalid` });
    uid = user.uid;
    const rootId = hash(uid), root = getServerFirestore().collection('somaAccounts').doc(rootId);
    const state = graphFixture();
    state.mode = 'account';
    state.courses[0] = { ...state.courses[0], title: 'Original manual course title', instructor: 'Original synthetic instructor', assessments: [{ id: 'manual-exam', title: 'Original manual exam', deadlineAt: '2026-11-02T17:00:00Z', includedTopics: ['Original synthetic topic'] }] };
    const encoded = encodeAccountRecords(state), batch = root.firestore.batch();
    for (const [group, { records }] of Object.entries(encoded.groups)) for (const [id, value] of Object.entries(records)) {
      batch.set(root.collection(group).doc(id), { ...value, ownerId: uid, workspaceId: state.id });
    }
    batch.set(root, { ownerId: uid, workspaceId: state.id, revision: state.revision, summary: encoded.summary, groups: Object.fromEntries(Object.entries(encoded.groups).map(([name, value]) => [name, value.kind])) });
    for (const course of catalog) batch.set(root.collection('blackboardCatalog').doc(hash(course.id)), { course, ownerId: uid, workspaceId: state.id, catalogEpoch });
    await batch.commit();
    const capability = verifyWorkerRequest(new Request('https://soma.example/api/internal/worker', { headers: { authorization: `Bearer ${process.env.SOMA_WORKER_SECRET}` } }));
    const account = await verifyWorkerAccount(capability, rootId, state.id);
    if (!account) throw new Error('Synthetic account verification failed.');
    await saveConnection(account, state.id, 'browser-blackboard', {
      provider: 'blackboard', status: 'connected', secret: { contextId: 'original-synthetic-context-never-opened' },
      configuration: { targets: [], blackboard: { selected: [], catalogIds: catalog.map(course => course.id), catalogCheckedAt: '2026-10-27T12:00:00Z', catalogComplete: true, catalogEpoch, catalogSubjectId: '_original_synthetic_self_1', nextCourseIndex: 0 } },
    }, 0);
    await run({ account, root, state });
  } finally {
    try {
      if (uid) {
        await getServerFirestore().recursiveDelete(getServerFirestore().collection('somaAccounts').doc(hash(uid)));
        await getAuth(getServerApp()).deleteUser(uid);
      }
    } finally { vi.unstubAllEnvs(); }
  }
}

// Real managed transactions and account verification; original synthetic records only.
// The fake Browserbase context is never used. No institution, provider or model is called.
describe.skipIf(process.env.SOMA_BLACKBOARD_SELECTION_LIVE !== 'true')('managed Blackboard course selection', () => {
  it('creates metadata only, explicitly maps a manual course, and persists retry without duplicates or assessment loss', async () => fixture(async ({ account, state }) => {
    const manual = structuredClone(state.courses[0]);
    const first = await selectBlackboardCourses(account, catalog.map(course => course.id), { [catalog[1].id]: manual.id });
    const createdId = `bb-${hash(catalog[0].id).slice(0, 24)}`;
    expect(first.selected).toEqual([{ id: catalog[0].id, courseId: createdId }, { id: catalog[1].id, courseId: manual.id }]);
    expect(first.workspace.courses).toHaveLength(state.courses.length + 1);
    expect(first.workspace.courses.find(course => course.id === createdId)).toEqual({ id: createdId, code: catalog[0].code, title: catalog[0].title, instructor: '', color: 'blue', nextEvent: '', deadline: '' });
    expect(first.workspace.courses.find(course => course.id === manual.id)).toEqual(manual);
    expect(first.workspace.sources).toEqual(state.sources);
    expect(first.workspace.lessons).toEqual(state.lessons);
    expect(first.workspace.attempts).toEqual(state.attempts);
    const retry = await selectBlackboardCourses(account, catalog.map(course => course.id), { [catalog[1].id]: manual.id });
    expect(retry.workspace.courses).toEqual(first.workspace.courses);
    expect(retry.workspace.sources).toEqual(state.sources);
    expect(retry.selected).toEqual(first.selected);
    expect((await readConnection(account, 'browser-blackboard'))!.configuration).toMatchObject({
      targets: first.selected.map(item => ({ courseId: item.courseId, url: catalog.find(course => course.id === item.id)!.url })),
      blackboard: { mode: 'courses', catalogSubjectId: '_original_synthetic_self_1', selectedSubjectId: '_original_synthetic_self_1' },
    });
    await deleteApp(getServerApp());
    expect((await readAccountWorkspace(account))!.courses).toEqual(first.workspace.courses);
    expect((await blackboardStatus(account)).selected).toEqual(first.selected);
  }), 90_000);

  it('rejects missing, foreign and old-generation catalog rows and invalid mappings without partial course publication', async () => fixture(async ({ account, root, state }) => {
    const baseline = await readAccountWorkspace(account);
    const assertUnchanged = async () => {
      const current = await readAccountWorkspace(account);
      expect(current!.revision).toBe(baseline!.revision);
      expect(current!.courses).toEqual(baseline!.courses);
      expect(current!.sources).toEqual(baseline!.sources);
      expect((await readConnection(account, 'browser-blackboard'))!.configuration).toMatchObject({ blackboard: { selected: [] } });
    };
    await expect(selectBlackboardCourses(account, ['_missing_catalog_1'])).rejects.toMatchObject({ code: 'blackboard_catalog_changed' });
    await assertUnchanged();
    const foreign = { id: '_foreign_catalog_1', title: 'Original synthetic foreign course', url: 'https://learn.bu.edu/ultra/courses/_foreign_catalog_1/outline' };
    await root.collection('blackboardCatalog').doc(hash(foreign.id)).set({ ownerId: 'different-synthetic-owner', workspaceId: state.id, course: foreign, catalogEpoch });
    await expect(selectBlackboardCourses(account, [foreign.id])).rejects.toMatchObject({ code: 'blackboard_catalog_changed' });
    await assertUnchanged();
    await root.collection('blackboardCatalog').doc(hash(foreign.id)).set({ ownerId: account.uid, workspaceId: 'older-synthetic-workspace', course: foreign, catalogEpoch });
    await expect(selectBlackboardCourses(account, [foreign.id])).rejects.toMatchObject({ code: 'blackboard_catalog_changed' });
    await assertUnchanged();
    await root.collection('blackboardCatalog').doc(hash(foreign.id)).set({ ownerId: account.uid, workspaceId: state.id, course: { ...foreign, id: '_different_identity_1' }, catalogEpoch });
    await expect(selectBlackboardCourses(account, [foreign.id])).rejects.toMatchObject({ code: 'blackboard_catalog_changed' });
    await assertUnchanged();
    await root.collection('blackboardCatalog').doc(hash(foreign.id)).set({ ownerId: account.uid, workspaceId: state.id, course: foreign, catalogEpoch: 'older-synthetic-subject-epoch' });
    await expect(selectBlackboardCourses(account, [foreign.id])).rejects.toMatchObject({ code: 'blackboard_catalog_changed' });
    await assertUnchanged();
    await expect(selectBlackboardCourses(account, [catalog[0].id], { [catalog[0].id]: 'not-in-this-workspace' })).rejects.toMatchObject({ code: 'source_course_scope' });
    await assertUnchanged();
    await expect(selectBlackboardCourses(account, catalog.map(course => course.id), Object.fromEntries(catalog.map(course => [course.id, state.courses[0].id])))).rejects.toMatchObject({ status: 400 });
    await assertUnchanged();
    await expect(selectBlackboardCourses(account, [catalog[0].id, catalog[0].id])).rejects.toMatchObject({ status: 400 });
    await expect(selectBlackboardCourses(account, [catalog[0].id], { [catalog[1].id]: state.courses[0].id })).rejects.toMatchObject({ status: 400 });
    await assertUnchanged();
  }), 90_000);

  it('retains removed-course evidence as stale and blocks active or expired unresolved browser leases', async () => fixture(async ({ account, root, state }) => {
    const selected = await selectBlackboardCourses(account, catalog.map(course => course.id));
    const firstId = selected.selected[0].courseId, secondId = selected.selected[1].courseId;
    const source = (id: string, courseId: string, provider: 'blackboard' | 'piazza'): Source => ({
      id, courseId, title: 'Original synthetic collected material', body: 'Original synthetic material, retained when selected scope changes.', version: 1,
      kind: provider, origin: 'live', retrievedAt: '2026-10-27T12:01:00Z', status: 'current',
      provenance: { origin: 'live-browser', sourceKey: `${provider}:browser-${provider}:${id}`, contentHash: hash(id), importedAt: '2026-10-27T12:01:00Z' },
    });
    const retained = source('synthetic-retained', firstId, 'blackboard'), removed = source('synthetic-removed', secondId, 'blackboard'), unrelated = source('synthetic-unrelated', secondId, 'piazza');
    await updateAccountWorkspace(account, current => ({ ...current, sources: [...current.sources, retained, removed, unrelated] }));
    const shrunk = await selectBlackboardCourses(account, [catalog[0].id]);
    expect(shrunk.workspace.sources.find(item => item.id === retained.id)).toEqual(retained);
    expect(shrunk.workspace.sources.find(item => item.id === removed.id)).toEqual({ ...removed, status: 'stale' });
    expect(shrunk.workspace.sources.find(item => item.id === unrelated.id)).toEqual(unrelated);
    expect(shrunk.workspace.courses).toEqual(selected.workspace.courses);
    expect(shrunk.workspace.sources.filter(item => state.sources.some(original => original.id === item.id))).toEqual(state.sources);
    const beforeLease = await readAccountWorkspace(account);
    const lease = await acquireConnectionLease(account, 'browser-blackboard', 'original-synthetic-remote-allocation');
    await expect(selectBlackboardCourses(account, [])).rejects.toMatchObject({ code: 'connection_busy' });
    await root.collection('connections').doc('browser-blackboard').update({ leaseUntil: 0 });
    await expect(selectBlackboardCourses(account, [])).rejects.toMatchObject({ code: 'connection_busy' });
    expect((await root.collection('connections').doc('browser-blackboard').get()).get('leaseId')).toBe(lease.leaseId);
    expect((await readAccountWorkspace(account))!.revision).toBe(beforeLease!.revision);
    expect(await releaseConnectionLease(account, 'browser-blackboard', lease.leaseId)).toBe(true);
    const cleared = await selectBlackboardCourses(account, []);
    expect(cleared.selected).toEqual([]);
    expect(cleared.workspace.courses).toEqual(selected.workspace.courses);
    expect(cleared.workspace.sources.find(item => item.id === retained.id)).toEqual({ ...retained, status: 'stale' });
    expect(cleared.workspace.sources.find(item => item.id === removed.id)).toEqual({ ...removed, status: 'stale' });
    expect(cleared.workspace.sources.find(item => item.id === unrelated.id)).toEqual(unrelated);
  }), 90_000);

  it('stales provider A evidence when provider B replaces it in the same Soma course and preserves historical mapping anchors', async () => fixture(async ({ account, state }) => {
    const manualId = state.courses[0].id;
    await selectBlackboardCourses(account, [catalog[0].id], { [catalog[0].id]: manualId });
    const makeSource = (id: string, sourceKey: string): Source => ({ id, courseId: manualId, title: 'Original synthetic identity-bound material', body: 'Original synthetic content stays bound to the course where it was observed.', version: 1, kind: 'blackboard', origin: 'live', retrievedAt: '2026-10-27T12:01:00Z', status: 'current', provenance: { origin: 'live-browser', sourceKey, contentHash: hash(id), importedAt: '2026-10-27T12:01:00Z' } });
    const legacyA = makeSource('original-legacy-a', 'blackboard:browser-blackboard:original-unscoped-a');
    const scopedA = makeSource('original-scoped-a', `blackboard:browser-blackboard:${catalog[0].id}:content:original-a`);
    await updateAccountWorkspace(account, current => ({ ...current, sources: [...current.sources, legacyA, scopedA] }));
    const replaced = await selectBlackboardCourses(account, [catalog[1].id], { [catalog[1].id]: manualId });
    expect(replaced.workspace.sources.find(source => source.id === legacyA.id)).toEqual({ ...legacyA, status: 'stale' });
    expect(replaced.workspace.sources.find(source => source.id === scopedA.id)).toEqual({ ...scopedA, status: 'stale' });
    const scopedB = makeSource('original-scoped-b', `blackboard:browser-blackboard:${catalog[1].id}:content:original-b`);
    await updateAccountWorkspace(account, current => ({ ...current, sources: [...current.sources, scopedB] }));
    const unchanged = await selectBlackboardCourses(account, [catalog[1].id], { [catalog[1].id]: manualId });
    expect(unchanged.workspace.sources.find(source => source.id === scopedB.id)).toEqual(scopedB);
    expect(unchanged.workspace.sources.find(source => source.id === scopedA.id)).toEqual({ ...scopedA, status: 'stale' });
    await selectBlackboardCourses(account, []);
    const beforeRemap = await readAccountWorkspace(account);
    await expect(selectBlackboardCourses(account, [catalog[1].id], { [catalog[1].id]: state.courses[1].id })).rejects.toMatchObject({ code: 'source_mapping_conflict' });
    await expect(selectBlackboardCourses(account, [catalog[0].id], { [catalog[0].id]: state.courses[1].id })).rejects.toMatchObject({ code: 'source_mapping_conflict' });
    expect(await readAccountWorkspace(account)).toEqual(beforeRemap);
    expect((await blackboardStatus(account)).selected).toEqual([]);
    const restored = await selectBlackboardCourses(account, [catalog[1].id], { [catalog[1].id]: manualId });
    expect(restored.workspace.sources.find(source => source.id === scopedB.id)).toEqual({ ...scopedB, status: 'stale' });
  }), 90_000);

  it('retains legacy URL evidence mapping after deselection and rejects reassignment to another Soma course', async () => fixture(async ({ account, state }) => {
    const manualId = state.courses[0].id;
    await selectBlackboardCourses(account, [catalog[0].id], { [catalog[0].id]: manualId });
    const legacy: Source = { id: 'original-legacy-url-source', courseId: manualId, title: 'Original synthetic legacy URL material', body: 'Original synthetic legacy text retains the course where it was collected.', version: 1, kind: 'blackboard', origin: 'live', retrievedAt: '2026-10-27T12:01:00Z', status: 'current', provenance: { origin: 'live-browser', sourceKey: `blackboard:browser-blackboard:${catalog[0].url}`, contentHash: hash('legacy-url'), importedAt: '2026-10-27T12:01:00Z' } };
    await updateAccountWorkspace(account, current => ({ ...current, sources: [...current.sources, legacy] }));
    await selectBlackboardCourses(account, []);
    const before = await readAccountWorkspace(account);
    expect(before!.sources.find(source => source.id === legacy.id)).toEqual({ ...legacy, status: 'stale' });
    await expect(selectBlackboardCourses(account, [catalog[0].id], { [catalog[0].id]: state.courses[1].id })).rejects.toMatchObject({ code: 'source_mapping_conflict' });
    expect(await readAccountWorkspace(account)).toEqual(before);
    const restored = await selectBlackboardCourses(account, [catalog[0].id], { [catalog[0].id]: manualId });
    expect(restored.selected).toEqual([{ id: catalog[0].id, courseId: manualId }]);
    expect(restored.workspace.sources.find(source => source.id === legacy.id)).toEqual({ ...legacy, status: 'stale' });
  }), 90_000);
});
