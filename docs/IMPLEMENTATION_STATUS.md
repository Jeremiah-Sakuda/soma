# Soma implementation evidence

October 26, 2026. This is a build-status record, not a declaration that the beta release gates have passed.

## Working and exercised

- Ready Card Today, Courses and Study use the existing lesson engine, checked numerical calculation code and persistent evidence. Optional prediction, reveal, fresh question, revisit, assistance, review and source-version history remain distinct.
- R12 commitment reconciliation, confirmed/tentative distinction, duplicate handling, declared focus-window arithmetic, corrections and before/after consequences are implemented. Shorter sessions keep omitted practice pending.
- Firebase/Firestore is provisioned. A synthetic write/read/delete probe passed, deny-all client rules are published, and server-side ownership remains enforced.
- Two disposable Firebase users exercised real password sign-in, token verification, session cookies, isolated owned records, reconnection, revision conflicts, deletion/recreation and cleanup. Private full-semester records use named record subcollections.
- Live Spark preparation over original synthetic sources produced a validated development preview through actual source reads and tool decisions. The first run failed safely; a second completed in about 10 seconds. This is two development runs, not the unseen generation release evaluation. Supporting passages are exact-match validated against current cited sources. Model output cannot alter equations or learner evidence.
- The integrated suite passed 123 unit tests, with three opt-in live tests skipped. Five Chromium journeys passed, including keyboard, reduced motion and 360–1440px layouts.
- Production is deployed at https://soma-woad-beta.vercel.app with self-hosted Manrope, encrypted server configuration, Firebase account routes, imports and jobs. Production HTTP checks passed page/health, Firestore-backed isolated demo sessions, persisted session selection, cross-origin rejection and disposable-session deletion.

## Source support

| Route | Actual mode | Remaining proof |
| --- | --- | --- |
| Judge semester | Original synthetic fixtures | No claim of institution access |
| Selected course and email text | Manual import | Verify actual student material and source fit |
| Selected calendar | Structured JSON import | No live monitoring claim; selected API access remains open |
| Blackboard / Gradescope | Not connected | User login, exact selected scope, read/reconnect experiment or documented fallback |
| Preparation jobs | Durable Firestore queue, explicit owner-triggered worker | Scheduled Trigger.dev/browser collection awaits keys and access |
| Spark | Live API + bounded lesson preparation verified | Full generation, source-fit, instructional-fit and follow-up evaluation |

## Release work still open

Real source access, independently reviewed scientific/source/instructional fit, unseen generation evaluation, scheduled no-prompt collection, human pilots and genuinely delayed learner outcomes remain open. Neither UI polish nor synthetic account tests satisfy these gates. The October 31 freeze, Day 3 generator decision and November 4 deadline remain in force. No submission or public-repository release has been claimed.

## Deployment correction

The first deployment failed to initialize Firebase Auth because jwks-rsa 4 required the ESM-only jose 6 module under Vercel’s module restrictions. A scoped npm override pins jwks-rsa’s jose to 5.10.0; module loading passed with require-ESM disabled and the redeployment passed production smoke checks. Local-only SQLite is lazy-loaded. The CLI lost its monitoring connection during redeployment, but Vercel inspect subsequently confirmed READY and the production alias. A repeat live-backend test during that network interruption timed out; earlier full live Firebase checks passed and the final production account HTTP check is reported separately.

## Final production account check

A hosted HTTP integration check passed in 10.26 seconds: real Firebase session-cookie exchange with Secure/HttpOnly attributes, empty private workspace, cross-origin import rejection, persisted manual source import, idempotent retry (one source/receipt), exactly one queued preparation with zero attempts, and deletion of sources/jobs. No model call was made by this check. The production test account and tombstone were removed. Two disposable synthetic accounts left by the interrupted repeat backend test were identified by prefix and exact creation-time interval and cleaned up; no real accounts were touched. Test: `tests/server/production-live.test.ts`, checkpoint `e7d8981`.
