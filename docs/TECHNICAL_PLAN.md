# Soma technical plan

**Implementation baseline, October 26, 2026; Firestore substitution authorized by Jeremy. Release results are recorded separately.** The [PRD](PRD.md) owns scope; this document makes its boundaries concrete. Verify provider APIs, availability, permissions, prices, and compatible package versions during setup. Do not infer API paths or capabilities from product names.

## Stack and deployment boundaries

| Responsibility | Default | Verification before depending on it |
| --- | --- | --- |
| Web interface and server endpoints | Next.js, TypeScript, Tailwind, shadcn/ui; Vercel | Current runtime support, authenticated server boundary, deploy and refresh behavior |
| Identity, evidence records, files | Firebase Authentication, Firestore; object storage to verify | Server ownership checks, deny-by-default client rules, transactions, versioned evidence, file access |
| Durable scheduled work | Trigger.dev Cloud | Recurrence, retry semantics, concurrency, task time limits, deployment secrets |
| Authenticated browser | Playwright and Browserbase | Interactive sign-in, session persistence, institutional login behavior, restart and expiry |
| Runtime reasoning | Muse Spark 1.3 via Meta Model API | Exact available model ID, SDK or HTTP contract, tools, images, structured output, computer-use actions, usage fields |
| Study presentation | Approved SVG/React components, PDF.js | Source coordinates, readable source view, deterministic controls, keyboard and reduced motion |
| Review scheduling | ts-fsrs | Pin version; persist ratings and scheduling state; use defaults initially |
| Verification | Vitest, Playwright, independent reference review | Actual numerical, ownership, state, recovery, and user-journey checks |

Use one TypeScript app/worker codebase. Keep long-running browser and generation work outside web-request lifetimes. Persist production state in Firestore and authorized object storage, not in process memory or a browser tab. Use the same domain services for the real-account and judge routes.

No graph database, separate Python service, multi-agent framework, vector database, general circuit solver, or calendar optimization engine is required initially. Add a dependency only when a measured requirement needs it.

## Execution path

1. A schedule, Refresh, explicit request, or returned-work event creates a bounded job with a workspace identity and goal.
2. The collector uses an authorized provider adapter. It normalizes source items, records retrieval status, and compares stable IDs and content versions.
3. A changed item becomes an immutable source version. Spark retrieves relevant context and may follow permitted links or inspect an image when needed.
4. Spark proposes academic facts, scoped interpretations, a priority decision, and a suitable activity. The application validates ownership, applicability, references, and allowed operations before committing.
5. The change planner classifies the consequence: timing/priority, assessment eligibility, teaching content, or no relevant change.
6. For a supported objective, Spark selects an approved quantitative model and returns a typed lesson specification. Ordinary practice is available when the lab route is unsuitable.
7. Validation checks model inputs, units, evidence, instructional fit, and publication freshness. The application publishes an immutable ready version only after the required checks.
8. The student opens the prepared artifact, explores, and optionally responds. The attempt service records original response, help, revisions, and actual timestamps.
9. Spark uses that evidence to propose a follow-up and revise interpretations. Deterministic scheduling and state services persist the result.

The student should not need to compose a chat prompt to activate the normal change-to-activity path.

## Provider contract and access decisions

Each adapter must support a scoped collection request, stable provider item identity, version detection, source retrieval, citation/location data, and explicit success/expiry/failure status. Preserve separate source-created, source-modified, and retrieved timestamps when available. Unknown dates remain unknown.

| Source | Intended route | Fallback and honest support label |
| --- | --- | --- |
| Blackboard | Per-student authorized browser with manual login/reconnect | Watched student-controlled course folder plus scoped course email; count manual copying |
| Course email | Official provider API or authorized connector scoped to selected courses | Uploads are development/manual support, not a live second source |
| Gradescope | Proved permitted read route | Explicit returned-work PDF/image upload |
| Lecture notes/transcripts | Course files and user-authorized imports | Manual import, identified as such |
| Notion / Granola | Optional selected-content import when access is available | No dependency on replacing task tracking or lecture recording |

The release target is at least two actual live source types. A pair of file uploads does not pass it. The watched-folder fallback itself needs verified access; it is not already implemented.

Bind every browser session and job to a workspace. Keep cookies, credentials, and session storage in supported secret/session facilities, outside prompts, logs, fixtures, and public artifacts. Limit navigation and reads to authorized course scope. Interactive login is a user step. Reading sources does not grant permission to send email, submit coursework, or write to connected systems.

Use content/version checks to skip redundant inference where possible. A failed external check cannot establish “no change”; show last successful collection and stale status.

## Data contracts

Firestore replaces the original relational baseline because the builder has exhausted free Supabase projects. Model relationships as explicit versioned document references; transactionally enforce ownership, revisions, and publication freshness. Keep observations and interpretations separate. Anonymous development workspaces may use a size-bounded snapshot, but private full-semester records must use separate collections before production onboarding. All private records carry a workspace identity. Foreign references must resolve inside that workspace or to explicitly approved public demo/model content. Use immutable version IDs for content used by an attempt.

| Record group | Required fields and invariants |
| --- | --- |
| Workspace, course, assessment | Owner, timezone, enrollment, provider identity, assessment applicability, dates and supporting evidence |
| Connection | Provider, authorized scope, secret reference, status, last attempt, last success, recoverable error |
| Source item and version | Stable provider ID, course mapping, original location, retrieval time, content hash, immutable text/image reference |
| Academic fact | Fact type/value, source version, course/assessment/person applicability, certainty, unresolved conflict or superseded link |
| Agent run and action | Trigger, workspace, allowed tools, actual tool inputs/results with sensitive data removed, status, usage, effects and concise rationale |
| Interpretation and relationship | Topic, hypothesis, supporting/contradicting observations, scope, uncertainty, current/superseded state |
| Activity and lesson version | Objective, selection reason, evidence versions, model version, typed parameters, instructional text, follow-up references, state |
| Model and validation | Equations/algorithm, supported assumptions, unit contract, parameter ranges, reference cases, approval status and test results |
| Attempt and assistance event | Student/session, item and lesson version, original response, ordered hints/reveals/tours, revisions, timestamps, criteria-based feedback |
| Review and preference | Card version, self-rating history, scheduler state; explicit preference value, scope, confirmation, active/deleted state |

Never overwrite an original response with a revision. Never infer independent understanding merely from a score, a lesson completion event, a task checked off, or an FSRS self-rating. Record question exposure and support so a fresh question can be distinguished from a repeated one. Describe an attempt as “without recorded help in Soma” when external conditions are unknown.

Supersede an interpretation while retaining the observations that supported it. A source correction or contrary diagnostic should change the current inference and subsequent action, not rewrite the student's past.

## Spark's graph authority

Give one orchestrator sufficient scope to investigate a course event and the relevant evidence neighborhood. Useful typed operations include reading source versions/images, following permitted course links, querying topic and assessment evidence, proposing scoped facts, proposing or revising interpretations, selecting an activity/model, and preparing a lesson specification.

Application validation must enforce:

- Workspace ownership and valid source/item/model references.
- Allowed relationship types, explicit evidence, uncertainty, and course/assessment scope.
- Preservation of raw observations and prior attempts.
- Separate academic facts, learner interpretations, and proposed actions.
- Applicability and authority of a source; newer content does not automatically erase a personal extension.
- No raw SQL, arbitrary URLs, executable source instructions, permission changes, or direct arbitrary writes to learning evidence.

Record the accepted action and a concise source-based reason. Actual tool activity is inspectable; private internal reasoning is not a UI artifact. Malicious commands in source documents are data, not instructions to the agent.

## Lesson specification and numerical model

P0 generation returns structured data for approved components: objective, cited source passages and versions, selected model/version, assumptions, parameters with units and ranges, controls and what each reveals, labels, concise instructional steps, prediction/checkpoint, answer criteria, and fresh follow-up.

The generator cannot alter the calculation model, validation code, scoring rules, or permitted component set. Escape displayed text. The renderer cannot read credentials, make arbitrary network requests, or write learner evidence itself.

**Proposed first model:** two ideal positive resistors driven by an ideal DC voltage source, in series or parallel. This is a bounded family, not an arbitrary network simulator. Treat all real-device effects as outside the model. Source values, model-derived results, and illustrative choices must be distinguishable.

For series, equivalent resistance is R1 + R2; current is V / (R1 + R2); each drop is current × resistance. For parallel, both branches have source voltage; each current is V / R; total current is the sum; equivalent resistance is R1 × R2 / (R1 + R2).

Proposed development domain: V from 0 to 24 volts, each resistance from 1 to 100 ohms. These are illustration bounds to confirm against the selected sources, not ratings for physical hardware. Reject zero/negative resistance, unsupported topology, unit mismatches, nonfinite values, and missing assumptions.

| Proposed reference case | Expected analytical relationship |
| --- | --- |
| Series: 12 V, 2 Ω, 4 Ω | 6 Ω total; 2 A throughout; drops 4 V and 8 V |
| Parallel: 12 V, 6 Ω, 3 Ω | 2 Ω equivalent; currents 2 A and 4 A; total 6 A |
| Parallel, equal branches: 10 V, 10 Ω, 10 Ω | 5 Ω equivalent; 1 A each; total 2 A |
| Zero source: 0 V, 1 Ω, 100 Ω, either supported arrangement | All currents and voltage drops zero; resistance remains finite |
| Series, unequal branches: 24 V, 1 Ω, 99 Ω | 100 Ω total; 0.24 A; drops 0.24 V and 23.76 V |

These written examples are proposed development oracles, not evidence that independent review has occurred. Review the formulas, limits, and reference outputs independently of the implementation and record the reviewer, tolerance policy, and results.

Two meaningful lesson variants can share this model: unequal parallel branches reveal why voltage is equal while current differs; a series contrast reveals why current is equal while voltage drops differ. A source- or learner-driven parameter or follow-up change must be visible. A skin/color change does not count.

All readouts and quantitative scoring derive from one model state. If current is shown with moving dots, label animation as a qualitative representation; its speed is not a claimed physical drift velocity. A known numerical defect blocks the affected artifact even if the animation looks convincing.

## Publication, freshness, and retry behavior

Use the PRD states: queued, generating, checking, ready, failed, stale. A failed validation can consume at most the allowed repair cycle. Exhaustion yields an explicit fallback. Publish a new immutable version; attempts retain the version they used.

Define deduplication identities from workspace, source versions, objective, model version, and relevant learner/context revision. Direct requests and background work must converge when those inputs match. Reopening current content reuses it.

Before publication, transactionally recheck referenced source versions, model approval, and relevant context. If they changed, mark/requeue the job rather than exposing an obsolete lesson as ready. A timing-only change normally reprioritizes valid content; changed exam scope alters eligibility; changed scientific support invalidates affected content. Preserve in-progress history, but stop a lesson known to be scientifically wrong.

Retries must not duplicate sources, recommendations, attempts, reviews, or cost reservations. Bound browser steps, retries, generation duration, and concurrency. Long jobs must recover after a worker restart.

## Budget and operational controls

Initial sizing is two deep investigations at up to eight calls each, one practice batch up to three, one tutoring session up to six: 25 calls per active workspace/day. One lesson job adds at most four calls including at most one repair, for 29 plus a separately bounded import. Four daily source checks are schedule triggers, not four extra unmetered inference allowances. All model calls, including semantic checks and retries, count.

The initial lesson wall-clock ceiling is ten minutes; a ready artifact should load much faster. Direct requests and speculative generation share the daily lesson allowance, with explicit requests prioritized. Reopening consumes no new generation budget.

By Day 2, replace sizing assumptions with measured input/output/image/cache usage and provider costs. Set explicit import, job, workspace, anonymous-session, and global spend limits. Reserve cost before concurrent work and reconcile actual usage afterward. Preserve 20 percent of the actual Meta allocation for release and judging. Browser/worker charges are separate. The participant guide describes a billing notification, not a guaranteed hard stop.

## Judge path and verification

Create an expiring isolated anonymous workspace over original public synthetic course material. Reuse a checked prepared lesson, then permit a bounded live follow-up or supported request through the same services. Rate limits and a global budget protect availability. Distinguish live inference, prepared content, uploads, and replay in the interface.

Meaningful automated checks cover numerical/reference behavior, state transitions, duplicate ingestion, publication races, account/storage isolation, expired source recovery, source injection, attempt history, and the two entry paths. Browser checks cover controls, representative frames, reset/resume, keyboard, reduced motion, layout, and a numeric/text equivalent. Human review checks scientific, source, and instructional fit. The full counts and reporting rules are in [Demo and Evaluation](DEMO_AND_EVALUATION.md).

