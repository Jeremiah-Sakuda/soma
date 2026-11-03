# Soma

**Turn what you’re studying into something you can explore.**

Soma turns a diagram on your screen into an experiment whose answers are computed, not guessed. Meta’s Muse models read the source, explain it and choose what to investigate; Soma’s own solver computes the result and draws it back onto the source, where you can cut a connection or open a resistor, change a cost or a value, or ask about the consequence. Two subjects are checked today, graph search and DC circuits. It starts with students: the slide you're studying becomes something you can test.

The opportunity: less setup between encountering a difficult idea and having a useful way to explore it, first in the classroom and potentially, with the same solver, on graphs people read outside it. [Demo story](docs/STORY_AND_DEMO.md) · [Three-minute script](docs/DEMO_VIDEO_SCRIPT.md) · [Submission copy](docs/SUBMISSION.md)

**[Try it in your browser](https://soma-woad-beta.vercel.app/explore)** (no account needed) · **[Download for macOS](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.3.0)** (v0.3.0 with Point & ask; Apple Silicon, signed and notarized. The overlay drawn on your screen, the compact bar and the 3D lift below ship in the next release, 0.4.0)

**Try the demo slide in two minutes.** Open [Soma](https://soma-woad-beta.vercel.app/explore) and choose **Try the Lecture 14 slide (live)**, or download [the original Lecture 14 slide](public/examples/lecture-14-dijkstra.png), choose **Upload screenshot** and ask *“Why doesn’t it just take the direct A-to-F edge?”* Muse Spark reads the slide and Soma runs Dijkstra **on the slide itself**: rings, distances and the route are drawn over your own capture. Click a connection on the slide to cut it, or choose **Find the tipping point** and drag the cost. Muse Wonder checks Spark's reading against the slide, weight by weight. Every route and number comes from Soma’s solver, and Wonder checks the explanation against it before you see it. Then try a different subject: choose **Try the Lecture 9 circuit slide (live)**, or download [the original Lecture 9 bridge slide](public/examples/lecture-9-bridge.png), and ask *“Why is there no current through R5?”* Spark reads the circuit, Soma solves it exactly by nodal analysis and draws every node’s voltage and every current on the slide. Click a resistor on the slide to open it, or choose **Find the tipping point**: Muse picks the part to vary and Soma finds exactly where the current through R₅ reverses. The [Soma lab engine](https://soma-woad-beta.vercel.app/lab/engine/index.html) is a separate recorded Muse run.

**Native interaction:** enable **Point & ask**, hold **Control–Option–Space**, point or circle while speaking, and release to ask about that region. Or press **Option–Space** for the compact ask bar: type a question, and Soma draws the checked search over the slide on your screen while its panel stays closed; press ⌘L to lift it into 3D, each vertex raised to its checked distance. The local trail responds immediately; Muse prepares the visual afterward. Step highlights now link back to the captured source. Compare a new capture with the prior one, or ask for a closer look at a formula. Native source references require an unchanged screen. The download above is Developer ID signed, Apple-notarized and stapled. Streaming speech is tested locally; its cloud relay awaits provisioning approval. [Details and verification](docs/POINT_AND_ASK.md).

In the browser, **Watch a recorded Muse run** opens a real completed Spark and Wonder run on an original synthetic screenshot. Its original timing, cost and model actions are shown, and opening it needs no inference. The prepared examples load instantly too. New questions use live generation.

**Take it beyond the example.** Save a checked exploration and choose **Try a fresh example**. Soma creates a different problem in the same algorithm family, keeps its solution hidden until you answer or reveal it, and retains your original answer and any hints. Open the checked practice visual or ask Muse to explain your answer. Practice stays inside the exploration; it is not a mastery score.

<!-- Add the three-minute demo video link to the line above before submission. -->

## Why Soma exists

A lecture diagram gives you one example. The question you want to ask is often more specific: what if I change this connection, start somewhere else, or compare these two states?

Making that example interactive can require translating it into another tool or finding a demonstration that matches. Soma starts from the selected source and question, so the explanation can stay connected to what you are already working on.

Soma is built for students and independent learners first. The potential is a shorter path from a moment of confusion to a useful investigation. The graph workflow makes that idea concrete: change a connection or cost, see the checked consequence, ask about it, and keep the revised exploration.

Soma grew out of its builder’s study workflow with Meta’s assistant. Its focus is the moment of understanding: giving the material in front of you something you can manipulate and investigate.

## What happens when you ask

```mermaid
flowchart LR
  A[Snapshot of your screen] --> B[Muse Spark reads it into<br/>a typed graph or circuit]
  B --> C[Soma's solver computes<br/>BFS, Dijkstra or nodal analysis]
  C --> F[Muse Spark writes the<br/>explanation and visual]
  F --> G{Weighted, circuit or<br/>prediction card?}
  G -- yes --> W[Muse Wonder reviews it<br/>against the checked results]
  G -- no --> H
  W --> H[You change it, ask,<br/>and save]
  H -- Find the tipping point --> D[Muse Spark chooses<br/>an edge or part to test]
  D --> E[Soma computes<br/>the exact tipping value]
  E --> F
```

1. **Capture.** ⌘⇧Space snapshots the display under your cursor. You review the snapshot, and it is not sent until you ask.
2. **Read.** Muse Spark reads the pixels and returns the graph as typed data (nodes, edges, direction, costs, start and goal) or the circuit (junctions, resistors and sources with their values and polarity, and ground). For a graph, Muse Wonder then looks at the same image and checks Spark's reading of every weight, connection and direction; where they disagree on a weight, Spark re-reads only those labels without being told Wonder's value, a weight is corrected only when both agree, and anything still disputed, including a doubted connection or direction, is shown to you. For a circuit, Soma snaps the reading onto the slide's own junction dots and part bodies. The reading is inspectable in Source & assumptions; unsupported or invalid output may prompt clarification or be declined.
3. **Compute.** Soma runs breadth-first search and Dijkstra's algorithm on a graph, or solves a circuit exactly by nodal analysis in fractions, publishing it as checked only if Kirchhoff's current law, every source's voltage and the power balance hold exactly. Every highlighted path, queue state, route cost, voltage and current on screen comes from this computation.
4. **Experiment.** On a weighted graph, click **Find the tipping point** and Spark picks the one edge your question turns on. Soma computes, for that edge, the exact cost at which the cheapest route starts or stops using it, and the cheapest route without it. The cost slider then re-runs both searches in your browser at any value, with no further model call. On a circuit, Spark picks the part to vary and what to watch; Soma finds the exact value where that current or voltage reaches zero (or where a resistor takes the most power) and re-solves the circuit there to verify it.
5. **Explain.** Spark writes the explanation, steps and narration around the checked results. For weighted-graph, circuit and prediction-informed cards, Muse Wonder reviews the finished card against those results as an advisory critic and can send it back for one repair.
6. **Follow up and save.** Ask about any node or edge, and your changes carry into the answer instead of resetting. Versions are saved and can be reopened.

## Why it could matter

**Bring the experiment to the example.** A student could explore the diagram they are studying without reconstructing it by hand in a separate visualizer.

**Make a question actionable.** Instead of stopping at a fixed explanation, the user can change a meaningful input and inspect the consequence. On supported graphs, those consequences come from a checked computation.

**Keep the investigation connected.** Contextual follow-ups and saved revisions let the user continue from the current experiment. The opportunity is less setup and more direct exploration; no quantified time-saving or learning-gain result is claimed.

**Reach past the classroom.** The checked step doesn't depend on the picture being a slide: Muse reads a picture into a typed graph or circuit, Soma's solver computes on it, and the result is drawn back onto the picture. The same questions come up on a transit map, a network diagram or a delivery route, which is where Soma could go next.

## Exploring a richer visual language

On the experimental spatial branch, a recorded engine study shows actual Muse-authored vector artwork, teaching copy and visual investigation choices. Compare matching piston positions across different strokes, inspect the connecting rod and export the question/action/explanation as a standalone study file. Soma supplies constrained motion and source/artifact checks.

This is a recorded local prototype alongside the canonical graph product. It is not integrated generic engine generation or cloud saving. [Engine investigations and actual evidence](docs/examples/pm126/README.md).

## How Soma uses Meta's models

Each model has a defined job, and none of them is trusted blindly.

| Model | Job in Soma | How it is held to account |
| --- | --- | --- |
| **Muse Spark 1.3** | Reads the screenshot (`inspect_source`, `locate_graph`), re-reads only the labels Wonder disputes without seeing Wonder's answer (`recheck_weights`), chooses the edge or part to test (`choose_investigation`, `choose_circuit_investigation`) and writes the visual and explanation (`compose_exploration`, `compose_cost_experiment`, `compose_circuit`) | Strict tool schemas are bound to the request's own IDs and versions. Output that fails validation goes back with structured findings for one bounded repair, or it is not published. |
| **Muse Wonder 1.0** | Checks Spark's reading of a graph against the same image (`check_reading`); reviews weighted-graph, circuit and prediction-informed cards: approves, or requests a revision | A reading correction applies only when both models agree after a blind second look; disputes are shown, not hidden. Reviews compare the explanation with the solver's results, after the application's own checks have passed. |
| **Muse Voice Transcribe 1.0** | Turns a spoken question into text | You click to record. Soma does not store the recording. |

**Where the reasoning shows up.** Spark decides *which experiment to run* on this particular graph; the application decides *what the answer is*. Every generated card shows its own pipeline (Spark read the source, Soma computed, Spark composed, Wonder reviewed or did not run), and a "How this card was prepared" panel lists the actual calls, events, time and cost. In testing, Wonder caught real defects: a Dijkstra frontier mislabeled as a first-in-first-out queue, misleading wording about tied routes, a step on the Lecture 14 slide claiming two vertices settled at once ([receipt](docs/examples/hero-dijkstra/receipts/wonder-review.json)), a reversed current in a six-node circuit and a 12-node settlement order that skipped a vertex ([results](tests/fixtures/source-evaluation-v2/results.json)). Each card went back for one repair before approval. Spark's stated reason for an experiment is dropped if it contains a number, and a caption drawn on the slide with any number Soma didn't compute is replaced by Soma's own; numbers in narration are checked only by Wonder's review.

**What the models never do:** compute paths, costs, search states, voltages or currents, run code, write learner records, change validation rules or spend outside the application's budget.

Narration audio uses Gemini 3.1 Flash TTS (preview, Sulafat voice), because the Meta models offered for this event include transcription but not speech synthesis. The words are the explanation on screen; Gemini only voices them. The browser's own voice is a one-click alternative, and captions are always on.

## What we tested this week

These are small development samples, frozen before any model call, with the answer key never sent to the model. They are evidence that the pipeline works on varied input, not a measured reliability rate.

| Check | Result |
| --- | --- |
| Fresh original graph images (small, 3–4 nodes) | **8 of 8 read exactly.** Nodes, edges, direction, start, goal and costs all matched, and the results matched an independent Floyd–Warshall reference. The set covered reverse traversal, zero and fractional costs, ties, cycles and disconnected graphs. |
| The full frozen set of 13 original sources | **12 of 13 intended outcomes.** Process diagrams became explanatory visuals, blank material got a clarifying question, and negative costs were correctly refused by the solver. The miss was a graph with missing costs, which was rejected safely instead of prompting a clarifying question. |
| A second frozen set: 12 new original slides (November 2) | **11 of 12 intended outcomes.** All six circuits were read exactly and solved to the key: two sources, a current source, kΩ and decimal values, an unmarked ground and ground on the battery's +. All five graphs, of 7 to 12 nodes, were read exactly with the key's goal cost. The miss was a capacitor circuit: Soma correctly didn't read it as a checked circuit, but its explanation failed to save. That save bug is fixed; one rerun then ran out of time on the explanation. |
| Nine screenshots: three real public pages (MDN, Google's ML course, OpenStax) and six original test images (two code variants, spreadsheet, circuit, cache diagram, unreadable crop) | **8 of 9 first requests** produced a source-specific explanation or a clarifying question. The code example changed correctly when the values on screen changed. The OpenStax page was rejected safely. |
| Solver correctness | Dijkstra matches exhaustive simple-path costs, and BFS matches independent reference traces. The circuit solver agrees with independent two-resistor formulas, and Kirchhoff's and Ohm's laws hold on 60 random circuits ([tests/domain](tests/domain)). |
| The original Lecture 9 circuit slide, two live service runs | **Both read exactly:** five resistors, the battery's polarity and ground. Soma solved B = C = 8 V and exactly 0 A through R₅; Wonder approved. Asked “When would current flow through R5, and which way?”, Muse chose R₄, a part the question didn't name, and Soma found exactly 8 Ω, verified by re-solving ([receipt](docs/examples/hero-circuit/receipts/live-run.json)). Replayed offline on both runs' raw readings, the current snapper puts every node within 6 px of the drawing. |
| Engineering | At this release: 1,819 offline tests passed (106 opt-in live or environment-gated tests skipped) and 169 browser journeys, with typecheck and production build, all run by CI on every push. `node scripts/verify-release.mjs` matches this source to the deployed app. |
| One recent original-synthetic service journey | Generation, changed-edge revision and exact save/reopen passed in 27.608 seconds including application work, after retained earlier outcomes. This is an example, not a typical-latency or reliability claim ([receipts](docs/examples/pm126/recorded/canonical-service-checks.json)). |

Details and method: [verification record](docs/VERIFICATION.md) · [general screenshots](docs/GENERAL_SCREENSHOTS.md) · [architecture](docs/ARCHITECTURE.md)

## Built during the hackathon

All code was written for the Meta Global AI Developer Hackathon, from kickoff on October 26 to November 4, 2026. The first commit (October 26, 11:10 ET) holds only pre-event planning documents. A second history root (October 29) comes from this project's own companion repository, also built during the event, and was merged here so the full build log stays in one place. Third-party packages are listed in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). The dated build log (`docs/BUILD_LOG.md`) and verbatim prompt archive (`docs/build-log/prompts.json`) record the work through November 1; the November 1–2 checked-circuit work is in the dated git history.

- **The visual exploration engine** (`/explore`): capture or upload, Spark interpretation, the checked solver, generated scenes, manipulation, contextual follow-ups and versioned saves.
- **Checked BFS and Dijkstra engines**, the model-chosen cost experiment, and weighted animation that replays the solver's own settlement and relaxation steps.
- **Checked DC circuits** (November 1–2): exact nodal analysis with Kirchhoff checks, opening parts and changing values on the slide, a model-chosen tipping point verified by re-solving, junction-dot snapping, and a 3D view in which height is voltage.
- **Visible model pipeline and a recorded live run** that judges can open without spending inference.
- **The macOS companion**: global shortcut, display snapshot with preview, floating panel, a compact translucent ask bar for typed questions, the checked search drawn over the real screen and liftable into 3D (height is checked distance; shortest routes pull taut), and a restricted bridge to native features. Release v0.3.0 is signed and notarized; the on-screen overlay, compact bar and 3D lift are in the next release, 0.4.0.
- **Voice**: Muse transcription for spoken questions, plus narrated, captioned playback that paces the animation.
- **Platform**: ownership-fenced persistence, cancellation, application-enforced spend limits and a release fingerprint that matches this source to production (`node scripts/verify-release.mjs`).
- **Earlier in the event:** a semester course workspace with read-only Blackboard, Gradescope and Piazza connectors. It remains in the repository for its existing routes but is not part of the demo.

## What comes next

- **Graphs beyond the classroom.** The same solver and overlay on diagrams people use outside a course: transit, network and route maps. Reading them is the open question, not computing them.
- **More checked subjects.** DC circuits were the second: the capture, reading, review, drawing and Mac companion stayed the same, and what was new was a solver, a reading contract and a way to draw voltages and currents. Truss statics is a natural next candidate.
- **Classroom pilots** that measure what students can do on their own afterward, not just what they did with help.
- **Course awareness.** Reconnect the course workspace so a new lecture arrives with its experiment ready.

## Scope

- Checked computation covers BFS and Dijkstra with nonnegative costs, up to 12 nodes and 24 edges, and ideal DC circuits of resistors and sources, up to 10 nodes and 16 parts. Everything else is an explanatory visual, labeled that way in the app. It is not a simulation.
- Reading a screenshot can go wrong. The **Source & assumptions** panel shows Spark's reading of the source and the uncertainty it reported. For a graph, Muse Wonder checks Spark's reading against the image, and any disagreement it can't resolve with Spark is shown as disputed. Two models can still agree on the same misreading, and a circuit reading is not re-checked by a second model.
- Browser upload is the fully verified capture path. The desktop shortcut passes automated policy and synthetic capture checks. Real Screen Recording permission, multi-display capture and clean-Mac installation are being tested by hand.
- Impact is framed around students first: easier exploration of a learner’s own material. Uses beyond the classroom are described as potential. Quantified time savings, adoption and classroom outcomes are not claimed.
- Soma takes one snapshot when you ask. It does not record your screen, and screenshots are not stored.
- Guest explorations last 24 hours. Live generation runs under a spend cap; the prepared examples need no model call.

## Run it yourself

Use Node 22 (`.nvmrc`). Dependencies are pinned.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000/explore`. The defaults use local synthetic persistence with live inference off, so the prepared examples work without credentials. For live generation, set `MODEL_API_KEY`, `SOMA_LIVE_INFERENCE=true`, `META_ALLOCATION_USD` and a bounded `META_APP_SPEND_CAP_USD`. Set `SOMA_EXPLORATION_REVIEW_ENABLED=true` for Wonder review. Optional narration and Firestore persistence are described in `.env.example`. Never commit a filled environment file.

**macOS companion:** `npm ci --prefix desktop && npm start --prefix desktop`. Capture needs macOS Screen Recording permission, and voice needs microphone permission. See [desktop notes](docs/DESKTOP.md).

**Verify:**

```sh
npm ci --prefix services/browser-runner --ignore-scripts
npm ci --prefix services/credential-runner --ignore-scripts
npm run typecheck && npm test && npm run build
npx playwright install chromium && npm run test:e2e
npm test --prefix desktop
```

Default tests are offline and use original synthetic material. Tests that call real providers are opt-in.


## Also in the repository

Earlier work from the same build (an understanding map across saved explorations, course-source connectors and approved computer actions) remains in the code and is documented under `docs/`. It is not part of the demo.
