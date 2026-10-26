# Soma implementation instructions

This folder contains the Soma hackathon handoff. Follow the current user request and higher-priority instructions first. For implementation work, start with CODEX_HANDOFF.md and docs/PRD.md. For documentation-only requests, do not scaffold or implement the product.

## Authority and status

- docs/PRD.md owns product scope and release acceptance. docs/HACKATHON_REQUIREMENTS.md records the supplied event requirements. docs/BUILD_PLAN.md owns the current dated sequence. Record later decisions in docs/DECISIONS.md.
- The historical PDF and older online companion plans can lag these files.
- No integrations, test outcomes, pilots, or benchmark results are established merely by their appearance in a plan. Preserve explicit status.
- The supplied guide lists an October 26 kickoff and October 27–November 4 building period. Record organizer clarification when resolving eligibility of kickoff-day implementation. Submission is November 4 at 9 PM America/New_York.

## Product invariants

- Soma is the product and agent. Spark is the runtime Meta model. The consumer Muse workflow is the origin and comparison baseline.
- Deliver the complete course-event-to-lesson-to-follow-up loop. It must create useful persistent output without a conversational prompt.
- Interactive lessons remain prominent. Support automatic preparation, direct requests, and revisits through one engine. Exploration and help must not require a compulsory assessment.
- Keep full-semester, multi-account support. Five courses and ten test accounts are verification workloads, not hard limits.
- Keep one approved quantitative family for P0. The proposed first family is ideal DC series/parallel resistor networks; confirm source fit before committing. Do not attach an excluded topic to an exam.
- Source access is read-only. Do not send messages, submit coursework, or write to connected services as part of collection.
- Store observations separately from interpretations. Retain original attempts, revisions, assistance, source/model versions, uncertainty, and actual time. A diagnosis is revisable.
- Exploration, completion, card self-ratings, and assisted answers cannot silently become independent-understanding evidence.
- Course sources remain authoritative for academic facts. Soma stores derived context and its own learning records.

## Engineering defaults

Use the provisional TypeScript stack in docs/TECHNICAL_PLAN.md; verify current APIs and pin compatible versions. One app/worker codebase, versioned evidence graph in Firestore (user-authorized replacement for Supabase; see docs/DECISIONS.md), bounded Spark tools, managed persistence, separate browser runner. Do not add a graph database or agent framework without a demonstrated need.

Generate typed lesson specifications for approved components. Keep numerical models deterministic and independently checked. Generated content cannot run arbitrary code, access credentials, write learner evidence directly, or modify validation rules.

Enforce workspace ownership at HTTP, database, storage, job, browser-session, and tool boundaries. Validate model outputs and references. Make ingestion and job retries idempotent. Recheck source/model versions before publication. Show stale sources honestly.

Bound calls, tokens, retries, wall time, and spend; unchanged-source checks should avoid inference where possible. Reserve 20 percent of the actual Meta allocation. Provider billing notifications do not replace application-enforced budgets.

## Working and verification

Complete a thin end-to-end slice early. Use original synthetic scenarios for development and clearly label them. Prove real source access separately. Time-box failed access experiments and use the documented fallback.

Run meaningful checks for numerical behavior, state changes, account isolation, source recovery, and user journeys. Report executed results; do not write tests that simply restate a mocked implementation. Keep held-out release cases outside prompts and tuning.

Use actual tool activity and concise decision records for inspectability; do not fabricate run logs or expose private internal reasoning. Live inference, prepared artifacts, uploaded sources, recordings, replay, and simulated time must be distinguishable.

Do not expand P0 to improve model count. Preserve the Day 3 lab decision, October 31 feature freeze, and time for correctness and visual polish. Check the main lesson at the target viewport, keyboard-only, and with reduced motion.

Keep credentials, session state, private course documents, and learner records out of public code, fixtures, and demo assets. Preserve required third-party notices and identify original event work accurately. Ask for missing inputs only when needed; continue independent authorized work meanwhile.

