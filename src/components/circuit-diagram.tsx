import type { CircuitInput, CircuitOutput } from '@/lib/domain/types';

const number = (value: number) => Number(value.toFixed(3)).toString();

type FlowStyle = React.CSSProperties & { '--flow-duration'?: string };
/** Dot speed is proportional to the model's current; no current, no motion. */
function Wire({ current }: { current?: number }) {
  if (current === undefined || current <= 0) return <span className="wire" />;
  const style: FlowStyle = { '--flow-duration': `${Math.min(12, Math.max(0.35, 2 / current)).toFixed(2)}s` };
  return <span className="wire flow" style={style} />;
}

/** Visual scales reflect the declared 0–24 V, 1–100 Ω model ranges, not new physics. */
function MeasurementBar({ value, maximum, label, voltage = false }: {
  value: number; maximum: number; label: string; voltage?: boolean;
}) {
  return <div className={`measurement-bar ${voltage ? 'voltage-bar' : ''}`}>
    <span className="bar-track"><span style={{ width: `${Math.min(100, Math.max(0, value / maximum * 100))}%` }} /></span>
    <span>{label}</span>
  </div>;
}

export function CircuitDiagram({ inputs, result, compact = false }: {
  inputs: CircuitInput; result?: CircuitOutput; compact?: boolean;
}) {
  const parallel = inputs.topology === 'parallel';
  const description = `${parallel ? 'Parallel' : 'Series'} circuit. ${inputs.voltage} volt ideal source. Resistors ${inputs.r1} and ${inputs.r2} ohms.${result ? ` First resistor: ${number(result.current1)} amperes, ${number(result.voltage1)} volts. Second resistor: ${number(result.current2)} amperes, ${number(result.voltage2)} volts. Total current ${number(result.totalCurrent)} amperes.` : ''}`;

  return <div className={`circuit-diagram ${compact ? 'compact' : ''}`} role="img" aria-label={description}>
    {parallel ? <div className="parallel-mechanism">
      <div className="source-symbol"><strong>{inputs.voltage} V</strong><span>source</span></div>
      <div className="node-rail" />
      <div className="parallel-branches">
        {([1, 2] as const).map(branch => {
          const resistance = branch === 1 ? inputs.r1 : inputs.r2;
          const current = branch === 1 ? result?.current1 : result?.current2;
          const voltage = branch === 1 ? result?.voltage1 : result?.voltage2;
          return <div className="circuit-branch" key={branch}>
            <div className="wire-and-resistor"><Wire current={current} /><strong className="resistor-chip">R{branch === 1 ? '₁' : '₂'} · {resistance} Ω</strong><Wire current={current} /></div>
            {current !== undefined && voltage !== undefined && <MeasurementBar value={current} maximum={24} label={`I${branch === 1 ? '₁' : '₂'} ${number(current)} A · ${number(voltage)} V`} />}
          </div>;
        })}
      </div>
      <div className="node-rail" />
    </div> : <div className="series-mechanism">
      <div className="series-path"><div className="source-symbol"><strong>{inputs.voltage} V</strong><span>source</span></div><Wire current={result?.totalCurrent} /><strong className="resistor-chip">R₁ · {inputs.r1} Ω</strong><Wire current={result?.totalCurrent} /><strong className="resistor-chip">R₂ · {inputs.r2} Ω</strong><Wire current={result?.totalCurrent} /></div>
      {result && <div className="series-measurements"><MeasurementBar value={result.totalCurrent} maximum={24} label={`${number(result.totalCurrent)} A everywhere`} /><MeasurementBar value={result.voltage1} maximum={24} label={`R₁ voltage drop · ${number(result.voltage1)} V`} voltage /><MeasurementBar value={result.voltage2} maximum={24} label={`R₂ voltage drop · ${number(result.voltage2)} V`} voltage /></div>}
    </div>}
    <p className="mechanism-caption">{parallel ? `Both resistors share the same two nodes, so each has ${inputs.voltage} V across it.` : 'One path, no branches: the same current passes through both resistors; the voltage divides.'}</p>
  </div>;
}

export function ModelTable({ inputs, result }: { inputs: CircuitInput; result: CircuitOutput }) {
  return <div className="table-scroll" tabIndex={0} role="region" aria-label="Circuit values, horizontally scrollable on small screens"><table className="model-table">
    <caption>Same model, as numbers</caption>
    <thead><tr><th scope="col">Part</th><th scope="col">Resistance</th><th scope="col">Voltage across</th><th scope="col">Current</th></tr></thead>
    <tbody><tr><th scope="row">R₁</th><td>{number(inputs.r1)} Ω</td><td>{number(result.voltage1)} V</td><td>{number(result.current1)} A</td></tr><tr><th scope="row">R₂</th><td>{number(inputs.r2)} Ω</td><td>{number(result.voltage2)} V</td><td>{number(result.current2)} A</td></tr><tr><th scope="row">Whole circuit</th><td>{number(result.equivalentResistance)} Ω</td><td>{number(inputs.voltage)} V</td><td>{number(result.totalCurrent)} A</td></tr></tbody>
  </table></div>;
}
