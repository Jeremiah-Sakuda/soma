import { expect, test, type Page } from '@playwright/test';
import { Object3D, PerspectiveCamera, Vector3 } from 'three';
import presentation from '../../src/lib/fixtures/recorded-graph-presentation.json' with { type: 'json' };

type Result = { path: string[] | null; cost: number | null; probe: number; caption: string };
type Point = { x: number; y: number };

const originalRoute = ['A', 'C', 'B', 'D', 'F'];
const alternateRoute = ['A', 'C', 'E', 'F'];

async function result(page: Page): Promise<Result | null> {
  const raw = await page.locator('html').getAttribute('data-soma-result');
  return raw ? JSON.parse(raw) : null;
}

// Mirror the authored world-space layout in xr/src/main.ts, not viewport-specific pixels.
// The installed IWSDK 1.1.0-rc.2 defaults to a 50° vertical FOV, near .1, far 200.
// If the scene/camera changes, update this projection contract along with the test.
function nodePosition(id: string): Vector3 {
  const node = presentation.layout.nodes.find((node) => node.nodeId === id);
  if (!node) throw new Error(`Missing recorded node ${id}`);
  return new Vector3(
    ((node.x - 0.32) / 0.45) * 0.42,
    0.74 + 0.14,
    -0.45 + ((node.y - 0.56) / 0.3) * 0.26,
  );
}

async function project(page: Page, worldPoint: Vector3): Promise<Point> {
  const canvas = await page.locator('#app > canvas').boundingBox();
  if (!canvas) throw new Error('The rendered canvas must be visible.');
  const camera = new PerspectiveCamera(50, canvas.width / canvas.height, 0.1, 200);
  camera.position.set(0, 1.15, 0);
  camera.lookAt(0, 0.74 + 0.12, -0.55);
  camera.updateMatrixWorld(true);
  const ndc = worldPoint.clone().project(camera);
  expect(ndc.z, 'Target must be in front of the camera').toBeGreaterThan(-1);
  expect(ndc.z).toBeLessThan(1);
  const screen = {
    x: canvas.x + ((ndc.x + 1) / 2) * canvas.width,
    y: canvas.y + ((1 - ndc.y) / 2) * canvas.height,
  };
  expect(screen.x).toBeGreaterThan(canvas.x);
  expect(screen.x).toBeLessThan(canvas.x + canvas.width);
  expect(screen.y).toBeGreaterThan(canvas.y);
  expect(screen.y).toBeLessThan(canvas.y + canvas.height);
  return screen;
}

// IWSDK resolves pointers during the frame loop. Let it process each actual mouse action
// before the next action; no synthetic dispatch, lab calls, or dataset writes are used.
async function frames(page: Page, count = 3) {
  await page.evaluate(async (count) => {
    for (let i = 0; i < count; i++)
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }, count);
}

async function press(page: Page, point: Point) {
  await page.mouse.move(point.x, point.y);
  await frames(page);
  await page.mouse.down();
  await frames(page);
}
async function release(page: Page) {
  await page.mouse.up();
  await frames(page);
}

async function expectRoute(page: Page, path: string[], cost: number) {
  await expect
    .poll(async () => {
      const state = await result(page);
      return state && { path: state.path, cost: state.cost };
    })
    .toEqual({ path, cost });
}

test('production lab cuts an edge, drags the probe, and resets using the mouse', async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.bringToFront();
  await page.goto('/');
  await expect(page).toHaveTitle('Soma Lab');
  expect(await page.evaluate(() => document.visibilityState)).toBe('visible');
  // Production assets, not the dev server or its injected emulator.
  await expect(page.locator('script[src*="/assets/"]')).toHaveCount(1);
  await expect(page.locator('script[src*="/@vite/client"]')).toHaveCount(0);
  await expectRoute(page, originalRoute, 7);
  const initial = (await result(page))!;
  expect(initial.probe).toBe(3);
  expect(initial.caption).toContain('cost 7');

  const edgePoint = await project(
    page,
    nodePosition('B').add(nodePosition('D')).multiplyScalar(0.5),
  );
  await press(page, edgePoint);
  // The edge commits on release, not press.
  await expectRoute(page, originalRoute, 7);
  await release(page);
  await expectRoute(page, alternateRoute, 9);
  const cut = (await result(page))!;
  expect(cut.caption).toContain('Cut B–D.');
  expect(cut.caption).toContain('cost 9');
  expect(cut.probe).toBe(3);

  await page.reload();
  await page.bringToFront();
  await expectRoute(page, originalRoute, 7);
  await expect(page.locator('html')).toHaveAttribute('data-soma-bead', /^\[/);
  const bead = new Vector3().fromArray(
    JSON.parse((await page.locator('html').getAttribute('data-soma-bead'))!),
  );
  const start = await project(page, bead);
  // The authored rail maps 10 cm to costs 0..10. Moving 5 cm up from cost 3
  // crosses the recorded threshold 5 and targets 8, without depending on screen size.
  const end = await project(page, bead.clone().add(new Vector3(0, 0.05, 0)));
  expect(end.y).toBeLessThan(start.y);
  await press(page, start);
  for (let i = 1; i <= 12; i++) {
    await page.mouse.move(
      start.x + ((end.x - start.x) * i) / 12,
      start.y + ((end.y - start.y) * i) / 12,
    );
    await frames(page, 2);
  }
  await release(page);
  await expect.poll(async () => (await result(page))?.probe ?? 0).toBeGreaterThan(5);
  await expectRoute(page, alternateRoute, 9);
  const dragged = (await result(page))!;
  expect(dragged.caption).toContain('D–F cost changed');
  expect(dragged.caption).toContain('cost 9');
  const movedBead = JSON.parse(
    (await page.locator('html').getAttribute('data-soma-bead'))!,
  ) as number[];
  expect(movedBead[1]).toBeGreaterThan(bead.y);

  // Reset's centre falls just below this desktop camera's view. Target an actual point
  // on the visible upper face (14 mm above centre; plaque height is 35 mm), transformed
  // by the same lookAt as the scene. This is geometry, not a guessed pixel coordinate.
  const reset = new Object3D();
  reset.position.set(-0.3, 0.74 + 0.03, -0.28);
  reset.lookAt(0, 1.15, 0);
  reset.updateMatrixWorld(true);
  const resetPoint = await project(page, reset.localToWorld(new Vector3(0, 0.014, 0)));
  await press(page, resetPoint);
  await release(page);
  await expectRoute(page, originalRoute, 7);
  const restored = (await result(page))!;
  expect(restored.probe).toBe(3);
  expect(restored.caption).toContain('Reset to the recorded graph.');
  await expect
    .poll(async () => JSON.parse((await page.locator('html').getAttribute('data-soma-bead'))!))
    .toEqual(bead.toArray());
  expect(errors).toEqual([]);

  await testInfo.attach('mouse-lab-results', {
    body: JSON.stringify(
      { initial, cut, dragged, restored, targets: { edgePoint, start, end, resetPoint } },
      null,
      2,
    ),
    contentType: 'application/json',
  });
  await testInfo.attach('reset-view', { body: await page.screenshot(), contentType: 'image/png' });
});
