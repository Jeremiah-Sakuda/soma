import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, it } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyAccountSession } from '../../src/lib/server/account';
import {
  acquireConnectionLease,
  readConnection,
  releaseConnectionLease,
} from '../../src/lib/server/connectors/store';

// Opt-in real hosted lifecycle with one deliberately fictional Firebase identity.
// This NEVER submits a password to BU or stores an institutional credential.
// Public application routes create/lease/clean all browser resources normally.
const enabled = process.env.SOMA_LIVE_CREDENTIAL_HOSTED_TEST === 'true';
const ensure = (condition: unknown, message: string) => {
  if (!condition) throw new Error(message);
};
function origin(value: string | undefined, suffix: string) {
  const parsed = new URL(value ?? '');
  ensure(
    parsed.protocol === 'https:' &&
      parsed.origin === value &&
      !parsed.port &&
      !parsed.username &&
      !parsed.password &&
      parsed.hostname.endsWith(suffix),
    'Hosted fixture origin configuration is invalid.',
  );
  return parsed.origin;
}
describe.skipIf(!enabled)(
  'hosted credential lifecycle — disposable original synthetic identity',
  () => {
    it('checks delayed entry after 25 seconds idle, real callback, one-use exchange and normal cancellation without provider credentials', async () => {
      ensure(
        !process.env.FIREBASE_AUTH_EMULATOR_HOST && !process.env.FIRESTORE_EMULATOR_HOST,
        'Hosted fixture requires managed Firebase.',
      );
      const uid = process.env.SOMA_CREDENTIAL_TEST_UID ?? '';
      ensure(
        /^soma-credential-hosted-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
          uid,
        ),
        'Declare the dedicated synthetic hosted fixture UID before configuring the rollout allowlist.',
      );
      const appOrigin = origin(process.env.SOMA_CREDENTIAL_TEST_APP_ORIGIN, '.vercel.app'),
        loginOrigin = origin(process.env.SOMA_CREDENTIAL_RUNNER_URL, '.run.app');
      ensure(
        typeof process.env.NEXT_PUBLIC_FIREBASE_API_KEY === 'string',
        'Firebase public client configuration is required.',
      );
      const auth = getAuth(getServerApp()),
        root = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(uid).digest('hex'));
      let exists = false;
      try {
        await auth.getUser(uid);
        exists = true;
      } catch (error) {
        if ((error as { code?: string }).code !== 'auth/user-not-found')
          throw new Error('Cannot verify synthetic account absence.');
      }
      ensure(
        !exists && !(await root.get()).exists,
        'Synthetic fixture UID already exists; recover it explicitly before rerunning.',
      );
      const password = randomBytes(32).toString('base64url'),
        email = `${uid}@bu.edu`;
      let created = false,
        appCookie = '',
        sessionPath = '',
        humanCookie = '',
        entryToken = '',
        cleanupConfirmed = false;
      const checks: string[] = [];
      const request = async (
        path: string,
        {
          method = 'GET',
          body,
          cookie = appCookie,
          service = false,
        }: { method?: string; body?: unknown; cookie?: string; service?: boolean } = {},
      ) => {
        try {
          return await fetch((service ? loginOrigin : appOrigin) + path, {
            method,
            headers: {
              origin: service ? loginOrigin : appOrigin,
              ...(cookie ? { cookie } : {}),
              ...(body === undefined ? {} : { 'content-type': 'application/json' }),
            },
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            cache: 'no-store',
            redirect: 'error',
            signal: AbortSignal.timeout(90_000),
          });
        } catch {
          throw new Error('Hosted fixture request could not complete.');
        }
      };
      const decode = async (response: Response) => {
        const text = await response.text();
        ensure(text.length < 128 * 1024, 'Hosted fixture response exceeded its bound.');
        try {
          return JSON.parse(text);
        } catch {
          throw new Error('Hosted fixture returned invalid JSON.');
        }
      };
      const signIn = async () => {
        const response = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
            redirect: 'error',
            signal: AbortSignal.timeout(15_000),
          },
        );
        ensure(response.ok, 'Fictional Firebase sign-in failed.');
        const value = await decode(response);
        ensure(typeof value.idToken === 'string', 'Fictional Firebase token is missing.');
        const session = await request('/api/auth/session', {
          method: 'POST',
          body: { idToken: value.idToken },
          cookie: '',
        });
        ensure(session.ok, 'Hosted app session exchange failed.');
        const header = session.headers.get('set-cookie');
        ensure(header?.includes('HttpOnly'), 'Hosted account cookie is not protected.');
        appCookie = header!.split(';')[0];
        const result = await decode(session);
        ensure(
          result.authenticated === true && result.uid === uid,
          'Hosted app returned a foreign identity.',
        );
      };
      const action = async (actionName: 'open' | 'cancel' | 'forget') =>
        request('/api/connectors/credentials', {
          method: 'POST',
          body: { provider: 'blackboard', action: actionName },
        });
      try {
        await auth.createUser({ uid, email, password });
        created = true;
        await signIn();
        checks.push('fictional-account-public-session');
        const workspaceResponse = await request('/api/workspace');
        ensure(workspaceResponse.ok, 'Hosted private workspace creation failed.');
        const workspace = await decode(workspaceResponse);
        ensure(
          workspace.workspace?.mode === 'account' && typeof workspace.workspace?.id === 'string',
          'Hosted fixture entered a demo workspace.',
        );
        ensure(
          workspace.workspace.sources?.length === 0,
          'Fictional workspace unexpectedly contains source data.',
        );
        const configured = await request('/api/connectors/browser', {
          method: 'POST',
          body: { provider: 'blackboard', action: 'configure', targets: [] },
        });
        ensure(configured.ok, 'Normal hosted browser configuration failed.');
        checks.push('empty-private-workspace-and-normal-context-path');
        const availability = await request('/api/connectors/credentials');
        ensure(availability.ok, 'Hosted rollout availability failed.');
        const availabilityBody = await decode(availability);
        ensure(
          availabilityBody.configured === true &&
            availabilityBody.providers?.[0]?.available === true,
          'Synthetic UID is not enabled by the hosted rollout gate.',
        );
        checks.push('synthetic-uid-rollout-enabled');
        const opened = await action('open');
        ensure(
          opened.ok,
          'Hosted isolated login allocation failed; cleanup reference must be inspected.',
        );
        const data = await decode(opened);
        let entry: URL;
        try {
          entry = new URL(data.loginUrl);
        } catch {
          throw new Error('Hosted login capability is invalid.');
        }
        ensure(
          entry.origin === loginOrigin &&
            /^\/login\/[a-f0-9-]{36}$/.test(entry.pathname) &&
            /^#[A-Za-z0-9_-]{43}$/.test(entry.hash) &&
            !entry.search,
          'Hosted login capability failed origin/session binding.',
        );
        sessionPath = entry.pathname;
        entryToken = entry.hash.slice(1);
        checks.push('real-app-callback-and-isolated-allocation');
        // Leave the isolated service untouched across its periodic session sweep.
        // A healthy idle session must survive until the human first opens its link.
        ensure(
          Number.isFinite(Date.parse(data.expiresAt)) &&
            Date.parse(data.expiresAt) > Date.now() + 25000,
          'Hosted entry did not have enough lifetime for its idle-entry regression.',
        );
        await new Promise((resolve) => setTimeout(resolve, 25000));
        ensure(
          Date.parse(data.expiresAt) > Date.now(),
          'Hosted entry expired before its delayed bootstrap.',
        );
        const bootstrap = await request(sessionPath + '/bootstrap', {
          method: 'POST',
          body: { token: entryToken },
          cookie: '',
          service: true,
        });
        ensure(
          bootstrap.ok,
          'Hosted one-use bootstrap failed after 25 seconds without service activity.',
        );
        const viewerHeader = bootstrap.headers.get('set-cookie');
        ensure(
          viewerHeader?.includes('HttpOnly') &&
            viewerHeader.includes('Secure') &&
            viewerHeader.includes('SameSite=Strict'),
          'Hosted credential cookie is not protected.',
        );
        humanCookie = viewerHeader!.split(';')[0];
        const bootstrapBody = await decode(bootstrap);
        ensure(
          bootstrapBody.phase === 'ready' && bootstrapBody.credential?.status === 'empty',
          'Delayed fictional login unexpectedly ended or contains a stored credential.',
        );
        checks.push('25-second-idle-entry-one-use-exchange-and-empty-private-vault');
        const replay = await request(sessionPath + '/bootstrap', {
          method: 'POST',
          body: { token: entryToken },
          cookie: '',
          service: true,
        });
        ensure(replay.status === 401, 'Hosted entry capability replay was accepted.');
        entryToken = '';
        checks.push('entry-replay-rejected');
        const status = await request(sessionPath + '/status', {
          method: 'POST',
          body: {},
          cookie: humanCookie,
          service: true,
        });
        ensure(
          status.ok && (await decode(status)).phase === 'ready',
          'Hosted scoped status check failed.',
        );
        // Cross the auth_time second deliberately, so revocation cannot compare equal.
        await new Promise((resolve) => setTimeout(resolve, 1100));
        await auth.revokeRefreshTokens(uid);
        const revoked = await request(sessionPath + '/status', {
          method: 'POST',
          body: {},
          cookie: humanCookie,
          service: true,
        });
        ensure(
          [401, 403, 404].includes(revoked.status),
          'Revoked Firebase identity retained hosted login access.',
        );
        checks.push('firebase-revocation-denies-live-session');
        await signIn();
        const cancelled = await action('cancel');
        ensure(cancelled.ok, 'Normal hosted cancellation did not confirm cleanup.');
        checks.push('normal-public-api-cancel-recovery');
        const after = await request('/api/connectors/credentials');
        ensure(after.ok, 'Hosted status after cancellation failed.');
        const afterBody = await decode(after);
        ensure(
          !afterBody.providers?.[0]?.active,
          'Hosted cleanup left a pending credential session.',
        );
        // Original synthetic regression for an established account: its context was
        // created by the public flow above, but an old manual reference survived a
        // page reload. Seed only this fictional account under its real store lease.
        const fixtureAccount = await verifyAccountSession(
          new Request(appOrigin, { headers: { cookie: appCookie } }),
        );
        if (!fixtureAccount)
          throw new Error('Synthetic fixture account could not be verified for its lease.');
        const leased = await acquireConnectionLease(
          fixtureAccount,
          'browser-blackboard',
          'synthetic-expired-manual-fixture',
        );
        const originalContext = leased.connection.secret.contextId,
          originalConfiguration = JSON.stringify(leased.connection.configuration),
          expiredId = randomUUID();
        ensure(
          leased.connection.secret.backend === 'gcp' &&
            typeof originalContext === 'string' &&
            !leased.connection.secret.credentialLogin &&
            !leased.connection.secret.sessionId,
          'Synthetic established context is not ready for its isolated regression.',
        );
        const seeded = {
          ...leased.connection.secret,
          sessionId: expiredId,
          sessionExpiresAt: new Date(Date.now() - 60000).toISOString(),
        };
        ensure(
          await releaseConnectionLease(fixtureAccount, 'browser-blackboard', leased.leaseId, {
            secret: seeded,
            status: 'connecting',
            notice: 'Original synthetic expired manual-session recovery fixture.',
          }),
          'Synthetic manual reference could not be checkpointed.',
        );
        const beforeRecovery = await readConnection(fixtureAccount, 'browser-blackboard');
        if (!beforeRecovery) throw new Error('Synthetic seeded connection disappeared.');
        ensure(
          beforeRecovery.secret.contextId === originalContext &&
            JSON.stringify(beforeRecovery.configuration) === originalConfiguration,
          'Synthetic seed changed its context or course selections.',
        );
        const reopened = await action('open');
        ensure(reopened.ok, 'Established-account expired manual-session recovery failed.');
        const recoveryData = await decode(reopened);
        let recoveredEntry: URL;
        try {
          recoveredEntry = new URL(recoveryData.loginUrl);
        } catch {
          throw new Error('Recovered hosted capability is invalid.');
        }
        ensure(
          recoveredEntry.origin === loginOrigin &&
            /^\/login\/[a-f0-9-]{36}$/.test(recoveredEntry.pathname) &&
            /^#[A-Za-z0-9_-]{43}$/.test(recoveredEntry.hash) &&
            !recoveredEntry.search,
          'Recovered hosted capability failed its binding.',
        );
        const recovered = await readConnection(fixtureAccount, 'browser-blackboard');
        if (!recovered) throw new Error('Synthetic recovered connection disappeared.');
        ensure(
          recovered.secret.contextId === originalContext &&
            JSON.stringify(recovered.configuration) === originalConfiguration &&
            !recovered.secret.sessionId &&
            !recovered.secret.sessionExpiresAt &&
            !!recovered.secret.credentialLogin,
          'Expired manual recovery lost configuration, changed context or retained the obsolete session.',
        );
        const recoveryBootstrap = await request(recoveredEntry.pathname + '/bootstrap', {
          method: 'POST',
          body: { token: recoveredEntry.hash.slice(1) },
          cookie: '',
          service: true,
        });
        ensure(
          recoveryBootstrap.ok && (await decode(recoveryBootstrap)).phase === 'ready',
          'Recovered session did not pass its real hosted callback and one-use entry.',
        );
        const recoveryCancel = await action('cancel');
        ensure(recoveryCancel.ok, 'Recovered hosted session cleanup failed.');
        checks.push('original-synthetic-expired-manual-reference-recovered-through-public-api');
      } finally {
        if (created) {
          // Never destroy encrypted cleanup references before the public cleanup path
          // confirms success. An incomplete run retains the known synthetic UID for
          // operator recovery rather than hiding an orphan by deleting its records.
          try {
            await signIn();
            const availability = await request('/api/connectors/credentials');
            ensure(availability.ok, 'Cannot inspect fixture cleanup references.');
            const state = await decode(availability);
            if (state.providers?.[0]?.active) {
              const cancelled = await action('cancel');
              ensure(cancelled.ok, 'Fixture cancellation needs operator recovery.');
            }
            const forgotten = await action('forget');
            ensure(forgotten.ok, 'Fixture vault cleanup needs operator recovery.');
            const removed = await request('/api/workspace', { method: 'DELETE' });
            ensure(removed.ok, 'Fixture workspace cleanup needs operator recovery.');
            const metadata = await root.get();
            ensure(
              !metadata.exists ||
                (metadata.get('ownerId') === uid &&
                  metadata.get('deleted') === true &&
                  metadata.get('deletionComplete') === true),
              'Fixture workspace deletion was not confirmed.',
            );
            if (metadata.exists) await root.delete();
            await auth.deleteUser(uid);
            cleanupConfirmed = true;
          } catch {
            throw new Error(
              'Hosted synthetic fixture cleanup is incomplete. Retain its configured UID and recover its normal app cleanup before removing Auth or Firestore records.',
            );
          }
        }
        appCookie = '';
        humanCookie = '';
        entryToken = '';
        ensure(!created || cleanupConfirmed, 'Hosted synthetic fixture cleanup was not confirmed.');
      }
      checks.push('normal-public-api-workspace-cleanup-confirmed');
      console.log(
        JSON.stringify({
          mode: 'hosted-original-synthetic-credential-lifecycle',
          checks,
          cleanupConfirmed,
          providerPasswordSubmitted: false,
          institutionalCredentialStored: false,
          authStateExportVerified: false,
        }),
      );
    }, 180000);
  },
);
