# Soma decisions and open dependencies

**Status at handoff: October 26, 2026.** “Selected” means a product decision; it does not mean the implementation exists. Keep a dated implementation log below as evidence arrives.

## Settled product decisions

| Decision | Status and consequence |
| --- | --- |
| Product name | Soma is tentative but used consistently; do not spend build time on a naming project |
| Entry | Indie Developer, Build for Your World; acceptance confirmed |
| Positioning | Agent monitors changing coursework and keeps a useful session ready; interactive lessons remain the central payoff |
| Core loop | Source change → real decision → persistent learning artifact → student interaction → adapted follow-up |
| UI | Today, Courses, Study; a ready lesson is prominent; familiar educational labels stay |
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

