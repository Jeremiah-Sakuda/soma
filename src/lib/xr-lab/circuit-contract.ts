import type { DcComponent, DcProbe, DcSolution } from '../domain/dc-circuit';

/** All positions use slide-normalised 0..1 coordinates, origin top-left. */
export type CircuitLabPart = {
  id: string;
  label: string;
  kind: DcComponent['kind'];
  from: string;
  to: string;
  value: number;
  unit: 'Ω' | 'V' | 'A';
  open: boolean;
  /** Body midpoint from the recorded presentation alignment. */
  x: number;
  y: number;
  /** Derived label anchor beside the body, not an extracted printed-label position. */
  labelX: number;
  labelY: number;
  /** Amperes, positive from `from` to `to`; zero when open, null if unsolved. */
  current: number | null;
};

export type CircuitLabState = {
  parts: CircuitLabPart[];
  /** Voltages relative to ground; null means floating or unsolved, never assumed zero. */
  nodes: { id: string; label: string; x: number; y: number; voltage: number | null }[];
  ground: string;
  status: DcSolution['status'];
  reason: string | null;
  checks: DcSolution['checks'];
  /** Historical experiment choice and boundary; not re-verified for modified topology. */
  probe: DcProbe;
  /** Computed from the current solution, not copied from recorded narration. */
  caption: string;
  provenance: {
    model: string;
    recordedAt: string;
    label: string;
    results: 'computed-now';
    solver: string;
    solverVersion: string;
    layout: 'recorded-alignment-with-derived-labels';
  };
};

/** Bounded XR controls: ohms, volts and amperes respectively; sources can reverse polarity.
 * These interaction ranges are deliberately narrower than the exact solver's supported domain.
 * Initial/reset values remain the recording's values; only user edits are clamped.
 */
export const CIRCUIT_LAB_VALUE_RANGES = {
  resistor: { min: 0.1, max: 1000 },
  'voltage-source': { min: -100, max: 100 },
  'current-source': { min: -10, max: 10 },
} as const;

export interface CircuitLab {
  state(): CircuitLabState;
  /** Open/close a resistor. Unknown IDs and source toggles throw without changing state. */
  togglePart(id: string): CircuitLabState;
  /** Clamp finite values by part kind; reject NaN/infinities and unknown IDs atomically. */
  setValue(id: string, value: number): CircuitLabState;
  reset(): CircuitLabState;
}

export type OpenRecordedCircuitLab = () => CircuitLab;
