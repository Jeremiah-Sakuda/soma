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

## Lift into 3D

A checked shortest-path drawing (Dijkstra or breadth-first) can be lifted off the slide: **3D** in the compact bar (⌘L), or **Lift into 3D** on the page. The graph's own region of your snapshot tilts back like a sheet of paper, and each vertex rises to its checked distance from the start, measured on a ruler beside it. Each connection is a string as long as its cost, so strings on shortest routes pull taut and the rest hang slack by exactly how much longer they are (labelled "4 · slack 1"). Queued estimates are pale until settled; when an estimate drops, its old height lingers briefly and its label reads "F ≤ 11 → 7". A connection that offers a shorter way to an estimate is marked with how much it lowers it. A cut experiment shows the cut connection at sheet level and the route that replaces it.

- Heights, slack and labels come only from the verified model's distances and costs; nothing in 3D is generated by Muse.
- The sheet is cropped from the snapshot you already sent, on this Mac; no new capture is taken to lift. While lifted, the drawing is not clickable; set it back down to cut connections. If you change the slide underneath, Soma re-checks it and takes the drawing down.
- Steps, playback and experiments keep working in 3D. Pressing **3D** again sets the drawing back down; Esc clears it as usual.
- With reduced motion, the lift and landing are instant. If WebGL is unavailable or the GPU context is lost, the drawing stays flat and the bar says so.

The renderer is three.js, bundled into `point-overlay-3d.js` by `build-lift.cjs` (run automatically before start, package and release) because the sandboxed overlay page loads no modules. `node test/lift-harness.cjs <dir>` renders the overlay over the Lecture 14 slide in headless Chromium and saves frames of the lift, a full search and a cut, with no Electron, capture or model calls.

## Developer ID release phases

The separate signed release copy is under `.local/desktop-release/Soma-darwin-arm64/Soma.app`. `npm run release --prefix desktop -- --sign-only` packages and signs without uploading. `npm run release --prefix desktop -- --notarize-only` reuses that signed bundle, accesses only the named Keychain profile, submits to Apple, staples/validates the result and checks Gatekeeper before generating `.local/desktop-release/Soma-macOS-arm64.zip`. Default profile is `soma-notary`; use SOMA_NOTARY_PROFILE to select another. A sole Developer ID identity is selected automatically; multiple identities require SOMA_SIGNING_IDENTITY. The public distribution archive is only created after all checks pass. Keep Apple passwords and private keys in Keychain; none belongs in this repository or chat.
