import { expect, test } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import type { SomaInvestigation, WorkspaceResponse } from '../../src/lib/domain/types';

test('optional investigation preserves responses and exposes a provisional before/after comparison', async ({ page }) => {
  let workspace = seedWorkspace('investigation-ui-contract');
  const source = workspace.sources.find(item => item.courseId === 'circuits')!;
  const quote = source.body.slice(0, 100);
  const record: SomaInvestigation = {
    id: 'investigation-first', workspaceId: workspace.id, courseId: 'circuits', createdAt: new Date().toISOString(), mode: 'synthetic',
    decision: 'needs-evidence', reason: 'These original synthetic sources do not settle which explanation fits the response.',
    sourceRefs: [{ sourceId: source.id, version: source.version, quote }], assessmentId: null, applicability: 'course',
    conflicts: [{ sourceIds: [source.id, 'source-b'], reason: 'The synthetic source statements have not been reconciled.', resolution: 'unresolved', preferredSourceId: null }],
    diagnosticLessonId: 'optional-diagnostic', diagnosticPlan: {
      kind: 'text', experimentRunId: null, courseId: 'circuits',
      hypotheses: [
        { id: 'branch-model', claim: 'The learner may be treating parallel branches as one series path.', evidence: [{ sourceId: source.id, version: source.version, quote }], attemptIds: [], status: 'plausible' },
        { id: 'source-model', claim: 'The learner may be holding total current constant as a branch changes.', evidence: [{ sourceId: source.id, version: source.version, quote }], attemptIds: [], status: 'plausible' },
      ],
      question: 'Which relationship stays fixed across ideal parallel branches?', options: ['The voltage across each branch', 'The total current', 'Every branch current'],
      predictions: [{ hypothesisId: 'branch-model', predictedOptionIndex: 1 }, { hypothesisId: 'source-model', predictedOptionIndex: 2 }],
      rationale: 'Different choices help distinguish two provisional explanations of the same returned response.', nextActivity: 'Compare the branch voltages against the ideal source.',
    },
  };
  const diagnostic = { ...workspace.lessons[0], id: 'optional-diagnostic', title: 'An optional branch comparison', kind: 'practice' as const, exposure: 'fresh-no-diagram' as const,
    question: record.diagnosticPlan!.question, options: record.diagnosticPlan!.options, diagnosticInvestigationId: record.id };
  const reply = (selectedLessonId?: string): WorkspaceResponse => ({ workspace, capabilities: { spark: true, persistence: 'local-synthetic', liveSources: [] }, ...(selectedLessonId ? { selectedLessonId } : {}) });
  const requests: Record<string, unknown>[] = [];
  // Test the browser/API contract with original synthetic records; no model or connector is called.
  await page.route('**/api/workspace', route => route.fulfill({ json: reply() }));
  await page.route('**/api/investigations', route => {
    const body = route.request().postDataJSON(); requests.push(body);
    if (!body.previousInvestigationId) {
      workspace = { ...workspace, investigations: [record], lessons: [diagnostic, ...workspace.lessons] };
      return route.fulfill({ json: reply(diagnostic.id) });
    }
    workspace = { ...workspace, investigations: [...workspace.investigations!, {
      ...record, id: 'investigation-second', supersedesId: record.id, attemptIds: [body.attemptId], diagnosticPlan: undefined, diagnosticLessonId: undefined,
      reason: 'The saved response weakens one provisional explanation while the other remains uncertain.',
      hypothesisRevisions: [{ hypothesisId: 'branch-model', status: 'weakened' }, { hypothesisId: 'source-model', status: 'unresolved' }],
    }] };
    return route.fulfill({ json: reply() });
  });
  await page.route('**/api/actions', route => {
    workspace = applyAction(workspace, route.request().postDataJSON());
    return route.fulfill({ json: reply() });
  });
  await page.goto('/?view=courses');
  await page.getByRole('button', { name: 'Investigate course update', exact: true }).first().click();
  await expect(page).toHaveURL(/lesson=optional-diagnostic/);
  expect(requests[0].courseId).toBe('circuits');
  expect((requests[0].goal as string).length).toBeLessThanOrEqual(300);
  expect((requests[0].initialSourceIds as string[]).length).toBeGreaterThan(0);
  await expect(page.getByRole('button', { name: 'Reconsider with my response' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Inspect investigation', exact: true }).click();
  await page.locator('section[aria-label="Course investigations"] summary').first().click();
  await expect(page.getByText('Unresolved source conflict', { exact: true })).toBeVisible();
  await expect(page.getByText(record.diagnosticPlan!.hypotheses[0].claim, { exact: true })).toHaveCount(0);
  await page.getByText('Evidence · 1 cited passage', { exact: true }).click();
  await expect(page.getByRole('blockquote')).toContainText(quote);
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.locator('.answer-options').getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Check my thinking', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Reconsider with my response' })).toBeVisible();
  await page.reload();
  await page.getByRole('button', { name: 'Reconsider with my response' }).click();
  expect(requests[1].previousInvestigationId).toBe(record.id);
  expect(requests[1].attemptId).toBe(workspace.attempts[0].id);
  expect(workspace.attempts).toHaveLength(1);
  await page.locator('section[aria-label="Course investigations"] summary').first().click();
  await expect(page.getByText('What changed after your response', { exact: true })).toBeVisible();
  await expect(page.getByText('Before: plausible · After: weakened', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/investigation-mobile.png', fullPage: true });
});
