import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuditEventInput, AuditFinish } from '../../src/lib/domain/audit';
import type { WorkspaceState } from '../../src/lib/domain/types';
import { seedWorkspace } from '../../src/lib/domain/seed';

const boundary = vi.hoisted(() => ({
  state: null as WorkspaceState | null, enabled: true,
  prepare: vi.fn(), create: vi.fn(), append: vi.fn(), finish: vi.fn(), update: vi.fn(),
}));
vi.mock('../../src/lib/server/workspace-access', () => ({
  resolveWorkspaceAccess: async () => ({ kind: 'demo', token: 'a'.repeat(64) }),
  readWorkspaceByAccess: async () => structuredClone(boundary.state),
  updateWorkspaceByAccess: (...args: unknown[]) => boundary.update(...args),
}));
vi.mock('../../src/lib/server/budget', async original => ({ ...await original<typeof import('../../src/lib/server/budget')>(), inferenceEnabled: () => boundary.enabled }));
vi.mock('../../src/lib/server/meta', async original => ({ ...await original<typeof import('../../src/lib/server/meta')>(), prepareWithSpark: (...args: unknown[]) => boundary.prepare(...args) }));
vi.mock('../../src/lib/server/audit-store', async original => ({ ...await original<typeof import('../../src/lib/server/audit-store')>(), createAuditRun: (...args: unknown[]) => boundary.create(...args) }));
import { POST } from '../../src/app/api/actions/route';
import { AuditStoreError } from '../../src/lib/server/audit-store';
import { PreparationError } from '../../src/lib/server/meta';
import { InferenceBudgetError } from '../../src/lib/server/budget';
import { WorkspaceConflictError } from '../../src/lib/server/store';

const request = () => new Request('https://soma.example/api/actions', { method: 'POST', headers: { origin: 'https://soma.example', 'content-type': 'application/json' }, body: JSON.stringify({ type: 'request-lesson', courseId: 'probability', topic: 'Independent probability practice' }) });
const events = () => boundary.append.mock.calls.map(call => call[0] as AuditEventInput);
const finishes = () => boundary.finish.mock.calls.map(call => call[0] as AuditFinish);
beforeEach(() => {
  vi.clearAllMocks(); boundary.enabled = true; boundary.state = seedWorkspace('audit-route');
  boundary.append.mockResolvedValue(undefined); boundary.finish.mockResolvedValue(undefined);
  boundary.create.mockImplementation(async () => ({ id: 'audit-route', append: boundary.append, finish: boundary.finish }));
  boundary.update.mockImplementation(async (_access, mutate, revision) => {
    if (revision !== undefined && revision !== boundary.state!.revision) throw new WorkspaceConflictError();
    boundary.state = await mutate(structuredClone(boundary.state)); boundary.state!.revision++;
    return structuredClone(boundary.state);
  });
  boundary.prepare.mockImplementation(async () => {
    const lesson = { ...boundary.state!.lessons.find(item => item.courseId === 'probability')!, id: 'audited-live-lesson', mode: 'live' as const };
    return { lesson, run: { id: 'audited-live-run', trigger: 'Synthetic test boundary', mode: 'live', status: 'completed', createdAt: new Date().toISOString(), steps: [], effect: 'Synthetic result', sourceIds: lesson.sourceIds } };
  });
});

describe('direct preparation audit publication boundary', () => {
  it('finishes publication only after the workspace commit and passes the same writer into the engine', async () => {
    boundary.finish.mockImplementation(async () => { expect(boundary.state!.lessons.some(item => item.id === 'audited-live-lesson')).toBe(true); });
    expect((await POST(request())).status).toBe(200);
    expect(boundary.prepare.mock.calls[0][3].audit.id).toBe('audit-route');
    expect(finishes()).toEqual([{ status: 'published', selectedLessonId: 'audited-live-lesson', publishedLessonId: 'audited-live-lesson' }]);
    expect(events().some(event => event.kind === 'publication')).toBe(true);
  });

  it('does not run inference or fallback when the audit journal cannot be created', async () => {
    boundary.create.mockRejectedValue(new AuditStoreError('Audit unavailable.', 503, 'audit_storage_failed'));
    expect((await POST(request())).status).toBe(503);
    expect(boundary.prepare).not.toHaveBeenCalled(); expect(boundary.update).not.toHaveBeenCalled();
  });

  it('does not fall back or publish when the engine stops because audit append failed', async () => {
    boundary.prepare.mockRejectedValue(new AuditStoreError('Audit unavailable.', 503, 'audit_storage_failed'));
    expect((await POST(request())).status).toBe(503);
    expect(boundary.update).not.toHaveBeenCalled(); expect(boundary.finish).not.toHaveBeenCalled();
  });

  it('keeps a stale publication trace without claiming that the generated proposal was saved', async () => {
    boundary.update.mockRejectedValue(new WorkspaceConflictError());
    expect((await POST(request())).status).toBe(409);
    expect(events().some(event => event.kind === 'publication')).toBe(false);
    expect(finishes().at(-1)).toEqual({ status: 'failed' });
    expect(boundary.state!.lessons.some(item => item.id === 'audited-live-lesson')).toBe(false);
  });

  it('returns the committed activity and an explicit incomplete-audit notice when final journaling fails', async () => {
    boundary.finish.mockRejectedValue(new AuditStoreError('Audit unavailable.', 503, 'audit_storage_failed'));
    const response = await POST(request()), body = await response.json();
    expect(response.status).toBe(200); expect(body.notice).toContain('final audit confirmation could not be recorded');
    expect(body.workspace.lessons.some((item: { id: string }) => item.id === 'audited-live-lesson')).toBe(true);
    expect(boundary.update).toHaveBeenCalledTimes(1);
  });

  it('retains the failed model outcome while separately recording the prepared fallback commit', async () => {
    boundary.prepare.mockRejectedValue(new PreparationError({ id: 'failed-model', trigger: 'Synthetic test', mode: 'live', status: 'failed', createdAt: new Date().toISOString(), steps: [], effect: 'Bounded failure', sourceIds: [] }));
    const response = await POST(request()); expect(response.status).toBe(200);
    expect(finishes().at(-1)).toEqual({ status: 'failed', mode: 'prepared' });
    expect(events().some(event => event.kind === 'stopped')).toBe(true);
    expect(events().some(event => event.kind === 'publication' && event.summary.includes('No new live lesson'))).toBe(true);
    expect(boundary.state!.runs.some(run => run.id === 'failed-model')).toBe(true);
  });

  it('records an allowance stop and prepared fallback without another inference attempt', async () => {
    boundary.prepare.mockRejectedValue(new InferenceBudgetError('global'));
    expect((await POST(request())).status).toBe(200);
    expect(finishes().at(-1)).toEqual({ status: 'blocked', mode: 'prepared' });
    expect(boundary.prepare).toHaveBeenCalledTimes(1);
  });

  it('records disabled inference as prepared execution without calling the model', async () => {
    boundary.enabled = false;
    expect((await POST(request())).status).toBe(200);
    expect(boundary.prepare).not.toHaveBeenCalled();
    expect(finishes()).toEqual([{ status: 'unchanged', mode: 'prepared' }]);
    expect(events().some(event => event.kind === 'decision' && event.summary.includes('without a model call'))).toBe(true);
  });
});
