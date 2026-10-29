# Soma visual-exploration implementation

Adopted October 29, 2026 by P084. This is the public implementation and acceptance record for the new direction; the detailed local planning proposal remains ignored. The goal is a working product to iterate on, with the October 31 feature freeze and November 4, 9 PM America/New_York deadline preserved.

## Product and release priority

Soma turns selected visible context into an explanation a person can explore. The core journey is selected window/screenshot → question → Muse-generated visual composition → meaningful manipulation → contextual follow-up → saved exploration. Source setup, full-semester ingestion and institutional login are optional background capabilities, and no longer launch prerequisites. Existing Today, Map, Activity, accounts, sources and working lessons remain available.

One checked family is breadth-first search on small unweighted graphs. Original synthetic examples establish the first slice; suitability for the owner's actual course must be checked separately. Explicit node order, direction, visited-on-enqueue behavior and termination-on-goal-dequeue define the model. A* and additional scientific families are deferred. Broader visual explanations carry explanation-only assurance; unsupported/illegible requests can ask for clarification. Checked computation does not certify every generated sentence or establish a learning benefit.

## Implementation milestones

| Milestone | Scope | Required proof | Status |
| --- | --- | --- | --- |
| M1 | Checked search engine and bounded generated scene contract | Independent reference traces, cycles/ties/disconnected/start=goal, invalid scene/ID/layout rejection | Implemented; 44 domain checks passed |
| M2 | Screenshot + actual Spark → computed feedback → generated scene; `/explore` | Two distinct source-specific compositions; trace bindings and actual tool/cost/latency facts | Implemented; focused and integrated checks passed |
| M3 | Object-aware follow-ups, user controls, immutable revisions, save/resume | Meaningful unscripted change; ownership/generation/cancel/stale-response tests | Implemented; focused and integrated checks passed |
| M4 | Capture/upload/example entry, keyboard/reduced motion, captions and optional voice | Explicit frame sending, stopped capture, permission failure, audio cancellation, judge cookie isolation | Implemented; focused and integrated checks passed |
| M5 | Integrated tests, real held-out inputs, deploy and documentation | Executed release checks, bounded live evidence, clean browser journey, remaining human gates and v1 reuse assessment | Release verification in progress |

Each milestone gets a review checkpoint and focused commits. Tests use original synthetic material; prepared examples, scripted provider tests, live generation and actual user sources must remain distinguishable. Ten original supported inputs have expected facts outside generation prompts; the first two also served compatibility debugging. The final run passed 10/10; see the verification record for the limits of these clean synthetic inputs and retained failures. No synthetic learner event may be inserted into the owner's evidence as a real attempt.

## Architecture and invariants

- Keep the existing React/Next application, Firebase ownership, Firestore persistence and global budget ledger. Add an exploration entry and bounded server pipeline; no agent framework, graph database or native overlay.
- Spark reads one explicitly selected image, extracts a candidate graph/interpretation, receives application-computed search feedback, and composes approved panels, node positions, highlights, state views and narration. A follow-up may revise focus, explanation or a supported comparison. This is model-authored composition; the renderer and computational rules remain authored application code.
- Strict scene specs contain no executable code, HTML callbacks, arbitrary resource URLs, credential access, learner-evidence writes or model-supplied verification/results. Application services bind authoritative source versions and derive assurance.
- Account exploration documents live under the owned account generation and participate in existing deletion fencing. Anonymous explorations use a separate short-lived HttpOnly capability and bounded guest persistence, not the v1 synthetic-workspace serializer. Concurrent publication requires the current revision/lease; cancellation cannot publish late content.
- Raw screenshots/audio are transient by default. Persist authorized derived observations, artifact versions, control state and concise run facts; do not log media bytes, private provider text or internal reasoning. Captures are sent only on Ask/Refresh, and sharing can be stopped. Provider retention is a separate policy boundary.
- Reuse global inference reservations and actual usage settlement. Each visual turn has bounded calls, time, payload, scene complexity and repair count, with a conservative per-call headroom check. Guest admission/concurrency limits supplement the shared global cap. P084 allows a testing cap up to $5 if the existing allowance is exhausted; do not reset ledger consumption or the 20-percent allocation reserve.

## Voice and browser boundaries

Typed questions and captions always work. Optional push-to-talk sends bounded mono PCM WAV to Muse Voice Transcribe; transcription is not speech synthesis. The initial speech-output candidate is the browser/device speech-synthesis API, explicitly attributed as such and invoked only by a user control. Runtime availability and speech cancellation require verification; no claim of Meta speech-output API access is made. Voice-provider failures must preserve the visual experience.

Selected-window sharing uses browser-mediated permissions with screenshot upload as fallback. The web companion does not draw over arbitrary operating-system applications or continuously monitor a screen. Target-browser capture and real microphone permissions remain separate from synthetic browser fixtures.

## Judging and v1 integration

The demonstration must show actual image interpretation, generated visual structure, checked consequences of an intervention, and a context-preserving model revision. Preserve source/assumption inspection and an immediately usable judge path. Scores, market uniqueness and learning improvements are not asserted.

After the slice works, assess which v1 capabilities improve this journey: selected course passages as context, provenance/freshness, revisitable artifacts, separate exploration/independent-attempt evidence, persistent hypotheses, and change-triggered preparation. Do not reintroduce semester setup as an entry requirement. Record adopted bridges and deferred opportunities with their verification status.

## Executed evidence and operational bounds

See [SOMA_V2_VALIDATION.md](SOMA_V2_VALIDATION.md) for actual provider results, release checks, cost and limitations; [SOMA_V2_V1_BRIDGES.md](SOMA_V2_V1_BRIDGES.md) ranks proposed reuse grounded in existing code. These are the current public records.

The owned session retains at most 24 artifact versions and 40 recent request facts. Deleting an exploration deletes all its versions. Terminal request facts are compacted into bounded audit totals only after the original deadline plus 90 seconds; generating work and its provider lease are never pruned by that compaction. Request-ID replay protection covers this retained window. Immutable scene versions and the global reservation ledger remain independent of compaction.

Guest access expires after 24 hours. The managed Firestore TTL policy for `somaExploreGuests.expiresAt` was enabled and verified ACTIVE on October 29; physical deletion is asynchronous. Signed-in exploration records remain in their account generation until explicit deletion. Guest history does not automatically transfer into an account. Global admission is four concurrent leases, 200 turns and 200 guest creations per UTC day, shared with transcription; each principal has twelve exploration reservations and twelve voice reservations per day. These availability limits supplement the shared $5 testing cap, not replace it.
