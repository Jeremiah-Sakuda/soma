import { test, expect, type Page } from '@playwright/test';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
const make = (version = 1) => {
  const spec = createExampleExploration();
  spec.version = version;
  spec.title = version === 1 ? 'Original synthetic graph' : 'Reviewed synthetic revision';
  return {
    ...checkExploration(spec),
    id: '85406d27-3987-4556-9899-de10db3956be',
    version,
    createdAt: '2026-10-30T12:00:00Z',
    updatedAt: '2026-10-30T12:00:00Z',
    question: 'Original question',
    source: {
      kind: 'example',
      label: 'Original example',
      capturedAt: '2026-10-30T12:00:00Z',
      summary: 'Original synthetic graph',
      uncertainty: [],
    },
    generation: {
      mode: 'prepared-example',
      provider: 'none',
      model: null,
      calls: 0,
      costUsd: 0,
      elapsedMs: 0,
      audit: [],
    },
    state: initialExplorationState(spec),
    saved: false,
  };
};
async function setup(page: Page) {
  await page.addInitScript(() => {
    const fetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (
        String(input) === '/api/explore' &&
        init?.method === 'POST' &&
        JSON.parse(String(init.body)).action === 'generate'
      ) {
        (window as any).__progressRequests = ((window as any).__progressRequests ?? 0) + 1;
        (window as any).__requestAccept = new Headers(init.headers).get('Accept');
        return new Response(
          new ReadableStream({
            start(controller) {
              (window as any).__visualStream = controller;
              controller.enqueue(
                new TextEncoder().encode(
                  JSON.stringify({
                    type: 'progress',
                    progress: { phase: 'reading-source', elapsedMs: 0 },
                  }) + '\n',
                ),
              );
            },
          }),
          { headers: { 'Content-Type': 'application/x-ndjson' } },
        );
      }
      return fetch(input, init);
    };
  });
  const a = make();
  await page.route(/\/api\/explore(?:\?.*)?$/, async (r) => {
    if (r.request().method() === 'GET')
      return r.fulfill({ json: { artifacts: [], liveEnabled: true } });
    const b = r.request().postDataJSON();
    if (b.action === 'cancel') return r.fulfill({ json: { cancelled: true } });
    return r.fulfill({ json: { artifact: a } });
  });
  await page.goto('/explore');
  await page.getByText('Or try an example', { exact: true }).click();
  await page
    .getByRole('button', { name: 'Try the original example', exact: true })
    .first()
    .click();
  await page.getByRole('heading', { name: a.spec.title, exact: true }).waitFor();
  await page.locator('#exploration-question').fill('Explain this current graph.');
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
}
async function emit(page: Page, event: unknown, close = false) {
  await page.evaluate(
    ({ event, close }) => {
      const c = (window as any).__visualStream;
      c.enqueue(new TextEncoder().encode(JSON.stringify(event) + '\n'));
      if (close) c.close();
    },
    { event, close },
  );
}

test('real stage messages preserve the current diagram until the complete revision arrives', async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByText('Muse Spark is reading your selected source…', { exact: false }),
  ).toBeVisible();
  expect(await page.evaluate(() => (window as any).__requestAccept)).toBe(
    'application/x-ndjson',
  );
  await emit(page, {
    type: 'progress',
    progress: { phase: 'reviewing-visual', elapsedMs: 4000 },
  });
  await expect(
    page.getByText('Muse Wonder is reviewing the explanation…', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Original synthetic graph', exact: true }),
  ).toBeVisible();
  await emit(page, { type: 'result', result: { artifact: make(2) } }, true);
  await expect(
    page.getByRole('heading', { name: 'Reviewed synthetic revision', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Cancel request', exact: true })).toHaveCount(
    0,
  );
});

test('cancel and streamed failure keep the original visual and question available on a phone', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 704 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup(page);
  await expect(
    page.getByText('Muse Spark is reading your selected source…', { exact: false }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancel request', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Original synthetic graph', exact: true }),
  ).toBeVisible();
  await expect(page.locator('#exploration-question')).toHaveValue(
    'Explain this current graph.',
  );
  await expect(page.getByRole('button', { name: 'Ask Soma', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__progressRequests)).toBe(1);
  await page.getByRole('button', { name: 'Ask Soma', exact: true }).click();
  await emit(page, { type: 'error', status: 422, code: 'generation_invalid' }, true);
  await expect(
    page.getByRole('alert').filter({ hasText: 'Soma could not validate' }),
  ).toContainText('last valid card was kept');
  await expect(
    page.getByRole('heading', { name: 'Original synthetic graph', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
    true,
  );
});

test('an interrupted response keeps the draft and last visual with a clear recovery message', async ({
  page,
}) => {
  await setup(page);
  await expect(
    page.getByText('Muse Spark is reading your selected source…', { exact: false }),
  ).toBeVisible();
  await page.evaluate(() => (window as any).__visualStream.close());
  await expect(page.locator('.exploration-error')).toContainText(
    'last card and question are kept',
  );
  await expect(page.locator('#exploration-question')).toHaveValue(
    'Explain this current graph.',
  );
  await expect(
    page.getByRole('heading', { name: 'Original synthetic graph', exact: true }),
  ).toBeVisible();
});
