import { describe, expect, it } from 'vitest';
import { getServerFirestore } from '../../src/lib/server/firebase-config';

// Explicit hosted inference probe. Uses only the app's original synthetic demo,
// makes at most one budgeted generation, and deletes its disposable workspace.
describe.skipIf(process.env.SOMA_PRODUCTION_META_TEST !== 'true')(
  'hosted Spark practice and reuse',
  () => {
    it('persists a cited preview and reopens it without a second inference reservation', async () => {
      const base = new URL(
        process.env.SOMA_PRODUCTION_BASE_URL || 'https://soma-woad-beta.vercel.app',
      ).origin;
      if (!base.startsWith('https://')) throw new Error('Hosted Meta verification requires HTTPS.');
      let cookie = '';
      const call = (path: string, method = 'GET', body?: unknown, revision?: number) =>
        fetch(`${base}${path}`, {
          method,
          signal: AbortSignal.timeout(100_000),
          headers: {
            ...(cookie ? { Cookie: cookie } : {}),
            ...(method !== 'GET' ? { Origin: base, 'Content-Type': 'application/json' } : {}),
            ...(revision === undefined ? {} : { 'x-workspace-revision': String(revision) }),
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        });
      try {
        const response = await call('/api/workspace');
        expect(response.status).toBe(200);
        cookie = response.headers
          .getSetCookie()
          .map((value) => value.split(';')[0])
          .join('; ');
        const initial = await response.json();
        expect(initial.capabilities.spark).toBe(true);
        const request = {
          type: 'request-lesson',
          courseId: 'probability',
          topic:
            'Prepare original practice distinguishing independent events from equal probabilities using the course source.',
        };
        const generated = await call('/api/actions', 'POST', request, initial.workspace.revision);
        expect(generated.status).toBe(200);
        const first = await generated.json();
        const lesson = first.workspace.lessons.find(
          (item: { id: string }) => item.id === first.selectedLessonId,
        );
        if (!lesson)
          throw new Error(
            `Hosted preparation did not publish: ${first.notice || 'No notice'}. ${JSON.stringify(first.workspace.runs.filter((run: { mode: string; status: string }) => run.mode === 'live' && run.status !== 'completed').map((run: { steps: string[] }) => run.steps))}`,
          );
        expect(lesson).toMatchObject({
          kind: 'practice',
          mode: 'live',
          examEligible: false,
          validation: { status: 'development-preview' },
        });
        expect(lesson.supportingPassages.length).toBeGreaterThan(0);
        expect(first.workspace.attempts).toHaveLength(0);
        const secondResponse = await call(
          '/api/actions',
          'POST',
          request,
          first.workspace.revision,
        );
        expect(secondResponse.status).toBe(200);
        const second = await secondResponse.json();
        expect(second.selectedLessonId).toBe(lesson.id);
        expect(
          second.workspace.lessons.filter((item: { id: string }) => item.id === lesson.id),
        ).toHaveLength(1);
        expect(second.workspace.runs[0]).toMatchObject({ status: 'unchanged', mode: 'prepared' });
        const reservations = await getServerFirestore()
          .collection('somaBudgetReservations')
          .where('workspaceId', '==', initial.workspace.id)
          .get();
        expect(reservations.size).toBe(1);
        expect(reservations.docs[0].get('charged')).toBeGreaterThan(0);
      } finally {
        if (cookie) expect((await call('/api/workspace', 'DELETE')).status).toBe(200);
      }
    }, 120_000);
  },
);
