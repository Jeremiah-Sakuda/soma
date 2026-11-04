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
  family = 'graph',
}: {
  generation: Generation;
  checked: boolean;
  replay?: boolean;
  family?: 'graph' | 'circuit';
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
  const readingCheck = audit.find((item) => item.event.startsWith('reading-'));
  return (
    <details className="exploration-pipeline">
      <summary>How it was made · {review}</summary>
      <p>
        {replay ? 'Recorded run' : 'Muse Spark composed'} · {checked ? 'Soma computed' : 'Scene validated'} · {review}.
      </p>
      <p>
        {source}.{' '}
        {readingCheck ? `${readingCheck.detail} ` : ''}
        {has('cost-probed') ? `Muse chose the ${family === 'circuit' ? 'component and quantity' : 'connection'} to investigate; Soma computed the supported cases and checked whether a boundary exists. ` : ''}
        {has('investigation-declined') ? `Muse found no supported single-${family === 'circuit' ? 'component' : 'connection'} investigation for this question, so no new experiment was run. ` : ''}
        {has('review-rejected')
          ? 'Wonder requested a correction before this version was accepted. '
          : ''}
        {checked
          ? `${family === 'circuit' ? 'Circuit quantities' : 'Search results'} come from the deterministic solver, conditional on the source reading. `
          : 'This is an explanatory visual, not a checked simulation. '}
        Model review is advisory. These are recorded generation actions; changing a control
        recomputes locally.
      </p>
      {has('cost-probe-unavailable') && (
        <p>
          The earlier intervention is unavailable with these controls. This explanation
          preserves the current experiment.
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
