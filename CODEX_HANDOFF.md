# Soma: start here

**Handoff date: October 26, 2026.** Jeremy has been accepted to the Meta Global AI Developer Hackathon. The target is a competitive Indie Developer entry under Build for Your World. This is an implementation brief, not evidence that the product already exists.

## The product to build

Soma monitors a student's authorized course sources and keeps their next study session ready. When a source changes, Spark determines the appropriate consequence: reprioritize an existing lesson, change exam eligibility, revise affected content, investigate returned feedback, or do nothing. The result is a persistent learning activity the student can open without writing a prompt.

Interactive lessons are central. Students manipulate meaningful controls, inspect the relationship, request an explanation, and optionally answer a fresh question. Their responses change what Soma prepares next. Preserve the difference between exploration, assisted completion, and later independent performance.

Use this complete loop as the implementation spine:

**Course event → relevant source reads → supported decision → prepared or updated lesson → student interaction → evidence-backed follow-up → later return.**

## What is here and what is not

The folder contains the complete reconciled [PRD](docs/PRD.md), [user stories](docs/USER_STORIES.md), engineering and delivery plans, evaluation instructions, original synthetic source material, and the supplied participant guide. An older PDF remains in output/pdf.

No application source, initialized deployment, working standalone connector, verified model integration, numerical validation result, recruited pilot cohort, or measured competitive advantage was established while preparing this handoff. Do not turn planned targets into completed checkmarks.

Jeremy reports that his existing consumer Muse workflow already checks Blackboard, Gradescope, and email, using a browser where needed. That is the origin and baseline. It does not provide Soma with an application API key, authenticated browser session, or reusable consumer-assistant infrastructure.

## First implementation session

Read [AGENTS.md](AGENTS.md), the [product brief](docs/PRODUCT_BRIEF.md), and the [event constraints](docs/HACKATHON_REQUIREMENTS.md). Then inspect the actual environment and existing files before scaffolding. Work in this folder unless Jeremy directs otherwise; preserve the documentation and historical PDF.

Use the guide's October 27–November 4 building period for scheduling. The guide also has an October 26 kickoff; record any organizer clarification before relying on kickoff-day work as eligible implementation. That uncertainty does not block reading, planning, or documenting dependencies.

Once implementation is within the applicable event window:

1. Establish one TypeScript app/worker codebase and the smallest runnable product shell. Verify current runtimes and SDKs, pin versions, and write exact local setup commands once they work.
2. Build workspace identity, source versions, durable jobs, and two-account isolation before attaching private material. Create a labeled synthetic course route so development can proceed while access is configured.
3. Time-box the actual Spark/Blackboard read-and-reconnect experiment to four focused hours. Prove a supported announcement read, linked-source follow-up, unchanged refresh, restart, and expired-session handling. If blocked, choose the named folder-plus-email fallback and record what remains unsupported.
4. In the same Day 1 milestone, confirm the first lesson family and reference material. The proposed default is ideal DC series/parallel resistor networks, matching the provided development story. Specify five independent reference cases before visual polish.
5. Complete a thin source-change-to-ready-lesson slice before expanding screens. A fixed development fixture can exercise plumbing, but the release requires real Spark decisions and at least two live source types.

Do not wait for every external dependency before completing independent local work. When a credential or access choice is genuinely required, request only that missing input and continue on the shared interfaces, synthetic cases, and numerical model. Keep unresolved routes visible.

## Default implementation choices

Use Next.js, TypeScript, Tailwind, shadcn/ui, Vercel, Supabase Auth/Postgres/Storage, Trigger.dev Cloud, Playwright with Browserbase, Muse Spark 1.3 through Meta Model API, PDF.js, ts-fsrs, and approved SVG/React lesson components. These are baseline choices to verify, not installed or proven dependencies.

Keep the evidence graph in Postgres. Spark has broad responsibility for source investigation and local graph interpretation through bounded typed tools. Application code owns authentication, invariants, numerical execution, publishing, spending, and persistence.

Runtime lesson generation produces a structured specification for a checked model and approved components. It does not produce arbitrary JavaScript. See [Technical Plan](docs/TECHNICAL_PLAN.md) for contracts and the model/agent boundary.

## Preserve the ambition; control the surface area

Build for multiple private accounts and full course loads. Five concurrent courses and ten isolated test accounts are acceptance workloads, not maximums. The release has one checked quantitative lesson family and two meaningful variants; other subjects use grounded ordinary practice.

There are three main destinations: Today, Courses, and Study. Keep the ready lesson prominent. Both automatic preparation and direct requests from course material use the same service, as do real students and the isolated judge experience. Reopening a lesson must not require another assessment.

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

No implementation is requested by the act of preparing this handoff itself. Begin implementation when Jeremy assigns it to the coding session.

