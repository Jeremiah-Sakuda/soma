import { describe, expect, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { jobSourcesCurrent, mayClaimJob, preparationJobId, type PreparationJob } from '../../src/lib/server/jobs';

describe('preparation ownership and restart contracts', () => {
  const workspace = seedEmptyAccountWorkspace('workspace-a', '2026-10-28T12:00:00Z');
  workspace.courses = [{ id: 'course-a', code: 'TEST', title: 'Original synthetic test', instructor: '', color: '#2244C2', deadline: '', nextEvent: '' }];
  workspace.sources = [{ id: 'source-a', version: 1, courseId: 'course-a', title: 'Original fixture', body: 'Original fixture', kind: 'upload', retrievedAt: workspace.createdAt, status: 'current' }];
  const job: PreparationJob = { id: 'job', ownerId: 'owner-a', workspaceId: workspace.id, courseId: 'course-a', topic: 'Resistors', sourceRefs: [{ sourceId: 'source-a', version: 1 }], status: 'queued', createdAt: workspace.createdAt, updatedAt: workspace.createdAt, attempts: 0, contextRevision: 0 };

  it('does not permit publication against another workspace, course, stale version or missing source', () => {
    expect(jobSourcesCurrent(workspace, job)).toBe(true);
    expect(jobSourcesCurrent(workspace, { ...job, workspaceId: 'workspace-b' })).toBe(false);
    expect(jobSourcesCurrent(workspace, { ...job, courseId: 'course-b' })).toBe(false);
    expect(jobSourcesCurrent(workspace, { ...job, sourceRefs: [{ sourceId: 'source-a', version: 2 }] })).toBe(false);
    expect(jobSourcesCurrent(workspace, { ...job, sourceRefs: [] })).toBe(false);
    expect(jobSourcesCurrent({ ...workspace, sources: workspace.sources.map(source => ({ ...source, status: 'stale' })) }, job)).toBe(false);
  });

  it('deduplicates unchanged jobs while distinguishing new source versions and accounts', () => {
    const first = preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic);
    expect(preparationJobId(structuredClone(workspace), job.courseId, job.sourceRefs, job.topic)).toBe(first);
    expect(preparationJobId({ ...workspace, id: 'workspace-b' }, job.courseId, job.sourceRefs, job.topic)).not.toBe(first);
    expect(preparationJobId(workspace, job.courseId, [{ sourceId: 'source-a', version: 2 }], job.topic)).not.toBe(first);
    expect(preparationJobId({ ...workspace, revision: 1 }, job.courseId, job.sourceRefs, job.topic)).not.toBe(first);
    const connectorJob = preparationJobId(workspace, job.courseId, job.sourceRefs, job.topic, 0);
    expect(preparationJobId({ ...workspace, revision: 8 }, job.courseId, job.sourceRefs, job.topic, 0)).toBe(connectorJob);
    expect(preparationJobId(workspace, job.courseId, [{ sourceId: 'source-a', version: 2 }], job.topic, 0)).not.toBe(connectorJob);
  });

  it('recovers expired work without stealing active leases or exceeding restart bounds', () => {
    expect(mayClaimJob({ ...job, status: 'generating', attempts: 1, leaseUntil: 2000 }, 1000)).toBe(false);
    expect(mayClaimJob({ ...job, status: 'generating', attempts: 1, leaseUntil: 1000 }, 1000)).toBe(true);
    expect(mayClaimJob({ ...job, status: 'checking', attempts: 3, leaseUntil: 1000 }, 1000)).toBe(false);
    expect(mayClaimJob({ ...job, status: 'ready' }, 1000)).toBe(false);
    expect(mayClaimJob({ ...job, status: 'stale' }, 1000)).toBe(false);
  });
});
