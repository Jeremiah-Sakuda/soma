import { renderToStaticMarkup } from 'react-dom/server';
import { EngineScene } from '../pm121/lib/EngineScene';
import { enginePose, validateEngine, type EngineFilm } from '../pm121/lib/engine';
import { comparisonStates, poseObservation } from './comparison';
import {
  identity,
  sourceQuotes,
  preparedQuestions,
  validateRecordedInvestigation,
  type Investigation,
} from './investigation';
import raw from './recorded/investigations.json';
import author from './recorded/author-1.json';
import review from './recorded/review-1.json';
import { assertRecordedFilm } from './recorded-film';
export function studySnapshot(filmInput: EngineFilm, angle: number, probe?: Investigation) {
  assertRecordedFilm(filmInput);
  const film = validateEngine(filmInput);
  if (probe) {
    const original = validateRecordedInvestigation(raw, author, review, film).investigations.find(
      (a) => a.id === probe.id,
    );
    if (JSON.stringify(original) !== JSON.stringify(probe))
      throw Error('Investigation differs from recorded decision');
  }
  const question = probe ? preparedQuestions.find((a) => a.id === probe.id) : null,
    states = probe
      ? probe.action === 'inspect-part'
        ? [enginePose(probe.targetDegrees)]
        : [enginePose(probe.observedDegrees), enginePose(probe.targetDegrees)]
      : comparisonStates(angle);
  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang="en">
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width,initial-scale=1" />
          <meta
            httpEquiv="Content-Security-Policy"
            content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'"
          />
          <title>Soma — My engine study snapshot</title>
          <style>{`body{font:16px/1.6 system-ui,sans-serif;color:#253b34;background:#fbfaf7;max-width:1000px;margin:30px auto;padding:0 22px}h1{font-size:32px;line-height:1.2}h2{font-size:20px}.states{display:grid;grid-template-columns:1fr 1fr;gap:22px}.state{border:1px solid #cdd5c9;background:white;border-radius:16px;padding:18px}.state svg{width:100%;height:360px}dl{display:grid;grid-template-columns:1fr 1fr;font-size:14px}dt,dd{margin:0;padding:4px 0}dd{text-align:right}footer{font-size:13px;overflow-wrap:anywhere;border-top:1px solid #cdd5c9;margin-top:30px;padding-top:16px}blockquote{margin:14px 0;padding-left:16px;border-left:3px solid #9cab93}@media(max-width:600px){.states{grid-template-columns:1fr}.state svg{height:320px}}@media print{body{margin:0;font-size:12px}.state{break-inside:avoid}.state svg{height:260px}}`}</style>
        </head>
        <body>
          <header>
            <p>SOMA / LOCAL STUDY SNAPSHOT</p>
            <h1>{probe ? probe.title : 'Same position. Different job.'}</h1>
            <p>My comparison from the recorded engine: {film.title}</p>
          </header>
          <main>
            {probe && (
              <section>
                <h2>Recorded Muse investigation</h2>
                <p>Prepared question: {question!.question}</p>
                <p>
                  Recorded context: {probe.observedDegrees}° · selected action: {probe.action} ·
                  target: {probe.targetDegrees}°{probe.part ? ` · part: ${probe.part}` : ''}
                </p>
                <p>{probe.objective}</p>
                <p>{probe.explanation}</p>
                <blockquote>{probe.sourceQuote}</blockquote>
                <p>
                  This is a recorded decision on a prepared question, not a live answer to my
                  current context.
                </p>
              </section>
            )}
            <div className="states">
              {states.map((p, i) => (
                <section className="state" key={i}>
                  <h2>
                    {film.strokes[p.phase].name} · {Number(p.degrees.toFixed(3))}°
                  </h2>
                  <EngineScene
                    film={film}
                    degrees={p.degrees}
                    compact
                    labels={false}
                    selected={probe?.part ?? null}
                  />
                  <dl>
                    <dt>Intake valve</dt>
                    <dd>{p.intakeLift > 0.01 ? 'Open' : 'Closed'}</dd>
                    <dt>Exhaust valve</dt>
                    <dd>{p.exhaustLift > 0.01 ? 'Open' : 'Closed'}</dd>
                  </dl>
                  <p>{poseObservation(p.degrees)}</p>
                </section>
              ))}
            </div>
            {(!probe || probe.action === 'compare-turns') && (
              <p>
                The linkage returns to the same position after one turn. Stroke roles differ; the
                full cycle takes two turns. Both valves are seated at the exact stroke boundaries in
                this idealized model.
              </p>
            )}
            <h2>Original synthetic teaching source</h2>
            {sourceQuotes.map((q) => (
              <blockquote key={q}>{q}</blockquote>
            ))}
            <h2>Illustrative assumptions</h2>
            <ul>
              {film.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </main>
          <footer>
            <p>
              Muse Spark authored the recorded engine artwork and teaching copy. Soma supplies
              constrained motion, this comparison and snapshot text/material finishes. Wonder's
              recorded review is advisory; it does not certify mechanics. This file makes no model
              calls and plays no media.
            </p>
            <p>
              Local export only. It is not a cloud-saved lesson, revision or evidence of independent
              understanding. No calculated pressure, force, temperature or efficiency.
            </p>
            <p>
              Source SHA256: {identity.sourceSha256}
              <br />
              Recorded film SHA256: {identity.filmSha256}
            </p>
          </footer>
        </body>
      </html>,
    )
  );
}
export function downloadStudySnapshot(film: EngineFilm, angle: number, probe?: Investigation) {
  const url = URL.createObjectURL(
      new Blob([studySnapshot(film, angle, probe)], { type: 'text/html;charset=utf-8' }),
    ),
    a = document.createElement('a');
  a.href = url;
  a.download = 'soma-engine-study.html';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
