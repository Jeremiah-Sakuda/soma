# Desktop companion

## Point & ask — 0.2.0

Enable **Point & ask**, hold **Control–Option–Space**, circle or point while speaking, then release. Soma joins a fresh display snapshot, normalized focus and transcript into the existing visual engine. Escape cancels; the old visual remains until a valid replacement arrives. [Behavior, privacy, checks and distribution status](POINT_AND_ASK.md). The existing **⌘⇧Space** path still captures a snapshot for review before asking.

The following distribution note refers to 0.1.0; 0.2.0 is signed but awaits its own notarization.

Use macOS Apple Silicon for the packaged companion. From this checkout, install with `npm ci --prefix desktop`, then `npm start --prefix desktop`. `npm run package --prefix desktop` creates an unsigned local package. Read `desktop/main.cjs` and `desktop/policy.cjs` for the actual menu labels and registered shortcut.

The menu-bar icon reopens a hidden panel. Close hides; Quit exits. Capture selects the display under the cursor, hides the panel first, then presents one snapshot for review. No inference begins until the user asks. If permissions were just enabled, relaunch the app when macOS requests it. Permission failures are recoverable; no alternate display is silently substituted.

Only an application-owned origin can use the restricted capture bridge. Renderer Node integration is disabled. Screenshots and speech are transient and subject to the same validation as browser uploads. No continuous screen monitoring is implemented.

Release tooling is `npm run release --prefix desktop -- --sign-only`, followed by `--notarize-only` after credentials are available locally. Distribution requires the developer's own Developer ID Application identity and a Keychain notarization profile. No signing credential is included in this source snapshot.

The owner's existing arm64 bundle passed Apple notarization, stapling and Gatekeeper verification on October 29. The hosted visual engine updates independently of that unchanged shell. Clean-Mac installation, actual screen/microphone consent, multi-display/fullscreen behavior and audible quality remain human verification gates; automated policy and synthetic capture checks do not establish them.


0.3.0 adds source references with exact-frame verification and Escape cancellation. [Behavior and current limits](POINT_AND_ASK.md#grounded-source-interaction--october-30-pm078). The existing public notarized 0.1.0 download has neither the 0.2.0 Point & ask shortcut nor these 0.3.0 source references. Build locally or use the owner's separate signed test bundle while notarization is pending.
