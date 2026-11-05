# Verification

Executed evidence, November 4, 2026. Source tests, actual provider runs, browser rendering, native-device behavior and distribution checks are separate evidence. A passed synthetic test does not establish real capture permissions, audio quality or learning benefit.

## Companion 0.5.0 distribution

[0.5.0 is public and Latest](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0), not a draft/prerelease. Its immutable tag targets `1305844ad25e4b2758053c24ff62c62afa889772`. The final archive is Developer ID signed, Apple-notarized and stapled; deep strict code-sign verification, Gatekeeper and extracted-ZIP round-trip verification passed.

| Item | Verified value |
| --- | --- |
| Platform | Apple Silicon, macOS 14.2+ (native helpers’ deployment target) |
| ZIP bytes | 121,436,184 |
| ZIP SHA-256 | `648b144e722d1501072f1d9241bd097dabade424777efbc13c4f53d6dad107fd` |
| Apple notarization | `450b2d47-2267-4a6c-8eca-1f449ee98c5a` — Accepted |
| Release runtime manifest | `soma-rehearsal-polish-2026-11-04` |
| Release source-tree SHA-256 | `e215b5512843545697d6544cb61ddabcac9a4673a6d7994ab8313e9ecf36e7fb` |

The release manifest covers 318 runtime/public files. All 86 desktop tests passed before packaging. The package audit matched 37 runtime source files byte-for-byte and separately checked installed package metadata after expected removal of development-only fields. The targeted private-path/configured-secret scan found no matches. GitHub’s uploaded-asset digest and an anonymous full download matched the ZIP checksum.

A checksum-pinned [release-transfer workflow](https://github.com/Jeremiah-Sakuda/soma/actions/runs/41936315365) reconstructed the identical notarized ZIP when direct upload was throttled. Signing keys stayed on the Mac; the temporary transfer asset was removed. Main may receive later documentation, formatting or dependency maintenance; it is not a replacement signature or notarization for this immutable download.

## Automated verification

The final local maintenance checks completed on November 4 (US time), November 5 UTC. Default tests use synthetic sources and provider doubles; paid/provider/device checks remain explicitly gated.

| Check | Executed result |
| --- | --- |
| Application suite | 2,028 passed; 107 opt-in/environment-gated cases skipped |
| Desktop policies/controllers | 86 passed, no skips |
| Relay and credential diagnostic contracts | 7 passed |
| Adversarial credential Chromium suite | 28 passed on synthetic hostile pages |
| Full browser suite | 207 passed; 14 gated cases skipped; no retries |
| Spatial/native 3D follow-up | 37 passed after the shadow API cleanup; no removed-shadow warnings |
| Types, formatting and production build | Passed |
| Isolated production trace | 1,224 files, two package links, zero private-configuration mappings; import passed |
| Fresh installation and local arm64 package | Passed with updated transitive dependencies; this local package is not the signed download |
| Dependency audit | Zero reported advisories in the application, desktop tools and all three isolated service lockfiles |
| Public local documentation links | All targets resolve to retained public files |

The full browser suite exposed a removed `PCFSoftShadowMap` setting. Three already substituted `PCFShadowMap`; selecting that supported setting explicitly removes the warning. The 37 affected spatial/native cases were rerun afterward, along with build, types, formatting, trace and manifest checks. The renamed engine-provenance test also passed all five cases.

The handwritten source diff was compared against pinned formatter output. The shadow setting is the one intentional rendering-code cleanup; no solver, orchestration or prompt behavior was rewritten. Metadata-only receipt cleanup removes private artifact locations without changing recorded model responses. The targeted secret-value comparison found no tracked matches; pattern-scan findings in the current tree and existing main history were classified as generated file digests or an explicitly synthetic test capability. This does not certify the absence of every possible private datum.

Current source manifest: `soma-source-polish-2026-11-04`, 318 runtime/public files, source-tree SHA-256 `ba3306a2b89ea122754b5c425596b0db26682c8f73d2191ffc912942ac3c4f10`. It differs from the immutable notarized release tag because of source formatting and dependency maintenance. Compare hosted `/release.json` separately before claiming deployment parity.

```sh
npm run format:check
node scripts/verify-release.mjs
npm run typecheck
npm test
node --test desktop/test/*.test.cjs
node --test services/voice-runner/test/*.test.mjs
node --test scripts/check-credential-service.test.mjs
npm run build
npm run check:browser-artifact
npm run test:e2e
```

Every push runs [the complete CI workflow](https://github.com/Jeremiah-Sakuda/soma/actions/workflows/ci.yml), including the complete browser suite. Earlier [full CI](https://github.com/Jeremiah-Sakuda/soma/actions/runs/41910292073) passed the runtime used for the released companion. CI retains failed browser attempts even when retries pass. The artifact trace checks isolated production imports and private-configuration mappings; it is not a comprehensive security review.

## Source and model evidence

[Source evaluation](GENERAL_SCREENSHOT_VALIDATION.md) reports methods, exact supported-source checks, first failures and repeats. Frozen fixtures include 13 original graph images and 6 original circuit images across two sets, plus unsupported cases and three third-party figures. The classic Dijkstra figure has a strict-label mismatch despite the correct route/cost; do not call it an exact-label pass.

[Actual recorded graph/circuit runs](../src/lib/fixtures/RECORDINGS.md) preserve original model output, uncertainty, usage and generation receipts. Separate deterministic replay alignment is presentation data. Opening a recording makes no inference; follow-up questions can make live calls. Later matching output is not substituted for an earlier failed attempt.

Native rehearsal verified first flat circuit drawing after a renderer-readiness fix, graph cut/restore, engine/circuit lift transitions and panel-controlled changes mirrored into the lift. Renderer/controller tests separately cover stale sources, ownership, small-value precision, repeated/interrupted lifts and GPU recovery. These do not establish every physical gesture or performance on other hardware.

## Retained defects and limits

- Explanatory follow-ups once restored defaults or failed after removing a probed edge/goal. Application-owned bindings and unavailable-probe handling now have service/browser regressions.
- Undirected arrowheads/reverse-path highlighting and explicit-BFS animation selection had defects; semantic rendering regressions cover them.
- New native overlays once dropped their first draw before renderer readiness. Delivery now waits for readiness, keeps only the latest valid draw and clears pending work on cancellation/failure.
- Capture once included Soma’s own drawing; capture/source re-check paths now clear or exclude it. This is distinct from clean-Mac permission acceptance.
- Earlier repeated-lift CI exceeded a 30-second test limit under software WebGL; the unchanged stress sequence passed under a scoped 90-second limit. This does not establish hardware frame rate.
- Source/general-generation failures, contract repairs, the undefined Firestore layout-field defect and provider timeouts remain described in the evaluation record. Successful repeats do not erase them.

No learning-improvement, adoption or general accuracy rate is established. Clean-Mac installation, physical permission/shortcut acceptance, multi-display/fullscreen behavior and audible narration quality remain separate human checks. No new inference or audio playback is part of this final source audit.
