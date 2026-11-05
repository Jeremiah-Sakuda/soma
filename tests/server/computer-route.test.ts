import { beforeEach, it, expect, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ resolve: vi.fn(), plan: vi.fn() }));
vi.mock('../../src/lib/server/exploration-store', async () => {
  const actual = await vi.importActual('../../src/lib/server/exploration-store');
  return { ...actual, resolveExplorationPrincipal: mocks.resolve };
});
vi.mock('../../src/lib/server/computer-actions', () => ({
  planComputerAction: mocks.plan,
}));
import { POST } from '../../src/app/api/explore/computer/route';
beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolve.mockResolvedValue({ principal: { key: 'synthetic' } });
  mocks.plan.mockResolvedValue({
    plan: { kind: 'clarify' },
    audit: { executed: false },
  });
});
const request = (body: string, origin = 'https://soma.example', type = 'application/json') =>
  new Request('https://soma.example/api/explore/computer', {
    method: 'POST',
    headers: { origin, 'content-type': type },
    body,
  });
it('rejects cross-origin requests before ownership lookup or model planning', async () => {
  expect((await POST(request('{}', 'https://elsewhere.example'))).status).toBe(403);
  expect(mocks.resolve).not.toHaveBeenCalled();
  expect(mocks.plan).not.toHaveBeenCalled();
});
it('uses shared streaming JSON size and content-type enforcement', async () => {
  expect((await POST(request('x'.repeat(18001)))).status).toBe(413);
  expect((await POST(request('{}', 'https://soma.example', 'text/plain'))).status).toBe(415);
  expect((await POST(request('not json'))).status).toBe(400);
  expect(mocks.plan).not.toHaveBeenCalled();
});
it('never exposes internal errors and returns private no-store proposals', async () => {
  const good = await POST(request('{}'));
  expect(good.status).toBe(200);
  expect(good.headers.get('cache-control')).toBe('private, no-store');
  mocks.plan.mockRejectedValue(Error('private provider secret'));
  const bad = await POST(request('{}'));
  expect(bad.status).toBe(503);
  expect(await bad.text()).not.toContain('secret');
});
