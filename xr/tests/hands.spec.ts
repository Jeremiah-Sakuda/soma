import { expect, test, type Page } from '@playwright/test';
import presentation from '../../src/lib/fixtures/recorded-graph-presentation.json' with { type: 'json' };

type Point = { x: number; y: number; z: number };
type Result = { path: string[] | null; cost: number | null; probe: number; caption: string };
type Finding = { baseline: string; result: string; caption: string };
type Desk = Finding & { lab: 'graph' | 'circuit'; pinned: Finding | null };
type InputSource = { handedness: string; hand?: unknown };
type HandEvent = { type: string; inputSource: InputSource };
type IwerDevice = {
  remote: { dispatch(method: string, params: Record<string, unknown>): Promise<unknown> };
  activeSession?: {
    inputSources: Iterable<InputSource>;
    addEventListener(type: string, listener: (event: HandEvent) => void): void;
  };
};
type IwerWindow = Window & { IWER_DEVICE?: IwerDevice; somaHandEvents?: string[] };

const hand = 'hand-right';
const originalRoute = ['A', 'C', 'B', 'D', 'F'];
const alternateRoute = ['A', 'C', 'E', 'F'];

async function command<T>(page: Page, method: string, params: Record<string, unknown> = {}) {
  return page.evaluate(
    ({ method, params }) => {
      const device = (window as IwerWindow).IWER_DEVICE;
      if (!device) throw new Error('IWER did not install in the dev page.');
      return device.remote.dispatch(method, params);
    },
    { method, params },
  ) as Promise<T>;
}

async function readResult(page: Page): Promise<Result | null> {
  const raw = await page.locator('html').getAttribute('data-soma-result');
  return raw ? JSON.parse(raw) : null;
}

async function readDesk(page: Page): Promise<Desk | null> {
  const raw = await page.locator('html').getAttribute('data-soma-desk');
  return raw ? JSON.parse(raw) : null;
}

async function expectRoute(page: Page, path: string[], cost: number) {
  await expect.poll(() => readResult(page)).toMatchObject({ path, cost });
}

async function frame(page: Page) {
  await page.evaluate(async () => {
    for (let i = 0; i < 3; i++) {
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    }
  });
}

// In seated local-floor space, this uses the same slide-to-desk mapping as the scene.
function edgeMidpoint(from: string, to: string): Point {
  const first = presentation.layout.nodes.find(({ nodeId }) => nodeId === from)!;
  const second = presentation.layout.nodes.find(({ nodeId }) => nodeId === to)!;
  const x = (first.x + second.x) / 2;
  const y = (first.y + second.y) / 2;
  return { x: ((x - 0.32) / 0.45) * 0.42, y: 0.88, z: -0.45 + ((y - 0.56) / 0.3) * 0.26 };
}

async function aim(page: Page, target: Point) {
  await command(page, 'look_at', { device: hand, target });
  await frame(page);
}

async function pinch(page: Page, value: 0 | 1) {
  await command(page, 'set_select_value', { device: hand, value, duration: 0.12 });
  await frame(page);
}

async function select(page: Page, point: Point) {
  await aim(page, point);
  await pinch(page, 1);
  await pinch(page, 0);
}

test('IWER hand ray completes both labs and pins a finding', async ({ page }, testInfo) => {
  await page.bringToFront();
  await page.goto('/?diagnostics=1');
  await expectRoute(page, originalRoute, 7);
  await expect
    .poll(() => command(page, 'get_session_status'))
    .toMatchObject({ sessionOffered: true, runtimeKind: 'emulated' });
  await command(page, 'accept_session');
  await expect
    .poll(() => command(page, 'get_session_status'))
    .toMatchObject({
      sessionActive: true,
      sessionMode: 'immersive-vr',
      enabledFeatures: expect.arrayContaining(['hand-tracking', 'local-floor']),
    });

  await command(page, 'set_input_mode', { mode: 'hand' });
  await command(page, 'set_connected', { device: 'controller-left', connected: false });
  await command(page, 'set_connected', { device: 'controller-right', connected: false });
  await command(page, 'set_connected', { device: 'hand-left', connected: false });
  await command(page, 'set_connected', { device: hand, connected: true });
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(
          (window as IwerWindow).IWER_DEVICE?.activeSession?.inputSources ?? [],
          (source) => ({ handedness: source.handedness, hand: Boolean(source.hand) }),
        ),
      ),
    )
    .toEqual([{ handedness: 'right', hand: true }]);

  // Observe real XRSession events. All control goes through IWER's frame-synced
  // device commands, so application pointer listeners and the lab see normal input.
  await page.evaluate(() => {
    const iwerWindow = window as IwerWindow;
    const events: string[] = [];
    iwerWindow.somaHandEvents = events;
    const session = iwerWindow.IWER_DEVICE!.activeSession!;
    for (const type of ['selectstart', 'selectend']) {
      session.addEventListener(type, (event) => {
        events.push(
          `${event.type}:${event.inputSource.handedness}:${Boolean(event.inputSource.hand)}`,
        );
      });
    }
  });
  await command(page, 'set_transform', { device: 'headset', position: { x: 0, y: 1.15, z: 0 } });
  await command(page, 'look_at', { device: 'headset', target: { x: 0, y: 0.91, z: -0.55 } });
  // Aim from above the front-row controls so they do not intercept the ray to B–D.
  await command(page, 'set_transform', { device: hand, position: { x: 0.16, y: 1.2, z: 0.04 } });

  await select(page, edgeMidpoint('B', 'D'));
  await expect
    .poll(() => page.evaluate(() => (window as IwerWindow).somaHandEvents))
    .toEqual(['selectstart:right:true', 'selectend:right:true']);
  await expectRoute(page, alternateRoute, 9);
  const cut = (await readResult(page))!;
  expect(cut.caption).toContain('Cut B–D.');

  // Reconnect before the probe experiment so its independent effect is visible.
  await select(page, edgeMidpoint('B', 'D'));
  await expectRoute(page, originalRoute, 7);
  const [x, y, z] = JSON.parse(
    (await page.locator('html').getAttribute('data-soma-bead'))!,
  ) as number[];
  await aim(page, { x, y, z });
  await pinch(page, 1);
  await aim(page, { x, y: y + 0.05, z });
  await pinch(page, 0);
  await expect.poll(async () => (await readResult(page))?.probe ?? 0).toBeGreaterThan(5);
  await expectRoute(page, alternateRoute, 9);
  const dragged = (await readResult(page))!;

  const pin = { x: 0.08, y: 0.944, z: -0.66 };
  const original = 'A → C → B → D → F · cost 7';
  const changed = 'A → C → E → F · cost 9';
  await select(page, pin);
  await expect
    .poll(() => readDesk(page))
    .toMatchObject({ lab: 'graph', pinned: { baseline: original, result: changed } });

  await select(page, { x: 0.27, y: 0.944, z: -0.66 });
  await expectRoute(page, originalRoute, 7);
  const reset = (await readResult(page))!;
  expect(reset.probe).toBe(3);
  expect(reset.caption).toContain('Reset to the recorded graph.');
  await select(page, pin);
  await expectRoute(page, alternateRoute, 9);
  expect((await readResult(page))?.probe).toBe(dragged.probe);
  await select(page, { x: 0.27, y: 0.944, z: -0.66 });
  await expectRoute(page, originalRoute, 7);

  await select(page, { x: -0.07, y: 0.944, z: -0.66 });
  await expect
    .poll(() => readDesk(page))
    .toMatchObject({ lab: 'circuit', result: 'R4 8 Ω · R5 0 A' });
  const circuit = [];
  for (const { x, result } of [
    { x: -0.1, result: 'R4 4 Ω · R5 0.24 A B → C' },
    { x: 0.1, result: 'R4 16 Ω · R5 ≈ 0.1678 A C → B' },
    { x: 0, result: 'R4 8 Ω · R5 0 A' },
  ]) {
    // The three preset controls sit on the front edge of the bridge tray.
    await select(page, { x, y: 0.88, z: -0.275 });
    await expect.poll(() => readDesk(page)).toMatchObject({ lab: 'circuit', result });
    circuit.push(await readDesk(page));
  }
  await testInfo.attach('immersive-circuit-view', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await select(page, { x: -0.21, y: 0.944, z: -0.66 });
  await expect
    .poll(() => readDesk(page))
    .toMatchObject({
      lab: 'graph',
      result: original,
      pinned: { baseline: original, result: changed },
    });
  const timing = JSON.parse((await page.locator('#frame-report').textContent())!);
  expect(timing).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        lab: 'graph',
        status: 'complete',
        sampleCount: expect.any(Number),
      }),
      expect.objectContaining({
        lab: 'circuit',
        status: 'complete',
        sampleCount: expect.any(Number),
      }),
    ]),
  );
  expect(timing.every((entry: { sampleCount: number }) => entry.sampleCount > 0)).toBe(true);
  const events = await page.evaluate(() => (window as IwerWindow).somaHandEvents);
  expect(events).toEqual(
    Array.from({ length: 12 }).flatMap(() => ['selectstart:right:true', 'selectend:right:true']),
  );
  await testInfo.attach('iwer-hand-results', {
    body: JSON.stringify({ cut, dragged, reset, circuit, events, timing }, null, 2),
    contentType: 'application/json',
  });
  await testInfo.attach('immersive-hand-view', {
    body: await page.screenshot(),
    contentType: 'image/png',
  });

  await page.reload();
  await expect
    .poll(() => readDesk(page))
    .toMatchObject({
      lab: 'graph',
      result: original,
      pinned: { baseline: original, result: changed },
    });
});
