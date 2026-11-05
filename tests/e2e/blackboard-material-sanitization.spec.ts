import { test, expect } from '@playwright/test';
import type { Page } from 'playwright-core';
import { collectBlackboardMaterials } from '../../src/lib/server/connectors/blackboard-materials';

test('course HTML is converted in an inert fragment without executing or loading embedded content', async ({
  page,
}) => {
  await page.goto('about:blank');
  const requests: string[] = [];
  page.on('request', (request) => requests.push(request.url()));
  const body =
    '<h2>Loop invariant</h2><p>After each iteration, the prefix is sorted.</p><script>globalThis.somaInjected=true</script><style>secret-style</style><iframe src="https://example.invalid/private">private-frame</iframe><form>private-form<input value="private-password"></form><img src="https://example.invalid/image.png" onerror="globalThis.somaInjected=true">';
  const request = {
    get: async (url: string) => ({
      status: () => 200,
      headers: () => ({}),
      body: async () =>
        Buffer.from(
          JSON.stringify({
            paging: {},
            results: url.includes('/announcements')
              ? []
              : [{ id: '_content_1', title: 'Invariant', body }],
          }),
        ),
      dispose: async () => undefined,
    }),
  };
  const browser = { request, evaluate: page.evaluate.bind(page) } as unknown as Pick<
    Page,
    'request' | 'evaluate'
  >;
  const result = await collectBlackboardMaterials(
    browser,
    '_course_1',
    undefined,
    Date.now() + 10000,
  );
  expect(result.records[0].body).toBe(
    'Loop invariant\nAfter each iteration, the prefix is sorted.',
  );
  expect(result.complete).toBe(true);
  expect(
    await page.evaluate(() => (globalThis as { somaInjected?: boolean }).somaInjected),
  ).toBeUndefined();
  expect(requests).toEqual([]);
  expect(await page.locator('script,iframe,form,img').count()).toBe(0);
});
