# Canonical repository — PM091

**November 4 history safety:** the repository is now public with user authorization, and main uses rewritten history. Work from current origin/main; never merge or push old-history branches. If a normal push is refused, stop and report it; do not force it. Development logs and the prompt archive remain local ignored files and must not be re-added or cited as published evidence.

Use only the original `Jeremiah-Sakuda/soma` repository and this working folder. Its visibility changes only with the user's authorization. Both original and imported commit histories are preserved in main; do not create a separate submission repository or use archived `.local/pm*/submission` clones for new work. `.local/pm091` contains private migration backups, not a second product repository. Historical links may name the retired repository; active release/document links must use `soma`.

# Soma implementation instructions

This folder contains the Soma hackathon handoff. Follow the current user request and higher-priority instructions first. For implementation work, start with CODEX_HANDOFF.md and docs/PRD.md. For documentation-only requests, do not scaffold or implement the product.

## Current release priority — visual exploration (P084)

The user adopted the v2 pivot on October 29. Start with `docs/SOMA_V2_IMPLEMENTATION.md` and its verification record as well as the handoff/PRD. The primary journey is selected visible context → generated visual → checked manipulation → contextual follow-up → saved revision. Full-semester collection is parked; course setup must not block exploration. Preserve the existing v1 routes, data, read-only source boundaries and evidence rules. `docs/SOMA_V2_V1_BRIDGES.md` is proposed follow-up, not implemented scope. The ignored local `somav2.md` proposal must remain private.

## Authority and status

- docs/PRD.md owns product scope and release acceptance. docs/HACKATHON_REQUIREMENTS.md records the supplied event requirements. docs/BUILD_PLAN.md owns the current dated sequence. Record later decisions in docs/DECISIONS.md.
- Read docs/SCOPE_UPDATE.md for the student-hub extension: commitment context and consequences feeding the existing learning engine. PRD R12 adds the acceptance boundary; do not restart the application or build a career suite.
- **Before any UI or UX work, read `docs/UI_UX_GUIDE.md` first.** It owns personas, navigation (Today · Map · Activity), screen layouts, the visual language, motion and the accessibility checklist, and it links the design canvas and its references. It supersedes the visual language and navigation in `docs/UI_DIRECTION.md` (Ready Card), whose behavioral, evidence and copy rules still apply where the guide doesn't replace them. Preserve the existing app and verified behavior when applying it.
- The historical PDF and older online companion plans can lag these files.
- No integrations, test outcomes, pilots, or benchmark results are established merely by their appearance in a plan. Preserve explicit status.
- Jeremy supplied the organizer's hacking-start announcement and authorized October 26 implementation; see docs/DECISIONS.md. The user extended feature work past the planned October 31 freeze to add checked DC circuits (November 1–2). Keep the November 4, 9 PM America/New_York submission deadline.

## Product invariants

- Soma is the product and agent. Spark is the runtime Meta model. The consumer Muse workflow is the origin and comparison baseline.
- Deliver the complete change-to-next-action loop. Course changes and confirmed nonacademic commitments can affect the next study session; useful persistent output must not require a conversational prompt. Learning remains the deepest action.
- Use selected calendar/email context, source-linked commitments, and inspectable before/after consequences. No separate career pipeline, general schedule solver, calendar writeback, or delegation. Tentative invitations stay tentative; no-overlap changes should preserve valid recommendations.
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

### Build log maintenance

- Maintain `docs/BUILD_LOG.md` and its canonical verbatim prompt archive, `docs/build-log/prompts.json`, throughout the build. Both are kept locally and are not published. Read the latest entries when resuming work.
- Capture every human prompt and clarification answer in this coding conversation verbatim, preserving spelling, whitespace and line breaks. Assign a stable prompt ID and retain the actual timestamp when available; do not invent timestamps or reconstruct missing text. Exclude platform-injected context and inter-agent messages.
- For each prompt, record the top three material outcomes and any deviations from `docs/BUILD_PLAN.md`, the PRD or other documented decisions. Mark pending, blocked or unverified outcomes honestly; do not fabricate three successes. Link relevant commits, artifacts and executed checks where available.
- Add prompts as they arrive and update outcomes before ending each turn and at meaningful checkpoints. Preserve original prompt text; append dated corrections or follow-up evidence. Label retrospective entries and cross-reference superseding prompts. Keep architectural/scope decisions in `docs/DECISIONS.md` as well.
- Credential and private-data exclusions still apply: never commit secret values, session material, private course documents or learner records from a prompt. Use an explicit redaction marker and explain the exception to verbatim logging; do not make another plaintext secret archive.

Complete a thin end-to-end slice early. Use original synthetic scenarios for development and clearly label them. Prove real source access separately. Time-box failed access experiments and use the documented fallback.

Run meaningful checks for numerical behavior, state changes, account isolation, source recovery, and user journeys. Report executed results; do not write tests that simply restate a mocked implementation. Keep held-out release cases outside prompts and tuning.

Use actual tool activity and concise decision records for inspectability; do not fabricate run logs or expose private internal reasoning. Live inference, prepared artifacts, uploaded sources, recordings, replay, and simulated time must be distinguishable.

Do not expand P0 to improve model count. Preserve the Day 3 lab decision and time for correctness and visual polish. Check the main lesson at the target viewport, keyboard-only, and with reduced motion.

Keep credentials, session state, private course documents, and learner records out of public code, fixtures, and demo assets. Preserve required third-party notices and identify original event work accurately. Ask for missing inputs only when needed; continue independent authorized work meanwhile.


<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
