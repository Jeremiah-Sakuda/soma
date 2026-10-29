# Soma decisions and open dependencies

**Status at handoff: October 26, 2026.** “Selected” means a product decision; it does not mean the implementation exists. Keep a dated implementation log below as evidence arrives.

## Settled product decisions

| Decision | Status and consequence |
| --- | --- |
| Product name | Soma is tentative but used consistently; do not spend build time on a naming project |
| Entry | Indie Developer, Build for Your World; acceptance confirmed |
| Positioning | “Before you can study, you have to figure out what to study.” Course content plus deadlines, available time, commitments and learning evidence keep interactive lessons and practice relevant as circumstances change |
| Core loop | Change → affected commitments → supported next action → prepared activity → student interaction → adapted follow-up |
| UI | Today combines commitments and ready activities; Courses and Study remain; no separate career or scheduling product |
| UI direction | Oct 26: Jeremy selected the "Ready Card" direction from a separate design canvas: one hero lesson with its source reason, a top-header shell, and a cool neutral/blue palette in Manrope. It borrows that canvas's change entries and paired evidence layout. It replaces the provisional Fieldnotes look in `design-system/soma/MASTER.md` and `globals.css`; directions A–E in `design-system/soma/directions/` stay unselected. Spec: [UI Direction](UI_DIRECTION.md). Not yet implemented |
| Hub boundary | R12 adds source-linked deadlines/events, one selected calendar read/import route, and consequences for study; no application pipeline or external writeback |
| Entry paths | Prepared, direct request from course material, and revisit converge on the same engine |
| User scope | Multi-account, full semester; five courses and ten test accounts are evaluation workloads |
| Learning evidence | Preserve original response, help, revision, novelty, actual delay, and versions; diagnoses are revisable |
| Model authority | Broad relevant investigation and graph proposals through typed tools; application enforces invariants |
| Runtime lesson generation | Structured specs for approved models/components; arbitrary executable generation deferred |
| Meta scope | Spark first; additional models only after core gates and measured benefit |
| Optional context | Notion/Granola imports if useful; no replacement task editor or lecture recorder |
| Delivery | Day 3 generation gate; October 31 feature freeze; final assets November 3 |

## Defaults to validate

**First family:** ideal DC series/parallel resistor networks. This resolves the old RC candidate versus an example exam that excludes capacitor transients. It is a proposed implementation choice, pending Day 1 real-source fit and numerical review. One family only. Record a switch and update all linked source/demo material if another family fits better.

**Stack:** the TypeScript and managed-service baseline in [Technical Plan](TECHNICAL_PLAN.md). Verify available accounts, SDKs, runtimes, and costs. A compatible substitution can be made for an evidenced blocker without reopening the product strategy; document the reason and changed operations.

**Schedule:** the guide's explicit October 27–November 4 building period is the planning baseline. The October 26 kickoff creates an unresolved timing distinction. Record organizer clarification if relying on October 26 implementation; this is not a claim that the guide explicitly prohibits every kickoff-day coding activity.

## Open dependencies

| Dependency | Current evidence | Owner / next action | Fallback |
| --- | --- | --- | --- |
| Eligible implementation timing | Supplied guide has kickoff and building-period distinction | Jeremy: retain any organizer clarification; builder follows it | Use listed building period for planning |
| Runtime Meta access and credits | Acceptance; no applied-credit or API-call evidence in this folder | Jeremy configures his account/payment/claim; builder verifies model access and usage | Continue synthetic plumbing; do not claim live Meta integration |
| Blackboard app access | Consumer Muse works for Jeremy; standalone route unproved | Builder + Jeremy: scoped login/read/reconnect experiment Day 1 | Watched course folder plus scoped email |
| Email provider and scope | Course email is required context; provider/connector unspecified | Jeremy selects account and authorized course scope; builder verifies read route | Manual fixtures for development; live-source gate remains open |
| Gradescope route | Intended source, no standalone evidence | Verify permitted read/export route and returned-work samples | Labeled PDF/image upload |
| Hosted services | Stack selected provisionally; accounts/deployment unknown | Builder inventories access and proves worker/browser persistence | Compatible managed alternative; record it |
| Reference material and reviewer | Synthetic resistor examples available; independent review unrecorded | Jeremy chooses permitted course examples and qualified reviewer; builder records checks | Stay on bounded synthetic/reference material, report validation status |
| Additional testers | Three students targeted, no confirmed cohort here | Jeremy recruits; builder offers usable scoped onboarding | Founder-only outcomes labeled; synthetic accounts never count as pilots |
| Builder capacity | No second builder confirmed | Jeremy confirms availability | Sequence solo; cut optional work |
| Current comparison access | Desk research available; no paid hands-on result | Verify available StudyFetch tier/features at test time | Report tested setup and access limitation |
| Repository/license/video destinations | Public repo and video required; destinations not selected | Prepare artifacts; Jeremy authorizes publication/submission as appropriate | Keep local reviewable outputs ready |

Missing access is not a reason to stop independent authorized work. Do not request credentials in prose or put them in a document; use the relevant secure account configuration flow.

## Changes made in this handoff

- Combined the agent-led promise with the existing interactive-lesson thesis.
- Added an explicit scheduled, no-conversational-prompt acceptance path.
- Kept the immediate lesson opening; added a brief source-event card rather than a raw run-log tour.
- Proposed resistor networks to align model, exam scope, and returned-work examples.
- Replaced the older ten-day plan with nine dated build days from the participant guide.
- Updated public-repository, original-contribution, video, judging, and budget-notification requirements.
- Preserved the full R1–R11 scope and the existing 18 development scenarios; added seven flagship development checks.
- Kept earlier online documents and the PDF as source/history, not competing implementation plans.

## Implementation log

### October 26 — PM authorization and credential preparation

- Jeremy authorized implementation management, subagent delegation as needed, GitHub repository setup, tests, frequent commits, and merge-conflict handling. The immediate step is local credential setup.
- Existing local Git repository is on `main` with planning baseline `1a7d3a2`; no remote is configured. `gh auth status` reports the saved GitHub login invalid. GitHub creation awaits local reauthentication; no remote repository has been created by this work.
- Added empty environment template and setup instructions; created ignored `.env.local` with owner-only permissions. Meta, Supabase, Trigger.dev, and Browserbase configuration references were checked against official documentation by a research subagent. No credentials or provider connections have been validated.
- Jeremy supplied the current guide again. It retains October 26 kickoff and October 27–November 4 building period, with no additional organizer clarification. Retain the existing build-period baseline; this milestone is preparation, not product implementation.
- During implementation, use small coherent commits, assign separate ownership for concurrent subagent edits, integrate and resolve conflicts centrally, and run meaningful numerical, state, isolation, recovery, and browser checks as the corresponding behavior exists. Do not report planned checks as executed tests.

Add later entries with the motivating observation, effect on scope, verification performed, and unresolved consequences.


### October 26 — organizer start announcement and Firestore substitution

- Jeremy supplied the organizer announcement, “Hacking has officially started!”, identifying Cerebral Valley as its source. This resolves kickoff-day implementation for this project; implementation starts October 26. The historical participant guide remains unchanged. Keep October 31 feature freeze and November 4, 9 PM America/New_York deadline.
- Jeremy reported exhausting his free Supabase project allowance and requested Google Firestore. Replace the provisional Supabase stack with Firestore and Firebase Authentication. The evidence relationships remain explicit typed references; server ownership checks and transactions replace Postgres row policies and SQL transactions. Cloud setup, account isolation, quotas, and deployment still need verification.
- Local SQLite is solely an explicitly labeled synthetic development fallback. It is not a private-course production backend or proof of Firestore connectivity.
- Network-enabled `gh auth status` passed; the previous reported invalid login was a restricted-network artifact. Created private GitHub repository https://github.com/Jeremiah-Sakuda/soma; public submission visibility remains a later release step.
- Executed two bounded Meta Responses probes using `muse-spark-1.3`. First: HTTP 200, incomplete at 256 output tokens (271 total). Second: HTTP 200, completed, expected response, 975 ms, 15 input + 49 output tokens. Combined 335 tokens. No secrets or private coursework were output. This proves runtime API access, not the lesson-generation release gate or available credits.

### October 26 — student-hub scope revision

- Jeremy requested evaluation of a broader student hub and an updated scope for Codex. The selected extension is commitment context and consequences feeding the current learning engine, specified in [Scope Update](SCOPE_UPDATE.md) and PRD R12.
- Add explicit academic/career deadlines, confirmed interviews and selected personal events with source evidence; one selected calendar read/import route informs declared focus windows. Tentative invitations and ambiguous identities remain unresolved. The same event observed in calendar and email must not consume time twice.
- Preserve Today, Courses and Study, with ready lessons prominent. Learning remains the deepest action. No application lifecycle tracker, résumé/interview suite, calendar optimizer, autonomous rescheduling, messaging, applications, or delegation enters P0.
- Reuse existing Firestore, source versions, jobs, activity preparation and learning evidence. Calendar and email context can change a recommendation, not fabricate learning progress or imply external changes. The existing numerical/generation/isolation gates and October 31 freeze remain.
- The demonstration must distinguish overlap, no overlap, and tentative updates through changed data rather than fixed outcomes. Fresh variants join the existing ten held-out change scenarios; this adds no separate pilot cohort.
- This revision changes documentation only. No product code, credentials, fixtures or deployments were imported, and no application/repository tests were executed by this scope review. Current implementation work and prior verified results remain intact; new behavior needs implementation and verification.

### October 26 — Ready Card selected; cloud setup verified

- Jeremy explicitly selected `docs/UI_DIRECTION.md` Ready Card and resumed implementation. This is the separate Ready Card design, not Fieldnotes or any A–E exploration. Apply the specified light tokens, Manrope, header navigation, hero lesson, optional prediction, source explanations and evidence view to the existing app.
- Created Firebase-enabled project `soma-meta-jerem-2026`, registered Soma Web, and created native Standard Firestore in `us-east1`. The synthetic write/read/delete probe passed. Deny-all browser database rules were published; the server enforces account and demo ownership.
- Firebase email/password authentication was initialized and verified enabled using the provisioning path in official Firebase CLI 15.34.1. Initial runtime-service-account provisioning was denied; the existing owner gcloud login completed setup without broadening runtime permissions or enabling paid Identity Platform billing.
- The runtime service account credential stays outside the repository for local ADC. Hosted credentials use an encrypted server-only Vercel environment value; public web configuration contains no admin credential.
- Created and linked Vercel project `jeremiah-sakudas-projects/soma` to the existing GitHub repository. Production env is configured; a successful application deployment and end-to-end production verification are still pending.
- Actual Meta allocation is user-confirmed $150. Reserve $30, with the more restrictive $1 development application cap still active. Live lesson preparation needs its own verification; earlier API probes do not establish the generation gate.
- Jeremy will use his own source accounts and add Browserbase/Trigger.dev keys to local env. Exact LMS URL and selected course/email scope remain needed for live collection. Imports remain explicitly labeled while access is pending.

### October 26 — integrated Ready Card and live-provider evidence

- Ready Card UI checkpoint `9cd89b6` passed type checking and four Playwright journeys. Domain checkpoint `7bd3fde` adds R12 consequences, bounded sessions, corrections and preserved prediction/fresh-question evidence; 82 domain/schema checks passed.
- A real two-account Firebase test passed sign-in/session verification, record isolation, reconnection, CAS conflict, deletion/recreation and cleanup. These synthetic users are not human pilots.
- Two development live Spark preparations ran over synthetic sources: the first failed safely before publication, the second passed with source reads and deterministic validation in about 10 seconds. This is not the unseen generation evaluation. Exact supporting passages are retained for inspection.
- Firestore application ledger read $0.028642 consumed under the $1 development cap. The confirmed $150 allocation retains its $30 reserve. This ledger is not a query of the provider Billing balance and does not include unrelated provider activity.

### October 26 — production milestone

- Deployed Ready Card at https://soma-woad-beta.vercel.app. Anonymous persistence/isolation/CSRF/deletion smoke and real private-account HTTP sign-in/import/job/deletion checks passed. Browser verification opened the live lesson.
- Scoped transitive override `jwks-rsa → jose 5.10.0` resolves the observed Vercel CommonJS/ESM startup failure. Application tests and production authentication pass with the fix.
- Live source connectors and automatic scheduling remain pending the user’s Browserbase/Trigger.dev configuration and exact source scope. Current preparation jobs persist and recover but require an explicit worker invocation. No scheduled-collection claim is made.

### October 26 — browser sessions and scoped Google sources

- Jeremy requested persistent browser access to BU Blackboard (`learn.bu.edu`), Gradescope and Piazza, plus Gmail and Google Calendar connectors. This explicitly extends the earlier extra-adapter deferral; the one quantitative family and feature freeze remain unchanged.
- Use user-completed login/MFA in Browserbase and encrypted persistent contexts rather than storing institutional passwords in prompts. Collect only selected, validated course pages through a bounded read policy. Context cleanup precedes workspace deletion; failed cleanup retains references for retry.
- Google authorization uses a Web OAuth client with PKCE, one-use account/workspace-bound state, read-only scopes and encrypted refresh tokens. Gmail requires selected course queries; Calendar selects one calendar and a bounded seven-day window. No mail, coursework or calendar writes are implemented.
- Google API services and production server configuration are installed. Real Firebase encryption/state/isolation tests and connection UI checks passed; no actual Google consent, selected mail/calendar read or institutional browser read has occurred yet. Browserbase credentials are still absent. Manual imports remain available and labeled.

### October 26 — deepen the Muse Spark runtime

- Jeremy asked to work on the Muse integration while Browserbase onboarding is pending. Continue the existing Muse Spark 1.3 Meta API integration; no consumer Muse session is reused.
- Extend the same approved lesson engine with source-grounded ordinary text practice, as already specified in the PRD. Preserve the single numerical model family, strict source/version validation, account ownership and no external writes.
- Bound provider responses, tool decisions and usage accounting. Include prior attempts with explicit assistance/exposure conditions; these records cannot silently become mastery evidence.
- Reuse generated artifacts only for matching objective, source versions, model/engine versions and learner context. Explicitly identify the chosen saved lesson in the response. Split larger semester collections into bounded jobs rather than failing when source counts grow.
- Two development live API cases passed; this is not the held-out generation or independent instructional review gate. The $1 development cap and $30 allocation reserve remain unchanged.

### October 26 — consequential Spark investigation and adaptation

- Jeremy prioritized a consequential decision that cannot be established by replaying a fixed teaching script: investigate source applicability, design a discriminating interaction, and revise the next activity after contrary evidence.
- Keep model choices distinct from deterministic safety/scientific checks. Spark selects source reads, reference follows, hypotheses, experiment parameters and revisions. Application code enforces ownership, exact source versions, scoped authority evidence, numerical results, uncertainty and immutable learner observations.
- Diagnostic responses are ungraded observations. Prior support, repetition and visible-model exposure cannot become independent-understanding evidence. Compact Ready Card/lesson/why surfaces expose evidence and changes, never private reasoning traces.
- A text-only eight-call investigation reserves $0.35 with at most three daily workspace investigations, allowing an initial decision and bounded reconsideration. The standard lesson profile remains $0.20/one daily job; the $1 development application cap and $30 reserve from the actual $150 allocation remain unchanged. Unknown usage retains the actual reserved amount.
- Registered-source investigation is not browser computer use. Multimodal returned-work interpretation, real institutional reads and model-directed browser actions require separate implementation and actual verification; no such claim follows from API documentation alone.

### October 26 — preparation content and context positioning

- Jeremy approved the PM002 frame and requested that it be applied to the product documents (PM003). The opening hook is “Before you can study, you have to figure out what to study.” The continuing promise is “Your coursework changes every week. Your study tools should keep up.”
- Explain Soma through the preparation it performs: course material, upcoming deadlines, available time, and learning evidence inform interactive lessons and practice for what matters next. As classes and circumstances change, preparation stays current. Email and calendar context serve that same learning experience.
- Attribute runtime investigation and adaptation to Meta's Muse Spark. The consumer Muse workflow remains the origin and comparison baseline. Use observable behavior instead of blanket competitor-friction claims or unmeasured claims of better learning.
- Apply the frame to the PRD and submission pitch, product brief, handoff, README, scope introduction, persona introduction, demo narrative and UI copy guidance. Preserve the Ready Card interaction, existing three-minute sequence, R1–R12, acceptance gates, supported lesson family, budget controls and October 31 freeze.
- This is a documentation and positioning decision. It does not expand engineering scope or establish implementation, integration or outcome evidence. Existing implementation work, including the separate investigation/adaptation milestone, continues under its recorded authorization.

### October 26 — Explicit entrance and narrower model tool contracts

The user requested an explanatory landing entrance with account creation and a quick synthetic demo, using the updated PRD positioning. Existing Ready Card, account isolation and deep links remain. New visitors should not receive simulated course data before choosing the demo.

Live investigation failures demonstrated that schema validity does not imply argument adherence. Model-facing text and experiment preparation now have separate capabilities; irrelevant kind/null fields are supplied by the application. Finish references use bounded empty/singleton arrays and are mapped to the existing nullable domain representation before unchanged source/authority validation. Invalid or incompatible values still reject. Preserve the original 1/4 held-out result, failed development attempts and independent evaluation distinction. No acceptance gate is relaxed.

The user approved one specifically selected private instructor note being sent to Meta Spark for a private preview and then confirmed account creation. That preview and original source were transferred through verified account lookup and owner/generation/revision-checked Firestore writes, without generating auth tokens, changing runtime guards or making another Meta call. Private identifiers and content remain excluded from public artifacts. This does not establish live Soma OAuth collection.

## October 26 — P030/P031 bounded operating cap and production hardening

- Jeremy authorized adding exactly $1 to the existing $1 application cap: **$2 total**. Keep existing spend/reservations, the $150 actual allocation/$30 reserve, daily limits and per-run budgets. The two skipped synthetic cases passed at $0.09620075 additional estimated usage; ledger $0.77484450 before subsequent verification. Local/Vercel configuration changed; hosted activation is verified only by a new READY deployment.
- Close production handoff gaps through the existing app/Firestore/Browserbase architecture: authenticated bounded worker, persisted cursor and overlap lease, source-job outbox recovery, atomically queued diagnostic adaptation, current-generation publication and bounded retries. No new agent framework or database. Trigger credentials remain absent; GitHub's 15-minute schedule is a best-effort fallback with explicit capacity/latency limits. Google Cloud billing is disabled; no Cloud Scheduler or billing change was made.
- Preserve the narrow one-private-preview permission. Only actual authenticated source selection opts new text into automatic preparation; the worker does not backfill old administrative imports without that marker. Browser source scopes carry owner-declared context; selected source title/sender does not establish authority.
- New investigation contract v5 can apply explicitly registered assessment facts with exact source quotes and before/after consequences. Dates/coverage require owner-confirmed typed metadata; arbitrary prose extraction remains needs-evidence. A declared timing/no-effect refresh can clone and rebase unchanged teaching passages while preserving original lessons/attempts; diagnostics stay stale when their bound evidence changes.
- Keep release claims bounded. Managed worker/boundary tests do not establish real institutional access, returned-work image support, scientific correctness review, broad unseen model quality or genuine delayed learning. See [production readiness](PRODUCTION_READINESS.md) for executed checks and open gates.

### P031 deployed activation boundary

Runtime `8ff0b47` deployed READY with the authorized $2 total cap. The response-driven hosted synthetic follow-up passed and settled $0.03165825, bringing application usage to $0.80650275. Automatic review rejected the general worker invocation because it could process real connected sources; keep recurring dispatch disabled until the requested explicit user approval arrives. Do not activate another scheduler as a workaround. Local real Firestore tests with synthetic adapters are separate successful evidence. Trigger credentials and real source acceptance remain pending.

## October 26 — P032 selected-source background processing approved

The user answered “Enable selected-source processing,” explicitly authorizing the production worker verification and recurring read-only refresh/Meta preparation for sources selected in Soma, within the existing $2 total cap. The prior activation hold is superseded; selected-source consent, owner/generation checks, leases/retries and all budget limits remain unchanged. A direct production tick returned HTTP200/idle after scanning one account. The GitHub 15-minute fallback is enabled; first workflow verification is recorded in the build log. Trigger.dev is not deployed. No permission for external writes, unselected content or a cap increase is inferred.

## October 26 — P034 progressive decision audit

Implement a durable, owner-scoped audit journal separate from workspace revisions. Application-observed events and model-stated rationale have distinct labels. Capture bounded action proposals, actual reads/checks, citation versions, rejected proposals/repairs, usage and final publication/failure; keep missing reasons explicit. No raw provider reasoning, credentials, arbitrary request payloads or extra narration calls. Live UI and export use the same diagnostic-protection projection; preserve old events and append outcomes/corrections. A validated proposal is not a published result. All source consent, generation, read-only and spend limits remain unchanged.

## October 26 — P037 architecture iteration and returned-work hero story

Jeremy selected all three reviewed architecture improvements: typed execution-failure propagation, concentrated audited publication and matching owned-journal contracts for managed Firestore and synthetic SQLite. Keep the existing persistence format and retry categories; the refactor must preserve source consent, generation/ownership, transactional publication/outbox/lease rules, protected diagnostic explanations and spending limits. This is consolidation of existing behavior, not a general agent/queue/persistence framework.

Jeremy also requested documentation around the returned-work hero moment: visible returned work and instructor annotation → competing provisional explanations → a source-supported discriminating interaction → an original response → revised hypotheses and next activity. One actual course and a coherent objective carry the video. R12 stays in the product; its demo role is brief or in the judge route. No evaluation/independent-review gates are removed. A single prediction changes evidential support rather than proving a diagnosis. Rendering the exact source problem requires supported interpretation and the approved checked quantitative family; use an honest narrower fallback otherwise. Actual-course family choice remains unresolved, and one-family P0 remains unchanged. Image interpretation and model-directed browser navigation are not established by this documentation decision.

## October 27 — P039 institutional login trust clarification

Jeremy identified Blackboard as the primary coursework source, with Piazza and Gradescope also used, and asked for secure credential handling. Reaffirm the existing user-completed hosted login/MFA plus isolated persistent-context approach; do not add an institutional password vault or request passwords in `.env` or chat. Prioritize Blackboard verification before the other two sites. Browserbase and the authorized Soma runtime remain trusted with authenticated browser access; saved cookies are credentials, course-page selection is an application restriction rather than a provider read-only grant, and contexts can retain more than cookies. [Browser Authentication](BROWSER_AUTHENTICATION.md) records the current controls and outstanding onboarding, hosted verification, retention/key-rotation and source-read checks. These are unresolved release work, not newly verified support. No new source access, infrastructure purchase, local companion, spend increase or runtime deployment is authorized or claimed by this clarification.

## October 27 — PM012 ambitious learning graph scope

Jeremy asked to scope the graph after PM011 brainstorming. [Learning Graph Scope](LEARNING_GRAPH_SCOPE.md) now refines PRD R10/R11: connect source-supported concepts and immutable evidence; propose competing explanations; prepare a checked interactive comparison; preserve the student's response and assistance; revise interpretations and prepare a meaningful follow-up; offer a fresh application. Spark makes bounded instructional decisions while the application enforces scientific behavior, ownership, source versions, publication and budgets.

Local concept/evidence inspection in the existing Ready Card lesson surface is now required. This narrowly supersedes the earlier general graph-view deferral; a semester-wide canvas remains deferred. The strengthened adaptation criterion requires at least one contrary-response case with a newly prepared, materially different supported follow-up surviving managed persistence/reload, plus an ambiguous or unchanged branch. Existing numerical, source-fit, generation, returned-work, privacy and independent-review gates remain; documentation does not establish completion.

One verified cross-course bridge and a specialist open-weight-model experiment are conditional stretches. No automatic cross-course mastery, additional quantitative family, training dependency, per-student weights, spend increase, new database/framework or separate graph application is adopted. Actual course fit remains a prerequisite. Delivery uses the existing October 27–31 milestones, October 31 freeze and November 4 deadline. This turn changes documents only and does not initiate implementation or training.

## October 27 — P040 simulated learning graph before personal coursework

Jeremy supplied the Learning Graph Scope and requested simulated-data polish, an updated PRD and manageable milestones before testing real coursework. Adopt the bounded scope and execute M1 synthetic scenario contract → M2 durable graph records → M3 checked Spark diagnostic → M4 response-driven revision/fresh application → M5 interaction polish → M6 selected real-course validation. See [Learning Graph Milestones](LEARNING_GRAPH_MILESTONES.md). This explicitly supersedes PM012/P037 and the original Day 1 real-course-first dependency. Source fit remains mandatory before real-course interactive claims; the resistor family remains a synthetic development fixture rather than an assumed match to Jeremy's classes.

Keep the same engine, managed persistence, Ready Card, one-family limit, bounded calls/repairs, $2 cap and $30 allocation reserve. Label scripted transport, actual Spark on synthetic data, prepared artifacts and live source access separately. Synthetic source/image fixtures cannot establish institutional access or learning effects. Preserve all numerical, independent instructional, held-out, image/region, privacy, live-source and pilot release gates. Cross-course bridging and specialist training remain conditional stretches. Do not move the October 31 freeze or November 4 deadline. No scheduler configuration or previous source authorization is changed by this planning turn; no new private reads or inference are initiated.

## October 27 — P041 implement and audit synthetic graph milestones

Jeremy authorized M1–M5 implementation with a review pause after each major milestone, frequent commits and a final push to main. Reuse typed sources/investigations, both existing stores, account outbox and checked family. Persist a versioned course-local graph projection from validated canonical evidence; no arbitrary graph editor or database is added. Approved prediction forms, deterministic quantities and canonical question/option mappings replace live free-number proposals. Historical numeric artifacts retain their history but cannot create new checked evidence.

Corrections are immutable ungraded observations with original-response references. They may provisionally support or weaken an interpretation as student self-report, explicitly qualified as not independently verified; they do not upgrade independent performance. This refines the previous implementation's overly strict all-unresolved correction rule to match the supplied graph scope. Ordinary assisted choice responses retain their existing stricter interpretation constraints. Reconsideration must explicitly address both original hypotheses, show retained prior statuses and include the original response behind a correction.

Preserve the 24 KB request ceiling, all spending/time/call limits and the $2 cap. Strip only schema documentation metadata, offer no academic-update capability without confirmed facts, and coalesce only identical duplicate finish citations; scientific/source/authority validators remain. New worker artifacts require fresh assistance authorization before explanation disclosure. Preview reset generations retain inactive history through distinct identifiers. Image/PDF/region extraction remains explicitly incomplete under M5's typed fallback, not a claimed image result. Actual-model development failures and fixes remain in the audit; no real coursework or new private-source processing occurred. Independent review, held-out/live-source/pilot gates and M6 remain open.

## October 27 — P042–P044 graph review and credential recovery

Preserve original diagnostic identity across same-publication revision/new activities and source-only continuations; hypothesis IDs are local to a diagnostic, never global learner claims. Retain provisional statuses, cited observations and historical versions until explicitly revised. A cosmetic text edit is insufficient novelty. The broader concept teaching-relationship requirement remains open.

Freeze workspace generation before external cleanup and reject unresolved leases. Preserve encrypted remote references until cleanup succeeds; provide a reload-safe retry for an already-confirmed deletion. Reconcile refreshed Google credentials even if the next read fails. Public connector projection uses an allowlist; credential exchange rejects redirects; origin and body bounds are enforced before processing.

Jeremy selected credential key rotation/recovery from the architecture review. Use one shared, bounded cipher supporting original v1 reads/writes and authenticated v2 key IDs, reader-first deployment, additional read keys and admin-only transactional rewrapping. Default writes stay v1 for compatibility; do not mutate actual production keys as part of implementing the mechanism. Dry-run/apply preserve lease, generation, OAuth expiry and version invariants. Keep protected recovery copies and require full inventory plus old-writer drain before key retirement. No model, budget, family or actual-course scope expansion. See the rotation runbook and security review for remaining operational gates.

## October 27 — PM024 UI overhaul: graph-first navigation and the Playground look

Jeremy adopted the direction explored on the design canvas (PM014–PM023) and asked for a UI overhaul plus a guidance document referenced from AGENTS.md. [UI/UX Guide](UI_UX_GUIDE.md) now owns personas, navigation, layouts, visual language, motion and the accessibility checklist. It supersedes the navigation and visual sections of UI Direction (Ready Card); that document's hero states, prediction and evidence rules and copy rules stay in force.

- Navigation becomes Today · Map · Activity. Course detail stays reachable from each course line (`?view=courses`), and lessons open in place (`?view=study`); existing deep links keep working.
- Add a semester **Map** destination. This narrowly supersedes the Learning Graph Scope's "not a new full-screen graph destination". It is a transit-style projection: course lines; lesson stations whose status comes only from saved evidence (on your own, with help, two explanations, ready, source changed); dated assessments. No force-directed canvas, graph editor, mastery percentage, new graph records or new database.
- Every station gets a Make panel limited to formats the engine supports today (open or request an interactive lesson, a fresh question, or request a new lesson on a topic). Quiz and flashcard generation formats stay proposals until the engine supports them.
- The visual language moves to the canvas's Playground look: Geist and Geist Mono self-hosted via `next/font`, warm paper-white ground, indigo accent, tactile primary buttons, and animated current in the circuit that respects reduced motion.

Scope, evidence rules, budgets, the one-family limit, the October 31 freeze and the November 4 deadline are unchanged. The concurrent Blackboard connector work in `source-connections.tsx` is left untouched by this overhaul.

## P050–P051 — Use deterministic Blackboard navigation; validate Gradescope next

October 27, 2026. Jeremy authorized implementing lightweight navigation and requested Piazza afterward, noting assignments primarily live on Gradescope. Use the existing saved browser session for exact read-only BU JSON routes, explicit course discovery/mapping and bounded resumable text reads. Routine navigation requires no Meta inference. Preserve subject identity, account ownership, leases, historical mapping, source versions, partial states and provider budgets; Spark investigates committed evidence through its existing tools. The browser UI's preference-writing calls are not enabled. Actual text navigation passed a bounded probe; this does not prove image/PDF support, a complete course walk or the teaching loop. Validate Gradescope then Piazza with separate contexts and user-entered MFA. No new credential store, general agent framework or budget increase.

## P052 — Verify executable browser artifacts, not only local imports

October 27, 2026. Fall 2026 scope is explicitly selected. Hosted collection failed at Playwright import despite a passing direct service check. An isolated Vercel package reproduced its missing browser registry JSON. Include that asset for browser, Blackboard and worker routes, and run the isolated trace import in CI. Keep fixed phase diagnostics without raw exception text. Reject prebuilt packages containing dotenv/service-account paths; local Vercel builds independently include root dotenv files, so prebuilt verification requires clean staging. Existing source uploads exclude `.env*`. No session/budget limit or provider permission is expanded by this repair.

## October 27 — P055 bounded Piazza previews and explicit live gate

Reuse the existing encrypted saved-browser context and deterministic selected-class navigation for Piazza. Do not call undocumented POST APIs or open posts merely to obtain content: initial class-visible instructor-note previews are the first supported reader. Require positive note/instructor markers and exclude private, section/group and graded items before reading their text. Block APIs, sockets, frames, unselected classes and scripts outside the initial first-party inventory. Preserve owned course mappings, exclusive leases, guarded publication, original learner attempts and source-dependent staleness. Rotate one class per session across the complete saved selection; partial observations must not imply full feed coverage. Full discussion ingestion remains an open access capability, not a satisfied requirement.

Authenticated shell/class-picker inspection is evidence of access, not proof that the new typed extractor or hosted publication works. The first typed probe failed closed at URL validation; accepting empty rendered-history delimiters is a narrow synthetic-tested correction, with configured/network URLs kept strict. Subsequent Browserbase allocations returned HTTP 402 and a read-only usage response reported 60 browser minutes. Stop new allocation attempts pending owner billing/usage action. No payment, plan change, inference or Piazza material publication is authorized by that failure. See [Piazza connector](PIAZZA_CONNECTOR.md) for the remaining actual extraction, selection and readback gate.

## October 27 — P059 select GCP browser hosting, preserve existing app and cleanup

Jeremy authorized linking Soma’s existing GCP project to Deployment Billing and moving browser hosting to GCP. Keep Vercel, Firestore, course scopes, source adapters, model/evidence boundaries and the Meta spending cap. The actual billing link failed with project quota; exact user selection of an existing project to unlink is required. Do not infer an unused project from its name or delete one automatically. Available promotional credit is not verified compute eligibility.

Prepare a backend-versioned migration with fresh human sign-ins, preserved selections, fenced encrypted browser profiles, authenticated human login/control channels and dispatch for legacy Browserbase cleanup. Cloud Run’s built-in TLS makes it the first hosting proof; instance affinity/max-instances alone cannot secure persistent ownership. A VM fallback needs a trusted authenticated front door. Review storage retention and metadata/browser-process isolation. [GCP Browser Migration](GCP_BROWSER_MIGRATION.md) records milestones and gates; no new runner, billing association or provider access has been established.

### P060 billing resolution and private deployed migration checkpoint

The user selected `hodi-2026` for unlinking. Hodi billing was disabled without deleting the project; Soma linked to Deployment Billing, independently verified with the other four associations unchanged. Dedicated least-privilege worker/build identities, private encrypted state storage and a bounded Cloud Run worker are deployed. Actual synthetic browser/state/viewer checks passed; production Vercel contains the transport adapter but still selects Browserbase.

Automatic approval review rejected anonymous Cloud Run invocation because the migration request did not expressly authorize that persistent public setting. Keep the service IAM-private until explicit approval for internet invocation; application private-key/owner control and one-use human-viewer authentication remain required even if that entry setting is approved. Do not bypass the rejection. Fresh user login/MFA and actual selected-source readback remain required after activation; no state portability, credit eligibility, instance-termination recovery or live-source success is inferred from the synthetic gate.

## October 28 — P061 activate approved protected GCP sign-in entry

Jeremy explicitly approved internet invocation of the single `soma-browser` Cloud Run service. Applied only its `allUsers` / `roles/run.invoker` binding; application private-key/owner control, one-use viewer capability/cookie, private encrypted storage, network restrictions and bounded capacity remain. Actual hosted tests without Google identity headers passed unauthorized control/CDP rejection and the full synthetic state/viewer/cleanup gate.

Production now selects GCP while the app remains on Vercel. A real legacy context DELETE exposed an empty-body JSON Content-Type incompatibility; fixed the transport and added strict upstream regression tests. Do not bypass confirmed old-provider cleanup. The final clean production deployment opened BU’s actual sign-in page through the protected viewer. Human login/MFA and actual selected-course readback are separate remaining gates; legacy Gradescope/Piazza references and their cleanup key remain until their reconnects complete. No change to source permissions, model cap or learning acceptance.

## October 28 — P064 fixed thirty-minute interactive sign-in and cookie-only recovery

The user's repeated short-window/disconnection feedback exposed a ten-minute allocation counted from creation, a reconnect that preserved its clock and an unhandled early stream drop. Use a fixed thirty-minute GCP interactive window with an accurate visible countdown; retain 180-second collections, 600-second legacy login and one-use/600-second entry links. Raise only the worker's request ceiling enough to accommodate that bounded login. Do not renew expiry in response to cookie resume or network retry.

Resume authenticates the existing scoped HttpOnly cookie under exact Origin and durable fencing, including a final synchronous grant/revocation check after asynchronous work. Never substitute a URL/body token, rotate cookies or replay input during recovery. Keep local editing blocked before authentication/offline. Expired GCP allocations may be replaced through normal CAS in one click; early missing sessions retain their original references/expiry instead of abandoning a potentially active lease. No source, capacity, inference or budget expansion. Actual rollout and long-session evidence are separate executed gates, not implied by the decision.


P064 executed checkpoint: worker revision `soma-browser-00004-k8g` (2,100-second request ceiling) and clean app deployment `dpl_4fw2RTf8A1iRC2Vd84bzn9CpQPVU` are live from `67b0281`. CI passed 1,012 tests / 54 skips and 42 journeys. An actual synthetic 1,800-second allocation and cookie-only resume/135-second held-stream/cleanup gate passed. The new Gradescope viewer showed approximately 29 minutes and was handed off at the empty login form. Authentication save, source read, full thirty-minute endurance and worker-loss recovery are separate remaining gates.

## October 28 — P068 distinguish reading, decisions and usable learning

Treat source collection, investigation decisions, prepared activities and demonstrated learning as separate gates. Metadata/announcements can support planning but do not prove lecture/slides or returned-work access. A completed keep-current investigation is not a newly prepared lesson. Fix stale queued work using same-transaction workspace revision/ownership checks and clear expired lease tokens; never remove active leases, increase the five-job admission cap or reset the model ledger to make verification pass. Preserve typed safe enqueue failure facts instead of a generic handoff warning. The existing $2 cap remains; actual remaining headroom is below a new reservation, so paid source-use checks require available budget rather than a synthetic success claim. Blackboard requested fresh human authentication during the new check.

### P070 — Authorized bounded verification allowance

Jeremy explicitly approved $1 additional model testing, total cap $3, for a course-grounded activity, citation/correctness check, saved reuse and bounded follow-up. Preserve the existing global ledger, unknown-usage reservations, daily limits and twenty-percent reserve of the $150 allocation. Local verification now selects cap $3; production activation and actual run evidence must be recorded separately. This supersedes the P068 $2 blocking threshold, not the source/privacy or release gates.

## October 28 — P071 proposed opt-in credential vault, current session flow retained

The user asked to renew a stale institutional request and consider secure credential autofill. A fresh protected BU login allocation is opened through the existing owned lifecycle; human credentials/MFA and actual readback remain required. Routine viewer resume preserves the provider page and deadline, so it does not itself repair a stale SSO request.

[Credential Autofill Proposal](CREDENTIAL_AUTOFILL_PROPOSAL.md) is a design-only response: opt-in owner consent, a separately privileged KMS-backed encrypted vault/login service, exact reviewed destinations and one-use fenced fill grants, no model/general browser-control access during secret entry, human MFA, and tested revoke/delete/rotation. Independent review confirms the current runner's general CDP login control and broad HTTPS egress do not satisfy that new isolation boundary. No password form, stored institutional password, vault key, new IAM authority or autofill implementation is established. Existing saved-authorization flow and Google OAuth remain unchanged; no automatic password retries or source-write permission is introduced.

## October 28 — P072 implement opt-in vault behind a separate login boundary

Jeremy authorized implementing the P071 design. Keep the ordinary browser and manual login path; add a separately configured login-only service with no general browser-control/model API, KMS-wrapped per-version encryption, exact reviewed BU form destinations, one-use owner/session/generation grants, human MFA and safe consent/lifecycle audits. Use a dedicated private GCS bucket with conditional writes instead of adding credentials to source records; the service obtains account/workspace/connection validation through a fixed authenticated app callback and has no Firebase administrator credential. Google stays OAuth; Gradescope/Piazza autofill remains unavailable pending separate review. No unattended password retries or credential-derived learner evidence.

Code and synthetic implementation evidence do not enable production. Automatic approval review explicitly rejected Cloud KMS activation as a persistent service/cost change needing exact authorization; the following identity-creation command did not execute. Finish reviewable code/tests and request approval for the concrete key, private storage, dedicated identity and protected service rollout in `docs/CREDENTIAL_AUTOFILL_DEPLOYMENT.md`; do not bypass that rejection or put passwords under the ordinary runner's key. No new institutional password, KMS key, identity, bucket or public service is established.

Full release testing also exposed a pre-existing recommendation update that ignored the supplied processing timestamp once the real machine clock passed a fixed test event. Corrected the shared recommendation/ingestion path to use the explicit processing time while retaining labeled demo time; added a years-ahead machine-clock regression. This is a separately committed correctness repair, not expanded calendar scope or a synthetic test-clock workaround.


## October 28 — P073 approved isolated rollout; activation remains gated

The user explicitly approved the documented KMS, private vault, restricted identity/secrets and protected public Cloud Run rollout. That supersedes P072's KMS-activation approval block. Dedicated resources and the separate login service are deployed; the app's setup flag remains false. No institutional password or MFA seed was stored.

Actual cloud identity verification is still required. Automatic approval review rejected temporary impersonation authority over existing app/browser identities and a proposed Storage Admin grant to inspect/administer the new bucket; neither ran. Removing legacy bucket-owner bindings during least-privilege policy installation also denied the project owner's metadata read. Preserve the narrow runtime policy and request the concrete limited administration/temporary-verification approval in the rollout document. Do not bypass it using service-account keys, indirect jobs, broader caller authority or a general browser secret API. Synthetic hosted denials and an empty BU form review do not establish full positive hosted lifecycle, KMS/IAM separation, MFA compatibility or actual course readback.


## October 28 — P074 verified cloud boundaries and owner-only optional setup

P074 explicitly approved the narrowed metadata/verification/cleanup permissions. Persistent bucket metadata/IAM administration now uses the four-permission custom role on the exact bucket; actual privacy/retention metadata was read back. All 27 synthetic cloud checks passed with login/browser/app identities. Temporary bindings, the access-token-only role and local token/config files were removed and independently verified. A hosted disposable-account lifecycle passed and was cleaned through normal application APIs.

Keep `SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS` set to the existing owner only for this rollout; unset means normal multi-account availability and must not accidentally expose an unfinished feature globally. Malformed lists deny setup while cleanup remains possible. Owner-only availability is deployed, not proof of real BU credential/MFA or fresh coursework readback. No automatic password use occurs: fresh owner authentication and explicit separate-service consent remain required. No additional model spending was authorized.

## October 28 — P075 proposed anti-project framing

Recommend “Your next study session, prepared before you ask” as product positioning and a checked experiment that causes Soma to revise its interpretation and next activity as the demo's central proof. This is a presentation recommendation, not new scope or a completed generated-lab claim. The evidence review and three-minute proposal are in `docs/DEMO_AND_EVALUATION.md`. Current synthetic adaptation, persistence and imported real-course practice are separate evidence; integrated source-to-activity operation, course fit and meaningful model-authored composition remain explicit proof gates. Education itself is not excluded by the supplied guide; a simple education chatbot/basic RAG remains a substantial category risk if the actual demo stays at that level.

## October 29 — P083 defers the integration push for direction review

The user explicitly put P082's broad end-to-end integration completion request on the back burner and requested familiarization with the local, Git-ignored v2 proposal. Preserve the existing application and unfinished verification status. Reading this proposal does not adopt it as PRD/UI acceptance or authorize its implementation, spending or deployment. Keep the local planning file untracked; summarize understanding in chat without copying it into the public repository.
