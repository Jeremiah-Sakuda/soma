# Soma — the story we are telling

November 1, 2026 positioning update, revised November 2 for the second checked subject. This document owns how Soma is described everywhere: README, submission copy, video, desktop notes and answers to judges. It supersedes the PM129 framing (engine-led, "visual learning companion"), kept in git history. Product scope stays in the [PRD](PRD.md); this is a positioning decision, recorded in [DECISIONS.md](DECISIONS.md), not a new feature commitment.

November 4 UTC alignment: the exact E investigation is now demonstrated through the service (Muse chose D–F, tie 5), followed by a source-preserving explanation and exact save/reopen. Circuit image agreement and R₅ reversal also passed. The candidate is not deployed, and the complete native circuit sequence and final three-minute footage remain pending. [Verification](VERIFICATION.md) retains earlier failed attempts and separates these evidence types.

## The positioning

**Students first, the capability second.**

- **Tagline (unchanged):** Turn what you're studying into something you can explore.
- **What Soma is:** Soma turns a diagram on your screen into an experiment with computed routes, voltages and currents. Meta's Muse models read the source and choose what to investigate; Soma's solver computes consequences of that reading and draws them back onto the source. Reading and explanatory prose remain fallible.
- **Who it's for first:** students and independent learners with a worked example in front of them and a question it doesn't answer. Two subjects are checked live: graph search, which every computing student meets, and DC circuits, which every physics and engineering student meets.
- **How far it reaches:** the checked part of the pipeline doesn't depend on the picture being a lecture slide. Nor does it depend on one subject: the circuit path reuses the same capture, reading, review, drawing and companion as graph search. Learning is where Soma starts and what it demonstrates in depth; it is not "one application of a platform".

## Why this framing (weighed against the rubric)

| Criterion | What the framing has to do | How students-first, capability-second does it |
| --- | --- | --- |
| Stage One theme fit: "Build for Your World" brings Meta models into a firsthand domain | Stay firsthand | Soma grew out of its builder's own study workflow; the hero is a student and a lecture slide |
| Impact, 30%: potential, identifiable beneficiaries, significance, likelihood of use | Name who benefits and show the ceiling | A concrete beneficiary today, plus an honest account of how far the same capability reaches |
| Demo, 25% | Pitch and footage must match | The planned video demonstrates the student journey; breadth is shown only where it has been run |
| Meta tooling, 25% / technical depth, 20% | Unchanged by framing | The differentiator is the pattern: the model reads and chooses, the code computes, the answer is drawn on the source |

Keep the student and the material in front of them central. Explain the broader potential through the shared reading, computation and interaction pattern, while distinguishing that potential from the two demonstrated subjects.

## The human problem

A slide shows one worked example, and the question you actually have isn't on it. What if this connection weren't there? Why doesn't it take the direct route? Getting from that question to an answer you trust usually means redrawing the example in another tool, or asking a chatbot that may confidently get the numbers wrong.

Soma removes that reconstruction step. The material you are already looking at becomes the experiment, and the numbers on it are computed rather than generated.

## Beyond the course

The same questions turn up wherever people reason over connections they can't edit: a transit map, a network diagram, a delivery route. Soma's checked step is not tied to the classroom. Muse reads a picture into a typed graph, Soma's solver computes on it, and the overlay draws the result back onto the picture. The solver already runs on any weighted graph Spark can read (nonnegative costs, up to 12 nodes and 24 edges): in testing, 13 of 13 fresh original graph images with 3 to 12 nodes were read exactly ([verification](VERIFICATION.md)). Each new kind of diagram needs a solver, a schema and a renderer, not a new product, and DC circuits show it: they were added on November 1–2 as a second checked subject on the same pipeline.

**How to say it:** describe uses beyond the classroom as potential ("could", "the same idea applies"), never as something Soma already does for those users. Show one in the video only after a non-course diagram has been run live through the same flow (see the optional video beat below).

## The demonstration

The planned cut follows one continuous live run on the original Lecture 14 slide, drawn by the native overlay on the real Preview window, then the 3D lift and circuit. The [three-minute script](DEMO_VIDEO_SCRIPT.md) owns timing, wording and footage status.

1. **The moment (on camera):** every student has sat with a slide like this.
2. **Ask on the slide:** Point & ask, "Why doesn't it just take the direct A-to-F edge?" The checked search is drawn on the slide itself.
3. **My own experiment:** cut D–F on the slide; new route, cost 9, no model call.
4. **Muse chooses, Soma computes:** ask “What would make the route go through E?” without selecting an edge. Muse chooses a connection; Soma computes its boundary. Actual service runs chose D–F, tie 5, with a route through E above it. Use the actual take's valid choice and value; 7 belongs only to the separate A–F fallback question.
5. **Why, checked:** the follow-up answers the experiment in progress; Muse Wonder checked the explanation against the computed trace.
6. **The answer has a shape:** restore the graph as read, then lift it in 3D. Every height is a checked distance; the shortest route pulls taut and the direct edge hangs slack by exactly 4.
7. **A second subject:** the Lecture 9 bridge. B = C = 8 V, so R₅ carries 0 A. Open R₂: R₅ carries 12/29 A from B to C. Restore the source and ask about R₅ current; in the recorded run Muse chose R₄ and Soma verified reversal around 8 Ω. Follow the actual checked choice in a new take.
8. **Close (on camera):** the slide didn't change; what changed is that I could ask it my question and inspect the computed consequence.

Save/reopen and fresh graph practice remain available for follow-up questions and the form, outside the current three-minute cut. Keep product narration muted during silent verification; service proof is not native footage or a timed final edit.

**The emotional arc:** confusion → control → consequence → possibility.

## Words we use and words we avoid

| Use | Avoid |
| --- | --- |
| explore, experiment, "what if", on your own slide or screen | AI tutor, study buddy, chatbot |
| computed routes and circuit quantities; consequences checked on the interpreted input | claiming code proves source reading or all explanatory prose; "accurate" or "guaranteed" for anything Muse generates |
| "starts with students", "built for students first" | "learning is just one application", "platform", "any domain" |
| "could", "potential", "the same idea applies" for uses beyond the classroom | named user groups beyond students as if they already use Soma |
| "two checked subjects: graph search and DC circuits" | "any subject", or calling the recorded engine lab live |
| "no study or adoption figures are claimed" | minutes saved, grade gains, user counts |

## Claims boundary

- **Checked:** BFS and Dijkstra routes, distances, cuts, tipping points and the 3D heights and slack; DC circuit voltages, currents, opened parts, changed values and tipping points, solved exactly with Kirchhoff's current law checked. Everything else (explanations, mechanisms, general screenshots) is generated, labelled and reviewable.
- **Demonstrated:** the student journey on the Lecture 14 slide, in the browser and on the real screen; the circuit journey on the Lecture 9 slide, live through the service and in the browser.
- **Potential:** diagrams beyond the classroom; further checked subjects such as truss statics.
- **Not claimed:** measured learning gains, adoption or time saved.

## Use the right document

- [Three-minute script and shot plan](DEMO_VIDEO_SCRIPT.md): what to say and show, footage status and edit rules.
- [Submission copy](SUBMISSION.md): paste-ready descriptions, impact, Meta and technical framing, judge answers.
- [Evidence and production handoff](SUBMISSION_EVIDENCE.md): which artifact supports each claim and what still needs footage or release verification.
- [Demo operation](DEMO.md): entry paths, the take and fallbacks.

The written framing is ready for review. No narrated video has been rendered or published by this documentation change, and the repository remains private until publication is separately authorized.
