/** Reviewed Gradescope document surface. No credentials, requests or persistence. */
export type GradescopeRequest = {
  url: string;
  method: string;
  resourceType: string;
  topLevel: boolean;
};
export type GradescopeCatalogCandidate = { url: string; title: string; term?: string };
export type GradescopeCatalogCourse = { id: string; url: string; title: string; term?: string };
export const GRADESCOPE_CATALOG_BATCH_LIMIT = 1000;
const ORIGIN = 'https://www.gradescope.com';
const numericId = /^[1-9][0-9]{0,31}$/;
const catalogPaths = new Set(['/', '/account', '/account/']);
export class GradescopeCatalogError extends Error {
  constructor(public readonly code: 'invalid' | 'conflict' | 'overflow') {
    super(
      code === 'overflow'
        ? 'Gradescope course-list batch exceeds the read limit. Continue with a smaller verified batch.'
        : 'Gradescope returned invalid or conflicting course metadata.',
    );
  }
}
function safeUrl(raw: string): URL | null {
  // Reject before URL normalization: it would otherwise erase traversal and empty query/hash markers.
  if (
    typeof raw !== 'string' ||
    raw.length > 2048 ||
    /[\u0000-\u0020\u007f\\%?#]/.test(raw) ||
    !/^https:\/\/www\.gradescope\.com(?::443)?\//.test(raw) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(raw)
  )
    return null;
  try {
    const url = new URL(raw);
    return url.origin === ORIGIN &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      (!url.port || url.port === '443')
      ? url
      : null;
  } catch {
    return null;
  }
}
export function canonicalGradescopeCourseUrl(id: string): string {
  if (!numericId.test(id)) throw new GradescopeCatalogError('invalid');
  return `${ORIGIN}/courses/${id}`;
}
export function parseGradescopeCourseUrl(raw: string): { id: string; url: string } | null {
  const url = safeUrl(raw),
    match = url && /^\/courses\/([1-9][0-9]{0,31})\/?$/.exec(url.pathname);
  return match ? { id: match[1], url: canonicalGradescopeCourseUrl(match[1]) } : null;
}
/** The course shell is server-rendered. Assets, APIs, frames and action routes remain blocked. */
export function isAllowedGradescopeRequest(
  request: GradescopeRequest,
  courseIds: readonly string[],
  mode: 'catalog' | 'collect',
): boolean {
  if (request.method !== 'GET' || request.resourceType !== 'document' || !request.topLevel)
    return false;
  const url = safeUrl(request.url);
  if (!url) return false;
  if (mode === 'catalog') return catalogPaths.has(url.pathname);
  const course = parseGradescopeCourseUrl(request.url);
  return Boolean(course && courseIds.includes(course.id));
}
function text(value: unknown, maximum: number, required = false): string | undefined {
  if (value === undefined && !required) return undefined;
  if (typeof value !== 'string' || /[\u0000-\u001f\u007f]/.test(value))
    throw new GradescopeCatalogError('invalid');
  const normalized = value.trim().replace(/\s+/g, ' ');
  if ((required && !normalized) || normalized.length > maximum)
    throw new GradescopeCatalogError('invalid');
  return normalized || undefined;
}
/** One bounded batch, never silently truncated. Repeated identities must agree exactly. */
export function normalizeGradescopeCatalog(
  candidates: readonly GradescopeCatalogCandidate[],
): GradescopeCatalogCourse[] {
  if (!Array.isArray(candidates)) throw new GradescopeCatalogError('invalid');
  if (candidates.length > GRADESCOPE_CATALOG_BATCH_LIMIT)
    throw new GradescopeCatalogError('overflow');
  const courses = new Map<string, GradescopeCatalogCourse>();
  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== 'object') throw new GradescopeCatalogError('invalid');
    const parsed = parseGradescopeCourseUrl(candidate.url);
    if (!parsed) throw new GradescopeCatalogError('invalid');
    const title = text(candidate.title, 300, true)!,
      term = text(candidate.term, 160);
    const next: GradescopeCatalogCourse = { ...parsed, title, ...(term ? { term } : {}) },
      previous = courses.get(next.id);
    if (previous && (previous.title !== next.title || previous.term !== next.term))
      throw new GradescopeCatalogError('conflict');
    courses.set(next.id, next);
  }
  return [...courses.values()];
}
/** Only independently extracted term metadata can establish a semester; titles never do. */
export function filterGradescopeFall2026(
  courses: readonly GradescopeCatalogCourse[],
): GradescopeCatalogCourse[] {
  return courses.filter(
    (course) => typeof course.term === 'string' && /^fall\s+2026$/i.test(course.term.trim()),
  );
}
