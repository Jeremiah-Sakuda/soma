# Soma — submission copy

November 1, 2026 positioning update: students first, the capability second ([story](STORY_AND_DEMO.md)); updated November 2 for the second checked subject, DC circuits. Supersedes the PM132 copy (kept in git history). Ready-to-edit copy for the Cerebral Valley form; exact field limits are unconfirmed. This draft does not publish or submit anything.

## Project name

Soma

## Tagline

Turn what you're studying into something you can explore.

## One sentence

Soma uses Meta's Muse models to turn the diagram in front of you, starting with the slide you're studying, into a live, checked experiment drawn right on top of it: cut a connection or open a resistor, find the tipping point, ask why.

## Short description

Point Soma at a lecture slide and ask a question. Muse Spark reads the diagram, a weighted graph or a resistor circuit, and Soma's own solver computes the answer and draws it over your slide: each step, distance and route, or every node's voltage and every current. Cut a connection or open a resistor on the slide and the answer changes instantly. Ask for the tipping point and Muse picks what to test while Soma computes the exact value where it flips. Before an explanation reaches you, Muse Wonder checks it against the computed result. Built for students first; the reading and solving underneath aren't tied to slides or to one subject.

## Main description

Every student knows the moment: a slide shows one worked example, and your real question is a different one. What if this edge weren't there? Why doesn't it take the direct route? Getting from that question to an answer you trust usually means redrawing the example in another tool, or asking a chatbot that may confidently get the numbers wrong.

Soma makes the slide itself the experiment. Capture your screen or upload a screenshot and ask. Muse Spark reads the source into a typed graph, including where each node and printed weight sits. Soma's own solver runs Dijkstra or BFS, and the result is drawn over your capture: settled and waiting vertices, tentative distances, the route along the slide's own edges.

Then you experiment. Click a connection on the slide to cut it and Soma recomputes at once, with no model call. Choose **Find the tipping point** and Muse picks a connection to test (Soma steers it toward a direct shortcut when the slide has one); Soma computes exactly where the answer flips, and dragging the cost moves the route on the slide. Ask why, by voice or text, and the answer addresses the experiment you're running. Before a weighted-graph explanation reaches you, Muse Wonder reviews it against Soma's computed trace and sends mistakes back for repair. Explorations save and reopen, and Soma can generate a fresh problem from the same idea with the answer hidden.

The same pattern works on a different subject. On a circuit slide, Spark reads every resistor, source and junction; Soma solves the circuit exactly by nodal analysis, in fractions rather than rounded decimals, and checks Kirchhoff's current law at every junction before anything is drawn. Open a resistor on the slide or change its value and every voltage and current updates. Ask when current would flow through the bridge and Muse picks the part to vary while Soma finds the exact value where the current reverses, then re-solves the circuit there to prove it.

We built Soma for the student with a lecture slide, but the idea underneath isn't tied to the classroom or to one subject. Muse reads a picture into a typed model, Soma's solver computes on it, and the answer is drawn back onto the picture. The same questions turn up on a transit map, a network diagram or a delivery route. Today Soma checks two subjects, graph search and DC circuits, on course material; each new kind of diagram needs a solver and a way to draw it, not a new product.

The model chooses how to read, explain and investigate. The code proves the answer.

## Impact and problem-statement fit

**Track:** Indie Developer / Build for Your World.

**Who it's for first:** students and independent learners working through diagram-heavy material, starting with graph search and DC circuits, topics every computing and physics student meets. Soma grew out of its builder's own study workflow, which is why the hero is a lecture slide.

**Why it matters:** the questions that build understanding are "what if" questions, and static slides can't answer them. Soma removes the reconstruction step between a slide and an experiment, and it gives answers a learner can trust because the numbers are computed rather than generated.

**How far it reaches:** the checked step doesn't depend on the picture being a slide, and adding a subject doesn't mean a new product: the circuit path reuses the same capture, reading, review, overlay and Mac companion as graph search. Soma's graph solver runs on any weighted graph Muse Spark can read, within its limits of nonnegative costs and 12 nodes (in testing, 8 of 8 fresh original graph images were read exactly), so the same experiment could reach anywhere people reason over connections they can't edit: transit maps, network diagrams, delivery routes.

**Why it's credible:** the core journey is one live run on an original slide; waits are shortened and labelled. The source becomes a controllable experiment, each change has a computed consequence, the model makes a visible decision, and the result can be kept and practiced. No study or adoption figures are claimed; the potential is shown through a working capability.

## Creative use of Meta tooling

- **Muse Spark 1.3:** reads the captured slide into a typed graph or circuit with the positions of its parts; composes the explanation and its steps; chooses which connection or part to test for the tipping point; answers follow-ups about the current experiment.
- **Muse Wonder 1.0:** reviews each explanation against Soma's computed trace or circuit solution and returns concrete findings that Spark repairs. In a retained live run it caught a step claiming two vertices settled at once.
- **Muse Voice Transcribe 1.0:** spoken questions in the browser and the Mac companion's Point & ask.

The models decide; the application constrains. Spark's output is validated against strict schemas, the solver alone produces routes and costs, and every model call, source reading and review is visible under **How Muse made this**.

## Technical execution

- Multimodal source reading into a validated graph, with deterministic repairs for underspecified details (for example, an incomplete neighbor order) recorded as assumptions.
- Independent BFS/Dijkstra solver and exact cost-boundary probe; learner changes (cut edges, costs, start, goal) recompute locally.
- Exact nodal analysis for DC circuits in rational arithmetic. Every solution is checked for Kirchhoff's current law at each junction, each source's voltage and power balance. A circuit's tipping point comes from three exact solves (any current or voltage is a ratio of linear functions of one part's value) and counts as verified only when the circuit re-solved at that value meets the condition exactly.
- Deterministic image snapping places a circuit reading on the slide's own junction dots and part bodies, with no model call.
- A source-anchored overlay that draws the checked trace on the learner's own capture. Coordinates are stored; screenshot pixels are not.
- Wonder review with bounded repair, application-enforced spend caps and retries, owned versioned persistence with exact reopen.
- About 1,800 automated tests plus opt-in live-provider journeys; the hero journey's live runs, including retained failures, are logged in `docs/BUILD_LOG.md`.

## Built during the event

All product code was written between October 26 and November 4, 2026. The dated build log (`docs/BUILD_LOG.md`) and verbatim prompt archive (`docs/build-log/prompts.json`) record every step, including the November 1 work on the hero journey, source overlay and engine lab, and the November 1–2 work on checked circuits. Pre-event material is limited to planning documents in the first commit. Third-party components are listed in `THIRD_PARTY_NOTICES.md`.

## What works now and what comes next

**Working product:** screenshot or screen capture → checked graph search or DC circuit drawn on the source → cut a connection or open a part, change a cost or value, and probe the tipping point → contextual follow-up with Wonder review → save and reopen; fresh practice for graph search. Prepared examples and a 3D view are included: for a search, height is distance; for a circuit, height is voltage.

**Soma lab:** a recorded Muse run in which Spark drew and explained a four-stroke engine and chose which comparisons to show. It replays without a model call; live engine generation is not part of the product yet.

**Next:** graphs beyond the classroom with the same solver (transit, network and route maps), more checked subjects such as truss statics, each with its own solver, fresh practice for circuits, and richer source-anchored visuals.

## Project links

- Live app: https://soma-woad-beta.vercel.app/explore
- Demo slides: `public/examples/lecture-14-dijkstra.png` (graph search) and `public/examples/lecture-9-bridge.png` (DC circuit)
- Soma lab engine: https://soma-woad-beta.vercel.app/lab/engine/index.html
- Repository: https://github.com/Jeremiah-Sakuda/soma (to be made public before submission)
- Demo video: pending

## Short answers for judges

**What did Muse actually decide?**
How to read the slide, how to explain each step, and what to test for the tipping point: on the graph slide it chose the direct A–F edge; on the circuit slide it chose R₄ as the part that decides whether current crosses R₅. Wonder decided whether each explanation matched the computed result.

**What does "checked" mean?**
Routes, distances, voltages, currents and tipping points come from Soma's solvers, run on the graph or circuit Spark read. A circuit solution is exact (fractions, not rounded decimals) and checked against Kirchhoff's current law at every junction. If the reading is wrong, the source panel shows what was read and its assumptions; the computation itself is never generated.

**Is this an AI-for-education chatbot?**
No. The answer is an experiment you manipulate on your own material, with computed results and an explanation that follows your changes.

**Is Soma only for students?**
Students are who we built it for and who the demo serves. The pattern underneath (the model reads and chooses, the code computes, the answer is drawn on the source) applies wherever people reason over a diagram they can't edit. Today the checked part covers two subjects, graph search and DC circuits, starting with course material.

**Is it only one algorithm?**
No. Graph search and DC circuits are both live and checked. The circuit path reuses the same capture, reading, review, drawing and Mac companion; what it added is a solver, a reading contract and a way to draw voltages and currents.

**Is the engine generated live?**
No. It is a recorded Muse run in the Soma lab, labelled as such. Circuits are the second live checked subject.

**Have you measured learning gains?**
No. We demonstrate the capability and its potential; learning outcomes would need their own study.
