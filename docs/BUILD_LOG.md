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

### October 26 — private connector implementation checks

P017: Browserbase adapters for BU Blackboard, Gradescope and Piazza are implemented with owner-bound encrypted contexts, selected course URLs, bounded read collection and cleanup before workspace deletion. Gmail/Calendar use PKCE, one-use encrypted state, owner-scoped tokens and explicit read selections. Changed course sources hand off to the durable queue; unchanged reads reuse source-version job identities. No source provider messages, submissions or calendar writes are performed.

P018: The exact production callback and read-only scope walkthrough were provided. Google API services and production credentials are configured. User consent and actual selected Google reads remain pending; local credential presence alone is not provider verification.

P019 top-three outcome update: (1) client ID/secret presence was verified without displaying values; (2) server configuration was uploaded and the connector code committed/pushed through `141edef`; (3) 166 unit tests, typecheck, production build, five browser journeys, real Firebase token-vault/state isolation and disposable-account connection UI checks passed. Google consent/read and Browserbase keys remain the next external dependencies. Four opt-in tests are skipped by the ordinary suite, with executed live Firebase checks recorded separately.

Remote GitHub checks and the automatic Vercel deployment are pending at this checkpoint. The initial local build failed under sandbox port restrictions; clearing generated build output and rerunning with local process access passed. No product scope change beyond P017's explicit adapter request.

## P020 — Browserbase onboarding attachment

**Verbatim prompt:** Preserved in the canonical archive; the supplied API key is explicitly redacted under the credential exclusion.

**Top 3 outcomes:**

1. Read the supplied onboarding flow; Node.js is installed and browse is absent.
2. Saved the supplied Browserbase API key in ignored owner-only `.env.local`; its value is excluded from logs and version control.
3. Asked the required install question. CLI access verification and project-ID-free integration are in progress.

**Plan deviations:** The supplied setup specifies key-only Browserbase configuration, superseding the earlier required-project-ID setup assumption. Keep the existing Soma repository and read-only source objective.

## P021 — Install Browserbase CLI

**Verbatim answer:** `Install browse (Recommended)`

**Top 3 outcomes:**

1. Installation authorized explicitly and started.
2. Access verification will use the environment key without printing it.
3. First cloud browser session remains pending the onboarding choices and successful access check.

**Plan deviations:** None. No template, new framework or alternative model provider has been added.

### October 26 — Google connectors deployed and verified

Vercel deployment `dpl_5NbxXMJnfHLM9YgK8EgevfAwqbMX` is READY at https://soma-woad-beta.vercel.app. GitHub CI passed for `141edef`: https://github.com/Jeremiah-Sakuda/soma/actions/runs/40386878067. The hosted disposable-account check passed in 15.14 seconds: configured Google status, one-use authorization-state creation, exact callback/PKCE/read-only scope, cross-origin rejection, safe missing-browser configuration handling, and the existing import/job/deletion checks. No Google consent or data read was performed. Synthetic account and private records were removed.

P020/P021 update: browse 0.11.3 installed after explicit user approval; key access verified by project listing. No project ID requested or added. The next onboarding choice is pending.

## P022 — Muse runtime integration

**Verbatim prompt:**

```text
In the meantime, can you work on our muse integration?
```

**Top 3 outcomes:**

1. Resumed Muse Spark runtime work while the independent Browserbase onboarding choice remains pending.
2. Identified two gaps: live generation only constructs resistor lessons, and provider output parsing lacks a response-byte ceiling.
3. Implementing bounded provider contracts, grounded ordinary practice and learner-context-aware preparation through the existing engine; executed results pending.

**Plan deviations:** None. Muse Spark remains the runtime model; this does not reuse credentials or sessions from the separate consumer Muse assistant.

### October 26 — P022 Muse integration milestone

**Top-three outcome update:**

1. Implemented the bounded Meta Responses client, grounded ordinary practice, exact disclosed-source citation validation, and the shared direct-request/collected-source engine (`4686906`, `b90231d`, `5b19d3b`).
2. Added bounded learner context and safe artifact reuse. Preserved attempts when no supported authored follow-up exists; reused requests now identify the selected saved lesson (`3b09992`, `857967d`, plus integrated fixes).
3. Two live Spark checks over synthetic material passed in 17.07 seconds; reconciled spend totaled $0.01867975 and the application ledger read $0.04732175/$1. Ordinary tests, build and browser results are recorded separately; independent review and unseen evaluation remain open.

**Plan deviations:** None. Ordinary practice is existing PRD scope; the one quantitative family is unchanged. Browserbase onboarding remains on its independent pending choice. Review found and corrected model-version reuse, oversized source-job and cached-lesson navigation defects before deployment.

P022 integrated validation: 209 ordinary tests passed; five explicitly gated live cases skipped. The separately enabled live Meta file passed both cases. Typecheck and production build passed. Six Chromium journeys passed in 9.6 seconds, including a response-contract regression proving that an older selected cached lesson opens correctly. Seven focused engine/semester-scope checks passed again after the final reuse guards. Remote CI and deployment are pending at this checkpoint.

## P023 — Use actual classes

**Verbatim prompt:** Preserved in the canonical prompt archive.

**Top 3 outcomes:**

1. Shifted the next demonstration and source-fit investigation to the user's actual classes; resistor material remains a synthetic implementation fixture.
2. Read a narrowly scoped selection through the connected BU Gmail account. Actual course identifiers and current topic discussions are available; private message bodies, grades, addresses and course URLs are excluded from public documentation/fixtures.
3. Checking authoritative lecture/source access and the correct private Soma destination before importing material. Student questions and course notifications establish context, not academic answers.

**Plan deviations:** The proposed first quantitative family remains provisional until it fits actual course needs. Do not invent resistor relevance or expand numerical models before reviewing sources.

P022 hosted verification correction: the first hosted generation check failed to publish a new lesson and returned the labeled prepared fallback. One diagnostic repeat also failed at proposal validation after an authorized source read; no invalid lesson was published. Both disposable workspaces were deleted. A single validator-guided repair is now implemented inside the existing four-call ceiling, with safe field/category diagnostics; it does not relax citation or publication checks. Quota-blocked jobs now remain queued without consuming a provider attempt; the real two-account Firestore regression passed in 22.91 seconds with zero Meta calls and cleanup.

P023 private-source checkpoint: identified an instructor-authored conceptual note through the connected mailbox and stored only the selected note in an ignored owner-only local file. The opt-in private-source integration check is implemented (`6eae98c`) but did not execute: automatic approval review rejected transferring the private note to the Meta API without explicit approval for that content/destination. No private course text was sent, no preview was generated, and no account workspace was changed. Requested approval for one selected-note preview; correct private account email is also pending. All private message bodies, course identifiers, account addresses and source URLs remain outside public fixtures/logs.

### October 26 — P022 hosted recovery verified; P023 source approval pending

The repaired hosted path passed in 11.20 seconds: a cited ordinary-practice preview persisted, reopening returned the same selected lesson with one total reservation, and cleanup removed the synthetic workspace. Latest application ledger: $0.078141 consumed under the unchanged $1 cap. This includes the two earlier failed hosted attempts; neither failure is hidden or counted as successful generation. Ordinary suite: 213 passed/seven gated skipped. Prior six Chromium journeys passed. Private real-course material remains local pending the explicit requested Meta-transfer approval and private account destination.

## PM001 — Evaluate the ambition of runtime Meta model use

**Recorded:** October 26, 2026, in the planning conversation. Exact received timestamp unavailable. PM-prefixed IDs are separate from the concurrent implementation conversation; earlier planning messages are not reconstructed.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM001`.

**Top 3 outcomes:**

1. Inspected the current Spark preparation, browser collection, learner-state handlers and implementation checkpoints. Live source selection, grounded practice and one validation-guided repair exist. The inspected preparation path remains bounded to four calls and 4,000 characters per source read; browser collection navigates selected URLs, while several scenario and learner follow-up decisions remain explicitly authored/deterministic. These observations do not establish autonomous browser investigation or general adaptive diagnosis.
2. Recommended deepening the existing change-to-next-action loop: investigate conflicting or incomplete course context, select a question or checked interactive experiment that distinguishes plausible misunderstandings, and revise the next activity when new evidence contradicts the initial interpretation. Proposed unseen-case evaluation would assess applicability, source grounding, adaptation, safe abstention, latency and cost. No such evaluation was executed in this advisory turn.
3. Checked current official Meta model and computer-use documentation. Both Spark 1.3 and Wonder support the documented computer-use loop; this is provider capability, not a claim that Soma has implemented it. Suggested model-led read-only navigation or a targeted Wonder comparison only if an observed bottleneck justifies the work. No model calls, credential operations, product code changes or deployments were performed.

**Plan deviations:** None adopted. Recommendations are proposals, not approved scope changes. Keep the approved quantitative-family boundary, source-fit requirement, existing budget controls and October 31 feature freeze. No PRD, build plan or implementation instruction was changed.

**Evidence:** `src/lib/server/meta.ts`, `src/lib/server/connectors/browser.ts`, `src/lib/domain/learning.ts`; existing P022 implementation checkpoints; [Meta model catalog](https://dev.meta.ai/docs/models) and [computer-use guide](https://dev.meta.ai/docs/computer-use). Runtime checks reported under P022 were not rerun for this advisory assessment.

## PM002 — Refine the content-and-context positioning

**Recorded:** October 26, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM002`.

**Top 3 outcomes:**

1. Evaluated the proposed framing around the concrete preparation burden: finding current course materials, determining priorities and selecting useful practice. No new competitive research or claim about most study products was established.
2. Drafted positioning that connects coursework, deadlines, schedule and learning progress to prepared interactive lessons and practice that update as circumstances change. Kept interactive learning visible and used Meta's Muse Spark for runtime attribution, preserving the consumer Muse workflow as origin context.
3. Recommended replacing vague friction language and the unmeasured promise of preparing better with observable product behavior. The copy is proposed positioning, not a claim that every planned capability is already verified.

**Plan deviations:** None. No scope, PRD, implementation instructions or product code changed. No runtime tests were required or executed for this copy review.

## P024 — Investigate, design an interaction, and revise

**Verbatim prompt:** Preserved in the canonical prompt archive.

**Top 3 outcomes:**

1. Adopted the requested source-investigation, diagnostic-selection and hypothesis-revision milestone inside the existing Soma surfaces. Registered references and paged source reads extend beyond the initially supplied excerpt.
2. Implemented bounded diagnostic and experiment contracts, provisional immutable records, optional ungraded responses, and compact inspection/reconsideration controls. Runtime orchestration and release verification remain in progress.
3. Retained original synthetic development cases, separate held-out evaluation, actual tool activity/citations/usage, account ownership and the allocation reserve. Private course transfers remain pending their separate explicit approval.

**Plan deviations:** Deepens the existing PRD R2/R3/R5/R11 loop; adds a separately reserved eight-call investigation profile and at most three runs per workspace/day for response reconsideration, within the unchanged global cap and reserve. Browser computer use and Wonder comparison remain conditional stretch, not implemented claims. The resistor fixture does not establish fit for the user's actual classes.

## PM003 — Adopt the content-and-context positioning

**Recorded:** October 26, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM003`.

**Top 3 outcomes:**

1. Authorized the PM002 positioning for the product documents: the work before studying, course content plus surrounding context, and preparation that stays current.
2. Updated the [PRD](PRD.md), [product brief](PRODUCT_BRIEF.md), [handoff](../CODEX_HANDOFF.md), README, scope introduction, persona introduction, demo narrative and UI copy guidance. Recorded the adopted decision in [Decisions](DECISIONS.md). Interactive lessons remain the visible payoff; Meta's Muse Spark is the runtime attribution and the consumer Muse workflow remains the origin.
3. Verified the hook and continuity promise across seven messaging documents, exact and unique PM003 prompt archival, and unchanged hashes for eight PRD sections covering scope, functional requirements, experience requirements, system boundaries, Meta behavior/budgets, success measures, release acceptance and delivery. `git diff --check` passed on the documentation set. No application tests were run for this documentation-only update; existing concurrent implementation edits were preserved.

**Plan deviations:** Positioning update only. No product scope or engineering change is authorized by this request.

## P025–P026 — Private account destination and one approved preview

**Verbatim answers:** P025 is explicitly redacted in the canonical archive because it is a private account identifier. P026 preserves the exact approval answer. Exact received timestamps unavailable.

**Top 3 outcomes:**

1. Accepted the private account destination without committing its email. Account creation confirmation remains pending; no password was requested in chat.
2. After explicit consent for the specific source and Meta destination, one bounded live private-course preview check passed in 14.61 seconds. The original selected note and generated preview remain owner-only, ignored local files. Supporting citations/provenance and unchanged zero-call reuse passed; this is a development preview requiring human review, not an instructional correctness benchmark.
3. No private course body, answer, email identifier, grade, credential or browser session was added to code, fixtures, logs or demo assets. The result has not yet been saved to the user account.

**Plan deviations:** The previous automatic approval rejection is retained in P023 history; this new explicit approval permits the specified single preview. The source was manually selected through Codex Gmail, not collected by Soma OAuth. Real connector and scheduled collection gates remain open.

## P027–P028 — Account created and explain Soma before the demo

**Verbatim prompts:** Preserved in the canonical archive. Exact received timestamps unavailable.

**Top 3 outcomes:**

1. Accepted the account-created confirmation and began owner-checked transfer of the already generated private preview. This transfer requires no additional Meta generation. Completion pending.
2. Began a landing entrance with an explanation of Soma and explicit create-account and quick-demo paths. The simulated workspace should begin after demo selection; signed-in accounts and deep links must retain existing behavior. Browser verification pending.
3. Read the updated PRD positioning: course content plus deadlines, available time and recorded learning progress prepare useful interactive lessons and practice. Applying this framing to the entrance without turning planned collection capabilities into verified claims.

**Plan deviations:** Adds an explanatory entry surface before the existing Ready Card. Does not replace the selected visual direction, lesson engine or account/source boundaries.

## PM005 — Evaluate open-weight Muse for Soma

**Recorded:** October 26, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM005`.

**Top 3 outcomes:**

1. Checked current official Meta documentation for Muse Spark Open, Glimmer and hosted inference. Spark Open can run through partner APIs; its full weight footprint makes self-hosting a substantial infrastructure task. Glimmer is a 30B text/image model suited to a possible local route; neither model's quality, latency nor hardware fit has been measured for Soma.
2. Recommended a bounded comparison of hosted Spark Open with the existing Spark 1.3 path on synthetic or appropriately authorized source investigation, diagnostic selection and validated lesson preparation. Preserve source/citation, tool, evidence and budget contracts; adopt only after actual workload and provider-compatibility checks. Local Glimmer, self-hosting Spark Open and fine-tuning are deferred recommendations, not implemented changes.
3. Confirmed from the supplied participant guide that the $10,000 Best Build on Meta Open Weight Models award accepts Muse Glimmer or Spark Open on participant hardware or partner inference and requires infrastructure verification. Eligibility and competitive benefit are conditional; no provider account, credits, deployment, model calls or private-data transfers were initiated.

**Plan deviations:** None adopted. This is advice, not authorization to change the runtime, add a provider or spend credits. The current Spark-first implementation, allocation reserve and October 31 freeze remain in effect. No product code, PRD or build-plan edits and no runtime tests were performed.

**Sources:** [Spark Open](https://dev.meta.ai/docs/muse-spark-open), [Glimmer](https://dev.meta.ai/docs/muse-glimmer), [Hosted inference](https://dev.meta.ai/docs/muse-spark-open/deploy), supplied [participant guide](sources/PARTICIPANT_GUIDE.txt).

### October 26 — P024–P028 implementation checkpoint

- P025/P027 follow-up: the approved preview used three Meta calls and passed source/provenance/unchanged-reuse checks in 14.61 seconds. The confirmed existing private account now holds one source, one lesson and its original preparation run, with owner/generation/revision checks and append-only CAS. Readback passed; previous account records were preserved. Transfer made zero new Meta calls. Identifiers, source text, generated content and administrative receipt remain excluded from this log.
- P027/P028: `ac54eb3` introduces the updated positioning before account signup or an explicit synthetic demo. New visitors trigger only an account-status check until choosing a path. All 12 browser journeys passed in 10.2 seconds, including sign-in/deep links, mobile/reduced motion, existing learning flows and persisted experiment controls.
- P024: `f6c8df5`, `fc09e68`, `27b5b73` and `e38ea6d` connect source investigation, immutable diagnostic hypotheses, ungraded responses, checked experiment controls and source-change jobs. The first frozen-engine unseen synthetic evaluation scored **1/4**, costing $0.10198425. Three cases failed at validation without publication; the response-reconsideration stage was not reached. Exact original rejection detail was not retained and is unavailable; the harness now persists sanitized future metrics. This is not a passed release gate.
- A separate original development probe exposed irrelevant nullable/discriminator fields and incomplete repairs. Its first three attempts failed safely; those failures are retained. Tools now separate text and checked experiment preparation, and encode absent/present finish references as empty/singleton arrays. The application supplies fixed types and still validates every supplied ID, exact passage, authority claim, source version and response condition. It does not silently discard incompatible values. One repair and the existing call/time/spend limits remain. `997c82b` verifies malformed-field and incompatible-reference rejection.
- The revised development probe passed a complete live text-diagnostic -> ungraded saved response -> explicit hypothesis reconsideration loop in 40.42 seconds. This reused development scenario is **not** counted as a new unseen result. A fresh independent evaluation is pending. No browser computer-use or multimodal input claim is established.

### October 26 — fresh model checks and review

Fresh independent v4 cases passed 2/2 across four stages (`1ef428a`): E1 4 calls/10.605s/$0.02664725, E2 5/13.005s/$0.03424200, F1 5/15.424s/$0.03785050, F2 5/13.383s/$0.04001150. E1 selected a changed supported activity; E2 retained that valid recommendation for a no-effect update. F1 prepared a text diagnostic; F2 reconsidered both hypotheses against a contrary original ungraded observation. F1/F2 each used one validation repair. The test did not require a newly generated follow-up lesson in F2; do not describe it as proof of that stronger behavior. Total $0.13875125; original 1/4 failures remain unchanged.

A single live synthetic experiment development probe (`34532db`) passed: actual list -> read -> evaluate_experiment -> prepare_experiment_diagnostic -> finish, 5 calls, 19.933s, $0.04010025 settled. Exact experiment control/readout survived lesson publication and deterministic reveal; the supported response remained ungraded. One informative experiment, zero repairs: no spontaneous uninformative-to-informative live repair was observed. The uninformative-first variation is verified through application-boundary tests, not this live run. Global ledger then expected $0.537403/$1; actual final ledger verification follows.

Review fixed pre-answer diagnostic rationale disclosure (`8282798`) and added actual runtime model/engine provenance to the investigation cache and record. UI review additionally identified delayed account-switch responses, expired deep-link recovery, deletion creating implicit demo state, and diagnostic source-disclosure exposure. Those UI fixes and their targeted checks are in progress; no premature pass is recorded.

### October 26 — final deployed checkpoint for P024–P028

- Runtime `cdfc87c` is deployed READY as `dpl_Gvj8B9j43kkDmQezXuXb3h2nzsWY`, aliased at https://soma-woad-beta.vercel.app. New entrance, private account continuity and the bounded investigation route are included.
- `npm run check` passed: typecheck, **288 ordinary tests** with 16 opt-in cases skipped, and optimized production build. All **16 browser journeys** passed across final runs. One expanded browser check first hit an ambiguous test selector; the selector was narrowed without changing product behavior or assertions.
- `cdfc87c` fixes delayed investigation/import/workspace-load responses crossing account transitions, discards queued stale-generation actions, recovers expired deep links, and returns deletion to the entrance. Diagnostic source/why/activity disclosure records help before exposure; failed help persistence blocks disclosure. Original responses recorded before later help stay immutable. `0e534a0` preserves disclosure history across stale-source recovery while still blocking stale attempts.
- Production entrance browser smoke passed with a fresh ephemeral context: HTTP200, zero workspace requests before explicit demo choice, exactly one afterward, no browser/hydration errors or unexpected provider mutations, and DELETE200 cleanup. No actual sign-in or private account was used by this check.
- Hosted Spark investigation verification (`5d04686`) passed once in **13.126s**: no-cookie401, cross-origin403 and extra-workspace-field400 were preflight with zero reservations; one ordinary-course keep-current investigation persisted, reopened from cache with no second model reservation, preserved lessons/attempts and stayed isolated from a second session. Three model calls cost **$0.02077275**; both disposable workspaces were deleted. No retry or cap increase.
- Final estimated application ledger after the known settled probes: **$0.55817575 consumed under the unchanged $1 cap**, with the user-confirmed $150 allocation and $30 reserve. This is application token accounting, not a provider Billing balance claim. Private course review, broad unseen reliability, multimodal returned-work interpretation, institutional/browser source access, scheduled collection and genuine delayed-learning/pilot gates remain open.

GitHub CI run `40401252182` passed for deployed runtime `cdfc87c`, including the full remote browser suite. Final documentation-only follow-up does not change that deployed runtime.

## P029 — Agentic completeness audit and simulated Muse scenarios

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Began a code-backed completeness audit against the current PRD. The bounded Spark investigation/diagnostic engine is implemented; scheduled collection, model computer use, visual returned-work input, automatic post-answer reconsideration and production authority metadata/consequence wiring remain incomplete or unverified. Detailed matrix pending.
2. Preparing fresh original synthetic live-provider cases with separate source-authority, no-effect, diagnostic revision and actual next-activity criteria. No private course source is reused. The stronger next-activity criterion will not be counted as passed merely because a hypothesis changed. Execution pending.
3. Retaining the existing $1 application cap, $150 allocation/$30 reserve, eight-call limit, one repair, source/ownership/numerical validation, and explicit preflight headroom checks. Actual calls, failures, tool actions, latency and settled usage will be recorded.

**Plan deviations:** Testing and completeness clarification only. No missing autonomy feature is declared implemented or silently added by the audit. Do not retune the core model instructions on these cases.

### October 26 — P029 executed results and completeness correction

1. Completed a code-backed [agentic status matrix](AGENTIC_STATUS.md). The bounded Spark engine is real, but the full PRD is incomplete: no scheduled monitoring/worker invocation, no automatic post-answer reconsideration, no model-directed external browser or returned-work image input, and incomplete production source-authority/academic-fact reconciliation. These are implementation gaps, not merely missing test evidence. No product code changed in this audit.
2. Executed two new original synthetic scenario families through the live Spark API (`25d0697`, `17924cc`): ambiguous returned work -> new diagnostic (5 calls/14.370s/$0.03837425), actual contrary ungraded response -> two hypothesis revisions and a different existing activity (6/17.192s/$0.04933025), and conflicting-source investigation -> registered reference follow and supported replacement selection (4/15.465s/$0.03276350). All three model runs passed; one validation repair was used. Cache reopening passed with zero calls and zero new reservations. Both adaptive publications survived in-memory JSON reload; this is not new managed persistence proof, and the second activity was selected from an existing library, not newly generated. No private records were used.
3. Preserved the $1 cap and $30 allocation reserve. Total new estimated usage $0.12046800; ledger $0.67864375, with $0.32135625 headroom below the next $0.35 investigation reservation. The new no-effect update and zero-voltage proposal cases were budget-skipped with zero calls; neither is a pass. Focused checks185 passed; full ordinary suite288 passed/20 opt-in skipped; typecheck passed. Detailed evidence, commands and limitations: [AGENTIC_EVALUATION.md](AGENTIC_EVALUATION.md).

**Plan deviations:** None. This turn added tests/documentation and sharpened the completeness claim. Model instructions, product runtime, deployed app, cap and source permissions remained unchanged. Full autonomy and the larger unseen/independent-review gates are still open.

## P030 — Increase the application development cap by one dollar

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Authorized a total application cap of $2, increasing the prior $1 cap by exactly $1. Local ignored configuration updated; existing usage is retained, not reset. Production configuration and activation pending. The $150 allocation, $30 reserve, per-run reservation, call/time/repair and daily limits remain unchanged.
2. Preparing to execute only the two previously budget-skipped scenarios: no-effect source update and uninformative zero-voltage proposal. A prepared synthetic baseline will make the no-effect case independently runnable without replaying or fabricating an earlier model result.
3. Actual outcomes, reconciled usage, remaining headroom and hosted activation verification will be appended after execution. No private course source is authorized or required for these checks.

**Plan deviations:** User-authorized cap increase from $1 to $2. No model prompt, validation, source permission, product scope or release gate changes.

## PM006 — Clarify knowledge graph status

**Recorded:** October 26, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM006`.

**Top 3 outcomes:**

1. Confirmed that the PRD and technical plan retain the evidence graph and bounded Spark interpretation authority. Firestore stores explicit versioned record references; a separate graph database is not required, and a graph canvas is deferred.
2. Inspected current types, account record storage and investigation tools. Sources, lesson versions, attempts/assistance, interpretations, diagnostic hypotheses, revisions and selected activities have explicit links. A comprehensive concept/prerequisite map across the semester is not implemented by these records and must not be claimed as complete.
3. Read the P029 live evaluation: a synthetic contrary diagnostic response led to explicit Spark hypothesis revisions and selection of a different existing activity, with original evidence preserved through in-memory publication and JSON reload. This is recorded prior evidence, not a new test; automatic post-answer invocation and full graph capabilities remain incomplete.

**Plan deviations:** None. Clarified retained scope versus current implementation; no PRD, product code, graph dependency, deployment or model call changed.

**Evidence:** [Technical plan](TECHNICAL_PLAN.md), [agentic status](AGENTIC_STATUS.md), [agentic evaluation](AGENTIC_EVALUATION.md), `src/lib/domain/types.ts`, `src/lib/server/investigator.ts`, `src/lib/server/account-store.ts`.

### October 26 — P030 additional live checks

The two previously skipped synthetic scenarios now passed once under the authorized $2 cap (`c0784aa`, `c465258`). No-effect preserved the independently prepared recommendation: 5 calls, 13.503s, $0.03722500. The zero-voltage case actually evaluated an uninformative experiment, revised it to a nonzero-voltage informative experiment, and published a deterministically checked diagnostic: 7 calls, 21.791s, $0.05897575; one duplicate-citation validation repair. Total additional estimated usage $0.09620075; reconciled global ledger $0.77484450 of $2. No private source was used. Vercel configuration is updated to $2; activation awaits deployment. Historical $1 budget-skipped results remain historical, superseded by these executions.

## P031 — Production architecture and sufficient tests before real connections

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Implementing a durable authenticated background worker with bounded account traversal, owner/generation checks, retries, source refresh and persisted job execution while the browser is closed. Actual hosting/scheduler verification remains pending. Google Cloud billing is disabled; Trigger credentials are absent. A GitHub schedule fallback is being prepared, with its availability limits explicit.
2. Implementing automatic queued post-answer adaptation and production source-authority registration/academic consequence reconciliation. Each retains immutable evidence and current-source validation; these changes are in progress, not release-verified.
3. Expanding tests around managed persistence, job recovery, account isolation, source/attempt races and automatic user journeys. Deployment, new full-suite results and remaining release limitations will be appended after execution.

**Plan deviations:** This user-authorized hardening checkpoint closes gaps identified in P029. No new quantitative family, provider, calendar writeback or external message sending is added. Actual source access, private content review and release gates cannot be pre-certified before connection.

### October 26 — P031 production candidate and executed evidence

1. Shipped worker dispatch/recovery, source authority/fact reconciliation and automatic adaptation (`056c29a`, `4de82ff`, `cacc0da`, `cb97d51`, `7dfbba9`, `614e5f6`). Review fixed refresh-version loops, intent/model-version deduplication, Gmail query rotation, transient/exhausted retries, atomic attempt/outbox saves, and stale UI result rollback (`aed2062`). Original evidence remains immutable. General academic prose extraction, images/PDFs and model computer use remain outside implemented support.
2. Fixed a semester-scale persistence blocker: stable exact record ranks preserve existing rows instead of rewriting every lesson on prepend (`a745a27`). Real Firestore proof covered 1,000 saved lessons and fresh-process reload. Explicit processing consent now gates unattended source, derived lesson/hypothesis and historical-attempt model input, including exact source versions and old-receipt retries (`94cbb36`, `8ff0b47`). Academic batches reject superseded authority and excluded-topic eligibility in either order. Typecheck/build, 327 ordinary tests and 19 browser journeys passed; separate real Firestore worker 47.72s, adaptation 43.08s and ordering 38.1s checks passed with synthetic external boundaries and cleanup.
3. Runtime `8ff0b47` is deployed READY (`dpl_Ast47Du1rWhB4XX5mfSjMhdQchaX`) at the production alias, activating the authorized $2 cap and configured Browserbase key. A new hosted synthetic automatic follow-up passed in 21.15s: response-only dispatch, linked actual Spark hypothesis revisions, immutable answer, persistence and cleanup. It cost $0.03165825; settled application ledger $0.80650275/$2. The initial diagnostic was authored/prepared, not a new Spark result; changed/generated next activity was not required. Calls/decision console detail was suppressed and is unavailable, not reconstructed. Future probe writes body-free metrics to ignored local storage.

**Activation limitation:** missing/wrong worker Bearer 401 and forbidden account selector 400 passed on the deployed endpoint. Automatic approval review rejected an authenticated general worker invocation because it could discover real connected data and send selected sources to Meta. It did not execute; no indirect scheduler activation was attempted. An explicit approval question is pending. GitHub fallback remains disabled; Trigger credentials remain absent. This limit is distinct from the successful synthetic hosted and managed-worker tests.

**Plan deviations:** Hardened implementation defects discovered during review; no extra model family/provider or external write behavior added. Actual institutional/Google read/reconnect verification, independent content/scientific review, broader held-out and learner gates remain open. These cannot honestly be called cosmetic fine-tuning. Production operations and recovery: [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md). Remote CI result is appended after completion.

### P031 final verification

The final default suite passed **327 tests**, with **25 opt-in cases skipped** (54 files). All **19 browser journeys**, typecheck and optimized build passed. GitHub CI `40410283634` passed for `8d24a5f`, including the remote browser suite. Production entrance smoke passed with no implicit demo read, no page errors, explicit demo entry and DELETE200 cleanup. Follow-up documentation does not change deployed runtime `8ff0b47`.

Recurring source-processing approval remains pending; the GitHub activation variable is absent, verified read-only. The authenticated general tick was not executed after automatic review rejected it. Trigger keys remain absent. The new local runbook records the concrete deployment, credentials, shutdown/recovery procedure and remaining acceptance boundaries.

## P032 — Authorize selected-source production processing

**Verbatim clarification answer:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Explicitly authorizes one production worker verification run and recurring read-only processing of sources selected in Soma, including Meta preparation within the existing $2 total cap. The earlier automatic-review activation block is superseded by this approval; no broader source or spend permission is inferred.
2. Direct production worker verification passed: HTTP200, idle, one account scanned, no due work. Credentials stayed private; owner/generation, selected-source consent, budget, retry and read-only boundaries remained in force.
3. Enabled the GitHub 15-minute fallback and successfully dispatched workflow `40413385697`. Its authenticated production tick returned idle/scanned0/cycleComplete true. Aggregate worker storage confirms two completed ticks and no error outcome; application usage remains $0.80650275 of $2. No content read or inference is claimed from these idle checks.

**Plan deviations:** None. Activates the already implemented and reviewed workflow after explicit permission; no budget increase, external write or new integration is added.

### P032 activation evidence

GitHub `SOMA_WORKER_ENABLED=true` and the exact canonical worker URL were verified after activation. [Workflow 40413385697](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40413385697) completed successfully at 22:33:52 UTC on October 26 (6:33:52 PM America/New_York). Stored aggregate `completedTicks=2`, `lastOutcome=idle`; no due selected source work was available. No new Meta charge; ledger $0.80650275/$2. GitHub scheduling remains best-effort; Trigger credentials and real-source read/reconnect acceptance remain separate. Only deployment configuration and documentation changed, so runtime tests were not unnecessarily repeated.

## P033 — Explain and audit AI decisions as they happen

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Inspected current investigator, model transport, domain records and investigation UI. Existing support includes exact cited passages/source versions, decision reasons, hypothesis revisions, tool outcomes, mode/model/engine labels and usage. Tool activity is accumulated during a run and published at completion; this is not a durable live audit stream. Raw provider reasoning is discarded by the client.
2. Recommended a structured decision/event ledger: trigger and context versions; proposed action and concise stated rationale; evidence and uncertainty; application validation and rejected proposals/repairs; executed action/outcome; before/after consequence; final publication, failure or budget stop. Application-observed events and model-provided explanations must remain visibly distinct, with no invented rationale for an unrecorded step.
3. Feasibility guidance: expose progressive status and expandable evidence-backed explanations, then retain an owner-scoped exportable run record. Preserve secret/private-data boundaries and hide diagnostic details that would reveal answers until exposure is recorded. A model explanation is a stated justification, not proof of hidden internal reasoning. This turn is assessment/design advice; no runtime, model prompt, deployment, budget or source-permission changes, and no tests/provider calls were made.

**Plan deviations:** None adopted. This strengthens the existing inspectability objective; detailed implementation and acceptance tests remain future work.

## P034 — Implement progressive AI auditability and list remaining user work

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Implemented a durable owner-scoped journal independent of workspace revisions, actual source/model/tool/check events, concise model-stated purposes, publication confirmation, bounded repair/usage/failure history and protected JSON export. Engine/collection integration `3bf1a9c`, `f74e882`, `a70f547`; storage `f741ac7`, `7cf23bf`, `12e9f3f`. Journal outage stops further inference; a post-commit outage preserves saved work with an incomplete notice. No raw provider reasoning or extra narration calls.
2. Shipped the Ready Card AI activity disclosure with live progress, source/model labels, evidence versions, full retained-history pagination and exports (`d2afb3d`, `00eb4b1`). Fixed the tool-field collision using distinct `auditRationale`, pinned disclosure to lesson/model/source context and committed revision, and withheld discarded diagnostic explanations (`166fb73`, `710e197`, `bf62b5f`). Typecheck/build, **364 default tests** (27 opt-in skipped), **23 browser journeys**, and **2 real Firestore audit cases** passed. The final two managed worker/adaptation boundary cases passed in 67.47s with scripted Meta transport, separately from real inference. Runtime `00eb4b1` deployed READY as `dpl_49WFE1KpromZZ5WZCpTWabaG7nh6` at the production alias.
3. Wrote [AI auditability](AI_AUDITABILITY.md) and [remaining user work](USER_REMAINING_WORK.md), distinguishing immediate source selection, content review/pilots, optional Trigger setup and submission decisions from engineering/release gates. Trigger secrets remain absent; the existing authorized GitHub scheduler remains active. Actual institutional source acceptance and independent learning/scientific validation are not implied by audit tests.

**Hosted evidence:** One actual Spark source-only no-effect run over disposable synthetic demo material passed in 12.56s: durable live progress, protected in-flight model text, recorded short stated purpose, actual application publication/usage, same projection in JSON export, owner/session denial, reload persistence and zero-inference reuse. Two Meta calls cost $0.01678750; aggregate ledger $0.82329025/$2. Both sessions deleted. No private course material used. This does not certify diagnostic teaching quality or real connector access.

**Remote verification:** [GitHub CI 40418506341](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40418506341) passed for `19f0af3`, covering clean install, module restrictions, typecheck, default suite, optimized build and all browser journeys. Subsequent evidence/documentation edits do not change deployed runtime `00eb4b1`.

**Verification corrections:** The first broad test run hit a five-second existing ordering stress-test deadline under 60 concurrent workers; the whole suite passed with four workers, now the default. An intermediate exact route assertion needed the new committed-revision field; corrected and the final suite passed. A proposed diagnostic field initially collided with domain `rationale`; fixed before release and regression-tested. Historical failures are retained, not counted as successful executions. Firestore cleanup initially required missing collection-group indexes; the two ASC `expiresAt` indexes were provisioned without enabling billing and both managed cases then passed in 10.41s. All these managed fixtures used original synthetic data and no Meta calls.

**Plan deviations:** None adopted. Strengthens existing inspectability following P033 without a new model family, provider, spend cap or source scope.

## P035 — Iterate on architecture with the supplied skill

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Applied the user-linked [Improve Codebase Architecture skill](https://github.com/EAIconsulting/mattpock-skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md), its HTML report guidance, Codebase Design vocabulary and Deepening guidance. Reviewed handoff, PRD/decisions and recent hotspots; CONTEXT.md and docs/adr were absent, so existing product/decision documents remain authoritative.
2. Completed a read-only subagent walk plus direct code/test inspection. Found three candidates: typed failure propagation/recovery (recommended first; existing engine errors reduce typed Meta failures to prose that job regexes parse), concentrated audited publication (four callers independently own ordering/commit flags), and journal adapter contract consistency (lower priority; caller interface already small). Each has evidence links, deletion test, preserved guarantees and specific test improvements. No interfaces or runtime refactor were adopted before the skill's candidate selection.
3. Created and opened `/private/var/folders/2k/24m45bdj4h51j76jmdm0kf9h0000gn/T/architecture-review-20261026T232407992365Z.html`. Browser rendering verified three candidate cards, three before/after diagram pairs, a rendered Mermaid diagram, desktop 1440/mobile 390 layouts without overflow and no page errors. Fixed CDN heading-style precedence and improved graph orientation after visual inspection. Actual application tests were not rerun; no live model/source calls, spend or deployment changes were made. User candidate selection is the next required step.

**Plan deviations:** None adopted. The invoked skill explicitly asks the user to choose a candidate before interface design and the grilling loop; implementation remains pending that selection. Preserve source consent, immutable evidence, ownership, budgets, freeze and release gates. The HTML report stays in the OS temp directory as required; only build-log maintenance belongs in the repository.

## P036 — Feedback and a single diagnostic demo moment

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable. The pasted evaluation text was removed from the archive at the user's request; the instruction framing is kept.

**Top 3 outcomes:**

1. Reviewed the supplied feedback against PRD R9/R10/R11 and the student-hub scope. The focused returned-work → competing hypotheses → discriminating activity → response → revised next activity sequence fits existing scope; reducing R12's video role is a proposed presentation change, not deletion of its product behavior.
2. Identified two necessary qualifications: a single prediction changes support for provisional hypotheses rather than proving a misconception, and an exact quiz circuit can be interactive only if it fits the approved checked family and source interpretation is supported. Preserve the user's earlier actual-class direction; do not select resistors solely for visual drama. Current image/PDF interpretation and model-directed browser navigation remain unimplemented; the feedback does not establish them as working.
3. Recommended tying architecture iteration to this vertical slice: a short typed-failure recovery improvement, real-course returned-work/diagnostic integration, and audited-publication concentration only where that work requires it. Defer journal-adapter cleanup absent concrete drift. This is prioritization advice; no candidate was selected by this message, no interface/runtime/PRD/build-plan change was adopted, and no tests, provider calls or deployment occurred.

**Plan deviations:** None adopted. D1 family choice, D2 evaluation deferrals and D3 video emphasis remain explicit choices; forwarding feedback alone is not approval to remove gates or change the quantitative family. Preserve consent, read-only sources, original attempts, uncertainty, $2 operating cap and the October 31 freeze.

## P037 — Implement all architecture candidates and document the hero moment

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Implemented all three selected candidates: typed execution failures retained through both engines and durable job failure facts (`7a2ecae`); one audited-publication module across the four entry points (`40d7724`); shared journal policy with actual Firestore and synthetic SQLite adapters and identical behavioral contracts (`a60b31a`). No narrative-controlled retries, new retry categories, storage migrations, agent/queue frameworks or source permissions. A post-commit audit outage preserves saved work/ready jobs while reporting incomplete confirmation; audit cleanup failure no longer prevents durable job recovery or masks the original error.
2. Typecheck, optimized build and **397 default tests** passed (34 opt-in skipped). All **23 browser journeys** passed after isolating/cleaning the test database (`44cb761`). Shared storage verification ran seven identical contracts on SQLite and seven on actual Firestore, plus two real account/expiry lifecycle cases (16 total, 15.46s); final real Firestore worker/adaptation regression passed 2/2 in 57.02s. Those fixtures used scripted Meta boundaries or no Meta at all, original synthetic records and cleanup. A separate read-only integration review found no P0/P1 issue. Runtime checkpoint `c0cf2fb` deployed READY as `dpl_B2NvPz7wHvZiawp8v9moyVzwxeg9` at the production alias.
3. Updated PRD, demo/evaluation storyboard, build plan, handoff, product brief, scope context, README and user checklist around **returned work → competing explanations → discriminating interaction → original response → revised interpretation and next activity**. Added a domain-only glossary and architecture ownership documentation. R12 remains in the product with at most ten relevant video seconds or the judge route; all independent-review, comparison, numerical, held-out and genuine learning-evidence gates remain. Vision/PDF/region interpretation, model-directed browsing and actual-course family fit remain open, not asserted as implemented.

**Hosted confirmation:** One real Spark no-effect investigation over disposable synthetic course material passed in 14.39s through the new publication/journal modules: durable progress before completion, protected model text, actual commit/usage events, recorded stated purpose, same projection in JSON export, session isolation, readback and zero-call cache reuse. Two calls cost $0.01670325; ledger $0.83999350/$2. Both sessions deleted. No private course material or new hero image path was exercised.

**Remote verification:** [GitHub CI 40421572121](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40421572121) passed for `c0cf2fb`, including clean install/module compatibility, typecheck, all default tests, optimized build and all browser journeys. Later evidence-only documentation does not change that deployed runtime.

**Verification corrections:** An initial browser run passed 22/23 and then hit the pre-existing 200-demo-session limit in the reused test SQLite database. A fresh per-run temporary database plus guarded teardown fixed test isolation without weakening the application limit; final 23/23 passed. During focused development, one lifecycle fixture assumed the wrong revision increment and one configuration fixture was blocked earlier by the correct budget preflight; both test setups were corrected and rerun. These are recorded failures, not extra successes.

**Plan deviations:** P035's selection gate is satisfied by the user's explicit “Do all 3.” No further confirmation was needed for the reviewed refactors or hero-story documentation. The three-minute presentation emphasis changes under P037; no research-grade evaluation deferral, second family or removal of product scope is adopted. Preserve the October 31 freeze, November 4 deadline and $2 operating cap.

## P038 — Rerun architecture review and refresh manual work

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable. Work dated October 27, 2026 in the client timezone.

**Top 3 outcomes:**

1. Reapplied the supplied Improve Codebase Architecture and Codebase Design skills against `03a9565`, the current glossary, decisions and recent hotspots, including a separate read-only subagent walk. P037's three refactors remain implemented. New candidates: disclosed course evidence (recommended with the returned-work slice), bounded inference accounting, and lower-priority durable preparation intent. Each has evidence, before/after visuals, deletion test and test improvements; no new interface or refactor was selected or implemented.
2. Confirmed the owner account is enabled with an active workspace but **zero saved provider connections**, using safe metadata only. No course bodies, credential values or decrypted tokens were read; no provider requests or cloud changes were made. Trigger keys remain absent; ledger is **$0.83999350/$2**. Updated [remaining user work](USER_REMAINING_WORK.md): connect/select Google and institutional pages, supply an actual-class returned-work example, then review/test/public-submission inputs; image/PDF/region work and release acceptance remain engineering tasks, not visual fine-tuning.
3. Created and opened `/private/var/folders/2k/24m45bdj4h51j76jmdm0kf9h0000gn/T/architecture-review-20261027T133220857920Z.html`. Browser check: three candidate cards, three before/after pairs, rendered Mermaid, no page errors or horizontal overflow at 1440/390 widths. A direct synthetic local probe reproduced an unversioned lesson surviving automatic-context selection; code inspection also found ordinary preparation counts an unsent preflight request while investigation reverses it. These remain unfixed review findings; the call-count case was not engine-reproduced. No application suites, live model calls or deployments were executed this review.

**Plan deviations:** None adopted. The skill says “Do NOT propose interfaces yet” and requests candidate selection after the report; that next step remains pending. Recommend the two small correctness fixes and evidence deepening alongside existing R9 work rather than another broad architecture-only round. Preserve the hero objective, one-family scope, source/privacy gates, $2 cap and October 31 freeze.

## P039 — Secure institutional login and primary Blackboard access

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable. Work dated October 27, 2026 in the client timezone.

**Top 3 outcomes:**

1. Inspected the existing browser route, connection storage, collection policies and UI against current Browserbase contexts/live-view/session documentation and BU's official Blackboard login guidance. Reaffirmed user-completed provider/SSO login and MFA with per-workspace/provider persistent contexts; no institutional password vault, password `.env` field, model login loop or copied cross-site SSO context. Blackboard is the primary access path; Piazza and Gradescope remain separate contexts and acceptance checks.
2. Wrote [institutional authentication and trust model](BROWSER_AUTHENTICATION.md), distinguishing existing controls from unverified production gates. Browserbase hosts the login and sensitive browser state; contexts may contain cookies, storage and saved form data. The authorized application runtime remains trusted with account access. Page selection enforces collection scope but does not make the website session a provider-issued read-only grant. Onboarding disclosure, hosted no-recording/logging proof, actual BU SSO/read/expiry/reconnect, retention/rotation and cleanup verification remain open engineering work. Updated decisions and Jeremy's manual checklist accordingly.
3. Reran **43 existing synthetic checks**: 33 browser policy/lifecycle cases plus 10 Google/shared connection encryption cases, all passed. `git diff --check` passed. These establish tested application behavior, not live institutional access, provider retention guarantees or a security certification. No source content, tokens, credentials or hosted browser were opened; no live provider/model calls, spend, runtime changes or deployment occurred.

**Plan deviations:** None adopted. This clarifies the October 26 session-based login decision and existing read-only access objective. No local companion/extension, new infrastructure, source scope, password handling or budget increase is adopted. Prior architecture candidates and production acceptance work remain pending.

## P040 — Plan synthetic learning-graph polish before real coursework

**Verbatim prompt and attachment:** Preserved in the canonical archive, including the complete supplied scope. Exact received timestamp unavailable. Work dated October 27, 2026 in the client timezone.

**Top 3 outcomes:**

1. Read the attachment and existing PM012 planning edits, PRD, build plan and implementation contracts. Adopted the bounded graph scope without restarting the app: evidence → competing explanations → checked experiment → response-driven revision → useful next activity → fresh application. Existing hypotheses/experiments/jobs/audit are reuse points; linked concept records, approved prediction forms, exposure completeness, meaningful follow-up and R9 image/region support still require implementation/verification.
2. Added [Learning Graph Milestones](LEARNING_GRAPH_MILESTONES.md) with six manageable increments, reviewable tasks, dependencies, owners, explicit exit evidence, a synthetic scenario matrix and conditional real-source validation. Updated PRD acceptance and build-plan priority, scope delivery override, handoff, decisions and owner checklist. Jeremy's account connections are no longer a prerequisite for the next development increments. Preserve existing planning refinements; the original attachment remains verbatim in the archive.
3. Documentation verification checks local links, whitespace, archive equality and milestone identifiers; results recorded below. This turn is planning only: no application implementation/tests, private course reads, live model calls, training, spend, deployment or scheduler changes. All milestone completion claims remain pending executed evidence.

**Plan deviations:** Explicit user-directed sequencing change: synthetic polish precedes personal-course testing, superseding the original Day 1/PM012/P037 real-course-first dependency. Real-course fit, two live source types, independent review, numerical, held-out, R9/privacy and genuine pilot gates remain required. Keep one quantitative family, $2 aggregate cap, October 31 freeze and November 4 deadline. Fine-tuning and a cross-course bridge remain conditional stretches. Unrelated advisory prompts are preserved.

P040 documentation verification: local links in eleven adopted planning documents resolved; canonical attachment text matches the supplied file exactly; all six milestone sections present. Whitespace checked separately. No application tests were run for this documentation-only change.

## P041 — Implement and audit learning graph milestones 1–5

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Implemented M1–M2 with original fictional source/returned-work fixtures, five analytical numerical checks and durable, versioned course-local graph records. Reviewed ownership, exact source-version consent, supersession and retry behavior; real Firestore graph tests passed 2/2. Checkpoints `5a29ee2`, `06dc934`, `2f85467`.
2. Implemented M3–M4 approved deterministic prediction forms, canonical comparisons, immutable corrections and atomic queued reconsideration. Audits fixed partial hypothesis revision, correction context, provisional self-report interpretation, replay size and identical citation duplication. Actual Spark generation passed 4/5; the final fresh comparison produced a materially different follow-up for contrary evidence and kept current work for ambiguity. Earlier failures remain documented. Total metered consumption: $1.55875225/$2. Checkpoints `c0cc0f0`, `7c23e9e`, `00b3aab`, `057d3b0` and final integration; see [audit](LEARNING_GRAPH_AUDIT.md).
3. Implemented M5 Ready Card local evidence inspection, saved-support disclosure, correction history and an authored no-call demo entry. Audit fixed disclosure on worker arrival and reset identity reuse. All 429 default tests and 28 browser journeys passed; managed outbox and fresh-activity restart/readback checks passed, along with type checking and the webpack production build. Pushed implementation `99adaca` and audit `574c84e` to main. Production deployment is Ready; isolated no-model hosted graph/persistence/mobile checks passed and its disposable demo was deleted. CI run 40566599806 passed type checking, default tests and the default production build; hosted CI browser verification is pending its dependency installation. UI checkpoints `95400d2`, `18577de`.

**Plan deviations:** M5 uses its documented typed-observation fallback: R9 image/PDF extraction and region evidence remain incomplete. Student corrections may revise provisional explanations with an explicit self-report/not-independent qualification; original evidence remains ungraded. Local default Turbopack compilation hit a host port-binding EPERM; webpack compilation passed locally and the default Turbopack build passed on Linux CI and Vercel. No budget, family, private-source permissions or dates changed. Independent scientific/instructional review, held-out/live-source/pilot gates and M6 real coursework remain open.

## P042 — Verify learning graph edge cases and credential architecture

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Reproduced and fixed three graph projection/lineage errors and an inspection error: revised original and new diagnostic claims remain separate, reused local IDs cannot inherit old diagnoses, and continuations retain status/observations. Cosmetic text edits cannot establish a fresh activity. Commits `269dfa0`, `ef15cbe`; [scope matrix](SECURITY_AND_GRAPH_REVIEW.md) explicitly leaves teaching relationships and R9 extraction open.
2. Traced credential trust boundaries and fixed deletion/reconnect and settings/lease races, rotated-refresh-token loss after read failure, origin scheme checks, byte-bounded request parsing and private-field projection. Commit `7fdbe86`; deletion recovery and cloud-browser trust disclosure in `ef15cbe`.
3. Executed 442 default tests (39 opt-in skipped), 31 browser journeys, a 4-test managed/SQLite bundle and one hosted credential HTTP test; type/config/build and narrow actual-value secret scan passed. Existing budget remains $1.55875225/$2; no private-course/model calls. Later P044 finishes with 453 default cases (CLI variants separated) and a five-test managed/SQLite bundle.

**Plan deviations:** Additional hardening prompted by reproduced failures, within the requested review. This does not close independent instructional, held-out, real-source, IAM/privacy or complete-graph acceptance gates.

## P043 — Continue additional verification and credential review

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Completed P042 regression work and pushed `269dfa0`, `7fdbe86`, `ef15cbe` to main. CI runs 40566599806, 40567991916 and 40573113950 passed; ef15cbe deployed Ready and its hosted synthetic credential check passed 1/1 in 8.18s.
2. Reviewed deletion recovery on mobile and generated an inspectable architecture report comparing key lifecycle, remote allocation reconciliation and diagnostic-lineage queries. Key rotation was selected in P044. Full findings and remaining scope are in [the review](SECURITY_AND_GRAPH_REVIEW.md).
3. Parallel reviewers reached their usage limit; root completed the review/testing. No independent security certification, production key rotation, new private-course access or new inference is claimed.

**Plan deviations:** Root continued after subagent interruption. Initial disclosure-test setup/selector failures were corrected and final 31/31 journeys passed; they are retained in the review rather than represented as first-run successes.

## P044 — Prioritize credential key rotation and recovery

**Verbatim clarification:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Implemented bounded versioned credential protection with authenticated key IDs, original-format compatibility, reader-first rollout, prior/future key readers and rollback. Commit `73fa35f`; no production key value was changed.
2. Added admin-only dry-run/apply migration with transactional owner/generation/lease checks, idempotent partial progress, preserved OAuth expiry/one-use state and pending-deletion recovery. Tool output has counts and hashed identifiers, never plaintext. Commit `58b3d71`; [runbook](CREDENTIAL_KEY_ROTATION.md) covers missing keys, interruption, rollback and retirement gates.
3. Verified 453 default tests (40 opt-in skipped, 7.21s; CLI variants separated), 5/5 combined managed/SQLite checks (23.10s), type/config checks and webpack production build. The managed check exercised the real maintenance CLI with disposable synthetic data. Five current credential values were absent from 265 tracked files and 45 client files; this narrow scan is not a historical-secret certification. Vercel 0cedfc8 deployed Ready; hosted credential check passed 1/1 in 10.66s including a real deployed v2 read. CI 40575691424 hit the existing ordering stress case’s five-second timeout; all assertions/iterations remain, with a case-specific 15-second bound. [CI 40576121991](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40576121991) passed tests, default production build and browser journeys for `b778a73`, also Ready on Vercel. PRD status now explicitly records the open teaching-relationship requirement.

**Plan deviations:** Adds operational key recovery to the credential hardening work, within the chosen architecture follow-up. Actual production rollover/retirement, secret custody/IAM, orphan reconciliation and real-provider privacy checks remain gates; no product-family or inference-budget expansion.

## P045 — Try the actual Blackboard connection

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Reloaded the existing hosted Soma tab to the current deployment. It was in an anonymous synthetic demo, so opened private-account sign-in and prefilled the previously supplied BU email; the browser is left visible for the user. Blackboard access is not yet established.
2. Reviewed the existing read-only Blackboard login/collection path and recording/log settings. No Browserbase context was allocated, no institutional page or private course source was read, and no model call or key change occurred.
3. Requested user sign-in to Soma before starting Blackboard authorization in the private workspace. Provider login/MFA and exact course-page selection remain pending. No code changed, so no new runtime test result is claimed; existing budget and read-only boundaries remain.

**Plan deviations:** Jeremy now requests the Blackboard trial, advancing selected real-source validation after the synthetic review. This does not establish complete learning-graph or release acceptance.

## P046 — Owner signed in to Soma

**Verbatim clarification:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Verified the visible hosted workspace is authenticated, with Blackboard connecting and no successful live read yet.
2. User had already opened the hosted login windows. No new context/session was allocated by the agent in this step.
3. Institutional login and exact course selection remain pending. Live control links are excluded from logs and source control as credentials.

**Plan deviations:** None.

## P047 — Blackboard login window was blank

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Verified the hosted live-view target remained about:blank, then navigated its address bar to the configured BU Blackboard origin. It reached the BU shibboleth login form; credential fields were empty at the pre-handoff check.
2. Handed credential entry/MFA back to the user and requested one course name/page URL. No private course material or login values were read, stored in the repository or sent to a model.
3. Permanent startup correction remains open. Browserbase documents blank live views from wrong tab selection; exact startup/live-target mapping still needs reproduction and a regression. Manual login and one course opening succeeded later, but fresh-session collection remains unverified.

**Plan deviations:** Time-boxed recovery of an actual login-window failure. No budget or source-write expansion.

## P048 — Blackboard sign-in completed; expect course navigation

**Verbatim clarification:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Observed the authenticated Blackboard course list and manually opened one current course through the hosted live view. This proves interactive access only, not autonomous Spark browsing or saved-context collection. Private course contents and control URLs are excluded from committed assets.
2. Clarified that the current connector reads exact selected pages; course discovery and autonomous navigation are not implemented. No new model call occurred.
3. After the user confirmed login completion, finished the interactive session in Soma. The UI confirms connected / browser saved and retains no successful live-read claim. Reopening a fresh collection session still needs verification.

**Plan deviations:** Interactive read-only validation within the requested Blackboard trial. No source inference/budget expansion.

## P049 — Lightweight Blackboard navigation architecture

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Reviewed the current exact-URL collector: it does not discover courses, traverse folders, handle nested content frames or expose navigation choices to Spark. Its blanket same-host GET/HEAD policy needs verification against actual Blackboard reads and assets.
2. Recommended deterministic Playwright course discovery/collection using the existing Browserbase session, with structured list-courses/list-materials/read-material tools for Spark. Routine navigation needs no model inference; browser runtime costs remain. This is a recommendation, not an implemented capability.
3. Proposed staged acceptance: correct login target plus fresh-context reuse; course selection and versioned scoped reads; bounded model-selected evidence investigation and navigation recovery. Consulted primary Playwright locator/frame and Browserbase live-view documentation. The existing account currently lists only its imported course, so discovery must map/register actual courses without dummy material. No new dependency, real-course model processing or larger budget was enabled.

**Plan deviations:** None adopted in this advisory turn. A richer source adapter fits the existing read-only collector boundary; model-directed UI exploration remains conditional pending explicit implementation and verification.

## PM015 — Explore alternative UI directions in parallel with graph work

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM015`.

**Top 3 outcomes:**

1. Reviewed the selected [UI Direction](UI_DIRECTION.md), the earlier unselected directions in `design-system/soma/directions/` (Fieldnotes, Daylight, Focus, Notebook, Agenda) and the deployed synthetic demo's Today and lesson screens, viewed read-only. Each earlier option restyles a study dashboard, and none shows the competing explanations or the discriminating experiment on the first screen.
2. Used Jeremy's locally installed UI/UX Pro Max skill (search only, nothing persisted). Its `--design-system` result (Neumorphism, Poppins) was a poor fit and was not applied, so targeted style, type and product searches guided the directions instead. Built four interactive, unselected directions as a private design canvas (https://claude.ai/artifact/5NaNL77LNFvGKhbWzFuyBk): F Casebook, G Bench, H Plate and I Studio. Each puts the Quiz 3 answer, explanations A and B, the R₂ experiment with a hidden checked trace, the optional prediction and a response-dependent revision on the first screen. Sources and rationale are in [the canvas folder](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified: no render, contrast, keyboard or reduced-motion check was run on the canvas boards. The revision states are scripted for the mockup, not Spark output. No direction is selected.

**Plan deviations:** None adopted. UI Direction (Ready Card) remains authoritative until Jeremy selects a change and it is recorded in Decisions. No `src/` files, PRD, build plan or deployment changed, so there is no overlap with the concurrent graph session's files. The physics in the mockups is computed in the board script for illustration; production lessons must still read from the checked model.


## PM017 — Give the explored directions personality

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM017`.

**Top 3 outcomes:**

1. Diagnosed the PM015 boards: F–I change typeface and palette but share a generic dashboard skeleton with stock-style icons. Soma doesn't own anything in them. Personality needs one idea that sets the mark, symbols, voice and motion together.
2. Added three static personality concept sheets to the same private canvas: J Neuron (the meaning of "soma": dendrite sources converge and one activity fires), K Margin notes (Soma as a TA's margin pen, with graphite student, red instructor and violet Soma inks expressing the observation/interpretation separation rule) and L Specimen (periodic-table tiles for Soma's own concepts; a lesson's history reads as a formula). Each sheet has a mark, six custom symbols, the hero moment in the product, voice samples and a signature motion with a reduced-motion fallback. Sources and rationale were added to [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified and unselected: the sheets were not rendered or checked for accessibility, and no direction or concept is adopted.

**Plan deviations:** None adopted. UI Direction remains authoritative; no `src/`, PRD, build plan or deployment change.

## PM018 — Still not sold on the explored directions (PM019 clarification answers)

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entries `PM018` (message) and `PM019` (answers to four multiple-choice clarification questions).

**Top 3 outcomes:**

1. Stopped generating options blind and asked about references, the first feeling, a character and what missed. Jeremy picked Linear, Raycast and Arc; Duolingo and Headspace; and Things, Notion and Readwise. The first feeling should be "curious, want to touch it", with no character, and J–L were "too conceptual".
2. Built one real Today screen from those answers, M · Playground, in light and dark on the same private canvas. It has an Arc-like course sidebar and ⌘K bar, Geist type, tactile press-down buttons and a dial slider, and amber current dots flowing through the circuit. R₁'s branch stays switched off until the student guesses or chooses to skip the guess, which is recorded as help. The scripted revision and next activity follow the guess. Sources and rationale are in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified and unselected: no render, animation, contrast, keyboard or reduced-motion check was run, and no direction is adopted.

**Plan deviations:** None adopted. UI Direction remains authoritative; no `src/`, PRD, build plan or deployment change.

## PM020 / PM021 — Rethink functionality and layout around the knowledge graph

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamps unavailable.

**Verbatim prompts:** Preserved in the canonical prompt archive, entries `PM020` (functionality and layouts) and `PM021` (knowledge graph as the central premise, sent while PM020 work was in progress).

**Top 3 outcomes:**

1. Redirected the PM020 layout pass to PM021: proposed the semester as a transit map. Courses are lines; syllabus concepts are stations by week; station looks come from evidence (own, with help, two explanations being tested, coming up, deadline); cross-course links are shown only as "proposed · not verified"; zoom levels (map → line → station → playground) replace separate destinations; Today is the map's frontier.
2. Built three boards on the private canvas: an interactive semester-map home (frontier chips, selectable stations, a station inspector with evidence labeled by who said it, change cards linked to stations), a station concept and evidence page (direct neighbors only, versioned interpretation, evidence timeline) and a mobile vertical-line view. Rationale is in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Flagged the conflict: UI Direction and Learning Graph Scope currently exclude a semester-wide graph destination for P0. N is unselected and unverified (no render, accessibility or reduced-motion check).

**Plan deviations:** None adopted. A graph-first home would deviate from UI Direction and Learning Graph Scope and needs Jeremy's decision recorded in Decisions before implementation. No `src/`, PRD, build plan or deployment change.

## PM022 — Personas, usage and navigation for the graph-first direction

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM022`.

**Top 3 outcomes:**

1. Grounded five representative personas in the PRD and [user stories](USER_STORIES.md): Jordan (juggler), Sam (short windows), Ana (returned work), Leo (exam week) and a no-account visitor. Mapped how often each needs eight functions, and concluded that the graph should be the premise while the next action is the home. This is consistent with the PRD's deferral of graph and mastery dashboards.
2. Recommended navigation of Today · Map · Activity, with course lines and Sources below and ⌘K for asking and jumping; on phones, Today · Map · ＋Ask · Activity; no Courses or Study tabs. Added five layout principles.
3. Added a personas and navigation board and four annotated low-fidelity wireframes (Jordan desktop Today, Ana returned work, Leo exam scope on the map, Sam phone Today) to the private canvas, with rationale in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md). None of this is verified or adopted.

**Plan deviations:** None adopted. Changing the navigation away from UI Direction (Today, Courses, Study) would need Jeremy's decision recorded in Decisions. No `src/`, PRD, build plan or deployment change.

## PM023 — Let students make their own quizzes and flashcards from any card

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM023`.

**Top 3 outcomes:**

1. Designed "study your way" as a Make panel on every station card, extending the existing direct-request, ordinary-practice and review-card scope through the same engine. Formats: interactive lesson (only with a checked model), practice quiz, flashcards, worked example, explain it plainly, exam-style set. Options cover scope (this station, plus neighbors, exam scope) and mode (closed book, or hints recorded as help). Soma's suggestion is labeled in the same grid.
2. Kept the evidence invariants: generated items cite the station's sources; closed-book correct fresh answers can count as "on your own", hints count as "with help", and flashcard ratings only schedule review. A repeated miss can trigger a suggested experiment, joining self-directed and agent-suggested study on one map.
3. Added three boards to the private canvas (an interactive Make panel, quiz and flashcard views with "where results go", and a phone bottom sheet), with rationale and a positioning-risk note in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md). Unverified and not adopted.

**Plan deviations:** None adopted. No `src/`, PRD, build plan or deployment change. Self-made sets should support rather than lead the demo, given the guide's anti-project list.

## PM024 / PM025 — UI overhaul to graph-first navigation, plus a UI/UX guide

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamps unavailable.

**Verbatim prompts:** Preserved in the canonical prompt archive, entries `PM024` (overhaul plus guide) and `PM025` ("COmmit frequently, push to main when done", sent mid-turn).

**Top 3 outcomes:**

1. Added [UI/UX Guide](UI_UX_GUIDE.md), which owns personas, Today · Map · Activity navigation, layouts, tokens, motion, evidence-honesty rules and the accessibility checklist, with references to the design canvas. AGENTS.md now says to read it before any UI work. UI Direction, the handoff and Learning Graph Scope were marked accordingly, and the decision is recorded in [Decisions](DECISIONS.md).
2. Overhauled the app without changing its data or server behavior:
   - a sidebar shell with Today, Map, Activity and course lines;
   - Geist and Geist Mono via `next/font`, indigo and paper tokens, tactile buttons;
   - a semester map projected only from saved records (`semester-map.ts`, 6 unit tests);
   - a station inspector with who-said-what evidence and a Make panel (open lesson, fresh question, ask for something new);
   - Today's map strip;
   - an Activity page behind the same help-disclosure gate as the dialog;
   - animated current along wires, its speed set by the checked model, with reduced motion respected.
3. Verification, all executed:
   - Typecheck passed. The unit suite passed (591 passed, 45 skipped), including 6 new semester-map tests. `npm run build` passed.
   - Playwright: 35 passed and 1 failed. The failure is `blackboard-material-sanitization.spec.ts`, which exercises the concurrent session's uncommitted Blackboard material reader and fails server-side; it isn't caused by the UI change.
   - The first run surfaced two overhaul regressions, both fixed: the Next dev indicator covered the sidebar's workspace menu, and one journey still clicked the removed Courses tab (it now uses the course line).
   - Browser checks at desktop and 375 px for Today, Map, Activity and the lesson: no horizontal page scroll, and visible keyboard focus through the sidebar and onto map stations. Reduced motion relies on the existing global rule.

**Plan deviations:** User-authorized. The Map destination narrowly supersedes Learning Graph Scope's "not a new full-screen graph destination", and navigation replaces Ready Card's Today · Courses · Study. Course detail and lesson deep links (`?view=courses`, `?view=study`) still work. Quiz and flashcard generation formats stay unbuilt proposals. The concurrent Blackboard work (`source-connections.tsx`, Blackboard files) was not touched or committed.

## P050 — Implement lightweight Blackboard navigation

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Committed blank-login recovery (`835f31c`), bounded read policy/runner (`c4a4d05`) and course discovery/selection/resumable supported text collection (`f90e5fe`). Fresh-session discovery verified 36 actual course metadata rows with institutional identity binding and zero inference. A bounded BI 107 text probe extracted 16 items with further folders pending, zero inference and zero material publication. No private body, login screenshot or control URL enters committed fixtures.
2. Milestone review found and fixed missing pagination proof, actual Blackboard string handlers/rawText/empty-page sentinels, historical remap bypass, lost traversal progress, failed-course starvation, stale lesson withdrawal, account identity changes and browser-budget cadence. Eighty-six focused tests, nine orchestration tests, five actual managed synthetic-account selection cases and the four picker browser journeys passed; final aggregate results follow below. Navigation uses application-authored GETs, while Spark investigates committed sources through the existing tools.
3. The production build passed with normal network access. One sandbox build failed on Google Fonts DNS; the first aggregate browser run passed 35 journeys and failed the new sanitizer because its fixture omitted the newly required paging proof. The fixture was corrected and its actual browser recheck passed. Full source publication through the selected-course hosted UI, actual expiry/deletion and real-course teaching quality are still separate gates. No Meta call or budget increase occurred.

**Final local verification:** 613 default tests passed / 47 opt-in skipped; three additional HTTP ownership/origin checks passed. All five managed synthetic-account cases passed. Across the full browser run and corrected sanitizer rerun, all 36 journeys passed; the picker notice was subsequently updated to show the server's actual partial-read result, and its focused recheck passed. Default production build passed; a scan of 325 tracked/client files found no actual private environment secret values. Source code and milestone audit pushed to main (`f90e5fe`, `0ca418d`); production deployment is READY at the existing Soma URL. The actual signed-in course picker rendered the verified catalog with all courses unselected; unauthenticated catalog GET returned 401 and foreign-origin POST returned 403, both no-store. Main CI for `88015ea` completed successfully ([run 40587503434](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40587503434)), including the default build and full browser suite. Course selection and a real selected-source publication remain user-dependent, rather than inferred from the read-only probe.

**Plan deviations:** Implements the requested lightweight adapter. The Ultra frontend attempted a preference PUT during exploration; collection instead uses exact authenticated GET JSON reads. Scheduled browser starts retain headroom under the existing daily cap, so larger selections/multi-slice walks can take longer than six hours. Files/images/embedded tools remain unsupported. Gradescope then Piazza follow under P051; no new model/framework or teaching family.

## P051 — Piazza and Gradescope after Blackboard

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Recorded the requested next integrations: Piazza for a class and Gradescope as the main assignment source.
2. Continuing the in-progress Blackboard milestone first; Gradescope is the next validation priority, followed by Piazza. No access, collection or model-processing outcome is claimed for either provider.
3. Existing separate encrypted browser contexts, user-entered login/MFA and selected read-only scope apply to the follow-up. No new credentials requested in chat.

**Plan deviations:** Sequencing clarification within the existing source-integration scope; no new product family or budget.

## P052 — Collect all Fall 2026 Blackboard courses

**Verbatim clarification:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Verified the complete 36-entry private Blackboard catalog and saved all three Fall 2026 selections in the deployed account. A final owned-record readback confirmed exact semester selection, one healthy connection and 36 current text observations across the three selected courses (16, 16 and 4). Older courses and the existing imported course were preserved. All three traversals still have pending pages; files/images/external tools remain unsupported.
2. Fixed the hosted-only HTTP 500. Direct audited publication worked locally, but isolated Vercel packaging reproduced a missing Playwright registry JSON. `4bcdbfa` includes that asset for all browser-reading routes and adds an isolated import gate to CI; a negative trace without the asset correctly fails. Browser, Blackboard and worker traces pass, and a clean Vercel staging build passes with zero dotenv mappings. The temporary staging and unsafe local prebuilt output were deleted; the active env file was unchanged. Safe diagnostics log only fixed phase/error-type facts.
3. Hosted partial reads now publish actual source versions and save/reuse source-investigation jobs within the unchanged budget. CI [40591134458](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40591134458) passed typecheck, tests, production build, the new isolated artifact check and the full browser suite. Opened the separate Gradescope browser handoff in Soma; its login window is ready for user-entered sign-in/MFA, with actual Gradescope access still unverified. The browser screenshot attempt was unavailable, so no claim is made about its loaded inner login page. Piazza remains the next separate connection. No full-course completion, image/PDF access or instructional-quality claim follows from these source checks.

**Plan deviations:** Real verification exposed and repaired deployment packaging before continuing source onboarding. No session/inference budget or source permission was expanded beyond the user's Fall 2026 selection. The existing release gates remain.

## P053 — Updated UI/UX guidance and new file

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Read the new docs/UI_UX_GUIDE.md completely and checked updated AGENTS.md, UI_DIRECTION.md and LEARNING_GRAPH_SCOPE.md guidance. Today · Map · Activity and the Playground visual language now own navigation/layout; previous Ready Card evidence and interaction rules remain where not superseded.
2. Confirmed the deployed app already uses that guide’s new navigation and styling. Continuing Fall 2026 source setup within the updated interface; no additional redesign was requested.
3. New study formats stay hidden until supported; source labels, private account separation, reduced motion and evidence honesty remain required. PRD/release gates and unsupported image/PDF status are unchanged.

**Plan deviations:** None; incorporated the already adopted UI guidance without reopening design selection.

## P054 — Gradescope completed sign-in (October 27, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P054`.

Top three outcomes:
1. Completed Soma’s save-session action after the user reported Gradescope sign-in/MFA finished. The UI confirms saved context, with source access explicitly still unverified.
2. Fresh-session read-only access passed: 17 enrolled course links, explicit term containers, and an EC 417 assignment-table structure with seven rows. The current Fall 2026 catalog contains three courses. No grades, submission responses, material publication or model inference in these probes.
3. Implemented assignment-only extraction and guarded publication with bounded four-page rotation, isolated unsupported-course recovery and source-dependent lesson staleness. Actual no-publication verification passed on three current-semester overviews and 26 assignment rows; names/dates only, no grades/responses/files or inference. Production deployment `7bfbd59` is live. Saved all three verified current-semester course mappings and performed the production refresh: three current owned overviews, 26 rows, exact selected scope and allowed metadata fields verified by independent managed readback. A frontend network error obscured the successful response; status retry recovered without another browser allocation. Opened Piazza in a separate hosted context and handed its sign-in/MFA window to the user. No Piazza content read or successful source-access claim yet.

Executed checks: fresh-context live catalog and assignment-structure probes passed. The first implemented reader failed safely on a primary-button assignment row; structural diagnosis led to explicit unknown-identity handling, then the three-course/26-row actual reader probe passed. Full synthetic suite: 749 passed, 51 skipped, followed by an additional explicit-failure regression; typecheck passed. The first production build hit a Turbopack internal cancellation; a clean generated-output rebuild passed. Isolated browser-artifact import passed (1,216 files, two links, zero private configuration mappings). Existing 36 synthetic browser journeys passed; the new six-course settings journey also passed (37 total browser journeys). CI [40595330232](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40595330232) passed the final implementation, including build, isolated browser artifact and all browser journeys. A managed-readback check initially used the default five-second unit timeout; the bounded live-service timeout passed. No private course bodies, identities or session material were added to fixtures.

Commits: `1db43fc` access/navigation checkpoint; `7bfbd59` metadata collection/recovery deployed and pushed to main; this final checkpoint records the independent owned readback.

Deviations: none established. Preserve concurrent PM028 generated-lesson correction; no course content or browser-control material is included here.

## P055 — Piazza completed sign-in (October 27, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P055`.

Top three outcomes:
1. Saved the separate Piazza context after the user reported completed sign-in. A fresh context rendered the authenticated CS 440 class shell with exact inventoried first-party scripts and all APIs/writes blocked. Three class links were repeated navigation to the same class, not three enrollments. The read-only class picker exposed explicit terms for two Fall 2026 classes (CS 440 and EC 463–464) and one Spring 2026 class. No classes were selected or published from this discovery.
2. Replaced the generic Piazza whole-page reader with bounded structured instructor-note previews from the initial visible feed, strict class/script policies, positive privacy/type filters, one-class rotation, guarded publication and isolated failed-class recovery. Added [Piazza connector boundaries and remaining gate](PIAZZA_CONNECTOR.md). Full posts, replies, private/section/graded items and attachments remain excluded; previews cannot establish complete coverage. No Meta calls or Piazza material publication occurred.
3. Actual typed catalog extraction failed closed on a URL scope check. A narrow empty-history-delimiter normalizer and synthetic regressions were added, but the suspected live cause remains unconfirmed. Further Browserbase allocation attempts were rejected; the final safe upstream status was HTTP 402. A read-only project usage request succeeded and reported 60 browser minutes, zero proxy bytes. Stopped allocating sessions and asked the owner to review billing/usage; no payment or plan change. Saved context remains available. Final actual extraction and production publication remain unverified.

Verification checkpoint: shared-checkout full default suite passed 893 tests with 54 opt-in skips, and typecheck passed. Concurrent optional lesson-orchestration work is included in that shared count and is not this connector change. Final scoped connector/worker regression set passed 210 tests across seven files, typecheck passed, and scoped whitespace checks passed. Independent final reviews added late-render URL revalidation, finite-deadline rejection and safe HTTP 402 retention without provider bodies or workspace mutation. The clean committed CI [40613543138](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40613543138) passed 911 tests (53 opt-in skips), all 37 browser journeys, typecheck, production build and the isolated browser-artifact import (1,218 files, two links, zero private configuration mappings). The reviewed code was source-deployed from a clean `3efb1cf` snapshot excluding local credentials and concurrent unfinished work. Deployment `dpl_9jzqsdgLvdr1aRL8o4DtUCS9Ao1R` is ready and aliased to the production site. Reloaded the actual authenticated UI and verified its partial-preview scope, no successful live-read claim, and saved-authorization retention. No additional browser-service allocation was attempted after the confirmed 402. No provider response bodies, private source text, session material or real identifiers were placed in fixtures.

Commits: `ae61ae6` discovery/access checkpoint; `3efb1cf` structured preview collection, privacy/recovery tests and operating boundary, pushed to main and deployed. This documentation checkpoint records the final clean verification and remaining provider gate.

Deviations: collection is deliberately limited to partial class-visible instructor-note previews rather than full discussion bodies. The live gate is deferred due to the provider billing refusal, not declared passed. Current source authorization, $2 Meta cap and concurrent PM028/PM029 work are preserved.

## P056 — Retry Piazza after provider allowance update (October 27, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P056`.

Top three outcomes:
1. Retried the existing opt-in saved-context access check once under the explicit private owner/class scope. It failed after 4.45 seconds during session allocation with safe upstream `providerStatus: 402`; no Piazza page opened, material was published or model was called. Saved authorization was retained.
2. Checked provider project identity and usage using read-only GETs. The existing connector has no explicit project override and its key resolves to exactly one project, named “Personal project,” with concurrency three. Project-list and usage reads both returned HTTP 200; usage remains 60 browser minutes and zero proxy bytes. A first diagnostic required an explicit project and stopped locally; the corrected check used the connector’s existing single-project fallback. No billing change or second session allocation was made.
3. Asked whether the user changed the allowance in this same Browserbase account or another one; any replacement key must remain in the local env file. Actual structured extraction, source selection, production collection/readback and full discussion access remain unverified. No application changes, new Meta calls or payment actions; existing deployed implementation and concurrent lesson work were preserved.

Executed checks: one opt-in actual-provider test failed at the allocation gate; two bounded read-only service requests succeeded. Canonical prompt/archive and scoped documentation checks follow before commit. No broad synthetic suite was rerun for this documentation-only checkpoint. These results supersede the expectation that provider access had recovered, not the recorded earlier CI success.

Deviations: retry remains blocked by the provider’s HTTP 402 response. No supported-reader or release gate is declared passed.

## P057 — Browser hosting cost and Google Cloud credits comparison (October 27, 2026)

Prompt: [canonical verbatim clarification and pasted plan screen](build-log/prompts.json), `P057`.

Top three outcomes:
1. The supplied account screen still labels Free as the current plan, consistent with the actual HTTP 402 refusal. Verified official Browserbase pricing: Developer $20/month, 100 browser hours, 25 concurrent browsers, $0.12/hour overage and a one-minute session billing minimum. The separate 15 Agents calls are not the limit for Soma’s direct Playwright/session API path. Developer is the recommended existing-provider tier for this hackathon, not a purchased or activated plan.
2. Compared lower-cash-cost alternatives: a local Playwright companion requires the computer to stay available; a Google Cloud browser worker could use eligible Cloud Run/Compute Engine credits while the app stays on Vercel. Google explicitly documents Chromium/Playwright and interactive streaming on Cloud Run. Credit eligibility/expiry is unknown: the Billing Credits page exposes restrictions by service/SKU. Credits do not automatically fund the current external Browserbase subscription.
3. Inspected the current connector: browser lifecycle, encrypted context references, session ownership and interactive sign-in handoff are coupled to Browserbase. A Google Cloud runner is feasible but requires an adapter, encrypted persistent browser state, user isolation, authenticated login/MFA streaming and recovery tests. Existing saved logins cannot simply be assumed portable. No infrastructure, plan, credentials, source selection, deployment or spending limit was changed; this is an advisory comparison.

Estimate: 24 checks/day at one to two billed minutes/check for 30 days equals 12–24 browser hours, excluding development/MFA/retries. This is arithmetic for illustration, not measured workload performance or a cost ceiling. Paid overages remain possible.

Sources checked: [Browserbase plans](https://docs.browserbase.com/account/billing/plans), [contexts](https://docs.browserbase.com/platform/browser/core-features/contexts), [Google Cloud browser automation](https://docs.cloud.google.com/run/docs/browser-automation), [Cloud Run pricing](https://cloud.google.com/run/pricing), [credit scope](https://docs.cloud.google.com/billing/docs/how-to/resolve-issues#view_promotional_credits_applied_to_your_account). Documentation/archive validation only; no application tests or additional browser session allocation needed for this comparison.

Deviations: none selected. A Google Cloud migration is an option, not an authorized or completed scope change. Existing live Piazza extraction/publication remains unverified.

## P058 — Check Google Cloud credits with CLI (October 27, 2026)

Prompt: [canonical verbatim prompt](build-log/prompts.json), `P058`.

Top three outcomes:
1. Inspected installed Google Cloud SDK 571.0.0 and supported stable/beta billing command help. Read the authenticated account and two accessible open billing accounts. Explicitly inspected Soma’s project billing: `billingEnabled: false`, with no linked billing account. The unrelated default CLI project was preserved. Initial sandbox logging/credential-cache permissions required the normal approved read-command escalation; no authentication, IAM or billing link was changed. An unavailable alpha help path attempted component discovery and failed without installation; it was not needed or retried.
2. Verified the documented Cloud Billing account API exposes metadata rather than remaining promotional balances. Used the official Credits console as a read-only fallback in the existing authenticated browser. The Deployment Billing account visibly lists three available grants and one expired grant. Reported available amounts/expiration information privately to the user; billing identifiers, credit identifiers and financial balances were not copied into the repository. The other billing account’s credit balance was not inspected.
3. Every available grant’s visible scope is “Certain usage; see the terms of the promotion for details.” Expanded the largest grant’s row but found no service-specific eligibility confirmation. Cloud Run/Compute Engine eligibility remains unverified pending promotion terms. Kept the Credits page available to the user. No billing activation, account linking, infrastructure creation, payment, model call, Browserbase allocation or application changes.

Sources: [gcloud billing accounts](https://docs.cloud.google.com/sdk/gcloud/reference/billing/accounts), [Cloud Billing account resource](https://docs.cloud.google.com/billing/docs/reference/rest/v1/billingAccounts), [official credit balance/scope view](https://docs.cloud.google.com/billing/docs/how-to/resolve-issues#view_promotional_credits_applied_to_your_account). Canonical archive and scoped documentation checks only; no application tests are warranted for the read-only inspection.

Deviations: supported CLI commands cannot complete the requested promotional-balance lookup, so the balance was read from the console and distinguished from CLI results. Credit availability is not a service-eligibility or successful-browser-migration claim.

## P059 — Authorize GCP browser migration and inspect billing project quota (October 27, 2026)

Prompt: [canonical verbatim prompt](build-log/prompts.json), `P059`, including its trailing space.

Top three outcomes:
1. User authorized linking Soma to Deployment Billing and migrating browser hosting to GCP. Executed the requested link attempt for the existing Soma project. Google rejected it with `FAILED_PRECONDITION` / `google.rpc.QuotaFailure` (“Cloud billing quota exceeded”). No billing association changed and no project was detached or deleted.
2. Read the actual linked-project list and project metadata: Falsify Transcend 2026 (`falsify-transcend-2026`), Hodi (`hodi-2026`), Dira Prod (`dira-prod`), Asili XPRIZE (`asili-xprize-2026`), Sema Cinema (`sema-cinema-2026`). All five are active and billing-enabled; lifecycle status is not usage/inactivity evidence. Presented this inventory and requested the exact project to unlink, explaining that it preserves the project but disables paid services. Selection was pending at this checkpoint and subsequently resolved by P060. No private billing account identifier is archived here.
3. Began an independent architecture review for the GCP browser runner while awaiting the required project choice. Preserve Vercel hosting, selected source mappings, read-only provider policies, account ownership, exclusive leases, encrypted saved authorization, direct user login/MFA and recoverable deletion. The migration must provide fresh GCP sign-ins without assuming Browserbase context portability. Deployment, actual provider access, credit applicability and the cutover remain unverified.

Executed checks: linked-project list and five project name/lifecycle metadata reads succeeded; one authorized billing-link mutation was rejected by quota. No application code changes, deployment, paid worker creation, inference or browser session allocation. Architecture review produced [GCP Browser Migration](GCP_BROWSER_MIGRATION.md), including backend-versioned cleanup, trusted interactive access, encrypted fenced storage and explicit cloud-credential/network isolation. P060 subsequently resolved the billing prerequisite.

Deviations: GCP migration is now explicitly selected, superseding P057’s advisory-only state. Provider-credit eligibility remains unknown. The billing quota blocks hosted rollout until the user identifies a project to unlink or obtains increased quota. No destructive project deletion is authorized by an unqualified “remove one.”

## P060 — Select Hodi for billing unlink (October 27, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P060`.

Top three outcomes:
1. Verified Hodi’s association immediately before the user-authorized unlink. Hodi now has billing disabled and no billing account; the project was not deleted.
2. Linked Soma to Deployment Billing successfully. Independent linked-project readback confirms Soma replaced Hodi while the other four project associations remain.
3. Implemented backend-versioned browser transport/cutover and an isolated GCP worker with owner-scoped control/CDP, one-use human viewer capabilities, encrypted cookies/localStorage/IndexedDB snapshots, generation fencing/tombstones and a DNS-pinning egress proxy. Initial focused verification passed 89 tests plus typecheck. Enabled required cloud APIs; created separate runtime/build identities, private credential-state bucket and Secret Manager entries. Readback confirmed public access prevention, uniform bucket access and zero soft-delete retention. Hosted runner, provider logins, credit applicability and production cutover remain unverified at this checkpoint.

Deviations: none from the exact selected unlink. No inference-cap increase or project deletion. Final migration results follow at checkpoints.

### P060 deployment and hosted-verification checkpoint — October 27, 2026

1. Implemented and pushed `24ad6a2` and `a2ec1f5`: backend-versioned transport and legacy cleanup, fenced encrypted GCP state, private control/CDP, one-use human viewer, sanitized sandboxed Chromium, pinned public-only egress and recoverable cleanup. Cloud APIs, separate build/runtime identities, bucket with public access prevention/zero soft-delete retention, Secret Manager and IAM-private Cloud Run worker are deployed. The service maximum is one instance, minimum zero; app active browser capacity is one. No existing source context or mapping was migrated yet.
2. Actual private hosted gate passed original synthetic cookie/localStorage/IndexedDB restoration, direct ciphertext/tombstone readback, metadata denial, real JPEG viewer frames and synthetic input, release revocation and deletion. Zero Meta calls or course credentials/data. Initial health probe failed because Google reserves paths ending in `z`; `/healthz` was changed to `/health`. Subsequent tests used authenticated `/v1/projects` and completed. This does not establish instance-termination recovery, real course collection or the full learner loop.
3. Clean CI [40627635442](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40627635442) on `a2ec1f5` passed 1,004 tests/54 opt-in skips, 37 browser journeys, typecheck, production build and isolated browser-artifact verification. The shared-checkout full suite passed 1,019/54 skips including concurrent lesson work. Focused checkpoints: 69 transport/lifecycle/policy, 59 state/egress, 14 worker security tests. A new frontend journey passed typing/paste, Tab/Escape, fragment removal and no pasted-value DOM retention; typecheck passed. Restricted local socket tests failed EPERM and passed with normal local-server permission. App `a2ec1f5` deployed successfully to the existing production alias after using explicit Vercel project scope; the initial “Not authorized” attempt is retained as a failed deployment attempt. Prepared GCP URL/project/control env settings only; backend remains Browserbase and no state-encryption key was sent to Vercel.

**Automatic approval and remaining boundary:** initial public Cloud Run invocation (`--allow-unauthenticated`) was rejected by automatic approval review: migration authorization did not explicitly authorize that persistent public-access setting. The safer IAM-private deployment succeeded and anonymous invocation is denied. Human login from an ordinary browser requires explicit approval for public invocation of this one service, with application private-key/owner and one-use viewer authentication still enforced. Until approved, no public IAM binding, backend activation, source reconnect or real course processing. See [GCP Browser Migration](GCP_BROWSER_MIGRATION.md) for the concrete configuration and open gates. Credit applicability remains unverified; no Meta cap change or project deletion.

P060 final private artifact: pushed `c7d3445`. Cloud Run revision `soma-browser-00003-7w8` serves all traffic with anonymous invocation disabled. The complete actual synthetic gate passed again against that final revision in 11.47 seconds, including real viewer input and independent encrypted storage/deletion readback; authenticated `/health` returned 200 and IAM readback had no anonymous binding. Public-entry approval has been requested explicitly. Until answered, backend activation and fresh provider login remain pending. New CI [40629457007](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40629457007) passed typecheck, default tests, production build and isolated artifact verification; browser-journey step was still pending at this checkpoint. No new private-source processing or inference.

P060 final CI readback: [40629457007](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40629457007) completed successfully on `c7d3445`: **1,004 tests passed / 54 opt-in skips**, **38 browser journeys passed**, typecheck, production build and isolated browser-artifact check passed. This supersedes the pending browser step above. The local authenticated proxy was stopped. The Cloud Run service remains IAM-private, production backend remains Browserbase, and the explicit public-entry approval remains pending; no real course login/collection or additional model call occurred.

## P061 — Authorize protected GCP sign-in entry (October 28, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P061`.

Top three outcomes (activation in progress):
1. User explicitly approved internet invocation of the single `soma-browser` Cloud Run service, resolving the prior automatic approval boundary. Applied `allUsers` / `roles/run.invoker` only to that service; policy readback confirmed the exact binding. Application private-key/owner control and one-use viewer authentication remain required.
2. Extended the opt-in actual hosted gate to omit Google identity headers entirely, matching the app and human-browser path. The gate passed in 13.39 seconds: public health works, missing/wrong control credentials and unauthenticated CDP are denied, private CDP/viewer input works, saved cookies/localStorage/IndexedDB restore, metadata is blocked and encrypted state/deletion readback passes. No course accounts or Meta calls. An initial test-only header union needed an explicit string-record annotation; corrected and typecheck passed.
3. Activated GCP in production from clean committed source, repaired an actual legacy-cleanup HTTP contract failure and deployed the tested repair. The final app produced the protected GCP window displaying BU’s real login page; human login/MFA and actual selected-source reads remain pending. Preserved all unrelated uncommitted lesson changes.

Deviations: public entry is now explicitly authorized; no other IAM relaxation, model budget increase or course-scope change.

### P061 production activation and cleanup repair checkpoint

- Added the production `SOMA_BROWSER_BACKEND=gcp` setting and deployed clean committed `fb25fac` as `dpl_587LbsLR4XQCKak8f8Jf4RXinXg7`, retaining the existing production alias. A fresh browser load visibly showed the Google Cloud hosting disclosure and retained the saved course selections. Local backend configuration also selects GCP. Unrelated uncommitted lesson work and private env files were excluded from the deployment archive.
- The first production Blackboard reconnect failed before GCP allocation. Sanitized provider diagnostics located HTTP 400 at the legacy context DELETE, with the encrypted legacy references retained and no active lease. A read-only owner-scoped check confirmed the saved legacy context still existed. Fixed body-less control requests to omit JSON Content-Type; authenticated JSON bodies retain it. Added strict empty-JSON upstream regression coverage. This repair preserves confirmed cleanup before replacement, ownership and generation leases; it does not skip old-provider deletion.
- The same owner-scoped, lease-protected application login path then passed against the real providers in 6.76 seconds, creating the fresh GCP login without a model call. All **90 focused browser transport/policy/lifecycle tests** and typecheck passed. The cleanup repair still needs its clean production deployment; actual human login, source readback and full teaching-loop success remain unverified. Private diagnostic scripts are ignored and print only safe status/category facts. Verified the [official legacy DELETE contract](https://docs.browserbase.com/reference/api/delete-a-context), including its 204 success response.

P061 final deployed handoff: pushed `185ea57`; clean Vercel deployment `dpl_HRwpQ7sbdfpq7gT2hqjrSAStz2Qi` is READY and aliased to the existing production domain. The final production reconnect succeeded and generated its protected GCP viewer. Browser verification showed “Connected” and BU’s actual `shib.bu.edu` sign-in page; the one-use fragment was removed. No credentials were entered or observed by the agent. The sign-in and Soma tabs are retained for human login/MFA; an ignored local screenshot records the empty login form. Independent metadata readback confirmed GCP/connecting, saved context/session present and no active application lease. Temporary private diagnostics were removed. The user has been asked to finish login/MFA and confirm in Soma. Actual GCP course reads, provider refresh/publication and new teaching-loop success remain unverified. Gradescope/Piazza retain their legacy authorization/mappings for their sequential reconnect/cleanup. Google sources remain separately unconnected in the visible UI.

CI on `fb25fac` completed successfully; final repair CI [40633292550](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40633292550) is pending at this checkpoint. The executed local repair gate is 90 focused browser tests plus typecheck; the actual owner-scoped login start also passed. No application/model spending increase, inference, course submission or external message.

P061 final CI: [40633292550](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40633292550) completed successfully on deployed `185ea57`: **1,006 tests passed / 54 opt-in skips**, **38 browser journeys passed**, typecheck, production build and isolated browser-artifact verification passed. The protected GCP sign-in entry and production backend activation are complete; only human provider login/MFA and subsequent actual source validation remain. No login inputs were observed after handoff, no inference was made and no other source permissions were changed.

## P062 — Reopen the protected Blackboard login (October 28, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P062`.

Top three outcomes:
1. Reconnect found the prior bounded GCP sign-in session expired. The normal application path cleared its ended-session reference and returned the expected brief sync/retry message; saved context and course scope were retained.
2. Created a fresh bounded viewer, then regenerated its one-use capability after an already-opened link was rejected. Replacing only the fragment on the same viewer path did not reinitialize the page; reloading with the fresh fragment established the protected connection. The actual viewer showed the authenticated Blackboard course shell. Saved the session through Soma; its UI now reports connected, with the previous three selections retained pending a fresh course-list check. No credentials were entered by the agent.
3. A fresh production course-discovery operation restored the Blackboard inventory using the saved GCP authorization; all three existing Fall 2026 selections remain checked/saved. No selected course-material ingestion or inference was initiated. Continued the previously authorized provider sequence: Gradescope reconnect succeeded through the GCP adapter, retained its mappings and opened its actual login form in an isolated protected viewer. Human Gradescope login/MFA and Piazza reconnect remain pending. No implementation or permission change.

Deviations: none. This is a routine sign-in refresh under the deployed GCP adapter.

P062 verification: observed the expired-session recovery, actual protected viewer connection, authenticated Blackboard shell, Soma’s saved/connected status and fresh course-list checked timestamp. Source selection stayed at three saved courses. Opened Gradescope’s real Log In modal and retained the viewer/Soma tabs for human handoff. An ignored local screenshot records the empty Gradescope form; no credential, session ID, viewer token, course document or learner record is archived. No application tests or deployment were rerun for routine reconnect/documentation-only work; the deployed `185ea57` CI gates remain the prior executed baseline. Asked the user to complete Gradescope login/MFA and confirm in Soma. No external messages, submissions, new inference or spending-limit changes.

## P063 — Renew the Gradescope sign-in window (October 28, 2026)

Prompt: [canonical verbatim clarification](build-log/prompts.json), `P063`.

Top three outcomes:
1. Resumed the existing active Gradescope session through the deployed, owned reconnect flow; the provider page was preserved and the original session expiry was not extended.
2. Regenerated its one-use viewer capability and fully reinitialized the same viewer document. Actual UI verification showed Connected and the Gradescope origin; retained both tabs for human sign-in. Captured only Soma’s connection status, avoiding a screenshot of possible login inputs. Authentication and source access remain unverified.
3. Existing course mappings, bounded sessions and source permissions retained. No implementation, inference, deployment, new material collection or permissions changes. Documentation-only verification; the prior executed application tests were not rerun. No credential or session material was archived.

Deviations: none; routine sign-in renewal.

## P064 — Diagnose repeated sign-in disconnection (October 28, 2026)

Prompt: [canonical verbatim prompt](build-log/prompts.json), `P064`, including trailing space.

Top three outcomes:
1. Diagnosed a ten-minute allocation counted before link opening and an independently observed early transport close; its specific cause remains unknown. Reconnect previously reused the deadline and every close appeared as ended.
2. Committed/pushed `67b0281` and deployed a fixed thirty-minute GCP sign-in allocation, visible monotonic countdown, cookie-only reload/resume, bounded stream retries and offline input protection. Collections remain 180 seconds and entry links one-use/ten minutes.
3. CI passed 1,012 tests (54 opt-in skips), 42 browser journeys, typecheck, production build and isolated artifact checks. Actual hosted synthetic browser checks passed, including a 135-second held stream and secure cleanup. The new production Gradescope window visibly connected with approximately 29 minutes remaining and its empty login form was handed off. Human login/save and actual source read remain unverified.

Deviations: GCP interactive sign-in increased from ten to thirty minutes, with a 2,100-second worker request ceiling. No source-permission, browser-capacity or model-spending expansion; full thirty-minute wall-clock durability and instance replacement recovery remain unverified.

### P064 diagnosis and implementation checkpoint

- Actual configuration was a 600-second sign-in allocation, beginning before the user opened its link; reconnect reused its original expiry. Deployed Cloud Run request timeout was 900 seconds on the same unchanged revision. The first 45-minute log window was empty; a bounded three-hour read then showed the latest viewer starting at 14:46:58 UTC and closing after 114.28 seconds, before the known 14:50:51 UTC session deadline. Therefore not every disconnect was expiry. The previous viewer mapped all WebSocket closes to “ended,” lacked recovery and tried an empty bootstrap on reload after consuming the fragment. The exact cause of the early transport close is not established by these status/timing facts.
- Implemented GCP-only 1,800-second interactive allocations, separate from unchanged 180-second collections and 600-second legacy logins. Entry links remain one-use and limited to 600 seconds. Cookie-only, exact-Origin resume checks both the durable fence and current unexpired grant after all awaits, cannot rotate/renew credentials or extend expiry, and permits reload without fragment. Added a monotonic countdown, a single five-attempt automatic recovery budget/manual retry, old-socket/image guards, no input replay, and local input interception before auth/while offline. The one-click expired-GCP recovery retains early missing-session references instead of reclaiming a possibly active durable lease. The legacy sync wait remains unchanged.
- Independent read-only architecture review identified a revoke-during-fence race in the new helper and the previous pre-auth editable canvas. Both are addressed with regression cases. All 110 focused worker/browser tests and typecheck passed. Four of the first five frontend journeys passed; the remaining test incorrectly expected exactly one retry during a nine-second fake-clock advance (three backoffs legitimately fit). Corrected that test oracle without changing the product retry limit; final frontend results follow. Actual 30-minute-cap runtime/held-stream checks and production rollout remain pending.

Deviations: in response to the user's short-window feedback, the GCP interactive allocation is increased from ten to thirty minutes; it remains fixed and cannot be prolonged by resume. The worker request timeout must exceed this allocation before rollout. No increase to source-read limits, source permissions, browser capacity or Meta/model spending. Full thirty-minute wall-clock durability and instance-termination recovery are not inferred from synthetic expiry tests or a short held-stream gate.

P064 local verification checkpoint: all five focused frontend journeys passed after the test-oracle correction, including real browser reload without fragment, transient close/recovery without offline input replay, monotonic countdown under wall-clock change, hard expiry, auth failure and five-attempt exhaustion/manual retry. Typecheck and 110 focused server/browser tests passed. Added an expired-GCP case with a future legacy readyAt to verify it is removed rather than carrying over the old wait; the focused lifecycle rerun passed. No real credentials or model calls were used. Next deploy the owned worker with the longer request ceiling, run the actual synthetic cookie-resume/held-stream gate, then activate the clean app artifact and reopen Gradescope.

### P064 production verification and human handoff

October 28, 2026. Worker revision `soma-browser-00004-k8g` serves 100% of traffic with a verified 2,100-second request timeout. The actual synthetic runtime gate passed in 150.03 seconds: a 1,800-second allocation, unchanged expiry through cookie-only resume, a 135-second uninterrupted stream, unauthorized control/CDP rejection, synthetic viewer input, encrypted cookie/localStorage/IndexedDB restoration, metadata denial, revocation and context deletion. Zero model calls or real-course content. This is a bounded held-stream check, not a thirty-minute wall-clock endurance claim.

Clean committed archive `67b0281` was deployed and, after the hosted gate passed, promoted as `dpl_4fw2RTf8A1iRC2Vd84bzn9CpQPVU`, retaining the Soma production domain. [CI 40728192801](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40728192801) passed 1,012 tests / 54 opt-in skips, all 42 browser journeys, typecheck, production build and isolated browser-artifact verification. Concurrent lesson-orchestration work was excluded from commit/deployment.

A fresh production app load replaced the expired Gradescope allocation in one reconnect action. The app displayed a thirty-minute end time and the protected viewer visibly connected with its countdown near 29:30. The empty provider login form is open for human sign-in/MFA; no credentials were entered by the agent. An exact-text automation wait for “Connected” timed out because the actual full sentence was longer; direct AX/screenshot verification confirmed successful connection without another allocation. The proof image remains ignored locally, and both tabs are retained for handoff. Save with “I’ve finished signing in” before expiry; then verify selected source access separately. Blackboard remains saved/catalog-verified, Piazza and Google setup remain open.

## P065 — Verify completed institutional sign-in (October 28, 2026)

Prompt: canonical verbatim archive entry `P065`.

Top three outcomes:
1. Refreshed the private app state and resumed its already-active Gradescope allocation without extending the deadline. Saved the completed human sign-in through the normal owned application path; the UI confirmed Browser saved. No credentials were entered or archived by the agent.
2. Ran the selected Gradescope metadata refresh using restored GCP authorization. At October 28, 1:27:36 PM America/New_York, the UI recorded two verified selected pages, zero changed sources and one unverified page retained as stale. This is partial actual read verification, not full source coverage or returned-work extraction. One source-investigation job was saved/already queued under existing authorization/budget; some preparation jobs could not queue. No model call was directly invoked or budget changed; worker completion is unverified.
3. Started Piazza reconnect through its recorded legacy cleanup/GCP migration path and verified the new protected viewer connected at the Piazza origin with approximately 29 minutes remaining. Opened its login control for human handoff. No Piazza source read/publication is established, and no course selection was invented. Both tabs retained; screenshot proof stays ignored locally.

Deviations: no scope or budget expansion. One Gradescope page remains unverified and some preparation queuing is incomplete; retain those as open follow-up work. This operational verification changed no application code, so the previous CI was not redundantly rerun. Two short UI automation waits expired while work continued; current status was inspected rather than repeating the requests.

## P066 — Save completed Piazza sign-in (October 28, 2026)

Prompt: canonical verbatim archive entry `P066`.

Top three outcomes:
1. Completed the normal owned Piazza save action before the active login deadline. The production UI confirms connected and Browser saved; the agent entered no credentials and recorded no session material.
2. The current connection has no saved class targets. Requested the current-semester class name and canonical overview URL, or equivalent selection in Soma, before collection. Course reading and the structured preview/publication gate remain unverified; saved sign-in alone is not read evidence.
3. Preserved Blackboard and Gradescope authorization/scopes, the stale third Gradescope page, existing budget and concurrent implementation. No new collection, inference, permission change or application code was introduced; prior CI was not redundantly rerun. Local screenshot proof is ignored.

Deviations: no scope change. Piazza collection awaits an explicit class target; its current UI uses exact-page selection rather than an implemented automatic class picker.

## P067 — Select CS440 and EC463 on Piazza (October 28, 2026)

Prompt: canonical verbatim clarification `P067`.

Top three outcomes:
1. Verified the actual Piazza catalog using the saved GCP authorization: CS440 and combined EC463–464 are Fall 2026, while the Spring class remains unselected. The first metadata probe failed its exact-code matching assumption on the combined label; a second metadata-only inspection verified its actual identity. Saved exactly those two requested class URLs through the production UI, mapped to existing owned CS440 and EC463 courses. No posts/feed text were read during catalog discovery.
2. Both opt-in typed access probes passed: CS440 ten instructor-note previews in 11.01 seconds and EC463 eight in 9.09 seconds, no model calls or publication in those probes. Two normal production refreshes then committed one source each at 2:53:14 PM / 2:53:47 PM America/New_York. An independent private readback passed in 2.72 seconds: two current version-1 records, exact owned mappings, partial-preview labels and only permitted preview row fields. No source bodies, class IDs, secrets or session material entered public documentation/fixtures.
3. Updated the Piazza support/migration records with actual proof and preserved the boundaries: no full posts, replies, private/section content, graded items or attachments. Production reported some preparation jobs could not queue; saved-source verification does not establish downstream lessons or model completion. Budgets, permissions and concurrent code remain unchanged. No application/deployment changes or redundant broad CI; private temporary probe scripts removed and screenshot proof stays ignored.

Deviations: no product-scope expansion. The combined provider label is mapped to EC463 as requested. Initial discovery matching assumption was corrected using observed metadata. Downstream preparation queuing remains an open issue; the model cap was not raised.

## P068 — Verify course-material reading through useful preparation (October 28, 2026)

Prompt: canonical verbatim entry `P068`, trailing space preserved.

Top three outcomes:
1. Diagnosed owned source status and stale queue capacity; repaired transactional stale-job recovery and typed source-to-preparation handoffs in `3121cf7`, preserving ownership, source revision, lease fencing and the five-job cap.
2. Added bounded initial ordinary practice in `d686d96`. Actual Spark use of an existing private manual CS440 note import produced one independently reviewed, privately published practice question and reuse without another inference call. A failed attempt is retained; this is not fresh LMS teaching access or a generated interactive lab.
3. Independent review and clean local/CI verification passed: 1,036 tests / 55 opt-in skips, typecheck, build, isolated browser runtime and 42 journeys. Clean `d686d96` was promoted to production. New Blackboard collection still needs human reauthentication; unsupported files/slides and one stale Gradescope overview remain open.

Deviations: actual instructional-source verification used the explicitly labeled existing manual import while BU authentication remained blocked. P070 authorized a bounded increase to $3 for local testing; production retains $2. No source permission expansion or fabricated learner response.

### P068 source/queue diagnosis checkpoint

Owner-scoped, read-only preflight passed in 4.08 seconds. Actual retained data: 36 current Blackboard text observations, two current and one stale Gradescope assignment overviews, two current Piazza preview records, one earlier manually imported teaching note, one earlier private practice and one saved keep-current investigation. These are different kinds of evidence: announcements and assignment dates do not establish lecture/slides/returned-work reading. The earlier ready investigation made six actual source-tool calls and saved a decision, but did not produce a lesson.

Five jobs are queued, one with obsolete source references. The exact production handoff warning is explained by the five-slot admission cap; the oldest current job is paused by the existing application allowance and can delay retiring later stale work. Read-only budget facts: application cap $2, consumed $1.85152875, remaining $0.14847125, below the $0.20 lesson and $0.35 investigation reservations. No new inference was attempted or cap/ledger reset. A fresh Blackboard text refresh then failed authorization; the deployed protected BU login window was opened for human MFA while independent work continues.

Two implementation fixes are under review: transactional stale-job cleanup/selection with source revision and lease fencing, and typed sanitized source-to-preparation handoff facts that distinguish queued work, completed decisions, capacity and changed sources. Original synthetic managed-Firestore queue cases preserve the five-job cap and confirm no model budget or source content mutation. A separate bounded initial ordinary-practice tool is being added to prevent a missing learning activity from being concealed by a saved keep-current decision; actual model use is a later gate.

P068 queue milestone audit: independent review confirmed ownership/generation checks, atomic stale retirement and five-slot admission. It identified an expired-token resurrection risk, fixed by clearing leaseId/leaseUntil in both stale paths. The managed original-synthetic Firestore test passed in 9.19 seconds, including stale-first dispatch, rollback, old-snapshot rejection, active lease retention, unchanged source/budget and disposable cleanup. A first sandbox attempt failed DNS before creating a fixture; the network-authorized run passed. The final clean staged artifact excludes all pre-existing orchestration changes and passed typecheck plus 34 focused queue/handoff/worker/job tests. No real-account writes, source collection or model calls were made by these tests.

## P069 — Reopen BU sign-in (October 28, 2026)

Prompt: canonical verbatim clarification `P069`.

Top three outcomes:
1. Reopened the active BU allocation using the normal owned reconnect flow and a fresh one-use viewer link. The protected window visibly connected with approximately thirteen minutes remaining; its original deadline was preserved.
2. Kept the new viewer and Soma tabs for human login/MFA; no credentials were entered or read by the agent. Fresh material read remains pending.
3. Preserved selected courses, state isolation and handoff. Screenshot proof captures the viewer header only to avoid sensitive provider inputs. No code, budget or permission change for this routine reopen.

Deviations: none; routine reauthentication recovery.

## P070 — Authorize bounded $3 model-testing cap (October 28, 2026)

Prompt: canonical verbatim clarification `P070`.

Top three outcomes:
1. Jeremy explicitly approved an additional $1 for the concrete course-source activity/reuse/follow-up test, raising the total application cap from $2 to $3.
2. Updated the ignored local testing configuration to $3 while preserving the global ledger, per-job/daily limits and twenty-percent reserve of the $150 allocation. Production remains at $2; activation is a separate pending action.
3. Executed two bounded actual Spark investigations on the existing private manual course-note import: $0.041556 failed and $0.0433185 passed, combined $0.0848745. Independent review, private audited publication and reuse passed; no learner response or adaptive follow-up was fabricated.

Deviations: approved testing-cap increase, replacing P068’s previous $2 gate; no change to the Meta allocation or unbounded inference authority.


### P068 initial ordinary-practice milestone

Implemented a source-grounded ordinary-practice branch for initial investigations, replacing the inapplicable response-revision tool slot so the eight-tool bound stays intact. It reuses the existing text-practice validator, only actually disclosed offset-zero segments, fresh-question checks and normal final-decision/publication fencing. It never invents learner hypotheses or writes understanding evidence. Optional reviewer work remains excluded from this change/deployment; the shared working copy retains that separate in-progress integration. Engine v9 invalidates old cached decisions for the new tool contract.

Thirteen new scripted-provider cases passed, including read-to-practice-to-finish publication, unread/later-page/forged/foreign quotes, stale source rejection, unoffered tool calls, protected rejected candidates and administrative keep-current. Independent review found no blocking P0/P1 issue. The isolated clean artifact passed typecheck and the full suite: 1,036 tests, 55 opt-in skips. Initial harness runs failed due to missing separate browser-runner dependencies and sandboxed loopback access; one dependency-link correction was needed, with no application changes. The successful rerun used the pinned installed dependency directory and permitted original-synthetic loopback tests; no live models/providers were enabled. A clean production build initially rejected an external node_modules symlink; rerun with a real pinned dependency directory passed, followed by isolated runtime verification and 42 browser journeys. Actual source-use results and the separate fresh-Blackboard boundary are recorded below.

### P068 actual source-use and production checkpoint

Commits `3121cf7` and `d686d96` are pushed to main. [CI run 40755876352](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40755876352) passed on `d686d96`; clean production source deployment `dpl_AT1bCuyocd67SXL2YCCES8CoKXah` was promoted to the existing Soma alias. Optional concurrent author/challenger work was excluded from the commit, build and deployment. No production budget increase was applied.

Two actual Spark attempts used the existing private manually imported CS440 teaching note, never relabeled as a fresh Blackboard read. Attempt one made four calls in 18.510 seconds at $0.041556: one exact-quote repair succeeded, but final decision validation failed after the repair allowance was spent. It published no lesson and retained the protected failure/cost record. The local failure harness did not retain the second validation detail, so no specific second cause is invented. Attempt two made four calls in 17.576 seconds at $0.0433185, repaired one exact quote, and produced a valid fresh ordinary-practice candidate. Independent source/algebra/citation review approved it before normal audited private publication. Full second-check wall time was 64.78 seconds including deliberate review; model latency was 17.576 seconds. Reopen reused the saved activity without inference, and original learner attempts stayed unchanged. Combined new cost: $0.0848745.

This demonstrates a reviewed source-grounded text question, not a generated interactive lab or measured learning benefit. No real learner response was invented to exercise adaptation. The new Blackboard material read still failed authorization; affected observations are withheld/stale. P071 opened a fresh human login attempt. Gradescope's remaining stale overview, full Piazza posts, teaching files/PDFs/slides and returned-work reading remain explicit gaps. See [Course source validation](COURSE_SOURCE_VALIDATION.md).

## P071 — Renew stale BU request and assess credential autofill (October 28, 2026)

Prompt: canonical verbatim entry `P071`, including trailing space.

Top three outcomes:
1. Ended the stale interactive attempt through the normal owned lifecycle, requested a fresh allocation, and visibly verified a connected BU identity-provider page with approximately 26 minutes remaining. Captured viewer-header-only proof and handed the window back for human password/MFA entry. Neither successful sign-in nor the precise stale-request cause is asserted.
2. Wrote `docs/CREDENTIAL_AUTOFILL_PROPOSAL.md`: explicit opt-in, separately privileged encrypted vault/login service, one-use owner/session/destination grants, human MFA and tested deletion/rotation. Independent review identified current general CDP control and broad HTTPS egress as blockers to the proposed isolation guarantees. No vault, institutional password, KMS key or IAM change was created.
3. Completed and documented P068's actual model source-use test, protected failure audit, correctness review, private publication and inference-free reuse. Full fresh LMS teaching-content reading and response-adaptive real-course follow-up remain pending rather than being inferred from the fallback success.

Deviations: credential autofill remains a proposed design, not a deployed feature or authority to store an unprovided password. Fresh login replaces the stale request; ordinary viewer reconnect alone cannot renew a stale SSO form.

## P072 — Implement isolated optional credential autofill (October 28, 2026)

Prompt: canonical verbatim entry `P072`.

Top three outcomes:
1. Implemented KMS-wrapped per-version vault encryption, private generation-pinned storage, consent, ownership/origin/version checks, deletion fencing and controlled rotation. No institutional password was accessed or stored; cloud storage/key/IAM deployment remains unverified.
2. Implemented a separate deterministic login service with no generic CDP/model API, transient protected entry, safe-state export, durable replay prevention and opt-in/forget/cancel controls. Human MFA and normal read-only collection remain separate. Initially supports the narrow BU Blackboard form contract; unfamiliar forms/MFA hosts fail closed.
3. Independent audits and release checks passed: 1,120 default tests / 74 opt-in skips, eighteen actual Chromium hostile-page cases, managed account/grant/secret-input rejection, 48 app journeys, typecheck, production build, isolated runtime mapping and a locally built pinned worker image. Code is pushed to main; infrastructure activation is explicitly blocked by automatic approval review pending the exact rollout approval.

Deviations: private GCS CAS vault storage replaces the proposed source-database-adjacent collection to avoid Firebase privileges in the login service. Full checks exposed a pre-existing processing-clock defect, fixed separately with a regression. Production activation and actual BU enrollment/autofill are pending rather than inferred from synthetic evidence; no unreviewed cloud workaround or password fallback was introduced.

### P072 V1 encrypted-vault checkpoint

Implemented separate AES-256-GCM per-version data keys with KMS wrapping, authenticated owner/workspace-generation/provider/origin/version bindings and generation-pinned GCS CAS. Private identifier/password payloads are ciphertext only; safe metadata and tombstones preserve update/deletion/rotation fences. No env-key fallback. Thirty-four synthetic vault/adapter cases passed; combined vault, broker boundary, existing account and hosting regression checks passed 59 tests, with typecheck passing. Independent worker-agent review found no blocking crypto issue and confirmed owner tags change with the workspace generation. No cloud resource, institutional password or real autofill was used. Login-worker and deployment review remain open.

### P072 V2 isolated-login milestone

Implemented a separate login-only service with no general CDP/navigation/model API, a private KMS-backed vault, durable create-only grant consumption, owner/session/generation callbacks and an explicit opt-in enrollment page. The ordinary app never receives institutional passwords. Shared GCS session fences prevent overlapping collection. Credential submission bypasses provider JavaScript handlers, rejects unsafe repost/redirect/reflection cases and permits a viewer only after secret-entry checks. Export requires a positive Blackboard identity read and transfers secure HttpOnly Blackboard cookies only. Cancel revokes before remote cleanup; Forget, combined Disconnect and frozen-account cleanup preserve references on failure, including after the new-setup flag is disabled.

Independent review identified and fixed redirect reposting, response reflection, raw canary arguments entering provider JavaScript, duplicate human/app completion and snapshot-leakage gaps. Thirty-four vault cases, fourteen HTTP/proxy cases and seventeen actual Chromium adversarial cases passed (65 worker cases total); nine broker-boundary and thirteen lifecycle cases passed, plus six synthetic UI journeys. Managed Firestore authorization fencing passed in 9.86 seconds with a disposable original synthetic Auth account and complete cleanup; the first network-sandbox attempt failed DNS before fixture creation. An initial browser fixture followed an empty synthetic query redirect to BU before it was changed to a strictly local HTTPS/CONNECT fixture; no credential or private course content was sent. Current browser fixtures make no external requests. Full exact-artifact checks remain next.

Automatic approval review rejected Cloud KMS enablement as a persistent service/cost change not expressly authorized by the implementation request. The following service-identity creation never executed. No new KMS, vault bucket, identity, public service, institutional password or IAM grant was created. Complete software verification and prepare a concrete rollout before requesting the exact cloud approval; do not bypass the rejection.

### P072 protected audits, rotation and complete app verification

Added a required protected audit sink with a fixed schema and create-only GCS event paths. It records consent, credential/fill outcomes, grant issue/use/denial/replay, publication intent/result, revocation, forgetting and controlled key rewrapping; no password, identifier, URL, page observation or raw provider error is accepted. Missing/failed audit writes block filling or return an error after a possible mutation, retaining cleanup references rather than claiming success. Operator rotation closes matching sessions, fences maintenance and relies on vault version/CAS checks. Independent review prompted prepublication intent and grant events. The final credential suite passed 75 cases, including seventeen actual Chromium hostile-page cases; typecheck passed. IAM-enforced create-only grants/audit prefixes remain a deployment gate, distinct from application create-only writes.

Managed authorization plus authenticated password-field rejection passed in 10.07 seconds with a disposable original synthetic identity; cleanup completed. The first full clean run found a pre-existing processing-clock defect (one failed / 1,106 passed / 73 skips). A separately committed correction and years-ahead clock regression passed 26 focused cases; the corrected full clean app suite passed 1,108 tests / 73 opt-in skips before the final worker-audit additions. Production build, isolated runtime import (zero private configuration mappings) and all 48 browser journeys passed on `c20b2fb`; CI run 40765693752 also passed. The earlier `cf0834c` CI failure corresponds to the retained clock failure. Final worker-audit code is being verified in the exact clean artifact next.

### P072 final exact-artifact verification

Final audited code `a31205e` is pushed to main. A clean tracked-source tree, with no local dotenv or private files, passed typecheck, production build, the isolated browser package import (zero private configuration mappings), and 1,118 default tests / 73 opt-in skips. Seventeen actual Chromium security cases passed separately against local HTTPS fixtures; all 48 app journeys passed after the clock repair, with no later app/UI changes. The final service-only linux/amd64 Docker image built successfully from clean tracked context, loaded all required modules and refused disabled startup with networking off and no credentials. This is packaging/startup-gate evidence, not a deployed browser/KMS or actual BU login result. Worker dependencies installed from their pinned lock with zero reported npm audit vulnerabilities.

Production app/browser infrastructure and Meta spend limits were not changed by this feature. The cloud rollout and actual IAM denial/append-only checks remain blocked until the explicit KMS/private-vault/dedicated-service approval in `docs/CREDENTIAL_AUTOFILL_DEPLOYMENT.md`. Actual user password entry, provider/MFA compatibility and subsequent selected-course material read remain later human/hosted gates. Existing manual provider sign-in remains available. [Independent CI run 40767132141](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40767132141) passed on the final audited code, including the actual Chromium adversarial stage and all app journeys.

### P072 final cancellation and clean-start review

Final review found a delayed audit write could outlive authorization before credential storage or browser-state publication. Added fresh owner/grant/context/expiry checks after those audit awaits and paused-audit revocation regressions; neither credential save nor state commit occurs after the tested revocation. Enrollment now starts an empty isolated browser rather than importing saved cookies, ensuring a fresh SSO request while cancellation preserves the previous encrypted context.

Code `02129d8` is pushed. The exact clean committed tree passed 1,120 default tests / 74 opt-in skips and all 78 credential cases, including eighteen actual Chromium local hostile-page tests. The first default attempt lacked sandbox loopback-listener permission (40 EPERM failures); rerunning with that specific permission passed without code changes or real-provider/model access. The final linux/amd64 service image rebuilt and loaded all required modules, correctly refusing disabled startup with networking off and no credentials. Typecheck passed; the prior audited app build and 48 journeys remain valid because this final patch changes only the separate login service and its tests. [Independent CI for this exact implementation commit](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40769098221) passed, including typecheck, full tests, production build, isolated runtime mapping, all eighteen Chromium adversarial cases and all 48 app journeys. Cloud and actual-provider gates remain pending.


## P073 — Approved isolated GCP credential rollout (October 28, 2026)

Prompt: canonical verbatim clarification `P073`.

Top three outcomes:
1. Executed the expressly approved KMS API/key (ninety-day rotation), dedicated private bucket, login-only identity, resource/prefix-limited policies, KMS data-access auditing and distinct Secret Manager broker/callback keys. Deployed the separate max-one-instance service, first private and then with the approved protected internet entry; final revision `soma-credential-login-00002-jx8` uses image code `fbc46bd`. App configuration was deployed from clean `0247aa9` source with autofill disabled; unrelated orchestration changes were excluded. No institutional password was stored or filled.
2. Private-service IAM rejection/authenticated health passed; all eleven hosted negative broker/viewer/CDP/callback checks passed on both the initial and final revisions. An empty official BU form matched the strict contract after its federated transition. Fixed the transition timing race with a bounded wait and actual Chromium regression: 86 focused credential cases (nineteen actual Chromium cases), seven cloud-probe offline cases and four script-contract checks passed. The clean default suite passed 1,127 tests / 75 opt-in skips. [Independent CI 40786154537](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40786154537) passed on `fbc46bd`, including nineteen Chromium security cases, typecheck, build and all 48 app journeys. Root repeated the actual empty BU form review on the final code: reviewed true, credentials entered false.
3. Kept activation disabled because actual identity-denial/append-only/lifecycle verification remains open. Automatic approval review rejected temporary Token Creator grants on the login/browser/app identities and a proposed persistent project-level Storage Admin grant for vault metadata administration. No rejected grant or substitute impersonation path executed. A narrower explicit verification/recovery approval is documented before requesting real password/MFA entry.

Deviations: replacing inherited bucket ACL roles with the narrow vault policy also removed the project owner's bucket metadata access; a real describe request returned 403. Effective runtime separation and bucket privacy/retention rereads are not asserted from policy text alone. The next approval proposes limited bucket metadata/IAM administration, thirty-minute identity impersonation and temporary synthetic-object cleanup permissions, with explicit expiry/removal. No institutional credentials, coursework, extra model spend or source scope expansion occurred. The disabled callback's rejection is a negative-boundary check, not positive account-lookup or lifecycle proof.


## P074 — Scoped cloud verification and bucket recovery approved (October 28, 2026)

Prompt: canonical verbatim clarification `P074`.

Top three outcomes:
1. Applied the approved persistent custom metadata/IAM role to the exact vault-bucket resource, with only get/getIamPolicy/setIamPolicy/update. Verified uniform access true, public-access prevention enforced and zero soft-delete retention. Applied thirty-minute synthetic-verification grants: access-token-only custom role on exactly three service accounts plus owner object cleanup. The first immediate token request failed propagation; its finally cleanup passed. A bounded retry passed all 27 actual KMS/GCS tests, including envelope encryption, generation-CAS, per-record rewrap/forget, app/browser vault/decrypt denials and audit/grant append-only denials. Synthetic object cleanup retained zero objects.
2. Independently confirmed all three temporary account bindings and the temporary objectAdmin binding were absent, the verification role marked deleted, and private token/config files removed. Hosted positive lifecycle passed in 22.90 seconds using a disposable fictional account and normal public APIs: callback/allocation, one-use protected entry, replay rejection, Firebase revocation, cancellation, forgetting and workspace deletion. Independent Auth/Firestore reads confirmed fixture removal. No institutional password, MFA response or course content was used.
3. Added and independently reviewed an optional exact-UID server rollout gate; malformed lists deny setup and excluded users retain cleanup. First deployed for the fictional UID only, then deployed owner-only opt-in after checks. Existing owner must freshly authenticate and explicitly choose setup/consent; page loads cannot store/fill a password. Full CI on `1ecc139` passed: 1,132 default tests / 76 opt-in skips, nineteen actual Chromium cases, typecheck/build, four script-contract checks and all 48 app journeys. Code and hosted fixture commits are `e6b5281` and `1ecc139`; owner deployment uses clean `1ecc139` source.

Deviations: a server-only rollout allowlist was added to prove positive hosted behavior before enabling the actual owner. The first owner-availability deployment was rejected by automatic approval review. Read-only checks established that page load only reads status, setup requires fresh verified owner action, and password storage requires a separate human consent submission. Re-review then accepted the same deployment with P073's exact approved wording (synthetic checks before enabling opt-in autofill) and those side-effect checks; no alternate execution path bypassed the rejection. First real BU password/MFA, authenticated safe-state export and selected-course readback remain human/provider gates. Actual record rewrap was tested; KMS-primary-version rollover and every provider encoding/MFA destination are not implied. No Meta inference or budget change occurred.

## P075 — Evaluate framing against anti-project traps (October 28, 2026)

Prompt: canonical verbatim entry `P075`.

Top three outcomes:
1. After automated credential verification and the owner-only rollout, obtained independent positioning, skeptical-judge and demo proposals from `framing_positioning`, `framing_skeptic` and `framing_demo`. All used repository product/event/evidence records; no live-provider inference or cloud changes were made for framing.
2. Evaluated three frames against actual proof and the supplied anti-project examples. Recommended study-preparation agent as the product category and competing explanations → checked experiment → revised next activity as the decisive demo. The generated-lab-composer headline remains conditional on actual meaningful composition evidence.
3. Recorded a proposed pitch, comparison, three-minute sequence and minimum integrated proof in `docs/DEMO_AND_EVALUATION.md`. Distinguished synthetic Spark adaptation, persistent evidence and one imported real-course practice artifact rather than splicing them into a claimed end-to-end real-course lab. No learning-gain or eligibility guarantee, new model family, UI rebrand or product-scope change was made.

Deviations: this is a framing recommendation and evidence requirement, not acceptance of an expanded implementation plan or a claim that wording resolves unfinished capability.


## P076 — Duplicate verification approval (October 28, 2026)

Prompt: canonical verbatim clarification `P076`, duplicate of `P074` for the same approval question.

Top three outcomes:
1. Recognized the repeated approval as confirmation of the completed P074 scope, rather than a request to repeat temporary privilege grants or verification resources.
2. Cross-referenced P074's recorded 27 actual cloud checks, hosted disposable-account test, cleanup and owner-only deployment; no new infrastructure action or test result is asserted.
3. Preserved the remaining human/provider gate: first actual BU password/MFA, safe-state handoff and selected-course readback. No new credential access or scope expansion occurred.

Deviations: none; duplicate approval does not renew or recreate removed verification privileges.


## P077 — Open Soma for owner sign-in (October 28, 2026)

Prompt: canonical verbatim entry `P077`.

Top three outcomes:
1. Opened the production Soma page visibly in the in-app browser and retained it as the user-facing deliverable; the initial app-panel open request only queued, so browser navigation was verified separately.
2. Opened and visibly verified the Welcome back / Sign in form for the user to enter their own credentials. No password, MFA response or account session was read or submitted by the agent.
3. Handed control back for fresh Soma sign-in before optional Blackboard setup. Actual institutional login, safe-state export and course readback remain pending.

Deviations: none; navigation and form opening create no new cloud permission or stored institutional credential.


## P078 — Fix Blackboard secure setup and verify collection coverage (October 28, 2026)

Prompt: canonical verbatim entry `P078`.

Top three outcomes:
1. Traced the actual owner failure to an expired manual Blackboard reference whose owned runner returned 404. Implemented lease-checkpointed recovery in `2999f8b`, preserving context and course selections. Active, foreign, uncertain and malformed-response cases retain references. Independent review caught and resolved a falsy-200/404 ambiguity. Added fixed, actionable client errors, retained-session cleanup controls, keyboard focus and honest Blackboard collection limits using UI UX Pro Max error-recovery guidance.
2. Inspected account-scoped collection metadata without exposing private bodies or session material: 36 Blackboard text observations (16 stale), three Piazza preview observations (one stale), three Gradescope overview observations (one stale), plus the existing manual import. Documented the already implemented Chromium-to-Firestore bridge, bounded Spark disclosure and remaining file/full-post/returned-work readers in `docs/COURSE_SOURCE_VALIDATION.md`. Gmail/Calendar have no saved account connections; some preparation remains budget-blocked. No new Meta call or institutional-password operation occurred.
3. Pushed the fix to main and deployed the clean committed source. The actual hosted fictional-account regression passed in 27.50 seconds, including expired-reference recovery through the public API, unchanged context/configuration, callback/one-use entry, revocation and normal cancellation/deletion. Independently confirmed fictional Auth and workspace-root absence, removed its rollout UID and redeployed owner-only. [Exact-commit CI](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40810884200) passed typecheck, 1,147 tests / 76 opt-in skips, four diagnostic contracts, production build/runtime trace, 19 adversarial Chromium cases and 51 browser journeys. Visibly reloaded production and verified the new Blackboard coverage text and setup controls. Actual BU entry/MFA, safe-state export and a fresh instructional-page read remain pending.

Deviations: an initial deployment was accidentally started from the working checkout; removed that deployment and replaced it with the clean committed release, excluding concurrent optional edits and private environment files. Final production uses `2999f8b` with the prior owner-only rollout restored. No scope expansion or full-course/model-use success is inferred from saved browser access.


## P079 — Plan automatic selected-course PDF collection (October 28, 2026)

Prompt: canonical verbatim entry `P079`.

Top three outcomes:
1. Inspected the current bounded Blackboard content traversal and exact JSON read allowlist. File handlers are explicitly skipped; attachment metadata/download endpoints, binary storage and page extraction are not implemented. No code, authorization state or provider data was changed.
2. Verified Anthology's attachment-discovery documentation: recursive folder/document discovery, Ultra embedded attachment links, Original attachment listing and download redirects. The documentation's app-token example does not prove these routes work through this BU student session; an actual owned attachment download is the first gate. Source: https://docs.blackboard.com/docs/blackboard/rest-apis/demo-code/curl-attach-demo.
3. Proposed a resumable inventory → validated scoped download → private object storage → page-aware text/OCR extraction → versioned source-disclosure pipeline, with per-file status, bounded retries, deduplication and changed-file checks. Recommend proving one instructional PDF before crawling the selected semester. Extraction, image interpretation and useful cited activity remain separate checks; complete collection is not claimed.

Deviations: none. This turn answers the collection-design question; no collector, cloud service, inference, full-semester read or new privacy permission is asserted as implemented.
