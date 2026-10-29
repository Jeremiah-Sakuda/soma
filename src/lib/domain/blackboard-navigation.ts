/** BU Blackboard's currently reviewed navigation surface; no credentials or browser dependency. */
export type BlackboardCatalogCourse = { id: string; title: string; code?: string; term?: string; url: string };
export type BlackboardCourseLocation = { id: string; url: string; kind: 'outline' | 'announcements' | 'content' };
export type BlackboardRequest = { url: string; method: string; resourceType: string; topLevel: boolean };
type CatalogCandidate = { id?: string; url?: string; title: string; code?: string; term?: string };
const ORIGIN = 'https://learn.bu.edu';
// Observed Ultra bootstrap host. This grants asset reads, never authenticated documents or APIs.
const ASSET_ORIGIN = 'https://dmuwut6e40u5o.cloudfront.net';
const identifier = /^[A-Za-z0-9_-]{1,160}$/;
const shellPaths = new Set(['/', '/ultra', '/ultra/', '/ultra/course', '/ultra/course/', '/ultra/courses', '/ultra/courses/']);
const catalogError = () => new Error('Blackboard returned an invalid or conflicting course catalog.');

function safeUrl(raw: string, origins = [ORIGIN]): URL | null {
  if (raw.length > 2048 || /[\u0000-\u0020\u007f\\]|%2f|%5c|%2e/i.test(raw)) return null;
  try {
    const url = new URL(raw);
    if (!origins.includes(url.origin) || url.username || url.password || (url.port && url.port !== '443')) return null;
    const keys = [...url.searchParams.keys()];
    if (new Set(keys).size !== keys.length || keys.some(key => /token|password|secret|authorization|session|credential/i.test(key))) return null;
    return url;
  } catch { return null; }
}
export function canonicalBlackboardCourseUrl(id: string): string {
  if (!identifier.test(id)) throw catalogError();
  return `${ORIGIN}/ultra/courses/${id}/outline`;
}
export function parseBlackboardCourseUrl(raw: string): BlackboardCourseLocation | null {
  const url = safeUrl(raw); if (!url) return null;
  const ultra = /^\/ultra\/courses\/([A-Za-z0-9_-]{1,160})\/(?:cl\/)?(outline|announcements)\/?$/.exec(url.pathname);
  if (ultra && !url.search) {
    url.hash = ''; url.pathname = url.pathname.replace(/\/$/, '');
    return { id: ultra[1], url: url.href, kind: ultra[2] as 'outline' | 'announcements' };
  }
  if (url.pathname !== '/webapps/blackboard/content/listContent.jsp') return null;
  const id = url.searchParams.get('course_id');
  if (!id || !identifier.test(id) || [...url.searchParams.keys()].some(key => !['course_id', 'content_id', 'mode'].includes(key))
    || (url.searchParams.has('content_id') && !identifier.test(url.searchParams.get('content_id')!))
    || (url.searchParams.has('mode') && url.searchParams.get('mode') !== 'reset')) return null;
  url.hash = ''; url.searchParams.sort();
  return { id, url: url.href, kind: 'content' };
}
function text(value: string | undefined, maximum: number, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value)) throw catalogError();
  const normalized = value.trim().replace(/\s+/g, ' ');
  if ((!normalized && required) || normalized.length > maximum) throw catalogError();
  return normalized || undefined;
}
/** Exact provider identities only. Presentation similarity never establishes course identity. */
export function normalizeBlackboardCatalog(candidates: CatalogCandidate[]): BlackboardCatalogCourse[] {
  const courses = new Map<string, BlackboardCatalogCourse>();
  for (const candidate of candidates) {
    const parsed = candidate.url === undefined ? undefined : parseBlackboardCourseUrl(candidate.url);
    if (candidate.url !== undefined && !parsed) throw catalogError();
    const id = candidate.id ?? parsed?.id;
    if (!id || !identifier.test(id) || (parsed && parsed.id !== id)) throw catalogError();
    const title = text(candidate.title, 300, true)!;
    const code = text(candidate.code, 100), term = text(candidate.term, 160);
    const next: BlackboardCatalogCourse = { id, title, ...(code ? { code } : {}), ...(term ? { term } : {}), url: canonicalBlackboardCourseUrl(id) };
    const previous = courses.get(id);
    if (previous && JSON.stringify(previous) !== JSON.stringify(next)) throw catalogError();
    courses.set(id, next);
  }
  return [...courses.values()];
}

const assetExtensions: Record<string, RegExp> = {
  script: /\.(?:m?js)$/i, stylesheet: /\.css$/i,
  font: /\.(?:woff2?|ttf|otf|eot)$/i, image: /\.(?:png|jpe?g|gif|svg|ico|webp|avif)$/i,
};
function staticAsset(url: URL, resourceType: string): boolean {
  // Explicit asset directories plus file type avoid treating an action-bearing endpoint as an asset.
  return /^\/(?:ultra|assets|static|javascript|js|css|fonts|images)\//.test(url.pathname)
    && !/^\/ultra\/courses\//.test(url.pathname)
    && !/\/(?:api|execute|launch|logout|signout|submit|delete|remove|enroll|accept|invite|create|update|save|mark[_-]?read)(?:\/|$)/i.test(url.pathname)
    && Boolean(assetExtensions[resourceType]?.test(url.pathname))
    && [...url.searchParams.keys()].every(key => ['v', 'version', 'ver', 'hash', 'cache', 'bust', '_'].includes(key));
}
function bootstrapRead(url: URL): boolean {
  if (url.search) return false;
  return url.pathname === '/learn/api/v1/users/me'
    || /^\/learn\/api\/v1\/themes\/_\d+_1\/settings$/.test(url.pathname)
    || url.pathname === '/learn/api/v1/utilities/timeUntilBbSessionInactive'
    || ['/learn/api/v1/systemPreferences/gradepill.decimal.config.preference.settings', '/learn/api/v1/systemPreferences/gradepill.rounding.mode.preference.settings'].includes(url.pathname);
}
/** Unknown endpoints stay blocked until observed and reviewed; read-only POST is not assumed. */
export function isAllowedBlackboardRequest(request: BlackboardRequest, courseIds: string[], mode: 'catalog' | 'collect'): boolean {
  if (!['GET', 'HEAD'].includes(request.method)) return false;
  const url = safeUrl(request.url, [ORIGIN, ASSET_ORIGIN]); if (!url) return false;
  if (url.origin === ASSET_ORIGIN) return !request.topLevel && /^\/ultra\/uiv[A-Za-z0-9._-]{1,120}\//.test(url.pathname) && staticAsset(url, request.resourceType);
  if (!request.topLevel && ['xhr', 'fetch'].includes(request.resourceType) && bootstrapRead(url)) return true;
  if (!request.topLevel && staticAsset(url, request.resourceType)) return true;
  // Shell bootstrap is permitted in either mode. It does not authorize collecting other courses.
  if (request.resourceType === 'document' && shellPaths.has(url.pathname) && !url.search) return true;
  if (mode !== 'collect' || request.resourceType !== 'document') return false;
  const course = parseBlackboardCourseUrl(url.href);
  return Boolean(course && courseIds.includes(course.id));
}
