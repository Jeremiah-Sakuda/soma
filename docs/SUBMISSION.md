# Soma — submission copy

November 1, 2026 positioning update: students first, the capability second ([story](STORY_AND_DEMO.md)); updated November 2 for the second checked subject, DC circuits, and for the review findings of November 2–3. Supersedes the PM132 copy (kept in git history). Ready-to-edit copy for the Cerebral Valley form; exact field limits are unconfirmed. This draft does not publish or submit anything.

**November 4 UTC delivery:** graphics runtime `73ae70e` and test-duration follow-up `8538cbc` use `soma-3d-2026-11-04`. The signed/notarized 0.4.1 is a private draft; the published installer remains 0.4.0. Current local renderer/controller checks and the labeled silent QA clip do not establish physical native alignment or hosted acceptance, which remain pending after the origin approval rejection. The actual service E investigation (Muse chose D–F, tie 5), source-preserving follow-up/save and circuit image-check/reversal runs remain separate evidence. Final three-minute/native footage is still pending. [Verification](VERIFICATION.md) owns the current full CI result, source identity and retained failures, including the earlier `2e82d9b` checkpoint.

## Project name

Soma

## Tagline

Turn what you're studying into something you can explore.

## One sentence

Soma uses Meta's Muse models to turn the diagram in front of you, starting with the slide you're studying, into a live, checked experiment drawn right on top of it: cut a connection or open a resistor, find the tipping point, ask why.

## Short description

Point Soma at a lecture slide and ask a question. Muse Spark reads the diagram, a weighted graph or a resistor circuit; Wonder checks that reading against the same image when available. Soma's own solver computes on that reading and draws the result over your slide: each step, distance and route, or node voltages and component currents. Cut a connection or open a resistor and the computed result changes instantly. Ask for the tipping point and Muse picks what to test while Soma computes the boundary. Wonder reviews the explanation against the computed result; reading and prose remain fallible. Built for students first, with room to extend the same approach to further topics.

## Main description

Every student knows the moment: a slide shows one worked example, and your real question is a different one. What if this edge weren't there? Why doesn't it take the direct route? Getting from that question to an answer you trust usually means redrawing the example in another tool, or asking a chatbot that may confidently get the numbers wrong.

Soma makes the slide itself the experiment. Capture your screen or upload a screenshot and ask. Muse Spark reads the source into a typed graph, including where each node and printed weight sits. Then Muse Wonder looks at the same image and checks Spark's reading of every weight, connection and direction. Where they disagree on a weight, Spark looks again at only those labels without being told Wonder's answer; a correction is applied only when both models agree, and anything still disputed, including any doubt about a connection or direction, is shown to you rather than hidden. Soma's own solver runs Dijkstra or BFS on the interpreted graph, and the result is drawn over your capture: settled and waiting vertices, tentative distances, the route along the slide's own edges. The reading remains inspectable because two models can agree on the same mistake.

Then you experiment. Click a connection on the slide to cut it and Soma recomputes at once, with no model call. Ask a what-if and choose **Investigate my question** (or **Find the tipping point** without one), and Muse picks the one connection the question turns on; Soma computes exactly where the route changes, and dragging the cost moves it on the slide. Ask why, by voice or text, and the explanation addresses the experiment you're running. Muse Wonder reviews it against Soma's computed trace and can send it back for one repair; the review is advisory, and the drawn route never depends on it. Explorations save and reopen with their interpreted graph and control state; private screenshot pixels are not retained. Soma can also create a fresh graph problem from the same idea with the answer hidden.

The same pattern works on a different subject. On a circuit slide, Spark reads every resistor, source and junction. Wonder checks components, values, connections and source polarity against the same image; an unresolved dispute prevents a checked circuit. Soma solves the interpreted circuit exactly by nodal analysis, in fractions, and draws it only if Kirchhoff's current law, source voltages and power balance hold exactly. Every voltage and current is available as an exact fraction beside its decimal. Open a resistor or change its value and everything updates. In the recorded hero run, asked when current would flow through R₅, Muse chose R₄; Soma found balance at exactly 8 Ω, verified it by re-solving, and computed opposite current directions on either side.

We built Soma around the moment a student has a question about a lecture slide. The same approach could help people explore other diagrams. Muse reads a picture into a typed model, Soma's solver computes on it, and the result is drawn back onto the picture. The same questions turn up on a transit map, a network diagram or a delivery route. The current demonstrations show checked graph search and DC circuits on lecture-style material. The circuit path reuses the graph workflow; further subjects would need their own solver, reading contract and rendering.

The model reads, explains and chooses what to investigate. Soma computes and checks the consequences of that reading.

## Impact and problem-statement fit

**Track:** Indie Developer / Build for Your World.

**Who it's for first:** students and independent learners working through diagram-heavy material, starting with graph search and DC circuits, topics every computing and physics student meets. Soma grew out of its builder's own study workflow, which is why the hero is a lecture slide.

**Why it matters:** the questions that build understanding are "what if" questions, and static slides can't answer them. Soma removes the reconstruction step between a supported slide and an experiment. A learner can change a meaningful input and inspect the computed consequence, while the source reading and explanation remain visible for scrutiny.

**How far it reaches:** the checked step doesn't depend on the picture being a slide, and adding a subject doesn't mean a new product: the circuit path reuses the same capture, reading, review, overlay and Mac companion as graph search. Soma's graph solver runs on any weighted graph Muse Spark can read, within its limits of nonnegative costs and 12 nodes (in two frozen tests on images we drew in a lecture-slide style, every supported image was read exactly: 13 of 13 graphs with 3 to 12 nodes and 6 of 6 circuits; of the six images that were not supported graphs or circuits, four got the intended explanation, refusal or question, and two ended safely with no answer, both reported; and on three figures from Wikimedia Commons that we didn't draw, two weighted graphs were solved correctly and a circuit with no printed values got a clarifying question), so the same experiment could reach anywhere people reason over connections they can't edit: transit maps, network diagrams, delivery routes.

**Why it's credible:** live runs on original slides demonstrate a source becoming a controllable experiment, changes with computed consequences, a visible model decision, and saved results. Recent hosted first-generation runs took 45–49 seconds; local manipulations then recompute immediately. The planned video labels shortened waits with their measured duration. No study or adoption figures are claimed; the potential is shown through a working capability.

## Creative use of Meta tooling

- **A second model checks the reading.** Wonder checks Spark's graph reading against the same image. It also checks circuit components, values, connections and source polarity in the release source. Disputed values receive a blind Spark re-read; agreed corrections apply, while unresolved circuit disputes prevent checked publication. The November 4 UTC circuit run confirmed all six parts, including values and battery polarity. Correction and unresolved-dispute behavior have offline tests; a live circuit correction is not claimed. An unavailable check is reported as unchecked.
- **Muse Spark 1.3:** reads the slide into a typed graph or circuit with the positions of its parts; chooses the one connection or part a question turns on, for the tipping point; composes the explanation and its steps; answers follow-ups about the current experiment. Its stated reason is dropped if it contains a number. Checked source and native-overlay captions come from the current calculation; authored explanations remain separately labeled. Numbers in spoken narration are checked only by Wonder's review.
- **Muse Wonder 1.0:** besides image checks, reviews weighted-graph and circuit explanations against computed results and can request one repair. Retained catches include two vertices claimed settled at once ([receipt](examples/hero-dijkstra/receipts/wonder-review.json)), reversed R₅ current and a skipped settlement ([results](../tests/fixtures/source-evaluation-v2/results.json)), and a changed-cost graph incorrectly labeled as the lecture's original graph. That last rejection exposed the source/base lifecycle issue fixed in the release source. Review remains advisory; each card reports what ran.
- **Muse Voice Transcribe 1.0:** spoken questions in the browser and the Mac companion's Point & ask.

Narration audio in the app uses Gemini TTS, because no Meta speech-synthesis model was offered for the event; Muse writes the words, Gemini only voices them, and the video mutes it.

The models decide; the application constrains. Spark's output is validated against strict schemas, the solver alone produces routes, costs, voltages and currents, and every model call, reading check and review is listed under **How this card was prepared**.

## Technical execution

- Multimodal source reading into a validated graph, with deterministic repairs for underspecified details (for example, an incomplete neighbor order) recorded as assumptions.
- Independent BFS/Dijkstra solver and computed cost-boundary probe; learner changes (cut edges, costs, start, goal) recompute locally.
- Same-source graph replies retain base inputs separately from current controls. An application-owned `writtenFor` binding validates the explanation's effective trace; source reset restores original costs and cut connections, while mismatched prose pauses.
- Exact nodal analysis for DC circuits in rational arithmetic, shown as exact fractions beside the decimals. A solution is drawn only if Kirchhoff's current law at each junction, each source's voltage and the power balance hold exactly (a guard against solver error; a misread value would still solve); otherwise Soma explains without a checked circuit. A circuit's tipping point comes from three exact solves (any current or voltage is a ratio of linear functions of one part's value) and counts as verified only when the circuit re-solved at that value meets the condition exactly.
- Deterministic image snapping places a circuit reading on the slide's own junction dots and part bodies, with no model call.
- A source-anchored overlay that draws the checked trace on the learner's own capture. Coordinates are stored; private screenshot pixels are not. Allowlisted original public demo images are a separate replay exception.
- Wonder review with bounded repair, application-enforced spend caps and owned versioned persistence. A review call allows at most 40 seconds inside the 90-second turn; one network/HTTP 5xx retry must fit existing call, time and spend limits and retains uncertain usage.
- Actual original-synthetic graph and circuit investigations can replay without inference. Original output and generation receipts are retained; drawing alignment is separate presentation data ([provenance](../src/lib/fixtures/RECORDINGS.md)).
- At `2e82d9b`, 26 silent browser journeys passed, including four source-selection lifecycle cases; typecheck, build and the 1,224-file/two-link trace passed with zero private mappings. Full CI passed: 1,940 application tests (107 gated skips), 59 desktop tests and 167 browser tests (14 gated skips), with no failed steps; Vercel reports READY. Earlier `17f6c86` CI passed 1,940 application tests (107 skipped), 59 desktop tests and 162 browser tests, but one browser test failed (14 skipped). The failure and earlier green checkpoints remain distinct ([verification](VERIFICATION.md)).

## Built during the event

Product code was written during the event, beginning at kickoff on October 26, 2026, after the organizers announced that hacking had officially started ([decision record](DECISIONS.md)). The submission deadline is November 4. The git history records the work. Pre-event material is limited to planning documents in the first commit. A second history root (October 29) is this project's own companion work from the same week, merged here so the history stays in one place (see the README). Third-party components are listed in `THIRD_PARTY_NOTICES.md`.

## What works now and what comes next

**Working product:** screenshot or screen capture → checked graph search or DC circuit drawn on the source → cut a connection or open a part, change a cost or value, and probe the tipping point → contextual follow-up with Wonder review → save and reopen; predict the next node before Soma reveals it; fresh practice for graph search. Both demo slides load with one click on the live app. Prepared examples and a browser 3D view are included: for a search, height is distance; for a circuit, height is voltage. The release source also lifts graphs, circuits and authored spatial models over the captured source. Installed-build verification is recorded separately in VERIFICATION.md.

**Next:** graphs beyond the classroom with the same solver (transit, network and route maps), more checked subjects such as truss statics, each with its own solver, fresh practice for circuits, and richer source-anchored visuals.

## Project links

- Live app: https://soma-woad-beta.vercel.app/explore
- Mac companion 0.4.0 (signed and notarized): https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.4.0
- Demo slides: `public/examples/lecture-14-dijkstra.png` (graph search) and `public/examples/lecture-9-bridge.png` (DC circuit)
- Repository: https://github.com/Jeremiah-Sakuda/soma (to be made public before submission)
- Demo video: pending

## Short answers for judges

**What did Muse actually decide?**
How to read the slide, explain it and choose what to test. In the November 4 UTC graph recording, asked “What would make the route go through E?” with no edge selected, Muse chose D–F; Soma computed a tie at cost 5 and checked a route through E above it. Asked when current would flow through R₅, Muse chose R₄ and Soma verified balance at 8 Ω with opposite directions on either side. Wonder checked the source readings and reviewed the explanations. These are actual disclosed demo-source runs, not a reliability benchmark.

**What does "checked" mean?**
Routes, distances, voltages, currents and tipping points come from Soma's solvers, run on the interpreted input. The November 4 release source checks both graph and circuit images with Wonder when available; hosted acceptance is pending. Graph review receives the full original image plus any available detail crop. Circuit solutions use exact fractions and require Kirchhoff's current law, source voltages and power balance to hold. These checks establish consequences of the interpretation, not reading or prose accuracy. The source panel exposes uncertainty and disputes; the pipeline reports which checks ran.

**Is this an AI-for-education chatbot?**
No. The answer is an experiment you manipulate on your own material, with computed results and an explanation that follows your changes.

**Is Soma only for students?**
Students are who we built it for and who the demo serves. The pattern underneath (the model reads and chooses, the code computes, the answer is drawn on the source) applies wherever people reason over a diagram they can't edit. Today the checked part covers two subjects, graph search and DC circuits, starting with course material.

**Is it only one algorithm?**
No. Graph search and DC circuits are both live and checked. The circuit path reuses the same capture, reading, review, drawing and Mac companion; what it added is a solver, a reading contract and a way to draw voltages and currents.

**Have you measured learning gains?**
No. We demonstrate the capability and its potential; learning outcomes would need their own study.
