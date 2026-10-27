import { expect, test, type Page } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';

// Original synthetic courses and a mocked saved authorization; no provider is contacted.
const courses = [
  { id: '_synthetic_one_1', title: 'Synthetic Ecology', code: 'BIO 101', term: 'Synthetic semester', url: 'https://learn.bu.edu/ultra/courses/_synthetic_one_1/outline' },
  { id: '_synthetic_two_1', title: 'Synthetic Algorithms', code: 'CS 201', term: 'Synthetic semester', url: 'https://learn.bu.edu/ultra/courses/_synthetic_two_1/outline' },
];

async function openPicker(page: Page, options: { selected?: { id: string; courseId: string }[]; complete?: boolean; failFirst?: boolean; paginated?: boolean } = {}) {
  const workspace = seedWorkspace('synthetic-blackboard-picker');
  workspace.mode = 'account';
  let catalog: { courses: typeof courses; checkedAt: string; complete: boolean; nextCursor?: string; query?: string } = { courses: options.paginated ? courses.slice(0, 1) : courses, checkedAt: '2026-10-27T16:00:00.000Z', complete: options.paginated ? false : options.complete ?? true, ...(options.paginated ? { nextCursor: 'available', query: 'Synthetic' } : {}) };
  let selected = options.selected ?? [];
  let failStatus = options.failFirst ?? false;
  const requests: Record<string, unknown>[] = [];
  let workspaceReads = 0;
  await page.route('**/api/workspace', async route => {
    workspaceReads++;
    await route.fulfill({ json: { workspace, capabilities: { spark: false, persistence: 'firestore', liveSources: ['blackboard'] } } });
  });
  await page.route('**/api/auth/session', route => route.fulfill({ json: { authenticated: true, accountWorkspaceAvailable: true } }));
  await page.route('**/api/audit**', route => route.fulfill({ json: { runs: [] } }));
  await page.route('**/api/jobs', route => route.fulfill({ json: { jobs: [] } }));
  await page.route('**/api/adaptations', route => route.fulfill({ json: { job: null } }));
  await page.route('**/api/connectors/google/status', route => route.fulfill({ json: { configured: false, providers: { gmail: false, calendar: false }, connections: [] } }));
  await page.route('**/api/connectors/browser', async route => {
    if (route.request().method() === 'POST') {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { notice: 'Synthetic refresh complete.' } });
      return;
    }
    await route.fulfill({ json: { configured: true, providers: [{ provider: 'blackboard', label: 'Blackboard', homeUrl: 'https://learn.bu.edu/', connection: { provider: 'blackboard', status: 'connected', configuration: {} } }] } });
  });
  await page.route('**/api/connectors/blackboard', async route => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      requests.push(body);
      if (body.action === 'discover') catalog = body.more
        ? { courses: courses.slice(1), checkedAt: catalog.checkedAt, complete: true, query: body.query ?? '' }
        : { ...catalog, courses: body.query ? courses.filter(course => course.title.includes(body.query)) : courses, query: body.query ?? '' };
      if (body.action === 'select') selected = body.courseIds.map((id: string) => ({ id, courseId: body.mappings?.[id] ?? `created-for-${id}` }));
    } else if (failStatus) {
      await route.fulfill({ status: 503, json: { error: 'Synthetic sign-in expired. Reconnect Blackboard and retry.' } });
      return;
    }
    await route.fulfill({ json: { catalog, selected } });
  });
  await page.goto('/?view=today');
  await page.getByRole('button', { name: 'Workspace menu' }).click();
  await page.getByText('Connect course sites, Gmail and Calendar', { exact: true }).click();
  const picker = page.getByRole('region', { name: 'Blackboard course selection', exact: true });
  await expect(picker).toBeVisible();
  return { picker, requests, workspace, reads: () => workspaceReads, restoreStatus: () => { failStatus = false; } };
}

test('selected course IDs and explicit mappings are saved before refresh, with no client titles or URLs', async ({ page }) => {
  const { picker, requests, workspace, reads } = await openPicker(page);
  const refresh = picker.getByRole('button', { name: 'Refresh selected courses', exact: true });
  await expect(refresh).toBeDisabled();
  await picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false }).check();
  await picker.getByLabel('Soma course for Synthetic Ecology', { exact: true }).selectOption(workspace.courses[0].id);
  await picker.getByRole('checkbox', { name: 'Synthetic Algorithms', exact: false }).check();
  await expect(picker.getByText('2 courses selected · unsaved changes')).toBeVisible();
  await expect(refresh).toBeDisabled();
  await picker.getByRole('button', { name: 'Save selected courses', exact: true }).click();
  await expect(picker.getByText('Selected courses saved.', { exact: false })).toBeVisible();
  expect(requests).toEqual([{ action: 'select', courseIds: courses.map(course => course.id), mappings: { [courses[0].id]: workspace.courses[0].id } }]);
  const beforeRefresh = reads();
  await refresh.click();
  await expect(picker.getByText('Refresh finished.', { exact: false })).toBeVisible();
  expect(requests[1]).toEqual({ provider: 'blackboard', action: 'refresh' });
  expect(reads()).toBeGreaterThan(beforeRefresh);
  await picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false }).uncheck();
  await expect(refresh).toBeDisabled();
});

test('filtered partial results retain saved courses outside the list until explicitly unchecked', async ({ page }) => {
  const selected = [{ id: courses[0].id, courseId: 'circuit-foundations' }];
  const { picker, requests } = await openPicker(page, { selected, complete: false });
  await expect(picker.getByText('This is a partial course list.', { exact: false })).toBeVisible();
  await picker.getByLabel('Filter this course page by name or code (optional)').fill('Algorithms');
  await picker.getByRole('button', { name: 'Check course list again', exact: true }).click();
  await expect(picker.getByText('Course list checked. Choose courses below, then save your selection.')).toBeVisible();
  const preserved = picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false });
  await expect(preserved).toBeChecked();
  await picker.getByRole('checkbox', { name: 'Synthetic Algorithms', exact: false }).check();
  await picker.getByRole('button', { name: 'Save selected courses', exact: true }).click();
  await expect(picker.getByText('Selected courses saved.', { exact: false })).toBeVisible();
  expect(requests[1]).toEqual({ action: 'select', courseIds: [courses[0].id, courses[1].id], mappings: { [courses[0].id]: 'circuit-foundations' } });
  await preserved.uncheck();
  await picker.getByRole('button', { name: 'Save selected courses', exact: true }).click();
  await expect(picker.getByText('1 course selected · saved selection')).toBeVisible();
  expect(requests[2].courseIds).toEqual([courses[1].id]);
});

test('course status failures recover without losing the form, including empty results and keyboard/mobile layout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const { picker, restoreStatus } = await openPicker(page, { failFirst: true });
  await expect(picker.getByRole('alert')).toContainText('Synthetic sign-in expired.');
  restoreStatus();
  await picker.getByRole('button', { name: 'Retry course selection', exact: true }).click();
  const first = picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false });
  await first.focus();
  await page.keyboard.press('Space');
  await expect(first).toBeChecked();
  await picker.getByLabel('Filter this course page by name or code (optional)').fill('No synthetic match');
  await picker.getByRole('button', { name: 'Check course list again', exact: true }).click();
  await expect(picker.getByText('No courses in this list.', { exact: false })).toBeVisible();
  // Unsaved draft scope survives a new catalog as well as persisted selection.
  await expect(picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/blackboard-picker-mobile.png', fullPage: true });
});

test('loading another course page sends only the more flag and preserved query, retaining draft selections', async ({ page }) => {
  const { picker, requests } = await openPicker(page, { paginated: true });
  await expect(picker.getByLabel('Filter this course page by name or code (optional)')).toHaveValue('Synthetic');
  await expect(picker.getByText('The filter checks one returned page at a time.', { exact: false })).toBeVisible();
  await picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false }).check();
  await picker.getByRole('button', { name: 'Load more courses', exact: true }).click();
  await expect(picker.getByRole('checkbox', { name: 'Synthetic Algorithms', exact: false })).toBeVisible();
  await expect(picker.getByRole('checkbox', { name: 'Synthetic Ecology', exact: false })).toBeChecked();
  await expect(picker.getByRole('button', { name: 'Load more courses', exact: true })).toHaveCount(0);
  expect(requests).toEqual([{ action: 'discover', query: 'Synthetic', more: true }]);
  await picker.getByRole('checkbox', { name: 'Synthetic Algorithms', exact: false }).check();
  await picker.getByRole('button', { name: 'Save selected courses', exact: true }).click();
  await expect(picker.getByText('2 courses selected · saved selection')).toBeVisible();
  expect(requests[1]).toEqual({ action: 'select', courseIds: courses.map(course => course.id), mappings: {} });
});
