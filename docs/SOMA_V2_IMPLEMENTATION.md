# Visual exploration implementation

Current implementation map, November 4, 2026. [PRD](PRD.md) owns scope; [architecture](ARCHITECTURE.md) explains execution; [verification](VERIFICATION.md) records executed checks.

## Journey and ownership

| Layer | Responsibility | Entry points |
| --- | --- | --- |
| Browser experience | Capture/upload, journal, controls, follow-up, save/reopen | `src/app/explore`, `src/components/exploration-*` |
| HTTP boundary | Session ownership, action validation, bounded requests | `src/app/api/explore` |
| Orchestration | Interpret, solve, select, compose, review and publish under shared limits | `src/lib/server/exploration.ts` |
| Model access | Typed Meta requests, usage and provider failures | `src/lib/server/meta.ts` |
| Deterministic domain | Graph/circuit computation, interventions and immutable typed specifications | `src/lib/domain` |
| Persistence | Owned revisions, actual assistance and version checks | `src/lib/server/exploration-store.ts` |
| Native companion | Explicit capture, cursor trail, freshness gates, drawing and lifts | `desktop` |
| Isolated services | Optional browser, credential and transcription workers | `services` |

Source filenames are authoritative; use `rg --files` to locate the specific renderer, solver or contract before changing it.

## Runtime contracts

Spark reads source pixels into bounded typed data. Soma computes on that reading. Wonder can check the original image and review the explanation, with actual outcomes retained. A skipped check is never displayed as approval. Numerical checks establish the interpreted model’s consequences, not arbitrary prose accuracy.

The graph and ideal DC circuit families are checked. General diagrams and authored mechanisms are explanation-only. The built-in engine is illustrative and uses application-owned geometry/mechanics with Muse-selected placement and teaching poses. No model-generated executable code runs.

Follow-ups preserve current controls and source bindings. Saved revisions retain interpreted data rather than private pixels. Actual model recordings remain immutable; deterministic replay alignment is separate presentation data. Optional graph practice retains its answer/assistance history rather than inventing a mastery score.

## Native integration

Companion 0.5.0 includes graph, circuit and illustrative-model lifts. Source drawing is fenced by capture identity, ownership and freshness. Capture clears/excludes existing Soma drawing; a changed slide invalidates its overlay. Pending first-draw delivery waits for renderer readiness and is discarded on cancellation or replacement. The hosted renderer receives a restricted preload bridge, not general Node access.

See [desktop setup](DESKTOP.md), [Point & ask](POINT_AND_ASK.md) and the exact [release verification](VERIFICATION.md). Browser tests, native controller/renderer tests and actual-device acceptance remain separate.

## Verification and maintenance

Use the commands in [local setup](LOCAL_SETUP.md). Tests cover independent numerical references, state preservation, ownership, prompt-injection boundaries, budget reservations, cancellation, stale publication and accessible browser journeys. Provider tests are opt-in. Regenerate and verify `public/release.json` after runtime changes; compare it with the hosted manifest separately. Preserve the existing course routes and their data contracts while working on `/explore`.
