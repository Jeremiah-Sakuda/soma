# Soma — the story we are telling

November 1, 2026 positioning update, revised November 2 for the second checked subject. This document owns how Soma is described everywhere: README, submission copy, video, desktop notes and answers to judges. It supersedes the PM129 framing (engine-led, "visual learning companion"), kept in git history. Product scope stays in the [PRD](PRD.md); this is a positioning decision, recorded in [DECISIONS.md](DECISIONS.md), not a new feature commitment.

**November 4 UTC delivery:** graphics runtime `73ae70e` and test-duration follow-up `8538cbc` use `soma-3d-2026-11-04`. The signed/notarized 0.4.1 is a private draft; the published installer remains 0.4.0. Current local renderer/controller checks and the labeled silent QA clip do not establish physical native alignment or hosted acceptance, which remain pending after the origin approval rejection. The actual service E investigation (Muse chose D–F, tie 5), source-preserving follow-up/save and circuit image-check/reversal runs remain separate evidence. Final three-minute/native footage is still pending. [Verification](VERIFICATION.md) owns the current full CI result, source identity and retained failures, including the earlier `2e82d9b` checkpoint.

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

The cut opens on a connection disappearing from the graph while the PDF stays open in Preview. Then it returns visibly to the start of that same take. The [three-minute script](DEMO_VIDEO_SCRIPT.md) owns the words, timing and conditional lines.

1. **Show the interaction first:** click D–F on the already-read slide and hold the new route, cost 9. This is an opening excerpt from the retained graph take.
2. **Return to the plain slide:** Jeremy introduces Soma and asks why the direct A–F edge loses. Show the source reading, review and calculated route, cost 7.
3. **Let Muse choose:** clear selection and ask “What would make the route go through E?” The user has named a goal, not a connection. Show the actual chosen edge, its reason and the computed threshold. The verified D–F example ties at 5; values above 5 route through E.
4. **Stay with the experiment:** ask why the route changes while the changed value remains active. The answer must address that state.
5. **Lift the graph:** visibly restore source values, complete the checked search and lift it into 3D. F is at 7. Cut D–F in the lifted view: F rises to 9. Restore the dashed connection: F returns to 7. This interaction is locally renderer-tested at `4611e5e` and requires physical native acceptance before filming. Heights are checked; the curves are schematic.
6. **Reverse a current:** show the balanced bridge, optionally open R₂, then restore it. Muse chooses a component to investigate. In the verified R₄ case, dragging across 8 Ω reverses R₅’s current. Hold on both directions.
7. **Close on the use:** Jeremy can try a question on the diagram he is already studying. Keep the demonstrated scope—graph search and DC circuits—visible on the end card.

Save/reopen and fresh graph practice remain available for follow-up questions and the form, outside the current three-minute cut. Keep product narration muted during silent verification; service proof is not native footage or a timed final edit.

Let the route change, the lift and the current reversal carry the excitement. The narration names the action and explains the result.

## Words we use and words we avoid

| Use | Avoid |
| --- | --- |
| explore, experiment, "what if", on your own slide or screen | AI tutor, study buddy, chatbot |
| computed routes and circuit quantities; consequences checked on the interpreted input | claiming code proves source reading or all explanatory prose; "accurate" or "guaranteed" for anything Muse generates |
| "starts with students", "built for students first" | "learning is just one application", "platform", "any domain" |
| "could", "potential", "the same idea applies" for uses beyond the classroom | named user groups beyond students as if they already use Soma |
| "explore the diagram in front of you"; name graph/circuit examples when showing them | capability exclusions in the opening; universal subject guarantees; presenting a recorded run as live |
| "no study or adoption figures are claimed" | minutes saved, grade gains, user counts |

## Claims boundary

- **Checked:** BFS and Dijkstra routes, distances, cuts, tipping points and the numerical 3D heights/slack; string curve lengths are schematic. DC circuit voltages, currents, opened parts, changed values and tipping points are solved exactly with Kirchhoff's current law checked. Voltage-as-height is available in the browser workspace and current native release source. Generated spatial models and explanations retain their own visible provenance; installed-build acceptance is tracked in VERIFICATION.md.
- **Demonstrated:** the student journey on the Lecture 14 slide, in the browser and on the real screen; the circuit journey on the Lecture 9 slide, live through the service and in the browser.
- **Potential:** diagrams beyond the classroom; further checked subjects such as truss statics.
- **Not claimed:** measured learning gains, adoption or time saved.

## Use the right document

- [Three-minute script and shot plan](DEMO_VIDEO_SCRIPT.md): what to say and show, footage status and edit rules.
- [Submission copy](SUBMISSION.md): paste-ready descriptions, impact, Meta and technical framing, judge answers.
- [Evidence and production handoff](SUBMISSION_EVIDENCE.md): which artifact supports each claim and what still needs footage or release verification.
- [Demo operation](DEMO.md): entry paths, the take and fallbacks.

The written framing is ready for review. No narrated video has been rendered or published by this documentation change, and the repository remains private until publication is separately authorized.


## November 4 positioning clarification

Lead with the action and experience: point at something, ask, explore the resulting visual. Keep topic coverage and expansion in documentation. The app’s cover should not introduce a capability taxonomy or contrast supported topics with everything else.

3D is being introduced where spatial relationships make an explanation useful to explore. Current examples include graph distance and circuit voltage views, alongside generated spatial illustrations. Further subject-specific experiences are a potential expansion, assessed for usefulness and verified behavior. A 3D illustration and a solver-computed experiment have different assurance; describe those facts beside the actual result and in the evidence documentation. Do not promise a checked simulation for every topic.

This changes positioning, not supported models or release acceptance. Keep actionable source, generation, review and save status visible in context.
