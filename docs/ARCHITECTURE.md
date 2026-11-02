# Architecture

Soma's design rule is simple: **the model proposes; the code proves.** Muse models read, decide and explain. Application code computes, validates and publishes. On supported graphs, no path, cost or search state comes from model text. Model-written explanations sit beside that computation, and Spark's reading of the source is shown for inspection.

The primary journey is selected context → generated visual → manipulation → contextual follow-up → saved version. The Next.js application and its bounded exploration service share TypeScript contracts. The Electron companion supplies explicit capture and a restricted floating window. It never exposes Node or arbitrary IPC to remote content.

## One turn, end to end

1. **Interpret.** Muse Spark 1.3 reads one transient image through the `inspect_source` tool. It returns a source summary, its uncertainty and, when the material supports it, a typed graph. Source text and learner text are treated as untrusted data. Raw pixels are not stored with the artifact.
2. **Compute.** The application runs BFS or nonnegative Dijkstra on the validated graph. Every path, frontier state and route cost shown to the learner comes from this computation. Correct computation does not by itself establish correct extraction or prose. Wonder reviews explanations against the computation in step 5. Spark's reading of the source is shown under **Source & assumptions** but is not independently re-checked.
3. **Experiment (on request, weighted graphs).** With `choose_cost_probe`, Spark selects one existing edge whose cost is worth investigating. The application computes a bounded set of interventions and returns those cases to Spark, which writes the explanation onto the preserved graph with `compose_cost_experiment`. When the chosen edge runs directly from start to goal, the cases include the exact cost at which both routes tie. Moving the slider afterward re-runs both searches in the browser at any value, without another model call.
4. **Compose.** Spark authors the scene from approved typed components: positions, highlights, steps, narration and follow-up questions. Explanation-only steps cannot claim a checked trace. Generated content cannot execute code, access secrets or alter validators.
5. **Review.** Weighted and prediction-informed candidates that pass the application's checks go to Muse Wonder 1.0, an advisory reviewer. Wonder sees the merged card, Spark's source summary and the checked results, but not the original image. It approves or requests a revision. One repair and re-review fit within the shared call, time and spend limits.
6. **Publish.** The service validates source identity, graph bindings, stable object identity, ownership and the latest version before publication. Failed or cancelled work keeps the previous usable artifact and records actual billing facts.

## Follow-ups keep your experiment

Follow-ups from the UI preserve the learner's effective experiment by default: disabled connections, a moved start or goal, reversed neighbor order and tested costs all carry forward. A question alone cannot silently restore source defaults. Explicit graph controls apply parameter edits. The preserved experiment can become the baseline of a new version, while the original source and earlier versions remain available. Programmatic modify and compare intents are distinct from explanatory turns. If the learner removes the edge under test or clears the goal, Soma still explains the graph, and the saved cost experiment is shown as unavailable.

## Checked computation

- Graphs have at most 12 nodes and 24 edges, with nonnegative finite costs, explicit neighbor order and deterministic tie handling.
- Unit-cost BFS uses queue choreography regardless of optional algorithm metadata.
- Dijkstra uses checked priority states, not FIFO animation. Weighted transitions replay the solver's settlement and relaxation snapshots, including improvements to nodes already in the queue.
- Narration audio supplies step progress; there are no word-level timestamps. Layout may move cards and labels for legibility without changing the saved graph or evidence.
- Companion-width comparisons show one selectable graph and two clearly labeled full-route costs.
- Illustrative panels for other subjects do not recompute as scientific models, and the app labels them as explanatory visuals.

## Learning records

Source access is read-only. Observations stay separate from interpretations. Attempts preserve assistance, time and version lineage. A prediction is checked by the server, and the original response is retained. A correct supported answer, a completed explanation or a self-rating cannot establish independent mastery.

## Budgets and limits

Every request reserves an application-enforced budget before any model activity. Each request is limited to:

- three provider calls, or five when Wonder review is enabled
- a 90-second deadline
- a $0.35 exploration reservation

Concurrent generations are limited by `SOMA_EXPLORATION_MAX_ACTIVE` (1–16, default 4). Actual usage settles the reservation; unknown usage keeps it. The application keeps a 20% reserve on the actual model allocation. These defaults do not authorize spending on another developer's credentials.

## Recorded run

**Watch a recorded Muse run** opens a genuine completed Spark and Wonder generation on an original synthetic screenshot as a new artifact the viewer owns. Its original time, cost and audit stay labeled as historical. Opening it makes no provider call and reserves no budget, and live follow-ups from it use the ordinary bounded pipeline.

## Models and services

| Component | Role |
| --- | --- |
| Muse Spark 1.3 | Vision interpretation, experiment selection and scene composition through four strict tools: `inspect_source`, `choose_cost_probe`, `compose_exploration` and `compose_cost_experiment` |
| Muse Wonder 1.0 | Advisory review of weighted and prediction-informed cards against checked results |
| Muse Voice Transcribe 1.0 | Optional spoken questions |
| Gemini 3.1 Flash TTS (preview, Sulafat voice) | Optional narration audio; browser voice and captions are alternatives |

No fine-tuned model, open-weight runtime or 3D renderer is claimed.

## Earlier event work in this snapshot

Earlier in the event, Soma began as a semester course workspace with read-only course connectors. Those routes and isolated services remain so that the browser application and its existing deep links reproduce. Unattended course preparation is not part of the primary companion journey.

## Fresh application from saved explorations

`exploration-application.ts` creates bounded original BFS/Dijkstra variations and derives their results with the checked solver. `POST /api/explore` application actions persist the exact saved parent/source/model/version, reference availability, immutable answer/reason, hints, reveals and actual timestamps in the owned session. Expected values and routes are omitted from unanswered public records. This is optional reference-available practice, not independent-assessment or mastery evidence.

After answer/reveal, an explicit action creates a separate solver-built visual with parent lineage and no provider request. An optional answer-informed Spark composition uses the saved observation through the ordinary budget, input-binding, advisory review, repair, cancellation and publication path. It cannot silently change the checked graph. Original deletion removes derived work; deleting only the child retains the attempt. Guest practice shares the existing 24-hour retention boundary. No v1 source scheduler, graph projection, notification system or new model family is introduced.

## Personal continuity and explicit actions (PM086)

The existing owned exploration session now also stores explicit goals/preferences and revisioned concept interpretations. Model-selected saved references, source versions and actual assistance evidence are validated before map publication. Goals are self-report; concept links are revisable interpretations; observations cannot be fabricated by the model. Bounded retrieval informs future visual composition, with deletion/edit fences before publication and response delivery. See [personal companion](PERSONAL_COMPANION.md).

Optional external actions use a separate trusted native window and a one-shot Accessibility helper. The hosted renderer has no control bridge. Spark proposes one typed action from sanitized app controls; the user reviews the exact action, and native code rechecks the selected process and control fingerprint before executing. Field readback and button acceptance are different verification outcomes. Existing collectors remain read-only. See [computer actions](COMPUTER_ACTIONS.md).
