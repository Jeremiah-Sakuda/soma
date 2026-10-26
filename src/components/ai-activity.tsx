'use client';
import { useEffect, useRef, useState } from 'react';
import { ChevronRight, FileDown, History, RefreshCw } from 'lucide-react';
import type { AuditEventView, AuditRunView } from '@/lib/domain/audit';

type Props = {
  workspaceId: string; revision: number; busy: boolean; enabled?: boolean;
  onSessionExpired: () => void; openLesson: (id: string) => void; inspectSources: () => void;
};
const running = (run: AuditRunView) => run.status === 'running';
function mergeRuns(current: AuditRunView[], incoming: AuditRunView[]) {
  const merged = new Map(current.map(run => [run.id, run]));
  for (const run of incoming) { const previous = merged.get(run.id); if (!previous || previous.journalRevision <= run.journalRevision) merged.set(run.id, run); }
  return [...merged.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt) || b.id.localeCompare(a.id));
}
const label = (value: string) => value.replaceAll('-', ' ').replaceAll('_', ' ');
const date = (value: string) => new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

function AuditEvent({ event }: { event: AuditEventView }) {
  return <li className="audit-event">
    <div className="audit-event-heading"><span className="overline">{event.actor === 'model' ? 'Model statement' : 'Application record'} · {label(event.kind)}</span><time dateTime={event.at}>{new Intl.DateTimeFormat('en-US', { timeStyle: 'medium' }).format(new Date(event.at))}</time></div>
    <p>{event.summary}</p>
    {event.rationaleStatus === 'recorded' && event.rationale && <p className="audit-rationale"><strong>{event.actor === 'model' ? 'Model’s stated rationale:' : 'Application reason:'}</strong> {event.rationale}</p>}
    {event.rationaleStatus === 'unrecorded' && event.actor === 'model' && <p className="meta">Rationale not recorded.</p>}
    {event.rationaleStatus === 'protected' && <p className="meta">Details are withheld until an attempt or help is recorded, so they do not reveal the diagnostic.</p>}
    {!event.protected && !!event.evidence?.length && <p className="meta">Evidence: {event.evidence.map(ref => `${ref.sourceId} · v${ref.version}`).join('; ')}</p>}
    {event.usage && <p className="meta">{event.usage.calls} model call{event.usage.calls === 1 ? '' : 's'} · estimated ${event.usage.costUsd.toFixed(5)} · {(event.usage.elapsedMs / 1000).toFixed(1)} seconds</p>}
  </li>;
}

/** Read-only journal polling. This component never starts a worker or model call. */
export function AiActivity({ workspaceId, revision, busy, enabled = true, onSessionExpired, openLesson, inspectSources }: Props) {
  const [runs, setRuns] = useState<AuditRunView[]>([]), [error, setError] = useState(''), [refresh, setRefresh] = useState(0), [paused, setPaused] = useState(false);
  const generation = useRef(0), pageGeneration = useRef(0), olderPages = useRef(0), olderRequest = useRef<AbortController | null>(null);
  const [nextCursor, setNextCursor] = useState<string>(), [loadingOlder, setLoadingOlder] = useState(false), [olderError, setOlderError] = useState('');
  useEffect(() => {
    ++pageGeneration.current; olderPages.current = 0; setRuns([]); setNextCursor(undefined); setOlderError(''); setLoadingOlder(false);
    return () => { ++pageGeneration.current; olderRequest.current?.abort(); };
  }, [workspaceId, enabled]);
  const [expandedRuns, setExpandedRuns] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const epoch = ++generation.current;
    if (!enabled) return;
    let cancelled = false, requests = 0, requestId = 0, timer: ReturnType<typeof setTimeout> | undefined, controller: AbortController | undefined;
    setPaused(false);
    async function poll() {
      if (cancelled || document.visibilityState !== 'visible') return;
      if (++requests > 90) { setPaused(true); return; }
      controller = new AbortController();
      const readId = ++requestId;
      try {
        const response = await fetch('/api/audit', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
        const result = await response.json() as { workspaceId?: string; runs?: AuditRunView[]; nextCursor?: string; error?: string };
        if (cancelled || epoch !== generation.current || readId !== requestId) return;
        if (response.status === 401) { onSessionExpired(); return; }
        if (!response.ok) throw new Error('Live activity is temporarily unavailable. Saved lessons remain available.');
        // Never display a response for a cookie/session changed outside this component.
        if (result.workspaceId !== workspaceId) { setRuns([]); setError('Your session changed. Reload the workspace to see its activity.'); return; }
        const incoming = (result.runs ?? []).filter(run => run.workspaceId === workspaceId);
        setRuns(current => mergeRuns(current, incoming));
        if (!olderPages.current && !olderRequest.current) setNextCursor(result.nextCursor);
        setError('');
        timer = setTimeout(() => void poll(), busy || incoming.some(running) ? 2000 : 15000);
      } catch (cause) {
        if (cancelled || epoch !== generation.current || readId !== requestId || (cause instanceof DOMException && cause.name === 'AbortError')) return;
        setError('Live activity is temporarily unavailable. Saved lessons remain available.');
        timer = setTimeout(() => void poll(), 15000);
      }
    }
    function visibilityChanged() { if (timer) clearTimeout(timer); controller?.abort(); ++requestId; if (document.visibilityState === 'visible') { requests = 0; setPaused(false); void poll(); } }
    document.addEventListener('visibilitychange', visibilityChanged);
    void poll();
    return () => { cancelled = true; ++generation.current; if (timer) clearTimeout(timer); controller?.abort(); document.removeEventListener('visibilitychange', visibilityChanged); };
  }, [workspaceId, revision, busy, enabled, refresh, onSessionExpired]);

  async function loadOlder() {
    if (!enabled || !nextCursor || olderRequest.current || olderPages.current >= 200) return;
    const epoch = pageGeneration.current, controller = new AbortController();
    olderRequest.current = controller; setLoadingOlder(true); setOlderError('');
    try {
      const response = await fetch(`/api/audit?cursor=${encodeURIComponent(nextCursor)}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) });
      const result = await response.json() as { workspaceId?: string; runs?: AuditRunView[]; nextCursor?: string };
      if (epoch !== pageGeneration.current) return;
      if (response.status === 401) { onSessionExpired(); return; }
      if (!response.ok || result.workspaceId !== workspaceId) throw new Error('Older activity could not be loaded. Try again.');
      setRuns(current => mergeRuns(current, (result.runs ?? []).filter(run => run.workspaceId === workspaceId)));
      ++olderPages.current; setNextCursor(result.nextCursor);
    } catch (cause) {
      if (epoch === pageGeneration.current && !(cause instanceof DOMException && cause.name === 'AbortError')) setOlderError('Older activity could not be loaded. Try again.');
    } finally {
      if (olderRequest.current === controller) olderRequest.current = null;
      if (epoch === pageGeneration.current) setLoadingOlder(false);
    }
  }

  const active = runs.find(running), latest = active ?? runs[0];
  const visibleEvent = active?.events.at(-1);
  const progress = active ? (visibleEvent?.protected ? 'Soma is checking the evidence and preparing the next step.' : visibleEvent?.summary ?? 'Soma is checking your selected evidence.') : busy ? 'Saving your request. Any model activity will appear here.' : latest ? `Latest activity: ${label(latest.status)}.` : 'No AI activity recorded yet.';
  if (!enabled) return null;
  return <section className="ai-activity" aria-label="Soma decision history">
    <div className="audit-live-line"><History size={17} aria-hidden="true"/><p role="status" aria-atomic="true">{progress}</p></div>
    <details className="audit-history"><summary><span>Why this decision? <span className="meta">{runs.length ? `${runs.length} loaded run${runs.length === 1 ? '' : 's'}` : 'Activity history'}</span></span><ChevronRight size={17} aria-hidden="true"/></summary>
      <div className="audit-history-body"><p className="meta">Model explanations describe its stated rationale. Application records show observed tools, checks, and saved outcomes. Missing explanations are not reconstructed.</p>
      <div className="action-row"><button className="text-button" onClick={() => setRefresh(value => value + 1)}><RefreshCw size={15} aria-hidden="true"/>Refresh activity</button><a className="text-button" href="/api/audit?format=json" download><FileDown size={16} aria-hidden="true"/>Export latest 30 runs</a></div>
      <p className="meta">Starts with the latest 30 runs. Load older activity below; saved history stays available as live updates arrive.</p>
      {paused && <p className="meta">Live updates paused after a bounded monitoring period. Refresh to resume.</p>}
      {error && <p className="inline-error">{error}</p>}
      {!runs.length && <p>No recorded runs in this workspace yet. Source checks and model preparation appear here as they happen.</p>}
      {runs.map(run => <details className="audit-run" key={run.id} open={expandedRuns[run.id] ?? running(run)} onToggle={event => { const open = event.currentTarget.open; setExpandedRuns(current => current[run.id] === open ? current : { ...current, [run.id]: open }); }}>
        <summary><span><strong>{run.trigger}</strong><small>{run.mode === 'live' ? (run.kind === 'source-refresh' ? 'Live source check' : 'Live model') : run.mode === 'synthetic' ? 'Synthetic scenario' : 'Prepared operation'} · {label(run.status)} · {date(run.startedAt)}</small></span></summary>
        <div className="audit-run-body"><dl className="audit-context"><div><dt>Context</dt><dd>Workspace revision {run.contextRevision}</dd></div><div><dt>Model</dt><dd>{run.model ?? 'Not recorded'}</dd></div><div><dt>Versions</dt><dd>Engine {run.engineVersion ?? 'not recorded'} · prompt {run.promptVersion ?? 'not recorded'}</dd></div><div><dt>Source versions</dt><dd>{run.sourceRefs.length ? run.sourceRefs.map(ref => `${ref.sourceId} · v${ref.version}`).join('; ') : 'None recorded'}</dd></div></dl>
          {!!run.sourceRefs.length && <button className="text-button" onClick={inspectSources}>Inspect cited sources</button>}
          <ol className="audit-events">{run.events.map(event => <AuditEvent event={event} key={event.seq}/>)}</ol>
          <div className="action-row">{(run.publishedLessonId ?? run.selectedLessonId) && <button className="secondary-button" onClick={() => openLesson((run.publishedLessonId ?? run.selectedLessonId)!)}>Open resulting activity</button>}<a className="text-button" href={`/api/audit?runId=${encodeURIComponent(run.id)}&format=json`} download><FileDown size={16} aria-hidden="true"/>Export this record</a></div>
          {run.events.some(event => event.protected) && <p className="meta">Explore the resulting activity and use its help controls if you want to reveal protected explanations. You do not have to answer first.</p>}
          <p className="meta">Export uses the same access checks and protected details as this view.</p>
        </div>
      </details>)}
      {nextCursor && <button className="secondary-button" disabled={loadingOlder || olderPages.current >= 200} onClick={() => void loadOlder()}>{loadingOlder ? 'Loading older runs…' : 'Load older runs'}</button>}
      {olderError && <p className="inline-error">{olderError}</p>}
      {olderPages.current >= 200 && <p className="meta">This view has reached its 200-page browsing limit. Every loaded run can be exported individually.</p>}
      </div>
    </details>
  </section>;
}
