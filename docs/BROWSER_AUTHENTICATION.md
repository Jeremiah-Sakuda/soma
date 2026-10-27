# Institutional sign-in and saved browser authorization

October 27, 2026 — P039. This specifies the existing browser-session approach for BU Blackboard, Piazza and Gradescope, its trust assumptions and the remaining acceptance work. It is not a claim of live institutional access or a completed security certification.

## Recommended user journey

1. In the signed-in Soma workspace, choose **Connect Blackboard**. Prioritize `https://learn.bu.edu/`, where Jeremy's primary coursework lives; add Piazza and Gradescope as separate connections afterward.
2. Soma opens a short-lived Browserbase live browser at the provider's official home page. The student enters credentials on the actual provider or institutional SSO page and completes MFA there. No Soma password form, `.env` entry, chat message or model tool receives the institutional password. Password autofill/saving must not be encouraged in this hosted browser.
3. The student finishes sign-in and returns to Soma. End the interactive session, allow context synchronization, then open a fresh collection session with the saved context. Saving a context is not successful course-access verification.
4. The student selects exact supported course pages. Only a successful scoped read with positive account/content checks marks those pages current. Preserve unsupported-page and expired-session states honestly.
5. A future refresh reuses the saved authorization while it remains valid. If the school requires sign-in/MFA again, pause collection and ask the student to reconnect. Do not retry passwords, bypass MFA, or continuously prompt Duo approvals.
6. Disconnect ends the hosted session, deletes its saved context and removes local authorization references. If remote deletion fails, retain protected cleanup references for retry and show the failure. This removes Soma's saved access; it is not a global logout of the student's other browsers or an institution-wide session revocation.

Google remains a separate OAuth flow for selected read-only Gmail and Calendar access. Browser login is not a reason to replace that route with stored Google passwords.

## What is actually trusted

The hosted browser processes the student's login and holds authenticated cookies. Browserbase is therefore a trusted processor, not a credential-blind relay. Soma's authorized server runtime can control that browser; application code, deployed operators, server secrets and provider administration are part of the trust model. “The model does not receive passwords” must not be presented as “the platform cannot access the authenticated account.”

Browserbase documents that a context contains a Chromium user-data directory, including cookies, local storage, IndexedDB and potentially saved form data. It documents per-context encryption at rest. Do not promise that a context contains only cookies or cannot retain sensitive form data. Do not deliberately save passwords or TOTP seeds. See [Contexts](https://docs.browserbase.com/platform/browser/core-features/contexts).

Authenticated cookies can grant access without another password. Treat the entire context, its references, control links and provider key as credentials. Course-page selection is an application-enforced collection restriction; the underlying website session may have broader account permissions. It is not a provider-issued read-only token.

If a user requires credentials and browser state to remain entirely on their own device, use a separately designed local companion/extension or the manual-import fallback. Cloud contexts cannot satisfy that requirement. A local companion is not implemented and is not added to P0 by this document.

## Current implementation and evidence

| Concern | Current implementation | Evidence and limit |
| --- | --- | --- |
| Password submission to Soma | Strict browser action schema accepts provider/action/targets; rejects a password property | Existing browser policy tests rerun under P039; this does not inspect provider internals |
| Account separation | One connection/context per workspace and provider; verified account/workspace generation; session project, owner tag and context/session association checks | Existing policy tests cover foreign project/context/workspace; managed connection tests are prior evidence, not rerun here |
| Stored references | AES-256-GCM connection secrets with random nonce and authenticated owner/workspace/connection binding; public connection projection omits secrets | Shared encryption tests rerun under P039; raw hosted browser state is retained by Browserbase, not stored as a cookie blob in Firestore |
| Login observability | Session allocation requests `recordSession:false`, `logSession:false`, `solveCaptchas:false`; no Spark login loop | Code inspection, consistent with the current [session contract](https://docs.browserbase.com/reference/api/create-a-session); hosted absence of recordings/logs still needs verification |
| Login control link | Authenticated same-origin action returns a Browserbase HTTPS live-view link, requested with a 600-second TTL; no-store response; UI holds it transiently and uses a no-referrer new tab | Code inspection; [live-view TTL contract](https://docs.browserbase.com/reference/api/session-live-urls). A leaked link may control the session until it ends/expires; TTL alone does not revoke an established viewer |
| Concurrent activity | Exclusive connection operations; refresh refuses to collect from the student's active login session | Synthetic lifecycle test rerun under P039; complete hosted race acceptance remains |
| Collection | Fresh session; close restored tabs; block non-GET/HEAD and known action paths; selected top-level navigation; block WebSockets and bypass service workers; no model access to login pages | Policy tests rerun under P039. GET-only collection may reject sites requiring read-only POST APIs or external assets; unsupported must remain visible |
| Expiry and disconnect | Positive content checks, stale/login-required status, context deletion before removing local references; failed cleanup retains references | Policy/lifecycle tests rerun under P039; real institutional expiry and deletion/reconnect still need proof |

Browserbase's documented [live-view feature](https://docs.browserbase.com/platform/browser/observability/session-live-view) supports user-controlled credential entry. The hosted browser is separate from the student's everyday local browser: an existing local Blackboard login is not automatically inherited.

## Work before calling this production ready

1. **Make the trust disclosure visible in onboarding.** Identify the hosted provider, session retention, expiration/reconnect behavior and Disconnect effect before credential entry. “Secure login window” alone is insufficient explanation. Distinguish saved authorization from verified course access.
2. **Verify the actual BU sign-in path first.** Confirm official provider/SSO destinations, redirects and any popups without recording credential fields, login DOM or screenshots. No AI observes or acts during credential entry. Test a fresh-session read of a selected Blackboard page; only then claim support. Piazza and Gradescope get separate checks and contexts; do not copy an entire BU SSO context between sites.
3. **Prove privacy and lifecycle guarantees in the hosted flow.** Confirm recording/logging are disabled, no login payload enters model requests/audit/export/analytics, links stay transient, login and collection cannot overlap, reconnect retains scope, and failed disconnect cleanup is recoverable. Test actual session expiration and fresh-context deletion with synthetic or dedicated test accounts before making production claims.
4. **Complete credential operations.** Document and exercise encryption-key/provider-key rotation, administrative access, context retention/abandoned-login cleanup and account-deletion recovery. Encryption with a deployment secret alone is not a completed operational key-management plan; a KMS-backed rotation design remains work if required for production.
5. **Prove the supported pages read without writes.** Site-specific course content may require collection changes. Any added network read must be reviewed explicitly; do not enable all POSTs or broaden SSO permissions to get a screenshot working. No submissions, posts, regrade requests or messages.

No institutional credentials or browser context were requested, opened or changed during P039. No live source-read claim follows from its synthetic tests. Existing selected-source authorization and the $2 Meta cap remain unchanged.
