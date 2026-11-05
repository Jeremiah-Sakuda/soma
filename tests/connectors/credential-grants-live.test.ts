import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import {
  exchangeAccountSession,
  verifyAccountSession,
  ACCOUNT_SESSION_COOKIE,
  recentAccountAuthentication,
} from '../../src/lib/server/account';
import {
  readOrCreateAccountWorkspace,
  deleteAccountWorkspace,
} from '../../src/lib/server/account-store';
import { configureBrowser } from '../../src/lib/server/connectors/browser';
import {
  acquireConnectionLease,
  releaseConnectionLease,
} from '../../src/lib/server/connectors/store';
import {
  authorizeCredentialGrant,
  createCredentialAuthorization,
  revokeCredentialAuthorization,
  type CredentialGrant,
} from '../../src/lib/server/connectors/credential-grants';
import { POST as credentialAction } from '../../src/app/api/connectors/credentials/route';

// Disposable fictional Auth identities only. No mail, browser, course or model calls.
describe.skipIf(process.env.SOMA_LIVE_FIRESTORE_TEST !== 'true')(
  'managed credential authorization fencing',
  () => {
    it('enforces real transactions, revocation, disabled users and frozen generations', async () => {
      if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST)
        throw new Error('Managed fixture requires real Firebase.');
      const auth = getAuth(getServerApp()),
        email = `soma-vault-fixture-${randomUUID()}@bu.edu`,
        password = randomBytes(24).toString('base64url');
      const user = await auth.createUser({ email, password });
      let account: Awaited<ReturnType<typeof verifyAccountSession>> = null;
      let leaseId: string | undefined;
      try {
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
          },
        );
        if (!response.ok) throw new Error('Original synthetic sign-in failed.');
        const { idToken } = (await response.json()) as { idToken: string },
          session = await exchangeAccountSession(idToken);
        account = await verifyAccountSession(
          new Request('https://soma.example', {
            headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${session.sessionCookie}` },
          }),
        );
        if (!account) throw new Error('Original synthetic session failed.');
        const rejectedSecret = await credentialAction(
          new Request('https://soma.example/api/connectors/credentials', {
            method: 'POST',
            headers: {
              origin: 'https://soma.example',
              'content-type': 'application/json',
              cookie: `${ACCOUNT_SESSION_COOKIE}=${session.sessionCookie}`,
            },
            body: JSON.stringify({ provider: 'blackboard', action: 'open', password }),
          }),
        );
        expect(rejectedSecret.status).toBe(400);
        expect(await rejectedSecret.text()).not.toContain(password);
        const workspace = await readOrCreateAccountWorkspace(account);
        await configureBrowser(account, 'blackboard', []);
        const leased = await acquireConnectionLease(
          account,
          'browser-blackboard',
          'credential-fixture',
        );
        leaseId = leased.leaseId;
        const grant: CredentialGrant = {
          authorizationId: randomUUID(),
          uid: user.uid,
          owner: createHash('sha256').update(`${workspace.id}:browser-blackboard`).digest('hex'),
          workspaceId: workspace.id,
          workspaceGeneration: workspace.id,
          provider: 'blackboard',
          contextId: randomUUID(),
          connectionVersion: leased.connection.version,
          recentAuthAt: recentAccountAuthentication(account),
        };
        await createCredentialAuthorization(account, grant, leaseId);
        expect(await authorizeCredentialGrant(grant, 'credential')).toEqual({ identifier: email });
        const second = { ...grant, authorizationId: randomUUID() };
        await expect(createCredentialAuthorization(account, second, leaseId)).rejects.toMatchObject(
          { code: 'credential_authorization' },
        );
        for (const changed of [
          { workspaceId: randomUUID() },
          { owner: 'e'.repeat(64) },
          { contextId: randomUUID() },
          { connectionVersion: 2 },
        ])
          await expect(
            authorizeCredentialGrant({ ...grant, ...changed }, 'session'),
          ).rejects.toMatchObject({ code: 'credential_authorization' });
        await auth.updateUser(user.uid, { disabled: true });
        await expect(authorizeCredentialGrant(grant, 'session')).rejects.toMatchObject({
          code: 'credential_authorization',
        });
        await auth.updateUser(user.uid, { disabled: false });
        expect(await authorizeCredentialGrant(grant, 'session')).toEqual({ identifier: email });
        await revokeCredentialAuthorization(account, workspace.id, grant.authorizationId);
        await expect(authorizeCredentialGrant(grant, 'session')).rejects.toMatchObject({
          code: 'credential_authorization',
        });
        const root = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(user.uid).digest('hex'));
        const stored = (
          await root.collection('credentialLogins').doc(grant.authorizationId).get()
        ).data()!;
        expect(stored.active).toBe(false);
        expect(JSON.stringify(stored)).not.toContain(password);
        await root.update({ deleted: true });
        await expect(authorizeCredentialGrant(grant, 'session')).rejects.toMatchObject({
          code: 'credential_authorization',
        });
        await root.update({ deleted: false });
      } finally {
        if (account) {
          if (leaseId) await releaseConnectionLease(account, 'browser-blackboard', leaseId);
          await deleteAccountWorkspace(account, async () => undefined);
        }
        const root = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(user.uid).digest('hex'));
        await root.delete();
        await auth.deleteUser(user.uid);
      }
    }, 60000);
  },
);
