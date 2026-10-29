import { describe, expect, it } from 'vitest';
import { canonicalBlackboardCourseUrl, isAllowedBlackboardRequest, normalizeBlackboardCatalog, parseBlackboardCourseUrl } from '../../src/lib/domain/blackboard-navigation';

const outline = 'https://learn.bu.edu/ultra/courses/_101_1/outline';
const documentRequest = (url: string, topLevel = true) => ({ url, method: 'GET', resourceType: 'document', topLevel });
describe('BU Blackboard identity and catalog parsing', () => {
  it('recognizes Ultra and classic identities without fuzzy title matching', () => {
    expect(parseBlackboardCourseUrl(`${outline}#content`)).toEqual({ id: '_101_1', url: outline, kind: 'outline' });
    expect(parseBlackboardCourseUrl('https://learn.bu.edu/ultra/courses/_101_1/cl/announcements/')).toEqual({ id: '_101_1', url: 'https://learn.bu.edu/ultra/courses/_101_1/cl/announcements', kind: 'announcements' });
    expect(parseBlackboardCourseUrl('https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?content_id=_202_1&course_id=_101_1&mode=reset')).toEqual({ id: '_101_1', url: 'https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?content_id=_202_1&course_id=_101_1&mode=reset', kind: 'content' });
    expect(canonicalBlackboardCourseUrl('_101_1')).toBe(outline);
  });
  it.each([
    'http://learn.bu.edu/ultra/courses/_101_1/outline',
    'https://learn.bu.edu.evil.test/ultra/courses/_101_1/outline',
    'https://learn.bu.edu:444/ultra/courses/_101_1/outline',
    'https://user:secret@learn.bu.edu/ultra/courses/_101_1/outline',
    'https://learn.bu.edu/ultra/courses/_101_1/outline?access_token=secret',
    'https://learn.bu.edu/ultra/courses/_101_1/outline?action=delete',
    'https://learn.bu.edu/ultra/courses/_101_1/submit',
    'https://learn.bu.edu/ultra/courses/_101_1/grades',
    'https://learn.bu.edu/ultra/courses/%2e%2e/outline',
    'https://learn.bu.edu/ultra/courses/_101_1%2Fother/outline',
    'https://learn.bu.edu\\@evil.test/ultra/courses/_101_1/outline',
    'https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?course_id=_101_1&course_id=_999_1',
    'https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?course_id=_101_1&content_id=',
    'https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?course_id=_101_1&mode=delete',
    'https://learn.bu.edu/webapps/blackboard/execute/content/modify?course_id=_101_1',
    'https://shib.bu.edu/login',
  ])('rejects unsupported, ambiguous or unsafe provider location %s', raw => {
    expect(parseBlackboardCourseUrl(raw)).toBeNull();
    expect(() => normalizeBlackboardCatalog([{ url: raw, title: 'Untrusted course link' }])).toThrow('invalid or conflicting');
  });
  it('deduplicates exact identity while preserving enrollment order and distinct terms', () => {
    const result = normalizeBlackboardCatalog([
      { id: '_101_1', title: '  CS 440   Algorithms ', code: 'CS 440', term: 'Fall 2026', url: outline },
      { id: '_101_1', title: 'CS 440 Algorithms', code: 'CS 440', term: 'Fall 2026', url: 'https://learn.bu.edu/ultra/courses/_101_1/cl/outline' },
      { id: '_102_1', title: 'CS 440 Algorithms', code: 'CS 440', term: 'Spring 2026' },
    ]);
    expect(result).toEqual([
      { id: '_101_1', title: 'CS 440 Algorithms', code: 'CS 440', term: 'Fall 2026', url: outline },
      { id: '_102_1', title: 'CS 440 Algorithms', code: 'CS 440', term: 'Spring 2026', url: 'https://learn.bu.edu/ultra/courses/_102_1/outline' },
    ]);
    expect(normalizeBlackboardCatalog([])).toEqual([]);
  });
  it('rejects conflicting identity or term instead of silently overwriting the earlier enrollment', () => {
    expect(() => normalizeBlackboardCatalog([{ id: '_999_1', url: outline, title: 'CS 440' }])).toThrow();
    for (const change of [{ title: 'A different course' }, { term: 'Spring 2026' }, { code: 'CS 441' }]) {
      expect(() => normalizeBlackboardCatalog([{ id: '_101_1', title: 'CS 440', code: 'CS 440', term: 'Fall 2026' }, { id: '_101_1', title: 'CS 440', code: 'CS 440', term: 'Fall 2026', ...change }])).toThrow();
    }
  });
  it.each(['', '../course', 'course/another', 'a'.repeat(161)])('rejects invalid standalone ID %s', id => {
    expect(() => canonicalBlackboardCourseUrl(id)).toThrow();
    expect(() => normalizeBlackboardCatalog([{ id, title: 'Course' }])).toThrow();
  });
  it('does not impose a five-course cap and rejects malformed labels', () => {
    expect(normalizeBlackboardCatalog(Array.from({ length: 11 }, (_, index) => ({ id: `_course_${index}`, title: `Course ${index}` })))).toHaveLength(11);
    for (const title of ['', '  ', 'private\nmessage', 'x'.repeat(301)]) expect(() => normalizeBlackboardCatalog([{ id: '_101_1', title }])).toThrow();
  });
});

describe('reviewed Blackboard request surface', () => {
  it('permits fixed catalog bootstrap paths in either mode, without treating them as course evidence', () => {
    for (const path of ['/', '/ultra', '/ultra/', '/ultra/course', '/ultra/courses']) {
      for (const mode of ['catalog', 'collect'] as const) expect(isAllowedBlackboardRequest(documentRequest(`https://learn.bu.edu${path}`), [], mode)).toBe(true);
    }
    expect(isAllowedBlackboardRequest(documentRequest('https://learn.bu.edu/ultra/profile'), [], 'catalog')).toBe(false);
    expect(isAllowedBlackboardRequest(documentRequest(outline), ['_101_1'], 'catalog')).toBe(false);
  });
  it('permits only selected-course documents, including embedded classic content', () => {
    for (const url of [outline, 'https://learn.bu.edu/ultra/courses/_101_1/cl/announcements', 'https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?course_id=_101_1&content_id=_202_1']) {
      expect(isAllowedBlackboardRequest(documentRequest(url), ['_101_1'], 'collect')).toBe(true);
      expect(isAllowedBlackboardRequest(documentRequest(url, false), ['_101_1'], 'collect')).toBe(true);
      expect(isAllowedBlackboardRequest(documentRequest(url, false), ['_999_1'], 'collect')).toBe(false);
    }
  });
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'CONNECT'])('blocks %s even for a selected course', method => {
    expect(isAllowedBlackboardRequest({ ...documentRequest(outline), method }, ['_101_1'], 'collect')).toBe(false);
  });
  it('allows reviewed static resource types despite incidental action words in file names', () => {
    for (const [path, resourceType] of [['/ultra/uiv1/update-save-delete.js', 'script'], ['/css/submit-button.css?v=12', 'stylesheet'], ['/fonts/create.woff2', 'font'], ['/images/signout-icon.svg', 'image']]) {
      const request = { url: `https://learn.bu.edu${path}`, method: 'GET', resourceType, topLevel: false };
      expect(isAllowedBlackboardRequest(request, [], 'catalog')).toBe(true);
      expect(isAllowedBlackboardRequest({ ...request, topLevel: true }, [], 'catalog')).toBe(false);
      expect(isAllowedBlackboardRequest({ ...request, url: request.url.replace('learn.bu.edu', 'cdn.example.com') }, [], 'catalog')).toBe(false);
    }
  });
  it('permits only the observed public CDN asset origin and version directory', () => {
    const base = 'https://dmuwut6e40u5o.cloudfront.net/ultra/uiv4001.2.0-rel.35_ca6d19d/';
    for (const [file, resourceType] of [['initial-load-99500fbee07467ea.js', 'script'], ['app-99500fbee07467ea.css', 'stylesheet'], ['course.woff2', 'font'], ['icon.svg', 'image']]) {
      const request = { url: base + file, method: 'GET', resourceType, topLevel: false };
      expect(isAllowedBlackboardRequest(request, [], 'catalog')).toBe(true);
      expect(isAllowedBlackboardRequest({ ...request, method: 'HEAD' }, [], 'collect')).toBe(true);
      for (const changed of [
        { topLevel: true }, { resourceType: 'document' }, { resourceType: 'xhr' }, { method: 'POST' },
        { url: request.url.replace('dmuwut6e40u5o', 'another-cloudfront') },
        { url: request.url.replace('/ultra/uiv4001.2.0-rel.35_ca6d19d/', '/unreviewed/') },
        { url: request.url + '?access_token=private' }, { url: request.url + '?action=delete' },
      ]) expect(isAllowedBlackboardRequest({ ...request, ...changed }, [], 'collect')).toBe(false);
    }
    for (const url of ['https://cdn.pendo.io/agent/static/app.js', 'https://js-agent.newrelic.com/agent.js', 'https://developer.blackboard.com/ltiStorage']) {
      expect(isAllowedBlackboardRequest({ url, method: 'GET', resourceType: 'script', topLevel: false }, [], 'catalog')).toBe(false);
    }
  });
  it('permits only observed self-account and UI-settings bootstrap reads', () => {
    const paths = ['/learn/api/v1/users/me', '/learn/api/v1/themes/_123_1/settings', '/learn/api/v1/utilities/timeUntilBbSessionInactive', '/learn/api/v1/systemPreferences/gradepill.decimal.config.preference.settings', '/learn/api/v1/systemPreferences/gradepill.rounding.mode.preference.settings'];
    for (const path of paths) for (const resourceType of ['xhr', 'fetch']) {
      const request = { url: `https://learn.bu.edu${path}`, method: 'GET', resourceType, topLevel: false };
      expect(isAllowedBlackboardRequest(request, [], 'catalog')).toBe(true);
      expect(isAllowedBlackboardRequest({ ...request, method: 'HEAD' }, [], 'collect')).toBe(true);
      for (const changed of [{ method: 'POST' }, { method: 'PUT' }, { topLevel: true }, { resourceType: 'document' }, { url: request.url + '?extra=value' }, { url: request.url.replace('learn.bu.edu', 'evil.test') }]) {
        expect(isAllowedBlackboardRequest({ ...request, ...changed }, [], 'collect')).toBe(false);
      }
    }
    for (const path of ['/learn/api/v1/users/_123_1', '/learn/api/v1/users/me/grades', '/learn/api/v1/gradebook', '/learn/api/v1/courses/_101_1/gradebook', '/learn/api/v1/themes/_other_1/settings', '/learn/api/public/v1/lti/placements', '/learn/api/v1/systemPreferences/unreviewed']) {
      expect(isAllowedBlackboardRequest({ url: `https://learn.bu.edu${path}`, method: 'GET', resourceType: 'xhr', topLevel: false }, ['_101_1'], 'collect')).toBe(false);
    }
  });
  it.each([
    ['https://learn.bu.edu/logout', 'document'],
    ['https://learn.bu.edu/ultra/courses/_101_1/submit', 'document'],
    ['https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?course_id=_101_1&action=delete', 'document'],
    ['https://learn.bu.edu/learn/api/public/v1/courses/_101_1/contents', 'fetch'],
    ['https://learn.bu.edu/learn/api/v1/courses/_999_1/contents', 'xhr'],
    ['https://learn.bu.edu/learn/api/v1/update.js', 'script'],
    ['https://learn.bu.edu/ultra/api/delete.js', 'script'],
    ['https://learn.bu.edu/ultra/logout/bootstrap.js', 'script'],
    ['https://learn.bu.edu/ultra/app.js?action=delete', 'script'],
    ['https://learn.bu.edu/ultra/app.js?course_id=_999_1', 'script'],
    ['https://learn.bu.edu/ultra/courses/_999_1/content.js', 'script'],
    ['https://learn.bu.edu/ultra/app.js?access_token=private', 'script'],
    ['https://learn.bu.edu/webapps/blackboard/execute/delete.js', 'script'],
    ['https://shib.bu.edu/idp/profile/SSO', 'document'],
    ['https://learn.bu.edu/ultra/api/delete', 'fetch'],
    ['https://learn.bu.edu/ultra/course?returnUrl=https://evil.test', 'document'],
  ])('does not widen collection through resource or endpoint disguise %s', (url, resourceType) => {
    expect(isAllowedBlackboardRequest({ url, resourceType, method: 'GET', topLevel: resourceType === 'document' }, ['_101_1'], 'collect')).toBe(false);
  });
});
