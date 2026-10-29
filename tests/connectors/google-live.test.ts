import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { ACCOUNT_SESSION_COOKIE, exchangeAccountSession, verifyAccountSession, type VerifiedAccount } from '../../src/lib/server/account';
import { readAccountWorkspace, readOrCreateAccountWorkspace, updateAccountWorkspace } from '../../src/lib/server/account-store';
import { acquireConnectionLease, checkpointConnectionLease, connectionPublicationGuard, consumeConnectionState, createConnectionState, deleteConnection, listConnections, readConnection, releaseConnectionLease, saveConnection } from '../../src/lib/server/connectors/store';

// Real Firebase storage/auth check with original synthetic token strings.
// This test makes no Google OAuth exchange or mailbox/calendar request.
describe.skipIf(process.env.SOMA_CONNECTOR_LIVE_TEST !== 'true')('live encrypted connection ownership and state', () => {
  it('enforces one-use state, account isolation, encryption, leases and disconnect publication guards', async () => {
    const created: { uid: string; account?: VerifiedAccount }[] = [];
    try {
      for (let index = 0; index < 2; index++) {
        const email = `soma-connector-test-${randomUUID()}@example.invalid`;
        const password = randomBytes(24).toString('base64url');
        const user = await getAuth(getServerApp()).createUser({ email, password });
        const record: { uid: string; account?: VerifiedAccount } = { uid: user.uid }; created.push(record);
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password, returnSecureToken: true }), signal: AbortSignal.timeout(20_000) });
        if (!response.ok) throw new Error(`Synthetic sign-in failed (${response.status}).`);
        const body = await response.json() as { idToken: string };
        const session = await exchangeAccountSession(body.idToken);
        const account = await verifyAccountSession(new Request('https://soma.example', { headers: { cookie: `${ACCOUNT_SESSION_COOKIE}=${session.sessionCookie}` } }));
        if (!account) throw new Error('Synthetic session verification failed.'); record.account = account;
      }
      const accountA = created[0].account!; const accountB = created[1].account!;
      const a = await readOrCreateAccountWorkspace(accountA); await readOrCreateAccountWorkspace(accountB);
      const state = await createConnectionState(accountA, a.id, { provider: 'gmail', verifier: 'original-synthetic-pkce-fixture' });
      await expect(consumeConnectionState(accountB, state)).rejects.toMatchObject({ code: 'oauth_state' });
      expect(await consumeConnectionState(accountA, state)).toEqual({ provider: 'gmail', verifier: 'original-synthetic-pkce-fixture' });
      await expect(consumeConnectionState(accountA, state)).rejects.toMatchObject({ code: 'oauth_state' });
      const root = getServerFirestore().collection('somaAccounts').doc(createHash('sha256').update(accountA.uid).digest('hex'));
      const expiring = await createConnectionState(accountA, a.id, { provider: 'calendar', verifier: 'original-expiry-fixture' });
      const expiryRef = root.collection('connectionStates').doc(createHash('sha256').update(expiring).digest('hex'));
      await expiryRef.update({ expiresAt: 0 });
      await expect(consumeConnectionState(accountA, expiring)).rejects.toMatchObject({ code: 'oauth_state' });
      expect((await expiryRef.get()).exists).toBe(false);
      await saveConnection(accountA, a.id, 'google-gmail', { provider: 'gmail', configuration: {}, status: 'connected', secret: { refreshToken: 'original-synthetic-refresh-fixture' } }, 0);
      await root.collection('connections').doc('google-gmail').update({internalFutureSecret:'synthetic-future-secret-canary'});
      const raw = await root.collection('connections').doc('google-gmail').get();
      expect(JSON.stringify(raw.data()).includes('original-synthetic-refresh-fixture')).toBe(false);
      expect(await readConnection(accountB, 'google-gmail')).toBeNull();
      expect(JSON.stringify(await listConnections(accountA)).includes('refreshToken')).toBe(false);
      expect(JSON.stringify(await listConnections(accountA))).not.toContain('synthetic-future-secret-canary');
      expect(JSON.stringify(await readConnection(accountA,'google-gmail'))).not.toContain('synthetic-future-secret-canary');
      const lease = await acquireConnectionLease(accountA, 'google-gmail', 'synthetic-read');
      await expect(saveConnection(accountA,a.id,'google-gmail',{provider:'gmail',configuration:{},status:'connected',secret:{refreshToken:'stale-synthetic-token'}},1)).rejects.toMatchObject({code:'connection_busy'});
      await expect(acquireConnectionLease(accountA, 'google-gmail', 'second-read')).rejects.toMatchObject({ code: 'connection_busy' });
      expect(await checkpointConnectionLease(accountA, 'google-gmail', lease.leaseId, { secret: { refreshToken: 'original-synthetic-updated-fixture' } })).toBe(true);
      expect((await readConnection(accountA, 'google-gmail'))?.secret.refreshToken).toBe('original-synthetic-updated-fixture');
      await deleteConnection(accountA, 'google-gmail');
      expect((await readConnection(accountA, 'google-gmail'))?.secret).toEqual({});
      expect(await releaseConnectionLease(accountA, 'google-gmail', lease.leaseId, { status: 'current' })).toBe(false);
      await expect(updateAccountWorkspace(accountA, workspace => { workspace.preferences.sessionMinutes = 90; return workspace; }, a.revision, connectionPublicationGuard(accountA, 'google-gmail', lease.leaseId))).rejects.toMatchObject({ code: 'connection_changed' });
      expect((await readAccountWorkspace(accountA))?.preferences.sessionMinutes).toBe(a.preferences.sessionMinutes);
    } finally {
      for (const record of created) {
        const root = getServerFirestore().collection('somaAccounts').doc(createHash('sha256').update(record.uid).digest('hex'));
        await getServerFirestore().recursiveDelete(root); await getAuth(getServerApp()).deleteUser(record.uid);
      }
    }
  }, 120_000);
});
