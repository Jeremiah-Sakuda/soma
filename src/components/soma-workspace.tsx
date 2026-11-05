'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity as ActivityIcon,
  ArrowRight,
  FolderOpen,
  House,
  Map as MapIcon,
  RefreshCw,
  Settings2,
  X,
} from 'lucide-react';
import type { Lesson, WorkspaceAction, WorkspaceResponse } from '@/lib/domain/types';
import { TodayView, time } from './today-view';
import { LessonStage } from './lesson-stage';
import { PreparationJobs } from './preparation-jobs';
import { AccountPanel } from './account-panel';
import { WorkspaceDeletionRecovery } from './workspace-deletion-recovery';
import { SomaEntrance } from './soma-entrance';
import { AiActivity } from './ai-activity';
import { MapStrip, MapView } from './map-view';
import {
  AdaptationStatus,
  InvestigationFollowUp,
  InvestigationPanel,
  type InvestigationRequest,
} from './investigation-panel';
type View = 'today' | 'map' | 'activity' | 'courses' | 'study';
const VIEWS: readonly View[] = ['today', 'map', 'activity', 'courses', 'study'];
type Panel =
  | 'sources'
  | 'activity'
  | 'settings'
  | 'scenario'
  | 'request'
  | 'account'
  | 'why'
  | 'correct'
  | null;
export function SomaWorkspace() {
  const [data, setData] = useState<WorkspaceResponse>(),
    [view, setView] = useState<View>('today'),
    [lessonId, setLessonId] = useState(''),
    [panel, setPanel] = useState<Panel>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [requestCourse, setRequestCourse] = useState(''),
    [requestTopic, setRequestTopic] = useState(''),
    [whyLesson, setWhyLesson] = useState<Lesson>(),
    [commitmentId, setCommitmentId] = useState(''),
    [correctionNote, setCorrectionNote] = useState('');
  const [entrance, setEntrance] = useState<'checking' | 'landing' | 'workspace'>('checking');
  const [station, setStation] = useState(''),
    [activityOpen, setActivityOpen] = useState(false);
  const [oauthReturn, setOauthReturn] = useState<'connected' | 'error' | null>(null);
  const initialized = useRef(false),
    generation = useRef(0),
    sessionChanging = useRef(false);
  const [epoch, setEpoch] = useState(0),
    [recoverAccount, setRecoverAccount] = useState(false),
    [deletionPending, setDeletionPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null),
    queue = useRef<Promise<unknown>>(Promise.resolve());
  // Every asynchronous callback belongs to the session that created it, including unmount saves.
  const invalidateSession = useCallback(() => {
    const next = ++generation.current;
    setEpoch(next);
    queue.current = Promise.resolve();
    setBusy(false);
    return next;
  }, []);
  // Network responses may arrive out of order within the same authenticated session.
  const publishWorkspace = useCallback((result: WorkspaceResponse, expected: number) => {
    setData((current) =>
      expected !== generation.current ||
      sessionChanging.current ||
      (current?.workspace.id === result.workspace.id &&
        current.workspace.revision > result.workspace.revision)
        ? current
        : result,
    );
  }, []);
  const beginSessionChange = useCallback(() => {
    sessionChanging.current = true;
    invalidateSession();
  }, [invalidateSession]);
  const endFailedSessionChange = useCallback(() => {
    sessionChanging.current = false;
  }, []);
  const clearPrivateView = useCallback(() => {
    setData(undefined);
    setPanel(null);
    setNotice('');
    setError('');
    setWhyLesson(undefined);
    setRequestCourse('');
    setRequestTopic('');
    setCommitmentId('');
    setCorrectionNote('');
    setOauthReturn(null);
    setDeletionPending(false);
  }, []);
  const recoverSession = useCallback(() => {
    invalidateSession();
    sessionChanging.current = false;
    clearPrivateView();
    setRecoverAccount(true);
    setError('Your account session expired. Sign in again to return to this lesson or workspace.');
    setEntrance('landing');
  }, [invalidateSession, clearPrivateView]);
  const load = useCallback(
    async (expected = generation.current) => {
      if (expected !== generation.current || sessionChanging.current) return;
      setEntrance('workspace');
      setError('');
      setDeletionPending(false);
      try {
        const response = await fetch('/api/workspace');
        const result = await response.json();
        if (expected !== generation.current) return;
        if (response.status === 401) {
          recoverSession();
          return;
        }
        if (!response.ok) {
          if (result.code === 'deletion_pending') {
            setData(undefined);
            setPanel(null);
            setDeletionPending(true);
            return;
          }
          throw new Error(result.error || 'Could not load your workspace.');
        }
        publishWorkspace(result, expected);
      } catch (err) {
        if (expected === generation.current)
          setError(err instanceof Error ? err.message : 'Could not load your workspace.');
      }
    },
    [recoverSession, publishWorkspace],
  );
  const signedOut = useCallback(() => {
    invalidateSession();
    sessionChanging.current = false;
    clearPrivateView();
    setRecoverAccount(false);
    setView('today');
    setLessonId('');
    setEntrance('landing');
    window.history.replaceState({}, '', '/');
  }, [invalidateSession, clearPrivateView]);
  const signedIn = useCallback(async () => {
    const expected = invalidateSession();
    sessionChanging.current = false;
    clearPrivateView();
    setRecoverAccount(false);
    await load(expected);
    if (expected === generation.current) setPanel('account');
  }, [invalidateSession, clearPrivateView, load]);
  const updateWorkspace = useCallback(
    (result: WorkspaceResponse) => publishWorkspace(result, epoch),
    [epoch, publishWorkspace],
  );
  const expireWorkspace = useCallback(() => {
    if (epoch === generation.current) recoverSession();
  }, [epoch, recoverSession, publishWorkspace]);
  const reloadWorkspace = useCallback(() => load(epoch), [load, epoch]);
  useEffect(() => {
    const read = () => {
      const expected = generation.current,
        url = new URL(window.location.href),
        p = url.searchParams;
      setView(VIEWS.find((item) => item === p.get('view')) ?? 'today');
      setLessonId(p.get('lesson') ?? '');
      setStation(p.get('station') ?? '');
      const returned = p.get('google');
      if (returned === 'connected' || returned === 'error') {
        setOauthReturn(returned);
        setPanel('account');
      }
      if (p.has('google')) {
        p.delete('google');
        window.history.replaceState(
          window.history.state,
          '',
          `${url.pathname}${url.search}${url.hash}`,
        );
      }
      if (
        p.get('demo') === '1' ||
        VIEWS.includes((p.get('view') ?? '') as View) ||
        p.has('lesson')
      ) {
        void load(expected);
        return;
      }
      setEntrance('checking');
      setError('');
      void fetch('/api/auth/session')
        .then(async (response) => {
          const result = await response.json();
          if (expected !== generation.current) return;
          if (!response.ok) throw new Error('Could not check your account session. Please retry.');
          if (result.authenticated) await load(expected);
          else {
            setData(undefined);
            setEntrance('landing');
          }
        })
        .catch((err) => {
          if (expected !== generation.current) return;
          setError(err instanceof Error ? err.message : 'Could not check your account session.');
          setEntrance('landing');
        });
    };
    if (!initialized.current) {
      initialized.current = true;
      read();
    }
    window.addEventListener('popstate', read);
    return () => window.removeEventListener('popstate', read);
  }, [load]);
  useEffect(() => {
    if (panel && !dialog.current?.open) dialog.current?.showModal();
    else if (!panel) dialog.current?.close();
  }, [panel, entrance]);
  const act = useCallback(
    (action: WorkspaceAction): Promise<WorkspaceResponse | undefined> => {
      if (epoch !== generation.current || sessionChanging.current)
        return Promise.resolve(undefined);
      setBusy(true);
      setError('');
      const run = queue.current.then(async () => {
        if (epoch !== generation.current || sessionChanging.current) return;
        try {
          const response = await fetch('/api/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(action),
          });
          const result = await response.json();
          if (epoch !== generation.current) return;
          if (response.status === 401) {
            recoverSession();
            return;
          }
          if (!response.ok) throw new Error(result.error || 'That change could not be saved.');
          publishWorkspace(result, epoch);
          if (result.notice) setNotice(result.notice);
          return result as WorkspaceResponse;
        } catch (err) {
          if (epoch === generation.current)
            setError(err instanceof Error ? err.message : 'That change could not be saved.');
          return undefined;
        }
      });
      queue.current = run;
      void run.finally(() => {
        if (epoch === generation.current && queue.current === run) setBusy(false);
      });
      return run;
    },
    [epoch, recoverSession, publishWorkspace],
  );
  function navigate(next: View, id?: string, stationId?: string) {
    if (epoch !== generation.current) return;
    setView(next);
    if (id) setLessonId(id);
    if (stationId !== undefined) setStation(stationId);
    const p = new URLSearchParams({ view: next });
    if (id) p.set('lesson', id);
    if (stationId) p.set('station', stationId);
    window.history.pushState({}, '', `?${p}`);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  const investigate = useCallback(
    (request: InvestigationRequest): Promise<WorkspaceResponse | undefined> => {
      if (epoch !== generation.current || sessionChanging.current)
        return Promise.resolve(undefined);
      setBusy(true);
      setError('');
      const run = queue.current.then(async () => {
        if (epoch !== generation.current || sessionChanging.current) return;
        try {
          const response = await fetch('/api/investigations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
          });
          const result = await response.json();
          if (epoch !== generation.current) return;
          if (response.status === 401) {
            recoverSession();
            return;
          }
          if (!response.ok)
            throw new Error(result.error || 'The investigation could not be saved.');
          publishWorkspace(result, epoch);
          if (result.notice) setNotice(result.notice);
          if (
            result.selectedLessonId &&
            result.workspace.lessons.some((item: Lesson) => item.id === result.selectedLessonId)
          ) {
            setPanel(null);
            navigate('study', result.selectedLessonId);
          }
          return result as WorkspaceResponse;
        } catch (err) {
          if (epoch === generation.current)
            setError(err instanceof Error ? err.message : 'The investigation could not be saved.');
          return undefined;
        }
      });
      queue.current = run;
      void run.then(async (result) => {
        if (
          result &&
          !(
            result.selectedLessonId &&
            result.workspace.lessons.some((item) => item.id === result.selectedLessonId)
          ) &&
          (await recordDisclosure(result.workspace.lessons))
        )
          setPanel('activity');
      });
      void run.finally(() => {
        if (epoch === generation.current && queue.current === run) setBusy(false);
      });
      return run;
    },
    [epoch, recoverSession, publishWorkspace],
  );
  const ws = data?.workspace,
    lesson = ws?.lessons.find((l) => l.id === lessonId) ?? ws?.lessons[0];
  const latestSources =
      ws?.sources.filter((s) => !ws.sources.some((n) => n.id === s.id && n.version > s.version)) ??
      [],
    stale = latestSources.filter((s) => s.status === 'stale').length;
  async function openLesson(id: string) {
    const pending = ws?.freshRequests?.find((r) => r.lessonId === id && r.status === 'pending');
    if (
      pending &&
      !(await act({ type: 'fresh-question', lessonId: pending.parentLessonId, when: 'now' }))
    )
      return;
    navigate('study', id);
  }
  // These panels may expose the answer-bearing passage or diagnostic explanation. Save help first.
  async function recordDisclosure(lessons: Lesson[]) {
    for (const item of lessons.filter((item) => item.diagnosticInvestigationId)) {
      if (!(await act({ type: 'assistance', lessonId: item.id, kind: 'explanation' })))
        return false;
    }
    return epoch === generation.current && !sessionChanging.current;
  }
  async function disclose(next: 'sources' | 'activity' | 'why', target?: Lesson) {
    if (!(await recordDisclosure(ws?.lessons ?? []))) return;
    if (target) setWhyLesson(target);
    setPanel(next);
  }
  // Activity can show diagnostic explanations, so the page opens only after help is recorded, like the dialog.
  async function openActivity() {
    if (!(await recordDisclosure(ws?.lessons ?? []))) return;
    setActivityOpen(true);
    navigate('activity');
  }
  async function freshQuestion(lessonId: string) {
    const response = await act({ type: 'fresh-question', lessonId, when: 'now' });
    if (!response) return;
    const request =
      response.workspace.freshRequests?.find(
        (r) => r.parentLessonId === lessonId && r.status === 'pending',
      ) ?? response.workspace.freshRequests?.find((r) => r.parentLessonId === lessonId);
    if (request) void openLesson(request.lessonId);
  }
  function askAbout(courseId: string, topic: string) {
    setRequestCourse(courseId);
    setRequestTopic(topic);
    setPanel('request');
  }
  function openCourse(courseId: string) {
    navigate('courses');
    requestAnimationFrame(() =>
      document.getElementById(`course-${courseId}`)?.scrollIntoView({ block: 'start' }),
    );
  }
  const activityContent = (open: (id: string) => void) => (
    <>
      <InvestigationPanel ws={ws!} openLesson={open} />
      <p>
        Actual tool and state activity. Synthetic events and live model calls are identified
        individually.
      </p>
      {[...ws!.runs].reverse().map((run) => (
        <article className="run-item" key={run.id}>
          <span className="status-chip">
            {run.mode === 'live'
              ? 'Live model'
              : run.mode === 'prepared'
                ? 'Prepared operation'
                : 'Synthetic scenario'}{' '}
            · {run.status}
          </span>
          <h3>{run.trigger}</h3>
          <p>{run.effect}</p>
          <ol>
            {run.steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
          <small>{time(run.createdAt)} Eastern · Actual run time</small>
        </article>
      ))}
      <h3>Revisable interpretations</h3>
      {ws!.interpretations.length ? (
        ws!.interpretations.map((item) => (
          <article className="interpretation" key={item.id}>
            <strong>{item.claim}</strong>
            <p>
              {item.status} · {item.reason}
            </p>
            <small>{item.evidenceIds.length} linked observations</small>
          </article>
        ))
      ) : (
        <p>
          No interpretation recorded. Exploration alone does not establish independent
          understanding.
        </p>
      )}
    </>
  );
  const oldestRetrieved = latestSources.length
    ? [...latestSources].sort((a, b) => a.retrievedAt.localeCompare(b.retrievedAt))[0].retrievedAt
    : undefined;
  const titles: Record<Exclude<Panel, null>, string> = {
    sources: 'Your sources',
    activity: 'Soma’s activity',
    settings: 'Your preferences',
    scenario: 'Try a synthetic change',
    request: 'Request a lesson',
    account: 'Your workspace',
    why: 'Why this lesson?',
    correct: 'Correct a commitment',
  };
  if (entrance === 'checking')
    return (
      <div className="main-container">
        <a className="wordmark" href="/">
          Soma.
        </a>
        <p className="loading-state" role="status">
          Opening Soma…
        </p>
      </div>
    );
  if (entrance === 'landing')
    return (
      <SomaEntrance
        recoverAccount={recoverAccount}
        beforeSessionChange={beginSessionChange}
        onSessionChangeFailed={endFailedSessionChange}
        error={error}
        oauthReturn={oauthReturn}
        retry={() => window.dispatchEvent(new PopStateEvent('popstate'))}
        onUpdate={updateWorkspace}
        accountReady={signedIn}
        openDemo={() => {
          setPanel(null);
          setOauthReturn(null);
          window.history.pushState({}, '', '?demo=1&view=today');
          setView('today');
          void load();
        }}
      />
    );
  if (deletionPending)
    return <WorkspaceDeletionRecovery onDone={signedOut} onSessionExpired={recoverSession} />;
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <div className="header-inner">
          <a
            className="wordmark"
            href="?view=today"
            onClick={(e) => {
              e.preventDefault();
              navigate('today');
            }}
          >
            Soma<span aria-hidden="true">.</span>
          </a>
          <nav className="primary-nav" aria-label="Main navigation">
            {(
              [
                ['today', 'Today', House],
                ['map', 'Map', MapIcon],
                ['activity', 'Activity', ActivityIcon],
              ] as const
            ).map(([item, label, Icon]) => (
              <button
                key={item}
                aria-current={view === item ? 'page' : undefined}
                onClick={() =>
                  item === 'activity'
                    ? void openActivity()
                    : navigate(item, undefined, item === 'map' ? station : undefined)
                }
              >
                <Icon size={18} aria-hidden="true" />
                {label}
              </button>
            ))}
          </nav>
          {ws && ws.courses.length > 0 && (
            <nav className="course-lines" aria-label="Course lines">
              <span className="nav-heading">Lines</span>
              {ws.courses.map((course) => (
                <button key={course.id} onClick={() => openCourse(course.id)}>
                  <span
                    className="line-swatch"
                    aria-hidden="true"
                    style={{ background: course.color }}
                  />
                  {course.code}
                </button>
              ))}
            </nav>
          )}
          <div className="header-status">
            <span className="mode-chip">
              {ws?.mode === 'account' ? 'Your account' : 'Synthetic demo'}
            </span>
            <button className="freshness-button" onClick={() => void disclose('sources')}>
              {stale
                ? `${stale} stale source${stale === 1 ? '' : 's'}`
                : oldestRetrieved
                  ? `Sources retrieved ${time(oldestRetrieved)}`
                  : 'Sources not connected'}
            </button>
            <button
              className="account-button"
              aria-label="Workspace menu"
              onClick={() => setPanel('account')}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </header>
      <main className="main-container" id="main" tabIndex={-1}>
        {error && (
          <div role="alert" className="alert error">
            {error}
            <button className="text-button" onClick={() => void load()}>
              Reload workspace
            </button>
          </div>
        )}
        {notice && (
          <div className="alert" role="status">
            {notice}
            <button
              className="icon-button"
              aria-label="Dismiss notification"
              onClick={() => setNotice('')}
            >
              <X size={16} />
            </button>
          </div>
        )}
        {!ws ? (
          <div className="loading-state">
            <h1>Your next session starts here.</h1>
            <p>{error ? 'Retry loading above.' : 'Opening your workspace…'}</p>
          </div>
        ) : (
          <>
            {(view === 'today' || view === 'study' || view === 'activity') && (
              <AiActivity
                key={`audit:${ws.id}:${epoch}`}
                workspaceId={ws.id}
                revision={ws.revision}
                busy={busy}
                enabled={!sessionChanging.current}
                onSessionExpired={expireWorkspace}
                openLesson={(id) => void openLesson(id)}
                inspectSources={() => void disclose('sources')}
              />
            )}
            {ws.mode === 'account' && (
              <AdaptationStatus
                key={`adaptation:${ws.id}`}
                data={data!}
                onUpdate={updateWorkspace}
                openLesson={(id) => void openLesson(id)}
                onSessionExpired={expireWorkspace}
              />
            )}{' '}
            {ws.mode === 'account' && (view === 'today' || view === 'courses') && (
              <PreparationJobs
                key={`preparation:${ws.id}`}
                revision={ws.revision}
                onUpdate={updateWorkspace}
                openLesson={(id) => void openLesson(id)}
              />
            )}
            {view === 'today' && (
              <TodayView
                ws={ws}
                act={act}
                busy={busy}
                openLesson={(id) => void openLesson(id)}
                openSources={() => void disclose('sources')}
                why={(l) => void disclose('why', l)}
                correct={(id) => {
                  setCommitmentId(id);
                  setPanel('correct');
                }}
                request={() => setPanel('request')}
                mapStrip={
                  <MapStrip
                    ws={ws}
                    select={(id) => navigate('map', undefined, id)}
                    openMap={() => navigate('map')}
                  />
                }
              />
            )}
            {view === 'study' &&
              (lesson ? (
                <>
                  <LessonStage
                    key={`${lesson.id}:${lesson.version}`}
                    lesson={lesson}
                    data={data!}
                    act={act}
                    busy={busy}
                    openSources={() => void disclose('sources')}
                    openLesson={(id) => void openLesson(id)}
                    exit={() => navigate('today')}
                  />
                  <InvestigationFollowUp
                    ws={ws}
                    lessonId={lesson.id}
                    busy={busy}
                    available={!!data?.capabilities.spark}
                    investigate={investigate}
                    inspect={() => void disclose('activity')}
                  />
                </>
              ) : (
                <section className="card empty-state">
                  <h1>No lesson prepared yet.</h1>
                  <p>Start with course material, then request a lesson.</p>
                  <button className="primary-button" onClick={() => void disclose('sources')}>
                    Open sources
                  </button>
                </section>
              ))}
            {view === 'map' && (
              <MapView
                ws={ws}
                selected={station}
                select={(id) => {
                  setStation(id);
                  const p = new URLSearchParams({ view: 'map', station: id });
                  window.history.replaceState({}, '', `?${p}`);
                }}
                openLesson={(id) => void openLesson(id)}
                freshQuestion={(id) => void freshQuestion(id)}
                askAbout={askAbout}
                openCourse={openCourse}
                busy={busy}
              />
            )}
            {view === 'activity' &&
              (activityOpen ? (
                <div className="stack">
                  <div className="page-heading">
                    <div>
                      <h1>Soma’s activity</h1>
                      <p>What Soma checked, ran and changed, with each run’s mode and status.</p>
                    </div>
                  </div>
                  <section className="card activity-page">
                    {activityContent((id) => void openLesson(id))}
                  </section>
                </div>
              ) : (
                <section className="card empty-state">
                  <h1>Soma’s activity</h1>
                  <p>
                    This page can show explanations behind open diagnostics. Opening it records that
                    you saw them, so later answers count as helped.
                  </p>
                  <button className="primary-button" onClick={() => void openActivity()}>
                    Show activity
                  </button>
                </section>
              ))}
            {view === 'courses' && (
              <>
                <div className="page-heading">
                  <div>
                    <h1>Your courses</h1>
                    <p>Saved lessons and the material behind them.</p>
                  </div>
                  <button className="secondary-button" onClick={() => void disclose('sources')}>
                    <FolderOpen size={17} />
                    Inspect sources
                  </button>
                </div>
                <div className="course-grid">
                  {ws.courses.map((course) => (
                    <article
                      className="card course-card"
                      id={`course-${course.id}`}
                      key={course.id}
                    >
                      <span className="overline">{course.code}</span>
                      <h2>{course.title}</h2>
                      <p className="meta">{course.instructor}</p>
                      {course.deadline && (
                        <p>
                          {course.nextEvent} · {time(course.deadline)} Eastern
                        </p>
                      )}
                      {course.assessments?.map((assessment) => (
                        <section className="source-item" key={assessment.id}>
                          <h3>{assessment.title}</h3>
                          {assessment.deadlineAt && (
                            <p>
                              {new Intl.DateTimeFormat('en-US', {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                                timeZone: assessment.timezone ?? ws.timezone ?? 'UTC',
                              }).format(new Date(assessment.deadlineAt))}{' '}
                              · {assessment.timezone ?? ws.timezone ?? 'UTC'}
                            </p>
                          )}
                          {assessment.includedTopics?.length ? (
                            <p>Included: {assessment.includedTopics.join(', ')}</p>
                          ) : null}
                          {assessment.excludedTopics?.length ? (
                            <p>Excluded: {assessment.excludedTopics.join(', ')}</p>
                          ) : null}
                          {assessment.sourceRefs?.length ? (
                            <button
                              className="text-button"
                              onClick={() => void disclose('sources')}
                            >
                              Inspect assessment sources
                            </button>
                          ) : (
                            <p className="meta">No source-backed assessment facts saved yet.</p>
                          )}
                        </section>
                      ))}
                      <div className="badge-row">
                        <span className="status-chip">
                          {latestSources.some(
                            (s) => s.courseId === course.id && s.status === 'stale',
                          )
                            ? 'Stale source context'
                            : `${latestSources.filter((s) => s.courseId === course.id).length} current source records`}
                        </span>
                        <span className="meta">
                          {ws.lessons.filter((l) => l.courseId === course.id).length} saved lessons
                          and practice
                        </span>
                      </div>
                      <div className="section-stack">
                        {ws.lessons
                          .filter((l) => l.courseId === course.id)
                          .map((l) => (
                            <button
                              className="lesson-row"
                              key={l.id}
                              onClick={() => void openLesson(l.id)}
                            >
                              <span>
                                <strong>{l.title}</strong>
                                <small>
                                  {l.state === 'stale'
                                    ? 'Source changed · stale'
                                    : l.exposure === 'fresh-no-diagram'
                                      ? 'Fresh question'
                                      : `${l.duration} min · ${l.mode === 'live' ? 'Live preparation' : 'Prepared'}`}
                                </small>
                              </span>
                              <ArrowRight size={16} />
                            </button>
                          ))}
                      </div>
                      <details className="course-material">
                        <summary
                          onClick={async (e) => {
                            const details = e.currentTarget.parentElement as HTMLDetailsElement;
                            if (details.open) return;
                            e.preventDefault();
                            if (
                              await recordDisclosure(
                                ws.lessons.filter((item) => item.courseId === course.id),
                              )
                            )
                              details.open = true;
                          }}
                        >
                          Course material ·{' '}
                          {latestSources.filter((s) => s.courseId === course.id).length} sources
                        </summary>
                        {latestSources
                          .filter((s) => s.courseId === course.id)
                          .sort((a, b) => b.retrievedAt.localeCompare(a.retrievedAt))
                          .map((s) => (
                            <div key={s.id}>
                              <h3>{s.title}</h3>
                              <p className="meta">
                                v{s.version} · {s.status} · {s.kind} · Retrieved{' '}
                                {time(s.retrievedAt)} Eastern
                              </p>
                              <p>{s.body}</p>
                              <button
                                className="text-button"
                                onClick={() => {
                                  setRequestCourse(course.id);
                                  setRequestTopic(
                                    `Help me understand this passage from ${s.title}: ${s.body.slice(0, 300)}`.slice(
                                      0,
                                      300,
                                    ),
                                  );
                                  setPanel('request');
                                }}
                              >
                                Explore this passage
                              </button>
                            </div>
                          ))}
                      </details>
                      <div className="action-row">
                        <button
                          className="secondary-button"
                          onClick={() => {
                            setRequestCourse(course.id);
                            setPanel('request');
                          }}
                        >
                          Request a lesson
                        </button>
                        <button
                          className="text-button"
                          disabled={
                            busy ||
                            !data?.capabilities.spark ||
                            !latestSources.some(
                              (source) =>
                                source.courseId === course.id && source.status === 'current',
                            )
                          }
                          onClick={() =>
                            void investigate({
                              courseId: course.id,
                              goal: `Review current material for ${course.code} and ${course.nextEvent || 'the next study session'}. Determine whether preparation should change, conflicts need evidence, or current work should stay.`.slice(
                                0,
                                300,
                              ),
                              initialSourceIds: latestSources
                                .filter(
                                  (source) =>
                                    source.courseId === course.id && source.status === 'current',
                                )
                                .sort(
                                  (a, b) => Date.parse(b.retrievedAt) - Date.parse(a.retrievedAt),
                                )
                                .slice(0, 8)
                                .map((source) => source.id),
                            })
                          }
                        >
                          Investigate course update
                        </button>
                      </div>
                      {!data?.capabilities.spark && (
                        <p className="meta">
                          Course investigation needs live Spark. Saved lessons remain available.
                        </p>
                      )}
                    </article>
                  ))}
                </div>
                {!ws.courses.length && (
                  <section className="card empty-state">
                    <h2>Your semester can start here.</h2>
                    <p>Add a course source to your account to prepare the first lesson.</p>
                    <button className="primary-button" onClick={() => void disclose('sources')}>
                      Open sources
                    </button>
                  </section>
                )}
              </>
            )}
            <footer className="page-footer">
              <span>
                {ws.mode === 'demo'
                  ? 'Original synthetic course material · Actual interactions are saved.'
                  : 'Your course context and learning records.'}
              </span>
              <button className="text-button" onClick={() => void disclose('activity')}>
                Soma’s activity
              </button>
            </footer>
          </>
        )}
      </main>
      <dialog
        ref={dialog}
        className="workspace-dialog"
        onCancel={() => setPanel(null)}
        onClick={(e) => {
          if (e.target === e.currentTarget) setPanel(null);
        }}
        aria-labelledby="dialog-title"
      >
        <div className="dialog-content">
          <div className="dialog-header">
            <h2 id="dialog-title">{panel ? titles[panel] : ''}</h2>
            <button
              className="icon-button"
              aria-label="Close dialog"
              onClick={() => setPanel(null)}
            >
              <X size={20} />
            </button>
          </div>
          {ws && (
            <>
              {panel === 'account' && oauthReturn && (
                <div
                  className={oauthReturn === 'error' ? 'alert caution' : 'alert'}
                  role={oauthReturn === 'error' ? 'alert' : 'status'}
                >
                  <span>
                    {oauthReturn === 'error'
                      ? 'Google authorization did not complete. Try Connect or Reconnect below.'
                      : 'Back from Google. Check the connection status below, choose the sources to read, save your scope, then refresh. Returning here does not establish a successful source read.'}
                  </span>
                  <button
                    className="icon-button"
                    aria-label="Dismiss connection message"
                    onClick={() => setOauthReturn(null)}
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
              {panel === 'account' && (
                <div className="account-menu">
                  <p>
                    {ws.mode === 'demo'
                      ? 'An isolated synthetic workspace. No course accounts are connected.'
                      : 'Your authenticated workspace.'}
                  </p>
                  {(
                    [
                      'sources',
                      'activity',
                      'settings',
                      ...(ws.mode === 'demo' ? ['scenario'] : []),
                    ] as const
                  ).map((item) => (
                    <button
                      className="secondary-button"
                      key={item}
                      onClick={() => {
                        if (item === 'sources' || item === 'activity') void disclose(item);
                        else setPanel(item as Panel);
                      }}
                    >
                      {titles[item as Exclude<Panel, null>]}
                      <ArrowRight size={16} />
                    </button>
                  ))}
                </div>
              )}
              {panel === 'account' && data && (
                <AccountPanel
                  key={ws.id}
                  data={data}
                  reload={reloadWorkspace}
                  onUpdate={updateWorkspace}
                  beforeSessionChange={beginSessionChange}
                  onSessionChangeFailed={endFailedSessionChange}
                  onSignedIn={signedIn}
                  onSignedOut={signedOut}
                />
              )}
              {panel === 'sources' && (
                <>
                  {ws.mode === 'account' && (
                    <button className="secondary-button" onClick={() => setPanel('account')}>
                      Add selected source material
                    </button>
                  )}
                  <p>
                    Sources are read only. Original versions remain available; lesson citations
                    identify the exact version used.
                  </p>
                  {ws.sources.map((source) => (
                    <details className="source-item" key={`${source.id}-${source.version}`}>
                      <summary>
                        <span>
                          <strong>{source.title}</strong>
                          <small>
                            Version {source.version} · {source.origin ?? source.kind} ·{' '}
                            {source.status}
                            {view === 'study' &&
                            lesson?.sourceVersions[source.id] === source.version
                              ? ' · Cited by this lesson'
                              : ''}
                          </small>
                        </span>
                      </summary>
                      <div className="source-body">
                        <p>{source.body}</p>
                        <small>
                          Retrieved {time(source.retrievedAt)} Eastern · {source.id}
                        </small>
                      </div>
                    </details>
                  ))}
                  <button
                    disabled={busy}
                    className="secondary-button"
                    onClick={() => void act({ type: 'refresh' })}
                  >
                    <RefreshCw size={16} />
                    Check source versions
                  </button>
                </>
              )}
              {panel === 'why' && whyLesson && (
                <>
                  <p>{whyLesson.reason}</p>
                  <InvestigationPanel
                    ws={ws}
                    courseId={whyLesson.courseId}
                    openLesson={(id) => {
                      setPanel(null);
                      void openLesson(id);
                    }}
                  />
                  {whyLesson.sourceIds.map((id) => {
                    const source = ws.sources.find(
                      (s) => s.id === id && s.version === whyLesson.sourceVersions[id],
                    );
                    return source ? (
                      <article className="source-item" key={id}>
                        <h3>{source.title}</h3>
                        <p>{source.body}</p>
                        <small>
                          v{source.version} · {source.status} · {source.origin ?? source.kind}
                        </small>
                      </article>
                    ) : null;
                  })}
                  <p className="meta">
                    Lesson v{whyLesson.version} · {whyLesson.modelVersion} ·{' '}
                    {whyLesson.mode === 'live' ? 'Live preparation' : 'Prepared artifact'}
                  </p>
                  <button className="text-button" onClick={() => void disclose('sources')}>
                    Inspect all source versions
                  </button>
                </>
              )}
              {panel === 'activity' &&
                activityContent((id) => {
                  setPanel(null);
                  void openLesson(id);
                })}
              {panel === 'settings' && (
                <>
                  <p>Preferences guide the next session. They do not measure understanding.</p>
                  <label className="field-label" htmlFor="session-length">
                    Preferred session length
                  </label>
                  <select
                    id="session-length"
                    value={ws.preferences.sessionMinutes}
                    disabled={busy}
                    onChange={(e) =>
                      void act({ type: 'preference', sessionMinutes: Number(e.target.value) })
                    }
                  >
                    {[10, 20, 45].map((m) => (
                      <option value={m} key={m}>
                        {m} minutes
                      </option>
                    ))}
                  </select>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={ws.preferences.workedExamples}
                      disabled={busy}
                      onChange={(e) =>
                        void act({ type: 'preference', workedExamples: e.target.checked })
                      }
                    />
                    Prefer worked examples
                  </label>
                  <form
                    className="focus-window-form"
                    onSubmit={async (e) => {
                      e.preventDefault();
                      const fields = new FormData(e.currentTarget);
                      await act({
                        type: 'focus-window',
                        startAt: new Date(String(fields.get('start'))).toISOString(),
                        endAt: new Date(String(fields.get('end'))).toISOString(),
                        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                      });
                    }}
                  >
                    <h3>Choose a focus window</h3>
                    <p className="meta">
                      Use your device’s local time zone. Soma checks this declared window against
                      the calendar context you import.
                    </p>
                    <label className="field-label" htmlFor="focus-start">
                      Start
                    </label>
                    <input id="focus-start" type="datetime-local" name="start" required />
                    <label className="field-label" htmlFor="focus-end">
                      End
                    </label>
                    <input id="focus-end" type="datetime-local" name="end" required />
                    <div className="form-actions">
                      <button className="secondary-button" disabled={busy} type="submit">
                        Save focus window
                      </button>
                    </div>
                  </form>
                  <div className="settings-status">
                    <h3>This session</h3>
                    <p>
                      {data?.capabilities.persistence === 'firestore'
                        ? 'Managed persisted workspace'
                        : 'Local persisted workspace'}
                      .{' '}
                      {data?.capabilities.spark
                        ? 'Spark available; each lesson identifies how it was prepared.'
                        : 'Prepared content; live Spark is unavailable.'}
                    </p>
                    <p>
                      {data?.capabilities.liveSources.length
                        ? `Source types available: ${data.capabilities.liveSources.join(', ')}`
                        : 'No live integrations connected.'}
                    </p>
                    <p>Session expires {time(ws.expiresAt)} Eastern.</p>
                  </div>
                </>
              )}
              {panel === 'request' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const courseId = requestCourse || ws.courses[0]?.id;
                    if (!courseId) return;
                    const response = await act({
                      type: 'request-lesson',
                      courseId,
                      topic: requestTopic,
                    });
                    if (response) {
                      const topology =
                        /series/i.test(requestTopic) && !/parallel/i.test(requestTopic)
                          ? 'series'
                          : 'parallel';
                      const next =
                        response.workspace.lessons.find(
                          (l) => l.id === response.selectedLessonId,
                        ) ??
                        response.workspace.lessons.find(
                          (l) => !ws.lessons.some((old) => old.id === l.id),
                        ) ??
                        response.workspace.lessons.find(
                          (l) =>
                            l.courseId === courseId &&
                            l.state === 'ready' &&
                            (l.kind !== 'circuit' || l.circuit.topology === topology),
                        );
                      setPanel(null);
                      setRequestTopic('');
                      if (next) navigate('study', next.id);
                    }
                  }}
                >
                  <p>
                    Choose a course idea or passage. When available, Spark prepares practice with
                    citations to your course sources; supported circuit topics use the interactive
                    engine. Prepared lessons remain available as a fallback. Each result identifies
                    its preparation mode. Generated previews need review.
                  </p>
                  <label className="field-label" htmlFor="request-course">
                    Course
                  </label>
                  <select
                    id="request-course"
                    value={requestCourse || ws.courses[0]?.id || ''}
                    onChange={(e) => setRequestCourse(e.target.value)}
                  >
                    {ws.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} · {c.title}
                      </option>
                    ))}
                  </select>
                  <label className="field-label" htmlFor="request-topic">
                    What would you like to explore?
                  </label>
                  <textarea
                    id="request-topic"
                    rows={4}
                    value={requestTopic}
                    onChange={(e) => setRequestTopic(e.target.value)}
                    minLength={3}
                    maxLength={300}
                    required
                  />
                  <div className="form-actions">
                    <button
                      type="submit"
                      className="primary-button"
                      disabled={busy || requestTopic.trim().length < 3 || !ws.courses.length}
                    >
                      {busy ? 'Preparing your lesson…' : 'Prepare a lesson'}
                      <ArrowRight size={16} />
                    </button>
                    {busy && ws.lessons.some((l) => l.state === 'ready') && (
                      <button
                        type="button"
                        className="text-button"
                        onClick={() => {
                          setPanel(null);
                          const prepared = ws.lessons.find((l) => l.state === 'ready');
                          if (prepared) void openLesson(prepared.id);
                        }}
                      >
                        Practice while you wait
                      </button>
                    )}
                  </div>
                </form>
              )}
              {panel === 'correct' && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const form = new FormData(e.currentTarget);
                    const response = await act({
                      type: 'correct-commitment',
                      commitmentId,
                      status: form.get('status') as 'confirmed' | 'tentative' | 'cancelled',
                      note: correctionNote,
                    });
                    if (response) {
                      setPanel(null);
                      setCorrectionNote('');
                    }
                  }}
                >
                  <p>
                    Correct Soma’s internal record for{' '}
                    <strong>{ws.commitments?.find((c) => c.id === commitmentId)?.title}</strong>.
                    Original source records remain preserved.
                  </p>
                  <label className="field-label" htmlFor="commitment-status">
                    Status
                  </label>
                  <select
                    name="status"
                    id="commitment-status"
                    defaultValue={
                      ws.commitments?.find((c) => c.id === commitmentId)?.status === 'cancelled'
                        ? 'cancelled'
                        : 'confirmed'
                    }
                  >
                    <option value="confirmed">Confirmed</option>
                    <option value="tentative">Tentative</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <label className="field-label" htmlFor="correction-note">
                    What needs correcting?
                  </label>
                  <textarea
                    id="correction-note"
                    value={correctionNote}
                    onChange={(e) => setCorrectionNote(e.target.value)}
                    required
                    maxLength={500}
                  />
                  <button
                    className="primary-button"
                    disabled={busy || !correctionNote.trim()}
                    type="submit"
                  >
                    Save correction
                  </button>
                </form>
              )}
              {panel === 'scenario' && (
                <>
                  <p>
                    Original synthetic events change this demo workspace. Scenario time is separate
                    from actual saved interaction times.
                  </p>
                  <div className="scenario-list">
                    {(
                      [
                        { scenario: 'learning-graph', label: 'Explore learning graph' },
                        {
                          scenario: 'commitment-overlap',
                          label: 'An interview overlaps your focus window',
                        },
                        {
                          scenario: 'commitment-no-overlap',
                          label: 'An interview moves outside your focus window',
                        },
                        {
                          scenario: 'commitment-tentative',
                          label: 'An interview time is tentative',
                        },
                        {
                          scenario: 'commitment-duplicate',
                          label: 'The same interview appears in two sources',
                        },
                        { scenario: 'exam-moved', label: 'An exam moves earlier' },
                        { scenario: 'scope-change', label: 'Exam coverage narrows' },
                        { scenario: 'source-revised', label: 'A source is corrected' },
                        { scenario: 'source-expired', label: 'A source becomes unavailable' },
                        { scenario: 'reconnect', label: 'Source access returns' },
                        { scenario: 'injection', label: 'A source contains unsafe instructions' },
                      ] as const
                    ).map((item) => (
                      <button
                        disabled={busy}
                        className="scenario-item"
                        key={item.scenario}
                        onClick={async () => {
                          const response = await act({ type: 'scenario', scenario: item.scenario });
                          if (response) {
                            setPanel(null);
                            if (
                              item.scenario === 'learning-graph' &&
                              response.workspace.recommendedLessonId
                            )
                              navigate('study', response.workspace.recommendedLessonId);
                          }
                        }}
                      >
                        <strong>{item.label}</strong>
                        <ArrowRight size={17} />
                      </button>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
        </div>
      </dialog>
    </div>
  );
}
