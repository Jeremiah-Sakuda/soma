import type { CalendarContext, Commitment, CommitmentCorrection, CommitmentObservation, Consequence, FocusWindow, SourceRef, WorkspaceState } from './types';

const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
export type TimeInterval = { startAt: string; endAt: string };
export type Availability = {
  status: 'known' | 'uncertain' | 'stale' | 'missing'; availableMinutes: number | null;
  totalFreeMinutes: number | null; tentativeAvailableMinutes: number | null;
  focusWindow?: FocusWindow; freeIntervals: TimeInterval[]; busyIntervals: TimeInterval[];
  tentativeCommitments: Commitment[]; reason: string; sourceRefs: SourceRef[];
};

export function instant(value: string): number {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d{1,3})?)?(?:Z|[+-]\d\d:\d\d)$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('Use an explicit ISO timestamp with a UTC offset.');
  return Date.parse(value);
}
export function validateTimezone(timezone: string): void {
  if (typeof timezone !== 'string' || timezone.length > 80) throw new Error('A valid timezone is required.');
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(0); } catch { throw new Error('A valid IANA timezone is required.'); }
}
export function validateInterval(startAt: string, endAt: string, timezone: string, allowPoint = false) {
  validateTimezone(timezone);
  const start = instant(startAt), end = instant(endAt);
  if (end < start || (!allowPoint && end === start) || end - start > 7 * DAY) throw new Error('The interval must have a valid positive duration of at most seven days.');
}
export function refsCurrent(state: WorkspaceState, refs: SourceRef[]): boolean {
  return refs.every(ref => state.sources.some(source => source.id === ref.sourceId && source.version === ref.version && source.status === 'current') &&
    !state.sources.some(source => source.id === ref.sourceId && source.version > ref.version));
}
function uniqueRefs(refs: SourceRef[]): SourceRef[] {
  return [...new Map(refs.map(ref => [`${ref.sourceId}@${ref.version}`, ref])).values()];
}

/** Merge overlaps once, including explicit buffers; numeric timestamps already honor their offsets. */
export function mergeBusyIntervals(intervals: TimeInterval[], from: string, until: string): TimeInterval[] {
  const lower = instant(from), upper = instant(until);
  if (upper <= lower) return [];
  const clipped = intervals.map(interval => ({ start: Math.max(lower, instant(interval.startAt)), end: Math.min(upper, instant(interval.endAt)) }))
    .filter(interval => interval.end > interval.start).sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const interval of clipped) {
    const previous = merged.at(-1);
    if (previous && interval.start <= previous.end) previous.end = Math.max(previous.end, interval.end);
    else merged.push({ ...interval });
  }
  return merged.map(interval => ({ startAt: new Date(interval.start).toISOString(), endAt: new Date(interval.end).toISOString() }));
}
function subtractBusy(busy: TimeInterval[], start: string, end: string): TimeInterval[] {
  let cursor = instant(start);
  const finish = instant(end), free: TimeInterval[] = [];
  for (const interval of busy) {
    const from = instant(interval.startAt), until = instant(interval.endAt);
    if (from > cursor) free.push({ startAt: new Date(cursor).toISOString(), endAt: new Date(from).toISOString() });
    cursor = Math.max(cursor, until);
  }
  if (cursor < finish) free.push({ startAt: new Date(cursor).toISOString(), endAt: new Date(finish).toISOString() });
  return free;
}
const duration = (interval?: TimeInterval) => interval ? Math.floor((instant(interval.endAt) - instant(interval.startAt)) / MINUTE) : 0;
function asBusy(commitment: Commitment): TimeInterval {
  return { startAt: new Date(instant(commitment.startAt) - commitment.bufferBeforeMinutes * MINUTE).toISOString(), endAt: new Date(instant(commitment.endAt) + commitment.bufferAfterMinutes * MINUTE).toISOString() };
}

export function selectAvailability(state: WorkspaceState, at: string | Date = state.demoClock ?? new Date()): Availability {
  const now = new Date(at).getTime();
  const focusWindow = (state.focusWindows ?? []).filter(window => instant(window.endAt) > now && instant(window.startAt) <= now + 7 * DAY).sort((a, b) => instant(a.startAt) - instant(b.startAt))[0];
  const context = state.calendarContext;
  const relevantCommitments = (state.commitments ?? []).filter(item => item.kind === 'event' && item.status !== 'cancelled' && (item.blocksFocus !== false || item.status === 'conflict') && focusWindow && instant(asBusy(item).endAt) > Math.max(now, instant(focusWindow.startAt)) && instant(asBusy(item).startAt) < instant(focusWindow.endAt));
  const sourceRefs = uniqueRefs([...(context?.sourceRefs ?? []), ...relevantCommitments.flatMap(item => item.sourceRefs)]);
  const empty: Availability = { status: 'missing', availableMinutes: null, totalFreeMinutes: null, tentativeAvailableMinutes: null, freeIntervals: [], busyIntervals: [], tentativeCommitments: [], reason: 'Declare a focus window before treating calendar gaps as study time.', sourceRefs };
  if (!focusWindow) return empty;
  if (!context || context.status === 'missing') return { ...empty, focusWindow, reason: 'Calendar context is missing. The declared focus window does not establish free time.' };
  const start = new Date(Math.max(now, instant(focusWindow.startAt))).toISOString();
  const all = relevantCommitments;
  const confirmed = all.filter(item => item.status === 'confirmed');
  const tentativeCommitments = all.filter(item => item.status === 'tentative' || item.status === 'conflict')
    .filter(item => instant(asBusy(item).endAt) > instant(start) && instant(asBusy(item).startAt) < instant(focusWindow.endAt));
  const busyIntervals = mergeBusyIntervals(confirmed.map(asBusy), start, focusWindow.endAt);
  const freeIntervals = subtractBusy(busyIntervals, start, focusWindow.endAt);
  // Availability is the next uninterrupted interval, not the sum of unrelated calendar gaps.
  const availableMinutes = duration(freeIntervals[0]);
  const hypothetical = mergeBusyIntervals([...confirmed, ...tentativeCommitments].map(asBusy), start, focusWindow.endAt);
  const tentativeAvailableMinutes = tentativeCommitments.length ? duration(subtractBusy(hypothetical, start, focusWindow.endAt)[0]) : null;
  const stale = context.status === 'stale' || !refsCurrent(state, sourceRefs) || (!state.demoClock && now - instant(context.checkedAt) > DAY);
  return { status: stale ? 'stale' : tentativeCommitments.length ? 'uncertain' : 'known', availableMinutes: stale ? null : availableMinutes,
    totalFreeMinutes: stale ? null : freeIntervals.reduce((total, item) => total + duration(item), 0), tentativeAvailableMinutes: stale ? null : tentativeAvailableMinutes,
    focusWindow, freeIntervals, busyIntervals, tentativeCommitments, sourceRefs,
    reason: stale ? 'Calendar context is stale. Recheck before claiming this time is free.' : tentativeCommitments.length ? 'A tentative or conflicting event may affect this focus window. It has not shortened the session.' : `${availableMinutes} uninterrupted minutes in the declared focus window, after confirmed events and explicit buffers.` };
}

function validateObservation(state: WorkspaceState, item: CommitmentObservation) {
  if (item.workspaceId !== state.id || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.eventId) || !item.identityBasis.trim() || !/^[a-zA-Z0-9_-]{1,128}$/.test(item.id)) throw new Error('Commitment ownership or identity evidence is invalid.');
  if (!item.sourceRefs.length || !refsCurrent(state, item.sourceRefs)) throw new Error('Commitment references must use current source versions in this workspace.');
  if (!['confirmed', 'tentative', 'cancelled'].includes(item.status) || !['event', 'deadline'].includes(item.kind) || !['Interview', 'Personal', 'Application'].includes(item.category)) throw new Error('Unsupported commitment category or status.');
  if (!item.title.trim() || item.title.length > 300 || item.identityBasis.length > 500) throw new Error('Commitment text exceeds its bounds.');
  validateInterval(item.startAt, item.endAt, item.timezone, item.kind === 'deadline');
  instant(item.observedAt);
  if (item.blocksFocus !== undefined && typeof item.blocksFocus !== 'boolean') throw new Error('Focus occupancy must be an explicit boolean.');
  for (const buffer of [item.bufferBeforeMinutes, item.bufferAfterMinutes]) if (!Number.isInteger(buffer) || buffer < 0 || buffer > 120) throw new Error('Buffers must be 0–120 whole minutes.');
}

/** Rebuilds internal facts from preserved observations; matching identity must be supplied by a verified adapter or explicit import. */
function reconcile(state: WorkspaceState): Commitment[] {
  const groups = new Map<string, CommitmentObservation[]>();
  for (const observation of state.commitmentObservations ?? []) {
    const group = groups.get(observation.eventId) ?? [];
    group.push(observation); groups.set(observation.eventId, group);
  }
  return [...groups].map(([id, observations]) => {
    // An old source version remains inspectable, but cannot override that source's newer observation.
    const active = observations.filter(item => !observations.some(newer => newer !== item && newer.sourceRefs.some(next => item.sourceRefs.some(old => next.sourceId === old.sourceId && next.version > old.version))));
    const head = active.at(-1)!;
    const signatures = new Set(active.map(item => `${instant(item.startAt)}|${instant(item.endAt)}|${item.kind}|${item.status === 'cancelled'}|${item.blocksFocus ?? true}`));
    const status = signatures.size > 1 ? 'conflict' : active.some(item => item.status === 'confirmed') ? 'confirmed' : head.status;
    const result: Commitment = { ...head, id, status, sourceRefs: uniqueRefs(active.flatMap(item => item.sourceRefs)), observationIds: observations.map(item => item.id) };
    for (const correction of (state.corrections ?? []).filter(item => item.commitmentId === id && item.workspaceId === state.id)) {
      for (const field of correction.fields ?? ['status', 'startAt', 'endAt', 'timezone'] as const) Object.assign(result, { [field]: correction.after[field] });
      result.correctionId = correction.id;
    }
    return result;
  });
}

export function recordConsequence(state: WorkspaceState, value: Omit<Consequence, 'id' | 'workspaceId'>) {
  state.consequences ??= [];
  state.consequences.push({ ...value, id: `consequence-${state.consequences.length + 1}`, workspaceId: state.id });
}
const fitMinutes = (available: number | null): 10 | 20 | 45 => available === null || available >= 45 ? 45 : available >= 20 ? 20 : 10;

/** Updates an internal recommendation only. The caller persists under its workspace revision transaction. */
export function refreshSessionRecommendation(state: WorkspaceState, now: string, trigger: string, previous?: Availability, classification: Consequence['classification'] = 'availability') {
  const availability = selectAvailability(state, state.demoClock ?? now);
  const prior = previous ?? availability;
  const oldMinutes = state.sessionRecommendation?.minutes ?? fitMinutes(prior.availableMinutes);
  const minutes = fitMinutes(availability.availableMinutes);
  state.sessionRecommendation = { minutes, availableMinutes: availability.availableMinutes, status: availability.status, sourceRefs: availability.sourceRefs, contextRevision: state.revision + 1, updatedAt: now, reason: availability.reason };
  if (oldMinutes !== minutes || prior.status !== availability.status || prior.availableMinutes !== availability.availableMinutes || prior.tentativeAvailableMinutes !== availability.tentativeAvailableMinutes) {
    recordConsequence(state, { createdAt: now, trigger, classification: availability.status === 'uncertain' ? 'uncertainty' : classification,
      sourceRefs: availability.sourceRefs, affectedIds: [availability.focusWindow?.id ?? 'focus-window', ...state.lessons.filter(item => item.state === 'ready').slice(0, 1).map(item => item.id)],
      before: { sessionMinutes: oldMinutes, availableMinutes: prior.availableMinutes, status: prior.status, omittedMinutes: 45 - oldMinutes },
      after: { sessionMinutes: minutes, availableMinutes: availability.availableMinutes, status: availability.status, omittedMinutes: 45 - minutes, tentativeAvailableMinutes: availability.tentativeAvailableMinutes },
      reason: availability.reason, result: minutes !== oldMinutes ? `Study session revised to ${minutes} minutes. ${45 - minutes} minutes of the full prepared session remain pending; lesson content and learning evidence are unchanged.` : 'Session length is unchanged. The availability uncertainty is retained for review.' });
  }
}

/** Shared ingestion path for selected calendar imports, scoped email observations, and labeled synthetic fixtures. */
export function ingestCommitments(input: WorkspaceState, observations: CommitmentObservation[], now: Date | string = new Date(), previousAvailability?: Availability): WorkspaceState {
  const state = structuredClone(input), timestamp = new Date(now).toISOString();
  const before = previousAvailability ?? selectAvailability(state, state.demoClock ?? timestamp);
  state.commitmentObservations ??= [];
  let added = false;
  for (const observation of observations) {
    validateObservation(state, observation);
    const duplicate = state.commitmentObservations.find(existing => existing.eventId === observation.eventId && existing.sourceRefs.length === observation.sourceRefs.length && existing.sourceRefs.every(ref => observation.sourceRefs.some(other => other.sourceId === ref.sourceId && other.version === ref.version)));
    if (duplicate) {
      const facts = (item: CommitmentObservation) => JSON.stringify([item.eventId, item.title, item.category, item.kind, instant(item.startAt), instant(item.endAt), item.timezone, item.status, item.bufferBeforeMinutes, item.bufferAfterMinutes, item.blocksFocus ?? true]);
      if (facts(duplicate) !== facts(observation)) throw new Error('An unchanged source version cannot supply contradictory commitment facts. Import a new source version.');
    } else {
      if (state.commitmentObservations.some(item => item.id === observation.id)) throw new Error('Observation identity already belongs to another source or event.');
      state.commitmentObservations.push(structuredClone(observation)); added = true;
    }
  }
  if (!added) return state;
  state.commitments = reconcile(state);
  refreshSessionRecommendation(state, timestamp, 'Source-linked commitment update', before);
  return state;
}

export function correctCommitment(input: WorkspaceState, action: { commitmentId: string; status?: 'confirmed' | 'tentative' | 'cancelled'; startAt?: string; endAt?: string; timezone?: string; note: string }, now: string): WorkspaceState {
  const state = structuredClone(input), commitment = state.commitments?.find(item => item.id === action.commitmentId && item.workspaceId === state.id);
  if (!commitment) throw new Error('Commitment does not belong to this workspace.');
  const before = selectAvailability(state);
  const status = action.status ?? commitment.status;
  if (status !== 'confirmed' && status !== 'tentative' && status !== 'cancelled') throw new Error('Choose whether this conflicting commitment is confirmed, tentative, or cancelled.');
  const after = { status, startAt: action.startAt ?? commitment.startAt, endAt: action.endAt ?? commitment.endAt, timezone: action.timezone ?? commitment.timezone };
  validateInterval(after.startAt, after.endAt, after.timezone, commitment.kind === 'deadline');
  if (!action.note.trim() || action.note.length > 500) throw new Error('Describe the correction in 1–500 characters.');
  state.corrections ??= [];
  const correction: CommitmentCorrection = { id: `correction-${state.corrections.length + 1}`, workspaceId: state.id, commitmentId: commitment.id, createdAt: now, note: action.note,
    fields: (['status', 'startAt', 'endAt', 'timezone'] as const).filter(field => action[field] !== undefined),
    before: { status: commitment.status, startAt: commitment.startAt, endAt: commitment.endAt, timezone: commitment.timezone }, after };
  state.corrections.push(correction);
  state.commitments = reconcile(state);
  recordConsequence(state, { createdAt: now, trigger: 'Student correction', classification: 'correction', sourceRefs: commitment.sourceRefs, affectedIds: [commitment.id], before: correction.before, after: correction.after,
    reason: action.note, result: 'Corrected Soma’s internal commitment. Original source records and all external events remain unchanged.' });
  refreshSessionRecommendation(state, now, 'Student correction', before, 'correction');
  return state;
}

export function validateRecommendationPublication(state: WorkspaceState, expectedRevision: number, sourceRefs: SourceRef[]): void {
  if (state.revision !== expectedRevision || !refsCurrent(state, sourceRefs)) throw new Error('Recommendation context changed before publication. Recompute from current sources.');
}

export function setCalendarContext(state: WorkspaceState, context: CalendarContext) {
  if (context.status === 'current' && (!context.sourceRefs.length || !refsCurrent(state, context.sourceRefs))) throw new Error('Calendar context references stale or foreign sources.');
  instant(context.checkedAt);
  state.calendarContext = structuredClone(context);
}
