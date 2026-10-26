# Soma implementation evidence

October 26, 2026. This is a build-status record, not a declaration that the beta release gates have passed.

## Working and exercised

- Ready Card Today, Courses and Study use the existing lesson engine, checked numerical calculation code and persistent evidence. Optional prediction, reveal, fresh question, revisit, assistance, review and source-version history remain distinct.
- R12 commitment reconciliation, confirmed/tentative distinction, duplicate handling, declared focus-window arithmetic, corrections and before/after consequences are implemented. Shorter sessions keep omitted practice pending.
- Firebase/Firestore is provisioned. A synthetic write/read/delete probe passed, deny-all client rules are published, and server-side ownership remains enforced.
- Two disposable Firebase users exercised real password sign-in, token verification, session cookies, isolated owned records, reconnection, revision conflicts, deletion/recreation and cleanup. Private full-semester records use named record subcollections.
- Live Spark preparation over original synthetic sources produced a validated development preview through actual source reads and tool decisions. The first run failed safely; a second completed in about 10 seconds. This is two development runs, not the unseen generation release evaluation. Supporting passages are exact-match validated against current cited sources. Model output cannot alter equations or learner evidence.
- The integrated suite passed 166 unit tests, with four opt-in live tests skipped. Five Chromium journeys passed, including keyboard, reduced motion and 360–1440px layouts.
- Production is deployed at https://soma-woad-beta.vercel.app with self-hosted Manrope, encrypted server configuration, Firebase account routes, imports and jobs. Production HTTP checks passed page/health, Firestore-backed isolated demo sessions, persisted session selection, cross-origin rejection and disposable-session deletion.

## Source support

| Route | Actual mode | Remaining proof |
| --- | --- | --- |
| Judge semester | Original synthetic fixtures | No claim of institution access |
| Selected course and email text | Manual import plus implemented scoped Gmail OAuth collector | User consent, first selected live read and source fit remain unverified |
| Selected calendar | Structured JSON import plus implemented read-only Google OAuth collector | User consent and first selected live read remain unverified |
| Blackboard / Gradescope / Piazza | Persistent Browserbase connector implemented, not live verified | Browserbase keys, user login, selected URLs and read/reconnect experiment |
| Preparation jobs | Durable Firestore queue, explicit owner-triggered worker | Scheduled Trigger.dev/browser collection awaits keys and access |
| Spark | Live API + bounded lesson preparation verified | Full generation, source-fit, instructional-fit and follow-up evaluation |

## Release work still open

Real source access, independently reviewed scientific/source/instructional fit, unseen generation evaluation, scheduled no-prompt collection, human pilots and genuinely delayed learner outcomes remain open. Neither UI polish nor synthetic account tests satisfy these gates. The October 31 freeze, Day 3 generator decision and November 4 deadline remain in force. No submission or public-repository release has been claimed.

## Deployment correction

The first deployment failed to initialize Firebase Auth because jwks-rsa 4 required the ESM-only jose 6 module under Vercel’s module restrictions. A scoped npm override pins jwks-rsa’s jose to 5.10.0; module loading passed with require-ESM disabled and the redeployment passed production smoke checks. SQLite remains the explicit synthetic-only local fallback. A later lazy-loader experiment broke the bundled local API; it was reverted after reproducing the failure in CI mode. The CLI lost its monitoring connection during redeployment, but Vercel inspect subsequently confirmed READY and the production alias. A repeat live-backend test during that network interruption timed out; earlier full live Firebase checks passed and the final production account HTTP check is reported separately.

## Final production account check

A hosted HTTP integration check passed in 10.26 seconds: real Firebase session-cookie exchange with Secure/HttpOnly attributes, empty private workspace, cross-origin import rejection, persisted manual source import, idempotent retry (one source/receipt), exactly one queued preparation with zero attempts, and deletion of sources/jobs. No model call was made by this check. The production test account and tombstone were removed. Two disposable synthetic accounts left by the interrupted repeat backend test were identified by prefix and exact creation-time interval and cleaned up; no real accounts were touched. Test: `tests/server/production-live.test.ts`, checkpoint `e7d8981`.

The first remote Chromium runs failed because a lazy SQLite loader introduced during deployment diagnosis returned HTTP500 on the local synthetic API. Restoring the original static import fixed the reproduction: all five journeys passed in CI mode (8.9 seconds), with no relaxed selectors or expectations. The Firebase jose override remains the independent production authentication fix.

## Private connector implementation (October 26)

Checkpoints `39b615a`, `f168c23`, `6c71ffa`, `94600c9`, `f449dc2` and `141edef` add account connection controls, encrypted browser contexts, Google OAuth, scoped read-only collection, stale/partial coverage handling, and source-version preparation handoff. Browser refresh has an 80-second collection deadline under the 120-second route budget. Calendar transparency preserves event status without blocking focus; omitted future events retain uncertain/stale availability rather than becoming cancellations.

Executed: typecheck, 166 ordinary tests (four gated live tests skipped), production build, five Chromium journeys (9.6 seconds), real Firebase two-account connector encryption/state/lease checks (10.22 seconds), and disposable-account UI checks for configured/missing Google settings and OAuth return UX. Test accounts and private records were cleaned. An initial local build hit a sandbox port-binding error; clearing generated output and rerunning with process access passed.

Gmail and Calendar API services are enabled; Google client credentials, production origin and stable encryption key are configured in Vercel. Browserbase credentials remain absent. Google user consent, actual mailbox/calendar reads, institutional browser login/read/restart and scheduled collection remain unverified. These tests are synthetic account checks, not user pilots or live-source release evidence.

The connector deployment is READY at the production alias. GitHub CI for `141edef` passed. A hosted disposable-account HTTP check passed (15.14 seconds), including Google configuration, authorization-state creation, callback URI, PKCE, read-only scope and CSRF, alongside import/job/deletion boundaries. No Google authorization was granted by this check.
