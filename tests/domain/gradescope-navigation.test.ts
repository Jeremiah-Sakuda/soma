import { describe, expect, it } from 'vitest';
import {
  canonicalGradescopeCourseUrl,
  filterGradescopeFall2026,
  GRADESCOPE_CATALOG_BATCH_LIMIT,
  GradescopeCatalogError,
  isAllowedGradescopeRequest,
  normalizeGradescopeCatalog,
  parseGradescopeCourseUrl,
} from '../../src/lib/domain/gradescope-navigation';
const origin = 'https://www.gradescope.com';
const request = (url: string) => ({ url, method: 'GET', resourceType: 'document', topLevel: true });
const candidate = (
  id: string,
  title = 'Synthetic Algorithms',
  term: string | undefined = 'Fall 2026',
) => ({ url: `${origin}/courses/${id}`, title, term });
describe('Gradescope reviewed read-only document policy', () => {
  it.each(['/', '/account', '/account/'])('allows exact catalog document %s', (path) => {
    expect(isAllowedGradescopeRequest(request(origin + path), [], 'catalog')).toBe(true);
  });
  it('only allows selected course documents during collection', () => {
    expect(isAllowedGradescopeRequest(request(origin + '/courses/42'), ['42'], 'collect')).toBe(
      true,
    );
    expect(isAllowedGradescopeRequest(request(origin + '/courses/42/'), ['42'], 'collect')).toBe(
      true,
    );
    expect(isAllowedGradescopeRequest(request(origin + '/courses/43'), ['42'], 'collect')).toBe(
      false,
    );
    expect(isAllowedGradescopeRequest(request(origin + '/'), ['42'], 'collect')).toBe(false);
    expect(isAllowedGradescopeRequest(request(origin + '/courses/42'), ['42'], 'catalog')).toBe(
      false,
    );
  });
  it.each(['POST', 'HEAD', 'PUT', 'DELETE', 'OPTIONS'])('blocks %s', (method) => {
    expect(
      isAllowedGradescopeRequest({ ...request(origin + '/account'), method }, [], 'catalog'),
    ).toBe(false);
  });
  it.each(['script', 'xhr', 'fetch', 'stylesheet', 'image', 'websocket', 'other'])(
    'blocks %s resources even on catalog paths',
    (resourceType) => {
      expect(
        isAllowedGradescopeRequest(
          { ...request(origin + '/account'), resourceType },
          [],
          'catalog',
        ),
      ).toBe(false);
    },
  );
  it('blocks subframe document loads', () =>
    expect(
      isAllowedGradescopeRequest(
        { ...request(origin + '/account'), topLevel: false },
        [],
        'catalog',
      ),
    ).toBe(false));
  it.each([
    'http://www.gradescope.com/courses/42',
    'https://gradescope.com/courses/42',
    'https://www.gradescope.com.evil.example/courses/42',
    'https://evil.example/courses/42',
    'https://user:password@www.gradescope.com/courses/42',
    'https://www.gradescope.com:8443/courses/42',
    origin + '/courses/42?foo=bar',
    origin + '/courses/42?',
    origin + '/courses/42#fragment',
    origin + '/courses/42#',
    origin + '/unused/../courses/42',
    origin + '/courses/./42',
    origin + '/courses/%34%32',
    origin + '/courses/%2e%2e/42',
    origin + '/courses/42%2fassignments',
    origin + '/courses/42%5cassignments',
    origin + '/courses\\42',
    origin + '/courses/042',
    origin + '/courses/0',
    origin + '/courses/NaN',
    origin + '/courses/42/assignments',
    origin + '/courses/42/submissions/7',
    origin + '/courses/42/delete',
    ' ' + origin + '/courses/42',
    origin + '/courses/42\n',
    origin + '/courses/' + '1'.repeat(33),
  ])('rejects unsafe or unsupported course URL %s', (url) => {
    expect(parseGradescopeCourseUrl(url)).toBeNull();
    expect(isAllowedGradescopeRequest(request(url), ['42'], 'collect')).toBe(false);
  });
  it('canonicalizes an explicit HTTPS port and trailing slash without changing identity', () => {
    expect(parseGradescopeCourseUrl('https://www.gradescope.com:443/courses/42/')).toEqual({
      id: '42',
      url: origin + '/courses/42',
    });
    expect(canonicalGradescopeCourseUrl('42')).toBe(origin + '/courses/42');
    expect(() => canonicalGradescopeCourseUrl('../42')).toThrow(GradescopeCatalogError);
  });
});
describe('Gradescope catalog normalization and term evidence', () => {
  it('deduplicates exact identities and normalizes visible whitespace', () => {
    expect(
      normalizeGradescopeCatalog([candidate('42', '  Synthetic   Algorithms  '), candidate('42')]),
    ).toEqual([
      { id: '42', url: origin + '/courses/42', title: 'Synthetic Algorithms', term: 'Fall 2026' },
    ]);
  });
  it('never conflates different IDs with similar titles', () =>
    expect(normalizeGradescopeCatalog([candidate('42'), candidate('43')])).toHaveLength(2));
  it.each([
    { rows: [candidate('42'), candidate('42', 'Different course')] },
    { rows: [candidate('42'), candidate('42', 'Synthetic Algorithms', 'Spring 2026')] },
    { rows: [candidate('42'), { url: origin + '/courses/42', title: 'Synthetic Algorithms' }] },
  ])('rejects conflicting duplicate identity metadata', ({ rows }) => {
    try {
      normalizeGradescopeCatalog(rows);
      throw new Error('Expected conflict');
    } catch (error) {
      expect(error).toBeInstanceOf(GradescopeCatalogError);
      expect((error as GradescopeCatalogError).code).toBe('conflict');
    }
  });
  it.each([
    { url: origin + '/courses/42', title: '' },
    { url: origin + '/courses/42', title: 'x'.repeat(301) },
    { url: origin + '/courses/42', title: 'Course\u0000' },
    { url: origin + '/courses/42', title: 'Course', term: 'x'.repeat(161) },
    { url: origin + '/courses/42', title: 'Course', term: 'Fall\n2026' },
    { url: origin + '/courses/42?token=secret', title: 'Course' },
  ])('rejects invalid source metadata', (row) =>
    expect(() => normalizeGradescopeCatalog([row])).toThrow(GradescopeCatalogError),
  );
  it('does not impose a five-course limit and reports batch overflow instead of truncating', () => {
    const rows = Array.from({ length: GRADESCOPE_CATALOG_BATCH_LIMIT }, (_, index) =>
      candidate(String(index + 1)),
    );
    expect(normalizeGradescopeCatalog(rows)).toHaveLength(GRADESCOPE_CATALOG_BATCH_LIMIT);
    try {
      normalizeGradescopeCatalog([...rows, candidate('10001')]);
      throw new Error('Expected overflow');
    } catch (error) {
      expect(error).toBeInstanceOf(GradescopeCatalogError);
      expect((error as GradescopeCatalogError).code).toBe('overflow');
    }
  });
  it('selects Fall 2026 only from explicit term metadata', () => {
    const rows = normalizeGradescopeCatalog([
      candidate('42', 'Synthetic Algorithms', ' Fall   2026 '),
      candidate('43', 'Fall 2026 Biology', 'Fall 2025'),
      { url: origin + '/courses/44', title: 'Fall 2026 Chemistry' },
      candidate('45', 'Synthetic Physics', 'fall 2026'),
      candidate('46', 'Synthetic Economics', 'Fall 2026 (archived)'),
      candidate('47', 'Synthetic Design', 'Fall 20260'),
    ]);
    expect(filterGradescopeFall2026(rows).map((row) => row.id)).toEqual(['42', '45']);
  });
});
