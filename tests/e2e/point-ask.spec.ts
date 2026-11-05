import { openMoreExamples } from './example-navigation';
import { test, expect, type Page, type Route } from '@playwright/test';
import { checkExploration, createExampleExploration } from '../../src/lib/domain/exploration';
import { initialExplorationState } from '../../src/lib/domain/exploration-view';
import { encodeVoiceWav, inspectVoiceWav } from '../../src/lib/domain/voice-audio';
const first = 'd710c025-d2fb-4696-9d30-a3516ee96609',
  second = 'd710c025-d2fb-4696-9d30-a3516ee96610';
function artifact(id = first, title = 'Original graph', focus?: unknown) {
  const spec = createExampleExploration();
  spec.title = title;
  return {
    ...checkExploration(spec),
    id,
    version: 1,
    createdAt: '2026-10-30T12:00:00Z',
    updatedAt: '2026-10-30T12:00:00Z',
    question: 'Original synthetic question',
    source: {
      kind: 'screenshot',
      label: 'Original synthetic display',
      capturedAt: '2026-10-30T12:00:00Z',
      summary: 'Original synthetic graph',
      uncertainty: [],
      ...(focus ? { focus } : {}),
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
}
async function setup(
  page: Page,
  { delayTranscript = false, pendingPermission = false, delayGeneration = false } = {},
) {
  await page.addInitScript(
    ({ pendingPermission, wav }) => {
      const audit = ((window as any).__pointTest = {
        stops: 0,
        chunks: [] as number[],
        feedback: [] as unknown[],
        resolve: null as any,
      });
      window.addEventListener('soma:point-feedback', (e) =>
        audit.feedback.push((e as CustomEvent).detail),
      );
      const make = () => ({
        getTracks: () => [
          {
            stop: () => {
              audit.stops++;
            },
          },
        ],
      });
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: {
          getUserMedia: async () =>
            pendingPermission
              ? new Promise((resolve) => {
                  audit.resolve = () => resolve(make());
                })
              : make(),
        },
      });
      // Original synthetic PCM through real decodeAudioData/OfflineAudioContext.
      // This controls permission/recorder timing; it does not prove native mic quality.
      const bytes = Uint8Array.from(atob(wav), (c) => c.charCodeAt(0));
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: class {
          static isTypeSupported() {
            return true;
          }
          state = 'inactive';
          mimeType = 'audio/wav';
          ondataavailable: any = null;
          onstop: any = null;
          onerror: any = null;
          constructor() {
            (audit as any).recorder = this;
          }
          start() {
            this.state = 'recording';
            audit.chunks.push(bytes.length);
          }
          stop() {
            if (this.state === 'inactive') return;
            this.state = 'inactive';
            queueMicrotask(() => {
              this.ondataavailable?.({ data: new Blob([bytes], { type: 'audio/wav' }) });
              this.onstop?.();
            });
          }
        },
      });
    },
    {
      pendingPermission,
      wav: Buffer.from(
        encodeVoiceWav(
          Float32Array.from(
            { length: 16000 },
            (_, i) => Math.sin((i / 16000) * Math.PI * 440 * 2) * 0.1,
          ),
        ),
      ).toString('base64'),
    },
  );
  let artifacts: any[] = [];
  const calls: any[] = [],
    audio: number[] = [];
  let transcript: Route | undefined, generation: Route | undefined;
  await page.route('**/api/explore/speech', (r) =>
    r.fulfill({
      contentType: 'audio/wav',
      body: Buffer.from(encodeVoiceWav(new Float32Array(16000).fill(0.002))),
    }),
  );
  await page.route('**/api/explore/transcribe', async (r) => {
    const b = r.request().postDataBuffer()!;
    audio.push(inspectVoiceWav(new Uint8Array(b)).frames);
    if (delayTranscript) {
      transcript = r;
      return;
    }
    await r.fulfill({ json: { transcript: 'Why this connection?' } });
  });
  await page.route(/\/api\/explore(?:\?.*)?$/, async (r) => {
    const req = r.request();
    if (req.method() === 'GET') {
      const id = new URL(req.url()).searchParams.get('artifactId');
      return r.fulfill({
        json: {
          artifacts,
          liveEnabled: true,
          versions: [],
          ...(id ? { active: artifacts.find((a) => a.id === id) } : {}),
        },
      });
    }
    const b = req.postDataJSON();
    calls.push(b);
    if (b.action === 'cancel') return r.fulfill({ json: { cancelled: true } });
    if (req.method() === 'PATCH') {
      const a = artifacts.find((a) => a.id === b.artifactId);
      a.saved = true;
      a.state = b.state;
      return r.fulfill({ json: { artifact: a } });
    }
    if (b.action === 'example') {
      const a = artifact();
      artifacts = [a];
      return r.fulfill({ json: { artifact: a } });
    }
    if (delayGeneration) {
      generation = r;
      return;
    }
    const a = artifact(second, 'Pointed connection', b.source?.focus);
    artifacts = [a, ...artifacts];
    return r.fulfill({ json: { artifact: a } });
  });
  await page.goto('/explore');
  await openMoreExamples(page);
  await page.getByRole('button', { name: 'Try the original example', exact: true }).first().click();
  await page.getByRole('heading', { name: 'Original graph', exact: true }).waitFor();
  const source = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 800;
    c.height = 500;
    const x = c.getContext('2d')!;
    x.fillStyle = 'white';
    x.fillRect(0, 0, 800, 500);
    x.fillStyle = 'black';
    x.font = '24px sans-serif';
    x.fillText('Original synthetic S → A → Goal', 30, 100);
    return c.toDataURL('image/jpeg');
  });
  return {
    calls,
    audio,
    source,
    transcript: () => transcript,
    completeTranscript: async () =>
      transcript?.fulfill({ json: { transcript: 'A late answer' } }).catch(() => {}),
    completeGeneration: async () => {
      const b = generation!.request().postDataJSON(),
        a = artifact(second, 'Pointed connection', b.source?.focus);
      artifacts = [a, ...artifacts];
      await generation!.fulfill({ json: { artifact: a } }).catch(() => {});
    },
  };
}
async function native(page: Page, type: string, id = first, extra: Record<string, unknown> = {}) {
  await page.evaluate(
    (d) => window.dispatchEvent(new CustomEvent('soma:point-ask', { detail: d })),
    { type, id, ...extra },
  );
}
const focus = { kind: 'circle', region: { x: 0.2, y: 0.1, width: 0.4, height: 0.35 } };
async function begin(page: Page) {
  await native(page, 'begin');
  await expect(
    page.getByRole('button', { name: 'Stop and transcribe', exact: true, includeHidden: true }),
  ).toHaveAttribute('aria-pressed', 'true');
  await expect
    .poll(() =>
      page.evaluate(() => {
        const a = (window as any).__pointTest;
        return {
          chunks: a.chunks,
          stops: a.stops,
          audioTime: a.context?.currentTime,
          ctxState: a.context?.state,
          recorder: a.recorder?.state,
        };
      }),
    )
    .toMatchObject({ chunks: expect.arrayContaining([expect.any(Number)]) });
}
test('point-and-ask joins source and prepared browser audio, submits once, preserves the original and saves focus', async ({
  page,
}) => {
  await page.setViewportSize({ width: 620, height: 704 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const h = await setup(page, { delayGeneration: true });
  await begin(page);
  // Source first: selecting context must not cancel the still-recording microphone.
  await native(page, 'source', first, {
    dataUrl: h.source,
    focus,
    capturedAt: '2026-10-30T12:00:00Z',
  });
  await expect(page.getByLabel('Selected circle region')).toBeVisible();
  await native(page, 'end');
  await expect.poll(() => h.calls.filter((c) => c.action === 'generate').length).toBe(1);
  const pendingSource = page.getByRole('figure', { name: 'Source being explained' });
  await expect(pendingSource).toBeVisible();
  await expect(pendingSource.getByLabel('Selected circle region')).toBeVisible();
  await expect(pendingSource.getByRole('img')).toBeVisible();
  const sent = h.calls.find((c) => c.action === 'generate');
  expect(sent.source.focus).toEqual(focus);
  expect(sent.question).toBe('Why this connection?');
  expect(sent).not.toHaveProperty('artifactId');
  expect(h.audio[0]).toBeGreaterThan(0);
  await expect(page.getByRole('heading', { name: 'Original graph', exact: true })).toBeVisible();
  await h.completeGeneration();
  await expect(
    page.getByRole('heading', { name: 'Pointed connection', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Save exploration', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Pointed connection Version 1/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Pointed connection', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/soma-pm077-pointed-native.png' });
});
test('a cancelled late transcript cannot submit or replace the current visual', async ({
  page,
}) => {
  const h = await setup(page, { delayTranscript: true });
  await begin(page);
  await native(page, 'end');
  await native(page, 'source', first, {
    dataUrl: h.source,
    focus,
    capturedAt: '2026-10-30T12:00:00Z',
  });
  await expect.poll(() => !!h.transcript()).toBe(true);
  await native(page, 'cancel', first, { message: 'Cancelled from native shortcut' });
  await h.completeTranscript();
  await page.waitForTimeout(200);
  expect(h.calls.some((c) => c.action === 'generate')).toBe(false);
  await expect(page.getByRole('heading', { name: 'Original graph', exact: true })).toBeVisible();
});
test('release during microphone permission cleans up a late permission result without sending audio', async ({
  page,
}) => {
  const h = await setup(page, { pendingPermission: true });
  await native(page, 'begin');
  await expect.poll(() => page.evaluate(() => !!(window as any).__pointTest.resolve)).toBe(true);
  await native(page, 'end');
  await page.evaluate(() => (window as any).__pointTest.resolve());
  await expect
    .poll(() => page.evaluate(() => (window as any).__pointTest.stops))
    .toBeGreaterThan(0);
  expect(h.audio).toHaveLength(0);
  expect(h.calls.some((c) => c.action === 'generate')).toBe(false);
});
test('a stale source and release from an earlier interaction are ignored', async ({ page }) => {
  const h = await setup(page);
  await native(page, 'begin');
  await native(page, 'begin', second);
  await native(page, 'end', first);
  await native(page, 'source', first, {
    dataUrl: h.source,
    focus,
    capturedAt: '2026-10-30T12:00:00Z',
  });
  await native(page, 'cancel', second);
  expect(h.calls.some((c) => c.action === 'generate')).toBe(false);
  await expect(page.getByRole('heading', { name: 'Original graph', exact: true })).toBeVisible();
});
test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus)
    console.log(
      'POINT_DIAGNOSTIC',
      await page.evaluate(() => {
        const a = (window as any).__pointTest;
        return {
          chunks: a?.chunks,
          stops: a?.stops,
          time: a?.context?.currentTime,
          state: a?.context?.state,
          recorder: a?.recorder?.state,
          feedback: a?.feedback,
        };
      }),
    );
});
test('a press and release in the same render cannot leave an orphaned point session', async ({
  page,
}) => {
  const h = await setup(page);
  await page.evaluate((id) => {
    for (const type of ['begin', 'end'])
      window.dispatchEvent(new CustomEvent('soma:point-ask', { detail: { type, id } }));
  }, first);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__pointTest.feedback.some((e: any) =>
          ['error', 'cancelled'].includes(e.state),
        ),
      ),
    )
    .toBe(true);
  expect(h.calls.some((c) => c.action === 'generate')).toBe(false);
});

test('choosing an upload during a hold cancels native audio and ignores its late context', async ({
  page,
}) => {
  const h = await setup(page);
  await native(page, 'begin');
  await expect
    .poll(() => page.evaluate(() => (window as any).__pointTest.recorder?.state))
    .toBe('recording');
  await page.getByLabel('Upload a PNG or JPEG screenshot', { exact: true }).setInputFiles({
    name: 'Replacement.jpg',
    mimeType: 'image/jpeg',
    buffer: Buffer.from(h.source.split(',')[1], 'base64'),
  });
  await expect
    .poll(() => page.evaluate(() => (window as any).__pointTest.stops))
    .toBeGreaterThan(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as any).__pointTest.feedback.some((e: any) => e.state === 'cancelled'),
      ),
    )
    .toBe(true);
  await native(page, 'end');
  await native(page, 'source', first, {
    dataUrl: h.source,
    focus,
    canPointBack: true,
    capturedAt: '2026-10-30T12:00:00Z',
  });
  expect(h.calls.some((c) => c.action === 'generate')).toBe(false);
  await expect(page.getByText('Replacement.jpg', { exact: true })).toBeVisible();
});

test('source regions stay attached to the capture and a later native capture carries its exact earlier image', async ({
  page,
}) => {
  const h = await setup(page);
  let firstImage = '';
  const generated: any[] = [];
  await page.route('**/api/explore', async (route) => {
    if (route.request().method() !== 'POST' || route.request().postDataJSON().action !== 'generate')
      return route.fallback();
    const b = route.request().postDataJSON();
    generated.push(b);
    const a = artifact(second, 'Grounded visual', b.source.focus);
    a.version = generated.length;
    a.spec.version = a.version;
    a.source.capturedAt = b.source.capturedAt;
    (a.source as any).anchors = [
      { id: 'source-region', label: 'Original connection', region: focus.region },
    ];
    if (a.spec.mode !== 'clarify') a.spec.steps[0].sourceHighlightIds = ['source-region'];
    if (generated.length === 1) firstImage = b.source.dataUrl;
    else {
      expect(b.previousImage).toBe(firstImage);
      expect(b.artifactId).toBe(second);
      expect(b.baseVersion).toBe(1);
      (a.source as any).change = {
        relationship: 'same-material',
        summary: 'No source content changed.',
        changed: [],
        uncertainty: [],
      };
    }
    await route.fulfill({ json: { artifact: a } });
  });
  await begin(page);
  await native(page, 'end');
  await native(page, 'source', first, {
    dataUrl: h.source,
    focus,
    canPointBack: true,
    capturedAt: '2026-10-30T12:00:00Z',
  });
  await expect(page.getByRole('heading', { name: 'Grounded visual', exact: true })).toBeVisible();
  // Source-region visibility follows the authored step, not the separate trace step.
  // Force a valid later-playback state that the original assertion did not account for.
  await page.getByRole('button', { name: 'Replay from start', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Play explanation', exact: true })).toBeVisible();
  await page.getByText('Explanation & checked state', { exact: true }).click();
  const lastAuthoredStep = page.locator('.exploration-explanation-steps button').last();
  await lastAuthoredStep.click();
  await expect(lastAuthoredStep).toHaveAttribute('aria-current', 'step');
  await page.getByText('See on source · 1 model-located region', { exact: true }).click();
  await expect(page.locator('.exploration-grounding-region')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Point on screen', exact: true })).toBeDisabled();
  const region = page.getByRole('button', { name: 'Original connection', exact: true });
  await region.click();
  await expect(region).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('.exploration-grounding-region')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Point on screen', exact: true })).toBeEnabled();
  await page.evaluate(() =>
    window.addEventListener('soma:source-highlight', (e: any) => {
      (window as any).__sourcePoint = e.detail;
    }),
  );
  await page.getByRole('button', { name: 'Point on screen', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__sourcePoint.id)).toBe(first);
  await page.evaluate(
    (id) =>
      window.dispatchEvent(
        new CustomEvent('soma:source-highlight-result', { detail: { id, shown: false } }),
      ),
    first,
  );
  await expect(page.getByText(/The screen changed or this capture expired/)).toBeVisible();
  await native(page, 'begin', second);
  await expect
    .poll(() => page.evaluate(() => (window as any).__pointTest.recorder?.state))
    .toBe('recording');
  await native(page, 'end', second);
  await native(page, 'source', second, {
    dataUrl: h.source,
    focus,
    capturedAt: '2026-10-30T12:01:00Z',
  });
  await expect(page.getByText('No source content changed.', { exact: false })).toBeVisible();
  await page.getByText('Compare captures', { exact: true }).click();
  await expect(
    page.getByRole('img', { name: 'Earlier captured source', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('img', { name: 'Current captured source', exact: true }),
  ).toBeVisible();
  expect(generated).toHaveLength(2);
});
