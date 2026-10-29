'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, CircleHelp, ImagePlus, MonitorUp, RotateCcw, Save, Square, Sparkles, X } from 'lucide-react';
import { checkExploration, type ExplorationSpec } from '@/lib/domain/exploration';
import { ExplorationScene, explorationVisibleCaption, initialExplorationState, type ExplorationViewState } from './exploration-scene';
import { ExplorationVoice } from './exploration-voice';
import { useExplorationCapture, type ExplorationCapture } from './exploration-capture';
import './exploration.css';

type Artifact = {
  id: string; version: number; createdAt: string; updatedAt: string; spec: ExplorationSpec;
  validation: { assurance: 'checked-bfs' | 'explanation-only' | 'needs-clarification'; modelVersion: string | null; checks: string[] };
  generation: { mode: 'live' | 'prepared-example'; provider: string; model: string | null; calls: number; costUsd: number; elapsedMs: number; audit?: { event: string; call: number; detail: string }[] };
  source: { label: string; capturedAt: string; kind: 'screenshot' | 'example'; summary: string; uncertainty: string[] };
  state: ExplorationViewState; saved: boolean; question: string;
};
type VersionSummary = { id: string; version: number; title: string; saved: boolean; updatedAt: string; generationMode: string };
type ApiResponse = { artifact?: Artifact; artifacts?: Artifact[]; active?: Artifact | null; liveEnabled?: boolean; versions?: VersionSummary[] };
async function api(method = 'GET', body?: unknown, signal?: AbortSignal, query = ''): Promise<ApiResponse> {
  const response = await fetch(`/api/explore${query}`, { method, cache: 'no-store', signal, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code = payload && typeof payload === 'object' && 'code' in payload ? payload.code : null;
    if (code === 'busy') throw new Error('Another exploration is still running. Keep exploring this card and try again shortly.');
    if (code === 'generation_invalid') throw new Error('Soma could not validate the new visual explanation. Your last valid card was kept; try a narrower question.');
    if (code === 'cancelled') throw new Error('This request was cancelled. Your previous exploration is unchanged.');
    if (code === 'timeout') throw new Error('The explanation took too long. Your last valid card is still here; try again when you are ready.');
    if (response.status === 429) throw new Error('This session’s generation limit has been reached. Your last valid card is still available.');
    if (response.status === 409) throw new Error('The exploration changed while this response was being prepared. Your last valid card was kept.');
    if (response.status === 401 || response.status === 403 || response.status === 404) throw new Error('This exploration is not available in this browser session. Try the original example to start again.');
    if (response.status === 400 || response.status === 413 || response.status === 422) throw new Error('Soma could not use this context. Try a clearer PNG or JPEG screenshot, or ask a narrower question.');
    throw new Error('Soma could not prepare a new card right now. Your last valid card is still here; you can also try the original example.');
  }
  return response.json();
}
function validated(artifact: Artifact): Artifact {
  // The same strict domain validator protects persisted and fresh responses.
  try { const checked = checkExploration(artifact.spec); return { ...artifact, spec: checked.spec, validation: checked.validation, state: artifact.state ?? initialExplorationState(checked.spec) }; }
  catch { throw new Error('Soma returned an incomplete visual card. Your previous card was kept; try again or use the original example.'); }
}
const capturedTime = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

export function ExplorationWorkspace() {
  const capture = useExplorationCapture(), uploadRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ExplorationCapture | null>(null), [newContext, setNewContext] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null), [artifacts, setArtifacts] = useState<Artifact[]>([]), [state, setState] = useState<ExplorationViewState | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [deleteConfirmation,setDeleteConfirmation]=useState(false);
  const [initialized,setInitialized]=useState(false),[initializing,setInitializing]=useState(true),[initializationAttempt,setInitializationAttempt]=useState(0);
  const [question, setQuestion] = useState(''), [busy, setBusy] = useState(false), [sourceBusy, setSourceBusy] = useState(false), [saving, setSaving] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [dirty, setDirty] = useState(false), [liveEnabled, setLiveEnabled] = useState<boolean | null>(null);
  const request = useRef<{ id: string; controller: AbortController; epoch: number } | null>(null), epoch = useRef(0), loadSequence = useRef(0);
  const initializationRequest=useRef<Promise<ApiResponse>|null>(null);
  const viewSequence = useRef(0);
  const questionRef = useRef<HTMLTextAreaElement>(null), errorRef = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    let active = true;
    setInitializing(true);
    // Share one cookie-establishing request across development effect replay.
    const pending=initializationRequest.current??api();initializationRequest.current=pending;
    void pending.then(result => { if (active) { setArtifacts(current => [...current, ...(result.artifacts ?? []).filter(item => !current.some(existing => existing.id === item.id))]); setLiveEnabled(result.liveEnabled ?? false);setInitialized(true);setInitializing(false); } }).catch(() => { if (active){setInitializing(false);setError('Your exploration session could not be started. Retry session setup before asking or opening the example. Local screenshot selection remains available.');} }).finally(()=>{if(initializationRequest.current===pending)initializationRequest.current=null;});
    return () => { active = false; request.current?.controller.abort(); };
  }, [initializationAttempt]);
  useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);
  function apply(next: Artifact, history?: VersionSummary[]) {
    const value = validated(next); viewSequence.current++; setArtifact(value); setState(value.state); setDirty(false); setDeleteConfirmation(false);
    setArtifacts(current => { const existing = current.find(item => item.id === value.id); return [existing && existing.version > value.version ? existing : value, ...current.filter(item => item.id !== value.id)].slice(0, 20); });
    setVersions(current => history ?? [{ id: value.id, version: value.version, title: value.spec.title, saved: value.saved, updatedAt: value.updatedAt, generationMode: value.generation.mode }, ...current.filter(item => item.id === value.id && item.version !== value.version)].sort((a,b) => b.version-a.version));
  }
  function cancel(message = 'Stopped waiting. An older response will not replace the card you are exploring.') {
    const pending = request.current; request.current = null; epoch.current++; pending?.controller.abort(); setBusy(false);
    if (pending) void api('POST', { action: 'cancel', requestId: pending.id }).catch(() => undefined);
    setNotice(message);
  }
  function updateState(next: ExplorationViewState) {
    if (request.current) cancel('Experiment changed. The earlier request will not replace your current controls.');
    viewSequence.current++; setState(next); setDirty(true);
  }
  function chooseSource(next: ExplorationCapture | null) {
    if (request.current) cancel('Source changed. The previous request will not replace your current card.');
    epoch.current++; loadSequence.current++; setSource(next); setNewContext(true); setError(''); setNotice('New context selected. Your previous card stays available until you ask about this source.');
  }
  async function share() {
    setSourceBusy(true); setError('');
    try { await capture.start(); chooseSource(null); setNotice('Window selected. No frame is sent until you choose Ask Soma.'); }
    catch { setError('Window sharing was not started. You can try again or upload a screenshot instead.'); }
    finally { setSourceBusy(false); }
  }
  async function upload(file?: File) {
    if (!file) return; setSourceBusy(true); setError('');
    try { const next = await capture.upload(file); capture.stop(); chooseSource(next); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'This screenshot could not be read.'); }
    finally { setSourceBusy(false); if (uploadRef.current) uploadRef.current.value = ''; }
  }
  async function example() {
    if(!initialized)return;
    cancel(''); capture.stop(); setSource(null); setNewContext(false); setError(''); setSourceBusy(true); const sequence = ++loadSequence.current;
    try { const result = await api('POST', { action: 'example' }); if (sequence !== loadSequence.current) return; if (!result.artifact) throw new Error('The original example could not be loaded.'); apply(result.artifact); setNotice('Original synthetic example loaded. No model call was made.'); }
    catch { if (sequence === loadSequence.current) setError('The original example could not be loaded. Try again in a moment.'); }
    finally { if (sequence === loadSequence.current) setSourceBusy(false); }
  }
  async function ask() {
    if (!initialized || !question.trim() || busy) return;
    if(!newContext&&artifact&&versions.some(item=>item.id===artifact.id&&item.version>artifact.version)){setError('Open the latest version before asking a follow-up, or choose a new source to start a separate exploration.');return;}
    setError(''); setNotice('');
    let selected = source;
    try { if (capture.sharing && (newContext || !artifact)) { selected = capture.capture(); setSource(selected); } }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Capture failed. Upload a screenshot instead.'); return; }
    if ((!artifact || newContext) && !selected) { setError('Select a window or screenshot first, or try the original example.'); return; }
    const id = crypto.randomUUID(), controller = new AbortController(), turnEpoch = epoch.current;
    request.current = { id, controller, epoch: turnEpoch }; setBusy(true);
    const followup = artifact && !newContext;
    const submittedDraft = question;
    const payload = { action: 'generate', requestId: id, question: question.trim(), ...(followup ? { artifactId: artifact.id, baseVersion: artifact.version, state, ...(state?.selectedObjectId ? { selectedObjectId: state.selectedObjectId } : {}) } : { source: { kind: 'screenshot', dataUrl: selected!.dataUrl, label: `${selected!.kind === 'capture' ? 'Selected-window capture' : 'Uploaded screenshot'}: ${selected!.label}`.slice(0,120), capturedAt: selected!.capturedAt } }) };
    try {
      const result = await api('POST', payload, controller.signal);
      if (request.current?.id !== id || epoch.current !== turnEpoch) return;
      if (!result.artifact) throw new Error('No complete visual card was returned.');
      apply(result.artifact); setNewContext(false); setQuestion(current => current === submittedDraft ? '' : current); setNotice('New visual card ready. Explore it or ask a follow-up.');
    } catch (failure) {
      if (request.current?.id === id && !controller.signal.aborted) setError(failure instanceof Error ? failure.message : 'Soma could not prepare a new card. Your last card was kept.');
    } finally { if (request.current?.id === id) { request.current = null; setBusy(false); } }
  }
  async function save() {
    if (!initialized || !artifact || !state) return; setSaving(true); setError('');
    const id = artifact.id, version = artifact.version, before = epoch.current, beforeView = viewSequence.current;
    try { const result = await api('PATCH', { action: 'save', artifactId: id, version, state }); if (epoch.current !== before) return; if (viewSequence.current !== beforeView) { setNotice('Saved the earlier state. Your newer changes are still here and remain unsaved.'); return; } if (result.artifact) apply(result.artifact); setNotice('Saved this version and your exact experiment state.'); }
    catch (failure) { setError(failure instanceof Error ? failure.message : 'Save did not finish. Your card is still open.'); }
    finally { setSaving(false); }
  }
  async function resume(id: string, version?: number) {
    if(!initialized)return;
    cancel(''); const sequence = ++loadSequence.current; setError(''); setSourceBusy(true);
    const beforeView=viewSequence.current;
    try { const result = await api('GET', undefined, undefined, `?artifactId=${encodeURIComponent(id)}${version ? `&version=${version}` : ''}`); if (sequence !== loadSequence.current) return;if(viewSequence.current!==beforeView){setNotice('Kept your newer experiment controls. Select the saved exploration again when you want to resume it.');return;} const next = result.active ?? result.artifact; if (!next) throw new Error('This exploration was not found.'); capture.stop(); setSource(null); setNewContext(false); apply(next, result.versions); setNotice('Resumed your saved version. Original screenshot pixels were not retained.'); }
    catch (failure) { if (sequence === loadSequence.current) setError(failure instanceof Error ? failure.message : 'This exploration could not be resumed.'); }
    finally { if (sequence === loadSequence.current) setSourceBusy(false); }
  }
  async function remove() {
    if(!initialized||!artifact)return;const id=artifact.id;cancel('');setSourceBusy(true);setError('');
    try{await api('DELETE',{artifactId:id});capture.stop();setArtifact(null);setState(null);setVersions([]);setSource(null);setNewContext(false);setDeleteConfirmation(false);setArtifacts(current=>current.filter(item=>item.id!==id));setNotice('Deleted this exploration and its saved versions.');}
    catch{setError('Deletion did not finish. Your exploration is still available; try again in a moment.');}
    finally{setSourceBusy(false);}
  }
  const hasContext = !!source || capture.sharing || (!!artifact && !newContext);
  const sourceLabel = newContext ? source?.label ?? (capture.sharing ? capture.shareLabel : '') : artifact?.source.label ?? source?.label;
  const currentSourceTime = newContext ? source?.capturedAt : artifact?.source.capturedAt ?? source?.capturedAt;
  const selectedLabel = state?.selectedObjectId && artifact?.spec.mode === 'checked-bfs' ? artifact.spec.input.nodes.find(node => node.id === state.selectedObjectId)?.label ?? state.selectedObjectId : state?.selectedObjectId;
  const earlierVersion = artifact && versions.some(item => item.id === artifact.id && item.version > artifact.version);
  return <div className="exploration-app">
    <a className="skip-link" href="#exploration-main">Skip to exploration</a>
    <header className="exploration-header"><a className="wordmark" href="/">Soma<span> / explore</span></a><div><span className="exploration-beta">Visual learning preview</span><a href="/" className="exploration-home"><ArrowLeft size={15} aria-hidden="true" /> Study workspace</a></div></header>
    <main id="exploration-main" className="exploration-main" tabIndex={-1}>
      <div className="exploration-heading"><div><p className="overline">Follow your curiosity</p><h1>Make the idea visible.</h1><p>Bring a question and the context in front of you. Explore the explanation together.</p></div><div>{artifact && <a href="#exploration-card" className="exploration-jump">Jump to visual card <ChevronRight size={15} aria-hidden="true" /></a>}<span className="exploration-private"><Check size={15} aria-hidden="true" /> You choose what to share</span></div></div>
      <div className="exploration-workbench">
        <aside className="exploration-source-column" aria-label="Selected context">
          <section className="exploration-source-card"><div className="section-heading"><h2>Your context</h2><span className={`status-chip ${capture.sharing ? 'ready' : ''}`}>{capture.sharing ? 'Sharing selected window' : artifact?.source.kind === 'example' && !newContext ? 'Original example' : sourceLabel ? 'Snapshot' : 'Not shared'}</span></div>
            <input ref={uploadRef} type="file" accept="image/png,image/jpeg" disabled={sourceBusy} className="sr-only" aria-label="Upload a PNG or JPEG screenshot" onChange={event => void upload(event.target.files?.[0])} />
            {source?.dataUrl ? <img className="exploration-source-image" src={source.dataUrl} alt="Your selected screenshot; captured only when requested" /> : artifact?.source.kind === 'example' && !newContext ? <div className="exploration-example-source"><span className="overline">Original example</span><h3>A small search problem</h3><p>Find a route through a graph. Watch the queue decide which node comes next.</p><span>Unweighted · breadth-first search</span></div> : <div className="exploration-source-empty"><MonitorUp size={34} strokeWidth={1.5} aria-hidden="true" /><p>{capture.sharing ? 'Window selected. Ask to capture one frame.' : 'A slide, a diagram, a question worth exploring.'}</p></div>}
            {sourceLabel && <p className="exploration-source-name">{sourceLabel}</p>}
            {currentSourceTime && <p className="meta">{artifact?.source.kind === 'example' && !newContext ? 'Example created' : 'Captured'} {capturedTime(currentSourceTime)}{artifact?.source.kind === 'example' && !newContext ? '' : ' · snapshot, not a live feed'}</p>}
            {capture.sharing && <p className="exploration-sharing-note">Your first Ask sends one frame. Refresh snapshot selects updated context; never continuous uploads.</p>}
            <div className="exploration-source-actions"><button type="button" className="secondary-button" disabled={sourceBusy} onClick={() => void share()}><MonitorUp size={17} aria-hidden="true" /> {capture.sharing ? 'Choose another window' : 'Share a window'}</button><button type="button" className="secondary-button" disabled={sourceBusy} onClick={() => uploadRef.current?.click()}><ImagePlus size={17} aria-hidden="true" /> Upload screenshot</button></div>
            {capture.sharing && <div className="action-row"><button type="button" className="text-button" onClick={() => { try { chooseSource(capture.capture()); } catch { setError('The window could not be captured. Try uploading a screenshot.'); } }}><RotateCcw size={15} aria-hidden="true" /> Refresh snapshot</button><button type="button" className="text-button" onClick={capture.stop}><Square size={13} aria-hidden="true" /> Stop sharing</button></div>}
            <button className="exploration-example-button" type="button" disabled={sourceBusy || !initialized} onClick={() => void example()}>Try the original example <ArrowUpRight size={16} aria-hidden="true" /></button>
            <p className="exploration-privacy-note">Screenshots go to Meta only when you ask. Raw image pixels are not saved with your exploration. Avoid sharing passwords or private messages.</p>
          </section>
          {artifacts.length > 0 && <section className="exploration-library"><h2>Pick up a thread</h2>{artifacts.map(item => <button key={item.id} type="button" aria-current={artifact?.id === item.id ? 'true' : undefined} disabled={sourceBusy || saving} onClick={() => void resume(item.id)}><span><strong>{item.spec.title}</strong><small>Version {item.version}{item.saved ? ' · Saved' : ''}</small></span><ChevronRight size={16} aria-hidden="true" /></button>)}</section>}
        </aside>
        <div className="exploration-stage-column">
          <section className="exploration-ask-card" aria-label="Ask about your context"><form onSubmit={event => { event.preventDefault(); void ask(); }}><label htmlFor="exploration-question">{artifact && !newContext ? 'Where would you like to go next?' : 'What would you like to understand?'}</label>{selectedLabel && <div className="exploration-selected-object"><span>Asking about: {selectedLabel}</span><button type="button" aria-label="Clear selected object" onClick={() => { if (state) updateState({ ...state, selectedObjectId: null }); }}><X size={14} aria-hidden="true" /></button></div>}<textarea ref={questionRef} id="exploration-question" rows={2} maxLength={2000} placeholder={artifact && !newContext ? 'Why that node? What if we change the start?' : 'Show me what this algorithm is doing…'} value={question} onChange={event => setQuestion(event.target.value)} /><div className="exploration-ask-actions"><span className="meta">{newContext && artifact ? 'New source → a new exploration' : artifact ? 'Your current context stays with the question' : 'Share a window, upload an image, or try the example'}</span>{busy ? <button type="button" className="secondary-button" onClick={() => cancel()}><Square size={14} aria-hidden="true" /> Cancel request</button> : <button className="primary-button" type="submit" disabled={!initialized || !hasContext || !question.trim() || sourceBusy || liveEnabled === false || (!newContext && !!earlierVersion)}><Sparkles size={17} aria-hidden="true" /> {newContext && artifact ? 'Explore new context' : 'Ask Soma'}</button>}</div></form><ExplorationVoice narration={artifact && state ? explorationVisibleCaption(artifact.spec, state) : ''} turnKey={JSON.stringify([artifact?.id, artifact?.version, state, epoch.current, question, busy, source?.capturedAt, capture.sharing])} onTranscript={setQuestion} disabled={!initialized || busy || sourceBusy || liveEnabled === false} />{liveEnabled === false && <p className="exploration-unavailable">Live generation is not enabled here. The original example remains available without a model call.</p>}</section>
          {!initialized && <p role="status" className="exploration-notice">{initializing ? 'Starting your private exploration session…' : 'Session setup needs a retry.'}</p>}{!initialized && !initializing && <button type="button" className="secondary-button" onClick={() => { setError(''); setInitializationAttempt(value => value+1); }}>Retry session setup</button>}
          {busy && <div role="status" className="exploration-working"><span /> Reading your context and preparing a checked visual card… Your current card stays available.</div>}
          {notice && <p role="status" className="exploration-notice">{notice}</p>}
          {error && <p ref={errorRef} role="alert" tabIndex={-1} className="exploration-error">{error}</p>}
          {artifact && state ? <article id="exploration-card" tabIndex={-1} className={`exploration-artifact ${newContext ? 'is-previous-context' : ''}`} aria-label="Visual exploration card"><div className="exploration-artifact-meta"><div className="badge-row"><span className="status-chip ready">{artifact.generation.mode === 'prepared-example' ? 'Prepared original example' : 'Live Muse Spark'}</span><span className="status-chip">{artifact.validation.assurance === 'checked-bfs' ? 'Checked BFS computation' : artifact.validation.assurance === 'needs-clarification' ? 'Needs clarification' : 'Explanatory visual'}</span>{newContext && <span className="status-chip caution">Previous context</span>}</div><span className="meta">Version {artifact.version}</span></div><h2>{artifact.spec.title}</h2><p className="exploration-objective">{artifact.spec.objective}</p>{artifact.source.uncertainty.length > 0 && <p className="exploration-unavailable">Some source details need review. Open “Source & assumptions” to inspect the reading uncertainty.</p>}
            {versions.length > 1 && <div className="exploration-version-row"><label htmlFor="exploration-version">Version history</label><select id="exploration-version" value={artifact.version} disabled={busy || sourceBusy || saving} onChange={event => void resume(artifact.id, Number(event.target.value))}>{versions.map(item => <option key={item.version} value={item.version}>Version {item.version}{item.saved ? ' · Saved' : ''} · {item.generationMode === 'prepared-example' ? 'Original example' : 'Generated'}</option>)}</select></div>}
            {earlierVersion && <p className="exploration-unavailable">You are viewing an earlier version. <button className="text-button" type="button" onClick={() => void resume(artifact.id)}>Open the latest version</button> to ask a follow-up.</p>}
            <ExplorationScene spec={artifact.spec} state={state} onChange={updateState} />
            {artifact.spec.mode !== 'clarify' && artifact.spec.followups.length > 0 && <div className="exploration-followups" aria-label="Suggested follow-ups">{artifact.spec.followups.map(item => <button type="button" key={item} disabled={busy || newContext} onClick={() => { setQuestion(item); questionRef.current?.focus(); }}>{item}<ArrowUpRight size={14} aria-hidden="true" /></button>)}</div>}
            <footer className="exploration-artifact-footer"><details><summary><CircleHelp size={15} aria-hidden="true" /> Source & assumptions</summary><p>{artifact.source.summary}</p>{artifact.source.uncertainty.length > 0 && <><h3>Source reading uncertainty</h3><ul>{artifact.source.uncertainty.map(item => <li key={item}>{item}</li>)}</ul></>}<p className="meta">{artifact.source.label} · {capturedTime(artifact.source.capturedAt)}</p>{artifact.spec.assumptions.length > 0 && <><h3>Assumptions</h3><ul>{artifact.spec.assumptions.map(item => <li key={item}>{item}</li>)}</ul></>}{artifact.spec.uncertainty.length > 0 && <><h3>Uncertainty</h3><ul>{artifact.spec.uncertainty.map(item => <li key={item}>{item}</li>)}</ul></>}{artifact.spec.unsupportedClaims.length > 0 && <><h3>Outside this explanation</h3><ul>{artifact.spec.unsupportedClaims.map(item => <li key={item}>{item}</li>)}</ul></>}<p className="meta">{artifact.validation.assurance === 'checked-bfs' ? `Computation: ${artifact.validation.modelVersion}. This checks the search behavior, not every generated explanation.` : 'Generated explanation; no checked quantitative model is attached.'} Exploring does not count as an independent attempt.</p></details><div><span className="meta">{dirty ? 'Unsaved changes' : artifact.saved ? 'Saved' : 'Ready to save'}</span><button type="button" className="secondary-button" disabled={saving || busy} onClick={() => void save()}><Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save exploration'}</button></div></footer>
          <details className="exploration-audit"><summary>How this card was prepared</summary><dl><div><dt>Mode</dt><dd>{artifact.generation.mode === 'prepared-example' ? 'Prepared original example' : 'Recorded live generation'}</dd></div><div><dt>Model</dt><dd>{artifact.generation.model ?? 'No model call'}</dd></div><div><dt>Provider calls</dt><dd>{artifact.generation.calls}</dd></div><div><dt>Generation time</dt><dd>{(artifact.generation.elapsedMs / 1000).toFixed(1)} seconds</dd></div><div><dt>Recorded model cost</dt><dd>${artifact.generation.costUsd.toFixed(4)}</dd></div></dl>{artifact.generation.audit?.length ? <ol>{artifact.generation.audit.map((item,index) => <li key={index}><strong>Call {item.call} · {item.event.replaceAll('-', ' ')}</strong><p>{item.detail}</p></li>)}</ol> : <p>Original authored material; no runtime model investigation was performed.</p>}<p className="meta">These are recorded actions and validation facts, not private model reasoning.</p></details>
          <div className="exploration-delete">{deleteConfirmation ? <div role="group" aria-label="Confirm exploration deletion"><p>Delete this exploration and all its saved versions? This cannot be undone.</p><div className="action-row"><button type="button" className="secondary-button" disabled={sourceBusy} onClick={() => setDeleteConfirmation(false)}>Keep exploration</button><button type="button" className="secondary-button" disabled={sourceBusy} onClick={() => void remove()}>Delete all versions</button></div></div> : <button type="button" className="text-button" disabled={sourceBusy || saving} onClick={() => setDeleteConfirmation(true)}>Delete exploration</button>}</div>
          </article> : <section className="exploration-empty-stage"><div className="exploration-empty-symbol"><Sparkles size={34} strokeWidth={1.4} aria-hidden="true" /></div><h2>A question can become an experiment.</h2><p>See the relationships. Change an assumption. Follow the part that makes you curious.</p><button type="button" className="primary-button" disabled={sourceBusy || !initialized} onClick={() => void example()}>Try the original example <ArrowUpRight size={17} aria-hidden="true" /></button><span className="meta">Breadth-first search · original synthetic material · no account needed</span></section>}
        </div>
      </div>
      <footer className="exploration-page-footer"><span>Soma · an explanation you can explore<br />Guest saves expire after 24 hours. Signed-in accounts use a separate history; guest work does not transfer automatically.</span><a href="/">Your study workspace <ArrowUpRight size={14} aria-hidden="true" /></a></footer>
    </main>
  </div>;
}
