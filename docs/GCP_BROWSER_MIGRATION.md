# GCP browser hosting migration

October 27, 2026 — P059. The user selected GCP hosting for the browser worker and authorized linking the existing Soma project to Deployment Billing. The lifecycle/transport and isolated worker are now implemented with initial synthetic coverage. Hosted execution, real-source login and cutover are pending; the original design and gates below remain requirements.

## Observed prerequisite

The actual link attempt returned `FAILED_PRECONDITION` with `google.rpc.QuotaFailure` for Cloud Billing. Deployment Billing currently lists five billing-enabled projects. The user must identify which project to unlink, or obtain more billing-project quota. P060 then selected Hodi: its billing was unlinked (the project remains), Soma linked successfully, and independent readback confirmed the other four associations unchanged. Unlinking disables paid services; it does not delete the project. Project lifecycle ACTIVE does not establish that it is safe to unlink.

The account has available promotional grants, but their console scope only says “Certain usage.” Their applicability to the proposed compute/storage remains unverified. Financial balances, billing identifiers and grant identifiers are intentionally excluded from this file. Soma’s billing is now enabled under the explicit P059/P060 authorization. The private state bucket and worker/build identities are prepared; no browser worker is deployed at this checkpoint. No Meta budget change.

## Preserve the product boundary

Keep the app on Vercel and use the existing Firestore workspace, identity, versioned observations, audited publication, leases and preparation budget. Move browser infrastructure only. Blackboard, Gradescope and Piazza keep their reviewed deterministic collection adapters and read-only network policies. Google Gmail/Calendar OAuth remains separate. Migration is not a new model, learning feature, source permission or Meta allowance increase.

Do not silently reinterpret a Browserbase context/session ID as a GCP ID. Add an explicit backend/version discriminator to protected browser references; missing discriminators mean legacy Browserbase. Dispatch active session actions, disconnect and workspace-deletion cleanup to the recorded backend, including recoverable legacy cleanup references after cutover. Keep the Browserbase key available for authorized cleanup until all owned contexts are confirmed removed. No browser-state export or cross-provider cookie sharing is assumed. New GCP authorization requires user-entered login/MFA in a separate context per workspace/provider. Preserve selected course mappings, but invalidate authentication verification and catalog freshness until the new subject is checked.

## Hosting proof before cutover

Start with a bounded Cloud Run proof because it provides a trusted HTTPS endpoint without requiring a new custom domain. Google documents Chromium/Playwright and interactive desktop streaming on Cloud Run. A Compute Engine broker remains a fallback if interactive behavior cannot meet the gates; it would require an authenticated trusted HTTPS/WSS front door, not a public CDP port or a developer-only tunnel.

Cloud Run instance-local memory, filesystem and connection affinity are not durable session guarantees. Maximum-instance settings alone do not provide exclusive access during revision overlap or replacement. Use existing ownership/generation leases plus durable fencing for profile writes and deletion. Active session loss must return an explicit reconnect state, never resurrect a different owner or publish an unverified read.

The isolated runner needs:

- A small authenticated control contract for context/session creation, status, release and deletion. Scope every action to owner, workspace generation, source provider and context identity. Reject stale leases/fences before publication or profile replacement.
- Encrypted cookies/localStorage/IndexedDB snapshots in private storage with bounded size, integrity validation and conditional generation writes. Whole-profile archives, passwords, virtual authenticators, OPFS and sessionStorage are not persisted by this version. Temporary profiles must be isolated and removed after the session. Choose storage deletion/retention settings explicitly: Cloud Storage’s default soft-delete period can retain credentials after a logical delete. Do not promise immediate erasure while recoverable objects remain.
- A short-lived human login/MFA view with authenticated HTTP and WebSocket access, revocable at completion/disconnect. Do not put a reusable control credential in logged URLs; do not expose raw unauthenticated CDP. Disable recordings, password saving and input/body logging. No model sees the login session.
- A sanitized browser-process environment containing no application, encryption or control secrets. Restrict browser access to cloud metadata/private network endpoints even during human SSO. Review sandbox/process and service-account boundaries rather than assuming page-level collection routing protects the runner itself.
- Per-session wall time, bounded capacity, explicit release, orphan cleanup and recovery after termination. Keep collection within the existing 80-second budget and preserve the existing provider start limits until an evidenced change is recorded. Scale idle capacity down where supported; measure actual charged usage rather than treating promotional balances as an enforced cap.

## Manageable milestones and gates

1. **Billing:** obtain the exact user-selected unlink target, perform that authorized unlink, link Soma, and independently read back both associations. Record failures without selecting another project automatically.
2. **Transport boundary:** add backend-versioned references and adapter dispatch with compatibility tests, including old-context cleanup, revoked ownership, stale leases and account deletion. Preserve the currently deployed browser path until GCP passes its gates.
3. **Isolated runner proof:** test synthetic login, context restart, profile write fencing, expired control links, HTTP/WebSocket ownership, disconnect, storage deletion/retention and metadata/secret isolation. Build pinned container dependencies and run the actual deployment artifact.
4. **Owned deployment:** deploy least-privilege compute/storage and the authenticated control/viewer endpoints after billing is linked. Verify TLS, instance-replacement failure behavior and a browser read against original synthetic pages. No actual course-source success follows from this step.
5. **Human sign-in and cutover:** switch the reviewed hosting configuration, clearly disclose GCP processing, and hand off each provider’s real login/MFA. Verify fresh selected-source reads and independent managed readback. Piazza preview extraction remains a separate open gate. Preserve source history and mappings; stop rather than bypass unsupported authentication or source policies.
6. **Final audit:** run relevant privacy, recovery, isolation, packaging and browser journeys; inspect the deployed UI; reconcile legacy Browserbase cleanup; commit and push checkpoints. Update status documents only with executed results.

## Sources

- [Cloud Run browser and OS automation](https://docs.cloud.google.com/run/docs/browser-automation)
- [Cloud Run WebSockets](https://docs.cloud.google.com/run/docs/triggering/websockets)
- [Cloud Run maximum instances](https://docs.cloud.google.com/run/docs/configuring/max-instances)
- [Cloud Storage soft delete](https://docs.cloud.google.com/storage/docs/soft-delete)
- [Project quota requests](https://support.google.com/cloud/answer/6330231)

Checkpoint: initial transport/state/egress/control/viewer synthetic tests and typecheck passed. Billing is linked; isolated hosted execution, runtime privacy/recovery tests and new provider sign-ins are the next gates. Browserbase remains the deployed hosting choice until those checks pass.
