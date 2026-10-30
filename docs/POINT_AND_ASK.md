> **October 30 — PM080 current distribution:** [Soma 0.3.0](https://github.com/Jeremiah-Sakuda/soma-hackathon/releases/tag/v0.3.0) is now signed, Apple-notarized, stapled and Gatekeeper-accepted. The published asset SHA-256 matches the local archive: `cfdfffa47c0594ef433467011ce9a96595d295739a274f25f772193bbb1f3e87`. Local stapled copy: `.local/pm080/Soma.app`. Earlier pending-notarization statements below are historical. Streaming relay activation remains pending; this notarization does not enable it.

# Point & ask — explicit native context

Soma can take a spoken question and a pointer selection from the same interaction. Enable **Point & ask** in the macOS toolbar, hold **Control–Option–Space**, circle or point at the relevant content while speaking, then release. A local cursor trail makes the selection visible immediately. Soma captures the display under that gesture on release, transcribes the question, and submits the image and normalized selection together to the existing visual engine. The panel opens on the opposite side of the selected area when space permits. Existing snapshot, upload, typed question, follow-up and save paths remain available.

This is an explicit session, not an always-on video stream. The microphone may need a moment to become ready; the overlay changes from **Preparing microphone** to **Listening**. The hold is bounded to 30 seconds. Escape, Hide, turning the mode off, changing source, microphone errors or starting another hold cancel stale work. A completed replacement visual replaces the old card only when ready. Generation is asynchronous; the cursor feedback is immediate, model output is not.

## Data and authority

- An independently written native helper registers only the reserved press/release shortcut. It does not collect keyboard text or request general Input Monitoring.
- Pointer locations are sampled locally during the hold. A closed gesture produces a bounding region; otherwise the final point gets a small selection box. Crossing displays cancels. Coordinates are normalized against the captured display, including negative display origins.
- Only the selected region, kind and snapshot time enter source provenance. No raw trajectory is sent or persisted. Raw screenshot/audio retention follows the existing transient source rules.
- Focus helps Spark resolve “this” or “that”; it is not a source fact or learning evidence. The full snapshot can still contain private content: use this only on material you intend to send to the model.
- The screenshot is current at release. If the page scrolls or changes during the gesture, the earlier circle is not semantically tracked. Start another hold after the content settles.
- Bounded typed composition, deterministic supported BFS/Dijkstra calculations, advisory Wonder review, source/version history, ownership, spend limits and assistance records remain unchanged. Other subjects remain explanation-only.

## Verification and limits — October 30

The shortcut helper compiled and actually reserved/released its chord in a ready-only probe. Thirteen desktop policy/geometry/lifecycle checks passed. The real Electron window, transparent overlay, preload bridge, recorder coordination and rendered-result journey passed with explicitly synthetic pixels/audio/helper events and a replay of a genuine model response. These checks do not establish physical shortcut operation, OS capture permission, real microphone quality, fullscreen/multi-monitor use or clean-Mac installation.

Two fresh provider requests used the same original screenshot and question, changing only the selected region. Spark traced the selected left program as **7 → 9 → 11** and the selected right program as **11 → 14 → 17**; both passed Wonder review and exact focus save/reopen checks. HTTP waits were about **14.2 and 16.5 seconds**, total **$0.0663715**. The first UI wait in that harness used a nonexistent history selector and timed out after the successful API/persistence checks; the actual response was subsequently rendered in the native replay without another generation. This two-case development check is not a general accuracy rate or a learning outcome.

The signed **0.2.0** native bundle includes the helper. Its notarization is blocked by a missing local `soma-notary` Keychain profile; the existing published 0.1.0 notarized bundle does not include Point & ask. Do not describe the new bundle as notarized until Apple accepts it and staple/Gatekeeper checks pass.


## PM077 release checkpoint — October 30

Public code **be83c63c0f031495256c5e38699863c4be312ab3**, clean CI [41071744426](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41071744426): **1,401 offline passes / 89 opt-in skipped**, **13 desktop checks**, **28 isolated credential-browser checks**, and **123 browser journeys**. Final typecheck, production build, source-manifest verification and isolated runtime import passed.

Production deployment **dpl_7iqYXQRwyUPUGKP2tptkRxJ6XgN3** serves `soma-pm077-2026-10-30`; its complete 214-file runtime manifest matches committed source, fingerprint `f228f56827a1ab7dd28bf0246ba555c5fdac9f6ede0ee738a17870318a70f20a`. The first deployment attempt returned Not authorized; explicitly selecting the verified owner scope/project succeeded. A final actual Electron-to-production bridge/render/hide check passed with synthetic screen/audio/helper events and replayed actual model output, making no new model calls. The first hosted harness incorrectly passed production as a development override and was stopped; the successful run uses the app's fixed production origin.

0.2.0 is Developer ID signed and deep/strict verified, including the shortcut helper. Its app archive contains 27 entries and no compiler cache. Apple notarization remains blocked by the missing local `soma-notary` profile; no new notarized download is claimed. Physical hold/release, microphone quality, capture permission, fullscreen/multi-monitor and clean-Mac installation remain human checks.


## Grounded source interaction — October 30 (PM078)

The existing visual engine now links explanation steps to up to six model-located regions on the captured source. **See on source** reveals the actual source image and selected regions. In the 0.3.0 native shell, **Point on screen** draws a transient source reference only after a local fresh capture exactly matches the frozen screen. A changed screen gets no live marker; use the captured preview or recapture. It never moves/clicks the real cursor. Native capture reuse expires after two minutes; Escape/hide/new hold cancel the overlay. Locations remain fallible model interpretations. The 0.2.0 shell retains basic Point & ask but cannot draw these new references.

A subsequent native capture can carry the preceding in-memory image into a comparison. Browser uploads use **Compare next upload or snapshot with this capture**. The service accepts an earlier image only when its hash matches the exact owned prior artifact/source, then records source-change interpretation and lineage in a new version. Previous versions remain immutable. **Compare captures** shows both transient images in the current session; raw images are not saved and will be unavailable after reload. Changing frame/context explicitly differs from editing checked solver controls.

Spark may request one **request_source_detail** crop of the current frozen image. Explicit questions beginning “Take a closer look”, “Zoom in” or “Enlarge” require that region-selection step; ordinary interpretation can optionally request it. The application decodes/crops only the validated inline image (at most 1600×1600 / 512 KiB), never hidden content, a new screen or external URLs. The model chooses the region; all coordinates remain relative to the complete current image. At most one crop and six total model calls, a 90-second run deadline and the existing $0.35 reservation bound the turn. No new checked subject or arbitrary generated code.

Generic diagram connectors now route around cards and their animated signals follow those routes. Layout coordinates are not scientific measurements. A new result/reopened version brings its heading into view; unchanged controls do not scroll the page. Source overlays are translucent and inspectors remain optional.

### Streaming speech status

Muse Voice Transcribe streaming is implemented through an isolated WebSocket relay. It accepts a one-use, 60-second Soma ticket, forwards at most 30 seconds of 24 kHz PCM, streams partials and returns a final transcript only after the application confirms the session is still authorized. The model key stays on the relay. Tickets carry no audio, transcript, browser session or provider credential. Their metadata expires after one day; API expiry/replay checks are immediate. Each admitted stream retains a conservative $0.01 allowance against the unchanged shared budget, not a claim about provider billing.

The UI advertises streaming only when the backend is configured; otherwise it uses existing recorded-question transcription directly. Actual AudioWorklet PCM, the isolated relay protocol, one-use/owner/expiry checks, and real Meta WebSocket transcription of a 4.58-second original synthesized question passed locally. These do not establish real microphone quality. **Cloud enablement is pending specific approval for a runtime account, two server-only secrets, scoped secret access and the ticket-protected service. No cloud relay has been provisioned.**

0.3.0 local distribution is signed but not notarized; the missing `soma-notary` profile remains a separate gate. No new downloadable notarized release is claimed.


PM078 verification: 1,412 offline passes/89 opt-in skips, 126 browser passes, 14 desktop and three relay passes; final numbered source markers passed all seven affected journeys. Eight-subject actual-model testing, original failures and narrower recovery are recorded in the general-screenshot validation report. Signed 0.3.0 is local only; cloud streaming and notarization are not established by those tests.


### PM078 published verification — October 30

Runtime source: [be62bdca061251851346ec6d9468901bd5e47df5](https://github.com/Jeremiah-Sakuda/soma-hackathon/commit/be62bdca061251851346ec6d9468901bd5e47df5). [Clean CI 41089794472](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41089794472) passed unit/type/build/trace, 14 desktop tests, three relay tests, 28 isolated adversarial browser cases and all 126 browser journeys. The complete local unit result is 1,412 passes/89 opt-in skips; CI also passed that suite.

Production https://soma-woad-beta.vercel.app/explore is deployment `dpl_6qeBzywPSDaKKChCA1UC1hUgCYvW`. The exact committed/public/production runtime manifest matches: `soma-pm078-2026-10-30`, 228 files, SHA-256 `0d0cf1d45b7ca39077e9ded9f4c039b4936a7bcb64bc05a1f95a0f778f978f7c`. Hosted guest creation, prepared weighted experiment, exact save/reopen, companion/phone rendering, explicit reopen after reload and microphone policy passed without inference; own test records were removed. The first smoke harness expected a false capability field instead of its intentionally absent disabled form; the second omitted the explicit saved-card reopen action after reload. Both harness failures are retained; the stage-aware corrected run passed with zero page exceptions.

No relay provisioned: streaming capability is absent in production, so recorded input remains the normal path. Local signed 0.3.0 passed normal macOS deep/strict signature verification in both original and copied bundles (all file bytes matched); a restricted-environment verification gave an inconsistent invalid-signature result, retained separately. Notarization/physical native capture and audible-device checks remain outstanding. Total measured shared testing ledger is $8.440255/$15.


## PM080 — Visible generation stages and recovery

Generation now reports actual reading, closer-reading, composition, validation, review, repair and publication phases through a bounded stream. It does not stream unchecked scene content or invent percentages. The last visual remains usable; changing its controls cancels the pending replacement. Cancel prevents an observed form-resubmission race. A broken connection preserves the draft and last visual with a retry message. Source/review contract repairs reuse the same pixels/candidate within the original total bounds. New scenes use strict JSON configuration; the factual critic accepts an actual function result or validated JSON, not unconstrained prose. Full test results, failed experiments and measured waits are in the general-screenshot validation record.


### PM080 confirmed release — October 30

Runtime source [24ec4b5](https://github.com/Jeremiah-Sakuda/soma-hackathon/commit/24ec4b5a40cbad11281fe3dbb3de5b4b7cca874f) passed [clean CI 41105115334](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41105115334), including all 129 browser journeys and 28 isolated credential-browser cases. The runtime manifest is `soma-pm080-2026-10-30`, 230 files, SHA-256 `a114e800f3843d500d45012175c21563a11c10f0abbd7110625d356c2d3d3716`. Production https://soma-woad-beta.vercel.app/explore serves deployment `dpl_7vRxLFctVqbS9LC3WgkJPQZjG561` from that exact committed runtime. Later documentation commits do not alter the runtime fingerprint.

An actual hosted upload using a frozen public Python page showed its first application phase at 1.702s and completed in 18.644s: three real Spark/Wonder calls, $0.0337535. Reading, composition, validation, review and saving were observed through the real response stream. Exact save/reload/reopen, 375px layout and zero page exceptions passed; synthetic guest records were removed. A first hosted harness could not retrieve the consumed stream through DevTools; its interrupted observation and cleanup are retained separately. The corrected observer cloned the real response without replacing or stubbing inference. These are individual development observations, not guaranteed latency or reliability.

[Soma 0.3.0 for Apple Silicon](https://github.com/Jeremiah-Sakuda/soma-hackathon/releases/download/v0.3.0/Soma-macOS-arm64.zip) is Developer ID signed, Apple-notarized, stapled and Gatekeeper-accepted. Published archive SHA-256 `cfdfffa47c0594ef433467011ce9a96595d295739a274f25f772193bbb1f3e87`, 121,155,342 bytes. This supersedes earlier pending-notarization statements. Native source remains be62bdc; the shell loads the current hosted engine. Physical shortcut/capture/audio and clean-Mac installation remain untested. Cloud streaming relay activation is still separate and pending; recorded input remains available. Last-read shared lifetime ledger: $12.09191425 of $15 at 2026-10-30T18:26:31.411Z, including retained earlier use/reservations; no reset or training spend.
