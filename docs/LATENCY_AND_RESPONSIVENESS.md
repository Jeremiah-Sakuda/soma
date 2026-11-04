# Latency, responsiveness and quality — PM099/PM100

Soma should respond to an interaction immediately while taking the time necessary to produce a correct, useful visual. Local acknowledgement, a model answer and a newly generated scene have different clocks. This release does not claim continuous video understanding, subsecond model generation or word-aligned narration.

## Shipped design

- **Immediate selected-context feedback.** Asking about a new capture opens the focused workbench and shows that frozen input, the actual selected region and the submitted question. This is local input, not an unchecked generated diagram. Setup collapses unless an active screen share needs its controls. Cancel stays visible and returns the initial draft to keyboard focus. The generic empty-state card is hidden during work. Status text remains legible; elapsed time no longer inherits the spinner's styling.
- **Compact continuation when the existing visual suffices.** Ordinary follow-ups already reused source interpretation. Spark may now return a bounded continuation rather than rewriting geometry, source metadata and computation. The application binds the current source, existing panels/objects/connections/positions/controls, effective primary/comparison inputs and next version. Assumptions, focused explanations and follow-ups are model-authored. Uncertainty and unsupported-claim records persist. All normal validation/binding checks and the applicable Wonder policy still run; no speculative scene reaches the UI.
- **A checked answer belongs to the visible snapshot.** A compact checked reply contains exactly one primary step, bound by the provider schema and application validation to the current trace index. Otherwise the compact branch is unavailable or rejected. This avoids generic replay before the actual answer. A view beyond the primary trace uses the full path. Inputs, disabled edges, goal, edited costs, comparison and source identity remain authoritative.
- **Keep the complete path.** A new source, new visual, content correction, missing context or uncertainty can still require full composition or clarification. No reasoning-effort reduction, dropped numerical check, lowered review budget, training job or new provider. One contract repair and one factual repair remain bounded by the existing six calls/90 seconds/$0.35 reservation.
- **Stronger source-fidelity review.** Review explicitly covers clarification questions and any embedded suggested answers. An unreadable source legend/label cannot be identified by a typical visual convention. A new schematic derived from visible prose must be distinguished from the unreadable source figure. Ambiguous clarifications also receive review when source uncertainty exists. Model review remains advisory and fallible.

## What the profile showed

In PM097's six-source repeat, source interpretation took about3.6–5.5s, initial composition5.3–10.4s and review1.8–7.6s. Some cases needed an additional author/review pair. The27.956s median was for new screenshot explanations, not ordinary follow-ups. Avoid comparing that directly with warm-continuation timings.

A three-case comparison used exactly the same question and source contexts in isolated owned guests: “Explain the key relationship more simply using the current diagram.” Closures and biology were replay-seeded genuine prior public-source artifacts; the weighted graph was an explicitly prepared fixture. Only the continuation was new inference. Reference facts were not supplied as hidden hints. Seeds are not counted as fresh screenshot generations or new user observations.

| Context | PM097 full-authoring baseline | Initial compact prototype |
| --- | --- | --- |
| Closures | Rejected after14.832s |7.337s,2calls,851output tokens |
| Biology |12.104s,2calls,1844output tokens |7.474s,2calls,720output tokens |
| Weighted comparison |12.102s,2calls,2517output tokens |9.760s,2calls,1422output tokens |

All three initial compact results preserved scene and source exactly, passed actual Wonder review, and saved/reopened exactly. The baseline was2/3published; the original closures rejection cause was not recovered before its guest cleanup. It is not treated as a successful latency sample. These are small sequential development observations, not an unbiased production benchmark. The weighted prototype preceded the stricter visible-snapshot rule; final measurements are recorded below rather than silently substituting them.

## Quality challenges and retained failures

PM100 made quality a release condition. Additional questions challenged a false premise, an unreadable legend and the need for a different diagram.

- The first false-premise answer correctly stated that enzymes do not changeΔG.
- The first unreadable-legend response admitted the crop but still guessed a typical curve style. The first regenerated diagram likewise attributed a curve style without a readable legend. Both full-path answers received Wonder approval; manual inspection flagged the weaknesses. They are not reported as quality passes.
- After the source-fidelity changes, the repeated legend request declined to read the missing labels and requested a clearer source. The repeated new-diagram request used full composition. Wonder caught the unsupported curve-style attribution, required repair and approved a schematic explicitly grounded in the visible text rather than the cropped figure. That turn took26.420s/four calls. This slower correct result is intentional.
- The repeated false-premise answer retained the correct distinction between activation energy and unchangedΔG. All three final quality-challenge artifacts preserved source lineage and passed exact saved readback. Their timings12.828s/9.823s/26.420s demonstrate why response complexity and correction must remain visible in latency reporting.

An initial compact graph reply could target a later snapshot and therefore begin playback with solver narration instead of the requested answer. The final contract now binds a single current primary snapshot; current-state and adversarial tests cover it. No existing graph is silently advanced to make a reply fit.

## Availability discovered during testing

The shared guest-admission counter reached200 new guests on October30, while paid turns were176 and consumed model spend was$13.66378375. Two subsequent guest-init requests returned429 before inference; no test guest existed to delete in those attempts. Counters were not reset. Session admission is now separately bounded/configurable with `SOMA_EXPLORATION_MAX_GUESTS_DAY`: default1000, valid1–5000, malformed values fall back to1000. The paid-turn cap remains200/day, concurrency remains unchanged and the shared lifetime model cap remains$15. Existing sessions remain accessible at the admission cap. This allows prepared/no-inference use without increasing model authorization.

## Verification and remaining direction

Final executed counts, deployed identity and final measurements are appended below. Tests cover full-scene fallback, source-change rejection of compact output, invalid references, substantive-review failure, strict no-input/no-source/no-geometry edits, changed weights/disabled edges/no goal/comparison, current-snapshot binding, bounded admission, cancellation, native circle feedback, first-source visibility, keyboard focus and reduced motion.

Meta documents that [streaming changes when output becomes visible rather than total generation time](https://dev.meta.ai/docs/cookbook/streaming-responses), and that [reasoning effort affects latency](https://dev.meta.ai/docs/reasoning). We did not simply expose partial JSON or lower effort. Streaming reviewed units and audio, or preparing a small complete scene before optional enrichment, are further experiments—not shipped capabilities. Provider caching may help repeated prefixes, but no cache-hit or cold-start benefit is claimed here.

The next latency target is the time to a useful, checked response. Fresh screenshots still require interpretation and a new composition; a complex or uncertain request may correctly remain slow. Do not trade source accuracy, diagram adequacy, state continuity or review for a benchmark number.

## Final candidate measurements and quality evidence

The final source/clarification review and current-snapshot contract were enabled for this repeat. Same contexts/question as the baseline; all three published, used compact continuation, preserved the complete scene/source exactly, received actual Wonder approval and saved/reopened exactly.

| Context | Baseline | Final candidate | Final total output tokens |
| --- | --- | --- | --- |
| Closures | Rejected14.832s; not a successful timing |12.525s,2calls |1213 |
| Biology |12.104s,2calls |11.442s,2calls |1039 |
| Weighted comparison |12.102s,2calls |7.522s,2calls |836 |

The weighted case was about38% faster in this observation; biology was about5% faster. The final three-case median was11.442s. General follow-ups were **not consistently as fast as the early7-second prototype**: final review alone took5.1–5.9s for the two prose subjects. There is no basis for a general2× speedup or a near-live fresh-generation claim.

A separate harder weighted case disabledS→A, changedS→Goal from10 to2, cleared the goal and inspected step2 withC selected. The final actual reply correctly explainedC/Goal's cost2 tie using declared neighbor order, bound its only step to primary snapshot2, retained both effective computations/source/geometry, and saved/reopened exactly. It took10.373s/two calls. Source assumptions explicitly retained the edits; the original source still says cost10. No defaults were restored.

The final local-input receipt appeared in399ms in a Chromium production-build observation, **before any server generation response**. It fit above the fold at620×704/375×704 with Cancel visible, no horizontal overflow or page errors, and retained/focused the question on cancel. This measures local acknowledgement including browser automation overhead, not model generation, physical-Mac or microphone latency. The initial853ms observation exposed the below-fold placement; the layout was corrected and rechecked instead of reporting that as a usability success.

Final local checks:1539offlinepassed/93opt-in-skipped,137Chromium,21desktop-policy and3synthetic-relay; typecheck, optimized webpack build and isolated trace1339files/0links/0privateconfigurationmappings. Source identity: `soma-pm099-2026-10-30`,247files, SHA-256 `0cc02ce97fd03e355260fe01566fd6191107dc6650fb92eae6cd05b82d79daf3`. Runtime output replays and clean CI/hosted evidence are recorded below after completion.

Final aggregate read2026-10-30T21:50:12.313Z:205guests/180turns/0active; consumed$13.9676615 of the unchanged$15lifetime cap. All actually created test guests were deleted. The admission-limited attempts created none and made no model call. Private evidence stays in `.local/pm097/latency-*` and `render-latency-*`; all original failures and earlier profiles are retained.

## Hosted acceptance

Implementation `3ff6374` deployed through the original private repository's existing [Vercel integration](https://vercel.com/jeremiah-sakudas-projects/soma/ETSUGPBaaTSiZcjqhX3DMZjAZ8Gi). Production's247-file manifest matches the SHA above. Actual hosted prepared-state persistence/rate controls and620/375render passed without inference. A separate real hosted edited-graph continuation completed in9.296s/two calls, passed Wonder, preserved scene/source/effective inputs, and saved/reopened exactly. Its single primary step2 correctly explained the cost2 tie betweenC andGoal using declared order; source still records the original cost10. All resulting test guests were deleted.

The hosted local-input receipt appeared in391ms with generation blocked before the backend; no model/speech charge. Cancel/draft/620-and375-width rendering passed without page errors or overflow. Six retained final outputs (ordinary continuations, edited graph, clarification and new diagram) passed local production renderer replays; the actual hosted graph result also passed a labeled response replay through the deployed renderer. These are render checks, not extra live generation. Physical Mac/cursor/microphone and audible-quality claims remain separate.

Final ledger snapshot2026-10-30T21:55:01.125Z:$13.99902475/$15,208created/181turns/0active; no reset/raise. Owned local servers stopped. CleanCI41134296347 is recorded after completion below.

## Clean verification completed

[CleanCI41134296347](https://github.com/Jeremiah-Sakuda/soma/actions/runs/41134296347) succeeded on `3ff6374`:1539offlinepassed/93opt-in-skipped,137Chromium,28isolated adversarial-browser,21desktop,4credential diagnostics and3relay. Default Next production build and isolated trace1224files/twolinks/0privateconfigurationmappings passed. The local webpack trace1339/0links is a distinct build result. This supersedes earlier pending-CI notes. Runtime source and hosted acceptance above remain unchanged; no further model calls were made for this closeout.
