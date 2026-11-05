import { z } from 'zod';
import { DC_MODEL_ID, DC_MODEL_VERSION, type DcInput, type DcSolution } from '../domain/dc-circuit';
import type { ExplorationSpec } from '../domain/exploration';

const unit = z.number().finite().min(0).max(1);
/** Where the source drew the circuit, as Spark reads it: one point on each node's wire and
 * each part's two ends. Presentation only; the solver never sees coordinates. */
export const circuitLayoutReadSchema = z.strictObject({
  nodes: z.array(z.strictObject({ nodeId: z.string().min(1).max(48), x: unit, y: unit })).max(10),
  components: z
    .array(
      z.strictObject({
        componentId: z.string().min(1).max(48),
        x1: unit,
        y1: unit,
        x2: unit,
        y2: unit,
      }),
    )
    .max(16),
});
export type CircuitLayoutRead = z.infer<typeof circuitLayoutReadSchema>;

export const CIRCUIT_READING =
  ' For a DC circuit drawn with resistors and ideal batteries or current sources whose values are all legible, set graph to JSON null and return circuit. Its nodes are the electrically distinct junctions: every stretch of wire joined without a component between is ONE node. Use the node letters the source prints, else N1, N2 and so on. ground is the node the source marks as ground or 0 V, else the negative terminal of the main battery. components lists every resistor (value in ohms), voltage source (value in volts; to is its + terminal, the longer plate) and current source (value in amperes; to is where its arrow points), each joining two different nodes, with the label the source prints. Convert kΩ, mA and similar to base units. Never invent or assume a value: if any value is unreadable, set circuit to JSON null and say which in uncertainty. Capacitors, inductors, diodes, transistors, switches and AC sources are not supported: set circuit to JSON null for them. With a circuit, also return circuitLayout in normalized top-left image coordinates: one point on each node’s wire (its junction dot when one is drawn) and each component’s two ends as drawn. Otherwise circuit and circuitLayout are JSON null.';

const text = z.string().trim().min(1).max(360);
/** Muse writes the words; the application binds them to the solved circuit. */
export function circuitCopySchema(input: DcInput, solution: DcSolution) {
  const ids = [...input.nodes.map((n) => n.id), ...input.components.map((c) => c.id)] as [
    string,
    ...string[],
  ];
  return z.strictObject({
    title: z.string().trim().min(1).max(100),
    objective: text,
    assumptions: z.array(text).max(3),
    steps: z
      .array(
        z.strictObject({
          traceIndex: z
            .number()
            .int()
            .min(0)
            .max(Math.max(0, solution.steps.length - 1)),
          caption: text,
          narration: text,
          highlightIds: z.array(z.enum(ids)).max(12),
        }),
      )
      .min(1)
      .max(6),
    followups: z.array(text).max(3),
  });
}
export type CircuitCopy = z.infer<ReturnType<typeof circuitCopySchema>>;

export const CIRCUIT_COMPOSE =
  ' A DC circuit was read from the learner’s source and solved exactly by Soma’s own nodal-analysis solver: checkedCircuit. Author only the words for the checked circuit visual using compose_circuit: title, objective, at most three assumptions, one to six steps and up to three followups. The application binds the circuit, layout, controls and computation. Each step has a traceIndex into checkedCircuit.steps: step 0 shows only ground at 0 V; each later step reveals one node (steps[k].node), from the highest voltage down, plus the currents of steps[k].revealedComponents. A caption may state only what is known at its traceIndex. Every number must be one checkedCircuit gives (voltages, currents, drops, power, component values) or the source prints; never do your own arithmetic, round differently or estimate. currents[id] > 0 means current flows through the component from its from node to its to node; say the direction with node labels. A current of 0 means no current. When state.disabledEdgeIds or state.edgeWeights are supplied, those parts are opened or changed by the learner’s experiment and checkedCircuit already reflects them; say so as a hypothetical change, never as a source fact. If experimentNote is supplied, the learner’s experiment could not be solved and checkedCircuit is the circuit as read: say that plainly and explain the circuit as read. When circuitExperiment is supplied, Muse chose it and Soma computed it exactly: componentId is the part whose value varies, observe is what is watched, criticalValue is the exact value at which the condition holds (verified means Soma re-solved the circuit there and the condition held exactly), and cases are checked samples on either side. Explain where and why it tips, as a hypothetical change to that one part; never compute your own values, and if criticalValue is null, say no allowed value meets the condition, as the note says. Answer the learner’s question by the final step. Use visible labels in learner-facing words; never mention IDs, tool names or schema fields. highlightIds name the nodes and components each step is about. followups are short questions the learner could ask next, such as opening a part or changing a value. No mastery claims.';

/** A checked circuit spec assembled by the application from the reading, the solution and
 * Muse's copy. Positions for the diagram view come from where the source drew each node. */
export function circuitSpec({
  id,
  version,
  observationId,
  sourceVersion,
  input,
  layout,
  copy,
  uncertainty,
  writtenFor = null,
}: {
  id: string;
  version: number;
  observationId: string;
  sourceVersion: number;
  input: DcInput;
  layout: CircuitLayoutRead | null | undefined;
  copy: CircuitCopy;
  uncertainty: string[];
  /** The learner's experiment, when the words explain one rather than the circuit as read. */
  writtenFor?: { open: string[]; values: Record<string, number> } | null;
}): ExplorationSpec {
  const placed = input.nodes.every((n) => layout?.nodes.some((p) => p.nodeId === n.id));
  const positions = input.nodes.map((n, i) => {
    const p = placed ? layout!.nodes.find((x) => x.nodeId === n.id)! : null;
    const angle = (i / input.nodes.length) * Math.PI * 2 - Math.PI / 2;
    return {
      nodeId: n.id,
      x: p ? p.x : 0.5 + 0.38 * Math.cos(angle),
      y: p ? p.y : 0.5 + 0.38 * Math.sin(angle),
    };
  });
  const taken = new Set([
    ...input.nodes.map((n) => n.id),
    ...input.components.map((c) => c.id),
    'circuit-primary',
    'circuit-steps',
  ]);
  return {
    schemaVersion: 'exploration-v1',
    id,
    version,
    mode: 'checked-circuit',
    modelId: DC_MODEL_ID,
    modelVersion: DC_MODEL_VERSION,
    title: copy.title,
    objective: copy.objective,
    sources: [{ observationId, version: sourceVersion, region: null }],
    assumptions: [
      'Wires and sources are ideal; every resistor follows Ohm’s law.',
      ...copy.assumptions,
    ].slice(0, 6),
    uncertainty: uncertainty.slice(0, 6),
    unsupportedClaims: [
      'Soma solves resistors and ideal DC sources only; capacitors, diodes and changing currents are not modeled.',
    ],
    input,
    ...(writtenFor ? { writtenFor } : {}),
    scene: {
      layout: 'diagram-sidebar',
      panels: [
        {
          id: 'circuit-primary',
          kind: 'circuit',
          title: 'Checked circuit',
          execution: 'primary',
          placement: { column: 1, row: 1, columnSpan: 2 },
          positions,
        },
        {
          id: 'circuit-steps',
          kind: 'steps',
          title: 'Step by step',
          placement: { column: 1, row: 2, columnSpan: 2 },
        },
      ],
    },
    steps: copy.steps.map((item, index) => {
      let stepId = `circuit_${version}_${index}`;
      while (taken.has(stepId)) stepId += 'x';
      taken.add(stepId);
      return {
        id: stepId,
        caption: item.caption,
        narration: item.narration,
        highlightIds: item.highlightIds,
        execution: 'primary' as const,
        executionStep: item.traceIndex,
      };
    }),
    controls: ['step', 'replay', 'open-component', 'set-value'],
    followups: copy.followups,
  };
}
