# Soma improvement plan October 29 2026

**PM064 execution update:** The owner adopted the six audit work items. Preservation/rendering fixes, compact companion, fresh source evaluation and public-source reproducibility are delivered and deployed. Clean checks and public CI passed; see the latest PM064 section in SOMA_V2_VALIDATION.md. The missing-cost source still safely rejects rather than clarifying. Native OS/course verification remains a human gate. The plan below is retained as the original audit proposal.

The objective is a compelling, reliable desktop visual companion whose defining action is a model-chosen experiment with checked consequences. The judging audit (internal review, removed before publication) found strong technical foundations, confirmed state and rendering defects, a mismatch with the companion viewport, and incomplete source/user evidence. Address those before expanding the feature set.

This is a proposed execution order. It preserves the October 31 feature freeze and November 4, 9 PM America/New_York submission deadline. Estimates assume one builder, reuse of the existing engine and separate human participation for device/user testing. They are effort ranges, not guarantees. No GPU training or publication is authorized merely by this plan.

## Product and demo focus

**Working proposition:** Soma turns a question on your screen into an experiment you can change, with consequences you can inspect.

Use Intro AI as the concrete domain. Demonstrate search behavior and a cost boundary deeply; use a second clear explanatory topic only after its generation works reliably. Keep numerical assurance specific to supported models. The broader product ambition comes from selecting a useful investigation from the user's work, not from listing every student task or every model available.

The primary loop stays:

**Visible source → source facts → chosen experiment → checked consequence → useful follow-up → saved experiment.**

Do not restore the semester hub, introduce a career workflow, add another numerical family or make assessment compulsory. Preserve the current source, privacy, evidence and spending boundaries.

## Ranked work

| Rank | Work | Effort estimate | Main benefit | Dependency |
| --- | --- | --- | --- | --- |
| 1 | Enforce preservation for ordinary follow-ups | 2–4 hours | Correctness, trust and contextual interaction | None |
| 2 | Correct renderer dispatch, undirected visuals and source labels | 1–2 hours | Correctness and credible teaching visuals | None |
| 3 | Build a compact presentation for the existing native viewport | 4–6 hours | Demo and everyday usability | Preserve corrected semantics from 1–2 |
| 4 | Repair non-graph generation failure and add safe stage diagnostics | 2–4 hours initially | Breadth the current pitch already implies, diagnosability | Identify the failed stage before changing architecture |
| 5 | Evaluate source fidelity and experiment usefulness on fresh cases | 2–3 hours plus model wait | Meta tooling and reliability evidence | Freeze expectations before tuning; run after fixes |
| 6 | Test native capture and usefulness with unfamiliar users | 1–2 hours builder preparation; participant time separate | Impact and native credibility | Compact path and a reliable example |
| 7 | Prepare a reviewed public release matching production | 2–3 hours plus CI | Submission requirement and reproducibility | Start inventory immediately; finalize after corrections |
| 8 | Reconcile the current story and rehearse the video/judge route | 2–3 hours plus recording | Demo and submission clarity | Verified behavior and a stable release |
| 9 | Add weighted choreography or a stronger model-selected counterexample | 3–5 hours, conditional | Memorable visual cause and effect | All preceding correctness/presentation gates pass with time remaining |

The ranges total more than a comfortable single-day sprint. Do not attempt every optional item. The first two fixes, a compact hero, honest source coverage and a reproducible submission take precedence over animation breadth. Begin release inventory and scheduling human testers while implementing the core fixes.

## Correctness gates

### Preserve the current experiment

Treat explanatory follow-ups as preserving current effective graph inputs by default. Let a model classify or propose a change, but make the authorized change a typed application contract. A request to change the start node must not change the goal, edge costs or connections. An ambiguous request should ask for clarification rather than quietly choosing a more convenient graph.

Acceptance:

- Reproduce the audit's unreachable B→X question after disabling an edge and changing a weight. The result retains the same effective inputs and remains unreachable unless a modification was explicitly requested.
- Test both BFS and Dijkstra, including reversed neighbor order, changed goal, disabled edges, fractional costs and comparison inputs.
- Reject a provider response that restores the source graph during an explanation.
- Assert resulting executions and saved/reopened state. Prompt-context assertions alone do not satisfy the gate.
- Preserve cancellation, revision conflicts, source version and ownership fences.

### Make the visual agree with the model

Derive directedness and path highlighting from the checked input, including symmetric matching for undirected edges. Correct prepared source metadata so BFS and weighted examples are named accurately.

Acceptance:

- The stored reverse edge G—S produces a highlighted S→G route without an arrowhead when `directed:false`.
- Swapping start/goal and testing zero/fractional weights preserves correct visuals.
- A directed reverse edge remains directional and is not incorrectly traversable.
- Browser/renderer assertions cover arrows and highlights, not only numerical results.
- Weighted source disclosure never says the example is unweighted.
- Semantically identical implicit/explicit BFS inputs, including unit weights, retain the same appropriate motion. Optional metadata does not route ordinary BFS through a static weighted presentation.

## Compact presentation gate

Use the current lesson engine and artifact model. Present one graph with algorithm overlays or a clear algorithm switch, a pair of route-cost readouts, one synchronized caption and the relevant intervention control. Keep the question action reachable without scrolling through a state table. Advanced controls, assumptions, full tables and audit records remain available in disclosures.

At representative **620×704 content size**, the learner must be able to see a legible graph, relevant cost comparison and the active control together, with an Ask action reachable by keyboard and pointer in the same view. The external source remains usable beside Soma. Test an actual packaged window in addition to browser approximation.

Acceptance:

- Source context, graph, current caption, comparison values, one primary action and an Ask action are usable together at the target size.
- No critical node/edge/weight collisions in the curated example plus ten varied supported graphs at desktop, companion and phone widths.
- Full object labels remain obtainable on selection or focus. Truncation must not turn an identity into an ambiguous fragment.
- Visual order and keyboard order agree. Focus does not jump to a distant composer before the visible controls.
- Exactly one dominant caption follows the current checked step. Static authored text is visibly contextual or collapsed, never a conflicting current-state claim.
- Manual, caption-only and reduced-motion operation retain all meaning. No fabricated progress or word-level alignment claims.

Do not solve this by removing inspection or making the panel so wide that it covers the user's work. Use progressive disclosure and an appropriate representation of the same experiment.

## Source and generation gate

The attention-slide failure is a development case now. Add safe diagnostic categories for the failing stage and bounded validator facts; investigate that case without logging private media, raw provider content or internal reasoning. The result may require a smaller mode-specific tool contract or a layout correction, but choose the correction from observed failures.

Freeze a new set of **ten legible inputs** before using it for release evaluation: eight varied search graphs and two explanatory Intro AI topics. Separately use three unclear or unsupported inputs to check honest clarification/assurance. Store expected facts outside generation prompts. Do not include the audit's already-seen source cases as unseen evaluation.

Proposed release gates:

- At least eight of ten legible inputs produce a usable, source-faithful artifact without developer editing. Report the entire denominator, repairs, time, cost and failure reasons.
- No published checked graph silently changes its source's nodes, direction, edge weights, start or goal. A wrong accepted source interpretation is a release defect even when its solver output is consistent.
- Unclear or unsupported material clarifies or stays explicitly explanatory; it does not receive false numerical assurance.
- Inspect every published source/render pair. Numerical and schema checks do not establish rendering fidelity.
- Exercise an explanatory follow-up after changing controls and an optional recorded prediction, with immutable original evidence.
- Preserve the current hard call/time/spend bounds. No cap reset; unchanged sources should not need unnecessary inference.

The current global allowance has about **$9.79 remaining** at audit close. Thirteen new requests at the existing $0.35 reservation would reserve at most $4.55 before settlement; actual usage may be lower. That is a proposed bounded evaluation within the existing $15 total, not permission for unrelated paid services. Recheck the shared ledger before running because other authorized work can consume it.

If extraction errors persist, time-box a safeguard using an independent source-fact check against transient original pixels or an explicit clarification fallback. The fact schema should cover direction, every edge and weight, start/goal and uncertainty. Verify model/API compatibility before choosing the reviewer. Keep raw screenshot persistence off and fit the full turn within existing resource limits. Do not add a second interpretation merely to advertise another model.

## Human usefulness and native gate

Schedule three to five people unfamiliar with Soma, ideally studying related technical material. Each brings a permitted screenshot or uses a clearly labeled original example. Keep private course content out of public recordings and code.

Observe rather than coach:

- Can they reach a useful visual and meaningful manipulation?
- Can they identify the source assumption and explain what changed?
- How much correction/setup effort is required?
- Can they ask about their current experiment without losing it?
- Would they voluntarily request another explanation or revisit this one?

Measure time to first useful interaction, errors and correction burden. A short fresh application question can reveal a teaching problem, but do not claim durable learning improvement from this small pilot.

Actual native verification must include screen permission denial and regrant, intended-display selection, hide/reopen, microphone denial, audible speech, interruption and save/resume. Run three consecutive complete journeys without lost state. Keep the no-install web path as the judge fallback. Record which checks are actual device tests versus browser approximations.

## Release and submission gate

Inventory the deployed snapshot and the dirty working tree now. Preserve unrelated work. Create a clean, reviewed release whose code, lockfiles, notices, setup instructions and tests reproduce the deployed hero. Required native, voice, experiment and review files must actually be in that release, not only on the local machine.

Before publication:

- Review source, fixtures, docs and history for secrets, session material, private coursework, learner records and inappropriate prompt-archive content.
- Identify third-party assets and event-built contributions accurately. Do not attribute runtime Meta behavior to the development coding tool.
- Run clean-install/build/test and the complete hero journey against that exact revision.
- Publish the required repository and any native download only through the appropriate reviewed release step. Confirm judge access in an unauthenticated browser.
- Reconcile PRD/brief/demo/handoff around the current v2 product. Retain old work as labeled history, not competing current promises.
- Keep the signed native artifact and a functioning web link. Test every submission link, the three-minute video and the final receipt.

## Three minute video

The video should show a consequence before explaining its architecture. The following is a proposed storyboard, contingent on real native and source checks passing.

| Time | Scene | What it proves |
| --- | --- | --- |
| 0:00–0:12 | A direct route costs more than a longer route; moving one cost changes the result | Immediate visual cause and effect |
| 0:12–0:40 | Intro AI source, native shortcut, reviewed snapshot and a concrete question | Firsthand workflow and source context |
| 0:40–1:15 | Source-specific visual, one short explanation and a meaningful manipulation | Real model composition and useful interaction |
| 1:15–1:55 | Spark selects an investigation, solver checks cases, Wonder reviews; user crosses the boundary | Purposeful Meta use and checked consequences |
| 1:55–2:25 | A plain “why?” preserves the changed experiment; optional prediction can trigger a targeted revision | Context continuity and honest adaptation |
| 2:25–2:50 | Save, hide/reopen and resume the exact experiment | Persistent usefulness |
| 2:50–3:00 | Product promise, clear event contribution and immediate judge link | A coherent submission |

Keep actual inference recorded. If editing removes a wait, disclose elapsed time; do not make prepared examples look live. Do not compress an unverified learning interval into a mastery claim. A simple, reliable sequence is more persuasive than including every surface or architecture diagram.

## One ambitious optional bet

After correctness and compact presentation pass, improve the existing model-selected experiment rather than adding another destination. Ask Soma to find a concrete counterexample to a supported graph claim, or explain why the checked search did not find one. The model chooses a relevant intervention; the executor supplies the witness or bounded invariant; the critic checks the conclusion and its assumptions.

This should generalize beyond the obvious direct-edge example while staying inside the checked graph family. Accept useful invariants, but do not present an irrelevant no-op as a successful investigation. Distinguish a bounded search from a universal mathematical proof.

Acceptance: on three previously unseen supported graphs, including one without a direct start-goal edge, the chosen experiment addresses the actual question and its visible consequence is correct. Add weighted relaxation/priority animation only when it clarifies that relationship and can be interrupted or reduced to a static equivalent.

## Deferred work and stopping rules

Fine-tuning, open-weight deployment, 3D and unattended course preparation stay outside the critical path. The [model and graphics proposal](MODEL_AND_GRAPHICS_EXPERIMENTS.md) remains available. A Glimmer adapter needs an untuned baseline, reviewed data, sealed evaluation and separately approved GPU costs. A 3D view needs a demonstrated teaching advantage over the corrected 2D view. Neither solves the current state-preservation or companion-layout defects.

- **October 29–30:** correct the state and rendering defects, reduce the companion surface, diagnose broad explanatory generation, start release inventory and schedule testers.
- **October 31 feature freeze:** select the demonstrated hero and freeze feature additions. Complete source/render and native checks. Drop optional animation/model work if it threatens correctness or recording.
- **November 1–2:** repair discovered defects, complete fresh release evaluation and user sessions, finalize a reproducible release and truthful claims.
- **November 3:** finish video, instructions, original-contribution record and clean-session link checks. This is the guide's last full day for submission questions.
- **November 4:** submit before 9 PM America/New_York and retain the actual confirmation.

If a planned capability misses its gate, narrow the claim and keep a useful, honest path. Do not manufacture native capture, autonomous preparation, learning gains or model breadth in the submission narrative.
