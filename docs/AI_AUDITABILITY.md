# AI auditability

Implemented October 26, 2026. Soma records application activity and short model-stated purposes in a durable, owner-scoped journal. A stated purpose is an explanation supplied by the model, not evidence of its hidden internal reasoning.

## What the student sees

Open **AI activity** in the study workspace. The compact disclosure preserves the Ready Card as the main action. It shows source checks, preparation, investigations and post-response adaptation; expand a run to inspect its events, evidence versions, validation/repair outcomes, model/engine versions, usage and final state. Live source checks are distinguished from live model execution, reused prepared work and synthetic mode. Source provenance is separate: a live model can operate over synthetic demo sources.

The application reports actions it actually observed, separately from Spark's proposed actions and stated purposes. Proposed or validated work is not labeled published until the workspace commit succeeds. Missing stated purposes stay unrecorded. Historical runs are not backfilled with invented explanations.

Progress refreshes while the disclosure is open, with a bounded polling window. Closing it stops polling; reopening refreshes saved state. A stopped browser does not stop the durable worker. A stale in-progress journal is displayed as interrupted after five minutes, rather than fabricating completion.

## Answer and privacy boundaries

Model-text events remain protected during a run and after failure. For a published selected activity, disclosure requires a saved response against the pinned lesson, model and source versions, or recorded help after the run began. The original response retains assistance/exposure metadata; reading an explanation cannot become new independent-understanding evidence. Discarded/unpublished diagnostic proposals remain protected, including when the final decision keeps the current plan. A source-only completed decision can expose its stated purpose without an activity response.

The API and JSON export apply the same projection. Neither contains raw provider reasoning, tool arguments, credentials, session material, page bodies or mail queries. A short model explanation can refer to authorized course content, so exports are private educational records and should be reviewed before sharing. App events can link exact source IDs/versions; old passages are not silently replaced with current text. Context snapshots beyond 200 references are explicitly marked truncated; individual executed read events preserve their evidence links.

## Storage and failure behavior

Journals are separate from the workspace revision and stored under its owned Firestore root. Each mutation checks ownership and workspace generation. Events have a sequence and timestamp; terminal runs reject further append. SQLite is only the explicit local synthetic fallback. Authenticated reads cannot select another account or workspace.

Each run is bounded to 100 events and 128 KiB, with 5,000 retained runs per workspace. Capacity stops new processing instead of silently deleting history. The UI pages 30 runs at a time and permits access to the entire retained history. **Export latest 30 runs** is a page export; each run also has a complete individual export. No claim of unlimited retention or one-click whole-account export is made.

Journal operations have a five-second confirmation deadline. An outage before an action halts further inference; there is no unaudited inference fallback. A remotely dispatched write may settle after that deadline, so the durable prefix is authoritative and completion is not reconstructed. If the workspace has already committed but final audit confirmation fails, saved work is preserved and an explicit incomplete-audit notice is returned.

Deleting a workspace deletes its owned journals. Anonymous journals inherit the session expiry. Scheduled bounded maintenance deletes expired demo children without requiring paid TTL, preserving account journals and unexpired sessions. Cleanup failures are reported as deferred maintenance and do not prevent selected-source worker dispatch. The Firestore collection-group single-field ASC indexes on `expiresAt` for `auditRuns` and `auditMetadata` are required for this cleanup. They were provisioned and verified in the project; preserve existing index configuration when applying them to another project.

This is an application audit journal. It is not a separately signed, externally witnessed or tamper-evident forensic ledger. Administrators with database privileges can alter storage. It does not prove model explanations are faithful, course facts are correct, or a learning benefit occurred.

## Verification

Tests cover durable progress before provider completion, exact publication boundaries, one bounded repair, unchanged zero-call reuse, journal-outage halt, discarded diagnostic protection, current-version disclosure, account/generation isolation, history pagination, export protection and source refresh. Real Firestore checks and a hosted synthetic model check are reported with executed results in the build log; test transport and real inference results remain separate. Operational limits and open release gates remain in [Production readiness](PRODUCTION_READINESS.md).

## P037 architecture consolidation

Direct preparation, direct investigation, source-change preparation jobs and response-adaptation jobs now share one audited-publication module. It derives the terminal state and protected activity references after the actual commit. Failure-journal writes cannot prevent durable job recovery; post-commit confirmation failures preserve saved work and remain visible to interactive callers or the worker. Structured execution-failure facts survive engine errors and are retained in failed/retrying job records independently of display text.

Journal policy now selects one internal storage adapter per writer. Firestore and synthetic-only SQLite retain the same persistence formats and caller interface, and the same behavioral contract cases run against both real stores. This does not make SQLite a private-account backend or expand retention/capacity. The current default, managed and deployed verification checkpoint is recorded in [Production readiness](PRODUCTION_READINESS.md).
