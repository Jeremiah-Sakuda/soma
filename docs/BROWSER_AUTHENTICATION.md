# Browser authorization for course sources

This is an optional earlier course-workspace capability. Connecting an institution is not required for `/explore`. A saved login, a successful source read and a prepared learning activity are separate states.

## Manual sign-in

1. Sign in to Soma and choose the supported course-site connection.
2. Open its bounded private hosted browser. Enter credentials on the actual provider/SSO page and complete MFA personally. No model observes or acts during credential entry.
3. Return to Soma and finish sign-in to persist permitted browser authorization and end the interactive session.
4. Select exact supported course pages. A later, separate read must verify authenticated content and the selected scope before marking sources current.
5. If authorization expires, reconnect; do not retry passwords, bypass MFA or repeatedly trigger approvals.
6. Disconnect removes Soma’s saved context. Failed remote cleanup retains protected references for retry. It does not globally sign the user out of their other browsers or revoke every institutional grant.

Google uses a separate read-only OAuth flow for selected Gmail/Calendar context, not a stored Google password.

## Trust boundary

The hosted browser and its operator can access authenticated state. It is a trusted processor, not a credential-blind relay. A website session can have broader permissions than Soma’s selected read-only collector. Context IDs, cookies, control links and provider keys are credentials even when no password is stored.

The general browser worker uses encrypted saved state and owned, expiring sessions. Legacy Browserbase contexts have their own provider trust/retention boundary; see [Browserbase contexts](https://docs.browserbase.com/platform/browser/core-features/contexts). Do not claim a context contains only cookies or that application selection is a provider-issued read-only grant.

For strict device-only credentials/state, use manual import rather than claiming the hosted connector meets that requirement. The screen companion is not a local institutional-login replacement.

## Collection limits

Collection uses positive authentication/content checks, selected supported destinations, bounded response sizes and allowlisted read navigation. Unknown pages, unsupported requests, missing pagination evidence and stale sessions fail visibly. Successful slices report their actual scope; rotating through many courses is not a promise that every source is current at once.

Blackboard and Gradescope have separate reader contracts. Gradescope’s metadata path reads reviewed assignment-table fields; it does not imply returned-work scans, answers or feedback extraction. Browser login alone is not evidence that every provider page is supported. Source requests, browser costs and model preparation remain distinct.

## Optional secure autofill

[Isolated credential autofill](CREDENTIAL_AUTOFILL_DEPLOYMENT.md) is separately configured and explicitly opted into. It is not the normal app’s password form. Its restricted login service, fresh consent, human MFA and safe-state handoff must pass their own checks. Disabling new setup must preserve Forget/Disconnect cleanup for existing records.

## Recovery and packaging

The GCP viewer has an expiring interactive allocation; reconnecting does not extend its original deadline. One-use entry, scoped cookies, Origin checks and ownership/version checks protect resumption. The view disables input while offline and does not replay queued input after reconnect. Hard worker loss remains a recovery boundary.

The Next production trace explicitly includes Playwright’s required browser registry. A full local `node_modules` tree can hide missing serverless files; use `npm run check:browser-artifact` after building. Do not create a prebuilt deployment from a checkout containing developer dotenv files. Preserve `.vercelignore` exclusions and the checker’s private-path rejection.

[Service overview](../services/README.md) · [security](SECURITY.md) · [verification](VERIFICATION.md).
