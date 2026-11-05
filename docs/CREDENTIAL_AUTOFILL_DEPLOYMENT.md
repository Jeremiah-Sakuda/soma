# Isolated credential autofill

Optional course-site login support, separate from the primary visual experience and normal manual sign-in. Configuration and a setup button do not establish successful institutional login, MFA, safe-state handoff or a source read.

## Isolation

The dedicated `services/credential-runner` handles explicit enrollment and bounded login. It exposes no general CDP, screenshot, arbitrary navigation or model endpoint. It has no direct Firebase administrative authority. The normal app, general browser worker and model must not have vault-object or KMS-decrypt access.

Use a dedicated private vault bucket with uniform access and public-access prevention, a dedicated symmetric KMS key, and a dedicated workload identity. Runtime audit/grant creation must be create-only at the IAM boundary; it must not allow reading, overwriting or deleting those prefixes. Review inherited privileges as well as resource policies. Encryption does not make the authorized decrypting runtime or cloud administrators credential-blind.

The app and login service use distinct broker and callback secrets. Use workload ADC and Secret Manager, not exported service-account keys or institutional passwords as deployment secrets. Keep all real project/resource names and secret values in private deployment configuration.

## Configuration

| Location | Required configuration |
| --- | --- |
| App | Explicit opt-in flag, `SOMA_CREDENTIAL_RUNNER_URL`, broker control key and authorization callback key |
| Login runtime | Enabled flag, canonical HTTPS origin, own control key, fixed authenticated app callback, vault bucket, KMS key and protected browser-state settings |
| General browser worker | No vault/KMS-decrypt authority or callback secret |

The optional `SOMA_CREDENTIAL_AUTOFILL_ALLOWED_UIDS` gate restricts availability, setup and callbacks. A present empty/malformed list permits nobody; absent means normal multi-account availability. Cleanup remains available after exclusion or disabling new enrollment.

Build the login service from the `services/` context with `credential-runner/Dockerfile` so shared browser/state imports remain present. The browser and voice services use their own directory contexts. Deploy only after reviewing the actual environment and IAM policies; these instructions do not grant deployment authority or imply cloud credits.

## User and provider boundary

Require a fresh authenticated account grant and explicit consent before enrollment. The user enters a password only in the isolated service and completes MFA personally. No password retry loop or unattended login is claimed. The reviewed provider policy is deliberately narrow: unfamiliar forms, origins, frames and MFA hosts fail closed.

The fixed internal top-level POST validates destination, form tokens, Origin and Referer. Secret-bearing redirects, redirect reposting and tested response reflections are refused before opening the viewer. After human MFA, safe-state export requires a positive provider identity check and includes only permitted secure HttpOnly course-site cookies. It does not copy the SSO profile or all browser storage. Reflection canary checks cover tested encodings; they do not prove safety against every malicious-provider transformation.

## Cleanup, rotation and rollback

Forget revokes the isolated operation and tombstones the vault record. Disconnect removes the optional stored credential and Soma’s saved course-browser context. Account deletion freezes its generation and retains cleanup references on external failure. A lost response is not success; preserve retryable references.

A KMS primary-version change does not migrate existing ciphertext. Retain old enabled versions until rewrap and recovery checks pass. Verify generation/CAS, rotation, tombstones and denied-key recovery. Disabling enrollment must preserve cleanup configuration while records/grants can exist. Do not roll back to a version that ignores them without draining and verifying cleanup first.

## Verification gates

Synthetic and disposable-account tests cover callback/ownership/replay, revocation, cleanup, safe-state rules, hostile pages and actual cloud isolation. Historical cloud checks confirmed login encryption/rewrap and denial of app/browser vault access; they do not establish every future IAM configuration or privileged operator’s behavior. Private real-account operations are not published as fixtures.

For a new environment, repeat actual denial tests with narrowly scoped disposable objects, remove temporary verification privileges and confirm cleanup. Test real provider login/MFA and selected-course readback separately; unit tests, a stored vault flag or a stopped login page cannot prove those outcomes.

[Security](SECURITY.md) · [key rotation](CREDENTIAL_KEY_ROTATION.md) · [service overview](../services/README.md).
