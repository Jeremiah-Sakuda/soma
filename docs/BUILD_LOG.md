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

## PM009 — Evaluate fine-tuning alongside the evidence graph

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM009`.

**Top 3 outcomes:**

1. Distinguished explicit, versioned course/learner relationships from a transformer's input-dependent attention and learned parameters. The graph remains changing student memory; ordinary model inference does not train new weights, and fine-tuning is not a replacement for source-grounded records.
2. Proposed a conditional specialist-training experiment for interpreting evidence and choosing a discriminating diagnostic, using the same retrieved graph context. Compare the prompted base model, tuned version and existing Spark path on independently reviewed held-out cases. Measure unsupported conclusions, contradictions, citation support and diagnostic usefulness, plus latency/cost; schema success alone cannot establish educational quality. No training dataset or measured improvement was claimed.
3. Verified current official training routes: Glimmer supports LoRA/QLoRA with a documented single-H100 QLoRA recipe; Spark Open has hosted training, but the documented Fireworks private-adapter serving route requires dedicated deployment. Actual access, training/serving cost and suitability remain unverified. Recommended protecting the existing feature freeze and adopting training only for a demonstrated, measurable failure pattern.

**Plan deviations:** None adopted. No training, model call, provider account, GPU provisioning, dataset export, private-data transfer, product code or scope change occurred. The current graph/storage design and authorized implementation continue unchanged.

**Sources:** [Transformer paper](https://arxiv.org/html/1706.03762v7), [Glimmer post-training](https://dev.meta.ai/docs/muse-glimmer/post-training), [Spark Open post-training](https://dev.meta.ai/docs/muse-spark-open/post-training). Prior audit documents were read as dated evidence, not as a fresh completeness audit.

## PM010 — Define the Muse specialization opportunity

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM010`, including trailing whitespace.

**Top 3 outcomes:**

1. Connected the user's proposed Meta centerpiece to the already selected returned-work hero: competing interpretations, an informative diagnostic, contrary evidence and a useful changed activity. The specialized task targets instructional judgment rather than JSON formatting or deterministic prediction matching.
2. Created [learning evidence specialization proposal](LEARNING_SPECIALIST_PROPOSAL.md) with the task boundary, data/review needs, base-versus-tuned-versus-existing-Spark comparison, demonstration, deployment considerations and conditional adoption criteria. The graph stays explicit memory; student facts are not automatically trained into model weights.
3. Preserved the authoritative PRD/build plan, existing runtime and concurrent work. No provider selected, dataset generated/exported, training launched, infrastructure purchased, model called or product code changed. This is a concrete proposed experiment, not a newly required tuned-model release gate.

**Plan deviations:** None adopted. Any training/serving implementation would need its actual provider, data, cost and fit resolved; preserve the October 31 freeze and existing scope. No new outcome or tuning advantage is claimed. Document consistency and whitespace checks are recorded after review.

PM010 documentation verification: the proposal was read back and checked for task/evaluation/deployment boundaries, explicit-memory preservation and existing deadlines. Whitespace checks and exact prompt-archive verification passed. No application tests were run for this advisory document.

## PM011 — Brainstorm an ambitious learning graph

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM011`, including trailing whitespace.

**Top 3 outcomes:**

1. Respected the user's request to remain in brainstorming. Explored a graph of testable reasoning hypotheses, interactive comparisons between hypothesis predictions and checked behavior, cross-course transfer, and editable links that open evidence or generate a targeted interaction. These are proposed experiences, not implemented capabilities or approved scope.
2. Checked primary sources for novelty context: RPKT already explores LLM-driven prerequisite discovery; Google Research describes generated educational interactives with iterative checking; FoundationalASSIST reports limitations in tested models' student prediction and item discrimination. No first-ever, judge-unseen, uniquely-Meta or demonstrated learning-gain claim is established.
3. Recommended exploring the combined experience in which Soma identifies an ambiguous relationship, generates an informative experiment, revises its model after the learner responds, and checks transfer in a different context. Model specialization is a possible enabler of that experience, not the experience itself. Recent multimodal and generative-interface capabilities make broader contextual authoring plausible; causal diagnosis and reliable generalization still require evidence.

**Plan deviations:** None adopted. No new proposal document, PRD change, training, model call, source export, implementation, spend or deployment. Existing implementation continues under its own instructions; this brainstorming does not add a model family or graph interface to P0.

**Sources:** [RPKT](https://arxiv.org/abs/2508.11892), [Google learning interactives](https://research.google/blog/the-future-of-practice-enabling-teachers-to-create-learning-interactives-with-generative-ui/), [FoundationalASSIST](https://arxiv.org/abs/2602.00070).

## PM012 — Scope the ambitious learning graph

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM012`, including trailing whitespace.

**Top 3 outcomes:**

1. Created [Learning Graph Scope](LEARNING_GRAPH_SCOPE.md) with the student experience, records and model authority, acceptance dimensions, dated delivery, demo and conditional stretches. The flagship combines competing explanations, a checked interactive experiment, evidence-based revision and a fresh application within the approved family.
2. Reconciled the PRD, handoff, build plan, technical plan, selected UI direction, demo/evaluation and specialist proposal. Local relationship inspection stays in the existing lesson surface. Cross-course transfer and fine-tuning remain conditional stretches, with no claim of implementation, tuning advantage or learning improvement.
3. Recorded the scope decision and preserved concurrent implementation work. Verification is documentation-only; no application code, model call, training, deployment, provider purchase or cap change occurred. Documentation checks are recorded below after execution.

**Plan deviations:** A deliberate bounded scope refinement replaces the general graph-view deferral with required local concept/evidence inspection, while retaining the semester-wide canvas deferral. R11 now explicitly requires a newly prepared meaningful follow-up after contrary evidence and an unchanged/uncertain branch. Existing numerical/source/evaluation gates, one-family restriction, budget limits and October 31 freeze remain. The full loop and actual-course fit still require implementation evidence.

PM012 documentation verification: local Markdown links across the eight scoped/handoff documents resolved; whitespace checks passed, including the new scope file; canonical archive verification confirmed the exact prompt and null received timestamp. Reviewed preservation of the approved-family/source-fit boundary, operating budgets, existing release gates and October 31/November 4 dates. No application tests were run for documentation-only work.

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

## PM015 — Explore alternative UI directions in parallel with graph work

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM015`.

**Top 3 outcomes:**

1. Reviewed the selected [UI Direction](UI_DIRECTION.md), the earlier unselected directions in `design-system/soma/directions/` (Fieldnotes, Daylight, Focus, Notebook, Agenda) and the deployed synthetic demo's Today and lesson screens, viewed read-only. Each earlier option restyles a study dashboard, and none shows the competing explanations or the discriminating experiment on the first screen.
2. Used Jeremy's locally installed UI/UX Pro Max skill (search only, nothing persisted). Its `--design-system` result (Neumorphism, Poppins) was a poor fit and was not applied, so targeted style, type and product searches guided the directions instead. Built four interactive, unselected directions as a private design canvas (https://claude.ai/artifact/5NaNL77LNFvGKhbWzFuyBk): F Casebook, G Bench, H Plate and I Studio. Each puts the Quiz 3 answer, explanations A and B, the R₂ experiment with a hidden checked trace, the optional prediction and a response-dependent revision on the first screen. Sources and rationale are in [the canvas folder](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified: no render, contrast, keyboard or reduced-motion check was run on the canvas boards. The revision states are scripted for the mockup, not Spark output. No direction is selected.

**Plan deviations:** None adopted. UI Direction (Ready Card) remains authoritative until Jeremy selects a change and it is recorded in Decisions. No `src/` files, PRD, build plan or deployment changed, so there is no overlap with the concurrent graph session's files. The physics in the mockups is computed in the board script for illustration; production lessons must still read from the checked model.


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

## PM017 — Give the explored directions personality

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM017`.

**Top 3 outcomes:**

1. Diagnosed the PM015 boards: F–I change typeface and palette but share a generic dashboard skeleton with stock-style icons. Soma doesn't own anything in them. Personality needs one idea that sets the mark, symbols, voice and motion together.
2. Added three static personality concept sheets to the same private canvas: J Neuron (the meaning of "soma": dendrite sources converge and one activity fires), K Margin notes (Soma as a TA's margin pen, with graphite student, red instructor and violet Soma inks expressing the observation/interpretation separation rule) and L Specimen (periodic-table tiles for Soma's own concepts; a lesson's history reads as a formula). Each sheet has a mark, six custom symbols, the hero moment in the product, voice samples and a signature motion with a reduced-motion fallback. Sources and rationale were added to [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified and unselected: the sheets were not rendered or checked for accessibility, and no direction or concept is adopted.

**Plan deviations:** None adopted. UI Direction remains authoritative; no `src/`, PRD, build plan or deployment change.

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

## PM018 — Still not sold on the explored directions (PM019 clarification answers)

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entries `PM018` (message) and `PM019` (answers to four multiple-choice clarification questions).

**Top 3 outcomes:**

1. Stopped generating options blind and asked about references, the first feeling, a character and what missed. Jeremy picked Linear, Raycast and Arc; Duolingo and Headspace; and Things, Notion and Readwise. The first feeling should be "curious, want to touch it", with no character, and J–L were "too conceptual".
2. Built one real Today screen from those answers, M · Playground, in light and dark on the same private canvas. It has an Arc-like course sidebar and ⌘K bar, Geist type, tactile press-down buttons and a dial slider, and amber current dots flowing through the circuit. R₁'s branch stays switched off until the student guesses or chooses to skip the guess, which is recorded as help. The scripted revision and next activity follow the guess. Sources and rationale are in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified and unselected: no render, animation, contrast, keyboard or reduced-motion check was run, and no direction is adopted.

**Plan deviations:** None adopted. UI Direction remains authoritative; no `src/`, PRD, build plan or deployment change.

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

## PM020 / PM021 — Rethink functionality and layout around the knowledge graph

**Recorded:** October 27, 2026, in the PM015 advisory conversation. Exact received timestamps unavailable.

**Verbatim prompts:** Preserved in the canonical prompt archive, entries `PM020` (functionality and layouts) and `PM021` (knowledge graph as the central premise, sent while PM020 work was in progress).

**Top 3 outcomes:**

1. Redirected the PM020 layout pass to PM021: proposed the semester as a transit map. Courses are lines; syllabus concepts are stations by week; station looks come from evidence (own, with help, two explanations being tested, coming up, deadline); cross-course links are shown only as "proposed · not verified"; zoom levels (map → line → station → playground) replace separate destinations; Today is the map's frontier.
2. Built three boards on the private canvas: an interactive semester-map home (frontier chips, selectable stations, a station inspector with evidence labeled by who said it, change cards linked to stations), a station concept and evidence page (direct neighbors only, versioned interpretation, evidence timeline) and a mobile vertical-line view. Rationale is in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Flagged the conflict: UI Direction and Learning Graph Scope currently exclude a semester-wide graph destination for P0. N is unselected and unverified (no render, accessibility or reduced-motion check).

**Plan deviations:** None adopted. A graph-first home would deviate from UI Direction and Learning Graph Scope and needs Jeremy's decision recorded in Decisions before implementation. No `src/`, PRD, build plan or deployment change.

## P050 — Implement lightweight Blackboard navigation

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Committed blank-login recovery (`835f31c`), bounded read policy/runner (`c4a4d05`) and course discovery/selection/resumable supported text collection (`f90e5fe`). Fresh-session discovery verified 36 actual course metadata rows with institutional identity binding and zero inference. A bounded BI 107 text probe extracted 16 items with further folders pending, zero inference and zero material publication. No private body, login screenshot or control URL enters committed fixtures.
2. Milestone review found and fixed missing pagination proof, actual Blackboard string handlers/rawText/empty-page sentinels, historical remap bypass, lost traversal progress, failed-course starvation, stale lesson withdrawal, account identity changes and browser-budget cadence. Eighty-six focused tests, nine orchestration tests, five actual managed synthetic-account selection cases and the four picker browser journeys passed; final aggregate results follow below. Navigation uses application-authored GETs, while Spark investigates committed sources through the existing tools.
3. The production build passed with normal network access. One sandbox build failed on Google Fonts DNS; the first aggregate browser run passed 35 journeys and failed the new sanitizer because its fixture omitted the newly required paging proof. The fixture was corrected and its actual browser recheck passed. Full source publication through the selected-course hosted UI, actual expiry/deletion and real-course teaching quality are still separate gates. No Meta call or budget increase occurred.

**Final local verification:** 613 default tests passed / 47 opt-in skipped; three additional HTTP ownership/origin checks passed. All five managed synthetic-account cases passed. Across the full browser run and corrected sanitizer rerun, all 36 journeys passed; the picker notice was subsequently updated to show the server's actual partial-read result, and its focused recheck passed. Default production build passed; a scan of 325 tracked/client files found no actual private environment secret values. Source code and milestone audit pushed to main (`f90e5fe`, `0ca418d`); production deployment is READY at the existing Soma URL. The actual signed-in course picker rendered the verified catalog with all courses unselected; unauthenticated catalog GET returned 401 and foreign-origin POST returned 403, both no-store. Main CI for `88015ea` completed successfully ([run 40587503434](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40587503434)), including the default build and full browser suite. Course selection and a real selected-source publication remain user-dependent, rather than inferred from the read-only probe.

**Plan deviations:** Implements the requested lightweight adapter. The Ultra frontend attempted a preference PUT during exploration; collection instead uses exact authenticated GET JSON reads. Scheduled browser starts retain headroom under the existing daily cap, so larger selections/multi-slice walks can take longer than six hours. Files/images/embedded tools remain unsupported. Gradescope then Piazza follow under P051; no new model/framework or teaching family.


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

## P051 — Piazza and Gradescope after Blackboard

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Recorded the requested next integrations: Piazza for a class and Gradescope as the main assignment source.
2. Continuing the in-progress Blackboard milestone first; Gradescope is the next validation priority, followed by Piazza. No access, collection or model-processing outcome is claimed for either provider.
3. Existing separate encrypted browser contexts, user-entered login/MFA and selected read-only scope apply to the follow-up. No new credentials requested in chat.

**Plan deviations:** Sequencing clarification within the existing source-integration scope; no new product family or budget.

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

## PM026 — Compare model-orchestration ambition with the current app

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM026`.

**Top 3 outcomes:**

1. Read the current UI/UX guide, runtime model client, investigation tools, semester-map projection, graph audit and latest build entries. Confirmed the client explicitly selects only `muse-spark-1.3`; the open-weight specialist remains a conditional proposal. The map projects saved course/lesson/evidence records, while the implemented graph separately retains hypotheses and revisions. This is a source/document review, not a new deployed-product test.
2. Distinguished implemented depth from missing collaboration: P041 records actual synthetic Spark diagnostic generation and contrary/ambiguous branches, with separate managed-persistence checks; those results are not evidence of a multi-model runtime, complete image interpretation, broad reliability or learning gains. The recent UI overhaul explicitly preserved server behavior.
3. Recommended evaluating a bounded author/challenger collaboration on the same source-linked graph: Spark proposes explanations and an experiment; a second Muse model challenges whether that experiment distinguishes them; Spark revises or retains the proposal using checks. Surface the resulting instructional consequence and actual concise decision records. This is advice, not an adopted PRD/model/budget change. Verified official Meta reasoning/model documentation for Wonder/Spark and Glimmer; account access, serving, cost and comparative quality remain unverified.

**Plan deviations:** None adopted. No app code, model call, training, private-source access, deployment, spend or release-scope change. Existing October 31 freeze and November 4 deadline remain. Prompt archive JSON and log whitespace checks passed; application tests were unnecessary for this advisory review.


## PM027 — Trace interactive lesson generation

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM027`, including trailing whitespace.

**Top 3 outcomes:**

1. Read `meta.ts`, `meta-practice.ts`, `investigator.ts`, authored lesson constructors and lesson-stage rendering. The ordinary circuit path lets Spark select cited source passages, series/parallel topology and numerical parameters; authored constructors supply much of the wording and the existing renderer supplies the visual layout and controls.
2. Distinguished the richer diagnostic path: Spark proposes explanations and approved experiment specifications; deterministic evaluation calculates predictions/results and validation gates source references before a diagnostic is constructed. Ordinary text practice can have model-written questions, options and explanations, but it does not generate a new interactive visual environment. Prepared demo/follow-up fixtures are separately authored.
3. Explained the gap from the anatomy-style ambition and recommended richer typed lesson composition over checked components as a proposed next step. No claim of arbitrary HTML/SVG/code generation, new scientific models, independent pedagogical verification or multi-model collaboration was made.

**Plan deviations:** None adopted. Source-code inspection only; no runtime test, inference, app edit, deployment, scope change or spending. Prompt JSON and documentation whitespace checks passed.


## PM028 — Restore the generated-lesson thesis

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Full supplied prior response and correction preserved in canonical archive `PM028`, including table spacing and literal HTML entity.

**Top 3 outcomes:**

1. Identified the drift: the thesis promised authored interactive experiences around a checked model, but R11's concrete generation/acceptance language allowed parameters, diagnostics and follow-up changes in a fixed renderer. Existing graph implementation is useful progress without proving the missing authoring layer.
2. Updated PRD thesis/R11, technical lesson contract, handoff, build priority and demo guidance to require bounded generated presentation/interaction composition, checked model bindings, representative browser checks, version preservation and honest fallback status. Two genuinely model-authored compositions must differ in explanatory sequence and meaningful visual focus/comparison/interaction; this is stronger than earlier parameter-only acceptance.
3. Recorded the correction without touching concurrent app implementation, selected navigation, source permissions, scientific family, budgets or dates. Anatomy remains a candidate; no external repository or license was freshly audited, dependency installed, model called, training launched, code changed or deployment made. Document consistency/links/whitespace and archive checks are recorded after execution.

**Plan deviations:** Explicit restoration/strengthening of the generated-lesson acceptance boundary and October 28–30 priority. The current fixed renderer is retained as foundation/fallback, not treated as complete flagship delivery. Completed graph milestones remain recorded; no gate is retroactively claimed passed. Existing October 31 freeze and numerical/source/held-out gates remain.

PM028 verification: scoped documentation whitespace checks passed; relative links in all six updated scope/handoff documents resolved; prompt archive JSON parsed with unique IDs, exact captured prompt equality and preserved literal ending. Read back the R11 and technical-contract changes for consistency with one-family, generated-code, version/evidence and freeze boundaries. No application tests were run for documentation-only changes.

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

## PM029 — Implement bounded lesson agent orchestration

**Recorded:** October 27, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Canonical archive entry `PM029`, including trailing whitespace.

**Top 3 outcomes (verification ongoing):**

1. Added a Spark author/Wonder challenger path to direct/queued lesson preparation and newly prepared source/response diagnostics. Rejected candidates remain unpublishable; one repair must pass a fresh review. Existing numerical/source/ownership and transactional publishing boundaries remain. Defaults off via a server configuration flag; no deployment or production activation is claimed.
2. Added allowlisted model transport, model-specific billing, shared call/time/reservation checks, versioned cache/job identity, pinned preparation-job policy, durable role summaries and protected review audit details. Reused the existing app/worker; no agent framework. Added the implementation/activation boundary in [Agent Orchestration](AGENT_ORCHESTRATION.md). Generated visual composition/browser checks remain separate open R11 work.
3. Initial existing-path focused checks passed 71 tests; new author/reviewer checks passed 8 and the combined investigator set passed 38. A new test request needed an explicit TypeScript request annotation; corrected and typecheck subsequently passed. Full default suite passed 820 with 53 opt-in skips at this checkpoint. A real synthetic two-model check is running through the existing actual Firestore allowance. Default Turbopack build failed on local port binding (EPERM); webpack verification is underway. Final results follow below.

**Plan deviations:** User authorized orchestration implementation. Wonder is now an optional runtime reviewer instead of a proposal-only model, with a publication gate when enabled. Four/eight total calls, one repair, 90 seconds and existing $0.20/$0.35 reservation sizes are retained. Direct reviewed preparation uses two application-read source segments to preserve review/repair call capacity. No app spending cap increase, new scientific family, arbitrary generated executable code, model training, private-source test or UI redesign. No generated-composition or learning outcome gate is claimed passed.


### PM029 executed verification and live-provider limitations

- Typecheck passed after the request annotation fix and final role-contract changes. The latest shared-checkout default suite passed **882 tests with 54 opt-in skips** (75 files passed, 28 skipped). This includes concurrent Piazza tests; they are not orchestration work. The focused orchestration/client/investigator/job set passed **66 tests** before the final unrelated concurrent additions.
- Deterministic tests exercise source/role transport, one reservation, model-specific prices, changed candidates with mandatory re-review, invalid/rejected/unavailable reviewers, unknown-usage retention, cache/reload, unsupported billing IDs, audit-write failure, protected feedback, diagnostic repair and unknown job policy rejection. No test result is a claim of model judgment quality or learning benefit.
- The initial restricted live test timed out at 100 seconds with no result. It is not live success; any interrupted reservation remains untouched. With network access, a real synthetic author attempt failed the exact-disclosed-quotation boundary after its one repair: known estimated token cost **$0.01539**. Added stable, non-sensitive validation detail rather than weakening source checks.
- The next real synthetic attempt prepared ordinary practice but Wonder did not complete a bounded review: known cost **$0.02045**. This reached the reviewer and withheld the candidate; it did not complete the two-model flow. Reviewer output budget was raised from 512 to 1,024 within the existing 2,048 ceiling, with minimal reasoning.
- A subsequent attempt repaired an initial quote failure, then the reviewer request returned HTTP failure without reported usage: known cost **$0.01335**, with the full **$0.20** reservation retained for uncertainty. The newly added `tool_choice: required` option was unsupported by Meta's API; verified the official auto-only contract and removed the option entirely. No hidden fallback or live success was claimed.
- Corrected-contract live verification was deferred/skipped at budget preflight. A bounded follow-up confirmed reason **global**. No cap increase, reservation release/reset, additional private-source processing, account publication or deployment occurred. Real-provider end-to-end review/repair remains unverified.
- Default Turbopack compilation failed locally on PostCSS subprocess port binding (EPERM), including with expanded network access. Restricted webpack initially failed DNS for existing Google fonts; webpack with network access compiled, typechecked and generated all routes successfully. A final webpack build after the last contract changes is recorded below. No font/UI change was used to mask these environment failures.

Sources verified: [Meta model IDs](https://dev.meta.ai/docs/models), [Wonder pricing](https://dev.meta.ai/resources/blog/build-with-muse-wonder), [reasoning/output budget](https://dev.meta.ai/docs/reasoning), [tool calling: auto-only selection](https://dev.meta.ai/docs/tool-calling). The implementation and follow-up are in [Agent Orchestration](AGENT_ORCHESTRATION.md). Concurrent connector work, private records and unrelated advisory files were preserved.

PM029 final context audit: diagnostic review now includes the validated competing hypotheses and prediction mappings, plus bounded original response/assistance when present, so the challenger can judge whether the interaction distinguishes those explanations. No author reasoning or new learner state is included. Typecheck and all 66 focused tests passed after this change. Reviewer findings persist as bounded protected audit entries; answer-revealing details stay out of public steps. An unknown review-policy version makes a preparation stale.

PM029 completion checkpoint: final network-enabled **webpack production build passed** after the validated-hypothesis context change, including TypeScript and route generation. Typecheck and 66 focused tests passed on the final orchestration code; the shared full-suite checkpoint was 882 passed/54 skipped. Scoped whitespace checks, local handoff links and exact canonical PM029 prompt checks passed. Default Turbopack remains locally blocked by port binding. Corrected live two-model completion remains unverified because the actual global allowance denied another reservation. The implementation stays opt-in/off by default; production environment and scheduler were not changed. No claims of generated visual lesson composition, browser approval or measured model-quality improvement. `next-env.d.ts` route imports were regenerated by the production build, not manually redesigned. No concurrent Piazza/connector changes, private data or unrelated advisory files were staged or committed by this turn.

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


## PM030 — Clarify fine-tuning status and timing

**Recorded:** October 28, 2026, in the planning conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Canonical archive entry `PM030`.

**Top 3 outcomes:**

1. Checked the specialist proposal, current model orchestration and available training/dataset paths. No implemented training pipeline or tuned checkpoint was found in the inspected project. Current Spark/Wonder orchestration uses prompted foundation-model inference; retrieving student graph records does not update model weights.
2. Kept fine-tuning as the documented conditional experiment: establish the working generated-lesson flow and reviewed evaluation cases, identify a recurring instructional failure, then compare a specialist against a strong prompted baseline on unseen cases. Data preparation can start before training; no claim that tuning must wait until after the hackathon.
3. Preserved current scope and concurrent implementation. No training launched, dataset exported/generated, provider selected, model called, private content processed, budget increased or application code changed. No application tests were needed for this status clarification.

**Plan deviations:** None. Fine-tuning remains outside the critical release path and subject to measured benefit, serving/cost fit and the October 31 freeze.

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


## P080 — Verify actual secure Blackboard sign-in (October 28, 2026)

Prompt: canonical verbatim entry `P080`.

Top three outcomes:
1. Read only the isolated page's fixed status: sign-in stopped. Request metadata recorded save-fill HTTP 409 in 4.76 seconds. That does not establish password rejection or vault state; enrollment can save before the fill fails. Cancelled the failed reference through normal Soma controls without Forget, credential retry, password/input inspection or browser-state export.
2. Fixed a separately proven internal POST defect: the secure cookie was retained but native Origin/Referer headers were missing. `3e9fe8e` adds only the reviewed origin/captured form referrer, finite diagnostic facts and static accessible recovery copy. Independent review, 28 actual Chromium synthetic cases, 34 diagnostic/server cases and twelve isolated-page journeys passed. [First-fix CI](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40813299882) passed typecheck, 1,158 ordinary tests / 85 opt-in skips, four diagnostic contracts, build/runtime trace, 28 Chromium cases and 63 browser journeys.
3. Built only clean committed service files and deployed the first fix as `soma-credential-login-00003-96t`, preserving identity/environment/resources/timeouts and passing eleven hosted negative checks. A fresh owner attempt then exposed a distinct idle-session lifecycle failure, addressed and tested under P081. Actual BU MFA, safe-state handoff, instructional PDF access and preparation remain pending; no Meta call, real password retry or course-file download was performed.

Deviations: credential entry did not establish successful sign-in, and the header defect is not asserted as the cause of the original 409. The planned PDF check remained gated by authentication; P081 carries the additional lifecycle repair.


## P081 — Fresh Soma authentication for recovery (October 28, 2026)

Prompt: canonical verbatim clarification `P081`.

Top three outcomes:
1. The owner confirmed fresh Soma authentication. Normal setup allocated a window, but bootstrap 25 seconds later returned session_ended before vault metadata. Status/timing metadata established the same service instance and surrounding callback HTTP 200 responses, not an explicit real-account denial. Cancelled the rejected reference normally and closed only the agent-created failed tab. Password storage remains unconfirmed.
2. `f17e852` separates uncertain callback failure (503) from explicit denial, prevents overlapping background checks, closes viewers on uncertainty and preserves only the original bounded setup. Sensitive actions still require fresh checks; explicit denial and expiry still terminate access. Independent review corrected misleading 503 copy before deployment. Fifty-three focused cases and typecheck passed; 65 combined boundary/authorization/server checks passed after `13200fa` updated an old malformed-200 expectation. [Final CI](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40814814845) passed typecheck, 1,177 ordinary tests / 85 opt-in skips, four script contracts, production build/runtime trace, 28 actual Chromium cases and 63 browser journeys.
3. Deployed `soma-credential-login-00004-7z9` with the same identity, environment, resources and timeout. The actual fictional-account lifecycle passed in 50.51 seconds, including 25-second idle entry, protected cookie/empty-vault metadata, replay/revocation, cancellation, expired-manual-reference recovery and normal cleanup. Independently confirmed fictional Auth/root absence, removed its temporary UID and redeployed clean app source `13200fa` with owner-only setup. Requested fresh human authentication again after the five-minute window elapsed; real credential use/MFA and source/PDF readback remain pending. No new inference occurred.

Deviations: the first lifecycle CI exposed one outdated test expectation; corrected it rather than changing the new uncertainty contract. Automatic approval review rejected a proposed command that would persist raw request URLs; the command did not execute, and diagnosis proceeded with URL-free status/timing/instance metadata. The application callback can still collapse some internal service failures into 403; universal outage recovery is not claimed.


## PM031 / PM032 — Research HeyClicky screen-aware graphics

**Recorded:** October 28, 2026; exact received timestamps unavailable. Both verbatim prompts are in the canonical archive. PM032 corrects the product attribution in PM031; no OpenAI product launch was established by the interrupted initial search.

**Top 3 outcomes:**

1. Researched the official HeyClicky homepage, October 23 release notes, trust page and original repository. The release describes screen annotations, narrated 2D drawings, photo cards and manipulable/clickable 3D objects, plus conversation context. These are company-described capabilities, not a hands-on benchmark performed here.
2. Distinguished the published old architecture from the current private release. The original MIT code describes transcript/screenshot → Claude → tagged cursor guidance, with separate speech services. The current company trust page names Anthropic/OpenAI, but the exact model and new 3D rendering implementation were not established. No public embeddable graphics API/SDK was verified. Unrelated community Windows ports were not treated as the official product.
3. Identified a relevant interaction pattern for Soma: selecting a diagram/object part can drive a focused visual explanation or comparison grounded in current lesson state. Scientific correctness and learner evidence remain separate checks. Research does not adopt a native desktop overlay, new model/family, voice requirement or product-scope change. No application code, inference, credentials, source access, deployment or spending was changed. No application tests were needed for research.

**Sources:** [release notes](https://www.heyclicky.com/changelog), [homepage](https://www.heyclicky.com/), [trust](https://www.heyclicky.com/trust).

**Plan deviations:** None. Preserve the existing scope and October 31 freeze.


## PM033 — Evaluate screen-context learning pivot

**Recorded:** October 28, 2026; exact received timestamp unavailable. Verbatim prompt: canonical archive PM033.

**Top 3 outcomes:**

1. Rechecked HeyClicky's official homepage and October 23 release notes against the supplied hackathon requirements. Screen awareness, interactive graphics, general memory and agent delegation are already advertised there; these alone do not establish differentiation. No hands-on comparison or claim of field-wide novelty was made.
2. Recommended exploring a screen-to-experiment product whose distinguishing behavior is selecting a useful causal intervention, making checked outcomes manipulable, and adapting subsequent experiences from separately recorded predictions, help and independent application. Broader audience is a proposed direction; cross-domain transfer is an ambitious experiment, not demonstrated learning efficacy.
3. Mapped reusable backend foundations (sources, deterministic model, evidence records, bounded generation/review and jobs) against missing screen intake and generated visual composition. Recommended a time-boxed proof before adopting the pivot, with supported-topic boundaries, actual latency/correctness observations and the existing October 31 freeze. Existing Wonder review remains optional/default-off and its corrected live flow remains unverified; no extra model or fine-tuning was required or executed.

**Sources:** https://www.heyclicky.com/changelog and https://www.heyclicky.com/; local docs/HACKATHON_REQUIREMENTS.md, docs/AGENT_ORCHESTRATION.md and PRD R11.

**Plan deviations:** None adopted. This is evaluation only; PRD, app, provider budget, deployment and source permissions remain unchanged. No application tests were needed; prompt JSON parsing and documentation whitespace checks were executed.


## PM034 — Inspect supplied HeyClicky demo

Recorded October 29, 2026; verbatim request and attachment reference in PM034.

Top three outcomes:
1. Inspected metadata and sampled visual frames/captions from the supplied 146.816-second video, including denser five-second samples of the central demonstration. No full audio transcription, hands-on product test or latency benchmark was performed.
2. Observed code/video-context explanations, progressive visual follow-ups, a 3D aircraft depiction and Raspberry Pi camera connection imagery. Identified continuity of curiosity and immediate contextual visual explanation as the core appeal; polished imagery does not itself establish checked executable simulation.
3. Refined the proposed Soma direction: preserve effortless optional exploration and evolving visual artifacts; differentiate through supported causal experiments and evidence-informed adaptation without compulsory assessment. This is evaluation, not adoption of a new renderer, domain, native overlay or product scope. No application code, model calls or deployment changed.

Checks: ffprobe metadata, ffmpeg contact-sheet extraction, visual inspection and documentation whitespace check. Temporary contact sheets remain in /tmp; no video copied into repository.


## PM035 — Muse visual cards and spoken explanation feasibility

Recorded October 29, 2026; verbatim prompt PM035.

Top three outcomes:
1. Recorded the user's endorsement of visual exploration and Intro to AI as the intended example. Specific course topic, revised scientific family and implementation acceptance remain to be selected; no PRD or app changes made in this answer.
2. Verified Meta documentation for Spark/Wonder image understanding and structured output. Proposed model-authored card/diagram specifications rendered by application components, with checked computations for manipulable examples. This establishes an architectural path, not tested rendering quality, latency or generated-composition success.
3. Verified Muse Voice Transcribe supports streaming speech input only. Meta research describes Muse Realtime Voice speech output, but no general public Model API speech-output endpoint was verified. Recommended separate speech synthesis for the usable API path, synchronized by application-controlled explanation steps. No provider calls, expenditure, voice activation or implementation occurred.

Sources: https://dev.meta.ai/docs/models ; https://dev.meta.ai/docs/structured-output ; https://dev.meta.ai/docs/speech-to-text ; https://dev.meta.ai/docs/overview ; https://research.meta.ai/blog/bringing-your-muse-to-life .

Checks: JSON serialization and documentation whitespace. Scope status: user-selected direction/example acknowledged; formal implementation rescope remains outstanding.


## PM036 — Clarify screen perception role

Recorded October 29, 2026; canonical prompt PM036.

1. Clarified using the official model documentation verified under PM035 that Spark supports image understanding, so a separate vision model is not required.
2. Distinguished application-controlled, user-authorized screen capture from model interpretation and application rendering; proposed sharing screenshot plus question/current visual state, with targeted recapture for changed content.
3. Preserved uncertainty: screenshots do not establish hidden content, full video history or reliable small-text extraction. This is architecture clarification, not an implemented capture feature or successful live vision test. No scope, code, spending or deployment change.

Checks: prompt JSON serialization and documentation whitespace.


## PM037 — Demo positioning assessment

Recorded October 29, 2026; canonical prompt PM037.

1. Assessed the screen-context visual exploration direction as having a strong immediate demonstration hook, without predicting winning odds.
2. Recommended a continuous Intro to AI example: visible material, generated explanation, meaningful user intervention and checked consequence; preserved a judge-testable path and honest distinction between generated composition and authored computational components.
3. Identified differentiation from the HeyClicky reference as an outcome the working demonstration must establish. No video, implementation, scope rewrite, provider call or deployment was performed.

Checks: JSON serialization and documentation whitespace.


## PM038 — Local Soma v2 scope document

Recorded October 29, 2026; canonical verbatim prompt PM038.

Top three outcomes:
1. Created local somav2.md with 20 sections covering generic interaction inspiration, goals, users, proposed Intro to AI example, scope replacement, generated visual contracts, model roles, voice, evidence, correctness, evaluation, demo and dated delivery plan. The excluded product reference is absent from the document.
2. Added /somav2.md to .gitignore and verified it is ignored and not tracked. The document is a private local proposal; the request did not authorize changing app code, deploying, spending, or silently replacing authoritative PRD/UI acceptance.
3. Read existing product/UI/orchestration records and used targeted UI/UX Pro Max guidance on cancellable transitions and reduced motion. Distinguished existing infrastructure from unverified generated visuals, speech output access, and the proposed new algorithm family; preserved the October 31 freeze and November 4 deadline.

Checks: document structure/reference exclusion, JSON serialization, git check-ignore, untracked-file check and documentation whitespace. No application tests were required. No existing history or concurrent changes were removed.


## P082 — Interrupted end-to-end completion request (October 29, 2026)

Prompt: canonical verbatim entry `P082`; superseded by `P083`.

Top three outcomes:
1. Began reviewing the current handoff, build plan, working tree and previous verification status. No implementation, model call, source collection or deployment began before the interruption.
2. The user then explicitly put this work on the back burner in P083. The broad completion request is deferred, not completed; prior authentication, source and release gaps retain their recorded status.
3. Preserved existing application, infrastructure and concurrent work. No new subagent was dispatched and no application behavior or spending allowance changed.

Deviations: work was interrupted and reprioritized by the user before implementation.


## P083 — Read the local v2 direction (October 29, 2026)

Prompt: canonical verbatim entry `P083`.

Top three outcomes:
1. Read all twenty sections of the local planning document and verified that it remains Git-ignored and untracked. Its private contents were not copied into the public repository.
2. Familiarized with its proposed journey, computational/visual boundaries, reusable foundations, proof gate and unresolved decisions; summarized understanding in chat. No proposal is represented as an implemented feature or adopted acceptance criterion.
3. Honored the pause on the previous integration push and recorded the priority decision. No product code, PRD/UI acceptance, external service, credential, inference budget or deployment changed.

Deviations: none; this is familiarization only, not authorization to implement the proposal. Checks were limited to file review, ignore/tracking status, JSON serialization and documentation whitespace.


## P084 — Adopt and implement the visual-exploration pivot (October 29, 2026)

Prompt: canonical verbatim entry `P084`. Supersedes P083's familiarization-only implementation gate.

Top three outcomes (implemented and verified first version):
1. Implemented the `/explore` source-to-visual loop, deterministic BFS, generated scene composition, controls, contextual revisions, owned save/resume/history and optional captioned voice. Retained existing v1 routes and data. Core milestones were reviewed and committed in `8019986`, `2c5e63a`, `c25e977`, `d5fd65c`, `1cfd5a5` and `b2fc1fd`.
2. Actual Spark tests passed ten original screenshot source/path cases and a stronger start-only comparison; additional live process explanation and missing-context clarification passed. The current complete working-tree suite passed 1,324 tests (90 skipped), 84 browser journeys, typecheck, webpack build and isolated browser artifact tracing. The clean committed release passed 1,309 tests (89 skipped); default-compiler CI and hosted API/browser checks passed.
3. Applied the authorized $5 total test cap when $2.6518575 consumed could not admit another $0.35 reservation under $3; retained usage and reserve. Documented current evidence/limits and three ranked v1 bridges. Guest Firestore TTL was enabled and verified ACTIVE. Real OS capture, microphone/word accuracy, audible playback and actual-course fit still require user checks.

Deviations: the default local compiler twice failed on a sandbox subprocess-port restriction; the supported webpack compiler passed. Initial synthetic geometry and provider-schema/null compatibility failures were retained and corrected. Request replay protection is explicitly bounded to the original deadline plus 90 seconds with terminal audit aggregation. Other scope deviations: none established; actual course fit is unverified, so first checked search examples are original synthetic material. The local proposal remains ignored; adopted public implementation requirements are summarized separately.

### P084 M1 review checkpoint — October 29, 2026

The checked BFS model and generated scene contract passed 44 focused domain tests, including independent reference paths, cycles, ties, disconnected goals, start=goal, invalid layouts and unsupported model claims. Root reviewed the traversal and reference validation. Adoption is recorded in authoritative product, sequence, UI and technical documents. M2–M5 remain in progress; no live v2 model outcome is established yet.

### P084 M2–M4 independent review checkpoint — October 29, 2026

Root and cross-agent reviews found and repaired pre-registration cancellation, late state overwrites, old-version access, comparison bounds and parameter visibility, source uncertainty, initial guest-cookie setup, media cleanup, terminal-history capacity and billing-fact loss. Browser/native audio tests distinguish actual deterministic/browser behavior, provider doubles and actual Meta calls. The first two synthetic worksheets also served compatibility debugging, so the final ten-case result is not presented as an untouched field benchmark. See `docs/SOMA_V2_VALIDATION.md` and `docs/SOMA_V2_V1_BRIDGES.md`. No private course media, credentials or raw model reasoning is committed.

### P084 M5 release checkpoint — October 29, 2026

Pushed all focused milestones through `e1d3fc0` to main. Deployed its clean archive to https://soma-woad-beta.vercel.app/explore; default hosted compilation passed. Independent CI https://github.com/Jeremiah-Sakuda/soma/actions/runs/40821210973 passed, including all 84 browser journeys and 28 opted-in isolated credential-browser checks. Exact source archive: typecheck and 1,309 tests passed, 89 intentionally skipped. Hosted synthetic API checks passed actual Spark screenshot generation, contextual revision, Firestore exact-state/older-version resume, guest/origin isolation, cancellation and deletion; hosted native browser controls/save/reload/phone/reduced-motion passed without client errors. Ledger $3.27464925/$5 includes retained reservations. V1 recurring scheduler parked under the back-burner direction; sources/credentials retained. Actual OS capture, spoken question/device voice and real-course fit remain user checks. Ranked v1 reuse proposals are documented, not implemented. No private media or secrets were committed.


## PM039 — Current visual-exploration gap assessment

Recorded October 29, 2026; canonical prompt PM039.

Top three outcomes:
1. Inspected the current exploration domain/schema, renderer, workspace, capture hook, voice controls, server generation, and P084 validation/bridge records. Corrected earlier assumptions: screen capture code, generated cards, BFS, revisions, save/resume and voice controls now exist. Previous actual-model tests are cited as recorded results, not rerun here.
2. Inspected the hosted /explore page and loaded its labeled original example without inference. At 1280x720 the source/form/voice surface pushes the visual card below the fold; inspected the actual graph card after Jump to visual card. No source sharing, microphone access, user data upload or new model generation was performed.
3. Prioritized diagram-first companion layout, synchronized narration/visual steps, richer bounded primitives and motion, coherent in-place revisions, and a simpler voice question flow. Specific code gaps: narration field not used by current caption-based readout; generic diagrams use circles/edges/text; each follow-up traverses interpretation/composition and publishes a full new spec with default view state. Screen-region pointing, continuous conversational voice, full 3D, and learning-graph bridges are not established.

Deviations: review only; no application, scope, budget or deployment changes. Checks were source inspection and hosted visual review; no new automated suite or live-model benchmark was executed.


## PM040 — Visual explanation experience implementation

Recorded October 29, 2026; canonical prompt PM040.

Top three outcomes:
1. Implemented a diagram-first exploration card, interruptible captioned narration tied to actual speech completion, richer bounded blocks/sequences/matrices/callouts, and opt-in recorded-question submission. Retained active sharing controls, keyboard alternatives, reduced motion and phone layout. Corrected the outgoing/incoming speech cancellation race.
2. Explicit Explain/Focus requests now reuse owned context and current checked controls; application validation rejects computational changes in that path. Valid revisions retain surviving selection, matching trace position and unchanged object positions. An actual Spark follow-up generated the new panels and narration after one bounded repair (2 calls, 16.262s, $0.0519925). An earlier failed live attempt is recorded; no universal success or latency claim is made.
3. Full working-tree suite passed 1,329 tests (91 skipped); final focused domain/server/route suite passed 42. Browser checks passed 25 exploration/voice journeys plus the added handoff regression in a passing 9-test voice rerun (26 distinct journeys); final panel check, typecheck and webpack build passed. Updated PRD, UI guide, plan, decisions, implementation and validation records. Shared usage is $3.37535775/$5. Existing concurrent changes were preserved; no deployment or new commit was made.

Deviations and limits: local implementation only, retaining the October 31 freeze. Browser TTS remains the output voice; recorded-turn auto-submission is not continuous conversation. Complete typed specs still publish immutable versions; this is continuity rather than streamed scene patches. No new numerical family, screen-region pointer, arbitrary code, model-count expansion or v1 bridge. Real device speech and real-course checks remain open. See SOMA_V2_VALIDATION.md for initial failures, repairs and exact evidence; `.local/pm040/` contains ignored synthetic screenshots/provider diagnostics.


## PM041 — Meta voice playback availability

Recorded October 29, 2026; canonical prompt PM041.

Top three outcomes:
1. Checked official Meta model/speech documentation: Muse Voice Transcribe produces text, not speech; Spark/Wonder expose text output. Source: https://dev.meta.ai/docs/models .
2. Found Muse Realtime Voice described as producing speech tokens in the avatar research announcement, but no public integration endpoint in the current Model API catalog. Research/consumer capability does not establish developer access. Source: https://research.meta.ai/blog/bringing-your-muse-to-life . Older MMS offers speech synthesis under CC-BY-NC: https://github.com/facebookresearch/fairseq/blob/main/examples/mms/README.md .
3. Recommended retaining Meta transcription/reasoning and separate TTS playback unless organizers confirm Realtime Voice access. No code, inference, spending allowance or deployment changed.

Deviations: none; research and advice only.


## PM042 — Gemini playback

Recorded October 29, 2026; canonical prompt PM042.

Top three outcomes:
1. Connected guided playback to Gemini 2.5 Flash TTS/Kore using the existing billed Soma project and server credentials. Enabled Vertex AI and granted the runtime only aiplatform.endpoints.predict via a custom role. Actual synthetic narration passed: 4.371s of valid 24 kHz PCM/WAV produced in 6.272s. Retained earlier permission/propagation and newer-model compatibility failures in the validation record.
2. Added same-origin owned-artifact/state speech requests, server-derived narration, strict output validation, bounded calls/bytes/time/spend, cancellation, actual audio-completion step advancement, a 12-entry in-memory replay cache, captions and explicit browser fallback. Meta reasoning/transcription remain. No screenshot, arbitrary client text, credential or audio is persisted by the TTS service.
3. Full suite passed 1,342 tests (92 skipped); 28 browser journeys plus an additional native WAV/ended-event journey passed. Final focused tests, typecheck and build are recorded below. Updated product/verification/UI/decision records and environment template. Five sent verification calls retained $0.15 allowance; shared total $3.52535775/$5. Local setting enabled; no deployment or commit performed.

Deviations: selected the working 2.5 Flash TTS API after the documented newer endpoint returned INVALID_ARGUMENT; no claim of general model unavailability. The existing shared $5 ledger conservatively counts Google calls as well as earlier Meta work. Native browser tests verify decoding/timing but not perceived audio quality. Hosted activation remains a release step. No API keys or private course media were committed.

### PM042 final verification checkpoint

Final focused speech/provider/route/budget/helper tests: 19 passed. Final TypeScript check and webpack production build passed with the selected Gemini 2.5 model and PCM adapter. Browser coverage totals 29 distinct journeys across the recorded runs. Local audio sample and diagnostics remain ignored; whitespace checks passed.


## PM043 — Cohesion assessment (retrospective)

1. Identified separate voice, provider and intent controls as experience fragmentation.
2. Proposed one question surface with automatic Muse interpretation and persistent visual context.
3. Identified measured synthesis delay as the main pacing issue; proposed preparing the next narration while speaking. No implementation or new measurement in this assessment.

## PM044 — Cohesive exploration and latency

Implementation in progress: simplify controls, preserve bounded automatic interpretation, prepare one narration step ahead with cancellation and replay reuse. Verification pending; no deployment or budget change.

### PM044 verification checkpoint — October 29, 2026

Top three outcomes:
1. One typed/recorded composer now sits beside the desktop visual. Added “Ask about this” pause/focus shortcut; removed manual intent selection and redundant Read step path. Provider and optional recorded-submit settings are disclosed. Spark interprets intent in the existing bounded pipeline; source/selection/control context and validation are preserved.
2. Added one-step-ahead narration preparation, pending-request joining, bounded replay cache and cancellation across interruptions. A failed prefetch never retries implicitly. Waiting states show real elapsed time and retain captions/current visual; first synthesis delay remains. No extra model, live call or budget increase.
3. Final 51 focused tests, TypeScript and 31 browser journeys passed. Inspected desktop/phone screenshots, including keyboard/reduced-motion paths. Corrected one test’s label-versus-ID expectation after the initial 27/28 run. Updated implementation, UI, decisions, validation and canonical prompt archive. Production build pending below.

Deviations: desktop composer placement supersedes PM040’s below-card layout. Automatic follow-ups retain the inspect/compose sequence; explicit Explain/Focus fast-path still exists at the API but is no longer a UI choice. Lookahead may spend on one unused step, bounded by existing limits. No claimed measured speedup, continuous listening, hosted deployment or commit. Concurrent changes preserved.

### PM044 final verification

Webpack production build passed, including TypeScript and all route generation. Final whitespace check passed. All work remains local and the earlier concurrent edits are preserved. This completes the implementation checkpoint above; the first synthesis wait and live latency measurement remain documented limitations.


## PM045 — Deploy and hosted verification

Authorized deployment and testing of the cohesive exploration/voice iteration. Preparing an isolated release from the existing release plus relevant changes, preserving unrelated work. Hosted configuration, deployment and tests pending; shared $5 cap unchanged.

### PM045 completed — October 29, 2026

Top three outcomes:
1. Enabled production Gemini narration and deployed the isolated visual/voice/cohesion snapshot. READY deployment: dpl_DLaLzQDjZTBQYgiZA8WSvVYXaHLr; canonical https://soma-woad-beta.vercel.app/explore . Manifest and release source are retained in ignored .local/pm045. Unrelated orchestration edits excluded and preserved; no commit/push.
2. Exact-release TypeScript and 1,332 tests passed, 89 skipped; hosted default compilation passed. Recorded initial missing test dependencies/loopback restriction and local Google-font fetch failure transparently in validation. The 31 focused browser journeys from PM044 preceded release; this turn additionally exercised the real hosted flow.
3. Actual Muse follow-up (2 calls, 9.201s, $0.031146), Gemini playback (first audio 6.222s, next-step gap 1.128s), interruption, exact-state save/resume, phone/reduced-motion layout and origin/guest isolation passed with zero client errors. Synthetic artifacts cleaned up; final shared ledger $3.64650375/$5.

Deviations: none in product scope; deployed an isolated overlay rather than the dirty checkout. Tests used original synthetic material; device microphone, actual OS capture and real course fit remain human checks. First-audio latency remains open. No budget reset or increase.

## PM046 — Animation quality comparison (October 29)

Top three outcomes:
1. Re-inspected the supplied 146.816-second reference video via a 12-frame overview and consecutive samples of the tensor explanation (26–33s) and aircraft explanation (68–73s). Compared them with the just-verified hosted Soma screenshots, narration timing and current renderer/CSS. Reference extracts are ignored under .local/pm046; no competitor material entered product assets.
2. Identified a substantial presentation gap: reference diagrams progressively assemble explanatory elements alongside source content; Soma largely presents full panels with color/highlight changes, queue-entry effects and state advancement after each utterance. Soma currently lacks within-utterance visual cues, drawn connections, semantic transfers and a focused presentation stage. This is a qualitative assessment, not a frame-rate benchmark or proof of the reference product's general reliability.
3. Recommended a bounded motion vocabulary and one polished Intro AI sequence: reveal, highlight, trace, transfer and re-layout, tied to checked state and short narrated beats. Improve visible teaching choreography before adding models or arbitrary generated code. Existing deterministic controls and validation remain the foundation.

Deviations: assessment only; no application changes, model calls, spending, deployment or new adopted scope. Sampling cannot establish subjective audio quality or exhaustive animation smoothness. Suggested priorities remain proposals pending user direction.


## PM047 — Animated visual explanation iteration

Completed October 29, 2026. Top three outcomes:
1. Implemented checked BFS dequeue, edge tracing and queue insertion choreography, progressive diagram reveal and motion tied to actual Gemini audio progress. Manual steps replay once; pause and reduced motion settle to the checked state. Browser voice uses static state because reliable timing is unavailable. No added model calls or learner evidence from replay.
2. Passed 56 focused tests, TypeScript, 34 browser journeys, and 1,337 exact-release tests (89 skipped). Inspected visual frames and a recorded complete traversal. Hosted real Gemini playback drove intermediate motion; interruption, phone reduced motion and cleanup passed with zero client errors. Final shared ledger $3.70650375/$5, including conservative reservations.
3. Deployed isolated snapshot dpl_CQQF89PdM1aNQ15eTJrRddzJeJiu to https://soma-woad-beta.vercel.app/explore. Manifest, screenshots, hosted results and animation-preview.mp4 retained under ignored .local/pm047. Unrelated orchestration changes preserved and excluded; no commit/push.

Deviations/limits: animation beats follow audio elapsed progress, not word timestamps. Checked BFS has richer choreography than generic explanatory diagrams; no arbitrary scientific simulation or equal-to-reference quality claim. Real OS capture and perceived voice quality remain human checks. Initial recording-test configuration failed before execution; corrected test context and final 34-test run passed.


## PM048 — Desktop companion assessment (October 29)

Top three outcomes:
1. Verified current getDisplayMedia call does not restrict capture to windows; whole-display selection may already be available in the browser despite window-specific UI copy. Actual OS picker not exercised.
2. Reviewed official Electron desktop capture, global shortcut and window APIs and browser capture permission requirements. Recommended a macOS-first thin Electron companion reusing the existing visual engine/backend, with a floating panel and explicit screen-capture permission.
3. Scoped the proposed interaction as shortcut → current-display snapshot → Muse interpretation → existing visual/narration experience, with capture before showing Soma and explicit pause controls. Native distribution, permissions and multi-display behavior require separate validation.

Deviations: advisory only; desktop direction is not yet adopted P0 or implemented. No product code, provider call or additional spending for this assessment. Web judge access remains available.


## PM049 — Desktop companion implementation (October 29)

Top three outcomes:
1. Built a macOS-first Electron companion with floating/resizable hosted Soma view, pin toggle, hide/reopen, global capture shortcut and explicit current-display snapshots. Reused the screenshot upload/preview flow; native capture itself never submits a model request. Locked renderer privileges, IPC, navigation and display selection. Pinned independent desktop dependencies; npm audit reported zero vulnerabilities at install.
2. Four policy tests and the final real Electron smoke passed, including nine runtime/adapter/control checks. Actual packaged-app production check passed five hosted checks with an original synthetic JPEG, no horizontal overflow and no provider calls. Inspected the hosted content screenshot. One repeated smoke timed out due to choosing the wrong content view; corrected toolbar selection and final runs passed.
3. Produced the unsigned Apple Silicon app at .local/desktop-dist/Soma-darwin-arm64/Soma.app (252 MB). Added desktop operating/verification guide and aligned product/technical/UI/demo/handoff documentation. No hosted code deployment, model spend, budget reset or commit; unrelated local work preserved.

Deviations/limits: uses a narrowly scoped DOM upload adapter rather than changing the hosted capture hook. Actual OS capture consent/fidelity, multi-monitor/fullscreen hardware, microphone and signing/notarization remain separate open gates. The package is a local build, not publicly distributable signed software. Global shortcut registration is checked at runtime and conflicts are reported. Historical v1 requirements remain marked as historical rather than being silently deleted.


## PM050 — Align documentation with desktop positioning (October 29)

Top three outcomes:
1. Set the current thesis to “Soma is a desktop visual learning companion that helps you understand what is on your screen,” with the hook “Understand what is in front of you, without leaving what you are doing.” Intro AI remains the first demo, with supported-model limits retained.
2. Updated PRD, implementation, product brief, user stories, UI guide, technical/build plans, demo/evaluation and Codex handoff. Added desktop acceptance, operating instructions and explicit native verification/distribution gates. Marked earlier student-hub pitch as historical scope; retained reusable behaviors.
3. Recorded PM049 adoption in DECISIONS and preserved the complete original human prompts in the canonical archive. Documentation reflects actual packaged/synthetic/hosted checks without calling them OS capture proof. No additional implementation scope, provider call, spend or deadline change introduced by this documentation request.

## PM051 — Assess the visual-exploration direction

**Recorded:** October 29, 2026, in a separate advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM051`.

**Top 3 outcomes:**

1. Read the P084 implementation, validation and bridge records and the PM049–PM050 desktop decision, and loaded the hosted `/explore` prepared BFS example read-only. That example makes no model call, and no Ask, Play or recording control was used. The selected-window → generated visual → checked manipulation → follow-up journey is far more legible than the v1 evidence story, and checked BFS fits the Intro AI course.
2. Named the direction's risks. Screenshot-in, explanation-out sits next to two listed anti-projects ("Simple Image Analyzers" and education chatbots) unless the checked manipulation leads. Only BFS is checked, so a judge's own upload most likely gets the explanation-only path. The primary journey needs a question, which conflicts with the AGENTS.md no-prompt invariant and removes the background-agent story. Gemini narration puts a non-Meta model in the demo audio.
3. Recommended keeping v2 as the front door and video spine and restoring one autonomy beat: a selected course source prepares an exploration before the student asks (bridges 1 and 3). Also: broaden the checked surface within graph search only if that fits the freeze, steer the judge path toward checked inputs, and keep the video's model attribution Meta-first.

**Plan deviations:** None adopted. Advisory only; no PRD, plan, decision, code or deployment changed, and no model or speech calls were made. Concurrent uncommitted v2 work was left untouched. The local `somav2.md` proposal was not read or copied.


## PM052 — Screen recording permission instructions (October 29)

1. Verified the packaged Soma app location still exists.
2. Checked Apple’s current screen recording permission instructions and provided the manual Add route with the exact local app path.
3. Explained enabling Soma and quitting/reopening; permission itself remains user-controlled and unverified. No application, permission or spending change.


## PM053 — Reopen hidden companion (October 29)

1. Explained Dock activation and Soma → Show Soma, matching current implementation.
2. Distinguished capture shortcut from simple reopening: Command+Shift+Space captures a new snapshot and opens the panel.
3. Combined this guidance with the pending permission instructions. No implementation, permission or budget change.


## PM054 — Assess external v2 feedback (October 29)

1. Compared feedback with the supplied participant rubric, current desktop scope, v1 bridges and actual exploration/reviewer code. Confirmed one checked BFS family and proposed-only bridges; current exploration path has no Wonder review.
2. Accepted the visible-differentiation concern while rejecting unsupported placement thresholds, model-count proxies and categorical exclusion of user-initiated workflows from the agentic award. Native delivery is workflow value, not sufficient proof of model novelty.
3. Recommended a coherent experiment/prediction/adaptation interaction, a purposeful second checked family and conditional reviewer use. Recommended preserving narration quality and evaluating additional autonomous preparation/open-weight work by benefit and costs. Advice only: no scope adoption, code change, model call or spend.


## PM055 — Build optional prediction to adaptive visual (October 29)

Checkpoint: implemented source/model/artifact/state-bound supported predictions and explicit answer-informed visual requests. Forty-two focused tests and isolated-release TypeScript passed. Final 35 exploration/voice browser journeys passed after fixing two real integration regressions: optional panel placement pushed phone controls down; an added history request interfered with resume. Panel moved below the experiment and history now uses existing read responses. Initial new test also needed an unambiguous example selector and explicit resume after reload. Isolated deployment and one actual Muse verification pending. Shared $5 cap unchanged. Dijkstra remains the next assessed breadth candidate, not implemented in this slice.


### PM055 release checkpoint

Top three outcomes:
1. Delivered optional prediction → checked feedback → saved observation → requested Spark visual adaptation, preserving exact source/model/state/version and explicit diagram-visible assistance. Original responses cannot be overwritten; checkpoint deletion follows the artifact. Added inspectable response lineage to adapted visuals.
2. Forty-two focused checks, isolated typecheck and 35 browser journeys passed after the documented regression fixes. Final response-lineage addition passed typecheck and 34 service tests; focused browser completion pending below. Real hosted synthetic adaptation succeeded with three calls, $0.0670135, 18.867s and the specific visual “Why does S leave before Goal?” Phone/reduced-motion no-overflow and cleanup passed. Screenshot inspected; this establishes one contextual adaptation, not diagnostic or learning efficacy.
3. Isolated production release prepared from PM047 plus nine selected files. Shared ledger $3.77351725/$5; no reset. One refresh command used the wrong working directory and republished the already-verified earlier snapshot; corrected the overlay with absolute paths before final lineage deployment. No unrelated changes, repository commit or automatic background ingestion introduced.

Scope: first complete slice toward the proposed experiment/prediction/adaptation direction. Weighted Dijkstra comparison remains the next design/implementation candidate. Wonder/open-weight/autonomous-source bridges are not claimed complete.


### PM055 final deployment

Final response-lineage snapshot READY: dpl_2W3bbpqqu5KAwtqKTh8cVdq8pMCL, immutable https://soma-p8pnwcaee-jeremiah-sakudas-projects.vercel.app, canonical https://soma-woad-beta.vercel.app/explore. Hosted compiler/typecheck passed. Final focused prediction browser rerun passed (1/1). Earlier 35-journey suite and actual adaptation results above remain distinct from this final cosmetic/provenance addition. Final no-inference hosted checkpoint result follows below. Whitespace checks passed.

Final no-inference hosted prediction check passed on the final release: original choice recorded and deterministic feedback returned; synthetic artifact/checkpoints deleted. No additional model or speech spend. Evidence: .local/pm055/final-hosted-results.json.


## PM057 — Completion assessment question (retrospective)

1. Clarified that the current prototype loop is implemented while broader capabilities/distribution and real-device/source testing remain.
2. Distinguished completed automated/live development checks from pending macOS permission, source-fit and submission evidence.
3. No scope or implementation change from that question; PM056 is the subsequent authorization for weighted paths/review/distribution work. Exact question is preserved in the canonical archive.

## PM056 — Weighted comparison, targeted review and distribution flow (October 29)

Top three outcomes:
1. Implemented nonnegative Dijkstra with deterministic ties/relaxation, checked-dijkstra binding, visible costs/priority frontier and a BFS costs-ignored comparison. Original example proves one edge/cost 10 versus three edges/cost 3. Controls, optional predictions, narration and save/resume reuse the existing engine. Weighted presentation uses static checked states, not misleading FIFO animation. Independent simple-path costs matched 24 generated small graphs.
2. Added targeted Wonder review for live weighted/prediction revisions, explicit audit decisions, one repair/re-review and model-specific billing within five calls/90s/the existing $0.35 reservation. Forty-nine isolated focused tests and TypeScript passed before the wire correction; 36 browser journeys passed. Final corrected-schema typecheck and 53 focused checks passed. Live hosted cost comparison passed. First hosted and local inference attempts failed at HTTP boundary; each retained its unknown-usage $0.35 reservation. Corrected required nullable wire fields and canonical input normalization; actual local Spark/Wonder handoff then passed (21.64s test duration, not a latency distribution). Successful inferred known-cost increment was $0.0799795. Shared ledger $4.55349675/$5, with $0.70 failed-request reservations retained. No reset or increase.
3. Added an explicit pinned signing dependency, hardened-runtime entitlements and a release pipeline that requires Developer ID Application, checks the secure notary profile, signs, verifies, submits, staples and Gatekeeper-checks before producing a distribution ZIP with notices. Sandbox metadata initially returned zero identities; elevated metadata found Apple Development only. Release preflight stopped before packaging/upload due to missing Developer ID identity. Owner clarification requested; no signed/notarized app or clean-Mac install claimed. Existing unsigned app remains usable.

Deviations/open gates: public distribution blocked on owner certificate/profile; no workaround or development-signature substitution. Original synthetic weighted and provider checks do not establish real-course extraction, instructional accuracy or review efficacy. Initial production deployment lacked the corrected strict schema; final correction deployment tracked below. Temporary live diagnostic source moved under ignored .local/pm056 to prevent accidental live tests. All other concurrent orchestration changes excluded except the model-aware Meta client required for this targeted reviewer and the narrowly copied usageCost rate function. No code commit/push. Freeze/deadline retained.


### PM056 final release

Corrected snapshot READY: dpl_9eHVNJsqD8EmPHGyT5PPvp7PMdcc, https://soma-4wubkhi9c-jeremiah-sakudas-projects.vercel.app, canonical https://soma-woad-beta.vercel.app/explore. Hosted compilation/typecheck passed. Final no-inference hosted weighted cost check and cleanup passed; evidence .local/pm056/final-hosted-results.json. Owner Apple credential question remains pending. No app package was overwritten by the blocked release preflight. Root docs/manifest/whitespace checks updated.


## PM058 — Developer membership confirmed; certificate setup handoff (October 29)

1. Human confirmed membership but no certificate. Checked official Apple certificate guidance and confirmed Xcode 26.6 is installed.
2. Opened Xcode Settings → Apple Accounts. Actual UI shows no signed-in account and Add Apple Account; no certificate was created or credentials entered. Initial app selection tool returned after unusually long latency; subsequent settings navigation worked.
3. Provided account sign-in and Manage Certificates → Developer ID Application instructions. Credential creation/private-key setup remains a human action under native-control handoff rules. Signing/notarization still pending; no account change, certificate request, provider call or budget change.


## PM059 — Certificate created; sign separate release (October 29)

1. Verified owner's new valid Developer ID Application certificate. Updated release flow to choose a sole matching identity, use a separate release directory and support signing/notarization phases. No private key was exported.
2. Actual packaging and Developer ID signing completed for .local/desktop-release/Soma-darwin-arm64/Soma.app. Deep/strict nested signature verification passed. Original test app was preserved. Signing process took roughly two minutes; no OS key prompt was confirmed or acted on. No new inference/spend.
3. Checked notary profile soma-notary: missing. Prepared secure owner-only setup instructions using Apple's app-specific password flow and interactive Keychain storage. Notarization/stapling/Gatekeeper and signed-runtime/permission checks remain pending; do not call this distributed or fully verified. Updated desktop guide; original prompt recorded verbatim.


## PM060 — Credentials stored; notarization submission (October 29)

Owner confirmed validated credentials stored as soma-notary. Resumed signed-only bundle with --notarize-only; signature validation, Apple submission, stapling, Gatekeeper and distribution archive pending. Account/private-machine identifiers redacted from prompt archive under documented exclusions; no password was supplied or stored in source.

Apple accepted the upload for processing: submission b81ba7b8-f090-4937-ba4c-02d59f777a20. This is upload acceptance, not notarization approval. Deep signature verification passed again; waiting on Apple before stapling and Gatekeeper assessment.


### PM060 pending external-review checkpoint

Top three outcomes:
1. Confirmed the owner-stored soma-notary profile works with Apple, reverified the signed bundle, and successfully uploaded submission b81ba7b8-f090-4937-ba4c-02d59f777a20. Apple still reports In Progress after several minutes. This is not approval.
2. Inspected 18 bundled asar entries; no environment/key/private-session/local-data paths found. Recorded exact submitted archive SHA-256 682e6c06f4acde6c58fd51501dabb803debf397d557a0994ea7801311f292fd9. No credential value was read into source or model/provider context; prompt identifiers redacted as documented.
3. Kept the existing release command running (exec session 28575). It will staple/validate, Gatekeeper-check and create the final ZIP only after Apple processing succeeds. No final distribution ZIP, stapling success or Gatekeeper approval is claimed. Current test app preserved. No inference, budget change, repost/submission duplication or code commit. Remaining external dependency is Apple's queue; no further owner input is currently needed.

## PM061–PM062 — Checked counterfactual experience; training and 3D research (October 29)

Checkpoint outcomes:
1. Implemented Spark-selected edge-cost probes, solver-generated interventions/exact direct-route ties, persisted controls, same-cost BFS/Dijkstra comparison and a compact visual control. First typecheck/54 focused checks and 36 browser journeys passed. Subsequent control-context refinements are undergoing isolated verification; actual new-tool inference and final screenshots are still pending.
2. Researched official Glimmer QLoRA/Axolotl guidance, provider GPU pricing and Three.js APIs. Scoped a narrow experiment-planner adapter with topology-separated evaluation and an optional cost-landscape renderer. Neither training nor 3D implementation/performance is claimed. Source links, proposed gates and cost estimate are recorded in MODEL_AND_GRAPHICS_EXPERIMENTS.md.
3. PM062 approved $15 total shared testing spend. Updated local and production cap without resetting $4.55349675 consumption/retained reservations. GPU spend remains unapproved. Preserving unrelated working-tree changes through a separate release overlay. Initial browser start failed at sandbox localhost binding and then passed with the authorized elevated runner. One overlay setup command named a not-yet-created working directory and executed nothing; reran setup from the repository root.

Deviations: adds a bounded interaction within the current checked graph family. No new family, model-count expansion, GPU job or 3D dependency. Source fit, learning benefit, uniqueness and reference-video quality parity remain unproven. Release, live new-tool test and final evidence follow below.

### PM061 live compatibility checkpoint

First hosted generation rejected its candidate (422/generation_invalid), preserving the original artifact; synthetic cleanup passed. A local instrumented synthetic repeat exposed a missing algorithm-state panel, then an internally inconsistent Wonder response (approve with nonempty findings). Kept both validators strict. Clarified required frontier/state-table panels and reviewer verdict/findings semantics. The next actual Spark/Wonder synthetic service test passed (23.30s total test duration; not a latency distribution). Final hosted corrected snapshot remains to be verified. All failed-call consumption remains counted; no budget reset. First fixture test also needed a required source argument and an explicit library-resume action after reload; corrected fixture/typecheck and keyboard/phone test passed. Final isolated 55 focused checks passed before these instruction-only corrections.

### PM061 first corrected hosted acceptance and presentation review

Corrected production snapshot dpl_9anHkbfRBLaZyZUzRxNzbDxvyFRj passed actual Spark edge selection → six solver cases → composition → Wonder approval, with three calls, 16.097s recorded generation time and $0.05761025 recorded model cost. Exact direct-route tie was 3. Keyboard cost change to 2, both route-cost readouts, HTTP save, real guest-store reopen, reduced-motion phone no-overflow and synthetic cleanup passed. Shared ledger reached $4.86250975/$15. This is one synthetic graph, not model generalization, learning impact or reviewer-quality evidence.

Inspected actual desktop/phone screenshots. Found the slider too far below the graph due to an expanded generated cost table. Moved the experiment into the scene immediately after graph panels and collapsed detailed node costs. Kept current controls interruptible during model preparation and disabled new cost investigations with no selected goal. Final isolated TypeScript/55 focused checks and all 37 browser journeys passed after this presentation change. Final layout deployment and hosted visual verification follow below. Prior failed and successful results retained separately under ignored .local/pm061.

### PM060 notarization completion, observed during PM061

Existing release command completed successfully without another submission. Apple status Accepted for b81ba7b8-f090-4937-ba4c-02d59f777a20; staple and validate passed; Gatekeeper accepted with source Notarized Developer ID. Final 116 MiB archive .local/desktop-release/Soma-macOS-arm64.zip has SHA-256 61e5e27860dfbc3d8d4f7c9d8126d5f3bf50424664c4bdaa7eb2a5ff2fe98588. Updated desktop guide and ignored submission state. No credentials exported; no clean-Mac installation or actual capture-permission claim.

### PM061 repeated live gate and narrowed experiment composition

A further live request rejected its candidate; cleanup passed. This supersedes any interpretation that one successful full-scene experiment established reliable generation. Narrowed the experiment follow-up to choose_cost_probe → application-checked cases → compose_cost_experiment (bounded objective/trace-bound captions/narration/follow-ups) → targeted Wonder review. The application preserves the validated graph, layout, source/model bindings and controls, and rejects invalid references. Initial source-to-scene composition remains model-authored; this narrower turn does not regenerate the layout. An inconsistent approval with actionable findings now becomes a revision request rather than silently discarding defects.

The first narrowed live review identified an actual inherited prepared-example defect: primary Dijkstra frontier metadata still said FIFO. It also flagged overconfident tie/path wording and ambiguous direct-edge versus whole-path cost. Fixed prepared and copied frontier labels from the checked algorithm, clarified tie semantics, and enlarged bounded reviewer finding length from 240 to 480 characters so useful diagnostics reach the author. Added a regression check for the mislabeled frontier and a bounded invalid-trace repair case. A script-edit command used the release working directory instead of the repository root; the edit did not execute, and was rerun correctly before hosted verification. No rollback/reset of failed-call spending.

PM061 narrowed-contract local acceptance: actual Spark/Wonder run passed in 14.406s recorded generation time, three calls and $0.03917725 recorded cost. No repair was required. The owned checked graph/layout stayed stable. Final isolated TypeScript and 56 focused tests passed, including invalid-trace repair and priority/FIFO label regression. Cumulative ledger $5.07962625/$15 before the final hosted narrowed-contract check. No GPU spend. An attempted re-creation of the already-existing isolated node_modules symlink returned FileExistsError after all overlay files/hashes were copied; existing symlink was valid and isolated checks passed.

### PM061–PM062 final release outcomes

1. Published isolated snapshot dpl_BRWN1WeoRaACbdFWkBRYz3LAkq6m (https://soma-oxtjwe5b3-jeremiah-sakudas-projects.vercel.app); canonical https://soma-woad-beta.vercel.app/explore. Hosted compilation/typecheck passed. Final actual Spark → checked experiment → narrow composition → Wonder approval passed with three calls, 14.351s and $0.03934625. Cost 4 produced path costs 3 versus 4; cost 2 produced two direct paths at 2. Inspected both actual screenshots. Control placement, keyboard, HTTP save/real persistence resume, reduced-motion phone and cleanup passed. Recorded under .local/pm061/hosted-results.json; earlier failures and prior successes remain separately retained.
2. Final isolated typecheck/56 focused checks passed. All 37 browser journeys passed after the layout refactor; focused fractional-slider rerun passed. These gates cover the implemented bounded slice, not general course fit or all model outputs. Weighted playback remains static checked states; label density/progressive weighted motion remain polish work. No reference-video parity or learning benefit claimed. Preserved unrelated checkout changes; no repository commit/push.
3. Fine-tuning and 3D proposals include official sources, a narrow Glimmer adapter task, topology-separated evaluation, proposed compute estimate and optional same-engine 3D cost landscape. Neither is trained/implemented. PM062's $15 cap is configured locally and in production; final consumed ledger $5.1189725 retains earlier failures/reservations. GPU training remains separately unapproved. Apple signing/notarization also completed under PM060, with final archive linked in the desktop guide. October 31 freeze and November 4 deadline retained.

## PM063 thorough audit with independent subagent reviews October 29

Verbatim human request is retained in docs/build-log/prompts.json. Platform Page/browser context and inter-agent messages are excluded. Repeated PM062 clarification envelopes used the same question item and do not constitute a second budget increase.

Top three outcomes:
1. Completed three independent reviews against the supplied rubric: Impact 6.5/10, Meta tooling 7.5/10, Technical Depth/Execution 8/10 and Demo 7/10; weighted midpoint 7.175, not a placement prediction. Confirmed ordinary auto-follow-up reset through two zero-network actual service/SQLite reproductions, and undirected weighted arrow/path defects through code reproduction plus a fresh live rendered source. Measured a 3,637px page and distant composer at representative 620×704 companion content size. Recorded copy, label/caption, source-fidelity, experiment-selection and documentation limitations.
2. Executed root typecheck and the complete offline unit/service suite. Initial sandbox run had 48 localhost-binding failures; elevated rerun with live flags/API credentials disabled passed 1,369 tests, 92 skipped (108 files passed, 38 skipped). Independent numerical audit matched 1,000 deterministic graphs against a Floyd–Warshall oracle; four desktop policy tests passed. Three fresh synthetic screenshot requests: directed weighted source and undirected fractional-cost source published with correct source facts and costs in 10.992s/$0.03835675 and 13.229s/$0.040084; attention slide rejected HTTP422/generation_invalid in 7.431s including setup. Published artifacts deleted. Tiny development sample is not a general reliability rate or actual-course evidence. Final shared test ledger $5.20537675/$15; no reset/GPU spend.
3. Wrote docs/HACKATHON_AUDIT_2026_10_29.md and docs/IMPROVEMENT_PLAN_2026_10_29.md with ranked work, estimates, acceptance/stopping gates, source links and a current video proposal. Verified GitHub repository is PRIVATE and remote HEAD 08d0eb23f358223cf327721e8fd34dffa4094215 lacks key deployed native/voice/experiment files. Refreshed handoff/build-plan pointers; preserved historical records. No product code fixes, deployment, code commit/push, visibility change, private capture, OS permission request or training job. Plan proposals are not adopted features. Freeze/deadline retained.

Evidence remains under ignored .local/audit-pm063/: offline logs, source inputs/results/renders, UX metrics/screenshots and actual preservation reproduction. Official competitor descriptions were verified as capability claims; no claim that those products cannot match Soma or that the current project is likely to place. All three reviewers completed; no further subagent work remains.

PM063 final rendering check: a zero-network React render reproduction confirmed semantically identical implicit and explicit algorithm:bfs inputs return the same path/visit order but choose animated versus static renderer respectively. Added that dispatch regression to the audit and plan; the same static branch carries the undirected-direction defect. Source/app files were not changed. Reproduction and results are in .local/audit-pm063/engineering/renderer-dispatch.*. Final document links, archive and whitespace validation passed.

## PM064 — Audit fixes and reproducible release (October 29)

User authorized addressing all six audit findings. Work in progress: preservation guard and rendering regressions; compact companion layout; bounded fresh generation evaluation with retained failures; reviewed source release. No new results, deployment, publication or training claimed at this checkpoint. Preserve the $15 shared test allowance and prior ledger. Initial archive append used the wrong root key and made no change; corrected to canonical entries.

### PM064 implementation and evaluation checkpoint

Added application-side auto-follow-up preservation, undirected weighted path/direction/self-loop rendering, metadata-independent BFS dispatch, strict null explanation bindings and bounded failure-stage facts. Native layout now groups one graph, paired route costs, step/experiment action and a fixed question composer. New browser acceptance caught a weighted selected-object label using its internal ID; fixed it.

Actual attention debugging retained two failed requests: plain response instead of interpretation tool, then invalid trace binding. Stage instructions and the explanation schema were corrected; subsequent actual synthetic attention generation published. Frozen 13-case fresh source evaluation published all eight graphs with matching source facts and independent-reference costs; both explanations, blank-source clarification and negative-cost refusal category succeeded. Missing-cost material was safely rejected on artifact binding rather than clarifying. This is 12/13 intended artifact/refusal outcomes, not a general reliability rate. Evaluation cost $0.496014 includes that failure. Shared ledger read $5.8081165/$15, with prior usage preserved. No GPU work.

Clean submission candidate installed from lockfiles; typecheck, production build, isolated browser artifact (1,224 files/two links/zero private mappings), four desktop checks and 1,360 offline tests passed (89 opt-in skipped). First isolated offline run lacked the separate services' installed ws dependency; installed pinned service dependencies. Updated a stale scripted provider fixture that identified stage by tool count/order. First broad browser run had six timeouts during overlapping build/CPU work; separate rerun passed all six. Final complete browser batch remains running. Native browser acceptance passes at 620×704: graph above composer, both cost selectors and experiment action visible. Measured page 1,961px versus audit 3,637px; composer y564 versus y2919. Actual OS testing remains separate.

Source export excludes private history and unrelated current v1 changes. Targeted scan of 411 candidate files against seven configured server-secret values and private-file/identifier rules found no matches. Runtime fingerprint records 196 files. Publication and deployment still pending at this checkpoint. Several shell preparation attempts used the repository-relative path from an already-selected nested directory; those writes did not execute, and were rerun from the correct directory. No private file was overwritten.

### PM064 final outcomes

1. Delivered all six audit work items within the current companion scope. Root implementation and docs reflect the preservation boundary, corrected graph visuals/BFS motion, compact native view and safe generation diagnostics. Clean source passed typecheck/build, 1,360 offline tests (89 skipped), four desktop policy checks and all 101 browser journeys in the final batch. GitHub CI 40967260561 also completed successfully. Earlier failed harness/build-concurrency runs remain retained rather than replaced by the successful result.
2. Published reviewed source at https://github.com/Jeremiah-Sakuda/soma-hackathon, commit aa8c15c7a990a339e20d835f0efcdd6369caa436, preserving the original private history and unrelated v1 changes. Deployed dpl_yJh4DP7eYyw76b7Zj2fHVbZzzdQz, canonical https://soma-woad-beta.vercel.app/explore. Its 196-file fingerprint matches the public source and hosted release.json. First Git-associated CLI deployment rejected Not authorized; the identical committed source archive uploaded successfully through the existing project without broadening authorization. Signed/notarized Mac ZIP attached to public release v0.1.0; GitHub-reported SHA-256 matches the previously verified archive.
3. Final actual hosted tests passed state preservation with cost2/disabled edge/changed goal/order plus real save/reopen, fresh undirected source/cost/highlight/no-arrow rendering, phone layout and synthetic cleanup. Auto follow-up required one Wonder-directed revision (four calls/$0.092412/22.452s); fresh graph used three calls/$0.03996975/18.351s. Fresh 13-case evidence retains the missing-cost rejection and distinguishes 12 intended artifacts/refusal categories from broad reliability. Native permissions/audio/clean-Mac/actual-course tests remain human gates. No GPU training, 3D implementation, model-count expansion or private-history publication.

Release/source/check artifacts: .local/pm064/release-manifest.json, hosted-results.json, clean-offline-final.log, clean-e2e-final.log, browser-artifact-final.log, evaluation-results.json and privacy-scan.json. Detailed status and limits are in the latest PM064 validation section. The six requested audit fixes are complete; remaining limitations are explicitly recorded.

Final shared ledger read: **$5.94049825 / $15 total**, including prior failures and retained reservations. No reset.

## PM065 — General screenshot acceptance (October 29)

Owner requested proving general screenshots rather than prepared examples. Auditing the live screenshot path and testing fresh cross-domain screenshots with generic questions, including real public educational pages, code/data/diagram views and ambiguous material. Original production fingerprint retained. Shared $15 allowance remains; previous ledger $5.94049825. Outcomes pending; no general reliability or arbitrary-topic simulation claim.

### PM065 final outcomes

1. Audited the upload/capture path: screenshot pixels reach Spark, sourceText is null for a new screenshot, no prepared-example action or graph facts are injected, and only the interpretation call sees the raw image. Tested nine frozen screenshots through production with identical generic questions and opaque labels: real MDN, Google and OpenStax pages plus code variants, worksheet, circuit, cache process and unreadable crop. Eight first requests produced the intended explanation/clarification. The OpenStax source rejected once, then a separate local diagnostic succeeded before the change; its original failure cause is not established. Kept first results. Exact 7→9→11 versus 11→14→17 output changes matched the two code images; worksheet/circuit/process facts matched their visible content. Successful source-specific artifacts stepped, selected objects and persisted. No universal reliability claim.
2. Tightened provider contracts to application-owned ID/version/source literals and available computation modes, retaining independent strict publication checks. Fixed actual crowded generated diagram labels with stable presentation-only spacing, readable card dimensions, annotation placement and self-loop headroom. No source facts, IDs, connections or saved specs are rewritten by layout. Added application-contract regressions, 2–29-card geometry checks and desktop/620px/phone reduced-motion browser checks. UI skill searches gave no exact collision rule; relied on observed rendering and geometry verification. Initial source-copy command used a nested relative path and wrote nothing; reran with absolute roots. First browser run conflicted with the preview server, then the new dense test helper expected the prepared BFS title; fixed the harness and reran. Existing 35 related browser journeys and the corrected dense case passed. Offline suite passed 1,365 before the final headroom case; focused final layout tests passed four cases. Public CI completed successfully, including the full updated suite, build/artifact checks and 102 browser journeys.
3. Published source b41c16f7a56193854d3cafce368b0a939fd5f374 and deployed dpl_2wmd1xkmEy42t9tHNNrJ2vdMQyAj to the existing canonical URL through a committed source archive. Runtime fingerprint covers 197 files. Three fresh post-change production screenshots passed: real UI upload of counter23/+5 with outputs28/33, water cycle, and results/rows debugging. UI request inspection showed zero prepared-example calls. Selected-object follow-up, save/reload/reopen and cleanup passed. Direct API harness initially missed guest initialization for two cases, causing pre-inference session_expired; retained those results, corrected the wait and completed the first authorized model requests. A checked BFS source regression also passed. Actual renders/text were inspected. Final shared ledger $6.480941/$15 retains earlier failures/reservations; no GPU/training/model-count expansion.

Detailed evidence: docs/GENERAL_SCREENSHOT_VALIDATION.md. Private artifacts: .local/pm065/cases.json, results.json, final-hosted-results-first.json, remaining-hosted-results.json, graph-smoke-results.json, release-manifest.json and actual source/render images. Public original-only fixtures and baseline results are committed; actual public-page captures remain private. Existing signed/notarized shell loads the updated web engine without a native binary change. Arbitrary verified simulations, real coursework and actual device/audio gates remain outside these results.

PM065 final public-source check: anonymous fetch of the committed release manifest exactly matched live production, release soma-pm065-2026-10-29, 197 runtime files, fingerprint 6e0e89a5ffc9c3c626f0106915f8469112d50a3c43df3f689a22e681b5b674b6. Documentation/archive JSON and whitespace checks passed. No further product changes after the successful source/production checks.

## PM066 — Voice and animation timing clarification

1. Inspected the playback, motion and renderer implementations. Gemini clip elapsed time drives normalized animation progress; actual audio completion advances the step. This is code inspection, not a new audible device test.
2. Confirmed the limits: choreography uses proportional beats rather than spoken word timestamps; BFS and general diagrams animate, while weighted/Dijkstra states are static. Browser speech fallback displays settled visuals, and reduced motion disables animation.
3. Answered the current behavior without changing product code, running provider requests or redeploying. Shared paid-test ledger remains $6.480941/$15.

## PM067 — Independent four-judge rubric panel (October 29)

Verbatim request and pasted participant-guide page are retained in docs/build-log/prompts.json. The user asked to assume the demo video exists and the repository is public.

1. Ran four independent read-only judge subagents (Meta platform, investor/product, senior engineer, demo/UX), each scoring the full rubric without access to the PM063 audit, improvement plan or rubric proposal. Weighted totals 6.7, 6.4, 6.6 and 6.1; category means Impact 5.6, Meta tooling 6.8, Technical depth 7.4, Demo 6.25; panel weighted mean about 6.4. All four passed Stage One, noting moderate "simple image analyzer / AI for Education" misclassification risk. These are reviewer judgments, not placement predictions; this panel is calibrated harsher than PM063's 7.2.
2. Parent verification: the public submission repository Jeremiah-Sakuda/soma-hackathon is PUBLIC and contains cost-probe.ts and desktop/, so the engineer's "public repo lacks the demo" finding applies only to the private root repository; its judge-facing README already discloses Gemini narration. Code reading confirms a reuse-path follow-up calls probeEdgeCost on the effective graph with disabled edges removed (exploration.ts reuse branch; exploration-view.ts filter), which throws a plain Error if the probed edge is disabled or the goal cleared; not reproduced at runtime. Global spend consumption is lifetime (somaBudget/global), with per-workspace daily counts; production cap value not inspected. The demo judge observed live weighted-label overlaps on the prepared example (S→Goal "10" over A→B, "cost: 2" over "6", "Unco…" truncation).
3. Consensus improvements: surface the Spark→checker→Wonder pipeline in the UI and video; rewrite the video storyboard to match /explore; run a small real-student trial; fix weighted label placement and the disabled-probe follow-up; format v2 code readably; harden the judging-week budget. No product code, deployment, provider spend, repository visibility change or commit in this prompt. The demo judge left one guest save that expires in 24 hours.

## PM068 — Evaluation of panel feedback

1. Read the panel record and inspected current exploration, probe, workspace and budget code. Confirmed by code reading the unguarded probe recomputation for a removed edge/cleared goal; no runtime reproduction this turn. Current UI already names Live Muse Spark and the experiment names Muse, so the categorical no-Muse claim is incorrect; preparation audit remains collapsed. Demo docs mix active and historical narratives. Lifetime spend cap is confirmed; actual production capacity and remaining cap were not inspected.
2. Recommended correctness/weighted legibility first, a concise current demo plus fresh screenshot and clearly labeled recorded generation, student task observation, selective visible advisory review and readability/operational verification. Distinguished model consensus and speculative score lifts from empirical placement evidence. General screenshot explanations are broader than checked BFS/Dijkstra computation. Advised retaining voice quality rather than switching vendors for appearances, and no forced reviewer rejection or extra model scope.
3. Evaluation only: no product edits, provider calls, deployments, budget changes or new agents. Paid-test ledger remains $6.480941/$15. Proposed work remains unimplemented by this prompt.

## PM069 — Panel-driven experience iteration

Implementation authorized: prioritize unavailable-probe follow-up recovery, weighted graph legibility/motion, truthful visible model pipeline, current demo story and source readability. Beginning from PM065 public source; preserve unrelated root changes. Results pending. No new model, GPU work or budget increase. Shared test ledger $6.480941/$15 remains.

## PM070 — Story, judge-facing documentation and demo script (October 29)

Verbatim request retained in docs/build-log/prompts.json as PM070. It was first appended as PM068 and renumbered because a concurrent session had already used PM068 and PM069 for other prompts. The user asked for documentation and framing that tells a winning story without hiding limits. No product code, deployment, provider spend, commit or push.

1. Rewrote the public `soma-hackathon` README around a story-led structure: problem, gap, product, a model-proposes/code-proves pipeline with a Mermaid diagram, impact with three verified citations (Hundhausen et al. 2002; Naps et al. 2002; Bastani et al. PNAS 2025), a Meta model table, test evidence, built-during-hackathon, what comes next and a concise scope section. Reframed public ARCHITECTURE, VERIFICATION and GENERAL_SCREENSHOTS openings and corrected the stale 196-file count to 197. Edits are Markdown only and excluded from the release fingerprint.
2. Wrote docs/STORY_AND_DEMO.md: five-beat story, pitches, a timed three-minute script with required disclosure labels and a recording checklist, submission form copy, an X post, judge Q&A and a claims ledger. Added pointers from CODEX_HANDOFF.md and the PM069 section of DEMO_AND_EVALUATION.md.
3. An independent fact-check against deployed source b41c16f found overclaims in the first draft. Corrected all must-fix items:
   - "every number" is now limited to paths, costs and search states on supported graphs
   - the graph set is described as small original synthetic images
   - real public pages are distinguished from original test images
   - Wonder is described as advisory and limited to weighted and prediction cards
   - the slider re-runs searches locally, and the exact tie applies only to direct edges
   - Spark has four tools
   - the clarification claim is softened
   - native capture is not yet hand-verified
   - production checks are attributed to the UI or the API harness
   - the video script avoids disabling the probed edge
   
   Production screenshots of the prepared examples still show overlapping weighted labels and an "Unco…" truncation, so no screenshot was added to the README; use a GIF from the recorded video. A concurrent PM069 writer has uncommitted source changes in the same public checkout, and verify-release now fails on those, not on these docs. Release claims hold for committed b41c16f until PM069 is released with a new fingerprint.

### PM069 implementation checkpoint

Implemented unavailable-probe recovery with source/current-input/version preservation and save/reopen regressions; readable weighted cards/cost badges and checked weighted replay; visible recorded model actions and bounded actual review findings; a genuine original-synthetic Spark/Wonder recording with no inference on opening; bounded configurable concurrency; readable formatting across v2 modules; current demo/student observation protocols. The recording rebinds owned IDs without changing original generated content or historical usage. It does not simulate live generation. No extra model or training scope.

First focused checks exposed two incorrect test expectations (prior goal cost was 10, not 8; actual generated IDs were uppercase P/Q/R), a crowded label candidate, then wide experiment-action placement, duplicate route announcements and native composer occlusion. Corrected these, retained failure logs. Five browser journeys passed after those fixes. Further visual inspection motivated wider full-label cards, stronger connection contrast and fewer crossings; final complete release checks are running. Initial full offline run hit 48 sandbox localhost-binding failures; permitted synthetic-server rerun passed 1,374 tests with 89 opt-in skips. No model calls in these tests.

Read the durable spending ledger: $6.480941 consumed; existing local configured cap is $15. Protected deployment variables were pulled to an ignored mode-0600 file; their sensitive values are unavailable in the pull, so that does not establish actual production cap/review values. No cap reset, budget increase or concurrency increase was performed. Provider capacity remains a separate verification condition; recorded/saved material remains usable without generation.

Preserved pre-existing uncommitted public-checkout prose changes. Prepared a new isolated clean release from public commit b41c16f7a56193854d3cafce368b0a939fd5f374 at .local/pm069/submission and copied only scoped product/test changes plus explicit new docs, rather than publishing unrelated edits. Earlier checkout and private root history are retained. New release is not deployed at this checkpoint. Human student trials, final footage, phrase-aligned speech and native audible-quality verification remain unclaimed.

## PM071 — Publish the judge-facing docs (October 29)

The user approved committing and pushing the doc files ("Yes", archived as PM071).

1. Before committing, found that the PM069 writer had pushed aeea0c6 and 01778ec to `soma-hackathon`. Production already served release soma-pm069-2026-10-29 (202 files). Those commits edited README, ARCHITECTURE and VERIFICATION, and added public DEMO.md and STUDENT_TRIAL.md. To avoid touching the shared dirty checkout, merged the PM070 docs in a clean temporary worktree from origin. The merge folded in the recorded Muse run, visible pipeline strip, weighted settlement/relaxation animation, the unavailable-probe recovery, the concurrency setting and the 1,374-test suite. Updated the reproducibility count to 202. Removed a link from public DEMO.md to the private STORY_AND_DEMO.md, plus internal PM jargon in that file.
2. Checks before pushing: zero broken relative Markdown links and a clean `git diff --check`. `verify-release.mjs` verified 202 files with fingerprint 2722c0b0…, matching live `/release.json`, and CI run 40994621511 on the upstream commit had succeeded. Pushed b000a34 to `codex/submission-release`, and GitHub serves the new README. CI on b000a34 was not awaited in this turn.
3. Removed the temporary worktree and restored the four doc files in `.local/pm064/submission` to that checkout's HEAD. The pushed versions supersede them, and the PM069 source changes there were left untouched. Updated STORY_AND_DEMO.md for the PM069 UI: the *Muse Spark generated* badge, the pipeline strip, the recorded-run fallback, the fixed follow-up path and new claims-ledger values. Open items: add the video link to the README, and the PM069 checkout is now three commits behind origin.

### PM069 hosted verification and final native correction

Public source 01778eca9372083c51eba87b2f07daaac26a0299 and deployment dpl_FsHU45ENBN8yonf2rVvtZETLg6ei passed CI 40994621511 (all 105 browser journeys). Actual hosted recording/save/reopen made no generation action. Both real Spark/Wonder probe follow-ups passed when the probed edge was disabled or goal cleared; changed costs, paired inputs, source lineage and save/reopen were preserved. First hosted harness expected the internal event spelling rather than the displayed humanized label; corrected only the harness, retaining the first result and cleanup.

The new original weighted screenshot rejected on its first request (generation_invalid). A diagnostic query over multiple guest records was rejected by automatic approval review because it could expose unrelated learner data; it did not run. Continued with a safer, explicitly cookie-identified new synthetic session and inspected only that session's exact document. One controlled repeat published a correct five-edge graph and L → M → N at cost7 versus direct13. Original rejection cause is not established. First results and the repeat are both retained; no causal reliability improvement is claimed. All published synthetic artifacts were removed.

Visual inspection of actual revised native cards exposed version-history space above the graph. Moved that control below the visual on the latest compact revision, keeping the version badge and earlier-version warning. Added a 620×704 revised-card acceptance case. The first typed fixture incorrectly narrowed model to null, and initial native measurements still overlapped the composer by 8.5/6.5px; widened its test type and removed excess panel/pipeline spacing while retaining graph size. Four final compact/replay/geometry journeys passed; typecheck passed. Final build/publication update is running. No new server generation behavior or extra model was added by this final layout correction.

Final durable spending read: **$6.72575325 / $15 total**, preserving earlier consumption/reservations. No additional inference is planned for the layout-only deployment. Private artifacts are under .local/pm069, including first and corrected harness logs, actual probe/follow-up records, the synthetic source and diagnostic result. Real student trial, finished video and native audible-quality checks remain human work, with scripts prepared.

### PM069 final outcomes

1. Delivered unavailable-probe follow-up recovery, separated weighted labels/full node names, checked weighted settlement/relaxation replay, truthful visible model activity and a genuine recorded synthetic-source run. The replay makes no provider request when opened and retains historical time/cost. Selective Wonder review remains; actual advisory findings are recorded. V2 source is formatted readably. Latest compact revision history moves below the visual, retaining version/earlier-version signals. Configurable concurrency remains bounded 1–16, default4; no capacity or spend allowance increase. Updated current demo/story and prepared a real-student observation kit, with no fabricated users, quotes or video.
2. Final offline suite passed 1,374 tests (89 skipped); typecheck/build, isolated browser trace (1,224 files/two links/zero private mappings), four desktop policy checks and public CI 40996515692 passed. Actual hosted recording/save/reopen required no generation. Both paid probe follow-ups preserve disabled edge/cleared goal, changed cost, paired graph, source and saved state. A final real Spark/Wonder revision took 7.764s/two calls/$0.02794875 and fit graph y268–500 above composer y564 at 620×704, with version history below and saved version2 verified. The first fresh weighted screenshot rejected; one controlled repeat matched all five edges/costs and path L→M→N (7 versus direct13). First rejection cause remains unknown. Earlier failed test/harness runs and the permission-review rejection are retained; only the explicitly identified new synthetic guest record was read for the safer diagnostic.
3. Published merged source 58668137c15471a16a1702fad2b057de3d27b7b9 to the existing public branch and deployed dpl_BSMfRHZrNf7RG9kxrMw1mrKEzfTV. A concurrent documentation commit b000a34 caused a non-fast-forward push; fetched and merged it without overwriting or force-pushing. Existing private root/older-checkout prose edits remain untouched. Anonymous source manifest equals production: soma-pm069-2026-10-29-r2, 202 files, SHA-256 4d74e6d0aea83393bb2287deea65f65cd3db59658f1d42497beb27b27f8a18c7. Exact committed upload is .local/pm069/deploy-r2; release-manifest.json, CI logs, native screenshots, actual provider artifacts and cleanup records remain ignored. Final durable spend $6.753702/$15, including all earlier consumption/reservations. Signed shell unchanged. No further inference planned; student trials, final footage and native audible/clean-Mac gates remain human work.

PM069 final CI count: all 106 browser journeys passed, alongside 1,374 offline tests. Public source and production checks are complete; no new inference after the final $6.753702 ledger read. Canonical prompt JSON parses. Root whitespace scan surfaced an older whitespace-only BUILD_LOG line in preserved historical material; public source whitespace validation passed. A private-document check was initially invoked from the nested source checkout and made no writes; rerun from the correct root.

## PM072 — Selective v1 reuse without scope growth

1. Reviewed the v1-to-v2 bridges and current optional prediction implementation. V2 already records original diagram-visible predictions, reveal/assistance and source/model/state lineage, and supports explicit answer-informed visuals. It does not currently provide fresh delayed independent assessment or project those records into the v1 learning graph. Existing source-selection and unattended-preparation bridges remain proposals.
2. Recommended one optional fresh application exercise from a saved exploration as the most coherent next addition: reuse evidence/assistance patterns, keep it inside the existing visual and save/revisit flow, compute supported answers with the solver, and preserve actual timestamps/exposure without claiming mastery. Deferred the student hub, LMS setup, scheduling, graph dashboard and automatic source preparation; adding another model family is a separate integration rather than a free reuse.
3. Advice only: no product or scope decision adopted, source changes, provider calls, deployments or new agents. Shared testing ledger remains $6.753702/$15. Current release correctness and human experience checks retain priority; this proposal is not claimed implemented.

## PM073 — Fresh application from saved explorations

Implementation authorized for one optional fresh, solver-checked graph exercise inside the existing save/revisit flow. Preserve original predictions, assistance, timestamps and source/model/version lineage. No separate dashboard, compulsory assessment, new model family, source monitoring or budget increase. Working from current public source in .local/pm069/submission, preserving unrelated root changes. Implementation and checks pending.

### PM073 implementation checkpoint

Implemented original same-family graph variations, server-only unrevealed solutions, immutable numeric answers/reasons, recorded hints/reveals, actual timestamps and source/model/version lineage. A post-attempt checked visual reuses existing controls and can request Spark composition using the real answer. Added bounded persistence, ownership checks, idempotent actions, parent/derived deletion behavior and a return to the original. First focused provider/route/domain checks passed 62 cases; subsequent fresh-specific checks passed 9 cases, including an independent shortest-distance reference over 300 variants and a response-adapted publication/failure-context check. Eight browser journeys passed across existing predictions, compact cards and new fresh practice, including reload and failed-save recovery. Visual inspection prompted responsive graph coordinates for phone legibility. Full release checks, real-provider verification and deployment remain pending. No provider calls this turn so far; shared ledger remains $6.753702/$15.

## PM074 — Architecture review with the improve-codebase-architecture skill (October 30)

Ran the user-supplied third-party skill (EAIconsulting/mattpock-skills `improve-codebase-architecture`, with its `codebase-design` vocabulary) read-only against the shipped exploration modules at public commit `5866813`. The skill's history scan pointed away from the parked v1 hot spots, so the review covered the v2 exploration server and client modules. Two read-only subagents surveyed them; the parent re-read the cited code before reporting. No source, tests, provider calls, deployments or commits changed. Shared ledger unchanged.

1. Produced a private HTML report outside the repository (session scratchpad, `architecture-review.html`) with eight deepening candidates. Five are rated Strong: effective-experiment module, turn acceptance, provider seam at typed Spark decisions, metered spend, client explore-turn protocol. Two are rated Worth exploring: step clock, run lifecycle and leases. One is Speculative: compact breakpoint. Top recommendation: one effective-experiment module shared by client and server. The graph the student is looking at is currently rebuilt five times under three rules. Timing is after the October 31 freeze.
2. Found by reading, not reproduced or fixed:
   - In `exploration.ts:1112–1311`, a Wonder transport or parse failure on the first attempt is handled as a bad scene and spends a second paid Spark compose.
   - Three domain validation messages fall through to `scene_invalid`.
   - The voice "Question transcribed" notice is cleared by the `turnKey` change it triggers.
   - Prediction history goes stale when stepping away from and back to a checked state (inferred).
   - Narration and transcription leases also consume exploration turns (intent unknown).
   These are correctness candidates, not adopted fixes.
3. Pending: the skill's grilling loop on a chosen candidate. `CONTEXT.md` predates v2 and lacks exploration terms, and `docs/adr/` does not exist; `DECISIONS.md` served as the decision record. Note that the concurrent PM073 work changes the prediction and workspace modules after `5866813`.

### PM073 release preparation

The complete local offline suite passed 1,383 tests (89 opt-in skipped); a subsequently added HTTP case passed with all 15 affected service/route cases. All 110 browser journeys passed. Visual inspection caught inherited compact SVG height caps shrinking the new phone graph; scoped its static graph separately and reran four fresh-practice journeys with actual rendered-label-height assertions, all passed. Production build, typecheck, isolated artifact import (1,224 traced files/two links/zero private mappings) and four desktop policy checks passed. A sandboxed font-dependent build stalled and was stopped; the network-enabled build passed. Final CSS-only build is being confirmed. Public branch baseline matches 5866813 and all six existing modified root files match that baseline, so scoped synchronization can preserve unrelated work. An initial Git read accidentally targeted the private root remote and found no public branch; the correct public checkout was then verified. Shared budget record is still $6.753702/$15. No provider call or deployment yet.

### PM073 hosted check and revisit correction

Published f657cc3 and deployment dpl_3Nfey9fKA68MSB1bYduFuaLXPQ64 (204-file fingerprint 57c80686…). Clean CI 41003567419 passed. The first real fresh-answer composition passed solver/input/lineage checks and Wonder review: 2 calls, 11.404s, $0.03626125. The hosted harness then timed out waiting for the generated title; its stage was not recorded, so the first result is retained without claiming an established failure stage. Local and production replays of the actual response (including a 12-second delay) rendered successfully without provider calls. A new deterministic saved-child/reload browser regression reproduced a history-order defect: the local UI prepended updated cards, but the server returned creation order after reload, selecting the original first. Fixing consistent recent-first ordering and default active selection; no change to the valid model output or composition policy. Original harness/session artifacts were cleaned; global budget is $6.78996325/$15. Final corrected release and hosted recheck pending.

### PM073 final hosted outcomes

1. Delivered optional fresh application inside saved checked explorations, with new original problems, hidden-until-check/reveal solver results, immutable answers/reasons, recorded assistance and actual timestamps/source/model/version. Opening the checked practice visual is inference-free; an explicit Spark explanation or same-graph follow-up uses the actual answered observation. Original and earlier attempts persist. Consistent recent-first history fixes reload ordering. No new family, source scheduler, learner dashboard or mastery claim. Updated scoped product/technical/experience/bridge docs and preserved unrelated root/v1 work.
2. Initial local complete offline run passed 1,383 tests (89 skipped); the final HTTP addition and all 15 affected cases passed. First clean CI 41003567419 passed its full unit/build/browser gates (110 browser journeys). The history regression failed before its correction and passed afterward with all 61 affected service/HTTP and 25 browser journeys. Actual Spark/Wonder result/lineage checks passed twice; the first hosted title wait timed out later without stage instrumentation, and the full response rendered in delayed local/hosted replays. Final stage-aware hosted verification passed actual explanation, preserved graph/answer/original, exact save/reopen and phone label/overflow checks (18px text). Final call: 2 calls/11.815s/$0.04183075. All test artifacts cleaned.
3. Published source 7b34b35c1432d9ce6dfcf708b6f243887a67f72d and production dpl_2ABujGFEqovnyENZ6GysRJrqjvWL. Public/production release soma-pm073-2026-10-30-r2 matches 204-file SHA-256 dd05971768fb423bc79d920e3f6c7d7768ba80a0a59d246945be561817b1da66. Exact committed upload .local/pm073/deploy-r2; source .local/pm069/submission; scoped root copies match. Final r2 CI 41004464496 is pending at this checkpoint. Global spending $6.831794/$15, retaining prior usage; native signature unchanged. No further model calls planned. Student evidence, finished video and actual-device audio/clean-Mac gates remain unclaimed.

### PM073 final handoff polish

Native-size screenshot inspection showed the newly opened practice visual inherited the old scroll position. Scoped the explicit practice-open action to flush its validated card, focus the existing article and scroll it into view with no animation. Four affected browser journeys passed, including heading-in-viewport and keyboard-focus assertions. Build and isolated artifact import passed. Published f2c7ad35d5fec2d23367da4b72cf6b59f3780ca6 with a new 204-file manifest (soma-pm073-2026-10-30-r3, 8ee82b976e73c1a49070b65a336c02f80315d5fed546d758bc958109021a7240), and synchronized the two scoped root files. Previous corrected release CI 41004464496 passed. Final UI-only deployment/CI/hosted focus checks are recorded when complete; no new provider call or policy/model change. Shared ledger remains last-read $6.831794/$15.

### PM073 completion

Final source f2c7ad35d5fec2d23367da4b72cf6b59f3780ca6 is published; production dpl_HZ7JdrUiSrbqA6TZs7yWky1bLiSi serves soma-pm073-2026-10-30-r3. Anonymous source/production manifests match all 204 runtime files (8ee82b976e73c1a49070b65a336c02f80315d5fed546d758bc958109021a7240). Clean CI 41004986055 passed its complete unit/build/browser gates. Final production focus, fresh answer, solver-built visual, exact save/reopen, recent-first order and preserved original response passed without a generation request; heading y58–82 at 620×704 and test artifacts removed. Actual Spark/Wonder composition/save/reopen and phone legibility passed on r2; r3 changes only explicit card focus/scroll. No new inference after the last global $6.831794/$15 read.

All 11 scoped root source/test files match the published source. A final combined assertion also assumed PM073 was the last prompt ID and failed because concurrent PM074 had been appended; no source mismatch existed. Rechecked the exact PM073 verbatim entry and preserved PM074. Canonical JSON parses. Handoff, PRD/experience/technical/story boundaries and validation are current; private root history/unrelated v1 work remain unstaged. Final clean source remains .local/pm069/submission, exact upload .local/pm073/deploy-r3; release/CI/hosted/first-failure/response-replay evidence is retained in .local/pm073. Signed native shell unchanged. Student learning outcomes, finished footage and actual-device audio/clean-Mac gates are not established by this feature.

## PM075 — Rigorous usability and visual polish verification

User authorized an experience-focused test/fix pass over the released companion, including fresh generated inputs, interaction clarity, animation/narration, compact layout, keyboard/reduced motion, waiting/failure recovery and save/revisit. Keep existing scope and $15 total allowance (last read $6.831794); no training/new model family. Start from public f2c7ad3; preserve unrelated root changes and PM074 architecture review. Results pending.


### PM075 verified implementation checkpoint

Observed and fixed disappearing general diagrams during voice preparation, duplicate/remote explanation controls, first-screen desktop graph size, endpoint-label collisions and phone text shrinking. Added responsive measured-width/long-label layout, causal-order crowded reflow with cycle fallback, explicit connection legends and optional disclosures. A real baseline gradient output contradicted its own correct table; new non-graph authoring binds the ordinary grid and existing Wonder review now covers structured explanations. Review outages no longer buy another author call; cancellation keeps its own status.

The complete network-enabled offline run passed 1,394 tests (89 opt-in skipped), the complete browser run passed 116 journeys, and final affected checks passed 62 provider/domain and 28 browser journeys. Typecheck, production build, isolated browser trace and four desktop policy checks passed. Retained the initial restricted localhost-bind failure, product regressions and harness corrections separately. Real Chromium audio playback drove measured animation progress. A real isolated-profile Electron shell passed JPEG preview/focus, pin, hide/mute, activate/unmute and resize; OS capture, shortcut registration and audible hardware quality were not exercised.

Fresh original screenshots exposed both successful and failed generation: post-change gradient and held-out stack published; attention and held-out autoencoder first requests rejected, then controlled repeats published with bounded repair/Wonder review. These repeats do not erase first failures or prove their causes. Weighted source facts and cost4 were independently checked. All own synthetic guest artifacts removed. Shared ledger $7.3758095/$15; no training or new family. Detailed evidence remains private in .local/pm075; public test fixtures contain only original neutral scene specs and explicitly label the retained invalid gradient example. Final source synchronization, manifest, deployment and CI pending.


### PM075 published release and hosted usability check

Published public source 3784227188f66ebeed38fa26ce33bc37c337f4b1 and production dpl_4ZfbJeADmec9cDbys9U2VrVsebN3 from the exact committed, sanitized upload .local/pm075/deploy. Anonymous public/production manifests match all 204 runtime files: soma-pm075-2026-10-30, SHA-256 799156cb92662ef7366a68e40e701558f2f3ee59d117e23fd02d7e54b0433db7. Scoped synchronization verified 16 root source/test/release files against the prior public baseline; unrelated private root/v1 changes and concurrent PM074 remain preserved.

The hosted repeat passed all six viewport overflow checks, 45 keyboard tabs with zero obscured focus, no sub-40px visible buttons, save/fresh-practice flow and cleanup, with zero page exceptions and no provider calls. At 620×704 the prepared weighted graph panel spans y293.5–525.5 above the composer at y564; shorter phone viewports still require scrolling. Actual fresh model/audio calls were checked on the production build locally against the same shared ledger. Clean CI 41009103487 is currently through install/manifest/types/unit/build/trace/adversarial service gates and running final browser journeys; outcome pending.


### PM075 final outcomes

1. Delivered and deployed visible-at-wait general mechanisms, nearby manual narration controls, primary-diagram focus/disclosures, readable measured-width/long-label layouts, causal DAG reflow, safe connection-label fallback and compact desktop playback/weighted inspection. Structured explanatory visuals now use the existing conditional Wonder reviewer; strict publication checks, bounded repair and preserved artifacts remain. Review transport/parse failure no longer spends on another author turn, and cancellation remains distinct. No new family, training, arbitrary code, source monitoring or product surface. The decision changes and earlier broader root work remain documented/preserved.
2. Public runtime 3784227188f66ebeed38fa26ce33bc37c337f4b1 passed clean CI 41009103487: 1,396 offline tests/89 opt-in skipped, 28 isolated adversarial browser cases and all 116 browser journeys. Build/trace/manifest/types gates passed. Production dpl_4ZfbJeADmec9cDbys9U2VrVsebN3 matches all 204 runtime hashes (soma-pm075-2026-10-30, 799156cb92662ef7366a68e40e701558f2f3ee59d117e23fd02d7e54b0433db7). Hosted six-viewport/45-tab focus/save/practice checks passed without inference. Actual Chromium speech/animation and isolated actual Electron shell checks passed within the explicitly recorded capture/audio limits. Final public verification documentation is published in f4c900027fd4018c788287af4aec763d18fff1e6; its runtime is unchanged from the clean-CI release. No new deployment or duplicated manual test run is required for that documentation-only change.
3. Retained all observed failures: the original gradient arrow error, attention and held-out autoencoder first-request rejections, bounded successful repeats, sandbox HTTP-bind failures and harness-only selector/JPEG/window mistakes. Broader generation is not declared reliable or equivalent to the reference video's bespoke illustration quality. Fresh stack and gradient outputs were source-specific; weighted cost4 matched independent relaxation. No actual student outcomes, new recorded demo, OS capture/shortcut-permission test or clean-device audible quality established. Final shared consumed ledger $7.3758095/$15, including retained unknown/cancelled reservations. Canonical PM075 prompt remains verbatim with unavailable received timestamp explicitly null. Scope/freeze/deadline and unrelated PM074/private root work preserved. Full evidence .local/pm075; user-facing report docs/POLISH_AUDIT.md.


## PM076 — Live visual context and pointing feasibility (October 30)

1. Checked current source: native capture takes one display thumbnail/JPEG per explicit capture, and the web sharing path maintains a local getDisplayMedia stream but sends only an explicit frame. The current vision service allows one image per request and no video content; recorded audio/transcription is separate. Soma does not currently retain cursor trajectories or continuously update model screen context. No inference/deployment/product change occurred; shared allowance unchanged from last $7.3758095/$15 read.
2. Verified official capabilities: Electron desktopCapturer/getDisplayMedia supports live desktop video capture (https://www.electronjs.org/docs/latest/api/desktop-capturer/); Apple ScreenCaptureKit supports capture streams and showsCursor (https://developer.apple.com/documentation/screencapturekit/scstreamconfiguration/showscursor); Meta documents Spark multi-image vision/localization (https://dev.meta.ai/docs/image-understanding) and video clips by uploaded file/URL (https://dev.meta.ai/docs/video-understanding). These sources establish capture/image/video processing, not measured low latency or a persistent bidirectional screen-video session in Soma. Did not infer how the unseen demo is implemented.
3. Recommended an explicit live-help mode as a possible next refinement: bounded local recent-frame buffer plus timestamped cursor trajectory/selection; at the question boundary submit a relevant frame/crop and pointer-path/region evidence to Spark. A circle made only by moving a cursor is a temporal gesture, not a mark left in a single screenshot; record/overlay the path rather than requiring the model to guess it. Keep capture coordinates, display scaling and question timing aligned; keep generated visuals stable while context updates and preserve prior source/version lineage. Immediate pointer feedback can feel live, but model visual authoring remains bounded inference with latency to measure. This is advice only, not adopted scope, implementation or a benchmark; no new training, models or always-on upload.


## PM077 — Native point-and-ask implementation (October 30)

Authorized fresh context during explicit push-to-talk, cursor gesture selection, native source highlighting and integration with the existing visual/follow-up engine. Implement independently, preserve current evidence/ownership/budget boundaries and existing native capture. Current clean public source f4c9000; shared ledger last read $7.3758095/$15. Implementation, tests and release pending.


### PM077 thin-slice checkpoint

Implemented an independently written macOS reserved press/release shortcut helper, explicit point mode, click-through local cursor/gesture overlay, fresh capture on release, normalized selection provenance and a coordinated source/transcript join into the existing generation engine. Reserved chord is Control–Option–Space; snapshot shortcut remains. Escape, mode-off, view/source changes, new interactions and microphone/transcription failures cancel stale work. The current visual stays available until a complete result arrives. Capture/gesture data is local until the explicit question submission; no always-on video upload or raw trajectory persistence.

Thirteen desktop policy/geometry/session checks and five source/provenance service checks passed. Native Swift helper compiled and actually reserved/released the chord in a ready-only probe; no synthetic keypress, real microphone or OS screen pixels used in that probe. First browser attempts exposed harness issues (hidden compact controls, resumed API response shape, JSON string escaping, browser input generation) and a same-render short-hold cleanup case, now corrected. Existing actual Chromium recorder check passed in the later targeted run; the point-session lifecycle tests use original PCM through real decode/resampling with deterministic recorder/permission timing. No live model call this turn yet; budget unchanged from $7.3758095/$15. Full tests, focused real-provider tests, native visual inspection, signing/notarization and deployment remain pending.


### PM077 verification checkpoint

1. Full offline suite passed 1,401 tests (89 opt-in skipped), 121 browser journeys and 13 desktop policy/geometry/lifecycle tests. Final native replay revealed a transient generic-diagram issue: ResizeObserver reflow shrank the canvas before CSS transform interpolation completed. A new regression sampled every animation frame and failed before correction. Removing only the diagram layout transform transition passed all 24 affected exploration/point journeys. Final typecheck and production build passed.
2. Two fresh provider requests used one frozen original 1400×850 screenshot and identical question, changing only normalized selection. Spark returned the correct left 7→9→11 and right 11→14→17 traces; each had actual Wonder approval and exact focus save/reopen checks. Model times 13.557s/15.916s, HTTP 14.176s/16.470s, costs $0.03167225/$0.03469925. Shared ledger $7.442180999999998/$15. The subsequent UI wait timed out due a nonexistent history selector; API/source/persistence checks had succeeded. No provider retry used to hide it. Actual responses rendered later in Electron replay.
3. Native helper compiled and actually reserved/released its chord; real Electron windows/transparent overlay/preload/render/hide passed with synthetic helper events, desktop pixels and deterministic audio. These are not physical shortcut, OS microphone/capture or clean-Mac proof. Developer ID signing/deep strict verification succeeded for 0.2.0. Notarization stopped before submission because `soma-notary` was missing, including an explicit login-Keychain read-only check. User was asked to restore credentials locally; no password requested in chat. Source/deployment and notarization remain separately recorded.

Private artifacts: `.local/pm077/source-manifest.json`, live-focus-results.json, native-flow-results.json and synthetic screenshots; final test logs `/tmp/soma-pm077-*`. No raw pointer trails/source images were added to public fixtures. Scope decision and interaction boundaries are in docs/POINT_AND_ASK.md. No new model family, training, continuous video upload or learning-outcome claim.


### PM077 final iteration

The signed package inspection found Swift compiler caches unnecessarily included in app.asar. Excluding that cache reduced the archive from 131 entries/67 MiB to 27 entries with no cache; native helper remains a separately signed resource. A further source-switch check found that disabling the recorder did not immediately terminate the native session. The initial weaker upload check passed; a stricter cancellation acknowledgement assertion failed, then explicit source/share/upload cancellation fixed it. Native microphone/screen permission descriptions now explicitly describe Point & ask. Final source and signed bundle checks are repeated for these changes; prior notarization credential gate remains.


## PM077 release checkpoint — October 30

Public code **be83c63c0f031495256c5e38699863c4be312ab3**, clean CI [41071744426](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41071744426): **1,401 offline passes / 89 opt-in skipped**, **13 desktop checks**, **28 isolated credential-browser checks**, and **123 browser journeys**. Final typecheck, production build, source-manifest verification and isolated runtime import passed.

Production deployment **dpl_7iqYXQRwyUPUGKP2tptkRxJ6XgN3** serves `soma-pm077-2026-10-30`; its complete 214-file runtime manifest matches committed source, fingerprint `f228f56827a1ab7dd28bf0246ba555c5fdac9f6ede0ee738a17870318a70f20a`. The first deployment attempt returned Not authorized; explicitly selecting the verified owner scope/project succeeded. A final actual Electron-to-production bridge/render/hide check passed with synthetic screen/audio/helper events and replayed actual model output, making no new model calls. The first hosted harness incorrectly passed production as a development override and was stopped; the successful run uses the app's fixed production origin.

0.2.0 is Developer ID signed and deep/strict verified, including the shortcut helper. Its app archive contains 27 entries and no compiler cache. Apple notarization remains blocked by the missing local `soma-notary` profile; no new notarized download is claimed. Physical hold/release, microphone quality, capture permission, fullscreen/multi-monitor and clean-Mac installation remain human checks.

Final three outcomes for PM077: (1) implemented the independently authored explicit Point & ask interaction, source focus/provenance and stale-session protection; (2) iterated on native-width reflow, manual-source cancellation and package contents, with failed-before/passed-after regressions and real focused-source checks; (3) published matching source/production with clean CI and prepared the signed local test app at `.local/pm077/Soma.app`. Deviations/remaining gates: no continuous stream, training or new family; notarization and human native-device checks remain outstanding. Existing test spend ledger remains $7.442180999999998/$15. No additional live inference during hosted smoke.


## PM078 — Grounded source interaction and cross-subject testing (October 30)

Authorized screen pointing, explicit before/after comparison, bounded closer-look tool, streaming questions and advisory contradiction review through the existing visual engine. Implement independently; preserve scope, ownership, current source/version lineage, typed components and $15 lifetime allowance (last actual ledger $7.442180999999998). Discover and freeze public sources across subjects before fresh tests. Outcomes pending: (1) implementation and source-grounding behavior; (2) numerical/ownership/native/UX verification; (3) cross-subject model tests and release. Do not record/reconstruct the prior expressly excluded prompt or name its external reference in repository materials.


### PM078 implementation and evaluation checkpoint

Implemented normalized source anchors and per-step references, exact-hash-bound before/after images, a single frozen-image crop tool, source preview/native highlights with stale-screen refusal, conservative one-use streaming tickets and an isolated Meta-ASR relay. Source facts, numeric assurances and existing record/evidence boundaries remain. Native pointing compares the current screen against the frozen capture and expires local capture reuse; no cursor movement/clicking or always-on upload. A new generic-diagram router avoids cards so branches are not rendered as sequences.

The first full offline suite passed 1,411 tests/89 opt-in skips; actual WebSocket relay tests passed three controlled upstream cases. New browser source/streaming checks passed; the first complete browser suite had 125 passes and one old assertion that counted the new metadata-only streaming-availability request as a submitted question. The corrected assertion still forbids source/question generation, and all 18 voice journeys passed. Relevant new source/routing checks and broader release checks continue.

Eight real public-page screenshots were frozen across programming, calculus, biology, chemistry, economics, statistics, history and physics. Initial harness wrong-section/footer selections were corrected before model requests and retained separately. All first-batch requests safely rejected at interpretation. One field-type diagnostic runner suppressed console output; a repeat wrote safe field-type metadata and confirmed the new absent `change` value arrived as literal string `"null"`, alongside the already-supported graph sentinel. Normalize only that exact absent-value sentinel before strict validation. The unchanged repaired set published/rendered/saved/reopened 7/8; the physics case rejected after bounded review/repair. Keep both attempts and all spend, not an inflated 7/8 first-request claim. Actual screenshots also exposed the generic branch-routing issue above. Model review requested a biology correction; review is advisory and its demand for a particular product-energy ordering was stronger than the cropped source supported, so the generic reviewer instructions now explicitly preserve source uncertainty.

Cloud provisioning is not completed: automatic approval review rejected creation of the runtime service account, Secret Manager uploads and scoped IAM grants without specific authorization for that configuration. A concrete approval question for the isolated relay configuration/deployment is pending. No credentials were uploaded and no new service/account was created by the rejected command. Continue unaffected model/UI/source verification, preserving the $15 cap.


### PM078 final outcomes

1. Delivered source-linked visual steps, numbered source markers, local verified native pointing, versioned before/after capture comparison, one bounded model-selected detail crop and obstacle-aware generic-diagram routes. New capture comparisons preserve earlier source/spec records; current controls remain protected on ordinary follow-ups. Streaming ASR implementation uses owner-bound single-use tickets, bounded PCM/session, separate relay authority and conservative application-budget charging. It is implemented/tested but not cloud-enabled. No new checked family, framework, always-on screen upload, training result or learning-outcome claim. Scoped root sync copied 49 safe source/test/release files and merged relay-only env/CI additions; unrelated v1/private work preserved.
2. Complete local suite: 1,412 unit passes/89 opt-in skips, 126 browser, 14 desktop and three relay passes; final phone-marker patch passed seven affected browser journeys and build/types. Clean CI 41089794472 passed all gates, including 28 isolated adversarial browser cases and all 126 browser journeys. Actual eight-source repeated development set published 7/8 after a confirmed null-sentinel parsing correction; initial 0/8, broad physics failure, narrower physics recovery, failed initial closer-look request and successful explicit crop are retained. Real changed/unchanged source turns preserved lineage; Wonder caught three seeded contradictions, not a precision/recall benchmark. Real Meta streaming ASR returned 12 partials plus final through local relay on original synthesized speech. Native Electron IPC/overlay passed controlled-pixel/helper/mic boundaries; retained actual outputs re-rendered at 620/375 with source controls and zero page exceptions. No physical native-input or student-study evidence.
3. Published runtime be62bdca061251851346ec6d9468901bd5e47df5; production dpl_6qeBzywPSDaKKChCA1UC1hUgCYvW serves soma-pm078-2026-10-30 with exact 228-file SHA-256 0d0cf1d45b7ca39077e9ded9f4c039b4936a7bcb64bc05a1f95a0f778f978f7c. Exact upload .local/pm078/deploy-final. Hosted identity/prepared weighted save/reopen/phone/companion/microphone-policy check passed without provider calls and test records removed; first harness failures (absent capability flag, missing explicit reopen) retained separately. Native 0.3.0 copied to .local/pm078/Soma.app; original/copy byte comparison and normal macOS deep/strict verification passed. A restricted-environment signature check failed inconsistently and was retained; no byte mismatch. Notarization remains blocked by missing soma-notary profile. Cloud provisioning was rejected by automatic approval review for missing specific authorization for the new service account/secret uploads/IAM, and a concrete approval question remains pending. No account/secret/service created by that rejected step; production recorded fallback remains. Final actual shared ledger $8.440255/$15. Current prompt stays verbatim; preceding excluded prompt remains excluded.


PM078 final documentation source is 736460b9169cf0f701c599ec115d7ac6726f8300; it changes only verification prose and retains clean-CI runtime be62bdc. Anonymous public GitHub and production release manifests were fetched and matched exactly. All 49 scoped root copies still match; canonical public checkout is clean. Known local test server stopped. No further inference or cloud provisioning.


## PM079 — Native interaction status and remaining work

1. Confirmed current native 0.3.0 source implements the local cursor trail, hold/circle-or-point interaction, release-time screenshot plus voice/normalized selection, and source-pointing overlay with stale-screen refusal. It is explicit capture, not continuous video or autonomous cursor control.
2. Distinguished existing evidence from remaining checks: native Electron integration passed controlled pixels/helper/audio, but physical shortcut, real OS capture/microphone, fullscreen/multiple displays and clean-device operation still need human-device verification. Latest clean-CI/production identity is unchanged from PM078.
3. Prioritized activation/distribution and release polish: cloud streaming needs the pending explicit service-account/secrets/IAM approval; recorded input remains available. Signed 0.3.0 still needs notarization, and general-source generation/latency plus final real-world demo evidence remain work. No code, deployment, provider call or scope change in this status turn.


## PM080 — Notarization, generation reliability and waiting

User authorized completing 0.3.0 notarization and improving generation reliability/latency. Start from public 736460b (runtime be62bdc), preserve $15 lifetime cap (last read $8.440255), previous failures and unrelated root/v1 work. Outcomes pending: (1) notarization/distribution, (2) source-grounded generation and truthful waiting, (3) verification/release. No new checked family or cloud voice provisioning authorized by this request.


## PM081 — Computer interaction positioning and optional action exploration (October 30)

1. Re-familiarized with the updated handoff, PRD, product/story documents, Point & ask record, latest build-log entries and desktop native/preload boundaries. Current documented release includes native point/circle capture, source anchors and before/after context, weighted experiments and fresh practice; desktop source highlights do not implement external clicks or typing. PM080 distribution/reliability outcomes remain pending in the local log. No new runtime verification is claimed.
2. Checked official Meta computer-use and macOS cookbook documentation: Spark/Wonder can drive an application-supplied observe/action/screenshot loop; native Mac control requires a new local execution boundary and OS permissions. Recommended task-scoped typed actions, selected-app enforcement, fresh-state checks, interrupt/recovery, redacted audit facts and explicit consequential-action approval. Screen content remains untrusted input; model instructions cannot grant action authority.
3. Assessed broader positioning against the supplied rubric. Recommendation: frame Soma as a way to understand and act on what is on screen, preserving generated manipulable explanations as its distinguishing capability. Explore one bounded explain-then-apply workflow before general desktop/form automation; evaluate observed action correctness and recovery, not merely cursor motion. This is advice, not an adopted PRD change or implementation. No provider inference, spend, deployment or code changes.

Deviation/status: external writes would expand the current read-only source boundary and need a separately adopted action scope. Existing course collection remains read-only. Only this prompt and its outcomes were appended; unrelated dirty work was preserved. Sources: https://dev.meta.ai/docs/computer-use and https://dev.meta.ai/docs/cookbook/computer-use-macos.


## PM082 — DSA interview preparation as the initial workflow (October 30)

1. Reviewed current v1 bridge, learning-graph and user-story documentation. Identified reuse of selected visible context, checked BFS/Dijkstra explorations, fresh-practice observations and immutable assistance history; connecting exploration evidence into the older learner graph remains new integration work. No claim that LeetCode ingestion, arbitrary code execution or DSA-wide checked visuals are implemented.
2. Developed a proposed problem → interactive pattern explanation → discriminating prediction → fresh transfer problem → evidence-linked concept-map journey. Interview goals and daily-practice claims are user-reported context, not independently observed history. Concept relationships and evidence of personal understanding remain distinct; help, revisions and uncertainty remain inspectable.
3. Recommended a narrow graph-search demonstration that reuses checked computation, with Muse selecting a useful counterexample and adapting the next activity. Broader desktop control is unnecessary for this initial value. Checked official LeetCode study-plan descriptions to distinguish the proposed adaptive visual/evidence loop from existing topic-organized problem lists. Source: https://leetcode.com/studyplan/top-interview-150/.

Status/deviations: product discussion and recommendation only; no PRD adoption, code, deployment, model expenditure or new test result. Logged the prompt verbatim and preserved unrelated changes.


### PM080 notarization and waiting checkpoint

Fresh notarization succeeded using the now-available soma-notary profile. Apple submission c1f04adf-fd55-4f4a-83ff-5e6ceaef2ad4 accepted; stapler and Gatekeeper passed. Published v0.3.0 against native/runtime source be62bdc; GitHub's asset digest matches local SHA-256 cfdfffa47c0594ef433467011ce9a96595d295739a274f25f772193bbb1f3e87 (121,155,342 bytes). Copied stapled bundle to .local/pm080/Soma.app and preserved earlier releases.

Reduced composition schema overhead (do not re-offer the completed inspection tool; only explanation-compatible authoring panels), kept strict domain/publication/reference checks and bounded review. New optional NDJSON response emits only actual application phases and a complete validated result/error, not partial model prose. Browser cancellation testing reproduced an existing mutable-button default-submit bug; prevent default activation before changing the button, then verified no automatic second generation. Initial phase tests needed to wait for the provider to start after the early phase event; a separate test assertion needed to exclude Next's empty route announcer. The deliberately narrowed authoring test was updated while saved-scene validation stayed unchanged. Complete offline suite 1,419 passes/89 opt-in skips; all 128 browser journeys pass. Build/type/isolated trace passed.

The first private live benchmark used native fetch but called its numeric status as a method. It aborted the measurement after requests began; all ten attempts and conservative charges are retained in evaluation-harness-first.json, not counted as model successes or failures. Corrected harness rerun is in progress under the unchanged $15 shared cap (read $10.20854275 after those aborted runs). The two new sources are now development repeats because those first requests were interrupted; do not relabel them clean first-request results. No cloud voice account/secrets/IAM provisioned.


## PM083 — Preserve broad positioning; coding is a demo angle (October 30)

1. Corrected the PM082 recommendation: the user does not want Soma narrowed to coding or DSA interview preparation. Coding is one potential demo angle within the broader screen companion.
2. Preserved the shared selected-context → visual explanation → exploration → follow-up journey across subjects. A personal understanding map remains a proposed cross-domain capability, not a newly shipped integration or coding-specific curriculum.
3. Recorded the positioning clarification in DECISIONS.md. No application changes, deployment, inference or tests were needed for this clarification; existing checked-family and explanation-only distinctions remain.

Deviation: supersedes the assistant's PM082 suggestion to make DSA the initial product focus. It does not authorize general computer control or expand checked computation to all subjects.


## PM084 — Gap assessment for the broad personal screen companion (October 30)

1. Inspected current exploration session/artifact contracts, model instructions, release handoff and latest build-log changes. Existing implementation supports selected snapshots/point focus, source-grounded visuals, local checked BFS/Dijkstra controls, contextual follow-ups, saved versions, predictions and same-family fresh practice. PM080 now records successful 0.3.0 notarization/distribution; reliability/waiting evaluation is still in progress in that checkpoint. No fresh tests or deployment inspection performed for this assessment.
2. Identified missing cross-exploration continuity: explicit editable personal goals, concept identity/relationships across sources, evidence-linked understanding-map projection, retrieval into future Muse turns and cross-session next-activity selection. Existing per-artifact learningContext and v1 evidence services provide foundations, not a completed integration. General screenshots do not supply off-screen problem text or executable validation for arbitrary subjects.
3. Separated the optional computer-action track: current native source pointing does not control other apps. Clicking/typing requires a new bounded native execution/permission/result-verification boundary. Recommended first closing the goal → concept/evidence → next-explanation loop across several contexts, while keeping computer actions a separate milestone.

Status: assessment only; no new scope adoption or implementation. Preserve broad positioning from PM083. No percentage-complete estimate, new benchmark claim, model spend or changes to concurrent PM080 work.


## PM085 — Muse capability allocation (October 30)

1. Verified official current Meta model and computer-use documentation: Spark/Wonder support multimodal interpretation, structured output/tool use and computer-action planning; Muse Voice Transcribe supplies speech recognition. Documented capabilities do not establish reliability for Soma's unimplemented workflows.
2. Mapped proposed personal goals, concept-link suggestions, evidence-based interpretations, memory retrieval choices, adaptive explanations and action planning to Muse. Soma must supply persistent owned records, retrieval tools, validators/renderers, deterministic checks, permission enforcement and the native action executor. Model-proposed understanding remains revisable, not proof of mastery.
3. Recommended Spark as the default and measured Wonder escalation/review for difficult cases; no fine-tuning is required to start building this integration. Clarified that current narration uses non-Meta TTS, while the described reasoning workflows can use Muse. No code changes, live inference, deployment or new scope adoption.

Sources: https://dev.meta.ai/docs/models and https://dev.meta.ai/docs/computer-use.


## PM086 — Personal companion integration and scoped actions

User authorized implementing the broad Muse-powered memory/map/adaptation/action direction, isolated from concurrent PM080 work, with frequent commits, branch push and merge to main. Dedicated checkout `.local/pm086/implementation`, public repository `soma-hackathon`, branch `codex/personal-companion`, starting at 736460b. Outcomes pending: (1) owned goals/concepts/evidence and adaptive Muse integration; (2) accessible UI and scoped native actions; (3) meaningful tests, review and main integration. Preserve current $15 shared ledger; no new allowance or cloud provisioning inferred.


## PM087 — Moonshot product exploration (October 30)

Research/advice request; no implementation or release-scope adoption. Reviewing current source/status and official external product/model research. Outcomes pending: (1) current capability baseline and concurrent-work boundaries; (2) researched creative direction beyond existing proposals; (3) concrete demo slice, feasibility and evaluation gates. Preserve concurrent PM080/PM086 changes.

### PM087 research outcomes

1. Reviewed current handoff, PRD, v2 implementation/verification, model/graphics proposals, story/rubric and recent build records. Read PM086 checkout history/status without modifying it: personal-companion planning is committed and memory/native-action source is in progress, not established as released. Existing v2 checked graphs, model-selected cost experiments, prediction/practice, source anchors and immutable revisions provide the foundation. Earlier discriminating-diagnostic ideas already exist in v1; the recommendation does not claim to invent them. Current reliability/distribution work remains independently tracked under PM080.
2. Researched official Meta model/API and October 12 Wonder materials; Sakana's October 2026 Agentic Scientist; World Labs' September Atlas and June simulator/planner distinctions; Sesame's conversational-presence research; and Google's Learn Your Way. Recommended a proposed “belief debugger”: the user supplies/confirms an explicit rule, Muse proposes a bounded experiment, application code executes that rule and the reference model, and a visual comparison exposes a discriminating counterexample. Extend later to evidence-linked cross-context transfer with explicit analogy limits. This is a creative synthesis, not an established first-ever invention, shipped feature, mind-reading claim or measured learning benefit.
3. Defined a potential hackathon slice within the existing weighted-graph family: bounded rule choices, one source-preserving hypothetical intervention, independently computed paired outcomes, user correction, saved provenance, and optional fresh practice. Evaluate against a fixed experiment baseline on held-out graphs; test ambiguous/correct rules and abstention, source fidelity, actual latency and cost. A new greedy-rule executor and comparison/search contract require implementation and verification. Recommend a tightly time-boxed spike only if adopted and compatible with the October 31 freeze; retain the working demo if it misses gates. Longer-term general experiments and cross-domain transfer remain research, with each checked domain needing its own validator.

Status/deviations: strategy advice only. No PRD/plan adoption, runtime edits, provider inference, paid experiment, deployment or changes to PM080/PM086 work. Updated only this prompt archive and log; archive JSON parses and prompt IDs are unique. Sources: https://dev.meta.ai/docs/models ; https://research.meta.ai/blog/muse-wonder ; https://pub.sakana.ai/agentic-scientist/ ; https://www.worldlabs.ai/blog/atlas ; https://www.worldlabs.ai/blog/taxonomy-of-world-models ; https://www.sesame.com/journal/crossing-the-uncanny-valley-of-voice ; https://research.google/blog/learn-your-way-reimagining-textbooks-with-generative-ai/ .


### PM080 reliability investigation checkpoint

The compact-candidate ten-source repeat published 7/10: optional out-of-bounds source location rejected calculus; two new topics had review-contract failures. Omit invalid optional locations (never clamp), retain count/identity limits, source facts and strict scene reference checks; an end-to-end regression passes. A subsequent pre-JSON repeat again published 7/10, with diagnostics identifying a completed review with no review tool and malformed composition/repair wrappers. Preserve all attempts.

Official Meta docs confirm only automatic tool choice is supported. Added explicit structured-data support in the bounded provider reader (not fabricated function calls); scene composition now requests strict JSON with the exact source/model/artifact bindings. Function-based extraction/cropping and existing v1 default parsing remain. The first constrained-JSON critic experiment missed a seeded enzyme contradiction; a nested conditional schema then approved all three known contradictions and was rejected as unsafe. Do not ship or claim those experiments as successful verification. Final critic keeps a concise fact-focused tool-or-validated-JSON response with the original strict verdict/findings semantics, no forced tool-choice flag or server review grammar. Final three-case Wonder challenge rejected all three contradictions in 11.6s total; this development repeat does not erase prior misses or prove accuracy.

One known incomplete critic may be retried once on the same unchanged candidate within the original six-call/90s/$0.35 bounds; material rejections still require author repair and re-review, and uncertain-billing transport failures are not retried. Safe contract failure codes, actual per-call durations and bounded terminal audit facts are retained. Stage feedback carries no partial model explanation; interrupted streams preserve the question and last visual with a clear retry message. A private diagnostic cleanup used an incorrect method, then its exactly identified synthetic artifact was removed by source hash/time/question match; all diagnostic failures and conservative spend remain documented. Final strict-JSON candidate verification is in progress.


### PM086 implementation and main integration checkpoint — October 30

1. Implemented owned goals/preferences, evidence-linked concepts/relationships, correction/forgetting/source-pruning, and bounded real Muse memory selection → next activity → personalized visual continuity. Kept coding as one broad-context demo angle. Used independent memory/UI/native agents and reviews; fixed revocation/settlement races, oversized context and strict Meta nullable-schema compatibility. Public spec: docs/PERSONAL_COMPANION.md.
2. Implemented accessible memory UI and separately approved native macOS action proposals/execution broker. Rechecks target identity/state; excludes secrets/command surfaces, rejects ambiguous controls, bounds steps/time and verifies field readback. Prepared isolated unsigned 0.4.0 package. Actual native execution remains unverified because the permission-only helper reported trusted:false; existing signed 0.3.0 release remains separate.
3. Frequent commits on codex/personal-companion; preserved and merged the parallel source/review reliability work through 24ec4b5. Created and pushed public main merge 04639b3 without changing the existing default/release branch. Local full checks passed 1,495 offline tests/90 opt-in skipped, 133 browser journeys, 21 desktop checks, build and TypeScript; after final parallel changes, 82 affected tests/TypeScript passed. Actual synthetic Muse continuity/visual/form-proposal test passed within the existing shared $15 cap. Clean-install CI evidence follows.

Deviations/limits: source integration only, no production deployment or new signed distribution claimed. Generated-manifest conflicts were regenerated from combined source. Earlier browser failures were retained and corrected (layout regression, hard-coded test port, missing synthetic build key); local isolated runtime trace correctly rejected external dependency symlinks used for checkout isolation, so clean-install CI must establish that gate. No private coursework sent, real native action performed or new cloud resources provisioned. Main source fingerprint c5d27a62fa5f41a7f961564ea95e5f6505a286e068978d2f75b5266be02a52d7; private coordination appendices stay with concurrent root documentation, public support/verification docs are committed.


### PM086 final verification

Main merge 04639b3 passed clean GitHub CI 41105423022 (https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41105423022): 1,497 offline tests/90 opt-in skipped, 133 browser journeys, 21 desktop checks, 28 isolated credential-browser tests, TypeScript/build/manifest and clean isolated runtime import (1,224 files, two links, no private configuration mappings). Feature CI 41105422019 also passed. The local dependency-link trace limitation is resolved by this independent clean-install check without weakening the guard. Public documentation-only evidence is pushed after the runtime merge. Production deployment, physical Accessibility execution and signed/notarized 0.4.0 remain explicitly pending; no other session's release was changed.


### PM080 final outcomes — October 30

1. Completed native distribution: Apple accepted submission c1f04adf-fd55-4f4a-83ff-5e6ceaef2ad4, stapling/validation, deep/strict codesign and Gatekeeper passed. Published notarized v0.3.0 ZIP (121,155,342 bytes; SHA-256 cfdfffa47c0594ef433467011ce9a96595d295739a274f25f772193bbb1f3e87) with matching GitHub digest. Stapled local copy `.local/pm080/Soma.app`; original source be62bdc and older releases preserved. Physical native capture/audio/clean-Mac installation not claimed.
2. Released strict JSON scene generation, bounded same-source and same-candidate format repairs, omission of invalid optional locations, and actual phase streaming with clear interruption recovery. Reproduced/fixed cancel-button automatic resubmission. Retained hard publication/ownership/source/current-state guards and original six-call/90s/$0.35/$15 limits. Ten-source final broad repeat published 8/10; physics and astronomy subsequently published, without relabeling first failures. Both successful repeats did not need the new source/review format guard; service tests prove those guards. Critic schema variants that missed contradictions were rejected; final factual critic caught 3/3 in a small development repeat, not an accuracy benchmark. All failed/interrupted harness/provider attempts remain in private evidence.
3. Runtime commit 24ec4b5a40cbad11281fe3dbb3de5b4b7cca874f and clean CI 41105115334 passed 1,428 offline tests/89 opt-in skips, 129 browser journeys, 14 desktop, three relay, 28 isolated adversarial cases, type/build/trace/manifest checks. Production dpl_7vRxLFctVqbS9LC3WgkJPQZjG561 serves soma-pm080-2026-10-30 (230 files; SHA-256 a114e800f3843d500d45012175c21563a11c10f0abbd7110625d356c2d3d3716). Actual hosted public-page generation showed first phase at 1.702s, completed in 18.644s, cost $0.0337535 across three calls, and passed exact save/reload/reopen, 375px layout and zero page exceptions. Own synthetic records cleaned. First hosted DevTools stream-observation failure is retained separately. Broad successful median 20.658s; matched prior/current median 22.588s/20.802s is uncontrolled, not a latency guarantee. Real checked weighted screenshot/investigation/authorized-cost follow-up preserved current state and saved lineage.

Release/handoff: `.local/pm080/deploy-final` is the exact committed upload; private tests/receipts/manifests in `.local/pm080`. Twenty scoped source/test/manifest files synchronized only after baseline comparison, preserving unrelated root and concurrent work. Public main PM086 is independently integrated/verified but not deployed by this release. Current measured lifetime ledger $12.09191425/$15 at 2026-10-30T18:26:31.411Z; no reset or training. No new checked family, P0 expansion, student outcome, cloud resource or relay provisioning. October 31 freeze retained. Public evidence: https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41105115334 and https://github.com/Jeremiah-Sakuda/soma-hackathon/releases/tag/v0.3.0. PM080 supersedes its pending status above; PM081–PM087 records preserved.

Final release identity checking uses the canonical public checkout. Running the manifest check in the unrelated dirty root correctly reported a mismatch; no root source or manifest was regenerated to conceal that difference. All 20 scoped PM080 runtime/test files still match the canonical release byte-for-byte; unrelated root source remains outside the published snapshot.

PM080 final publication: documentation-only c85dec4da18f9a4da12a72df9161588394c02510 pushed to codex/submission-release after clean runtime CI. Anonymous public GitHub and production release manifests match exactly; canonical checkout is clean. Final receipt `.local/pm080/release-manifest.json`. Known local test server stopped. A sandbox DNS failure on the first push and sandbox process-inspection denial were resolved through the normal approved tool path; no production or budget change.


## PM088 — Main consolidation and branch cleanup

User authorized merging the release into main and retaining only main. Public soma-hackathon currently has three branches; main already includes runtime 24ec4b5 and clean companion CI, while release adds only verified release documentation. Preserve unrelated private root work and all commits. Outcomes pending: merge, default-branch change, merged-branch cleanup and final verification.

### PM088 consolidation checkpoint

1. Merged release documentation into existing companion main without dropping either line of work. Public main commit 2f161a00d6f1c95f9af5ad471bcd8418dc20045a contains runtime 24ec4b5 and companion 04639b3; only two evidence documents differ from prior main. Combined 245-file runtime manifest verifies, fingerprint c5d27a62fa5f41a7f961564ea95e5f6505a286e068978d2f75b5266be02a52d7.
2. Set public soma-hackathon default branch to main; removed codex/personal-companion and codex/submission-release only after ancestry checks and with exact-commit leases. Anonymous branch listing confirms main is the only remote branch. Canonical release and clean companion checkouts now both have only local main, aligned with remote; unrelated private soma root and older archived working directories preserved. Tags and published downloads retained.
3. Source status is clean in both maintained public checkouts. New main CI 41108659902 is queued; previous combined-runtime main CI 41105423022 passed. No runtime edits, deployment, inference, spend or new cloud resource. Current production remains the independently verified PM080 deployment; merging the newer combined source does not establish it as deployed.

PM088 final verification: public ls-remote returns only refs/heads/main at 2f161a00d6f1c95f9af5ad471bcd8418dc20045a; main is GitHub default and the sole local branch in both maintained public checkouts. Canonical status is clean. Combined runtime manifest passes and all former branch tips are ancestors of main. New CI 41108659902 is in progress, not yet a passing result; prior runtime CI remains green. The local read-only watcher was stopped; the GitHub job continues. User request to merge/consolidate is complete; tags, downloads and private working changes are preserved.


## PM089 — Commit-count explanation

1. Verified public soma-hackathon main at 2f161a0 has 43 total reachable commits (22 first-parent); its prior main at 47d86a9 had 41. The last merge increased the public count by two; it did not squash or reduce it.
2. Verified original private soma root remains at 08d0eb2 with 206 commits. Public history starts at aa8c15c, a separately published reviewed source snapshot recorded in PM064; it does not import the original private history. Distinguish these repositories clearly rather than suggesting the older 206-commit history was merged into the public repository.
3. Ancestry checks confirm c85dec4, 1642d9e, 47d86a9 and runtime24ec4b5 all remain reachable from public main. No code/history/branch/deployment changed for this explanation. Original private working changes remain untouched.


## PM090 — Separate-public-repository rationale and accountability

1. Read PM064 publication records and its exact user request: reproducible public source was one of six authorized audit fixes. The implementation chose a separate reviewed public source export excluding private history/unrelated work rather than changing original soma visibility. A separate repository was an implementation choice, not an explicit user request or hackathon requirement.
2. Explained that this choice split history and canonical working paths and was not communicated clearly enough. Original private soma history remains; no new claim that its history is imported into public soma-hackathon.
3. No repository visibility, history, code, branch, deployment or credential change made in this explanation. Publishing original private history or replacing repositories is not inferred from the user's question.


## PM091 — Preserve both histories in original soma and retire the separate repository

User explicitly authorized importing every commit from soma-hackathon into original soma, deleting soma-hackathon and using only soma, private until the end of the hackathon. Plan: preserve dirty root work and all objects, merge unrelated histories without rewriting either, migrate tagged release assets before deletion, verify source/tests/reachability, push original soma main and remove obsolete remote references. No public visibility change or scheduled publication inferred; no new provider spending/cloud resources. Outcomes pending.

### PM091 merge checkpoint

Preserved 165 modified/new original files in e7e1fe5 after scanning against seven configured secret values/private-key markers (zero matches). Local editor launch configuration remains ignored. Imported all 43 source commits and both tags; original 206 commits remain ancestors. Saved a complete Git bundle and private uncommitted patch/tar/hash inventory. An initial protected-index denial made no change; normal approved Git execution completed the checkpoint/import.

Prepared a genuine unrelated-history merge using the original 08d0eb2 tree as the manual three-way baseline. Retained 105 original-only files (product docs, history, design and v1 material), new companion features, exact source/review reliability work and unpublished v1 lesson-review changes. Updated canonical instructions/release links while preserving verbatim historical prompts. No forced history rewrite, visibility change, paid inference or deployment. Public main clean CI 41108659902 had passed before archival. A documentation script initially used the nested worktree as its root and exited before edits; rerun from original root.

### PM091 verification and release migration

Pushed consolidated main 936d903 and original v0.1.0/v0.3.0 tags atomically to private soma. All 206 original and all 43 imported commit hashes are reachable; merge feee287 preserves both parents and source history without squash/rebase. Restored original-only documents byte-for-byte except three intentional migration appendices; retained unpublished v1 review source/tests exactly. The initial blanket action-link adjustment changed some older references; follow-up936d903 restores the original records, not fabricated new-repo run IDs. Private prompt archive text preserved.

Both GitHub release assets migrated to soma with byte-identical GitHub digests: v0.3.0 archive cfdfffa47c0594ef433467011ce9a96595d295739a274f25f772193bbb1f3e87 and v0.1.0 archive61e5e27860dfbc3d8d4f7c9d8126d5f3bf50424664c4bdaa7eb2a5ff2fe98588;0.3 checksum sidecar also matches. Release metadata and prior successful CI logs41108659902/41105423022/41105115334 archived privately. No open issues or pull requests were reported in retired repository. Archived source clones now point to original soma; canonical working directory is the original root.

Local typecheck passed. Restricted offline run had48 localhost-permission failures; approved rerun passed1,512 tests/93 opt-in skips. All133 browser journeys passed;21 desktop checks passed. Relay first failed because root lacked its own pinned ws dependency; installed its lockfile with scripts disabled and all three relay tests passed. Local default Turbopack build twice failed on process/port permissions; do not claim its downstream missing-trace check passed. Clean original-repo CI41116288584 is checking default build/trace independently. Development next-env changes restored to committed production imports. No provider call, new expenditure, deployment, native permission or publication change.

### PM091 outcomes and remaining deletion gate

1. History/source migration complete: original soma main contains every original 206-commit hash and every imported43-commit hash plus checkpoint/merge/verification commits. Both release tags and unchanged notarized ZIP assets are on soma; active links and canonical instructions use original soma. Root is the sole Git worktree; temporary import ref/worktree removed and archived clone origins repointed to soma. Backup bundle, patch, file hashes, source/release metadata and prior CI logs remain ignored/private.
2. Verification:1,512 offline passes/93 opt-in skips;133 browser journeys;21 desktop and three relay tests. Clean original-repo CI41116288584 passed lockfile installs, relay, manifest, type/unit/desktop checks, default production build, isolated trace and adversarial browser stage; full browser stage is still running, not yet reported as complete. Local Turbopack process-permission failures remain recorded separately. No deployment, provider call/spend, permission expansion or visibility change.
3. Deletion preflight verified every current old-repo branch tip is an ancestor of soma main, original soma remains private/main-only, and migrated release asset digests match. CLI deletion returned HTTP403 because its OAuth token lacks delete_repo; this was GitHub authorization, not automatic approval review. Opened the already signed-in Firefox settings without expanding token permissions. Browser-control tool requires action-time confirmation for permanent deletion even after an earlier request; requested through the async question tool. Exact retired repository name is filled in its final dialog; the final delete button has not been pressed while confirmation is pending. Do not claim the old repository is deleted. It is no longer a development remote. No publication is scheduled or performed; keep soma private until the end-of-hackathon release instruction.

PM091 clean verification complete: original soma CI41116288584 succeeded (https://github.com/Jeremiah-Sakuda/soma/actions/runs/41116288584), including default production build/isolated trace and the complete browser/adversarial suite. Full log retained privately. Runtime commit936d903 is verified; subsequent documentation-only commits do not change its246-file fingerprint. Canonical main remains private and sole branch; only the browser final deletion confirmation remains pending.


## PM092 — Final repository deletion confirmed

1. Captured explicit action-time confirmation for deleting the fully migrated soma-hackathon repository. Fresh browser state confirmed exact repository/name and the final delete action was clicked.
2. GitHub redirected to a sudo-mode identity check before performing deletion. Selected the existing GitHub Mobile method; it sent a verification request to the owner. No new credential or expanded OAuth scope was created. Requested that the user approve it in GitHub Mobile; challenge value is authentication material and is not logged.
3. Deletion remains unverified/pending authentication. Original soma history, tags, release assets, main-only/private visibility and passing clean CI remain preserved; no code, deployment or provider call changed.


## PM093 — 3D moonshot reconsideration (October 30)

User requests a more ambitious alternative to PM087 and exploration of 3D graphics. Research/advice only; no implementation or scope adoption. Reviewing latest PM080/PM086/PM091 progress in canonical original soma and current official 3D/model sources. Outcomes pending.


### PM091–PM093 consolidation and deletion complete

After the explicit deletion confirmation and owner-approved GitHub Mobile identity check, browser left the sudo flow. Authenticated GitHub API now returns404 for soma-hackathon; independent preflight confirmed private soma/main-only still contains both full histories and both release tags/assets. Final deletion receipt `.local/pm091/deletion-verification.json`. No OAuth scope expansion, credential creation, source rewrite, deployment, provider use or publication occurred. This supersedes all pending-deletion notes. Work continues exclusively in original private soma.

## PM094 — Remaining Soma work

Status/planning request. Inspect current source/release/verification documents; distinguish shipped source from deployed hosted behavior and signed native distribution. No new feature or implementation inferred. Outcomes pending.

### PM093 research outcomes

1. Re-read latest canonical handoff, PRD/v2 records, PM080/PM086/PM091/PM092 log, personal-companion spec and existing graphics proposal. PM086 memory/adaptation and optional action broker are implemented/verified in merged main; production remains PM080 and physical native actions/signed 0.4.0 are separate gates. Current package/proposal inspection establishes no shipped 3D engine. Worked only in original soma; no archived clone used. Existing unrelated log/archive edits preserved.
2. Researched current official Meta model capabilities, World Labs Atlas (September 2026), SpAItial Echo-3 (October 2026), Spline image/text-to-3D and experimental Spell, and Three.js renderer/clipping documentation. Applied UI/UX skill and guide: reduced/excessive-motion guidance fits; VisionOS gaze result does not apply to this desktop proposal. Recommend a proposed personal 3D explanation workspace: selected source becomes a manipulable spatial model with linked source identity, cutaways, controlled time and live representation changes; later saved scenes connect through personal memory. This supersedes PM087 as the recommended moonshot direction, not as adopted product scope.
3. Proposed a source-to-3D-to-source demonstration, with an optics bench as a spatially meaningful aspirational hero and biology/code as broader future contexts. Clearly separate generic explanatory 3D from independently checked domain simulation; optics would require an explicitly adopted new domain and validator. First rendering spike can reuse checked graph traces, but that spike alone does not establish the moonshot. Muse authors bounded scene/interaction specifications; application owns rendering, execution, validation and source provenance. No native 3D-generation API or automatic accurate hidden-geometry reconstruction assumed. Recommend scene continuity under an unplanned follow-up and save/reopen as acceptance, with keyboard/reduced-motion alternatives and a freeze-aware release decision.

Status/deviations: research and recommendation only, no product code, package installation, deployment, paid inference, API subscription, repository publication or release-scope change. Prompt archive parses with unique IDs. Latest documented lifetime test spend remains $12.09191425/$15, not a fresh ledger read. Sources: https://dev.meta.ai/docs/models ; https://www.worldlabs.ai/blog/atlas ; https://spaitial.ai/ ; https://docs.spline.design/generate/ai-3d-generation ; https://docs.spline.design/spline-ai/spell-ai-3d-worlds ; https://threejs.org/docs/pages/WebGLRenderer.html .

### PM094 status findings and recommended remaining work

1. Deletion is complete: authenticated API404 for the retired repository, original soma private/main-only with both complete histories and both releases. User's GitHub Mobile completion logged as PM093; exact auth challenge omitted. Updated active demo instruction to original soma and preserved historical records.
2. Fresh read-only production inspection changed the earlier deployment assessment: current hosted release already matches PM091 fingerprint8eca7077dff04f73a4a2ba7e58f56bd7ceb9ed414ae92935fd0ed78eff8245fe. Existing Vercel check on936d903 is success at https://vercel.com/jeremiah-sakudas-projects/soma/FisAtVm4p62RkTEJgVnkskYpAWfN. Original-repository push triggered its existing deployment integration; no manual deployment was issued by this status turn. Anonymous memoryGET401 and computerGET405 establish route boundaries, not full production acceptance. Publicly downloadable native releases are still0.1.0/0.3.0;0.4.0 source/package requires physical testing/signing/notarization.
3. Recommended remaining priorities: integrated production memory/visual user journey; physical native acceptance and0.4 distribution; fresh real-source reliability/latency/polish; actual user observations and three-minute footage; final documentation/judge capacity/budget/publication review. Current README/demo omit some newer continuity behavior and older v1 checklist is historical; updated current pointers without changing product scope. Cloud ASR provisioning,fine-tuning,3D,new families and moonshot research remain optional/separately gated. No new runtime changes, live model calls, spending, external outreach, deployment request or public visibility change.


## PM096 — Spatial exploration implementation

User authorized a separate branch, scoping, implementation and thorough verification of the 3D direction. Created codex/spatial-exploration in original private soma from 5ea3514. Initial sandbox Git ref denial made no change; normal approved Git execution created branch. Outcomes pending: bounded model-authored 3D scenes and checked-graph view; integrated continuity/accessibility/fallback; numerical, service, browser, build and live-provider verification within existing allowance. No main merge, production deployment or publication requested.


## PM097 — Source reliability, useful continuity and visual/audio polish

Focused implementation authorized in original soma under existing $15 cap. Preserve source/current-state/evidence/ownership/cancellation boundaries. No new checked domain, model count, native release, cloud provisioning or training. Apply current UI guide and targeted UI/UX Pro Max guidance. Outcomes pending: reliability and relevant memory; diagram/playback polish; meaningful offline/browser/fresh-source verification. Initial log attempt found intervening entries and made no edit; dynamic ID allocation preserves them.

### PM096 — Implemented and verified spatial branch (October 30)

1. Scoped and built source → bounded Muse-authored 3D schematic → orbit/select/separate/cutaway/isolate/step → contextual view revision → exact saved reopening on `codex/spatial-exploration`. Existing checked BFS/Dijkstra receive a projection of their actual traces; general 3D stays explanation-only. Strict primitive/pose/reference/view contracts, owned persistence, stable part/connection identity and geometry, source binding, review and budget limits remain enforced. Three.js 0.187.0 is lazy loaded with its MIT notice. Scope/dependencies `ce53a70`; implementation `7c7e045`; interaction/identity fixes `cbcdae8`. See `docs/SPATIAL_EXPLORATION.md` for demonstration and limits.
2. Verification: 38 focused domain/service tests; complete offline suite 1,550 passed/94 opt-in skipped; full Chromium run 138/141 followed by 36/36 affected cases after fixing all three new failures (drag reset during animation rerenders and private replay opening); optimized production spatial journeys 6/6 passed. Earlier graph-fit regressions from view-switch placement and Node dynamic-import resolution were corrected, not hidden by relaxed assertions. Desktop/diagnostic25, voice-relay3 and adversarial-browser28 passed. Typecheck, optimized build, isolated production trace (1,224 files/two links/no private configuration mappings), Firebase import and runtime manifest passed. Runtime251-file fingerprint a1133895e6c2c576a2920279b7cf55d55c526d5b9fc40d5f36089bebe2944113; experimental release ID soma-pm096-spatial-2026-10-30. Browser/build checks used a credential-free local source snapshot; occupied ports and the other active development server were left untouched. Logs/screenshots remain ignored in `.local/pm096`.
3. Actual Muse/Firestore source-to-3D and contextual side-view revision passed on one original synthetic screenshot: first publication31,201ms/six bounded calls/$0.0785505 (source-format and color repairs), follow-up12,387ms/two calls/$0.03039475. Parts/geometry, source, selection, spread and slice persisted, exact save/reopen matched, original revision remained unchanged. Both actual generated outputs rendered successfully and were visually inspected. An earlier live continuation was rejected because reviewer context lacked current presentation settings; supplied validated state, retained the failure receipt, and reran successfully. Final settled shared ledger snapshot $12.5904345/$15; no cap reset/raise. Private actual artifacts `.local/pm096/live-1793392062102`; failed receipt `.local/pm096/live-1793391956526`.

Deviations/limits: separate experimental scope explicitly authorized by PM096; no new checked scientific family, arbitrary generated code, XR, recovered digital twin, new service or evidence-of-mastery inference. One development live example is not a cross-subject benchmark; Chromium/software-WebGL and failure coverage is not every physical GPU. Branch remains local/private, not merged, deployed, pushed or published. Existing unrelated log/prompt changes from other chats were preserved and excluded from this completion commit. PM096 verbatim prompt was already committed in ce53a70.

## PM098 — Spatial pre-merge verification

1. Reproduced and fixed spatial projection, continuity and interaction defects: tentative-distance bounds, separation preserving checked height and stable object positions, text-only/mixed diagrams, step-ID pose retention, 2D→3D semantic identity, click-sized camera wobble and 44×44 controls. Added domain/service and actual-browser regression coverage, including cross-session HTTP mutation rejection and six WebGL mount/unmount cycles. Initial defect receipts retained; fixes in 485d400 and the final PM098 completion commit.
2. Integrated canonical main dc11105 into the feature branch in afa5675, preserving concurrent prompt/log entries. Corrected the resulting full-width spatial reflow conflict and a real follow-up request failure: combined author guidance exceeded the existing 8,000-character limit. Compacted duplicated guidance without weakening constraints; spatial service tests now use the real encoder/upper-bound estimator. The first combined offline run failed three follow-up cases and the first combined live run rejected continuation; both failures are recorded, not counted as passes.
3. Final combined-source verification: 1,568 offline passed/94 opt-in skipped; complete optimized-production Chromium suite146 passed; desktop+diagnostics25; voice relay3; adversarial credential browser28; typecheck/build/Firebase restricted-module import/isolated trace passed. Fresh actual Muse+Firestore source→3D→side-view revision→exact reopen passed:18.751s/3calls/$0.03515275 and9.513s/2calls/$0.02404725, preserving source, parts, selection, cutaway/separation and original revision. Shared final-run ledger snapshot$13.671588/$15 includes concurrent authorized work; this test cost$0.0592, no cap reset/raise. Actual-output and small-viewport renders visually inspected. Report: docs/SPATIAL_EXPLORATION.md; private failures/successes/logs: .local/pm098.

Status/limits: ready for merge review against main dc11105 (latest fetched). Source identity251files/16356bdbb4da58db0241977a6b16cd36fd31e7259c64e54fea877464952a7093. No feature→main merge, push, deployment, publication or new hosted-CI run. Generic spatial content is explanatory; this is one synthetic mechanism, not broad-subject reliability or learning-outcome evidence. Chromium/software-WebGL and failure tests do not establish every physical GPU/native browser. Existing small-viewport question dock requires scrolling. Other chats' uncommitted log/prompt changes are preserved separately; subsequent main changes require renewed integration verification.


## DEMO-20261030-ae6b95d1 — Demo scenario exploration

1. Reviewed current spatial schema/renderer/authoring and SPATIAL_EXPLORATION.md rather than earlier scoring or log content. Current experimental branch supports bounded Muse-authored primitives, cutaway/separation/isolation, step poses and saved views, plus solver-driven graph projection; it does not add arbitrary physical simulation or musical synthesis. No fresh provider calls or tests run.
2. Proposed DSA weighted-search reasoning, audible musical beating, speaker/pump cutaways, seasonal geometry and molecular geometry as candidate demonstrations. Distinguished candidate subject validation from existing renderer capability; tones/waveforms and scientific parameter models would need new deterministic components. Verified candidate references with official LeetCode, NASA and authored Physics Classroom educational material.
3. Recommended two complete source→question→manipulation→understanding moments, with DSA as the existing checked anchor and one noncoding spatial/music story. Offered an approximately three-minute structure and a specific 440/442 Hz beating interaction. No decision to narrow to coding, add all candidates, deploy the spatial branch or expand the freeze was made.

Status: demo ideation and prioritization only. No runtime, scope or release changes; prior judging scores and build-log contents were not consulted.


## PM099 — Lower latency and immediate context feedback

User authorized focused latency iteration. Reuse the same detached main worktree to preserve the concurrently tested spatial branch. Profile actual timings; implement a bounded compact continuation on existing visuals plus immediate frozen-source feedback, with full composition fallback and unchanged review/ownership/current-state/budget guards. No unreviewed generated scene, continuous screen upload, new provider or budget raise. Outcomes pending.

PM097 isolation: concurrent PM096 spatial work owns the original checkout branch. Use detached worktree `.local/pm097/polish` of the same original soma repository, based on main5ea3514; never reset or stage the spatial branch. Snapshot PM096/PM097 prompt records retained from ce53a70. Changes target existing 2D generation/memory/playback only. Shared ledger actual consumed$12.09191425/$15; first read used absent consumedUsd and made no mutation, corrected to actual consumed before any live request.


### PM097 — Implemented reliability and polish outcomes

1. Source-stage isolation and source-driven owned memory retrieval: no personal/learner interpretation primes screenshot reading; bounded exact-term/plural retrieval abstains from irrelevant memories and excludes their relationships/evidence/next activity. Preserve original source/current experiment, ownership, cancellation and revision checks. Separate one application repair from one substantive review repair under original6calls/90s/$0.35 limits; repeated failures stay bounded. Actual first biology rejection motivated recovery; no unsupported source-accuracy or mastery claim. Added application grid reflow preserves scene content/order/references and still requires validation/review, avoiding a model call for panel_overlap. Source qualifiers/visibility limits are explicit. See RELIABILITY_AND_POLISH.md.
2. Connection labels avoid other routed connections and retain full legend text; undirected legend lines, balanced readable labels, contextual composer and concise uncertainty copy preserve existing style. Gemini same-state pause/resume uses actual media time and existing audio buffer; Replay resets;0.8/1/1.2/1.5rates retain audio-driven animation. Browser rate change explicitly pauses. No word alignment, new animation engine, TTS provider call or native hardware acceptance. Real Chromium WAV and mock-media checks pass. Long diagrams still scroll; the existing dock can cover part until scrolling, not a claimed single-screen fit.
3. Final verification:1524offlinepassed/93opt-in-skipped;135Chromium;21desktop;3relay; typecheck/optimizedwebpackbuild/1339-file isolatedtrace with0links/0privateconfigmappings. Restricted offline run had48localhost-listen failures; network-enabled run passed. First new-test build found missing union narrowing; corrected without changing runtime. Earlier focused repair parameterization and real-WAV observation errors were harness defects, retained privately. Old-source comparison reproduces five memory/source regressions. Four fresh public captures plus two retained development sources: initial5/6published, finalrepeat6/6published/exactsave-reopen/render620/375; median27.956s, not faster than earlier~20s. Initial dev-HMR UI timeouts do not count as model failures or render passes. Final six retained-output replays pass against the post-reflow production bundle with no inference. Actual saved prepared BFS→twoMuse-proposed concepts→fresh screenshot relevant retrieval→exact save/reopen passed in18.747s for new generation. All owned live guests deleted. Source URLs and limits in report; raw screenshots/provider outputs remain ignored `.local/pm097`.

Status/deviations: began in same-repo detached worktree from main5ea3514 to protect concurrently authorized spatial branch. PM096/PM097 prompt records preserved from ce53a70; no root/spatial changes staged/reset or separate repository created. Earlier progress message prematurely said6/6; immediately corrected to actual first5/6, and both results are retained. No cap raise/reset/newmodel/newdomain/training/provisioning/native distribution/publication. Shared ledger settled$12.96341875/$15. Runtime246files/67c66684d408c3d7f2fff5c9b19077caa6e9ecac82aadc0cb52bfec0fa9a74d7. Clean CI/hosted verification pending commit/push; do not infer deployment from this paragraph. October31freeze and November4submission unchanged.

PM097 publication evidence: implementation e877662 fast-forwarded canonical private soma main without rewriting history (256commits at that point); original-root spatial branch and its unrelated edits untouched. Existing Vercel integration succeeded at https://vercel.com/jeremiah-sakudas-projects/soma/5wTAyZFz2E2txeC1uJYwtHAckixE. Hosted246-file fingerprint67c66684d408c3d7f2fff5c9b19077caa6e9ecac82aadc0cb52bfec0fa9a74d7 matches; actual prepared-example changed-state save/reopen,0.8×control and620/375render pass with0pageerrors/overflow, no inference/speech charge, ownedguestdeleted. Final actual ledger read2026-10-30T20:52:01.871Z$12.96341875/$15. Clean CI41126305678 pending final result. Private-value scan passed; first archive-check script used wrong key prompts instead of entries, corrected check verifies schema/uniqueIDs/exactPM097 text. Production source build and retained-output replays were rerun after final runtime changes. Local owned server stopped after tests.

PM097 final correction to pending-CI status: clean GitHubActions41126305678 succeeded on e877662, including default Next build,1524offline/93skipped,135browser,28adversarial,21desktop,4diagnostic,3relay and isolated trace1224files/twolinks/0privateconfigmappings. Local webpack trace1339/0links is a separate build result. Hosted acceptance already passed against the same runtime manifest. Report and handoff updated; source/private archive scan and runtime verification pass. No additional model requests or spending after final ledger snapshot.


## EVAL-20261030-88710cac — Independent current-product rubric assessment

1. Reviewed the current PRD opening/current extension, README, implementation of cost investigation and memory, official supplied rubric, and engineering verification documents. Did not consult prior build-log entries, prior evaluation documents or other judge scores. The external event page exposed only its loading shell; rubric weights/descriptions came from the organizer guide supplied locally.
2. Inspected the deployed PM091 experience and public release fingerprint, including its visible memory panel and the prepared weighted graph's local unreachable-goal update. No paid inference or full test suite was rerun. Confirmed canonical GitHub repository remains private. Existing recorded live testing reports 8/10 broad-source publications, roughly 20.7s median successful wait, and bounded graph computation.
3. Independent provisional rubric assessment: Impact 7.5, Meta tooling 8.5, Technical depth/execution 8.5, Demo 7.5, weighted 7.95/10. These are evaluator estimates, not official scores or placement predictions. Priorities: show a source-specific checked intervention and useful changed explanation, gather concrete user task evidence, finish public submission/release accessibility.

Deviations: evaluation only; no product, deployment, permission, spending or release-scope change. This entry and prompt were appended without consulting earlier log content. Native physical execution and arbitrary-topic checked experiments were not credited as demonstrated.


## CLARIFY-20261030-940c6aa1 — Hackathon pilot expectation clarification

1. Clarified from the supplied guide that no pilot, user-count target or measured learning outcome is required; Impact asks about real-world potential and usefulness.
2. Corrected prior recommendation: a small usability check is optional supporting evidence, not a release gate or expected formal study in a ten-day event. Missing a pilot alone should not imply deficient impact.
3. Prioritized a working demo, concrete user problem and credible benefit explanation; brief informal feedback can help if time permits. No new tests, implementation or submission action.

Deviation: clarification of assessment emphasis only; no product-scope change. Prior build-log content and other assessments were not consulted.


## PM101 — Native Mac computer-control acceptance

1. Used native computer control in installed Chrome on the Mac, with a guest window and isolated local synthetic database. Firefox exposed stale screenshots, so no Firefox pass. Inspected revised rendering and exercised pointer orbit, perspective/side presets, part selection, isolation, keyboard sliders and 2D/3D switching.
2. Saved explanation2, Processor selection, separation0.55, cutaway0.2 and the 3D view; navigated away/reopened and verified them visibly. An earlier isolated save/reopen also passed. Left an unsaved assembled-perspective reset visible for review, with tested state still saved in the library. Server localhost:41898 remains local, inference disabled.
3. The user rejected the initial primitive appearance during this acceptance pass (PM102) and chose educational cutaways (PM103). Native review then caught tiny isolation framing; corrected and rechecked on the final production build. This is actual Mac UI evidence, not a claim about all physical GPUs/browsers. No merge/push/deployment/publication.


## PM102 / PM103 — Spatial visual quality revision

1. Replaced the primitive-only appearance with five optional application-owned educational part styles, beveled materials/shadows, annotation leaders, quieter stage, intentional assembly separation and closer isolated-part framing. Preserved legacy primitives, stable IDs, sources and existing assurance. Styling is illustrative, not recovered geometry. No external asset generation, executable model output or new checked family.
2. Added bounded360ms pose transitions with moving connections, reduced-motion final states and resource cleanup. Added unapproved-style rejection, source-preserving style continuity and separation/marker alignment coverage. Full final checks:1570offlinepassed/94opt-in-skipped;147productionChromium;typecheck/build/isolatedtrace1224files/2links/0privateconfig passed. Initial new transition check missed the transient state; observing changes before the click corrected the harness, then all147passed. Native control verification in PM101; responsive screenshots visually inspected.
3. Fresh live test was blocked before inference by the Firestore daily guest-creation cap; no cost, bypass or reset. Ledger unchanged$13.848943/$15. New-style live authoring remains unverified; earlier live-output replay is rendering evidence only. Final252-file manifest2c7eb5049a9b574e24e2b30ffcd1b8d23be7f7c2511e38db1a1275b0e70b1c94. Report:docs/SPATIAL_EXPLORATION.md; private receipts:.local/pm101.

Status: implementation and local checks complete; user visual acceptance and any feature merge remain pending. Existing fixed-composer/small-screen scrolling and broad asset-generation limits remain. Concurrent PM100/PM104 documents are preserved outside this commit.


## PM105 — Clarify Muse authoring versus rendering (October 30)

1. Clarified that live Muse authors validated scene descriptions: parts, arrangement, connections and explanation steps.
2. Detailed meshes are application-owned components; the open prepared example is handcrafted and labeled accordingly.
3. Disclosed that fresh style selection remained unverified after the daily guest cap blocked the PM103 attempt before inference. No code, spending or scope change.

## PM106 — Additional spatial polish and broader component vocabulary (October 30)

1. Expanded Muse's optional strict render-style vocabulary from 5 to 17. Added battery, coil, gear, piston, turbine, pipe, vessel, lens, membrane, nucleus, helix and speaker meshes. Preserved bounded scenes, legacy primitives, source-fit requirements, explanation-only assurance and style identity across reviewed revisions. No external asset service, generated mesh code or new checked model.
2. Iterative polish improved camera fitting, wrapped labels, collision/silhouette avoidance, mesh-anchored leader lines, shadow framing, cell cutaway orientation, helix contrast and selected-camera feedback. Native Chrome review on the user's Mac verified saved state restoration, presets, keyboard separation, isolation and the final leader/assembled presentation. Review server:localhost:41900/explore, live inference off.
3. Full offline suite:1,591 passed/94 opt-in skipped; 20 geometry/layout cases reran after final mesh changes. Final exact-build production browser suite:148 passed. Build/TypeScript and 1,224-file isolated browser trace passed. Runtime:253 files, SHA24d1a1c0e6f8e4d0655d84473e0c25d127cf9efaccf6472fb5915d35b28a7839. Logs/screenshots:.local/pm106; detailed record:docs/SPATIAL_EXPLORATION.md.

Retained failures: expanded instructions initially exceeded the real provider cap; condensed guidance passed with <7,800 tested follow-up characters. Sandbox denied sockets to 48 unit checks; local-access rerun passed. Initial browser build omitted its synthetic public auth key, causing three expected sign-in refusals; configured test build passed. Sandboxed build stalled and was restarted with local worker access. No limits bypassed, provider calls, spend, feature merge, push or publication. Fresh Muse selection of the expanded vocabulary remains unverified (last live attempt:PM103 daily guest cap). Broader UI redesign remains separate; concurrent PM100/PM104 records are preserved.

## PM107 — Evaluate Anatomy as an alternative visual toolkit (October 30)

1. Inspected the public wheresryan22/anatomy README, skill, MIT license, React integration guide, isometric TypeScript kit and moving-3D guide. It is an agent authoring skill and drawing toolkit with SVG, optional WebGL effects and beta moving-3D support; it is not a mesh-generation API. Source: https://github.com/wheresryan22/anatomy.
2. Recommended evaluating complete, purposeful isometric mechanisms against Soma's current generic part compositions. Proposed one original educational mechanism with the existing controls, source links and saved revisions; adoption, rendering quality and performance remain unverified. The toolkit documents React/Next integration; its moving-3D guide explicitly reports beta status, not production readiness.
3. Clarified the integration boundary: Muse would author validated structured content and bounded assembly/motion choices through a new adapter; installing the coding skill alone does not change live Muse authoring. Keep deterministic lesson checks and prohibit arbitrary generated executable code. MIT notice retention is required if vendored. No installation, implementation, tests, provider calls, spending, merge or publication performed.

Deviation/status: research and recommendation only, not an adopted architecture or scope change. Preserve the existing spatial branch and current renderer for comparison until an authorized prototype is evaluated. Concurrent PM100/PM104 documentation remains untouched.

## PM108 — Anatomy comparison implementation and authorized $20 cap (October 30)

1. Implemented an original Anatomy-backed isometric adapter alongside Three.js on the existing spatial branch. All17 approved styles, original relay assembly, same-scene side-by-side comparison, shared selection/step/separation/isolation, enclosure cutaway, persistent renderer preference and backward-compatible saved states. Pinned MIT geometry kit and notices; no upstream showcase reuse, beta turning engine, generated scripts or new scientific model. Independent camera tests align axes/zoom; painter constraints fix broad-board occlusion. Three.js skips callback-only updates to prevent redundant idle GPU frames.
2. Executed final checks:1,615offlinepassed/94opt-in-skipped;156exact-build production Chromium journeys passed, including four actual prior Muse-output replays. TypeScript/default build and isolated trace1,224files/twointernal links/zero private-configuration mappings passed. Native Chrome verified saved Anatomy state, synchronized steps, selection, cutaway and isolation. Responsive comparison/catalog studies checked1440/620/375. Runtime257files/SHAd4b232df147e8b1f680aa459bce2e155b006782fde44d228dcfbd95a13436925. Report:docs/ANATOMY_COMPARISON.md; private receipts:.local/pm108.
3. Raised local cumulative application cap from$15 to$20 as explicitly requested; allocation$150, reserve and all previous consumption/unknown reservations preserved. Actual final ledger2026-10-30T22:47:42.862Z:$13.99902475, remaining$6.00097525. Fresh Muse test was blocked by existing MAX_GUESTS_DAY before inference:zero calls/spend, no reset/bypass. Fresh expanded-style authoring remains unverified; earlier real-output replay is only renderer compatibility evidence.

Retained failures: sandbox socket restrictions affected48 offline cases before the permitted rerun. The first preview/trace used a dependency symlink incompatible with isolated packaging; materialized the same pinned dependencies, then default build/trace passed. Initial SVG painter order hid a sensor behind its support board; corrected. Transparent-shell picking and real hit-point/disclosure test defects were fixed. Final default-build regression initially155/156; strict pixel checks exposed tiny software-GPU edge differences and direct instrumentation then found redundant actual GPU draws. Fixed callback-only rendering, retained zero-idle-draw assertion, bounded raster tolerance and repeated full suite to156/156. No provider billing purchase, hosted configuration change, main merge, push, deployment, publication or user visual acceptance claim. Concurrent PM100/PM104/PM109/PM110 records and unrelated design/proposal work remain outside this change.

Implementation commit: [3ee1edf](https://github.com/Jeremiah-Sakuda/soma/commit/3ee1edf).

## PM111 — Clarify Anatomy authorship (October 30)

1. Clarified that Muse authors validated scene specifications: part choices, positions, connections, explanation steps and bounded poses.
2. Anatomy projection and Soma component geometry/detail are application code. The currently reviewed relay is an original prepared example, not a fresh model-generated figure.
3. The implemented comparison supports existing structured Muse scenes, not bespoke Anatomy figure generation from scratch. No code, tests, model calls, spending, merge or publication in this clarification.

Deviation: none; authorship clarification only.

## PM112 — Compare Muse involvement across renderers (October 30)

1. Clarified that current Three.js and Anatomy views consume the same validated scene specification; neither currently gives Muse more authorship.
2. Distinguished application-owned geometry and rendering from Muse-authored part choice, arrangement, connections, poses and explanation. Renderer preference changes presentation only.
3. Identified richer bounded mechanism/geometry/motion authoring as the way to expand Muse involvement; this remains proposed, not implemented or verified by the comparison. No code, calls, spending or release change.

Deviation: none; clarification only.

## PM113 — Muse mechanism authoring (October 30)

1. Implemented bounded Muse-authored convex prisms, lathe profiles and tube paths, with named controls, coupled motion and step poses. A shallow provider payload stays within the ten-level API limit; the application binds one model-chosen assembly frame and validates the complete scene before factual review/storage. Both renderers use one compiler; new custom mechanisms default to Anatomy. Catalog styles and legacy saves remain compatible. No generated code, arbitrary assets or checked physics.
2. Completed a real synthetic-source Muse/Wonder journey after recorded fixes: six custom pieces/all three forms, a gate/handle coupling independently checked across five opening values, substantive geometry rejection/repair before publication, then a contextual follow-up and exact Firestore reopening. First5calls/40.218s/$0.08729075; follow-up3calls/26.695s/$0.06486925. Added an accurately labeled recording alongside the separately labeled prepared fixture. This is development evidence, not a reliability, learning or latency benchmark.
3. Final verification:1,640offline passed/95opt-in skipped;166production-browser passed, including both actual revisions in both renderers; TypeScript/default build/packaging trace passed (1,224files/two package links/zero private configuration mappings). Native Mac Chrome exercised prepared steps, manual controls, comparison, selection and exact reopening, plus actual recorded comparison. Runtime263files/SHA2453777e926c3ed1084f131541e9388d337673e9ddb0501ee56e791d36ac436d. Preview41906 has live inference disabled. At2026-10-31T00:13:10.915Z shared ledger$14.93734875/$20, leaving$5.06265125; prior charges and two uncertain$0.35reservations retained.

Retained failures: two provider schema-depth failures; one4,096-token truncation; missing spatial panel and duplicate sequence/step IDs; live Wonder geometry correction and contextual contract repair. Fixed the shallow authoring contract, constrained spatial composition and shared frame, and bounded spatial output to6,144tokens/minimal effort under the same6calls/90s/$0.35turn reservation. Local instruction-length, shared-fixture-coordinate, collinear-edge, motion-observer/entry-clock and sandbox-build failures were corrected and rerun; receipts retained. Full details: MUSE_MECHANISM_AUTHORING.md. No daily-limit reset, main merge, push, deployment, publication or user visual-acceptance claim. Concurrent PM100/PM104/PM109/PM110/PM114/PM115 design/polish work remains outside this commit.

Implementation commit: [7f1fa17](https://github.com/Jeremiah-Sakuda/soma/commit/7f1fa17).

## PM117 — Matched before/after mechanism examples (October 30)

1. Generated three actual matched pairs from original synthetic gate, sliding-piston and three-blade-rotor sources. Before uses the verified PM108 fixed-part contract; After uses PM113 custom geometry. Five accepted outputs are fresh and saved/reopened in real Firestore; the gate After reuses the accepted PM113 run and is labeled. One first rotor After attempt failed and is retained. No model output was replaced by hand-designed geometry.
2. Built a local replay gallery at http://localhost:41908 with common camera/renderer controls, three stages, custom After sliders and collapsed source/generation details. Flagged the old rotor’s turbine-preset/source mismatch; both raw outputs remain unchanged. Saved the complete accepted responses, source images, actual usage/audits, viewer source and third-party notices under docs/examples/pm117. The canonical product runtime remains unchanged; this is a visual development comparison, not a reliability or physics benchmark.
3. Verification:9browser checks passed across all pairs, real WebGL/SVG, source bytes, responsive/keyboard controls, browser Back and no-inference boundaries;3geometry checks passed for rigid moving groups/fixed supports; TypeScript and the production gallery build passed. In-app inspection exercised the generated control and examples. New ledger increment$0.32454525; cumulative$15.261894/$20 at2026-10-31T00:23:46.288Z, leaving$4.738106. All prior usage/reservations and limits retained. See docs/examples/pm117/README.md and .local/pm117 for executed receipts and retained failures.

Deviation: no product scope change. The first rotor After generation required a fresh second attempt after a failed application repair; its known cost remains included. Initial gallery test failures were noncanonical range strings and a label-based blade assertion that also counted the hub; corrected test inputs/classification and reran. Native/in-app and automated checks do not establish user visual acceptance. No main merge, push, deployment or publication. Concurrent design/polish prompts and artifacts remain outside this change.

Artifact commit: [b2430c8](https://github.com/Jeremiah-Sakuda/soma/commit/b2430c8).

## PM118 — Direct Anatomy slider manipulation (October 31)

1. Reproduced all three normal-motion slider regressions. Manual overrides now render exact poses immediately and cancel explanation easing; authored steps retain bounded animation and exact final values. Cached immutable swept bounds, stopped the gallery's unchanged Before plate from recomputing, and moved numbered markers with current geometry while preserving stable camera framing. Six held-drag/reversal/exact-pose browser checks passed.
2. Found a separate actual Muse piston error: excessive travel intersected the fixed base and rod/head/grip had gaps. Muse generated a corrected recording from the same synthetic source; Wonder approved it, then real Firestore save/exact reopen passed. Independent checks cover clearance, attachment, coupled rigid motion and fixed supports across101positions. The original accepted output remains archived and the gallery discloses the revision. Three provider calls/19.510s/$0.04767325; ledger$15.30956725/$20 at2026-10-31T17:28:51.758Z, remaining$4.69043275. Prior spending/reservations/limits retained.
3. Final checks:1,647offline passed/95opt-in skipped;166exact-production-browser passed, plus6new gallery regressions and9existing gallery compatibility checks. TypeScript, default Next/Vite builds and packaging trace passed (1,224files/two package links/zero private configuration mappings). Native Mac Chrome checked all three controls and the corrected full-compression pose; a fresh in-app tab exercised the final slider. Runtime263files/SHA195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1. Report:docs/ANATOMY_SLIDER_FIX.md; private receipts:.local/pm118; current gallery:http://localhost:41908/#piston.

Retained failures and limits: previous single-fill/reduced-motion checks missed continuous-drag lag. Initial repair question exceeded the unchanged input limit and was rejected with zero inference/spend; the bounded retry succeeded. The first credential-free production build omitted the synthetic public Firebase key needed at compile time for three account fixtures; rebuilt with that test-only setting. The initial combined idle assertion counted the separate2.4s explanation clock; corrected to assert immediate geometry stability and idle work after that existing clock settles. Both subsequent full browser runs passed166/166, including the final marker-corrected runtime. Original in-app tab had stale connection-error state; a fresh tab loaded the running loopback gallery. No general collision solver, checked physics, user visual acceptance, main merge, push, deployment or publication. Concurrent design/polish records and artifacts remain outside this change.

## PM119 — Web-authored motion explanations (October 31)

1. Inspected the implemented mechanism authoring contract: custom bounded 3D geometry still has application-owned projection/palette and no generated HTML/JavaScript. Identified a proposed alternative in which Muse authors custom vector composition, story beats and timed motion through a controlled scene/timeline renderer.
2. Verified official Anthropic Artifact support for HTML/SVG/interactive React and Remotion's frame-driven React/player model. Recommended prototyping a source-grounded, narrated 2D motion explanation with direct scrubbing and an interruptible experiment; optional rendered video is an export of the same composition, not video-model inference. Visual quality and live Muse authoring reliability remain unverified.
3. Discussion/recommendation only: no implementation, dependencies, model calls, spending, tests, scope adoption, main merge, push or publication. Shared cap remains$20; latest observed consumption$15.30956725 from PM118 is historical, not a newly fetched ledger observation.

Status: proposed direction, not adopted architecture. Preserve typed output validation and application-owned checks; free-form executable model code would require a different runtime boundary and is not implied by this discussion. Sources:https://support.anthropic.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them and https://www.remotion.dev/docs/idea and https://www.remotion.dev/docs/player.

## PM120 — Muse motion film comparison (October31)

1. Built the authorized same-source comparison at http://localhost:41912: corrected actual PM118 Anatomy output beside an actual Muse-authored24-second vector film. Model-authored artwork, custom paths, typography, palette, labels, narration words and timing run through a bounded deterministic React/SVG renderer with HTML/CSS controls. Shared direct travel pauses the film; media time drives voiced playback, with silent fallback, chapter seeks, reduced motion and a transcript. Locally rendered720-frame/30fps/H.264/AAC MP4 includes model-written captions and prepared macOS Samantha narration. No video model, new package or generated executable code.
2. Final generation and layout repair passed application validation and actual Wonder advisory review. Preserved rejected outputs, first-reviewed layout and final responses. Twenty actual provider calls across seven bounded operations cost$0.50475875; summed generation-operation time191.186s is not a one-turn latency claim. Ledger$15.814326/$20 at2026-10-31T21:46:18.087Z, remaining$4.185674; previous usage, unknown reservations, allocation reserve and all admission limits retained. All sources are original synthetic material.
3. Executed20domain cases,9production-gallery browser journeys (101actual rendered travel settings, attachments/clearance, label/part/path bounds, pointer reversals, real media clock, interruption/completion/idle/failure fallback,375/620/1440, keyboard/reduced motion, source bytes and no-API serving) and the complete MP4 export check. TypeScript/Vite production build passed. Full offline1,667passed/97opt-in skipped, with affected20cases rerun after final changes. In-app playback completed0:24 and native Mac Chrome exercised playback/keyboard takeover. Runtime263files/SHA195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1 unchanged. Scope/receipts:docs/examples/pm120/README.md and .local/pm120.

Retained failures: initial harness launched before its test directory existed (zero calls); initial advisory output exhausted1,024tokens; real candidates clipped labels, intersected parts, doubled motion or misstated a changing gap. Candidate-preserving repairs replaced context-losing whole-layout retries. Some reviewer findings misread clamped opacity/internal IDs; supplied actual runtime states/source semantics, preserving substantive review. The Mac locked before the final native refresh; final layout checks completed in-app/browser, with native controls verified earlier. A first approved layout still had text over a guide; visual inspection caught it, Muse corrected only the local labels/leaders/draw order, and a new label-versus-part regression passed. First browser failures involved range-event priming and implicit output/status selector ambiguity; corrected the harness and improved direct-control takeover/announcement behavior. This is an explicitly authorized local prototype, not a generic film platform, new checked domain, canonical film persistence/follow-up integration or adopted renderer default. No main merge, push, deployment, publication or user visual-acceptance claim. Concurrent design/polish artifacts remain untouched.

## PM121–PM122 — Four-stroke engine refinement (October 31)

1. User selected a single-cylinder four-stroke cutaway. Implemented actual Muse-authored engine SVG art/story, deterministic connected crank/piston/rod and idealized valves/flow, four stroke selectors, immediate720° manipulation, clearer single-scene hierarchy and enlarged phone framing. Prior comparison retained. [Authorship and scope](examples/pm121/README.md).
2. Five bounded actual-generation operations/16calls added$0.47103575; latest ledger$16.28536175/$20. Retained rejected generations and reviewer defects. Accepted Muse repairs are exactly reproducible from the recorded base and two bounded patches; no artistic hand edits. Mac Samantha/FFmpeg export is720frames/30fps/24sec800×600H264/AAC; no video-model claim.
3. Full offline1679passed/99skipped after sandbox-only local-port failures;13focused engine cases and ten browser journeys passed, including held-pointer reversals,241 rendered angles, voice interruption/fallback, closed valve seats, keyboard/reduced motion and phone layouts. Typecheck/build and unchanged263-file PM118 runtime passed. Final in-app visual inspection and natural narrated0→720° completion passed. Native Mac unavailable while locked; no native acceptance claim. Local experimental refinement only; no canonical save/follow-up integration, main merge, push, deployment or publication.

## PM123 — Startup-demo quality iteration (October31)

1. Refined the same engine through illustration/material, interaction/layout, editorial/media and accessibility passes. Actual Muse path/copy refinements, direct two-turn crank dragging, pose-preserving part inspection, keyboard focus recovery and compact desktop/phone controls; preserved original PM121 geometry lineage and canonical runtime. [Scope, authorship and retained failures](examples/pm123/README.md).
2. Eight actual Spark/Wonder calls across four bounded operations added$0.1686385; latest ledger$16.45400025/$20. First oversized instructions failed locally with zero provider calls/charge; subsequent actual copy/shape edits and exact patch lineage retained. Complete Mac narration and720frames/30fps1920×1080H264/AAC export passed; no video model or live-on-playback claim.
3. Full1690offline/100opt-in skipped,23focused engine/presentation cases and16production browser journeys passed, including two-turn/reversal dragging, media interruption/fallback, selection/focus/shortcuts, text contrast, full-HD text bounds and target desktop/phone controls. Typecheck/build/export, served-film hash and unchanged263-file PM118 manifest passed. Actual in-app direct-handle0→89° and final visual/playback review; native Mac unavailable while locked. No main merge, push, deployment, publication or canonical engine save/follow-up integration.

## PM124 — Further engine refinement (October31)

1. Added expanded presentation framing,0.5×/normal audio and silent playback, optional cycle repeat and clear Resume film wording. Preserved pose, part focus and scroll recovery. Added deterministic forward-stroke piston/phase guides, intake state labeling and cast-fin/rod material detail. [Authorship/scope](examples/pm124/README.md); recorded Muse data unchanged.
2. No provider calls or additional inference spending. Refreshed720-frame/30fps/24sec1920×1080H264/AAC film uses the existing complete Mac narration and same renderer. Prior cap/consumption/reservations preserved; no balance reset or new ledger observation claimed.
3. Full1696offline/100opt-in skipped,29focused and22production browser journeys passed: real and silent half-speed, rate/pose continuity, voice repeat boundary, manual interruption, presentation/focus/scroll, forward-cue consistency, prior geometry/media/privacy/phone/contrast checks. Typecheck/build/export, served-film hash and unchanged263-file PM118 manifest passed. In-app half-speed narration/repeat visibly returned from713° into intake; final presentation inspected/captured. No fresh native Mac, canonical engine integration, main merge, push, deployment or publication claim.

## PM125 — Three rubric review-and-iteration rounds (October31)

1. Completed three independent read-only subagent judging roles across three review→implementation→verification rounds against Impact30%, Meta tooling25%, Technical depth20%, Demo25%. Retained all nine subjective scorecards, substantive findings and honest canonical-engine/learner-impact/release gaps. [Round-by-round record](examples/pm125/JUDGING.md) and [truthful judge walkthrough](examples/pm125/DEMO_ROUTE.md). Scores precede their resulting corrections; no organizer or final-acceptance claim.
2. Implemented inspectable original synthetic source/actual Muse output, authentic rejected exhaust valve→exact recorded Muse repair, optional identical-linkage/different-valve cycle comparisons, representative stroke previews with full-sentence narration restart, coherent reduced-motion geometry/readouts and independent media-position persistence, exact accessible spoken transcript, presentation proof/focus, bounded post-start/metadata audio recovery and truthful transport/ending/framing. Existing model art/script unchanged; no new inference/spend or budget reset under the retained$20 cumulative cap.
3. Round1:28browser passed; round2:32browser and1700offline/100skipped passed; final:40browser,1701offline/100opt-in skipped, typecheck/build/full-HD720-frame export and unchanged263-file PM118 manifest passed. Parent inspected actual source, repair and comparison in-app; saved screenshots privately in.local/pm125. Retained initial test-selector/transform/initial-pose assumptions and real desktop overflow corrections; round3 independently caught and fixed narration skip on reduced-motion pause with new voiced/silent continuity/delayed-media cases. No fresh native-Mac/hosted full-journey verification, canonical engine integration, main merge, push, deployment or publication. Concurrent design/polish artifacts and other chat log entries remain untouched.
