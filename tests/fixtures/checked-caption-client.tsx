import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ExplorationScene } from '../../src/components/exploration-scene';
import { ExplorationJournalLog } from '../../src/components/exploration-journal-log';
import type { ExplorationSpec } from '../../src/lib/domain/exploration';
import {
  captionIsGrounded, circuitSolution, explorationExecution,
  explorationStepCaption, initialExplorationState,
} from '../../src/lib/domain/exploration-view';
import type { SourceOverlayModel } from '../../src/lib/domain/source-overlay-model';
import graph from '../../src/lib/fixtures/recorded-graph.json';
import circuit from '../../src/lib/fixtures/recorded-circuit.json';
import graphPresentation from '../../src/lib/fixtures/recorded-graph-presentation.json';
import circuitPresentation from '../../src/lib/fixtures/recorded-circuit-presentation.json';

export type CheckedCaptionFixture = { kind: 'graph' | 'circuit'; caption: string; image: string };
declare global {
  interface Window {
    __checkedCaptionInitial: CheckedCaptionFixture;
    __checkedCaptionMirror: { id: string; model: SourceOverlayModel | null }[];
    __checkedCaptionExpected: string;
    __checkedCaptionNumericGuard: boolean;
    __checkedCaptionMedia: string[];
  }
}

// Adversarial authored prose over original synthetic recorded inputs. Actual React,
// solvers, source overlay and native mirror events run; no native service is connected.
function Fixture() {
  const input = window.__checkedCaptionInitial;
  const [spec] = useState(() => {
    const value = structuredClone(input.kind === 'graph' ? graph.spec : circuit.spec) as ExplorationSpec;
    if (value.mode === 'clarify' || value.mode === 'explanation') throw Error('Expected a checked fixture.');
    delete value.writtenFor;
    const state = initialExplorationState(value);
    const run = explorationExecution(value, state), dc = circuitSolution(value, state);
    const final = (run?.steps.length ?? dc!.steps.length) - 1;
    value.steps = [{
      id: 'synthetic-adversarial-caption', caption: input.caption, narration: input.caption,
      execution: 'primary', executionStep: final, highlightIds: [],
    }];
    return value;
  });
  const [state, setState] = useState(() => {
    const initial = initialExplorationState(spec);
    const run = explorationExecution(spec, initial), dc = circuitSolution(spec, initial);
    return { ...initial, step: (run?.steps.length ?? dc!.steps.length) - 1 };
  });
  const run = explorationExecution(spec, state), dc = circuitSolution(spec, state);
  window.__checkedCaptionExpected = explorationStepCaption(spec, state);
  window.__checkedCaptionNumericGuard = captionIsGrounded(input.caption, [run], dc);
  return <main className="exploration-app">
    <ExplorationJournalLog spec={spec} state={state} provenance="muse" />
    <ExplorationScene spec={spec} state={state} onChange={setState} overlay={{
      image: input.image,
      layout: input.kind === 'graph' ? graphPresentation.layout : circuitPresentation.layout,
      nativeId: `synthetic-caption-${input.kind}`,
    }} />
  </main>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
