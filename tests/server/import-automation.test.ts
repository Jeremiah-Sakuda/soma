import { expect, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { applySourceImport, sourceImportSchema } from '../../src/lib/server/imports';
import { importWithAutomation, needsImportAutomationConsent } from '../../src/lib/server/import-automation';

it('does not opt a newer administrative version into automation when the user retries an older import receipt', () => {
  const old = sourceImportSchema.parse({ kind: 'course-text', importId: 'old-selected-import', expectedRevision: 0, sourceKey: 'same-course-note', title: 'Original synthetic note', text: 'Original selected synthetic teaching material.', course: { id: 'course', code: 'SYN', title: 'Synthetic course' } });
  const first = applySourceImport(seedEmptyAccountWorkspace('receipt-consent'), old).workspace;
  const next = { ...old, importId: 'new-admin-import', text: 'Newer administrative material not selected for automatic processing.' };
  const newer = applySourceImport(first, next).workspace;
  expect(needsImportAutomationConsent(newer, old)).toBe(false);
  const retried = importWithAutomation(newer, old);
  expect(retried.sources.every(source => !source.provenance?.automaticPreparation)).toBe(true);
  expect(needsImportAutomationConsent(newer, next)).toBe(true);
  const selected = importWithAutomation(newer, next);
  expect(selected.sources.find(source => source.status === 'current')?.provenance?.automaticPreparation).toBe(true);
  expect(selected.sources.find(source => source.status === 'stale')?.provenance?.automaticPreparation).toBeUndefined();
});
