/** Conservative routing to the checked two-resistor illustration family, not a general circuit solver. */
export function isSupportedCircuitRequest(topic: string): boolean {
  if (typeof topic !== 'string' || topic.length > 300 || !topic.trim()) return false;
  const excluded = /\b(capacitors?|capacitance|capacitive|transients?|inductors?|inductance|inductive|alternating|ac|quantum|arbitrary|execute|execution|eval|javascript|python|scripts?|code|injection|instructions?|permissions?|credentials?|secrets?|api\s*keys?|ignore|override|bypass|mark.{0,30}done|rc|rlc|rl|diodes?|transistors?|impedance|frequency|frequencies)\b/i;
  const supported = /\b(resistors?|resistances?|series|parallel|ohm(?:s|['’]s)?|voltages?|currents?|circuits?)\b/i;
  return !excluded.test(topic) && supported.test(topic);
}
