# Soma — implementation handoff

**Turn what you are looking at into something you can explore.**

Open [`/explore`](https://soma-woad-beta.vercel.app/explore), select a screenshot or window, and ask a question. Meta Muse Spark interprets the selected context, uses application-computed BFS feedback and composes a visual scene. Change the experiment, select an object for a follow-up, then save and reopen the exact version. A prepared original example is available without an account or a model call.

The first checked family is small unweighted breadth-first search. Other visual explanations are labeled explanation-only, and missing context can trigger clarification. Raw screenshots and voice recordings are transient by default. Optional Muse transcription produces an editable question; captioned speech output uses the browser’s voice.

**Current scope and milestones:** [visual-exploration implementation](docs/SOMA_V2_IMPLEMENTATION.md). **Executed evidence and limits:** [verification record](docs/SOMA_V2_VALIDATION.md). The existing course workspace and deep links remain available. [Proposed v1 bridges](docs/SOMA_V2_V1_BRIDGES.md) describe selected course material, distinct learning evidence and background preparation; they are not implemented integrations.

## Read in this order

1. [Handoff](CODEX_HANDOFF.md): first actions, priorities, and current status.
2. [Product brief](docs/PRODUCT_BRIEF.md): positioning, audience, and the coherent product story.
3. [PRD](docs/PRD.md): adopted v2 release acceptance plus the retained v1 requirements.
4. [Technical plan](docs/TECHNICAL_PLAN.md) and [build plan](docs/BUILD_PLAN.md): architecture, contracts, dependencies, and dated milestones.
5. [Demo and evaluation](docs/DEMO_AND_EVALUATION.md): what must work and what evidence to collect.

Supporting documents: [UI guide](docs/UI_UX_GUIDE.md) (current entry, visual language and accessibility), [user stories](docs/USER_STORIES.md), [decisions and open dependencies](docs/DECISIONS.md), [event requirements](docs/HACKATHON_REQUIREMENTS.md), [competitive research](docs/RESEARCH.md), [development scenarios](docs/fixtures/DEVELOPMENT_SCENARIOS.md), and [source index](docs/SOURCE_INDEX.md).

Credential preparation: use the ignored `.env.local` file and [local setup instructions](docs/LOCAL_SETUP.md). The committed `.env.example` contains empty credential placeholders.

[AGENTS.md](AGENTS.md) provides implementation instructions for coding agents. The local PRD incorporates later conversation decisions and the participant guide. The existing [October 22 PDF](output/pdf/Soma%20PRD.pdf) is retained as a historical export; use the local Markdown documents for this build.

Jeremy supplied the organizer's start announcement and authorized October 26 implementation. The submission deadline remains **November 4 at 9 PM America/New_York**, with feature freeze October 31. Public repositories and a three-minute video are required; public release and submission status are recorded separately from local implementation.

