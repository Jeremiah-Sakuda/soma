import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { rolldown } from 'rolldown';
import type { CheckedCaptionFixture } from '../fixtures/checked-caption-client';

let client: string;
const styles = ['exploration.css', 'exploration-journal.css']
  .map((name) => readFileSync(resolve('src/components', name), 'utf8'))
  .join('\n');
const graphImage = `data:image/png;base64,${readFileSync(resolve('public/examples/lecture-14-dijkstra.png')).toString('base64')}`;
const circuitImage = `data:image/png;base64,${readFileSync(resolve('public/examples/lecture-9-bridge.png')).toString('base64')}`;

test.beforeAll(async () => {
  const bundle = await rolldown({
    input: resolve('tests/fixtures/checked-caption-client.tsx'),
    platform: 'browser',
    transform: { jsx: 'react-jsx', define: { 'process.env.NODE_ENV': '"production"' } },
  });
  try {
    const { output } = await bundle.generate({ format: 'iife' });
    if (output[0].type !== 'chunk') throw Error('Expected the real local React component fixture.');
    client = output[0].code;
  } finally {
    await bundle.close();
  }
});

async function open(page: Page, kind: CheckedCaptionFixture['kind'], caption: string) {
  const errors: string[] = [],
    requests: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/*', (route) => {
    if (new URL(route.request().url()).pathname === '/__checked-caption-fixture') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><link rel="icon" href="data:,"><style>${styles}</style><div id="root"></div>`,
      });
    }
    requests.push(route.request().url());
    return route.abort();
  });
  await page.addInitScript(
    (initial) => {
      window.__checkedCaptionInitial = initial;
      window.__checkedCaptionMirror = [];
      window.__checkedCaptionMedia = [];
      window.addEventListener('soma:screen-overlay', (event) => {
        window.__checkedCaptionMirror.push((event as CustomEvent).detail);
      });
      HTMLMediaElement.prototype.play = function () {
        window.__checkedCaptionMedia.push('play');
        return Promise.reject(Error('Silent fixture'));
      };
      window.speechSynthesis.speak = () => {
        window.__checkedCaptionMedia.push('speech');
        throw Error('Silent fixture');
      };
      navigator.mediaDevices.getUserMedia = async () => {
        window.__checkedCaptionMedia.push('microphone');
        throw Error('Silent fixture');
      };
      for (const name of ['AudioContext', 'OfflineAudioContext'] as const) {
        const runtime = window as unknown as Record<string, any>;
        if (runtime[name])
          runtime[name] = new Proxy(runtime[name], {
            construct() {
              window.__checkedCaptionMedia.push(name);
              throw Error('Silent fixture');
            },
          });
      }
    },
    { kind, caption, image: kind === 'graph' ? graphImage : circuitImage },
  );
  await page.goto('/__checked-caption-fixture');
  await page.addScriptTag({ content: client });
  await expect(page.locator('figure.source-overlay')).toHaveCount(1);
  return async () => {
    expect(errors).toEqual([]);
    expect(requests).toEqual([]);
    expect(await page.evaluate(() => window.__checkedCaptionMedia)).toEqual([]);
  };
}

async function checked(page: Page, authored: string, expectedFragment?: string) {
  const caption = page.locator('figure.source-overlay figcaption');
  const expected = await page.evaluate(() => window.__checkedCaptionExpected);
  await expect(caption).toContainText(expectedFragment ?? expected.slice(0, 150));
  await expect(caption).not.toContainText(authored);
  const actual = await caption.evaluate((element) => {
    const title = element.querySelector('.source-overlay-caption-title')!.textContent!;
    return element.textContent!.replace(title, '').trim();
  });
  await expect
    .poll(() => page.evaluate(() => window.__checkedCaptionMirror.at(-1)?.model?.caption?.text))
    .toBe(actual);
}

const cases: { kind: CheckedCaptionFixture['kind']; name: string; caption: string }[] = [
  {
    kind: 'graph',
    name: 'swapped node distances',
    caption: 'F has distance 0, while A has distance 7.',
  },
  { kind: 'graph', name: 'an earlier tentative distance', caption: 'F is settled at cost 11.' },
  {
    kind: 'graph',
    name: 'a false claim with no numbers',
    caption: 'F is unreachable in this graph.',
  },
  {
    kind: 'circuit',
    name: 'swapped source and ground voltages',
    caption: 'D sits at 12 V, while A is ground at 0 V.',
  },
  {
    kind: 'circuit',
    name: 'current borrowed from a source voltage',
    caption: 'R₅ carries 12 A from B to C.',
  },
];
for (const example of cases)
  test(`checked source and native captions reject ${example.name}`, async ({ page }) => {
    const finish = await open(page, example.kind, example.caption);
    // Every adversarial sentence passes the old global number-membership guard.
    // The displayed calculation must still bind the right quantities to this state.
    expect(await page.evaluate(() => window.__checkedCaptionNumericGuard)).toBe(true);
    await checked(page, example.caption);
    await expect(page.locator('.journal-note')).toContainText(example.caption);
    await expect(page.locator('.journal-note')).toContainText('Explanation by Muse:');
    if (example.name === 'swapped node distances') {
      await expect(page.locator('figure.source-overlay .source-overlay-tag')).toContainText([
        'F = 7',
      ]);
      await page
        .locator('figure.source-overlay')
        .getByRole('button', { name: 'Cut connection D–F, cost 3', exact: true })
        .click();
      await expect(page.locator('figure.source-overlay figcaption')).toContainText('cost 9');
      await checked(page, example.caption, 'cost 9');
      await expect(page.locator('.journal-note')).toHaveCount(0);
      await page
        .locator('figure.source-overlay')
        .getByRole('button', { name: 'Restore connection D–F, cost 3', exact: true })
        .click();
      await checked(page, example.caption);
      await expect(page.locator('figure.source-overlay figcaption')).toContainText('cost 7');
      await expect(page.locator('.journal-note')).toContainText(example.caption);
    }
    await finish();
  });

test('native graph actions recompute the checked route only for this capture and a known edge', async ({
  page,
}) => {
  const finish = await open(page, 'graph', 'F is settled at cost 11.');
  const figure = page.locator('figure.source-overlay');
  const current = () => page.evaluate(() => window.__checkedCaptionMirror.at(-1)?.model);
  const dispatch = (id: string, edgeId: string) =>
    page.evaluate(
      async (detail) => {
        window.dispatchEvent(new CustomEvent('soma:screen-overlay-action', { detail }));
        // Let React commit any response before asserting that rejected actions did nothing.
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      },
      { id, type: 'toggle-edge', edgeId },
    );
  const route = async () => {
    const model = await current();
    return {
      final: model?.final,
      cost: model?.nodes.find((node) => node.id === 'F')?.distance,
      path: model?.edges
        .filter((edge) => edge.tone === 'path')
        .map((edge) => edge.id)
        .sort(),
      cut: model?.edges.filter((edge) => edge.tone === 'cut').map((edge) => edge.id),
    };
  };
  const original = { final: true, cost: 7, path: ['e_AC', 'e_BC', 'e_BD', 'e_DF'], cut: [] };
  await expect.poll(route).toEqual(original);
  const before = await current();
  const count = await page.evaluate(() => window.__checkedCaptionMirror.length);
  await dispatch('another-capture', 'e_DF');
  await dispatch('synthetic-caption-graph', 'unknown-edge');
  expect(await current()).toEqual(before);
  expect(await page.evaluate(() => window.__checkedCaptionMirror.length)).toBe(count);
  await expect(
    figure.getByRole('button', { name: 'Cut connection D–F, cost 3', exact: true }),
  ).toBeVisible();

  // Exercise the real DOM bridge, React state transition, deterministic solver and
  // returned native model together. No precomputed replacement model is injected.
  await dispatch('synthetic-caption-graph', 'e_DF');
  await expect
    .poll(route)
    .toEqual({ final: true, cost: 9, path: ['e_AC', 'e_CE', 'e_EF'], cut: ['e_DF'] });
  await expect(figure.locator('figcaption')).toContainText('cost 9');
  await expect(
    figure.getByRole('button', { name: 'Restore connection D–F, cost 3', exact: true }),
  ).toBeVisible();
  await dispatch('synthetic-caption-graph', 'e_DF');
  await expect.poll(route).toEqual(original);
  await expect(figure.locator('figcaption')).toContainText('cost 7');
  await expect(
    figure.getByRole('button', { name: 'Cut connection D–F, cost 3', exact: true }),
  ).toBeVisible();
  await finish();
});
