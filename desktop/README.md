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

App output: `.local/desktop-dist/Soma-darwin-arm64/Soma.app`. Open the app, grant screen-recording permission if asked, then use **Capture display** or **Command+Shift+Space**. The shortcut selects the display under your cursor. The app hides briefly before capturing to keep its panel out of the snapshot. Review the image and choose **Ask Soma**. Close/Hide preserves the session; **Soma → Quit** exits. Hide cancels active request/voice controls and pauses narration. Pin can be toggled. Use Reload after connectivity failure. If the shortcut is occupied, use the capture button or release the conflicting shortcut and reopen Soma.

Permission denied: open **Screen permission**, allow Soma in macOS Privacy & Security screen recording settings, then quit/reopen. Packages created with the package command are unsigned; the owner’s separate distribution bundle passed signing and notarization. Public builds require your own signing/notarization. Do not disable Gatekeeper globally. Development launches may attribute capture permission to the parent terminal/IDE; test the packaged app separately. No Windows/Linux distribution is claimed.

Development against a local Next server:

```sh
SOMA_DESKTOP_URL=http://127.0.0.1:3000 npm start --prefix desktop
```

Only loopback HTTP overrides are allowed in development; packaged builds lock to the production origin. No API credentials are bundled. The desktop session is separate from your ordinary browser session. Uploaded screenshots use the existing transient preview path. Never bundle app session data or private captures.

The smoke script launches real Electron with an original local HTML fixture; it checks screenshot delivery without OS capture or provider calls. See `docs/DESKTOP.md` for current verification evidence and open gates. The upload adapter deliberately targets the existing labeled file input. Keep that integration check when editing source setup.


## Compact ask bar

**Compact** in the toolbar, **Soma → Compact ask bar**, or **Option+Space** (Command+Option+Space if another launcher owns Option+Space) swaps the panel for a small translucent bar near the bottom of the screen. Type a question and press Return: Soma takes one snapshot of the display the bar is on, with its own windows left out, and the checked search is drawn over your screen by the same overlay as Point & ask. Pressing Return is the consent to send that snapshot; nothing is captured before it. The panel stays closed while compact mode lasts, including after a voice Point & ask; clicking the Dock icon brings back the bar.

- **Follow-ups.** While a drawing is on screen, Return asks a follow-up about it without a new snapshot; **New snapshot** (⌘N) captures again for the next question. With nothing drawn, every question takes a snapshot.
- **Test it** (⌘Return) asks Muse to pick the connection your question is about, and Soma computes where the route changes. It appears for a checked shortest-path graph with a goal.
- **Steps.** ‹ › move through the drawn search and ▶ plays the narration; like the panel, stepping waits for playback to pause.
- **One question at a time.** While Muse works, Return keeps your text and says so instead of starting another request.
- **Esc** first clears the drawing (it owns Esc while shown), then hides the bar. Hiding the bar also cancels a question in flight and pauses narration. ⤢ opens the full panel and ends compact mode; **Capture display** and **Show Soma** end it too.

A drag moves the bar; it stays where you put it on that display. While Soma runs, Option+Space belongs to the bar, so it no longer types a non-breaking space in other apps; if another launcher already owns it, Soma uses Command+Option+Space.

## Developer ID release phases

The separate signed release copy is under `.local/desktop-release/Soma-darwin-arm64/Soma.app`. `npm run release --prefix desktop -- --sign-only` packages and signs without uploading. `npm run release --prefix desktop -- --notarize-only` reuses that signed bundle, accesses only the named Keychain profile, submits to Apple, staples/validates the result and checks Gatekeeper before generating `.local/desktop-release/Soma-macOS-arm64.zip`. Default profile is `soma-notary`; use SOMA_NOTARY_PROFILE to select another. A sole Developer ID identity is selected automatically; multiple identities require SOMA_SIGNING_IDENTITY. The public distribution archive is only created after all checks pass. Keep Apple passwords and private keys in Keychain; none belongs in this repository or chat.
