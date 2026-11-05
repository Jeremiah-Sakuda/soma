import { describe, expect, it, vi } from 'vitest';
import type { Page } from 'playwright-core';
import {
  collectBlackboardMaterials,
  type BlackboardTraversal,
} from '../../src/lib/server/connectors/blackboard-materials';
const course = '_101_1';
const contents = `/learn/api/v1/courses/${course}/contents?limit=20`;
const announcements = `/learn/api/v1/courses/${course}/announcements?limit=20`;
const deadline = () => Date.now() + 30000;
const item = (
  id: string,
  body = 'An original synthetic explanation.',
  title = 'Loop invariant',
) => ({ id, courseId: course, title, body, contentHandler: { id: 'resource/x-bb-document' } });
function fixture(responses: Record<string, unknown>) {
  const get = vi.fn(async (raw: string) => {
    const url = new URL(raw),
      path = url.pathname + url.search;
    if (!(path in responses)) throw new Error('Unexpected synthetic page');
    return {
      status: () => 200,
      headers: () => ({}),
      body: async () => Buffer.from(JSON.stringify({ paging: {}, ...(responses[path] as object) })),
      dispose: vi.fn(async () => undefined),
    };
  });
  // These unit cases exercise traversal, identity and budgets. Browser tests execute the actual inert HTML parser.
  const evaluate = vi.fn(async (_fn: unknown, body: string) => body);
  return {
    get,
    evaluate,
    page: { request: { get }, evaluate } as unknown as Pick<Page, 'request' | 'evaluate'>,
  };
}
describe('bounded resumable Blackboard material observations', () => {
  it('extracts stable course-scoped content and announcements without inventing workspace mappings', async () => {
    const { page, get } = fixture({
      [contents]: { results: [item('_content_1')] },
      [announcements]: {
        results: [
          {
            id: '_announcement_1',
            title: 'Coverage update',
            body: 'The midterm covers recurrence relations.',
          },
        ],
      },
    });
    const result = await collectBlackboardMaterials(page, course, undefined, deadline());
    expect(result).toMatchObject({
      complete: true,
      warnings: 0,
      materialIds: [`${course}:content:_content_1`, `${course}:announcement:_announcement_1`],
    });
    expect(result.cursor).toBeUndefined();
    expect(get).toHaveBeenCalledTimes(2);
    expect(result.records).toEqual([
      {
        id: `${course}:content:_content_1`,
        title: 'Loop invariant',
        body: 'An original synthetic explanation.',
        kind: 'blackboard',
        url: `https://learn.bu.edu/ultra/courses/${course}/outline`,
      },
      {
        id: `${course}:announcement:_announcement_1`,
        title: 'Coverage update',
        body: 'The midterm covers recurrence relations.',
        kind: 'blackboard',
        url: `https://learn.bu.edu/ultra/courses/${course}/announcements`,
      },
    ]);
  });
  it('expands folders and validates paging, preserving pending work after four API pages', async () => {
    const folder = `/learn/api/v1/courses/${course}/contents/_folder_1/children?limit=20`;
    const second = `/learn/api/v1/courses/${course}/contents/_folder_1/children?limit=20&offset=20`;
    const third = `/learn/api/v1/courses/${course}/contents/_folder_1/children?limit=20&offset=40`;
    const { page, get } = fixture({
      [contents]: {
        results: [
          { id: '_folder_1', title: 'Recurrences', contentHandler: { id: 'resource/x-bb-folder' } },
          item('_root_1'),
        ],
      },
      [announcements]: { results: [] },
      [folder]: {
        results: [item('_child_1')],
        paging: { nextPage: `https://learn.bu.edu${second}` },
      },
      [second]: { results: [item('_child_2')], paging: { nextPage: third } },
      [third]: { results: [item('_child_3')] },
    });
    const first = await collectBlackboardMaterials(page, course, undefined, deadline());
    expect(first.complete).toBe(false);
    expect(first.warnings).toBe(0);
    expect(get).toHaveBeenCalledTimes(4);
    expect(first.cursor?.pending).toEqual([third]);
    expect(first.records).toHaveLength(3);
    const saved = structuredClone(first.cursor);
    const secondRun = await collectBlackboardMaterials(page, course, first.cursor, deadline());
    expect(secondRun.complete).toBe(true);
    expect(secondRun.records.map((record) => record.id)).toEqual([`${course}:content:_child_3`]);
    expect(secondRun.materialIds).toHaveLength(4);
    expect(first.cursor).toEqual(saved);
  });
  it('retains a partially processed page when forty text records fill the run', async () => {
    const { page } = fixture({
      [contents]: { results: Array.from({ length: 45 }, (_, index) => item(`_item_${index}`)) },
      [announcements]: { results: [] },
    });
    const first = await collectBlackboardMaterials(page, course, undefined, deadline());
    expect(first.records).toHaveLength(40);
    expect(first.cursor?.pending[0]).toBe(contents);
    expect(first.complete).toBe(false);
    const last = await collectBlackboardMaterials(page, course, first.cursor, deadline());
    expect(last.records).toHaveLength(5);
    expect(last.complete).toBe(true);
    expect(new Set([...first.records, ...last.records].map((record) => record.id)).size).toBe(45);
    expect(last.materialIds).toHaveLength(45);
  });
  it('deduplicates identical content but rejects contradictory records sharing a stable provider ID', async () => {
    const identical = fixture({
      [contents]: { results: [item('_one_1'), item('_one_1')] },
      [announcements]: { results: [] },
    });
    expect(
      (await collectBlackboardMaterials(identical.page, course, undefined, deadline())).records,
    ).toHaveLength(1);
    const changed = fixture({
      [contents]: { results: [item('_one_1'), item('_one_1', 'Conflicting explanation.')] },
    });
    await expect(
      collectBlackboardMaterials(changed.page, course, undefined, deadline()),
    ).rejects.toMatchObject({ code: 'blackboard_material_conflict' });
  });
  it('labels unsupported files/images/LTI and unreadable text while leaving empty folders as metadata', async () => {
    const folder = `/learn/api/v1/courses/${course}/contents/_folder_1/children?limit=20`;
    const { page, evaluate } = fixture({
      [contents]: {
        results: [
          {
            id: '_file_1',
            title: 'Notes',
            body: 'PDF metadata',
            contentHandler: { id: 'resource/x-bb-file' },
            hasChildren: true,
          },
          {
            id: '_image_1',
            title: 'Diagram',
            body: 'Image metadata',
            contentHandler: { id: 'image/png' },
          },
          {
            id: '_lti_1',
            title: 'External tool',
            body: 'Tool metadata',
            contentHandler: { id: 'resource/x-bb-blti-link' },
          },
          { id: '_empty_1', title: 'Empty document' },
          { id: '_folder_1', title: 'Folder', hasChildren: true },
          item('_long_1', 'x'.repeat(48001)),
          item('_badtitle_1', 'Body', 'x'.repeat(301)),
        ],
      },
      [announcements]: { results: [] },
      [folder]: { results: [] },
    });
    const result = await collectBlackboardMaterials(page, course, undefined, deadline());
    expect(result.complete).toBe(true);
    expect(result.warnings).toBe(6);
    expect(result.records).toEqual([]);
    expect(result.materialIds).toEqual([]);
    expect(evaluate).toHaveBeenCalledOnce();
  });
  it.each([
    { courseId: '_999_1', results: [] },
    { results: [{ ...item('_one_1'), courseId: '_999_1' }] },
  ])('rejects a foreign course at either response or item boundary', async (response) => {
    const { page } = fixture({ [contents]: response });
    await expect(
      collectBlackboardMaterials(page, course, undefined, deadline()),
    ).rejects.toBeDefined();
  });
  it.each([
    'https://evil.test/learn/api/v1/courses/_101_1/contents?offset=20',
    '/learn/api/v1/courses/_999_1/contents?offset=20',
    '/learn/api/v1/courses/_101_1/gradebook',
    '/learn/api/v1/users/me',
    '/learn/api/v1/courses/_101_1/contents?access_token=private',
    '/learn/api/v1/courses/_101_1/contents?offset=20&offset=40',
  ])('rejects unsafe paging before continuing outside scope: %s', async (nextPage) => {
    const { page, get } = fixture({ [contents]: { results: [], paging: { nextPage } } });
    await expect(
      collectBlackboardMaterials(page, course, undefined, deadline()),
    ).rejects.toBeDefined();
    expect(get).toHaveBeenCalledOnce();
  });
  it('rejects cyclic paging without falsely certifying completion', async () => {
    const { page, get } = fixture({
      [contents]: { results: [item('_one_1')], paging: { nextPage: contents } },
      [announcements]: { results: [] },
    });
    await expect(
      collectBlackboardMaterials(page, course, undefined, deadline()),
    ).rejects.toMatchObject({ code: 'blackboard_paging_cycle' });
    expect(get).toHaveBeenCalledOnce();
  });
  it('retains only valid observed modification timestamps', async () => {
    const { page } = fixture({
      [contents]: {
        results: [
          { ...item('_one_1'), modifiedDate: '2026-10-27T10:30:00-04:00' },
          { ...item('_two_1'), modifiedDate: 'not a timestamp' },
        ],
      },
      [announcements]: { results: [] },
    });
    const result = await collectBlackboardMaterials(page, course, undefined, deadline());
    expect(result.records[0].modifiedAt).toBe('2026-10-27T14:30:00.000Z');
    expect(result.records[1].modifiedAt).toBeUndefined();
  });
  it('rejects cross-course cursors and explicit traversal capacity overflow before a request', async () => {
    const { page, get } = fixture({});
    const wrong: BlackboardTraversal = {
      providerCourseId: '_other_1',
      pending: [],
      seen: [],
      materialIds: [],
    };
    await expect(collectBlackboardMaterials(page, course, wrong, deadline())).rejects.toMatchObject(
      { code: 'blackboard_read_scope' },
    );
    const oversized: BlackboardTraversal = {
      providerCourseId: course,
      pending: [],
      seen: [],
      materialIds: Array.from({ length: 2001 }, (_, index) => `${course}:content:_item_${index}`),
    };
    await expect(
      collectBlackboardMaterials(page, course, oversized, deadline()),
    ).rejects.toMatchObject({ code: 'blackboard_traversal_limit' });
    expect(get).not.toHaveBeenCalled();
  });
});

it('refuses to infer end-of-list from absent paging metadata', async () => {
  const { page } = fixture({ [contents]: { results: [item('_one_1')], paging: undefined } });
  await expect(
    collectBlackboardMaterials(page, course, undefined, deadline()),
  ).rejects.toMatchObject({ code: 'blackboard_paging_unverified' });
});

it('accepts the observed internal string folder handler and explicit empty next-page sentinel', async () => {
  const folder = `/learn/api/v1/courses/${course}/contents/_folder_1/children?limit=20`;
  const { page } = fixture({
    [contents]: {
      results: [{ id: '_folder_1', title: 'Folder', contentHandler: 'resource/x-bb-folder' }],
      paging: { nextPage: '' },
    },
    [announcements]: { results: [], paging: { nextPage: '' } },
    [folder]: { results: [item('_text_1')], paging: { nextPage: '' } },
  });
  const result = await collectBlackboardMaterials(page, course, undefined, deadline());
  expect(result.complete).toBe(true);
  expect(result.records.map((r) => r.id)).toEqual([`${course}:content:_text_1`]);
});

it('reads internal rawText bodies and expands lesson containers without fetching file locations', async () => {
  const child = `/learn/api/v1/courses/${course}/contents/_module_1/children?limit=20`;
  const { page, get } = fixture({
    [contents]: {
      results: [{ id: '_module_1', title: 'Module', contentHandler: 'resource/x-bb-lesson' }],
    },
    [announcements]: {
      results: [
        {
          id: '_announcement_2',
          title: 'Update',
          body: { rawText: 'Original announcement.', webLocation: 'https://evil.test/' },
        },
      ],
    },
    [child]: {
      results: [
        {
          ...item('_one_1'),
          body: { rawText: 'Original module text.', fileLocation: 'https://evil.test/' },
        },
      ],
    },
  });
  const result = await collectBlackboardMaterials(page, course, undefined, deadline());
  expect(result.complete).toBe(true);
  expect(result.records.map((r) => r.body)).toEqual([
    'Original announcement.',
    'Original module text.',
  ]);
  expect(get).toHaveBeenCalledTimes(3);
});
