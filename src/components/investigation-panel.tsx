'use client';
import { useEffect, useState } from 'react';
import type { AdaptationSummary } from '@/lib/server/adaptation-jobs';
import type { WorkspaceResponse, SomaInvestigation, WorkspaceState } from '@/lib/domain/types';
import { time } from './today-view';

export type InvestigationRequest = {
  courseId: string;
  goal: string;
  initialSourceIds?: string[];
  previousInvestigationId?: string;
  attemptId?: string;
};
export function investigationRecords(ws: WorkspaceState): SomaInvestigation[] {
  return ws.investigations ?? [];
}
const decisionLabels = {
  'revise-session': 'Session change proposed',
  'keep-current': 'Keep current preparation',
  'needs-evidence': 'More evidence needed',
} as const;

export function InvestigationPanel({ ws, courseId, openLesson }: {
  ws: WorkspaceState; courseId?: string; openLesson: (id: string) => void;
}) {
  const all = investigationRecords(ws);
  const records = all.filter(record => !courseId || record.courseId === courseId).slice().reverse();
  if (!records.length) return null;
  return <section aria-label="Course investigations">
    <h3>Course investigations</h3>
    <p className="meta">Source-supported decisions and provisional explanations. Original sources and responses stay preserved.</p>
    {records.map(record => {
      const previous = all.find(item => item.id === record.supersedesId);
      const diagnostic = ws.lessons.find(item => item.id === record.diagnosticLessonId);
      const answered = diagnostic && ws.attempts.some(item => item.lessonId === diagnostic.id && item.lessonVersion === diagnostic.version);
      const revisedPlan = previous?.diagnosticPlan;
      const linkedAttempts = ws.attempts.filter(attempt => record.attemptIds?.includes(attempt.id));
      return <details className="source-item" key={record.id}>
        <summary><span><strong>{decisionLabels[record.decision]}</strong><small>{ws.courses.find(course => course.id === record.courseId)?.code ?? 'Course'} · {record.mode === 'live' ? 'Live Spark' : record.mode === 'synthetic' ? 'Synthetic scenario' : 'Prepared operation'} · {time(record.createdAt)} Eastern</small></span></summary>
        <div className="source-body">
          <p>{record.reason}</p>
          <p className="meta">Applies to {record.applicability === 'assessment' ? `assessment ${record.assessmentId ?? 'not identified'}` : record.applicability === 'course' ? 'this course' : 'an uncertain scope'}. Validated updates can change Soma’s internal preparation; the original source records remain preserved.</p>
          {record.conflicts.map((conflict, index) => <div className="help-box" key={index}>
            <strong>{conflict.resolution === 'unresolved' ? 'Unresolved source conflict' : 'Explicit source supersession'}</strong>
            <p>{conflict.reason}</p>
            <p className="meta">{conflict.sourceIds.map(id => ws.sources.find(source => source.id === id)?.title ?? id).join(' · ')}</p>
          </div>)}
          <details><summary>Evidence · {record.sourceRefs.length} cited passage{record.sourceRefs.length === 1 ? '' : 's'}</summary>
            {record.sourceRefs.map((ref, index) => {
              const source = ws.sources.find(item => item.id === ref.sourceId && item.version === ref.version);
              return <article key={`${ref.sourceId}-${ref.version}-${index}`}>
                <h4>{source?.title ?? ref.sourceId}</h4><blockquote>{ref.quote}</blockquote>
                <p className="meta">Version {ref.version} · {source?.status ?? 'Source version unavailable'}{source && ws.sources.some(item => item.id === source.id && item.version > source.version) ? ' · Newer version exists' : ''}</p>
              </article>;
            })}
          </details>
          {revisedPlan && record.hypothesisRevisions?.length && linkedAttempts.length ? <section>
            <h4>What changed after your response</h4>
            {revisedPlan.hypotheses.map(hypothesis => {
              const before = previous?.hypothesisRevisions?.find(item => item.hypothesisId === hypothesis.id)?.status ?? 'plausible';
              const revision = record.hypothesisRevisions?.find(item => item.hypothesisId === hypothesis.id);
              const after = revision?.status;
              return <article key={hypothesis.id}><p>{hypothesis.claim}</p><p className="meta">Before: {before} · After: {after ?? 'No revision recorded'}</p>{revision?.reason && <p>{revision.reason}</p>}</article>;
            })}
            {linkedAttempts.map(attempt => <div key={attempt.id}><p><strong>Saved response:</strong> {attempt.response}</p><p className="meta">{time(attempt.createdAt)} Eastern · {attempt.assisted ? 'With recorded assistance' : 'Without recorded help'}{attempt.revisionOf ? ' · Revised response' : ' · Original response'}</p></div>)}
            <p className="meta">A response can support or weaken an explanation. It does not establish mastery or retention.</p>
          </section> : null}
          {record.toolActivity?.length ? <details><summary>Recorded tool activity</summary><ol>{record.toolActivity.map((item, index) => <li key={index}><strong>{item.tool}</strong>: {item.outcome}</li>)}</ol>{record.usage && <p className="meta">{record.usage.calls} calls · {(record.usage.elapsedMs / 1000).toFixed(1)} seconds · ${record.usage.costUsd.toFixed(4)} recorded cost</p>}</details> : null}
          {record.diagnosticPlan && <section>
            <h4>Why this interaction?</h4>
            {answered ? <>
              <p>{record.diagnosticPlan.rationale}</p>
              {record.diagnosticPlan.hypotheses.map(hypothesis => <p key={hypothesis.id}>{hypothesis.claim} <span className="meta">({record.hypothesisRevisions?.find(item => item.hypothesisId === hypothesis.id)?.status ?? 'plausible'})</span></p>)}
              <p><strong>Proposed next activity:</strong> {record.diagnosticPlan.nextActivity}</p>
            </> : <p>An optional question compares two provisional explanations. Its explanation becomes visible after a saved response, so it does not suggest an answer first.</p>}
            {diagnostic && <button className="secondary-button" onClick={() => openLesson(diagnostic.id)}>{answered ? 'Revisit optional question' : 'Open optional question'}</button>}
          </section>}
        </div>
      </details>;
    })}
  </section>;
}

export function InvestigationFollowUp({ ws, lessonId, busy, available, investigate, inspect }: {
  ws: WorkspaceState; lessonId: string; busy: boolean; available: boolean;
  investigate: (request: InvestigationRequest) => Promise<unknown>; inspect: () => void;
}) {
  const records = investigationRecords(ws);
  const record = records.slice().reverse().find(item => item.diagnosticLessonId === lessonId && item.diagnosticPlan);
  if (!record) return null;
  const lesson = ws.lessons.find(item => item.id === lessonId);
  const attempt = ws.attempts.filter(item => item.lessonId === lessonId && item.lessonVersion === lesson?.version).at(-1);
  const considered = attempt && records.some(item => item.supersedesId === record.id && item.attemptIds?.includes(attempt.id));
  return <section className="card" aria-label="Reconsider the investigation" style={{ marginTop: 24 }}>
    <h2>{attempt ? 'Let this response inform what comes next.' : 'A question you can choose to explore.'}</h2>
    <p>{attempt ? ws.mode==='account' ? 'Soma automatically queues a follow-up from this saved response. Your original question, response, and assistance stay in your record.' : 'Soma can reconsider its provisional explanations using your saved response. The original question, response, and assistance stay in your record.' : 'Answering is optional. You can return to your ready lessons at any time.'}</p>
    <div className="action-row">
      {ws.mode!=='account' && attempt && !considered && <button className="secondary-button" disabled={busy || !available} onClick={() => void investigate({ courseId: record.courseId, previousInvestigationId: record.id, attemptId: attempt.id, goal: 'Reconsider the provisional explanations using this saved response and current course evidence; choose the next useful activity without inferring mastery.' })}>{busy ? 'Reconsidering…' : 'Reconsider with my response'}</button>}
      <button className="text-button" onClick={inspect}>Inspect investigation</button>
    </div>
    {considered && <p className="meta" role="status">This response has a saved reconsideration. Inspect the investigation to compare the records.</p>}
    {attempt && !available && !considered && <p className="meta">Live Spark is unavailable. Your response is saved; reconsideration can wait.</p>}
  </section>;
}


/** Read-only polling observes durable worker results; the browser never starts inference. */
export function AdaptationStatus({ data, onUpdate, openLesson, onSessionExpired }: {
  data: WorkspaceResponse; onUpdate: (value: WorkspaceResponse) => void; openLesson: (id: string) => void; onSessionExpired: () => void;
}) {
  const [jobs,setJobs]=useState<AdaptationSummary[]>([]),[error,setError]=useState(''),[refresh,setRefresh]=useState(0),[paused,setPaused]=useState(false),[retrying,setRetrying]=useState(false);
  const ws=data.workspace;
  useEffect(()=>{
    let stopped=false,timer:ReturnType<typeof setTimeout>|undefined,polls=0;
    const controller=new AbortController();setPaused(false);
    async function poll(){
      if(stopped||document.hidden)return;
      if(polls++>=60){setPaused(true);return;}
      try{
        const response=await fetch('/api/adaptations',{signal:controller.signal});
        if(stopped)return;if(response.status===401){onSessionExpired();return;}
        const result=await response.json();if(!response.ok)throw new Error('Follow-up status is temporarily unavailable. Your saved response is retained.');
        if(stopped)return;const next:AdaptationSummary[]=result.jobs??[];setJobs(next);setError('');
        if(next.some(job=>job.status==='ready'&&!ws.investigations?.some(item=>item.attemptIds?.includes(job.attemptId)))){
          const updated=await fetch('/api/workspace',{signal:controller.signal});
          if(stopped)return;if(updated.status===401){onSessionExpired();return;}
          if(!updated.ok)throw new Error('The follow-up is saved, but the workspace could not refresh.');
          const payload:WorkspaceResponse=await updated.json();if(!stopped&&payload.workspace.id===ws.id)onUpdate(payload);
        }
        if(!stopped&&next.some(job=>job.status==='queued'||job.status==='running'))timer=setTimeout(()=>void poll(),5000);
      }catch{if(!stopped){setError('Follow-up status is temporarily unavailable. Your saved response is retained.');timer=setTimeout(()=>void poll(),10000);}}
    }
    const visible=()=>{if(!document.hidden&&!stopped){if(timer)clearTimeout(timer);void poll();}};
    void poll();document.addEventListener('visibilitychange',visible);
    return()=>{stopped=true;controller.abort();if(timer)clearTimeout(timer);document.removeEventListener('visibilitychange',visible);};
  },[ws.id,ws.revision,refresh,onUpdate,onSessionExpired]);
  const job=jobs.find(item=>ws.attempts.some(attempt=>attempt.id===item.attemptId&&attempt.lessonId===item.lessonId));
  if(!job&&!error)return null;
  async function retry(){if(!job)return;setRetrying(true);try{const response=await fetch('/api/adaptations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jobId:job.id})});if(response.status===401){onSessionExpired();return;}if(!response.ok)throw new Error();setRefresh(value=>value+1);}catch{setError('This follow-up could not be queued again. Your response remains saved.');}finally{setRetrying(false);}}
  return <section className="card" aria-label="Automatic follow-up" style={{marginBottom:24}}><h2>Your next step</h2><p role="status" aria-atomic="true">{job?.status==='queued'?(job.notice??'Response saved. Soma’s follow-up is queued automatically.'):job?.status==='running'?'Soma is reconsidering your response. You can keep studying.':job?.notice??'Checking your saved follow-up.'}</p>{error&&<p role="alert">{error}</p>}<div className="action-row">{job?.status==='ready'&&job.selectedLessonId&&<button className="primary-button" onClick={()=>openLesson(job.selectedLessonId!)}>Open next activity</button>}{job?.status==='failed'&&<button className="secondary-button" disabled={retrying} onClick={()=>void retry()}>Retry follow-up</button>}{(paused||error)&&<button className="text-button" onClick={()=>setRefresh(value=>value+1)}>Check follow-up status</button>}</div>{paused&&<p className="meta">Automatic status checks paused. Background work can continue while this page is closed.</p>}</section>;
}
