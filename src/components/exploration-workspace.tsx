'use client';
import { CompanionMemory } from './companion-memory';
import { readExplorationStream } from '@/lib/client/exploration-stream';
import {
  explorationProgressLabel,
  type ExplorationProgress,
} from '@/lib/domain/exploration-progress';
import { ExplorationSourceGrounding } from './exploration-source-grounding';
import type { SourceAnchor, SourceChange } from '@/lib/domain/source-grounding';

import { useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ImagePlus,
  MonitorUp,
  MoreHorizontal,
  RotateCcw,
  Save,
  Square,
  Sparkles,
  X,
} from 'lucide-react';
import { checkExploration, type ExplorationSpec } from '@/lib/domain/exploration';
import {
  ExplorationScene,
  explorationExecution,
  initialExplorationState,
  type ExplorationViewState,
} from './exploration-scene';
import type { ExplorationPrediction } from '@/lib/domain/exploration-prediction';
import { ExplorationCostProbe } from './exploration-cost-probe';
import { ExplorationCircuitProbe } from './exploration-circuit-probe';
import type { CostProbe } from '@/lib/domain/cost-probe';
import type { DcProbe } from '@/lib/domain/dc-circuit';
import { circuitSolution, explorationInputsChanged } from '@/lib/domain/exploration-view';
import type { PublicExplorationApplication } from '@/lib/domain/exploration-application';
import { ExplorationApplicationCard } from './exploration-application';
import { ExplorationPredictionCard } from './exploration-prediction';
import { ExplorationPlayback } from './exploration-playback';
import { ExplorationPipeline } from './exploration-pipeline';
import { useExplorationPointAsk } from './exploration-point-ask';
import type { PointFocus } from '@/lib/domain/point-context';
import type { PublicDemoImage, RecordedPresentation } from '@/lib/server/exploration-types';
import { ExplorationVoice } from './exploration-voice';
import { useExplorationCapture, type ExplorationCapture } from './exploration-capture';
import type { SourceGraphLayout } from './source-overlay';
import { JournalMenu } from './journal-menu';
import { ExplorationJournalLog } from './exploration-journal-log';
import './exploration.css';
import './exploration-journal.css';

/** Steps in the checked trace on screen, for either checked family; null without one. */
function compactStepCount(spec: ExplorationSpec, state: ExplorationViewState) {
  return explorationExecution(spec, state)?.steps.length ?? (circuitSolution(spec, state)?.steps.length || null);
}
type Artifact = {
  recording?: {
    id: string;
    generatedAt: string;
    sourceImage: string;
    presentation?: RecordedPresentation;
  };
  experiment?: CostProbe;
  circuitExperiment?: DcProbe;
  practiceOrigin?: {
    applicationId: string;
    artifactId: string;
    version: number;
  };
  learningContext?: {
    predictionId?: string;
    applicationId?: string;
    choice: string;
    expected: string;
    reason: string;
    exposure: string;
  };
  id: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  spec: ExplorationSpec;
  validation: {
    assurance: 'checked-bfs' | 'checked-dijkstra' | 'checked-circuit' | 'explanation-only' | 'needs-clarification';
    modelVersion: string | null;
    checks: string[];
  };
  generation: {
    mode: 'live' | 'prepared-example';
    provider: string;
    model: string | null;
    calls: number;
    costUsd: number;
    elapsedMs: number;
    audit?: { event: string; call: number; detail: string }[];
  };
  source: {
    label: string;
    capturedAt: string;
    focus?: PointFocus;
    observationId?: string;
    anchors?: SourceAnchor[];
    layout?: SourceGraphLayout;
    publicDemo?: { image: PublicDemoImage; presentation?: RecordedPresentation };
    readingCheck?: {
      status: 'confirmed' | 'corrected' | 'disputed';
      weighted?: boolean;
      nodes: number;
      edges: number;
      corrections: { edgeId: string; from: number; to: number }[];
      disputes: string[];
    };
    change?: SourceChange;
    kind: 'screenshot' | 'example';
    summary: string;
    uncertainty: string[];
  };
  state: ExplorationViewState;
  saved: boolean;
  question: string;
};
type VersionSummary = {
  id: string;
  version: number;
  title: string;
  saved: boolean;
  updatedAt: string;
  generationMode: string;
};
type ApiResponse = {
  predictions?: ExplorationPrediction[];
  applications?: PublicExplorationApplication[];
  artifact?: Artifact;
  artifacts?: Artifact[];
  active?: Artifact | null;
  liveEnabled?: boolean;
  streamingVoiceEnabled?: boolean;
  versions?: VersionSummary[];
};
const SAVE_FAILURE_MESSAGE =
  'Soma could not save this exploration. Your changes are still here. Try again.';
async function api(
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
  query = '',
  onProgress?: (value: ExplorationProgress) => void,
): Promise<ApiResponse> {
  let response = await fetch(`/api/explore${query}`, {
    method,
    cache: 'no-store',
    signal,
    ...(body === undefined
      ? {}
      : {
          headers: {
            'Content-Type': 'application/json',
            ...(onProgress ? { Accept: 'application/x-ndjson' } : {}),
          },
          body: JSON.stringify(body),
        }),
  });
  if (response.ok && response.headers.get('Content-Type')?.includes('application/x-ndjson')) {
    try {
      response = await readExplorationStream(response, onProgress ?? (() => {}), signal);
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new Error(
        'Soma could not finish receiving the visual. Your last card and question are kept. Please try again.',
      );
    }
  }
  if (!response.ok) {
    const payload: unknown = await response.json().catch(() => null);
    const code =
      payload && typeof payload === 'object' && 'code' in payload ? payload.code : null;
    if (code === 'busy')
      throw new Error(
        'Another exploration is still running. Keep exploring this card and try again shortly.',
      );
    if (code === 'review_unavailable')
      throw new Error(
        'Soma could not finish reviewing the visual. Your last card and current controls are kept; please try again shortly.',
      );
    if (code === 'generation_invalid')
      throw new Error(
        'Soma could not validate the new visual explanation. Your last valid card was kept; try a narrower question.',
      );
    if (code === 'cancelled')
      throw new Error('This request was cancelled. Your previous exploration is unchanged.');
    if (code === 'timeout')
      throw new Error(
        'The explanation took too long. Your last valid card is still here; try again when you are ready.',
      );
    if (response.status === 429)
      throw new Error(
        'Live generation is at capacity. Your last valid card and the recorded Muse run remain available.',
      );
    if (response.status === 409)
      throw new Error(
        'The exploration changed while this response was being prepared. Your last valid card was kept.',
      );
    if (response.status === 401 || response.status === 403 || response.status === 404)
      throw new Error(
        'This exploration is not available in this browser session. Try the original example to start again.',
      );
    if (response.status === 400 || response.status === 413 || response.status === 422)
      throw new Error(
        'Soma could not use this context. Try a clearer PNG or JPEG screenshot, or ask a narrower question.',
      );
    throw new Error(
      method === 'PATCH' && body && typeof body === 'object' && 'action' in body && body.action === 'save'
        ? SAVE_FAILURE_MESSAGE
        : 'Soma could not prepare a new card right now. Your last valid card is still here; you can also try the original example.',
    );
  }
  return response.json();
}
function validated(artifact: Artifact): Artifact {
  // The same strict domain validator protects persisted and fresh responses.
  try {
    const checked = checkExploration(artifact.spec);
    return {
      ...artifact,
      spec: checked.spec,
      validation: checked.validation,
      state: artifact.state ?? initialExplorationState(checked.spec),
    };
  } catch {
    throw new Error(
      'Soma returned an incomplete visual card. Your previous card was kept; try again or use the original example.',
    );
  }
}
const capturedTime = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export function ExplorationWorkspace() {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const [applicationHistory, setApplicationHistory] = useState<PublicExplorationApplication[]>(
    [],
  );
  const [predictionHistory, setPredictionHistory] = useState<ExplorationPrediction[]>([]);
  const capture = useExplorationCapture(),
    uploadRef = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<ExplorationCapture | null>(null),
    [newContext, setNewContext] = useState(false);
  const [artifact, setArtifact] = useState<Artifact | null>(null),
    [artifacts, setArtifacts] = useState<Artifact[]>([]),
    [state, setState] = useState<ExplorationViewState | null>(null);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [deleteConfirmation, setDeleteConfirmation] = useState(false);
  const [spokenProgress, setSpokenProgress] = useState<{
    key: string;
    progress: number | null;
  } | null>(null);
  const [playing, setPlaying] = useState(false),
    [conversational, setConversational] = useState(false);
  const [initialized, setInitialized] = useState(false),
    [initializing, setInitializing] = useState(true),
    [initializationAttempt, setInitializationAttempt] = useState(0);
  const [question, setQuestion] = useState(''),
    [busy, setBusy] = useState(false),
    [sourceBusy, setSourceBusy] = useState(false),
    [saving, setSaving] = useState(false);
  const [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [dirty, setDirty] = useState(false),
    [liveEnabled, setLiveEnabled] = useState<boolean | null>(null);
  const request = useRef<{
      id: string;
      controller: AbortController;
      epoch: number;
    } | null>(null),
    epoch = useRef(0),
    loadSequence = useRef(0);
  const initializationRequest = useRef<Promise<ApiResponse> | null>(null);
  const viewSequence = useRef(0);
  const questionRef = useRef<HTMLTextAreaElement>(null),
    errorRef = useRef<HTMLParagraphElement>(null);
  const [progress, setProgress] = useState<ExplorationProgress | null>(null);
  const pendingSourceRef = useRef<HTMLElement>(null);
  const [pendingSource, setPendingSource] = useState<{
    capture: ExplorationCapture;
    question: string;
  } | null>(null);
  useEffect(() => {
    if (busy && pendingSource)
      pendingSourceRef.current?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [busy, pendingSource]);
  const [streamingVoiceEnabled, setStreamingVoiceEnabled] = useState(false);
  const sourceMemory = useRef<{
    capture: ExplorationCapture;
    id: string;
    version: number;
  } | null>(null);
  const [compareCapture, setCompareCapture] = useState(false);
  const [comparisonCapture, setComparisonCapture] = useState<{
    currentCapturedAt: string;
    previous: ExplorationCapture;
  } | null>(null);
  const compactAction = useRef<(d: { action: string; text?: string }) => void>(() => {});
  useEffect(() => {
    const handle = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d && typeof d.action === 'string') compactAction.current(d);
    };
    window.addEventListener('soma:compact', handle);
    return () => window.removeEventListener('soma:compact', handle);
  }, []);
  const pointAsk = useExplorationPointAsk({
    ready: initialized && liveEnabled !== false,
    interrupt: () => {
      cancel('');
      setPlaying(false);
    },
    prepare: capture.upload,
    source: (next) => {
      capture.stop();
      setSource(next);
      setNewContext(true);
      setError('');
    },
    submit: (text, next) => ask(text, undefined, false, undefined, next),
    error: setError,
    typed: () => question,
  });
  useEffect(() => {
    let active = true;
    setInitializing(true);
    // Share one cookie-establishing request across development effect replay.
    const pending = initializationRequest.current ?? api();
    initializationRequest.current = pending;
    void pending
      .then((result) => {
        if (active) {
          setPredictionHistory(result.predictions ?? []);
          setApplicationHistory(result.applications ?? []);
          setArtifacts((current) => [
            ...current,
            ...(result.artifacts ?? []).filter(
              (item) => !current.some((existing) => existing.id === item.id),
            ),
          ]);
          setLiveEnabled(result.liveEnabled ?? false);
          setStreamingVoiceEnabled(result.streamingVoiceEnabled === true);
          setInitialized(true);
          setInitializing(false);
        }
      })
      .catch(() => {
        if (active) {
          setInitializing(false);
          setError(
            'Your exploration session could not be started. Retry session setup before asking or opening the example. Local screenshot selection remains available.',
          );
        }
      })
      .finally(() => {
        if (initializationRequest.current === pending) initializationRequest.current = null;
      });
    return () => {
      active = false;
      request.current?.controller.abort();
    };
  }, [initializationAttempt]);
  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);
  useEffect(() => {
    if (!artifact) return;
    const card = document.getElementById('exploration-card');
    card?.focus({ preventScroll: true });
    card?.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [artifact?.id, artifact?.version]);
  function apply(next: Artifact, history?: VersionSummary[]) {
    setPlaying(false);
    const value = validated(next);
    viewSequence.current++;
    setArtifact(value);
    setState(value.state);
    setDirty(false);
    setDeleteConfirmation(false);
    setArtifacts((current) => {
      const existing = current.find((item) => item.id === value.id);
      return [
        existing && existing.version > value.version ? existing : value,
        ...current.filter((item) => item.id !== value.id),
      ].slice(0, 20);
    });
    setVersions(
      (current) =>
        history ??
        [
          {
            id: value.id,
            version: value.version,
            title: value.spec.title,
            saved: value.saved,
            updatedAt: value.updatedAt,
            generationMode: value.recording ? 'recorded-live' : value.generation.mode,
          },
          ...current.filter((item) => item.id === value.id && item.version !== value.version),
        ].sort((a, b) => b.version - a.version),
    );
  }
  function cancel(
    message = 'Stopped waiting. An older response will not replace the card you are exploring.',
  ) {
    pointAsk.cancel('');
    setPlaying(false);
    const initialWait = busy && !artifact;
    const pending = request.current;
    request.current = null;
    epoch.current++;
    pending?.controller.abort();
    setBusy(false);
    setPendingSource(null);
    if (initialWait) requestAnimationFrame(() => questionRef.current?.focus());
    if (pending)
      void api('POST', { action: 'cancel', requestId: pending.id }).catch(() => undefined);
    setNotice(message);
  }
  function updateState(next: ExplorationViewState) {
    setPlaying(false);
    if (request.current)
      cancel('Experiment changed. The earlier request will not replace your current controls.');
    viewSequence.current++;
    setState(next);
    setDirty(true);
  }
  function chooseSource(next: ExplorationCapture | null) {
    pointAsk.cancel('');
    setPlaying(false);
    if (request.current)
      cancel('Source changed. The previous request will not replace your current card.');
    epoch.current++;
    loadSequence.current++;
    setSource(next);
    setNewContext(true);
    setError('');
    setNotice(
      artifact
        ? 'New context selected. Your previous card stays available until you ask about this source.'
        : 'Source selected. Review it, then ask your question.',
    );
  }
  async function share() {
    pointAsk.cancel('');
    setSourceBusy(true);
    setError('');
    try {
      await capture.start();
      chooseSource(null);
      setNotice('Window selected. No frame is sent until you choose Ask Soma.');
    } catch {
      setError(
        'Window sharing was not started. You can try again or upload a screenshot instead.',
      );
    } finally {
      setSourceBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    pointAsk.cancel('');
    setSourceBusy(true);
    setError('');
    try {
      const next = await capture.upload(file);
      capture.stop();
      chooseSource(next);
    } catch (failure) {
      setError(
        failure instanceof Error ? failure.message : 'This screenshot could not be read.',
      );
    } finally {
      setSourceBusy(false);
      if (uploadRef.current) uploadRef.current.value = '';
    }
  }
  /** Loads an original demo slide as a source; asking still runs live. */
  async function lectureSlide(circuit = false) {
    try {
      const blob = await fetch(circuit ? '/examples/lecture-9-bridge.png' : '/examples/lecture-14-dijkstra.png').then((r) => {
        if (!r.ok) throw new Error();
        return r.blob();
      });
      await upload(
        new File([blob], circuit ? 'Lecture 9 · Wheatstone bridge.png' : 'Lecture 14 · Dijkstra worked example.png', { type: 'image/png' }),
      );
      setQuestion(circuit ? 'Why is there no current through R5?' : 'Why doesn’t it just take the direct A to F edge?');
      requestAnimationFrame(() => questionRef.current?.focus());
    } catch {
      setError('The demo slide could not be loaded. Try uploading a screenshot.');
    }
  }
  async function example(weighted = false, spatial = false, mechanism = false) {
    if (!initialized) return;
    cancel('');
    capture.stop();
    setSource(null);
    setNewContext(false);
    setError('');
    setSourceBusy(true);
    const sequence = ++loadSequence.current;
    try {
      const result = await api('POST', {
        action: 'example',
        ...(weighted ? { weighted: true } : {}),
        ...(spatial ? { spatial: true } : {}),
        ...(mechanism ? { mechanism: true } : {}),
      });
      if (sequence !== loadSequence.current) return;
      if (!result.artifact) throw new Error('The original example could not be loaded.');
      apply(result.artifact);
      setNotice('Original synthetic example loaded. No model call was made.');
    } catch {
      if (sequence === loadSequence.current)
        setError('The original example could not be loaded. Try again in a moment.');
    } finally {
      if (sequence === loadSequence.current) setSourceBusy(false);
    }
  }
  async function ask(
    spoken?: string,
    predictionId?: string,
    investigate = false,
    practice?: { artifact: Artifact; applicationId: string },
    fresh?: ExplorationCapture,
  ) {
    const base = practice?.artifact ?? artifact;
    const baseState = practice?.artifact.state ?? state;
    const draft = spoken ?? question;
    if (!initialized || !draft.trim() || busy) return false;
    if (
      !fresh &&
      !newContext &&
      base &&
      versions.some((item) => item.id === base.id && item.version > base.version)
    ) {
      setError(
        'Open the latest version before asking a follow-up, or choose a new source to start a separate exploration.',
      );
      return false;
    }
    setPlaying(false);
    setError('');
    setNotice('');
    let selected = fresh ?? source;
    try {
      if (!fresh && capture.sharing && (newContext || !base)) {
        selected = capture.capture();
        setSource(selected);
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : 'Capture failed. Upload a screenshot instead.',
      );
      return false;
    }
    if ((fresh || !base || newContext) && !selected) {
      setError('Select a window or screenshot first, or try the original example.');
      return false;
    }
    const id = crypto.randomUUID(),
      controller = new AbortController(),
      turnEpoch = epoch.current;
    request.current = { id, controller, epoch: turnEpoch };
    setBusy(true);
    setProgress(null);
    const pair = !!(
      base &&
      selected &&
      (fresh || compareCapture) &&
      sourceMemory.current?.id === base.id &&
      sourceMemory.current.version === base.version &&
      sourceMemory.current.capture.capturedAt === base.source.capturedAt
    );
    const followup = base && !newContext && !fresh;
    setPendingSource(
      !followup && selected ? { capture: selected, question: draft.trim() } : null,
    );
    const submittedDraft = draft;
    const payload = {
      action: 'generate',
      ...(predictionId ? { predictionId } : {}),
      ...(practice ? { applicationId: practice.applicationId } : {}),
      requestId: id,
      question: draft.trim(),
      intent: investigate ? 'investigate' : 'auto',
      ...(pair
        ? {
            previousImage: sourceMemory.current!.capture.dataUrl,
            artifactId: base!.id,
            baseVersion: base!.version,
            state: baseState,
          }
        : {}),
      ...(followup
        ? {
            artifactId: base.id,
            baseVersion: base.version,
            state: baseState,
            ...(baseState?.selectedObjectId
              ? { selectedObjectId: baseState.selectedObjectId }
              : {}),
          }
        : {
            source: {
              kind: 'screenshot',
              dataUrl: selected!.dataUrl,
              label:
                `${selected!.kind === 'capture' ? 'Selected-window capture' : 'Uploaded screenshot'}: ${selected!.label}`.slice(
                  0,
                  120,
                ),
              capturedAt: selected!.capturedAt,
              ...(selected!.focus ? { focus: selected!.focus } : {}),
            },
          }),
    };
    try {
      const result = await api('POST', payload, controller.signal, '', (value) => {
        if (request.current?.id === id && epoch.current === turnEpoch) setProgress(value);
      });
      if (request.current?.id !== id || epoch.current !== turnEpoch) return false;
      if (!result.artifact) throw new Error('No complete visual card was returned.');
      if (pair && selected)
        setComparisonCapture({
          currentCapturedAt: selected.capturedAt,
          previous: sourceMemory.current!.capture,
        });
      else if (!followup) setComparisonCapture(null);
      if (selected && (!followup || pair))
        sourceMemory.current = {
          capture: selected,
          id: result.artifact.id,
          version: result.artifact.version,
        };
      else if (
        sourceMemory.current?.id === result.artifact.id &&
        sourceMemory.current.capture.capturedAt === result.artifact.source.capturedAt
      )
        sourceMemory.current.version = result.artifact.version;
      apply(result.artifact);
      setCompareCapture(false);
      setNewContext(false);
      setQuestion((current) => (current === submittedDraft ? '' : current));
      setNotice('New visual card ready. Explore it or ask a follow-up.');
      if (spoken && (conversational || fresh)) setPlaying(true);
      return true;
    } catch (failure) {
      if (request.current?.id === id && !controller.signal.aborted)
        setError(
          failure instanceof Error
            ? failure.message
            : 'Soma could not prepare a new card. Your last card was kept.',
        );
      return false;
    } finally {
      if (request.current?.id === id) {
        request.current = null;
        setPendingSource(null);
        setBusy(false);
      }
    }
  }
  async function save() {
    if (!initialized || !artifact || !state) return;
    setSaving(true);
    setError('');
    const id = artifact.id,
      version = artifact.version,
      before = epoch.current,
      beforeView = viewSequence.current;
    try {
      const result = await api('PATCH', {
        action: 'save',
        artifactId: id,
        version,
        state,
      });
      if (epoch.current !== before) return;
      if (viewSequence.current !== beforeView) {
        setNotice(
          'Saved the earlier state. Your newer changes are still here and remain unsaved.',
        );
        return;
      }
      if (result.artifact) apply(result.artifact);
      setNotice('Saved this version and your exact experiment state.');
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : SAVE_FAILURE_MESSAGE,
      );
    } finally {
      setSaving(false);
    }
  }
  async function resume(id: string, version?: number) {
    if (!initialized) return;
    cancel('');
    const sequence = ++loadSequence.current;
    setError('');
    setSourceBusy(true);
    const beforeView = viewSequence.current;
    try {
      const result = await api(
        'GET',
        undefined,
        undefined,
        `?artifactId=${encodeURIComponent(id)}${version ? `&version=${version}` : ''}`,
      );
      if (sequence !== loadSequence.current) return;
      if (viewSequence.current !== beforeView) {
        setNotice(
          'Kept your newer experiment controls. Select the saved exploration again when you want to resume it.',
        );
        return;
      }
      const next = result.active ?? result.artifact;
      if (!next) throw new Error('This exploration was not found.');
      capture.stop();
      setSource(null);
      setNewContext(false);
      setPredictionHistory(result.predictions ?? []);
      setApplicationHistory(result.applications ?? []);
      apply(next, result.versions);
      setNotice(
        next.recording
          ? 'Resumed the recorded run. Its original synthetic source is available under Source & sharing.'
          : 'Resumed your saved version. Original screenshot pixels were not retained.',
      );
    } catch (failure) {
      if (sequence === loadSequence.current)
        setError(
          failure instanceof Error ? failure.message : 'This exploration could not be resumed.',
        );
    } finally {
      if (sequence === loadSequence.current) setSourceBusy(false);
    }
  }
  async function openRecording(mechanism = false, subject: 'graph' | 'circuit' = 'graph') {
    cancel('');
    setSourceBusy(true);
    setError('');
    const sequence = ++loadSequence.current;
    try {
      const result = await api('POST', { action: 'recording', ...(mechanism ? { mechanism: true } : { subject }) });
      if (sequence !== loadSequence.current) return;
      if (!result.artifact) throw new Error('The recorded run could not be opened.');
      capture.stop();
      setSource(null);
      setNewContext(false);
      apply(result.artifact);
      setNotice(
        'Recorded Spark/Wonder run on an original synthetic screenshot. No new model call; time and cost describe the original generation.',
      );
    } catch (failure) {
      if (sequence === loadSequence.current)
        setError(
          failure instanceof Error ? failure.message : 'The recorded run could not be opened.',
        );
    } finally {
      if (sequence === loadSequence.current) setSourceBusy(false);
    }
  }
  async function remove() {
    if (!initialized || !artifact) return;
    const id = artifact.id;
    cancel('');
    setSourceBusy(true);
    setError('');
    try {
      await api('DELETE', { artifactId: id });
      capture.stop();
      setArtifact(null);
      setState(null);
      setVersions([]);
      setSource(null);
      setNewContext(false);
      setDeleteConfirmation(false);
      setArtifacts((current) => current.filter((item) => item.id !== id));
      setNotice('Deleted this exploration and its saved versions.');
    } catch {
      setError(
        'Deletion did not finish. Your exploration is still available; try again in a moment.',
      );
    } finally {
      setSourceBusy(false);
    }
  }
  const hasContext = !!source || capture.sharing || (!!artifact && !newContext);
  const sourceLabel = newContext
    ? (source?.label ?? (capture.sharing ? capture.shareLabel : ''))
    : (artifact?.source.label ?? source?.label);
  const currentSourceTime = newContext
    ? source?.capturedAt
    : (artifact?.source.capturedAt ?? source?.capturedAt);
  const publicSource = artifact?.source.publicDemo ?? (artifact?.recording
    ? { image: artifact.recording.sourceImage, presentation: artifact.recording.presentation }
    : undefined);
  const changedSinceExplanation = artifact && state
    ? explorationInputsChanged(artifact.spec, state)
    : false;
  const [waitingSeconds, setWaitingSeconds] = useState(0);
  useEffect(() => {
    setWaitingSeconds(0);
    if (!busy) return;
    const began = Date.now();
    const timer = setInterval(
      () => setWaitingSeconds(Math.floor((Date.now() - began) / 1000)),
      1000,
    );
    return () => clearInterval(timer);
  }, [busy]);
  // On narrow windows the diagram fits the room between its top and the docked
  // question line, so the whole graph and the question share the screen.
  useEffect(() => {
    if (!artifact) return;
    const fit = () => {
      const root = document.querySelector<HTMLElement>('.exploration-app'),
        graph = document.querySelector<HTMLElement>('.journal-right .exploration-graph'),
        panel = graph?.closest<HTMLElement>('.exploration-panel'),
        dock = document.querySelector<HTMLElement>('.journal-composer');
      if (!root || !graph || !panel || !dock) return;
      if (!matchMedia('(max-width: 760px)').matches) {
        root.style.removeProperty('--journal-graph-room');
        return;
      }
      const box = graph.getBoundingClientRect(),
        below = panel.getBoundingClientRect().bottom - box.bottom;
      const room = window.innerHeight - dock.offsetHeight - (box.top + window.scrollY) - below - 12;
      root.style.setProperty('--journal-graph-room', `${Math.max(220, Math.floor(room))}px`);
    };
    const frame = requestAnimationFrame(fit);
    window.addEventListener('resize', fit);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', fit);
    };
  }, [artifact, compact]);
  const selectedLabel =
    state?.selectedObjectId &&
    (artifact?.spec.mode === 'checked-bfs' || artifact?.spec.mode === 'checked-dijkstra')
      ? (artifact.spec.input.nodes.find((node) => node.id === state.selectedObjectId)?.label ??
        (() => {
          const edge = artifact.spec.input.edges.find((e) => e.id === state.selectedObjectId);
          const name = (id: string) =>
            artifact.spec.mode === 'checked-bfs' || artifact.spec.mode === 'checked-dijkstra'
              ? (artifact.spec.input.nodes.find((node) => node.id === id)?.label ?? id)
              : id;
          return edge ? `${name(edge.from)}–${name(edge.to)} connection` : null;
        })() ??
        state.selectedObjectId)
      : state?.selectedObjectId && artifact?.spec.mode === 'checked-circuit'
        ? ([...artifact.spec.input.nodes, ...artifact.spec.input.components].find((x) => x.id === state.selectedObjectId)?.label ?? state.selectedObjectId)
      : artifact?.spec.mode === 'explanation' ? artifact.spec.scene.panels.flatMap((panel) =>
          panel.kind === 'spatial' ? panel.objects.map((o) => ({ id: o.id, label: o.label })) : []
        ).find((o) => o.id === state?.selectedObjectId)?.label ?? state?.selectedObjectId
      : state?.selectedObjectId;
  const earlierVersion =
    artifact &&
    versions.some((item) => item.id === artifact.id && item.version > artifact.version);
  // Compact mode: the companion's ask bar drives follow-ups, investigations, steps and
  // playback on the current exploration, and shows a one-line status from here.
  compactAction.current = (d: { action: string; text?: string }) => {
    const text = typeof d.text === 'string' ? d.text.trim().slice(0, 1000) : '';
    if (d.action === 'ask' && text) void ask(text);
    else if (d.action === 'investigate')
      void ask(
        text ||
          (artifact?.spec.mode === 'checked-circuit'
            ? 'Choose the one part whose value most changes what this circuit does, and find exactly where it tips.'
            : 'Choose an informative connection and investigate where fewest edges and lowest cost agree or diverge. Use the checked intervention results to explain the boundary, preserve the original graph and expose a hypothetical cost control.'),
        undefined,
        true,
      );
    else if ((d.action === 'next' || d.action === 'previous') && artifact && state) {
      const last = Math.max(0, (compactStepCount(artifact.spec, state) ?? 1) - 1);
      updateState({ ...state, step: Math.max(0, Math.min(last, state.step + (d.action === 'next' ? 1 : -1))) });
    } else if (d.action === 'play' && artifact) setPlaying(!playing);
  };
  const compactSteps = artifact && state ? compactStepCount(artifact.spec, state) : null;
  // `step` is the shown step's index and `steps` the count. `visual` means this card belongs to
  // a screen snapshot, so it can be drawn there; the companion also requires the drawing to be up.
  const compactStatus = JSON.stringify({
    busy: busy || sourceBusy,
    visual:
      !!artifact &&
      sourceMemory.current?.id === artifact.id &&
      sourceMemory.current.capture.capturedAt === artifact.source.capturedAt &&
      !!sourceMemory.current.capture.nativeId,
    step: compactSteps ? Math.min(state!.step, compactSteps - 1) : null,
    steps: compactSteps,
    playing,
    message: error || '',
    investigable:
      ((artifact?.spec.mode === 'checked-dijkstra' && !!state?.goal) || artifact?.spec.mode === 'checked-circuit') &&
      liveEnabled !== false,
  });
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('soma:compact-state', { detail: JSON.parse(compactStatus) }));
  }, [compactStatus]);
  const versionHistory =
    artifact && versions.length > 1 ? (
      <div className="exploration-version-row">
        <label htmlFor="exploration-version">Version history</label>
        <select
          id="exploration-version"
          value={artifact.version}
          disabled={busy || sourceBusy || saving}
          onChange={(event) => void resume(artifact.id, Number(event.target.value))}
        >
          {versions.map((item) => (
            <option key={item.version} value={item.version}>
              Version {item.version}
              {item.saved ? ' · Saved' : ''} ·{' '}
              {item.generationMode === 'prepared-example'
                ? 'Original example'
                : item.generationMode === 'recorded-live'
                  ? 'Recorded run'
                  : 'Generated'}
            </option>
          ))}
        </select>
      </div>
    ) : null;
  const composer = (
    <section className="exploration-ask-card journal-composer" aria-label="Ask about your context">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void ask();
        }}
      >
        <label htmlFor="exploration-question">
          {artifact && !newContext
            ? 'Where would you like to go next?'
            : 'What would you like to understand?'}
        </label>
        {selectedLabel && (
          <div className="exploration-selected-object">
            <span>Asking about: {selectedLabel}</span>
            <button
              type="button"
              aria-label="Clear selected object"
              onClick={() => {
                if (state) updateState({ ...state, selectedObjectId: null });
              }}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )}
        <div className="journal-composer-row">
          <textarea
            ref={questionRef}
            id="exploration-question"
            rows={1}
            maxLength={2000}
            placeholder={
              artifact && !newContext
                ? artifact.spec.mode === 'explanation' || artifact.spec.mode === 'clarify'
                  ? 'Ask about this explanation…'
                  : artifact.spec.mode === 'checked-circuit'
                    ? 'What if we open a part or change its resistance?'
                    : 'Why that node? What if we change the start?'
                : 'Ask about what is on your screen…'
            }
            value={question}
            onChange={(event) => {
              setPlaying(false);
              setQuestion(event.target.value);
            }}
          />
          <ExplorationVoice
            streamingEnabled={streamingVoiceEnabled}
            pointCommand={pointAsk.command}
            onPointError={pointAsk.voiceError}
            onPointPhase={pointAsk.voicePhase}
            onPointPartial={pointAsk.partial}
            turnKey={
              pointAsk.sessionId
                ? `point:${pointAsk.sessionId}`
                : JSON.stringify([
                    artifact?.id,
                    artifact?.version,
                    state,
                    playing,
                    epoch.current,
                    question,
                    busy,
                    source?.capturedAt,
                    capture.sharing,
                  ])
            }
            onInterrupt={() => {
              flushSync(() => setPlaying(false));
            }}
            onTranscript={(text, pointId) => {
              setQuestion(text);
              if (pointAsk.transcript(text, pointId)) return;
              if (pointId) return;
              if (conversational && hasContext && !earlierVersion) void ask(text);
            }}
            disabled={!initialized || busy || sourceBusy || liveEnabled === false}
          />
          {busy ? (
            <button
              type="button"
              className="secondary-button"
              onClick={(event) => {
                event.preventDefault();
                cancel();
              }}
            >
              <Square size={14} aria-hidden="true" /> Cancel request
            </button>
          ) : (
            <button
              className="primary-button"
              type="submit"
              disabled={
                !initialized ||
                !hasContext ||
                !question.trim() ||
                sourceBusy ||
                liveEnabled === false ||
                (!newContext && !!earlierVersion)
              }
            >
              <Sparkles size={17} aria-hidden="true" />{' '}
              {newContext && artifact ? 'Explore new context' : 'Ask Soma'}
            </button>
          )}
        </div>
        <span className="meta journal-composer-hint">
          Recordings go to Meta for transcription.
        </span>
      </form>
      {pointAsk.status && (
        <div className="exploration-point-status">
          <p role="status">{pointAsk.status}</p>
          {pointAsk.sessionId && !busy && (
            <button
              type="button"
              className="secondary-button"
              onClick={() => cancel('Point & ask cancelled. Your previous visual is kept.')}
            >
              Cancel point &amp; ask
            </button>
          )}
        </div>
      )}
      {liveEnabled === false && (
        <p className="exploration-unavailable">
          Live generation is not enabled here. The original example remains available without a
          model call.
        </p>
      )}
    </section>
  );
  const questionSettings = (
    <details className="exploration-voice-settings">
      <summary>Question settings</summary>
      <label className="exploration-conversation">
        <input
          type="checkbox"
          checked={conversational}
          onChange={(event) => {
            setPlaying(false);
            setConversational(event.target.checked);
          }}
        />{' '}
        Ask and explain after recording{' '}
        <span className="meta">Sends the completed question and plays the reply.</span>
      </label>
    </details>
  );
  const examples = (
    <div className="journal-examples" role="group" aria-label="Examples">
      <div className="journal-example-grid">
        <button
          type="button"
          className="exploration-example-button is-recommended"
          aria-label="Watch a recorded Muse run"
          aria-describedby="example-recorded-note"
          disabled={sourceBusy || !initialized}
          onClick={() => void openRecording()}
        >
          <span className="journal-example-copy">
            <span>Watch a recorded Muse run</span>
            <small id="example-recorded-note">Start here · recorded, no generation wait</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="exploration-example-button"
          aria-label="Compare weighted paths"
          aria-describedby="example-weighted-note"
          disabled={sourceBusy || !initialized}
          onClick={() => void example(true)}
        >
          <span className="journal-example-copy">
            <span>Compare weighted paths</span>
            <small id="example-weighted-note">Prepared · opens instantly</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="exploration-example-button"
          aria-label="Try the Lecture 14 slide (live)"
          aria-describedby="example-graph-note"
          disabled={sourceBusy || !initialized}
          onClick={() => void lectureSlide()}
        >
          <span className="journal-example-copy">
            <span>Try the Lecture 14 slide (live)</span>
            <small id="example-graph-note">Graph · loads a slide, then Ask</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="exploration-example-button"
          aria-label="Try the Lecture 9 circuit slide (live)"
          aria-describedby="example-circuit-note"
          disabled={sourceBusy || !initialized}
          onClick={() => void lectureSlide(true)}
        >
          <span className="journal-example-copy">
            <span>Try the Lecture 9 circuit slide (live)</span>
            <small id="example-circuit-note">Circuit · loads a slide, then Ask</small>
          </span>
          <ArrowUpRight size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="journal-example-extras">
        <button
          className="exploration-example-button"
          type="button"
          disabled={sourceBusy || !initialized}
          onClick={() => void example()}
        >
          Try the original example <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="exploration-example-button"
          disabled={sourceBusy || !initialized}
          onClick={() => void example(false, true)}
        >
          Open the 3D example <ArrowUpRight size={16} aria-hidden="true" />
        </button>
        <a className="exploration-example-button" href="/lab/engine/index.html">
          Lab: a Muse-drawn engine you can turn <ArrowUpRight size={16} aria-hidden="true" />
        </a>
      </div>
    </div>
  );
  const library = artifacts.length > 0 && (
    <section className="exploration-library">
                  <h2>Pick up where you left off</h2>
                  {artifacts.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      aria-current={artifact?.id === item.id ? 'true' : undefined}
                      disabled={sourceBusy || saving}
                      onClick={() => void resume(item.id)}
                    >
                      <span>
                        <strong>{item.spec.title}</strong>
                        <small>
                          Version {item.version}
                          {item.saved ? ' · Saved' : ''}
                        </small>
                      </span>
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                  ))}
                </section>
  );
  const sourcePanel = (
    <section className="exploration-source-card">
      <div className="section-heading">
        <h2>Your context</h2>
        <span className={`status-chip ${capture.sharing ? 'ready' : ''}`}>
          {capture.sharing
            ? 'Sharing selected window'
            : artifact?.source.kind === 'example' && !newContext
              ? 'Original example'
              : sourceLabel
                ? 'Snapshot'
                : 'Not shared'}
        </span>
      </div>
      {artifact && sourceMemory.current?.id === artifact.id && (
        <label className="exploration-compare-source">
          <input
            type="checkbox"
            checked={compareCapture}
            onChange={(e) => setCompareCapture(e.target.checked)}
          />{' '}
          Compare next upload or snapshot with this capture
        </label>
      )}
      {(source?.focus || (!newContext && artifact?.source.focus)) && (
        <p className="meta">Selected region · captured when you released the shortcut.</p>
      )}
      {publicSource && !newContext && !source?.dataUrl ? (
        <img
          className="exploration-source-image"
          src={publicSource.image}
          alt={artifact?.recording ? 'Original synthetic screenshot used in the recorded Spark run' : 'Original synthetic demo screenshot'}
        />
      ) : source?.dataUrl ? (
        <div className={source.focus ? 'exploration-point-preview' : 'exploration-upload-preview'}>
          <img
            className="exploration-source-image"
            src={source.dataUrl}
            alt="Your selected screenshot; captured only when requested"
          />
          {source.focus && (
            <span
              className="exploration-source-focus"
              aria-label={`Selected ${source.focus.kind} region`}
              style={{
                left: `${source.focus.region.x * 100}%`,
                top: `${source.focus.region.y * 100}%`,
                width: `${source.focus.region.width * 100}%`,
                height: `${source.focus.region.height * 100}%`,
              }}
            />
          )}
        </div>
      ) : artifact?.source.kind === 'example' && !newContext ? (
        <div className="exploration-example-source">
          <span className="overline">Original example</span>
          <h3>
            {artifact.spec.mode === 'explanation' ? artifact.spec.title : artifact.spec.mode === 'checked-dijkstra'
              ? 'Fewest edges or lowest cost?'
              : 'A small search problem'}
          </h3>
          <p>
            {artifact.spec.mode === 'explanation' ? artifact.source.summary : artifact.spec.mode === 'checked-dijkstra'
              ? 'Compare two routes through the same weighted graph.'
              : 'Find a route through a graph. Watch the queue decide which node comes next.'}
          </p>
          <span>
            {artifact.spec.mode === 'explanation' ? 'Original schematic · explanation only' : artifact.spec.mode === 'checked-dijkstra'
              ? 'Weighted · Dijkstra and BFS'
              : 'Unweighted · breadth-first search'}
          </span>
        </div>
      ) : (
        <div className="exploration-source-empty">
          <MonitorUp size={34} strokeWidth={1.5} aria-hidden="true" />
          <p>
            {capture.sharing
              ? 'Window selected. Ask to capture one frame.'
              : 'A slide, a diagram, a question worth exploring.'}
          </p>
        </div>
      )}
      {sourceLabel && <p className="exploration-source-name">{sourceLabel}</p>}
      {currentSourceTime && (
        <p className="meta">
          {artifact?.source.kind === 'example' && !newContext ? 'Example created' : 'Captured'}{' '}
          {capturedTime(currentSourceTime)}
          {artifact?.source.kind === 'example' && !newContext ? '' : ' · snapshot, not a live feed'}
        </p>
      )}
      {capture.sharing && (
        <p className="exploration-sharing-note">
          Your first Ask sends one frame. Refresh snapshot selects updated context; never
          continuous uploads.
        </p>
      )}
      <div className="exploration-source-actions">
        <button
          type="button"
          className="secondary-button"
          disabled={sourceBusy}
          onClick={() => void share()}
        >
          <MonitorUp size={17} aria-hidden="true" />{' '}
          {capture.sharing ? 'Choose another window' : 'Share a window'}
        </button>
        <button
          type="button"
          className="secondary-button"
          disabled={sourceBusy}
          onClick={() => uploadRef.current?.click()}
        >
          <ImagePlus size={17} aria-hidden="true" /> Upload screenshot
        </button>
      </div>
      {capture.sharing && (
        <div className="action-row">
          <button
            type="button"
            className="text-button"
            onClick={() => {
              try {
                chooseSource(capture.capture());
              } catch {
                setError('The window could not be captured. Try uploading a screenshot.');
              }
            }}
          >
            <RotateCcw size={15} aria-hidden="true" /> Refresh snapshot
          </button>
        </div>
      )}
      <p className="exploration-privacy-note">
        Screenshots go to Meta only when you ask. Raw image pixels are not saved with your
        exploration. Avoid sharing passwords or private messages.
      </p>
    </section>
  );
  return (
    <div className={`exploration-app ${artifact || busy ? 'has-exploration' : ''}`}>
      <a className="skip-link" href="#exploration-main">
        Skip to exploration
      </a>
      <input
        ref={uploadRef}
        type="file"
        accept="image/png,image/jpeg"
        disabled={sourceBusy}
        className="sr-only"
        aria-label="Upload a PNG or JPEG screenshot"
        onChange={(event) => void upload(event.target.files?.[0])}
      />
      <header className="exploration-header journal-topbar">
        <a className="wordmark journal-wordmark" href="/">
          soma
        </a>
        {capture.sharing && (
          <div className="journal-sharing">
            <span role="status">Sharing a window</span>
            <button type="button" className="text-button" onClick={capture.stop}>
              <Square size={13} aria-hidden="true" /> Stop sharing
            </button>
          </div>
        )}
        <div className="journal-topbar-actions">
          {(artifact || busy) && !(artifact && (newContext || capture.sharing)) && (
            <JournalMenu
              className="journal-source-menu"
              summary={
                <>
                  <MonitorUp size={16} aria-hidden="true" /> Source &amp; sharing
                </>
              }
            >
              {sourcePanel}
            </JournalMenu>
          )}
          {(artifact || busy) && (
            <JournalMenu
              className="journal-explorations-menu"
              closeOn=".exploration-library button, .journal-examples button"
              summary={
                <>
                  Explorations <ChevronDown size={15} aria-hidden="true" />
                </>
              }
            >
              {library}
              {examples}
            </JournalMenu>
          )}
          <JournalMenu label="More" summary={<MoreHorizontal size={18} aria-hidden="true" />}>
            <CompanionMemory
              sessionReady={initialized}
              artifact={
                artifact ? { id: artifact.id, version: artifact.version, saved: artifact.saved } : null
              }
              onOpen={(id, version) => {
                void resume(id, version);
              }}
              onAsk={(next) => {
                setPlaying(false);
                setQuestion(next);
                requestAnimationFrame(() => questionRef.current?.focus());
              }}
            />
            {questionSettings}
            <a className="journal-menu-link" href="/">
              <ArrowLeft size={15} aria-hidden="true" /> Your study workspace
            </a>
            <p className="meta">
              Guest saves expire after 24 hours. Signed-in accounts use a separate history; guest
              work does not transfer automatically.
            </p>
          </JournalMenu>
        </div>
      </header>
      <main id="exploration-main" className="exploration-main journal-desk" tabIndex={-1}>
        {!initialized && (
          <p role="status" className="exploration-notice">
            {initializing
              ? 'Starting your private exploration session…'
              : 'Session setup needs a retry.'}
          </p>
        )}
        {!initialized && !initializing && (
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setError('');
              setInitializationAttempt((value) => value + 1);
            }}
          >
            Retry session setup
          </button>
        )}
        {busy && (
          <div role="status" className="exploration-working">
            <span aria-hidden="true" />
            <div>
              {progress
                ? explorationProgressLabel[progress.phase]
                : 'Soma is preparing your visual explanation…'}{' '}
              <span aria-hidden="true">{waitingSeconds}s elapsed.</span>{' '}
              {artifact
                ? 'Your current diagram stays available. Changing a control cancels this request.'
                : 'You can cancel below without losing your question.'}{' '}
              {waitingSeconds >= 15 &&
                'The last valid visual stays available until this revision passes its checks.'}
            </div>
          </div>
        )}
        {busy && pendingSource && (
          <figure
            ref={pendingSourceRef}
            className="exploration-pending-source"
            aria-label="Source being explained"
          >
            <figcaption>Your selected screen · explanation preparing</figcaption>
            <div className="exploration-pending-image">
              {/* This is the user's frozen input, never a partial model scene. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingSource.capture.dataUrl}
                alt="Frozen screen selected for this question"
              />
              {pendingSource.capture.focus && (
                <span
                  className="exploration-source-focus"
                  aria-label={`Selected ${pendingSource.capture.focus.kind} region`}
                  style={{
                    left: `${pendingSource.capture.focus.region.x * 100}%`,
                    top: `${pendingSource.capture.focus.region.y * 100}%`,
                    width: `${pendingSource.capture.focus.region.width * 100}%`,
                    height: `${pendingSource.capture.focus.region.height * 100}%`,
                  }}
                />
              )}
            </div>
            <p>
              You asked:{' '}
              {pendingSource.question.length > 180
                ? pendingSource.question.slice(0, 180) + '…'
                : pendingSource.question}
            </p>
          </figure>
        )}
        {notice && (
          <p role="status" className="exploration-notice">
            {notice}
          </p>
        )}
        {error && (
          <p ref={errorRef} role="alert" tabIndex={-1} className="exploration-error">
            {error}
          </p>
        )}
        {artifact && (newContext || capture.sharing) && (
          <div className="journal-new-source">{sourcePanel}</div>
        )}
        {artifact && state ? (
          <article
            id="exploration-card"
            data-exploration-mode={artifact.spec.mode}
            tabIndex={-1}
            className={`exploration-artifact journal-spread ${newContext ? 'is-previous-context' : ''}`}
            aria-label="Visual exploration card"
          >
            <header className="journal-page journal-left journal-left-head">
              <div className="exploration-artifact-meta journal-page-meta">
                <p className="journal-provenance">
                  <span>
                    {artifact.recording
                      ? 'Recorded Muse Spark run'
                      : artifact.generation.mode === 'prepared-example'
                        ? artifact.practiceOrigin
                          ? 'Fresh practice variation'
                          : 'Prepared original example'
                        : 'Muse Spark generated'}
                  </span>
                  <span aria-hidden="true"> · </span>
                  <span>
                    {artifact.validation.assurance === 'checked-circuit'
                      ? 'Checked circuit computation'
                      : artifact.validation.assurance === 'checked-dijkstra'
                      ? 'Checked Dijkstra computation'
                      : artifact.validation.assurance === 'checked-bfs'
                        ? 'Checked BFS computation'
                        : artifact.validation.assurance === 'needs-clarification'
                          ? 'Needs clarification'
                          : 'Explanatory visual'}
                  </span>
                  {newContext && <span className="status-chip caution">Previous context</span>}
                </p>
                {artifact.version > 1 && <span className="meta">Version {artifact.version}</span>}
                <div
                  className="journal-save"
                  data-save-state={saving ? 'saving' : dirty || !artifact.saved ? 'unsaved' : 'saved'}
                >
                  <span
                    id="exploration-save-status"
                    className="meta journal-save-status"
                    role="status"
                    aria-label="Exploration save status"
                    aria-atomic="true"
                  >
                    {saving ? 'Saving…' : dirty || !artifact.saved ? 'Unsaved' : 'Saved'}
                  </span>
                  <button
                    type="button"
                    className="secondary-button"
                    aria-label="Save exploration"
                    aria-describedby="exploration-save-status"
                    disabled={saving || busy}
                    onClick={() => void save()}
                  >
                    <Save size={16} aria-hidden="true" /> {saving ? 'Saving…' : 'Save exploration'}
                  </button>
                </div>
                <JournalMenu
                  label="Page details"
                  className="journal-page-menu"
                  summary={<MoreHorizontal size={18} aria-hidden="true" />}
                >
                  <details>
                    <summary>
                      <CircleHelp size={15} aria-hidden="true" /> Source & assumptions
                    </summary>
                    <p>{artifact.source.summary}</p>
                    {changedSinceExplanation && (
                      <>
                        <h3>Earlier explanation</h3>
                        <p>{artifact.spec.title}</p>
                        <p>{artifact.spec.objective}</p>
                      </>
                    )}
                    {artifact.source.uncertainty.length > 0 && (
                      <>
                        <h3>Source reading uncertainty</h3>
                        <ul>
                          {artifact.source.uncertainty.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <p className="meta">
                      {artifact.source.label} · {capturedTime(artifact.source.capturedAt)}
                    </p>
                    {artifact.spec.assumptions.length > 0 && (
                      <>
                        <h3>Assumptions</h3>
                        <ul>
                          {artifact.spec.assumptions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {artifact.spec.uncertainty.length > 0 && (
                      <>
                        <h3>Uncertainty</h3>
                        <ul>
                          {artifact.spec.uncertainty.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    {artifact.spec.unsupportedClaims.length > 0 && (
                      <>
                        <h3>Outside this explanation</h3>
                        <ul>
                          {artifact.spec.unsupportedClaims.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      </>
                    )}
                    <p className="meta">
                      {artifact.validation.assurance.startsWith('checked-')
                        ? `Computation: ${artifact.validation.modelVersion}. This checks the search behavior, not every generated explanation.`
                        : 'Generated explanation; no checked quantitative model is attached.'}{' '}
                      Exploring does not count as an independent attempt.
                    </p>
                  </details>
                  <details id="exploration-audit" className="exploration-audit">
                    <summary>How this card was prepared</summary>
                    <dl>
                      <div>
                        <dt>Mode</dt>
                        <dd>
                          {artifact.recording
                            ? 'Replay of a recorded live generation'
                            : artifact.generation.mode === 'prepared-example'
                              ? artifact.practiceOrigin
                                ? 'Fresh practice variation'
                                : 'Prepared original example'
                              : 'Recorded live generation'}
                        </dd>
                      </div>
                      <div>
                        <dt>Model</dt>
                        <dd>{artifact.generation.model ?? 'No model call'}</dd>
                      </div>
                      <div>
                        <dt>Provider calls</dt>
                        <dd>{artifact.generation.calls}</dd>
                      </div>
                      <div>
                        <dt>Generation time</dt>
                        <dd>{(artifact.generation.elapsedMs / 1000).toFixed(1)} seconds</dd>
                      </div>
                      <div>
                        <dt>Recorded model cost</dt>
                        <dd>${artifact.generation.costUsd.toFixed(4)}</dd>
                      </div>
                    </dl>
                    {artifact.generation.audit?.length ? (
                      <ol>
                        {artifact.generation.audit.map((item, index) => (
                          <li key={index}>
                            <strong>
                              Call {item.call} · {item.event.replaceAll('-', ' ')}
                            </strong>
                            <p>{item.detail}</p>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p>Original authored material; no runtime model investigation was performed.</p>
                    )}
                    <p className="meta">
                      These are recorded actions and validation facts, not private model reasoning.
                    </p>
                  </details>
                  <div className="exploration-delete">
                    {deleteConfirmation ? (
                      <div role="group" aria-label="Confirm exploration deletion">
                        <p>Delete this exploration and all its saved versions? This cannot be undone.</p>
                        <div className="action-row">
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={sourceBusy}
                            onClick={() => setDeleteConfirmation(false)}
                          >
                            Keep exploration
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            disabled={sourceBusy}
                            onClick={() => void remove()}
                          >
                            Delete all versions
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-button"
                        disabled={sourceBusy || saving}
                        onClick={() => setDeleteConfirmation(true)}
                      >
                        Delete exploration
                      </button>
                    )}
                  </div>
                </JournalMenu>
              </div>
              <ExplorationPipeline
                generation={artifact.generation}
                checked={artifact.validation.assurance.startsWith('checked-')}
                replay={!!artifact.recording}
                family={artifact.spec.mode === 'checked-circuit' ? 'circuit' : 'graph'}
              />
              {artifact.recording && (
                <>
                  <details className="journal-recording-details">
                    <summary>Recorded run details{publicSource?.presentation ? ' · drawing aligned' : ''}</summary>
                    <p className="exploration-recording-note">
                      Recorded {capturedTime(artifact.recording.generatedAt)} · original synthetic
                      source · no new visual generation. Optional narration uses your selected voice.
                    </p>
                    {publicSource?.presentation && (
                      <p className="exploration-recording-note">
                        Replay drawing aligned to source · original recording unchanged.
                      </p>
                    )}
                  </details>
                  {artifact.spec.mode !== 'explanation' && (
                    <div className="journal-recording-switch" role="group" aria-label="Recorded example">
                      <button
                        type="button"
                        aria-pressed={artifact.spec.mode !== 'checked-circuit'}
                        disabled={sourceBusy || busy}
                        onClick={() => void openRecording(false, 'graph')}
                      >Recorded graph</button>
                      <button
                        type="button"
                        aria-pressed={artifact.spec.mode === 'checked-circuit'}
                        disabled={sourceBusy || busy}
                        onClick={() => void openRecording(false, 'circuit')}
                      >Recorded circuit</button>
                    </div>
                  )}
                </>
              )}
              {publicSource?.presentation && !artifact.recording && (
                <p className="exploration-recording-note">
                  Source drawing aligned to its original demo image.
                </p>
              )}
              <h2>{changedSinceExplanation
                ? artifact.spec.mode === 'checked-circuit' ? 'Your circuit experiment' : 'Your graph experiment'
                : artifact.spec.title}</h2>
              {artifact.practiceOrigin && (
                <p className="meta">
                  Fresh practice variation · linked to your original saved exploration.{' '}
                  <button
                    type="button"
                    className="text-button"
                    disabled={busy || sourceBusy}
                    onClick={() =>
                      void resume(
                        artifact.practiceOrigin!.artifactId,
                        artifact.practiceOrigin!.version,
                      )
                    }
                  >
                    Back to original exploration
                  </button>
                </p>
              )}
              {artifact.learningContext && (
                <details className="exploration-prediction-lineage">
                  <summary>
                    Prepared from your{' '}
                    {artifact.learningContext.applicationId ? 'answer' : 'prediction'}:{' '}
                    {artifact.learningContext.choice}
                  </summary>
                  <p>
                    You chose {artifact.learningContext.choice}; the checked result was{' '}
                    {artifact.learningContext.expected}.
                  </p>
                  {artifact.learningContext.reason && (
                    <p>Your explanation: {artifact.learningContext.reason}</p>
                  )}
                  <p className="meta">
                    {artifact.learningContext.applicationId
                      ? 'Fresh practice with the reference available.'
                      : 'Practice with the diagram visible.'}{' '}
                    Original response retained with its source, experiment and model versions.
                  </p>
                </details>
              )}
              <p className="exploration-objective">{changedSinceExplanation
                ? 'The drawing and numbers reflect your changes. Ask Soma to explain this experiment.'
                : artifact.spec.objective}</p>
              {artifact.source.uncertainty.length > 0 && (
                <details className="journal-source-uncertainty">
                  <summary>
                    Source reading: {artifact.source.uncertainty.length}{' '}
                    {artifact.source.uncertainty.length === 1 ? 'uncertainty' : 'uncertainties'}
                  </summary>
                  <ul>{artifact.source.uncertainty.map((item) => <li key={item}>{item}</li>)}</ul>
                </details>
              )}
              {earlierVersion && (
                <p className="exploration-unavailable">
                  You are viewing an earlier version.{' '}
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => void resume(artifact.id)}
                  >
                    Open the latest version
                  </button>{' '}
                  to ask a follow-up.
                </p>
              )}
            </header>
            <span className="journal-gutter" aria-hidden="true" />
            <section className="journal-page journal-right" aria-label="Visual">
              <ExplorationPlayback
                onProgress={(progress, key) =>
                  setSpokenProgress((previous) =>
                    previous?.key === key && previous.progress === progress
                      ? previous
                      : { progress, key },
                  )
                }
                onQuestion={() => {
                  setPlaying(false);
                  questionRef.current?.focus();
                }}
                artifactId={artifact.id}
                version={artifact.version}
                spec={artifact.spec}
                state={state}
                playing={playing}
                onPlaying={setPlaying}
                disabled={busy || sourceBusy || newContext}
                onAdvance={(next) => {
                  viewSequence.current++;
                  setState(next);
                  setDirty(true);
                }}
              />
              <ExplorationScene
                experimentInline={!artifact.experiment}
                playing={playing}
                spokenProgress={
                  spokenProgress?.key === JSON.stringify([artifact.id, artifact.version, state])
                    ? spokenProgress.progress
                    : null
                }
                spec={artifact.spec}
                state={state}
                onChange={updateState}
                circuitObservation={artifact.circuitExperiment?.observe}
                overlay={
                  !newContext &&
                  artifact.source.layout &&
                  sourceMemory.current?.id === artifact.id &&
                  sourceMemory.current.capture.capturedAt === artifact.source.capturedAt
                    ? {
                        image: sourceMemory.current.capture.dataUrl,
                        layout: artifact.source.layout,
                        anchors: artifact.source.anchors,
                        nativeId: sourceMemory.current.capture.nativeId,
                        readingCheck: artifact.source.readingCheck,
                      }
                    : !newContext && artifact.source.layout && publicSource
                      ? {
                          image: publicSource.image,
                          layout: publicSource.presentation?.layout ?? artifact.source.layout,
                          anchors: artifact.source.anchors,
                          readingCheck: artifact.source.readingCheck,
                        }
                      : undefined
                }
                experiment={
                  !newContext && artifact.spec.mode === 'checked-circuit' ? (
                    <>
                      {artifact.circuitExperiment && (
                        <ExplorationCircuitProbe
                          probe={artifact.circuitExperiment}
                          input={artifact.spec.input}
                          state={{
                            open: state.disabledEdgeIds,
                            shorted: [],
                            values: Object.fromEntries(
                              Object.entries(state.edgeWeights ?? {}).filter(([id]) => id !== artifact.circuitExperiment!.componentId),
                            ),
                          }}
                          value={
                            state.edgeWeights?.[artifact.circuitExperiment.componentId] ??
                            artifact.circuitExperiment.originalValue
                          }
                          disabled={sourceBusy}
                          onChange={(value) => {
                            const id = artifact.circuitExperiment!.componentId;
                            const weights = { ...(state.edgeWeights ?? {}), [id]: value };
                            if (artifact.spec.mode === 'checked-circuit' && artifact.spec.input.components.find((c) => c.id === id)?.value === value) delete weights[id];
                            const next = { ...state, edgeWeights: weights, explanationStep: 0 };
                            // Show the checked consequence at once: every node revealed.
                            updateState({ ...next, step: Math.max(0, (circuitSolution(artifact.spec, next)?.steps.length ?? 1) - 1) });
                          }}
                        />
                      )}
                      {(question.trim() || !artifact.circuitExperiment) && (
                        <button
                          type="button"
                          className="secondary-button"
                          title={
                            liveEnabled === false
                              ? 'Investigating needs live generation, which is off here.'
                              : 'Muse picks the part your question is about; Soma computes exactly where it tips.'
                          }
                          disabled={busy || sourceBusy || liveEnabled === false || !!earlierVersion}
                          onClick={() =>
                            void ask(
                              question.trim() ||
                                'Choose the one part whose value most changes what this circuit does, and find exactly where it tips.',
                              undefined,
                              true,
                            )
                          }
                        >
                          {question.trim() ? 'Investigate my question' : 'Find the tipping point'}
                        </button>
                      )}
                    </>
                  ) : !newContext &&
                  artifact.spec.mode === 'checked-dijkstra' && (
                    <>
                      {artifact.experiment ? (
                        <ExplorationCostProbe
                          probe={artifact.experiment}
                          input={{
                            ...artifact.spec.input,
                            start: state.start ?? artifact.spec.input.start,
                            goal: state.goal,
                            edges: artifact.spec.input.edges
                              .filter((e) => !state.disabledEdgeIds.includes(e.id))
                              .map((e) =>
                                e.id !== artifact.experiment!.edgeId &&
                                state.edgeWeights?.[e.id] !== undefined
                                  ? { ...e, weight: state.edgeWeights[e.id] }
                                  : e,
                              ),
                            neighborOrder: state.reversed
                              ? [...artifact.spec.input.neighborOrder].reverse()
                              : artifact.spec.input.neighborOrder,
                          }}
                          value={
                            state.edgeWeights?.[artifact.experiment.edgeId] ??
                            artifact.spec.input.edges.find(
                              (e) => e.id === artifact.experiment!.edgeId,
                            )?.weight ??
                            1
                          }
                          disabled={sourceBusy}
                          onChange={(value) =>
                            updateState({
                              ...state,
                              // Show the checked consequence at once: the completed search.
                              step: Math.max(
                                0,
                                (explorationExecution(artifact.spec, {
                                  ...state,
                                  edgeWeights: {
                                    ...(state.edgeWeights ?? {}),
                                    [artifact.experiment!.edgeId]: value,
                                  },
                                })?.steps.length ?? 1) - 1,
                              ),
                              explanationStep: 0,
                              edgeWeights: {
                                ...(state.edgeWeights ?? {}),
                                [artifact.experiment!.edgeId]: value,
                              },
                            })
                          }
                        />
                      ) : null}
                      {(question.trim() || !artifact.experiment) && (
                        <button
                          type="button"
                          className="secondary-button"
                          title={
                            liveEnabled === false
                              ? 'Investigating needs live generation, which is off here.'
                              : !state.goal
                                ? 'Choose a goal to investigate route costs.'
                                : question.trim()
                                  ? 'Muse picks the connection your question is about; Soma computes exactly where the route changes.'
                                  : undefined
                          }
                          disabled={
                            busy ||
                            sourceBusy ||
                            liveEnabled === false ||
                            !!earlierVersion ||
                            !state.goal
                          }
                          onClick={() =>
                            void ask(
                              question.trim() ||
                                'Choose an informative connection and investigate where fewest edges and lowest cost agree or diverge. Use the checked intervention results to explain the boundary, preserve the original graph and expose a hypothetical cost control.',
                              undefined,
                              true,
                            )
                          }
                        >
                          {question.trim() ? 'Investigate my question' : 'Find the tipping point'}
                        </button>
                      )}
                    </>
                  )
                }
              />
            </section>
            <section className="journal-page journal-left journal-left-body" aria-label="Notes">
              <ExplorationJournalLog
                spec={artifact.spec}
                state={state}
                provenance={
                  artifact.recording
                    ? 'recorded'
                    : artifact.generation.mode === 'prepared-example'
                      ? 'prepared'
                      : 'muse'
                }
              />
              {versionHistory}
              <ExplorationSourceGrounding
                key={JSON.stringify(artifact.spec.sources)}
                capture={
                  source?.capturedAt === artifact.source.capturedAt
                    ? source
                    : sourceMemory.current?.capture.capturedAt === artifact.source.capturedAt
                      ? sourceMemory.current.capture
                      : undefined
                }
                anchors={artifact.source.anchors ?? []}
                change={artifact.source.change}
                previous={
                  comparisonCapture?.currentCapturedAt === artifact.source.capturedAt
                    ? comparisonCapture.previous
                    : undefined
                }
                activeIds={
                  artifact.spec.mode === 'clarify'
                    ? []
                    : (artifact.spec.steps[state?.explanationStep ?? 0]?.sourceHighlightIds ?? [])
                }
              />
              {!newContext && (
                <ExplorationPredictionCard
                  key={JSON.stringify([artifact.id, artifact.version, state])}
                  artifactId={artifact.id}
                  version={artifact.version}
                  spec={artifact.spec}
                  state={state}
                  history={predictionHistory}
                  canAdapt={liveEnabled !== false}
                  disabled={busy || sourceBusy || playing || !!earlierVersion}
                  onPause={() => setPlaying(false)}
                  onAdapt={(id) =>
                    void ask(
                      'Use my recorded prediction and explanation to build a targeted visual that helps me investigate this step. Preserve this experiment and distinguish a possible misunderstanding from a confirmed diagnosis.',
                      id,
                    )
                  }
                />
              )}
              {!newContext &&
                artifact.saved &&
                !dirty &&
                !artifact.practiceOrigin &&
                (artifact.spec.mode === 'checked-bfs' ||
                  artifact.spec.mode === 'checked-dijkstra') && (
                  <ExplorationApplicationCard
                    key={artifact.id + '-' + artifact.version}
                    artifactId={artifact.id}
                    version={artifact.version}
                    history={applicationHistory.filter(
                      (item) =>
                        item.artifactId === artifact.id && item.version === artifact.version,
                    )}
                    disabled={busy || sourceBusy || playing}
                    canAdapt={liveEnabled !== false}
                    onPause={() => setPlaying(false)}
                    onOpen={async (applicationId, explain) => {
                      const sequence = ++loadSequence.current,
                        beforeView = viewSequence.current;
                      setSourceBusy(true);
                      try {
                        const result = await api('POST', {
                          action: 'application',
                          id: applicationId,
                          artifactId: artifact.id,
                          version: artifact.version,
                          operation: 'explore',
                        });
                        if (sequence !== loadSequence.current || beforeView !== viewSequence.current)
                          return;
                        if (!result.artifact) throw new Error('Could not open the fresh example.');
                        flushSync(() => {
                          apply(result.artifact!);
                          setNewContext(false);
                          setSource(null);
                          setApplicationHistory([]);
                          setSourceBusy(false);
                        });
                        const card = document.getElementById('exploration-card');
                        card?.focus({ preventScroll: true });
                        card?.scrollIntoView({
                          block: 'start',
                          behavior: 'instant',
                        });
                        if (explain)
                          await ask(
                            'Use my recorded fresh-problem answer and explanation to choose a useful visual contrast. Explain the checked result on this practice graph, preserve its inputs, and distinguish this hypothetical variation from the original source. Do not diagnose mastery or a confirmed misconception.',
                            undefined,
                            false,
                            { artifact: result.artifact, applicationId },
                          );
                        else
                          setNotice(
                            'Fresh practice graph opened. Soma computed this starting visual without a new model call.',
                          );
                      } finally {
                        if (sequence === loadSequence.current) setSourceBusy(false);
                      }
                    }}
                  />
                )}
              {artifact.spec.mode !== 'clarify' && artifact.spec.followups.length > 0 && (
                <div className="exploration-followups" aria-label="Suggested follow-ups">
                  {artifact.spec.followups.slice(0, 2).map((item) => (
                    <button
                      type="button"
                      key={item}
                      disabled={busy || newContext}
                      onClick={() => {
                        setPlaying(false);
                        setQuestion(item);
                        questionRef.current?.focus();
                      }}
                    >
                      {item}
                      <ArrowUpRight size={14} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              )}
            </section>
          </article>
        ) : busy ? null : (
          <section className="journal-page journal-cover" aria-labelledby="journal-cover-title">
            <p className="overline">Your study journal</p>
            <h1 id="journal-cover-title">Point Soma at something you’re studying.</h1>
            <p className="journal-cover-lede">
              Turn graphs and DC circuits into checked experiments. Other topics get visual
              explanations.
            </p>
            {library}
            <div className="journal-cover-entry">
              {(source || capture.sharing) && sourcePanel}
              <section className="journal-cover-examples" aria-labelledby="journal-examples-title">
                <h2 id="journal-examples-title" className="journal-cover-subhead">Try an example</h2>
                {examples}
                <p className="meta">Original demo material · no account needed. Live slides generate only after Ask.</p>
              </section>
              {!source && !capture.sharing && sourcePanel}
            </div>
          </section>
        )}
        {composer}
      </main>
    </div>
  );
}
