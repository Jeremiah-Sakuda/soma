# Demo rehearsals — November 4, 2026

These records distinguish actual model generation, replay of retained model output, deterministic interactions and edited footage. All recordings and receipts remain private under `.local/demo-rehearsal-20261104/`; that ignored directory is not a public demo download. No institutional coursework or credentials were used in these examples. Times in artifact folder names are UTC.

The native recordings use a signed **0.5.0 rehearsal candidate**, not a final notarized release. The browser rehearsal uses the current-source local development app. Neither establishes acceptance of the final published companion.

## Evidence and clips

| Take | Source and runtime | What was established | Private index |
| --- | --- | --- | --- |
| Browser, `19-47-06-087Z` | `ada3c97`; retained Muse examples replayed in local development app | Actual graph solver 7 → 9 → 7; circuit current reversal; exact saved experiment reopening | `browser/clips.json` |
| Native graph, `19-54-18.972Z` | `ada3c97`; actual macOS screen, original synthetic slide in a fullscreen original-slide viewer; live Muse | Source interpretation, checked cost 7, native lift, successful later cut to 9 and restoration to 7 | `native/2026-11-04T19-54-18.972Z/native-clips.json` |
| Native engine, `20-08-23.676Z` | `1d52f46`; actual macOS screen, original synthetic PNG in fullscreen Preview; live Muse | Source-to-model lift and four visible crankshaft poses: 0°, 360°, 630°, 720° | `native/2026-11-04T20-08-23.676Z/engine-clips.json` |
| Native circuit, `20-18-10.826Z` | `1d52f46`; actual macOS screen, original synthetic PNG in fullscreen Preview; live Muse | Balanced native voltage lift; app-panel changes mirrored to native current/voltage; Muse chose R4 and exact balance at 8 Ω | `native/2026-11-04T20-18-10.826Z/circuit-clips.json` |
| Fresh native cold start, `20-42-06.666Z` | `bff7b10`; newly packaged signed candidate, actual Preview source; live Muse | First flat drawing appears; final four-step annotations and free 3D lift work. Flat caption overlaps the bottom toolbar and needs the separate layout fix | `native/2026-11-04T20-42-06.666Z/events.json` and `cold-start-receipt-summary.json` |

Each index records exact paths, hashes, source identity, timing and limitations. Native graph loaded hosted manifest `b41611f8a7b321a8875654d8940711ac58fd7fef1210b7be16ec4402b72069c2`; engine loaded `314195eaa8ae4501de3c98aba6807f0d1109a2e166f86f7314bd8a95b0253175`. Their distinct source versions must remain explicit when footage is combined.

### Browser replay

The successful full clip is 73.36 seconds. Separate continuous excerpts are `graph-7-9-7.mp4` (30.52 seconds), `circuit-current-reversal.mp4` (25.96 seconds) and `saved-exact-reopen.mp4` (9.96 seconds), inside `browser/2026-11-04T19-47-06-087Z/`.

One end-to-end rehearsal passed. Graph D–F weight changed 3 → 6 → 3, with checked route cost 7 → 9 → 7. Circuit R4 changed 8 → 7.2 → 8 → 8.8 Ω, with current zero → B-to-C → zero → C-to-B. Saved and reopened experiment states matched. The test observed no forbidden requests, media attempts or page errors and made **zero new model calls**. Replaying an existing artifact is not evidence of new inference.

Two earlier failed harness attempts remain under `browser/2026-11-04T19-45-54-705Z/attempt-{1,2}/`, with 8.52- and 7.4-second failed clips and traces. The rehearsal harness initially blocked the development HMR connection and discovered its archived script as another test. Corrections were limited to the harness; the passing result does not erase those attempts.

### Native graph

The 700.37-second raw recording is retained. Six separate clips in the take's `clips/` directory preserve original speed:

| Clip | Raw interval | Duration |
| --- | --- | --- |
| `01-checked-graph-seven.mp4` | 117–125 s | 8 s |
| `02-native-lift-off.mp4` | 136.5–149 s | 12.5 s |
| `03-cut-route-seven-to-nine.mp4` | 212–225 s | 13 s |
| `04-restore-route-nine-to-seven.mp4` | 273–286 s | 13 s |
| `failure-01-pointer-attempt-unchanged.mp4` | 194–205 s | 11 s |
| `failure-02-restore-attempt-unchanged.mp4` | 246–254 s | 8 s |

Initial generation took 45.572 seconds of service time and 47.979 seconds measured in the UI. The first pointer attempt left cost 7 unchanged; an early restore attempt left cost 9 unchanged. Only the later excerpts show successful cut/restoration. Do not describe this as a seamless first-attempt interaction.

Later recorded receipts establish two additional live revisions. Muse proposed investigating E–F, with a tie at cost 1; setting E–F to 0 produced checked route A–C–E–F with cost 6, and a subsequent answer used that changed value. Version 3 was saved. D–F was already selected when the investigation began, so this does not establish unselected-context choice. These later panel actions are not independently shown by the six graph clips: the physical display remained on the fullscreen slide during most panel operations.

The main cost and route caption are readable. Some secondary slack labels overlap nearby graph parts. The unchanged source slide still prints 7 when the hypothetical overlay shows 9; narration should make the edge-removal experiment clear. Sampled frames do not show a traveling OS cursor, so use them as screen-state evidence rather than cursor choreography.

### Native engine

The 541.60-second raw recording is retained. Four separate 9.5-second clips preserve continuous action at original speed:

| Clip | Raw interval | Visible result |
| --- | --- | --- |
| `01-source-to-lift-zero.mp4` | 156.5–166 s | Original slide becomes a lifted model, 0° |
| `02-first-turn-360.mp4` | 194.5–204 s | 360°, camshaft 180°, spark cue |
| `03-second-turn-630.mp4` | 225.5–235 s | 630°, camshaft 315°, exhaust cue |
| `04-cycle-complete-720.mp4` | 253.5–263 s | 720°, camshaft 360°, complete cycle |

`clips/engine-editorial-44s.mp4` combines those excerpts with a three-second disclosure slate and three explicit one-second cut cards. Generation and idle waits are omitted between excerpts; shown actions remain at 1× speed. The slate discloses 31.361 seconds of explanation service time and 46.284 seconds of model-generation service time. The first source-to-lift excerpt contains only the final seconds of generation, not an instant end-to-end result.

All four encoded pose frames, labels, spark/exhaust cues and disclosure slate were visually inspected. All five outputs are silent H.264, 3024×2060, 30 fps; the original 3024×1964 viewport is retained with a 96-pixel footer below it. Full editorial decode completed without errors. Original footage was not replaced or retouched.

This is an **illustrative schematic**, not a measured engine simulation. The 0° and 720° geometry looks similar, so retain the angle, turn count and stroke indicator. The brief disclosure slate should be supplemented with narration or a title if generation speed is discussed.

### Native circuit

The raw video is 936.33 seconds (the recording event clock ended at 937.257 seconds) and is retained privately. It uses the same source and hosted manifest as the engine take. The first nine minutes include file-dialog/setup material and are excluded from all excerpts.

The initial question, “Why is there no current through R5?”, produced a live explanation with B and C both at 8 V and zero current through R5. The first ordinary flat overlay did not appear; a later 3D redraw worked. The source-to-lift excerpt therefore does not establish successful first flat drawing. Fix `aa76eb3` now waits for renderer readiness and delivers only the latest valid draw. All 86 desktop tests passed, including delayed-load, stale-capture, load-failure and disposal regressions; the retained circuit rendered correctly offline. This fix is not present in the filmed candidate and still needs a fresh packaged check. The native 3D scene uses checked node voltage as height. Two attempts to click the lifted R2 label did not change the experiment: native resistor connection cylinders and their labels are not pickable. Both failed attempts remain in the raw and separate failure clips. The later successful path uses the actual app panel, visible in the raw footage, while the native drawing mirrors its computed state.

Opening R2 in the app panel produced 0.4138 A through R5. R2 was restored and selection cleared before the next question, “When would current flow through R5, and which way?” Muse chose R4; Soma calculated exact balance at 8 Ω and checked cases on both sides. The published revision records `selectedObjectId: null` and no disabled edges. This supports selection-free published context; no request-body interception was performed.

The recorded app-panel controls then established:

| R4 | R5 current | Native result |
| --- | --- | --- |
| 0.4 Ω | 1.032 A, B → C | B above C |
| Exactly 8 Ω | Zero | B and C both at 8 V |
| 25.6 Ω | 0.2429 A, C → B | C above B |

Version 2 was saved at R4 = 25.6 Ω. The saved-state artifact supports that state; this take does not establish an exact reopening. Raw samples around 858, 888 and 906 seconds show the app panel, and samples at 872, 896 and 919 seconds show the resulting native view after the panel is hidden. Do not describe these as native resistor clicks.

The take's `clips/` directory contains these separate, silent, original-speed excerpts:

| Clip | Raw interval | Duration |
| --- | --- | --- |
| `01-balanced-native-lift.mp4` | 640–674 s | 34 s |
| `02-panel-r2-open.mp4` | 731–750 s | 19 s |
| `03-r4-low-b-to-c.mp4` | 854–864 s | 10 s |
| `04-exact-eight-zero.mp4` | 885–895 s | 10 s |
| `05-r4-high-c-to-b.mp4` | 901–911 s | 10 s |
| `failure-01-native-label-no-change.mp4` | 676–687 s | 11 s |
| `failure-02-native-label-no-change.mp4` | 701–712 s | 11 s |

`clips/circuit-editorial-35s.mp4` contains the three 10-second R4 excerpts, a three-second generation-wait disclosure and two one-second cut cards. It discloses 37.582 seconds of explanation service time plus 33.489 seconds of investigation service time. All clips retain the original viewport with a provenance footer. Encoded current/balance endpoints and panel visibility were inspected; the full editorial decoded without errors. R4 controls are visible in the chosen excerpts. The R2 excerpt establishes a panel-present change and resulting native state, without claiming its exact button is readable throughout. Retain the panel-control limitation when editing.

### Fresh packaged cold-start verification

The `20-42-06.666Z` take uses a newly packaged signed 0.5.0 candidate at `bff7b10efc56ab8fb645890c691f7611d5c606f9`. Its hosted/local release manifest matched `f922a281a03c47d03ba492901f27f669084a72115f137187098210ead5414191` (`soma-rehearsal-recovery-2026-11-04`). It uses the same original circuit PNG in actual fullscreen Preview. The raw recording stopped normally at event-clock 194.440 seconds and remains private.

A fresh live “Why is there no current through R5?” generation took 46.966 seconds of service time, four provider calls and $0.0610605. The first flat step now visibly annotates D = 0 V (`cold-start-first-flat.png`, around 94 seconds); the final step shows the node voltages and branch currents (`cold-start-final-flat.png`, around 121 seconds). The ordinary first-draw cold-start failure is therefore verified as recovered on this packaged candidate. It is not inferred from a subsequent 3D redraw.

The same screenshots also reveal a separate defect: the flat explanation caption overlaps the bottom toolbar and extends beyond the visible area. These are valid cold-start evidence, **not clean flat-demo footage**. The caption-layout fix is being developed offline after this recording, without another live generation; it is not present in the filmed candidate and still requires its own verification. The later free 3D lift is visible and settled in `cold-start-lift.png`, with a readable caption. No additional editorial was created for this take; the original raw, receipt and screenshots retain both the success and the remaining defect.

## Model use and allowance checkpoint

Eight admitted exploration generations produced the following retained Meta receipts. A generation can contain multiple provider calls; the daily exploration allowance counts admissions, not each provider call.

| Generation | Provider calls | Service time | Recorded cost (USD) |
| --- | ---: | ---: | ---: |
| Graph initial explanation | 5 | 45.572 s | 0.09191875 |
| Graph investigation | 3 | 46.855 s | 0.04970050 |
| Graph contextual follow-up | 2 | 15.933 s | 0.03718550 |
| Engine explanation | 3 | 31.361 s | 0.04384975 |
| Engine model | 2 | 46.284 s | 0.05463850 |
| Circuit initial explanation | 4 | 37.582 s | 0.05753700 |
| Circuit investigation | 3 | 33.489 s | 0.04178175 |
| Fresh packaged circuit cold start | 4 | 46.966 s | 0.06106050 |
| **Total** | **26** | **304.042 s** | **0.43767225** |

Receipt sources: `native/2026-11-04T20-08-23.676Z/rehearsal-receipts-summary.json`, the circuit take's `circuit-receipts-summary.json` and `circuit-investigation-summary.json`, and `native/2026-11-04T20-42-06.666Z/cold-start-receipt-summary.json` (full artifact `cold-start-circuit-v1.json`). This total excludes narration and is not the project's lifetime spend or provider billing balance. Clip encoding and the browser replay added no inference cost. The existing companion session had 12 of 12 admissions available at 19:54:21 UTC, then 7 before the circuit take and 5 before the fresh cold start. Its last recorded allowance check at **20:45:02.502 UTC showed 4 remaining** after these eight generations. This is a dated checkpoint, not a guarantee of the current remaining allowance. No allowance reset or limit increase was performed for this record.

## Failures, privacy and remaining checks

- **Physical held-button drag/reset remains unverified.** Passive engine input capture showed a trusted press followed by a move with `buttons=0`, triggering the intended lost-release cancellation. An alternate Preview-target attempt delivered no overlay events. These automation attempts do not demonstrate successful physical drag or establish that a human held-button drag is broken. Keep the guard; verify with an actual held-button interaction.
- The graph's first-click/hover issues motivated `07344ff`; its renderer/controller checks do not replace acceptance on the packaged candidate. Engine pose changes do not establish graph pointer acceptance after that fix.
- The fresh `bff7b10` packaged take closes the first-flat-draw recovery check. Verify the separate caption-layout fix and retain the overlapping-caption frames as evidence of the remaining defect; the later readable 3D caption does not establish flat-layout acceptance.
- Complete final paired hosted/companion acceptance after the accepted source freeze; verify signing/notarization and final release identity independently of these rehearsal packages.
- Keep raw videos, traces and failed takes. The earlier `native/2026-11-04T19-52-42.927Z/` framing preflight contains private background content and is marked **PRIVATE — DO NOT SHARE**. See `native/PRIVATE_MEDIA_NOTICE.json`. A successful clip review does not clear the entire raw recording for publication.
- Human review and final edit selection remain outstanding. Preserve original synthetic-source labels, replay/live distinctions, illustrative-model scope and explicit cuts. No recording in this document has been publicly published as the final submission.


### Caption repair after the final live take

`8e8ac12` keeps flat captions inside the captured display and above the default compact bar. It preserves a requested placement that fits; otherwise it uses available space beside the annotations and clamps to the viewport. Long captions remain scrollable in small windows. All 25 actual-renderer browser tests passed, including five new cases covering long text, top/bottom anchors, small viewports and positive/negative display offsets. Typecheck, syntax and diff checks passed.

The exact last circuit result was replayed offline in the real renderer: the complete final caption occupies x=931, y=669, width=330, height=169 and ends at y=838, above the default bar starting at y=850. The screenshot and video under `.local/caption-fit-audit/` are explicitly labeled retained-data replay with no new inference. The source background includes a captured earlier bar state; this is layout-test evidence, not a coherent live product take. The fix preserves the adopted appearance. Its 132-pixel reserved band follows the default compact position; it does not track an arbitrarily dragged bar. Final packaged acceptance must include this layout change.
