# Soma — submission copy

November 1, 2026 positioning update: students first, the capability second ([story](STORY_AND_DEMO.md)); updated November 2 for the second checked subject, DC circuits, and for the review findings of November 2–3. Supersedes the PM132 copy (kept in git history). Ready-to-edit copy for the Cerebral Valley form; exact field limits are unconfirmed. This draft does not publish or submit anything.

## Project name

Soma

## Tagline

Turn what you're studying into something you can explore.

## One sentence

Soma uses Meta's Muse models to turn the diagram in front of you, starting with the slide you're studying, into a live, checked experiment drawn right on top of it: cut a connection or open a resistor, find the tipping point, ask why.

## Short description

Point Soma at a lecture slide and ask a question. Muse Spark reads the diagram, a weighted graph or a resistor circuit; for a graph, Muse Wonder checks that reading against the slide itself, weight by weight. Soma's own solver computes the answer and draws it over your slide: each step, distance and route, or every node's voltage and every current. Cut a connection or open a resistor on the slide and the answer changes instantly. Ask for the tipping point and Muse picks what to test while Soma computes the exact value where it flips. Before a weighted-graph or circuit explanation reaches you, Wonder checks it against the computed result. Built for students first; the reading and solving underneath aren't tied to slides or to one subject.

## Main description

Every student knows the moment: a slide shows one worked example, and your real question is a different one. What if this edge weren't there? Why doesn't it take the direct route? Getting from that question to an answer you trust usually means redrawing the example in another tool, or asking a chatbot that may confidently get the numbers wrong.

Soma makes the slide itself the experiment. Capture your screen or upload a screenshot and ask. Muse Spark reads the source into a typed graph, including where each node and printed weight sits. Then Muse Wonder looks at the same image and checks Spark's reading of every weight, connection and direction. Where they disagree on a weight, Spark looks again at only those labels without being told Wonder's answer; a correction is applied only when both models agree, and anything still disputed, including any doubt about a connection or direction, is shown to you rather than hidden. Soma's own solver runs Dijkstra or BFS on the checked reading, and the result is drawn over your capture: settled and waiting vertices, tentative distances, the route along the slide's own edges.

Then you experiment. Click a connection on the slide to cut it and Soma recomputes at once, with no model call. Ask a what-if and choose **Investigate my question** (or **Find the tipping point** without one), and Muse picks the one connection the question turns on; Soma computes exactly where the answer flips, and dragging the cost moves the route on the slide. Ask why, by voice or text, and the answer addresses the experiment you're running. Before a weighted-graph explanation reaches you, Muse Wonder reviews it against Soma's computed trace and sends mistakes back for one repair; the review is advisory, and the drawn route never depends on it. Explorations save and reopen, and Soma can generate a fresh problem from the same idea with the answer hidden.

The same pattern works on a different subject. On a circuit slide, Spark reads every resistor, source and junction; Soma solves the circuit exactly by nodal analysis, in fractions rather than rounded decimals, and draws it only if Kirchhoff's current law, every source's voltage and the power balance hold exactly, a guard on the solver rather than on the reading. Every voltage and current is available as an exact fraction beside its decimal. Open a resistor on the slide or change its value and everything updates. Ask when current would flow through R₅, and Muse picks which part to vary, R₄; Soma finds the exact value, 8 Ω, where the current reverses (the value printed on the slide, and exactly why the bridge balances), then re-solves the circuit there to prove it. Drag R₄ across that value and the arrow on the slide turns around.

We built Soma for the student with a lecture slide, but the idea underneath isn't tied to the classroom or to one subject. Muse reads a picture into a typed model, Soma's solver computes on it, and the answer is drawn back onto the picture. The same questions turn up on a transit map, a network diagram or a delivery route. Today Soma checks two subjects, graph search and DC circuits, on course material; each new kind of diagram needs a solver and a way to draw it, not a new product.

The model chooses how to read, explain and investigate. The code proves the answer.

## Impact and problem-statement fit

**Track:** Indie Developer / Build for Your World.

**Who it's for first:** students and independent learners working through diagram-heavy material, starting with graph search and DC circuits, topics every computing and physics student meets. Soma grew out of its builder's own study workflow, which is why the hero is a lecture slide.

**Why it matters:** the questions that build understanding are "what if" questions, and static slides can't answer them. Soma removes the reconstruction step between a slide and an experiment, and it gives answers a learner can trust because the numbers are computed rather than generated.

**How far it reaches:** the checked step doesn't depend on the picture being a slide, and adding a subject doesn't mean a new product: the circuit path reuses the same capture, reading, review, overlay and Mac companion as graph search. Soma's graph solver runs on any weighted graph Muse Spark can read, within its limits of nonnegative costs and 12 nodes (in two frozen tests on images we drew in a lecture-slide style, every supported image was read exactly: 13 of 13 graphs with 3 to 12 nodes and 6 of 6 circuits; of the six images that were not supported graphs or circuits, four got the intended explanation, refusal or question, and two ended safely with no answer, both reported; and on three figures from Wikimedia Commons that we didn't draw, two weighted graphs were solved correctly and a circuit with no printed values got a clarifying question), so the same experiment could reach anywhere people reason over connections they can't edit: transit maps, network diagrams, delivery routes.

**Why it's credible:** the core journey is one live run on an original slide; waits are shortened and labelled. The source becomes a controllable experiment, each change has a computed consequence, the model makes a visible decision, and the result can be kept and practiced. No study or adoption figures are claimed; the potential is shown through a working capability.

## Creative use of Meta tooling

- **A second model checks the reading.** Spark reads the captured graph into a typed model; Wonder then looks at the same image and checks Spark's reading of every printed weight, connection and direction. Where they disagree on a weight, Spark re-reads only those labels without being told Wonder's value, and a weight is corrected only when both models land on it; anything else, including a doubted connection or direction, is shown to the learner as disputed. In the second frozen evaluation Wonder confirmed all five graph readings; no live correction has been recorded yet. Circuit readings are not yet cross-checked.
- **Muse Spark 1.3:** reads the slide into a typed graph or circuit with the positions of its parts; chooses the one connection or part a question turns on, for the tipping point; composes the explanation and its steps; answers follow-ups about the current experiment. Its stated reason is dropped if it contains a number, and a caption drawn on the slide that contains any number Soma didn't compute is replaced by Soma's own caption. Numbers in spoken narration are checked only by Wonder's review.
- **Muse Wonder 1.0:** besides the reading check, reviews every weighted-graph and circuit explanation against Soma's computed trace or solution and sends concrete findings back for one repair. Retained catches: a step claiming two vertices settled at once ([receipt](examples/hero-dijkstra/receipts/wonder-review.json)), a reversed current through R₅ in a six-node circuit, and a 12-node settlement order that skipped a vertex ([results](../tests/fixtures/source-evaluation-v2/results.json)).
- **Muse Voice Transcribe 1.0:** spoken questions in the browser and the Mac companion's Point & ask.

Narration audio in the app uses Gemini TTS, because no Meta speech-synthesis model was offered for the event; Muse writes the words, Gemini only voices them, and the video mutes it.

The models decide; the application constrains. Spark's output is validated against strict schemas, the solver alone produces routes, costs, voltages and currents, and every model call, reading check and review is listed under **How this card was prepared**.

## Technical execution

- Multimodal source reading into a validated graph, with deterministic repairs for underspecified details (for example, an incomplete neighbor order) recorded as assumptions.
- Independent BFS/Dijkstra solver and exact cost-boundary probe; learner changes (cut edges, costs, start, goal) recompute locally.
- Exact nodal analysis for DC circuits in rational arithmetic, shown as exact fractions beside the decimals. A solution is drawn only if Kirchhoff's current law at each junction, each source's voltage and the power balance hold exactly (a guard against solver error; a misread value would still solve); otherwise Soma explains without a checked circuit. A circuit's tipping point comes from three exact solves (any current or voltage is a ratio of linear functions of one part's value) and counts as verified only when the circuit re-solved at that value meets the condition exactly.
- Deterministic image snapping places a circuit reading on the slide's own junction dots and part bodies, with no model call.
- A source-anchored overlay that draws the checked trace on the learner's own capture. Coordinates are stored; screenshot pixels are not.
- Wonder review with bounded repair, application-enforced spend caps and retries, owned versioned persistence with exact reopen.
- 1,824 offline tests and 169 browser journeys, run by CI on every push, plus opt-in live-provider journeys; three frozen evaluations with their answer keys and every failure retained ([verification](VERIFICATION.md)).

## Built during the event

All product code was written between October 26 and November 4, 2026. Coding began at kickoff on October 26, after the organizers announced that hacking had officially started ([decision record](DECISIONS.md)). The dated build log (`docs/BUILD_LOG.md`) and verbatim prompt archive (`docs/build-log/prompts.json`) record the work through November 1, including the hero journey and source overlay; the November 1–2 checked-circuit work is in the dated git history. Pre-event material is limited to planning documents in the first commit. A second history root (October 29) is this project's own companion work from the same week, merged here so the history stays in one place (see the README). Third-party components are listed in `THIRD_PARTY_NOTICES.md`.

## What works now and what comes next

**Working product:** screenshot or screen capture → checked graph search or DC circuit drawn on the source → cut a connection or open a part, change a cost or value, and probe the tipping point → contextual follow-up with Wonder review → save and reopen; predict the next node before Soma reveals it; fresh practice for graph search. Both demo slides load with one click on the live app. Prepared examples and a 3D view are included: for a search, height is distance; for a circuit, height is voltage.

**Next:** graphs beyond the classroom with the same solver (transit, network and route maps), more checked subjects such as truss statics, each with its own solver, fresh practice for circuits, and richer source-anchored visuals.

## Project links

- Live app: https://soma-woad-beta.vercel.app/explore
- Mac companion 0.4.0 (signed and notarized): https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.4.0
- Demo slides: `public/examples/lecture-14-dijkstra.png` (graph search) and `public/examples/lecture-9-bridge.png` (DC circuit)
- Repository: https://github.com/Jeremiah-Sakuda/soma (to be made public before submission)
- Demo video: pending

## Short answers for judges

**What did Muse actually decide?**
How to read the slide, how to explain each step, and what to test for the tipping point. Asked when current would flow through R₅, it chose to vary R₄ (any of the four bridge resistors could have balanced it), and Soma found the exact value, 8 Ω, the bridge's balance point, where the current reverses. On the graph slide, asked whether the direct A–F edge could ever win, it chose A–F. Wonder checked whether Spark's reading of a graph matched the image, and whether each explanation matched the computed result.

**What does "checked" mean?**
Routes, distances, voltages, currents and tipping points come from Soma's solvers, run on the graph or circuit Spark read and, for graphs, Wonder checked against the image. A circuit solution is exact (fractions, not rounded decimals) and is drawn only if Kirchhoff's current law, every source's voltage and the power balance hold exactly. If the reading is wrong, the source panel shows what was read, any disputed labels and its assumptions; the computation itself is never generated.

**Is this an AI-for-education chatbot?**
No. The answer is an experiment you manipulate on your own material, with computed results and an explanation that follows your changes.

**Is Soma only for students?**
Students are who we built it for and who the demo serves. The pattern underneath (the model reads and chooses, the code computes, the answer is drawn on the source) applies wherever people reason over a diagram they can't edit. Today the checked part covers two subjects, graph search and DC circuits, starting with course material.

**Is it only one algorithm?**
No. Graph search and DC circuits are both live and checked. The circuit path reuses the same capture, reading, review, drawing and Mac companion; what it added is a solver, a reading contract and a way to draw voltages and currents.

**Have you measured learning gains?**
No. We demonstrate the capability and its potential; learning outcomes would need their own study.
