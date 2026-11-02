# Soma — three-minute demo script

November 1, 2026 positioning update of the PM153 script (kept in git history), revised November 2. Following the [story](STORY_AND_DEMO.md): the range beat lifts the search into 3D on the real screen, then shows the second checked subject, a circuit slide run live through the same flow; the close adds one line about reach. PM153 still holds for everything else: Jeremy on camera at the open and close, every spoken line burned in as a caption, and the checked search drawn by the native overlay directly on the Preview window. This is a production script, not a record of captured footage.

The journey is one continuous live run on the original Lecture 14 slide (`docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf`), followed by about 25 seconds of range: the 3D lift and a second live slide, the original Lecture 9 Wheatstone bridge (`docs/examples/hero-circuit/Lecture-9-Bridge.pdf`).

**The promise:** your own slide becomes the explorable thing. Soma draws the checked search on the screen you are already looking at. Built for students first; the same idea reaches any diagram you can't edit.

**End-card line:** Turn what you're studying into something you can explore.

**Voice:** Jeremy, first person, conversational. Describe the experience, not the architecture. Honest scope goes in the small on-screen labels, not in the voiceover.

## Checked facts the footage must match

These values come from Soma's solver and have been confirmed in live runs (`.local/pm132/hero-live`):

- The cheapest route is A → C → B → D → F, cost 7. B improves from 4 to 3 when C settles; on the overlay this is the tag "④ D = 4" and later the equation tag "4 + 3 = 7 < 11", with the printed A–F line struck once.
- BFS (fewest edges) takes A–F directly, cost 11.
- Cutting D–F gives A → C → E → F, cost 9.
- The tipping point on A–F is exactly 7. At 7 the routes tie; below 7 the direct edge wins.
- In 3D, F rises to 7 on the ruler; the route strings are taut and A–F hangs with "11 · slack 4".

The circuit beat's values come from Soma's circuit solver and were confirmed in two live service runs (`.local/circuit/live`):

- B and C both sit at 8 V, so R₅ carries exactly 0 A (tag "R₅: 0 A", dashed). R₁ and R₂ carry 2 A, R₃ and R₄ carry 1 A, and the battery 3 A.
- Opening R₂ sends about 0.4138 A through R₅ from B to C (tag "R₅ ≈ 0.4138 A →"); C rises to about 9.103 V.
- The tipping point: the current in R₅ is exactly zero when R₄ is 8 Ω, and reverses on either side.

If a take shows anything else, stop and retake. Never narrate a value that is not on screen.

## Script and shot plan

The "On screen" column describes what the viewer sees. The "Spoken" column is the voiceover, or Jeremy's words when he is on camera. Every spoken line also appears as a burned-in caption (see Edit rules). Each beat also carries a small label in the corner of the screen.

| Time | On screen | Spoken | Small on-screen label |
| --- | --- | --- | --- |
| 0:00–0:10 | **On camera.** Jeremy at the desk, the laptop screen visible behind or beside him with the Lecture 14 slide open. | Every student has sat with a slide like this: one worked example, and the question you actually have isn't on it. | — |
| 0:10–0:22 | Screen capture, Preview full screen. Jeremy holds ⌃⌥Space and circles the graph with the cursor. The translucent Soma panel slides in at the edge of the screen. | *(to Soma)* "Why doesn't it just take the direct A-to-F edge?" | Original demo slide · live run |
| 0:22–0:50 | The drawing appears **on the slide itself**: a loop around A, then C, then B. The pastel tags "① A = 0", "② C = 1" and "③ B = 3" sit beside their nodes; the dashed "F ≤ 11" turns into "4 + 3 = 7 < 11"; the printed A–F line gets one slash. The companion pointer flies to each node. The caption reads "Round n of m". | Muse Spark reads my slide, and Muse Wonder reads it again on its own to check every weight before Soma runs the real algorithm right on top of it. There's the moment the lecture skipped: going through D costs seven, so the direct edge loses. Every loop and number here is computed, not drawn by a model. | Read by Spark · checked by Wonder (green line: all 6 nodes, 9 weights confirmed) · computed by Soma · wait shortened, actual [n] s |
| 0:50–1:08 | Jeremy clicks the D–F line on the slide. A red ✕ appears and the route redraws along A–C–E–F with "= 9". The caption reads "You cut D–F. Checked route: A → C → E → F, cost 9." Hold. | Now my own question. What if D-to-F weren't there? I cut it, right on the slide. New route, cost nine. Instantly, with no model call. | Your experiment · 0 model calls |
| 1:08–1:46 | Jeremy restores D–F, types or says "Would the direct A-to-F edge ever be the better route?" and clicks **Investigate my question**. The panel shows Muse's choice, A–F, with its reason under "Why this connection", and the tie at 7. He drags the slider 11 → 8 → 7 → 6 and the route moves onto the slide's A–F arc. Then a second question, "What would make the route stop going through B–D?" Muse picks B–D this time; tie at 3. | Then I ask Soma to test my question. Muse picks the connection my question is about, and Soma proves exactly where the answer flips. At seven the two routes cost the same; below seven, the direct edge wins outright. A different question, and Muse picks a different connection. The model chose the experiment; the code proved the answer. | Muse chose the connection · Soma computed the boundary |
| 1:46–2:00 | Jeremy asks the follow-up, which is typed or spoken. The answer appears in the panel, about the current experiment. **How Muse made this** opens for 3 seconds to show the Wonder review line. | When I ask why, the answer is about the experiment I'm running. And before this explanation reached me, Muse Wonder checked it against Soma's computed trace. In one run it caught Spark settling two vertices at once and sent it back. | Muse Voice Transcribe · Spark · Wonder review |
| 2:00–2:08 | Jeremy clicks **Save exploration** and reopens it from the library in the same state. Then **Try a fresh example**: a new graph from the same family, with the answer hidden. | Everything I explored is saved, and Soma can make a fresh problem from the same idea. | Saved revision · fresh practice |
| 2:08–2:16 | Back on the slide. Jeremy clicks **Lift into 3D** in the panel (⌘L if he is using the compact bar). The search lifts off the slide on the real screen: each vertex rises to its checked distance on the ruler, the A–C–B–D–F strings pull taut, and A–F hangs slack, labelled "11 · slack 4". Hold on the settled view. | And the answer has a shape. Every height is a checked distance: the shortest route pulls tight, and the direct edge hangs slack by exactly four. | 3D lift · heights and slack computed by Soma |
| 2:16–2:31 | Preview switches to the Lecture 9 bridge slide. Jeremy presses ⌥Space and types "Why is there no current through R5?" Soma draws on the slide: "B = 8 V", "C = 8 V", the dashed "R₅: 0 A", and every current with its arrow. He clicks R₂ on the slide: a red ✕, and "R₅ ≈ 0.4138 A →" appears. Hold. | And it isn't only graphs. On a circuit slide, Soma solves the circuit exactly: B and C both sit at eight volts, so nothing crosses the bridge. I open R-two, and now current flows through it. | Original demo slide · live run · solved exactly by Soma, Kirchhoff checked · wait shortened, actual [n] s |
| 2:31–2:48 | **On camera.** Jeremy, with the slide behind him showing the route drawn on it. | The slide didn't change. What changed is that I could ask it my question and see why, with the math checked. I built Soma for my lectures, but every diagram you can't edit has questions like mine. | — |
| 2:48–3:00 | End card. | Built this week with Muse Spark, Muse Wonder and Muse Voice Transcribe. Turn what you're studying into something you can explore. | Soma · live app URL · github.com/Jeremiah-Sakuda/soma · Built during the Meta Global AI Developer Hackathon, Oct 26–Nov 4 |

[Voiceover-only recording copy](DEMO_VOICEOVER.txt).

## Capture setup

- **Release:** use the deployed production app at the release recorded in `public/release.json`, and a signed companion build that includes the 3D lift (the release after v0.4.0). Record both release IDs with the take.
- **Screen:** 1920×1080, with notifications and the menu bar clock hidden. Preview shows `Lecture-14-Dijkstra.pdf` full screen. The companion loads the hosted app, so the overlay draws over Preview.
- **Point & ask:** hold ⌃⌥Space, circle the graph, and speak. For a silent rehearsal, type the question into the composer first; Point & ask then uses the typed text instead of the microphone.
- **Questions:** "Why doesn't it just take the direct A-to-F edge?", then "Why does it only win once it costs seven or less?" On the circuit slide: "Why is there no current through R5?"
- **Circuit slide:** open `Lecture-9-Bridge.pdf` in a second Preview window, full screen, before the take, so the switch is one keystroke.
- **On camera:** two short pieces to camera, recorded separately at eye level in soft side light. Keep the laptop screen visible but out of focus.
- **Fallback:** if the native overlay misaligns on a take, use **Share a window** on Preview; the same drawing then appears over the capture inside Soma. Say which path the take used in its label.
- **Takes:** each full take costs about $0.15–0.25 of live inference. Record at least three, keep every raw file, and pick the cleanest. Note each take's actual generation time for the "wait shortened" label.

## Edit rules

- **Burned-in captions:** two lines at most, 42 characters per line, bottom centre, white on a 60% dark band. Keep the band clear of the overlay's own caption, which sits under the graph. Quoted questions to Soma go in italics.
- Keep the slide recognizable at all times; the drawing on it is the hero. Don't cut to the diagram view.
- Hold for about a second after every change (a cut, a slider stop, an answer) so the consequence reads in a silent clip.
- Shorten only generation waits, and label each one with the duration measured in that take.
- Show the Wonder catch only from an actual run. If the recorded take's audit has no review rejection, keep "In one run…" as scripted and show the retained receipt from `.local/pm132/hero-live/review-3.json`, labelled "earlier live run, same slide".
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

Also verified (November 2): the circuit beat's reading, solution and investigation, live through the service twice on the Lecture 9 slide (exact reading both times; Wonder approved; Muse chose R₄ and Soma found exactly 8 Ω), and the circuit drawing, opening and value changes in the browser with a scripted provider.

Not yet verified: the narrated edit, Try a fresh example on the hero exploration, the panel's **Lift into 3D** button in a live Point & ask take (the live check used the compact bar), a signed companion release with the 3D lift, the circuit drawn by the native overlay on the real screen, the circuit on the hosted app, and any non-course diagram. No final video URL exists yet.
