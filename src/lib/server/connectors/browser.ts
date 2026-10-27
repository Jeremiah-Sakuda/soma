import {logBrowserReadFailure,type BrowserReadPhase} from './browser-diagnostics';
import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Browser, Page } from 'playwright-core';
import type { VerifiedAccount } from '../account';
import { readAccountWorkspace, updateAccountWorkspace } from '../account-store';
import { WorkspaceStoreError } from '../store';
import { acquireConnectionLease, checkpointConnectionLease, connectionsForDeletion, connectionPublicationGuard, deleteConnection, listConnections, readConnection, releaseConnectionLease, saveConnection, type Connection } from './store';
import { applyCollectedSources,staleCollectedSources, type CollectedSource } from './ingest';
import { sourceAuthorityContextSchema, validateSourceContext, type SourceAuthorityContext } from '../../domain/source-context';
import {isAllowedGradescopeRequest,parseGradescopeCourseUrl} from '../../domain/gradescope-navigation';

export const BROWSER_PROVIDERS = {
  blackboard: { label: 'BU Blackboard', homeUrl: 'https://learn.bu.edu/', hosts: ['learn.bu.edu'] },
  gradescope: { label: 'Gradescope', homeUrl: 'https://www.gradescope.com/', hosts: ['gradescope.com', 'www.gradescope.com'] },
  piazza: { label: 'Piazza', homeUrl: 'https://piazza.com/', hosts: ['piazza.com'] },
} as const;
export type BrowserProvider = keyof typeof BROWSER_PROVIDERS;
export type BrowserTarget = { courseId: string; url: string; context?: SourceAuthorityContext };
export type BlackboardSelection = { id: string; courseId: string };
export type Configuration = { targets: BrowserTarget[]; nextTargetIndex?:number; blackboard?: { mode?: 'courses'; selected: BlackboardSelection[]; catalogIds: string[]; catalogCheckedAt: string; catalogComplete: boolean; nextCourseIndex?: number; nextCatalogPath?: string; catalogQuery?: string; catalogSubjectId?: string; selectedSubjectId?: string; catalogEpoch?: string; traversals?: Record<string,{providerCourseId:string;pending:string[];seen:string[];materialIds:string[]}> } };
type Secret = { contextId?: string; sessionId?: string; sessionExpiresAt?: string; loginPageId?: string; readyAt?: string; day?: string; starts?: number };
type BrowserConnection = Connection<Secret, Configuration>;
const ID = (provider: BrowserProvider) => `browser-${provider}`;
const fail = (message: string, status = 409, code = 'browser_connection') => new WorkspaceStoreError(message, status, code);
const localGradescopeReadFailures=new Set(['gradescope_read_structure','gradescope_read_scope','gradescope_assignment_overflow','gradescope_assignment_conflict','gradescope_assignment_capacity']);
export const browserActionSchema = z.object({
  provider: z.enum(['blackboard', 'gradescope', 'piazza']),
  action: z.enum(['start', 'complete', 'configure', 'refresh', 'disconnect']),
  targets: z.array(z.object({ courseId: z.string().min(1).max(128), url: z.string().max(2048), context: sourceAuthorityContextSchema.optional() }).strict()).max(1000).optional(),
}).strict();
export function browserConfigured(): boolean { return Boolean(process.env.BROWSERBASE_API_KEY && process.env.SOMA_CONNECTOR_ENCRYPTION_KEY); }
function settings() {
  if (!browserConfigured()) throw fail('Browser connections are not configured yet.', 503, 'browser_configuration');
  return { key: process.env.BROWSERBASE_API_KEY!, projectId: process.env.BROWSERBASE_PROJECT_ID };
}
let discoveredProject: { keyHash: string; expires: number; value: Promise<string> } | undefined;
/** Resolve the single project granted to the key; ambiguous accounts require an explicit deployment selection. */
export async function resolveBrowserProjectId(): Promise<string> {
  const config = settings();
  if (config.projectId) return config.projectId;
  const keyHash = createHash('sha256').update(config.key).digest('hex');
  if (discoveredProject?.keyHash === keyHash && discoveredProject.expires > Date.now()) return discoveredProject.value;
  const value = (async () => {
    const projects = z.array(z.object({ id: z.string().min(1) })).max(100).parse(await api('/projects'));
    if (projects.length !== 1) throw fail('The browser key must identify one project. Set a deployment project selection before connecting.', 503, 'browser_project');
    return projects[0].id;
  })();
  const entry = { keyHash, expires: Date.now() + 300_000, value }; discoveredProject = entry;
  try { return await value; } catch (error) { if (discoveredProject === entry) discoveredProject = undefined; throw error; }
}
function safeProviderUrl(provider: BrowserProvider, raw: string): URL {
  let url: URL; try { url = new URL(raw); } catch { throw fail('Enter a valid course URL.', 400); }
  if (url.protocol !== 'https:' || url.username || url.password || (url.port && url.port !== '443') || !(BROWSER_PROVIDERS[provider].hosts as readonly string[]).includes(url.hostname) || /%2f|%5c|%2e/i.test(raw)) throw fail('Use an HTTPS course URL on the selected provider.', 400);
  return url;
}
function courseIdentity(provider: BrowserProvider, url: URL): string | null {
  if (provider === 'gradescope') return /^\/courses\/(\d+)(?:\/(?:assignments|submissions)(?:\/\d+)?)?\/?$/.exec(url.pathname)?.[1] ?? null;
  if (provider === 'piazza') return /^\/class\/([a-zA-Z0-9_-]+)\/?$/.exec(url.pathname)?.[1] ?? null;
  return /^\/ultra\/courses\/([a-zA-Z0-9_-]+)\/(?:outline|announcements|grades)(?:\/)?$/.exec(url.pathname)?.[1]
    ?? (url.pathname === '/webapps/blackboard/content/listContent.jsp' ? url.searchParams.get('course_id') : null);
}
export function validateCourseTarget(provider: BrowserProvider, target: BrowserTarget): BrowserTarget {
  const url = safeProviderUrl(provider, target.url);
  const identity = courseIdentity(provider, url);
  const allowedKeys = provider === 'blackboard' ? ['course_id', 'content_id', 'mode'] : provider === 'piazza' ? ['cid'] : [];
  if (!identity || !/^[a-zA-Z0-9_-]{1,160}$/.test(identity) || [...url.searchParams.keys()].some(key => !allowedKeys.includes(key)) || (url.searchParams.has('mode') && url.searchParams.get('mode') !== 'reset')) throw fail('Select a supported course, announcement, or assignment page URL.', 400);
  url.hash = ''; if (provider === 'gradescope') url.hostname = 'www.gradescope.com'; url.searchParams.sort();
  return { courseId: target.courseId, url: url.href, ...(target.context ? { context: sourceAuthorityContextSchema.parse(target.context) } : {}) };
}
/** A conservative read policy; unsupported provider APIs fail closed instead of making POSTs. */
export function isAllowedReadRequest(provider: BrowserProvider, raw: string, method: string): boolean {
  if (!['GET', 'HEAD'].includes(method)) return false;
  try {
    const url = safeProviderUrl(provider, raw);
    return !/(?:logout|signout|delete|remove|submit|enroll|accept|invite|create|update|save|mark[_-]?read)/i.test(decodeURIComponent(url.pathname + url.search));
  } catch { return false; }
}
export function validatesCourseSnapshot(provider: BrowserProvider, target: BrowserTarget, finalUrl: string, text: string, authenticatedMarker: boolean): boolean {
  try {
    const initial = safeProviderUrl(provider, target.url), final = safeProviderUrl(provider, finalUrl);
    return validateCourseTarget(provider, { ...target, url: initial.href }).url === validateCourseTarget(provider, { ...target, url: final.href }).url && authenticatedMarker
      && text.trim().length >= 100 && /assignments?|announcements?|course content|syllabus|lecture|instructor|questions|homework/i.test(text)
      && !/sign in to (?:your|access)|log in to (?:your|access)|session (?:has )?expired|access denied|single sign.on/i.test(text);
  } catch { return false; }
}
async function api<T>(path: string, method = 'GET', body?: unknown, missingOk = false): Promise<T> {
  const config = settings();
  const response = await fetch(`https://api.browserbase.com/v1${path}`, { method, headers: { 'X-BB-API-Key': config.key, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(15_000), cache: 'no-store', redirect: 'error' });
  if (missingOk && response.status === 404) return undefined as T;
  if (!response.ok) throw fail('The browser service is unavailable. Saved authorization has been retained; try again.', 503, 'browser_provider');
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
const sessionSchema = z.object({ id: z.string().min(1), projectId: z.string(), contextId: z.string().optional(), status: z.string(), expiresAt: z.string(), connectUrl: z.string().optional(), userMetadata: z.record(z.string(), z.unknown()).optional() });
type Session = z.infer<typeof sessionSchema>;
function ownerTag(connection: BrowserConnection): string { return createHash('sha256').update(`${connection.workspaceId}:${connection.id}`).digest('hex'); }
export function validateSessionOwnership(session: Session, connection: Pick<BrowserConnection, 'workspaceId'|'id'|'secret'>, projectId: string): boolean {
  const tag = createHash('sha256').update(`${connection.workspaceId}:${connection.id}`).digest('hex');
  return session.projectId === projectId && session.userMetadata?.somaOwner === tag && (!session.contextId || session.contextId === connection.secret.contextId) && session.id === connection.secret.sessionId;
}
async function getSession(connection: BrowserConnection): Promise<Session | null> {
  if (!connection.secret.sessionId) return null;
  const raw = await api<unknown>(`/sessions/${encodeURIComponent(connection.secret.sessionId)}`, 'GET', undefined, true);
  if (!raw) return null;
  const session = sessionSchema.parse(raw);
  if (!validateSessionOwnership(session, connection, await resolveBrowserProjectId())) throw fail('Browser session ownership could not be verified.', 403, 'browser_owner');
  return session;
}
const active = (session: Session | null) => Boolean(session && ['RUNNING', 'PENDING'].includes(session.status) && Date.parse(session.expiresAt) > Date.now());
async function releaseSession(connection: BrowserConnection) {
  const session = await getSession(connection);
  if (session && ['RUNNING', 'PENDING'].includes(session.status)) await api(`/sessions/${encodeURIComponent(session.id)}`, 'POST', { status: 'REQUEST_RELEASE' });
}
function clearSession(secret: Secret): Secret {
  const { sessionId: _id, sessionExpiresAt: _expiry, loginPageId: _page, ...rest } = secret;
  return { ...rest, readyAt: new Date(Date.now() + 5000).toISOString() };
}
async function connect(session: Session, markPhase?:(phase:'playwright-import'|'cdp-connect')=>void): Promise<Browser> {
  if (!session.connectUrl) throw fail('Browser session is not ready. Try again shortly.');
  const address = new URL(session.connectUrl);
  if (address.protocol !== 'wss:' || !(address.hostname === 'connect.browserbase.com' || /^connect\.[a-z0-9-]+\.browserbase\.com$/.test(address.hostname))) throw fail('Browser service returned an invalid connection.', 503);
  markPhase?.('playwright-import');
  const { chromium } = await import('playwright-core');
  markPhase?.('cdp-connect');
  return chromium.connectOverCDP(session.connectUrl, { timeout: 15_000 });
}
async function allocateSession(account: VerifiedAccount, leaseId: string, connection: BrowserConnection, seconds: number): Promise<{ connection: BrowserConnection; session: Session }> {
  const now = new Date();
  if (connection.secret.readyAt && Date.parse(connection.secret.readyAt) > now.getTime()) throw fail('The saved browser is syncing. Try again in a few seconds.');
  const day = now.toISOString().slice(0, 10), starts = connection.secret.day === day ? connection.secret.starts || 0 : 0;
  if (starts >= 24) throw fail('This provider has reached today’s browser session limit.', 429);
  connection.secret = { ...connection.secret, day, starts: starts + 1 };
  if (!await checkpointConnectionLease(account, connection.id, leaseId, { secret: connection.secret })) throw fail('Source settings changed. Reopen the connection.');
  const raw = await api<unknown>('/sessions', 'POST', { projectId: await resolveBrowserProjectId(), timeout: seconds, keepAlive: true, browserSettings: { context: { id: connection.secret.contextId, persist: true }, recordSession: false, logSession: false, solveCaptchas: false }, userMetadata: { somaOwner: ownerTag(connection) } });
  const session = sessionSchema.parse(raw);
  connection.secret = { ...connection.secret, sessionId: session.id, sessionExpiresAt: session.expiresAt };
  const next = connection;
  if (!await checkpointConnectionLease(account, connection.id, leaseId, { secret: connection.secret })) {
    await api(`/sessions/${encodeURIComponent(session.id)}`, 'POST', { status: 'REQUEST_RELEASE' });
    throw fail('Source settings changed. Reopen the connection.');
  }
  if (!validateSessionOwnership(session, next, await resolveBrowserProjectId())) throw fail('Browser session ownership could not be verified.', 503);
  return { connection: next, session };
}
async function persistLease(account: VerifiedAccount, connection: BrowserConnection, leaseId: string, patch: Parameters<typeof releaseConnectionLease<Secret, Configuration>>[3]) {
  if (!await releaseConnectionLease(account, connection.id, leaseId, patch)) throw fail('Source settings changed. Reopen the connection.', 409);
}
async function validateTargets(account: VerifiedAccount, provider: BrowserProvider, targets: BrowserTarget[]) {
  const workspace = await readAccountWorkspace(account);
  if (!workspace) throw fail('Create your private workspace first.', 404);
  const valid = targets.map(target => {
    const course=provider==='gradescope'?parseGradescopeCourseUrl(target.url):null;
    if(provider==='gradescope'&&!course)throw fail('Select the HTTPS Gradescope course overview on www.gradescope.com. Submission and returned-work pages are not collected by this reader.',400,'source_course_scope');
    const valid = validateCourseTarget(provider, {...target,...(course?{url:course.url}:{})});
    validateSourceContext(workspace, target.courseId, target.context); return valid;
  });
  if (valid.some(target => !workspace.courses.some(course => course.id === target.courseId))) throw fail('Choose a course from this workspace.', 400);
  if (new Set(valid.map(target => target.url)).size !== valid.length) throw fail('Select each page only once.', 400);
  return { workspace, targets: valid };
}
export async function configureBrowser(account: VerifiedAccount, provider: BrowserProvider, targets: BrowserTarget[]) {
  const validated = await validateTargets(account, provider, targets), id = ID(provider);
  const previous = await readConnection<Secret, Configuration>(account, id);
  if (previous && previous.status !== 'disconnected') {
    const { connection, leaseId } = await acquireConnectionLease<Secret, Configuration>(account, id, 'configure');
    await updateAccountWorkspace(account, state => staleCollectedSources(state,source=>!!source.provenance?.sourceKey.startsWith(`${provider}:${connection.id}:`)), undefined, connectionPublicationGuard(account, connection.id, leaseId));
    await persistLease(account, connection, leaseId, { configuration: { targets: validated.targets }, status: connection.secret.contextId ? 'connected' : 'login-required', notice: 'Selected pages changed. Refresh to verify current access.' });
  } else await saveConnection(account, validated.workspace.id, id, { provider, status: 'login-required', secret: {}, configuration: { targets: validated.targets }, notice: 'Sign in, then refresh selected pages to verify access.' }, previous?.version || 0);
  return { notice: 'Selected pages saved. Only these pages will be collected.' };
}
export async function startBrowserLogin(account: VerifiedAccount, provider: BrowserProvider) {
  settings();
  const existing = await readConnection<Secret, Configuration>(account, ID(provider));
  if (!existing || existing.status === 'disconnected') await configureBrowser(account, provider, []);
  const lease = await acquireConnectionLease<Secret, Configuration>(account, ID(provider), 'login', 120_000);
  let connection = lease.connection;
  try {
    await validateTargets(account, provider, connection.configuration.targets);
    let session = await getSession(connection);
    if (!active(session)) {
      if (connection.secret.sessionId) {
        await releaseSession(connection); connection.secret = clearSession(connection.secret);
        await checkpointConnectionLease(account, connection.id, lease.leaseId, { secret: connection.secret });
        throw fail('The previous sign-in session ended. Wait a few seconds, then reconnect.');
      }
      if (!connection.secret.contextId) {
        const context = z.object({ id: z.string().min(1) }).parse(await api('/contexts', 'POST', { projectId: await resolveBrowserProjectId() }));
        connection = { ...connection, secret: { ...connection.secret, contextId: context.id } };
        if (!await checkpointConnectionLease(account, connection.id, lease.leaseId, { secret: connection.secret })) { await api(`/contexts/${encodeURIComponent(context.id)}`, 'DELETE'); throw fail('Source settings changed.'); }
      }
      const created = await allocateSession(account, lease.leaseId, connection, 600); connection = created.connection; session = created.session;
    }
    const browser = await connect(session!);
    let pageId: string;
    try {
      const context = browser.contexts()[0]; if (!context) throw fail('Browser is not ready.');
      const targets = await Promise.all(context.pages().filter(page => !page.isClosed()).map(async page => {
        const cdp = await context.newCDPSession(page);
        try {
          const info = z.object({ targetInfo: z.object({ targetId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) }) }).parse(await cdp.send('Target.getTargetInfo'));
          return { page, id: info.targetInfo.targetId };
        } finally { await cdp.detach(); }
      }));
      const nonblank = targets.filter(target => !/^about:blank(?:[?#]|$)/.test(target.page.url()));
      // A reconnect must not reload a provider/SSO/MFA page that the student is already using.
      const existing = nonblank.find(target => target.id === connection.secret.loginPageId) ?? nonblank.at(-1);
      let selected = existing ?? targets.find(target => target.id === connection.secret.loginPageId) ?? targets[0];
      if (!selected) {
        const page = await context.newPage(), cdp = await context.newCDPSession(page);
        try {
          const info = z.object({ targetInfo: z.object({ targetId: z.string().regex(/^[a-zA-Z0-9_-]{1,128}$/) }) }).parse(await cdp.send('Target.getTargetInfo'));
          selected = { page, id: info.targetInfo.targetId };
        } finally { await cdp.detach(); }
      }
      if (!existing) await selected.page.goto(BROWSER_PROVIDERS[provider].homeUrl, { waitUntil: 'domcontentloaded', timeout: 20_000 });
      pageId = selected.id;
      connection.secret = { ...connection.secret, loginPageId: pageId };
      if (!await checkpointConnectionLease(account, connection.id, lease.leaseId, { secret: connection.secret })) throw fail('Source settings changed. Reopen the connection.');
    } finally { await browser.close(); }
    const debug = z.object({ pages: z.array(z.object({ id: z.string(), debuggerFullscreenUrl: z.string().url() })).max(100) }).parse(await api(`/sessions/${encodeURIComponent(session!.id)}/debug?expiresIn=600`));
    const matches = debug.pages.filter(page => page.id === pageId);
    if (matches.length !== 1) throw fail('The sign-in page is not available yet. Reconnect to retry.', 503, 'browser_login_target');
    const login = new URL(matches[0].debuggerFullscreenUrl);
    const rawSocket = login.searchParams.get('wss');
    let socket: URL; try { socket = new URL(rawSocket?.startsWith('wss://') ? rawSocket : `wss://${rawSocket ?? ''}`); } catch { throw fail('Browser service returned an invalid sign-in link.', 503, 'browser_login_target'); }
    if (login.protocol !== 'https:' || login.username || login.password || (login.port && login.port !== '443') || !(login.hostname === 'browserbase.com' || login.hostname.endsWith('.browserbase.com'))
      || socket.protocol !== 'wss:' || socket.username || socket.password || (socket.port && socket.port !== '443') || !(socket.hostname === 'connect.browserbase.com' || /^connect\.[a-z0-9-]+\.browserbase\.com$/.test(socket.hostname))
      || socket.pathname !== `/debug/${session!.id}/devtools/page/${pageId}`) throw fail('Browser service returned an invalid sign-in link.', 503, 'browser_login_target');
    const previousCatalog=connection.configuration.blackboard;
    const configuration=provider==='blackboard'?{...connection.configuration,blackboard:{...(previousCatalog?.mode?{mode:previousCatalog.mode}:{}),selected:previousCatalog?.selected??[],catalogIds:[],catalogCheckedAt:'',catalogComplete:false,catalogEpoch:randomUUID()}}:connection.configuration;
    await persistLease(account, connection, lease.leaseId, { configuration, secret: connection.secret, status: 'connecting', notice: 'Finish sign-in in the private browser. Course access is not verified yet.' });
    return { loginUrl: login.href, expiresAt: session!.expiresAt, notice: 'Enter credentials and MFA only in the provider page. Finish sign-in, then select Refresh to verify course access.' };
  } catch (error) {
    await releaseConnectionLease(account, connection.id, lease.leaseId, { secret: connection.secret, status: 'error', notice: 'Sign-in did not finish. Reconnect or disconnect to clean up the saved browser.' }); throw error;
  }
}
export async function completeBrowserLogin(account: VerifiedAccount, provider: BrowserProvider) {
  const { connection, leaseId } = await acquireConnectionLease<Secret, Configuration>(account, ID(provider), 'complete');
  try {
    if (!connection.secret.contextId) throw fail('Start sign-in first.', 409, 'browser_login_required');
    await releaseSession(connection);
    await persistLease(account, connection, leaseId, { secret: clearSession(connection.secret), status: 'connected', notice: 'Browser saved. Course access remains unverified until a selected page is read.' });
    return { notice: 'Saved the browser context. Wait a few seconds for sync, then refresh selected pages to verify access.' };
  } catch (error) { await releaseConnectionLease(account, connection.id, leaseId); throw error; }
}
/** Shared private runner for application-authored read adapters. Model tools never receive
 * the page, connection secret or policy callback. Authorization is rechecked at publication. */
export async function withBrowserRead<T>(account: VerifiedAccount, provider: BrowserProvider,
  allow: (request: {url:string;method:string;resourceType:string;topLevel:boolean})=>boolean,
  operation: (input: {page:Page;connection:BrowserConnection;workspace:NonNullable<Awaited<ReturnType<typeof readAccountWorkspace>>>;guard:ReturnType<typeof connectionPublicationGuard>;deadline:number;blockedOrigins:Set<string>;checkpointConfiguration:(configuration:Configuration)=>Promise<void>;markPhase?:(phase:'source-read'|'source-publication')=>void})=>Promise<{value:T;configuration?:Configuration;notice?:string;lastSuccessAt?:string;status?:'connected'|'current'}>
): Promise<T> {
  const deadline=Date.now()+80_000;
  const lease=await acquireConnectionLease<Secret,Configuration>(account,ID(provider),'discover-or-read',240_000);
  let connection=lease.connection,browser:Browser|undefined,allocated=false;
  let phase:BrowserReadPhase='workspace-read';
  const timer=setTimeout(()=>{void browser?.close().catch(()=>undefined);},Math.max(1,deadline-Date.now()));timer.unref();
  try {
    const workspace=await readAccountWorkspace(account);if(!workspace)throw fail('Private workspace is unavailable.',404);
    if(!connection.secret.contextId)throw fail('Sign in to this provider first.',409,'browser_login_required');
    phase='session-read';
    if(active(await getSession(connection)))throw fail('Finish the sign-in session before reading courses.');
    if(connection.secret.sessionId){await releaseSession(connection);connection.secret=clearSession(connection.secret);await checkpointConnectionLease(account,connection.id,lease.leaseId,{secret:connection.secret});throw fail('The previous session ended. Wait a few seconds, then retry.');}
    phase='session-allocation';
    const created=await allocateSession(account,lease.leaseId,connection,180);connection=created.connection;allocated=true;phase='cdp-connect';browser=await connect(created.session,value=>{phase=value;});
    const context=browser.contexts()[0];if(!context)throw fail('Browser is not ready.');
    phase='policy-install';
    const blockedOrigins=new Set<string>();
    await context.route('**/*',async route=>{
      const request=route.request();let topLevel=false;
      try{topLevel=request.isNavigationRequest()&&!request.frame().parentFrame();}catch{ /* Service worker requests are not allowed navigation. */ }
      if(allow({url:request.url(),method:request.method(),resourceType:request.resourceType(),topLevel}))await route.continue();
      else{try{blockedOrigins.add(new URL(request.url()).origin);}catch{}await route.abort('blockedbyclient');}
    });
    await context.routeWebSocket('**/*',socket=>socket.close());
    for(const old of context.pages())await old.close();
    phase='page-init';
    const page=await context.newPage(),cdp=await context.newCDPSession(page);await cdp.send('Network.setBypassServiceWorker',{bypass:true});await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');
    const guard=connectionPublicationGuard(account,connection.id,lease.leaseId);
    const checkpointConfiguration=async(configuration:Configuration)=>{if(!await checkpointConnectionLease(account,connection.id,lease.leaseId,{configuration}))throw fail('Source authorization changed.',409,'connection_changed');connection.configuration=configuration;};
    phase='source-read';
    const result=await operation({page,connection,workspace,guard,deadline,blockedOrigins,checkpointConfiguration,markPhase:value=>{phase=value;}});
    remainingReadTime(deadline,1);
    phase='browser-close';await browser.close();browser=undefined;phase='session-release';await releaseSession(connection);
    phase='lease-persist';await persistLease(account,connection,lease.leaseId,{secret:clearSession(connection.secret),...(result.configuration?{configuration:result.configuration}:{}),...(result.lastSuccessAt?{lastSuccessAt:result.lastSuccessAt}:{}),...(result.status?{status:result.status}:{}),notice:result.notice??'Read-only course check finished.'});
    return result.value;
  } catch(error) {
    logBrowserReadFailure(phase,error);
    if(browser)await browser.close().catch(()=>undefined);
    let secret=connection.secret;
    if(allocated){try{await releaseSession(connection);secret=clearSession(secret);}catch{ /* Keep encrypted cleanup references. */ }}
    await releaseConnectionLease(account,connection.id,lease.leaseId,{secret,...(allocated?{status:(error as {code?:string}).code==='browser_login_required'?'login-required' as const:'stale' as const,notice:'Course check did not complete. Saved authorization was retained.'}:{})});
    throw error;
  }finally{clearTimeout(timer);}
}

export function remainingReadTime(deadline: number, maximum: number, now = Date.now()): number {
  const left = deadline - now;
  if (left <= 0) throw fail('The selected-page read reached its time limit. Try fewer pages.', 408, 'browser_timeout');
  return Math.min(left, maximum);
}
/** Four pages per session, rotating over the complete saved scope. */
export function browserReadBatch(targets:BrowserTarget[],cursor=0){
  if(!targets.length)return {targets:[],nextTargetIndex:0,partial:false};
  const start=Number.isSafeInteger(cursor)&&cursor>=0?cursor%targets.length:0;
  const count=Math.min(4,targets.length);
  return {targets:Array.from({length:count},(_,offset)=>targets[(start+offset)%targets.length]),nextTargetIndex:(start+count)%targets.length,partial:targets.length>count};
}
async function readPage(page: Page, provider: BrowserProvider, target: BrowserTarget, deadline: number): Promise<CollectedSource> {
  const response = await page.goto(target.url, { waitUntil: 'domcontentloaded', timeout: remainingReadTime(deadline, 20_000) });
  if (!response?.ok()) throw fail('This selected page is unavailable. Sign in again or check its URL.', 409, 'browser_login_required');
  if(provider==='gradescope')return (await import('./gradescope-materials')).readGradescopeAssignmentMetadata(page,target,deadline);
  // Positive authenticated navigation plus useful course content are both required.
  const auth = page.locator('a[href*="logout"], a[href*="signout"], button[aria-label*="Account"], [data-testid="user-menu"]');
  await auth.first().waitFor({ state: 'attached', timeout: remainingReadTime(deadline, 8000) }).catch(() => undefined);
  const password = await page.locator('input[type="password"]').count();
  const body = (await page.locator('body').innerText({ timeout: remainingReadTime(deadline, 8000) })).trim();
  if (password || !validatesCourseSnapshot(provider, target, page.url(), body, await auth.count() > 0)) throw fail('Course access could not be verified. Complete sign-in or choose a supported course page.', 409, 'browser_login_required');
  if (body.length > 48_000) throw fail('This page is too large. Select a narrower course page.', 413);
  return { id: target.url, title: (await page.title()).slice(0, 300) || BROWSER_PROVIDERS[provider].label, body, courseId: target.courseId, url: target.url, kind: provider, ...(target.context ? { context: target.context } : {}) };
}
export async function refreshBrowser(account: VerifiedAccount, provider: BrowserProvider) {
  if (provider === 'blackboard') {
    const saved = await readConnection<Secret, Configuration>(account, ID(provider));
    if (saved?.configuration.blackboard?.mode === 'courses') return (await import('./blackboard')).refreshBlackboardCourses(account);
  }
  // Reserve 40 seconds of the 120-second route for release, context sync and persistence.
  const deadline = Date.now() + 80_000;
  const lease = await acquireConnectionLease<Secret, Configuration>(account, ID(provider), 'collect', 240_000);
  let connection = lease.connection, browser: Browser | undefined, allocatedHere = false;
  let batch:ReturnType<typeof browserReadBatch>|undefined;
  const deadlineTimer = setTimeout(() => { void browser?.close().catch(() => undefined); }, Math.max(1, deadline - Date.now()));
  deadlineTimer.unref();
  try {
    const selected = await validateTargets(account, provider, connection.configuration.targets);
    if (!selected.targets.length) throw fail('Select at least one course page first.', 400);
    batch=browserReadBatch(selected.targets,connection.configuration.nextTargetIndex);
    if (!connection.secret.contextId) throw fail('Sign in to this provider first.', 409, 'browser_login_required');
    if (active(await getSession(connection))) throw fail('Finish the sign-in session before refreshing.');
    if (connection.secret.sessionId) {
      await releaseSession(connection); connection.secret = clearSession(connection.secret);
      await checkpointConnectionLease(account, connection.id, lease.leaseId, { secret: connection.secret });
      throw fail('The previous session ended. Wait a few seconds, then refresh.');
    }
    const allocated = await allocateSession(account, lease.leaseId, connection, 180); connection = allocated.connection; allocatedHere = true;
    browser = await connect(allocated.session);
    const context = browser.contexts()[0]; if (!context) throw fail('Browser is not ready.');
    await context.route('**/*', async route => {
      const request = route.request();
      const navigation = request.isNavigationRequest();
      const allowed = provider==='gradescope'
        ?isAllowedGradescopeRequest({url:request.url(),method:request.method(),resourceType:request.resourceType(),topLevel:navigation&&!request.frame().parentFrame()},batch!.targets.flatMap(target=>{const course=parseGradescopeCourseUrl(target.url);return course?[course.id]:[];}),'collect')
        :isAllowedReadRequest(provider, request.url(), request.method()) && (!navigation || selected.targets.some(target => {
        try { return validateCourseTarget(provider, { ...target, url: request.url() }).url === target.url; } catch { return false; }
      }));
      if (allowed) await route.continue(); else await route.abort('blockedbyclient');
    });
    await context.routeWebSocket('**/*', socket => socket.close());
    for (const page of context.pages()) await page.close();
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.setBypassServiceWorker', { bypass: true });
    await cdp.send('ServiceWorker.enable');await cdp.send('ServiceWorker.stopAllWorkers');
    const records: CollectedSource[] = [];
    const failedTargets:BrowserTarget[]=[];
    for (const target of batch.targets) {
      try{records.push(await readPage(page,provider,target,deadline));}
      catch(error){
        // Unsupported course layouts must not prevent supported courses in the same
        // batch from publishing. Authentication/deadline/authorization failures remain global.
        if(provider==='gradescope'&&localGradescopeReadFailures.has((error as {code?:string}).code??''))failedTargets.push(target);
        else throw error;
      }
    }
    if(!records.length)throw fail('No selected overview could be verified. Previous material was retained; check the selected pages.',422,'gradescope_no_supported_overview');
    remainingReadTime(deadline, 1);
    const checkedAt = new Date().toISOString();
    let changedSourceIds: string[] = [];
    const workspace = await updateAccountWorkspace(account, state => {
      const result = applyCollectedSources(state, records, { provider, connectionId: connection.id, checkedAt }); changedSourceIds = result.changedSourceIds;
      const failedKeys=new Set(failedTargets.map(target=>`${provider}:${connection.id}:${target.url}`));
      return staleCollectedSources(result.workspace,source=>failedKeys.has(source.provenance?.sourceKey??''));
    }, selected.workspace.revision, connectionPublicationGuard(account, connection.id, lease.leaseId));
    await browser.close(); browser = undefined; await releaseSession(connection);
    const notice=`Read ${records.length} selected page(s); ${changedSourceIds.length} changed source(s).${failedTargets.length?` ${failedTargets.length} selected page(s) could not be verified; any previous material remains stale.`:''}${batch.partial?' More selected pages remain; later checks rotate through them.':''}${provider==='gradescope'?' Assignment names and displayed dates only; scores, student responses and returned-work files are not collected.':''}`;
    await persistLease(account, connection, lease.leaseId, { secret: clearSession(connection.secret), configuration:{...connection.configuration,nextTargetIndex:batch.nextTargetIndex},status: failedTargets.length?'stale':batch.partial?'connected':'current', lastSuccessAt: checkedAt, notice });
    return { workspace, changedSourceIds, notice };
  } catch (error) {
    if (browser) await browser.close().catch(() => undefined);
    if (!allocatedHere) { await releaseConnectionLease(account, connection.id, lease.leaseId); throw error; }
    let secret = connection.secret;
    try { await releaseSession(connection); secret = clearSession(secret); } catch { /* Retain session ID for cleanup/reconnect. */ }
    await updateAccountWorkspace(account, state => staleCollectedSources(state,source=>!!source.provenance?.sourceKey.startsWith(`${provider}:${connection.id}:`)), undefined, connectionPublicationGuard(account, connection.id, lease.leaseId)).catch(() => undefined);
    await releaseConnectionLease(account, connection.id, lease.leaseId, { secret,...(batch?.partial&&(error as {code?:string}).code!=='browser_login_required'?{configuration:{...connection.configuration,nextTargetIndex:batch.nextTargetIndex}}:{}),status: (error as {code?:string}).code === 'browser_login_required' ? 'login-required' : 'stale', notice: 'Refresh did not verify current course content. Previous sources are stale; reconnect or try again.' });
    throw error;
  } finally { clearTimeout(deadlineTimer); }
}
export async function disconnectBrowser(account: VerifiedAccount, provider: BrowserProvider) {
  const existing = await readConnection<Secret, Configuration>(account, ID(provider));
  if (!existing || existing.status === 'disconnected') return { notice: 'Disconnected.' };
  const { connection, leaseId } = await acquireConnectionLease<Secret, Configuration>(account, ID(provider), 'disconnect');
  try {
    if (connection.secret.sessionId) await releaseSession(connection);
    // Browserbase documents DELETE /v1/contexts/{id}; do not erase our only cleanup reference on failure.
    if (connection.secret.contextId) await api(`/contexts/${encodeURIComponent(connection.secret.contextId)}`, 'DELETE', undefined, true);
    await updateAccountWorkspace(account, state => staleCollectedSources(state,source=>!!source.provenance?.sourceKey.startsWith(`${provider}:${connection.id}:`)), undefined, connectionPublicationGuard(account, connection.id, leaseId));
    await deleteConnection(account, connection.id);
    return { notice: 'Disconnected and deleted the saved provider browser context.' };
  } catch (error) { await releaseConnectionLease(account, connection.id, leaseId, { status: 'error', notice: 'Browser cleanup failed. Authorization references were retained so cleanup can be retried.' }); throw error; }
}
export async function disconnectAllBrowserConnections(account: VerifiedAccount) {
  for (const connection of await listConnections(account)) if (connection.id === ID(connection.provider as BrowserProvider) && connection.provider in BROWSER_PROVIDERS && connection.status !== 'disconnected') await disconnectBrowser(account, connection.provider as BrowserProvider);
}

/** The account store has already frozen this generation and excluded active leases. */
export async function cleanupBrowsersForDeletion(account: VerifiedAccount, workspaceId: string): Promise<void> {
  for (const saved of await connectionsForDeletion(account, workspaceId)) {
    const connection = saved as BrowserConnection;
    if (connection.secret.sessionId) await releaseSession(connection);
    if (connection.secret.contextId) await api(`/contexts/${encodeURIComponent(connection.secret.contextId)}`, 'DELETE', undefined, true);
  }
}
