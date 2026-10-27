import { afterEach, describe, expect, it, vi } from 'vitest';
import type { APIRequestContext, APIResponse } from 'playwright-core';
import { readBlackboardJson } from '../../src/lib/server/connectors/blackboard-api';

const scope = { subjectId: '_self_1', courseIds: ['_101_1'] };
function setup(options: { status?: number; body?: Buffer; headers?: Record<string, string> } = {}) {
  const response = { status: () => options.status ?? 200, headers: () => options.headers ?? {}, body: vi.fn(async () => options.body ?? Buffer.from('{"results":[{"id":"_101_1"}]}')), dispose: vi.fn(async () => undefined) };
  const get = vi.fn(async () => response as unknown as APIResponse);
  return { response, get, request: { get } as unknown as Pick<APIRequestContext, 'get'> };
}
afterEach(() => vi.restoreAllMocks());

describe('bounded Blackboard API GET reader (synthetic response contracts)', () => {
  it('constructs exact self/membership/course GETs with redirects disabled and the shared remaining timeout', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const paths = [
      '/learn/api/v1/users/me',
      '/learn/api/v1/users/_self_1/memberships?expand=course',
      '/learn/api/v1/users/_self_1/memberships?expand=course&limit=100&offset=10000',
      '/learn/api/v1/courses/_101_1/contents?limit=50&offset=0',
      '/learn/api/v1/courses/_101_1/contents/_content_1/children',
      '/learn/api/v1/courses/_101_1/announcements',
      '/learn/api/public/v1/courses/_101_1/contents',
      '/learn/api/public/v1/courses/_101_1/contents/_content_1/children',
    ];
    for (const path of paths) {
      const { request, get, response } = setup();
      expect(await readBlackboardJson(request, path, scope, 11000)).toEqual({ results: [{ id: '_101_1' }] });
      expect(get).toHaveBeenCalledExactlyOnceWith(`https://learn.bu.edu${path}`, { maxRedirects: 0, timeout: 10000, failOnStatusCode: false });
      expect(response.dispose).toHaveBeenCalledOnce();
    }
    const { request, get } = setup();
    await readBlackboardJson(request, '/learn/api/v1/users/me', {}, 100000);
    expect(get).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ timeout: 15000 }));
  });
  it.each([
    'https://learn.bu.edu/learn/api/v1/users/me', '//evil.test/learn/api/v1/users/me',
    '/learn/api/v1/users/_other_1/memberships?expand=course',
    '/learn/api/v1/users/_self_1/memberships',
    '/learn/api/v1/users/_self_1/memberships?expand=grades',
    '/learn/api/v1/users/_self_1/memberships?expand=course&expand=course',
    '/learn/api/v1/users/_self_1/memberships?expand=course&limit=0',
    '/learn/api/v1/users/_self_1/memberships?expand=course&limit=101',
    '/learn/api/v1/users/_self_1/memberships?expand=course&limit=01',
    '/learn/api/v1/users/_self_1/memberships?expand=course&offset=-1',
    '/learn/api/v1/users/_self_1/memberships?expand=course&offset=10001',
    '/learn/api/v1/users/_self_1/memberships?expand=course&offset=1.5',
    '/learn/api/v1/users/me?access_token=private', '/learn/api/v1/users/me#private',
    '/learn/api/v1/users/me/../me', '/learn/api/v1/users/%2e%2e/me',
    '/learn/api/v1/courses/_999_1/contents',
    '/learn/api/v1/courses/_101_1/gradebook',
    '/learn/api/v1/courses/_101_1/attempts',
    '/learn/api/v1/courses/_101_1/test/submissions',
    '/learn/api/v1/courses/_101_1/contents/_one%2Ftwo_1/children',
    '/learn/api/v1/courses/_101_1/contents/_one_1/delete',
    '/learn/api/v1/courses/_101_1/contents?course_id=_999_1',
    '/learn/api/v1/courses/_101_1/contents?action=delete',
    '/learn/api/v1/courses/_101_1/contents?limit=10&limit=20',
    '/learn/api/public/v1/courses/_101_1/announcements',
    '/learn/api/v1/courses/_101_1/contents?session=private',
    '/learn/api/v1/courses/_101_1/contents\\private',
  ])('blocks unreviewed or unscoped path before any request: %s', async path => {
    const { request, get } = setup();
    await expect(readBlackboardJson(request, path, scope, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_scope' });
    expect(get).not.toHaveBeenCalled();
  });
  it('does not permit memberships or course reads without caller scope', async () => {
    const { request, get } = setup();
    for (const path of ['/learn/api/v1/users/_self_1/memberships?expand=course', '/learn/api/v1/courses/_101_1/contents']) {
      await expect(readBlackboardJson(request, path, {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_scope' });
    }
    expect(get).not.toHaveBeenCalled();
  });
  it.each([301, 302, 307, 308, 404, 500])('rejects HTTP %s without parsing its potentially private body', async status => {
    const { request, response } = setup({ status, headers: { location: 'https://evil.test/private' } });
    await expect(readBlackboardJson(request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_unavailable' });
    expect(response.body).not.toHaveBeenCalled(); expect(response.dispose).toHaveBeenCalledOnce();
  });
  it.each([401, 403])('requires reconnect after HTTP %s and disposes the response', async status => {
    const { request, response } = setup({ status });
    await expect(readBlackboardJson(request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'browser_login_required' });
    expect(response.dispose).toHaveBeenCalledOnce();
  });
  it('rejects declared oversized responses before reading the body and actual oversized bodies before parsing', async () => {
    const declared = setup({ headers: { 'content-length': String(2 * 1024 * 1024 + 1) } });
    await expect(readBlackboardJson(declared.request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_capacity' });
    expect(declared.response.body).not.toHaveBeenCalled(); expect(declared.response.dispose).toHaveBeenCalledOnce();
    const actual = setup({ body: Buffer.alloc(2 * 1024 * 1024 + 1, 'x') });
    await expect(readBlackboardJson(actual.request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_capacity' });
    expect(actual.response.dispose).toHaveBeenCalledOnce();
  });
  it.each([Buffer.from('<html>Private login form</html>'), Buffer.from([0xff, 0xfe])])('rejects invalid JSON or UTF-8 without echoing source content', async body => {
    const { request, response } = setup({ body });
    await expect(readBlackboardJson(request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_response' });
    expect(response.dispose).toHaveBeenCalledOnce();
  });
  it('enforces exhausted deadline before requesting or parsing and still disposes received responses', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1000);
    const before = setup();
    await expect(readBlackboardJson(before.request, '/learn/api/v1/users/me', {}, 1000)).rejects.toMatchObject({ code: 'browser_timeout' });
    expect(before.get).not.toHaveBeenCalled();
    const after = setup();
    after.response.body.mockImplementation(async () => { vi.spyOn(Date, 'now').mockReturnValue(3000); return Buffer.from('{}'); });
    await expect(readBlackboardJson(after.request, '/learn/api/v1/users/me', {}, 2000)).rejects.toMatchObject({ code: 'browser_timeout' });
    expect(after.response.dispose).toHaveBeenCalledOnce();
  });
  it('replaces raw provider exception details with a fixed safe failure', async () => {
    const { request, get } = setup();
    get.mockRejectedValue(new Error('https://private.test/login?token=synthetic-secret body: private coursework'));
    await expect(readBlackboardJson(request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).rejects.toMatchObject({ code: 'blackboard_read_failed', message: 'The Blackboard read could not finish. Saved authorization was retained.' });
  });
  it('does not mask a parsed response if disposal itself fails', async () => {
    const { request, response } = setup(); response.dispose.mockRejectedValue(new Error('Provider internals'));
    expect(await readBlackboardJson(request, '/learn/api/v1/users/me', {}, Date.now() + 10000)).toEqual({ results: [{ id: '_101_1' }] });
  });
});
