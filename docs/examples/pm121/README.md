# PM121–PM122 — Inside the engine

**Historical PM121 verification record.** [PM123](../pm123/README.md) supersedes the presentation and exported media at the same URL. The original Muse base specification remains intact; its800×600 film and prior presentation are preserved in commit9d5c71c. Current viewer applies additional recorded Muse refinements and application material finishes, direct crank/part inspection and a1920×1080 export.

A refined local four-stroke cutaway on `codex/spatial-exploration`. Open **http://localhost:41914**. The earlier same-piston Anatomy/film comparison remains at **http://localhost:41912**. Engine versus piston is not a matched-source quality benchmark.

The user selected a single-cylinder four-stroke combustion engine. The primary presentation is now one large cutaway: intake, compression, power and exhaust; synchronized piston, connecting rod, crank and poppet valves; illustrative gas flow and a brief ignition flash; four direct stroke selectors and one crank control covering 720°. Playback is a24-second recorded explanation. Touch/keyboard manipulation pauses immediately, without a settling tail. At phone width the drawing enlarges and a numbered part key replaces tiny side labels. Detailed provenance stays collapsed.

## Authorship and factual boundary

Muse Spark authored the vector engine paths, palette, captions and narration script. Soma owns the constrained slider-crank transforms, idealized non-overlapping valve timing, gas particles/flow/spark, bearings, plug, part callouts, responsive framing, controls and media clock. Mac Samantha speaks the complete Muse script; FFmpeg makes the MP4. No video model or model call during playback.

`film.json` is reproducible exactly from `base-author.json` plus the three `d` updates in `path-repair-author.json`, followed by the one counterweight update in `counterweight-author.json`. The app applies those updates mechanically; there are no undisclosed artistic hand edits. The accepted Wonder review is advisory. It does not certify physical accuracy or learning outcomes.

The original synthetic source card is included, informed by [NASA Glenn’s four-stroke description](https://www.grc.nasa.gov/WWW/K-12/BGP/engopt.html). Dimensions are illustrative. Rod length170, crankradius64 and the cylinder roof are rendering assumptions. The geometry satisfies the slider-crank closure equation, independently checked across1441 angles. This is not a pressure, force, combustion, temperature or efficiency model; no new scored science family or learner evidence is created. Valve overlap and ignition advance are deliberately omitted.

## Actual generation and retained failures

Five bounded operations made **16 actual Spark/Wonder calls**, costing **$0.47103575**. Latest observed shared ledger **$16.28536175 / $20**, at **2026-10-31T23:31:01.878Z**; all previous usage and uncertain reservations retained. Admission,90-second operations,30-second requests,4-call limits and$0.35 reservations remain enforced. No cap increase/reset.


## Executed verification

- Full offline suite: **1679 passed /99 opt-in skipped**. The first sandboxed run failed48 local-server cases with `listen EPERM`; rerun with loopback permitted passed all. A subsequently added exact-art-lineage case passed with all **13 focused engine tests**.
- **Ten production browser journeys**: source data, stroke/valve behavior,241 rendered angle samples, exact held-pointer reversals, actual media clock/pause/seek/end, voice failure recovery, valve-head seats, path/label bounds, labels off, keyboard/reduced motion and375/620/900/1440 layouts, icon sizing, no outbound/API/workspace access and range media serving.
- TypeScript and standalone Vite build passed. Canonical product runtime remains PM118:263files / SHA `195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1`.
- Same SVG scene exported as **720 frames /30fps /24 seconds /800×600 H264 with AAC audio**. All four local speech segments fit their six-second chapters without cutting words (3.84–4.49 seconds each).

This remains a static private demo, with no canonical exploration generation endpoint, save/reopen/follow-up integration, main merge, deployment or publication.

## Reproduce

```sh
node node_modules/vite/bin/vite.js build --config docs/examples/pm121/viewer/vite.config.mjs
node scripts/serve-engine-demo.mjs
node node_modules/vitest/vitest.mjs run tests/domain/engine-film.test.ts
node node_modules/@playwright/test/cli.js test --config tests/engine/playwright.config.ts
SOMA_RENDER_ENGINE_FILM=true node node_modules/vitest/vitest.mjs run tests/export/engine-film.export.test.ts
```

Replay is loopback-only, static GET/HEAD with range media; CSP disallows connections. Vite does not load environment files. Live generation is separately opt-in (`SOMA_ENGINE_FILM_LIVE=true`); it uses existing Firestore admission/budget enforcement and requires private credentials. Replaying, testing or rendering does not require inference.
