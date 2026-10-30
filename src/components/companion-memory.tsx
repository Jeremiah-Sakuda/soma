"use client";

import { useEffect, useRef, useState } from "react";
import type {
  CompanionMemoryCommand,
  CompanionMemoryView,
  MemoryConcept,
  MemoryReference,
} from "@/lib/domain/companion-memory";
import "./companion-memory.css";

type Props = {
  sessionReady: boolean;
  artifact: { id: string; version: number; saved: boolean } | null;
  onOpen: (id: string, version: number) => void;
  onAsk: (question: string) => void;
};
type Result = {
  memory: CompanionMemoryView;
  kind?: "guest" | "account";
  liveEnabled?: boolean;
  audit?: { calls: number; costUsd: number; model: string };
};
const relationshipWords = {
  related: "connects with",
  prerequisite: "supports",
  contrast: "contrasts with",
  transfer: "may transfer to",
};

async function request(
  method: string,
  signal: AbortSignal,
  body?: unknown,
): Promise<Result> {
  const response = await fetch("/api/explore/memory", {
    method,
    signal,
    cache: "no-store",
    ...(body
      ? {
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) {
    if (response.status === 409)
      throw new Error(
        "This memory changed elsewhere. Refresh memory, then retry your saved draft.",
      );
    if (response.status === 429)
      throw new Error(
        "Muse is at capacity or the testing budget is unavailable. Your existing memory and draft are kept.",
      );
    if (response.status === 401 || response.status === 403)
      throw new Error(
        "Your session could not be verified. Sign in again or reload Soma; your draft is kept here.",
      );
    if (response.status === 404)
      throw new Error(
        "That saved exploration is no longer available. Open another saved exploration and try again.",
      );
    throw new Error(
      "Soma could not update memory. Your existing memory and draft are kept. Try again.",
    );
  }
  return response.json();
}

export function CompanionMemory({
  sessionReady,
  artifact,
  onOpen,
  onAsk,
}: Props) {
  const [open, setOpen] = useState(false);
  const [memory, setMemory] = useState<CompanionMemoryView | null>(null);
  const [kind, setKind] = useState<"guest" | "account">("guest");
  const [live, setLive] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [text, setText] = useState("");
  const [goalKind, setGoalKind] = useState<"goal" | "preference">("goal");
  const [editingId, setEditingId] = useState<string | undefined>();
  const [correction, setCorrection] = useState<{
    id: string;
    label: string;
    summary: string;
  } | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);
  const active = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const previousArtifact = useRef(
    artifact ? `${artifact.id}:${artifact.version}` : "",
  );
  const latest = useRef(artifact);
  latest.current = artifact;

  useEffect(() => () => active.current?.abort(), []);
  useEffect(() => {
    if (correction) document.getElementById("companion-concept-label")?.focus();
  }, [correction?.id]);
  useEffect(() => {
    if (resetConfirm)
      document.getElementById("companion-confirm-reset")?.focus();
  }, [resetConfirm]);
  useEffect(() => {
    const next = artifact ? `${artifact.id}:${artifact.version}` : "";
    if (next !== previousArtifact.current && busy === "Connecting with Muse…") {
      active.current?.abort();
      setBusy("");
      inFlight.current = false;
      setNotice(
        "The exploration changed. Refresh memory to check any completed connection before trying again.",
      );
    }
    previousArtifact.current = next;
  }, [artifact, busy]);
  useEffect(() => {
    if (!sessionReady) {
      active.current?.abort();
      setMemory(null);
      setBusy("");
      inFlight.current = false;
    }
  }, [sessionReady]);

  function accept(result: Result) {
    setMemory(result.memory);
    if (result.kind) setKind(result.kind);
    if (result.liveEnabled !== undefined) setLive(result.liveEnabled);
  }
  async function perform(
    method: string,
    body: unknown,
    label: string,
    success?: () => void,
  ) {
    if (inFlight.current || !sessionReady) return;
    const controller = new AbortController();
    active.current = controller;
    inFlight.current = true;
    setBusy(label);
    setError("");
    setNotice("");
    try {
      const result = await request(method, controller.signal, body);
      if (controller.signal.aborted) return;
      accept(result);
      success?.();
      if (result.audit)
        setNotice(
          `Muse connected this exploration using ${result.audit.calls} calls · $${result.audit.costUsd.toFixed(4)}. Connections are proposals you can correct.`,
        );
    } catch (e) {
      if (!controller.signal.aborted)
        setError(
          e instanceof Error ? e.message : "Could not load memory. Try again.",
        );
    } finally {
      if (active.current === controller) {
        setBusy("");
        inFlight.current = false;
        active.current = null;
      }
    }
  }
  function load() {
    return perform("GET", undefined, "Loading memory…");
  }
  function command(
    value: Omit<CompanionMemoryCommand, "revision"> | Record<string, unknown>,
    success?: () => void,
  ) {
    if (memory)
      void perform(
        "PATCH",
        { ...value, revision: memory.revision },
        "Saving memory…",
        success,
      );
  }
  function connect() {
    const current = latest.current;
    if (!memory || !current?.saved || !live) return;
    void perform(
      "POST",
      {
        artifactId: current.id,
        version: current.version,
        revision: memory.revision,
        requestId: crypto.randomUUID(),
      },
      "Connecting with Muse…",
    );
  }
  function refs(references: MemoryReference[]) {
    return (
      <div className="companion-memory-refs">
        {references.map((ref) => (
          <button
            type="button"
            key={`${ref.artifactId}:${ref.version}`}
            disabled={!!busy}
            onClick={() => onOpen(ref.artifactId, ref.version)}
          >
            Open supporting exploration · v{ref.version}
          </button>
        ))}
      </div>
    );
  }
  function conceptCard(concept: MemoryConcept) {
    const evidence =
      memory?.evidence.filter((record) =>
        concept.refs.some(
          (ref) =>
            ref.artifactId === record.ref.artifactId &&
            ref.version === record.ref.version,
        ),
      ) ?? [];
    return (
      <li key={concept.id} className="companion-memory-concept">
        <h4>{concept.label}</h4>
        <span className="companion-memory-tag">
          {concept.provenance === "user-correction"
            ? "Your correction"
            : "Muse proposal"}
        </span>
        <p>{concept.summary}</p>
        {concept.uncertainty.length > 0 && (
          <ul aria-label={`Uncertainty about ${concept.label}`}>
            {concept.uncertainty.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
        {refs(concept.refs)}
        <details>
          <summary>Recorded practice ({evidence.length})</summary>
          {evidence.length === 0 ? (
            <p>
              No recorded answer supports this connection yet. Viewing an
              explanation is exploration.
            </p>
          ) : (
            <ul>
              {evidence.map((record) => (
                <li key={record.id}>
                  <p>
                    <strong>
                      {record.kind === "prediction"
                        ? "Prediction with diagram visible"
                        : "Practice with reference available"}
                    </strong>{" "}
                    ·{" "}
                    {record.matches
                      ? "Answer matched the checked result"
                      : "Answer differed from the checked result"}
                  </p>
                  <p>
                    Your answer: {record.answer}
                    {record.reason && <> · Your explanation: {record.reason}</>}
                  </p>
                  <p>
                    Assistance: {record.assistance.replaceAll("-", " ")}
                    {record.revealedBeforeAnswer
                      ? " · Result revealed before answer"
                      : ""}{" "}
                    ·{" "}
                    <time dateTime={record.recordedAt}>
                      {new Date(record.recordedAt).toLocaleString()}
                    </time>
                  </p>
                </li>
              ))}
            </ul>
          )}
          <p>This is practice evidence, not a mastery judgment.</p>
        </details>
        <div className="companion-memory-actions">
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              setCorrection({
                id: concept.id,
                label: concept.label,
                summary: concept.summary,
              })
            }
          >
            Correct {concept.label}
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() =>
              command({ action: "delete-concept", id: concept.id })
            }
          >
            Remove {concept.label}
          </button>
        </div>
      </li>
    );
  }
  return (
    <section
      className="companion-memory"
      aria-label="Your goals and understanding"
    >
      <button
        type="button"
        className="companion-memory-toggle"
        aria-expanded={open}
        aria-controls="companion-memory-content"
        onClick={() => {
          setOpen(!open);
          if (!open && !memory && sessionReady) void load();
        }}
      >
        <span>Your goals & understanding</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <div id="companion-memory-content" className="companion-memory-content">
          <p>
            Connect your explorations across subjects. Goals come from you;
            concept connections are Muse’s interpretations.
          </p>
          <p className="companion-memory-note">
            {kind === "guest"
              ? "Guest memory lasts up to 24 hours and stays in this guest session."
              : "Memory is private to your account. You can edit or remove it here."}
          </p>
          <div role="status" aria-live="polite">
            {busy || notice}
          </div>
          {error && <p role="alert">{error}</p>}
          <button
            type="button"
            disabled={!!busy || !sessionReady}
            onClick={() => void load()}
          >
            Refresh memory
          </button>
          {!sessionReady && <p>Waiting for your Soma session…</p>}
          {memory && (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  command(
                    {
                      action: "upsert-goal",
                      id: editingId,
                      kind: goalKind,
                      text: text.trim(),
                    },
                    () => {
                      setText("");
                      setEditingId(undefined);
                      setNotice("Your goal or preference is saved.");
                    },
                  );
                }}
              >
                <h3>Your context</h3>
                <label htmlFor="companion-goal-kind">Remember as</label>
                <select
                  id="companion-goal-kind"
                  value={goalKind}
                  disabled={!!busy}
                  onChange={(e) =>
                    setGoalKind(e.target.value as "goal" | "preference")
                  }
                >
                  <option value="goal">Goal</option>
                  <option value="preference">Preference</option>
                </select>
                <label htmlFor="companion-goal-text">
                  {editingId
                    ? "Edit your context"
                    : "What would you like Soma to remember?"}
                </label>
                <textarea
                  id="companion-goal-text"
                  maxLength={500}
                  required
                  value={text}
                  disabled={!!busy}
                  placeholder="For example: I’m learning how everyday systems work. I prefer trying an example first."
                  onChange={(e) => setText(e.target.value)}
                />
                <div className="companion-memory-actions">
                  <button type="submit" disabled={!!busy || !text.trim()}>
                    {editingId ? "Save changes" : "Remember this"}
                  </button>
                  {editingId && (
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => {
                        setEditingId(undefined);
                        setText("");
                      }}
                    >
                      Cancel edit
                    </button>
                  )}
                </div>
              </form>
              <ul className="companion-memory-goals">
                {memory.goals.map((goal) => (
                  <li key={goal.id}>
                    <span className="companion-memory-tag">
                      Your {goal.kind}
                    </span>
                    <p>{goal.text}</p>
                    <div className="companion-memory-actions">
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => {
                          setEditingId(goal.id);
                          setText(goal.text);
                          setGoalKind(goal.kind);
                          document
                            .getElementById("companion-goal-text")
                            ?.focus();
                        }}
                      >
                        Edit {goal.kind}
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() =>
                          command(
                            { action: "delete-goal", id: goal.id },
                            () => {
                              if (editingId === goal.id) {
                                setEditingId(undefined);
                                setText("");
                              }
                            },
                          )
                        }
                      >
                        Delete {goal.kind}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="companion-memory-connect">
                <h3>Connections across explorations</h3>
                <p>
                  Connect sends this saved exploration’s source summary and
                  learning records to Muse, together with your saved memory. It
                  does not resend the screenshot.
                </p>
                <button
                  type="button"
                  disabled={!!busy || !artifact?.saved || !live}
                  onClick={connect}
                >
                  Connect this exploration with Muse
                </button>
                {!artifact?.saved && (
                  <p>Open or save an exploration to connect it.</p>
                )}
                {!live && (
                  <p>
                    Live Muse analysis is unavailable in this session. Existing
                    memory remains editable.
                  </p>
                )}
              </div>
              {memory.nextActivity && (
                <aside className="companion-memory-next">
                  <h3>A possible next exploration</h3>
                  <p>{memory.nextActivity.question}</p>
                  <p>{memory.nextActivity.reason}</p>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => onAsk(memory.nextActivity!.question)}
                  >
                    Use this question
                  </button>
                  <p className="companion-memory-note">
                    Adds to your question field for review. It does not submit
                    automatically.
                  </p>
                </aside>
              )}
              <p className="companion-memory-note">
                Connections show what you explored and practiced. They are not
                scores or proof of independent understanding.
              </p>
              <ul className="companion-memory-concepts">
                {memory.concepts.map(conceptCard)}
              </ul>
              {memory.concepts.length === 0 && (
                <p>
                  No concept connections yet. Connect an exploration when you
                  want Muse to propose them.
                </p>
              )}
              {memory.relationships.length > 0 && (
                <section
                  className="companion-memory-map"
                  aria-label="Concept relationship map"
                >
                  <h3>How these ideas connect</h3>
                  <ul>
                    {memory.relationships.map((rel) => (
                      <li key={rel.id}>
                        <p className="companion-memory-map-line">
                          <strong>
                            {memory.concepts.find((c) => c.id === rel.from)
                              ?.label ?? rel.from}
                          </strong>
                          <span>{relationshipWords[rel.kind]}</span>
                          <strong>
                            {memory.concepts.find((c) => c.id === rel.to)
                              ?.label ?? rel.to}
                          </strong>
                        </p>
                        <p>{rel.reason}</p>
                        <span className="companion-memory-tag">
                          Muse proposal · not verified
                        </span>
                        {refs(rel.refs)}
                        <button
                          type="button"
                          disabled={!!busy}
                          onClick={() =>
                            command({
                              action: "delete-relationship",
                              id: rel.id,
                            })
                          }
                        >
                          Remove connection
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
              {correction && (
                <form
                  className="companion-memory-correction"
                  onSubmit={(e) => {
                    e.preventDefault();
                    command({ action: "correct-concept", ...correction }, () =>
                      setCorrection(null),
                    );
                  }}
                >
                  <h3>Correct a concept</h3>
                  <label htmlFor="companion-concept-label">Concept name</label>
                  <input
                    id="companion-concept-label"
                    required
                    maxLength={100}
                    disabled={!!busy}
                    value={correction.label}
                    onChange={(e) =>
                      setCorrection({ ...correction, label: e.target.value })
                    }
                  />
                  <label htmlFor="companion-concept-summary">
                    Your correction
                  </label>
                  <textarea
                    id="companion-concept-summary"
                    required
                    maxLength={500}
                    disabled={!!busy}
                    value={correction.summary}
                    onChange={(e) =>
                      setCorrection({ ...correction, summary: e.target.value })
                    }
                  />
                  <div className="companion-memory-actions">
                    <button
                      type="submit"
                      disabled={
                        !!busy ||
                        !correction.label.trim() ||
                        !correction.summary.trim()
                      }
                    >
                      Save correction
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => setCorrection(null)}
                    >
                      Cancel correction
                    </button>
                  </div>
                </form>
              )}
              <div className="companion-memory-reset">
                {resetConfirm ? (
                  <>
                    <p>
                      Clear all goals, preferences and proposed connections?
                      Your saved explorations and original practice records
                      remain.
                    </p>
                    <div className="companion-memory-actions">
                      <button
                        type="button"
                        id="companion-confirm-reset"
                        disabled={!!busy}
                        onClick={() =>
                          command({ action: "reset" }, () => {
                            setResetConfirm(false);
                            setCorrection(null);
                            setEditingId(undefined);
                            setText("");
                            setNotice(
                              "Memory cleared. Your saved explorations remain available.",
                            );
                          })
                        }
                      >
                        Confirm clear memory
                      </button>
                      <button
                        type="button"
                        disabled={!!busy}
                        onClick={() => setResetConfirm(false)}
                      >
                        Keep memory
                      </button>
                    </div>
                  </>
                ) : (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => setResetConfirm(true)}
                  >
                    Clear memory…
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
