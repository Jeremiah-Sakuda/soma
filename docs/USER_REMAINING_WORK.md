# Remaining work for Jeremy

October 27, 2026. This separates inputs that require you from engineering and release verification that remain ours. The audit interface and completed architecture refactors do not waive the existing release gates.

Read-only setup check for P038: the existing owner account is enabled and its workspace is active, but it has **no saved provider connections**. This checked connection metadata only, without opening course content or decrypting credentials. Creating the account and configuring the Google OAuth client do not complete provider connection or source selection.

## Current priority: review the synthetic learning experience

P040 defers testing personal coursework until the simulated learning-graph experience is polished and reviewed. You do not need to connect accounts or supply private course material to unblock M1–M5. Codex owns the [milestones](LEARNING_GRAPH_MILESTONES.md); your next input is feedback on the working synthetic journey. The setup steps below apply to M6 afterward. Actual-course fit and real-source release checks remain required.

## Later: connect and select your actual course context

1. Sign in to [Soma](https://soma-woad-beta.vercel.app) using your existing Soma account; no new account or OAuth client is needed. Connect Google and select the calendars and course-specific Gmail queries you want Soma to read. Authorization alone does not select or prove access to course content.
2. Connect Blackboard (`learn.bu.edu`) first, then Gradescope and Piazza as needed. Complete password and MFA only on the actual provider/SSO page in the hosted browser, then select supported exact course pages. Browserbase hosts this browser and retains sensitive session state; it does not inherit your everyday browser's login. Soma does not need your institutional password in chat, `.env`, a source document or Git. Read [the authentication approach and trust model](BROWSER_AUTHENTICATION.md). Institutional SSO can require manual reconnection; if a page is unsupported, use the labeled course text/import route while we fix or report the connector.
3. Select one real course/topic and representative returned work for the hero sequence: visible marking, plausible explanations and a useful follow-up. Choose material we may process privately; public demo permission is a separate decision. Identify which source actually controls dates/coverage; confirm typed academic facts when needed. The CS 440 preview exists, but it does not establish a full live course integration. The resistor development lab has not yet been confirmed against your actual course sources.

After connection, tell me the selections are ready. I own verifying actual read, unchanged refresh, changed-source recovery, expiry/reconnect, course fit and the full learning path. Your selections authorize only that scope, under the existing $2 total application cap.

## Content and learning checks that need people

- Review whether generated practice and cited passages are useful and correct for your class. Arrange a qualified independent scientific/instructional reviewer for the approved quantitative family; we prepare the cases and fix problems. Confirming unrelated source material cannot make resistor labs exam-eligible.
- Recruit willing testers if available, use the product on real tasks and record baseline preparation effort honestly. A later attempt must occur after real elapsed time, with assistance and intervening study recorded. No learning/retention claim follows from a synthetic run or an assisted answer. Target initial pilot October 30 and later follow-up November 1 where feasible.

## Optional infrastructure input

Trigger.dev remains unconfigured. If you want the intended dedicated scheduler, fill `TRIGGER_SECRET_KEY` and `TRIGGER_PROJECT_REF` in `.env.local`, then tell me they are ready. I handle configuration/deployment. The authenticated GitHub fallback is already active every 15 minutes, best-effort; this is not currently blocking background processing. Do not add a second scheduler until we coordinate overlap behavior.

The read-only ledger check for P038 shows **$0.83999350 consumed of the $2 total app cap**, separate from the $150 provider allocation and $30 reserve. No increase is needed to connect sources. A future increase requires your explicit decision; I will not reset spending records or assume the entire allocation is available for unattended use.

## Before the hackathon submission

- Confirm the track, all team members (maximum four) and the representative.
- Approve what course snippets, screenshots and learner records may appear in public demo assets. Review the repository before we change it from private to public, as required by the event.
- Record or participate in the three-minute demo and verify the final public repository, video and product links. We prepare the script, contribution record and submission package. Submit by **November 4, 9 PM America/New_York**; target a complete draft November 3. The feature freeze remains October 31.

## Engineering work remains ours

Real-source acceptance and connector fixes, broader held-out reliability cases, independent-review fixes, accessibility/recovery verification and final demo preparation remain our work. Returned-work image/PDF interpretation, general prose extraction of assessment facts, comprehensive prerequisite mapping and model-directed browser navigation are not established by the current text collector. Any decision to deliver, cut or defer these must be explicit against the PRD and freeze. The remaining release work cannot yet honestly be described as visual fine-tuning only.
