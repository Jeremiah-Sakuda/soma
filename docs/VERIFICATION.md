# Verification record — October 29, 2026

Headline results from executed checks on clean checkouts and on production. These are small development samples, not reliability rates:

- **Source reading:** 8 of 8 fresh original graph images (3–4 nodes) were read exactly, and the results matched an independent Floyd–Warshall reference. The full frozen set produced 12 of 13 intended outcomes.
- **Varied screenshots:** of nine screenshots (three real public pages and six original test images), 8 produced a source-specific explanation or a clarifying question on the first request ([details](GENERAL_SCREENSHOTS.md)).
- **Engineering:** the October 30 polish release passed clean CI with 1,396 offline tests (89 opt-in skipped) and all 116 browser journeys. Browser journeys cover the weighted comparison, cost experiment, companion layout, replay and label geometry.
- **Release identity:** `node scripts/verify-release.mjs` matches a committed source tree to the deployed app.

The sections below give the method, every failure and the limits.

## Fixes from internal review

Before release, AI-assisted internal reviews scored the product against the judging criteria. We fixed the six ranked issues they found, then iterated on the experience (see the last section). Other limits are listed under "What these checks do not establish".

- Ordinary auto follow-ups reuse the effective current graph. Application validation rejects restoration of source defaults, changed goals, re-enabled connections, changed costs or an unexpected comparison. Two service regressions exercise attempted BFS/weighted resets; a successful changed-input response is persisted and reopened. Original versions remain immutable.
- Weighted undirected edges have no arrowheads. Path highlighting matches either stored orientation. Directed edges retain direction, and weighted self-loops have visible curves.
- Explicit BFS and explicit unit weights select the same queue animation as implicit BFS. A weighted FIFO comparison remains labeled as ignoring costs; Dijkstra remains a priority-state rendering.
- At 620×704 the comparison shows one selectable graph and both full-route costs, with the experiment action nearby and a fixed question composer. The measured prepared weighted page fell from 3,637px to 1,961px; the composer starts at y564 rather than y2919, and the graph fits above it. These are browser content measurements, not actual macOS window/chrome measurements.
- Failure records retain bounded stage/validation codes without storing raw provider prose, image pixels or private reasoning. Explanation-only steps require null computation bindings. Stage-specific source instructions fixed a reproduced attention-slide tool omission; the original synthetic attention slide then published as explanation-only. Earlier failed attempts remain counted.

## Offline and clean-source checks

Pinned dependency installation completed with `npm ci`, including the two isolated services. TypeScript, production build, four desktop policy checks and an isolated production browser import passed. The import inspected 1,224 traced files and two links with zero private-configuration mappings.

The complete offline suite passed **1,360 tests**, with 89 opt-in tests skipped across 143 files (108 passed, 35 skipped). Skips do not establish provider/native behavior. The default suite never uses another developer's credentials.

The first broad browser run included six timeouts during overlapping CPU/build activity; its output is retained privately. All six passed in a separate rerun. The final full batch, with four workers and no concurrent build, passed all 101 browser journeys. No all-green first-run claim is made here.

## Fresh source evaluation

Before provider calls, 13 new original synthetic cases were frozen with SHA-256 `22cf4ca98cc1360db17905ec5488eb82b2bc66180c810b32918a5797c57b34ed`. Inputs and first-request results are in `tests/fixtures/exploration-source-evaluation/`. Each case had one outer request, with only the service's bounded internal repair. The answer key was not supplied to the model.

- Eight graphs: all published with matching nodes, edges, direction, start, goal and costs; numerical outcomes matched an independent Floyd–Warshall reference. Cases include reverse traversal, zero/fractional costs, ties, cycles and disconnection.
- Two general processes: gradient descent and instruction pipelines published as explanation-only. Their text was reviewed against the synthetic source; this is not an external expert evaluation.
- Blank material returned clarification.
- A negative-cost graph remained explanation-only and explicitly rejected nonnegative-solver applicability.
- The deliberately missing-cost graph failed publication after an artifact-identity validation error. This was safe rejection, but it did **not** provide the desired clarification. Do not count it as a successful explanation or silently omit it.

Thus 12/13 requests published the intended artifact/refusal category; 10/10 fully legible supported sources published. This small development evaluation is not a general success-rate estimate. The cases are now disclosed development evidence, not future held-out tests. Recorded provider cost for the 13 requests was $0.496014, including the failure. All spending and retained reservations remain in the shared $15 total allowance.

## What these checks do not establish

They do not establish learning improvement, fidelity on real coursework, or live-model reliability across arbitrary subjects. Clean-Mac installation, native screen and microphone consent, multi-display and fullscreen capture, and audible narration quality are being checked by hand. The existing arm64 shell passed notarization/stapling/Gatekeeper; this source snapshot does not contain a signing key. A fresh unsigned package is not the notarized distribution artifact.

## Reproducibility

`node scripts/verify-release.mjs` compares 202 runtime files against `public/release.json`. The same manifest ships with the hosted app so a source checkout can be matched to production. Private prompts, source documents, credentials, captures, learner records and local build history are excluded from this repository. The source privacy scan checked configured server-secret values and excluded-file patterns; that is a targeted check, not a comprehensive security certification.

## Experience update, October 29 evening

Focused offline tests cover removed-probe-edge/cleared-goal follow-ups, source/version preservation, save/reopen, replay ownership/no inference, weighted tentative-cost improvement and final-state equality, cost-label geometry and configured concurrency. The final complete offline suite passed 1,374 tests (89 opt-in skipped). Typecheck and the production build passed. Five browser journeys passed for weighted comparison, keyboard cost experiment, 620×704 companion layout, replay/save/resume and label geometry at desktop/companion/phone sizes. The complete browser batch passed 104/105; the remaining failure identified duplicate audit text, which was consolidated. All 20 affected exploration/replay browser journeys then passed, including the previously failing case. The added weighted narration test passed in the full batch. GitHub CI and final hosted checks are recorded separately when completed. Earlier failed sandbox HTTP-server starts and first layout/harness failures are not counted as passes.

No student trial, new video, word-aligned speech, arbitrary-topic checked simulation, native audible-quality test or new training result is claimed. [Student observation kit](STUDENT_TRIAL.md) and [current demo script](DEMO.md) separate planned evidence from completed checks.

The isolated production browser trace imported successfully with 1,224 files, two links and zero private configuration mappings. Four desktop policy checks passed. The signed native shell is unchanged; clean-Mac permissions and audible narration remain separate human checks.

Hosted PM069 verification passed real model-selected experiments and explanatory follow-ups after either disabling the probed edge or clearing the goal, including changed costs, paired inputs, original source lineage and save/reopen. The recorded run opened/saved/reopened without generation. One new weighted screenshot rejected on its first request; a controlled repeat read all five edges/costs correctly and produced L → M → N (7 versus direct 13). The first rejection cause is unknown; this is not a first-request reliability improvement. The final narrow revision moves version history below the visual, preserving the version badge and earlier-version warning.

## Fresh practice verification — October 30

The saved-exploration flow adds optional original graph variations with server-side solution hiding, immutable answers, recorded hints/reveals and separate actual timestamps. Independent all-pairs relaxation checks 300 weighted/unweighted directed/undirected variations. Focused service/HTTP checks verify ownership, no inference on creation/grading, idempotent retries, reveal-before-answer protection, source/model/version lineage, answer-informed composition and failure preservation, plus deletion/recreation of derived visuals.

The local complete offline suite passed 1,383 tests (89 opt-in skipped) before the last HTTP case was added; all 15 affected service/HTTP cases then passed. All 110 browser journeys passed. The final compact-graph override then passed all four affected fresh-practice journeys, including an actual rendered node-label height assertion at 375 and 620 pixels, keyboard/reduced-motion, reload and failed-save recovery. Typecheck, production build, four desktop policy checks and the isolated browser artifact check passed. Production/live-provider checks and clean CI are recorded after publication, not inferred from these local tests. These are engineering checks, not evidence of improved learning or real student use.

The first published fresh-practice revision passed clean CI 41003567419. A real answer-informed Spark/Wonder response used two calls, 11.404 seconds and $0.03626125, preserving its checked input and attempt lineage. The first hosted harness later timed out on a title wait without stage instrumentation; delayed local and hosted response replays rendered successfully. A separate saved-child/reload regression exposed inconsistent history ordering, reproduced before the fix and passed afterward. The server now returns updated explorations in the same recent-first order as the live UI. All 61 affected service/HTTP tests and 25 exploration/replay/practice browser journeys passed after that correction; final production verification is recorded separately.

The corrected history release passed [clean CI](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41004464496). Its stage-aware production journey passed a real saved fresh answer → Spark/Wonder explanation → unchanged checked input → exact saved-version reopen → preserved original/answer, plus phone legibility (18px rendered node text) and overflow checks. Two model calls took 11.815 seconds and $0.04183075; synthetic artifacts were removed. This is an engineering demonstration, not a learning-effectiveness result. Final handoff polish explicitly focuses and scrolls to the new visual; all four affected browser journeys passed, including heading-in-viewport and keyboard-focus assertions. No additional provider call was needed for this UI-only change.


## Usability and visual audit — October 30

See [executed polish audit](POLISH_AUDIT.md) for observed defects, changes, viewport/keyboard checks, real audio-clock verification and an isolated actual Electron run. The final focused checks passed 62 provider/domain cases and 28 browser journeys after earlier complete offline/browser runs (1,394 tests plus 89 opt-in skipped; 116 browser journeys). First-request attention and autoencoder generation failures remain in the record even though controlled repeats succeeded. No general reliability or learning-outcome claim follows. Publication/hosted identity is recorded below when verified.


### Published PM075 verification

Runtime source [3784227](https://github.com/Jeremiah-Sakuda/soma-hackathon/commit/3784227188f66ebeed38fa26ce33bc37c337f4b1) passed [clean CI 41009103487](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41009103487): 1,396 offline tests, 89 opt-in skipped, all 116 browser journeys, build, manifest, production browser trace and adversarial isolated browser gates. Production dpl_4ZfbJeADmec9cDbys9U2VrVsebN3 serves soma-pm075-2026-10-30. Anonymous source/production manifests match 204 runtime files, SHA-256 799156cb92662ef7366a68e40e701558f2f3ee59d117e23fd02d7e54b0433db7.

The deployed six-viewport audit (320–1440px) had no horizontal overflow, sub-40px visible buttons or page exceptions. A 45-tab walk had no obscured focus; save/fresh-practice/cleanup passed without inference. At 620×704, the prepared weighted graph panel sits at y293.5–525.5 above the composer at y564. Shorter phone views still need vertical scrolling. Exact source-specific live-model results and retained first-request failures are in the polish audit; they were tested on the production build locally, not relabeled as new hosted requests. Shared final testing ledger $7.3758095/$15. The following documentation-only update does not change this runtime or require a new deployment.


## Point & ask — October 30

Pointing adds an interaction-ID-fenced native shortcut, local gesture overlay, release-time screenshot, transcript/source join and normalized focus provenance. Full pre-polish verification passed **1,401 offline tests (89 opt-in skipped)**, **121 browser journeys**, and **13 desktop checks**. After a native replay exposed transient generic-diagram reflow overflow, a new animation-frame regression failed before the correction; all **24 affected exploration/point journeys** then passed. Cards now reflow together with the canvas; step signals still animate. Typecheck, production build and isolated browser trace passed before that CSS-only correction; release checks follow separately.

The compiled native helper reported successful chord registration. An actual Electron overlay/bridge/render/hide journey passed with controlled helper events, original synthetic desktop/audio and replayed actual generation. Two fresh selected-region requests returned the intended distinct program traces and preserved exact focus on save/reopen. This is a small development sample; failed harness UI waits and physical-input/OS-permission/clean-Mac limitations are retained in [Point & ask](POINT_AND_ASK.md). No real student or learning-gain claim.

A stricter manual-upload-during-hold check then reproduced a native-session cancellation gap. Source selection now sends cancellation immediately, before any late native release/capture. All **25 affected browser journeys** passed after this change. Signed package inspection also removed unnecessary compiler caches; only the compiled helper is shipped as an extra resource.


## PM077 release checkpoint — October 30

Public code **be83c63c0f031495256c5e38699863c4be312ab3**, clean CI [41071744426](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41071744426): **1,401 offline passes / 89 opt-in skipped**, **13 desktop checks**, **28 isolated credential-browser checks**, and **123 browser journeys**. Final typecheck, production build, source-manifest verification and isolated runtime import passed.

Production deployment **dpl_7iqYXQRwyUPUGKP2tptkRxJ6XgN3** serves `soma-pm077-2026-10-30`; its complete 214-file runtime manifest matches committed source, fingerprint `f228f56827a1ab7dd28bf0246ba555c5fdac9f6ede0ee738a17870318a70f20a`. The first deployment attempt returned Not authorized; explicitly selecting the verified owner scope/project succeeded. A final actual Electron-to-production bridge/render/hide check passed with synthetic screen/audio/helper events and replayed actual model output, making no new model calls. The first hosted harness incorrectly passed production as a development override and was stopped; the successful run uses the app's fixed production origin.

0.2.0 is Developer ID signed and deep/strict verified, including the shortcut helper. Its app archive contains 27 entries and no compiler cache. Apple notarization remains blocked by the missing local `soma-notary` profile; no new notarized download is claimed. Physical hold/release, microphone quality, capture permission, fullscreen/multi-monitor and clean-Mac installation remain human checks.


## PM086 personal companion integration — October 30

Implemented explicit editable goals/preferences, source-version-linked concept relationships and practice evidence, bounded Muse memory selection/composition, recommended next activities and memory-informed visual follow-ups. Optional native actions use a separate local approval controller and standard macOS Accessibility controls. See [personal companion](PERSONAL_COMPANION.md) and [computer actions](COMPUTER_ACTIONS.md) for exact scope and limits. Coding is a demonstration context, not the product boundary.

After integrating the parallel generation-recovery/progress commit `af78c68`, the final local suite passed **1,495 offline tests (90 opt-in skipped)**, **all 133 browser journeys**, **21 desktop policy/lifecycle checks**, TypeScript and the production webpack build. The memory bounds test uses the actual provider encoder at near-capacity input without making paid calls. Native Swift compilation and an isolated unsigned 0.4.0 package passed; the permission-only probe returned `trusted:false`. No real native field or button was operated.

The opt-in synthetic live test passed actual Muse memory selection → source-linked concepts/next question → personalized checked visual → exact form-fill proposal. It used no private sources and executed no OS action. The successful checkpoint read $11.69797825 consumed of the existing $15 shared cap. Prior strict-tool-schema rejections and conservative reservations remain recorded; this small development case is not a cross-subject benchmark.

Earlier full browser checks exposed a true layout regression (fixed by placing memory in the source area), a hard-coded test port (fixed to use the baseURL fixture), and missing synthetic Firebase build configuration (supplied for the isolated browser build). The final 133-case rerun passed. The local isolated browser-artifact check rejected the externally symlinked dependency directory used to avoid touching the parallel checkout; its guard remains intact. Clean-install CI must independently verify the production trace. No production deployment, new signed/notarized native distribution or physical Accessibility execution is claimed by this source merge.

Runtime manifest: `soma-pm086-2026-10-30`, 245 files, SHA-256 `c5d27a62fa5f41a7f961564ea95e5f6505a286e068978d2f75b5266be02a52d7`. Final remote branch/CI evidence follows separately.

The later parallel `24ec4b5` source/review format-recovery change was also integrated; only the generated manifest conflicted and was regenerated. All 82 affected source/review/memory tests and TypeScript passed afterward. The full clean-install CI gate is run on the combined main revision.
