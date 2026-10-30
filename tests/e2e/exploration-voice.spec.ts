import { test, expect, type Page, type Route } from '@playwright/test';
import {
  checkExploration,
  createExampleExploration,
  createWeightedExample,
} from '../../src/lib/domain/exploration';
import { inspectVoiceWav, encodeVoiceWav } from '../../src/lib/domain/voice-audio';
import { initialExplorationState } from '../../src/components/exploration-scene';

// Original synthetic codec/microphone/speech doubles exercise cancellation and
// actual React controls. They do not establish live ASR or audible speech quality.
async function setup(
  page: Page,
  options: {
    weighted?: boolean;
    deny?: boolean;
    pendingMicrophone?: boolean;
    delayTranscript?: boolean;
    nativeAudio?: boolean;
    delaySpeech?: boolean;
    failSpeech?: boolean;
    nativePlayback?: boolean;
  } = {},
) {
  await page.addInitScript(({ deny, pendingMicrophone, nativeAudio, nativePlayback }) => {
    const spy = ((window as any).__voice = {
      stops: 0,
      cancels: 0,
      spoken: [] as string[],
      last: null as any,
      cancelled: null as any,
      resolveMicrophone: null as any,
      native: [] as unknown[],
      chunks: [] as number[],
    });
    const media = ((window as any).__gemini = { played: 0, paused: 0, last: null as any });
    if (!nativePlayback)
      Object.defineProperty(window, 'Audio', {
        configurable: true,
        value: class {
          duration = 10;
          currentTime = 0;
          onended: any = null;
          onerror: any = null;
          constructor(public src: string) {
            media.last = this;
          }
          async play() {
            media.played++;
          }
          pause() {
            media.paused++;
          }
          removeAttribute() {}
          load() {}
        },
      });
    const stream = {
      getTracks: () => [
        {
          stop: () => {
            spy.stops++;
          },
        },
      ],
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        getUserMedia: async () => {
          if (deny) throw new DOMException('Original synthetic denial', 'NotAllowedError');
          if (pendingMicrophone)
            return new Promise((resolve) => {
              spy.resolveMicrophone = () => resolve(stream);
            });
          if (nativeAudio) {
            const audio = new AudioContext(),
              oscillator = audio.createOscillator(),
              destination = audio.createMediaStreamDestination();
            oscillator.frequency.value = 440;
            oscillator.connect(destination);
            oscillator.start();
            await audio.resume();
            for (const track of destination.stream.getTracks()) {
              const stop = track.stop.bind(track);
              Object.defineProperty(track, 'stop', {
                value: () => {
                  spy.stops++;
                  oscillator.stop();
                  void audio.close();
                  stop();
                },
              });
            }
            return destination.stream;
          }
          return stream;
        },
      },
    });
    if (nativeAudio) {
      const NativeRecorder = window.MediaRecorder;
      Object.defineProperty(window, 'MediaRecorder', {
        configurable: true,
        value: class extends NativeRecorder {
          constructor(stream: MediaStream, options?: MediaRecorderOptions) {
            super(stream, options);
            this.addEventListener('dataavailable', (event) => spy.chunks.push(event.data.size));
          }
        },
      });
      const decode = AudioContext.prototype.decodeAudioData;
      (AudioContext.prototype as any).decodeAudioData = function (data: ArrayBuffer) {
        spy.native.push({ stage: 'decode', bytes: data.byteLength });
        return decode.call(this, data).then(
          (buffer) => {
            spy.native.push({ stage: 'decoded', duration: buffer.duration });
            return buffer;
          },
          (error) => {
            spy.native.push({ stage: 'decode-error', name: error.name });
            throw error;
          },
        );
      };
      const render = OfflineAudioContext.prototype.startRendering;
      OfflineAudioContext.prototype.startRendering = function () {
        spy.native.push({ stage: 'render' });
        return render.call(this).then((buffer) => {
          spy.native.push({ stage: 'rendered', duration: buffer.duration });
          return buffer;
        });
      };
    }
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      mimeType = 'audio/webm';
      ondataavailable: any = null;
      onstop: any = null;
      onerror: any = null;
      start() {
        this.state = 'recording';
      }
      stop() {
        if (this.state === 'inactive') return;
        this.state = 'inactive';
        this.ondataavailable?.({ data: new Blob(['original-synthetic-encoded-audio']) });
        this.onstop?.();
      }
    }
    if (!nativeAudio) {
      Object.defineProperty(window, 'MediaRecorder', { configurable: true, value: Recorder });
      Object.defineProperty(window, 'AudioContext', {
        configurable: true,
        value: class {
          async decodeAudioData() {
            return { duration: 1 };
          }
          async close() {}
        },
      });
      Object.defineProperty(window, 'OfflineAudioContext', {
        configurable: true,
        value: class {
          destination = {};
          createBufferSource() {
            return { buffer: null, connect() {}, start() {} };
          }
          async startRendering() {
            return { getChannelData: () => new Float32Array(24000) };
          }
        },
      });
    }
    Object.defineProperty(window, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: class {
        onend: any = null;
        onerror: any = null;
        constructor(public text: string) {}
      },
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel() {
          spy.cancels++;
          spy.cancelled = spy.last;
        },
        speak(utterance: any) {
          spy.spoken.push(utterance.text);
          spy.last = utterance;
        },
      },
    });
  }, options);
  const checked = checkExploration(
      options.weighted
        ? createWeightedExample({ observationId: 'original-weighted', version: 1, region: null })
        : createExampleExploration(),
    ),
    now = '2026-10-29T15:00:00.000Z';
  const artifact = {
    ...checked,
    id: '629cdb47-2131-4c92-9e22-6900e87cba15',
    version: 1,
    createdAt: now,
    updatedAt: now,
    question: 'Why is this node next?',
    source: {
      observationId: checked.spec.sources[0].observationId,
      version: 1,
      kind: 'example',
      label: 'Original BFS example',
      capturedAt: now,
      summary: 'Original synthetic graph.',
      uncertainty: [],
    },
    generation: {
      mode: 'prepared-example',
      provider: 'none',
      model: null,
      calls: 0,
      costUsd: 0,
      elapsedMs: 0,
    },
    state: initialExplorationState(checked.spec),
    saved: false,
  };
  const requests: { path: string; method: string; type: string | null; body: Buffer | null }[] = [];
  let pending: Route | undefined, speechPending: Route | undefined;
  await page.route('**/api/explore**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname;
    requests.push({
      path,
      method: request.method(),
      type: request.headers()['content-type'] ?? null,
      body: request.postDataBuffer(),
    });
    if (path.endsWith('/speech')) {
      if (options.delaySpeech) {
        speechPending = route;
        return;
      }
      if (options.failSpeech) return route.fulfill({ status: 503, json: { code: 'unavailable' } });
      return route.fulfill({
        contentType: 'audio/wav',
        body: Buffer.from(encodeVoiceWav(new Float32Array(24000))),
      });
    }
    if (path.endsWith('/transcribe')) {
      if (options.delayTranscript) {
        pending = route;
        return;
      }
      return route.fulfill({
        json: {
          transcript: 'Why does A leave the queue before B?',
          audioDurationMs: 1000,
          provider: 'meta',
          model: 'muse-voice-transcribe-1.0',
        },
      });
    }
    if (request.method() === 'GET')
      return route.fulfill({ json: { artifacts: [], active: null, liveEnabled: true } });
    const body = request.postDataJSON();
    if (body.action === 'example') return route.fulfill({ json: { artifact } });
    return route.fulfill({
      status: 500,
      json: { error: 'No generated operation belongs in this voice fixture.' },
    });
  });
  await page.goto('/explore');
  await expect(page.getByRole('button', { name: 'Record question', exact: true })).toBeEnabled();
  return {
    requests,
    finishSpeech: async () => {
      if (speechPending)
        await speechPending
          .fulfill({
            contentType: 'audio/wav',
            body: Buffer.from(encodeVoiceWav(new Float32Array(24000))),
          })
          .catch(() => {});
    },
    example: async () => {
      await page
        .getByRole('button', { name: 'Try the original example', exact: true })
        .first()
        .click();
      await expect(
        page.getByRole('button', { name: 'Play explanation', exact: true }),
      ).toBeEnabled();
      await page.getByText('Playback settings', { exact: true }).click();
      await page.getByRole('button', { name: 'Use browser voice', exact: true }).click();
    },
    finish: async () => {
      if (pending)
        await pending
          .fulfill({
            json: { transcript: 'Original late transcript', audioDurationMs: 1000, turns: [] },
          })
          .catch(() => {});
    },
  };
}

test('explicit recording posts bounded WAV and inserts editable text without submitting a question or a screenshot', async ({
  page,
}) => {
  const h = await setup(page);
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Stop and transcribe', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Stop and transcribe', exact: true }).click();
  await expect(page.locator('#exploration-question')).toHaveValue(
    'Why does A leave the queue before B?',
  );
  const calls = h.requests.filter((request) => request.path.endsWith('/transcribe'));
  expect(calls).toHaveLength(1);
  expect(calls[0].type).toBe('audio/wav');
  expect(calls[0].body?.subarray(0, 4).toString()).toBe('RIFF');
  expect(calls[0].body?.length).toBe(48044);
  expect(
    h.requests.filter(
      (request) => request.method === 'POST' && !request.path.endsWith('/transcribe'),
    ),
  ).toHaveLength(0);
  expect(await page.evaluate(() => (window as any).__voice.stops)).toBeGreaterThan(0);
});

test('native Chromium recording decodes, downmixes and resamples an original synthetic signal to checked PCM WAV', async ({
  page,
}) => {
  const h = await setup(page, { nativeAudio: true });
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Stop and transcribe', exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => (window as any).__voice.chunks.some((size: number) => size > 0)),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Stop and transcribe', exact: true }).click();
  await expect
    .poll(async () => ({
      value: await page.locator('#exploration-question').inputValue(),
      native: await page.evaluate(() => (window as any).__voice.native),
    }))
    .toMatchObject({ value: 'Why does A leave the queue before B?' });
  const call = h.requests.find((request) => request.path.endsWith('/transcribe'));
  expect(call?.body).toBeTruthy();
  const audio = inspectVoiceWav(new Uint8Array(call!.body!));
  expect(audio.sampleRate).toBe(24000);
  expect(audio.durationMs).toBeGreaterThan(100);
  expect(audio.durationMs).toBeLessThan(5000);
  expect(call!.body!.subarray(44).some((value) => value !== 0)).toBe(true);
});

test('denied microphone permission preserves the typed path and sends no audio', async ({
  page,
}) => {
  const h = await setup(page, { deny: true });
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await expect(
    page.getByText('Microphone access is unavailable. You can type your question instead.', {
      exact: true,
    }),
  ).toBeVisible();
  await page.locator('#exploration-question').fill('Typed questions still work.');
  expect(h.requests.some((request) => request.path.endsWith('/transcribe'))).toBe(false);
});

test('cancelling a pending microphone request stops a late returned track without recording or uploading', async ({
  page,
}) => {
  const h = await setup(page, { pendingMicrophone: true });
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel voice', exact: true }).click();
  await page.evaluate(() => (window as any).__voice.resolveMicrophone());
  await expect.poll(() => page.evaluate(() => (window as any).__voice.stops)).toBe(1);
  expect(h.requests.some((request) => request.path.endsWith('/transcribe'))).toBe(false);
});

test('cancelling an in-flight transcript rejects its late text and leaves the original question intact', async ({
  page,
}) => {
  const h = await setup(page, { delayTranscript: true });
  await page.locator('#exploration-question').fill('Keep this typed question.');
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await page.getByRole('button', { name: 'Stop and transcribe', exact: true }).click();
  await expect
    .poll(() => h.requests.filter((request) => request.path.endsWith('/transcribe')).length)
    .toBe(1);
  await page.getByRole('button', { name: 'Cancel voice', exact: true }).click();
  await h.finish();
  await expect(page.locator('#exploration-question')).toHaveValue('Keep this typed question.');
});

test('guided explanation advances on actual playback completion, pauses on manual changes and ignores stale events', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause explanation', exact: true })).toBeVisible();
  await page.evaluate(() => {
    (window as any).__voice.old = (window as any).__voice.last;
    (window as any).__voice.last.onend();
  });
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await expect.poll(() => page.evaluate(() => (window as any).__voice.spoken.length)).toBe(2);
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await page.evaluate(() => (window as any).__voice.old.onend());
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Pause explanation', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Replay from start', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextS']);
});

test('conversational submission is opt-in and sends a completed transcript against current artifact context', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByText('Question settings', { exact: true }).click();
  await page.getByRole('checkbox', { name: /Ask and explain after recording/ }).check();
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await page.getByRole('button', { name: 'Stop and transcribe', exact: true }).click();
  await expect
    .poll(
      () =>
        h.requests.filter(
          (r) => r.method === 'POST' && r.body?.toString().includes('"action":"generate"'),
        ).length,
    )
    .toBe(1);
  const request = h.requests.find((r) => r.body?.toString().includes('"action":"generate"'))!;
  const body = JSON.parse(request.body!.toString());
  expect(body.question).toBe('Why does A leave the queue before B?');
  expect(body.artifactId).toBeTruthy();
  expect(body.source).toBeUndefined();
  await expect(page.getByRole('alert').filter({ hasText: 'Soma could not prepare' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Why does A come before B?', exact: true }),
  ).toBeVisible();
});

test('recording interrupts narration and a late completion cannot advance the diagram', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await page.evaluate(() => {
    (window as any).__voice.oldEnd = (window as any).__voice.last.onend;
  });
  await page.getByRole('button', { name: 'Record question', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Stop and transcribe', exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (window as any).__voice.oldEnd());
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextS']);
  await expect(page.getByRole('button', { name: 'Play explanation', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel voice', exact: true }).click();
  expect(h.requests.some((r) => r.path.endsWith('/transcribe'))).toBe(false);
});

test('Gemini audio advances only after completion and replay reuses ephemeral audio', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(1);
  await expect.poll(() => h.requests.filter((r) => r.path.endsWith('/speech')).length).toBe(2);
  const body = JSON.parse(h.requests.find((r) => r.path.endsWith('/speech'))!.body!.toString());
  expect(Object.keys(body).sort()).toEqual(['artifactId', 'state', 'version']);
  expect(body.state.step).toBe(0);
  await page.evaluate(() => {
    (window as any).__gemini.oldEnd = (window as any).__gemini.last.onended;
    (window as any).__gemini.last.onended();
  });
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(2);
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await page.evaluate(() => (window as any).__gemini.oldEnd());
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await page.getByRole('button', { name: 'Replay from start', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(3);
  expect(
    h.requests.filter(
      (r) => r.path.endsWith('/speech') && JSON.parse(r.body!.toString()).state.step === 0,
    ),
  ).toHaveLength(1);
  expect(await page.evaluate(() => (window as any).__gemini.paused)).toBeGreaterThan(0);
});

test('cancelled Gemini synthesis never starts late audio and failure keeps captions plus explicit fallback', async ({
  page,
}) => {
  const h = await setup(page, { delaySpeech: true });
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => h.requests.filter((r) => r.path.endsWith('/speech')).length).toBe(1);
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await h.finishSpeech();
  expect(await page.evaluate(() => (window as any).__gemini.played)).toBe(0);
  await page.route('**/api/explore/speech', (route) =>
    route.fulfill({ status: 503, json: { code: 'unavailable' } }),
  );
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Gemini voice is unavailable' }),
  ).toBeVisible();
  await expect(page.locator('.exploration-spoken-caption')).toContainText('S starts');
  expect(await page.evaluate(() => (window as any).__voice.spoken.length)).toBe(0);
  await page.getByRole('button', { name: 'Use browser voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__voice.spoken.length)).toBe(1);
});

test('native Chromium decodes WAV playback and advances the visual on the real ended event', async ({
  page,
}) => {
  const h = await setup(page, { nativePlayback: true });
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  expect(h.requests.some((r) => r.path.endsWith('/speech'))).toBe(true);
});

test('a slow next-step prefetch is joined on advance, and interruption aborts it without late playback', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  let pending: Route | undefined,
    aborted = false;
  const steps: number[] = [];
  page.on('requestfailed', (request) => {
    if (request.url().endsWith('/speech')) aborted = true;
  });
  await page.route('**/api/explore/speech', (route) => {
    const step = route.request().postDataJSON().state.step;
    steps.push(step);
    if (step === 1) {
      pending = route;
      return;
    }
    return route.fulfill({
      contentType: 'audio/wav',
      body: Buffer.from(encodeVoiceWav(new Float32Array(24000))),
    });
  });
  expect(steps).toEqual([]);
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => steps).toEqual([0, 1]);
  await page.evaluate(() => (window as any).__gemini.last.onended());
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await expect(
    page.getByRole('status').filter({ hasText: 'Preparing Gemini audio' }),
  ).toBeVisible();
  expect(steps).toEqual([0, 1]);
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await expect.poll(() => aborted).toBe(true);
  await pending!
    .fulfill({
      contentType: 'audio/wav',
      body: Buffer.from(encodeVoiceWav(new Float32Array(24000))),
    })
    .catch(() => {});
  expect(await page.evaluate(() => (window as any).__gemini.played)).toBe(1);
});

test('failed prefetch keeps the current step playing, then stops without an implicit retry', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  const steps: number[] = [];
  await page.route('**/api/explore/speech', (route) => {
    const step = route.request().postDataJSON().state.step;
    steps.push(step);
    return step === 0
      ? route.fulfill({
          contentType: 'audio/wav',
          body: Buffer.from(encodeVoiceWav(new Float32Array(24000))),
        })
      : route.fulfill({ status: 429, json: { code: 'capacity' } });
  });
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => steps).toEqual([0, 1]);
  await expect(page.getByRole('button', { name: 'Pause explanation', exact: true })).toBeVisible();
  await page.evaluate(() => (window as any).__gemini.last.onended());
  await expect(
    page.getByRole('status').filter({ hasText: 'Gemini voice is unavailable' }),
  ).toBeVisible();
  expect(steps).toEqual([0, 1]);
  expect(await page.evaluate(() => (window as any).__gemini.played)).toBe(1);
});

test('one question surface and disclosed settings remain usable on keyboard and a reduced-motion phone', async ({
  page,
}) => {
  const h = await setup(page);
  await page.getByRole('button', { name: 'Try the original example', exact: true }).first().click();
  await expect(page.getByRole('button', { name: 'Read step', exact: true })).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: 'Follow-up action' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Use browser voice', exact: true })).toBeHidden();
  const settings = page.getByText('Playback settings', { exact: true });
  await settings.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Use browser voice', exact: true })).toBeVisible();
  await page.keyboard.press('Enter');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: '.local/pm044/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/pm044/mobile.png', fullPage: true });
  await page.getByRole('button', { name: 'Ask about this', exact: true }).click();
  await expect(page.locator('#exploration-question')).toBeFocused();
  await page.locator('#exploration-question').fill('Explain this selection.');
  expect(h.requests.some((r) => r.path.endsWith('/speech'))).toBe(false);
});

test('audio progress choreographs dequeue, edge discovery and enqueue in the same checked stage', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(1);
  await page.evaluate(() => (window as any).__gemini.last.onended());
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(2);
  const stage = page.locator('.exploration-search-stage');
  await expect(stage).toHaveAttribute('data-motion-progress', '0.000');
  await page.evaluate(() => {
    (window as any).__gemini.last.currentTime = 1.5;
  });
  await expect(stage).toHaveAttribute('data-motion-progress', '0.150');
  await expect(page.locator('.exploration-motion-caption')).toHaveText('Take S from the front.');
  const departing = stage.locator('[data-token="s"][data-motion="departure"]');
  await expect(departing).toHaveCount(1);
  await stage.screenshot({ path: '.local/pm047/dequeue.png' });
  await page.evaluate(() => {
    (window as any).__gemini.last.currentTime = 4;
  });
  await expect(stage).toHaveAttribute('data-motion-progress', '0.400');
  await expect(page.locator('.exploration-motion-caption')).toHaveText('Discover A from S.');
  expect(
    Number(await stage.locator('[data-trace]').first().getAttribute('stroke-dashoffset')),
  ).toBeGreaterThan(0);
  await stage.screenshot({ path: '.local/pm047/discover.png' });
  await page.evaluate(() => {
    (window as any).__gemini.last.currentTime = 5.5;
  });
  await expect(stage).toHaveAttribute('data-motion-progress', '0.550');
  await expect(page.locator('.exploration-motion-caption')).toHaveText('Add A to the back.');
  await stage.screenshot({ path: '.local/pm047/enqueue.png' });
  await page.evaluate(() => {
    (window as any).__gemini.last.currentTime = 9.5;
  });
  await expect(stage).toHaveAttribute('data-motion-progress', '0.950');
  await expect(page.locator('.exploration-motion-caption')).toHaveText('A is next in the queue.');
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await expect(stage).toHaveAttribute('data-motion-progress', '1.000');
  await expect(stage.locator('[data-motion="departure"]')).toHaveCount(0);
  await stage.screenshot({ path: '.local/pm047/settled.png' });
  await page.screenshot({ path: '.local/pm047/desktop.png', fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({ path: '.local/pm047/phone.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(h.requests.filter((r) => r.path.endsWith('/speech')).length).toBeLessThanOrEqual(3);
});

test('manual replay settles to the checked result and reduced motion skips all intermediate poses', async ({
  page,
}) => {
  const h = await setup(page);
  await h.example();
  const stage = page.locator('.exploration-search-stage');
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect
    .poll(async () => Number(await stage.getAttribute('data-motion-progress')))
    .toBeLessThan(1);
  await expect(stage).toHaveAttribute('data-motion-progress', '1.000', { timeout: 4000 });
  await expect(
    page.getByRole('list', { name: 'First in, first out queue' }).locator('li'),
  ).toHaveText(['NextA', '2B']);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(stage).toHaveAttribute('data-motion-progress', '1.000');
  await expect(stage.locator('[data-motion="departure"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(1);
  await expect(stage).toHaveAttribute('data-motion-progress', '1.000');
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
});

test.describe('checked motion recording', () => {
  test('manual sequence reveals a terminal path and keeps the queue consistent', async ({
    browser,
  }) => {
    const context = await browser.newContext({
        baseURL: 'http://127.0.0.1:3100',
        viewport: { width: 1280, height: 900 },
        recordVideo: { dir: '.local/pm047/video', size: { width: 1280, height: 900 } },
      }),
      page = await context.newPage();
    try {
      const h = await setup(page);
      await h.example();
      await page.getByText('Playback settings', { exact: true }).click();
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.locator('.exploration-search-stage').scrollIntoViewIfNeeded();
      for (let step = 1; step <= 5; step++) {
        await page
          .getByRole('button', { name: 'Next step', exact: true })
          .evaluate((button: HTMLButtonElement) => button.click());
        await expect
          .poll(async () =>
            Number(
              await page.locator('.exploration-search-stage').getAttribute('data-motion-progress'),
            ),
          )
          .toBeLessThan(1);
        await expect(page.locator('.exploration-search-stage')).toHaveAttribute(
          'data-motion-progress',
          '1.000',
          { timeout: 4000 },
        );
        if (step < 5) await expect(page.locator('.exploration-trace.is-path')).toHaveCount(0);
      }
      await expect(page.locator('.exploration-trace.is-path')).toHaveCount(2);
      await expect(page.locator('.exploration-motion-caption')).toHaveText(
        'Goal reached. Follow the discovered path.',
      );
    } finally {
      await context.close();
    }
  });
});

// Synthetic WAV and Audio clock double: verifies the real React timing path,
// not the quality of provider speech or word alignment.
test('weighted narration replays a queued goal cost improvement from 10 to 3', async ({ page }) => {
  const h = await setup(page, { weighted: true });
  await h.example();
  await page.getByRole('button', { name: 'Use Gemini voice', exact: true }).click();
  await page.getByRole('button', { name: 'Play explanation', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(1);
  for (let played = 2; played <= 4; played++) {
    await page.evaluate(() => (window as any).__gemini.last.onended());
    await expect.poll(() => page.evaluate(() => (window as any).__gemini.played)).toBe(played);
  }
  const stage = page.locator('.exploration-weighted-stage').first();
  await expect(stage).toHaveAttribute('data-motion-progress', '0.000');
  await expect(stage.locator('[data-weighted-node="g"]')).toContainText('cost: 10');
  await page.evaluate(() => ((window as any).__gemini.last.currentTime = 8.5));
  await expect(stage).toHaveAttribute('data-motion-progress', '0.850');
  await expect(stage.locator('[data-weighted-node="g"]')).toContainText('cost: 3');
  await expect(stage.locator('[data-weighted-trace="bg"]')).toHaveCount(1);
  await expect(stage.locator('[data-in-path="true"]')).toHaveCount(0);
  await stage.screenshot({ path: '.local/pm069/weighted-relaxation.png' });
  await page.getByRole('button', { name: 'Pause explanation', exact: true }).click();
  await expect(stage).toHaveAttribute('data-motion-progress', '1.000');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('button', { name: 'Next step', exact: true }).click();
  await expect(stage).toHaveAttribute('data-motion-progress', '1.000');
});
