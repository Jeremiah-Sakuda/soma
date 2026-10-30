# Spatial exploration — PM096

October 30, 2026. Authorized experimental branch: `codex/spatial-exploration`, in original private `Jeremiah-Sakuda/soma`. This is a branch implementation, not a production release or change to the October 31 freeze.

## Deliverable

An end-to-end spatial workspace inside the existing exploration: selected source → Muse-authored bounded 3D schematic → inspect/explode/slice/isolate/step → contextual follow-up → saved version. Existing checked BFS/Dijkstra scenes gain a spatial view driven by the same solver. General spatial scenes remain explicitly explanatory; no optics, biology or mechanical numerical model is added.

The application owns geometry primitives, camera limits, rendering, object selection, local presentation controls and checks. Muse may author bounded spatial objects and per-step poses, tied to stable IDs, and revise the explanation. No generated JavaScript, shaders, HTML, remote meshes or arbitrary physics. A source image cannot establish hidden geometry; the UI labels spatial schematics as abstractions.

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

## Verification

Pending implementation and executed checks.
