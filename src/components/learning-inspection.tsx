'use client';
import { useState } from 'react';
import { localLearningGraph } from '@/lib/domain/learning-graph';
import { recheckDiagnosticExperimentInput } from '@/lib/domain/diagnostics';
import type { Lesson, WorkspaceState, SomaInvestigation } from '@/lib/domain/types';
import { type Act, time } from './today-view';

/** Local, source-linked inspection. Explanations are disclosed only after support is saved. */
export function LearningInspection({ ws, lesson, act, busy, openLesson }: {
  ws: WorkspaceState; lesson: Lesson; act: Act; busy: boolean; openLesson: (id: string) => void;
}) {
  const [disclosedContext, setDisclosedContext] = useState<string>(), [saving, setSaving] = useState(false), [error, setError] = useState('');
  const records = ws.investigations ?? [];
  const initial = records.find(record => record.id === lesson.diagnosticInvestigationId);
  if (!initial?.diagnosticPlan) return null;
  const lineage = new Set([initial.id]);
  for (let index = 0; index < records.length; index++) for (const record of records) if (record.supersedesId && lineage.has(record.supersedesId)) lineage.add(record.id);
  const descendants = records.filter(record => lineage.has(record.id));
  const latest = descendants.at(-1) ?? initial;
  function priorDiagnostic(record: SomaInvestigation) {
    const seen = new Set<string>(); let id = record.supersedesId;
    while (id && !seen.has(id)) {
      seen.add(id);
      const parent = records.find(item => item.id === id && item.workspaceId === ws.id && item.courseId === lesson.courseId);
      if (!parent || parent.diagnosticPlan) return parent;
      id = parent.supersedesId;
    }
    return undefined;
  }
  const local = localLearningGraph(ws, lesson.id);
  const concepts = local.filter(record => record.kind === 'concept');
  const interpretations = local.filter(record => record.kind === 'interpretation');
  const nextId = latest.selectedLessonId ?? latest.diagnosticLessonId;
  const next = ws.lessons.find(item => item.id === nextId);
  const connected = ws.lessons.filter(item => item.id === lesson.id || (item.courseId === lesson.courseId &&
    (lineage.has(item.diagnosticInvestigationId ?? '') || item.sourceIds.some(id => lesson.sourceIds.includes(id)))));
  const related = connected.filter(item => item.state === 'ready' && item.sourceIds.length > 0 && item.sourceIds.every(id =>
    ws.sources.some(source => source.id === id && source.courseId === item.courseId && source.version === item.sourceVersions[id] && source.status === 'current') &&
    !ws.sources.some(source => source.id === id && source.version > item.sourceVersions[id])));
  const sourceIds = new Set([...connected.flatMap(item => item.sourceIds), ...descendants.flatMap(record => record.sourceRefs.map(ref => ref.sourceId))]);
  // Bind permission to the exact artifacts visible now, excluding mutable support/revision counters.
  // A new worker publication closes synchronously on its first render, even during a save.
  const context = JSON.stringify({ workspaceId: ws.id, lessonId: lesson.id, lessonVersion: lesson.version,
    investigations: descendants, activities: connected,
    sources: ws.sources.filter(source => sourceIds.has(source.id)).map(source => ({id:source.id,version:source.version,status:source.status})),
    graph: local,
  });
  const visible = disclosedContext === context;
  const statusLabel = (status: string) => status === 'supported' ? 'Provisionally supported' : status === 'plausible' ? 'Plausible' : status === 'weakened' ? 'Weakened' : 'Unresolved';
  let checked: ReturnType<typeof recheckDiagnosticExperimentInput> | undefined;
  if (lesson.diagnosticExperiment) { try { checked = recheckDiagnosticExperimentInput(lesson.diagnosticExperiment.input); } catch { /* Historical artifact remains explicitly unchecked. */ } }
  async function disclose() {
    setSaving(true); setError('');
    try {
      // Only existing activities connected to this evidence/lineage acquire support.
      for (const item of related) if (!await act({ type: 'assistance', lessonId: item.id, kind: 'explanation' })) {
        setError('The inspection could not save its support record. Your explanations remain closed. Try again.'); return;
      }
      setDisclosedContext(context);
    } catch { setError('The inspection could not save its support record. Your explanations remain closed. Try again.'); } finally { setSaving(false); }
  }
  return <section className="card learning-inspection" aria-label="What Soma is checking">
    <span className="overline">Connected evidence</span><h2>What Soma is checking</h2>
    <p>{concepts.map(record => record.kind === 'concept' ? record.objective : '').join(' · ') || lesson.objective}</p>
    <p className="meta">{initial.mode === 'live' ? 'Actual Spark investigation on the labeled sources.' : 'Prepared synthetic investigation · authored starting artifact.'} Provisional explanations can change. A comparison does not establish mastery.</p>
    {!visible ? <><p>Inspect the competing explanations, exact evidence and checked comparison. Opening them records support for connected activities; predicting remains optional.</p><button className="secondary-button" disabled={busy || saving} onClick={() => void disclose()}>{saving ? 'Saving support…' : 'Inspect explanations and evidence'}</button></> : <>
      <div className="inspection-header"><p role="status" className="meta">Inspection opened with recorded support. Original responses keep their original conditions.</p><button className="text-button" onClick={() => setDisclosedContext(undefined)}>Close evidence inspection</button></div>
      {lesson.id.startsWith('graph-preview-parallel') && <details><summary>View fictional returned work</summary><figure><img src="/synthetic/returned-work.svg" width={800} height={480} alt="Original synthetic returned work: a 12 V parallel circuit with 6 Ω and 3 Ω branches. Fictional answer says each branch gets 3 A; the authored marking asks which nodes each resistor connects to."/><figcaption className="meta">Original authored development image and typed observation. This walkthrough does not demonstrate model image extraction.</figcaption></figure></details>}
      <section><h3>Two provisional explanations</h3><p>{initial.diagnosticPlan.rationale}</p><div className="inspection-pair">{initial.diagnosticPlan.hypotheses.map(hypothesis => {
        const interpretation = interpretations.find(record => record.kind === 'interpretation' && (record.diagnosticInvestigationId ? record.diagnosticInvestigationId === initial.id && record.hypothesisId === hypothesis.id : record.claim === hypothesis.claim));
        const revision = descendants.filter(record => priorDiagnostic(record)?.id === initial.id).flatMap(record => record.hypothesisRevisions ?? []).findLast(item => item.hypothesisId === hypothesis.id);
        return <article className="evidence-card" key={hypothesis.id}><span className="status-chip">{statusLabel(revision?.status ?? (interpretation?.kind === 'interpretation' ? interpretation.status : hypothesis.status))}</span><h4>{hypothesis.claim}</h4><p className="meta">{revision?.reason ?? (interpretation?.kind === 'interpretation' ? interpretation.uncertainty : 'Plausible explanation; not an established learner belief.')}</p>{hypothesis.evidence.map((ref, index) => {
          const source = ws.sources.find(item => item.id === ref.sourceId && item.version === ref.version);
          return <details key={`${ref.sourceId}-${index}`}><summary>Supporting evidence: {source?.title ?? 'Source unavailable'} · v{ref.version}</summary><blockquote>{ref.quote}</blockquote><p className="meta">{source?.origin ?? source?.kind} · {source?.status ?? 'unavailable'}{ws.sources.some(item => item.id === ref.sourceId && item.version > ref.version) ? ' · Newer version exists' : ''}</p></details>;
        })}{hypothesis.attemptIds.map(id => {
          const attempt = ws.attempts.find(item => item.id === id);
          return attempt ? <details key={id}><summary>Recorded observation · {time(attempt.createdAt)} Eastern</summary><p>{attempt.response}</p><p className="meta">{attempt.assisted ? 'With recorded support' : 'No help recorded in Soma'} · Lesson v{attempt.lessonVersion} · {attempt.modelVersion}</p></details> : null;
        })}</article>;
      })}</div></section>
      {lesson.diagnosticExperiment && <section><h3>Checked experiment</h3>{checked ? <><p>Only {checked.input.change.parameter === 'voltage' ? 'source voltage' : checked.input.change.parameter === 'r1' ? 'R₁' : 'R₂'} changes. All other inputs stay fixed.</p><div className="inspection-table"><table><caption>Predictions and deterministic result · {{current1:'Current through R₁',current2:'Current through R₂',voltage1:'Voltage across R₁',voltage2:'Voltage across R₂'}[checked.observable]}</caption><thead><tr><th scope="col">Comparison</th><th scope="col">Value</th></tr></thead><tbody><tr><th scope="row">Baseline</th><td>{Number(checked.observedBefore.toPrecision(6))} {checked.unit}</td></tr>{checked.input.predictions.map(prediction => <tr key={prediction.hypothesisId}><th scope="row">{prediction.claim}<small>{prediction.predictionForm==='checked-model'?'Ideal DC relationship':prediction.predictionForm==='unchanged'?'Unchanged from baseline':prediction.predictionForm==='equal-branch-current'?'Equal branch currents':prediction.predictionForm==='equal-voltage-drop'?'Equal voltage drops':'Historical prediction'}</small></th><td>{Number(prediction.predictedValue.toPrecision(6))} {checked!.unit}</td></tr>)}<tr><th scope="row">Checked result after the change</th><td>{Number(checked.observedAfter.toPrecision(6))} {checked.unit}</td></tr></tbody></table></div><p className="meta">{checked.reason} Independent scientific review and course fit remain pending.</p></> : <p className="inline-caution">Historical artifact: approved prediction forms are unavailable. This comparison cannot create new checked evidence.</p>}</section>}
      <section><h3>{latest.id !== initial.id ? 'What changed after your response' : 'What comes next'}</h3>{latest.id !== initial.id ? <><div className="inspection-pair"><article className="evidence-card"><h4>Before</h4><p>{initial.diagnosticPlan.nextActivity}</p><p className="meta">{lesson.question}</p></article><article className="evidence-card"><h4>After</h4><p>{latest.reason}</p><p>{latest.decision === 'keep-current' ? 'The existing preparation remains useful.' : latest.decision === 'needs-evidence' ? 'The evidence is still uncertain. Further clarification may help.' : next && next.id !== lesson.id ? next.question : 'A revision is recorded; no different activity has been published here.'}</p></article></div>{latest.attemptIds?.map(id => {
        const attempt = ws.attempts.find(item => item.id === id); return attempt ? <details key={id}><summary>{attempt.responseKind === 'correction' ? 'Student correction' : 'Saved response'} · {time(attempt.createdAt)} Eastern</summary><p>{attempt.response}</p><p className="meta">{attempt.assisted ? 'Recorded support preceded this observation.' : 'No help recorded in Soma; external support is unknown.'} Original observations are preserved.</p></details> : null;
      })}</> : <p>{initial.diagnosticPlan.nextActivity}</p>}{next && next.id !== lesson.id && <button className="primary-button" disabled={next.state !== 'ready'} onClick={() => openLesson(next.id)}>Open {next.exposure === 'fresh-no-diagram' ? 'fresh application' : 'next activity'}</button>}</section>
      <details><summary>Interpretation history and model versions</summary>{descendants.map(record => <article key={record.id}><h4>{record.mode === 'live' ? 'Actual Spark decision' : 'Prepared synthetic decision'} · {time(record.createdAt)} Eastern</h4><p>{record.reason}</p>{record.hypothesisRevisions?.map(revision => <p key={revision.hypothesisId}>{priorDiagnostic(record)?.diagnosticPlan?.hypotheses.find(item => item.id === revision.hypothesisId)?.claim ?? revision.hypothesisId}: {statusLabel(revision.status)} · {revision.reason}</p>)}</article>)}<p className="meta">Lesson v{lesson.version} · {lesson.modelVersion} · {lesson.sourceIds.map(id => `${id} v${lesson.sourceVersions[id]}`).join(' · ')}. Actual timestamps; no simulated delay is evidence of retention.</p></details>
    </>}{error && <p role="alert">{error}</p>}
  </section>;
}
