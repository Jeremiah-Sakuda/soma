# Soma demo operation

November 1, 2026 positioning update. Supersedes the PM129 engine-led version (kept in git history). The story is students first, the capability second: one continuous live run on the Lecture 14 slide, then a short look at how far it reaches. [Story and positioning](STORY_AND_DEMO.md) · [Three-minute script](DEMO_VIDEO_SCRIPT.md) · [Submission copy](SUBMISSION.md) · [Evidence and footage](SUBMISSION_EVIDENCE.md).

## The take

The [script](DEMO_VIDEO_SCRIPT.md) owns timing and wording. In order:

1. **On camera:** the slide behind Jeremy, and the question it doesn't answer.
2. **Ask on the slide:** Preview full screen, hold ⌃⌥Space, circle the graph, ask "Why doesn't it just take the direct A-to-F edge?" The native overlay draws the checked search on the slide.
3. **Cut a connection:** click D–F on the slide. Route A → C → E → F, cost 9, no model call.
4. **Muse chooses, Soma proves:** restore D–F, ask "Would the direct A-to-F edge ever be the better route?" and choose **Investigate my question**. Muse picks A–F; Soma computes the tie at 7. Drag the slider 11 → 8 → 7 → 6. A second question gets a different connection (B–D, tie at 3).
5. **Follow-up:** ask why; open **How Muse made this** for the Wonder review line.
6. **Keep it:** **Save exploration**, reopen it, then **Try a fresh example**.
7. **Lift into 3D:** the panel's **Lift into 3D** (⌘L in the compact bar). Hold on the settled view: F at 7 on the ruler, taut route, A–F slack 4.
8. **A second subject:** the Lecture 9 bridge slide in Preview, ⌥Space, "Why is there no current through R5?" Soma draws every voltage and current; B = C = 8 V and R₅ carries 0 A. Click R₂ on the slide to open it: current crosses R₅ from B to C.
9. **On camera:** the close and the end card.

Keep the understanding map, course workspace, architecture and repair history out of the three-minute story. They remain available for questions.

## Entry paths

**Native companion (the video's path):** the signed macOS companion loading the hosted app. Point & ask uses ⌃⌥Space once enabled in the toolbar; the compact bar is Option+Space. The 3D lift needs a companion build that includes it (the release after v0.4.0). Do not make an unrecorded OS permission prompt the opening dependency.

**Browser (the judge path and fallback):** the [Explore route](https://soma-woad-beta.vercel.app/explore). Upload the [Lecture 14 slide](../public/examples/lecture-14-dijkstra.png) and ask the same question; the checked search is drawn over the uploaded capture. If the native overlay misaligns on a take, use **Share a window** on Preview and say which path the take used in its label.

**Circuit slide:** [Lecture 9 bridge](../public/examples/lecture-9-bridge.png) (PDF for Preview: `docs/examples/hero-circuit/Lecture-9-Bridge.pdf`). The same entry paths work: upload it in the browser or ask over it natively.

**Soma lab engine:** the hosted [lab page](https://soma-woad-beta.vercel.app/lab/engine/index.html). Actual recorded Muse source and investigation cases, with no runtime inference. It is not a live generation or cloud-save flow, and it is no longer in the video.

## Recording modes

- Fresh source generation: capture the actual result and wait. Shortened waits need actual elapsed-time labels.
- Genuine recorded Muse generation: keep its recorded label and original attribution. New follow-ups may still be live operations.
- Prepared examples: identify them as prepared, not as recorded model output.
- Lab illustrations: identify the recorded prototype and original synthetic source.
- Circuit beat: the Lecture 9 slide run live, its values checked against the script's list before it goes in the cut.
- Non-course diagrams stay potential unless an original map is run live and checked.

Use original synthetic material or a source with explicit sharing permission. Review source interpretation visibly when it matters; graph computation checks the interpreted input, not every pixel-reading claim. Preserve the earlier valid artifact on generation failure and use the documented recorded or prepared path honestly.

The cumulative testing allowance is $40 (PM132), with prior consumption and reservations retained. Check the actual ledger and admission before another live take; a full hero take has cost about $0.15–0.25, but there is no fixed per-take promise.

## Submission framing

Impact means plausible real-world potential, beneficiaries and significance. The student journeys on the two slides are the demonstrated evidence; reach beyond the classroom is stated as potential. Learner studies, adoption and quantified savings are optional additional evidence, not hackathon prerequisites.

Recording, final video upload, clean public judge access and publication remain separate completion steps. Use only [Jeremiah-Sakuda/soma](https://github.com/Jeremiah-Sakuda/soma) as the source repository; keep it private until authorized. No new hosted or native acceptance or final-video claim follows from this document.
