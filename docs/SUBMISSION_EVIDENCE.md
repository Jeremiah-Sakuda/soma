# Submission evidence and production handoff

November 1, 2026 positioning update, revised November 2 for checked circuits. Supersedes the PM129 map built around the S/M/N/T worksheet and the engine opening (kept in git history). Internal support for the [script](DEMO_VIDEO_SCRIPT.md) and [submission copy](SUBMISSION.md): it keeps production facts out of the pitch while making each claim reviewable. It does not introduce a learner-study prerequisite for Impact.

Paths under `.local/` are private local artifacts: real runs kept for review, not published.

## Claim-to-evidence map

| Pitch claim | Evidence available | How to show it |
| --- | --- | --- |
| Muse Spark reads the slide into a typed graph, including where nodes and weights sit | Live hero runs on the original Lecture 14 slide (`.local/pm132/hero-live`); the **Source & assumptions** panel; 13 of 13 fresh original graph images read exactly across two frozen sets, 3–12 nodes ([verification](VERIFICATION.md)) | The live take; open Source & assumptions only if asked |
| Routes, distances and the tipping point are computed, not generated | Solver tests: Dijkstra against exhaustive simple paths, BFS against reference traces ([tests/domain](../tests/domain)) | Burned-in labels; never narrate a value that is not on screen |
| The checked search is drawn on the slide itself | Native overlay on the real Preview window: alignment across rounds and a clean final frame (PM139–PM153) | The live take, Preview full screen |
| Cutting a connection changes the route with no model call | Live hero runs: cutting D–F gives A → C → E → F, cost 9 | Click D–F on the slide; hold on the result |
| Muse chooses the experiment; Soma proves where it flips | Live hero runs: Muse picks A–F, tie at 7; a second question picks B–D, tie at 3 | **Investigate my question** and the slider |
| Wonder catches mistakes before they reach the learner | Retained review that sent back a step settling two vertices at once (`.local/pm132/hero-live/review-3.json`) | Show it from the recorded take's own audit if present; otherwise label the receipt "earlier live run, same slide" |
| An exploration can be kept and practiced | Exact save and reopen in service checks ([PM126 record](examples/pm126/JUDGING.md)) | Save, reopen, **Try a fresh example** (not yet verified on the hero exploration) |
| In 3D, heights are checked distances and slack is exact | Geometry tests (`desktop/test/lift-geometry.test.cjs`); headless renders over the slide (`desktop/test/lift-harness.cjs`); a live run on the real screen through the compact bar, including a re-check while lifted (`desktop/test/compact-live.cjs`, frames in `.local/compact-live-3d` and `.local/compact-live-debug`) | Lift on the hero slide; needs a signed companion release that includes the 3D lift |
| A second subject is checked live: DC circuits | A frozen set of six fresh original circuit slides (two sources, a current source, kΩ and decimal values, unmarked ground, ground on +), all read exactly and solved to the key; a capacitor circuit correctly not read as checked, though its explanation was not published ([verification](VERIFICATION.md), `tests/fixtures/source-evaluation-v2/`). Two live service runs on the original Lecture 9 slide (`.local/circuit/live`, `tests/providers/circuit-live.test.ts`): exact reading both times (five resistors, battery polarity, ground), B = C = 8 V and exactly 0 A through R₅, Wonder approved; a live investigation in which Muse chose R₄ and Soma found exactly 8 Ω, verified by re-solving. Solver tests against independent formulas and Kirchhoff/Ohm on 60 random circuits (`tests/domain/dc-circuit.test.ts`); snapping within 6 px of the drawing for both live placements (`tests/server/circuit-snap.test.ts`); browser journey with a scripted provider (`tests/e2e/circuit.spec.ts`); a live run of the page itself against a local server (upload, read in 24 s, drawn on the slide with Wonder reviewed, then Find the tipping point: Muse chose R₄, Soma found exactly 8 Ω, and the slider reversed R₅'s current on the slide) | The 2:16–2:31 circuit beat, live on the slide |
| Students are the first beneficiaries | The working journey on a lecture slide; the builder's own study workflow (README, "Why Soma exists") | The on-camera open and close |
| The same capability reaches diagrams beyond the classroom | The circuit path reuses the capture, reading, review, drawing and companion unchanged; the graph solver is generic to weighted graphs; 13 of 13 fresh original graph images read exactly; 8 of 9 varied screenshots, including real public pages, a spreadsheet and a circuit, got a source-specific explanation or clarification ([general screenshots](GENERAL_SCREENSHOTS.md)) | **Potential only** until an original non-course map has been run live (Variant A). Public copy frames this reach as potential ("could"); after a verified take, it may say the map was shown |
| This could reduce setup between a question and an experiment | The working source → change → consequence → kept-result sequence | Describe the potential and show the interaction; no invented minutes saved, grades or adoption |
| The implementation is substantial | November 1: 1,770 offline tests passed (104 opt-in skipped), 59 companion unit tests and both Electron smoke tests; release fingerprint (`node scripts/verify-release.mjs`) | Keep detailed results in the repository; don't spend the opening on test counts |

## Footage inventory

| Asset or sequence | Current status | Production use |
| --- | --- | --- |
| Original Lecture 14 slide (`docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf`, `public/examples/lecture-14-dijkstra.png`) | Exists; original material made for the demo | The hero source throughout |
| Hero journey on the native overlay | Verified live (PM132, PM139–PM153); final narrated take not recorded | The 0:10–2:12 capture |
| On-camera open and close | Not recorded | Two short pieces to camera |
| 3D lift on the hero slide | Verified live through the compact bar in an unreleased build; not filmed | The 2:12–2:21 beat after the companion release |
| Original Lecture 9 bridge slide (`docs/examples/hero-circuit/Lecture-9-Bridge.pdf`, `public/examples/lecture-9-bridge.png`) | Exists; original material made for the demo | The 2:16–2:31 circuit beat |
| Circuit beat on the native overlay | Verified live through the service and on the page against a local server; the native run on the real screen is written (`desktop/test/circuit-live.cjs`) but needs an unlocked screen; not on the hosted app; not filmed | After the branch is deployed |
| Non-course map | Not created or run | Potential only |
| Soma lab engine | Hosted recorded Muse run | No longer in the cut; labelled as recorded wherever shown |
| Final three-minute narrated edit, captions and video URL | Not produced | Assemble, review and upload only when authorized |

## Recording order

1. Release the companion build with the 3D lift and record both release IDs.
2. Deploy the checked-circuit build and run the Lecture 9 slide once on the real screen through the companion; check its values against the script before filming.
3. Capture the hero journey in one continuous take, keeping the uncut take and its measured waits.
4. Capture the 3D lift on the same exploration, then the circuit beat on the Lecture 9 slide.
5. Record the on-camera pieces, then the voiceover from the locked script, adjusting to the actual footage and never the other way round.
6. Assemble the 3:00 cut, label shortened waits with measured times, and burn in captions.

## Final review

One reviewer should be able to answer, from the cut alone: who is this for first, what can they now do, what did Muse decide, what changed when they acted, and how far could this reach?

Separately verify the final source, video and live-product links and the native release status. The repository remains private until publication is authorized. No final video upload, submission receipt or public release is established here.
