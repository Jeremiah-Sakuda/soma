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
