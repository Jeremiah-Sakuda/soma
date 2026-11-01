# Soma — three-minute demo script

PM153 · November 1, 2026. Supersedes the PM132 script (kept in git history) for three changes: Jeremy is on camera at the open and close, every spoken line is burned in as a caption, and the checked search is drawn by the native overlay directly on the Preview window rather than inside Soma's own window. This is a production script, not a record of captured footage.

The journey is one continuous live run on the original Lecture 14 slide (`docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf`), followed by about 20 seconds of range.

**The promise:** your own slide becomes the explorable thing. Soma draws the checked search on the screen you are already looking at.

**End-card line:** Turn what you're studying into something you can explore.

**Voice:** Jeremy, first person, conversational. Describe the experience, not the architecture. Honest scope goes in the small on-screen labels, not in the voiceover.

## Checked facts the footage must match

These values come from Soma's solver and have been confirmed in live runs (`.local/pm132/hero-live`):

- The cheapest route is A → C → B → D → F, cost 7. B improves from 4 to 3 when C settles; on the overlay this is the tag "④ D = 4" and later the equation tag "4 + 3 = 7 < 11", with the printed A–F line struck once.
- BFS (fewest edges) takes A–F directly, cost 11.
- Cutting D–F gives A → C → E → F, cost 9.
- The tipping point on A–F is exactly 7. At 7 the routes tie; below 7 the direct edge wins.

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
| 2:00–2:12 | Jeremy clicks **Save exploration** and reopens it from the library in the same state. Then **Try a fresh example**: a new graph from the same family, with the answer hidden. | Everything I explored is saved, and Soma can make a fresh problem from the same idea, hiding the answer until I try it. | Saved revision · fresh practice |
| 2:12–2:30 | The **3D workspace** on the same graph (3 s). Cut to the engine lab: Jeremy turns the crank and opens the 90° / 450° comparison (8 s). | The same approach reaches past graphs: the checked search in 3D, and in our lab, an engine Muse drew and explains. | 3D view of the same search · Soma lab · recorded Muse run |
| 2:30–2:48 | **On camera.** Jeremy, with the slide behind him showing the route drawn on it. | The slide didn't change. What changed is that I could finally ask it my question, and see why the answer is what it is, with the calculation checked. | — |
| 2:48–3:00 | End card. | Built this week with Muse Spark, Muse Wonder and Muse Voice Transcribe. Turn what you're studying into something you can explore. | Soma · live app URL · github.com/Jeremiah-Sakuda/soma · Built during the Meta Global AI Developer Hackathon, Oct 26–Nov 4 |

[Voiceover-only recording copy](DEMO_VOICEOVER.txt).

## Capture setup

- **Release:** use the deployed production app at the release recorded in `public/release.json`, and the signed companion v0.4.0. Record the release ID with the take.
- **Screen:** 1920×1080, with notifications and the menu bar clock hidden. Preview shows `Lecture-14-Dijkstra.pdf` full screen. The companion loads the hosted app, so the overlay draws over Preview.
- **Point & ask:** hold ⌃⌥Space, circle the graph, and speak. For a silent rehearsal, type the question into the composer first; Point & ask then uses the typed text instead of the microphone.
- **Questions:** "Why doesn't it just take the direct A-to-F edge?", then "Why does it only win once it costs seven or less?"
- **On camera:** two short pieces to camera, recorded separately at eye level in soft side light. Keep the laptop screen visible but out of focus.
- **Fallback:** if the native overlay misaligns on a take, use **Share a window** on Preview; the same drawing then appears over the capture inside Soma. Say which path the take used in its label.
- **Takes:** each full take costs about $0.15–0.25 of live inference. Record at least three, keep every raw file, and pick the cleanest. Note each take's actual generation time for the "wait shortened" label.

## Edit rules

- **Burned-in captions:** two lines at most, 42 characters per line, bottom centre, white on a 60% dark band. Keep the band clear of the overlay's own caption, which sits under the graph. Quoted questions to Soma go in italics.
- Keep the slide recognizable at all times; the drawing on it is the hero. Don't cut to the diagram view.
- Hold for about a second after every change (a cut, a slider stop, an answer) so the consequence reads in a silent clip.
- Shorten only generation waits, and label each one with the duration measured in that take.
- Show the Wonder catch only from an actual run. If the recorded take's audit has no review rejection, keep "In one run…" as scripted and show the retained receipt from `.local/pm132/hero-live/review-3.json`, labelled "earlier live run, same slide".
- The engine segment is a recorded Muse run in the Soma lab. Keep its label on screen, and never splice it in after source capture as if it had been generated live.
- Mute product narration under the voiceover. If product audio is audible, credit the configured speech provider: Muse writes the words, not the voice.

## Status

Verified:
- the hero journey, live through the service (PM132);
- the native overlay on the real Preview window: alignment across the rounds and a clean final frame (PM139–PM153);
- the hosted app at release `soma-pm153-review-2026-11-01`.

Not yet verified: the narrated edit and Try a fresh example on the hero exploration. No final video URL exists yet.
