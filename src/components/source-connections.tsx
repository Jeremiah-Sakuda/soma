'use client';

import { useCallback, useEffect, useState } from 'react';
import { SourceContextFields } from './source-context-fields';
import type { SourceAuthorityContext } from '@/lib/domain/source-context';
import type { WorkspaceResponse } from '@/lib/domain/types';

const fieldSpacing = { marginTop: 16 };

function ReadStatus({ lastReadAt, notice }: { lastReadAt?: string; notice?: string }) {
  return <div style={fieldSpacing}>
    <p className="meta">{lastReadAt
      ? `Last successful read: ${new Date(lastReadAt).toLocaleString()}.`
      : 'No successful live read recorded yet.'}</p>
    {notice && <p className="inline-caution">{notice}</p>}
  </div>;
}

type GoogleProvider = 'gmail' | 'calendar';
type Connection = {
  id?: string;
  provider: string;
  status: 'connected' | 'connecting' | 'current' | 'stale' | 'error' | 'login-required' | 'disconnected';
  lastSuccessAt?: string;
  notice?: string;
  configuration?: { queries?: { courseId: string; query: string; context?: SourceAuthorityContext }[]; calendarIds?: string[]; timezone?: string };
};
type GoogleStatus = { configured: boolean; providers: Record<GoogleProvider, boolean>; connections: Connection[] };
type Calendar = { id: string; summary: string; timeZone?: string; primary?: boolean };

async function jsonRequest(path: string, method = 'GET', payload?: unknown) {
  const response = await fetch(path, { method, ...(payload === undefined ? {} : {
    headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
  }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'The connection request could not be completed.');
  return result;
}

function GoogleConnections({ data, reload }: { data: WorkspaceResponse; reload: () => Promise<void> }) {
  const [status, setStatus] = useState<GoogleStatus>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState('');
  const [queries, setQueries] = useState<{ courseId: string; query: string; context?: SourceAuthorityContext }[]>([{ courseId: '', query: '' }]);
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [calendarId, setCalendarId] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [calendarsLoaded, setCalendarsLoaded] = useState(false);
  const [truncated, setTruncated] = useState(false);
  const read = useCallback(async () => {
    const result: GoogleStatus = await jsonRequest('/api/connectors/google/status');
    setStatus(result);
    return result;
  }, []);
  useEffect(() => { let active = true; void read().then(result => {
    if (!active) return;
    const gmail = result.connections.find(item => item.provider === 'gmail');
    const calendar = result.connections.find(item => item.provider === 'calendar');
    if (gmail?.configuration?.queries?.length) setQueries(gmail.configuration.queries);
    if (calendar?.configuration?.calendarIds?.[0]) setCalendarId(calendar.configuration.calendarIds[0]);
    if (calendar?.configuration?.timezone) setTimezone(calendar.configuration.timezone);
  }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, [read]);
  async function run(key: string, action: () => Promise<void>) {
    setBusy(key); setError(''); setNotice('');
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : 'The connection request failed.'); }
    finally { setBusy(''); }
  }
  async function connect(provider: GoogleProvider) {
    await run(`${provider}-connect`, async () => {
      const result = await jsonRequest('/api/connectors/google/start', 'POST', { provider });
      const url = new URL(result.authorizationUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'accounts.google.com') throw new Error('The authorization address was not recognized.');
      window.location.assign(url.href);
    });
  }
  async function save(provider: GoogleProvider) {
    await run(`${provider}-save`, async () => {
      if (provider === 'gmail' && queries.some(item => !/(?:^|\s|\()(?:label|from|subject):\S+/i.test(item.query))) throw new Error('Each Gmail query must select a specific label, sender (from:), or subject.');
      await jsonRequest('/api/connectors/google/settings', 'PATCH', provider === 'gmail'
        ? { provider, queries }
        : { provider, calendarIds: [calendarId], timezone });
      await read(); setNotice('Selected source scope saved. Refresh reads only that selection.');
    });
  }
  async function refresh(provider: GoogleProvider) {
    await run(`${provider}-refresh`, async () => {
      await jsonRequest('/api/connectors/google/refresh', 'POST', { provider });
      await read(); await reload(); setNotice('Refresh finished. Review the recorded read status and source versions.');
    });
  }
  async function disconnect(provider: GoogleProvider) {
    await run(`${provider}-disconnect`, async () => {
      await jsonRequest('/api/connectors/google/connection', 'DELETE', { provider });
      await read(); await reload(); setNotice('Soma’s stored connection was removed. Existing source records remain inspectable.');
    });
  }
  return <div style={fieldSpacing}>
    <h3>Google sources</h3>
    <p className="meta">Read-only Gmail and Google Calendar authorization. Choose what to collect before refreshing.</p>
    {!status && !error && <p role="status" className="meta">Checking connection configuration…</p>}
    {status && !status.configured && <p className="inline-caution">Google OAuth is not configured on this deployment. Connecting and refreshing Google sources is unavailable until configuration is restored.</p>}
    {status && (['gmail', 'calendar'] as const).map(provider => {
      const connection = status.connections.find(item => item.provider === provider);
      const connected = !!connection && !['disconnected', 'login-required', 'connecting'].includes(connection.status);
      const configured = status.configured && status.providers[provider];
      const saved = provider === 'gmail' ? !!connection?.configuration?.queries?.length : !!connection?.configuration?.calendarIds?.length;
      const scopeChanged = provider === 'gmail' ? JSON.stringify(queries) !== JSON.stringify(connection?.configuration?.queries ?? []) : calendarId !== connection?.configuration?.calendarIds?.[0] || timezone !== connection?.configuration?.timezone;
      return <section className="card" style={fieldSpacing} key={provider} aria-label={provider === 'gmail' ? 'Gmail connection' : 'Google Calendar connection'}>
        <div className="section-heading"><h3>{provider === 'gmail' ? 'Gmail' : 'Google Calendar'}</h3><span className="status-chip">{connection?.status ?? 'Not connected'}</span></div>
        <ReadStatus lastReadAt={connection?.lastSuccessAt} notice={connection?.notice} />
        <div className="action-row" style={fieldSpacing}>
          <button className="secondary-button" disabled={!!busy || !configured} onClick={() => void connect(provider)}>{connection && connection.status !== 'disconnected' ? 'Reconnect' : 'Connect'} {provider === 'gmail' ? 'Gmail' : 'Google Calendar'}</button>
          {connection && connection.status !== 'disconnected' && <button className="text-button" disabled={!!busy} onClick={() => void disconnect(provider)}>Disconnect</button>}
        </div>
        {connected && <form onSubmit={event => { event.preventDefault(); void save(provider); }}>
          {provider === 'gmail' ? <>
            <p className="meta" style={fieldSpacing}>Select a specific label, sender (from:), or subject for each course. Each refresh checks one saved query, rotating through your mappings.</p>
            {!data.workspace.courses.length && <p className="inline-caution">Add a course using a selected material import before mapping Gmail messages.</p>}
            {queries.map((query, index) => <fieldset key={index} style={fieldSpacing}>
              <legend className="field-label">Selection {index + 1}</legend>
              <label className="field-label" htmlFor={`gmail-course-${index}`}>Course</label>
              <select id={`gmail-course-${index}`} value={query.courseId} required onChange={event => setQueries(items => items.map((item, position) => position === index ? { ...item, courseId: event.target.value } : item))}>
                <option value="">Choose a course</option>{data.workspace.courses.map(course => <option value={course.id} key={course.id}>{course.code} · {course.title}</option>)}
              </select>
              <label className="field-label" htmlFor={`gmail-query-${index}`}>Gmail query</label>
              <input id={`gmail-query-${index}`} type="text" value={query.query} required minLength={3} maxLength={500} placeholder="from:instructor@example.edu newer_than:30d" onChange={event => setQueries(items => items.map((item, position) => position === index ? { ...item, query: event.target.value } : item))} />
              <SourceContextFields prefix={`gmail-context-${index}`} value={query.context} sources={data.workspace.sources.filter(source => source.courseId === query.courseId)} assessments={data.workspace.courses.find(course => course.id === query.courseId)?.assessments} onChange={context => setQueries(items => items.map((item, position) => position === index ? { ...item, context } : item))}/>
              {queries.length > 1 && <button className="text-button" type="button" onClick={() => setQueries(items => items.filter((_, position) => position !== index))}>Remove selection {index + 1}</button>}
            </fieldset>)}
            <button className="text-button" type="button" disabled={queries.length >= 20} onClick={() => setQueries(items => [...items, { courseId: '', query: '' }])}>Add another course query</button>
          </> : <>
            <button style={fieldSpacing} className="secondary-button" type="button" disabled={!!busy} onClick={() => void run('calendar-list', async () => {
              const result = await jsonRequest('/api/connectors/google/calendars'); setCalendars(result.calendars); setTruncated(!!result.truncated); setCalendarsLoaded(true);
            })}>{calendarsLoaded ? 'Reload available calendars' : 'List my calendars'}</button>
            <p className="meta" style={fieldSpacing}>Refresh reads the next seven days from one selected calendar.</p>
            <label className="field-label" htmlFor="selected-calendar">Calendar to read</label>
            <select id="selected-calendar" value={calendarId} required onChange={event => { setCalendarId(event.target.value); const selected = calendars.find(calendar => calendar.id === event.target.value); if (selected?.timeZone) setTimezone(selected.timeZone); }}>
              <option value="">Choose one calendar</option>{calendarId && !calendars.some(calendar => calendar.id === calendarId) && <option value={calendarId}>{calendarId} · saved selection</option>}{calendars.map(calendar => <option key={calendar.id} value={calendar.id}>{calendar.summary}{calendar.primary ? ' · Primary' : ''}</option>)}
            </select>
            {calendarsLoaded && !calendars.length && <p className="meta">No readable calendars returned.</p>}
            {truncated && <p className="inline-caution">The provider returned a bounded calendar list. Only the calendars shown are available for this selection.</p>}
            <label className="field-label" htmlFor="calendar-timezone">Timezone</label>
            <input id="calendar-timezone" type="text" value={timezone} onChange={event => setTimezone(event.target.value)} required />
          </>}
          <div className="action-row" style={fieldSpacing}>
            <button className="secondary-button" disabled={!!busy || (provider === 'gmail' && !data.workspace.courses.length)} type="submit">Save selected scope</button>
            <button className="primary-button" disabled={!!busy || !saved || scopeChanged || !configured} type="button" onClick={() => void refresh(provider)}>Refresh saved selection</button>
          </div>
        </form>}
      </section>;
    })}
    {busy && <p role="status" className="meta" style={fieldSpacing}>Connection request in progress…</p>}
    {notice && <p role="status" className="alert" style={fieldSpacing}>{notice}</p>}
    {error && <p role="alert" className="inline-error">{error}<button className="text-button" onClick={() => void run('status', async () => { await read(); })}>Retry connection status</button></p>}
  </div>;
}

type BrowserProvider = 'blackboard' | 'gradescope' | 'piazza';
type BrowserTarget = { courseId: string; url: string; context?: SourceAuthorityContext };
type BrowserConnection = Omit<Connection, 'configuration'> & { configuration?: { targets?: BrowserTarget[] } };
type BrowserStatus = { configured: boolean; providers: {
  provider: BrowserProvider; label: string; homeUrl: string; connection?: BrowserConnection;
}[] };
type LoginWindow = { loginUrl: string; expiresAt: string };

function BrowserConnections({ data, reload }: { data: WorkspaceResponse; reload: () => Promise<void> }) {
  const [status, setStatus] = useState<BrowserStatus>();
  const [targets, setTargets] = useState<Partial<Record<BrowserProvider, BrowserTarget[]>>>({});
  const [login, setLogin] = useState<Partial<Record<BrowserProvider, LoginWindow>>>({});
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const read = useCallback(async () => {
    const result: BrowserStatus = await jsonRequest('/api/connectors/browser');
    setStatus(result); return result;
  }, []);
  useEffect(() => { let active = true; void read().then(result => {
    if (!active) return;
    setTargets(Object.fromEntries(result.providers.map(item => [item.provider, item.connection?.configuration?.targets?.length
      ? item.connection.configuration.targets : [{ courseId: '', url: '' }]])));
  }).catch(err => { if (active) setError(err.message); }); return () => { active = false; }; }, [read]);
  async function action(provider: BrowserProvider, name: 'start' | 'complete' | 'refresh' | 'disconnect' | 'configure') {
    setBusy(`${provider}-${name}`); setError(''); setNotice('');
    try {
      const result = await jsonRequest('/api/connectors/browser', 'POST', { provider, action: name, ...(name === 'configure' ? { targets: targets[provider] ?? [] } : {}) });
      if (name === 'start') {
        const url = new URL(result.loginUrl);
        if (url.protocol !== 'https:') throw new Error('The secure login address was not available.');
        setLogin(current => ({ ...current, [provider]: { loginUrl: url.href, expiresAt: result.expiresAt } }));
      }
      if (name === 'complete' || name === 'disconnect') setLogin(current => ({ ...current, [provider]: undefined }));
      await read();
      if (name === 'refresh' || name === 'disconnect') await reload();
      setNotice(result.notice ?? (name === 'configure' ? 'Selected course pages saved. Refresh reads only these URLs.' : 'Connection state updated.'));
    } catch (err) { setError(err instanceof Error ? err.message : 'The source connection request failed.'); }
    finally { setBusy(''); }
  }
  function updateTarget(provider: BrowserProvider, index: number, update: Partial<BrowserTarget>) {
    setTargets(current => ({ ...current, [provider]: (current[provider] ?? []).map((target, position) => position === index ? { ...target, ...update } : target) }));
  }
  return <div style={fieldSpacing}>
    <h3>Course sites</h3>
    <p className="meta">Sign in through a browser hosted by Browserbase, separate from your everyday browser. Enter passwords and MFA only on the provider’s actual login page; do not save passwords in the hosted browser.</p>
    <p className="meta">Browserbase retains sensitive browser state, including cookies and site storage. Soma’s authorized server can use that session. Page selection limits Soma’s collection; the underlying login can have broader account access. Disconnect deletes the saved context; failed cleanup is retained for retry. Sessions can expire and require MFA again.</p>
    {!status && !error && <p className="meta" role="status">Checking browser connection availability…</p>}
    {status && !status.configured && <p className="inline-caution">Persistent browser access is not configured on this deployment. New login sessions are unavailable until configuration is restored.</p>}
    {status?.providers.map(item => {
      const connection = item.connection;
      const selected = targets[item.provider] ?? [{ courseId: '', url: '' }];
      const session = login[item.provider];
      const saved = !!connection?.configuration?.targets?.length;
      const scopeChanged = JSON.stringify(selected) !== JSON.stringify(connection?.configuration?.targets ?? []);
      const connected = !!connection && !['disconnected', 'login-required', 'connecting'].includes(connection.status);
      return <section className="card" style={fieldSpacing} key={item.provider} aria-label={`${item.label} connection`}>
        <div className="section-heading"><h3>{item.label}</h3><span className="status-chip">{connection?.status ?? 'Not connected'}</span></div>
        <p className="meta" style={{ overflowWrap: 'anywhere' }}>{item.homeUrl}</p>
        <ReadStatus lastReadAt={connection?.lastSuccessAt} notice={connection?.notice} />
        <div className="action-row" style={fieldSpacing}>
          <button className="secondary-button" disabled={!!busy || !status.configured} onClick={() => void action(item.provider, 'start')}>{connection && connection.status !== 'disconnected' ? 'Reconnect' : 'Connect'} {item.label}</button>
          {connection && connection.status !== 'disconnected' && <button className="text-button" disabled={!!busy} onClick={() => void action(item.provider, 'disconnect')}>Disconnect</button>}
        </div>
        {session && <section className="settings-status" aria-label={`${item.label} login window`}>
          <h3>Finish signing in</h3>
          <p>The Browserbase login window is available until {new Date(session.expiresAt).toLocaleTimeString()}. Complete the provider’s login and any MFA, then return here.</p>
          <a className="primary-button" style={{ marginTop: 14, textDecoration: 'none' }} href={session.loginUrl} target="_blank" rel="noopener noreferrer">Open secure login window</a>
          <button className="secondary-button" style={fieldSpacing} disabled={!!busy} onClick={() => void action(item.provider, 'complete')}>I’ve finished signing in</button>
          <p className="meta">Saving the browser session does not prove source access. A successful read of your selected course page establishes that separately.</p>
        </section>}
        {connected && <form onSubmit={event => { event.preventDefault(); void action(item.provider, 'configure'); }}>
          <p className="meta" style={fieldSpacing}>Choose exact, read-only course page URLs. Collection stays within the pages you select; it does not submit work or post messages.</p>
          {!data.workspace.courses.length && <p className="inline-caution">Add a course using a selected material import before mapping course-site pages.</p>}
          {selected.map((target, index) => <fieldset key={index} style={fieldSpacing}>
            <legend className="field-label">Course page {index + 1}</legend>
            <label className="field-label" htmlFor={`${item.provider}-course-${index}`}>Course</label>
            <select id={`${item.provider}-course-${index}`} value={target.courseId} required onChange={event => updateTarget(item.provider, index, { courseId: event.target.value })}>
              <option value="">Choose a course</option>{data.workspace.courses.map(course => <option key={course.id} value={course.id}>{course.code} · {course.title}</option>)}
            </select>
            <label className="field-label" htmlFor={`${item.provider}-url-${index}`}>Exact course page URL</label>
            <input id={`${item.provider}-url-${index}`} type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" spellCheck={false} value={target.url} required maxLength={2048} pattern="https://.*" placeholder={item.homeUrl} onChange={event => updateTarget(item.provider, index, { url: event.target.value })} />
            <SourceContextFields prefix={`${item.provider}-context-${index}`} value={target.context} sources={data.workspace.sources.filter(source => source.courseId === target.courseId)} assessments={data.workspace.courses.find(course => course.id === target.courseId)?.assessments} onChange={context => updateTarget(item.provider, index, { context })}/>
            {selected.length > 1 && <button className="text-button" type="button" onClick={() => setTargets(current => ({ ...current, [item.provider]: selected.filter((_, position) => position !== index) }))}>Remove course page {index + 1}</button>}
          </fieldset>)}
          <button className="text-button" type="button" disabled={selected.length >= 5} onClick={() => setTargets(current => ({ ...current, [item.provider]: [...selected, { courseId: '', url: '' }] }))}>Add another course page</button>
          <div className="action-row" style={fieldSpacing}>
            <button type="submit" className="secondary-button" disabled={!!busy || !data.workspace.courses.length}>Save selected pages</button>
            <button type="button" className="primary-button" disabled={!!busy || !saved || scopeChanged || !status.configured} onClick={() => void action(item.provider, 'refresh')}>Refresh saved pages</button>
          </div>
        </form>}
      </section>;
    })}
    {busy && <p role="status" className="meta" style={fieldSpacing}>Connection request in progress…</p>}
    {notice && <p role="status" className="alert" style={fieldSpacing}>{notice}</p>}
    {error && <p role="alert" className="inline-error">{error}<button className="text-button" onClick={() => { setError(''); void read().catch(err => setError(err.message)); }}>Retry connection status</button></p>}
  </div>;
}

export function SourceConnections({ data, reload }: { data: WorkspaceResponse; reload: () => Promise<void> }) {
  return <details className="import-panel">
    <summary>Connect course sites, Gmail and Calendar</summary>
    <p className="meta">Connections belong to this account. Source collection is read only, and every successful read keeps its own timestamp and source version.</p>
    <BrowserConnections data={data} reload={reload} />
    <GoogleConnections data={data} reload={reload} />
  </details>;
}
