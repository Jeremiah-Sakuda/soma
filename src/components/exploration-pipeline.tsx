'use client';

type Generation = {
  mode: 'live' | 'prepared-example';
  audit?: { event: string; call: number; detail: string }[];
};

/** Completed, recorded actions only. This is not a simulated live progress bar,
 * and model review never substitutes for the deterministic computation. */
export function ExplorationPipeline({
  generation,
  checked,
  replay,
}: {
  generation: Generation;
  checked: boolean;
  replay?: boolean;
}) {
  if (generation.mode === 'prepared-example') return null;
  const audit = generation.audit ?? [];
  const has = (event: string) => audit.some((item) => item.event === event);
  const source = has('source-interpreted')
    ? 'Spark read the source'
    : has('source-reused')
      ? 'Source context reused'
      : 'Recorded source';
  const review = has('review-approved') ? 'Wonder reviewed' : 'Wonder not run';
  return (
    <details className="exploration-pipeline">
      <summary>
        {replay ? 'Recorded run' : 'Muse Spark composed'} <span aria-hidden="true">→</span>{' '}
        {checked ? 'Soma computed' : 'Scene validated'} <span aria-hidden="true">→</span> {review}
      </summary>
      <p>
        {source}.{' '}
        {has('cost-probed') ? 'Spark chose an edge; Soma computed the cost interventions. ' : ''}
        {has('review-rejected')
          ? 'Wonder requested a correction before this version was accepted. '
          : ''}
        {checked
          ? 'Search results come from the deterministic solver. '
          : 'This is an explanatory visual, not a checked simulation. '}
        Model review is advisory. These are recorded generation actions; changing a control
        recomputes locally.
      </p>
      {has('cost-probe-unavailable') && (
        <p>
          The earlier cost intervention is unavailable with these controls. This explanation
          preserves the current graph.
        </p>
      )}
      <a
        href="#exploration-audit"
        onClick={() => {
          // The audit can sit inside a closed menu; open every enclosing disclosure.
          for (
            let details = document.getElementById('exploration-audit')?.closest('details') ?? null;
            details;
            details = details.parentElement?.closest('details') ?? null
          )
            details.open = true;
        }}
      >
        Inspect recorded calls and timing
      </a>
    </details>
  );
}
