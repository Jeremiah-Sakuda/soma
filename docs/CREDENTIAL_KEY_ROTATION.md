# Credential key rotation and recovery

P044, October 27, 2026. Applies to encrypted Google tokens, browser context/session references and pending OAuth payloads in Firestore. It does not rotate provider API keys, revoke provider grants, replace Firebase sign-in credentials or erase browser contexts. No production key replacement or real-user migration has been performed by this change.

## Configuration contract

| Server-only setting | Meaning |
| --- | --- |
| `SOMA_CONNECTOR_ENCRYPTION_KEY` | Active 32-byte AES key, encoded as 64 hexadecimal characters, padded base64 or unpadded base64url. |
| `SOMA_CONNECTOR_ENCRYPTION_KEY_ID` | Stable, nonsecret identifier, 1–32 letters/digits/underscores/hyphens. Defaults to `legacy`. Never assign different key bytes to an existing ID. |
| `SOMA_CONNECTOR_DECRYPTION_KEYS` | JSON object mapping up to four additional IDs to their keys. Default `{}`. Used for both preloading a future reader key and retaining prior keys. |
| `SOMA_CONNECTOR_WRITE_FORMAT` | `v1` by default for rollout compatibility; explicitly set `v2` after every reader supports it. |

Keep these values in restricted server secrets, with a separately protected recovery copy and controlled operator access. Never use `NEXT_PUBLIC_`, source control, chat, command-line key arguments, logs or test fixtures for actual keys. Update environment values atomically for each runtime. Include the web deployment, worker/scheduler and any maintenance process. Application operators with these secrets can decrypt saved authorization; this is not zero-knowledge storage or a KMS-backed design.

`v1` retains the original envelope and authenticated owner/workspace/record binding. Because it has no key ID, readers try only the bounded configured key set. `v2` includes an authenticated key ID as well as the owner/workspace/record binding. Both use fresh 12-byte nonces and AES-256-GCM authentication. Reads fail closed on missing keys, corruption or a different owner/generation. Rewrapping authenticates even a record already marked with the active key.

## Reader-first rollout

1. Deploy this compatible reader everywhere while leaving the existing key unchanged and the default `v1` writer. Verify healthy OAuth refresh, browser cleanup and application reads. Older application versions can still read new `v1` writes at this stage.
2. After every reader is compatible, switch all writers to `v2` with the existing key/ID. From this point rollback must use a version supporting `v2` and the complete key set. A release predating this change is no longer a safe rollback.
3. Generate the next random 32-byte key in the approved secret manager. Preload it under a new ID in **every reader's** additional-key map, retaining the old active key. Confirm deployment completion before any writer uses the new key.
4. Atomically switch the active key/ID to the new pair and retain the old pair in the additional map. Keep `v2`. During deployment overlap, old writers still work because both releases can read both keys. The preloaded release is the compatible rollback target.
5. Run a scoped dry-run, then apply. Inspect all counts and resolve every failure, unresolved lease or generation change. Repeat verification after old web/worker/maintenance processes have drained. Any remaining old writer can create another old-key record after a successful pass.
6. Remove the old key only after a complete inventory reports every retained record current under the target key, old writers have drained, pending deletion references and OAuth states are accounted for, and the rollback/backup retention policy permits retirement. Re-run verification after removal. Do not infer safe retirement from a successful migration of only one account.

Do not change key bytes under the same ID, skip reader preloading, retire a key with unresolved rows or reset failed ciphertext as a recovery tactic.

## Maintenance tool

Run from a trusted administrator environment with the same Firebase project and credential keys as the deployed application. It uses the Admin SDK; it is not an HTTP endpoint, model tool or user-facing privilege. Obtain the account-root hash from authorized account metadata; avoid putting emails/tokens in shell history.

```sh
npm run credentials:rotate -- --account-root ACCOUNT_ROOT_HASH
npm run credentials:rotate -- --account-root ACCOUNT_ROOT_HASH --apply
```

The command requires an explicitly configured `v2` writer. Default is dry-run. To inventory or migrate the entire project, substitute `--all-accounts` for the account scope; review the project identity first. Do not combine scopes. `--dry-run` and `--apply` cannot be combined.

Output contains counts, nonsecret target ID and hashed record identifiers with fixed failure codes. It never prints plaintext or provider exception bodies. Exit status `0` means the requested pass completed, `2` means unresolved rows/partial progress remain, and `1` means invalid configuration/scope or a failed operation. A dry-run with `wouldMigrate > 0` is a successful inventory, not a retirement certificate.

Every record transaction rechecks root owner/generation, record ownership, current ciphertext and unresolved lease. It updates only the encrypted field, preserving configuration, connection version, OAuth expiry and one-use semantics. Frozen pending-deletion accounts are included so encrypted cleanup references can be recovered. Fully deleted roots are skipped. Leased records, including expired but unreleased leases, are skipped: recover/finish the connection operation first, then rerun. Do not clear a lease blindly because it may protect newly allocated remote state.

Partial writes remain valid and reruns are idempotent. The default administrative limit is 500 records per account across connections/states; exceeding it yields `incomplete` and prevents success. This is a maintenance safety bound, not a product account/course limit. The library accepts an explicit limit up to 1,000 for reviewed maintenance. A larger account needs a reviewed paginated migration before retirement; repeatedly running the default command alone does not advance beyond that bound. An interrupted run below that bound resumes by recognizing already-current rows.

## Recovery and rollback

- **Missing or misconfigured key:** pause migration/retirement, restore the correct trusted key set and redeploy compatible readers. Existing encrypted records are retained. A key ID does not reconstruct a lost key. Without the actual key or a recoverable backup, decryption is not possible.
- **One corrupt/foreign record:** the row is unchanged and reported as unavailable. Investigate the hashed identifier through restricted administrative tooling. Do not copy ciphertext to another account or overwrite it with an empty secret.
- **Interrupted rotation:** retain both keys, rerun dry-run/apply, inspect unresolved counts and verify all readers. No credential downgrade or provider reauthorization is required for valid retained records.
- **Application rollback:** use the preloaded compatible release, retaining both keys. If writes must return to the old key, select its original ID/key, keep the new key in the read map, retain `v2`, and use the same migration procedure. Test before retiring either key. Never roll back to a reader that understands only `v1` once `v2` exists.
- **Pending workspace deletion:** restore the needed keys, complete migration if necessary, then use Soma's deletion-recovery view to retry the already-confirmed cleanup. Freezing the generation prevents reconnection/publication during that cleanup. Do not erase browser references before remote deletion succeeds.
- **Suspected compromise:** key re-encryption does not invalidate tokens already copied by an attacker. Revoke affected provider grants/sessions and provider/deployment keys through their own incident procedures, investigate operator access and notify affected users as appropriate. This tool alone is not incident remediation.

## Verification boundary

Synthetic cipher tests compare legacy compatibility against an independent AES reader, authenticate envelope labels and owner binding, reject damaged/missing keys and check rollover/rollback. Actual Firestore tests exercise dry-run, partial progress, active leases, OAuth one-use state, frozen deletion recovery, malformed ownership and the maintenance command. They use disposable synthetic records and delete them afterward. This establishes mechanism behavior, not deployed key custody, IAM least privilege, provider privacy settings or a completed production rotation. See [the security review](SECURITY.md) for remaining gates.

Hosted compatibility also passed on commit `0cedfc8`: the deployed Google start flow opened a v2-encrypted disconnected synthetic record while original-format writes remained configured. No provider login/token exchange or source job was created. CI 40576121991 passed the final implementation at `b778a73`, which Vercel reported Ready. Existing production keys were not replaced.
