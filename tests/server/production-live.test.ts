import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';

// Deliberate production API verification only. Creates and removes one original
// synthetic account; never invokes inference or uploads real student material.
describe.skipIf(process.env.SOMA_PRODUCTION_HTTP_TEST !== 'true')(
  'production account HTTP boundaries',
  () => {
    it('signs in, persists an idempotent import and queued job, then deletes the workspace', async () => {
      const base = new URL(
        process.env.SOMA_PRODUCTION_BASE_URL || 'https://soma-woad-beta.vercel.app',
      ).origin;
      if (!base.startsWith('https://')) throw new Error('Production verification requires HTTPS.');
      const email = `soma-production-check-${randomUUID()}@example.invalid`;
      const password = randomBytes(24).toString('base64url');
      let uid: string | undefined;
      let cookie = '';
      const call = async (path: string, method = 'GET', body?: unknown, origin = base) =>
        fetch(`${base}${path}`, {
          method,
          signal: AbortSignal.timeout(30_000),
          headers: {
            ...(cookie ? { cookie } : {}),
            ...(method !== 'GET' ? { origin, 'content-type': 'application/json' } : {}),
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        });
      const read = async (response: Response, expectedStatus: number, stage: string) => {
        if (response.status !== expectedStatus)
          throw new Error(`${stage} returned HTTP ${response.status}, expected ${expectedStatus}.`);
        return response.json() as Promise<Record<string, any>>;
      };
      try {
        const user = await getAuth(getServerApp()).createUser({ email, password });
        uid = user.uid;
        const signIn = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${process.env.NEXT_PUBLIC_FIREBASE_API_KEY}`,
          {
            method: 'POST',
            signal: AbortSignal.timeout(30_000),
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ email, password, returnSecureToken: true }),
          },
        );
        const credentials = await read(signIn, 200, 'Synthetic Firebase sign-in');
        const session = await call('/api/auth/session', 'POST', { idToken: credentials.idToken });
        const status = await read(session, 200, 'Production session exchange');
        expect(status.authenticated).toBe(true);
        expect(status.accountWorkspaceAvailable).toBe(true);
        const setCookie = session.headers.get('set-cookie') || '';
        const value = setCookie.match(/(?:^|,\s*)soma_account=([^;]+)/)?.[1];
        if (!value) throw new Error('Production exchange did not issue an account cookie.');
        expect(/httponly/i.test(setCookie)).toBe(true);
        expect(/secure/i.test(setCookie)).toBe(true);
        cookie = `soma_account=${value}`;
        const initial = await read(await call('/api/workspace'), 200, 'Private workspace creation');
        expect(initial.workspace.mode).toBe('account');
        expect(initial.workspace.sources).toHaveLength(0);
        expect(initial.workspace.lessons).toHaveLength(0);
        if (process.env.SOMA_PRODUCTION_CONNECTOR_TEST === 'true') {
          const google = await read(
            await call('/api/connectors/google/status'),
            200,
            'Google connector configuration',
          );
          expect(google.configured).toBe(true);
          expect(google.connections).toEqual([]);
          await read(
            await call(
              '/api/connectors/google/start',
              'POST',
              { provider: 'gmail' },
              'https://cross-origin.example',
            ),
            403,
            'Google cross-origin rejection',
          );
          const start = await read(
            await call('/api/connectors/google/start', 'POST', { provider: 'gmail' }),
            200,
            'Google authorization state creation',
          );
          const authorization = new URL(start.authorizationUrl);
          expect(authorization.origin).toBe('https://accounts.google.com');
          expect(authorization.searchParams.get('redirect_uri')).toBe(
            `${base}/api/connectors/google/callback`,
          );
          expect(authorization.searchParams.get('scope')).toBe(
            'https://www.googleapis.com/auth/gmail.readonly',
          );
          expect(authorization.searchParams.get('code_challenge_method')).toBe('S256');
          expect(authorization.searchParams.has('client_secret')).toBe(false);
          const browser = await read(
            await call('/api/connectors/browser'),
            200,
            'Browser connector configuration',
          );
          if (!browser.configured)
            await read(
              await call('/api/connectors/browser', 'POST', {
                provider: 'blackboard',
                action: 'start',
              }),
              503,
              'Unconfigured browser rejection',
            );
        }
        const input = {
          importId: 'production-synthetic-import-1',
          expectedRevision: initial.workspace.revision,
          kind: 'course-text',
          sourceKey: 'production-synthetic-course-source',
          title: 'Original synthetic parallel resistor notes',
          text: 'Original synthetic verification source: in an ideal DC parallel network, each resistor has the same voltage as the ideal source. Branch currents follow I = V / R. This is test material, not a private course document.',
          course: {
            id: 'synthetic-course',
            code: 'TEST101',
            title: 'Original synthetic circuit course',
          },
        };
        expect(
          (await call('/api/imports', 'POST', input, 'https://untrusted.example')).status,
        ).toBe(403);
        const imported = await read(
          await call('/api/imports', 'POST', input),
          200,
          'Production manual import',
        );
        expect(imported.workspace.sources).toHaveLength(1);
        expect(imported.workspace.sources[0].origin).toBe('manual-import');
        expect(imported.workspace.importReceipts).toHaveLength(1);
        const retry = await read(
          await call('/api/imports', 'POST', input),
          200,
          'Production import retry',
        );
        expect(retry.workspace.sources).toHaveLength(1);
        expect(retry.workspace.importReceipts).toHaveLength(1);
        const saved = await read(await call('/api/workspace'), 200, 'Production read-back');
        expect(saved.workspace.id).toBe(initial.workspace.id);
        expect(saved.workspace.sources).toHaveLength(1);
        const jobs = await read(await call('/api/jobs'), 200, 'Production job read-back');
        expect(jobs.jobs).toHaveLength(1);
        expect(jobs.jobs[0].status).toBe('queued');
        expect(jobs.jobs[0].attempts).toBe(0);
        expect(jobs.scheduling).toBe('explicit-worker');
        const deleted = await read(
          await call('/api/workspace', 'DELETE'),
          200,
          'Production workspace deletion',
        );
        expect(deleted.deleted).toBe(true);
        const root = getServerFirestore()
          .collection('somaAccounts')
          .doc(createHash('sha256').update(uid).digest('hex'));
        expect((await root.collection('sources').get()).empty).toBe(true);
        expect((await root.collection('jobs').get()).empty).toBe(true);
        expect((await root.get()).get('deletionComplete')).toBe(true);
      } finally {
        if (uid) {
          const root = getServerFirestore()
            .collection('somaAccounts')
            .doc(createHash('sha256').update(uid).digest('hex'));
          await getServerFirestore().recursiveDelete(root);
          await getAuth(getServerApp()).deleteUser(uid);
        }
      }
    }, 180_000);
  },
);
