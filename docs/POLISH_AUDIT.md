# Usability and visual audit — October 30, 2026

Soma received a test-and-fix pass focused on what a person sees and can control, using the current exploration flow. This is engineering evidence, not a student trial, proof of learning improvement or a ranking prediction.

## Changes justified by observed behavior

- General diagrams previously faded every part to invisible at progress zero. They now keep the mechanism visible while narration loads. Only the highlighted causal connection receives a moving signal during playback; reduced motion keeps the static equivalent.
- Put general explanation navigation and its current narration above the visual; removed duplicate controls/captions. The primary diagram is prominent, with supporting panels and object controls in explicit disclosures. Manual exploration does not wait for voice.
- Use measured diagram width, full-label card height, collision-checked connection labels and a connection-list fallback when labels cannot fit. Crowded acyclic mechanisms read in causal order; cycles retain authored order. This changes rendering only, not stored semantic identities, connections or source claims.
- Compact desktop playback chrome and collapse the weighted inspector. Remove the inherited graph height cap from generated diagrams so phone text remains readable rather than shrinking to fit. Long scenes may require vertical scrolling.
- Extend the existing optional Wonder review to structured explanatory diagrams, matrices and sequences. A baseline gradient scene put a +0.75 update at the minimum, contradicting its own correct table. The author/reviewer contracts now explicitly check arrow destinations and intermediate states. Review is advisory, not an independent numerical solver.
- Bind new non-graph authoring to the ordinary diagram-sidebar grid instead of offering a stacked-layout choice with extra placement constraints. Existing stored valid scenes remain supported; publication validation is not relaxed.
- A reviewer transport/parse failure returns a recoverable review error, preserves the previous visual and does not spend another Spark author call. Cancellation retains its own status.

## Executed baseline and real-model checks

Five original synthetic screenshot sources and their answer keys were frozen before calls. Attention, gradient descent and a six-node weighted graph were development baselines; stack-machine and autoencoder screenshots were held out until after the initial fixes. Expected answers were used to inspect outputs, never provided as hidden prompt hints. Questions were topic-focused, so this is not an unbiased general screenshot benchmark.

| Input | First baseline result | First post-change result | Separate repeat |
| --- | --- | --- | --- |
| Attention scores and value mixing | Rejected; a baseline diagnostic repeat also rejected with stack_layout | Rejected | Published after bounded repair and Wonder approval, 4 calls |
| Two gradient-descent updates | Published with a misleading +0.75 arrow | Published, correct intermediate updates and arrow destinations, Wonder approved; 3 calls / 13.309s | Not repeated |
| Six-node weighted graph | Published; all eight undirected edge costs preserved; independent repeated-edge relaxation agrees with cost 4 versus BFS cost 12 | Presentation replay only | Not repeated |
| Stack machine (held out) | Not used | Published after one bounded application repair, Wonder approved; 4 calls / 19.631s; result 20 matches source | Not repeated |
| Autoencoder (held out) | Not used | Rejected | Published after bounded repair and Wonder approval; 4 calls / 20.215s; 64→8→64, reconstruction comparison and no class labels preserved |

First-request attention and autoencoder failures remain failures. The original post-change rejection causes were not recovered before their own sessions were cleaned. Successful repeats do not identify those earlier causes or establish reliable first-request behavior. All synthetic guest artifacts were removed. General explanations remain fallible and explanation-only.

## Experience verification

The first production audit checked widths 1440, 1024, 620, 420, 375 and 320; no horizontal page overflow, no sub-40px visible buttons and no obscured focus during a 45-tab native-panel walk. It found the wide graph below the first screen and oversized compact diagrams. New regressions initially reproduced missing visible-at-wait content and first-screen overflow. Harness-only selector/setup mistakes are retained separately from product failures.

The complete offline run passed 1,394 tests (89 opt-in skipped) before the final causal-order and review-cancellation assertions; all 62 affected tests then passed. The complete browser suite passed 116 journeys; the final causal-order/phone-label change then passed all 28 affected browser journeys. Typecheck, production build, four desktop policy checks and the isolated production browser trace passed. The trace imported 1,224 files, two links and zero private configuration mappings. The initial restricted unit run could not bind its synthetic HTTP servers; the network-enabled offline run passed.

Actual Gemini TTS returned audio/wav and played through a real Chromium HTMLAudioElement. Eight consecutive samples advanced audio from 0.208s to 1.286s and animation progress from 0.045 to 0.281. This verifies the audio clock drives visual progress; it does not establish word timing, speaker quality or audible playback on another Mac.

A real Electron shell with an isolated temporary profile passed hosted React loading, pin toggle, JPEG snapshot-to-preview/focus, hide/mute, activate/show/unmute, resize to a 620×704 content view, and sandbox/context isolation. No desktop capture, owner profile, global shortcut registration or private screen content was used. Initial native harness attempts selected the wrong window and supplied PNG to the JPEG-only bridge; the corrected contract check passed. The signed native shell itself is unchanged.

Final source identity, clean CI and hosted checks are recorded in VERIFICATION.md after publication. Shared consumed testing ledger after all provider and speech calls: $7.3758095 of the existing $15 allowance. Unknown/cancelled usage retains its reservation.

## Remaining release risks

First-request generation reliability remains the largest observed gap. A successful repair/repeat is not a substitute for that metric. General diagrams are still bounded explanatory compositions, not unrestricted generated simulations or the polished custom illustrations in the reference video. The checked graph experiment is the strongest dependable manipulation. Real student observations, finished demo footage, actual-device audible quality and clean-Mac permission testing remain separate human gates.
