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

## PM004 — Evaluate winning potential against the rubric

**Recorded:** October 26, 2026, in a separate advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM004`, including the pasted participant guide. The guide matches the P004 copy apart from trailing whitespace; it adds no new event requirement.

**Top 3 outcomes:**

1. Scored the documented plan against the Stage Two rubric as advisory judgment, not a predicted ranking. Technical depth is the strongest criterion. Impact faces the crowded study-tool category, and Meta tooling use is narrower than the PRD describes because computer use and returned-work image reading are conditional in the build plan. Demo is the largest gap because the three-minute video is the primary artifact and the only artifact in the final round.
2. Recommended raising the ceiling without new feature categories: make Spark's discriminating-diagnostic decision the central Meta moment, feed it from a real returned-work image, open the video on no-prompt autonomy from a real class source, and attach one measured preparation-time result. Also recommended moving research-grade evaluation effort (the StudyFetch comparison and multi-student delayed-attempt study) toward video production, and keeping R12 to a short beat or the judge route.
3. Confirmed eligibility hygiene: the pre-event planning baseline `1a7d3a2` is dated 11:10 AM ET and the first code commit `87747d7` is dated 12:42 PM ET on October 26, after the kickoff and organizer start announcement. The repository is still private, and the public contribution record remains a pending release step.

**Plan deviations:** None adopted. These are recommendations only. No PRD, build plan, decision, code or deployment changed, and the October 31 freeze is unchanged. The deployed Today and lesson screens were viewed read-only; no tests or model calls were run.

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

**Plan deviations:** None adopted. This strengthens the existing inspectability objective; detailed implementation and acceptance tests remain future work. Preserve the concurrent uncommitted strategy proposal and PM007 log entries.

## P034 — Implement progressive AI auditability and list remaining user work

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Implemented a durable owner-scoped journal independent of workspace revisions, actual source/model/tool/check events, concise model-stated purposes, publication confirmation, bounded repair/usage/failure history and protected JSON export. Engine/collection integration `3bf1a9c`, `f74e882`, `a70f547`; storage `f741ac7`, `7cf23bf`, `12e9f3f`. Journal outage stops further inference; a post-commit outage preserves saved work with an incomplete notice. No raw provider reasoning or extra narration calls.
2. Shipped the Ready Card AI activity disclosure with live progress, source/model labels, evidence versions, full retained-history pagination and exports (`d2afb3d`, `00eb4b1`). Fixed the tool-field collision using distinct `auditRationale`, pinned disclosure to lesson/model/source context and committed revision, and withheld discarded diagnostic explanations (`166fb73`, `710e197`, `bf62b5f`). Typecheck/build, **364 default tests** (27 opt-in skipped), **23 browser journeys**, and **2 real Firestore audit cases** passed. The final two managed worker/adaptation boundary cases passed in 67.47s with scripted Meta transport, separately from real inference. Runtime `00eb4b1` deployed READY as `dpl_49WFE1KpromZZ5WZCpTWabaG7nh6` at the production alias.
3. Wrote [AI auditability](AI_AUDITABILITY.md) and [remaining user work](USER_REMAINING_WORK.md), distinguishing immediate source selection, content review/pilots, optional Trigger setup and submission decisions from engineering/release gates. Trigger secrets remain absent; the existing authorized GitHub scheduler remains active. Actual institutional source acceptance and independent learning/scientific validation are not implied by audit tests.

**Hosted evidence:** One actual Spark source-only no-effect run over disposable synthetic demo material passed in 12.56s: durable live progress, protected in-flight model text, recorded short stated purpose, actual application publication/usage, same projection in JSON export, owner/session denial, reload persistence and zero-inference reuse. Two Meta calls cost $0.01678750; aggregate ledger $0.82329025/$2. Both sessions deleted. No private course material used. This does not certify diagnostic teaching quality or real connector access.

**Remote verification:** [GitHub CI 40418506341](https://github.com/Jeremiah-Sakuda/soma/actions/runs/40418506341) passed for `19f0af3`, covering clean install, module restrictions, typecheck, default suite, optimized build and all browser journeys. Subsequent evidence/documentation edits do not change deployed runtime `00eb4b1`.

**Verification corrections:** The first broad test run hit a five-second existing ordering stress-test deadline under 60 concurrent workers; the whole suite passed with four workers, now the default. An intermediate exact route assertion needed the new committed-revision field; corrected and the final suite passed. A proposed diagnostic field initially collided with domain `rationale`; fixed before release and regression-tested. Historical failures are retained, not counted as successful executions. Firestore cleanup initially required missing collection-group indexes; the two ASC `expiresAt` indexes were provisioned without enabling billing and both managed cases then passed in 10.41s. All these managed fixtures used original synthetic data and no Meta calls.

**Plan deviations:** None adopted. Strengthens existing inspectability following P033 without a new model family, provider, spend cap or source scope. The concurrent PM007/PM008 advisory entries and strategy proposal remain unadopted and untouched.

## P035 — Iterate on architecture with the supplied skill

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable.

**Top 3 outcomes:**

1. Applied the user-linked [Improve Codebase Architecture skill](https://github.com/EAIconsulting/mattpock-skills/blob/main/skills/engineering/improve-codebase-architecture/SKILL.md), its HTML report guidance, Codebase Design vocabulary and Deepening guidance. Reviewed handoff, PRD/decisions and recent hotspots; CONTEXT.md and docs/adr were absent, so existing product/decision documents remain authoritative.
2. Completed a read-only subagent walk plus direct code/test inspection. Found three candidates: typed failure propagation/recovery (recommended first; existing engine errors reduce typed Meta failures to prose that job regexes parse), concentrated audited publication (four callers independently own ordering/commit flags), and journal adapter contract consistency (lower priority; caller interface already small). Each has evidence links, deletion test, preserved guarantees and specific test improvements. No interfaces or runtime refactor were adopted before the skill's candidate selection.
3. Created and opened `/private/var/folders/2k/24m45bdj4h51j76jmdm0kf9h0000gn/T/architecture-review-20261026T232407992365Z.html`. Browser rendering verified three candidate cards, three before/after diagram pairs, a rendered Mermaid diagram, desktop 1440/mobile 390 layouts without overflow and no page errors. Fixed CDN heading-style precedence and improved graph orientation after visual inspection. Actual application tests were not rerun; no live model/source calls, spend or deployment changes were made. User candidate selection is the next required step.

**Plan deviations:** None adopted. The invoked skill explicitly asks the user to choose a candidate before interface design and the grilling loop; implementation remains pending that selection. Preserve source consent, immutable evidence, ownership, budgets, freeze and release gates. The HTML report stays in the OS temp directory as required; only build-log maintenance belongs in the repository. Concurrent PM007/PM008 advisory work remains untouched.

## P036 — Rubric feedback and a single diagnostic demo moment

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable. This is the newly supplied feedback message; existing advisory PM008 remains a separate historical entry and is not rewritten.

**Top 3 outcomes:**

1. Reviewed the supplied assessment against PRD R9/R10/R11, the student-hub scope and S1/S2/D3 in the unadopted strategy proposal. The focused returned-work → competing hypotheses → discriminating activity → response → revised next activity sequence fits existing scope; reducing R12's video role is a proposed presentation change, not deletion of its product behavior. Numerical award scores and claims about other entrants remain judgments, not verified forecasts.
2. Identified two necessary qualifications: a single prediction changes support for provisional hypotheses rather than proving a misconception, and an exact quiz circuit can be interactive only if it fits the approved checked family and source interpretation is supported. Preserve the user's earlier actual-class direction; do not select resistors solely for visual drama. Current image/PDF interpretation and model-directed browser navigation remain unimplemented; the fully-built assessment does not establish them as working.
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

**Plan deviations:** P035's selection gate is satisfied by the user's explicit “Do all 3.” No further confirmation was needed for the reviewed refactors or hero-story documentation. The three-minute presentation emphasis changes under P037; no research-grade evaluation deferral, second family or removal of product scope is adopted. Preserve the October 31 freeze, November 4 deadline and $2 operating cap. Concurrent PM007/PM008 advisory entries and proposal remain untouched.

## P038 — Rerun architecture review and refresh manual work

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable. Work dated October 27, 2026 in the client timezone.

**Top 3 outcomes:**

1. Reapplied the supplied Improve Codebase Architecture and Codebase Design skills against `03a9565`, the current glossary, decisions and recent hotspots, including a separate read-only subagent walk. P037's three refactors remain implemented. New candidates: disclosed course evidence (recommended with the returned-work slice), bounded inference accounting, and lower-priority durable preparation intent. Each has evidence, before/after visuals, deletion test and test improvements; no new interface or refactor was selected or implemented.
2. Confirmed the owner account is enabled with an active workspace but **zero saved provider connections**, using safe metadata only. No course bodies, credential values or decrypted tokens were read; no provider requests or cloud changes were made. Trigger keys remain absent; ledger is **$0.83999350/$2**. Updated [remaining user work](USER_REMAINING_WORK.md): connect/select Google and institutional pages, supply an actual-class returned-work example, then review/test/public-submission inputs; image/PDF/region work and release acceptance remain engineering tasks, not visual fine-tuning.
3. Created and opened `/private/var/folders/2k/24m45bdj4h51j76jmdm0kf9h0000gn/T/architecture-review-20261027T133220857920Z.html`. Browser check: three candidate cards, three before/after pairs, rendered Mermaid, no page errors or horizontal overflow at 1440/390 widths. A direct synthetic local probe reproduced an unversioned lesson surviving automatic-context selection; code inspection also found ordinary preparation counts an unsent preflight request while investigation reverses it. These remain unfixed review findings; the call-count case was not engine-reproduced. No application suites, live model calls or deployments were executed this review.

**Plan deviations:** None adopted. The skill says “Do NOT propose interfaces yet” and requests candidate selection after the report; that next step remains pending. Recommend the two small correctness fixes and evidence deepening alongside existing R9 work rather than another broad architecture-only round. Preserve the hero objective, one-family scope, source/privacy gates, $2 cap and October 31 freeze. Concurrent PM007/PM008 advisory work remains untouched.

## P039 — Secure institutional login and primary Blackboard access

**Verbatim prompt:** Preserved in the canonical archive. Exact received timestamp unavailable. Work dated October 27, 2026 in the client timezone.

**Top 3 outcomes:**

1. Inspected the existing browser route, connection storage, collection policies and UI against current Browserbase contexts/live-view/session documentation and BU's official Blackboard login guidance. Reaffirmed user-completed provider/SSO login and MFA with per-workspace/provider persistent contexts; no institutional password vault, password `.env` field, model login loop or copied cross-site SSO context. Blackboard is the primary access path; Piazza and Gradescope remain separate contexts and acceptance checks.
2. Wrote [institutional authentication and trust model](BROWSER_AUTHENTICATION.md), distinguishing existing controls from unverified production gates. Browserbase hosts the login and sensitive browser state; contexts may contain cookies, storage and saved form data. The authorized application runtime remains trusted with account access. Page selection enforces collection scope but does not make the website session a provider-issued read-only grant. Onboarding disclosure, hosted no-recording/logging proof, actual BU SSO/read/expiry/reconnect, retention/rotation and cleanup verification remain open engineering work. Updated decisions and Jeremy's manual checklist accordingly.
3. Reran **43 existing synthetic checks**: 33 browser policy/lifecycle cases plus 10 Google/shared connection encryption cases, all passed. `git diff --check` passed. These establish tested application behavior, not live institutional access, provider retention guarantees or a security certification. No source content, tokens, credentials or hosted browser were opened; no live provider/model calls, spend, runtime changes or deployment occurred.

**Plan deviations:** None adopted. This clarifies the October 26 session-based login decision and existing read-only access objective. No local companion/extension, new infrastructure, source scope, password handling or budget increase is adopted. Prior architecture candidates and production acceptance work remain pending. Preserve concurrent PM007/PM008 advisory content and the unadopted rubric proposal.

## P040 — Plan synthetic learning-graph polish before real coursework

**Verbatim prompt and attachment:** Preserved in the canonical archive, including the complete supplied scope. Exact received timestamp unavailable. Work dated October 27, 2026 in the client timezone.

**Top 3 outcomes:**

1. Read the attachment and existing PM012 planning edits, PRD, build plan and implementation contracts. Adopted the bounded graph scope without restarting the app: evidence → competing explanations → checked experiment → response-driven revision → useful next activity → fresh application. Existing hypotheses/experiments/jobs/audit are reuse points; linked concept records, approved prediction forms, exposure completeness, meaningful follow-up and R9 image/region support still require implementation/verification.
2. Added [Learning Graph Milestones](LEARNING_GRAPH_MILESTONES.md) with six manageable increments, reviewable tasks, dependencies, owners, explicit exit evidence, a synthetic scenario matrix and conditional real-source validation. Updated PRD acceptance and build-plan priority, scope delivery override, handoff, decisions and owner checklist. Jeremy's account connections are no longer a prerequisite for the next development increments. Preserve existing planning refinements; the original attachment remains verbatim in the archive.
3. Documentation verification checks local links, whitespace, archive equality and milestone identifiers; results recorded below. This turn is planning only: no application implementation/tests, private course reads, live model calls, training, spend, deployment or scheduler changes. All milestone completion claims remain pending executed evidence.

**Plan deviations:** Explicit user-directed sequencing change: synthetic polish precedes personal-course testing, superseding the original Day 1/PM012/P037 real-course-first dependency. Real-course fit, two live source types, independent review, numerical, held-out, R9/privacy and genuine pilot gates remain required. Keep one quantitative family, $2 aggregate cap, October 31 freeze and November 4 deadline. Fine-tuning and a cross-course bridge remain conditional stretches. Unrelated advisory prompts and rubric proposal are preserved.

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

## PM014 — Re-ask whether the fully implemented plan could win

**Recorded:** October 27, 2026, in a new advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM014`. The typed text is identical to PM008, and the pasted guide is referenced to the PM008 copy (see the archive's paste note).

**Top 3 outcomes:**

1. Re-read the current scope with full implementation assumed: [Product Brief](PRODUCT_BRIEF.md), PRD hero moment, storyboard and Meta tooling sections, [Learning Graph Scope](LEARNING_GRAPH_SCOPE.md), the unadopted [Rubric Strategy Proposal](RUBRIC_STRATEGY_PROPOSAL.md), and the PM008/PM013 assessments. The pasted guide adds no new event requirement.
2. Scored it independently as advisory judgment, not a predicted ranking: Impact 7–7.5, Meta tooling 7.5–8, Technical depth about 9, Demo 7.5–8, about 7.6–8.1 weighted. Verdict: yes, it could win, but it is a finalist-range contender rather than the favorite. This agrees with PM013. Best Agentic Use-Case is the most natural bonus; the open-weight bonus applies only if the specialist stretch ships.
3. Named what limits the ceiling: the study-tool first impression next to the guide's anti-project list, a one-person impact base, a modest intro-circuit visual, a payoff that is intellectual rather than visceral in a live video round, and use of one Meta model. Named the moment most likely to lift it: show Spark's discriminating experiment, including the rejected or repaired uninformative one, as the "surprised even us" beat.

**Plan deviations:** None adopted. No PRD, build plan, decision, code or deployment changed. No tests or model calls were run. Concurrent uncommitted implementation work, the PM013 entry and the strategy proposal were left untouched.

## PM015 — Explore alternative UI directions in parallel with graph work

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM015`.

**Top 3 outcomes:**

1. Reviewed the selected [UI Direction](UI_DIRECTION.md), the earlier unselected directions in `design-system/soma/directions/` (Fieldnotes, Daylight, Focus, Notebook, Agenda) and the deployed synthetic demo's Today and lesson screens, viewed read-only. Each earlier option restyles a study dashboard, and none shows the competing explanations or the discriminating experiment on the first screen.
2. Used Jeremy's locally installed UI/UX Pro Max skill (search only, nothing persisted). Its `--design-system` result (Neumorphism, Poppins) was a poor fit and was not applied, so targeted style, type and product searches guided the directions instead. Built four interactive, unselected directions as a private design canvas (https://claude.ai/artifact/5NaNL77LNFvGKhbWzFuyBk): F Casebook, G Bench, H Plate and I Studio. Each puts the Quiz 3 answer, explanations A and B, the R₂ experiment with a hidden checked trace, the optional prediction and a response-dependent revision on the first screen. Sources and rationale are in [the canvas folder](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified: no render, contrast, keyboard or reduced-motion check was run on the canvas boards. The revision states are scripted for the mockup, not Spark output. No direction is selected.

**Plan deviations:** None adopted. UI Direction (Ready Card) remains authoritative until Jeremy selects a change and it is recorded in Decisions. No `src/` files, PRD, build plan or deployment changed, so there is no overlap with the concurrent graph session's files. The physics in the mockups is computed in the board script for illustration; production lessons must still read from the checked model.


## PM017 — Give the explored directions personality

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM017`. PM016 was taken by a separate Antigravity advisory turn before this entry was written.

**Top 3 outcomes:**

1. Diagnosed the PM015 boards: F–I change typeface and palette but share a generic dashboard skeleton with stock-style icons. Soma doesn't own anything in them. Personality needs one idea that sets the mark, symbols, voice and motion together.
2. Added three static personality concept sheets to the same private canvas: J Neuron (the meaning of "soma": dendrite sources converge and one activity fires), K Margin notes (Soma as a TA's margin pen, with graphite student, red instructor and violet Soma inks expressing the observation/interpretation separation rule) and L Specimen (periodic-table tiles for Soma's own concepts; a lesson's history reads as a formula). Each sheet has a mark, six custom symbols, the hero moment in the product, voice samples and a signature motion with a reduced-motion fallback. Sources and rationale were added to [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified and unselected: the sheets were not rendered or checked for accessibility, and no direction or concept is adopted.

**Plan deviations:** None adopted. UI Direction remains authoritative; no `src/`, PRD, build plan or deployment change.

## PM018 — Still not sold on the explored directions (PM019 clarification answers)

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entries `PM018` (message) and `PM019` (answers to four multiple-choice clarification questions).

**Top 3 outcomes:**

1. Stopped generating options blind and asked about references, the first feeling, a character and what missed. Jeremy picked Linear, Raycast and Arc; Duolingo and Headspace; and Things, Notion and Readwise. The first feeling should be "curious, want to touch it", with no character, and J–L were "too conceptual".
2. Built one real Today screen from those answers, M · Playground, in light and dark on the same private canvas. It has an Arc-like course sidebar and ⌘K bar, Geist type, tactile press-down buttons and a dial slider, and amber current dots flowing through the circuit. R₁'s branch stays switched off until the student guesses or chooses to skip the guess, which is recorded as help. The scripted revision and next activity follow the guess. Sources and rationale are in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Unverified and unselected: no render, animation, contrast, keyboard or reduced-motion check was run, and no direction is adopted.

**Plan deviations:** None adopted. UI Direction remains authoritative; no `src/`, PRD, build plan or deployment change.

## PM020 / PM021 — Rethink functionality and layout around the knowledge graph

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamps unavailable.

**Verbatim prompts:** Preserved in the canonical prompt archive, entries `PM020` (functionality and layouts) and `PM021` (knowledge graph as the central premise, sent while PM020 work was in progress).

**Top 3 outcomes:**

1. Redirected the PM020 layout pass to PM021: proposed the semester as a transit map. Courses are lines; syllabus concepts are stations by week; station looks come from evidence (own, with help, two explanations being tested, coming up, deadline); cross-course links are shown only as "proposed · not verified"; zoom levels (map → line → station → playground) replace separate destinations; Today is the map's frontier.
2. Built three boards on the private canvas: an interactive semester-map home (frontier chips, selectable stations, a station inspector with evidence labeled by who said it, change cards linked to stations), a station concept and evidence page (direct neighbors only, versioned interpretation, evidence timeline) and a mobile vertical-line view. Rationale is in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
3. Flagged the conflict: UI Direction and Learning Graph Scope currently exclude a semester-wide graph destination for P0. N is unselected and unverified (no render, accessibility or reduced-motion check).

**Plan deviations:** None adopted. A graph-first home would deviate from UI Direction and Learning Graph Scope and needs Jeremy's decision recorded in Decisions before implementation. No `src/`, PRD, build plan or deployment change.

## PM022 — Personas, usage and navigation for the graph-first direction

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM022`.

**Top 3 outcomes:**

1. Grounded five representative personas in the PRD and [user stories](USER_STORIES.md): Jordan (juggler), Sam (short windows), Ana (returned work), Leo (exam week) and a no-account visitor. Mapped how often each needs eight functions, and concluded that the graph should be the premise while the next action is the home. This is consistent with the PRD's deferral of graph and mastery dashboards.
2. Recommended navigation of Today · Map · Activity, with course lines and Sources below and ⌘K for asking and jumping; on phones, Today · Map · ＋Ask · Activity; no Courses or Study tabs. Added five layout principles.
3. Added a personas and navigation board and four annotated low-fidelity wireframes (Jordan desktop Today, Ana returned work, Leo exam scope on the map, Sam phone Today) to the private canvas, with rationale in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md). None of this is verified or adopted.

**Plan deviations:** None adopted. Changing the navigation away from UI Direction (Today, Courses, Study) would need Jeremy's decision recorded in Decisions. No `src/`, PRD, build plan or deployment change.

## PM023 — Let students make their own quizzes and flashcards from any card

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamp unavailable.

**Verbatim prompt:** Preserved in the canonical prompt archive, entry `PM023`.

**Top 3 outcomes:**

1. Designed "study your way" as a Make panel on every station card, extending the existing direct-request, ordinary-practice and review-card scope through the same engine. Formats: interactive lesson (only with a checked model), practice quiz, flashcards, worked example, explain it plainly, exam-style set. Options cover scope (this station, plus neighbors, exam scope) and mode (closed book, or hints recorded as help). Soma's suggestion is labeled in the same grid.
2. Kept the evidence invariants: generated items cite the station's sources; closed-book correct fresh answers can count as "on your own", hints count as "with help", and flashcard ratings only schedule review. A repeated miss can trigger a suggested experiment, joining self-directed and agent-suggested study on one map.
3. Added three boards to the private canvas (an interactive Make panel, quiz and flashcard views with "where results go", and a phone bottom sheet), with rationale and a positioning-risk note in [the canvas folder README](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md). Unverified and not adopted.

**Plan deviations:** None adopted. No `src/`, PRD, build plan or deployment change. Self-made sets should support rather than lead the demo, given the guide's anti-project list.

## PM024 / PM025 — UI overhaul to graph-first navigation, plus a UI/UX guide

**Recorded:** October 27, 2026, in the PM014 advisory conversation. Exact received timestamps unavailable.

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

1. User selected the current semester, Fall 2026, as the private Blackboard collection scope. Verified all 36 catalog entries and saved the three matching Fall 2026 courses in the signed-in deployed workspace. The existing imported course and all older courses were preserved.
2. The first hosted collection returned a generic HTTP 500; no successful full read is inferred. Diagnosing the audited collection path with bounded live checks and secret-safe diagnostics. Existing account isolation, read-only access and Meta spending cap apply.
3. Older courses remain outside the selection. Gradescope and Piazza remain separate follow-ups with their own login/MFA.

**Plan deviations:** None; this supplies the previously missing selected-course scope.

## P053 — Updated UI/UX guidance and new file

**Verbatim prompt:** Canonical archive; received timestamp unavailable.

**Top 3 outcomes:**

1. Read the new docs/UI_UX_GUIDE.md completely and checked updated AGENTS.md, UI_DIRECTION.md and LEARNING_GRAPH_SCOPE.md guidance. Today · Map · Activity and the Playground visual language now own navigation/layout; previous Ready Card evidence and interaction rules remain where not superseded.
2. Confirmed the deployed app already uses that guide’s new navigation and styling. Continuing Fall 2026 source setup within the updated interface; no additional redesign was requested.
3. New study formats stay hidden until supported; source labels, private account separation, reduced motion and evidence honesty remain required. PRD/release gates and unsupported image/PDF status are unchanged.

**Plan deviations:** None; incorporated the already adopted UI guidance without reopening design selection.
