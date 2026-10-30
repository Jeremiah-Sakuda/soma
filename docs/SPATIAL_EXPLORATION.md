# Spatial exploration — PM096

October 30, 2026. Authorized experimental branch: `codex/spatial-exploration`, in original private `Jeremiah-Sakuda/soma`. This is a branch implementation, not a production release or change to the October 31 freeze.

## Deliverable

An end-to-end spatial workspace inside the existing exploration: selected source → Muse-authored bounded 3D schematic → inspect/explode/slice/isolate/step → contextual follow-up → saved version. Existing checked BFS/Dijkstra scenes gain a spatial view driven by the same solver. General spatial scenes remain explicitly explanatory; no optics, biology or mechanical numerical model is added.

The application owns geometry primitives, camera limits, rendering, object selection, local presentation controls and checks. Muse may author bounded spatial objects and per-step poses, tied to stable IDs, revise the explanation, and request a bounded camera/separation/cutaway/isolation change. A view action applies once at publication; reopening never reapplies it over subsequent manual controls. No generated JavaScript, shaders, HTML, remote meshes or arbitrary physics. A source image cannot establish hidden geometry; the UI labels spatial schematics as abstractions.

## Acceptance

1. Spatial specifications reject unknown fields, invalid IDs, duplicate/cyclic parents, dangling links/poses, nonfinite/out-of-range geometry, excessive complexity and checked-mode spatial claims. Existing saved specifications still parse.
2. The spatial view supports keyboard-accessible object selection, explicit camera presets and orbit buttons, exploded separation, clipping, isolation and explanation/trace steps. Source and captions remain available. No mandatory motion; rendering is demand-driven, bounded and disposed. Initialization/context loss leaves a useful accessible representation and recovery path.
3. Save/reload restores camera, presentation, selection and step through existing owned persistence. Follow-ups preserve presentation state and unchanged object meaning; malformed/foreign state cannot be stored. Scene changes prune invalid references. Original revisions remain immutable.
4. Checked 3D positions/status/path derive from actual current BFS/Dijkstra traces, including ties, disconnected nodes, changed weights and disabled edges. Spatial geometry never changes numerical answers.
5. An original synthetic spatial example is usable without inference and clearly labeled. Actual Muse spatial authoring/follow-up must be tested separately within the unchanged shared $15 allowance; scripted providers are not live evidence.
6. Domain, service/HTTP isolation and actual WebGL browser journeys; desktop/620px/375px, keyboard/reduced motion, save/reopen, generation failure and WebGL failure; full regression suite, type/build and manifest checks. Record executed results and any unmet gates below.

## Boundaries and sequence

First: domain/state contracts and deterministic projection. Second: Three.js renderer and integrated controls/examples. Third: Muse authoring/continuity, service and browser verification. Last: live bounded synthetic-source evidence and final review. Pin Three.js and types to matching 0.187.0, checked against registry on October 30. Do not merge main, deploy, publish the repository, provision cloud resources or raise budgets as part of this branch task.

This is a schematic spatial explanation engine, not recovery of a physically accurate digital twin. New checked scientific families, unrestricted asset generation, XR and continuous camera observation remain future work.

## Implementation and demonstration

Implemented in `7c7e045`, interaction fixes and runtime identity in `cbcdae8`, after scope/dependencies commit `ce53a70`.

- `spatial-schema.ts` defines strict primitive, pose, containment and view contracts. `spatial-exploration.ts` projects existing checked traces and applies presentation transforms without modifying the solver.
- Client-only Three.js loads on demand. Picking, orbit, presets, clipping, separation and isolation have keyboard alternatives; explicit steps drive poses without continuous animation. Failed initialization or context loss falls back to a readable front projection with object/connection descriptions and a retry control.
- Existing owned revision storage saves presentation state. Authoring and factual review receive the current context; context-preserving spatial follow-ups retain the existing part/connection IDs and geometry before review. Clarification remains possible. The service’s explicit `modify` intent permits structural changes; ordinary browser follow-ups preserve the existing structure.
- Three.js and types are pinned to 0.187.0; MIT notice retained. No new service, credential, database or remote asset source.

To try without spending: open `/explore`, choose **Open the 3D example**, select **Processor**, separate the parts, move the cutaway slider, advance/reverse explanations and try Side/Above. Save, reload and reopen from the library. **Compare weighted paths → 3D workspace** demonstrates the existing checked Dijkstra/BFS results in space.

For actual generation, supply a visible diagram and request a **3D schematic**. Select a part and ask, “Keep the parts and current separation; show the selected part from the side and explain it.” Save the resulting revision. This requires normal configured live inference and available shared budget.

## Verification — October 30

- Focused domain/service checks: **38 passed**, covering bounds, malicious/unknown fields, cycles, IDs, source/version binding, lost parts, immutable originals, persisted controls, account isolation, numerical ties/zero weights/disconnection/disabled edges, and reviewer context.
- Full offline regression: **1,550 passed, 94 skipped** including the final lost-part case. Skips are explicit opt-in infrastructure/live checks. Restricted sandbox first produced localhost EPERM failures; the authorized run passed. Final checks below supersede intermediate runs.
- Prepared actual-WebGL browser suite initially **5 passed**: save/reopen, solver parity, reversible step state, context loss/recovery, initial GPU denial, keyboard/reduced motion and widths 1440/620/375. Full regression exposed a Node import suffix issue and pre-existing graph-fit regressions caused by the new view selector; those were fixed rather than weakening assertions. Final full browser run passed 138/141; three new pointer/replay cases failed. Fixed drag reset during parent animation rerenders and corrected the private replay harness to explicitly open library entries. The subsequent affected set passed **36/36**, including those three, all spatial journeys, audio animation, native/desktop layout and both recorded actual Muse outputs. Unaffected full-suite cases were not repeatedly rerun.
- **Actual Muse + Firestore live test passed** with an original synthetic screenshot. Source-to-spatial publication: 31,201 ms, six bounded calls, $0.0785505; contextual side-view revision: 12,387 ms, two calls, $0.03039475. Same parts/geometry, source, selection, separation and cutaway retained; saved revision reopened exactly; original unchanged. First scene needed source-format repair and a factual color correction; this is one development example, not a reliability benchmark.
- Earlier live attempt published its first scene but rejected continuation because the reviewer lacked saved presentation state. Added that validated context and a focused regression; kept the failure receipt. No rejection bypass or budget reset.
- Live receipts/output remain private in `.local/pm096/live-1793391956526` (failed) and `.local/pm096/live-1793392062102` (passed). Final settled ledger snapshot was **$12.5904345 / $15**; the shared ledger may change through other authorized work. No provider keys or course/learner data are in the test source or artifacts.
- Existing desktop/diagnostic checks **25 passed**, authenticated voice relay **3 passed**, adversarial credential-browser cases **28 passed**.
- Typecheck and optimized Next.js production build passed. Isolated browser trace imported successfully (1,224 files, two links, zero private configuration mappings); Firebase module-restriction check passed. Root and credential-free verification snapshot agree on 251 runtime files, SHA-256 `a1133895e6c2c576a2920279b7cf55d55c526d5b9fc40d5f36089bebe2944113`, release ID `soma-pm096-spatial-2026-10-30`. Manifest writer now accepts an explicit release ID. Actual Muse first/follow-up render screenshots were visually inspected; replay is rendering evidence, not another live call.
- Optimized-production spatial browser smoke: **6/6 passed** on port 41796 (the first selected port was already occupied and was left untouched). Logs are retained in ignored `.local/pm096/`; source verification used a credential-free snapshot on separate local ports so another active development server was not stopped.

## Remaining limits

Generic 3D is a bounded explanatory schematic, not an accurate reconstructed digital twin or a new checked physics family. Hardware coverage is Chromium with software WebGL plus deliberate GPU failure, not every physical GPU/native device. Live evidence covers one original synthetic mechanism and its continuation, not broad-subject reliability or user learning outcomes. The branch is not merged, deployed, pushed or published by this task.


## PM098 — Fresh pre-merge verification, October 30

The spatial branch incorporates canonical main `dc11105` through merge commit
`afa5675`; main itself was not changed. This acceptance run supersedes the earlier
partial full-browser result. All final acceptance checks below passed.

Defects reproduced and corrected:

- A large tentative Dijkstra distance could project far outside the scene after
  its final distance improved. Projection now normalizes against the entire
  checked trace; separation preserves the distance-encoding height.
- Separated object positions depended on array order/count. Stable object IDs now
  determine offsets, preserving existing positions through reordered revisions.
- Text-only diagrams offered an empty 3D view. They now remain 2D; mixed diagrams
  retain their text annotations when shown spatially.
- Renamed explanation steps could rewind the inspected spatial pose. The current
  pose is preserved before factual review. Converting a 2D node to the same named
  spatial object now preserves semantic identity without weakening mode checks.
- Sub-threshold pointer movement visibly changed the camera without saving it.
  Click selection now restores the saved camera before picking.
- Main's panel reflow needed explicit full-width spatial placement. Added a
  context-panel-plus-spatial regression, preserving content and source references.
- Camera buttons and range controls now meet the guide's 44×44 touch targets.
- Combined author instructions exceeded the existing 8,000-character provider
  limit on follow-ups. Removed duplicated wording while retaining source,
  computation, continuity and view-action constraints. Spatial service tests now
  exercise the real request encoder/budget estimator instead of stubbing it.

Executed evidence:

- Full offline suite: **1,568 passed / 94 opt-in skipped**, 128 passing test files.
  The first combined run had three failing follow-up cases; all were reproduced
  with the real request encoder and pass after the instruction-length correction.
- Complete production Chromium suite: **146 passed**, including both recorded
  fresh Muse outputs, actual WebGL picking/orbit/save/reopen, solver parity,
  initial GPU denial/context loss/recovery, six mount/unmount cycles with context
  disposal, cross-session HTTP isolation, hostile origins, injected state,
  click-sized pointer wobble, keyboard/reduced motion and 1440/620/375 widths.
  All visible spatial buttons/range controls meet 44×44 targets. Screenshots of
  both actual outputs and companion/phone views were visually inspected. Small
  viewports use scrolling around the existing fixed question dock; this does not
  establish that the entire workspace fits on one screen. Replay establishes
  rendering only; the separate live test establishes inference/persistence.
- Desktop plus diagnostic contracts: **25 passed**; authenticated voice relay:
  **3 passed**; adversarial credential-browser pages: **28 passed**.
- Typecheck, optimized production build, Firebase module-restriction import and
  isolated browser trace passed: 1,224 traced files, two links, zero private
  configuration mappings. Root and credential-free build snapshot agree on 251
  runtime files, SHA-256
  `16356bdbb4da58db0241977a6b16cd36fd31e7259c64e54fea877464952a7093`,
  release `soma-pm098-spatial-2026-10-30`.
- Fresh actual Muse + Firestore test passed against the combined implementation:
  initial scene **18,751 ms / 3 calls / $0.03515275**; contextual revision
  **9,513 ms / 2 calls / $0.02404725**. Selected processor, source, part geometry,
  separation and cutaway persisted; requested side camera applied; saved revision
  reopened exactly and the original remained unchanged. Synthetic development
  source only; explanatory assurance, no new scientific computation.
- An earlier combined live attempt published its scene after factual repair but
  failed its follow-up before a provider request because of the instruction limit.
  Both failure and success receipts remain private. A successful pre-integration
  live run is retained separately, not substituted for combined-branch evidence.
- Latest successful run's shared ledger snapshot: **$13.671588 / $15**. Other
  authorized work also used this ledger concurrently; the delta is not this
  test's cost. This successful test cost $0.0592. No budget reset or increase.

Private receipts and logs are under `.local/pm098/`; the final live artifacts are
in `live-1793395866881`. Browser verification uses an isolated, credential-free
source copy on port 41898. No other chat's development server was stopped.
The latest remote-main check still resolved to `dc11105`. Subsequent main changes
will require an integration check before merge. No feature merge, deployment,
push, publication, clean hosted CI claim or physical GPU acceptance is implied.


## PM101–PM103 — Mac review and educational cutaway revision

The user requested native Mac computer-control testing, rejected the initial
primitive appearance, and selected polished educational cutaways. PM098's
functional results did not establish visual acceptance. This revision remains
on the spatial branch, awaiting the user's judgment of the revised appearance.

Implemented:

- Five optional, strict application-owned part styles: housing, chip, sensor,
  indicator and signal marker. The existing primitives remain compatible.
  Muse may select a style only where its meaning fits the source; component
  finishes and geometry remain explicitly illustrative. No downloaded meshes,
  generated code, texture service or new checked scientific model.
- Beveled geometry, restrained materials, contact shadows, a quieter stage,
  readable labels with leader lines, Lucide camera icons and a neutral inspector.
  Whole-scene framing is closer; explicit isolation frames the selected assembly.
- Styled parts separate along an assembly axis; the moving marker follows the
  relevant part's offset. Pose transitions run for 360 ms and then stop. Reduced
  motion applies the final pose immediately. Connections follow moving endpoints.
  Animation, shadow maps, geometry and materials are disposed on unmount.
- Contextual follow-ups preserve an existing part's render style before factual
  review, just as they preserve its geometry. Legacy parts do not acquire a new
  style silently. Added validation and continuity regressions.

Native computer-control evidence (installed Chrome guest window on this Mac):

- Opened the actual local production build and inspected the recognizable parts,
  shadows, labels and isolated processor. Used pointer drag to orbit, side and
  perspective presets, native selection and isolation controls.
- Used keyboard arrow/Home controls to set separation to 0.55 and cutaway to 0.2;
  advanced to explanation 2, switched 2D→3D, saved, navigated away and reopened.
  The UI visibly restored processor selection, explanation 2, both slider values
  and the 3D representation. Earlier isolation save/reopen also passed.
- Native review exposed a tiny isolated component under whole-assembly framing;
  corrected and visually verified the closer framing. Reset to the assembled
  perspective for review afterward; that reset is intentionally unsaved, leaving
  the tested saved state available in the library.
- Firefox's automation surface returned stale screenshots, so no Firefox pass is
  claimed. One Chrome tab became blank during a server restart; a fresh local
  tab loaded correctly. No hardware-driver benchmark or universal browser claim.

Final verification:

- **1,570 offline tests passed / 94 opt-in skipped**; typecheck passed.
- **147 production Chromium tests passed**, including legacy actual-Muse output
  replay, WebGL failure/recovery/disposal, account isolation, pointer interaction,
  persistence, keyboard, 1440/620/375 widths and motion. First browser run passed
  the existing 146 cases but the new transition assertion missed its transient
  state; recording attribute transitions before clicking fixed the observation,
  and the complete suite passed on the final build. The failure receipt remains.
- Optimized build and isolated browser trace passed: 1,224 files, two links,
  zero private configuration mappings. Runtime manifest: 252 files,
  `2c7eb5049a9b574e24e2b30ffcd1b8d23be7f7c2511e38db1a1275b0e70b1c94`,
  release `soma-pm103-spatial-2026-10-30`.
- A fresh live Muse/Firestore attempt was blocked at initialization by the daily
  guest-session creation cap, **before any inference call or charge**. Ledger
  stayed $13.848943/$15. No cap reset/raise or bypass. The new optional styles are
  exercised through schema/service/native/rendering tests; fresh live authoring
  of those styles is **not verified**. PM098 live receipts apply to the earlier
  contract, and recorded replay is not new inference.

Logs and screenshots are private under `.local/pm101/`. The local-only synthetic
server is left at `http://localhost:41898/explore` for review, with live inference
disabled. The native Chrome test tab is left open. No feature merge, push,
deployment or publication. The broader UI and fixed mobile composer were not
redesigned here; existing small-screen scrolling limitations remain. This small
part library is not a universal realistic-asset generator.

## PM106 — Broader component vocabulary and additional polish

User-authorized continuation of the experimental branch, not a new checked
scientific family. Muse's strict scene schema now offers **17** optional styles
(previously five), alongside the four existing fallback primitives:

| Use | Application-owned illustrations |
| --- | --- |
| Electronics | housing, chip, sensor, indicator, battery, coil |
| Mechanisms | gear, piston, turbine |
| Fluids and optics | pipe, vessel, lens |
| Cell / molecular explanation | membrane, nucleus, helix |
| Sound and causal motion | speaker, marker |

These are fixed illustrative meshes. Muse chooses semantically appropriate
parts, positions, dimensions, connections and step poses; it does not generate
arbitrary mesh code. A membrane is a cell illustration, a helix is a schematic
DNA-style ladder, and a coil is a winding. Counts of gear teeth, blades and rungs,
fluid fill level, construction and finishes are never source measurements or
scientific simulations. The author instructions require source fit, use of null
for unrelated concepts, and explicit assumptions for inferred geometry.
Existing bounded object/pose limits, review, ownership and source rules remain.
No new dependency, external mesh/texture service, or generated executable code.

Polish passes:

1. Distinct part silhouettes with purposeful detail: open pipe bore, exposed
   piston/rod, windings, gear hub, turbine blades, optical lens, speaker cone,
   translucent vessel and membrane, nucleus cutaway and paired helix strands.
2. Camera distance fits assembly bounds in camera space at the current aspect
   ratio, including explicit isolation. Labels wrap instead of truncating;
   callout placement considers both sides/rows and measured label height, with
   collision-free priority for the selected/highlighted object. Dense scenes
   retain the full accessible object list when not every callout fits.
3. Camera presets visibly announce their active state. Wording covers all
   component domains. Zero-length animated connections hide their arrows as
   well as their line. Existing bounded motion/reduced-motion behavior remains.

New geometry, framing and label-layout tests passed;
full offline suite: 1,591 passed / 94 opt-in skipped. An initial full run's 48
HTTP tests failed because sandbox policy denied localhost socket binding; the
same suite passed with local socket access. The first expanded author prompt
exceeded the real provider instruction limit; condensed spatial guidance retains
the invariants and leaves tested follow-up instructions below 7,800 characters.
Three service revisions exercise every new style through review, save/reopen and
immutable-original checks with a scripted author and the real request encoder.
This is contract evidence, not fresh Muse inference. PM103's daily guest cap
blocked the last live attempt; no limit bypass, reset or new provider call here.
Further visual inspection added solid-part silhouette avoidance to the label
layout, aligned callout leaders with actual mesh surfaces, tightened shadow
framing, turned cell cutaways toward the initial camera, and gave the helix
contrasting strands. The 20 geometry/layout cases passed again after asset fixes.

Native Chrome on the user's Mac restored the prior saved experiment (processor,
step 2, spread 0.55, slice 0.2). Above/perspective presets visibly updated their
pressed state; keyboard separation and isolation worked. Final close-up and
assembled views verified clear part silhouettes and the corrected leader anchor.
One macOS capture interruption recovered via a fresh accessibility read. The app
is left assembled at `http://localhost:41900/explore`; the unsaved reset preserves
the previous saved test state. The server has live inference disabled.

The final exact-build production browser run passed **148/148** cases. Tests include all 17 styles in synthetic rendering studies at
1440/620/375 widths, wrapped labels, isolation, old recorded Muse outputs, real
local persistence, WebGL recovery/disposal, keyboard and reduced motion. These
component studies are hand-authored test fixtures, not new model output. The
first run passed 145 cases but three account-switch checks correctly refused
sign-in because the isolated build lacked the synthetic public auth key. Rebuilt
with that test key and reran; no production credential or auth behavior changed.
The first sandboxed Next build stalled; stopped only its verified local process
and rebuilt with local worker permissions. Original failure logs are retained.

Production build/TypeScript and isolated browser trace passed: 1,224 files,
two links, zero private-configuration mappings. Root and isolated source match
253-file manifest `24d1a1c0e6f8e4d0655d84473e0c25d127cf9efaccf6472fb5915d35b28a7839`,
release `soma-pm106-spatial-2026-10-30`. Private receipts are in `.local/pm106/`.
No merge to main, push, deployment, publication or fresh live-Muse claim.

## PM108 — Anatomy comparison

The user authorized an Anatomy-backed isometric alternative and shared cumulative testing cap of $20 on October 30. Current Three.js remains available. [Comparison scope, implementation, tradeoffs and executed verification](ANATOMY_COMPARISON.md) distinguishes prepared examples, retained Muse-output replay and fresh inference. This does not establish a feature merge or visual acceptance.
