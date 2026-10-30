# Lesson agent orchestration

October 27, 2026 — implementation record for PM029. This document describes the backend author/challenger flow. It does not establish the generated visual-composition or browser-verification gates in PRD R11.

## Roles and boundaries

- **Spark 1.3 authors:** source-grounded activity proposals through the existing preparation/investigation schemas and tools.
- **Wonder 1.0 challenges:** a separate request with the candidate and the exact authorized source segments disclosed to the author. Diagnostic review also receives the validated competing hypotheses, prediction mappings and bounded saved response/assistance when present. No author conversation/private reasoning, credentials, external tools, publication capability or learner-evidence writes. It checks source fit, answer ambiguity/correctness, support leakage and usefulness of the proposed interaction. Diagnostics are explicitly ungraded; their stored answer index is not treated as a correctness grade.
- **Application checks and publishes:** existing mathematical/reference validation, consent, ownership, versions, generation, job lease and transactional publication remain authoritative. Reviewer approval is an advisory model judgment, not independent scientific, instructional or browser approval.

The reviewer returns `approve`, `revise` or `unsupported`, with bounded structured findings. `revise` returns advisory feedback to the author within the existing single repair allowance; the repaired candidate needs another review. Invalid/incomplete/unavailable review blocks the new candidate. There is no silent same-model fallback. Unknown provider usage retains the reservation.

Direct preparation and queued prepare-lesson work use `prepareWithSpark`. Source investigations and response-driven adaptation use `investigateWithSpark`; newly prepared diagnostics pass the challenger before their IDs become selectable. Reusing a previously saved activity or retaining valid preparation does not claim a fresh reviewer call. Reviewer rejection does not authorize new scientific assumptions or changes to the observation/assistance rules.

## Activation and limits

`SOMA_LESSON_REVIEW_ENABLED=true` enables the flow for new requests. It defaults off; this implementation does not edit deployed environment values or retroactively review old artifacts. Both requests use the existing server-only Meta key and pinned endpoint. Do not change `META_MODEL_ID` from `muse-spark-1.3`; the server selects the allowlisted reviewer model explicitly.

The existing lesson limit is four total provider calls/90 seconds/one $0.20 reservation. To leave room for author → reviewer → repair → reviewer, the application discloses at most two selected source segments of 2,000 characters to the direct author. It does not spend another model call requesting those segments. Only those disclosed versions/quotes can be cited. The investigation route preserves its existing source-navigation tools and eight-call/90-second/$0.35 reservation. Author and reviewer calls share these limits; neither role creates a second allowance. A conservative request-byte/output bound checks remaining reservation headroom before each call. Normal source failures and unsupported requests remain explicit.

Wonder uses verified Standard pricing ($4 input/$20 output per million tokens), separately from Spark's $1.25/$4.25. The reviewer uses minimal reasoning and a 1,024-token output ceiling within the existing 2,048-token maximum. Tool selection remains Meta’s documented auto mode; missing/incomplete tool output blocks the candidate. Each result/error is reconciled using the actual model rate. No Contributor model, arbitrary model ID, allocation increase, daily-limit reset or budget-ledger reset is introduced. Existing 20-percent allocation reserve and $2 total operating cap remain.

New preparation jobs capture their review policy so a worker restart/configuration change cannot silently change it. Job identities and generation/investigation caches include the orchestration version. Adaptation identities include the configured policy; existing source/attempt fingerprint and generation checks remain.

## Inspectability

Existing durable audit journals record handoff starts, actual model names, protected concise review decisions, usage, repairs and stops. `AgentRun.orchestration` retains role/model/outcome/known cost facts and survives ordinary workspace persistence. Reviewer findings returned to an author are untrusted data. They cannot become public answer-revealing run text or private internal reasoning. Existing assistance-based audit disclosure applies.

No model review is represented as a completed browser check. The current fixed circuit renderer remains the existing rendering path. Generated presentation composition, representative browser validation and two genuinely generated visual lesson variants remain separate open R11 work; completing this orchestration does not satisfy those gates.

## Verification

The deterministic provider tests exercise the real HTTP parser, model routing, source/reference validators and reservation ledger with authored synthetic responses. They cover first-pass approval, a changed candidate with mandatory re-review, rejection, invalid approval, unavailable usage, protected feedback, cache/reload, and diagnostic review/repair. These are software checks, not evidence that either model judges lessons correctly.

`tests/providers/lesson-orchestration-live.test.ts` is opt-in with `SOMA_LIVE_ORCHESTRATION_TEST=true`. It requires the actual Firestore allowance, uses original synthetic probability material, makes no account/source publication and records bounded model/cost outcomes. A budget denial is reported as deferred/skipped, not live success. Consult BUILD_LOG PM029 for the executed result, failures and build limitations.

Meta references checked October 27: [model IDs and compatibility](https://dev.meta.ai/docs/models), [Wonder Standard pricing](https://dev.meta.ai/resources/blog/build-with-muse-wonder). No claim of fine-tuning, cross-model quality improvement or real learning benefit is established by this implementation.
