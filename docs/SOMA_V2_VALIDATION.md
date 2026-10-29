# Soma v2 verification record

October 29, 2026. Executed checks for P084. Synthetic fixtures are original project material; they are not the owner’s coursework or learner evidence.

## Actual Spark image and tool evaluation

Ten fixed screenshots passed extracted node/edge/direction/start/goal/order and independently calculated path checks. They cover the cases below. The first two were also used to diagnose provider compatibility before the final run; the remaining eight were not part of those debugging calls. These are clean authored worksheets, not a benchmark of messy real slides, handwriting, OCR, educational efficacy or arbitrary topics.

| Original case | Source + path | Calls | Reported cost | Wall time |
| --- | --- | ---: | ---: | ---: |
| diamond | Passed | 2 | $0.024265 | 7.7s |
| directed-cycle | Passed | 2 | $0.024186 | 8.9s |
| disconnected | Passed | 2 | $0.022794 | 8.5s |
| start-goal | Passed | 2 | $0.021881 | 8.1s |
| direction-detour | Passed | 2 | $0.023703 | 7.6s |
| reversed-tie | Passed | 2 | $0.023823 | 7.3s |
| shortest-branch | Passed | 2 | $0.025453 | 8.0s |
| no-edges | Passed | 2 | $0.020441 | 5.9s |
| undirected-cycle | Passed | 2 | $0.024657 | 8.1s |
| full-traversal | Passed | 2 | $0.024001 | 8.2s |
| contextual-followup | Initial narrower follow-up check | 2 | $0.032872 | 12.0s |

The final ten-image run plus its comparison used $0.268077 reported provider usage. Each used two Spark calls. Source scenes varied in panel composition; the follow-up changed from diagram/sidebar to two-graph comparison. A preceding pilot used three calls for two turns with one validated repair each. These are actual provider calls, not replay or provider doubles.

Checks certify the proposed BFS model, source-reference bindings and scene structure. They do not certify every generated caption. Manual inspection of a comparison found that the model also swapped the goal when only a start change was requested. The follow-up test was strengthened, generation guidance tightened, and canonical per-graph configuration made visible. An additional actual run passed: selected start A replaced S while goal G, edges, direction and neighbor order remained unchanged; a manually inspected generated explanation correctly contrasted the two queue traces. Its follow-up cost $0.0308065 across two calls (10.7s). The earlier narrower assertion is not treated as full intent correctness.

## Failures retained and corrected

The first authored image accidentally drew collinear nodes, making a text/drawing conflict. Spark reported uncertainty; the fixture geometry was corrected. An uncertain extraction also returned the string `"null"` instead of a JSON null. The exact string null now normalizes to null only for this nullable extraction field; four other string forms remain rejected. This cannot grant a checked graph. The live composition request exposed Meta’s rejection of nested `oneOf`; tool schemas now use `anyOf` while the same strict application validator remains authoritative. Unknown post-send usage retains its full reservation.

At $2.6518575 consumed, the $3 cap could not admit another $0.35 reservation. P084’s conditional authorization was applied: local and production total testing caps are $5, with no reset of the shared ledger and the $150 allocation’s 20-percent reserve intact. Reported usage and reserved/unknown usage are distinct. Final total ledger usage will be recorded after hosted verification.

## Other verification

- Root independently reran 44 domain checks, 20 existing/new Meta-boundary checks, eight existing/new budget checks, 46 exploration service/HTTP/managed-storage contract checks, and 34 voice format/service/HTTP checks.
- The earlier complete working-tree suite passed 1,309 tests (88 skipped); the final working-tree run passed 1,324 tests (90 skipped). Exact committed release checks remain a separate gate.
- Browser journeys exercise actual deterministic controls/save/resume. Provider doubles are labeled; they do not establish live inference.
- Native Chromium MediaRecorder → decode/downmix/resample → canonical WAV passed with original synthetic audio and a mocked transcription response.
- The actual Muse ASR endpoint accepted a one-second original silent WAV and produced the application’s expected `no_speech` state. This verifies the multipart/format boundary, not speech recognition accuracy.
- Root inspected 1440px and 375px screenshots. Keyboard/reduced-motion/native permission and production journey status will be recorded at release.

## Remaining gates

Human-selected OS capture, real microphone permission/word accuracy/audible playback, and source fit on the owner’s actual material are separate checks. Current checked computation is small unweighted BFS only. Explanation-only visuals never receive a checked-computation badge. No v1 bridge is claimed implemented; see [SOMA_V2_V1_BRIDGES.md](SOMA_V2_V1_BRIDGES.md).

## Additional actual assurance tests

An original HTTP request-process screenshot produced an explanation-only diagram (three calls, $0.03935225, 11.9s). A screenshot with no visible graph produced clarification with no execution (three calls, $0.032404, 7.2s). These passed after the narrow null compatibility fix; the initial failed request is retained as a failure. They establish those two paths, not coverage of arbitrary visual domains.

## Integrated review and local release checks

Independent reviews and regressions fixed cancellation before registration, late-resume and stale-save overwrites, capture permission/unmount races, exact older-version access, comparison traces longer than the primary, missing extraction uncertainty, initial cookie establishment, recoverable session capacity, cancelled-run billing facts and voice account revocation during cleanup. Guest TTL was verified ACTIVE; physical deletion is asynchronous.

The full Chromium browser suite passed **84 journeys**, including 15 new exploration and six voice journeys, preserved v1 account/credential flows, phone layout, keyboard and reduced motion. Screenshot review covered 1440px and 375px. Voice native codec uses synthetic audio and a provider double; the separate actual ASR no-speech test is identified above.

TypeScript passed. This host denied Turbopack’s subprocess port twice with `Operation not permitted`; Next’s supported webpack production build passed, and the isolated browser artifact trace check passed (1,339 traced files, no private configuration mappings). Default compiler verification will come from CI/hosted deployment; do not describe the failed local default builds as passing.
