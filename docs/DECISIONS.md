# Soma decisions and open dependencies

**Status at handoff: October 26, 2026.** “Selected” means a product decision; it does not mean the implementation exists. Keep a dated implementation log below as evidence arrives.

## Settled product decisions

| Decision | Status and consequence |
| --- | --- |
| Product name | Soma is tentative but used consistently; do not spend build time on a naming project |
| Entry | Indie Developer, Build for Your World; acceptance confirmed |
| Positioning | Student hub keeps the next action useful as classes and commitments change; interactive learning is the deepest capability |
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
