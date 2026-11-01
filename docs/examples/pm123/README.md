# PM123 — Engine presentation refinement

**Historical PM123 verification record.** [PM124](../pm124/README.md) adds presentation, slow/repeat playback and forward-motion cues at the same URL; the original recorded Muse presentation and lineage remain unchanged.

**Review http://localhost:41914.** This supersedes the PM121 presentation on the same private `codex/spatial-exploration` branch. The original PM121 Muse specification and its accepted geometry lineage remain unchanged; the recorded refinement is additive. Earlier Anatomy/piston comparison remains41912.

The user requested repeated refinement toward startup-demo quality. This is a more finished **local recorded prototype**, not a production-readiness, user-acceptance or learning-effectiveness claim.

## Refinement passes

1. **Illustration craft:** actual Muse refinements reshape the piston skirt, connecting rod and counterweight. Application material gradients, machined highlights, concentric bearings and cut-face hatching separate casting, copper and steel. Organic deterministic gas particles replace the uniform dot grid. Geometry still uses the same constrained slider-crank and idealized valve timing.
2. **Direct interaction and composition:** grab the copper handle to turn the crank directly through two revolutions, including wraparound, reversal and exact stopping. The standard keyboard/touch slider remains available. Select the piston, rod or crankshaft to pause and inspect its Muse-authored role/cue without changing the pose. Escape/Back returns focus to the originating part control. Playback clears part selection; hidden-page playback pauses. Space toggles playback outside interactive controls. Desktop composition is tighter; phone controls follow the drawing before the story.
3. **Editorial and media:** actual Muse copy passes replace awkward labels and terse fragments with complete captions, plus part explanations and observation cues. Narration identifies changing chamber volume and two crank turns. The complete locally prepared Mac Samantha voice is24 seconds, paced into four6-second chapters. The export is now **1920×1080 /30fps /720frames /H264/AAC**, with branded framing, readable captions, valve states and cycle progress. It uses the same EngineScene; no video model. Complete speech segments are4.74–5.20seconds and fit without truncation.
4. **Accessibility and finish:** stronger small-text contrast in every stroke, visible keyboard focus, reduced-motion snapshots,44px control targets, immediate pointer reversal, direct source disclosure, stable caption layout and desktop/phone framing checks. Material effects and rendering remain bounded local SVG; no new runtime dependency or network connection.

## Muse versus application authorship

`copy-base.json` exactly equals `refinement-author.json.structured`. The final `presentation.json` is that base with only subtitle and per-stroke name/verb/caption fields from `copy-author.json.structured`. Narration, part descriptions and three path refinements remain intact. The original `pm121/film.json` is preserved. `presentFilm` applies the bounded recorded data without mutating the base or changing part identity. No artistic hand edits are disguised as model output.

Muse authors vector paths/refinements and teaching copy; Soma owns material finishes, SVG layout/callouts, gas/spark depiction, constrained motion, controls and export composition. Voice is the prepared macOS Samantha voice. The visible recording label and source disclosure distinguish replay from live generation. Playback, inspection and manipulation make no provider calls or learner-evidence writes.

Source and assumptions remain PM121's original synthetic teaching card, qualitatively grounded in its linked NASA reference. Dimensions/timing are illustrative; no pressure, force, temperature, efficiency, valve-overlap or ignition-advance model is implied. No new checked quantitative/scored family.

## Actual generation and retained failures

Four bounded development operations made **eight actual Spark/Wonder calls**, adding **$0.1686385**. Latest observed shared ledger **$16.45400025 / $20**, at **2026-10-31T23:47:12.201Z**. Existing admission,20-percent allocation reserve, per-operation$0.35 reservation/90-second deadline,30-second requests and four-call limit retained. No cap increase/reset.

The first request exceeded the local instructions-size boundary and was rejected before transmission: zero calls/charge. Moving the large existing-art specification to the bounded input fixed it. The first accepted copy needed clearer cylinder-volume wording and a shorter subtitle; a subsequent recorded pass corrected those, then a copy-only schema improved captions while preserving narration/art. The first browser render rejected a26-character verb against the older22-character contract; both contracts now permit26, validated before rendering. Earlier candidates/requests/reviews and unsuccessful states are retained privately in `.local/pm123`; no reliability or held-out benchmark claim.

## Executed verification

- **1690 offline passes /100 opt-in skips**, including23 focused engine/presentation cases:1441-angle constraint closure, fixed roles/unchanged geometry, bounded paths/refinement scope, duplicate/unsafe data rejection and exact real-output lineage.
- **16 production browser journeys:** existing engine/voice/replay boundaries;241 rendered angle samples; two full turns of direct-handle dragging with reversal/exact stop; held-slider reversal; selection interruption, unchanged pose and focus restoration; playback shortcut isolation; source disclosure; four-stroke full-HD text bounds; small interface-text contrast≥4.5:1 in each stroke;1440/1280desktop and620/375phone controls visible/no overflow; keyboard/reduced motion and44px controls.
- TypeScript, standalone Vite build, full-HD export/codec/duration/frame checks and served-MP4 SHA matching the final render receipt passed. Product manifest remains PM118:263files/SHA `195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1`.
- Actual in-app pointer control changed the crank from0° to89° and opened the intake; final narrated0→720° playback completed naturally at Play again, part inspection preserved the pose, and Escape restored focus. The final material/copy composition was visually inspected and captured in-app. Native Mac Chrome access was attempted but the Mac was locked; no unlock or native acceptance claim. This does not block the independent in-app and development-browser checks.

Private proof/checks: `.local/pm123/browser-final.log`, `offline-final.log`, `typecheck-final-r2.log`, `export-final.log`, `final-375.png`, `final-1280.png`, `final-1440.png` and final in-app screenshot. The original PM121 screenshot/export remain represented by commit9d5c71c.

## Reproduce

```sh
node node_modules/vite/bin/vite.js build --config docs/examples/pm121/viewer/vite.config.mjs
node scripts/serve-engine-demo.mjs
node node_modules/@playwright/test/cli.js test --config tests/engine/playwright.config.ts
node node_modules/vitest/vitest.mjs run tests/domain/engine-film.test.ts tests/domain/engine-presentation.test.ts
SOMA_RENDER_ENGINE_FILM=true node node_modules/vitest/vitest.mjs run tests/export/engine-film.export.test.ts
```

Export the media **before** rebuilding the viewer so the static build contains the latest film/WAV. The loopback-only server remains static GET/HEAD with range media, no credentials/API/workspace files, and CSP `connect-src 'none'`. Live refinement is separately opt-in via `SOMA_ENGINE_POLISH_LIVE=true` and the existing Firestore budget/admission services.

No canonical engine-generation endpoint, film save/reopen, contextual follow-up integration, main merge, push, deployment or publication was added.
