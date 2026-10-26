# Soma build log

**Established October 26, 2026.** Chronological user direction, three material outcomes per prompt, and explicit deviations from the documented plan. Dates below use America/New_York. This first edition is a retrospective backfill from this coding conversation; outcomes describe the state at backfill, not necessarily work completed immediately after each message.

## How to read and maintain this log

- [Prompt archive](build-log/prompts.json) is the canonical verbatim record, preserving original spelling, whitespace, line breaks and timestamps. UI clarification answers retain their question as context; platform wrappers, injected environment/AGENTS context and inter-agent messages are not user prompts.
- Every new human prompt or clarification answer gets a stable ID, exact text, three outcome slots, and a deviation note. Update outcomes as work completes; mark pending or unverified items explicitly rather than inventing a third success.
- Keep the original prompt immutable. Add later corrections as dated updates and cross-reference the prompt that changed direction. Update before ending each turn and at meaningful checkpoints.
- Never publish secrets, credentials, private course content or learner records. If a future prompt contains them, retain only a clearly marked redacted record in version control and note that this is an explicit exception to verbatim public logging. Do not create a second plaintext secret archive.
- BUILD_PLAN owns sequence, PRD owns acceptance, and DECISIONS owns decisions. This log tracks what prompted work and what actually resulted; it does not replace those documents.
- Coverage: P001–P011 are all recoverable human inputs in this coding conversation at creation. Prompts from other chats are not reconstructed; supplied scope documents are referenced as documents. No missing timestamps, tests or outcomes are fabricated.

## P001 — Project orientation

**Received:** 2026-10-26 11:03:45 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
Alright, this is a new project, there are a few docs for you to familiarize yourself with 
```

**Top 3 outcomes (state at backfill):**

1. The existing Soma handoff and product documents establish the implementation baseline; no replacement project was created.
2. The original planning snapshot is preserved in Git (`1a7d3a2`).
3. Current scope authority is identified as PRD, build sequence as BUILD_PLAN, and later decisions as DECISIONS; historical plans are supporting context.

**Plan deviations:** None established for this orientation request. These are retrospective observations of the retained baseline, not a reconstructed claim of unseen tool activity.

## P002 — UI UX Pro Max availability

**Received:** 2026-10-26 11:39:40 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
Do you have the UI UX pro max skill? 
```

**Top 3 outcomes (state at backfill):**

1. UI UX Pro Max is available locally at `/Users/jerem/.codex/skills/ui-ux-pro-max/SKILL.md`.
2. The existing design system is retained at `design-system/soma/MASTER.md`.
3. The skill is explicitly applied to the three proposed visual directions under P010; a final visual direction has not been selected.

**Plan deviations:** No product-scope change. Availability is verified at backfill time; no earlier installation action is inferred.

## P003 — PM mandate, credentials and delivery process

**Received:** 2026-10-26 12:28:38 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
Alright. You are the PM  for this hackathon. Your directive is to use subagents as needed to fully implement the solution, in charge of initializing a github repo, setting up tests, and committing very frequemtly to keep track of progress, and then handling any merge conflicts. Let's start by me giving you whatever API keys you need in an env file 
```

**Top 3 outcomes (state at backfill):**

1. Ignored, owner-only local environment setup and safe placeholder documentation were prepared (`24ef86e`).
2. Domain, product UI, persistence and credential research work were delegated; root integrates changes and checks ownership boundaries.
3. A private GitHub repository (`Jeremiah-Sakuda/soma`) and local checkpoints exist, including `87747d7` and `7fb4e46`; public publication and remote push are not established by this entry.

**Plan deviations:** The initial restricted-network GitHub authentication failure was later disproved by a network-enabled check. Public repository visibility is still a release requirement. No merge-conflict resolution is claimed where no conflict was observed.

## P004 — Participant guide supplied in clarification answer

**Received:** 2026-10-26 12:30:47 EDT · **Recorded:** retrospective, October 26, 2026

**Clarification question (context, not user wording):** The supplied guide lists October 26 kickoff but October 27 as the start of building. Have organizers confirmed that product implementation today is eligible? I can finish credential and repository preparation while this is unresolved.

**Verbatim prompt:** Full 13,329-character answer in [prompt archive](build-log/prompts.json), entry `P004`. The long pasted guide is not duplicated here.

**Top 3 outcomes (state at backfill):**

1. The complete supplied guide is retained verbatim in the prompt archive, including its kickoff and building-period distinction.
2. Meta incorporation, public repository, original event work and the November 4 submission requirements inform the project constraints.
3. The timing uncertainty was resolved by the later organizer announcement in P005, not by rewriting this guide.

**Plan deviations:** Preparation initially stayed within the existing timing baseline. P005 explicitly supersedes that timing uncertainty. The pasted guide is user-supplied evidence, not an independent verification of the website.

## P005 — Organizer announcement authorizes implementation

**Received:** 2026-10-26 12:33:07 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
They just announced: **Hacking has officially started!** Event details can be found [here](https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details "here

(https://cerebralvalley.ai/e/meta-ai-developer-hackathon/details)") and ask all your questions in the Discord.
Cerebral Valley so I think we're good to s tart
```

**Top 3 outcomes (state at backfill):**

1. The user-supplied organizer start announcement is recorded in DECISIONS as authorization to begin on October 26.
2. The pinned TypeScript/Next.js scaffold and Firebase substitution checkpoint were created (`87747d7`).
3. The versioned learning engine and isolated session foundation were checkpointed (`7fb4e46`); the October 31 freeze and November 4 deadline remain.

**Plan deviations:** Implementation begins October 26 rather than the guide’s October 27 building-period baseline, based on the organizer clarification supplied by the user. See DECISIONS, “organizer start announcement and Firestore substitution.”

## P006 — Firestore substitution and Meta API probe

**Received:** 2026-10-26 12:37:37 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
I have exceeded my free supabase projects, can we use google firestore? Also meta API should be there test it 
```

**Top 3 outcomes (state at backfill):**

1. Firestore/Firebase replaces provisional Supabase because the user exhausted free Supabase projects; versioned evidence references and server ownership checks remain.
2. Two bounded Meta probes returned HTTP 200: first incomplete at its output cap, second completed with the expected response (15 input + 49 output tokens, 975 ms); 335 tokens combined.
3. A local SQLite fallback supports explicitly synthetic development only; Firestore-mode server persistence and isolation checks are implemented, but actual cloud read/write verification remains pending.

**Plan deviations:** User-authorized persistence change from relational Supabase/Postgres to Firestore. SQLite is temporary synthetic infrastructure, not production private-data storage. Successful API probes are not a lesson-generation release pass.

## P007 — Actual Meta credit allocation

**Received:** 2026-10-26 12:48:40 EDT · **Recorded:** retrospective, October 26, 2026

**Clarification question (context, not user wording):** What Meta API credit balance is actually available in Billing? I’ll use that amount to enforce the 20% reserve before enabling automatic inference. The key test passed, but it does not confirm the credit balance.

**Verbatim prompt:**

```text
150 free credits they gave
```

**Top 3 outcomes (state at backfill):**

1. The user reports $150 in free Meta credits; this is a user-confirmed allocation, not an independently queried Billing balance.
2. The 20% reserve is $30, leaving an absolute allocation-based ceiling of $120.
3. Current local application configuration is more restrictive: $1 spend cap with bounded calls and transactional reservations; it does not authorize spending the full $120 immediately.

**Plan deviations:** No reserve-policy deviation. The lower application cap is an intentional development limit. No remaining provider balance is inferred from token counts.

## P008 — Firebase provisioning through gcloud

**Received:** 2026-10-26 12:54:03 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
is it possible for you to create the firebase application using the gcloud cli and get the credentials to fill in? 
```

**Top 3 outcomes (state at backfill):**

1. Created Firebase-enabled Google Cloud project `soma-meta-jerem-2026` and registered its Soma Web application; public client configuration was written directly to ignored local env.
2. Created a free-tier native default Firestore database in `us-east1` and a project-scoped runtime service account.
3. A runtime credential file was created outside the repository. Application wiring, actual cloud connectivity checks and explicit rules deployment remain pending at this pause.

**Plan deviations:** Provisioning uses gcloud authentication plus Firebase Management REST calls because Firebase CLI has no login. No paid billing upgrade is recorded. Resource creation does not establish deployed application connectivity.

## P009 — Vercel deployment target

**Received:** 2026-10-26 12:55:51 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
Also, we'll deploy on vercel 
```

**Top 3 outcomes (state at backfill):**

1. Vercel is the selected hosting destination.
2. Vercel CLI authentication and the accessible account/team were checked successfully.
3. Project linking, encrypted environment configuration and deployment remain pending; no deployed URL is claimed.

**Plan deviations:** Hosting is now explicitly Vercel; credentials must use a server environment mechanism rather than a developer-machine credential path. Deployment work is paused for P010’s design selection.

## P010 — Build log and visual-direction review

**Received:** 2026-10-26 13:05:24 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
Actually before we continue. 1) Establish a build log, with instructions to update it in AGENTS.md. The build log should capture all prompts I give verbatim, as well as the top 3 outcomes that it had, and any deviations from documented plan. Fill it retroactively with the first few prompts And 2) have the product design agent generate a few visual diractions, so i can pick one. Use the UI UX pro max skill 
```

**Top 3 outcomes (state at backfill):**

1. Established this build log and the exact-text prompt archive; backfilled all 11 human prompts/answers available in this coding conversation, with original timestamps.
2. Added mandatory prompt/outcome/deviation maintenance instructions to AGENTS.md, including honest pending status and secret exclusions.
3. Product design agent delivered Fieldnotes, Daylight and Focus using UI UX Pro Max and the updated scope. The self-contained [comparison](../design-system/soma/directions/index.html) and nine desktop/lesson/mobile screenshots are ready. Agent checks passed for 1440×900 CTA visibility, 375/390px overflow, keyboard circuit interaction and native dialogs; root visually reviewed all three desktop concepts plus mobile and lesson samples.

**Plan deviations:** User-directed pause in implementation/deployment for traceability and design review. Concepts are proposals; existing app design and master design system remain unchanged until selection.

## P011 — Updated scope and handoff supplied

**Received:** 2026-10-26 13:05:27 EDT · **Recorded:** retrospective, October 26, 2026

**Verbatim prompt:**

```text
I have also provided a scope update and updated the handoff doc
```

**Top 3 outcomes (state at backfill):**

1. Read updated CODEX_HANDOFF.md and docs/SCOPE_UPDATE.md; the extension is commitment context feeding the existing learning engine.
2. Design concepts use the same confirmed interview, 45-to-20-minute focus-window consequence and reusable resistor lesson so visual choices compare the same product behavior.
3. Preserved the user’s in-flight documentation edits. New R12 behavior remains a requirement to implement and verify, not a feature completed by this documentation review.

**Plan deviations:** Compared with the earlier course-only loop, R12 adds source-linked commitments/consequences and at most one selected calendar read/import route. It defers extra adapters and integrations, preserves the freeze, and excludes external writeback or a career suite. See SCOPE_UPDATE and PRD R12.

## P012 — Compare Google-inspired concepts without the skill

**Received:** 2026-10-26 13:15:23 EDT · **Recorded:** during work, October 26, 2026

**Verbatim prompt:**

```text
I think fieldnotes is the best as is, but I am not sure about any of them. Can you try generate without using the skill so I can compare? I am thinking about google's design language for notebookLM and gcal so it's more user friendly 
```

**Top 3 outcomes:**

1. Fieldnotes is the user’s current preference, not a final selection; the existing concept is preserved as the comparison baseline.
2. Product design agent redirected to two new concepts without UI UX Pro Max: a NotebookLM-inspired content workspace and a Calendar-inspired agenda, using official visual references and independent design reasoning.
3. Delivered [Study Notebook and Everyday Agenda](../design-system/soma/directions/google-inspired.html), six screenshots and [reference/validation notes](../design-system/soma/directions/GOOGLE_INSPIRED.md). Both passed the agent’s keyboard circuit interaction, native dialog/Escape, reduced-motion, 375/390px overflow and 1440×900 action-visibility checks. Root reviewed both desktop screenshots and the Notebook browser view; Fieldnotes files have no changes against checkpoint `7ba41e1`.

**Plan deviations:** This explicitly overrides P010’s skill requirement for the new comparison concepts. Pause final design selection and implementation while the user compares alternatives. The same student-hub scope and learning invariants remain. Ambient browser metadata was excluded from the verbatim human prompt.

### October 26 — P010 completion evidence / P012 continuation

The log and maintenance rules were checkpointed in `24f8992`. All 11 original archived prompt texts matched the original chat records exactly, including whitespace; each has three outcome slots and a deviation note. The three initial design proposals are complete, with checks and tradeoffs in [directions README](../design-system/soma/directions/README.md). A local comparison runs at `http://127.0.0.1:3101/`; this is a design preview, not a production deployment. P012 requests additional concepts before selecting an implementation direction.

### October 26 — P012 completion evidence

D/E were authored without further skill reads, skill searches or skill-derived templates; official NotebookLM and Google Calendar references and independent design reasoning informed this comparison. Root opened the new preview in the in-app browser. The originals remain available through its A/B/C link. All 12 human inputs are archived; no final design selection is inferred. Application implementation and Vercel deployment remain paused for this user-directed review.

## P013 — Implementation continuation / source setup

**Received:** 2026-10-26T13:35:36.310000-04:00 · **Recorded:** during work, October 26, 2026

**Verbatim prompt:**

```text
Implement the Ready Card spec in docs/UI_DIRECTION.md, not Fieldnotes..  COntinue with the rest o fthe project as well 
```

**Top 3 outcomes:**

1. Ready Card in UI_DIRECTION.md is selected; Fieldnotes and A–E remain unselected explorations.
2. Resumed UI, domain and account/import implementation in parallel using the existing codebase.
3. Firebase/Vercel completion is verified: production is live at https://soma-woad-beta.vercel.app. Ready Card, account/import interfaces, R12 consequences and persistent preparation jobs are implemented; executed checks and remaining release gates are in IMPLEMENTATION_STATUS.md.

**Plan deviations:** User ends the design-comparison pause. UI_DIRECTION supersedes the provisional visual master; update the master without changing PRD/R12 acceptance.

## P014 — Implementation continuation / source setup

**Received:** 2026-10-26T13:38:09.564000-04:00 · **Recorded:** during work, October 26, 2026

**Verbatim prompt:**

```text
We'll use my own
```

**Top 3 outcomes:**

1. User clarification recorded; own accounts are the intended source context.
2. Local-key setup remains with the user; secret values must stay out of chat and version control.
3. Live source verification remains pending; the bounded import path proceeds meanwhile.

**Plan deviations:** No new scope change. Provider access is pending rather than claimed complete.

## P015 — Implementation continuation / source setup

**Received:** 2026-10-26T13:38:09.564000-04:00 · **Recorded:** during work, October 26, 2026

**Verbatim prompt:**

```text
I’ll add them to .env.local
```

**Top 3 outcomes:**

1. User clarification recorded; own accounts are the intended source context.
2. Local-key setup remains with the user; secret values must stay out of chat and version control.
3. Live source verification remains pending; the bounded import path proceeds meanwhile.

**Plan deviations:** No new scope change. Provider access is pending rather than claimed complete.

## P016 — Continue implementation

**Received:** 2026-10-26T13:46:47.306000-04:00

**Verbatim prompt:**

```text
continue 
```

**Top 3 outcomes:**

1. Resumed all three implementation agents after the interruption; preserved their in-flight changes.
2. Ready Card browser journeys, R12 domain/schema checks, real Firebase two-account checks and bounded live Spark preparation have executed; evidence is recorded in IMPLEMENTATION_STATUS.md.
3. Account imports and durable preparation jobs are implemented. Production deployment and anonymous HTTP persistence/isolation checks passed; private account HTTP verification also passed (secure session, persisted/deduplicated import, queued preparation, cross-origin rejection and deletion).

**Plan deviations:** No new scope. Scheduled external collection remains pending provider keys and selected institution access; imported sources stay labeled.

### October 26 — deployed Ready Card milestone

Production: https://soma-woad-beta.vercel.app. Integrated typecheck and 123 unit checks passed; five browser journeys passed. Live backend Firebase and Spark checks are separate opt-in tests, not included in that unit count. The first deployment exposed a Firebase transitive ESM import failure; the scoped jose5 override fixed it. A deployment-monitor network failure and a timed-out repeat backend check are retained as failures; Vercel later confirmed READY and production smoke checks passed. External live collection, scheduled invocation, human review and pilots remain open.

### October 26 — production verification complete

The deployed Ready Card was opened in the browser and its lesson screen verified. Production private-account HTTP check passed; all disposable users/records from that check and the interrupted backend run were cleaned up. The current build log preserves 16 human inputs. Live institutional source collection, scheduled invocation, independent scientific review and human pilots remain explicit next dependencies; this deployed milestone does not declare the full hackathon release complete.

### October 26 — CI regression correction

Remote browser checks exposed a regression from the local SQLite lazy-loader refactor. Root reproduced it with `CI=true npm run test:e2e`, restored the original loader and reran all five journeys successfully (8.9s). No tests were weakened. Production Firebase’s separate jose compatibility fix remains. This corrects the earlier interim statement that all final remote checks were complete; local and production checks passed while final remote CI was pending.

### October 26 — final remote checks passed

GitHub CI for code revision `1ea81ce` passed all stages, including five Chromium journeys: https://github.com/Jeremiah-Sakuda/soma/actions/runs/40377954896. The automatic Vercel deployment is READY and the production persistence/isolation/CSRF/deletion smoke passed again. Final ordinary suite: 123 passed, three explicitly gated live checks skipped; executed live-provider/account checks are reported separately. This documentation-only outcome record changes no application code.

## P017 — Persistent browser and Google connectors

**Received:** 2026-10-26T19:09:11.638Z

**Verbatim prompt:**

```text
Okay so, the way my muse session does it is by using a browser and storing the blackboard login credentials for learn.bu.edu. It does the same for gradesceope and piazza. Is that something we can implement? Also we need a connector for gcal and gmail 
```

**Top 3 outcomes:**

1. Browser-based read-only connection work now targets BU Blackboard (`learn.bu.edu`), Gradescope and Piazza using user-completed login/MFA and encrypted persistent contexts.
2. Gmail and Calendar read-only OAuth connectors are being implemented with workspace-bound encrypted tokens, explicit selections and versioned live-source observations.
3. Google API services are enabled; a step-by-step Web OAuth client walkthrough was supplied. Live provider sign-in and read/restart verification remain pending credentials and user consent.

**Plan deviations:** User explicitly requests Gradescope and Piazza browser adapters in addition to Blackboard and the Google sources. Prioritize the selected-URL collector and preserve the existing one-family learning scope and freeze. Persistent browser sessions replace any need to put institutional passwords in application prompts or fixtures.

## P018 — Persistent browser and Google connectors

**Received:** 2026-10-26T19:11:58.660Z

**Verbatim prompt:**

```text
Walk me through creating it
```

**Top 3 outcomes:**

1. Browser-based read-only connection work now targets BU Blackboard (`learn.bu.edu`), Gradescope and Piazza using user-completed login/MFA and encrypted persistent contexts.
2. Gmail and Calendar read-only OAuth connectors are being implemented with workspace-bound encrypted tokens, explicit selections and versioned live-source observations.
3. Google API services are enabled; a step-by-step Web OAuth client walkthrough was supplied. Live provider sign-in and read/restart verification remain pending credentials and user consent.

**Plan deviations:** User explicitly requests Gradescope and Piazza browser adapters in addition to Blackboard and the Google sources. Prioritize the selected-URL collector and preserve the existing one-family learning scope and freeze. Persistent browser sessions replace any need to put institutional passwords in application prompts or fixtures.

## P019 — Google OAuth client configured

**Received:** 2026-10-26T19:16:50.388Z

**Verbatim prompt:**

```text
Google Oauth should be done 
```

**Top 3 outcomes:**

1. Verified the local OAuth client ID and secret are present without displaying their values.
2. Configured the Google OAuth credentials, stable connector encryption key and production callback origin in Vercel production.
3. Account connection UI passed real disposable Firebase account checks for both missing and configured Google states; user OAuth consent and an actual selected-source read remain pending deployment and authorization.

**Plan deviations:** None. Client configuration is distinct from provider consent and successful source collection.
