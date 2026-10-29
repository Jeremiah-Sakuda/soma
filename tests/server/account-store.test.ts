import { describe, expect, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { accountRecordChanges, decodeAccountRecords, encodeAccountRecords, readAccountWorkspace, updateAccountWorkspace, deleteAccountWorkspace } from '../../src/lib/server/account-store';
import type { VerifiedAccount } from '../../src/lib/server/account';

describe('private account record boundaries', () => {
  it('rejects fabricated UID capabilities before accessing persistence', async () => {
    const fabricated = { uid: 'victim-user' } as VerifiedAccount;
    await expect(readAccountWorkspace(fabricated)).rejects.toMatchObject({ status: 401 });
    await expect(updateAccountWorkspace(fabricated, state => state)).rejects.toMatchObject({ status: 401 });
    await expect(deleteAccountWorkspace(fabricated)).rejects.toMatchObject({ status: 401 });
  });

  it('stores source versions as separate records and round-trips Unicode plus optional maps', () => {
    const workspace = seedEmptyAccountWorkspace('test-account');
    workspace.sources = [1, 2].map(version => ({ id: 'source-a', courseId: 'circuits', version, title: 'Ω and 学習', body: `version ${version}`, kind: 'upload', status: version === 1 ? 'stale' : 'current', retrievedAt: workspace.createdAt }));
    workspace.assistance = { lessonA: ['hint', 'explanation'] };
    const encoded = encodeAccountRecords(workspace);
    expect(Object.keys(encoded.groups.sources.records)).toHaveLength(2);
    expect(encoded.summary).not.toHaveProperty('sources');
    expect(encoded.summary).not.toHaveProperty('assistance');
    expect(decodeAccountRecords(encoded)).toEqual(workspace);
  });

  it('changes only the affected evidence record, preserving independent records', () => {
    const original = seedEmptyAccountWorkspace('test-account');
    original.sources = [1, 2, 3].map(index => ({ id: `source-${index}`, courseId: 'circuits', version: 1, title: 'Original fixture', body: 'original synthetic test text', kind: 'upload', status: 'current', retrievedAt: original.createdAt }));
    const changed = structuredClone(original);
    changed.sources[1].status = 'stale';
    const changes = accountRecordChanges(encodeAccountRecords(original), encodeAccountRecords(changed));
    expect(changes).toHaveLength(1);
    expect(changes[0].group).toBe('sources');
    expect((changes[0].record?.value as { id: string }).id).toBe('source-2');
  });

  it('bounds atomic write size without imposing a five-course or ten-account limit', () => {
    const original = seedEmptyAccountWorkspace('test-account');
    const many = structuredClone(original);
    many.sources = Array.from({ length: 451 }, (_, index) => ({ id: `source-${index}`, courseId: 'course', version: 1, title: 'Synthetic test fixture', body: 'test', kind: 'upload', status: 'current', retrievedAt: original.createdAt }));
    const encoded = encodeAccountRecords(many);
    expect(Object.keys(encoded.groups.sources.records)).toHaveLength(451);
    expect(() => accountRecordChanges(encodeAccountRecords(original), encoded)).toThrow('smaller batch');
  });

  it('starts private accounts empty, with no imported demonstration evidence', () => {
    const workspace = seedEmptyAccountWorkspace('test-account');
    expect(workspace.mode).toBe('account');
    for (const key of ['courses', 'sources', 'lessons', 'attempts', 'runs', 'interpretations'] as const) expect(workspace[key]).toHaveLength(0);
  });
});
