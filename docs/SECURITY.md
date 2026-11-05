# Security and privacy boundaries

This document describes application controls, not a security certification.

## Source and model boundary

Treat screenshots, course text, mail and learner requests as untrusted data. Source access is read-only. Generated output uses bounded typed specifications; it cannot run arbitrary code, obtain credentials, modify validators or write learning observations directly. Publication checks source/model/version bindings, semantic references and ownership independently of provider prose.

The deterministic solver checks consequences of interpreted data. Wonder’s image/prose review is fallible. Preserve uncertainty, disagreement and missing checks instead of representing agreement as proof of source accuracy.

## Capture and native boundary

Private screenshot pixels and speech are transient inputs; saved explorations retain interpreted data and controls. Explicit original public demo sources are allowlisted recording assets. Do not add real account screens, institutional work or learner records to fixtures.

Hosted Electron content has no Node integration or unrestricted IPC. Native capture and drawing are origin/sender checked, and stale-source checks prevent drawing on a changed screen. Optional external computer actions use a separate trusted approval surface and recheck the exact process/control before execution. Read-only collection does not inherit action authority.

## Ownership and credentials

Check workspace/account ownership at HTTP, persistence, jobs, browser sessions and tool boundaries. Recheck version/generation before publication. Client Firestore rules deny direct access; Admin SDK operations still enforce ownership.

Connector secrets are encrypted with fresh nonces and owner/workspace/connection binding. Public metadata is allowlisted. OAuth uses exact callbacks, one-use state and PKCE. Session/context credentials and private service endpoints must not enter model prompts or public exports. See [browser authentication](BROWSER_AUTHENTICATION.md) and [key rotation](CREDENTIAL_KEY_ROTATION.md).

Secrets belong in ignored local configuration, server hosting secrets, Secret Manager or Keychain as appropriate. Firebase public web identifiers are different from Admin credentials. Signing identities and notarization credentials never ship in source or installers.

## Failure and limits

Reserve budget before inference. Bound request bytes, tokens, calls, concurrency, retries and wall time. Unknown provider usage retains its reservation. Ownership, deletion and version fences apply before publication and response delivery. Failure/cancellation preserves previous usable work without publishing partial unchecked content.

Audit events record observed application actions and model-stated purposes; they are not private chain-of-thought or a tamper-evident forensic ledger. Administrators can alter storage. Optional source services are isolated and disabled until configured; a provider login or configuration preflight does not prove a successful authorized read.

## Verification

Tests cover cross-account access, forged bindings, stale versions, deletion races, prompt injection, malformed provider output, numeric references and native sender/freshness gates. Provider and physical-device tests remain opt-in and separate. The public source/installer scans check configured secret-value matches and credential patterns; those checks cannot guarantee the absence of every possible private datum. See [verification](VERIFICATION.md).

## Dependency maintenance

The lockfiles pin dependencies. The Node 22 application overrides the SDK’s transitive `rimraf` to 6.1.4; the desktop packaging tool overrides ASAR’s `glob`/`minimatch` to 14.0.3/11.0.1. These replace versions covered by file-matching denial-of-service/cancellation advisories without upgrading the application framework or Electron. They require fresh-install, import and packaging verification; an audit with no reported advisories is not a security certification. The previously published notarized archive remains pinned to its immutable source tag.
