# Muse motion film versus Anatomy — PM120

Open the **[local comparison](http://localhost:41912)**. Both sides use the original synthetic piston source from PM117. Left is the corrected PM118 actual Muse mechanism, rendered by Anatomy. Right is an actual Muse-authored 24-second vector film. The shared travel slider pauses the film and applies the same normalized value to both drawings. Their geometry, scale and camera differ; this is a development comparison, not a controlled quality benchmark.

[Download the rendered MP4](public/piston-film.mp4). The browser version supports narration, pause/resume, direct scrubbing, four chapter jumps and manual experiments. Reduced motion uses settled chapter frames. Captions and a full transcript remain available if audio cannot play. Playback, scrubbing and downloads make no provider calls.

## Authorship and rendering

Muse Spark authored the actual shapes, custom SVG paths, part placement, palette, typography, labels, captions, narration words and animation tracks in `film.json`. Muse Wonder supplied advisory review. Soma supplies the bounded React/SVG renderer, HTML/CSS comparison layout, chapter-heading/subtitle placement, controls and clock. No model-produced HTML/JavaScript executes, and no video model or new package is used.

The drawing has 21 nodes and 13 tracks. The prototype grammar allows up to48 nodes,32 tracks and24,576 serialized characters, with strict references, finite coordinates, bounded paths/colors and one rigid travel driver. It is currently scoped to a piston with fixed guide/base and connected head/rod/grip. This is not a generic film-authoring product or an additional checked science family. Annotation tracks reveal/fade content; direct manipulation never starts a trailing animation.

The browser uses the prepared audio element's actual media time when narration is enabled, and a bounded browser clock otherwise. The MP4 uses the same `MotionScene` and timeline, rasterized locally with the existing sharp dependency and encoded with installed FFmpeg:720 frames,30fps,640×460,H.264/AAC,24 seconds. Model-written captions are burned into the export. The narration is **macOS Samantha prepared locally**, not Muse speech synthesis or Gemini. Complete words are retained; each voice segment is padded to its authored chapter interval. `render-receipt.json` records durations, hashes and codec metadata.

## Actual generation and retained failures

The final artifact required **20 actual Spark/Wonder calls across seven bounded development operations**, adding **$0.50475875** to the shared application ledger. Summed operation time was191.186s, including rejected outputs and review; this is not one-turn generation latency. At `2026-10-31T21:46:18.087Z` the ledger was **$15.814326 / $20**, leaving$4.185674. All prior consumption, uncertain reservations, admission limits and the allocation reserve remain intact.

Initial candidates had clipped labels, intersecting travel, duplicate motion drivers, misplaced callouts and misleading gap wording. The first review also exhausted its1,024-token output limit; the normal2,048-token text limit completed subsequent reviews. One reviewer incorrectly treated pre-key opacity as visible and rejected the required internal parameter ID as a physics claim. Supplying actual evaluated frame states and the source/renderer semantics resolved those false positives. The canonical repair runner now carries the candidate into repair instead of rebuilding its layout without that context.

A first reviewed candidate still placed labels over a guide. Native/in-app visual inspection caught this after initial label-to-label/canvas checks passed. Muse then made a narrowly constrained placement/draw-order correction, with assertions preserving geometry, motion, styles, captions and narration. The final browser check also tests text against actual part bounds. Advisory approval is not a substitute for rendered verification.

`winning-author.json` and `accepted-review.json` retain the final actual responses. `first-reviewed-film.json` and its author/review retain the earlier reviewed layout. `rejected-outputs.json` and `generation-receipt.json` retain failed candidates, reviews, usage and ledger observations. Source bytes are original synthetic material; no credentials, learner records or private course source are included.

## Executed verification

- **20 motion-domain cases passed**, covering deterministic seeking/interpolation, exact reversals, immutable output, coupling/reference limits and rejection of executable markup, external fills, cyclic groups, oversized/nonfinite paths, competing drivers and invalid timelines.
- **Nine production-gallery browser journeys passed**, including actual SVG geometry across101 manual settings (head/base/guide clearance, attachments, fixed supports), held-pointer reversals, real WAV/media-clock playback, interruption/restart/natural completion, zero idle animation after settling, blocked-audio fallback, canvas/path/text bounds and label/part collisions, keyboard/reduced motion,375/620/1440 widths, source-byte equality and loopback/no-API/media-range boundaries.
- **MP4 export check passed**: complete local narration,720 frames,H.264/AAC,640×460,30fps,24 seconds. TypeScript and the Vite production build passed. Full offline regression passed **1,667 /97 opt-in skipped**; the affected20 cases were rerun after final renderer/output changes.
- In-app playback completed naturally at0:24, then scrubbing and manual experiments were inspected. Native Mac Chrome exercised playback and keyboard interruption/reversal. Final screenshots are in `.local/pm120/`. The Mac locked before the last native refresh; the final corrected layout was checked in-app and by the production-gallery browser suite. No unlock was attempted.
- The canonical application runtime is unchanged:263files/SHA195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1. No Next route, provider service, account boundary or production visual default changed.

Initial browser failures were a zero-valued range fill that did not emit a change event, and ambiguous status locators matching native `<output>` elements. Tests now enter experiment mode explicitly and target the actual status paragraph; pointer/keyboard takeover and clock announcement behavior were also improved. Private failed and successful receipts remain in `.local/pm120/`.

## Reproduce locally

Using the repository's existing pinned dependencies, with no credentials needed for replay:

```sh
node node_modules/vite/bin/vite.js build --config docs/examples/pm120/viewer/vite.config.mjs
node scripts/serve-motion-comparison.mjs
npx playwright test --config tests/motion/playwright.config.ts
npx vitest run tests/domain/motion-film.test.ts
```

To regenerate the MP4 locally, use a Mac with Samantha and the already-installed `/opt/homebrew/bin/ffmpeg` and `ffprobe`; the explicit export test calls `scripts/render-motion-comparison.tsx`:

```sh
SOMA_RENDER_MOTION_FILM=true npx vitest run tests/export/motion-film.export.test.ts
```

Fresh model generation is separately opt-in through `tests/live/motion-film.live.test.ts`, requires authorized Firestore/Meta configuration, and uses the existing global reservation and guest/concurrency admission controls. It writes new private per-run output and does not replace the reviewed public recording automatically. Never reset the ledger to rerun it.

This is a local comparison prototype on `codex/spatial-exploration`. Source upload, canonical saved-exploration persistence and contextual film follow-ups are not integrated. No main merge, deployment, public publication, reliability/learning benchmark or user visual acceptance is claimed.
