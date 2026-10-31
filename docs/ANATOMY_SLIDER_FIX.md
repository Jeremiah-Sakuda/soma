# Anatomy direct manipulation — PM118

Review the repaired [local gallery](http://localhost:41908/#piston) on `codex/spatial-exploration`. Main remains unmerged. The user reported sluggish, incorrect-feeling slider movement on October 31.

Continuous slider input previously restarted a 360 ms eased transition at every change. The drawing trailed the input, including when reversing direction. Manual overrides now render the exact requested pose in the same React render and cancel an in-flight explanation transition. Explanation steps still ease between rigid parameter poses, now at the browser frame rate, and finish on exact values. Reduced motion and idle settling remain supported.

Swept camera bounds are cached by immutable piece identity with weak references. Slider input no longer compiles seventeen meshes per moving piece merely to fit the camera. Returned world bounds remain independent copies, and revised specifications get new cache entries. The gallery's unchanged Before plate no longer recomputes its scene during After scrubbing. Camera fitting still covers the full motion range; numbered markers now follow the current geometry rather than its full-range bounds.

## The piston had a separate authored geometry error

The original actual Muse output moved the head down 0.30 local units: its lower face crossed the fixed base near the end of the control. Its rod also had gaps at the head and grip. Schema validation and advisory review had accepted that output. Earlier rigid-group checks established coupling, not collision avoidance or attachment.

Muse generated a corrected recording from the same original synthetic screenshot, with specific repair constraints supplied by the application developer. Muse authored the replacement shapes and motion, and Wonder approved it. All three movers use the same 0.16 downward travel; the head retains clearance above the base. Independent checks sample 101 positions, testing clearance, attachments, rigid-group distances and stationary supports. This is a targeted geometric development check, not a general collision solver or checked physical simulation.

The corrected artifact was saved and exactly reopened in Firestore. The original remains in [piston-original-after.json](examples/pm117/piston-original-after.json); the actual new response is in [comparisons.json](examples/pm117/comparisons.json), and its usage/ledger observation is in [piston-repair-receipt.json](examples/pm117/piston-repair-receipt.json). The gallery discloses the revision. Gate and rotor generations were not changed.

This correction used three actual provider calls, 19.510 seconds of application generation time and **$0.04767325**. Shared cumulative spending was **$15.30956725 / $20** at `2026-10-31T17:28:51.758Z`, leaving **$4.69043275**. Existing reservations, allocation reserve and limits remain unchanged. An initial overlong question was rejected before inference with zero charge; the retry fit the existing input limit.

## Verification

- Before the fix, all three exact-pose slider regression cases failed. With normal motion enabled, the final gallery passes six checks: fast value changes/reversals and held-pointer dragging in both directions for gate, piston and rotor. Actual SVG paths match reduced-motion target poses within two animation frames, and stay unchanged after release. The Before drawing stays unchanged.
- Nine existing gallery checks passed with the corrected piston: SVG/WebGL, source bytes, responsive/keyboard/reduced-motion paths, browser Back and no-inference serving. Fifty targeted geometry checks passed after the marker correction, including the retained original piston error.
- Final checks: **1,647 offline passed / 95 opt-in skipped**, **166 production-browser passed** against the exact final runtime. TypeScript, Vite/Next production builds and packaging trace passed (1,224 traced files, two package links, zero private configuration mappings). Private execution receipts are under `.local/pm118/`.
- Native Mac Chrome exercised control reversals and fine keyboard changes across all three examples, and full compression of the corrected piston. Fresh in-app browser inspection exercised the final control. The original in-app tab had stale connection-error state; a fresh tab loaded the running loopback gallery successfully.

Retained verification failures: the first production build omitted the synthetic compile-time Firebase key required by three account-isolation fixtures; rebuilding with the test-only public key restored those journeys. The first combined step/manual idle assertion counted the separate 2.4-second explanation clock; it now checks immediate geometry stability, then idle work after that existing bounded clock settles. No ownership, authentication, provider or validation boundary was weakened.

Runtime manifest: 263 files, SHA-256 `195d3d553598638a63403e84534d7196f76aa165d48d415178273f844f32d8d1`, release `soma-pm118-slider-2026-10-31`. No main merge, push, deployment, publication or user visual-acceptance claim.
