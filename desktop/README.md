# Soma desktop companion

Soma brings interactive visual explanations beside whatever you are working on. This macOS Apple Silicon companion uses the current hosted Soma engine; it needs an internet connection. Capture is one snapshot at a time, only when requested, with preview before any model submission.

From the repository root:

```sh
npm ci --prefix desktop
npm start --prefix desktop
npm test --prefix desktop
npm run test:smoke --prefix desktop
npm run package --prefix desktop
```

App output: `.local/desktop-dist/Soma-darwin-arm64/Soma.app`. Open the app, grant screen-recording permission if asked, then use **Capture** or **Command+Shift+Space**. The shortcut selects the display under your cursor. The app hides briefly before capturing to keep its panel out of the snapshot. Review the image and choose **Ask Soma**. Close/Hide preserves the session; **Soma → Quit** exits. Hide cancels active request/voice controls and pauses narration. The frameless panel starts at 540×650 and can resize down to 380×460. Drag the Soma toolbar to move it. Choose **Explore further in app** to expand the same window, or **Return to compact window** to restore its prior dimensions and pin state; unsaved questions, current controls and playback stay in the same WebContents. The expanded window starts unpinned. **More options** contains Keep on top, Point & ask, Reload Soma and Screen permission. Use Reload after connectivity failure. If the shortcut is occupied, use the capture button or release the conflicting shortcut and reopen Soma.

Permission denied: open **More options → Screen permission**, allow Soma in macOS Privacy & Security screen recording settings, then quit/reopen. Packages created with the package command are unsigned; the owner’s separate distribution bundle passed signing and notarization. Public builds require your own signing/notarization. Do not disable Gatekeeper globally. Development launches may attribute capture permission to the parent terminal/IDE; test the packaged app separately. No Windows/Linux distribution is claimed.

Development against a local Next server:

```sh
SOMA_DESKTOP_URL=http://127.0.0.1:3000 npm start --prefix desktop
```

Only loopback HTTP overrides are allowed in development; packaged builds lock to the production origin. No API credentials are bundled. The desktop session is separate from your ordinary browser session. Uploaded screenshots use the existing transient preview path. Never bundle app session data or private captures.

The smoke script launches real Electron with an original local HTML fixture; it checks screenshot delivery without OS capture or provider calls. See `docs/DESKTOP.md` for current verification evidence and open gates. The upload adapter deliberately targets the existing labeled file input. Keep that integration check when editing source setup.


## Developer ID release phases

The separate signed release copy is under `.local/desktop-release/Soma-darwin-arm64/Soma.app`. `npm run release --prefix desktop -- --sign-only` packages and signs without uploading. `npm run release --prefix desktop -- --notarize-only` reuses that signed bundle, accesses only the named Keychain profile, submits to Apple, staples/validates the result and checks Gatekeeper before generating `.local/desktop-release/Soma-macOS-arm64.zip`. Default profile is `soma-notary`; use SOMA_NOTARY_PROFILE to select another. A sole Developer ID identity is selected automatically; multiple identities require SOMA_SIGNING_IDENTITY. The public distribution archive is only created after all checks pass. Keep Apple passwords and private keys in Keychain; none belongs in this repository or chat.

## Surface integration

The native renderer starts at `/explore?surface=companion`. The isolated preload delivers `soma:surface` with `{surface: 'companion' | 'workspace'}`. The hosted exploration can request these two layout modes with `soma:surface-request`; main-process checks require the owned exploration WebContents and its top frame on the configured origin. After installing its event listener, the web app dispatches `soma:surface-ready` to synchronize the current native mode, including after reload. No URL or arbitrary native operation is accepted. Expansion never navigates or creates a second session. Capture still comes from the local toolbar/shortcut and requires review before sending.

`npm test --prefix desktop` verifies surface transitions and removed-display recovery. `npm run test:smoke --prefix desktop` checks real Electron keyboard expansion, draft/WebContents preservation, compact restoration and route rejection against a synthetic local page. These checks do not establish packaged OS capture, hardware permissions, signing or release distribution.
