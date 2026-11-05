import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it, vi } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyWorkerAccount } from '../../src/lib/server/account';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { encodeAccountRecords, readAccountWorkspace } from '../../src/lib/server/account-store';
import {
  saveConnection,
  readConnection,
  acquireConnectionLease,
  releaseConnectionLease,
  createConnectionState,
  consumeConnectionState,
  connectionsForDeletion,
} from '../../src/lib/server/connectors/store';
import { CredentialCipher } from '../../src/lib/server/credential-crypto';
import { rotateAccountCredentials } from '../../src/lib/server/credential-rotation';
import { graphFixture } from '../helpers/learning-graph';

// Actual managed transactions; disposable credentials only. No provider/model calls.
describe.skipIf(process.env.SOMA_CREDENTIAL_ROTATION_LIVE !== 'true')(
  'managed credential key recovery',
  () => {
    it('dry-runs, resumes partial rotation, skips leases, preserves OAuth state and supports rollback and deletion recovery', async () => {
      const user = await getAuth(getServerApp()).createUser({
          email: `soma-key-${randomUUID()}@example.invalid`,
        }),
        rootId = createHash('sha256').update(user.uid).digest('hex');
      const db = getServerFirestore(),
        root = db.collection('somaAccounts').doc(rootId),
        old = randomBytes(32).toString('hex'),
        next = randomBytes(32).toString('hex');
      const settings = (key: string, id: string, extra: Record<string, string>, format = 'v2') => ({
        SOMA_CONNECTOR_ENCRYPTION_KEY: key,
        SOMA_CONNECTOR_ENCRYPTION_KEY_ID: id,
        SOMA_CONNECTOR_DECRYPTION_KEYS: JSON.stringify(extra),
        SOMA_CONNECTOR_WRITE_FORMAT: format,
      });
      const configure = (env: Record<string, string>) => {
        for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value);
      };
      try {
        vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
        vi.stubEnv('SOMA_WORKER_SECRET', randomBytes(32).toString('hex'));
        vi.stubEnv('SOMA_PERSISTENCE', 'firestore');
        configure(settings(old, 'legacy', {}, 'v1'));
        const state = graphFixture();
        state.mode = 'account';
        const encoded = encodeAccountRecords(state),
          batch = db.batch();
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
          ),
          account = await verifyWorkerAccount(capability, rootId, state.id);
        if (!account) throw new Error('Synthetic account unavailable.');
        for (const [id, provider, secret] of [
          ['google-gmail', 'gmail', { refreshToken: 'synthetic-gmail' }],
          ['google-calendar', 'calendar', { refreshToken: 'synthetic-calendar' }],
          ['browser-blackboard', 'blackboard', { contextId: 'synthetic-context' }],
        ] as const)
          await saveConnection(
            account,
            state.id,
            id,
            { provider, status: 'connected', configuration: { selected: 'original' }, secret },
            0,
          );
        const oauth = await createConnectionState(account, state.id, {
            verifier: 'synthetic-pkce',
          }),
          oauthRef = root
            .collection('connectionStates')
            .doc(createHash('sha256').update(oauth).digest('hex')),
          oauthBefore = (await oauthRef.get()).data()!;
        const lease = await acquireConnectionLease(account, 'google-gmail', 'synthetic-refresh');
        const before = (await root.collection('connections').get()).docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
          metadata = (await root.get()).data();
        const active = new CredentialCipher(settings(next, 'next', { legacy: old })),
          rollback = new CredentialCipher(settings(old, 'legacy', { next }));
        expect(await rotateAccountCredentials(db, rootId, active)).toMatchObject({
          scanned: 4,
          wouldMigrate: 3,
          busy: 1,
          migrated: 0,
          failed: 0,
        });
        const command = (apply = false) =>
          spawnSync(
            process.execPath,
            [
              '--experimental-strip-types',
              'scripts/rotate-connector-key.mjs',
              '--account-root',
              rootId,
              ...(apply ? ['--apply'] : []),
            ],
            {
              encoding: 'utf8',
              timeout: 30_000,
              env: { ...process.env, ...settings(next, 'next', { legacy: old }) },
            },
          );
        const dry = command();
        expect(dry.status).toBe(2);
        expect(JSON.parse(dry.stdout)).toMatchObject({
          mode: 'dry-run',
          wouldMigrate: 3,
          busy: 1,
          migrated: 0,
        });
        expect(dry.stderr + dry.stdout).not.toContain(old);
        expect(
          (await root.collection('connections').get()).docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })),
        ).toEqual(before);
        expect(
          await rotateAccountCredentials(db, rootId, active, { apply: true, maxRecords: 1 }),
        ).toMatchObject({ migrated: 1, incomplete: true });
        expect(await rotateAccountCredentials(db, rootId, active, { apply: true })).toMatchObject({
          current: 1,
          migrated: 2,
          busy: 1,
          failed: 0,
        });
        // Old writer preloaded with the new reader can still open records during rollout.
        configure(settings(old, 'legacy', { next }, 'v1'));
        expect((await readConnection(account, 'google-calendar'))!.secret).toEqual({
          refreshToken: 'synthetic-calendar',
        });
        expect(await releaseConnectionLease(account, 'google-gmail', lease.leaseId)).toBe(true);
        expect(await rotateAccountCredentials(db, rootId, active, { apply: true })).toMatchObject({
          current: 3,
          migrated: 1,
          busy: 0,
        });
        configure(settings(next, 'next', {}));
        expect((await readConnection(account, 'google-gmail'))!.secret).toEqual({
          refreshToken: 'synthetic-gmail',
        });
        expect((await oauthRef.get()).get('expiresAt')).toBe(oauthBefore.expiresAt);
        expect(await consumeConnectionState(account, oauth)).toEqual({
          verifier: 'synthetic-pkce',
        });
        await expect(consumeConnectionState(account, oauth)).rejects.toMatchObject({
          code: 'oauth_state',
        });
        expect(await rotateAccountCredentials(db, rootId, rollback, { apply: true })).toMatchObject(
          { migrated: 3, failed: 0 },
        );
        configure(settings(next, 'next', { legacy: old }));
        expect((await readConnection(account, 'google-calendar'))!.version).toBe(1);
        expect((await readConnection(account, 'google-calendar'))!.configuration).toEqual({
          selected: 'original',
        });
        expect((await root.get()).data()).toEqual(metadata);
        expect(await readAccountWorkspace(account)).toBeTruthy();
        // A frozen deletion can recover its encrypted cleanup references after rollover.
        await root.update({ deleted: true });
        expect(await rotateAccountCredentials(db, rootId, active, { apply: true })).toMatchObject({
          migrated: 3,
        });
        configure(settings(next, 'next', {}));
        expect((await connectionsForDeletion(account, state.id))[0].secret).toEqual({
          contextId: 'synthetic-context',
        });
        const ref = root.collection('connections').doc('google-calendar'),
          valid = (await ref.get()).data()!;
        for (const patch of [
          { ownerId: 'foreign-owner' },
          { workspaceId: 'stale-workspace' },
          { encryptedSecret: 'v2.missing.invalid.invalid.invalid' },
        ]) {
          await ref.set({ ...valid, ...patch });
          const report = await rotateAccountCredentials(db, rootId, active, { apply: true });
          expect(report.failed).toBe(1);
          expect(JSON.stringify(report)).not.toContain('synthetic-calendar');
          expect((await ref.get()).data()).toEqual({ ...valid, ...patch });
        }
        await ref.set(valid);
        expect(await rotateAccountCredentials(db, rootId, active, { apply: true })).toMatchObject({
          current: 3,
          migrated: 0,
        });
        const applied = command(true);
        expect(applied.status).toBe(0);
        expect(JSON.parse(applied.stdout)).toMatchObject({
          mode: 'apply',
          current: 3,
          migrated: 0,
          failed: 0,
        });
        expect(applied.stderr + applied.stdout).not.toContain(next);
      } finally {
        await db.recursiveDelete(root);
        await getAuth(getServerApp()).deleteUser(user.uid);
        vi.unstubAllEnvs();
      }
    }, 120_000);
  },
);
