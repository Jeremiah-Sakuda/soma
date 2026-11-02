> **November 1 — positioning update:** students first, the capability second. Soma turns a diagram on your screen into an experiment whose answers are computed, not guessed, built for students first; uses beyond the classroom are potential. [STORY_AND_DEMO.md](STORY_AND_DEMO.md) owns the current wording; the October 29 framing below is kept as a record.

> **October 30 — PM080 current distribution:** [Soma 0.3.0](https://github.com/Jeremiah-Sakuda/soma-hackathon/releases/tag/v0.3.0) is now signed, Apple-notarized, stapled and Gatekeeper-accepted. The published asset SHA-256 matches the local archive: `cfdfffa47c0594ef433467011ce9a96595d295739a274f25f772193bbb1f3e87`. Local stapled copy: `.local/pm080/Soma.app`. Earlier pending-notarization statements below are historical. Streaming relay activation remains pending; this notarization does not enable it.

> **October 30 — PM077:** Native Point & ask adds an explicit hold-to-speak/circle interaction to the existing visual engine. Hold Control–Option–Space after enabling it in the toolbar; release joins a fresh snapshot, normalized focus and transcript. No continuous video upload or new model family. Preserve selected-context → visual → manipulation → follow-up → saved revision. [Current behavior, privacy, verification and 0.2.0 distribution gate](POINT_AND_ASK.md). Earlier native-release statements refer to 0.1.0; 0.2.0 is signed and awaits notarization.

# Soma desktop visual learning companion

**October 29 distribution gate passed (PM060):** Apple accepted notarization submission `b81ba7b8-f090-4937-ba4c-02d59f777a20`. Stapling and staple validation succeeded; Gatekeeper accepted the app as Notarized Developer ID. Final macOS arm64 ZIP: `.local/desktop-release/Soma-macOS-arm64.zip` (116 MiB compressed); SHA-256 `61e5e27860dfbc3d8d4f7c9d8126d5f3bf50424664c4bdaa7eb2a5ff2fe98588`. Earlier pending statements below are historical. This verifies signing/distribution gates; a clean-Mac install, actual screen permissions and capture fidelity remain separate user tests. The hosted experience updates independently of this thin shell.


Adopted October 29, 2026 by PM049; positioning synchronized by PM050.

**Soma helps you understand what is on your screen, without leaving what you are doing.** Invoke it over a slide, paper, problem or application and explore a Muse-generated visual explanation beside your work. Intro AI is the first concrete demonstration. The companion reduces context setup; the source-aware interactive experience remains the product.

## User experience

1. Open Soma. The floating panel loads the existing hosted `/explore` experience; guest/example and account paths retain existing behavior. Internet is required.
2. Work in another application and press Command+Shift+Space, or choose Capture display. The current display is the one under the cursor. No individual-window picker is needed.
3. Soma pauses active narration/request/recording controls, hides its own panel, and requests one display thumbnail after a short compositor delay. OS consent is required. It refuses a missing display rather than substituting another.
4. The bounded JPEG enters the existing upload/preview handler. Review the snapshot, type or record a question, and choose Ask Soma. Capture itself sends nothing to the model.
5. Spark interprets the source and question and composes the visual; existing checked BFS controls, narration, follow-ups, revisions and save/resume apply. Broader explanation-only material remains labeled by existing assurance rules. Gemini speaks validated narration; Meta supplies reasoning/composition and recorded-question transcription.
6. Pin/unpin, resize or hide the panel. Close hides; Quit exits. Use a fresh capture for new context. Hide pauses/cancels known active lesson controls and mutes the hosted view. No continuous screen recording or automatic inference is introduced.

## Implementation and scope

`desktop/` has its own pinned lockfile, Electron 45.1.0 runtime and @electron/packager 20.3.0. A local toolbar hosts a separate sandboxed WebContentsView of the fixed production origin. The remote page receives no Node or general native bridge. Only the local toolbar can request native actions; sender/frame checks protect IPC. Snapshot delivery is restricted to `/explore` and reuses its labeled screenshot input, cancellation, preview and validation. The adapter is intentionally an integration dependency: retain its runtime smoke whenever the upload surface changes.

Native JPEGs are bounded before transfer and live in memory only. Local persisted browser session cookies remain local, separate from the user's regular browser. Never distribute session files. No service keys, learner records or private course documents belong in the bundle. Existing server ownership, source provenance and spend enforcement apply unchanged.

macOS Apple Silicon is the packaging target. Other platforms, automatic updates, continuous screen context and expanded scientific models are outside this slice. Public distribution signing/notarization remains separate from producing an unsigned local app. Keep the web judge route at https://soma-woad-beta.vercel.app/explore so installation does not prevent evaluation.

## Run and package

From the repository root: `npm ci --prefix desktop`, then `npm start --prefix desktop`. Run `npm test --prefix desktop` for policy checks and `npm run test:smoke --prefix desktop` for the real Electron/synthetic page bridge. Package with `npm run package --prefix desktop`.

Local output: `.local/desktop-dist/Soma-darwin-arm64/Soma.app`. The app is not signed/notarized for public distribution. A local development server can be selected through `SOMA_DESKTOP_URL=http://127.0.0.1:3000` only in unpackaged development. Packaged builds cannot override production origin.

## Verification status

- Four policy tests passed: production/development origins, privileged route restrictions, external URL filtering, exact multi-display source mapping and panel bounds.
- Real Electron runtime smoke passed nine checks: window, sandbox/isolation, pin toggle, native snapshot-to-upload bridge, composer focus, pause bridge, absence of native API in remote page refusal of snapshot delivery on another route, and Hide dismissing/muting the panel. Original synthetic fixture only; no OS capture or model calls.
- Packaged the unsigned 252 MB macOS Apple Silicon app successfully. The actual packaged executable loaded the production `/explore` page, delivered an original synthetic JPEG through its real React upload handler, focused the composer and fit a 620px view without horizontal overflow. No OS screen capture or model submission was used. Screenshot inspected under ignored `.local/pm049/hosted.png`.
- A repeated smoke initially selected the hosted content view instead of the local toolbar and timed out. Updated the harness to select by toolbar URL; final runs passed. This was a harness selection failure, not a passed first run.
- Actual screen-recording consent/denial/regrant, native screenshot fidelity, compositor exclusion, multi-monitor hardware, macOS fullscreen/Spaces placement, microphone attribution and perceived audio quality require human/device validation. These are not established by a synthetic upload test. Signing/notarization and distribution on another Mac remain open.

Official platform references: https://www.electronjs.org/docs/latest/api/desktop-capturer , https://www.electronjs.org/docs/latest/api/global-shortcut , https://www.electronjs.org/docs/latest/tutorial/security . Read current Electron guidance before changing permissions or native boundaries.

## Developer ID distribution pipeline — October 29

`npm run release --prefix desktop` prepares a separate public-distribution archive. It checks the exact Developer ID Application identity, packages a separate release copy, applies hardened-runtime/JIT and microphone entitlements with @electron/osx-sign, verifies nested signatures, submits with notarytool, staples/validates the ticket and runs Gatekeeper assessment before producing `.local/desktop-release/Soma-macOS-arm64.zip`. Electron and Chromium notices are included. No credentials are embedded or written to this repository. A signing/notarization failure is a release failure, with no unsigned fallback advertised as complete.

Configure locally after installing the certificate and securely storing notarization credentials:

```sh
export SOMA_SIGNING_IDENTITY='Developer ID Application: Your Name (TEAMID)'
export SOMA_NOTARY_PROFILE='soma-notary'
npm run release --prefix desktop
```

Use `xcrun notarytool store-credentials soma-notary` interactively to store the appropriate Apple credentials in Keychain. Do not paste a password or private key into chat or commit it. The Apple Developer account owner must supply the certificate/profile. Current verified blocker: a metadata-only elevated check finds an Apple Development identity, but no Developer ID Application identity. Development signing does not establish distribution eligibility. The release preflight correctly stopped before packaging or upload. No signed/notarized artifact or clean-Mac installation is claimed. The existing unsigned app remains available for local testing.


Membership clarification: owner confirms Apple Developer membership but has not created the Developer ID certificate. Xcode 26.6 is installed. The inspected Xcode Settings → Apple Accounts view has no signed-in account, so the owner must first add the member Apple Account, select the paid team and create Developer ID Application through Manage Certificates. No credential creation or account sign-in was performed by the agent.


## PM059 — Developer ID signing completed; notary profile pending

The owner created the certificate. Elevated keychain metadata confirms a valid Developer ID Application identity for team QVHQ6RL246. Ran `npm run release --prefix desktop -- --sign-only`; packaging and Developer ID signing succeeded. Deep/strict nested signature verification reports valid on disk and satisfies the designated requirement. Separate signed copy: `.local/desktop-release/Soma-darwin-arm64/Soma.app`. The earlier `.local/desktop-dist` app remains available. Signing does not establish notarization or a clean-Mac install.

The updated release script automatically selects one installed Developer ID identity (requires explicit selection when multiple exist), keeps signing output separate, and supports `--sign-only` and `--notarize-only`. Keychain profile `soma-notary` is not present: actual `notarytool history` returned no password item. Owner must generate an app-specific password and store it interactively with `xcrun notarytool store-credentials soma-notary --team-id QVHQ6RL246`. Never put that password in chat, environment files or source. Resume with `npm run release --prefix desktop -- --notarize-only` after the profile is stored. No notarization submission, staple, Gatekeeper acceptance or signed-runtime/permission check has passed yet. This supersedes earlier missing-certificate status.


## PM060 — Apple submission in progress

Owner securely stored and validated the soma-notary Keychain profile. Resumed --notarize-only with the existing signed app; deep/strict signature validation passed. Apple received submission b81ba7b8-f090-4937-ba4c-02d59f777a20 and reports In Progress. Upload acceptance is not notarization approval. The submitted archive SHA-256 is 682e6c06f4acde6c58fd51501dabb803debf397d557a0994ea7801311f292fd9. Bundle inspection found 18 asar entries and no environment, key, certificate-export, private-session or local-data paths. Waiting on Apple before staple/Gatekeeper validation and final distribution archive. Earlier missing-profile status is superseded.
