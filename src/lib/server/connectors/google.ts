import { readJsonBody } from '../http';
import {
  sourceAuthorityContextSchema,
  validateSourceContext,
  type SourceAuthorityContext,
} from '../../domain/source-context';
import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { CommitmentObservation, WorkspaceState } from '../../domain/types';
import {
  ingestCommitments,
  refreshSessionRecommendation,
  selectAvailability,
  setCalendarContext,
} from '../../domain/commitments';
import {
  readAccountWorkspace,
  readOrCreateAccountWorkspace,
  updateAccountWorkspace,
} from '../account-store';
import type { VerifiedAccount } from '../account';
import { WorkspaceStoreError } from '../store';
import { applyCollectedSources, type CollectedSource } from './ingest';
import {
  acquireConnectionLease,
  connectionPublicationGuard,
  consumeConnectionState,
  createConnectionState,
  deleteConnection,
  listConnections,
  readConnection,
  releaseConnectionLease,
  saveConnection,
  type Connection,
} from './store';

export type GoogleProvider = 'gmail' | 'calendar';
type GoogleSecret = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes: string[];
};
export type GoogleConfiguration = {
  queries?: { courseId: string; query: string; context?: SourceAuthorityContext }[];
  nextQueryIndex?: number;
  calendarIds?: string[];
  timezone?: string;
};
type OAuthState = {
  provider: GoogleProvider;
  verifier: string;
  workspaceId: string;
  connectionVersion: number;
};
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
const connectionId = (provider: GoogleProvider) => `google-${provider}`;
export const GOOGLE_SCOPES = {
  gmail: ['https://www.googleapis.com/auth/gmail.readonly'],
  calendar: [
    'https://www.googleapis.com/auth/calendar.events.readonly',
    'https://www.googleapis.com/auth/calendar.calendarlist.readonly',
  ],
} as const;
const providerSchema = z.enum(['gmail', 'calendar']);
const validTimezone = (value: string) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
    return true;
  } catch {
    return false;
  }
};
export const googleSettingsSchema = z.discriminatedUnion('provider', [
  z.strictObject({
    provider: z.literal('gmail'),
    queries: z
      .array(
        z.strictObject({
          courseId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/),
          context: sourceAuthorityContextSchema.optional(),
          query: z
            .string()
            .trim()
            .min(3)
            .max(500)
            .refine(
              (query) => /(?:^|\s|\()(?:label|from|subject):\S+/i.test(query),
              'Choose a specific label, sender, or subject',
            ),
        }),
      )
      .min(1)
      .max(20),
  }),
  z.strictObject({
    provider: z.literal('calendar'),
    calendarIds: z.array(z.string().min(1).max(256)).length(1),
    timezone: z.string().max(80).refine(validTimezone),
  }),
]);

export function googleAppOrigin(): string {
  try {
    const url = new URL(process.env.SOMA_APP_URL || '');
    if (
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.pathname !== '/' ||
      (url.protocol !== 'https:' &&
        !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
    )
      throw new Error();
    return url.origin;
  } catch {
    throw new WorkspaceStoreError(
      'The source callback URL is not configured.',
      503,
      'google_configuration',
    );
  }
}
function oauthConfiguration() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret || !process.env.SOMA_CONNECTOR_ENCRYPTION_KEY)
    throw new WorkspaceStoreError(
      'Google connections need an OAuth web client configured by the app owner.',
      503,
      'google_configuration',
    );
  return {
    clientId,
    clientSecret,
    redirectUri: `${googleAppOrigin()}/api/connectors/google/callback`,
  };
}
export function googleConfigured(): boolean {
  try {
    oauthConfiguration();
    return true;
  } catch {
    return false;
  }
}
export function parseGoogleProvider(value: unknown): GoogleProvider {
  const result = providerSchema.safeParse(value);
  if (!result.success)
    throw new WorkspaceStoreError('Choose Gmail or Google Calendar.', 400, 'google_provider');
  return result.data;
}

export function googleAuthorizationUrl(
  provider: GoogleProvider,
  state: string,
  verifier: string,
): string {
  const config = oauthConfiguration();
  const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  url.search = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: GOOGLE_SCOPES[provider].join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent select_account',
    include_granted_scopes: 'true',
    code_challenge: createHash('sha256').update(verifier).digest('base64url'),
    code_challenge_method: 'S256',
  }).toString();
  return url.toString();
}

export async function startGoogleConnection(
  account: VerifiedAccount,
  provider: GoogleProvider,
): Promise<string> {
  oauthConfiguration();
  const workspace = await readOrCreateAccountWorkspace(account);
  const previous = await readConnection(account, connectionId(provider));
  const verifier = randomBytes(48).toString('base64url');
  const state = await createConnectionState<OAuthState>(account, workspace.id, {
    provider,
    verifier,
    workspaceId: workspace.id,
    connectionVersion: previous?.version ?? 0,
  });
  return googleAuthorizationUrl(provider, state, verifier);
}

async function boundedJson(response: Response, maxBytes = 1_048_576): Promise<any> {
  const reader = response.body?.getReader();
  if (!reader)
    throw new WorkspaceStoreError('Google returned an empty response.', 502, 'google_response');
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new WorkspaceStoreError(
        'The selected Google response is too large. Narrow its scope.',
        413,
        'google_capacity',
      );
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new WorkspaceStoreError(
      'Google returned an unreadable response.',
      502,
      'google_response',
    );
  }
}

async function tokenRequest(parameters: Record<string, string>): Promise<any> {
  const config = oauthConfiguration();
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ...parameters,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store',
    redirect: 'error',
  });
  const body = await boundedJson(response, 32_768);
  if (!response.ok || typeof body.access_token !== 'string')
    throw new WorkspaceStoreError(
      'Google authorization expired or was not granted. Reconnect the source.',
      401,
      'google_authorization',
    );
  return body;
}

export async function finishGoogleConnection(
  account: VerifiedAccount,
  stateToken: string,
  code: string,
): Promise<void> {
  if (!code || code.length > 4096)
    throw new WorkspaceStoreError(
      'Google did not return an authorization code.',
      400,
      'google_code',
    );
  const state = await consumeConnectionState<OAuthState>(account, stateToken);
  const provider = parseGoogleProvider(state.provider);
  const config = oauthConfiguration();
  const body = await tokenRequest({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.redirectUri,
    code_verifier: state.verifier,
  });
  const secret = parseGoogleAuthorizationTokens(body, provider);
  const previous = await readConnection<GoogleSecret, GoogleConfiguration>(
    account,
    connectionId(provider),
  );
  await saveConnection(
    account,
    state.workspaceId,
    connectionId(provider),
    {
      provider,
      status: 'connected',
      configuration: previous?.configuration ?? {},
      secret,
      notice: 'Authorized. Select a scope and refresh to verify the first read.',
    },
    state.connectionVersion,
  );
}

export function parseGoogleAuthorizationTokens(
  body: unknown,
  provider: GoogleProvider,
  now = Date.now(),
): GoogleSecret {
  const result = z
    .object({
      access_token: z.string().min(1).max(8192),
      refresh_token: z.string().min(1).max(8192),
      token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
      expires_in: z.number().int().min(1).max(86_400),
      scope: z.string().max(8192),
    })
    .safeParse(body);
  if (!result.success)
    throw new WorkspaceStoreError(
      'Google did not provide durable authorization. Reconnect the source.',
      403,
      'google_scope',
    );
  const scopes = result.data.scope.split(' ');
  if (!GOOGLE_SCOPES[provider].every((scope) => scopes.includes(scope)))
    throw new WorkspaceStoreError(
      'Required read-only access was not granted. Reconnect and allow the selected source.',
      403,
      'google_scope',
    );
  return {
    accessToken: result.data.access_token,
    refreshToken: result.data.refresh_token,
    expiresAt: now + result.data.expires_in * 1000,
    scopes,
  };
}

export async function googleConnectionStatus(account: VerifiedAccount) {
  const configured = googleConfigured();
  await readOrCreateAccountWorkspace(account);
  return {
    configured,
    providers: { gmail: configured, calendar: configured },
    connections: (await listConnections(account)).filter((connection) =>
      ['gmail', 'calendar'].includes(connection.provider),
    ),
  };
}

export async function saveGoogleSettings(account: VerifiedAccount, input: unknown): Promise<void> {
  const parsed = googleSettingsSchema.safeParse(input);
  if (!parsed.success)
    throw new WorkspaceStoreError(
      'Choose explicit course mail queries or one calendar and a valid timezone.',
      400,
      'google_selection',
    );
  const value = parsed.data;
  const connection = await readConnection<GoogleSecret, GoogleConfiguration>(
    account,
    connectionId(value.provider),
  );
  if (!connection || connection.status === 'disconnected')
    throw new WorkspaceStoreError('Connect this Google source first.', 409, 'connection_missing');
  const workspace = await readAccountWorkspace(account);
  if (
    !workspace ||
    (value.provider === 'gmail' &&
      value.queries.some(
        (query) => !workspace.courses.some((course) => course.id === query.courseId),
      ))
  )
    throw new WorkspaceStoreError(
      'Every mail query must map to a course in this workspace.',
      422,
      'google_course_scope',
    );
  if (value.provider === 'gmail')
    for (const query of value.queries)
      validateSourceContext(workspace, query.courseId, query.context);
  const { provider: _provider, ...configuration } = value;
  await saveConnection(
    account,
    workspace.id,
    connection.id,
    {
      ...connection,
      configuration,
      status: 'connected',
      notice: 'Selection saved. Refresh to verify the selected sources.',
    },
    connection.version,
  );
  await updateAccountWorkspace(account, (current) => {
    for (const source of current.sources)
      if (source.provenance?.sourceKey.startsWith(`${value.provider}:${connection.id}:`))
        source.status = 'stale';
    if (value.provider === 'calendar' && current.calendarContext?.mode === 'live') {
      const before = selectAvailability(current);
      current.calendarContext.status = 'stale';
      refreshSessionRecommendation(
        current,
        new Date().toISOString(),
        'Calendar selection changed',
        before,
      );
    }
    return current;
  });
}

async function freshSecret(secret: GoogleSecret): Promise<GoogleSecret> {
  if (secret.accessToken && secret.expiresAt > Date.now() + 60_000) return secret;
  if (!secret.refreshToken)
    throw new WorkspaceStoreError('Reconnect this Google source.', 401, 'google_authorization');
  const body = await tokenRequest({
    grant_type: 'refresh_token',
    refresh_token: secret.refreshToken,
  });
  const result = z
    .object({
      access_token: z.string().min(1).max(8192),
      token_type: z.string().refine((value) => value.toLowerCase() === 'bearer'),
      expires_in: z.number().int().min(1).max(86_400),
      refresh_token: z.string().min(1).max(8192).optional(),
    })
    .safeParse(body);
  if (!result.success)
    throw new WorkspaceStoreError(
      'Google returned invalid authorization. Reconnect the source.',
      401,
      'google_authorization',
    );
  return {
    ...secret,
    accessToken: result.data.access_token,
    expiresAt: Date.now() + result.data.expires_in * 1000,
    ...(result.data.refresh_token ? { refreshToken: result.data.refresh_token } : {}),
  };
}

async function googleRead(url: URL, secret: GoogleSecret, deadline: number): Promise<any> {
  if (
    !['gmail.googleapis.com', 'www.googleapis.com'].includes(url.hostname) ||
    url.protocol !== 'https:'
  )
    throw new Error('Unapproved Google API target.');
  const remaining = deadline - Date.now();
  if (remaining <= 0)
    throw new WorkspaceStoreError(
      'Source refresh reached its time limit. Narrow the selection.',
      504,
      'google_timeout',
    );
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secret.accessToken}` },
    method: 'GET',
    signal: AbortSignal.timeout(Math.min(15_000, remaining)),
    cache: 'no-store',
    redirect: 'error',
  });
  if (!response.ok)
    throw new WorkspaceStoreError(
      response.status === 401 || response.status === 403
        ? 'Google access needs to be reconnected or the selected permission was not granted.'
        : 'Google could not complete this source check. Previously saved material is stale.',
      response.status === 401 || response.status === 403 ? 401 : 502,
      'google_read',
    );
  return boundedJson(response);
}

/** Explicit bounded pagination: a next-page token is never silently treated as complete. */
export async function collectBoundedPages<T>(
  read: (pageToken?: string) => Promise<{ items: T[]; nextPageToken?: string }>,
  maxPages: number,
  maxItems: number,
): Promise<{ items: T[]; truncated: boolean }> {
  const items: T[] = [];
  const seen = new Set<string>();
  let pageToken: string | undefined;
  for (let page = 0; page < maxPages; page++) {
    const result = await read(pageToken);
    if (!Array.isArray(result.items)) throw new Error('Invalid provider page.');
    const remaining = maxItems - items.length;
    items.push(...result.items.slice(0, remaining));
    if (result.items.length > remaining) return { items, truncated: true };
    if (!result.nextPageToken) return { items, truncated: false };
    if (seen.has(result.nextPageToken) || items.length >= maxItems)
      return { items, truncated: true };
    seen.add(result.nextPageToken);
    pageToken = result.nextPageToken;
  }
  return { items, truncated: true };
}

export function normalizeGmailMessage(
  message: any,
  courseId: string,
  context?: SourceAuthorityContext,
): CollectedSource {
  if (typeof message.id !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(message.id))
    throw new Error('Invalid Gmail message identity.');
  const headers = Array.isArray(message.payload?.headers) ? message.payload.headers : [];
  const header = (name: string) =>
    String(
      headers.find((item: any) => String(item.name).toLowerCase() === name)?.value ?? '',
    ).slice(0, 500);
  const plain: string[] = [];
  let visited = 0;
  const walk = (part: any, depth: number) => {
    if (!part || depth > 8 || ++visited > 64) return;
    if (part.mimeType === 'text/plain' && typeof part.body?.data === 'string')
      plain.push(Buffer.from(part.body.data, 'base64url').toString('utf8'));
    if (Array.isArray(part.parts)) for (const child of part.parts) walk(child, depth + 1);
  };
  walk(message.payload, 0);
  const content = plain.length
    ? plain.join('\n\n')
    : `Message preview only; full plain-text body unavailable:\n${String(message.snippet ?? '')}`;
  const body = `Subject: ${header('subject')}\nFrom: ${header('from')}\nDate header: ${header('date') || 'Unknown'}\n\n${content}`;
  return {
    id: message.id,
    courseId,
    ...(context ? { context } : {}),
    title: (header('subject') || 'Selected course email').slice(0, 300),
    body:
      body.length > 48_000
        ? `${body.slice(0, 47_920)}\n[Content truncated at the collection limit; attachments not collected.]`
        : body,
    kind: 'email',
    url: `https://mail.google.com/mail/u/0/#all/${message.id}`,
  };
}

type CalendarEvent = {
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
  timezone: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  busy: boolean;
  updated?: string;
  url?: string;
};
export function calendarMidnight(date: string, timezone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !validTimezone(timezone))
    throw new Error('Invalid calendar date or timezone.');
  const target = Date.parse(`${date}T00:00:00Z`);
  let candidate = target;
  if (!Number.isFinite(target) || new Date(target).toISOString().slice(0, 10) !== date)
    throw new Error('Invalid calendar date.');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  for (let iteration = 0; iteration < 3; iteration++) {
    const parts = Object.fromEntries(
      formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
    );
    const represented = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
      Number(parts.second),
    );
    candidate += target - represented;
  }
  const final = Object.fromEntries(
    formatter.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]),
  );
  if (
    `${final.year}-${final.month}-${final.day}` !== date ||
    final.hour !== '00' ||
    final.minute !== '00'
  )
    throw new Error('Calendar midnight does not exist in this timezone.');
  return new Date(candidate).toISOString();
}

export function normalizeCalendarEvent(event: any, timezone: string): CalendarEvent {
  if (
    typeof event.id !== 'string' ||
    !/^[a-zA-Z0-9_-]{1,256}$/.test(event.id) ||
    !validTimezone(timezone)
  )
    throw new Error('Invalid calendar event identity.');
  const self = Array.isArray(event.attendees)
    ? event.attendees.find((attendee: any) => attendee.self === true)
    : undefined;
  const status =
    event.status === 'cancelled' || self?.responseStatus === 'declined'
      ? 'cancelled'
      : event.status === 'tentative' || ['needsAction', 'tentative'].includes(self?.responseStatus)
        ? 'tentative'
        : 'confirmed';
  const instant = (value: any) => {
    if (
      typeof value?.dateTime === 'string' &&
      /(?:Z|[+-]\d\d:\d\d)$/.test(value.dateTime) &&
      Number.isFinite(Date.parse(value.dateTime))
    )
      return new Date(value.dateTime).toISOString();
    if (typeof value?.date === 'string')
      return calendarMidnight(value.date, value.timeZone || timezone);
    return undefined;
  };
  const startAt = instant(event.start);
  const endAt = instant(event.end);
  if (status !== 'cancelled' && (!startAt || !endAt || Date.parse(endAt) <= Date.parse(startAt)))
    throw new Error('Calendar interval is incomplete.');
  return {
    id: event.id,
    title: String(event.summary || 'Selected busy event').slice(0, 160),
    ...(startAt ? { startAt } : {}),
    ...(endAt ? { endAt } : {}),
    timezone,
    status,
    busy: event.transparency !== 'transparent',
    ...(typeof event.updated === 'string' && Number.isFinite(Date.parse(event.updated))
      ? { updated: new Date(event.updated).toISOString() }
      : {}),
    ...(typeof event.htmlLink === 'string' &&
    event.htmlLink.startsWith('https://www.google.com/calendar/')
      ? { url: event.htmlLink }
      : {}),
  };
}

export async function listGoogleCalendars(account: VerifiedAccount) {
  const leased = await acquireConnectionLease<GoogleSecret, GoogleConfiguration>(
    account,
    connectionId('calendar'),
    'list-calendars',
    60_000,
  );
  let secret = leased.connection.secret;
  try {
    secret = await freshSecret(secret);
    const deadline = Date.now() + 40_000;
    const result = await collectBoundedPages<any>(
      async (pageToken) => {
        const url = new URL('https://www.googleapis.com/calendar/v3/users/me/calendarList');
        url.searchParams.set('maxResults', '50');
        url.searchParams.set('minAccessRole', 'reader');
        if (pageToken) url.searchParams.set('pageToken', pageToken);
        const page = await googleRead(url, secret, deadline);
        return { items: page.items ?? [], nextPageToken: page.nextPageToken };
      },
      2,
      100,
    );
    await releaseConnectionLease(account, leased.connection.id, leased.leaseId, { secret });
    return {
      calendars: result.items.map((item) => ({
        id: String(item.id),
        summary: String(item.summary || 'Calendar'),
        timeZone: String(item.timeZone || ''),
        primary: item.primary === true,
      })),
      truncated: result.truncated,
    };
  } catch (error) {
    await releaseConnectionLease(account, leased.connection.id, leased.leaseId, {
      secret,
      status: 'login-required',
      notice: 'Could not list calendars. Reconnect if access expired.',
    });
    throw error;
  }
}

export async function refreshGoogleConnection(
  account: VerifiedAccount,
  provider: GoogleProvider,
): Promise<WorkspaceState> {
  const workspace = await readAccountWorkspace(account);
  if (!workspace)
    throw new WorkspaceStoreError('Open a private workspace first.', 404, 'workspace_missing');
  const leased = await acquireConnectionLease<GoogleSecret, GoogleConfiguration>(
    account,
    connectionId(provider),
    'read-selected-sources',
    120_000,
  );
  const connection = leased.connection;
  let secret = connection.secret;
  const checkedAt = new Date().toISOString();
  try {
    secret = await freshSecret(secret);
    const deadline = Date.now() + 60_000;
    const records: CollectedSource[] = [];
    let truncated = false;
    let events: CalendarEvent[] = [];
    let calendarId = '';
    let timezone = connection.configuration.timezone || workspace.timezone || 'UTC';
    let nextConfiguration = connection.configuration;
    if (provider === 'gmail') {
      const queries = connection.configuration.queries ?? [];
      if (!queries.length)
        throw new WorkspaceStoreError(
          'Select a course and mail query before refreshing.',
          422,
          'google_selection',
        );
      const index = (connection.configuration.nextQueryIndex ?? 0) % queries.length;
      const selected = queries[index];
      if (!workspace.courses.some((course) => course.id === selected.courseId))
        throw new WorkspaceStoreError(
          'The selected course is no longer available.',
          422,
          'google_course_scope',
        );
      const listed = await collectBoundedPages<{ id: string }>(
        async (pageToken) => {
          const url = new URL('https://gmail.googleapis.com/gmail/v1/users/me/messages');
          url.searchParams.set('q', selected.query);
          url.searchParams.set('maxResults', '10');
          if (pageToken) url.searchParams.set('pageToken', pageToken);
          const page = await googleRead(url, secret, deadline);
          return { items: page.messages ?? [], nextPageToken: page.nextPageToken };
        },
        2,
        20,
      );
      truncated = listed.truncated;
      for (let offset = 0; offset < listed.items.length; offset += 4) {
        const selectedMessages = listed.items.slice(offset, offset + 4);
        const batch = await Promise.all(
          selectedMessages.map(async (item) => {
            if (!/^[a-zA-Z0-9_-]{1,128}$/.test(item.id))
              throw new Error('Invalid Google message ID.');
            const url = new URL(
              `https://gmail.googleapis.com/gmail/v1/users/me/messages/${item.id}`,
            );
            url.searchParams.set('format', 'full');
            return normalizeGmailMessage(
              await googleRead(url, secret, deadline),
              selected.courseId,
              selected.context,
            );
          }),
        );
        records.push(...batch);
      }
      nextConfiguration = {
        ...connection.configuration,
        nextQueryIndex: (index + 1) % queries.length,
      };
    } else {
      const ids = connection.configuration.calendarIds ?? [];
      if (ids.length !== 1)
        throw new WorkspaceStoreError(
          'Select one calendar before refreshing.',
          422,
          'google_selection',
        );
      calendarId = ids[0];
      const listed = await collectBoundedPages<any>(
        async (pageToken) => {
          const url = new URL(
            `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
          );
          for (const [key, value] of Object.entries({
            maxResults: '20',
            singleEvents: 'true',
            showDeleted: 'true',
            timeMin: checkedAt,
            timeMax: new Date(Date.parse(checkedAt) + 7 * 86_400_000).toISOString(),
          }))
            url.searchParams.set(key, value);
          if (pageToken) url.searchParams.set('pageToken', pageToken);
          const page = await googleRead(url, secret, deadline);
          if (typeof page.timeZone === 'string' && validTimezone(page.timeZone))
            timezone = page.timeZone;
          return { items: page.items ?? [], nextPageToken: page.nextPageToken };
        },
        2,
        40,
      );
      truncated = listed.truncated;
      events = listed.items.map((event) => normalizeCalendarEvent(event, timezone));
      for (const event of events)
        records.push({
          id: `${calendarId}:${event.id}`,
          title: event.title,
          body: JSON.stringify(event, null, 2),
          kind: 'calendar',
          ...(event.updated ? { modifiedAt: event.updated } : {}),
          ...(event.url ? { url: event.url } : {}),
        });
      records.push({
        id: `${calendarId}:selection-window`,
        title: 'Selected calendar coverage',
        body: JSON.stringify({
          calendarId,
          date: checkedAt.slice(0, 10),
          rollingDays: 7,
          complete: !truncated,
          eventIds: events.map((event) => event.id).sort(),
        }),
        kind: 'calendar',
      });
    }
    const saved = await updateAccountWorkspace(
      account,
      (current) => {
        const before = selectAvailability(current, checkedAt);
        let next = applyCollectedSources(current, records, {
          provider,
          connectionId: connection.id,
          checkedAt,
        }).workspace;
        if (provider === 'calendar') {
          const sourceFor = (id: string) =>
            next.sources
              .filter(
                (source) =>
                  source.provenance?.sourceKey ===
                  `${provider}:${connection.id}:${calendarId}:${id}`,
              )
              .sort((a, b) => b.version - a.version)[0];
          const coverage = sourceFor('selection-window');
          if (!coverage) throw new Error('Calendar coverage source was not saved.');
          const missing = markMissingCalendarEventsStale(
            next,
            events.map((event) => event.id),
            calendarId,
            connection.id,
            checkedAt,
          );
          setCalendarContext(next, {
            status: truncated || missing ? 'stale' : 'current',
            sourceRefs: [{ sourceId: coverage.id, version: coverage.version }],
            checkedAt,
            mode: 'live',
          });
          const observations: CommitmentObservation[] = [];
          for (const event of events) {
            const eventId = `gcal-${digest(`${calendarId}:${event.id}`).slice(0, 32)}`;
            const previous = next.commitments?.find((commitment) => commitment.id === eventId);
            const source = sourceFor(event.id);
            if (!source) continue;
            const startAt = event.startAt ?? previous?.startAt;
            const endAt = event.endAt ?? previous?.endAt;
            if (!startAt || !endAt) continue;
            observations.push({
              id: `observation-${digest(`${source.id}:${source.version}:${eventId}`).slice(0, 32)}`,
              workspaceId: next.id,
              eventId,
              title: event.title,
              category: 'Personal',
              kind: 'event',
              startAt,
              endAt,
              timezone: event.timezone,
              status: event.status,
              blocksFocus: event.busy,
              bufferBeforeMinutes: 0,
              bufferAfterMinutes: 0,
              sourceRefs: [{ sourceId: source.id, version: source.version }],
              observedAt: checkedAt,
              identityBasis:
                'Google Calendar selected calendar ID and stable provider event ID; no email-based identity inference.',
            });
          }
          next = ingestCommitments(next, observations, checkedAt, before);
          refreshSessionRecommendation(
            next,
            checkedAt,
            'Selected Google Calendar refreshed',
            before,
          );
        }
        return next;
      },
      workspace.revision,
      connectionPublicationGuard(account, connection.id, leased.leaseId),
    );
    const calendarStale = provider === 'calendar' && saved.calendarContext?.status === 'stale';
    await releaseConnectionLease(account, connection.id, leased.leaseId, {
      secret,
      configuration: nextConfiguration,
      status: truncated || calendarStale ? 'stale' : 'current',
      lastSuccessAt: checkedAt,
      lastAttemptAt: checkedAt,
      notice: truncated
        ? 'Read limit reached; only part of the selected scope was collected. Narrow the query or calendar.'
        : calendarStale
          ? 'The calendar was read, but a previously observed future event is missing. Availability remains uncertain until it is resolved.'
          : provider === 'gmail'
            ? 'Selected mail query read successfully. Each refresh checks one selected query, rotating through your mappings.'
            : 'Selected calendar read successfully for the next seven days.',
    });
    return saved;
  } catch (error) {
    try {
      await updateAccountWorkspace(
        account,
        (current) => {
          for (const source of current.sources)
            if (source.provenance?.sourceKey.startsWith(`${provider}:${connection.id}:`))
              source.status = 'stale';
          if (provider === 'calendar' && current.calendarContext?.mode === 'live') {
            const before = selectAvailability(current);
            current.calendarContext.status = 'stale';
            refreshSessionRecommendation(
              current,
              checkedAt,
              'Google Calendar refresh failed',
              before,
            );
          }
          return current;
        },
        undefined,
        connectionPublicationGuard(account, connection.id, leased.leaseId),
      );
    } catch {
      /* A changed/deleted workspace must not be recreated by failure handling. */
    }
    await releaseConnectionLease(account, connection.id, leased.leaseId, {
      secret,
      status:
        error instanceof WorkspaceStoreError && error.status === 401 ? 'login-required' : 'stale',
      lastAttemptAt: checkedAt,
      notice: 'The last refresh did not complete. Previously saved sources may be out of date.',
    });
    throw error;
  }
}

/** A complete read can omit moved or inaccessible events; absence is not cancellation evidence. */
export function markMissingCalendarEventsStale(
  state: WorkspaceState,
  eventIds: string[],
  calendarId: string,
  connection: string,
  checkedAt: string,
): number {
  const included = new Set(
    eventIds.map((id) => `gcal-${digest(`${calendarId}:${id}`).slice(0, 32)}`),
  );
  const missing = (state.commitments ?? []).filter(
    (commitment) =>
      commitment.status !== 'cancelled' &&
      Date.parse(commitment.endAt) > Date.parse(checkedAt) &&
      Date.parse(commitment.startAt) < Date.parse(checkedAt) + 7 * 86_400_000 &&
      !included.has(commitment.id) &&
      commitment.sourceRefs.some((ref) =>
        state.sources.some(
          (source) =>
            source.id === ref.sourceId &&
            source.provenance?.sourceKey.startsWith(`calendar:${connection}:${calendarId}:`),
        ),
      ),
  );
  for (const commitment of missing)
    for (const ref of commitment.sourceRefs)
      for (const source of state.sources) if (source.id === ref.sourceId) source.status = 'stale';
  return missing.length;
}

export async function disconnectGoogleConnection(
  account: VerifiedAccount,
  provider: GoogleProvider,
): Promise<void> {
  const id = connectionId(provider);
  await deleteConnection(account, id);
  await updateAccountWorkspace(account, (current) => {
    for (const source of current.sources)
      if (source.provenance?.sourceKey.startsWith(`${provider}:${id}:`)) source.status = 'stale';
    if (provider === 'calendar' && current.calendarContext?.mode === 'live') {
      const before = selectAvailability(current);
      current.calendarContext.status = 'stale';
      refreshSessionRecommendation(
        current,
        new Date().toISOString(),
        'Google Calendar disconnected',
        before,
      );
    }
    return current;
  });
}

export async function readGoogleJson(request: Request): Promise<unknown> {
  return readJsonBody(request);
}
