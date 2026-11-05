import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const fixture = vi.hoisted(() => ({ purge: vi.fn(), tick: vi.fn() }));
vi.mock('../../src/lib/server/audit-store', () => ({ purgeExpiredDemoAuditData: fixture.purge }));
vi.mock('../../src/lib/server/worker', () => ({ runWorkerTick: fixture.tick }));
import { POST } from '../../src/app/api/internal/worker/route';
const secret = 'synthetic-maintenance-capability-1234567890';
const request = (body = '{}', authorized = true) =>
  new Request('https://soma.example/api/internal/worker', {
    method: 'POST',
    body,
    headers: authorized ? { Authorization: `Bearer ${secret}` } : {},
  });
beforeEach(() => {
  vi.stubEnv('SOMA_WORKER_ENABLED', 'true');
  vi.stubEnv('SOMA_WORKER_SECRET', secret);
  fixture.purge.mockReset().mockResolvedValue(2);
  fixture.tick.mockReset().mockResolvedValue({ processed: 0 });
});
afterEach(() => vi.unstubAllEnvs());
describe('worker audit retention maintenance', () => {
  it('authenticates and rejects caller scope before cleanup or source work', async () => {
    expect((await POST(request('{}', false))).status).toBe(401);
    expect((await POST(request('{"workspaceId":"foreign"}'))).status).toBe(400);
    expect(fixture.purge).not.toHaveBeenCalled();
    expect(fixture.tick).not.toHaveBeenCalled();
  });
  it('bounds expired demo cleanup and continues trusted worker work', async () => {
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 0, auditMaintenance: 'completed' });
    expect(fixture.purge).toHaveBeenCalledExactlyOnceWith(2);
    expect(fixture.tick).toHaveBeenCalledOnce();
  });
  it('reports deferred cleanup without blocking selected-source work', async () => {
    fixture.purge.mockRejectedValue(new Error('temporary index failure'));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ processed: 0, auditMaintenance: 'deferred' });
    expect(fixture.tick).toHaveBeenCalledOnce();
    expect(JSON.stringify(await POST(request()))).not.toContain('temporary index failure');
  });
});
