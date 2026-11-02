# Soma — the story we are telling

November 1, 2026 positioning update. This document owns how Soma is described everywhere: README, submission copy, video, desktop notes and answers to judges. It supersedes the PM129 framing (engine-led, "visual learning companion"), kept in git history. Product scope stays in the [PRD](PRD.md); this is a positioning decision, recorded in [DECISIONS.md](DECISIONS.md), not a new feature commitment.

## The positioning

**Students first, the capability second.**

- **Tagline (unchanged):** Turn what you're studying into something you can explore.
- **What Soma is:** Soma turns a diagram on your screen into an experiment whose answers are computed, not guessed. Meta's Muse models read the source and choose what to investigate; Soma's own solver computes the result and draws it back onto the source, where you can change it and see what happens.
- **Who it's for first:** students and independent learners with a worked example in front of them and a question it doesn't answer. Graph search is the first checked subject, because every computing student meets it.
- **How far it reaches:** the checked part of the pipeline doesn't depend on the picture being a lecture slide. Learning is where Soma starts and what it demonstrates in depth; it is not "one application of a platform".

## Why this framing (weighed against the rubric)

| Criterion | What the framing has to do | How students-first, capability-second does it |
| --- | --- | --- |
| Stage One theme fit: "Build for Your World" brings Meta models into a firsthand domain | Stay firsthand | Soma grew out of its builder's own study workflow; the hero is a student and a lecture slide |
| Impact, 30%: potential, identifiable beneficiaries, significance, likelihood of use | Name who benefits and show the ceiling | A concrete beneficiary today, plus an honest account of how far the same capability reaches |
| Demo, 25% | Pitch and footage must match | The video proves the student journey end to end; breadth is shown only where it has been run |
| Meta tooling, 25% / technical depth, 20% | Unchanged by framing | The differentiator is the pattern: the model reads and chooses, the code computes, the answer is drawn on the source |

A tutor-only framing undersells the capability and invites comparison with a crowded field of AI study tools. A platform framing ("learning is just one application") would score the platform we describe against the one domain we show, demote our best evidence to an example and weaken theme fit. The middle path keeps the demonstrated beneficiary as the hero and lets judges see the ceiling.

## The human problem

A slide shows one worked example, and the question you actually have isn't on it. What if this connection weren't there? Why doesn't it take the direct route? Getting from that question to an answer you trust usually means redrawing the example in another tool, or asking a chatbot that may confidently get the numbers wrong.

Soma removes that reconstruction step. The material you are already looking at becomes the experiment, and the numbers on it are computed rather than generated.

## Beyond the course

The same questions turn up wherever people reason over connections they can't edit: a transit map, a network diagram, a delivery route. Soma's checked step is not tied to the classroom. Muse reads a picture into a typed graph, Soma's solver computes on it, and the overlay draws the result back onto the picture. The solver already runs on any weighted graph Spark can read (nonnegative costs, up to 12 nodes and 24 edges): in testing, 8 of 8 fresh original graph images were read exactly ([verification](VERIFICATION.md)). Each new kind of diagram needs a solver, a schema and a renderer, not a new product.

**Status, stated plainly:** Soma has been built and demonstrated on course material. Uses beyond the classroom are potential. Say so in those words until a non-course diagram has been run live through the same flow (see the optional video beat below).

## The demonstration

One continuous live run on the original Lecture 14 slide, drawn by the native overlay on the real Preview window, then a short look at how far it goes. The [three-minute script](DEMO_VIDEO_SCRIPT.md) owns timing and wording.

1. **The moment (on camera):** every student has sat with a slide like this.
2. **Ask on the slide:** Point & ask, "Why doesn't it just take the direct A-to-F edge?" The checked search is drawn on the slide itself.
3. **My own experiment:** cut D–F on the slide; new route, cost 9, no model call.
4. **Muse chooses, Soma proves:** Muse picks the connection a question is about; Soma computes exactly where the answer flips (7).
5. **Why, checked:** the follow-up answers the experiment in progress; Muse Wonder checked the explanation against the computed trace.
6. **Keep it:** save, reopen, and a fresh problem from the same idea.
7. **The answer has a shape:** lift the search off the slide in 3D. Every height is a checked distance; the shortest route pulls taut and the direct edge hangs slack by exactly 4.
8. **How far it goes:** if an original non-course diagram has been run live, show it for a few seconds with the same question and a checked answer. Otherwise show the Soma lab engine, labelled as a recorded Muse run.
9. **Close (on camera):** the slide didn't change; what changed is that I could ask it my question and see why, with the math checked.

**The emotional arc:** confusion → control → consequence → possibility.

## Words we use and words we avoid

| Use | Avoid |
| --- | --- |
| explore, experiment, "what if", on your own slide or screen | AI tutor, study buddy, chatbot |
| computed, checked, the code proves the answer | "accurate", "guaranteed" for anything Muse generates |
| "starts with students", "built for students first" | "learning is just one application", "platform", "any domain" |
| "could", "potential", "the same idea applies" for uses beyond the classroom | named user groups beyond students as if they already use Soma |
| "no study or adoption figures are claimed" | minutes saved, grade gains, user counts |

## Claims boundary

- **Checked:** BFS and Dijkstra routes, distances, cuts, tipping points and the 3D heights and slack. Everything else (explanations, mechanisms, general screenshots) is generated, labelled and reviewable.
- **Demonstrated:** the student journey on the Lecture 14 slide, in the browser and on the real screen.
- **Potential:** diagrams beyond the classroom; further checked subjects such as DC circuits.
- **Not claimed:** measured learning gains, adoption or time saved.

## Use the right document

- [Three-minute script and shot plan](DEMO_VIDEO_SCRIPT.md): what to say and show, footage status and edit rules.
- [Submission copy](SUBMISSION.md): paste-ready descriptions, impact, Meta and technical framing, judge answers.
- [Evidence and production handoff](SUBMISSION_EVIDENCE.md): which artifact supports each claim and what still needs footage or release verification.
- [Demo operation](DEMO.md): entry paths, the take and fallbacks.

The written framing is ready for review. No narrated video has been rendered or published by this documentation change, and the repository remains private until publication is separately authorized.
