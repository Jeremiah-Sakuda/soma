'use client';
import { DC_UNITS, probeDcValue, solveDc, type DcInput, type DcProbe, type DcState } from '@/lib/domain/dc-circuit';
import { circuitQuantity } from '@/lib/domain/exploration-view';

/** Muse chose one part of the circuit; Soma computed exactly where the watched quantity tips.
 * The slider varies only that part, and every reading below it is re-solved from scratch. */
export function ExplorationCircuitProbe({
  probe,
  input,
  state,
  value,
  disabled,
  onChange,
}: {
  probe: DcProbe;
  input: DcInput;
  /** The learner's other changes; the varied part's own value is `value`. */
  state: DcState;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const part = input.components.find((c) => c.id === probe.componentId);
  if (!part || state.open.includes(part.id))
    return <p className="meta">Reconnect the part this experiment varies to resume it.</p>;
  // Recompute under the current experiment: other opened parts or values change the answer.
  let current = probe;
  try {
    current = probeDcValue(input, state, probe.componentId, probe.observe, probe.condition, probe.rationale);
  } catch {
    // Keep the saved result if the current experiment makes the probe unavailable.
  }
  const unit = DC_UNITS[part.kind];
  const name = (id: string) =>
    input.components.find((c) => c.id === id)?.label ?? input.nodes.find((n) => n.id === id)?.label ?? id;
  const watched =
    current.observe.kind === 'voltage'
      ? `the voltage at ${name(current.observe.nodeId)}`
      : `the ${current.observe.kind} in ${name(current.observe.componentId)}`;
  const critical = current.criticalValue;
  const resistor = part.kind === 'resistor';
  const top = resistor
    ? Math.max(part.value, critical ?? 0, ...current.cases.map((c) => c.value)) * 1.6
    : Math.max(Math.abs(part.value), Math.abs(critical ?? 0), 1) * 2;
  const bottom = resistor ? Math.min(part.value, critical ?? part.value) / 20 : -top;
  const solved = solveDc(input, { ...state, values: { ...state.values, [part.id]: value } });
  const reading = (() => {
    if (solved.status !== 'solved') return solved.reason ?? 'No single solution at this value.';
    const o = current.observe;
    if (o.kind === 'voltage') {
      const v = solved.voltages[o.nodeId];
      return v === null ? `${name(o.nodeId)} is cut off from ground.` : `Voltage at ${name(o.nodeId)}: ${circuitQuantity(v, 'V')}`;
    }
    const c = input.components.find((x) => x.id === o.componentId)!;
    if (o.kind === 'power') return `Power in ${c.label}: ${circuitQuantity(solved.power[c.id], 'W')}`;
    const i = solved.currents[c.id];
    // A tipping point that is not a terminating decimal leaves only rounding residue here.
    if (Math.abs(i) < 1e-9) return `Current in ${c.label}: ${i === 0 ? 'exactly ' : ''}0 A`;
    const [a, b] = i > 0 ? [c.from, c.to] : [c.to, c.from];
    return `Current in ${c.label}: ${circuitQuantity(Math.abs(i), 'A')}, from ${name(a)} to ${name(b)}`;
  })();
  const nudge = (direction: number, big: boolean) => {
    const step = resistor ? Math.max(value * (big ? 0.1 : 0.01), 1e-6) : big ? 1 : 0.1;
    const next = Number((value + direction * step).toPrecision(10));
    onChange(Math.min(top, Math.max(bottom, next)));
  };
  return (
    <section className="exploration-cost-probe" aria-label="Checked circuit experiment">
      <span className="overline">Muse chose the experiment · Soma computed it</span>
      <h3>
        {current.condition === 'maximum-power'
          ? `When does ${part.label} take the most power?`
          : `When does ${watched} ${current.observe.kind === 'power' ? 'vanish' : 'reach zero'}?`}
      </h3>
      {current.rationale && (
        <p className="exploration-cost-probe-why">
          <strong>Why {part.label}:</strong> {current.rationale}
        </p>
      )}
      <p>Change only {part.label}. Soma re-solves the whole circuit at every value.</p>
      <label htmlFor="circuit-probe-value">
        {part.label}: <strong>{Number(value.toPrecision(4))} {unit}</strong>
      </label>
      <input
        id="circuit-probe-value"
        type="range"
        min={bottom}
        max={top}
        step="any"
        value={value}
        disabled={disabled}
        onKeyDown={(e) => {
          if (['ArrowLeft', 'ArrowDown', 'ArrowRight', 'ArrowUp'].includes(e.key)) {
            e.preventDefault();
            nudge(e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : 1, e.shiftKey);
          }
        }}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <p role="status">
        <strong>{reading}</strong>
      </p>
      {critical !== null && (
        <button type="button" className="secondary-button" disabled={disabled} onClick={() => onChange(critical)}>
          Try the tipping point at {Number(critical.toPrecision(6))} {unit}
        </button>
      )}
      <p>{current.note}</p>
      {current.verified && critical !== null && (
        <p className="meta">
          Verified: Soma re-solved the circuit with {part.label} at exactly {current.criticalExact} {unit}, and the
          condition held exactly.
        </p>
      )}
      <p className="meta">Hypothetical change to this captured circuit. Your source is unchanged.</p>
    </section>
  );
}
