'use client';

import { useEffect, useId, useRef, useState } from 'react';
import type { WorkspaceResponse } from '@/lib/domain/types';

type Course = { id: string; title: string; code?: string; url: string; term?: string };
type Selection = { id: string; courseId: string };
type BlackboardStatus = {
  catalog: { courses: Course[]; checkedAt: string; complete: boolean; nextCursor?: string; query?: string };
  selected: Selection[];
};

const spacing = { marginTop: 16 };

async function request(path: string, payload?: unknown): Promise<BlackboardStatus> {
  const response = await fetch(path, {
    cache: 'no-store',
    ...(payload === undefined ? {} : {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Blackboard could not be read. Try again or reconnect.');
  return result;
}

function sameSelection(current: Selection[], saved: Selection[]): boolean {
  const normalized = (items: Selection[]) => items.map(item => `${item.id}\u0000${item.courseId}`).sort();
  return JSON.stringify(normalized(current)) === JSON.stringify(normalized(saved));
}

export function BlackboardCoursePicker({ data, reload, disabled = false }: {
  data: WorkspaceResponse; reload: () => Promise<void>; disabled?: boolean;
}) {
  const prefix = useId();
  const mounted = useRef(false);
  const [status, setStatus] = useState<BlackboardStatus>();
  const [knownCourses, setKnownCourses] = useState<Record<string, Course>>({});
  const [selection, setSelection] = useState<Selection[]>([]);
  const [query, setQuery] = useState('');
  const [catalogQuery, setCatalogQuery] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    mounted.current = true;
    let active = true;
    void request('/api/connectors/blackboard').then(result => {
      if (!active) return;
      setStatus(result); setSelection(result.selected);
      setQuery(result.catalog.query ?? ''); setCatalogQuery(result.catalog.query ?? '');
      setKnownCourses(Object.fromEntries(result.catalog.courses.map(course => [course.id, course])));
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : 'Course selection could not be loaded.'); });
    return () => { active = false; mounted.current = false; };
  }, []);

  async function run(name: string, action: () => Promise<void>) {
    setBusy(name); setError(''); setNotice('');
    try { await action(); }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'The Blackboard request failed. Try again.'); }
    finally { if (mounted.current) setBusy(''); }
  }

  async function discover(more = false) {
    await run(more ? 'more' : 'discover', async () => {
      await request('/api/connectors/blackboard', { action: 'discover', ...(query.trim() ? { query: query.trim() } : {}), ...(more ? { more: true } : {}) });
      if (!mounted.current) return;
      const result = await request('/api/connectors/blackboard');
      if (!mounted.current) return;
      setStatus(result);
      setCatalogQuery(query.trim());
      setKnownCourses(current => ({ ...current, ...Object.fromEntries(result.catalog.courses.map(course => [course.id, course])) }));
      // A bounded or filtered catalog must never silently remove saved or draft scope.
      setNotice('Course list checked. Choose courses below, then save your selection.');
    });
  }

  async function save() {
    await run('save', async () => {
      const mappings = Object.fromEntries(selection.filter(item => item.courseId).map(item => [item.id, item.courseId]));
      await request('/api/connectors/blackboard', { action: 'select', courseIds: selection.map(item => item.id), mappings });
      if (!mounted.current) return;
      const result = await request('/api/connectors/blackboard');
      if (!mounted.current) return;
      setStatus(result); setSelection(result.selected);
      await reload();
      if (mounted.current) setNotice(result.selected.length
        ? 'Selected courses saved. Refresh reads only these courses; it does not submit work or post messages.'
        : 'No Blackboard courses selected. Course collection is paused.');
    });
  }

  const blocked = disabled || !!busy;
  const dirty = !!status && !sameSelection(selection, status.selected);
  const hidden = [...new Map([...(status?.selected ?? []), ...selection].map(item => [item.id, item])).values()]
    .filter(item => !status?.catalog.courses.some(course => course.id === item.id));

  function courseRow(course: Pick<Course, 'id' | 'title' | 'code' | 'term'>, index: number, missing = false) {
    const selected = selection.find(item => item.id === course.id);
    const inputId = `${prefix}-course-${index}`;
    const mappingId = `${prefix}-mapping-${index}`;
    const mappingMissing = !!selected?.courseId && !data.workspace.courses.some(item => item.id === selected.courseId);
    return <div key={course.id} style={{ paddingBlock: 12, borderTop: '1px solid var(--divider)' }}>
      <label htmlFor={inputId} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 44, overflowWrap: 'anywhere' }}>
        <input id={inputId} type="checkbox" disabled={blocked} checked={!!selected} onChange={event => {
          setNotice('');
          const checked = event.target.checked;
          setSelection(current => checked ? [...current, status?.selected.find(item => item.id === course.id) ?? { id: course.id, courseId: '' }] : current.filter(item => item.id !== course.id));
        }} />
        <span><strong>{course.title}</strong>{(course.code || course.term) && <span className="meta" style={{ display: 'block' }}>{[course.code, course.term].filter(Boolean).join(' · ')}</span>}</span>
      </label>
      {missing && <p className="inline-caution">Selection outside this course list. Keep it checked to preserve the selection, or uncheck it to remove it when you save.</p>}
      {selected && <div style={{ marginTop: 8 }}>
        <label htmlFor={mappingId} className="field-label">Soma course for {course.title}</label>
        <select id={mappingId} disabled={blocked} value={selected.courseId} onChange={event => {
          setNotice('');
          setSelection(current => current.map(item => item.id === course.id ? { ...item, courseId: event.target.value } : item));
        }}>
          <option value="">Create new course</option>
          {mappingMissing && <option value={selected.courseId}>Previously saved course · unavailable</option>}
          {data.workspace.courses.map(item => <option key={item.id} value={item.id}>{item.code} · {item.title}</option>)}
        </select>
      </div>}
    </div>;
  }

  return <section aria-label="Blackboard course selection" aria-busy={!!busy} style={spacing}>
    <h3>Choose your Blackboard courses</h3>
    <p className="meta" style={spacing}>Soma finds courses using your saved sign-in. You choose which courses it may read. Finding and opening courses uses no AI inference.</p>
    <form onSubmit={event => { event.preventDefault(); void discover(); }} style={spacing}>
      <label htmlFor={`${prefix}-query`} className="field-label">Filter this course page by name or code (optional)</label>
      <input id={`${prefix}-query`} type="text" value={query} maxLength={200} disabled={blocked} onChange={event => setQuery(event.target.value)} placeholder="Course name or code" />
      <p className="meta" style={{ marginTop: 8 }}>The filter checks one returned page at a time. Load more courses to check another page; earlier selections stay saved.</p>
      <button className="secondary-button" type="submit" disabled={blocked} style={spacing}>{busy === 'discover' ? 'Finding courses…' : status?.catalog.checkedAt ? 'Check course list again' : 'Find my courses'}</button>
    </form>
    {!status && !error && <p className="meta" role="status" style={spacing}>Loading saved course selection…</p>}
    {status && <>
      {status.catalog.checkedAt && <p className="meta" style={spacing}>Course list checked {new Date(status.catalog.checkedAt).toLocaleString()}.</p>}
      {!status.catalog.complete && <p className="inline-caution" style={spacing}>This is a partial course list. Missing courses and saved selections have not been removed. {status.catalog.nextCursor ? 'Load more courses to check the next page.' : 'Check the list again if a course is missing.'}</p>}
      {!status.catalog.courses.length && <p className="meta" style={spacing}>No courses in this list. Try another name or code, or reconnect if your sign-in has expired.</p>}
      <fieldset disabled={blocked} style={spacing}>
        <legend className="field-label">Courses Soma may read</legend>
        {status.catalog.courses.map((course, index) => courseRow(course, index))}
        {hidden.map((item, index) => {
          const savedCourse = data.workspace.courses.find(course => course.id === item.courseId);
          return courseRow(knownCourses[item.id] ?? { id: item.id, title: savedCourse?.title ?? `Blackboard course ${item.id}`, code: savedCourse?.code }, status.catalog.courses.length + index, true);
        })}
      </fieldset>
      {status.catalog.nextCursor && <button type="button" className="secondary-button" style={spacing} disabled={blocked || query.trim() !== catalogQuery} onClick={() => void discover(true)}>{busy === 'more' ? 'Loading more courses…' : 'Load more courses'}</button>}
      {status.catalog.nextCursor && query.trim() !== catalogQuery && <p className="meta" style={{ marginTop: 8 }}>Check the course list with your changed filter before loading more.</p>}
      <p className="meta" style={spacing}>{selection.length} {selection.length === 1 ? 'course selected' : 'courses selected'}{dirty ? ' · unsaved changes' : ' · saved selection'}</p>
      <div className="action-row" style={spacing}>
        <button className="secondary-button" type="button" disabled={blocked || !dirty} onClick={() => void save()}>{busy === 'save' ? 'Saving courses…' : 'Save selected courses'}</button>
        <button className="primary-button" type="button" disabled={blocked || dirty || !status.selected.length} onClick={() => void run('refresh', async () => {
          await request('/api/connectors/browser', { provider: 'blackboard', action: 'refresh' });
          if (!mounted.current) return;
          await reload();
          if (mounted.current) setNotice('Refresh finished. Review source timestamps and any sign-in or read notices.');
        })}>{busy === 'refresh' ? 'Reading selected courses…' : 'Refresh selected courses'}</button>
      </div>
    </>}
    {busy && <p role="status" className="meta" style={spacing}>{busy === 'discover' || busy === 'more' ? 'Reading one page of your Blackboard course list. This may take a moment.' : busy === 'refresh' ? 'Reading material from your saved course selection…' : 'Saving your course selection…'}</p>}
    {notice && <p role="status" className="alert" style={spacing}>{notice}</p>}
    {error && <div role="alert" className="inline-error" style={spacing}><p>{error}</p><button className="text-button" type="button" disabled={blocked} onClick={() => void run('retry', async () => {
      const result = await request('/api/connectors/blackboard');
      if (mounted.current) {
        setStatus(result); if (!status) {
          setSelection(result.selected); setQuery(result.catalog.query ?? ''); setCatalogQuery(result.catalog.query ?? '');
        }
        setKnownCourses(current => ({ ...current, ...Object.fromEntries(result.catalog.courses.map(course => [course.id, course])) }));
      }
    })}>Retry course selection</button></div>}
  </section>;
}
