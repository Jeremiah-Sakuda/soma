import { afterEach, describe, expect, it, vi } from 'vitest';
import { verifyWorkerRequest, assertTrustedWorker, type TrustedWorker } from '../../src/lib/server/worker-auth';
import { connectionDue, connectionRefreshInterval, connectionScopeFingerprint, retryDelayMs, SOURCE_REFRESH_MS } from '../../src/lib/server/worker';
import { POST } from '../../src/app/api/internal/worker/route';
import type { PublicConnection } from '../../src/lib/server/connectors/store';
import { automaticPreparationSources } from '../../src/lib/server/jobs';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';

afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const request = (token?: string, body?: string) => new Request('https://soma.example/api/internal/worker', { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, ...(body !== undefined ? { body } : {}) });
const token = 'original-synthetic-worker-test-token-123456789';
function enable() { vi.stubEnv('SOMA_WORKER_ENABLED', 'true'); vi.stubEnv('SOMA_WORKER_SECRET', token); }
describe('scheduled worker authentication and due work', () => {
  it('requires explicit activation and the full bearer secret, not a user identity or cookie', () => {
    vi.stubEnv('SOMA_WORKER_ENABLED', 'false'); vi.stubEnv('SOMA_WORKER_SECRET', token);
    expect(() => verifyWorkerRequest(request(token))).toThrow();
    enable();
    for (const input of [request(), request(token.slice(1)), request('uid-worker'), new Request('https://soma.example', { headers: { cookie: `soma_account=${token}` } })]) expect(() => verifyWorkerRequest(input)).toThrow();
    expect(() => assertTrustedWorker({ expiresAt: Date.now() + 10_000 } as TrustedWorker)).toThrow();
    const verified = verifyWorkerRequest(request(token));
    expect(() => assertTrustedWorker(verified)).not.toThrow();
    vi.spyOn(Date, 'now').mockReturnValue(verified.expiresAt);
    expect(() => assertTrustedWorker(verified)).toThrow();
  });
  it('rejects account selection at the HTTP boundary before any database or job action', async () => {
    enable();
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request(token, '{"uid":"another-account"}'))).status).toBe(400);
    expect((await POST(request(token, 'x'.repeat(33)))).status).toBe(400);
  });
  const connection: PublicConnection = { id: 'google-gmail', provider: 'gmail', workspaceId: 'original-synthetic-workspace', version: 1, status: 'current', configuration: { queries: [{ courseId: 'original-course', query: 'subject:original' }], nextQueryIndex: 0 } };
  it('does not refresh on lease versions or query rotation; changed selection invalidates schedule', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    const schedule = { [connection.id]: { scope: connectionScopeFingerprint(connection), nextAt: now + SOURCE_REFRESH_MS, failures: 0, lastAttemptAt: new Date(now).toISOString(), outcome: 'completed' } };
    expect(connectionDue({ ...connection, version: 8, configuration: { ...connection.configuration, nextQueryIndex: 1 } }, schedule, now + 60_000)).toBe(false);
    expect(connectionDue(connection, schedule, now + SOURCE_REFRESH_MS)).toBe(true);
    expect(connectionDue({ ...connection, configuration: { queries: [{ courseId: 'original-course', query: 'subject:changed' }] } }, schedule, now + 60_000)).toBe(true);
  });
  it('rotates selected Gmail queries within the same six-hour target instead of six hours per query', () => {
    const selected = { ...connection, configuration: { queries: Array.from({ length: 5 }, (_, i) => ({ courseId: `course-${i}`, query: `subject:fixture-${i}` })) } };
    const now = Date.parse('2026-10-28T12:00:00Z');
    expect(connectionRefreshInterval(selected)).toBe(SOURCE_REFRESH_MS / 5);
    expect(connectionDue({ ...selected, lastSuccessAt: new Date(now).toISOString() }, undefined, now + SOURCE_REFRESH_MS / 5 - 1)).toBe(false);
    expect(connectionDue({ ...selected, lastSuccessAt: new Date(now).toISOString() }, undefined, now + SOURCE_REFRESH_MS / 5)).toBe(true);
    expect(connectionRefreshInterval({ ...selected, provider: 'calendar' })).toBe(SOURCE_REFRESH_MS);
  });
  it('respects manual success, missing scope and reconnect states, and bounds failure backoff', () => {
    const now = Date.parse('2026-10-28T12:00:00Z');
    const schedule = { [connection.id]: { scope: connectionScopeFingerprint(connection), nextAt: now, failures: 0, lastAttemptAt: new Date(now - SOURCE_REFRESH_MS).toISOString(), outcome: 'completed' } };
    expect(connectionDue({ ...connection, lastSuccessAt: new Date(now - 60_000).toISOString() }, schedule, now)).toBe(false);
    for (const status of ['connecting', 'login-required', 'disconnected'] as const) expect(connectionDue({ ...connection, status }, undefined, now)).toBe(false);
    expect(connectionDue({ ...connection, configuration: {} }, undefined, now)).toBe(false);
    expect(retryDelayMs(2)).toBeGreaterThan(retryDelayMs(1));
    expect(retryDelayMs(100)).toBe(SOURCE_REFRESH_MS);
  });
  it('never backfills inference consent for legacy or administratively transferred sources', () => {
    const state = seedEmptyAccountWorkspace('original-synthetic-consent');
    state.courses = [{ id: 'course', code: 'SYN', title: 'Original fixture', instructor: '', color: '#123456', deadline: '', nextEvent: '' }];
    const source = { id: 'legacy', version: 1, courseId: 'course', title: 'Original fixture', body: 'Original synthetic material.', kind: 'upload' as const, status: 'current' as const, retrievedAt: state.createdAt };
    state.sources = [source, { ...source, id: 'legacy-live', origin: 'live' }, { ...source, id: 'approved', provenance: { automaticPreparation: true, origin: 'manual-course', sourceKey: 'fixture', contentHash: 'fixture', importedAt: state.createdAt } }];
    expect(automaticPreparationSources(state).map(item => item.id)).toEqual(['approved']);
    state.sources.push({ ...state.sources[2], version: 2, status: 'stale' });
    expect(automaticPreparationSources(state)).toEqual([]);
  });
});
