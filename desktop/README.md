# Soma desktop companion

Soma turns a diagram on your screen into an experiment whose answers are computed, not guessed, starting with the slide you're studying. Explanatory visuals can address other supported material; the checked part today is graph search and DC circuits, drawn directly on the source. This Apple Silicon companion requires macOS 14.2 or newer and uses the current hosted Soma engine; it needs an internet connection. Capture is explicit, one snapshot at a time. The panel offers preview; submitting a compact-bar question consents to capture and send.

From the repository root:

```sh
npm ci
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

The smoke script launches real Electron with an original local HTML fixture; it checks screenshot delivery without OS capture or provider calls. See [desktop verification](../docs/VERIFICATION.md) for executed evidence and limits. The upload adapter deliberately targets the existing labeled file input. Keep that integration check when editing source setup.


## Compact ask bar

**Compact** in the toolbar, **Soma → Compact ask bar**, or **Option+Space** (Command+Option+Space if another launcher owns Option+Space) swaps the panel for a small translucent bar near the bottom of the screen. Type a question and press Return: Soma takes one snapshot of the display the bar is on, with its own windows left out, and the checked search is drawn over your screen by the same overlay as Point & ask. Pressing Return is the consent to send that snapshot; nothing is captured before it. The panel stays closed while compact mode lasts, including after a voice Point & ask; clicking the Dock icon brings back the bar.

- **Follow-ups.** While a drawing is on screen, Return asks a follow-up about it without a new snapshot; **New snapshot** (⌘N) captures again for the next question. With nothing drawn, every question takes a snapshot.
- **Test it** (⌘Return) asks Muse to pick the connection your question is about, and Soma computes where the route changes. It appears for a checked shortest-path graph with a goal.
- **Steps.** For explanations, ‹ › move to a step and speak it in full sentences. Narration waits until the model has lifted; ▶ plays through the remaining steps. For checked traces, stepping waits for playback to pause.
- **One question at a time.** While Muse works, Return keeps your text and says so instead of starting another request.
- **Esc** first clears the drawing (it owns Esc while shown), then hides the bar. Hiding the bar also cancels a question in flight and pauses narration. ⤢ opens the full panel and ends compact mode; **Capture display** and **Show Soma** end it too.

A drag moves the bar; it stays where you put it on that display. While Soma runs, Option+Space belongs to the bar, so it no longer types a non-breaking space in other apps; if another launcher already owns it, Soma uses Command+Option+Space.

## Lift into 3D

Supported answers can be lifted off the slide: **3D** in the compact bar (⌘L), or **Lift into 3D** on the page. What rises depends on the answer:

- **A checked search (Dijkstra or breadth-first)** lifts as described below: heights are checked distances.
- **A checked circuit**: each node rises from where it is printed to its checked voltage, on a stem, with each part a straight ramp labelled with its value. In a balanced bridge, R₅ lies flat.
- **An explanation-only visual**: Muse builds a 3D model of what the explanation is about (the first lift asks for it; it is saved as a new version), and the diagram region tilts back as a crisp card with the model standing on it. Typed questions use that diagram region too. Parts are named where they are; forces and flows are arrows; stepping through the explanation moves, reveals and lights up the parts each step is about. The model is labelled illustrative: shapes and motion are schematic, not measured.

The four-stroke engine uses Soma’s built-in cutaway. Muse chooses its placement and teaching steps; Soma assembles and poses its parts. Parts, proportions and motion are labeled illustrative. The original source slide is [Lecture 7](../docs/examples/hero-engine/lecture-7-four-stroke.png). If model creation fails, the bar reports the failure and **3D** can be pressed again; it does not substitute an upright flat diagram.

A lifted model or circuit can be handled on screen: hover it and the overlay takes the pointer (anywhere else, clicks still reach your apps); drag to turn it on its own upright axis (bounded, so it never goes end-on); click a part to pick it, which selects it on the page for your next question and names its role beside it; double-click to set the view back. Parts the current step is not about grey out with quiet names, and a name that has to move away from its part gets a leader line.

For a checked search: The graph's own region of your snapshot tilts back like a sheet of paper, and each vertex rises to its checked distance from the start, measured on a ruler beside it. Each connection becomes a schematic string: the label gives its checked cost and extra slack (for example, "4 · slack 1"). A taut string has no numerical slack; the curve length itself does not measure cost. Queued estimates are pale until settled; when an estimate drops, its old height lingers briefly and its label reads "F ≤ 11 → 7". A connection that offers a shorter way to an estimate is marked with how much it lowers it. A cut experiment shows the cut connection at sheet level and the route that replaces it.

- Heights, slack and labels come only from the verified model's distances and costs; nothing in 3D is generated by Muse.
- The sheet is cropped from the snapshot you already sent, on this Mac. If you used another app, Soma checks the live slide before lifting and waits flat until the full sheet region matches. A changed source is cleared; canceled or replaced requests cannot lift later. While lifted, click a connection or its cost label to cut it; click the dashed connection to restore it. The checked solver updates the route and heights while preserving your viewing angle. Drag the sheet or drawing to turn it; the Turn left, Turn right and Reset view buttons provide a drag-free alternative. A drag never cuts an edge, and the caption blocks clicks through to geometry beneath it. After you use another app, Soma re-checks the slide under the sheet every few seconds and takes the drawing down if it changed on two checks in a row (one passing banner is not enough). It does not check on a timer alone, because each check briefly hides Soma's windows from screen recorders and shares.
- Steps, playback and experiments keep working in 3D. Pressing **3D** again sets the drawing back down; Esc clears it as usual.
- With reduced motion, the lift, landing and changed heights settle immediately without moving old-height ghosts. If WebGL is unavailable, the GPU context is lost, or the slide region cannot be cut, the drawing stays flat and the bar or panel says why. A lifted scene does not time out while it is up.

The renderers are three.js (`lift-renderer.mjs` for a search, `lift-model.mjs` for circuits and models, which reuses the page's part builder), bundled into `point-overlay-3d.js` by `build-lift.cjs` (run automatically before start, package and release) because the sandboxed overlay page loads no modules. `node test/lift-harness.cjs <dir>` renders the overlay over the Lecture 14 slide in headless Chromium and saves frames of the lift, a full search and a cut, with no Electron, capture or model calls. `node test/model-harness.cjs <artifact.json> <slide.png> <dir>` does the same for any saved explanation's model (with `INTERACT=1` it also points at a part, picks it and turns the model), and `node test/model-harness.cjs circuit docs/examples/hero-circuit/lecture-9-bridge.png <dir>` for the circuit lift.

The current engine web release requires companion **[0.5.0](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0)**, now published as Latest. Its final archive is Developer ID signed, Apple-notarized, stapled and Gatekeeper-accepted, with SHA-256 `648b144e722d1501072f1d9241bd097dabade424777efbc13c4f53d6dad107fd`. Packaged code matches the release source; [verification](../docs/VERIFICATION.md) records exact provenance and the remaining clean-Mac/physical-permission limits. Replace older 0.4.x or rehearsal copies; the historical 0.4.1 draft remains unpublished.

## Developer ID release phases

The separate signed release copy is under `.local/desktop-release/Soma-darwin-arm64/Soma.app`. `npm run release --prefix desktop -- --sign-only` packages and signs without uploading. `npm run release --prefix desktop -- --notarize-only` reuses that signed bundle, accesses only the named Keychain profile, submits to Apple, staples/validates the result and checks Gatekeeper before generating `.local/desktop-release/Soma-macOS-arm64.zip`. Default profile is `soma-notary`; use SOMA_NOTARY_PROFILE to select another. A sole Developer ID identity is selected automatically; multiple identities require SOMA_SIGNING_IDENTITY. The public distribution archive is only created after all checks pass. Keep Apple passwords and private keys in Keychain; none belongs in this repository or chat.
