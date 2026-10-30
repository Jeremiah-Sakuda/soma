# Soma judging audit October 29 2026

Soma has a substantive Meta-powered interactive engine, but the current experience does not yet communicate its strongest capability clearly enough. The best product argument is a source-specific experiment whose consequences the user can change and inspect. The immediate priorities are preserving that experiment during follow-ups, making its visuals correct, and fitting the interaction into the desktop companion.

The submission package is unfinished: the GitHub repository is private and its published revision does not contain several deployed flagship features. That is a release task before submission, not a reason to make an unreviewed working tree public now.

The accompanying [improvement plan](IMPROVEMENT_PLAN_2026_10_29.md) orders the work against the October 31 feature freeze and November 4, 9 PM America/New_York submission deadline. This audit proposes changes; it does not implement them or authorize GPU training, repository publication, or a broader product pivot.

## Scope and evidence

Three independent subagent reviews covered product impact and differentiation, Meta tooling and engineering, and the visible experience and demo. They used the supplied participant guide and current implementation rather than earlier score estimates. The parent verified release status, ran the full offline suite, and exercised three fresh source-to-visual cases on production.

The active product is the v2 desktop visual companion and web `/explore` path. The inspected deployed snapshot is `dpl_BRWN1WeoRaACbdFWkBRYz3LAkq6m`, with its selected source hashes in `.local/pm061/release-manifest.json`. Relevant exploration files match that isolated snapshot. The root also contains unrelated, unfinished v1 changes; their existence is not evidence that they ship in the primary journey.

Evidence collected during this audit:

| Check | Observed result | Limit |
| --- | --- | --- |
| Current root TypeScript | Passed | Does not prove the public repository reproduces production |
| Full offline unit and service suite | 1,369 passed; 92 skipped across 146 files | Live and optional checks remained disabled; the first sandbox run failed because HTTP fixtures could not bind localhost, then the elevated offline run passed |
| Independent numerical oracle | 1,000 deterministic random graphs matched a separately implemented Floyd–Warshall oracle | Covers Dijkstra costs, not image extraction or rendered diagrams |
| Desktop policy tests | Four passed in the engineering review | Does not test actual OS capture permissions, audible voice or clean-Mac installation |
| Production experience inspection | Prepared examples inspected at 1440×900, 620×704 and 375×812; reduced motion and keyboard behavior checked | The 620px case approximates narrow native content; it is not an actual OS capture test |
| Fresh directed weighted screenshot | Correct source graph and cheapest path, cost 3; published in 10.992 seconds, three calls, $0.03835675 | One original synthetic graph |
| Fresh undirected weighted screenshot | Correct source graph and cheapest path, cost 2; published in 13.229 seconds, three calls, $0.040084 | Rendering still incorrectly displayed directed arrows |
| Fresh attention-mechanism slide | Rejected with HTTP 422, `generation_invalid`, after 7.431 seconds including setup | One attempt; the response did not identify the failed stage, so the cause is not established |
| Equivalent BFS renderer reproduction | Identical computations with implicit/explicit BFS selected animated/static presentations respectively | Zero-network React render check, not a live occurrence rate |
| Follow-up preservation reproduction | Two actual service/SQLite cases published unintended resets, with zero network calls | Proves the application accepts the change, not its frequency with live models |
| GitHub status | `Jeremiah-Sakuda/soma` is PRIVATE; remote HEAD is `08d0eb23f358223cf327721e8fd34dffa4094215` | Checked during the audit; no visibility or remote changes made |

The three fresh source cases used original synthetic material, not existing held-out fixtures or private coursework. Expected graph facts stayed outside model requests. Published artifacts were deleted after inspection. These cases are now development evidence and must not be reused as unseen release cases after tuning fixes.

The shared test ledger reached **$5.20537675 of the approved $15 total**. Its increase during this audit was about $0.0864, including the failed request. Prior spending and conservative reservations remain counted. No GPU job ran.

## Independent assessment against the rubric

The supplied [participant guide](sources/PARTICIPANT_GUIDE.txt) defines the criteria at lines 218–236. These scores are reviewer judgments about the current evidence, not predicted judge scores or placement probabilities.

| Criterion | Weight | Independent score | Defensible range | Main reason |
| --- | --- | --- | --- | --- |
| Impact | 30% | 6.5/10 | 6–7 | Useful, firsthand problem and a plausible wedge; no demonstrated user benefit or actual-course adoption yet |
| Meta tooling | 25% | 7.5/10 | 7–8 | Real vision, bounded experiment selection, computed feedback, composition and advisory review; source fidelity and generalization need stronger proof |
| Technical depth and execution | 20% | 8/10 | 7.5–8.5 | Strong solver, ownership, cancellation, budgets and persistence; important state and visual defects remain |
| Demo | 25% | 7/10 | 6.5–7.5 | Working, inspectable and immediately accessible; too much scrolling, label interference and weak weighted choreography |

The weighted midpoint is **7.175/10**, approximately **7.2/10**. This is a useful prioritization signal, not a calibrated comparison with the field. Impact and Demo together account for 55% of the rubric; adding engineering breadth without improving those experiences would miss the largest opportunity.

Stage One theme and Meta-use fit are credible. Education itself is not excluded, and the checked manipulation goes beyond a simple question-and-answer interface. Nevertheless, the guide explicitly discourages simple education chatbots and image analyzers. The submission must make the executed experiment obvious; changing terminology cannot guarantee classification. The public-repository requirement also remains unfinished.

## What the current product actually delivers

| Capability | Current status |
| --- | --- |
| Explicit screenshot/display context, question and source interpretation | Implemented and deployed. Fresh synthetic image-only graphs were read correctly in this audit. Actual course/native capture remains a separate gate. |
| Generated visual explanations | Initial source composition uses typed, model-authored panels and steps. General explanatory primitives exist; the attention-slide attempt failed in this audit. |
| Checked BFS and nonnegative Dijkstra | Implemented, independently tested and deployed. This is one related algorithm family, not arbitrary checked simulation. |
| Model-selected edge-cost investigation | Implemented and live-verified. Spark selects an existing edge, Soma computes interventions, and a bounded copy tool authors the explanation around the preserved graph/layout. |
| Wonder review | Active for targeted weighted and prediction-informed turns. It reviews derived source text, scenes, traces and checked intervention results. It does not independently inspect the original pixels. |
| Prediction and answer-informed revision | Implemented. Original response and diagram-visible assistance are recorded; the result is not independent mastery evidence. |
| Save, resume, versions and ownership | Implemented. Guest history expires after 24 hours and does not automatically transfer into account history. |
| Voice | Meta handles recorded-question transcription; Gemini supplies speech output. Captioned/manual operation remains available. Actual device quality and permissions need user testing. |
| Native shell and distribution | Thin macOS arm64 companion implemented. Developer ID signing, Apple notarization, stapling and Gatekeeper checks passed. Clean-device install and capture fidelity are separate tests. |
| Autonomous course updates and long-term learner graph in the v2 journey | Parked or proposed bridges. Existing v1 infrastructure must not be presented as integrated v2 behavior. |
| Glimmer, fine-tuning and 3D | Researched proposals, not running product capabilities. |

## Confirmed findings

### Ordinary follow-ups can change the experiment without authorization

This is the most important functional defect because it undermines the central promise that a follow-up understands the diagram the user just manipulated.

The UI sends ordinary questions with `intent:'auto'` in [exploration-workspace.tsx](../src/components/exploration-workspace.tsx#L126). The server's enforced reuse path accepts only explicit `explain`, `focus` and `investigate` intents at [exploration.ts](../src/lib/server/exploration.ts#L110). Its preservation check at line 156 is conditional on that reuse path. For `auto`, the model can propose another graph and pass validation because the resulting scene agrees with that newly proposed graph.

The engineering reviewer reproduced this through the actual service and SQLite store for BFS and weighted search. Before the question, start was B, goal X, S→A was disabled and order was reversed. The weighted case also set S→Goal cost to 2. The question was “Why can I not reach X from B with these connections?” The scripted provider returned the original graph. Soma published and persisted version 2 with start S, goal Goal, restored S→A and a reachable result; the weighted cost reverted from 2 to 10.

This does not establish how often a live model makes the mistake. It establishes that the application permits it. The current test at `tests/server/exploration.test.ts:42` checks the context sent to the model but accepts an output that restores the original graph.

Required correction: preserve current effective inputs by default. A requested modification should produce a typed, bounded delta, and publication should reject changes outside that delta. Test resulting graphs, executions and persisted state, not merely prompt context.

### Undirected weighted graphs are rendered as directed

The solver handles undirected weighted graphs, but [WeightedStage](../src/components/exploration-search-stage.tsx#L68) draws an arrowhead for every edge and checks final-path highlighting only in its stored forward orientation.

The smallest reproduction stores an edge G→S with weight 2, sets `directed:false`, start S and goal G. Dijkstra correctly returns S→G at cost 2; the renderer's path predicate does not recognize the reverse traversal and still draws an arrow toward S. The unweighted renderer already handles these cases correctly.

The fresh live undirected screenshot provided a second observation: source facts and cost were correct, but the resulting diagram displayed arrowheads on its undirected edges. Numerical correctness alone therefore cannot certify the presented lesson.

Required correction: omit direction markers for undirected edges and match path segments in both orientations. Test visible diagrams after swapping start and goal, including reverse traversal, zero costs and ties.

### Equivalent BFS inputs can lose the richer animation

The branch at `exploration-search-stage.tsx:13` chooses the static renderer when any `algorithm` value is present or any edge has an explicit weight. That includes ordinary unweighted inputs tagged `algorithm:"bfs"` or containing explicit unit weights.

A zero-network React rendering reproduction confirmed that implicit BFS and the same graph tagged explicitly as BFS produce identical paths and visit order, but only the implicit input contains the motion stage. The prepared example uses the richer path, so its animation is not proof that an equivalent model-generated graph receives that presentation. The shared static branch also carries the undirected arrow/highlight problem described above.

Required correction: choose presentation from algorithm semantics and effective costs, not optional metadata presence. Add paired implicit/explicit/unit-weight BFS checks. Preserve a safe priority-specific presentation for Dijkstra until its choreography is correctly implemented.

### The default companion width hides the central interaction

[Desktop panel bounds](../desktop/policy.cjs#L14) start at no more than 620px width. At the representative 620×704 content viewport, the weighted page measured 3,637px tall. The first graph began at y494; the second at y965; the tipping-point button at y1421; the composer at y2919. These document coordinates show how much scrolling separates the learner's actions. The 375px page was 4,082px tall.

The responsive layout avoids horizontal overflow, but it does not keep the comparison, its control and a question action together. [CSS ordering](../src/components/exploration.css#L185) also puts the visual stage before the source column while their DOM order remains different, creating a keyboard-order risk that needs a targeted regression.

Required correction: adapt the same engine into a compact presentation with one graph, algorithm overlays or tabs, two cost readouts, one synchronized caption, one active control and an accessible question action. Keep advanced state, audit and configuration available through disclosures. Increasing the window to obscure the source is not a complete solution to the companion goal.

### Graph labels and explanatory surfaces compete

Even the curated six-node example has edge-cost/node-distance collisions and truncates “Unconnected X.” The weighted renderer uses fixed radii and unadjusted label placement at `exploration-search-stage.tsx:64–69`. Generated positions make this a broader risk.

Playback captions, authored steps, a search caption, current-state text and optional practice repeat information. The prepared “What changes?” panel still says both searches are starting after the trace advances. Some repetition is an inspectability feature, but it should not compete with the one sentence explaining the current action.

Required correction: reserve space for labels and weights, expose full object identity, and synchronize one dominant caption to the checked current state. Retain complete accessible text without displaying every representation simultaneously.

### Prepared-source copy mislabels the flagship

[exploration-workspace.tsx:174](../src/components/exploration-workspace.tsx#L174) shows “Unweighted · breadth-first search” and “Watch the queue” for every prepared example, including the weighted shortest-path example. This was confirmed live. It is a small correction with a direct effect on judge comprehension.

### Publication reliability outside graph search remains uncertain

Two fresh weighted screenshots published correctly. A clear source slide containing the attention formula, its terms and a left-to-right flow rejected with `generation_invalid` on its first attempt. The broad explanatory renderer exists, so this is not proof that attention explanations are unsupported. It is a failed product attempt in a relevant Intro AI use case.

The current public failure does not identify whether extraction, tool arguments, layout validation, binding, review or the provider caused it. Add fixed stage/error categories to diagnostic records without storing raw screenshots, credentials, private provider text or internal reasoning. Then repair the identified failure and evaluate new, unseen cases. Do not count repeated debugging success as a held-out pass.

## Architectural limitations that matter to judging

### Review shares the first interpretation's blind spots

Spark sees the screenshot and proposes source facts at `exploration.ts:113–127`. Wonder receives a summary, scene and computations, with source text capped at 3,000 characters in [exploration-review.ts](../src/lib/server/exploration-review.ts#L6). It does not independently see the source image.

A missing edge or misread weight can consequently remain internally consistent through both the solver and critic. The current “checked computation” label correctly limits the assurance; broader “verified lesson” language would not be justified.

The first response should be better extraction evaluation on varied inputs. If failures warrant a runtime safeguard, independently check source facts against transient original pixels or request explicit clarification. Use existing model capabilities and preserve call/spend bounds. A second model count is not the requirement; independent evidence is.

### Valid experiments are not necessarily useful experiments

[probeEdgeCost](../src/lib/domain/cost-probe.ts#L6) validates an existing edge and computes its consequences. It does not require that the selected edge addresses the user's claim. An irrelevant or disconnected edge can produce identical outcomes across all sampled costs and still be presented as a model-chosen experiment.

An invariant can be educational when it answers the question. Otherwise the system should decline the uninformative probe, choose a better one within its existing bounds, or explain why it cannot establish the requested effect. Evaluate experiment relevance on unseen graphs, including ones without an obvious direct start-goal edge.

### Native and learning claims need human evidence

Policy tests and notarization are strong distribution evidence. They do not establish permission denial/regrant behavior, multi-display fidelity, hide/reopen continuity, audible narration, microphone recognition or an unfamiliar user's ability to learn from the experience.

Run short real-material sessions and record setup/correction burden, time to useful interaction, source mistakes and voluntary reuse. A small pilot can establish usefulness problems and improve the demo; it cannot establish durable learning gains.

## Differentiation and positioning

Screen awareness, generated diagrams, interactive lessons, adaptation and voice are insufficient as standalone novelty claims. Google's official documentation describes screen sharing and spoken interaction in [Gemini Live](https://support.google.com/gemini/answer/15274899?hl=en-GB). Its August announcement describes [interactive simulations and 3D models](https://workspaceupdates.googleblog.com/2026/08/generate-interactive-simulations-and-models-in-the-Gemini-app.html). These capabilities make 3D an inadequate differentiator by itself.

StudyFetch advertises [interactive apps from uploaded material](https://www.studyfetch.com/features/mini-apps) and [Guided Chat that coordinates activities and carries context](https://www.studyfetch.com/blog/meet-guided-chatting-on-studyfetch). These are vendors' stated capabilities, not independently verified quality comparisons. Their existence does not prove that they match Soma's complete workflow, or that Soma performs better.

Soma's defensible proposed wedge is:

> Soma turns a question on your screen into an experiment you can change, with consequences you can inspect.

The strongest proof is a concrete boundary: fewer edges stop meaning lower cost, the route changes under the same intervention, and the next explanation preserves that experiment. The product should earn its differentiation through that experience and a small direct workflow comparison. It should not rely on a claim that other products cannot generate simulations.

Keep Gemini speech as an explicitly attributed supporting service if it gives the best experience. The rubric does not require every dependency to be Meta, and replacing good narration with weaker output solely for optics could hurt Demo. Spark's interpretation, experiment decision and composition, plus purposeful Wonder review, are the important Meta story.

## Submission and documentation readiness

The guide requires a public repository and clearly identified event-built functionality. During this audit the repository was private and remote HEAD was `08d0eb23f358223cf327721e8fd34dffa4094215`. None of the following existed at that revision: `desktop/main.cjs`, `desktop/package.json`, `exploration-cost-probe.tsx`, `exploration-playback.tsx`, `exploration-review.ts`, `gemini-speech.ts` or `cost-probe.ts` in their corresponding current source directories.

The production release was assembled through an isolated overlay to avoid deploying unrelated working-tree changes. That was a reasonable development safeguard. The submission now needs a clean, reviewed snapshot whose public code, instructions, tests, notices and deployed behavior agree. Do not simply push every dirty file or make private history public without reviewing it.

The notarized Mac archive exists locally and the web path works without installation. A clean-browser web judge path should remain primary for immediate access. Publish a native download only after reviewing the actual release package and instructions.

Product docs retain competing stories: the v2 introduction is followed by an older returned-work/background-preparation/independent-evidence storyboard; bridge status and older budget/signing paragraphs also lag newer records. The handoff's current status pointer was refreshed with this audit, but the broader document reconciliation remains planned. A submission should describe one active product, distinguish parked infrastructure and proposed experiments, and identify original event work truthfully.

## What to preserve

- The deterministic search engine, source/control distinction and specific assurance labels.
- Model decisions that execute real tools and receive real computed feedback.
- Original responses, assistance conditions, immutable revisions and exact-state save/resume.
- Ownership and deletion fences, cancellation, retained unknown-usage reservations and application-enforced budgets.
- Explicit capture, transient raw media, captions, keyboard paths and reduced-motion alternatives.
- A no-login web example and the signed native companion as complementary access paths.

The next iteration should expose these strengths through a smaller, clearer interaction. Fine-tuning, 3D and restored course automation remain optional bets after the correctness, presentation and evidence gates in the plan.

## Audit artifacts

Local artifacts remain under ignored `.local/audit-pm063/`: full offline test logs, source inputs/results/renders, viewport measurements and screenshots, and the zero-network follow-up reproductions. They contain original synthetic material and application facts. They are not an automatically published submission package.
