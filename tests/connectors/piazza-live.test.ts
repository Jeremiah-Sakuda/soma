import { createHash } from 'node:crypto';
import { getAuth } from 'firebase-admin/auth';
import { describe, expect, it } from 'vitest';
import { getServerApp, getServerFirestore } from '../../src/lib/server/firebase-config';
import { verifyWorkerAccount } from '../../src/lib/server/account';
import { verifyWorkerRequest } from '../../src/lib/server/worker-auth';
import { withBrowserRead, remainingReadTime } from '../../src/lib/server/connectors/browser';
import {
  canonicalPiazzaCourseUrl,
  isAllowedPiazzaRequest,
  filterPiazzaFall2026,
} from '../../src/lib/domain/piazza-navigation';
import { renderPiazzaCourse } from '../../src/lib/server/connectors/piazza-page';
import {
  readPiazzaCatalog,
  readPiazzaFeedPreviews,
} from '../../src/lib/server/connectors/piazza-materials';

async function scopedAccount() {
  if (!process.env.SOMA_PIAZZA_OWNER_EMAIL) throw new Error('Explicit owner scope required.');
  const user = await getAuth(getServerApp()).getUserByEmail(process.env.SOMA_PIAZZA_OWNER_EMAIL),
    rootId = createHash('sha256').update(user.uid).digest('hex');
  const metadata = (await getServerFirestore().collection('somaAccounts').doc(rootId).get()).data();
  const capability = verifyWorkerRequest(
    new Request('https://soma.example/api/internal/worker', {
      headers: { authorization: `Bearer ${process.env.SOMA_WORKER_SECRET}` },
    }),
  );
  const account = await verifyWorkerAccount(capability, rootId, metadata?.workspaceId);
  if (!account) throw new Error('Explicit account unavailable.');
  return account;
}

/** Opted-in access proof. No post is opened; no material publication or inference. */
describe.skipIf(process.env.SOMA_PIAZZA_LIVE_TEST !== 'true')(
  'authorized Piazza saved-session access',
  () => {
    it('verifies a selected class and reviewed public instructor-note previews', async () => {
      if (!process.env.SOMA_PIAZZA_TEST_CLASS_ID) throw new Error('Explicit class scope required.');
      const id = process.env.SOMA_PIAZZA_TEST_CLASS_ID,
        url = canonicalPiazzaCourseUrl(id),
        scripts = new Set<string>();
      const result = await withBrowserRead(
        await scopedAccount(),
        'piazza',
        (request) => isAllowedPiazzaRequest(request, [id], 'collect', [...scripts]),
        async ({ page, deadline }) => {
          const response = await page.goto(url, {
            waitUntil: 'domcontentloaded',
            timeout: remainingReadTime(deadline, 20_000),
          });
          expect(response?.ok()).toBe(true);
          await renderPiazzaCourse(page, deadline, (paths) =>
            paths.forEach((path) => scripts.add(path)),
          );
          let catalog;
          try {
            catalog = await readPiazzaCatalog(page, deadline);
          } catch (error) {
            const actual = new URL(page.url());
            process.stdout.write(
              JSON.stringify({
                sameOrigin: actual.origin === 'https://piazza.com',
                sameClassPath: actual.pathname === new URL(url).pathname,
                hasTrailingSlash: actual.pathname.endsWith('/'),
                queryKeys: [...actual.searchParams.keys()].map((key) =>
                  key === 'cid' ? 'cid' : '[other]',
                ),
                cidShape: actual.searchParams.has('cid')
                  ? /^[1-9][0-9]*$/.test(actual.searchParams.get('cid') ?? '')
                    ? 'positive-integer'
                    : '[other]'
                  : null,
                hasHash: !!actual.hash,
                code: (error as { code?: string }).code,
              }) + '\n',
            );
            throw error;
          }

          expect(catalog.some((course) => course.id === id)).toBe(true);
          const emptyHistoryDelimiter = /[?#]$/.test(page.url());
          const source = await readPiazzaFeedPreviews(
            page,
            { url, courseId: 'private-access-probe' },
            deadline,
          );
          expect(source.kind).toBe('piazza');
          expect(source.url).toBe(url);
          const rows = source.body
            .split('\n')
            .slice(1)
            .filter((line) => line.startsWith('{'))
            .map((line) => JSON.parse(line));
          for (const row of rows)
            expect(
              Object.keys(row).every((key) =>
                ['previewId', 'title', 'snippet', 'postNumber'].includes(key),
              ),
            ).toBe(true);
          return {
            value: { catalog, previewCount: rows.length, emptyHistoryDelimiter },
            notice:
              'Selected Piazza instructor-note previews verified read only. Full posts and replies were not opened; no material publication in this probe.',
          };
        },
      ).catch((error) => {
        const status = (error as { providerStatus?: number }).providerStatus;
        if (Number.isInteger(status) && status! >= 400 && status! <= 599)
          process.stdout.write(JSON.stringify({ providerStatus: status }) + '\n');
        throw error;
      });
      process.stdout.write(
        JSON.stringify({
          catalogCourses: result.catalog.length,
          fall2026Courses: filterPiazzaFall2026(result.catalog).length,
          previewCount: result.previewCount,
          emptyHistoryDelimiter: result.emptyHistoryDelimiter,
          ...(process.env.SOMA_PIAZZA_COURSE_METADATA === 'true'
            ? { courses: filterPiazzaFall2026(result.catalog) }
            : {}),
          modelCalls: 0,
          persistedMaterial: 0,
        }) + '\n',
      );
    }, 120_000);
  },
);
