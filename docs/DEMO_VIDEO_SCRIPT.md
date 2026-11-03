# Soma — three-minute demo script

November 1, 2026 positioning update of the PM153 script (kept in git history), revised November 2, and November 3 after review: one graph investigation instead of two, save and fresh practice left to the form, and a longer circuit beat in which Muse picks a part the question never names and the current visibly reverses. Following the [story](STORY_AND_DEMO.md): the range beat lifts the search into 3D on the real screen, then shows the second checked subject, a circuit slide run live through the same flow; the close adds one line about reach. PM153 still holds for everything else: Jeremy on camera at the open and close, every spoken line burned in as a caption, and the checked search drawn by the native overlay directly on the Preview window. This is a production script, not a record of captured footage.

The journey is one continuous live run on the original Lecture 14 slide (`docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf`), followed by about 25 seconds of range: the 3D lift and a second live slide, the original Lecture 9 Wheatstone bridge (`docs/examples/hero-circuit/Lecture-9-Bridge.pdf`).

**The promise:** your own slide becomes the explorable thing. Soma draws the checked search on the screen you are already looking at. Built for students first; the same idea reaches any diagram you can't edit.

**End-card line:** Turn what you're studying into something you can explore.

**Voice:** Jeremy, first person, conversational. Describe the experience, not the architecture. Honest scope goes in the small on-screen labels, not in the voiceover.

## Checked facts the footage must match

These values come from Soma's solver and have been confirmed in live runs ([receipt](examples/hero-dijkstra/receipts/live-run.json)):

- The cheapest route is A → C → B → D → F, cost 7. B improves from 4 to 3 when C settles (tag "③ B = 3"); D settles at 4 (tag "④ D = 4"), and F's dashed "F ≤ 11" becomes the equation tag "4 + 3 = 7 < 11", with the printed A–F line struck once.
- BFS (fewest edges) takes A–F directly, cost 11.
- Cutting D–F gives A → C → E → F, cost 9.
- The tipping point on A–F is exactly 7. At 7 the routes tie, both costing 7, and Soma's fixed tie rule draws the direct edge; below 7 the direct edge wins outright.
- In 3D, F rises to 7 on the ruler; the route strings are taut and A–F hangs with "11 · slack 4".

The circuit beat's values come from Soma's circuit solver and were confirmed in two live service runs ([receipt of the second](examples/hero-circuit/receipts/live-run.json)):

- B and C both sit at 8 V, so R₅ carries exactly 0 A (tag "R₅: 0 A", dashed). R₁ and R₂ carry 2 A, R₃ and R₄ carry 1 A, and the battery 3 A.
- Opening R₂ sends about 0.4138 A through R₅ from B to C (tag "R₅ ≈ 0.4138 A →"); C rises to about 9.103 V.
- The tipping point: asked "When would current flow through R5, and which way?", Muse chose R₄. The current in R₅ is exactly zero when R₄ is 8 Ω, the bridge's balance point. Above 8 Ω it flows from C to B (arrow ←); below, from B to C (arrow →).

If a take shows anything else, stop and retake. Never narrate a value that is not on screen.

## Script and shot plan

The "On screen" column describes what the viewer sees. The "Spoken" column is the voiceover, or Jeremy's words when he is on camera. Every spoken line also appears as a burned-in caption (see Edit rules). Each beat also carries a small label in the corner of the screen.

| Time | On screen | Spoken | Small on-screen label |
| --- | --- | --- | --- |
| 0:00–0:10 | **On camera.** Jeremy at the desk, the laptop screen visible behind or beside him with the Lecture 14 slide open. | Every student has sat with a slide like this: one worked example, and the question you actually have isn't on it. | — |
| 0:10–0:20 | Screen capture, Preview full screen. Jeremy holds ⌃⌥Space and circles the graph with the cursor. The translucent Soma panel slides in at the edge of the screen. | *(to Soma)* "Why doesn't it just take the direct A-to-F edge?" | Original demo slide · live run |
| 0:20–0:48 | The drawing appears **on the slide itself**: a loop around A, then C, then B. The pastel tags "① A = 0", "② C = 1" and "③ B = 3" sit beside their nodes; the dashed "F ≤ 11" turns into "4 + 3 = 7 < 11"; the printed A–F line gets one slash. The companion pointer flies to each node. The caption reads "Round n of m". Hold 2 seconds on the green line "Muse Wonder read your slide independently and confirmed all 6 nodes and 9 weights." | Muse Spark reads my slide, and Muse Wonder reads it again on its own to check every weight before Soma runs the real algorithm right on top of it. There's the moment the lecture skipped: going through D costs seven, so the direct edge loses. Every loop and number here is computed, not drawn by a model. | Read by Spark · checked by Wonder · computed by Soma · wait shortened, actual [n] s |
| 0:48–1:04 | Jeremy clicks the D–F line on the slide. A red ✕ appears and the route redraws along A–C–E–F with "= 9". The caption reads "You cut D–F. Checked route: A → C → E → F, cost 9." Hold. | Now my own question. What if D-to-F weren't there? I cut it, right on the slide. New route, cost nine. Instantly, with no model call. | Your experiment · 0 model calls |
| 1:04–1:30 | Jeremy restores D–F, says "Would the direct A-to-F edge ever be the better route?" and clicks **Investigate my question**. The panel shows Muse's choice, A–F, and the tie at 7. He drags the slider 11 → 8 → 7 → 6, holding at 7 on the tie, and the route moves onto the slide's A–F arc. | Then I ask Soma to test my question. Muse picks the connection to vary, and Soma proves exactly where the answer flips. At seven the two routes tie; drop below seven and the direct edge wins outright. | Muse chose the connection · Soma computed the boundary · tie at 7 |
| 1:30–1:44 | Jeremy asks the follow-up **out loud** through Point & ask. The answer appears in the panel, about the current experiment. **How this card was prepared** opens for 3 seconds to show the Wonder review line. | When I ask why, the answer is about the experiment I'm running, and Muse Wonder checked it against Soma's trace first. In one run it caught a step settling two vertices at once. | Muse Voice Transcribe · Spark · Wonder review |
| 1:44–1:56 | Back on the slide. Jeremy clicks **Lift into 3D** in the panel (⌘L if he is using the compact bar). The search lifts off the slide on the real screen: each vertex rises to its checked distance on the ruler, the A–C–B–D–F strings pull taut, and A–F hangs slack, labelled "11 · slack 4". Hold on the settled view. | And the answer has a shape. Every height is a checked distance: the shortest route pulls tight, and the direct edge hangs slack by exactly four. | 3D lift · heights and slack computed by Soma |
| 1:56–2:28 | Preview switches to the Lecture 9 bridge slide. Jeremy presses ⌥Space and types "Why is there no current through R5?" Soma draws on the slide: "B = 8 V", "C = 8 V", the dashed "R₅: 0 A", and every current with its arrow. He clicks R₂ on the slide: a red ✕, and "R₅ ≈ 0.4138 A →" appears. He restores R₂, types "When would current flow through R5, and which way?" and clicks **Investigate my question**. The panel reads "Change only R₄" and "exactly zero when R₄ is 8 Ω". He drags R₄ up past 8 Ω: the R₅ arrow on the slide turns to ←; down past it, back to →. Hold. | And it isn't only graphs. On a circuit slide, Soma solves the circuit exactly: B and C both sit at eight volts, so nothing crosses the bridge. Open R-two, and current flows. Then I ask when current would flow at all. Muse picks R-four, a part I never named, and Soma finds the exact value, eight ohms. Drag across it, and the current turns around. | Original demo slide · live run · solved exactly by Soma · Muse chose R₄ · waits shortened, actual [n] s |
| 2:28–2:46 | **On camera.** Jeremy, with the slide behind him showing the route drawn on it. | The slide didn't change. What changed is that I could ask it my question and see why, with the math checked. I built Soma for my lectures, but every diagram you can't edit has questions like mine. | — |
| 2:46–3:00 | End card. | Built this week with Muse Spark, Muse Wonder and Muse Voice Transcribe. Turn what you're studying into something you can explore. | Soma · live app URL · github.com/Jeremiah-Sakuda/soma · Built during the Meta Global AI Developer Hackathon, Oct 26–Nov 4 |

[Voiceover-only recording copy](DEMO_VOICEOVER.txt).

## Capture setup

- **Release:** use the deployed production app at the release recorded in `public/release.json`, and a signed companion build that includes the 3D lift (the release after v0.4.0). Record both release IDs with the take.
- **Screen:** 1920×1080, with notifications and the menu bar clock hidden. Preview shows `Lecture-14-Dijkstra.pdf` full screen. The companion loads the hosted app, so the overlay draws over Preview.
- **Point & ask:** hold ⌃⌥Space, circle the graph, and speak. For a silent rehearsal, type the question into the composer first; Point & ask then uses the typed text instead of the microphone.
- **Questions:** "Why doesn't it just take the direct A-to-F edge?", then "Would the direct A-to-F edge ever be the better route?" and, spoken, "Why does it only win once it costs seven or less?" On the circuit slide: "Why is there no current through R5?", then "When would current flow through R5, and which way?"
- **Circuit slide:** open `Lecture-9-Bridge.pdf` in a second Preview window, full screen, before the take, so the switch is one keystroke.
- **On camera:** two short pieces to camera, recorded separately at eye level in soft side light. Keep the laptop screen visible but out of focus.
- **Fallback:** if the native overlay misaligns on a take, use **Share a window** on Preview; the same drawing then appears over the capture inside Soma. Say which path the take used in its label.
- **Takes:** each full take costs about $0.20–0.35 of live inference, including the circuit investigation. Record at least three, keep every raw file, and pick the cleanest. Note each take's actual generation time for the "wait shortened" label.

## Edit rules

- **Burned-in captions:** two lines at most, 42 characters per line, bottom centre, white on a 60% dark band. Keep the band clear of the overlay's own caption, which sits under the graph. Quoted questions to Soma go in italics.
- Keep the slide recognizable at all times; the drawing on it is the hero. Don't cut to the diagram view.
- Hold for about a second after every change (a cut, a slider stop, an answer) so the consequence reads in a silent clip.
- Shorten only generation waits, and label each one with the duration measured in that take.
- Show the Wonder catch only from an actual run. If the recorded take's audit has no review rejection, keep "In one run…" as scripted and show the retained receipt ([wonder-review.json](examples/hero-dijkstra/receipts/wonder-review.json)), labelled "earlier live run, same slide".
- The circuit beat must be its own live take on the Lecture 9 slide, with its values checked against the list above. If the native overlay misaligns on it, use **Share a window** like the hero fallback and label it.
- The Soma lab engine is a recorded Muse run and is no longer in the cut. If it is ever shown, keep its label on screen and never present it as generated live.
- A non-course diagram (a transit or network map) stays potential: never imply one works without footage of it working.
- Mute product narration under the voiceover. If product audio is audible, credit the configured speech provider: Muse writes the words, not the voice.

## Status

Verified:
- the hero journey, live through the service (PM132);
- the native overlay on the real Preview window: alignment across the rounds and a clean final frame (PM139–PM153);
- the hosted app at release `soma-pm153-review-2026-11-01`.

Also verified (November 1): the 3D lift on the real screen through the compact bar, including a slide re-check while lifted, in an unreleased companion build (`desktop/test/compact-live.cjs`).

Also verified (November 2): the circuit beat's reading, solution and investigation, live through the service twice on the Lecture 9 slide (exact reading both times; Wonder approved; Muse chose R₄ and Soma found exactly 8 Ω), the circuit drawing, opening and value changes in the browser with a scripted provider, and the whole circuit journey live on the page against a local server, including Find the tipping point.

Not yet verified: the narrated edit, the panel's **Lift into 3D** button in a live Point & ask take (the live check used the compact bar), a signed companion release with the 3D lift, the circuit drawn by the native overlay on the real screen, the circuit investigation and the R₄ drag in the companion panel over the real screen, the circuit on the hosted app, and any non-course diagram. No final video URL exists yet. Save, reopen and Try a fresh example are no longer in the cut; the form describes them.
