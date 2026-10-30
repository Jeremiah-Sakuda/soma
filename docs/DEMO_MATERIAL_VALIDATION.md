# Demo material rehearsal — October 30, 2026

Status: testing record, not a production deployment or reliability benchmark. Baseline `afa5675`; isolated branch `codex/demo-material-tests`. Concurrent spatial/UI work was left untouched. No build log or prior judging scores were consulted for this evaluation.

## Inputs and boundaries

Three original synthetic screenshots were authored in `tests/fixtures/demo-material/sources.ts`: a directed weighted shortest-path interview worksheet; a loudspeaker mechanism diagram; and a 440/442 Hz two-tone teaching diagram. No actual LeetCode page, private coursework, licensed recording, microphone audio or native computer interaction was used.

Live generation used the existing Muse integration, Spark composition, Wonder advisory review, deterministic Dijkstra checks and the shared Firestore spending ledger. Voice playback was not tested. Retained output replay is explicitly distinguished from new inference.

## First live pass

| Case | Published result | Calls | Generation time | Recorded cost |
| --- | --- | --- | --- | --- |
| DSA | Checked Dijkstra explanation | 3 | 20.833 s | $0.046391 |
| Speaker | Explanation-only spatial scene | 5 | 33.887 s | $0.076439 |
| Music | Explanation-only sequence/callout panels | 3 | 18.922 s | $0.03695275 |

All three initial artifacts were saved and reopened through the actual Firestore-backed service. DSA source extraction retained all five directed edge weights. Its computed route was A→C→B→D, cost 5; disabling B→D produced A→C→D, cost 11 in the deterministic computation. Speaker review rejected a push/pull wording inconsistency, the author repaired it, and Wonder approved the revised explanation. Music explained the two-per-second beating and matching-frequency case, but produced text panels, not a waveform or audible simulation.

Both contextual model follow-ups failed before making another provider call. Their assembled instructions were 8,081 characters, above the unchanged 8,000-character encoder limit. Initial instructions were 7,479 characters. Commit `cdd0003` compacted shared instructions while retaining grounding, current-state preservation, privacy and assurance constraints. Tests using the real encoder reproduced six failures before the fix; all 56 affected tests passed after it. No limit was raised.

The first pass cost $0.15978275. Shared ledger observations include concurrent work and must not be presented as this test's cost. First-pass ledger moved from $13.3984405 to $13.55822325 against the existing $15 total cap.

## Repeat and admission limits

A post-fix default-store repeat was refused before any inference: the production guest-admission counter had reached 200 for the day (176 turns, zero active generations at inspection). Ledger consumed was $13.66378375. Neither quota nor spending state was reset. This is a real operational limit, not evidence that the fixed follow-up works live.

## Isolated live repeat

The test-only store introduced in `1faa24a` allows at most two synthetic guests and four sequential turns. Only exploration persistence/admission is isolated; actual provider calls, revalidation, the default budget reservation/settlement, and the $15 Firestore cap remain intact. This run does **not** prove production persistence or guest admission. Two offline store-boundary tests and TypeScript passed.

- DSA initial generation failed safely after two extraction calls. Both responses preserved the five edge weights but proposed `neighborOrder: [B,C,D]`, omitting A despite the schema requiring an exact node permutation, and emitted a string `"null"` for change. This is an additional model/schema reliability issue; no invalid artifact was published. It must not be hidden by only showing the successful first run.
- Speaker initial generation passed in 17.123 seconds, 3 calls, $0.03891475.
- Speaker follow-up passed in 28.011 seconds, 4 calls, $0.075817. It retained object positions/sizes, selected coil, separation 0.55 and cutaway 0.2, set side azimuth 90, saved/reopened the revision and preserved the original version. Wonder requested a repair because the first narration implied only the coil could move; Spark corrected it to the attached coil-and-diaphragm assembly and passed review.
- The isolated repeat's ledger delta was $0.138608, including the failed DSA extraction. Shared ledger ended at $13.80239175 in that run.

## Targeted DSA follow-up from retained valid output

A final run reused the first valid synthetic DSA artifact in the isolated store, explicitly charging/counting zero fresh initial-generation calls. The actual follow-up made two model calls, costing $0.04655125, and failed with structured `validation / graph_binding`. Both proposed outputs used the correct changed primary graph and cost-11 explanation, but added a new comparison graph of the original source while the current reuse contract requires the existing comparison input (none) to remain unchanged. The repair did not resolve that mismatch. This exposes a model/instruction/validator contract issue; it is not a wrong shortest-path calculation and must not be called a passing contextual revision.

No further live rerolls were made. Final observed shared ledger: $13.848943 of $15. Approximate spend attributable to these test windows was $0.345 (including the failed extraction's ledger delta); this is an application-ledger observation, not a provider Billing balance. Known artifact/failed-follow-up records account for $0.32106575, plus the failed extraction window's $0.02387625 delta. No budget or admission limit was raised.

The instruction-length fix is verified offline and by the successful live speaker follow-up. DSA remains **not ready for an unrehearsed live demonstration** until the extraction shape and comparison-preservation contract are resolved and retested.

## Render checks and manual review

The retained initial outputs were rendered at 1280, 620 and 375 px with Chromium/WebGL and reduced motion: **9 passed, 6 skipped** (the missing follow-up artifacts were not substituted). The enhanced replay advances the DSA trace twice, captures 2D, then opens 3D; speaker controls exercise separation, cutaway and side view. Assertions cover JavaScript errors and horizontal overflow, not every visual defect. An earlier render pass also passed the same nine initial-artifact cases. The isolated-repeat speaker initial and revised artifacts then passed all six renders (three widths each; nine absent non-speaker cases skipped).

Manual inspection favors the DSA **2D** view: its route/frontier changes remain readable at companion and phone widths. The current 3D view compresses the graph and overlaps some labels; it is not automatically a better explanation. Speaker geometry is schematic primitives, not recovered dimensions or a checked physical simulation, and side-view labels overlap. Its wording “reverses force and motion” should be refined: reversing force does not establish an instantaneous velocity reversal. Advisory model approval did not catch that nuance.

Full-card test captures can include the fixed question composer partway through the image. The replay disables live inference and shows development banners; these are test conditions. They are not suitable as final marketing screenshots without a dedicated recording pass.

## Demo recommendation

Preferred demo after the above reliability fixes: DSA. show the tempting cost-8 discovery, the later cost-3 improvement, then a changed edge and contextual explanation. Retain 2D as the clearest primary view. A speaker cutaway can demonstrate breadth after camera/label and explanatory wording polish. Keep music conditional until a dedicated waveform/audio interaction exists; the current test does not substantiate that experience.

These are development examples, not held-out benchmark cases, a pilot, or a claim of broad source coverage. A final rehearsal should use the exact intended source, final UI build, narration, timing and follow-up once production admission permits it.

## Reproduction and local evidence

- Live harness: `tests/providers/demo-material-live.test.ts` (explicit `SOMA_DEMO_MATERIAL_LIVE=true`; source/case filters and output root supported).
- Replay: `SOMA_DEMO_REPLAY=.local/demo-material/first npx playwright test --config playwright.demo.config.ts`.
- First outputs/audits: `.local/demo-material/first/`; quota-blocked repeat: `.local/demo-material/repeat/`.
- Isolated-repeat results: `.local/demo-material/isolated-repeat/`; retained-artifact DSA follow-up: `.local/demo-material/dsa-followup/`.
- Screenshots: `.local/demo-material/first/renders/` (ignored local artifacts).
- Do not publish keys, sessions or private learner/source data with test outputs.
