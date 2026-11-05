import type { APIRequestContext, APIResponse } from 'playwright-core';
import { WorkspaceStoreError } from '../store';

type BlackboardReadScope = { subjectId?: string; courseIds?: string[] };
const ORIGIN = 'https://learn.bu.edu';
const MAX_BYTES = 2 * 1024 * 1024;
const ID = /^[A-Za-z0-9_-]{1,160}$/;
const failure = (message: string, status: number, code: string) =>
  new WorkspaceStoreError(message, status, code);
const scopeFailure = () =>
  failure('This Blackboard read is outside the selected scope.', 400, 'blackboard_read_scope');
function timeout(deadline: number): number {
  const remaining = deadline - Date.now();
  if (!Number.isFinite(remaining) || remaining <= 0)
    throw failure('The Blackboard read reached its time limit. Try again.', 408, 'browser_timeout');
  return Math.min(15_000, remaining);
}
function validPaging(url: URL, allowed: string[]): boolean {
  if ([...url.searchParams.keys()].some((key) => !allowed.includes(key))) return false;
  for (const [key, maximum, minimum] of [
    ['limit', 100, 1],
    ['offset', 10_000, 0],
  ] as const) {
    const value = url.searchParams.get(key);
    if (
      value !== null &&
      (!/^(?:0|[1-9]\d{0,4})$/.test(value) || Number(value) < minimum || Number(value) > maximum)
    )
      return false;
  }
  return true;
}
function permittedRead(path: string, scope: BlackboardReadScope): URL {
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.length > 2048 ||
    /[\u0000-\u0020\u007f\\]|%2f|%5c|%2e/i.test(path) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(path)
  )
    throw scopeFailure();
  let url: URL;
  try {
    url = new URL(path, ORIGIN);
  } catch {
    throw scopeFailure();
  }
  const keys = [...url.searchParams.keys()];
  if (
    url.origin !== ORIGIN ||
    url.username ||
    url.password ||
    url.hash ||
    new Set(keys).size !== keys.length
  )
    throw scopeFailure();
  if (url.pathname === '/learn/api/v1/users/me' && !url.search) return url;
  const membership = /^\/learn\/api\/v1\/users\/([A-Za-z0-9_-]{1,160})\/memberships$/.exec(
    url.pathname,
  );
  if (
    membership &&
    scope.subjectId &&
    ID.test(scope.subjectId) &&
    membership[1] === scope.subjectId &&
    url.searchParams.get('expand') === 'course' &&
    validPaging(url, ['expand', 'limit', 'offset'])
  )
    return url;
  const course =
    /^\/learn\/api\/(v1|public\/v1)\/courses\/([A-Za-z0-9_-]{1,160})\/(contents(?:\/([A-Za-z0-9_-]{1,160})\/children)?|announcements)$/.exec(
      url.pathname,
    );
  if (
    course &&
    scope.courseIds?.includes(course[2]) &&
    (course[1] === 'v1' || course[3] !== 'announcements') &&
    validPaging(url, ['limit', 'offset'])
  )
    return url;
  throw scopeFailure();
}
/** Validate a persisted continuation without performing a provider request. */
export function validateBlackboardReadPath(path: string, scope: BlackboardReadScope): string {
  const url = permittedRead(path, scope);
  return url.pathname + url.search;
}

/** Application-authored reads only. Callers parse the returned provider JSON before publishing it. */
export async function readBlackboardJson(
  request: Pick<APIRequestContext, 'get'>,
  path: string,
  scope: BlackboardReadScope,
  deadline: number,
): Promise<unknown> {
  const url = permittedRead(path, scope);
  let response: APIResponse | undefined;
  try {
    response = await request.get(url.href, {
      maxRedirects: 0,
      timeout: timeout(deadline),
      failOnStatusCode: false,
    });
    const status = response.status();
    if (status === 401 || status === 403)
      throw failure(
        'Blackboard access could not be verified. Reconnect and complete sign-in.',
        409,
        'browser_login_required',
      );
    if (status < 200 || status >= 300)
      throw failure(
        'This Blackboard material is unavailable through the supported read route.',
        422,
        'blackboard_read_unavailable',
      );
    const declaredLength = response.headers()['content-length'];
    if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > MAX_BYTES))
      throw failure(
        'This Blackboard response is too large to read safely.',
        413,
        'blackboard_read_capacity',
      );
    const body = await response.body();
    if (body.byteLength > MAX_BYTES)
      throw failure(
        'This Blackboard response is too large to read safely.',
        413,
        'blackboard_read_capacity',
      );
    timeout(deadline);
    try {
      return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(body));
    } catch {
      throw failure(
        'Blackboard did not return a supported JSON response.',
        422,
        'blackboard_read_response',
      );
    }
  } catch (error) {
    if (error instanceof WorkspaceStoreError) throw error;
    // Provider exceptions may contain URLs or request details. Never forward their text.
    throw failure(
      'The Blackboard read could not finish. Saved authorization was retained.',
      503,
      'blackboard_read_failed',
    );
  } finally {
    if (response) await response.dispose().catch(() => undefined);
  }
}
