const $ = (id) => document.getElementById(id);
let candidate = null;
window.somaComputer.onState((state) => {
  candidate = state.plan;
  $("history").replaceChildren(
    ...(state.history || []).map((action) => {
      const item = document.createElement("li");
      item.textContent = `${action.kind === "type" ? "Replace" : "Press"} ${action.label}${action.kind === "type" ? ` with ${action.text}` : ""} · ${action.outcome === "value-confirmed" ? "value read back and confirmed" : "press accepted; verify the app result"}`;
      return item;
    }),
  );
  $("app").textContent = state.app
    ? `Selected app: ${state.app} · ${state.steps}/5 actions`
    : "No active task. Focus the target app, then press ⌘⇧A.";
  $("controls").replaceChildren(
    ...state.controls.map((c) => {
      const item = document.createElement("li");
      item.textContent = `${c.id}: ${c.label} (${c.role})`;
      return item;
    }),
  );
  const target = state.controls.find((c) => c.id === candidate?.target);
  $("proposal").textContent = candidate
    ? `${candidate.reason}\n${["clarify", "done"].includes(candidate.kind) ? (candidate.kind === "done" ? "Muse thinks this task is complete. Verify the result in the app." : "Clarification needed") : `${candidate.kind === "type" ? "Replace field" : "Press control"}: ${target?.label || ""}${candidate.kind === "type" ? `\nExact replacement: ${candidate.text}` : ""}`}`
    : "";
  $("consent").checked = false;
  $("execute").disabled = true;
  if (state.message) $("status").textContent = state.message;
  if (!state.app || (!state.steps && !state.plan)) $("audit").textContent = "";
  if (state.audit)
    $("audit").textContent =
      `${state.audit.model} · ${state.audit.calls} call · $${state.audit.costUsd.toFixed(5)} · proposal only`;
});
$("consent").addEventListener("change", () => {
  $("execute").disabled =
    !$("consent").checked ||
    !candidate ||
    ["clarify", "done"].includes(candidate.kind);
});
for (const command of ["plan", "execute", "stop"])
  $(command).addEventListener("click", async () => {
    const button = $(command);
    button.disabled = true;
    try {
      await window.somaComputer.command(
        command,
        command === "plan"
          ? $("goal").value
          : command === "execute"
            ? $("consent").checked
            : undefined,
      );
    } catch (error) {
      $("status").textContent = error.message;
    } finally {
      button.disabled = command === "execute";
    }
  });
window.somaComputer.command("ready");
