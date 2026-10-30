# Anatomy comparison — PM108, October 30

An experimental alternative on `codex/spatial-exploration`, using the same validated scene and controls as the Three.js renderer. This is a comparison prototype; neither a main merge nor user visual acceptance is established by automated checks.

## Try it locally

Open `http://localhost:41904/explore`, choose **Open the 3D example** (or reopen the relay from the library), then choose **Current 3D**, **Anatomy illustration** or **Side by side**. At narrow widths the comparison stacks vertically. The prepared relay is original synthetic teaching material, not a Muse output or an observed physical device.

Both views share explanation step, part selection, camera, separation, cutaway value and isolation. Saving retains the selected renderer and exact view state; side-by-side comparison is a temporary inspection mode. Existing saved states without a renderer still open with Three.js. Renderer changes make no provider calls and never alter the scene specification, source, solver or learner evidence.

## Implementation

- Anatomy `kit/iso-kit.ts` is pinned to upstream commit `1482e8469b0a9e0d8cc18ea2740a01423d29ae80`. MIT copyright and permission are retained in `src/vendor/anatomy/LICENSE` and `THIRD_PARTY_NOTICES.md`.
- Original Soma geometry adapts all 17 approved illustrative styles. The relay becomes one open-front enclosure with a board, supports, sensor, pinned processor, indicator and signal marker. Detail is explicitly illustrative. No upstream showcase artwork is reused.
- Pure upstream projection/extrusion functions produce path data; Soma constructs SVG through React. There is no generated markup execution, external asset URL or arbitrary model script. The optional upstream beta 3D engine, WebGL effects and coding-agent installation are not included.
- World coordinates map from Soma's y-up convention to the kit's z-up convention as `(x,z,y)`. Independent camera-right/up checks and the existing camera-distance zoom convention keep rotations and zoom consistent across renderers. Bounds fit the current visible scene. Separating-axis painter constraints keep broad platforms behind components above them, with stable depth fallback for intersecting/ambiguous schematic solids. Transparent shells draw last and do not intercept contained-part picking; the labeled part buttons select shells.
- Pose changes interpolate for a bounded 360 ms and settle without idle frames. Reduced motion skips interpolation. Selection, pointer orbit, keyboard alternatives, containment-aware isolation and textual object/connection inspection reuse the current journey.
- Muse continues to author the bounded scene specification and follow-up explanation. The adapter accepts that contract; choosing Anatomy does not give Muse unrestricted bespoke figure authoring. Isometric requests now route to the existing spatial contract. Renderer preference is preserved through reviewed revisions and saved reopening.

## Compare the tradeoffs

| Concern | Current Three.js | Anatomy prototype |
| --- | --- | --- |
| Appearance | Lit perspective meshes, broad part callouts | Four-tone isometric drawing, restrained numbered highlights and selected-part label |
| Runtime | WebGL with flat fallback | SVG, verified without WebGL |
| Camera | Perspective orbit, including below-ground angles | Orthographic/isometric projection; below-ground angles display at ground level |
| Cutaway | Mesh clipping | Opens housing walls/lid; disabled with an explanation when a scene has no enclosure |
| Occlusion | GPU depth buffer | Application painter constraints; complex intersecting solids can still be ambiguous |
| Content | Same source-bound scene and deterministic checked graph projection | Same; no extra scientific assurance |

The prototype demonstrates the toolkit integration and an original mechanism. It does not reproduce the craft of every bespoke upstream showcase, establish a frame-rate benchmark across hardware, or prove improved learning. More complex mechanisms may need dedicated assembly designs and occlusion work. Visual preference remains a user decision.

## Testing allowance and live status

PM108 explicitly raises the shared cumulative testing allowance from $15 to $20. Local `META_APP_SPEND_CAP_USD=20`; actual allocation remains $150, including its 20% reserve. Historical charges and unknown-usage reservations are retained. No billing purchase, provider credit balance, hosted configuration or daily admission limit was changed.

At `2026-10-30T22:29:14.196Z`, the actual shared ledger was $13.99902475, leaving $6.00097525 under the new cap. The PM108 fresh spatial generation/follow-up attempt was refused during guest initialization by the existing `MAX_GUESTS_DAY` limit. It made zero provider calls and left the ledger unchanged. Fresh Muse selection of the expanded styles remains unverified; recorded-output rendering is distinct from live generation.

## Verification record

Executed so far: 1,615 offline checks passed (94 opt-in skips), final TypeScript/default production build and isolated trace passed (1,224 files, two internal links, zero private-configuration mappings). The final exact-build production browser run passed all156 journeys, including four retained real Muse-output replays (first/follow-up × Three/Anatomy). No provider calls were made by replay. Private logs, screenshot studies and retained model replay inputs live under ignored `.local/pm108`. No raw screenshots, credentials or provider response archive is committed. Native Mac UI observations are recorded separately from automated Chromium checks.

Retained intermediate failures: sandbox socket denial affected48 offline cases before the local-access rerun; the first preview used a dependency symlink incompatible with the isolated Turbopack root; initial visual inspection exposed center-depth occlusion of a far-side sensor by the broad board; SVG picking needed transparent-shell pass-through and a real visible hit-point test; a source-disclosure test initially closed an already-open disclosure; the first isolated trace rejected an absolute dependency symlink. These were investigated rather than counted as passes. Dependency materialization uses the same pinned lockfile and makes no package-version change.

Additional retained regression evidence: the default-build browser run initially passed155/156; encoded PNG equality failed. Strict decoded-pixel comparison exposed19 differing color-channel values in a subsequent parallel software-GPU run. Direct draw-call instrumentation then established actual redundant GPU submissions (3,306 to5,568 calls during the idle observation), so this was not dismissed as compression alone. Three.js now skips updates that change only callback identity. The test waits for compositor frames, independently requires zero additional real WebGL draw calls for450ms and permits at most4/255 change in fewer than0.01% of raster channels. Camera-axis/zoom consistency also received an independent projection test. The corrected final build passed all156 browser journeys.

Final release evidence: runtime257 files, SHA-256 `d4b232df147e8b1f680aa459bce2e155b006782fde44d228dcfbd95a13436925`, release `soma-pm108-anatomy-2026-10-30`. Root and credential-free snapshot manifests match. Executed receipts: `.local/pm108/unit-release-final.log`, `browser-release-final.log`, `build-release-final.log`, `typecheck-final.log`, `trace-release-final.log` and `manifest-final.json`. Native Chrome on the Mac verified saved Anatomy renderer/selection/zoom/separation restoration, synchronized comparison steps, part selection, enclosure cutaway and isolation; the final camera/idle refinements also passed the full exact-build browser suite. Native review is not a cross-device GPU benchmark.

At `2026-10-30T22:47:42.862Z` the shared ledger remained$13.99902475/$20, leaving$6.00097525. No inference spend was added by PM108. Final local review server: `http://localhost:41904/explore`, live inference disabled. Main remains unmerged and no push, deployment or publication occurred.

Final native reload also reopened the saved Anatomy state on the last tested build. The review tab is left at explanation2, Processor selected, assembled perspective and Side by side; these last review changes are unsaved, so the earlier saved view remains available in the library.
