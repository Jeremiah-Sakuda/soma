import type { WorkspaceState } from '../domain/types';
import { applySourceImport, type SourceImport } from './imports';

/** A normal authenticated import explicitly opts this selected text into automatic preparation.
 * Administrative preview transfer uses the pure importer and never receives this marker. */
export function importWithAutomation(workspace: WorkspaceState, input: SourceImport) {
  const result = applySourceImport(workspace, input);
  const receipt = result.workspace.importReceipts?.find(item => item.key === input.importId);
  if (input.kind !== 'calendar-json') for (const source of result.workspace.sources) {
    if (result.sourceIds.includes(source.id) && source.status === 'current' && source.provenance?.contentHash === receipt?.hash && source.provenance) source.provenance.automaticPreparation = true;
  }
  return result.workspace;
}

export function needsImportAutomationConsent(workspace: WorkspaceState, input: SourceImport): boolean {
  if (input.kind === 'calendar-json') return false;
  const receipt = workspace.importReceipts?.find(item => item.key === input.importId);
  return !!receipt && workspace.sources.some(source => source.id === receipt.sourceId && source.status === 'current' && source.provenance?.contentHash === receipt.hash && !source.provenance.automaticPreparation);
}
