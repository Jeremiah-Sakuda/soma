# Desktop companion

Use macOS Apple Silicon for the packaged companion. From this checkout, install with `npm ci --prefix desktop`, then `npm start --prefix desktop`. `npm run package --prefix desktop` creates an unsigned local package. Read `desktop/main.cjs` and `desktop/policy.cjs` for the actual menu labels and registered shortcut.

The menu-bar icon reopens a hidden panel. Close hides; Quit exits. Capture selects the display under the cursor, hides the panel first, then presents one snapshot for review. No inference begins until the user asks. If permissions were just enabled, relaunch the app when macOS requests it. Permission failures are recoverable; no alternate display is silently substituted.

Only an application-owned origin can use the restricted capture bridge. Renderer Node integration is disabled. Screenshots and speech are transient and subject to the same validation as browser uploads. No continuous screen monitoring is implemented.

Release tooling is `npm run release --prefix desktop -- --sign-only`, followed by `--notarize-only` after credentials are available locally. Distribution requires the developer's own Developer ID Application identity and a Keychain notarization profile. No signing credential is included in this source snapshot.

The owner's existing arm64 bundle passed Apple notarization, stapling and Gatekeeper verification on October 29. The hosted visual engine updates independently of that unchanged shell. Clean-Mac installation, actual screen/microphone consent, multi-display/fullscreen behavior and audible quality remain human verification gates; automated policy and synthetic capture checks do not establish them.
