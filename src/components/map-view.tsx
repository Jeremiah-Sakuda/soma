'use client';
import { useMemo } from 'react';
import { ArrowRight, MessageSquarePlus, Play, Sparkles } from 'lucide-react';
import { semesterMap, type MapLine, type MapStation } from '@/lib/domain/semester-map';
import type { WorkspaceState } from '@/lib/domain/types';

type LineStyle = React.CSSProperties & { '--line': string };
const lineStyle = (color: string): LineStyle => ({ '--line': color });
const day = (at: string, timeZone = 'America/New_York') =>
  new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
  }).format(new Date(at));

/** The station Soma would open first: its recommendation, then an open question, then anything. */
export function defaultStation(lines: MapLine[]) {
  const all = lines.flatMap((line) => line.stations);
  return (all.find((s) => s.recommended) ?? all.find((s) => s.status === 'split') ?? all[0])
    ?.lessonId;
}

function StationGlyph({ station }: { station: MapStation }) {
  return (
    <span
      aria-hidden="true"
      className={`station-glyph ${station.status}${station.stale ? ' stale' : ''}`}
    />
  );
}

export function MapLegend() {
  return (
    <ul className="map-legend" aria-label="What the station marks mean">
      <li>
        <span className="station-glyph own" aria-hidden="true" />
        On your own
      </li>
      <li>
        <span className="station-glyph help" aria-hidden="true" />
        With help
      </li>
      <li>
        <span className="station-glyph split" aria-hidden="true" />
        Two explanations
      </li>
      <li>
        <span className="station-glyph tried" aria-hidden="true" />
        Worked in the lesson
      </li>
      <li>
        <span className="station-glyph ready" aria-hidden="true" />
        Ready, not started
      </li>
      <li>
        <span className="milestone-glyph" aria-hidden="true" />
        Exam or deadline
      </li>
      <li>No percentages. Every mark comes from saved work.</li>
    </ul>
  );
}

export function MapView({
  ws,
  selected,
  select,
  openLesson,
  freshQuestion,
  askAbout,
  openCourse,
  busy,
}: {
  ws: WorkspaceState;
  selected?: string;
  select: (lessonId: string) => void;
  openLesson: (id: string) => void;
  freshQuestion: (lessonId: string) => void;
  askAbout: (courseId: string, topic: string) => void;
  openCourse: (courseId: string) => void;
  busy: boolean;
}) {
  const lines = useMemo(() => semesterMap(ws), [ws]);
  const now = Date.parse(ws.demoClock ?? new Date().toISOString());
  const currentId =
    selected && lines.some((line) => line.stations.some((s) => s.lessonId === selected))
      ? selected
      : defaultStation(lines);
  const line = lines.find((item) => item.stations.some((s) => s.lessonId === currentId));
  const station = line?.stations.find((s) => s.lessonId === currentId);

  return (
    <div className="stack">
      <div className="page-heading">
        <div>
          <h1>Your semester map</h1>
          <p>
            Each line is a course. Stations are the lessons and practice Soma prepared from your
            sources, marked only by what your saved work shows.
          </p>
        </div>
      </div>
      <div className="map-layout">
        <section className="card map-card" aria-label="Semester map">
          <div className="map-scroll">
            {lines.map((item) => {
              const past = item.milestones.filter((m) => Date.parse(m.at) < now),
                upcoming = item.milestones.filter((m) => Date.parse(m.at) >= now);
              return (
                <div className="map-line" key={item.courseId} style={lineStyle(item.color)}>
                  <button
                    className="map-line-label"
                    onClick={() => openCourse(item.courseId)}
                    aria-label={`${item.code} ${item.title}: open course detail`}
                  >
                    <span className="line-swatch" aria-hidden="true" />
                    <span>
                      <strong>{item.code}</strong>
                      <small>{item.title}</small>
                    </span>
                  </button>
                  <ol className="map-track">
                    {past.map((m) => (
                      <li className="map-milestone past" key={m.id}>
                        <span className="milestone-glyph" aria-hidden="true" />
                        <span className="station-label">
                          {m.title}
                          <small>{day(m.at, ws.timezone)}</small>
                        </span>
                      </li>
                    ))}
                    {item.stations.map((s) => (
                      <li key={s.lessonId}>
                        <button
                          className="station-button"
                          aria-pressed={s.lessonId === currentId}
                          aria-label={`${s.title.replace(/[.\s]+$/, '')}. ${s.word}${s.stale ? '. Source changed' : ''}${s.recommended ? '. Soma suggests this next' : ''}`}
                          onClick={() => select(s.lessonId)}
                        >
                          <StationGlyph station={s} />
                          <span className="station-label">{s.title}</span>
                        </button>
                      </li>
                    ))}
                    {!item.stations.length && (
                      <li className="map-empty">
                        <button className="text-button" onClick={() => askAbout(item.courseId, '')}>
                          No lessons yet · ask for one
                        </button>
                      </li>
                    )}
                    {upcoming.length > 0 && (
                      <li className="map-now" aria-label="Now">
                        <span>Now</span>
                      </li>
                    )}
                    {upcoming.map((m) => (
                      <li className="map-milestone" key={m.id}>
                        <span className="milestone-glyph" aria-hidden="true" />
                        <span className="station-label">
                          {m.title}
                          <small>{day(m.at, ws.timezone)}</small>
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              );
            })}
          </div>
          <MapLegend />
        </section>
        {station && line ? (
          <StationInspector
            line={line}
            station={station}
            openLesson={openLesson}
            freshQuestion={freshQuestion}
            askAbout={askAbout}
            busy={busy}
          />
        ) : (
          <aside className="card station-inspector">
            <h2>No stations yet</h2>
            <p className="meta">
              Add course material, then ask for a lesson. Stations appear as Soma prepares them.
            </p>
          </aside>
        )}
      </div>
    </div>
  );
}

function StationInspector({
  line,
  station,
  openLesson,
  freshQuestion,
  askAbout,
  busy,
}: {
  line: MapLine;
  station: MapStation;
  openLesson: (id: string) => void;
  freshQuestion: (lessonId: string) => void;
  askAbout: (courseId: string, topic: string) => void;
  busy: boolean;
}) {
  const interactive = station.kind === 'circuit';
  return (
    <aside
      className="card station-inspector"
      aria-labelledby="station-title"
      style={lineStyle(line.color)}
    >
      <p className="station-course">
        <span className="line-swatch" aria-hidden="true" />
        {line.code} · {line.title}
      </p>
      <h2 id="station-title">{station.title}</h2>
      <div className="badge-row">
        <span className={`status-chip station-status ${station.status}`}>
          <StationGlyph station={station} />
          {station.word}
        </span>
        {station.stale && <span className="status-chip caution">Source changed</span>}
        {station.recommended && (
          <span className="status-chip ready">
            <Sparkles size={13} aria-hidden="true" />
            Soma suggests this next
          </span>
        )}
      </div>
      <p className="station-objective">{station.objective}</p>
      <section aria-labelledby="station-evidence">
        <h3 id="station-evidence" className="overline">
          Evidence
        </h3>
        <ul className="evidence-list">
          {station.evidence.map((e, i) => (
            <li key={i}>
              <span className={`who-tag ${e.who.toLowerCase()}`}>{e.who}</span>
              <span>{e.text}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="make-panel" aria-labelledby="make-title">
        <h3 id="make-title">Study this your way</h3>
        <div className="make-options">
          <button
            className={`make-option${station.recommended || station.status === 'split' ? ' suggested' : ''}`}
            onClick={() => openLesson(station.lessonId)}
          >
            <Play size={18} aria-hidden="true" />
            <span>
              <strong>{interactive ? 'Interactive lesson' : 'Practice questions'}</strong>
              <small>
                {interactive ? 'Checked model' : 'From your sources'} · {station.duration} min
                {station.recommended || station.status === 'split' ? ' · Soma suggests this' : ''}
              </small>
            </span>
          </button>
          {interactive && (
            <button
              className="make-option"
              disabled={busy}
              onClick={() => freshQuestion(station.lessonId)}
            >
              <ArrowRight size={18} aria-hidden="true" />
              <span>
                <strong>Fresh question, no diagram</strong>
                <small>Checks it on your own · about 4 min</small>
              </span>
            </button>
          )}
          <button
            className="make-option"
            onClick={() =>
              askAbout(line.courseId, `Help me understand: ${station.objective}`.slice(0, 300))
            }
          >
            <MessageSquarePlus size={18} aria-hidden="true" />
            <span>
              <strong>Ask for something new</strong>
              <small>Soma prepares it from {line.code} sources</small>
            </span>
          </button>
        </div>
        <p className="meta">
          Only an unassisted fresh question can mark this station “On your own”. Hints and
          exploration are kept as help.
        </p>
      </section>
    </aside>
  );
}

/** Today's slice of the map: every line, glyphs only, each station one click from its inspector. */
export function MapStrip({
  ws,
  select,
  openMap,
}: {
  ws: WorkspaceState;
  select: (lessonId: string) => void;
  openMap: () => void;
}) {
  const lines = useMemo(() => semesterMap(ws).filter((line) => line.stations.length), [ws]);
  if (!lines.length) return null;
  return (
    <section className="card map-strip" aria-labelledby="map-strip-title">
      <div className="section-heading">
        <h2 id="map-strip-title">Where you are on the map</h2>
        <button className="text-button" onClick={openMap}>
          Open the map
          <ArrowRight size={15} aria-hidden="true" />
        </button>
      </div>
      <div className="map-strip-lines">
        {lines.map((line) => (
          <div className="map-strip-line" key={line.courseId} style={lineStyle(line.color)}>
            <span className="map-strip-code">{line.code}</span>
            <ol className="map-strip-track">
              {line.stations.map((s) => (
                <li key={s.lessonId}>
                  <button
                    className="strip-station"
                    aria-label={`${s.title}, ${line.code}. ${s.word}`}
                    title={`${s.title} · ${s.word}`}
                    onClick={() => select(s.lessonId)}
                  >
                    <StationGlyph station={s} />
                  </button>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </section>
  );
}
