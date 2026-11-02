import { z } from 'zod';
import { sceneIdSchema } from './graph-search';

export const DC_MODEL_ID = 'dc-nodal' as const;
export const DC_MODEL_VERSION = 'dc-nodal-v1' as const;

const label = z.string().trim().min(1).max(40);
/** Every component runs from `from` to `to`, and its current is positive when it flows that way.
 * `value` is ohms for a resistor, volts for a voltage source, amperes for a current source. A
 * source's `to` is its positive terminal: a voltage source holds V(to) − V(from) = value, and a
 * current source drives `value` amperes through itself from `from` to `to`. */
export const DC_KINDS = ['resistor', 'voltage-source', 'current-source'] as const;
export const dcComponentSchema = z.strictObject({
  id: sceneIdSchema,
  label,
  kind: z.enum(DC_KINDS),
  from: sceneIdSchema,
  to: sceneIdSchema,
  value: z.number().finite(),
});
export const DC_UNITS = { resistor: 'Ω', 'voltage-source': 'V', 'current-source': 'A' } as const;
/** Allowed magnitudes per kind; resistances must be positive (a wire is a shared node). */
export const dcValueAllowed = (kind: (typeof DC_KINDS)[number], v: number) =>
  Number.isFinite(v) && (kind === 'resistor' ? v > 0 && v <= 1e9 : Math.abs(v) <= (kind === 'voltage-source' ? 1e5 : 1e3));
export const dcInputSchema = z
  .strictObject({
    nodes: z.array(z.strictObject({ id: sceneIdSchema, label })).min(2).max(10),
    ground: sceneIdSchema,
    components: z.array(dcComponentSchema).min(2).max(16),
  })
  .superRefine((input, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: 'custom', message });
    const nodeIds = new Set(input.nodes.map((n) => n.id)),
      ids = new Set(nodeIds);
    if (nodeIds.size !== input.nodes.length) issue('Node IDs must be unique.');
    if (!nodeIds.has(input.ground)) issue('Ground must name a circuit node.');
    for (const c of input.components) {
      if (ids.has(c.id)) issue('Object IDs must be unique.');
      ids.add(c.id);
      if (!nodeIds.has(c.from) || !nodeIds.has(c.to)) issue('Component terminals must name circuit nodes.');
      if (c.from === c.to) issue('A component must join two different nodes.');
      if (!dcValueAllowed(c.kind, c.value)) issue(`${c.label} has an unsupported value.`);
    }
    if (!input.components.some((c) => c.kind !== 'resistor')) issue('The circuit needs a source.');
    if (islands(input.nodes.map((n) => n.id), input.components).some((island) => !island.includes(input.ground)))
      issue('Every node must connect to the rest of the circuit.');
  });
export type DcInput = z.infer<typeof dcInputSchema>;
export type DcComponent = DcInput['components'][number];
/** An experiment on the circuit as read: components removed (open) or replaced by a wire
 * (shorted), and values changed. Never stored in the input, so the reading stays as read. */
export type DcState = { open: string[]; shorted: string[]; values: Record<string, number> };
export const emptyDcState = (): DcState => ({ open: [], shorted: [], values: {} });
export type DcStep = {
  index: number;
  /** The node whose voltage this step reveals; null for the opening step (ground only). */
  node: string | null;
  revealedNodes: string[];
  /** Components whose current is known once both of their ends are revealed. */
  revealedComponents: string[];
  status: 'ready' | 'solving' | 'complete';
};
export type DcSolution = {
  modelId: typeof DC_MODEL_ID;
  modelVersion: typeof DC_MODEL_VERSION;
  input: DcInput;
  state: DcState;
  status: 'solved' | 'unsolvable';
  reason: string | null;
  /** Volts above ground; null for a node cut off from ground. */
  voltages: Record<string, number | null>;
  /** Amperes from `from` to `to` through each component; 0 when open. */
  currents: Record<string, number>;
  /** V(from) − V(to); defined even on a floating island. */
  drops: Record<string, number>;
  /** Watts absorbed (negative means the component delivers power). */
  power: Record<string, number>;
  exact: { voltages: Record<string, string | null>; currents: Record<string, string> };
  /** Independent exact checks on the solution: Kirchhoff's current law at every node, every
   * source's terminal voltage, and absorbed power summing to zero. */
  checks: { kcl: boolean; sources: boolean; power: boolean };
  steps: DcStep[];
};

// Exact rational arithmetic, so "computed" means exact: 12 V across 4 Ω and 8 Ω is 1 A, not 0.9999.
type Q = { n: bigint; d: bigint };
const gcd = (a: bigint, b: bigint): bigint => {
  if (a < 0n) a = -a;
  if (b < 0n) b = -b;
  while (b) [a, b] = [b, a % b];
  return a;
};
const q = (n: bigint, d = 1n): Q => {
  if (d === 0n) throw new Error('Division by zero.');
  if (d < 0n) [n, d] = [-n, -d];
  const g = gcd(n, d) || 1n;
  return { n: n / g, d: d / g };
};
const ZERO = q(0n),
  ONE = q(1n);
const add = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
const sub = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
const mul = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
const div = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
const isZero = (a: Q) => a.n === 0n;
const eq = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
const bits = (v: bigint) => (v < 0n ? -v : v).toString(2).length;
const toNumber = (a: Q) => {
  const shift = Math.max(bits(a.n), bits(a.d)) - 1000;
  return shift > 0 ? Number(a.n >> BigInt(shift)) / Number(a.d >> BigInt(shift)) : Number(a.n) / Number(a.d);
};
const toText = (a: Q) => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);
/** The decimal a number prints as, exactly: 0.1 is 1/10, not the nearest binary fraction. */
export function exactDecimal(x: number): Q {
  if (!Number.isFinite(x)) throw new Error('Values must be finite.');
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:e([+-]\d+))?$/.exec(String(x));
  if (!m) throw new Error('Unreadable value.');
  const [, sign, whole, frac = '', exp = '0'] = m;
  const scale = Number(exp) - frac.length,
    digits = BigInt(`${sign}${whole}${frac}`);
  return scale >= 0 ? q(digits * 10n ** BigInt(scale)) : q(digits, 10n ** BigInt(-scale));
}

/** Connected groups of nodes over the given components. */
function islands(nodeIds: string[], components: { from: string; to: string }[]) {
  const parent = new Map(nodeIds.map((id) => [id, id]));
  const find = (id: string): string => {
    const p = parent.get(id)!;
    if (p === id) return id;
    const root = find(p);
    parent.set(id, root);
    return root;
  };
  for (const c of components)
    if (parent.has(c.from) && parent.has(c.to)) parent.set(find(c.from), find(c.to));
  const groups = new Map<string, string[]>();
  for (const id of nodeIds) groups.set(find(id), [...(groups.get(find(id)) ?? []), id]);
  return [...groups.values()];
}

/** Exact Gauss–Jordan elimination; null when the system has no unique solution. */
function solveLinear(A: Q[][], b: Q[]): Q[] | null {
  const n = b.length,
    M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    const pivot = M.findIndex((row, r) => r >= col && !isZero(row[col]));
    if (pivot < 0) return null;
    [M[col], M[pivot]] = [M[pivot], M[col]];
    for (let r = 0; r < n; r++) {
      if (r === col || isZero(M[r][col])) continue;
      const f = div(M[r][col], M[col][col]);
      for (let c = col; c <= n; c++) M[r][c] = sub(M[r][c], mul(f, M[col][c]));
    }
  }
  return M.map((row, i) => div(row[n], row[i]));
}

type ExactSolution = {
  potentials: Map<string, Q>;
  grounded: Set<string>;
  currents: Map<string, Q>;
  value: (c: DcComponent) => Q;
};
const asRead = (c: DcComponent) => c.value;
/** Modified nodal analysis. Unknowns are node potentials (one reference per connected island,
 * ground for its own island) and the current through every voltage source or shorted part.
 * `exactValues` overrides values with exact fractions, for tipping points such as 20/3 Ω. */
function solveExact(input: DcInput, state: DcState, exactValues = new Map<string, Q>()): ExactSolution | null {
  const open = new Set(state.open),
    shorted = new Set(state.shorted);
  const active = input.components.filter((c) => !open.has(c.id));
  const value = (c: DcComponent) => exactValues.get(c.id) ?? exactDecimal(state.values[c.id] ?? asRead(c));
  const groups = islands(input.nodes.map((n) => n.id), active);
  const references = new Set(groups.map((g) => (g.includes(input.ground) ? input.ground : g[0])));
  const unknownNodes = input.nodes.map((n) => n.id).filter((id) => !references.has(id));
  const branches = active.filter((c) => c.kind === 'voltage-source' || shorted.has(c.id));
  const size = unknownNodes.length + branches.length;
  const index = new Map(unknownNodes.map((id, i) => [id, i]));
  const A = Array.from({ length: size }, () => Array.from({ length: size }, () => ZERO)),
    b = Array.from({ length: size }, () => ZERO);
  const addAt = (row: number | undefined, col: number | undefined, v: Q) => {
    if (row !== undefined && col !== undefined) A[row][col] = add(A[row][col], v);
  };
  for (const c of active) {
    const i = index.get(c.from),
      j = index.get(c.to);
    if (c.kind === 'resistor' && !shorted.has(c.id)) {
      const g = div(ONE, value(c));
      addAt(i, i, g);
      addAt(j, j, g);
      addAt(i, j, q(-g.n, g.d));
      addAt(j, i, q(-g.n, g.d));
    } else if (c.kind === 'current-source' && !shorted.has(c.id)) {
      const current = value(c);
      if (i !== undefined) b[i] = sub(b[i], current);
      if (j !== undefined) b[j] = add(b[j], current);
    }
  }
  branches.forEach((c, k) => {
    const row = unknownNodes.length + k,
      i = index.get(c.from),
      j = index.get(c.to);
    // The branch current leaves `from` and enters `to`.
    addAt(i, row, ONE);
    addAt(j, row, q(-1n));
    addAt(row, j, ONE);
    addAt(row, i, q(-1n));
    b[row] = c.kind === 'voltage-source' && !shorted.has(c.id) ? value(c) : ZERO;
  });
  const x = size ? solveLinear(A, b) : [];
  if (!x) return null;
  const potentials = new Map<string, Q>(input.nodes.map((n) => [n.id, index.has(n.id) ? x[index.get(n.id)!] : ZERO]));
  const grounded = new Set(groups.find((g) => g.includes(input.ground)) ?? []);
  const currents = new Map<string, Q>();
  for (const c of input.components) {
    if (open.has(c.id)) currents.set(c.id, ZERO);
    else if (branches.includes(c)) currents.set(c.id, x[unknownNodes.length + branches.indexOf(c)]);
    else if (c.kind === 'current-source') currents.set(c.id, value(c));
    else currents.set(c.id, div(sub(potentials.get(c.from)!, potentials.get(c.to)!), value(c)));
  }
  return { potentials, grounded, currents, value };
}

function sanitizeState(input: DcInput, raw: Partial<DcState> | undefined): DcState {
  const ids = new Set(input.components.map((c) => c.id));
  const state: DcState = {
    open: [...new Set(raw?.open ?? [])].filter((id) => ids.has(id)),
    shorted: [...new Set(raw?.shorted ?? [])].filter((id) => ids.has(id)),
    values: {},
  };
  for (const [id, v] of Object.entries(raw?.values ?? {})) {
    const c = input.components.find((x) => x.id === id);
    if (c && dcValueAllowed(c.kind, v)) state.values[id] = v;
  }
  return state;
}

/** Solve the circuit as read, or under an experiment. Pure and deterministic. */
export function solveDc(raw: unknown, rawState?: Partial<DcState>): DcSolution {
  const input = dcInputSchema.parse(raw),
    state = sanitizeState(input, rawState);
  const exact = solveExact(input, state);
  const base = { modelId: DC_MODEL_ID, modelVersion: DC_MODEL_VERSION, input, state } as const;
  if (!exact)
    return {
      ...base,
      status: 'unsolvable',
      reason:
        'No single answer exists: an ideal source is shorted or left with no path for its current.',
      voltages: {},
      currents: {},
      drops: {},
      power: {},
      exact: { voltages: {}, currents: {} },
      checks: { kcl: false, sources: false, power: false },
      steps: [],
    };
  const { potentials, grounded, currents, value } = exact;
  const drop = (c: DcComponent) => sub(potentials.get(c.from)!, potentials.get(c.to)!);
  const open = new Set(state.open),
    shorted = new Set(state.shorted);
  const kcl = input.nodes.every((n) =>
    isZero(
      input.components.reduce(
        (sum, c) => (c.from === n.id ? add(sum, currents.get(c.id)!) : c.to === n.id ? sub(sum, currents.get(c.id)!) : sum),
        ZERO,
      ),
    ),
  );
  const sources = input.components.every((c) => {
    if (open.has(c.id)) return true;
    if (shorted.has(c.id)) return isZero(drop(c));
    if (c.kind !== 'voltage-source') return true;
    return eq(sub(ZERO, drop(c)), value(c));
  });
  const absorbed = new Map(input.components.map((c) => [c.id, mul(drop(c), currents.get(c.id)!)]));
  const power = isZero([...absorbed.values()].reduce(add, ZERO));
  const voltages: Record<string, number | null> = {},
    exactVoltages: Record<string, string | null> = {};
  for (const n of input.nodes) {
    const v = grounded.has(n.id) ? potentials.get(n.id)! : null;
    voltages[n.id] = v && toNumber(v);
    exactVoltages[n.id] = v && toText(v);
  }
  const record = <T>(f: (c: DcComponent) => T) => Object.fromEntries(input.components.map((c) => [c.id, f(c)]));
  return {
    ...base,
    status: 'solved',
    reason: null,
    voltages,
    currents: record((c) => toNumber(currents.get(c.id)!)),
    drops: record((c) => toNumber(drop(c))),
    power: record((c) => toNumber(absorbed.get(c.id)!)),
    exact: { voltages: exactVoltages, currents: record((c) => toText(currents.get(c.id)!)) },
    checks: { kcl, sources, power },
    steps: revealSteps(input, potentials, grounded),
  };
}

/** Ground first, then one node per step from the highest potential down, so current is seen
 * running downhill; a component's current appears once both of its ends are known. Nodes cut
 * off from ground come last. */
function revealSteps(input: DcInput, potentials: Map<string, Q>, grounded: Set<string>): DcStep[] {
  const order = input.nodes
    .map((n, i) => ({ id: n.id, i }))
    .filter((n) => n.id !== input.ground)
    .sort((a, b) => {
      const ga = grounded.has(a.id),
        gb = grounded.has(b.id);
      if (ga !== gb) return ga ? -1 : 1;
      const d = sub(potentials.get(b.id)!, potentials.get(a.id)!);
      return ga && !isZero(d) ? (d.n > 0n ? 1 : -1) : a.i - b.i;
    })
    .map((n) => n.id);
  const revealed = [input.ground];
  const known = () => input.components.filter((c) => revealed.includes(c.from) && revealed.includes(c.to)).map((c) => c.id);
  const steps: DcStep[] = [
    { index: 0, node: null, revealedNodes: [...revealed], revealedComponents: known(), status: order.length ? 'ready' : 'complete' },
  ];
  for (const id of order) {
    revealed.push(id);
    steps.push({
      index: steps.length,
      node: id,
      revealedNodes: [...revealed],
      revealedComponents: known(),
      status: revealed.length === input.nodes.length ? 'complete' : 'solving',
    });
  }
  return steps;
}

export type DcObservation =
  | { kind: 'current'; componentId: string }
  | { kind: 'voltage'; nodeId: string }
  | { kind: 'power'; componentId: string };
export type DcProbe = {
  version: 'dc-probe-v1';
  /** The component whose value is varied. */
  componentId: string;
  observe: DcObservation;
  condition: 'zero' | 'maximum-power' | { equals: number };
  originalValue: number;
  /** The exact value at which the condition holds; null when no allowed value does. */
  criticalValue: number | null;
  criticalExact: string | null;
  /** The circuit re-solved at the critical value meets the condition exactly. */
  verified: boolean;
  /** Muse's one-sentence reason for choosing this component for the learner's question. */
  rationale: string | null;
  note: string;
  cases: { value: number; observed: number }[];
};

const observe = (s: DcSolution, o: DcObservation) =>
  o.kind === 'voltage' ? s.voltages[o.nodeId] : o.kind === 'current' ? s.currents[o.componentId] : s.power[o.componentId];
function observeExact(input: DcInput, state: DcState, o: DcObservation, exactValues?: Map<string, Q>): Q | null {
  const exact = solveExact(input, state, exactValues);
  if (!exact) return null;
  if (o.kind === 'voltage') return exact.grounded.has(o.nodeId) ? exact.potentials.get(o.nodeId)! : null;
  const current = exact.currents.get(o.componentId)!;
  if (o.kind === 'current') return current;
  const c = input.components.find((x) => x.id === o.componentId)!;
  return mul(sub(exact.potentials.get(c.from)!, exact.potentials.get(c.to)!), current);
}

/** Exact tipping point for one component's value. Any current or voltage in a linear circuit is
 * a ratio (α + βp)/(γ + δp) of the varied value p, so three exact solves fix it; the answer is
 * then re-solved from scratch and must meet the condition exactly to count as verified. */
export function probeDcValue(
  raw: unknown,
  rawState: Partial<DcState> | undefined,
  componentId: string,
  observation: DcObservation,
  condition: DcProbe['condition'],
  rationale: string | null = null,
): DcProbe {
  const input = dcInputSchema.parse(raw),
    state = sanitizeState(input, rawState);
  const component = input.components.find((c) => c.id === componentId);
  if (!component || state.open.includes(componentId) || state.shorted.includes(componentId))
    throw new Error('Choose a connected component to vary.');
  const observedId = observation.kind === 'voltage' ? observation.nodeId : observation.componentId;
  if (!(observation.kind === 'voltage' ? input.nodes : input.components).some((x) => x.id === observedId))
    throw new Error('Observe a part of this circuit.');
  if (
    condition === 'maximum-power' &&
    !(observation.kind === 'power' && observation.componentId === componentId && component.kind === 'resistor')
  )
    throw new Error('Maximum power applies to the varied resistor itself.');
  if (observation.kind === 'power' && typeof condition === 'object')
    throw new Error('Ask for power to vanish or peak; ask about a current or voltage reaching a value.');
  const resistor = component.kind === 'resistor';
  const unit = DC_UNITS[component.kind];
  const originalValue = state.values[componentId] ?? asRead(component);
  const allowed = (p: Q) => (!resistor || p.n > 0n) && dcValueAllowed(component.kind, toNumber(p));
  const at = (p: Q) => new Map([[componentId, p]]);
  const name = (id: string) =>
    input.components.find((c) => c.id === id)?.label ?? input.nodes.find((n) => n.id === id)?.label ?? id;
  const quantity =
    observation.kind === 'voltage'
      ? `the voltage at ${name(observation.nodeId)}`
      : `the ${observation.kind} in ${name(observation.componentId)}`;
  const Quantity = quantity[0].toUpperCase() + quantity.slice(1);
  // Power is the current squared times the resistance, so fit the current and reason from it.
  const fitted: DcObservation =
    observation.kind === 'power' ? { kind: 'current', componentId: observation.componentId } : observation;
  const p0 = exactDecimal(originalValue);
  const samples = resistor ? [p0, mul(p0, q(2n)), div(p0, q(2n))] : [p0, add(p0, ONE), add(p0, q(2n))];
  const ys = samples.map((p) => observeExact(input, state, fitted, at(p)));
  let critical: Q | null = null,
    note = '';
  if (ys.some((y) => y === null)) note = `${Quantity} has no defined value here.`;
  else {
    const fit = fitRatio(samples, ys as Q[]);
    if (!fit) note = `${Quantity} does not depend on ${name(componentId)}.`;
    else if (condition === 'maximum-power')
      // The resistor's own current is α/(γ + δR), so I²R peaks where R matches the rest: R = γ/δ.
      critical = isZero(fit.delta) || !isZero(fit.beta) ? null : div(fit.gamma, fit.delta);
    else {
      const target = condition === 'zero' ? ZERO : exactDecimal(condition.equals);
      const denominator = sub(fit.beta, mul(target, fit.delta));
      critical = isZero(denominator) ? null : div(sub(mul(target, fit.gamma), fit.alpha), denominator);
    }
    if (critical && !allowed(critical)) critical = null;
  }
  let verified = false;
  if (critical) {
    const check = observeExact(input, state, observation, at(critical));
    if (check)
      verified =
        condition === 'maximum-power'
          ? [mul(critical, q(99n, 100n)), mul(critical, q(101n, 100n))].every((p) => {
              const nearby = observeExact(input, state, observation, at(p));
              return nearby !== null && sub(check, nearby).n > 0n;
            })
          : eq(check, condition === 'zero' ? ZERO : exactDecimal(condition.equals));
  }
  const criticalValue = critical ? Number(toNumber(critical).toPrecision(12)) : null;
  if (!note) {
    const v = criticalValue !== null ? `${trim(criticalValue)} ${unit}` : null;
    note =
      condition === 'maximum-power'
        ? v
          ? `${name(componentId)} takes the most power at ${v}, where it matches the resistance of the rest of the circuit.`
          : `No resistance for ${name(componentId)} gives it a power peak.`
        : condition === 'zero'
          ? v
            ? `${Quantity} is exactly zero when ${name(componentId)} is ${v}${observation.kind === 'power' ? '' : '; on either side it has opposite signs'}.`
            : `No allowed value of ${name(componentId)} makes ${quantity} zero.`
          : v
            ? `${Quantity} is exactly ${trim(condition.equals)} when ${name(componentId)} is ${v}.`
            : `No allowed value of ${name(componentId)} makes ${quantity} equal ${trim(condition.equals)}.`;
  }
  const around = criticalValue ?? originalValue;
  const values = [originalValue, ...(resistor ? [around / 2, around, around * 2] : [around - 1, around, around + 1])];
  const cases = [...new Set(values.map((v) => Number(v.toPrecision(12))))]
    .filter((v) => (resistor ? v > 0 && v <= 1e9 : Number.isFinite(v)))
    .sort((a, b) => a - b)
    .map((value) => {
      const p = value === criticalValue && critical ? critical : exactDecimal(value);
      const y = observeExact(input, state, observation, at(p));
      return { value, observed: y === null ? NaN : toNumber(y) };
    });
  return {
    version: 'dc-probe-v1',
    componentId,
    observe: observation,
    condition,
    originalValue,
    criticalValue,
    criticalExact: critical && toText(critical),
    verified,
    rationale,
    note,
    cases,
  };
}
const trim = (v: number) => `${Number(v.toPrecision(6))}`;

/** Coefficients of y = (α + βp)/(γ + δp) through three exact points, or null when y is constant.
 * Each point gives α + βp − γy − δyp = 0, a 3×4 system whose null space is one-dimensional. */
function fitRatio(ps: Q[], ys: Q[]) {
  if (ys.every((y) => eq(y, ys[0]))) return null;
  const M = ps.map((p, i) => [ONE, p, sub(ZERO, ys[i]), sub(ZERO, mul(ys[i], p))]);
  const pivots: number[] = [];
  for (let c = 0, r = 0; c < 4 && r < 3; c++) {
    const p = M.findIndex((row, i) => i >= r && !isZero(row[c]));
    if (p < 0) continue;
    [M[r], M[p]] = [M[p], M[r]];
    for (let i = 0; i < 3; i++) {
      if (i === r || isZero(M[i][c])) continue;
      const f = div(M[i][c], M[r][c]);
      for (let k = c; k < 4; k++) M[i][k] = sub(M[i][k], mul(f, M[r][k]));
    }
    pivots.push(c);
    r++;
  }
  const free = [0, 1, 2, 3].filter((c) => !pivots.includes(c));
  if (free.length !== 1) return null;
  const x = [ZERO, ZERO, ZERO, ZERO];
  x[free[0]] = ONE;
  pivots.forEach((c, i) => (x[c] = sub(ZERO, div(M[i][free[0]], M[i][c]))));
  const [alpha, beta, gamma, delta] = x;
  return { alpha, beta, gamma, delta };
}
