import { test, expect, type Page } from '@playwright/test';
import { createExampleExploration, checkExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
const id = 'd710c025-d2fb-4696-9d30-a3516ee96609';
async function setup(page: Page, answer = true) {
  let bytes = 0,
    finals = 0;
  const payloads: any[] = [];
  await page.addInitScript(() => {
    const original = new AudioContext({ sampleRate: 24000 }),
      osc = original.createOscillator(),
      destination = original.createMediaStreamDestination();
    osc.frequency.value = 440;
    osc.connect(destination);
    osc.start();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          await original.resume();
          return destination.stream;
        },
      },
    });
  });
  await page.routeWebSocket('wss://voice.soma.test/stream', (socket) => {
    let partial = false;
    socket.onMessage((data) => {
      if (typeof data === 'string') {
        const d = JSON.parse(data);
        if (d.ticket) {
          if (answer) socket.send('{"type":"ready"}');
        } else if (d.type === 'end') {
          finals++;
          socket.send('{"type":"final","transcript":"Why does this connection matter?"}');
        }
      } else {
        bytes += data.byteLength;
        if (!partial) {
          partial = true;
          socket.send('{"type":"partial","transcript":"Why does this"}');
        }
      }
    });
  });
  await page.route('**/api/explore/transcribe/session', (route) =>
    route.fulfill({
      json:
        route.request().postDataJSON().action === 'start'
          ? { ticket: 'a'.repeat(64), url: 'wss://voice.soma.test/stream' }
          : { cancelled: true },
    }),
  );
  const spec = createExampleExploration();
  const a = {
    ...checkExploration(spec),
    id,
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    source: {
      kind: 'example',
      label: 'Original example',
      capturedAt: new Date().toISOString(),
      summary: 'Original graph',
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
    question: 'Original question',
  };
  await page.route('**/api/explore', (route) => {
    if (route.request().method() === 'GET')
      return route.fulfill({
        json: { artifacts: [], liveEnabled: true, streamingVoiceEnabled: true },
      });
    const b = route.request().postDataJSON();
    payloads.push(b);
    return route.fulfill({ json: { artifact: a } });
  });
  await page.goto('/explore');
  await page
    .getByRole('button', { name: 'Try the original example', exact: true })
    .first()
    .click();
  await expect(page.getByRole('heading', { name: spec.title, exact: true })).toBeVisible();
  return { bytes: () => bytes, finals: () => finals, payloads };
}
const native = (page: Page, type: string) =>
  page.evaluate((d) => window.dispatchEvent(new CustomEvent('soma:point-ask', { detail: d })), {
    type,
    id,
  });
test('real AudioWorklet sends PCM while holding and final transcript arrives only after release', async ({
  page,
}) => {
  const h = await setup(page);
  await page.evaluate(() =>
    window.addEventListener('soma:point-feedback', (e: any) => {
      (window as any).__lastPoint = e.detail;
    }),
  );
  await native(page, 'begin');
  await expect.poll(h.bytes).toBeGreaterThan(0);
  await expect
    .poll(() => page.evaluate(() => (window as any).__lastPoint?.text))
    .toBe('Why does this');
  expect(h.finals()).toBe(0);
  await native(page, 'end');
  await expect.poll(h.finals).toBe(1);
  await expect(
    page.getByText('Question transcribed. Preparing the selected visual…', { exact: true }),
  ).toBeVisible();
  expect(h.bytes()).toBeLessThanOrEqual(1440000);
  await native(page, 'cancel');
});
test('cancelling during a streaming handshake closes the session without sending audio or submitting a question', async ({
  page,
}) => {
  const h = await setup(page, false);
  await native(page, 'begin');
  await native(page, 'cancel');
  await page.waitForTimeout(200);
  expect(h.bytes()).toBe(0);
  expect(h.payloads.filter((v) => v.action === 'generate')).toHaveLength(0);
});
