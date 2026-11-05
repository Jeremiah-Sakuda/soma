import { describe, expect, it } from 'vitest';
import {
  browserActionSchema,
  browserReadBatch,
  remainingReadTime,
  isAllowedReadRequest,
  validateCourseTarget,
  validatesCourseSnapshot,
  validateSessionOwnership,
} from '../../src/lib/server/connectors/browser';
import { createHash } from 'node:crypto';

const target = {
  courseId: 'real-course',
  url: 'https://www.gradescope.com/courses/123/assignments/456',
};
const courseBody =
  'Assignments for Electrical Engineering. Instructor: Example. Homework 3: calculate resistance using series and parallel networks. The submission deadline is Friday.';
describe('browser collection boundaries (development checks, not a provider access test)', () => {
  it('permits explicitly supported page forms and normalizes duplicates', () => {
    expect(
      validateCourseTarget('gradescope', {
        ...target,
        url: 'https://gradescope.com/courses/123#details',
      }).url,
    ).toBe('https://www.gradescope.com/courses/123');
    expect(
      validateCourseTarget('blackboard', {
        ...target,
        url: 'https://learn.bu.edu/ultra/courses/_123_1/outline',
      }).url,
    ).toContain('_123_1');
    expect(
      validateCourseTarget('piazza', { ...target, url: 'https://piazza.com/class/abcdef?cid=22' })
        .url,
    ).toContain('cid=22');
  });
  it.each([
    'http://www.gradescope.com/courses/123',
    'https://www.gradescope.com.evil.test/courses/123',
    'https://user:password@www.gradescope.com/courses/123',
    'https://www.gradescope.com:8443/courses/123',
    'https://www.gradescope.com/courses/123?access_token=secret',
    'https://www.gradescope.com/courses/123/assignments/new',
    'https://www.gradescope.com/courses/123/submit',
    'https://www.gradescope.com/courses/%2e%2e/courses/123',
    'https://127.0.0.1/courses/123',
    'https://piazza.com/class/abcdef',
  ])('rejects unsafe or unsupported course target %s', (url) =>
    expect(() => validateCourseTarget('gradescope', { ...target, url })).toThrow(),
  );
  it.each(['POST', 'PUT', 'PATCH', 'DELETE', 'CONNECT', 'OPTIONS'])(
    'blocks %s even on selected provider',
    (method) => {
      expect(isAllowedReadRequest('gradescope', target.url, method)).toBe(false);
    },
  );
  it('blocks mutating GETs, foreign resource URLs, and encoded action paths', () => {
    expect(isAllowedReadRequest('gradescope', 'https://www.gradescope.com/logout', 'GET')).toBe(
      false,
    );
    expect(
      isAllowedReadRequest('gradescope', 'https://www.gradescope.com/%64elete/123', 'GET'),
    ).toBe(false);
    expect(isAllowedReadRequest('blackboard', 'https://shib.bu.edu/login', 'GET')).toBe(false);
    expect(
      isAllowedReadRequest('gradescope', 'https://www.gradescope.com/assets/course.css', 'GET'),
    ).toBe(true);
  });
  it('requires positive account markers and actual selected page evidence', () => {
    expect(validatesCourseSnapshot('gradescope', target, target.url, courseBody, true)).toBe(true);
    expect(validatesCourseSnapshot('gradescope', target, target.url, courseBody, false)).toBe(
      false,
    );
    expect(
      validatesCourseSnapshot(
        'gradescope',
        target,
        'https://www.gradescope.com/login',
        courseBody,
        true,
      ),
    ).toBe(false);
    expect(
      validatesCourseSnapshot(
        'gradescope',
        target,
        'https://www.gradescope.com/courses/999/assignments/456',
        courseBody,
        true,
      ),
    ).toBe(false);
    expect(
      validatesCourseSnapshot(
        'gradescope',
        target,
        'https://www.gradescope.com/courses/123/assignments/999',
        courseBody,
        true,
      ),
    ).toBe(false);
    expect(
      validatesCourseSnapshot(
        'gradescope',
        target,
        target.url,
        `${courseBody} Session has expired`,
        true,
      ),
    ).toBe(false);
    expect(
      validatesCourseSnapshot('gradescope', target, target.url, 'Loading assignments…', true),
    ).toBe(false);
  });
  it('does not accept a redirect to a different Blackboard content item', () => {
    const page = {
      ...target,
      url: 'https://learn.bu.edu/webapps/blackboard/content/listContent.jsp?course_id=_1_1&content_id=_2_1',
    };
    expect(
      validatesCourseSnapshot(
        'blackboard',
        page,
        page.url.replace('_2_1', '_3_1'),
        courseBody,
        true,
      ),
    ).toBe(false);
  });
  it('binds the browser session to the project, context and workspace connection', () => {
    const owner = {
      workspaceId: 'workspaceA',
      id: 'browser-gradescope',
      secret: { contextId: 'contextA', sessionId: 'sessionA' },
    };
    const session = {
      id: 'sessionA',
      projectId: 'projectA',
      contextId: 'contextA',
      status: 'RUNNING',
      expiresAt: '2026-11-01T00:00:00Z',
      userMetadata: {
        somaOwner: createHash('sha256').update('workspaceA:browser-gradescope').digest('hex'),
      },
    };
    expect(validateSessionOwnership(session, owner, 'projectA')).toBe(true);
    expect(
      validateSessionOwnership(session, { ...owner, workspaceId: 'workspaceB' }, 'projectA'),
    ).toBe(false);
    expect(validateSessionOwnership(session, owner, 'projectB')).toBe(false);
    expect(validateSessionOwnership({ ...session, id: 'sessionB' }, owner, 'projectA')).toBe(false);
    expect(validateSessionOwnership({ ...session, contextId: 'contextB' }, owner, 'projectA')).toBe(
      false,
    );
    expect(validateSessionOwnership({ ...session, userMetadata: {} }, owner, 'projectA')).toBe(
      false,
    );
  });
  it('caps every read by the remaining shared deadline, including later selected pages', () => {
    expect(remainingReadTime(80_000, 20_000, 0)).toBe(20_000);
    expect(remainingReadTime(80_000, 20_000, 75_000)).toBe(5000);
    expect(() => remainingReadTime(80_000, 8000, 80_000)).toThrow('time limit');
  });
  it('rejects passwords, arbitrary actions and oversized page selections at the route boundary', () => {
    expect(
      browserActionSchema.safeParse({
        provider: 'gradescope',
        action: 'start',
        password: 'never-send',
      }).success,
    ).toBe(false);
    expect(
      browserActionSchema.safeParse({
        provider: 'gradescope',
        action: 'evaluate',
        code: 'arbitrary',
      }).success,
    ).toBe(false);
    expect(
      browserActionSchema.safeParse({
        provider: 'gradescope',
        action: 'configure',
        targets: Array(6).fill(target),
      }).success,
    ).toBe(true);
    expect(
      browserActionSchema.safeParse({
        provider: 'gradescope',
        action: 'configure',
        targets: Array(1001).fill(target),
      }).success,
    ).toBe(false);
  });
  it('rotates a full course load through bounded page reads without losing the sixth course', () => {
    const targets = Array.from({ length: 6 }, (_, i) => ({
      courseId: `course-${i}`,
      url: `https://www.gradescope.com/courses/${i + 1}`,
    }));
    const first = browserReadBatch(targets),
      second = browserReadBatch(targets, first.nextTargetIndex);
    expect(first.targets.map((x) => x.courseId)).toEqual([
      'course-0',
      'course-1',
      'course-2',
      'course-3',
    ]);
    expect(second.targets.map((x) => x.courseId)).toEqual([
      'course-4',
      'course-5',
      'course-0',
      'course-1',
    ]);
    expect(new Set([...first.targets, ...second.targets].map((x) => x.courseId)).size).toBe(6);
    expect(first.partial).toBe(true);
    expect(second.nextTargetIndex).toBe(2);
    expect(browserReadBatch(targets.slice(0, 3)).partial).toBe(false);
    expect(browserReadBatch([], 99)).toEqual({ targets: [], nextTargetIndex: 0, partial: false });
    expect(browserReadBatch(targets, NaN)).toEqual(first);
  });
});
