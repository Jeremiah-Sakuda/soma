# Soma — three-minute demo script

PM132 · November 1, 2026. Supersedes the PM129 engine-led script (kept in git history). This is a production script, not a record of captured footage. One continuous live journey on the original Lecture 14 slide (`docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf`), then about 20 seconds of range.

**The promise:** your own slide becomes the explorable thing. Soma draws the checked search directly on the screen you captured.

**End-card line:** Turn what you're studying into something you can explore.

**Voice:** Jeremy, first person, conversational. Say the experience, not the architecture. Honest scope goes in the small on-screen labels, not in the voiceover.

## Checked facts the footage must match

Computed by Soma's solver and confirmed in live runs (`.local/pm132/hero-live`):

- Cheapest route A → C → B → D → F, cost 7. B improves from 4 to 3 when C settles.
- BFS (fewest edges) takes A–F directly, cost 11.
- Cut D–F: A → C → E → F, cost 9.
- Tipping point on A–F: exactly 7. At 7 the routes tie; below 7 the direct edge wins.

If a take shows anything else, stop and retake. Never narrate a value that is not on screen.

## Script and shot plan

| Time | On screen | Voiceover | Small on-screen label |
| --- | --- | --- | --- |
| 0:00–0:12 | Lecture 14 PDF full screen in Preview. Cursor circles the graph (Point & ask: hold ⌃⌥Space, circle, speak; or Share a window). | This is the moment I built Soma for. A slide with one example of Dijkstra… and a question it doesn't answer. *(spoken to Soma)* "Why doesn't it just take the direct A-to-F edge?" | Original demo slide · live run |
| 0:12–0:36 | Soma opens with the slide itself as the stage. A is ringed. Step forward: C settles, B's badge drops 4 → 3, D, then F settles at 7 along A–C–B–D–F. Caption card follows each step. | Muse Spark reads my slide, every node and every weight, and Soma runs the real algorithm on top of it. That's the moment the lecture glossed over: B drops from four to three. Each ring and number here is computed, not drawn by a model. | Read by Muse Spark · computed by Soma · wait shortened, actual [n] s |
| 0:36–0:58 | Click the D–F line on the slide. Red ✕; route jumps to A–C–E–F; F's badge reads 9. Caption: "You cut D–F. Checked route: A → C → E → F, cost 9." Hold. | Now my own question. What if D-to-F weren't there? I cut it, right on the slide. New route, cost nine. Instantly, with no model call. The solver answers that. | Your experiment · 0 model calls |
| 0:58–1:30 | Click D–F to restore. Click **Find the tipping point**. Result: Muse chose A–F; boundary 7. Drag the slider 11 → 8 → 7 → 6, slowly. At 7 or below the route jumps onto the slide's A–F arc; the label over the printed 11 reads "11 → 6". | Then I ask Soma for the tipping point. Muse decides which connection is worth testing, the direct edge, and Soma proves exactly where the answer flips. At seven the two routes tie. Below seven, the direct edge wins. The model chose the experiment. The code proved the answer. | Muse Spark chose A–F · Soma computed the boundary |
| 1:30–1:52 | Record question aloud: "Why does it only win once it costs seven or less?" Answer appears on the same slide, about the current experiment. Open **How Muse made this** for 3 seconds: Wonder review line. | When I ask why, the answer is about the experiment I'm running, not a textbook definition. And before an explanation reaches me, Muse Wonder checks it against Soma's computed trace. In one run it caught Spark settling two vertices in one step and sent it back to be fixed. | Muse Voice Transcribe · Spark · Wonder review |
| 1:52–2:12 | **Save exploration**, reopen from the library, same state. Then **Try a fresh example**: a new graph in the same family, answer hidden. | Understanding means doing it again. Everything I explored is saved, and Soma can make a fresh problem from the same idea, hiding the answer until I try it myself. | Saved revision · fresh practice |
| 2:12–2:34 | Toggle **3D workspace** on the same graph (3 s). Cut to the engine lab: turn the crank, open the 90° / 450° comparison (8 s). | The same idea reaches past graphs: the same checked search in 3D, and in our lab, an engine Muse drew and explains. Turn the crank and see why two pistons in the same spot are doing different jobs. | 3D view of the same search · Soma lab · recorded Muse run |
| 2:34–3:00 | Back to the slide with the route drawn on it. End card. | Every student has sat with a slide that shows one example and leaves the real question open. Soma turns that slide into something you can test. Built this week with Muse Spark, Muse Wonder and Muse Voice Transcribe. Turn what you're studying into something you can explore. | Soma · live app URL · github.com/Jeremiah-Sakuda/soma · Built during the Meta Global AI Developer Hackathon, Oct 26–Nov 4 |

[Voiceover-only recording copy](DEMO_VOICEOVER.txt).

## Capture setup

- **Release:** the deployed production app at the release recorded in `public/release.json`. Record the release ID with the take.
- **Screen:** 1920×1080, browser zoom 100%, Soma in a full-screen window. Close other tabs; hide bookmarks and notifications.
- **Source:** open `docs/examples/hero-dijkstra/Lecture-14-Dijkstra.pdf` in Preview, full screen. For Point & ask, use the signed Mac companion (it loads the hosted app, so the overlay is included). Fallback: **Share a window** on the Preview window, or **Upload screenshot** with `lecture-14-dijkstra.png`. Say which path the take used in its label.
- **Question:** speak or type exactly "Why doesn't it just take the direct A-to-F edge?" The follow-up is "Why does it only win once it costs seven or less?"
- **Takes:** each full take costs about $0.15–0.25 of live inference. Record at least three, keep every raw file, and pick the cleanest. Note each take's actual generation time for the "wait shortened" label.

## Edit rules

- Keep the slide recognizable at all times. The overlay is the hero; don't cut to the diagram view.
- Hold for about a second after every change (cut, slider stop, answer) so the consequence reads in a silent clip.
- Shorten only generation waits, and label them with the measured duration from that take.
- Show the Wonder catch only from an actual run. If the recorded take's audit has no review rejection, say "In one run…" (as scripted) and show the retained receipt from `.local/pm132/hero-live/review-3.json`, labelled "earlier live run, same slide".
- The engine segment is a recorded Muse run in the Soma lab. Keep its label on screen and never splice it after source capture as if it were generated live.
- Product narration is muted under the voiceover. If product audio is heard, credit the configured speech provider; Muse writes the words, not the voice.

## Status

Hero journey verified live through the service (PM132 test) and in the local UI with the overlay (upload → generation with Wonder review → cut → tipping point → slider). Not yet verified: the hosted UI after deployment, native Point & ask with the overlay, Try a fresh example on the hero exploration, and the narrated edit. No final video URL exists yet.
