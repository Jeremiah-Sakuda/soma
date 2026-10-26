# Soma — implementation handoff

Soma keeps students ready as their classes and commitments change. It connects course updates, relevant email, and selected calendar context to useful next actions. Interactive lessons and evidence-based follow-up are its deepest capability.

**Start with [CODEX_HANDOFF.md](CODEX_HANDOFF.md) and the [scope update](docs/SCOPE_UPDATE.md).** Implementation has started in this folder. The documents describe intended behavior; current implementation evidence and limitations are recorded in [Decisions](docs/DECISIONS.md). The student-hub extension should build on the existing app, not replace it.

## Read in this order

1. [Handoff](CODEX_HANDOFF.md): first actions, priorities, and current status.
2. [Product brief](docs/PRODUCT_BRIEF.md): positioning, audience, and the coherent product story.
3. [PRD](docs/PRD.md): complete requirements R1–R12 and release gates.
4. [Technical plan](docs/TECHNICAL_PLAN.md) and [build plan](docs/BUILD_PLAN.md): architecture, contracts, dependencies, and dated milestones.
5. [Demo and evaluation](docs/DEMO_AND_EVALUATION.md): what must work and what evidence to collect.

Supporting documents: [UI direction](docs/UI_DIRECTION.md) (selected screens, states and tokens), [user stories](docs/USER_STORIES.md), [decisions and open dependencies](docs/DECISIONS.md), [event requirements](docs/HACKATHON_REQUIREMENTS.md), [competitive research](docs/RESEARCH.md), [development scenarios](docs/fixtures/DEVELOPMENT_SCENARIOS.md), and [source index](docs/SOURCE_INDEX.md).

Credential preparation: use the ignored `.env.local` file and [local setup instructions](docs/LOCAL_SETUP.md). The committed `.env.example` contains empty credential placeholders.

[AGENTS.md](AGENTS.md) provides implementation instructions for coding agents. The local PRD incorporates later conversation decisions and the participant guide. The existing [October 22 PDF](output/pdf/Soma%20PRD.pdf) is retained as a historical export; use the local Markdown documents for this build.

Jeremy supplied the organizer's start announcement and authorized October 26 implementation. The submission deadline remains **November 4 at 9 PM America/New_York**, with feature freeze October 31. Public repositories and a three-minute video are required; public release and submission status are recorded separately from local implementation.

