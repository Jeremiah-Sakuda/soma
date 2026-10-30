# Soma story, demo video and submission copy

**PM070, October 29, 2026.** This is the full story and video script. The beat outline in [DEMO_AND_EVALUATION.md](DEMO_AND_EVALUATION.md) (PM069) and this script describe the same video. Every claim here is tied to executed evidence in the [claims ledger](#claims-ledger). The public README in `soma-hackathon` tells the same story. An independent fact-check against the deployed source corrected an earlier draft of this file.

## The story in five beats

1. **The problem.** Lecture slides are frozen: one graph, one route, one answer. Students understand by asking what the slide cannot answer, such as "what if this edge cost more?", "what if I start here?" and "why not the direct route?".
2. **Why today's tools fall short.** An AI chat explains in paragraphs, or draws a picture you cannot change and nobody checked. A visualizer lets you experiment, but you have to find one and re-enter your slide's example by hand.
3. **The product.** Soma is a companion that lives beside your work. Press ⌘⇧Space, ask, and the graph on your screen becomes a live experiment you can change.
4. **Why you can trust it.** The model proposes; the code proves. Muse Spark reads the screen and decides which experiment is worth running. Soma's solver computes every path and cost. Muse Wonder reviews the explanation against those results before you see it.
5. **Why it matters beyond this week.** Research says learners gain more from doing things with a visualization than from watching it, and that AI help without safeguards becomes a crutch. Soma lets students experiment on the material in front of them and keeps their own predictions separate from help. Each new subject needs only a solver, a schema and a renderer; circuits are next.

**Tagline:** Point at a diagram. Change it. See what actually happens.

**Design line:** The model proposes; the code proves.

**One sentence:** Soma turns the graph on your screen into an experiment you can run: Meta's Muse Spark reads it and chooses what to test, Soma computes the true result, and Muse Wonder reviews the explanation before you see it.

**Thirty seconds:** Slides show one answer, but you learn from the questions they can't answer. Today an AI chat gives you paragraphs, and a visualizer makes you re-enter the example yourself. Soma is a Mac companion: press a shortcut over your slide, ask your question, and that graph becomes a live experiment beside your work. Muse Spark reads it from the pixels and picks which edge is worth testing. Soma's solver computes every path and cost, so the slider is instant and needs no model call. Muse Wonder reviews the explanation against the checked results. Graph search is the first fully checked subject; anything else gets a labeled explanatory visual.

## Three-minute video script

Record the real app on a real Mac. This recording also covers the native-capture checks that are still open: Screen Recording permission, the shortcut and the snapshot preview. If native capture fails on the day, record the same beats through browser upload at [/explore](https://soma-woad-beta.vercel.app/explore) and leave out the shortcut.

**Source material.** Use a real Intro AI slide only if you have permission to show it. Otherwise make an original slide with a plain topic title such as "Uniform-cost search", and label the first frame *Original slide made for this demo*. Use a weighted graph whose direct start–goal edge is expensive, for example S→Goal at cost 10, with a three-edge route totaling 3. Quote route costs only from what the actual card shows.

**Voice.** Use Jeremy's own voiceover over muted product audio. If any Soma narration audio is heard, caption it: *Narration voice: Gemini TTS (non-Meta)*.

| Time | On screen | Voiceover | Required label |
| --- | --- | --- | --- |
| 0:00–0:12 | Full-screen slide with the highlighted shortest route | "Every week I study from slides like this. They show one answer. But the question I actually have is: why doesn't it just take the direct edge?" *(Say the first sentence only if it is true for you.)* | Source label (real slide with permission, or original slide) |
| 0:12–0:30 | ⌘⇧Space → snapshot preview → record the question: "Why doesn't the shortest path take the direct edge?" → transcript appears → Ask | "One shortcut. Soma takes a single snapshot, and the snapshot isn't sent until I ask. Muse transcribes my question." | — |
| 0:30–0:38 | Waiting state → card appears | — | Wait shortened (actual: N s); use the real elapsed time |
| 0:38–1:00 | Live-generation and *Checked Dijkstra computation* badges. Step through. Show both route costs, for example Dijkstra 3 over 3 edges and BFS 10 over 1 edge. | "Muse Spark read that graph straight from the pixels: every node, edge and cost. Then Soma's solver computed every path and cost you see. The explanation is Spark's. The answers are computed. The model proposes; the code proves." | — |
| 1:00–1:40 | Click **Find the tipping point** → *Muse chose an experiment · checked by Soma* appears → set the edge cost to 4, then the tie value (use the tie shortcut or Shift+Arrow), then 2, and watch both route costs | "So when does the direct route win? I let Spark decide which edge is worth testing, and Soma computed the cases. This slider re-runs both searches right here, with no model call. At 4 the routes split. At 3 they tie. At 2, both take the direct edge." *(Adjust the numbers to the card.)* | — |
| 1:40–2:05 | Switch off a connection on the cheap route (not the edge under test, and keep the goal set) → ask a follow-up → the answer keeps the change → open **How this card was prepared** and show the call list, time and cost | "Follow-ups keep my experiment instead of resetting it. And here is exactly how this card was built: every model call, and Muse Wonder's review of the explanation against the solver's results." *(Mention a review revision only if this take shows one.)* | — |
| 2:05–2:22 | Step once, then **Predict the next node** → choose → **Check my prediction** → checked result | "Before Soma reveals a step, I can predict it. My guess is checked and kept, and it's recorded as practice with the diagram visible, never as proof I understand. AI that thinks for you can hurt learning; Soma keeps me thinking." | — |
| 2:22–2:42 | Three quick cuts from fresh screenshots: code, a circuit, a documentation page, each with its explanatory-visual badge | "It works beyond graphs too: code, circuits, documentation. When a visual is explanatory rather than computed, Soma says so. Graph search is the first subject it can fully check. Circuits are next." | Explanatory visuals, not simulations |
| 2:42–3:00 | Save → reopen from version history → end card | "Soma. Point at a diagram, change it, see what actually happens." | End card: *Built during the Meta Global AI Developer Hackathon, Oct 26 – Nov 4 · Muse Spark · Muse Wonder · Muse Voice Transcribe · soma-woad-beta.vercel.app/explore* |

### Before recording

- **Budget.** Check the ledger first. A full take is three live turns, about $0.11–0.17, so plan two or three takes.
- **Dry run on the recording Mac.** Confirm the shortcut, the permission prompt and the snapshot preview.
- **Model-chosen controls.** Spark decides whether the card includes the BFS comparison and the **Change a connection** control. Confirm both appear in your take before relying on the 0:38 and 1:40 beats.
- **Label legibility.** Check weighted labels at the window size you record; an earlier review saw overlapping weights at some widths.
- **The 1:40 follow-up.** Keep the edge under test switched on and the goal set, so the slider stays usable. Since PM069, removing either no longer breaks the follow-up; the cost experiment is just shown as unavailable.
- **Fallback if live generation is at capacity.** **Watch a recorded Muse run** opens a real completed Spark and Wonder run with its original timing and cost. If you use it, keep its recorded label on screen and do not present it as a fresh run.
- **Review revisions.** If Wonder rejects the follow-up twice, the take fails. Re-record rather than editing around it.
- **Current UI labels (PM069 release).** The live badge reads *Muse Spark generated*, and each generated card shows a pipeline strip: Spark read the source, Soma computed, Spark composed, and Wonder reviewed or did not run. Show that strip in the 1:40 beat. Match the voiceover to the build you record.
- **Waits.** Use real elapsed times in every "wait shortened" label.

### Do not

- Imply real course material without permission, real students, or measured learning gains.
- Show the parked course workspace or connectors.
- Cut a failure into looking like a success. If a take fails, re-record it.

## Submission form copy

**Project name:** Soma

**Tagline:** Point at a diagram. Change it. See what actually happens.

**Track and problem statement:** Indie Developer · Build for Your World

**Short description:**
Soma is a macOS study companion that turns the graph on your screen into an experiment you can run. Press ⌘⇧Space over a slide and ask a question. Muse Spark reads the diagram from the pixels and chooses an experiment worth running, Soma's own solver computes every path and cost, and Muse Wonder reviews the explanation against those results. The model proposes; the code proves.

**Full description:**
Lecture slides show one answer, but students learn from the questions a slide can't answer: what if this edge cost more, or why not take the direct route? An AI chat answers in paragraphs you can't change or check. A visualizer lets you experiment, but only after you re-enter the example yourself.

Soma closes that gap. One shortcut snapshots your screen, and Muse Spark reads the diagram as typed data. Soma then runs the actual algorithms on it, so every path and cost on screen is computed, not generated. Click **Find the tipping point** and Spark picks the edge worth testing. Soma computes the cases, and a slider shows how both routes respond to that cost, instantly and without another model call. Muse Wonder reviews the finished explanation against the checked results and can send it back for a repair. Follow-ups keep your changes, your predictions are checked and kept separate from help, and versions are saved.

Graph search (BFS and Dijkstra) is fully checked. Code, circuits, documentation and other material get step-by-step explanatory visuals, labeled as such. In our development tests, Soma read 8 of 8 fresh original graph images exactly against an independent reference. It handled 8 of 9 varied screenshots on the first request, including real documentation pages.

**How we used Meta's models:**

- **Muse Spark 1.3:** vision interpretation, experiment selection and scene composition through four strict tools.
- **Muse Wonder 1.0:** advisory reviewer that checks generated explanations against computed results. In testing it caught a mislabeled Dijkstra frontier and misleading tie wording.
- **Muse Voice Transcribe 1.0:** spoken questions.

The models never compute paths or costs, run code or write learner records. Every card shows its actual model calls, time and cost. Narration audio uses Gemini TTS, because the event's Meta lineup has no speech synthesis. Browser voice and captions are alternatives.

**Built during the hackathon:**
Everything, from October 26 onward: the exploration engine, the checked solvers and the cost-experiment tool, the signed and notarized macOS companion, voice, persistence, budgets and the release fingerprint that ties the public source to production. An earlier course-workspace prototype from the same week remains in the repository but is not part of the demo.

**What's next:** More checked subjects, starting with circuits, then classroom pilots that measure unassisted performance.

**Links:**

- Repository: https://github.com/Jeremiah-Sakuda/soma-hackathon (submit this repository only)
- Live: https://soma-woad-beta.vercel.app/explore
- Mac app: https://github.com/Jeremiah-Sakuda/soma-hackathon/releases/tag/v0.1.0

## Post on X

> Slides show one answer. You learn from the questions they can't answer.
>
> Soma: press ⌘⇧Space over a graph diagram and it becomes an experiment you can change. Muse Spark reads it and picks what to test, the code computes the truth, and Muse Wonder reviews the explanation.
>
> The model proposes. The code proves. [video] #MetaAIHackathon

Confirm the event's official hashtag and handles before posting.

## Judge questions and answers

**Isn't this an image analyzer or an AI-for-education chatbot?**
No. There is no chat thread, and the output is not an answer. It is a computed experiment you can change. The model's main decision is which experiment to run, and the application computes every path and cost.

**Why only graph search?**
"Checked" means a real solver sits behind the visual. We chose one subject done properly over many done loosely. Each new subject needs a solver, a schema and a renderer, and the capture, model and review pipeline stays the same. Everything else already gets a labeled explanatory visual.

**Has anyone used it?**
Not yet in a class. It was built this week and tested on 22 frozen sources plus production checks after release, with every failure published. The next step is a pilot that measures what students can do afterward without help.

**What happens if Spark misreads the screenshot?**
The **Source & assumptions** panel shows Spark's reading and the uncertainty it reported. Ambiguous input gets a clarifying question or is declined rather than published. Validation rejects inconsistent output. Fresh original graph images were read correctly 8 of 8 times. Spark's reading is not independently re-checked, and we say so.

**What does Wonder actually add?**
A second model reviews the explanation against the solver's results. It caught real wording and labeling defects in testing and has sent a live card back for revision. It is advisory; the application's own checks run first.

**Doesn't Spark just pick the obvious edge?**
For the tipping-point experiment, Soma instructs Spark to prefer a direct start–goal edge, because that edge gives an exact tie to show. Spark still has to identify that edge from the graph it read.

**Why Gemini for the voice?**
The Meta models offered for this event include transcription but no speech synthesis. Narration is optional; the browser voice and captions work without it.

**How much does a turn cost, and how long does it take?**
About $0.04 and roughly 10–20 seconds for three Meta calls. A review revision raises that to about $0.09. Moving the slider afterward costs nothing.

**What was built during the hackathon?**
All of it, from October 26 onward. The public repository's release fingerprint matches the deployed app.

**Did you use open-weight models?**
No. We researched a Muse Glimmer adapter for experiment selection but did not ship it, because we did not want to claim a capability we had not proven.

## Claims ledger

| Claim | Evidence |
| --- | --- |
| 8 of 8 fresh original graph images (3–4 nodes) read exactly; 12 of 13 intended outcomes | PM064 frozen 13-case evaluation; public `docs/VERIFICATION.md`, `tests/fixtures/exploration-source-evaluation/` |
| 8 of 9 varied screenshots (3 real public pages, 6 original images) on the first request | PM065; public `docs/GENERAL_SCREENSHOTS.md` |
| Wonder caught a FIFO label on a Dijkstra frontier and misleading tie wording | SOMA_V2_VALIDATION.md, PM061 |
| Wonder sent a live follow-up back for one revision (4 calls, 22.452 s, $0.092412) | SOMA_V2_VALIDATION.md, PM064 hosted checks |
| A typical turn is 3 calls, roughly 10–20 s and about $0.04 | Measured 10.992 s/$0.0384 and 13.229 s/$0.0401 (PM063), 14.351 s/$0.0393 (PM061), 18.351 s/$0.0400 (PM064); six 3-call weighted cases ran 8.8–21.2 s (PM064) |
| More than 1,300 offline tests and over 100 browser journeys | 1,374 offline tests in the PM069 suite; 101 journeys on the clean snapshot (aa8c15c) and 102 in CI run 40988357305; PM069 CI run 40994621511 succeeded |
| Production matches the public source | Release soma-pm069-2026-10-29, fingerprint 2722c0b0…; `verify-release.mjs` verified 202 files at b000a34 (docs commit on top of the PM069 release), matching live `/release.json` on October 29. |
| Signed and notarized macOS app | DESKTOP_COMPANION.md; release v0.1.0 |
| Research citations | Hundhausen, Douglas & Stasko 2002 (doi:10.1006/jvlc.2002.0237); Naps et al. 2002 (doi:10.1145/960568.782998); Bastani et al., PNAS 2025 (doi:10.1073/pnas.2422633122). The citations motivate the design; they do not show that Soma improves learning. |
