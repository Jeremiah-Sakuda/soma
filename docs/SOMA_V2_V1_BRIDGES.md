**PM073 continuity update (October 30):** Fresh application is now implemented within saved checked explorations: original same-family problems, hidden-until-check/reveal solutions, immutable answers, recorded hints/reveals, actual timestamps, checked practice visuals and optional answer-informed Spark composition. Reference availability stays explicit; this is not independent-understanding validation, learner-graph projection or unattended preparation. Existing source-selection/background bridges remain proposed. See the current implementation and validation records for release evidence.

# Three bridges from Soma v1 to visual exploration

**PM055 update (October 29):** A narrow portion of bridge 2 is implemented in the exploration service: optional diagram-visible next-node predictions, immutable original answers, reveal facts, persisted source/model/state lineage and explicit answer-informed Spark visual requests. This is not a v1 learning-graph projection, validated misconception diagnosis or independent delayed assessment. Bridges 1 and 3 remain proposed. See [implementation](SOMA_V2_IMPLEMENTATION.md#pm055--optional-prediction-to-adaptive-visual) and [validation](SOMA_V2_VALIDATION.md) for actual release evidence.


October 29, 2026. **Architecture assessment and proposed follow-up, not implemented integration.** This review inspected the code links below. It performed no source refresh, credential operation, model call or production change. Existing connector coverage and authentication gates retain their recorded status.

The best sequence is **selected material → optional learning evidence → unattended preparation**. Keep the v2 screen/screenshot/example entry usable without connecting courses. These bridges reuse specific v1 services; they do not require completing the previous student-hub roadmap.

| Rank | Proposed bridge | Student benefit | Existing foundation | New work / main risk |
| --- | --- | --- | --- | --- |
| 1 | Open selected course material as an exploration | Revisit an already imported passage without recapturing or repasting it | Owned account workspace, immutable source versions and bounded interpretation/composition | An explicit course-selection source adapter; source staleness and ownership must survive publication |
| 2 | Record optional predictions as distinct learning evidence | A later explanation can respond to an actual answer while preserving ungraded curiosity | Original attempts, assistance/exposure records, immutable graph projection and response adaptation | New exploration references/checkpoint criteria; ordinary controls must never become mastery evidence |
| 3 | Prepare an exploration when selected material changes | A useful visual is ready on the learner's return | Consent-scoped sources, idempotent jobs, leases, typed failures and audited publication | A new checked exploration job outcome; real collection, cost, relevance and unattended recovery remain gates |

## 1. Selected material → an exploration

**Verified code foundation.** [`readAccountWorkspace`](../src/lib/server/account-store.ts) resolves the owned workspace. [`applySourceImport`](../src/lib/server/imports.ts) retains source identity/version/history, marks older versions stale, and distinguishes manual material from live collection. [`reconcileSourceRefresh`](../src/lib/domain/source-context.ts) reconciles changes. The current [`createExplorationService`](../src/lib/server/exploration.ts) accepts `screenshot` or `example` sources and uses the same checked scene contract for a new question and a versioned follow-up. It does **not** currently accept an existing course-source selection.

**Proposed smallest implementation.** Add an explicit “Explore this selection” action to existing source inspection. Send only source ID/version and a bounded selection, not a client-supplied workspace or arbitrary URL. The server resolves the exact owned text and records an observation that links back to that immutable source version and passage. Use an honest new source kind such as `course-selection`; text selection is neither a screenshot nor a new live LMS read. Feed the selection into the existing interpretation/composition service. Check the source version again at publication and retain the original artifact if a newer version arrives.

Start with one already imported, supported text example. A graph drawn in a PDF cannot be recovered merely because its filename or surrounding text was imported. Unclear graph structure still requires confirmation or explanatory-only output. Keep the BFS checker and its model version separate from the older circuit validator.

**Acceptance before claiming this bridge works:** two-account source-ID rejection; exact selected passage/version restored after reopening; source update during generation cannot publish stale work as current; unchanged selections reuse valid state without implying a fresh model call; unavailable material preserves the last valid artifact. This adds no new LMS adapter or password requirement.

## 2. An optional prediction → revisable learning evidence

**Verified code foundation.** [`applyAction`](../src/lib/domain/learning.ts) preserves attempts, revisions and assistance. [`recordPrediction`, `exploreLesson` and `revealPrediction`](../src/lib/domain/prediction.ts) distinguish selection, exploration and reveal, but their current computational contracts are **circuit-specific**. [`reconcileLearningGraph`](../src/lib/domain/learning-graph.ts) is an application-owned immutable projection of canonical source/lesson/investigation/attempt records. [`saveActionWithAdaptation`](../src/lib/server/adaptation-jobs.ts) can commit an eligible diagnostic attempt and its adaptation outbox entry together. These are useful patterns, not a ready-made BFS observation API.

**Proposed smallest implementation.** Introduce a versioned exploration event referring to artifact/version, checked model/version, exact input state, source observations, actual timestamp and assistance/exposure. “Changed the start node” remains exploration. An optional “Which node leaves the queue next?” checkpoint must record the learner's choice **before** revealing the corresponding checked state; its answer comes from the deterministic trace. Link a subsequent explanation to that observation without grading a click, playback or self-rating.

Extend canonical graph references and projection deliberately if graph continuity is needed. Do not fabricate a circuit `Lesson` or `Attempt` solely to pass existing graph validators. Do not call `enqueueAdaptation` with a made-up exploration attempt: its current guards require the latest matching diagnostic investigation, lesson and sources. A modest first bridge may record truthful exploration events without introducing any new diagnostic inference.

**Acceptance:** original choice and later revision remain separate; help/reveal remains attached to the original versions; skip/check-decline never blocks exploring; a contrary answer can revise a hypothesis; a genuinely later fresh item stays distinct from the displayed trace. No mastery inference follows from time, narration completion or successful manipulation.

## 3. A selected-source change → a prepared exploration

**Verified code foundation.** [`importWithAutomation`](../src/lib/server/import-automation.ts) marks explicitly selected normal imports for automatic preparation. [`automaticModelContext`](../src/lib/server/automatic-context.ts) restricts unattended model context to opted-in current sources and matching evidence. [`enqueuePreparation`, `jobSourcesCurrent`, `reconcilePreparationOutbox`, and `runPreparationJob`](../src/lib/server/jobs.ts) implement job identity, source/model freshness, bounded leases/retries and publication. [`runAuditedPublication`](../src/lib/server/audited-publication.ts) supplies the existing commit/audit boundary. Current preparation intents/outcomes publish lessons or investigation decisions, not `ExplorationSpec` artifacts.

**Proposed smallest implementation.** After the first two bridges prove useful, add a narrow exploration-preparation outcome and source-to-exploration lineage. A changed, opted-in source may queue one relevant supported visual. Keep the old version inspectable; update neither the learner's active controls nor a newer interactive turn behind their back. An unchanged or irrelevant update should preserve valid work and avoid inference where possible. Reuse the existing budget ledger, ownership checks, retry facts and publication guard; do not simply call the interactive request handler from an unowned scheduler.

**Acceptance:** restart/idempotence; current source and model versions checked at commit; expired credentials yield an honest stale/source-access state; cancelled or superseded work cannot publish; shared spending/concurrency limits survive retries; a source change produces a useful artifact without a prompt. Successful synthetic scheduling does not establish fresh Blackboard/Piazza/Gradescope reading or all-course coverage.

## Recommended stopping point

Complete the v2 proof gate first: source-specific generated composition plus a meaningful unscripted follow-up, checked behavior and usable save/resume. Then choose bridge 1 as the next small product slice. Bridges 2 and 3 remain proposed backlog until their separate acceptance checks and budget/consent boundaries are implemented and demonstrated. The existing v1 services stay available throughout; none is a prerequisite for trying the exploration example.
