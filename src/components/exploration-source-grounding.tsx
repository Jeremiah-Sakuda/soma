"use client";
import { useEffect, useState } from "react";
import type { SourceAnchor, SourceChange } from "@/lib/domain/source-grounding";
import type { ExplorationCapture } from "./exploration-capture";

type SourceOwner = {
  capturedAt: string | undefined;
  nativeId: string | undefined;
  image: string | undefined;
  anchors: string;
};
type SourceInteraction = { owner: SourceOwner; selected: string | null; status: string };
const sameOwner = (a: SourceOwner, b: SourceOwner) =>
  a.capturedAt === b.capturedAt && a.nativeId === b.nativeId &&
  a.image === b.image && a.anchors === b.anchors;

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
  const anchorDefinitions = JSON.stringify(anchors.map((a) => [
    a.id, a.label, a.region.x, a.region.y, a.region.width, a.region.height,
  ]));
  const owner: SourceOwner = {
    capturedAt: capture?.capturedAt,
    nativeId: capture?.nativeId,
    image: capture?.dataUrl,
    anchors: anchorDefinitions,
  };
  const [interaction, setInteraction] = useState<SourceInteraction>(() => ({
    owner, selected: null, status: "",
  }));
  // Invalidate immediately during render as well as clearing retained state below:
  // a new capture must never briefly inherit an old region or pointing notice.
  const owned = sameOwner(interaction.owner, owner);
  const selected = owned ? interaction.selected : null;
  const status = owned ? interaction.status : "";
  const updateInteraction = (next: Partial<Pick<SourceInteraction, "selected" | "status">>) =>
    setInteraction((current) => ({
      owner,
      selected: sameOwner(current.owner, owner) ? current.selected : null,
      status: sameOwner(current.owner, owner) ? current.status : "",
      ...next,
    }));
  const active = anchors.filter((a) =>
    selected ? a.id === selected : activeIds.includes(a.id),
  );
  const visible = active;
  useEffect(() => {
    setInteraction((current) => sameOwner(current.owner, owner)
      ? current
      : { owner, selected: null, status: "" });
  }, [capture?.capturedAt, capture?.nativeId, capture?.dataUrl, anchorDefinitions]);
  useEffect(() => {
    if (!capture?.nativeId) return;
    const listen = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d?.id === capture.nativeId)
        updateInteraction({
          status: d.shown
            ? "Pointing at the captured source on your screen."
            : "The screen changed or this capture expired. Use the captured source below or capture again.",
        });
    };
    window.addEventListener("soma:source-highlight-result", listen);
    return () =>
      window.removeEventListener("soma:source-highlight-result", listen);
  }, [capture?.capturedAt, capture?.nativeId, capture?.dataUrl, anchorDefinitions]);
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
          <p className="meta">
            {selected
              ? "This region stays selected as the explanation advances. Select it again to follow the explanation."
              : "Regions follow the explanation. Select one to keep it in view."}
          </p>
          <div className="action-row">
            {anchors.map((a) => (
              <button
                key={a.id}
                className="secondary-button"
                type="button"
                aria-label={a.label}
                aria-pressed={selected === a.id}
                onClick={() => updateInteraction({ selected: selected === a.id ? null : a.id, status: "" })}
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
                updateInteraction({ status: "Checking that the screen still matches…" });
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
