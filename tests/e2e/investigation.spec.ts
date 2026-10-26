import { expect, test } from '@playwright/test';
import { seedWorkspace } from '../../src/lib/domain/seed';
import { applyAction } from '../../src/lib/domain/learning';
import { evaluateDiagnosticExperiment } from '../../src/lib/domain/diagnostics';
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
      workspace = { ...workspace, recommendedLessonId: diagnostic.id, investigations: [record], lessons: [diagnostic, ...workspace.lessons] };
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
  await page.getByRole('button', { name: 'Back to today', exact: true }).click();
  await expect(page.locator('.ready-card').getByRole('heading', { name: diagnostic.title, exact: true })).toBeVisible();
  await expect(page.locator('.session-items')).not.toContainText('Fresh application');
  await page.getByRole('button', { name: 'Open lesson', exact: true }).click();
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
  expect(workspace.attempts[0].assisted).toBe(true);
  expect(workspace.attempts[0].assistance.some(item => item.includes('explanation'))).toBe(true);
  await page.locator('section[aria-label="Course investigations"] summary').first().click();
  await expect(page.getByText('What changed after your response', { exact: true })).toBeVisible();
  await expect(page.getByText('Before: plausible · After: weakened', { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 360, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '.local/screenshots/investigation-mobile.png', fullPage: true });
});

test('persisted diagnostic experiments restore their setup, reveal generic targets, and preserve mismatched conditions', async ({ page }) => {
  let workspace = seedWorkspace('diagnostic-experiment-ui');
  const baseline = { topology: 'parallel' as const, voltage: 12, r1: 6, r2: 3 };
  const voltage = evaluateDiagnosticExperiment({ baseline, change: { parameter: 'voltage', value: 24 }, observable: 'current1', predictions: [
    { hypothesisId: 'changes', claim: 'Branch current doubles when the source voltage doubles.', predictedValue: 4 },
    { hypothesisId: 'fixed', claim: 'Branch current stays fixed when the source voltage changes.', predictedValue: 2 },
  ] });
  const resistance = evaluateDiagnosticExperiment({ baseline, change: { parameter: 'r1', value: 12 }, observable: 'current1', predictions: [
    { hypothesisId: 'changes', claim: 'Branch current halves when its branch resistance doubles.', predictedValue: 1 },
    { hypothesisId: 'fixed', claim: 'Branch current stays fixed when its resistance changes.', predictedValue: 2 },
  ] });
  expect(voltage.informative && resistance.informative).toBe(true);
  const lessons = [voltage, resistance].map((experiment, index) => ({ ...workspace.lessons[0], id: `diagnostic-experiment-${index}`, title: index ? 'A resistance experiment' : 'A voltage experiment', circuit: baseline, diagnosticInvestigationId: `investigation-${index}`, diagnosticExperiment: { input: experiment.input } }));
  workspace = { ...workspace, lessons: [...lessons, ...workspace.lessons] };
  const reply = (): WorkspaceResponse => ({ workspace, capabilities: { spark: false, persistence: 'local-synthetic', liveSources: [] } });
  // Only transport is stubbed. The application reducer owns prediction and reveal records.
  await page.route('**/api/workspace', route => route.fulfill({ json: reply() }));
  await page.route('**/api/actions', route => {
    workspace = applyAction(workspace, route.request().postDataJSON());
    return route.fulfill({ json: reply() });
  });
  await page.goto('/?view=study&lesson=diagnostic-experiment-0');
  await page.getByRole('spinbutton', { name: 'Resistance R₁', exact: true }).fill('10');
  await expect.poll(() => workspace.savedInputs[lessons[0].id]?.r1).toBe(10);
  await page.getByRole('button', { name: 'Restore experiment setup', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Resistance R₁', exact: true })).toHaveValue('6');
  await page.locator('.predict-options').getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Save prediction', exact: true }).click();
  await page.getByRole('button', { name: 'Set source voltage to 24 V and see', exact: true }).click();
  await expect(page.getByRole('spinbutton', { name: 'Supply voltage', exact: true })).toHaveValue('24');
  await expect(page.getByText('Your prediction matched.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('spinbutton', { name: 'Supply voltage', exact: true })).toHaveValue('24');
  await expect(page.getByText('Your prediction matched.', { exact: true })).toBeVisible();
  expect(workspace.predictions?.find(item => item.lessonId === lessons[0].id && item.kind === 'reveal')).toMatchObject({ resultInputs: { voltage: 24, r1: 6, r2: 3 }, comparisonValid: true, matched: true });

  await page.goto('/?view=study&lesson=diagnostic-experiment-1');
  await page.locator('.predict-options').getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Save prediction', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Set R₁ to 12 Ω and see', exact: true })).toBeVisible();
  await page.getByRole('spinbutton', { name: 'Supply voltage', exact: true }).fill('18');
  await expect.poll(() => workspace.savedInputs[lessons[1].id]?.voltage).toBe(18);
  await page.getByRole('spinbutton', { name: 'Resistance R₁', exact: true }).fill('12');
  await expect(page.getByText('Other inputs changed', { exact: true })).toBeVisible();
  await expect(page.getByText('Your prediction matched.', { exact: true })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText('Other inputs changed', { exact: true })).toBeVisible();
  const records = workspace.predictions?.filter(item => item.lessonId === lessons[1].id);
  expect(records?.find(item => item.kind === 'selection')).toMatchObject({ inputs: baseline, checkpoint: { parameter: 'r1', targetValue: 12 } });
  const revealed = records?.find(item => item.kind === 'reveal');
  expect(revealed).toMatchObject({ comparisonValid: false, resultInputs: { voltage: 18, r1: 12, r2: 3 } });
  expect(revealed).not.toHaveProperty('matched');
});

test('source disclosure waits for saved help and cannot rewrite an earlier unassisted diagnostic response', async ({ page }) => {
  let workspace = seedWorkspace('diagnostic-help-boundary');
  const lesson = { ...workspace.lessons[0], id: 'help-boundary', kind: 'practice' as const, exposure: 'fresh-no-diagram' as const, diagnosticInvestigationId: 'help-inspection', reason: 'An optional comparison using your selected course context.' };
  workspace = { ...workspace, lessons: [lesson, { ...lesson, id: 'historical-help-boundary', state: 'stale' }, ...workspace.lessons] };
  const reply = (): WorkspaceResponse => ({ workspace, capabilities: { spark: false, persistence: 'local-synthetic', liveSources: [] } });
  let rejectHelp = true;
  await page.route('**/api/workspace', route => route.fulfill({ json: reply() }));
  await page.route('**/api/actions', route => {
    const action = route.request().postDataJSON();
    if (action.type === 'assistance' && rejectHelp) return route.fulfill({ status: 503, json: { error: 'Synthetic help persistence unavailable.' } });
    workspace = applyAction(workspace, action); return route.fulfill({ json: reply() });
  });
  await page.goto('/?view=study&lesson=help-boundary');
  await page.locator('.why-card summary').click();
  await page.getByRole('button', { name: 'Read source context', exact: true }).click();
  await expect(page.locator('main [role="alert"]')).toContainText('Synthetic help persistence unavailable.');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(workspace.assistance[lesson.id] ?? []).toHaveLength(0);
  await page.locator('.answer-options').getByRole('radio').first().check();
  await page.getByRole('button', { name: 'Check my thinking', exact: true }).click();
  await expect.poll(() => workspace.attempts.length).toBe(1);
  const original = structuredClone(workspace.attempts[0]); expect(original.assisted).toBe(false);
  rejectHelp = false;
  await page.getByRole('button', { name: 'Read source context', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your sources', exact: true })).toBeVisible();
  expect(workspace.assistance[lesson.id].some(item => item.includes('explanation'))).toBe(true);
  expect(workspace.attempts[0]).toEqual(original);
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.getByRole('button', { name: 'Save revised answer', exact: true }).click();
  await expect.poll(() => workspace.attempts.length).toBe(2);
  expect(workspace.attempts[1].assisted).toBe(true); expect(workspace.attempts[0]).toEqual(original);
});
