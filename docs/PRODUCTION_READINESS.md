# Deployment and operational checks

The hosted browser experience and signed macOS companion are independent deliverables. A successful source build is not proof of deployment parity or native permission acceptance.

## Before deploying

- Use managed Firestore for hosted persistence, server credentials and the checked-in deny-client rules. Keep all Admin/provider credentials server-only.
- Set the actual Meta allocation, cumulative spend cap, live-inference flag and desired review setting. Admission and spending limits can stop live generation; prepared/recorded examples must remain distinguishable and usable.
- Configure optional voice/browser/credential workers only after their isolated authentication and deployment checks pass. Course setup must not block exploration.
- Run types, unit/service tests, desktop policies, production build, isolated trace and browser journeys. Validate the runtime manifest and check excluded/private paths.
- Compare the hosted `/release.json` with the intended source manifest after deployment; a hosting READY status alone does not establish content parity.

## Runtime behavior

A request has bounded calls, time and a spend reservation. Cancellation, unknown provider usage, review failure and stale version publication have separate outcomes. Never clear a shared budget ledger to make a demonstration work. Show the actual allowance and retain the last usable artifact.

Guest workspaces have bounded retention and ownership; private-account data uses managed storage. Source freshness, provider authorization, actual read success and prepared model output remain distinct states. Existing scheduled course processing is a separate route from explicit screen exploration.

## Distribution

Use [0.5.0 Latest](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0) for current native lifts. Its exact notarization and checksum are in [verification](VERIFICATION.md). A locally built unsigned app is not that distribution artifact. Clean-Mac installation, physical capture/shortcut permissions, multi-display/fullscreen behavior and audible narration require separate acceptance.
