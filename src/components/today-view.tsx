'use client';
import { ArrowRight, Clock3, BookOpen } from 'lucide-react';
import { selectAvailability } from '@/lib/domain/commitments';
import { planSession } from '@/lib/domain/session';
import type {
  Lesson,
  WorkspaceState,
  WorkspaceAction,
  WorkspaceResponse,
} from '@/lib/domain/types';
import { CircuitDiagram } from './circuit-diagram';
export type Act = (action: WorkspaceAction) => Promise<WorkspaceResponse | undefined>;
export const time = (date: string) =>
  new Date(date).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/New_York',
  });
export function TodayView({
  ws,
  openLesson,
  openSources,
  why,
  correct,
  act,
  busy,
  request,
  mapStrip,
}: {
  ws: WorkspaceState;
  openLesson: (id: string) => void;
  openSources: () => void;
  why: (lesson: Lesson) => void;
  correct: (id: string) => void;
  act: Act;
  busy: boolean;
  request: () => void;
  mapStrip?: React.ReactNode;
}) {
  const availability = selectAvailability(ws),
    minutes = ws.selectedSessionMinutes ?? ws.sessionRecommendation?.minutes ?? 20,
    plan = planSession(ws, minutes);
  const ready = ws.lessons.filter(
    (l) =>
      l.state === 'ready' && (l.exposure !== 'fresh-no-diagram' || l.diagnosticInvestigationId),
  );
  const featured = ready.find((l) => l.id === plan.items[0]?.lessonId) ?? ready[0];
  const now = new Date(ws.demoClock ?? Date.now()).getTime();
  const coming = [
    ...ws.courses
      .filter((c) => c.deadline)
      .map((c) => ({
        id: c.id,
        title: c.nextEvent,
        at: c.deadline,
        label: c.code,
        status: 'Academic deadline',
      })),
    ...(ws.commitments ?? [])
      .filter((c) => c.status !== 'cancelled')
      .map((c) => ({
        id: c.id,
        title: c.title,
        at: c.startAt,
        label: c.category,
        status: c.status,
      })),
  ]
    .filter((c) => Date.parse(c.at) >= now && Date.parse(c.at) <= now + 7 * 86400000)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  return (
    <div className="stack">
      <div className="context-line">
        <div>
          <span className="overline">Your next session</span>
          <p>
            {ws.demoClock
              ? `Scenario time: ${time(ws.demoClock)} Eastern`
              : 'A little progress, on your terms.'}
          </p>
        </div>
        <button className="secondary-button" onClick={request}>
          Request a lesson
        </button>
      </div>
      {featured ? (
        <article className="ready-card">
          <div className="ready-copy">
            <div className="badge-row">
              <span className="pill ready">Ready to explore</span>
              <span className="meta">
                {ws.courses.find((c) => c.id === featured.courseId)?.code} · {featured.duration} min
              </span>
            </div>
            <h1>{featured.title}</h1>
            <p>{featured.description}</p>
            <p className="reason-line">{featured.reason}</p>
            <div className="action-row">
              <button className="primary-button" onClick={() => openLesson(featured.id)}>
                Open lesson <ArrowRight size={17} />
              </button>
              <button className="text-button" onClick={() => why(featured)}>
                Why this lesson?
              </button>
            </div>
            <p className="meta">Explore freely. No quiz required.</p>
          </div>
          <div className="ready-preview" aria-hidden="true">
            {featured.kind === 'circuit' ? (
              <CircuitDiagram inputs={featured.circuit} compact />
            ) : (
              <div className="plain-practice-preview">
                <BookOpen size={40} />
                <h2>
                  One idea.
                  <br />A useful next step.
                </h2>
              </div>
            )}
          </div>
        </article>
      ) : (
        <section className="card empty-state">
          <h1>Your next lesson starts with your course.</h1>
          <p>Add course material in your account, then request a lesson.</p>
          <button className="primary-button" onClick={openSources}>
            Open sources
          </button>
        </section>
      )}
      {mapStrip}
      <section className="card session-builder">
        <div className="section-heading">
          <div>
            <h2>Make it fit your day</h2>
            <p>{availability.reason}</p>
          </div>
          <div className="session-pills" aria-label="Session length">
            {([10, 20, 45] as const).map((m) => (
              <button
                key={m}
                aria-pressed={minutes === m}
                disabled={busy}
                onClick={() => void act({ type: 'select-session', minutes: m })}
              >
                {m} min
              </button>
            ))}
          </div>
        </div>
        <div className="session-plan">
          <div className="session-items">
            {plan.items.map((item) => (
              <button
                className="session-item"
                key={item.id}
                onClick={async () => {
                  if (item.id.endsWith('-fresh')) {
                    const result = await act({
                      type: 'fresh-question',
                      lessonId: item.lessonId,
                      when: 'now',
                    });
                    const request = result?.workspace.freshRequests?.find(
                      (r) => r.parentLessonId === item.lessonId,
                    );
                    if (request) openLesson(request.lessonId);
                  } else openLesson(item.lessonId);
                }}
              >
                <span>{item.title}</span>
                <span className="meta">
                  {item.minutes} min <ArrowRight size={14} />
                </span>
              </button>
            ))}
          </div>
          <p className="meta">
            {plan.minutes} minutes prepared.{' '}
            {plan.omittedItems.length
              ? `${plan.omittedMinutes} minutes remain for another session: ${plan.omittedItems.map((i) => i.title).join('; ')}.`
              : 'All available session steps included.'}
          </p>
          {plan.longerThanAvailable && (
            <p className="inline-caution">
              This choice is longer than the {plan.availableMinutes} available minutes. Your focus
              window has not changed.
            </p>
          )}
          {availability.status !== 'known' && (
            <p className="inline-caution">
              Availability is {availability.status}; this is a planning choice, not a confirmed free
              slot.
            </p>
          )}
        </div>
      </section>
      <div className="today-context-grid">
        <section className="card">
          <div className="section-heading">
            <h2>Also ready</h2>
            <span className="meta">Across your courses</span>
          </div>
          {ready
            .filter((l) => l.id !== featured?.id)
            .slice(0, 3)
            .map((l) => (
              <button className="lesson-row" key={l.id} onClick={() => openLesson(l.id)}>
                <BookOpen size={20} />
                <span>
                  <small>{ws.courses.find((c) => c.id === l.courseId)?.code}</small>
                  <strong>{l.title}</strong>
                  <small>
                    {l.duration} min ·{' '}
                    {l.kind === 'circuit' ? 'Interactive lesson' : 'Guided practice'}
                  </small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
        </section>
        <section className="card">
          <h2>Coming up</h2>
          <p className="meta">Next seven days{ws.demoClock ? ' in this synthetic scenario' : ''}</p>
          <div className="coming-up-list">
            {coming.length ? (
              coming.map((c) => (
                <div className="commitment-row" key={c.id}>
                  <Clock3 size={17} />
                  <div>
                    <strong>{c.title}</strong>
                    <p>{time(c.at)} Eastern</p>
                    <span className="meta">
                      {c.label} · {c.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p>No dated events in the available context.</p>
            )}
          </div>
        </section>
      </div>
      <section className="card changes-card">
        <div className="section-heading">
          <h2>What changed</h2>
          <button className="text-button" onClick={openSources}>
            Inspect sources
          </button>
        </div>
        {(ws.consequences ?? []).length ? (
          [...(ws.consequences ?? [])]
            .reverse()
            .slice(0, 5)
            .map((c) => (
              <details className="change-entry" key={c.id}>
                <summary>
                  <span>
                    <strong>{c.result}</strong>
                    <small>
                      {c.classification} · Recorded {time(c.createdAt)} Eastern
                    </small>
                  </span>
                </summary>
                <div className="change-details">
                  <p>{c.reason}</p>
                  <div className="before-after">
                    <div>
                      <h3>Before</h3>
                      {Object.entries(c.before).map(([k, v]) => (
                        <p key={k}>
                          {k}: {String(v ?? 'unknown')}
                        </p>
                      ))}
                    </div>
                    <div>
                      <h3>After</h3>
                      {Object.entries(c.after).map(([k, v]) => (
                        <p key={k}>
                          {k}: {String(v ?? 'unknown')}
                        </p>
                      ))}
                    </div>
                  </div>
                  {c.sourceRefs.map((ref) => {
                    const source = ws.sources.find(
                      (s) => s.id === ref.sourceId && s.version === ref.version,
                    );
                    return source ? (
                      <blockquote key={`${ref.sourceId}-${ref.version}`}>
                        <p>{source.body}</p>
                        <cite>
                          {source.title} · v{ref.version}
                        </cite>
                      </blockquote>
                    ) : null;
                  })}
                  <div className="action-row">
                    <button className="text-button" onClick={openSources}>
                      View source
                    </button>
                    {(ws.commitments ?? [])
                      .filter(
                        (item) =>
                          c.affectedIds.includes(item.id) ||
                          item.sourceRefs.some((ref) =>
                            c.sourceRefs.some((cr) => cr.sourceId === ref.sourceId),
                          ),
                      )
                      .map((item) => (
                        <button
                          key={item.id}
                          className="text-button"
                          onClick={() => correct(item.id)}
                        >
                          Correct {item.title}
                        </button>
                      ))}
                  </div>
                </div>
              </details>
            ))
        ) : (
          <p className="muted">
            No course or commitment changes recorded yet. New source consequences will appear here.
          </p>
        )}
      </section>
    </div>
  );
}
