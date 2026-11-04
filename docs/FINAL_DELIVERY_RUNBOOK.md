# November 4 final delivery

All deadlines below are America/New_York. [Verification](VERIFICATION.md) owns executed results; this file sequences remaining delivery. [Build plan](BUILD_PLAN.md) owns scope and [script](DEMO_VIDEO_SCRIPT.md) owns the cut.

## Before the freeze

Codex owns the release manifest and graph interaction. Claude merges engine source only, leaving the manifest to Codex. Preserve the unrelated `next-env.d.ts` edit and both histories. Engine go/no-go is 4:30 PM; code freeze is 5:30 PM. If the engine misses its visual/provenance bar, keep the checked circuit as the second example. Use actual filmed output for the final words.

Current source checkpoint: `569c8f6`, manifest `soma-lift-interaction-2026-11-04`. Neither the published 0.4.0 installer nor the previous 0.4.1 draft contains the new graph interaction. Preserve both dated artifacts. Signing preflight found one Developer ID identity and an available `soma-notary` keychain profile; this does not establish a new signed build.

## After source freeze

1. Integrate the accepted engine changes, review the exact diff and rebuild the bundled renderer with `node desktop/build-lift.cjs`. Regenerate `public/release.json` with the final release ID using `node scripts/verify-release.mjs --write --release-id=...`, then run its verifier. Commit and push the final source identity.
2. Check exact-commit CI and required local checks. Record failures and retries. Verify Vercel’s deployment identity and the hosted `/release.json`, then observe graph/circuit entry paths and the accepted engine path. Metadata saying READY is insufficient for UI acceptance.
3. Preserve the earlier draft/ZIP before packaging. Choose and record the final companion version. Run `node desktop/release.cjs --sign-only`, audit packaged source identity and private-file exclusions, then `node desktop/release.cjs --notarize-only`. The existing script checks signing, submits to Apple, staples, validates the staple and checks Gatekeeper. Record ZIP SHA-256, notarization ID and exact source commit.
4. Test the installed signed build over the original demo source: alignment; lifted cut/restore 7→9→7; rotation and click-through; source-change rejection; circuit opening/current reversal; accepted engine parts and motion. The isolated pointer test and renderer tests cover narrower boundaries and cannot substitute for this complete journey.
5. Publish the verified companion asset to the canonical repository release and download it back to compare checksums. Verify the product download link and final release/version wording. Preserve the prior release and original histories.

## Film and form

Use the graph’s lifted cut for the cold open only after the installed-build check. Keep one coherent graph take; disclose shortened waits and actual review status. A prepared model or recorded engine keeps its provenance label. The script has a circuit fallback; do not delay the entire submission for an unaccepted engine.

The final video must be at most three minutes and publicly accessible to judges. Match spoken words to actual model choices and calculated state. Confirm captions, readable values, source rights and original-event-work attribution using existing evidence. No learner study or invented adoption figures are required.

Form copy is in [SUBMISSION.md](SUBMISSION.md); claim support and footage status are in [SUBMISSION_EVIDENCE.md](SUBMISSION_EVIDENCE.md). Use only `Jeremiah-Sakuda/soma`. Remaining human inputs are the final video URL, participant/track/representative details if the form requires them, and any personal attestations. Repository visibility is currently private and requires the user’s explicit authorization to change. Complete the form, review its actual fields/links, submit before 9 PM and retain the confirmation. Do not mark the submission complete without its receipt.
