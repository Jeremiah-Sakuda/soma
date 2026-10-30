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
