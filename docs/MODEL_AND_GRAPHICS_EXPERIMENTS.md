# Soma: model-directed experiments, adaptation and 3D

Status: October 29, 2026. The cost experiment is implemented, with release verification tracked in BUILD_LOG. Fine-tuning and 3D below are proposed experiments, not shipped capabilities. The October 31 freeze and November 4 submission deadline remain unchanged.

## Product direction

The reference experience sets the quality bar for a compact visual companion: retain the visible source, introduce one relationship at a time, coordinate the drawing with narration, and let the user interrupt naturally. More model calls alone do not achieve this. Soma's distinguishing interaction should be a testable explanation: the model chooses something worth changing, the application checks its consequences, and the learner can investigate the result.

The first implementation places the cost control directly after the graph and keeps detailed node-cost tables collapsed. It asks a concrete question: when does the route with the fewest edges also become the cheapest route? Spark chooses an existing edge through `choose_cost_probe`. Soma computes bounded interventions, returns checked cases to Spark for visual composition, and applies the existing targeted Wonder review. A slider updates both algorithms using the same graph costs without another inference. Original source facts remain inspectable; the change is labeled hypothetical. Saved versions retain the selected edge, checked experiment and user control state.

An exact tie is established only for a direct start-to-goal edge with a reachable alternative: remove that edge, compute the cheapest alternative, and use that cost as the tie. Other edges receive discrete checked samples with no global threshold claim. Changing start, goal, enabled edges or other costs recomputes the visible experiment. Exploration is not independent-understanding evidence.

## Priority and visible experience

1. Release and inspect the cost experiment, including actual Spark selection/composition, Wonder review, save/resume and failed-generation recovery.
2. Continue the visual-quality work: progressive reveal, stable object placement, fewer simultaneous panels, source visible alongside the companion, and clear interruption. Weighted playback currently shows checked snapshots; it does not yet have the BFS motion choreography.
3. Benchmark an open-weight specialist before considering training. Adopt it only if it measurably improves task success, latency, privacy or cost.
4. Prototype 3D only after the 2D interaction is reliable. It is an optional view of the same experiment.

The proposed demo is source → Muse chooses an experiment → move one cost across a checked tie → see the route change → ask why. Optional prediction and its recorded assistance remain available; no assessment is required to explore. Run facts are actual recorded actions, not invented model deliberation. We cannot establish that judges have never seen a similar interaction.

## Fine-tuning: a narrow Glimmer specialist

Meta documents SFT and QLoRA for Muse Glimmer, including a one-H100 QLoRA recipe. The recipe pins `meta-models/Muse-Glimmer-30B` revision `a4e59da52a7bc87ae7251dd5545c0dd437c44b68` and Axolotl 0.19.0. This establishes a supported starting point, not Soma training compatibility or results. Use a separate GPU environment and the official recipe; keep its CUDA/Python dependencies out of the web application. [Meta post-training guide](https://dev.meta.ai/docs/muse-glimmer/post-training), [Axolotl model guide](https://docs.axolotl.ai/docs/models/muse-glimmer.html).

The proposed specialist is an **experiment planner and visual director**, not a replacement numerical model. Start with experiment selection alone:

- Input: an authorized derived graph, the user's question, current controls, source uncertainty and bounded application-computed candidate outcomes.
- Output: a strict existing tool choice such as `choose_cost_probe({edgeId})`, or an explicit request for clarification. A later experiment can add typed visual beats referencing existing scene IDs.
- Spark continues source interpretation and overall composition. Wonder remains an advisory critic. Application validators retain authority over ownership, graph bindings, numerical outputs, publication and budget.
- The specialist receives no desktop access, credentials, arbitrary tools, generated code or ability to write learning evidence.

### Data and evaluation

Prepare original synthetic graphs and questions using the deterministic solver, then review targets. Include direct-edge and internal-edge interventions, zero-cost ties, unreachable goals, ambiguous extraction, changed controls, misleading requests and injected source instructions. Do not use private captures, course documents or real learner answers as training data without separate authorization. Do not assume Spark-output distillation permissions; verify the relevant terms before using teacher outputs. Human-authored and solver-derived targets provide an initial path.

Proposed pilot scale: 300 reviewed training examples and 60 development cases. Keep at least 100 release cases sealed outside training/prompt construction. These are planning targets, not an existing dataset or a claim that this sample size is sufficient. Partition by underlying graph topology and question family before generating weight variants; random row splits would leak nearly identical examples. Include a separately authored challenge set and unsupported inputs.

Compare the unchanged base Glimmer, base plus a few examples, and the adapter with identical inputs and inference limits. Record strict parse/tool-ID validity, unsupported-input abstention, information gained from the chosen experiment, preservation of unchanged variables, injection failures, end-to-end publication rate, latency and cost. An appropriate edge need not match a single reference ID; score whether its checked outcomes distinguish the relevant claim. Generated explanations need a separate source/claim review. A Wonder approval is not ground truth.

Proposed promotion gate: a clear improvement over the strongest untuned baseline on sealed task success, no new critical authority/grounding failures, and acceptable end-to-end latency. Do not train just to add a badge. If base prompting succeeds already, spend the remaining build time on presentation and held-out cases. RL/GRPO is a later experiment after a measured baseline and robust rewards; formatting success alone invites reward hacking.

### Compute proposal — not authorized or running

Modal lists H100 SXM5 at $0.001097/second, approximately $3.95/GPU-hour. Two GPU-hours are about $7.90 before CPU, RAM, storage, downloads and evaluation. This is a time-limited experiment estimate, not a completed-training quote. [Modal pricing](https://modal.com/pricing).

First propose a short single-H100 load/forward/backward smoke test using the pinned recipe, short sequences and a tiny reviewed dataset. Measure actual VRAM, startup time and tokens/second before requesting a full adapter run. Use an enforced timeout, one concurrent GPU and automatic shutdown; include checkpoint download/cache and evaluation time in the estimate. A two-hour ceiling may produce an inconclusive result. Provider credits, account setup and the final total cost are unverified. The approved $15 application testing allowance does not authorize GPU training.

Spark Open is a much larger serving/training target (816B total parameters); it is not the first adapter experiment for this schedule. No hosted Spark/Wonder fine-tuning endpoint is established in our implementation. [Spark Open specifications](https://dev.meta.ai/docs/muse-spark-open).

## 3D stretch: a cost landscape, not a second product

A purposeful first scene keeps the graph's source-derived horizontal layout and encodes a node's current tentative cost as height. Unreached nodes are explicitly unknown, not zero. As Dijkstra settles nodes, the frontier and chosen path become visible at their checked costs. The same cost slider, trace, source reference, narration and saved state drive the 2D and 3D views. Height is an abstract encoding; this is not reconstruction of real-world geometry from the screenshot.

Use Three.js WebGLRenderer with WebGL2 and bounded OrbitControls for an initial prototype. Both have maintained official APIs; OrbitControls provides camera orbit/zoom and change events. WebGPU is not required for the first slice. [Renderer documentation](https://threejs.org/docs/pages/WebGLRenderer.html), [OrbitControls documentation](https://threejs.org/docs/pages/OrbitControls.html).

The application owns geometry, scales, units, text, camera limits and all numerical state. A model may choose an existing node to focus on or an approved camera preset; it cannot supply shaders, executable code or arbitrary assets. Prefer a fixed isometric camera initially, plus keyboard-operable rotate/reset controls and an obvious 2D toggle. Dynamically load the optional renderer, render on changes, dispose GPU resources, cap pixel ratio and reuse existing scene bounds. Keep the textual trace and cost comparison accessible outside the canvas.

Prototype gates:

- The 3D view explains frontier cost ordering more clearly in a short user walkthrough; decoration alone is insufficient.
- Every cost and path matches the 2D engine at zero costs, ties, disconnection and changed weights.
- On the target Mac, manual changes respond within 100 ms at the supported graph bound; camera motion targets a stable 60 fps. These are unmeasured targets.
- Keyboard-only and reduced-motion users can complete the same experiment. Reduced motion uses immediate states and no automated camera movement.
- Renderer initialization/context loss returns to the working 2D view without losing the experiment; unsupported devices retain the complete experience.
- Actual Electron viewport and phone checks pass. No default always-spinning scene or mandatory GPU path.

No 3D package, training job, adapter, local open-weight service or benchmark improvement is delivered merely by this proposal. Preserve the working 2D release if either experiment misses its gate.

PM061 reliability correction: the cost-investigation follow-up now uses `compose_cost_experiment` for bounded objective, captions, narration and follow-ups while the application preserves the validated checked graph/layout and derives frontier labels from its algorithm. Initial screenshot-to-scene composition still uses the full scene tool. This is a purposeful typed turn, not arbitrary layout/code generation on every follow-up. Nonempty reviewer findings trigger revision even if the verdict incorrectly says approve; defects are never discarded.
