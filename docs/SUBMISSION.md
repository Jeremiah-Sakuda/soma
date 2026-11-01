# Soma — submission copy

PM129 · November 1, 2026. Ready-to-edit copy for the event form; exact form fields/length limits have not been confirmed. Current repository: Jeremiah-Sakuda/soma. This draft does not publish or submit anything.

## Project name

Soma

## Tagline

Turn what you’re studying into something you can explore.

## One sentence

Soma uses Meta’s Muse models to turn selected material and a question into an interactive visual explanation that you can manipulate, investigate and revisit.

## Short description

Soma brings interactive explanations to the material you are already studying. Muse interprets the source, composes the visual and helps choose what to investigate. Change a connection, inspect a mechanism or ask about the consequence. Supported graph results are computed by Soma, and explorations can be saved and revisited.

## Main description

A lecture diagram gives you one example. The question you want to ask is often more specific: “What if I change this?” Getting from that question to an experiment can mean rebuilding the example in another tool or finding a demonstration that happens to match.

Soma’s opportunity is to reduce that setup. It is a visual learning companion that starts with selected material and a question, then uses Meta’s Muse models to create an explanation you can explore.

The working graph workflow makes the idea concrete. Muse Spark interprets a screenshot and composes the visual explanation. Soma independently computes supported BFS and Dijkstra results. Change a connection or cost, inspect the consequence, ask a contextual follow-up and reopen a saved revision. The current experiment carries into the explanation.

We also explored a more expressive visual direction: an engine cutaway whose vector artwork, teaching copy and investigation choices were authored by Muse. In this recorded local prototype, Spark selects revealing comparisons or a part inspection; Soma validates the data and supplies constrained motion. A study export preserves the actual prepared question, visual action and explanation.

The potential is a shorter path from encountering a difficult idea to investigating it. For students and independent learners, Soma could bring explorable explanations to their own examples without rebuilding each one from scratch. The graph product demonstrates the existing exploration loop; the engine prototype explores how rich model-authored explanations could become.

## Impact and problem-statement fit

**Track:** Indie Developer / Build for Your World.

**Who could benefit:** students and independent learners working with diagrams, algorithms and technical explanations.

**Why it matters:** the setup needed to make an example explorable interrupts the question that prompted it. Soma could reduce that translation and reconstruction work, giving people a useful way to investigate the material already in front of them.

**What makes the potential credible:** the demo shows an actual source becoming a controllable explanation, a change producing a visible consequence, model-guided investigation and a result the user can keep. Those tangible capabilities make the proposed benefit visible: a question can become an investigation the user controls and keeps.

## Creative use of Meta tooling

Muse contributes to the explanation’s structure and investigation, as well as its words.

- **Muse Spark 1.3:** interprets selected screenshots, composes source-bound visuals, selects informative graph interventions when requested and writes contextual revisions. In the engine prototype, actual recorded Spark responses authored vector paths/refinements and selected visual actions for three prepared questions.
- **Muse Wonder 1.0:** provides advisory review of generated explanations or artifacts. Retained outputs show real findings and repairs; approval is not a guarantee of scientific correctness.
- **Muse Voice Transcribe 1.0:** supports spoken questions in the existing companion. Spoken input is optional to the visual workflow.

Soma validates bounded model data and controls what it can affect. Supported graph paths/costs come from code; the engine uses illustrative constrained motion. Model calls, source identity and recorded/live status are inspectable. Optional spoken playback uses the configured speech provider; Muse authors the explanation.

## Technical execution

The project combines multimodal source interpretation, typed visual composition, independently checked graph computation, interruptible manipulation/playback and owned versioned persistence. Contextual revisions preserve the effective experiment and source lineage. The engine’s recorded guidance and exports are bound to the actual source/film/author artifacts; changed artifacts cannot silently inherit old provenance. Spend and retries are application-bounded.

A fresh original-synthetic service journey demonstrated generation, an edge intervention, contextual revision and exact Firestore reopen. Earlier unsuccessful outcomes are retained. This is concrete development evidence, not a reliability percentage or hosted-UI acceptance claim.

## Built during the event

Event work includes the visual-exploration workflow, checked graph engines/interventions, generated explanatory scenes, contextual revisions/persistence, companion capture/voice interactions and the recorded spatial/engine experiments. The canonical repository retains the original histories and identifies third-party components in [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md). The dated build log identifies event implementation and release status alongside the archived planning and third-party notices.

## What works now and what comes next

**Working product:** selected-context interpretation, supported checked graph experiments, explanatory visuals, contextual follow-ups and saved revisions. The native companion and newer source features have separate release/device verification records.

**Recorded local exploration:** the Muse-authored engine, prepared model-selected investigations and standalone study exports. Generic live engine generation/follow-up/cloud saving is not integrated into the canonical product.

**Opportunity ahead:** connect richer visual explanations to the same exploration workflow, extend checked subjects with appropriate validation, and investigate usefulness with learners. This describes potential and future work, not a new release commitment.

## Project links

- Canonical repository:[Jeremiah-Sakuda/soma](https://github.com/Jeremiah-Sakuda/soma). Currently private; publication requires the user’s separate authorization.
- Existing browser product:[Soma Explore](https://soma-woad-beta.vercel.app/explore). Recheck the clean judge path against the final release before submitting.
- macOS distribution: choose the verified signed release from the canonical repository at final release review. Do not infer that the older binary contains all newer source features.
- Demo video:pending final recording/edit/upload. Insert its actual accessible URL after completion.

## Short answers for judges

**What is the potential impact?**
Soma could reduce the work between a question about a diagram and a useful way to test it. The opportunity is bringing interactive explanations to the learner’s own material, at the moment they want to explore.

**What did Muse actually decide?**
In the graph product it interprets the source and composes the explanation; supported experiment selection is visible in the model record. In the engine study it chose90°/450° and270°/630° comparisons and a450° connecting-rod inspection for exact prepared questions. Those decisions and explanations are retained actual outputs.

**What does “checked” mean?**
Soma computes supported graph results from the interpreted input. It does not make all screenshot readings infallible or turn every explanatory illustration into a quantitative simulation.

**Is the engine generated live in the product?**
The engine shown is a recorded local prototype of Muse-authored art and investigation. It demonstrates that expressive direction; canonical graph generation/revision/saving is a separate working workflow.

**Have you measured learning gains?**
No. We are demonstrating a working capability and its plausible benefit at hackathon scale. The potential is easier access to exploration of a learner’s own examples; any later learning or time-saving claims would need their own evidence.
