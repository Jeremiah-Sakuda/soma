# Soma: start here

## P084 release handoff — October 29, 2026

The visual-exploration slice is implemented and deployed at `/explore`. Start with `docs/SOMA_V2_IMPLEMENTATION.md`, `docs/SOMA_V2_VALIDATION.md` and `docs/SOMA_V2_V1_BRIDGES.md`. Actual hosted Spark/Firestore checks passed with original material. The v1 scheduler is parked; existing accounts, source connections, credentials and deep links are retained. Remaining user checks are a real selected-window capture, microphone/word recognition/audible device voice, and actual-course fit. Guest history expires after 24 hours and does not transfer to an account. The $5 total testing cap preserves previous consumption and reservations. Do not resume parked full-semester ingestion merely because older checklists below remain.

Current release priority (P084, October 29): implement the visual-exploration pivot in [docs/SOMA_V2_IMPLEMENTATION.md](docs/SOMA_V2_IMPLEMENTATION.md). The selected-context → generated visual → manipulation → follow-up → saved artifact journey is primary. Existing v1 routes and sources remain available; full-semester collection is deferred. See that record for milestone status and executed checks.

**Handoff date: October 26, 2026.** **Later decisions:** Jeremy supplied the organizer’s start announcement and authorized October 26 implementation; Firestore/Firebase replaces Supabase due to project quota. See docs/DECISIONS.md; original handoff details below are retained as context. Jeremy has been accepted to the Meta Global AI Developer Hackathon. The target is a competitive Indie Developer entry under Build for Your World. This is an implementation brief, not evidence that the product already exists.

## The product to build

**P080–P081 actual sign-in correction:** The owner entered credentials once, but BU sign-in did not complete; encrypted password storage is possible and not yet confirmed. This supersedes older statements that no actual enrollment was attempted. Reviewed POST headers, fixed safe failure diagnostics and bounded idle-session recovery are committed in `3e9fe8e` / `f17e852`; callback-boundary tests align in `13200fa`. The isolated service is `soma-credential-login-00004-7z9`. Its actual fictional-account lifecycle passed after 25 seconds idle (50.51 seconds total), then the account was removed and owner-only production restored. Fresh human Soma authentication, metadata-only confirmation, user-controlled BU/MFA, safe-state handoff and selected-course/PDF readback remain separate gates. Never infer vault status from the application's cleanup-tracking flag or retry a real password to diagnose a failure. See the latest [credential deployment checkpoint](docs/CREDENTIAL_AUTOFILL_DEPLOYMENT.md#p081-bounded-idle-session-recovery).

**P072–P074 optional credential autofill:** Dedicated GCP resources, safety checks and owner-only opt-in availability are deployed. Read [Credential Autofill Deployment](docs/CREDENTIAL_AUTOFILL_DEPLOYMENT.md). Twenty-seven actual cloud checks, eleven negative hosted checks, a positive disposable-account lifecycle and empty BU-form review passed; all temporary verification grants/tokens and the fixture account were removed. First real password/MFA, safe browser-state handoff and selected-course readback remain human/provider gates. Preserve exact UID rollout gating, fresh owner consent, separate privileges and cleanup. No institutional password has been stored. The [anti-project framing review](docs/DEMO_AND_EVALUATION.md#p075-anti-project-positioning-review) is a recommendation, not proof that generated composition or actual-course acceptance is complete.

**P050–P051 source checkpoint:** Deterministic Blackboard discovery/selection and resumable supported text collection now reuse the private saved context. Fresh-session metadata and a read-only text probe passed. P052 then selected all three Fall 2026 Blackboard courses and verified initial versioned publication of 36 current text items, with resumable folders still pending. The hosted browser packaging defect is fixed and isolated artifact import is now a CI gate; complete course walks and teaching fit remain separate gates. See [Institutional sign-in](docs/BROWSER_AUTHENTICATION.md). Next validate Gradescope (primary assignments), then Piazza, with separate contexts.

**P042–P044 review:** Read [Graph and Credential Review](docs/SECURITY_AND_GRAPH_REVIEW.md) and [Credential Key Rotation](docs/CREDENTIAL_KEY_ROTATION.md). Additional graph identity/retention and credential deletion/refresh races were fixed with synthetic regressions. Key rollover/recovery is backward compatible; production keys were not replaced. Explicit teaching relationships, R9 image extraction and release/security operational gates remain open.

**P041 implementation checkpoint:** M1–M5 synthetic graph implementation and audits are in [Learning Graph Audit](docs/LEARNING_GRAPH_AUDIT.md). Use the quick demo's Demo controls → Explore learning graph for the authored starting activity. Actual Spark development checks separately verify generation and response-based change/no-change decisions, with failures retained. R9 image/PDF/region extraction still uses an explicit typed fallback and remains an open gate. M6 actual-course access/fit and independent/held-out/pilot acceptance have not passed merely because this checkpoint exists.


**Current sequence — P040, October 27:** Polish the complete learning-graph experience on labeled synthetic data before testing Jeremy's real coursework. Start with [Learning Graph Milestones](docs/LEARNING_GRAPH_MILESTONES.md) and the current Build Plan. Real-source access and actual-course family fit remain later release gates; existing accounts/connectors are reused. This supersedes the earlier real-course-first execution order, not the release requirements.


**October 27 learning-graph refinement:** Read [Learning Graph Scope](docs/LEARNING_GRAPH_SCOPE.md) with PRD R10/R11. Scope the existing hero around competing explanations, a checked interactive comparison, a response-driven graph revision and a fresh application. Reuse the current engine and Ready Card; local relationship inspection is part of the lesson. Broad cross-course discovery, a semester canvas and a fine-tuned model are not P0 dependencies. This scoping work does not establish implemented capability.

**Before you can study, you have to figure out what to study.** Soma brings together your course material, upcoming deadlines, available time, and learning progress to prepare interactive lessons and practice for what matters next. As your classes and circumstances change, your preparation keeps up.

**Read [the student-hub scope update](docs/SCOPE_UPDATE.md) first.** Course content and surrounding context feed the same preparation loop. Keep the small shared view of source-linked deadlines and confirmed events, including career and personal context. A change can affect the student's next study recommendation; learning remains the deepest action Soma performs. Continue the existing implementation and preserve its account, Firestore, lesson, and evidence services.

**Product headline:** Your coursework changes every week. Your study tools should keep up. Use the preparation task and visible learning activity to explain the product. The positioning update adds no feature area or release gate.

Meta's Muse Spark investigates course updates, connects them to existing work, and adapts the next activity from recorded learning evidence. It determines the appropriate consequence: reprioritize an existing activity, revise session fit, change exam eligibility, revise affected content, investigate returned feedback, or do nothing. Relevant email and selected calendar context inform that decision. The result is a persistent next action or prepared learning activity, with its source and reason visible.

Interactive lessons are central. Students manipulate meaningful controls, inspect the relationship, request an explanation, and optionally answer a fresh question. Their responses change what Soma prepares next. Preserve the difference between exploration, assisted completion, and later independent performance.

**Selected demo spine (P037):** returned work → competing provisional explanations → a discriminating interaction → an original response → revised interpretations and next activity. Use one actual course/objective when authorized, without forcing resistor relevance. R12 stays in the product; its video role is at most ten relevant seconds or the judge route. Image/PDF interpretation, region evidence and model-directed browsing remain unimplemented/verification gaps; do not infer them from this story. All release and comparison gates remain.

Use this complete loop as the implementation spine:

**Change → affected commitments → supported next action → prepared learning activity when appropriate → student interaction → evidence-backed follow-up.**

## What is here and what is not

The folder contains the complete reconciled [PRD](docs/PRD.md), [user stories](docs/USER_STORIES.md), engineering and delivery plans, evaluation instructions, original synthetic source material, and the supplied participant guide. An older PDF remains in output/pdf.

Implementation now includes application, domain, server and test files. The decision log records initial runtime Meta access and the Firebase/Firestore substitution. This scope review did not rerun the application or verify live source access, production deployment, pilots, or release gates. Inspect current code and actual test results; do not treat planning targets as completed checks.

Jeremy reports that his existing consumer Muse workflow already checks Blackboard, Gradescope, and email, using a browser where needed. That is the origin and baseline. It does not provide Soma with an application API key, authenticated browser session, or reusable consumer-assistant infrastructure.

## First implementation session

Read [AGENTS.md](AGENTS.md), the [product brief](docs/PRODUCT_BRIEF.md), and the [event constraints](docs/HACKATHON_REQUIREMENTS.md). Then inspect the actual environment and existing files before scaffolding. Work in this folder unless Jeremy directs otherwise; preserve the documentation and historical PDF.

The organizer-start clarification is recorded in docs/DECISIONS.md and implementation was authorized for October 26. Keep the existing code and milestones. The first-session checklist below remains an acceptance checklist where unfinished, not an instruction to scaffold again.

Once implementation is within the applicable event window:

1. Establish one TypeScript app/worker codebase and the smallest runnable product shell. Verify current runtimes and SDKs, pin versions, and write exact local setup commands once they work.
2. Build workspace identity, source versions, durable jobs, and two-account isolation before attaching private material. Create a labeled synthetic course route so development can proceed while access is configured.
3. Time-box the actual Spark/Blackboard read-and-reconnect experiment to four focused hours. Prove a supported announcement read, linked-source follow-up, unchanged refresh, restart, and expired-session handling. If blocked, choose the named folder-plus-email fallback and record what remains unsupported.
4. In the same Day 1 milestone, confirm the first lesson family and reference material. The proposed default is ideal DC series/parallel resistor networks, matching the provided development story. Specify five independent reference cases before visual polish.
5. Complete a thin source-change-to-ready-lesson slice before expanding screens. A fixed development fixture can exercise plumbing, but the release requires real Spark decisions and at least two live source types.

Do not wait for every external dependency before completing independent local work. When a credential or access choice is genuinely required, request only that missing input and continue on the shared interfaces, synthetic cases, and numerical model. Keep unresolved routes visible.

## Default implementation choices

Use the existing Next.js/TypeScript application with Firebase Authentication and Firestore, plus the source/worker tooling in [Technical Plan](docs/TECHNICAL_PLAN.md). Preserve the current UI and checked lesson components where they work. Verify each additional provider and package rather than replacing implemented infrastructure with the original provisional stack.

Keep evidence relationships as versioned Firestore references. Spark has broad responsibility for source investigation and local graph interpretation through bounded typed tools. Application code owns authentication, invariants, time arithmetic, numerical execution, publishing, spending, and persistence.

Runtime lesson generation produces a structured specification for a checked model and approved components. It does not produce arbitrary JavaScript. See [Technical Plan](docs/TECHNICAL_PLAN.md) for contracts and the model/agent boundary.

## Preserve the ambition; control the surface area

Build for multiple private accounts and full course loads. Five concurrent courses and ten isolated test accounts are acceptance workloads, not maximums. The release has one checked quantitative lesson family and two meaningful variants; other subjects use grounded ordinary practice.

There are three main destinations: Today, Map, and Activity (October 27 update; see [UI/UX Guide](docs/UI_UX_GUIDE.md), which you should read before any UI work). Courses are lines on the map with their own detail view, and lessons open from wherever you are. Keep the ready lesson prominent. Both automatic preparation and direct requests from course material use the same service, as do real students and the isolated judge experience. Reopening a lesson must not require another assessment. The [UI Direction](docs/UI_DIRECTION.md) Ready Card spec still supplies hero states, prediction and evidence rules.

Today now includes relevant commitments and their consequences alongside ready lessons. Add one selected read-only calendar route or clearly labeled import, not a calendar editor. Career context is limited to explicit deadlines and confirmed events; no Jobs destination, application pipeline, autonomous replies, rescheduling, or delegation. R12 defines the extension and its failure cases.

Do not add a general calendar optimizer, graph canvas, extra LMS adapters, recording product, voice, Quest, social features, or multiple model integrations before the loop and release gates pass. Notion and Granola can supply relevant imports; replacing them is outside scope. Glimmer, Wonder, and SAM are optional experiments, not a model-count requirement.

## Evidence that makes the product credible

The critical gates are listed in [Demo and Evaluation](docs/DEMO_AND_EVALUATION.md):

- A scheduled source change causes a durable useful consequence without a conversational prompt.
- Real Spark source reads and decisions affect an artifact or follow-up.
- Independent numerical references, source fit, instructional fit, and runtime behavior all pass.
- At least 8 of 10 unseen supported requests produce publishable lessons without manual edits; all five negative cases fall back safely.
- Original attempts, assistance, item versions, revisions, and actual timestamps survive restart.
- A new diagnostic can overturn an earlier interpretation.
- Account isolation and source recovery work.
- A judge can open a ready lesson without signing in and try a bounded live follow-up.
- Report actual pilot and comparison results, including failures and missing access.

The Day 3 generation gate is 4 of 5 development requests. If it fails, freeze generator breadth and use checked parameterized lessons with accurately narrowed claims. If the science fails, withhold affected lessons. Those fallbacks preserve useful work; they do not count as satisfying the original flagship promise.

## What the coding agent should leave behind

After each meaningful milestone, provide a runnable result and update the build status with actual evidence: commands run, outcomes, support matrix, remaining blockers, and the next dependency. Keep architectural changes in the decision log.

Before release, provide setup instructions, migrations, deployment configuration, measured budget settings, executed verification results, source/model support, an accessible judge route, a three-minute demo, and an original-contribution/dependency record. Mark incomplete gates plainly. Public publication, deployment access, payment setup, and submission must follow Jeremy's actual authorization.

The current scope update changes product requirements only. Continue already-authorized implementation in the coding session, using the current working tree and recording verified progress. Do not assume the new hub behavior is implemented because it is documented.

