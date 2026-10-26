import { ingestCommitments, selectAvailability } from './commitments';
import type { CommitmentObservation, Source, WorkspaceState } from './types';

/** Original synthetic events go through the same interval and consequence engine as imported observations. */
export function commitmentScenario(input: WorkspaceState, scenario: 'commitment-overlap' | 'commitment-no-overlap' | 'commitment-tentative' | 'commitment-duplicate', now: string): WorkspaceState {
  if (input.mode !== 'demo') throw new Error('Synthetic commitment scenarios are available only in demo workspaces.');
  const state = structuredClone(input), before = selectAvailability(input);
  const existing = state.commitmentObservations ?? [];
  if (scenario === 'commitment-duplicate' && existing.length) return ingestCommitments(state, existing.filter(item => item.eventId === 'interview-demo').filter(item => item.sourceRefs.every(ref => state.sources.some(source => source.id === ref.sourceId && source.version === ref.version && source.status === 'current'))), now);
  const startAt = scenario === 'commitment-no-overlap' ? '2026-10-28T17:00:00-04:00' : '2026-10-28T16:20:00-04:00';
  const endAt = scenario === 'commitment-no-overlap' ? '2026-10-28T17:40:00-04:00' : '2026-10-28T17:00:00-04:00';
  const status = scenario === 'commitment-tentative' ? 'tentative' : 'confirmed';
  const observations: CommitmentObservation[] = [];
  for (const channel of ['calendar', 'email'] as const) {
    const id = `source-interview-${channel}`;
    const body = `Original synthetic ${channel} observation. Shared event identity: interview-demo. Interview ${status === 'confirmed' ? 'confirmed' : 'proposed, not accepted'} for October 28, ${scenario === 'commitment-no-overlap' ? '17:00–17:40' : '16:20–17:00'} America/New_York. No buffer was requested. These are fixture times; collection timestamps are actual.`;
    const current = state.sources.filter(source => source.id === id).sort((a, b) => b.version - a.version)[0];
    if (current?.body === body && current.status === 'current') {
      const prior = existing.find(item => item.eventId === 'interview-demo' && item.sourceRefs.some(ref => ref.sourceId === id && ref.version === current.version));
      if (prior) { observations.push(prior); continue; }
    }
    if (current) current.status = 'stale';
    const source: Source = { id, title: `Interview ${channel} · original synthetic observation`, body, version: (current?.version ?? 0) + 1, kind: 'synthetic', retrievedAt: now, status: 'current', timezone: 'America/New_York', origin: 'synthetic' };
    state.sources.push(source);
    observations.push({ id: `${id}-observation-v${source.version}`, workspaceId: state.id, eventId: 'interview-demo', title: 'Interview', category: 'Interview', kind: 'event', startAt, endAt, timezone: 'America/New_York', status,
      bufferBeforeMinutes: 0, bufferAfterMinutes: 0, sourceRefs: [{ sourceId: id, version: source.version }], observedAt: now, identityBasis: 'Both original fixture sources explicitly name the shared event identity interview-demo.' });
  }
  return ingestCommitments(state, observations, now, before);
}
