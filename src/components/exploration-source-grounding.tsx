"use client";
import { useEffect, useState } from "react";
import type { SourceAnchor, SourceChange } from "@/lib/domain/source-grounding";
import type { ExplorationCapture } from "./exploration-capture";
/** A captured source is inspectable even when the live desktop has moved on. */
export function ExplorationSourceGrounding({
  capture,
  anchors,
  activeIds,
  change,
  previous,
}: {
  capture?: ExplorationCapture;
  anchors: SourceAnchor[];
  activeIds: string[];
  change?: SourceChange;
  previous?: ExplorationCapture;
}) {
  const [selected, setSelected] = useState<string | null>(null),
    [status, setStatus] = useState("");
  const active = anchors.filter((a) =>
    selected ? a.id === selected : activeIds.includes(a.id),
  );
  const visible = active;
  useEffect(() => {
    setSelected(null);
    setStatus("");
  }, [capture?.capturedAt, activeIds.join("|")]);
  useEffect(() => {
    const listen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id === capture?.nativeId)
        setStatus(
          d.shown
            ? "Pointing at the captured source on your screen."
            : "The screen changed or this capture expired. Use the captured source below or capture again.",
        );
    };
    window.addEventListener("soma:source-highlight-result", listen);
    return () =>
      window.removeEventListener("soma:source-highlight-result", listen);
  }, [capture?.nativeId]);
  if (!anchors.length && !change) return null;
  return (
    <section className="exploration-grounding" aria-label="Source grounding">
      {change && (
        <p className="exploration-source-change">
          <strong>
            {change.relationship === "same-material"
              ? "What changed"
              : change.relationship === "different-material"
                ? "New material"
                : "Source relationship uncertain"}
            :
          </strong>{" "}
          {change.summary}
          {change.uncertainty.length > 0 && (
            <small>{change.uncertainty.join(" ")}</small>
          )}
        </p>
      )}
      {change && previous && capture && (
        <details>
          <summary>Compare captures</summary>
          <div className="exploration-capture-pair">
            <figure>
              <figcaption>Earlier capture</figcaption>
              <img src={previous.dataUrl} alt="Earlier captured source" />
            </figure>
            <figure>
              <figcaption>Current capture</figcaption>
              <img src={capture.dataUrl} alt="Current captured source" />
            </figure>
          </div>
        </details>
      )}
      {!!anchors.length && (
        <details>
          <summary>
            See on source · {anchors.length} model-located{" "}
            {anchors.length === 1 ? "region" : "regions"}
          </summary>
          {capture ? (
            <div className="exploration-grounding-image">
              <img
                src={capture.dataUrl}
                alt="Captured source with model-located regions"
              />
              {visible.map((a) => (
                <span
                  key={a.id}
                  className="exploration-grounding-region"
                  role="img"
                  aria-label={`Region ${anchors.indexOf(a) + 1}: ${a.label}`}
                  style={{
                    left: `${a.region.x * 100}%`,
                    top: `${a.region.y * 100}%`,
                    width: `${a.region.width * 100}%`,
                    height: `${a.region.height * 100}%`,
                  }}
                >
                  <span aria-hidden="true">{anchors.indexOf(a) + 1}</span>
                </span>
              ))}
            </div>
          ) : (
            <p className="meta">
              Source pixels were not saved. Capture again to inspect these
              locations.
            </p>
          )}
          <div className="action-row">
            {anchors.map((a) => (
              <button
                key={a.id}
                className="secondary-button"
                type="button"
                aria-label={a.label}
                aria-pressed={visible.some((v) => v.id === a.id)}
                onClick={() => setSelected(a.id)}
              >
                {anchors.indexOf(a) + 1} · {a.label}
              </button>
            ))}
          </div>
          {capture?.nativeId && capture.nativeHighlight && (
            <button
              className="secondary-button"
              type="button"
              disabled={!visible.length}
              onClick={() => {
                setStatus("Checking that the screen still matches…");
                window.dispatchEvent(
                  new CustomEvent("soma:source-highlight", {
                    detail: { id: capture.nativeId, anchors: visible },
                  }),
                );
              }}
            >
              Point on screen
            </button>
          )}
          <p className="meta">
            Locations are model interpretations. Native pointing requires the
            screen to still match this capture.
          </p>
          {status && <p role="status">{status}</p>}
        </details>
      )}
    </section>
  );
}
