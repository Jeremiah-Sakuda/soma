import { randomUUID } from 'node:crypto';
import { chmodSync, mkdirSync, writeFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { resolve } from 'node:path';
import { describe, it } from 'vitest';
import { seedEmptyAccountWorkspace } from '../../src/lib/domain/seed';
import { calculateCircuit } from '../../src/lib/domain/circuit';
import { getPredictionCheckpoint } from '../../src/lib/domain/prediction';
import { applyAction } from '../../src/lib/domain/learning';
import type { DiagnosticExperimentResult } from '../../src/lib/domain/diagnostics';
import { investigateWithSpark, publishInvestigation, type InvestigationResult } from '../../src/lib/server/investigator';
import { getServerFirestore } from '../../src/lib/server/firebase-config';
import { INVESTIGATION_RESERVATION_USD, MAX_INVESTIGATION_CALLS } from '../../src/lib/server/budget';

const names = new Set(['list_sources', 'read_source', 'follow_reference', 'evaluate_experiment', 'prepare_diagnostic', 'prepare_experiment_diagnostic', 'revise_interpretation', 'finish_investigation']);
const check = (value: unknown, stage: string) => { if (!value) throw new Error(`Experiment development probe failed: ${stage}.`); };

/** One original synthetic development check, not held-out evaluation, real course access, or scientific review. */
describe.skipIf(process.env.SOMA_EXPERIMENT_LIVE_TEST !== 'true')('single live experiment-composition development probe', () => {
  it('composes, evaluates and publishes a model-selected experiment with truthful interaction evidence', { timeout: 115_000, retry: 0 }, async () => {
    const state = seedEmptyAccountWorkspace(`experiment-development-${randomUUID()}`), courseId = 'synthetic-circuit-development';
    state.courses = [{ id: courseId, code: 'SYN', title: 'Original synthetic resistor development course', instructor: '', color: '#245683', deadline: '', nextEvent: '' }];
    state.sources = [{ id: 'original-resistor-note', courseId, title: 'Original synthetic node and branch note', version: 1, status: 'current', kind: 'synthetic', origin: 'synthetic', retrievedAt: state.createdAt, context: { role: 'teaching-material' }, body: 'This is original synthetic development material, not an actual class source. Ideal resistors connected in parallel share the same two endpoint nodes and the same voltage. Each branch current equals its voltage divided by its resistance. Changing one branch resistance at fixed source voltage changes that branch current but leaves the other branch current unchanged. In a single series path, all resistors carry the same current; total resistance is the sum, and each voltage drop equals current times resistance. A drawing can be misleading: node connectivity, not the position or shape of a wire on the page, determines the topology. An explanation that unequal branches carry equal current could reflect misreading the diagram as a single path or confusing the common-voltage relationship with common current. A discriminating interaction should make different predictions under competing explanations.' }];
    const original = JSON.stringify(state), started = Date.now(), fetchOriginal = globalThis.fetch;
    let calls = 0, outcome = 'failed', failureStage = 'preflight', result: InvestigationResult | undefined;
    const toolSequence: string[] = [], experiments = new Map<string, DiagnosticExperimentResult>(), seenOutputs = new Set<string>();
    let validationRepairs = 0;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== 'https://api.meta.ai/v1/responses') return fetchOriginal(input, init);
      calls++; check(calls <= MAX_INVESTIGATION_CALLS, 'call ceiling');
      if (typeof init?.body === 'string') {
        const body = JSON.parse(init.body) as { input?: { type?: string; call_id?: string; output?: string }[] };
        for (const item of body.input ?? []) if (item.type === 'function_call_output' && item.output && item.call_id && !seenOutputs.has(item.call_id)) {
          seenOutputs.add(item.call_id);
          const output = JSON.parse(item.output);
          if (output.accepted === false) validationRepairs++;
          if (typeof output.id === 'string' && output.id.startsWith('experiment-') && typeof output.informative === 'boolean' && output.input) experiments.set(output.id, output as DiagnosticExperimentResult);
        }
      }
      const response = await fetchOriginal(input, init);
      if (response.ok) {
        const data = await response.clone().json() as { output?: { type?: string; name?: string }[] };
        for (const item of data.output ?? []) if (item.type === 'function_call') toolSequence.push(item.name && names.has(item.name) ? item.name : 'unknown-tool');
      }
      return response;
    }) as typeof fetch;
    try {
      const cap = Number(process.env.META_APP_SPEND_CAP_USD || '1');
      check(cap > 0 && cap <= 1 && process.env.SOMA_LIVE_INFERENCE === 'true' && Boolean(process.env.MODEL_API_KEY), 'unchanged application budget');
      check(!process.env.FIRESTORE_EMULATOR_HOST && !process.env.FIREBASE_AUTH_EMULATOR_HOST, 'no emulator fallback');
      failureStage = 'live investigation';
      // No scripted provider actions, fixed numeric experiment, or preselected readout.
      result = await investigateWithSpark(state, { courseId, initialSourceIds: ['original-resistor-note'], goal: 'Investigate the synthetic equal-branch-current explanation. Choose a manipulable control and numerical readout that distinguish two plausible diagram-reading or topology explanations, then offer an optional interactive diagnostic and select that next activity.' });
      failureStage = 'composition and publication';
      check(result.record.engineVersion === 'source-diagnostic-investigation-v4' && result.run.mode === 'live' && result.run.status === 'completed', 'frozen v4 live engine');
      check(JSON.stringify(state) === original, 'original input preservation');
      const readIndex = toolSequence.indexOf('read_source'), evaluateIndex = toolSequence.indexOf('evaluate_experiment'), prepareIndex = toolSequence.indexOf('prepare_experiment_diagnostic'), finishIndex = toolSequence.lastIndexOf('finish_investigation');
      check(readIndex >= 0 && evaluateIndex > readIndex && prepareIndex > evaluateIndex && finishIndex > prepareIndex, 'actual read/evaluate/prepare/finish sequence');
      const selectedRun = result.record.diagnosticPlan?.experimentRunId;
      const evaluated = selectedRun ? experiments.get(selectedRun) : undefined;
      check(evaluated?.informative === true && result.record.diagnosticPlan?.kind === 'circuit-experiment', 'selected informative evaluated experiment');
      check(result.lesson?.kind === 'circuit' && result.selectedLessonId === result.lesson.id && !result.lesson.examEligible && result.lesson.validation?.status === 'development-preview', 'validated selected preview');
      check(JSON.stringify(result.lesson?.diagnosticExperiment?.input) === JSON.stringify(evaluated!.input), 'exact checked experiment binding');
      const published = publishInvestigation(state, result), lesson = published.lessons.find(item => item.id === result!.selectedLessonId)!;
      check(published.recommendedLessonId === lesson.id && published.investigations?.some(record => record.id === result!.record.id), 'saved decision and lesson');
      check(JSON.stringify(published.sources) === JSON.stringify(state.sources) && JSON.stringify(published.attempts) === JSON.stringify(state.attempts), 'publication preserves evidence');
      failureStage = 'renderer and observation validation';
      const checkpoint = getPredictionCheckpoint(lesson), experiment = evaluated!.input;
      check(checkpoint.parameter === experiment.change.parameter && checkpoint.targetValue === experiment.change.value && checkpoint.observedOutput === experiment.observable, 'actual selected control and readout');
      const predicted = applyAction(published, { type: 'prediction', lessonId: lesson.id, optionIndex: checkpoint.answerIndex });
      const revealed = applyAction(predicted, { type: 'reveal-prediction', lessonId: lesson.id });
      const reveal = revealed.predictions!.at(-1)!, expectedInputs = { ...experiment.baseline, [experiment.change.parameter]: experiment.change.value };
      check(JSON.stringify(reveal.resultInputs) === JSON.stringify(expectedInputs) && JSON.stringify(reveal.result) === JSON.stringify(calculateCircuit(expectedInputs)) && reveal.comparisonValid && reveal.matched, 'deterministic reveal');
      const answered = applyAction(revealed, { type: 'attempt', lessonId: lesson.id, optionIndex: 0 });
      check(answered.attempts.at(-1)?.correct === null && answered.attempts.at(-1)?.assisted && JSON.stringify(answered.interpretations) === JSON.stringify(revealed.interpretations), 'ungraded supported response');
      check(calls === result.record.usage?.calls && calls <= MAX_INVESTIGATION_CALLS && result.record.usage!.costUsd <= INVESTIGATION_RESERVATION_USD, 'bounded usage');
      outcome = 'passed'; failureStage = 'none';
    } catch (error) {
      const effect = (error as { run?: { effect?: string } }).run?.effect ?? '';
      if (failureStage === 'live investigation') failureStage = /call limit/i.test(effect) ? 'call-limit' : /time|timeout/i.test(effect) ? 'time-limit' : /schema|required|invalid_type/i.test(effect) ? 'tool-schema' : /experiment|hypothes|prediction/i.test(effect) ? 'diagnostic-boundary' : /quote|source|evidence/i.test(effect) ? 'source-boundary' : 'tool-or-provider-boundary';
      throw new Error(`Single experiment development probe stopped at ${failureStage}; no repeat run was attempted.`);
    } finally {
      globalThis.fetch = fetchOriginal;
      let settlement: { chargedUsd: number | null; reservedUsd: number; state: string } = { chargedUsd: null, reservedUsd: INVESTIGATION_RESERVATION_USD, state: 'unavailable' };
      try {
        let rows: { charged?: number | null; reserved?: number }[];
        if (process.env.SOMA_PERSISTENCE === 'firestore') {
          const snapshot = await getServerFirestore().collection('somaBudgetReservations').where('workspaceId', '==', state.id).get();
          rows = snapshot.docs.map(document => document.data());
        } else {
          const db = new DatabaseSync(resolve(process.env.SOMA_BUDGET_DB_PATH || '.local/budget.sqlite'), { readOnly: true });
          try { rows = db.prepare('SELECT charged, reserved FROM reservations WHERE workspace=?').all(state.id) as typeof rows; } finally { db.close(); }
        }
        if (rows.length === 1) settlement = { chargedUsd: typeof rows[0].charged === 'number' ? rows[0].charged : null, reservedUsd: Number(rows[0].reserved), state: typeof rows[0].charged === 'number' ? 'settled' : 'reservation-retained' };
        else if (rows.length === 0) settlement = { chargedUsd: 0, reservedUsd: 0, state: 'no-reservation' };
      } catch { /* Metrics still record unavailable settlement; never guess a charge. */ }
      mkdirSync('.local', { recursive: true, mode: 0o700 });
      const path = '.local/investigator-experiment-development-metrics.json';
      writeFileSync(path, '', { mode: 0o600 }); chmodSync(path, 0o600);
      writeFileSync(path, JSON.stringify({ label: 'One original synthetic development probe; not held-out, real-class, or scientific validation.', engine: 'source-diagnostic-investigation-v4', at: new Date().toISOString(), outcome, failureStage, calls, elapsedMs: Date.now() - started, estimatedCostUsd: result?.record.usage?.costUsd ?? null, settlement, tools: toolSequence, validationRepairs, experimentCount: experiments.size, informativeResults: [...experiments.values()].map(item => item.informative), uninformativeThenInformativeObserved: [...experiments.values()].some((item, index, all) => !item.informative && all.slice(index + 1).some(later => later.informative)) }, null, 2), { mode: 0o600 });
    }
  });
});
