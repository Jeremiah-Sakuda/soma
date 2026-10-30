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
