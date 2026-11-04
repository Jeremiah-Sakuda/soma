# Muse mechanism authoring — PM113

October 30, experimental `codex/spatial-exploration`. The user adopted richer bounded geometry and motion after clarifying that changing Three.js to Anatomy alone did not expand Muse’s authorship. This extends the same private Soma application; it does not add a checked science domain or authorize a main merge.

## What Muse controls

Muse can construct parts from convex extruded outlines, lathed radius/height profiles and segmented tube paths. Each piece has a purpose, color, local scale, position and XYZ rotation. Named semantic parts retain selection, source binding and follow-up identity. Up to three normalized controls drive rotation about an explicit pivot and translation; explanation steps can set those controls. The renderer compiles the surfaces deterministically. No generated JavaScript, HTML, shaders, external models, URLs, physical solver or validation-rule changes are accepted.

Both Three.js and Anatomy use the same geometry compiler, transforms and palette. Anatomy is the default for newly authored custom mechanisms. The existing seventeen catalog styles and legacy saved scenes remain compatible. A custom part chooses geometry or a catalog style. Mixed scenes can contain both kinds of parts. Three uses real depth buffering and an optional clipping plane; Anatomy uses face shading, silhouette/crease paths and bounded painter ordering. Anatomy’s enclosure cutaway remains specific to catalog housings. Intersecting surfaces may still sort imperfectly; these are illustrative mechanisms, not CAD or recovered anatomy.

## Controls and continuity

Control values are normalized from zero to one; they are not physical units. A driver rotates a resting piece around its object-local pivot by value times its XYZ angles, then adds value times its translation. Piece-local transforms apply first. Muse chooses one shared assembly frame with a position and uniform scale; Soma binds that frame to each custom part. Coupled pieces use matching pivots and driver definitions, so independent part bounding boxes cannot pull an attached handle away. The compiler does not solve joints or constraints automatically.

Explanation defaults, step-bound values and manual overrides are separate. Manual overrides persist across steps, renderer switches, saves and contextual follow-ups. “Follow explanation motion” removes overrides; the UI states when controls override the step’s motion. Follow-ups preserve existing geometry, driver definitions and parameter identity before factual review. If step IDs change, Soma binds the previously inspected explanation pose to the new active step without baking manual values into the explanation. Reconstructing the world requires a fresh source. Presentation changes do not become independent-understanding evidence.

Anatomy interpolates control values over a bounded 360ms transition and recomputes rigid transforms at each frame; reduced motion settles immediately. Three updates the same geometry directly. Full-range conservative bounds keep framing stable when scrubbing. If WebGL is denied, custom mechanisms retain their geometry in an SVG front illustration; the explicit 2D view uses that illustration too.

## Bounds and provenance

At most sixteen semantic parts, twelve pieces per part, sixty-four pieces per scene, 4,096 conservative faces, three controls and twenty-four step/control bindings. The existing 16,384-byte total specification cap, provider response/node limits, six calls, ninety seconds and $0.35 reservation also apply and can bind sooner. Explicit spatial composition has a 6,144-output-token ceiling with minimal reasoning effort; ordinary vision calls retain their 4,096-token default. Unknown billing retains the full reservation. Finite coordinates, local references, convex nonintersecting outlines, monotone lathe profiles, positive tube segments and unique bindings are validated before publication. Source uncertainty, factual review, workspace ownership and exact saved revisions remain required.

The provider wire carries geometry beside the scene in a shallow `mechanism` payload, avoiding the [Meta API’s ten-level schema nesting limit](https://dev.meta.ai/docs/structured-output). Soma assembles that payload into the full domain specification before topology/source validation, factual review and storage. Explicit mechanism requests constrain composition to one spatial panel; unrelated panels cannot replace the mechanism.

“Open geometry authoring example” loads an original prepared hinged passage with all three forms, two coupled moving parts and three poses. It explicitly states that it is not Muse output and makes no model call. Prepared examples, recorded Muse output and new live generation must stay distinguishable.

The cumulative testing allowance remains $20, preserving prior usage, unknown-usage reservations and the $150 allocation’s twenty-percent reserve. No daily admission limit was changed.

## Executed verification

- Offline regression: **1,640 passed, 95 opt-in skipped**. Compiler/service cases cover topology, finite data, budget limits, independent hinge math, conservative full-range bounds, renderer surface correspondence, inert controls, shallow-schema depth, foreign bindings, ownership, state rejection, follow-up continuity and exact reopening.
- Production browser: **166 passed** against the exact default Next build. Includes prepared and actual recorded mechanisms, both actual live revisions in both renderers, old Muse recordings, keyboard/reduced motion, 375/620/1440 widths, normal animation/idle settling, WebGL denial and an SVG geometry fallback. An invalid-state HTTP test first proves a valid PATCH succeeds, then verifies rejection and atomic preservation.
- TypeScript, production build and packaging trace passed: 1,224 traced files, two valid package links, zero private configuration mappings. Canonical and credential-free snapshot runtime manifests match: **263 files**, SHA-256 `2453777e926c3ed1084f131541e9388d337673e9ddb0501ee56e791d36ac436d`, release `soma-pm113-mechanisms-2026-10-30`.
- Native Mac Chrome verified prepared step motion, manual overrides, comparison, selection, save and exact reopening. It also opened the actual Muse recording and advanced its synchronized comparison. Browser images of the actual generated surfaces were visually inspected. This does not establish user visual acceptance or a cross-device GPU benchmark.

### Actual Muse development run

The original synthetic hinged-passage screenshot passed the real source-reading → composition → Wonder review → checked publication pipeline. Muse authored six pieces using prism, lathe and tube forms, four semantic parts, a shared assembly frame, one opening parameter and three poses. Wonder rejected an initially short gate slab because it did not fill the opening. Muse corrected the geometry; Wonder then approved. First generation: five calls, **40.218s**, **$0.08729075** recorded usage. Advisory approval is not proof of physical correctness.

The real contextual follow-up preserved every part’s geometry, driver and the manual 0.6 opening. It required one application repair, then passed Wonder review: three calls, **26.695s**, **$0.06486925**. Independent compiled-vertex distances confirmed the handle stays attached through opening values 0, .25, .5, .75 and 1. Both revisions retained their source, and exact state reopened in actual Firestore. This is one successful development journey after fixes, not a held-out reliability result or a latency benchmark.

“Open Muse mechanism recording” imports that exact first accepted output into an owned local session without new inference. It preserves original usage, timing and the advisory geometry-repair audit, visibly labels replay, and includes only the original synthetic source image. The separate prepared compiler example remains labeled prepared. Local preview: **http://localhost:41906/explore**, live inference disabled. Main is unmerged; no push, deployment or publication.

At **2026-10-31T00:13:10.915Z**, the unchanged shared ledger was **$14.93734875 / $20**, leaving **$5.06265125**. It includes two retained $0.35 reservations with uncertain provider billing. No historical consumption, unknown reservation or daily limit was reset.

### Retained failures and corrections

The initial nested geometry schema exceeded Meta’s ten-level limit; two attempts retained full reservations, and safe HTTP error metadata confirmed the cause. A shallow, lossless authoring payload fixed the schema. A subsequent 4,096-token composition truncated; the explicit spatial profile is now bounded at 6,144 with minimal effort. A complete proposal initially omitted its spatial panel; a repair reused sequence/step IDs. Explicit mechanism composition now requires one spatial panel, and shared-frame authoring prevents independently scaled part boxes from breaking attachments. The successful real run still needed a substantive geometry revision and a follow-up contract repair, recorded honestly above.

Earlier local failures: author instructions exceeded 8,000 characters until condensed; shared coordinates in the prepared fixture were copied independently; a geometry-intersection test gained bounding-box overlap checks for collinear edges; a normal-motion observer was corrected to watch the moving gate rather than only its stationary hinge, and waits for the existing bounded card-entry animation before checking idle work. A sandbox build was stopped after stalling; the permitted default build passed. These receipts remain in `.local/pm113/`, including `live-r1.log` through `live-r5.log`, `unit-final.log`, `browser-final.log`, `build-final.log`, `typecheck-final-r2.log`, `trace-final.log`, manifests, budget and original synthetic live artifacts.

Implementation commit: [7448550](https://github.com/Jeremiah-Sakuda/soma/commit/7448550).
