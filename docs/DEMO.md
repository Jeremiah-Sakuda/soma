# Soma demo operation

November 3, 2026 operation update. The story is students first, the capability second: the Lecture 14 graph slide, its checked consequences and 3D lift, followed by the Lecture 9 circuit. [DEMO_VIDEO_SCRIPT.md](DEMO_VIDEO_SCRIPT.md) owns the exact shot list, timing, conditional lines and measured values. This guide supplies entry paths and rehearsal operations; it does not establish captured footage. [Submission copy](SUBMISSION.md) · [Verification](VERIFICATION.md) · [Evidence and footage](SUBMISSION_EVIDENCE.md).

**November 4 UTC candidate:** the exact E investigation and circuit source-check/investigation/save path have passed real service checks. A fresh three-turn graph run also passed the source-preserving follow-up and exact save/reopen after the fix. The hosted app remains review6, so the candidate's new circuit image check, graph reset and recordings must not be described as deployed yet. Keep this distinction in each take's release receipt.

## The take

Follow the [current script](DEMO_VIDEO_SCRIPT.md#script-and-shot-plan), in this order:

1. **On camera:** the slide behind Jeremy, and the question it doesn't answer.
2. **Ask on the slide:** Preview full screen, hold ⌃⌥Space, circle the graph, ask "Why doesn't it just take the direct A-to-F edge?" The native overlay draws the checked search on the slide.
3. **Cut a connection:** click D–F on the slide. Route A → C → E → F, cost 9, no model call.
4. **Muse chooses, Soma computes:** restore D–F, ask "What would make the route go through E?" and choose **Investigate my question**. Read the connection and tie actually returned, then drag across it to send the route through E. The script lists four acceptable choices and their boundaries; do not assume a particular edge. If the investigation cannot answer it, use the script's A–F fallback question and label the take accordingly. Keep the changed cost active for the follow-up; restore source values before the 3D lift.
5. **Follow-up:** ask "Why does it flip right there?" The explanation must address the current experiment. Only attribute a Wonder review to this turn if its pipeline says it ran; an earlier catch uses the script's separate earlier-run label.
6. **Lift into 3D:** return to the slide's original values (the candidate provides **Back to the graph as read**) and use the panel's **Lift into 3D**. Hold on the settled view: F at 7 on the ruler, taut route, A–F slack 4.
7. **A second subject:** switch Preview to the Lecture 9 bridge slide and use the panel's Point & ask flow, ⌃⌥Space, with "Why is there no current through R5?" Check B = C = 8 V and R₅ = 0 A. Open R₂ on the slide: R₅ becomes 12/29 A ≈ 0.4138 A from B to C. Choose **Back to the circuit as read**, ask "When would current flow through R5, and which way?" and choose **Investigate my question**. The recorded hero choice is R₄, balance at 8 Ω; move it above and below that value and hold on the reversed arrow each time. Match the actual take to the script's checked facts.
8. **On camera:** the close and end card.

Save/reopen and **Try a fresh example** remain available for judge questions and the submission form; they are outside the current three-minute cut. Fresh practice is graph-only. The understanding map, course workspace, architecture and detailed repair history also stay outside the cut.

## Entry paths

**Native companion (the planned video's path):** use the signed, notarized [0.4.0 release](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.4.0), which includes the overlay, compact bar and 3D lift. Record its version and the hosted release identity from `public/release.json` with the take. Point & ask uses ⌃⌥Space once enabled in the toolbar. Keep both slides in the panel flow: the compact bar (⌥Space) hides the panel and has no slider. Dock the panel at the right edge so it does not cover the graph. Set up required OS permissions before the take.

**Browser (the judge path and fallback):** open [Explore](https://soma-woad-beta.vercel.app/explore) and choose **Try the Lecture 14 slide (live)**. Alternatively upload the [Lecture 14 slide](../public/examples/lecture-14-dijkstra.png) and ask the same question; the checked search is drawn over the uploaded capture. If the native overlay misaligns on a take, use **Share a window** on Preview and label that path. For an instant walkthrough, **Watch a recorded Muse run** opens a real earlier run with its original attribution and timing; new questions still use live generation.

**Circuit slide:** use **Try the Lecture 9 circuit slide (live)**, upload the [Lecture 9 bridge](../public/examples/lecture-9-bridge.png), or open `docs/examples/hero-circuit/Lecture-9-Bridge.pdf` in a second Preview window. The circuit investigation's slider is in the panel. A native implementation exists, but the full native circuit sequence remains a separate verification task until its actual result is recorded.

**Silent rehearsal:** type each question into the composer; the script's Point & ask path can use the typed question instead of the microphone. Keep product narration and playback muted. A silent run can verify capture, controls, overlays and typed follow-ups; it does not verify transcription or audible quality.

**Candidate recordings:** Source & sharing offers **Recorded graph** and **Recorded circuit**. These reopen actual November 4 UTC outputs: D–F/tie 5 for the exact E question, and R₄/balance 8 Ω for the R₅ question. Opening, manipulating and saving them needs no inference; new questions do. Keep the recorded label, original timing and cost visible. A separate, labeled drawing alignment places the marks on the original public slide without rewriting the recorded reading, uncertainty or model receipt. [Provenance](../src/lib/fixtures/RECORDINGS.md).

**Soma lab engine:** the hosted [lab page](https://soma-woad-beta.vercel.app/lab/engine/index.html). Actual recorded Muse source and investigation cases, with no runtime inference. It is not a live generation or cloud-save flow, and it is no longer in the video.

## Recording modes

- Fresh source generation: capture the actual result and wait. Shortened waits need actual elapsed-time labels.
- Genuine recorded Muse generation: keep its recorded label and original attribution. New follow-ups may still be live operations.
- Prepared examples: identify them as prepared, not as recorded model output.
- Lab illustrations: identify the recorded prototype and original synthetic source.
- Circuit beat: the Lecture 9 slide run live, its values checked against the script's list before it goes in the cut.
- Non-course diagrams stay potential unless an original map is run live and checked.

Use original synthetic material or a source with explicit sharing permission. Check source interpretation before relying on the computed result: model agreement can still be wrong. The candidate independently checks circuit images as well as graph images; hosted review6 predates the circuit image check. Wonder's explanation review is advisory. Preserve the earlier valid artifact on failure and use a recorded or prepared path with its label intact.

Recent hosted first-generation checks took 49 seconds for the graph and 45 seconds for the circuit; the latest circuit investigation took 32 seconds. These are individual measurements, not typical-latency claims. Local cuts and value changes recompute immediately after reading. Record each take's own waits and shorten only those waits in the edit, with visible actual-duration labels.

The last documented cumulative testing allowance is $40 (PM132), with prior consumption and reservations retained. Check the actual configured cap, ledger and admission before any live take; the script estimates $0.20–0.35 including the circuit investigation, not a fixed per-take promise. A documented budget is not permission to reset or increase it.

## Submission framing

Impact means plausible real-world potential, beneficiaries and significance. The student journeys on the two slides are the demonstrated evidence; reach beyond the classroom is stated as potential. Learner studies, adoption and quantified savings are optional additional evidence, not hackathon prerequisites.

The [verification record](VERIFICATION.md) separates service/browser/native checks. The exact unnamed-edge graph investigation is now verified on the current service; a later follow-up was correctly rejected for confusing the source graph and experiment, and the subsequent three-turn service run verified the fix, current controls and exact save/reopen. The full native circuit sequence, final edit, video upload, clean public judge access and submission receipt remain separate completion steps. The [script status](DEMO_VIDEO_SCRIPT.md#status) records these service receipts separately from native footage and final production. Use only [Jeremiah-Sakuda/soma](https://github.com/Jeremiah-Sakuda/soma); repository visibility changes only with user authorization. No new deployment or audio result follows from this document.
