'use client';

import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import SpatialWorkspace from './spatial-workspace';
import { spatialScene, supportsSpatial } from '@/lib/domain/spatial-exploration';
import { clearOfInk, liftFocus, liftRegion, liftScene, sceneOverlayModel, type InkGrid } from '@/lib/domain/scene-lift';
import { defaultSpatialView } from '@/lib/domain/spatial-schema';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { ExplorationSearchStage } from './exploration-search-stage';
import { SourceOverlay, type SourceGraphLayout } from './source-overlay';
import { ExplorationCircuitStage } from './exploration-circuit-stage';
import type { SourceOverlayModel } from '@/lib/domain/source-overlay-model';
import type { SourceAnchor } from '@/lib/domain/source-grounding';
import { useExplorationMotion } from './exploration-motion';
import { diagramRoutes, pointOnDiagramRoute } from '@/lib/domain/diagram-routing';
import { diagramLayout, diagramEdgeLabels } from '@/lib/domain/exploration-layout';
import { routeCost } from '@/lib/domain/cost-probe';
import type { DcObservation } from '@/lib/domain/dc-circuit';
import { beatProgress } from '@/lib/domain/exploration-motion';
import {
  runBfs,
  type BfsInput,
  type BfsExecution,
  type BfsStep,
  type ExplorationPanel,
  type ExplorationSpec,
} from '@/lib/domain/exploration';

export {
  initialExplorationState,
  explorationExecution,
  explorationInputsChanged,
  explorationVisibleCaption,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';
import {
  comparisonExecution,
  graphExperimentActive,
  explorationExecution,
  explorationInputsChanged,
  explorationStepCaption,
  explorationVisibleCaption,
  type ExplorationViewState,
} from '@/lib/domain/exploration-view';
import { defaultGraphControls } from '@/lib/domain/graph-state';
const nodeName = (input: BfsInput, id: string | null) =>
  input.nodes.find((node) => node.id === id)?.label ?? 'None';

function DiagramPanel({
  panel,
  selected,
  onSelect,
  highlights,
  progress,
}: {
  panel: Extract<ExplorationPanel, { kind: 'diagram' }>;
  selected: string | null;
  onSelect: (id: string) => void;
  highlights: string[];
  progress: number;
}) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const container = useRef<HTMLDivElement>(null);
  const [availableWidth, setAvailableWidth] = useState<number | undefined>(undefined);
  useEffect(() => {
    const observer = new ResizeObserver((entries) =>
      setAvailableWidth(entries[0].contentRect.width),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  const layout = useMemo(
    () => diagramLayout(panel, compact, availableWidth),
    [panel, compact, availableWidth],
  );
  const routes = useMemo(() => diagramRoutes(panel, layout), [panel, layout]);
  const edgeLabels = useMemo(
    () => diagramEdgeLabels(panel, layout, routes),
    [panel, layout, routes],
  );
  const markerId = useId().replace(/[^a-z0-9]/gi, '');
  const nodes = panel.objects.filter(
    (object) => object.kind === 'node' || object.kind === 'block',
  );
  const pos = (id: string) => layout.positions.find((node) => node.id === id)!;
  return (
    <div ref={container} className="exploration-diagram-container">
      <svg
        className="exploration-graph"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        data-diagram-progress={progress.toFixed(3)}
        role="img"
        aria-label={`${panel.title}. Select labeled objects below to ask a follow-up.`}
      >
        <defs>
          <marker
            id={markerId}
            viewBox="0 0 10 10"
            refX="10"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
          </marker>
        </defs>
        {panel.objects
          .filter((object) => object.kind === 'edge')
          .map((edge) => {
            const from = pos(edge.from),
              loop = edge.from === edge.to;
            const route = routes.find((r) => r.id === edge.id);
            const signal = pointOnDiagramRoute(
              route?.points ?? [],
              beatProgress(progress, 0.08, 0.92),
            );
            return (
              <g key={edge.id}>
                <path
                  fill="none"
                  data-diagram-edge={edge.id}
                  className={`exploration-edge ${highlights.includes(edge.id) ? 'is-highlighted' : ''}`}
                  d={
                    loop
                      ? `M ${from.x - 32} ${from.y - 34} C ${from.x - 85} ${from.y - 82},${from.x + 85} ${from.y - 82},${from.x + 32} ${from.y - 34}`
                      : (route?.d ?? '')
                  }
                  markerEnd={edge.directed ? `url(#${markerId})` : undefined}
                />
                {highlights.includes(edge.id) && progress > 0 && progress < 1 && !loop && (
                  <circle
                    data-diagram-signal={edge.id}
                    cx={signal.x}
                    cy={signal.y}
                    r="5"
                    fill="var(--accent)"
                  />
                )}
              </g>
            );
          })}
        {edgeLabels
          .filter((label) => !label.legend)
          .map((label) => (
            <g key={label.id} data-diagram-label={label.id}>
              <rect
                x={label.x - label.width / 2}
                y={label.y - 12}
                width={label.width}
                height="24"
                rx="7"
                fill="var(--surface)"
                stroke="var(--border)"
              />
              <text x={label.x} y={label.y} textAnchor="middle" dominantBaseline="central">
                {label.text}
              </text>
            </g>
          ))}
        {nodes.map((node) => {
          const point = pos(node.id);
          return (
            <g
              key={node.id}
              opacity="1"
              transform={`translate(${point.x},${point.y})`}
              className={`exploration-node ${selected === node.id || highlights.includes(node.id) ? 'is-selected' : ''}`}
              onClick={() => onSelect(node.id)}
            >
              {node.kind === 'block' ? (
                <rect
                  x={-layout.cardWidth / 2}
                  y={-layout.cardHeight / 2}
                  width={layout.cardWidth}
                  height={layout.cardHeight}
                  rx="10"
                />
              ) : (
                <ellipse rx={layout.cardWidth / 2} ry={layout.cardHeight / 2} />
              )}
              <foreignObject
                x={-layout.cardWidth / 2 + 6}
                y={-layout.cardHeight / 2 + 6}
                width={layout.cardWidth - 12}
                height={layout.cardHeight - 12}
              >
                <div className="exploration-diagram-label">{node.label}</div>
              </foreignObject>
            </g>
          );
        })}
        {layout.notes.map((object) => (
          <foreignObject
            key={object.id}
            x="20"
            y={object.y}
            width={layout.width - 40}
            height={object.height}
          >
            <div className="exploration-diagram-note">{object.text}</div>
          </foreignObject>
        ))}
      </svg>
      {edgeLabels.some((label) => label.legend) && (
        <ul className="exploration-diagram-label-legend" aria-label="Diagram connection labels">
          {edgeLabels
            .filter((label) => label.legend)
            .map((label) => {
              const edge = panel.objects.find((o) => o.id === label.id);
              return (
                <li key={label.id}>
                  {edge?.kind === 'edge'
                    ? nodes.find((n) => n.id === edge.from)?.label +
                      (edge.directed ? ' → ' : ' — ') +
                      nodes.find((n) => n.id === edge.to)?.label +
                      ': '
                    : ''}
                  {label.text}
                </li>
              );
            })}
        </ul>
      )}
      <details className="exploration-diagram-inspector">
        <summary>Inspect diagram</summary>
        <div className="exploration-object-buttons" aria-label="Select a diagram object">
          {nodes.map((node) => (
            <button
              type="button"
              key={node.id}
              aria-pressed={selected === node.id}
              onClick={() => onSelect(node.id)}
            >
              {node.label}
            </button>
          ))}
        </div>
        <details>
          <summary>Diagram in words</summary>
          <ul>
            {panel.objects.map((object) => (
              <li key={object.id}>
                {object.kind === 'node' || object.kind === 'block'
                  ? object.label
                  : object.kind === 'text'
                    ? object.text
                    : `${nodes.find((node) => node.id === object.from)?.label} ${object.directed ? 'points to' : 'connects to'} ${nodes.find((node) => node.id === object.to)?.label}${object.label ? `: ${object.label}` : ''}`}
              </li>
            ))}
          </ul>
        </details>
      </details>
    </div>
  );
}

function StateTable({ execution, step }: { execution: BfsExecution; step: BfsStep }) {
  return (
    <div className="exploration-table-scroll">
      <table className="exploration-state-table">
        <caption>State after step {step.index}</caption>
        <thead>
          <tr>
            <th scope="col">Node</th>
            <th scope="col">State</th>
            <th scope="col">Distance</th>
            <th scope="col">Parent</th>
          </tr>
        </thead>
        <tbody>
          {execution.input.nodes.map((node) => (
            <tr key={node.id}>
              <th scope="row">{node.label}</th>
              <td>
                {step.current === node.id
                  ? 'Current'
                  : step.queue.includes(node.id)
                    ? 'In queue'
                    : step.expanded.includes(node.id)
                      ? 'Expanded'
                      : 'Not reached'}
              </td>
              <td>{step.distances[node.id] ?? '—'}</td>
              <td>{nodeName(execution.input, step.parents[node.id] ?? null)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Which cells of a small copy of the capture differ from its commonest colour, its paper. */
function inkGrid(img: HTMLImageElement): InkGrid | null {
  try {
    const width = 512, height = Math.max(8, Math.round((width * img.naturalHeight) / img.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    if (!g) return null;
    g.drawImage(img, 0, 0, width, height);
    const data = g.getImageData(0, 0, width, height).data, counts = new Map<number, number>();
    for (let i = 0; i < data.length; i += 4) {
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const paper = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    const [r, gr, b] = [(paper >> 8) * 17, ((paper >> 4) & 15) * 17, (paper & 15) * 17];
    const ink = new Uint8Array(width * height);
    for (let i = 0; i < ink.length; i++)
      ink[i] = Math.abs(data[i * 4] - r) + Math.abs(data[i * 4 + 1] - gr) + Math.abs(data[i * 4 + 2] - b) > 30 ? 1 : 0;
    return { width, height, ink };
  } catch {
    return null;
  }
}

export function ExplorationScene({
  spec,
  state,
  onChange,
  playing = false,
  spokenProgress = null,
  experiment,
  circuitObservation,
  experimentInline = false,
  overlay,
  onBuildModel,
  modelBusy = false,
  liftRequest = 0,
}: {
  /** Builds a 3D model of an explanation that has none yet (a new version). */
  onBuildModel?: () => Promise<boolean>;
  modelBusy?: boolean;
  /** Counts the companion bar's requests to lift an explanation that has no model yet. */
  liftRequest?: number;
  /** The learner's capture and where it drew the graph; present only while the pixels are in memory. */
  overlay?: {
    image: string;
    /** Where the source drew its graph; absent for answers with no drawing read from the source.
     * A circuit's layout also places each part by its two drawn ends. */
    layout?: SourceGraphLayout & { components?: { componentId: string; x1: number; y1: number; x2: number; y2: number }[] };
    anchors?: SourceAnchor[];
    nativeId?: string;
    /** The learner's pointed or circled area of the capture. */
    focus?: { x: number; y: number; width: number; height: number };
    /** Muse Wonder's independent check of the reading drawn here. */
    readingCheck?: { status: 'confirmed' | 'corrected' | 'disputed'; weighted?: boolean; nodes: number; edges: number; corrections: { edgeId: string; from: number; to: number }[]; disputes: string[] };
  };
  experiment?: ReactNode;
  circuitObservation?: DcObservation;
  experimentInline?: boolean;
  spec: ExplorationSpec;
  state: ExplorationViewState;
  onChange: (next: ExplorationViewState) => void;
  playing?: boolean;
  spokenProgress?: number | null;
}) {
  const [overlayView, setOverlayView] = useState<'source' | 'diagram'>('source');
  // Whether the drawing on screen carries checked distances to lift into 3D.
  const [liftable, setLiftable] = useState(false);
  // Why the companion took the drawing down or kept it flat, when it says.
  const [screenNotice, setScreenNotice] = useState('');
  // In the Mac companion, mirror the same overlay over the real display it was captured from.
  const nativeId = overlay?.nativeId;
  const mirror = useCallback(
    (model: SourceOverlayModel | null) => {
      if (!nativeId) return;
      setLiftable(Boolean(model?.lift || model?.scene));
      window.dispatchEvent(new CustomEvent('soma:screen-overlay', { detail: { id: nativeId, model } }));
    },
    [nativeId],
  );
  // An explanation has no drawing read from the source: the companion gets its 3D scene, to
  // lift off the slide around where the learner pointed.
  const image = overlay?.image,
    focus = overlay?.focus,
    anchors = overlay?.anchors;
  const [aspect, setAspect] = useState<number | null>(null);
  const [ink, setInk] = useState<InkGrid | null>(null);
  useEffect(() => {
    setAspect(null);
    setInk(null);
    if (!nativeId || !image || spec.mode !== 'explanation') return;
    let live = true;
    const img = new Image();
    img.onload = () => {
      if (!live || !img.naturalWidth) return;
      setAspect(img.naturalHeight / img.naturalWidth);
      setInk(inkGrid(img));
    };
    img.src = image;
    return () => {
      live = false;
    };
  }, [image, nativeId, spec.mode]);
  const sceneModel = (() => {
    if (!nativeId || !aspect || spec.mode !== 'explanation') return null;
    const scene = spatialScene(spec, state);
    if (!scene?.objects.length) return null;
    const at = Math.min(state.explanationStep, spec.steps.length - 1);
    return sceneOverlayModel(liftScene(scene, clearOfInk(liftRegion(liftFocus(focus, anchors, spec.steps), aspect), ink), undefined, state.selectedObjectId), {
      text: spec.steps[at].caption,
      stepLabel: `Step ${at + 1} of ${spec.steps.length}`,
    });
  })();
  const sceneKey = spec.mode === 'explanation' ? JSON.stringify(sceneModel) : null;
  useEffect(() => {
    if (sceneKey !== null) mirror(sceneKey === 'null' ? null : (JSON.parse(sceneKey) as SourceOverlayModel));
  }, [sceneKey, mirror]);
  const explaining = spec.mode === 'explanation';
  useEffect(() => (explaining ? () => mirror(null) : undefined), [explaining, mirror]);
  const toggleRef = useRef<(edgeId: string) => void>(() => {});
  const selectRef = useRef<(id: string) => void>(() => {});
  selectRef.current = (id: string) => onChange({ ...state, selectedObjectId: state.selectedObjectId === id ? null : id });
  const [onScreen, setOnScreen] = useState(false);
  // Whether the companion has lifted the on-screen drawing into 3D.
  const [lifted, setLifted] = useState(false);
  const setView = useCallback(
    (view: '2d' | '3d') => window.dispatchEvent(new CustomEvent('soma:screen-overlay-view', { detail: { id: nativeId, view } })),
    [nativeId],
  );
  // Asked to lift before the model existed: lift once it arrives on screen.
  const pendingLift = useRef(false);
  const hasModel = spec.mode === 'explanation' && spec.scene.panels.some((p) => p.kind === 'spatial');
  // The part picked on the model, by name.
  const pickedPart =
    spec.mode === 'explanation'
      ? spec.scene.panels.flatMap((p) => (p.kind === 'spatial' ? p.objects : [])).find((o) => o.id === state.selectedObjectId)?.label
      : undefined;
  // The companion's 3D button on an explanation with no model: build it, then lift it. If no
  // model comes back, the diagram itself stands up, as on the page.
  const seenLiftRequest = useRef(liftRequest);
  useEffect(() => {
    if (liftRequest === seenLiftRequest.current) return;
    seenLiftRequest.current = liftRequest;
    if (hasModel || !onBuildModel || modelBusy) return;
    pendingLift.current = true;
    // No model this time: nothing lifts; the bar says so and 3D can be pressed again.
    void onBuildModel().then((ok) => {
      if (!ok) pendingLift.current = false;
    });
  }, [liftRequest, hasModel, onBuildModel, modelBusy, setView]);
  useEffect(() => {
    if (pendingLift.current && hasModel && liftable && onScreen && !lifted) {
      pendingLift.current = false;
      setView('3d');
    }
  }, [hasModel, liftable, onScreen, lifted, setView]);
  useEffect(() => {
    setOnScreen(false);
    setLifted(false);
    setScreenNotice('');
    if (!nativeId) return;
    const listen = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d?.id !== nativeId) return;
      setOnScreen(d.shown === true);
      setScreenNotice(
        d.reason === 'checking'
          ? 'Checking that your slide is still the same before lifting…'
          : d.reason === 'changed'
          ? 'Your slide changed, so Soma took the drawing off your screen. Capture again to draw on the new one.'
          : d.reason === 'moved'
            ? 'Your screen changed before Soma could draw on it, so the drawing stays here. Ask again to draw on what is there now.'
          : d.reason === 'webgl'
            ? 'This Mac could not draw in 3D, so the drawing stays flat on your slide.'
            : d.reason === 'sheet'
              ? 'Soma could not lift this drawing, so it stays flat on your slide.'
              : '',
      );
      setLifted((was) => (d.shown !== true ? false : d.view === '3d' ? true : d.view === '2d' ? false : was));
    };
    window.addEventListener('soma:screen-overlay-result', listen);
    return () => window.removeEventListener('soma:screen-overlay-result', listen);
  }, [nativeId]);
  useEffect(() => {
    if (!nativeId) return;
    const listen = (event: Event) => {
      const d = (event as CustomEvent).detail;
      if (d?.id === nativeId && d.type === 'toggle-edge' && typeof d.edgeId === 'string') toggleRef.current(d.edgeId);
      // A part picked on the lifted model is selected here too, for the next question.
      if (d?.id === nativeId && d.type === 'select' && typeof d.objectId === 'string') selectRef.current(d.objectId);
    };
    window.addEventListener('soma:screen-overlay-action', listen);
    return () => window.removeEventListener('soma:screen-overlay-action', listen);
  }, [nativeId]);
  const [compact, setCompact] = useState(false),
    [activeGraph, setActiveGraph] = useState<'primary' | 'comparison'>('primary');
  const sceneElement = useRef<HTMLDivElement>(null), revealScene = useRef(false);
  useEffect(() => {
    if (revealScene.current) { revealScene.current = false; sceneElement.current?.scrollIntoView({ block: 'start', behavior: 'instant' }); }
  }, [state.spatial?.mode]);
  useEffect(() => {
    const media = matchMedia('(max-width:760px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  const { selectedObjectId: _selected, spatial: _presentation, ...motionState } = state;
  const motionKey = JSON.stringify([spec.id, spec.version, motionState]);
  const progress = useExplorationMotion(motionKey, playing, spokenProgress);
  const titleControlsKey = JSON.stringify([
    state.start, state.goal, state.disabledEdgeIds, state.reversed, state.edgeWeights,
  ]);
  // Only scientific controls change these titles. Keep the display spec stable
  // during camera/selection/step updates so the spatial canvas can reuse geometry.
  const displaySpec = useMemo(() => {
    if ((spec.mode !== 'checked-bfs' && spec.mode !== 'checked-dijkstra') ||
      !explorationInputsChanged(spec, state)) return spec;
    const primary = explorationExecution(spec, state);
    const secondary = comparisonExecution(spec, state);
    const panels = spec.scene.panels.map((panel) => {
      if (panel.kind !== 'graph' && panel.kind !== 'frontier' && panel.kind !== 'state-table')
        return panel;
      const computed = panel.execution === 'comparison' ? secondary : primary;
      if (!computed) return panel;
      const title = panel.kind === 'graph'
        ? `Current graph: start ${nodeName(computed.input, computed.input.start)}, ${computed.input.goal === null
            ? 'all reachable nodes'
            : `goal ${nodeName(computed.input, computed.input.goal)}`}`
        : panel.kind === 'frontier' ? 'Current frontier' : 'Current node costs';
      return { ...panel, title };
    });
    return { ...spec, scene: { ...spec.scene, panels } };
  }, [spec, titleControlsKey]);
  if (spec.mode === 'clarify')
    return (
      <div className="exploration-clarify">
        <h3>A little more context</h3>
        <p>{spec.question}</p>
      </div>
    );
  if (spec.mode === 'checked-circuit')
    return (
      <ExplorationCircuitStage
        spec={spec}
        state={state}
        onChange={onChange}
        overlay={overlay?.layout ? { ...overlay, layout: overlay.layout } : undefined}
        mirror={mirror}
        onScreen={onScreen}
        screenNotice={screenNotice}
        compact={compact}
        experiment={experiment}
        circuitObservation={circuitObservation}
        toggleRef={toggleRef}
        lift={{ liftable, lifted, toggle: () => setView(lifted ? '2d' : '3d') }}
      />
    );
  const execution = explorationExecution(spec, state),
    comparison = comparisonExecution(spec, state);
  const step = execution?.steps[Math.min(state.step, execution.steps.length - 1)],
    explanation = spec.steps[Math.min(state.explanationStep, spec.steps.length - 1)];
  const changed = explorationInputsChanged(spec, state),
    experimenting = graphExperimentActive(spec, state),
    highlights = changed
      ? []
      : spec.mode === 'explanation'
        ? explanation.highlightIds
        : (spec.steps.find(
            (item) => item.execution !== null && item.executionStep === state.step,
          )?.highlightIds ?? []);
  const authoredStep = !changed
    ? spec.steps.find(
        (item) => item.execution === 'primary' && item.executionStep === state.step,
      )
    : undefined;
  const finalStep = Math.max(execution?.steps.length ?? 1, comparison?.steps.length ?? 1) - 1;
  // The source draws the primary checked snapshot, so its printed/native caption
  // comes from that calculation. Authored explanations stay in the journal;
  // finding their numbers elsewhere in a trace does not establish their meaning.
  const overlayCaption = explorationStepCaption(spec, state);
  const select = (selectedObjectId: string) => onChange({ ...state, selectedObjectId });
  const graphInput =
    spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra' ? spec.input : null;
  const toggleEdge = (edgeId: string) => {
    const next = {
      ...state,
      selectedObjectId: edgeId,
      disabledEdgeIds: state.disabledEdgeIds.includes(edgeId)
        ? state.disabledEdgeIds.filter((id) => id !== edgeId)
        : [...state.disabledEdgeIds, edgeId],
    };
    // Show the checked consequence at once: jump to the completed search.
    const run = explorationExecution(spec, next);
    onChange({ ...next, step: run ? run.steps.length - 1 : 0 });
  };
  toggleRef.current = (edgeId: string) => {
    if (spec.mode !== 'explanation' && spec.controls.includes('toggle-edge') && graphInput?.edges.some((e) => e.id === edgeId))
      toggleEdge(edgeId);
  };
  // After a learner change, the authored captions describe the original graph; say only what was computed.
  const experimentCaption = (() => {
    if (!experimenting || !execution || !graphInput) return null;
    const names = (ids: readonly string[]) => ids.map((id) => nodeName(graphInput, id)).join(' → ');
    const cut = graphInput.edges
      .filter((edge) => state.disabledEdgeIds.includes(edge.id))
      .map((edge) => `${nodeName(graphInput, edge.from)}–${nodeName(graphInput, edge.to)}`);
    const costs = graphInput.edges
      .filter((edge) => {
        const value = state.edgeWeights?.[edge.id];
        return value !== undefined && value !== (edge.weight ?? 1);
      })
      .map(
        (edge) =>
          `${nodeName(graphInput, edge.from)}–${nodeName(graphInput, edge.to)} now costs ${state.edgeWeights![edge.id]} (was ${edge.weight ?? 1})`,
      );
    const lead = [cut.length ? `You cut ${cut.join(', ')}.` : '', costs.length ? `${costs.join('; ')}.` : '']
      .filter(Boolean)
      .map((part) => part + ' ')
      .join('');
    if (!state.goal) return `${lead}The search now reaches ${execution.visitOrder.length} of ${graphInput.nodes.length} nodes.`;
    return execution.path
      ? `${lead}Checked route: ${names(execution.path)}, cost ${routeCost(execution.input, execution.path)}.`
      : `${lead}No route reaches ${nodeName(graphInput, state.goal)} now.`;
  })();
  const panels = displaySpec.mode === 'clarify' ? spec.scene.panels : displaySpec.scene.panels;
  const heroDiagram =
    spec.mode === 'explanation' ? panels.find((panel) => panel.kind === 'diagram') : undefined;
  const graphs = panels.filter((panel) => panel.kind === 'graph');
  const spatialPanel = panels.find((panel) => panel.kind === 'spatial');
  const spatialMode = state.spatial?.mode ?? (spatialPanel ? '3d' : '2d');
  const showSpatial = Boolean(spatialPanel) || spatialMode === '3d';
  // One inspected search at a time; the journal's search log carries the queue and steps.
  const singleSearch =
    showSpatial || compact || spec.mode === 'checked-dijkstra' || spec.mode === 'checked-bfs';
  const graphSummary = (which: 'primary' | 'comparison', computed: BfsExecution) => {
    const current = computed.steps[Math.min(state.step, computed.steps.length - 1)];
    return (
      <button
        type="button"
        aria-pressed={activeGraph === which}
        onClick={() => setActiveGraph(which)}
      >
        <strong>
          {computed.modelId === 'dijkstra-nonnegative' ? 'Dijkstra' : 'BFS'} ·{' '}
          {routeCost(computed.input, computed.path) ?? 'unreachable'}
        </strong>
        <span className="meta">
          {current.status === 'found' ? (
            <span role="status">
              Route: {computed.path?.map((id) => nodeName(computed.input, id)).join(' → ')} ·
              total cost {routeCost(computed.input, computed.path)} ·{' '}
              {computed.path!.length - 1} {computed.path!.length === 2 ? 'edge' : 'edges'}
            </span>
          ) : computed.modelId === 'dijkstra-nonnegative' ? (
            'Full route · lowest cost'
          ) : (
            'Full route · fewest edges'
          )}
        </span>
      </button>
    );
  };
  const experimentRow = Math.max(...graphs.map((panel) => panel.placement.row), 0) + 1;
  const renderPanel = (panel: ExplorationPanel) => {
    const computation =
      panel.kind === 'graph' || panel.kind === 'frontier' || panel.kind === 'state-table'
        ? panel.execution === 'comparison'
          ? comparison
          : execution
        : null;
    const current = computation?.steps[Math.min(state.step, computation.steps.length - 1)];
    const combined =
      panel.kind === 'frontier' && graphs.some((graph) => graph.execution === panel.execution);
    const mainGraph = panel.kind === 'graph' && (graphs.length === 1 || singleSearch);
    return (
      <section
        key={panel.id}
        className={`${combined ? 'sr-only' : ''} exploration-panel exploration-panel-${panel.kind} ${highlights.includes(panel.id) ? 'is-highlighted' : ''}`}
        style={{
          gridColumn:
            mainGraph || panel === heroDiagram
              ? '1 / span 2'
              : `${panel.placement.column} / span ${panel.placement.columnSpan}`,
          gridRow:
            panel === heroDiagram
              ? 'auto'
              : experiment && panel.placement.row >= experimentRow
                ? panel.placement.row + 1
                : panel.placement.row,
        }}
        aria-label={panel.title}
      >
        <h3>{panel.title}</h3>
        {(spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
          ['sequence', 'matrix', 'diagram', 'callout'].includes(panel.kind) && (
            <p className="meta">
              Illustration for this explanation. The search controls update the graph and
              frontier.
            </p>
          )}
        {panel.kind === 'sequence' && (
          <ol className="exploration-tiles" aria-label={panel.title}>
            {panel.items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  aria-pressed={state.selectedObjectId === item.id}
                  className={highlights.includes(item.id) ? 'is-highlighted' : ''}
                  onClick={() => select(item.id)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ol>
        )}
        {panel.kind === 'matrix' && (
          <div className="exploration-table-scroll">
            <table className="exploration-matrix">
              <caption>{panel.title}</caption>
              <tbody>
                {panel.rows.map((row, i) => (
                  <tr key={i}>
                    {row.map((cell, j) => (
                      <td key={j}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {panel.kind === 'callout' && (
          <aside className={`exploration-callout ${panel.tone}`}>
            <span className="overline">
              {panel.tone === 'idea' ? 'Key idea' : 'Assumption'}
            </span>
            <p>{panel.text}</p>
          </aside>
        )}
        {panel.kind === 'graph' && overlay?.layout && graphInput && panel.execution === 'primary' && (
          <div className="source-overlay-switch" role="group" aria-label="Where to draw the search">
            <button type="button" aria-pressed={overlayView === 'source'} onClick={() => setOverlayView('source')}>
              On your source
            </button>
            <button type="button" aria-pressed={overlayView === 'diagram'} onClick={() => setOverlayView('diagram')}>
              Diagram
            </button>
          </div>
        )}
        {panel.kind === 'graph' &&
          computation &&
          (overlay?.layout && graphInput && overlayView === 'source' && panel.execution === 'primary' ? (
            <>
            {overlay.readingCheck && (
              <p className={`source-reading-check is-${overlay.readingCheck.status}`} role="status">
                {overlay.readingCheck.status === 'confirmed'
                  ? `Muse Wonder checked Spark’s reading against your slide and confirmed all ${overlay.readingCheck.nodes} nodes and ${overlay.readingCheck.edges} ${overlay.readingCheck.weighted === false ? 'connections' : 'weights'}.`
                  : overlay.readingCheck.status === 'corrected'
                    ? `Muse Wonder caught ${overlay.readingCheck.corrections.length} misread weight${overlay.readingCheck.corrections.length === 1 ? '' : 's'}; Spark looked again and agreed: ${overlay.readingCheck.corrections
                        .map((c) => {
                          const e = graphInput.edges.find((x) => x.id === c.edgeId);
                          const n = (id?: string) => graphInput.nodes.find((x) => x.id === id)?.label ?? id ?? c.edgeId;
                          return `${n(e?.from)}–${n(e?.to)} is ${c.to}, not ${c.from}`;
                        })
                        .join('; ')}.`
                    : `Check before trusting this route. ${overlay.readingCheck.disputes.join(' ')}`}
              </p>
            )}
            {screenNotice && !(onScreen && lifted) && (
              <p className="source-overlay-onscreen" role="status">
                {screenNotice}
              </p>
            )}
            {onScreen && (
              <div className="source-overlay-onscreen">
                <p role="status">
                  {lifted
                    ? 'Lifted off your slide in 3D: height is the checked distance from the start, and the shortest routes pull their strings taut.'
                    : `Drawn on your screen, over the window you captured.${spec.mode !== 'explanation' && spec.controls.includes('toggle-edge') ? ' Click a connection there to cut it;' : ''}`}{' '}
                  Esc hides it.
                </p>
                {/* Outside the live region, so its name is not re-announced with each status. */}
                {spec.mode !== 'explanation' && liftable && (
                  <button
                    type="button"
                    className="source-overlay-lift"
                    aria-pressed={lifted}
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent('soma:screen-overlay-view', { detail: { id: nativeId, view: lifted ? '2d' : '3d' } }),
                      )
                    }
                  >
                    Lift into 3D
                  </button>
                )}
              </div>
            )}
            <SourceOverlay
              image={overlay.image}
              layout={overlay.layout!}
              graph={graphInput}
              execution={computation}
              index={state.step}
              disabledEdgeIds={state.disabledEdgeIds}
              weights={state.edgeWeights}
              canToggle={spec.mode !== 'explanation' && spec.controls.includes('toggle-edge')}
              selected={state.selectedObjectId}
              caption={experimentCaption ?? overlayCaption}
              stepLabel={
                experimentCaption
                  ? 'Your experiment'
                  : `Round ${Math.min(state.step, finalStep) + 1} of ${finalStep + 1}`
              }
              obstacles={(overlay.anchors ?? []).map((a) => a.region)}
              onModel={mirror}
              onToggleEdge={toggleEdge}
              onSelect={select}
              compact={onScreen}
            />
            </>
          ) : (
            <ExplorationSearchStage
              progress={state.step >= computation.steps.length ? 1 : progress}
              panel={panel}
              execution={computation}
              index={state.step}
              selected={state.selectedObjectId}
              onSelect={select}
              highlights={highlights}
            />
          ))}
        {panel.kind === 'diagram' && (
          <DiagramPanel
            progress={progress}
            panel={panel}
            selected={state.selectedObjectId}
            onSelect={select}
            highlights={highlights}
          />
        )}
        {panel.kind === 'frontier' && computation && current && (
          <>
            <p className="meta">
              {computation.modelId === 'dijkstra-nonnegative'
                ? 'Lowest tentative cost first'
                : 'First in → first out'}
            </p>
            <ol className="exploration-frontier" aria-label={`${panel.title} queue`}>
              {current.queue.map((id, index) => (
                <li key={id}>
                  <span>{index === 0 ? 'Next' : index + 1}</span>
                  <strong>{nodeName(computation.input, id)}</strong>
                </li>
              ))}
            </ol>
            {!current.queue.length && <p>Queue empty</p>}
          </>
        )}
        {panel.kind === 'state-table' &&
          computation &&
          current &&
          (experiment ? (
            <details>
              <summary>Inspect checked node costs</summary>
              <StateTable execution={computation} step={current} />
            </details>
          ) : (
            <StateTable execution={computation} step={current} />
          ))}
        {panel.kind === 'text' && <p>{panel.text}</p>}
        {panel.kind === 'steps' &&
          (changed ? (
            <p>
              The inputs changed. The queue and captions now show the recomputed search; the
              original authored steps are paused.
            </p>
          ) : (
            <ol className="exploration-explanation-steps">
              {spec.steps.map((item, index) => (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-current={state.explanationStep === index ? 'step' : undefined}
                    onClick={() =>
                      onChange({
                        ...state,
                        explanationStep: index,
                        ...(item.executionStep !== null ? { step: item.executionStep } : {}),
                      })
                    }
                  >
                    {item.caption}
                  </button>
                </li>
              ))}
            </ol>
          ))}
      </section>
    );
  };
  return (
    <>

      {spec.mode === 'explanation' && (onScreen || screenNotice) && (
        <div className="source-overlay-onscreen">
          <p role="status">
            {screenNotice && !(onScreen && lifted)
              ? screenNotice
              : lifted
                ? `Lifted off your slide as a 3D model. ${pickedPart ? `${pickedPart} is selected: your next question is about it.` : 'Drag it to turn it, click a part to ask about it, double-click to set the view back.'} Esc hides it.`
                : 'On your screen, over the window you captured. Esc hides it.'}
          </p>
          {onScreen && (liftable || !spatialPanel) && onBuildModel !== undefined && (
            <button
              type="button"
              className="source-overlay-lift"
              aria-pressed={lifted}
              disabled={modelBusy}
              onClick={() => {
                if (spatialPanel) setView(lifted ? '2d' : '3d');
                else {
                  pendingLift.current = true;
                  void onBuildModel().then((ok) => {
                    if (!ok) pendingLift.current = false;
                  });
                }
              }}
            >
              {modelBusy ? 'Building the 3D model…' : 'Lift into 3D'}
            </button>
          )}
        </div>
      )}
      {spec.mode === 'explanation' && (
        <div className="exploration-explanation-navigation">
          <div className="exploration-step-bar">
            <div className="action-row">
              <button
                type="button"
                className="secondary-button"
                disabled={state.explanationStep === 0}
                onClick={() =>
                  onChange({
                    ...state,
                    explanationStep: state.explanationStep - 1,
                  })
                }
              >
                <ChevronLeft size={16} aria-hidden="true" /> Previous explanation
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={state.explanationStep >= spec.steps.length - 1}
                onClick={() =>
                  onChange({
                    ...state,
                    explanationStep: state.explanationStep + 1,
                  })
                }
              >
                Next explanation <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
          <p
            className="exploration-active-explanation"
            role="status"
            aria-live={playing ? 'off' : 'polite'}
          >
            <span className="overline">
              Explanation {state.explanationStep + 1} of {spec.steps.length}
            </span>
            {spec.steps[state.explanationStep].narration ||
              spec.steps[state.explanationStep].caption}
          </p>
        </div>
      )}
      {(spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') &&
        execution &&
        spec.controls.includes('step') && (
          <div className="exploration-step-bar">
            <div className="action-row">
              <button
                className="secondary-button"
                type="button"
                disabled={state.step <= 0}
                onClick={() => onChange({ ...state, step: Math.max(0, state.step - 1) })}
              >
                <ChevronLeft size={16} aria-hidden="true" /> Previous step
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={state.step >= finalStep}
                onClick={() => onChange({ ...state, step: state.step + 1 })}
              >
                Next step <ChevronRight size={16} aria-hidden="true" />
              </button>
              <span className="meta journal-page-number">
                Step {Math.min(state.step, finalStep)} / {finalStep}
              </span>
              {singleSearch && experimentInline && experiment}
            </div>
          </div>
        )}
      {singleSearch && execution && comparison && (
        <div className="exploration-comparison-switch" aria-label="Choose search to inspect">
          {graphSummary('primary', execution)}
          {graphSummary('comparison', comparison)}
        </div>
      )}
      <div
        ref={sceneElement}
        className={`exploration-scene exploration-layout-${spec.scene.layout}`}
        aria-label="Generated visual composition"
      >
        {showSpatial ? (
          <>
            <SpatialWorkspace
              spec={displaySpec}
              state={state}
              onChange={onChange}
              which={comparison ? activeGraph : 'primary'}
            />
            {experiment && !experimentInline && <div className="exploration-experiment-slot">{experiment}</div>}
            {panels.some((p) => !['graph', 'frontier', 'diagram', 'spatial'].includes(p.kind)) && <details className="exploration-supporting-panels">
              <summary>Steps, numbers & context</summary>
              <div className="exploration-scene">{panels.filter((p) => !['graph', 'frontier', 'diagram', 'spatial'].includes(p.kind)).map(renderPanel)}</div>
            </details>}
          </>
        ) : heroDiagram ? (
          <>
            {renderPanel(heroDiagram)}
            <details className="exploration-supporting-panels">
              <summary>Steps, numbers & context</summary>
              <div className="exploration-scene">
                {panels.filter((panel) => panel !== heroDiagram).map(renderPanel)}
              </div>
            </details>
          </>
        ) : singleSearch && execution ? (
          <>
            {graphs
              .filter((panel) => panel.execution === (comparison ? activeGraph : 'primary'))
              .map(renderPanel)}
            {/* The inspected search's queue stays available as text. */}
            {panels
              .filter(
                (panel) =>
                  panel.kind === 'frontier' &&
                  panel.execution === (comparison ? activeGraph : 'primary') &&
                  execution.modelId !== 'dijkstra-nonnegative',
              )
              .map(renderPanel)}
            {experiment && !experimentInline && (
              <div className="exploration-experiment-slot">{experiment}</div>
            )}
            <details className="exploration-scene-details">
              <summary>Explanation & checked state</summary>
              <div className="exploration-scene">
                {panels
                  .filter((panel) => panel.kind !== 'graph' && panel.kind !== 'frontier')
                  .map(renderPanel)}
              </div>
            </details>
          </>
        ) : experiment ? (
          <>
            {graphs.map(renderPanel)}
            <div
              className="exploration-experiment-slot"
              style={{ gridColumn: '1 / -1', gridRow: experimentRow }}
            >
              {experiment}
            </div>
            {panels.filter((panel) => panel.kind !== 'graph').map(renderPanel)}
          </>
        ) : (
          panels.map(renderPanel)
        )}
      </div>
      {spec.mode === 'explanation' && !spatialPanel && onBuildModel && (
        <div className="spatial-mode-switch" role="group" aria-label="Visual representation">
          <button type="button" className="spatial-build" disabled={modelBusy} onClick={() => { revealScene.current = true; void onBuildModel(); }}>
            {modelBusy ? 'Building the 3D model…' : 'See it in 3D'}
          </button>
        </div>
      )}
      {supportsSpatial(spec) && (spec.mode !== 'explanation' || spatialPanel || !onBuildModel) && <div className="spatial-mode-switch" role="group" aria-label="Visual representation">
        <button type="button" aria-pressed={spatialMode === '2d'} onClick={() => { revealScene.current = spatialMode !== '2d'; onChange({ ...state, spatial: { ...(state.spatial ?? defaultSpatialView()), mode: '2d' } }); }}>2D view</button>
        <button type="button" aria-pressed={spatialMode === '3d'} onClick={() => { revealScene.current = spatialMode !== '3d'; onChange({ ...state, spatial: { ...(state.spatial ?? defaultSpatialView()), mode: '3d' } }); }}>3D workspace</button>
      </div>}
      {execution && (
        <div className="exploration-caption" aria-live="polite">
          <span className="overline">
            {execution
              ? `Search step ${step?.index ?? 0}`
              : `Explanation ${state.explanationStep + 1} of ${spec.steps.length}`}
          </span>
          <p>{explorationVisibleCaption(spec, state)}</p>
          {authoredStep && (
            <p className="exploration-authored-caption">
              Soma’s explanation: {authoredStep.caption}
            </p>
          )}
        </div>
      )}
      {(spec.mode === 'checked-bfs' || spec.mode === 'checked-dijkstra') && execution && (
        <details className="exploration-controls-disclosure" open={!compact}>
          <summary>Change the experiment</summary>
          <div className="exploration-controls" aria-label="Search controls">
            <div className="exploration-inputs">
              {spec.controls.includes('set-start') && (
                <label>
                  Start node
                  <select
                    value={state.start ?? spec.input.start}
                    onChange={(event) =>
                      onChange({
                        ...state,
                        start: event.target.value,
                        step: 0,
                      })
                    }
                  >
                    {spec.input.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {spec.controls.includes('set-goal') && (
                <label>
                  Goal node
                  <select
                    value={state.goal ?? ''}
                    onChange={(event) =>
                      onChange({
                        ...state,
                        goal: event.target.value || null,
                        step: 0,
                      })
                    }
                  >
                    <option value="">Explore every reachable node</option>
                    {spec.input.nodes.map((node) => (
                      <option key={node.id} value={node.id}>
                        {node.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            {spec.controls.includes('reverse-neighbor-order') && (
              <button
                className="secondary-button"
                type="button"
                aria-pressed={state.reversed}
                onClick={() => onChange({ ...state, reversed: !state.reversed, step: 0 })}
              >
                Reverse neighbor order
              </button>
            )}
            {spec.controls.includes('toggle-edge') && (
              <details>
                <summary>Change a connection</summary>
                <p className="meta">Recomputes this experiment. Your source stays unchanged.</p>
                <div className="exploration-edge-controls">
                  {spec.input.edges.map((edge) => (
                    <label key={edge.id}>
                      <input
                        type="checkbox"
                        checked={!state.disabledEdgeIds.includes(edge.id)}
                        onChange={() =>
                          onChange({
                            ...state,
                            step: 0,
                            disabledEdgeIds: state.disabledEdgeIds.includes(edge.id)
                              ? state.disabledEdgeIds.filter((id) => id !== edge.id)
                              : [...state.disabledEdgeIds, edge.id],
                          })
                        }
                      />
                      {nodeName(spec.input, edge.from)} {spec.input.directed ? '→' : '—'}{' '}
                      {nodeName(spec.input, edge.to)}
                    </label>
                  ))}
                </div>
              </details>
            )}
            {experimenting && (
              <button
                type="button"
                className="secondary-button"
                onClick={() => onChange({
                  ...state,
                  ...defaultGraphControls(spec.input),
                  step: 0,
                  explanationStep: 0,
                  selectedObjectId: null,
                })}
              >
                Back to the graph as read
              </button>
            )}
            <details>
              <summary>Search state in a table</summary>
              <StateTable execution={execution} step={step!} />
            </details>
            <p className="meta">
              {spec.mode === 'checked-dijkstra'
                ? 'Nonnegative weighted graph · settle lowest tentative cost · stop when goal is settled.'
                : 'Unweighted graph · visited when added to queue · stop when goal leaves queue.'}
            </p>
          </div>
        </details>
      )}
    </>
  );
}
