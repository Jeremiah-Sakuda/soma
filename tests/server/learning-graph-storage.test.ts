import { localLearningGraph } from '../../src/lib/domain/learning-graph';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { getAuth } from 'firebase-admin/auth';
import { deleteApp } from 'firebase-admin/app';
import { describe, expect, it, vi } from 'vitest';
import { graphFixture } from '../helpers/learning-graph';
import {
  createWorkspace,
  updateWorkspace,
  readWorkspace,
  closeLocalStore,
} from '../../src/lib/server/store';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyWorkerAccount } from '../../src/lib/server/account';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import {
  encodeAccountRecords,
  updateAccountWorkspace,
  readAccountWorkspace,
} from '../../src/lib/server/account-store';

it('SQLite retains the linked graph after disk reopen and retry without sharing another session', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'soma-graph-'));
  vi.stubEnv('SOMA_PERSISTENCE', 'local-synthetic');
  vi.stubEnv('SOMA_LOCAL_DATABASE_PATH', join(directory, 'graph.sqlite'));
  try {
    const first = await createWorkspace(),
      second = await createWorkspace();
    const saved = await updateWorkspace(first.token, (current) => {
      const fixture = graphFixture();
      fixture.id = current.id;
      fixture.createdAt = current.createdAt;
      fixture.expiresAt = current.expiresAt;
      fixture.investigations!.forEach((record) => {
        record.workspaceId = current.id;
      });
      return fixture;
    });
    // Change fixture's investigation owner only through its canonical generation before projection.
    expect(saved.learningGraph?.length).toBeGreaterThan(0);
    closeLocalStore();
    expect(await readWorkspace(first.token)).toEqual(saved);
    const retry = await updateWorkspace(first.token, (current) => current);
    expect(retry.learningGraph).toEqual(saved.learningGraph);
    expect((await readWorkspace(second.token))!.learningGraph).toBeUndefined();
  } finally {
    closeLocalStore();
    vi.unstubAllEnvs();
    rmSync(directory, { recursive: true, force: true });
  }
});

describe.skipIf(process.env.SOMA_LIVE_GRAPH_TEST !== 'true')(
  'managed synthetic graph storage',
  () => {
    it('retains graph records through managed reconnect, enforces owner and stale CAS, and deduplicates retry', async () => {
      if (process.env.FIRESTORE_EMULATOR_HOST || process.env.FIREBASE_AUTH_EMULATOR_HOST)
        throw new Error('Requires real Firebase.');
      const user = await getAuth(getServerApp()).createUser({
        email: `soma-graph-${randomUUID()}@example.invalid`,
      });
      const rootId = createHash('sha256').update(user.uid).digest('hex');
      try {
        vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
        vi.stubEnv('SOMA_WORKER_SECRET', randomBytes(32).toString('hex'));
        vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
        const state = graphFixture();
        state.mode = 'account';
        state.investigations = [];
        const root = getServerFirestore().collection('somaAccounts').doc(rootId),
          encoded = encodeAccountRecords(state),
          batch = root.firestore.batch();
        for (const [group, { records }] of Object.entries(encoded.groups))
          for (const [id, value] of Object.entries(records))
            batch.set(root.collection(group).doc(id), {
              ...value,
              ownerId: user.uid,
              workspaceId: state.id,
            });
        batch.set(root, {
          ownerId: user.uid,
          workspaceId: state.id,
          revision: state.revision,
          summary: encoded.summary,
          groups: Object.fromEntries(
            Object.entries(encoded.groups).map(([key, value]) => [key, value.kind]),
          ),
        });
        await batch.commit();
        const capability = verifyWorkerRequest(
          new Request('https://soma.example/api/internal/worker', {
            headers: { authorization: `Bearer ${process.env.SOMA_WORKER_SECRET}` },
          }),
        );
        const account = await verifyWorkerAccount(capability, rootId, state.id);
        if (!account) throw new Error('Synthetic account unavailable.');
        const saved = await updateAccountWorkspace(account, (current) => ({
          ...current,
          investigations: graphFixture().investigations,
        }));
        expect(saved.learningGraph?.length).toBeGreaterThan(0);
        await deleteApp(getServerApp());
        expect(await readAccountWorkspace(account)).toEqual(saved);
        const retry = await updateAccountWorkspace(account, (current) => current);
        expect(retry.learningGraph).toEqual(saved.learningGraph);
        await expect(
          updateAccountWorkspace(account, (current) => current, saved.revision),
        ).rejects.toMatchObject({ status: 409 });
        await expect(
          updateAccountWorkspace(account, (current) => ({
            ...current,
            investigations: [
              {
                ...graphFixture().investigations![0],
                id: 'foreign-record',
                workspaceId: 'foreign-workspace',
              },
            ],
          })),
        ).rejects.toThrow('outside this workspace');
        expect((await readAccountWorkspace(account))!.learningGraph).toEqual(saved.learningGraph);
        const revised = await updateAccountWorkspace(account, (current) => {
          const lesson = current.lessons[0];
          current.attempts.push({
            id: 'managed-response',
            lessonId: lesson.id,
            lessonVersion: lesson.version,
            modelVersion: lesson.modelVersion,
            question: lesson.question,
            response: lesson.options[0],
            correct: null,
            assisted: true,
            assistance: ['explanation'],
            createdAt: '2026-10-27T12:01:00Z',
            novel: false,
            feedback: 'Synthetic response',
            sourceVersions: lesson.sourceVersions,
          });
          current.investigations!.push({
            ...current.investigations![0],
            id: 'managed-revision',
            supersedesId: 'investigation-original',
            createdAt: '2026-10-27T12:02:00Z',
            diagnosticPlan: undefined,
            diagnosticLessonId: undefined,
            attemptIds: ['managed-response'],
            hypothesisRevisions: [
              {
                hypothesisId: 'one',
                status: 'weakened',
                reason: 'This synthetic response contradicted the provisional prediction.',
              },
            ],
          });
          return current;
        });
        await deleteApp(getServerApp());
        const reopened = await readAccountWorkspace(account);
        expect(reopened).toEqual(revised);
        expect(
          reopened!.learningGraph!.filter((record) => record.kind === 'interpretation'),
        ).toHaveLength(4);
        expect(reopened!.attempts.at(-1)!.assisted).toBe(true);
        const followed = await updateAccountWorkspace(account, (current) => {
          const original = current.lessons[0],
            first = current.investigations![0];
          const fresh = {
            ...original,
            id: 'managed-fresh-application',
            kind: 'practice' as const,
            exposure: 'fresh-no-diagram' as const,
            diagnosticInvestigationId: 'managed-fresh-investigation',
            question:
              'Which endpoint comparison identifies the shared branch voltage in a new drawing?',
            mode: 'prepared' as const,
          };
          current.lessons.unshift(fresh);
          current.recommendedLessonId = fresh.id;
          current.investigations!.push({
            ...first,
            id: 'managed-fresh-investigation',
            supersedesId: 'managed-revision',
            createdAt: '2026-10-27T12:03:00Z',
            selectedLessonId: fresh.id,
            diagnosticLessonId: fresh.id,
            attemptIds: ['managed-response'],
            diagnosticPlan: { ...first.diagnosticPlan!, question: fresh.question },
            hypothesisRevisions: [
              {
                hypothesisId: 'one',
                status: 'weakened',
                reason: 'Original scripted synthetic response warrants a fresh condition.',
              },
              {
                hypothesisId: 'two',
                status: 'unresolved',
                reason: 'Independent understanding remains unconfirmed.',
              },
            ],
          });
          return current;
        });
        await deleteApp(getServerApp());
        const final = await readAccountWorkspace(account);
        expect(final).toEqual(followed);
        expect(final!.recommendedLessonId).toBe('managed-fresh-application');
        expect(final!.attempts).toEqual(revised.attempts);
        expect(
          localLearningGraph(final!, state.lessons[0].id).find(
            (record) => record.kind === 'interpretation' && record.hypothesisId === 'one',
          ),
        ).toMatchObject({ status: 'weakened', observationIds: ['managed-response'] });
        expect(
          localLearningGraph(final!, 'managed-fresh-application')
            .filter((record) => record.kind === 'interpretation')
            .every(
              (record) =>
                record.kind === 'interpretation' &&
                record.version === 1 &&
                record.status === 'plausible' &&
                record.diagnosticInvestigationId === 'managed-fresh-investigation',
            ),
        ).toBe(true);
        expect(
          final!.learningGraph!.some(
            (record) =>
              record.kind === 'relationship' &&
              record.from.kind === 'activity' &&
              record.from.id === 'managed-fresh-application',
          ),
        ).toBe(true);
      } finally {
        await getServerFirestore().recursiveDelete(
          getServerFirestore().collection('somaAccounts').doc(rootId),
        );
        await getAuth(getServerApp()).deleteUser(user.uid);
        vi.unstubAllEnvs();
      }
    }, 60000);
  },
);
