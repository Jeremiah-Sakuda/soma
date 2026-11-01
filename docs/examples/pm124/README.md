# PM124 — Presentation and motion refinement

Review **http://localhost:41914**. Use the expand icon beside Labels for **Presentation view**, or inspect the normal view. This iteration builds on the recorded PM121/PM123 engine on the existing private spatial branch.

## What changed

- **Presentation view:** a larger cutaway and its working controls occupy the window. Source/marketing chrome is hidden; the Muse recording label remains visible. The pose, voice/rate and repeat settings are preserved. Escape first closes a part inspection, then exits presentation. Body scrolling restores on exit. This is a local view change, not browser fullscreen or publishing.
- **Patient playback:**0.5× and1× speed, with actual audio driving the geometry and pitch preservation requested from the browser. Changing rate retains the current pose. Optional repeat loops the real WAV or silent clock across720° without ending playback. Manual takeover stops playback immediately. The primary label now distinguishes Resume film from Play the cycle/Play again.
- **Readable mechanism cues:** a piston-travel marker and forward-stroke arrow, a per-stroke half-turn arc around the crank, and an intake-open/closed callout derive from the same current geometry. Downstroke/Upstroke describe the forward cycle, not a measured instantaneous velocity while the user reverses the crank. Arrows hide at dead centers. The existing Muse cooling-fin paths receive a cast finish, and a recessed rod highlight adds separation; no base geometry or model-authored words changed.
- **Refreshed film:** the same final scene is exported at1920×1080,30fps,720frames,24seconds,H264/AAC with complete existing narration. The export remains normal-speed and noninteractive. The viewer separately offers slow/repeat controls.

## Authorship and scope

This pass makes **zero provider calls and adds$0 inference spending**. It reuses the actual recorded Muse art, refinements and script described in [PM123](../pm123/README.md). Material treatment, motion guides, timing and controls are application code, not a new Muse generation. PM123's last observed shared ledger was$16.45400025/$20 at2026-10-31T23:47:12.201Z; no new balance measurement/reset/cap increase is implied.

The diagram remains illustrative. No pressure, force, thermodynamic or scored-physics model was added. Cues describe the forward cycle. Playback/controls create no learner evidence or model calls. Original synthetic source and model lineage remain intact. No canonical engine generation/save/follow-up integration, main merge, push, deployment or publication.

## Executed verification

- **1696 offline passed /100 opt-in skipped**, including29 focused engine/presentation/guide cases. New checks independently cover dead-center travel limits, stroke direction/arc boundaries, half-speed timing, mid-cycle restart, loop wrap and invalid clock inputs.
- **22 production browser journeys** passed: all previous engine, source, media, full-HD text/contrast, direct two-turn/held-slider reversal, part/focus, keyboard/reduced-motion and phone checks; plus real-media half-speed/rate changes, equivalent silent timing, repeat across the real audio boundary, manual takeover, presentation pose/focus/scroll restoration, cue/valve consistency and phone presentation.
- TypeScript, standalone Vite build,1920×1080 export/frame/codec/duration and served-MP4 SHA matching the current render receipt passed. Canonical product remains PM118,263files/SHA `195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1`.
- Actual in-app inspection entered presentation view, selected0.5× narration/repeat near713°, observed the loop return into intake, paused and changed the crank to425°. Final visual inspection/screenshot captures the finished presentation. No fresh native Mac verification is claimed.

Private evidence: `.local/pm124/browser-final-r2.log`, `offline-final.log`, `unit-r1.log`, `typecheck-final-r2.log`, `export-final.log`, `runtime-unchanged.json`, `render/frames/00425.png`, final in-app screenshot. The previous presentation is preserved in commit9982244.

## Reproduce

```sh
SOMA_RENDER_ENGINE_FILM=true node node_modules/vitest/vitest.mjs run tests/export/engine-film.export.test.ts
node node_modules/vite/bin/vite.js build --config docs/examples/pm121/viewer/vite.config.mjs
node scripts/serve-engine-demo.mjs
node node_modules/@playwright/test/cli.js test --config tests/engine/playwright.config.ts
```

Export before building the static viewer. The original loopback-only static server, range-media support and CSP `connect-src 'none'` remain unchanged. No credentials or API/workspace files enter the replay bundle.
