# Desktop companion

## Point & ask — 0.3.0

Enable **Point & ask**, hold **Control–Option–Space**, circle or point while speaking, then release. Soma joins a fresh display snapshot, normalized focus and transcript into the existing visual engine. Escape cancels; the old visual remains until a valid replacement arrives. [Behavior, privacy, checks and distribution status](POINT_AND_ASK.md). The existing **⌘⇧Space** path still captures a snapshot for review before asking.

**[Download 0.5.0 — Latest](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0)** (November 4): Apple Silicon, macOS 14.2 or newer; Developer ID signed, Apple-notarized, stapled and Gatekeeper-accepted. This version adds the current explanation-model/engine and checked-circuit lifts, graph interaction, first-draw recovery and caption polish. Archive SHA-256 `648b144e722d1501072f1d9241bd097dabade424777efbc13c4f53d6dad107fd`; the checksum is attached to the release. Earlier [0.4.0](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.4.0) and [0.3.0](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.3.0) downloads remain historical.

Use macOS Apple Silicon for the packaged companion. From this checkout, install with `npm ci --prefix desktop`, then `npm start --prefix desktop`. `npm run package --prefix desktop` creates an unsigned local package. Read `desktop/main.cjs` and `desktop/policy.cjs` for the actual menu labels and registered shortcut.

The menu-bar icon reopens a hidden panel. Close hides; Quit exits. Capture selects the display under the cursor, hides the panel first, then presents one snapshot for review. No inference begins until the user asks. If permissions were just enabled, relaunch the app when macOS requests it. Permission failures are recoverable; no alternate display is silently substituted.

Only an application-owned origin can use the restricted capture bridge. Renderer Node integration is disabled. Screenshots and speech are transient and subject to the same validation as browser uploads. No continuous screen monitoring is implemented.

Release tooling is `npm run release --prefix desktop -- --sign-only`, followed by `--notarize-only` after credentials are available locally. Distribution requires the developer's own Developer ID Application identity and a Keychain notarization profile. No signing credential is included in this source snapshot.

Historical arm64 releases passed notarization on October 29. The current 0.5.0 archive passed the release checks recorded above; its native lift implementation is newer than 0.4.x. Hosted explanations update independently of the companion. Clean-Mac installation, actual screen/microphone consent, multi-display/fullscreen behavior and audible quality remain human verification gates; automated policy and synthetic capture checks do not establish them.


0.3.0 adds source references with exact-frame verification and Escape cancellation. [Behavior and current limits](POINT_AND_ASK.md#grounded-source-interaction--october-30-pm078). The public notarized 0.3.0 download includes both the Point & ask shortcut and these source references. The earlier 0.1.0 release remains available for historical reference.
