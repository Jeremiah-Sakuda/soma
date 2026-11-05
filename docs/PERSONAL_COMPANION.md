# Personal continuity

October 30, 2026. Soma remains a broad screen companion. Coding is one possible demo context, alongside coursework, diagrams and unfamiliar software. The core journey is selected context → generated visual → exploration → saved understanding → a better-informed next interaction. Optional computer actions have a separate native authority boundary.

## Use the memory loop

Open **Your goals & understanding** beside the source/history controls. Add a goal or preference in your own words. These records are explicitly self-reported and editable; Soma does not infer that you completed a daily practice routine from your statement.

Save an exploration, then choose **Connect with Muse**. Spark selects up to three relevant saved experiences, inspects their summaries and recorded practice evidence alongside the current one, and proposes concepts, relationships and a next question. Original images are not resent. The same process applies across subjects; it does not force a coding curriculum or connect unrelated material.

The map presents named concept cards and directional relationship rows with inspectable source/version links. It distinguishes Muse proposals, your corrections, diagram-visible predictions, reference-available fresh practice and assistance. It does not assign mastery scores. A next question is placed in the composer for your review; it never starts inference automatically.

Subsequent visual generation receives bounded relevant personal context. Its audit records the context revision and counts supplied. Muse chooses whether a connection is useful; computation and source bindings stay under application control. This is personalized context, not a guarantee that every model response makes the best instructional choice.

You can edit/delete goals, correct/remove concepts and connections, or clear memory. Clearing memory removes goals and interpretations while preserving original saved explorations and practice records. Deleting an exploration prunes its dependent interpretations and recommendations. Account memory uses the existing owned Firestore session; guest memory expires with the existing 24-hour guest session and does not transfer automatically into an account.

## Implementation and boundaries

- `companion-memory.ts` defines strict typed proposals and source-linked, revisioned records. Observation data is projected from actual stored predictions/application answers; the model cannot create observations or goals.
- `companion-analysis.ts` runs a bounded `select_memories` → `propose_memory` tool sequence. Every proposed reference must have been selected and belong to a currently saved owned artifact. No arbitrary network fetch or model code execution.
- `/api/explore/memory` reuses session ownership, same-origin mutation checks, bounded bodies, private responses and existing persistence. Conflicting edits, source removal, cancellation and ownership revocation prevent stale publication. Ownership/memory are rechecked after awaited budget settlement.
- Generation incorporates bounded goals and relevant concept evidence through the existing exploration engine. Editing or forgetting relevant memory during a turn invalidates stale personalization.
- The shared ledger, admission limits, 20% allocation reserve and existing lifetime cap are preserved. Connection analysis permits two model calls; unknown usage retains the reservation. No new allowance, scheduler or automatic background processing was introduced.
- Computer control is implemented separately through the [native action guide](COMPUTER_ACTIONS.md). A remote model proposal cannot directly call privileged native APIs. The existing course collectors remain read-only.

## Verification record

Actual synthetic Meta testing passed the complete chain: selection of a prior original saved graph, two linked concepts and a next activity, a new checked Dijkstra visual supplied with personal context, and an exact `Display name = Ada` form-action proposal. No real user source, native click or field was involved. This is a development integration case, not a cross-subject reliability benchmark.

The first live attempts exposed Meta's requirement that every strict-tool property be required. The wire schema now requires a nullable recommendation while the persisted domain keeps absence optional. Failed attempts and their conservative reservations were retained. Failed attempts retained their conservative reservations; a historical test ledger is not the current remaining allowance.

Tests cover real local persistence and HTTP boundaries, source deletion, stale/replayed requests, forged refs and recommendations, model usage accounting, cancellation, goal edits during generation, ownership revocation, and forgetting memory during settlement. Browser checks cover editing/reload/reset, preserved drafts after conflicts, relationship/evidence inspection, suggestion review and 375/620px layouts. Full integration testing caught and corrected a layout regression: memory now occupies the existing source area rather than moving the main visual below the first viewport.

Current aggregate and distribution checks are in [verification](VERIFICATION.md). The 0.5.0 companion includes the action controller; physical Accessibility execution remains a separate acceptance boundary.

## Acceptance and remaining human checks

The implementation supports explicit goals, evidence-linked concepts across saved experiences, a proposed next activity, memory-informed visuals and individually approved native action proposals. It does not claim independent learning gains, universal scientific simulation, general desktop autonomy or correct operation in every app. Standard Accessibility controls are the initial action boundary.

Verify the new native build with macOS Accessibility permission and a benign form: inspect the target/value, replace a field, confirm readback, try a button and stop with Escape. Then evaluate real cross-subject explanations and whether proposed connections help you. The published installer’s signing is recorded separately from physical action acceptance.
