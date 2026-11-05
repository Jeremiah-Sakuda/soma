# Soma product requirements

Release scope, November 4, 2026.

## Product thesis

Turn what you’re studying into something you can explore. A static diagram contains one example; a learner’s question often asks what would happen if something changed. Soma starts from that diagram, keeps it recognizable, and makes supported relationships manipulable without requiring the learner to rebuild the example in another tool.

The primary journey is **selected visible context → generated visual → checked manipulation → contextual follow-up → saved revision**. Students and independent learners working with diagram-heavy material are the initial audience. The product does not require course setup or a compulsory assessment.

## User stories

| Situation | Expected behavior |
| --- | --- |
| I am looking at a lecture diagram | Capture or upload it, ask by text or optional voice, and receive a source-specific visual with an inspectable reading |
| I want to test a different input | Change a supported connection or value and see computed consequences immediately |
| I do not know what to change | Ask a question; Muse selects a supported intervention and Soma computes its boundary or reports none |
| I ask why after experimenting | The explanation addresses the current controls; it cannot silently reset them |
| I return later | Reopen the saved revision with its source lineage, interpreted model, controls and actual generation record |
| The material is ambiguous or unsupported | Receive uncertainty, clarification, an explanation-only visual or a bounded failure; never an invented checked simulation |

## Functional acceptance

1. **Source interpretation.** Spark reads transient image pixels into typed data and approximate locations. Source content is untrusted input, not instructions. The UI exposes the reading, assumptions and uncertainty. Dense text may need a closer capture.
2. **Checked graphs.** Support BFS and Dijkstra on nonnegative graphs with at most 12 nodes and 24 edges. Solver state drives routes, distances, queue/priority state and local interventions. Undirected rendering and reverse-traversed highlighting preserve graph semantics. BFS retains queue animation with explicit algorithm metadata.
3. **Checked circuits.** Support ideal DC networks with resistors, voltage sources and current sources, at most 10 nodes and 16 parts. Exact rational nodal analysis must satisfy Kirchhoff’s current law, source voltages and power balance before checked publication. Nonunique or unsupported networks are not checked circuits.
4. **Independent image review.** When enabled and admitted, Wonder checks graph/circuit interpretation against the original image. Disputed values can receive a blind Spark re-read; only agreed corrections apply. Unresolved circuit disputes prevent checked publication. Two models can share a mistake; skipped/unavailable reviews remain visible.
5. **Investigation.** Muse selects an existing edge or circuit part relevant to the question. Soma computes a graph route boundary or a bounded circuit condition and verifies circuit critical values by exact re-solving. It must not fabricate a boundary when none exists.
6. **Composition and review.** Spark authors approved typed visual components and explanations around computed results. Wonder’s bounded explanation review/repair remains advisory. Generated content cannot execute arbitrary code, access credentials, change validators or write learner evidence directly.
7. **Experiment continuity.** Explanatory follow-ups preserve effective controls, disabled edges, starts/goals and tested values. Bind wording to the controls it describes; pause stale wording when controls differ. Keep original source and immutable revisions available. Removing a probed edge or goal makes that probe unavailable without breaking ordinary explanation.
8. **Native interaction.** Explicit capture and cursor gestures share the browser exploration engine. Source drawing/lifting requires a current capture; stale or changed screens must refuse drawing and offer recapture. Captures must omit Soma’s own drawing. Restricted native bridges never expose arbitrary Node or IPC to hosted content.
9. **3D presentation.** Graph/circuit views reflect checked values, including small values and floating/unrevealed states. Camera movement does not change facts. The built-in engine is an illustrative cutaway: Muse chooses placement and teaching poses; Soma supplies geometry and mechanics. Other mechanisms remain explanatory, with a readable fallback if WebGL is unavailable.
10. **Saving.** Persist interpreted data, control state, versions and ownership, with Unsaved/Saving/Saved feedback. Failed saves preserve the draft. Private screenshot pixels are not saved; reopened private captures use diagram view. Explicit original public demo images are a separate replay exception.
11. **Optional practice and memory.** Fresh graph practice retains original answers, assistance, exposure and actual time. Goals are self-report; concept links are revisable interpretations. Viewing, completion, hints or a supported answer never silently become independent-understanding evidence.
12. **Failure and budgets.** Bound calls, tokens, retries, wall time and spend before inference. Preserve the previous usable artifact on cancellation/failure. Unknown provider usage retains its reservation. Report actual progress rather than fabricated stages or partial unchecked explanations.

## Experience acceptance

The visual and current result remain central. At companion width, keep experiment and question controls nearby; use disclosures for source, history and detailed computation. Maintain keyboard access, visible focus, captions/manual stepping, reduced motion and meaningful no-WebGL behavior. Distinguish live inference, actual recordings and prepared examples. Narration follows the current validated experiment; it is paced by audio progress, not word-level timestamps.

## Release boundary

The signed/notarized macOS companion and browser application are separate deliverables. Source tests, browser renderer checks, device gestures, operating-system permissions and clean-Mac installation are separate evidence. [Verification](VERIFICATION.md) records what was executed.

Full-semester collection is parked as a primary journey. Preserve earlier routes, data and read-only integrations, but do not add a career suite, general calendar solver, calendar writeback or unattended external actions. Additional scientific subjects require a supported model, reading contract, validation and rendering; broader explanation is not evidence of broader checked simulation.

## Impact evidence

The intended benefit is less reconstruction between seeing a difficult idea and investigating it. Measure that benefit with real workflows before claiming time savings or learning gains. Current source evaluations are small development samples and do not establish educational effectiveness, adoption or general reliability.
