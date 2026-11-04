# Soma — three-minute demo script

November 4 script revision: open with the working interaction on the PDF, then return clearly to the start of that same take. Give the unselected-edge investigation the most time: the viewer should see Muse choose what to change and then watch the consequence. The 3D lift and current reversal supply the other visual payoffs. The spoken copy uses ordinary descriptions of what is happening; it leaves detailed verification in the evidence record.

This is a production script, not captured footage. The graph source is the original demo Lecture 14 slide (`docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf`); the circuit source is the original demo Lecture 9 bridge (`docs/examples/hero-circuit/Lecture-9-Bridge.pdf`). Neither should be introduced as a real instructor’s handout. The main sequence follows one graph take, with a clearly separated circuit take. The opening graph excerpt is a preview of the same take, not another inference result spliced into it.

**November 4 UTC delivery:** current web runtime `1658b98` uses `soma-clarity-2026-11-04`, with calculation-owned source captions, printed browser-height values and compact save feedback. The native sources remain those of the signed/notarized private 0.4.1 draft; the published installer remains 0.4.0. Local renderer/controller checks and the labeled silent QA clips do not establish physical native alignment or hosted acceptance, which remain pending after the origin approval rejection. Actual service E investigation (Muse chose D–F, tie 5), source-preserving follow-up/save and circuit image-check/reversal runs remain separate evidence. Final three-minute/native footage is still pending. [Verification](VERIFICATION.md) owns current CI/deployment results, source identity and retained failures.

**What the viewer should notice:** the PDF is still open in Preview; a question becomes an experiment on it; Muse chooses a connection the user did not name; the route and current visibly change.

**Voice:** Jeremy, conversational. Speak to the result on screen. Pause when the route changes, the graph lifts or the current reverses. The script should not sound excited on the viewer’s behalf. Keep the existing tagline available on the end card; there is no need to read it aloud.

## Checked facts the footage must match

**Settled-frame rehearsal check:** advancing to the last checked step is not the same as the drawing finishing its animation. Wait for the full route and its final labels to settle, then hold the completed result for at least two seconds before lifting or cutting away. The silent local QA take caught a short final-source hold; its graph/circuit figures, current values and actual save/reopen were verified separately. Keep real source, current controls and printed numerical readouts legible in the chosen framing.

These values come from Soma's solver and have been confirmed in live runs ([receipt](examples/hero-dijkstra/receipts/live-run.json)):

- The cheapest route is A → C → B → D → F, cost 7. B improves from 4 to 3 when C settles (tag "③ B = 3"); D settles at 4 (tag "④ D = 4"), and F's dashed "F ≤ 11" becomes the equation tag "4 + 3 = 7 < 11", with the printed A–F line struck once.
- BFS (fewest edges) takes A–F directly, cost 11.
- Cutting D–F gives A → C → E → F, cost 9.
- The tipping point on A–F is exactly 7. At 7 the routes tie, both costing 7, and Soma's fixed tie rule draws the direct edge; below 7 the direct edge wins outright. (Fallback question only; see below.)
- "What would make the route go through E?" names no connection, so Muse has to choose one. Four connections can send the route through E, and Soma's probe gives each an exact answer on this slide: C–E below 3 (tie at 3; A → C → E → F), E–F below 1 (tie at 1), D–F above 5 (tie at 5; A → C → E → F, cost 9), or B–D above 3 (tie at 3). D–E touches E but only ties even at cost 0, so it never wins. If Muse picks anything else, or no connection, use the fallback question "Would the direct A-to-F edge ever be the better route?" and the A–F facts above.
- In both successful November 4 UTC service investigations, no edge was preselected and Muse chose D–F. The latest run independently checked D–F = 2.5 → A–C–B–D–F, cost 6.5, and D–F = 7.5 → A–C–E–F, cost 9. Its follow-up at 7.5 retained the original source cost 3 and passed Wonder review plus exact save/reopen. A new take may choose another valid connection; narrate its actual checked boundary.
- In 3D, F rises to 7 on the ruler; the route strings are taut and A–F hangs with "11 · slack 4". Heights and numerical slack come from the checked graph; string curvature/length is schematic, not a physical measurement of cost.

The circuit beat's values come from Soma's circuit solver and were confirmed in two live service runs ([receipt of the second](examples/hero-circuit/receipts/live-run.json)):

- B and C both sit at 8 V, so R₅ carries exactly 0 A (tag "R₅: 0 A", dashed). R₁ and R₂ carry 2 A, R₃ and R₄ carry 1 A, and the battery 3 A.
- Opening R₂ sends about 0.4138 A through R₅ from B to C (tag "R₅ ≈ 0.4138 A →"); C rises to about 9.103 V.
- The tipping point: asked "When would current flow through R5, and which way?", Muse chose R₄. The current in R₅ is exactly zero when R₄ is 8 Ω, the value printed on the slide and the bridge's balance point (R₁/R₂ = R₃/R₄). Above 8 Ω it flows from C to B (arrow ←); below, from B to C (arrow →). The table of checked values shows exact fractions, such as 12/29 A ≈ 0.4138 A for R₅ with R₂ open.

If a take shows anything else, stop and retake. Never narrate a value that is not on screen.

## Script and shot plan

The timing is an edit target, with shortened model waits disclosed using this take’s actual measurements. Cursor movement, slider response and result holds play at their actual speed. All spoken words are captioned. Small factual labels are separate from captions and must stay clear of the diagram.

The recording copy below assumes the verified D–F / tie 5 and R₄ / balance 8 Ω outcomes. A new take can choose differently: use its actual valid choice and computed boundary. Do not coach the model to pick D–F just to fit the script. The alternatives in Checked facts remain available.

| Time | On screen | Spoken | Small on-screen label |
| --- | --- | --- | --- |
| 0:00–0:10 | Cold open on the actual native overlay over Preview. From the already-read graph, click D–F; hold the new route and cost 9. Use this excerpt from the same retained take as the rest of the demo. | This graph is on a PDF. I can cut a connection and watch the shortest route change, right here on the page. | Original demo slide · excerpt from this take |
| 0:10–0:20 | Briefly show Jeremy, then cut clearly to the start of the take: plain slide, no overlay. Circle the graph and ask. | I built Soma for questions I have while studying. Why doesn’t it take the direct route from A to F? | Start of take · Point & ask |
| 0:20–0:42 | Show the actual reading result, then the search drawing on the source. Let the completed A–C–B–D–F route settle; hold cost 7 beside direct cost 11 for two seconds. Shorten the measured generation wait. | Soma draws the search on the slide. Going through D costs seven; the direct edge costs eleven. Muse Spark reads the diagram, Muse Wonder checks the reading against the image, and Soma calculates the route. | Spark: reads · Wonder: reviews · Soma: calculates · actual wait: [n] s |
| 0:42–1:16 | Keep the original graph active. Clear the selected object visibly. Ask the exact E question and click Investigate my question. Show Muse’s chosen connection and its reason. For D–F, show the tie at 5, then drag above 5 and hold on A–C–E–F. | What would make the route go through E? I haven’t selected a connection or told it what to change. Muse chooses D-to-F. Soma calculates the threshold: at five, the routes tie. Above five, the route goes through E. I can move it back and forth and see exactly where that happens. | Muse chose the connection · Soma computed the threshold · actual wait: [n] s |
| 1:16–1:31 | Keep the changed D–F value active. Ask the follow-up through Point & ask. Show the actual answer mentioning the changed experiment. Highlight the relevant sentence editorially only if it exists in this take; do not replace the model’s answer. | Why does it flip right there? Soma answers using the value I just changed. I can ask about this particular experiment and keep working with it. | Current experiment · actual review status · actual wait: [n] s |
| 1:31–1:49 | Show Back to the graph as read; advance to the final checked step, confirm F = 7, then Lift into 3D. Hold the ruler, F = 7 and A–F slack 4. Keep the source page recognizable. | Back to the original graph. Here’s the same search in three dimensions. Height shows the cost of reaching each node. F is at seven; the direct edge has four units of extra cost. | Source restored · computed heights and slack · string curves schematic |
| 1:49–2:30 | Switch to the original bridge slide; circle it and ask about R₅. Show B = C = 8 V and R₅ = 0 A. Open R₂ and hold 0.4138 A B→C. Restore source, clear selection, and ask When would current flow through R5, and which way? in the panel. Show the actual R₄ choice. Drag below and above 8 Ω with two-second holds on opposite current arrows. | Now a circuit. Why is there no current through R-five? Both ends are at eight volts. Open R-two, and current starts flowing across the bridge. Then I ask when it would flow, and which way. Muse chooses R-four to vary. Below eight ohms, the current goes this way. Above eight, it turns around. | Original demo slide · DC circuit calculation · Muse chose R₄ · actual waits labeled |
| 2:30–2:47 | Jeremy on camera beside the settled circuit result. No extra feature montage. Keep the last useful result visible. | I built this for my lectures. The useful part is being able to try the question as soon as I have it, on the diagram I’m already looking at. | Soma · checked graph search and DC circuits |
| 2:47–3:00 | End card with verified product/repository links. Say the line, then leave quiet time to read. Credit only the models actually used in the take. | That’s Soma. You can try it at the link on screen. | Built during the Meta Global AI Developer Hackathon · Muse Spark / Wonder / Voice Transcribe when used |

[Voiceover-only recording copy](DEMO_VOICEOVER.txt). The current spoken copy is **280 words** (whitespace count). At 130–145 words per minute, the words occupy roughly 116–129 seconds, leaving the rest for actions, result holds and the end card. This is a planning estimate, not a timed rehearsal.

### Match the words to the take

- If Wonder did not complete the image review, remove “Muse Wonder checks the reading against the image” and use the actual status label. Image agreement is not a correctness guarantee.
- If Muse selects another connection for E, replace only the connection/threshold/result sentences with the actual valid outcome. If no usable choice is published, retake or use the labeled recorded investigation; do not narrate a success over a failed result.
- If the follow-up does not use the changed value, keep that failure out of a successful-take claim. The script’s continuity claim needs an actual matching answer.
- For the circuit, the exact input remains “When would current flow through R5, and which way?” The shorter narration describes that question; it is not a claim that a new prompt has been tested. If a different part is chosen, verify its direction/boundary before changing the voiceover.
- If the circuit beat will not fit at a natural pace, omit the R₂-open detour and its sentence. Keep Muse’s choice and both sides of the current reversal; those show more than another computed number. If more time is needed, shorten the on-camera close before speeding up an interaction.
- The camera and panel must leave the route and arrows visible. Only say “on the page” over actual native footage. In a browser take say “over the captured slide,” and introduce that capture visibly.

## Editorial choices

The opening shows the capability before explaining it. The middle spends its time on a decision: the user names E, and Muse chooses a connection to investigate. Model names appear once where their work is visible. The 3D beat explains what height means; the circuit beat ends with the arrow changing direction.

Dropped from the spoken copy: “Every student has…”, “the answer has a shape”, “with the math checked, not guessed”, the aside about an earlier Wonder catch, and repeated “a number that isn’t on the slide.” Keep the real Wonder catch in supporting evidence. It need not interrupt the current experiment.

No montage of unfinished topics, invented user results, scripted model decisions or generic claims about transforming education. Save/reopen stays outside the three-minute cut; it remains available in the judge route.

## Candidate second 3D example — engine (proposed, not in the locked voiceover)

The user suggested an engine, a jet taking off or another subject, with exceptionally high visual quality as the requirement. The recommended candidate is a single-cylinder four-stroke cutaway. A jet takeoff would require an additional visual environment and a clear aerodynamic explanation; its spectacle alone would not show Muse’s contribution.

**Potential 30-second beat, replacing part of the circuit slot:** begin with a source diagram and the question “Why does this engine need two turns?” Show a large cutaway. Rotate the crank one turn and pause at the same piston position; make the different valve state visible. Finish the second turn. The useful reveal is that matching piston positions do not mean the same point in the cycle. This proposed true-3D sequence is not implemented or verified by the script.

The existing engine is a recorded Muse-authored **2D vector** prototype with constrained motion and a synchronized 90°/450° comparison. It supplies real authorship and question-conditioned investigation evidence, but it is not the canonical live source-to-3D flow. Do not present a new modeled asset as generated live, or describe that existing illustration as true 3D. Its inspected frame is useful proof of the concept, not acceptance of the proposed visual bar. [Existing work](examples/pm121/README.md) · [Recorded investigation](examples/pm126/README.md).

Selection bar before replacing the circuit: every visible joint stays attached through the full motion; cut surfaces and occlusion are clean; materials distinguish parts without concealing them; one camera and one control expose the mechanism; labels are few and readable at video size; manual scrubbing is immediate; the question, actual Muse decision and resulting change remain apparent. A premium technical illustration is an appropriate target; photorealism is not required. Inspect paused frames as well as motion. If the engine cannot meet that bar, retain the checked circuit and give the existing graph lift more time.

This is a proposed script alternative, not a request to create aircraft, a new physics solver or an unlabeled cinematic clip. The canonical voiceover stays unchanged until the example and its footage earn inclusion.

## Capture setup

- **Release:** record the actual web manifest and installed companion version with the take. The signed [0.4.0 release](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.4.0) includes the overlay, compact bar and 3D lift. The signed/notarized 0.4.1 draft contains the November 4 geometry/controller/precision fixes; it still needs current physical native alignment and hosted acceptance after the pending origin approval. Do not identify older native footage as a 0.4.1 run. [Current evidence](VERIFICATION.md).
- **Screen:** 1920×1080, with notifications and the menu bar clock hidden. Preview shows `Lecture-14-Dijkstra.pdf` full screen. The companion loads the hosted app, so the overlay draws over Preview.
- **Point & ask:** hold ⌃⌥Space, circle the graph, and speak. For a silent rehearsal, type the question into the composer first; Point & ask then uses the typed text instead of the microphone.
- **Questions:** "Why doesn't it just take the direct A-to-F edge?", then "What would make the route go through E?" (fallback: "Would the direct A-to-F edge ever be the better route?") and, spoken, "Why does it flip right there?" On the circuit slide: "Why is there no current through R5?", then "When would current flow through R5, and which way?" Both slides stay in the panel's Point & ask flow; the compact bar (⌥Space) hides the panel and has no slider.
- **Circuit slide:** open `Lecture-9-Bridge.pdf` in a second Preview window, full screen, before the take, so the switch is one keystroke.
- **On camera:** two short pieces to camera, recorded separately at eye level in soft side light. Keep the laptop screen visible but out of focus.
- **Fallback:** if the native overlay misaligns on a take, use **Share a window** on Preview; the same drawing then appears over the capture inside Soma. Say which path the take used in its label.
- **Takes:** each full take costs about $0.20–0.35 of live inference, including the circuit investigation. Keep every raw file and record its measured waits. Rehearse actions silently first; check the remaining budget before additional live takes. Keep one coherent successful graph take rather than combining incompatible outcomes. Note each take's actual generation time for the "wait shortened" label.

## Edit rules

- **Burned-in captions:** two lines at most, 42 characters per line, bottom centre, white on a 60% dark band. Keep the band clear of the overlay's own caption, which sits under the graph. Quoted questions to Soma go in italics.
- Keep the slide recognizable at all times; the drawing on it is the hero. Don't cut to the diagram view.
- Hold each settled route and each circuit current direction for at least two seconds. An animation still drawing is not a settled hold.
- Shorten only generation waits, and label each one with the duration measured in that take.
- The earlier Wonder catch is supporting evidence ([wonder-review.json](examples/hero-dijkstra/receipts/wonder-review.json)), outside this cut. Never present it as part of the current take unless that take has its own recorded rejection.
- The circuit beat must be its own live take on the Lecture 9 slide, with its values checked against the list above. If the native overlay misaligns on it, use **Share a window** like the hero fallback and label it.
- The Soma lab engine is a recorded Muse run and is no longer in the cut. If it is ever shown, keep its label on screen and never present it as generated live.
- A non-course diagram (a transit or network map) stays potential: never imply one works without footage of it working.
- Mute product narration under the voiceover. If product audio is audible, credit the configured speech provider: Muse writes the words, not the voice.

## Status

Verified:
- the hero journey, live through the service (PM132);
- the native overlay on the real Preview window: alignment across the rounds and a clean final frame (PM139–PM153);
- the hosted app at an earlier release, `soma-pm153-review-2026-11-01` (this script's release is the one in `public/release.json`).

Also verified (November 1): the 3D lift on the real screen through the compact bar, including a slide re-check while lifted, in an unreleased companion build (`desktop/test/compact-live.cjs`).

Also verified (November 2): the circuit beat's reading, solution and investigation, live through the service twice on the Lecture 9 slide (exact reading both times; Wonder approved; Muse chose R₄ and Soma found exactly 8 Ω), the circuit drawing, opening and value changes in the browser with a scripted provider, and the whole circuit journey live on the page against a local server, including Find the tipping point.

Also verified (November 1, 9:25 PM): the whole graph journey through the panel on the real screen (`desktop/test/demo-live.cjs`, nine of nine beats), including **Lift into 3D** from the panel. On recording, dock the panel at the right edge: in that run it covered the left half of the slide.

Also verified (November 3): the hosted app at release `soma-circuits-review3-2026-11-03`, headless: the Lecture 14 button drew the checked search with the green line "Muse Wonder checked Spark's reading against your slide and confirmed all 6 nodes and 9 weights"; the Lecture 9 button drew the circuit; the circuit investigation chose R₄ and found exactly 8 Ω, verified. Muse's reason for R₄ did not appear at first: a filter bug, fixed; after the fix, on release `soma-circuits-review6-2026-11-03`, the panel read "Why R4: Changing R4 shifts node C relative to node B so R5 direction reveals imbalance" (investigation in 32 s). One earlier attempt timed out when a composition call hit the old 30-second per-call limit, now 45 s. The signed companion [0.4.0](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.4.0) is published.

Also verified (November 4 UTC, current canonical service): the exact E question with no edge selected, D–F boundary 5 and routes on both sides; the follow-up at D–F = 7.5, source/base preservation and exact save/reopen. The circuit run confirmed all six parts and polarity with Wonder's independent image check, then verified R₄ balance 8 Ω and R₅ direction reversal plus save/reopen. Two unavailable reviews, the misleading-title rejection and a later composition HTTP failure remain in the [verification record](VERIFICATION.md). These are separate attempts, not an aggregate success-rate claim.

Not yet verified: the reported deployment's hosted manifest/UI and native acceptance (browser approval pending); the circuit drawn by the native overlay on the real screen, its investigation and R₄ drag through the complete companion sequence; the narrated/timed edit; and any non-course diagram. No final video URL exists yet. Save, reopen and Try a fresh example remain outside the three-minute cut. No new transcription or audible-quality check is claimed.
