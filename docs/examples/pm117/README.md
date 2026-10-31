# Actual Muse before/after examples — PM117

**October 31, PM118:** The current gallery includes a fresh Muse piston correction: shorter travel avoids the base, and the rod touches the head and grip. The original After recording is retained in `piston-original-after.json`. Direct slider dragging no longer eases behind input, and markers follow moving parts. See [the correction and verification record](../../ANATOMY_SLIDER_FIX.md). The generation/results paragraphs below record the original PM117 run; the correction added $0.04767325, bringing cumulative spending to $15.30956725/$20.

Open **[the local comparison gallery](http://localhost:41908)**. The three tabs contain matched original-synthetic source images and actual Muse outputs:

| Example | Before: fixed parts | After: authored geometry |
| --- | --- | --- |
| Hinged gate | Catalog frame/handle choices and shifted whole-part poses approximate a hinge. | Six authored shapes; gate and handle rotate around the same pivot. Reuses the accepted PM113 after-output. |
| Sliding piston | Repeated housing assemblies, a piston preset and primitive parts. | A constructed open guide, head, rod and grip, with one coupled translation control. |
| Three-blade rotor | Complete turbine presets were used for individual blades, producing a source mismatch. This raw output is retained and flagged. | Three individual tapered blades and hub turn as a rigid group; axle and support remain fixed. |

The source image and renderer are held constant within each pair. Outputs were generated independently with contract-specific instructions; this is a visual development comparison, not a controlled quality benchmark. Both variants use the current Anatomy or Three renderer and common camera controls, fitted separately to their bounds. Source images, original prompts, source uncertainty, captions, assumptions, generation usage/timing and advisory review audits are preserved in `comparisons.json`. Only the spatial panel is displayed in the viewer. Geometry and movement remain illustrative, not checked physics or independent-understanding evidence.

Before used the verified PM108 catalog runtime, SHA `d4b232df147e8b1f680aa459bce2e155b006782fde44d228dcfbd95a13436925`, read without modification from the credential-free local snapshot. After used PM113, SHA `2453777e926c3ed1084f131541e9388d337673e9ddb0501ee56e791d36ac436d`. No diagrams were replaced by hand-drawn “better” outputs. Known flaws in the old outputs are not proof that every new generation will be better. Advisory review did not catch every visible mismatch in the old catalog geometry.

## Generation and budget

Five new accepted outputs were generated and saved/reopened through the actual Firestore service. The gate after-output is the earlier accepted PM113 recording, accurately labeled as reused. One initial rotor after-generation failed to publish after an application repair; its known usage remains charged. A fresh second attempt succeeded. `generation-results.json` retains every attempt and ledger observation. Each generation retained its normal call, wall-time, ownership, review and $0.35 reservation limits.

This request added **$0.32454525** to the shared ledger. At `2026-10-31T00:23:46.288Z` the total was **$15.261894 / $20**, leaving **$4.738106**. Prior usage and uncertain PM113 reservations were retained. No cap, allocation, reserve or admission limit changed.

## Verification and replay

- **Nine browser checks passed**: all three pairs in SVG and real WebGL, custom movement with an unchanged Before drawing, matching source-image bytes, keyboard controls, 375/620/1440 widths, deep links/Back and no-inference serving.
- **Three geometry checks passed**: both specifications validate; pairwise distances between representative moving vertices remain constant across five control values, while fixed supports stay fixed. The rotor has three authored blade pieces.
- TypeScript and the Vite production artifact build passed. The product runtime manifest remains unchanged at PM113's 263 files; the canonical app was not restyled or rebuilt for this gallery.
- In-app browser inspection exercised the actual gate control and switched among the generated comparisons. Paired screenshots were visually inspected.
- Static serving is restricted to the built gallery on loopback. GET/HEAD only, no API routes, no workspace-file serving, no provider credentials, and a CSP with `connect-src 'none'`. Replaying or manipulating examples makes no model calls. Required bundled notices are included.

Initial gallery test inputs used noncanonical `.9` range strings; these were corrected to `0.9`. A blade-count assertion initially also matched “Hub turns with blades”; it now counts the actual driven prism blade pieces. Those failed test receipts and the failed model generation remain under `.local/pm117/`. The build's client-directive warnings are expected for this all-client standalone artifact; the large Three chunk loads only when 3D is selected.

The viewer is already running for this review. To rebuild and serve it later from the canonical repository root, using the existing pinned dependencies:

```sh
node node_modules/vite/bin/vite.js build --config docs/examples/pm117/viewer/vite.config.mjs
node scripts/serve-mechanism-comparison.mjs
```

Detailed private run receipts: `.local/pm117/generation-r1.log`, `generation-results.json`, `geometry-checks-r2.log`, `gallery-tests-final.log`, `typecheck-final.log`, `gallery-build-final.log`, source files and paired screenshots. No main merge, push, deployment, publication or user visual acceptance is claimed.

Artifact commit: [b2430c8](https://github.com/Jeremiah-Sakuda/soma/commit/b2430c8).
