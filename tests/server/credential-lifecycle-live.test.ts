import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { describe, it, expect } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import {
  exchangeAccountSession,
  verifyAccountSession,
  ACCOUNT_SESSION_COOKIE,
  type VerifiedAccount,
} from '../../src/lib/server/account';
import {
  readAccountWorkspace,
  readOrCreateAccountWorkspace,
  deleteAccountWorkspace,
  updateAccountWorkspace,
} from '../../src/lib/server/account-store';
import {
  saveConnection,
  readConnection,
  acquireConnectionLease,
  releaseConnectionLease,
  connectionsForDeletion,
  createConnectionState,
  consumeConnectionState,
} from '../../src/lib/server/connectors/store';

// Real Firebase auth/transactions; original synthetic secrets only. No institutional,
// Google, Browserbase or model calls. Provider cleanup failure is deliberately injected.
describe.skipIf(process.env.SOMA_CREDENTIAL_LIVE_TEST !== 'true')(
  'credential deletion transaction and recovery',
  () => {
    it('freezes reconnects before cleanup, retains failed cleanup and isolates account generations', async () => {
      const users: { uid: string; account?: VerifiedAccount }[] = [];
      try {
        for (let i = 0; i < 2; i++) {
          const email = `soma-credential-edge-${randomUUID()}@example.invalid`,
            password = randomBytes(24).toString('base64url');
          const user = await getAuth(getServerApp()).createUser({ email, password }),
            record: { uid: string; account?: VerifiedAccount } = { uid: user.uid };
          users.push(record);
          const response = await fetch(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
            {
              method: 'POST',
              headers: { 'content-type': 'application/json' },
              body: JSON.stringify({ email, password, returnSecureToken: true }),
              signal: AbortSignal.timeout(20_000),
            },
          );
          if (!response.ok) throw new Error('Synthetic sign-in failed.');
          const session = await exchangeAccountSession((await response.json()).idToken);
          record.account = (await verifyAccountSession(
            new Request('https://soma.example', {
              headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${session.sessionCookie}` },
            }),
          ))!;
          expect(record.account).toBeTruthy();
        }
        const account = users[0].account!,
          other = users[1].account!,
          workspace = await readOrCreateAccountWorkspace(account),
          otherWorkspace = await readOrCreateAccountWorkspace(other);
        const root = () =>
          getServerFirestore()
            .collection('somaAccounts')
            .doc(createHash('sha256').update(account.uid).digest('hex'));
        const input = {
          provider: 'blackboard',
          status: 'connected' as const,
          configuration: { targets: [] },
          secret: { contextId: 'original-fake-context-for-deletion' },
        };
        await saveConnection(account, workspace.id, 'browser-blackboard', input, 0);
        await saveConnection(
          account,
          workspace.id,
          'google-gmail',
          {
            provider: 'gmail',
            status: 'connected',
            configuration: {},
            secret: { refreshToken: 'original-synthetic-canary' },
          },
          0,
        );
        const state = await createConnectionState(account, workspace.id, {
          verifier: 'original-synthetic-verifier',
        });
        const lease = await acquireConnectionLease(
          account,
          'browser-blackboard',
          'synthetic-active-operation',
        );
        let callbacks = 0;
        const cleanup = async () => {
          callbacks++;
        };
        await expect(deleteAccountWorkspace(account, cleanup)).rejects.toMatchObject({
          code: 'connection_busy',
        });
        expect(callbacks).toBe(0);
        await root().collection('connections').doc('browser-blackboard').update({ leaseUntil: 0 });
        await expect(deleteAccountWorkspace(account, cleanup)).rejects.toMatchObject({
          code: 'connection_busy',
        });
        expect(await releaseConnectionLease(account, 'browser-blackboard', lease.leaseId)).toBe(
          true,
        );
        await expect(deleteAccountWorkspace(account)).rejects.toMatchObject({
          code: 'source_cleanup_required',
        });
        let entered!: () => void, release!: () => void;
        const entry = new Promise<void>((r) => (entered = r)),
          gate = new Promise<void>((r) => (release = r));
        const deletion = deleteAccountWorkspace(account, async (generation) => {
          expect(generation).toBe(workspace.id);
          const pending = await connectionsForDeletion(account, generation);
          expect(pending).toHaveLength(1);
          expect(pending[0].secret).toEqual(input.secret);
          entered();
          await gate;
          throw new Error('Injected remote cleanup failure');
        });
        await entry;
        expect(await readAccountWorkspace(account)).toBeNull();
        await expect(readOrCreateAccountWorkspace(account)).rejects.toMatchObject({
          code: 'deletion_pending',
        });
        await expect(
          saveConnection(account, workspace.id, 'browser-blackboard', input),
        ).rejects.toMatchObject({ code: 'workspace_changed' });
        await expect(
          acquireConnectionLease(account, 'browser-blackboard', 'racing-reconnect'),
        ).rejects.toMatchObject({ code: 'workspace_changed' });
        await expect(consumeConnectionState(account, state)).rejects.toMatchObject({
          code: 'workspace_changed',
        });
        await expect(updateAccountWorkspace(account, (value) => value)).rejects.toMatchObject({
          code: 'workspace_missing',
        });
        await expect(connectionsForDeletion(other, workspace.id)).rejects.toMatchObject({
          code: 'workspace_changed',
        });
        release();
        await expect(deletion).rejects.toThrow('Injected remote cleanup failure');
        await deleteApp(getServerApp());
        expect((await root().get()).get('deleted')).toBe(true);
        expect((await root().get()).get('deletionComplete')).not.toBe(true);
        expect(
          JSON.stringify(
            (await root().collection('connections').get()).docs.map((doc) => doc.data()),
          ),
        ).not.toContain('original-synthetic-canary');
        const retained = await connectionsForDeletion(account, workspace.id);
        expect(retained[0].secret).toEqual(input.secret);
        await deleteAccountWorkspace(account, async (generation) => {
          expect(await connectionsForDeletion(account, generation)).toHaveLength(1);
        });
        expect((await root().collection('connections').get()).empty).toBe(true);
        expect((await root().collection('connectionStates').get()).empty).toBe(true);
        const recreated = await readOrCreateAccountWorkspace(account);
        expect(recreated.id).not.toBe(workspace.id);
        await expect(connectionsForDeletion(account, workspace.id)).rejects.toMatchObject({
          code: 'workspace_changed',
        });
        await expect(
          saveConnection(account, workspace.id, 'browser-blackboard', input),
        ).rejects.toMatchObject({ code: 'workspace_changed' });
        expect(await readConnection(account, 'browser-blackboard')).toBeNull();
        expect(await readAccountWorkspace(other)).toEqual(otherWorkspace);
      } finally {
        for (const user of users) {
          await getServerFirestore().recursiveDelete(
            getServerFirestore()
              .collection('somaAccounts')
              .doc(createHash('sha256').update(user.uid).digest('hex')),
          );
          await getAuth(getServerApp()).deleteUser(user.uid);
        }
      }
    }, 120_000);
  },
);
