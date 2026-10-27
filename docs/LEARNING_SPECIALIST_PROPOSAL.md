# Soma learning evidence specialization proposal

**October 27, 2026. Proposed experiment following Jeremy's identification of this as a place for Muse to shine.** The PRD and current build plan remain authoritative. This proposal specifies a candidate technical centerpiece; it does not select a training provider, authorize compute spending, or make a tuned model a release dependency.

## Product purpose

The [Learning Graph Scope](LEARNING_GRAPH_SCOPE.md) defines the product loop this experiment could improve. Fine-tuning is a conditional stretch; connected evidence, interactive diagnosis and revision must work through the existing Spark path independently of a trained adapter.

Soma prepares useful study activities from course content and the context around it. Its model must interpret limited evidence about understanding: why a student may have made a mistake, what remains uncertain, and which interaction would help distinguish plausible explanations.

The research hypothesis is that a Muse model adapted on reviewed learning-evidence examples can make these decisions more reliably than the same model with prompting alone. The student-facing result is a better next activity in the existing Ready Card and lesson experience. Learning gains are a separate claim requiring learner evidence.

## The task to specialize

Given relevant course passages, a small connected set of learner records, and a new observation, propose a justified interpretation update and a useful next diagnostic interaction.

| Input | Proposed output |
| --- | --- |
| Versioned course passages and supported objective | The source-supported relationship relevant to the response |
| Original response, help, exposure and prior interpretations | Plausible explanations, their evidence and unresolved alternatives |
| New supporting or contradictory observation | Which interpretation to retain, weaken or revise, with a concise reason and evidence references |
| Approved activity capabilities | A question or checked experiment whose expected responses distinguish the remaining explanations, or a justified decision to seek clarification or retain the current activity |

The difficult task is choosing explanations and informative interactions for unfamiliar evidence. Training that only produces valid JSON or repeats deterministic answer-to-hypothesis matching would not establish meaningful improvement.

The graph remains explicit, versioned memory. Training teaches reusable interpretation behavior; each student's changing records remain retrievable context. A proposed update passes the same source, ownership, uncertainty, numerical and publication checks as the existing engine. Original observations and assistance stay intact. No model learns private student facts through automatic weight updates.

## Demonstration

Use the existing returned-work story: an observed mistake admits two plausible explanations; Muse prepares a diagnostic; the student gives a response that contradicts the initial interpretation; Muse changes the evidential support and selects a useful next activity. A single response does not prove a diagnosis or mastery.

If specialization wins the comparison, show one unseen case where the base and tuned models receive the same evidence but choose meaningfully different diagnostics or interpretations. Present the complete evaluation results alongside the selected example, including cases where the tuned model is worse. If the base model already succeeds, retain that success rather than manufacturing an apparent failure.

## Data and comparison

Begin with text and structured observations from the current supported scope. Returned-work image extraction remains its own existing implementation and verification task. Do not combine a new perception model, another quantitative family and a new training objective in this experiment.

Use original synthetic cases or appropriately licensed and authorized material. Review the instructional judgments independently; teacher-model output is a draft label, not ground truth. Existing permission to process a private source for one preview does not authorize training on it.

Include ambiguous errors, prerequisite versus local mistakes where supported, assistance and repeated exposure, contradictory evidence, irrelevant grade deductions, unsupported conclusions, and cases where no change is useful. Keep a separate evaluation set grouped by source/problem family so paraphrases of a training example do not become apparent generalization. No numerical success target or dataset size is established by this proposal; set these before running the frozen evaluation.

Compare three routes with the same evidence access, tools and validators: the prompted base open-weight model, its tuned counterpart, and the existing Spark path. Give the base a reasonable prompt and demonstrations. Assess interpretation support, diagnostic usefulness, appropriate uncertainty, and changes after contrary evidence. Also record schema validity, citation integrity, latency, failures and total serving cost. Human review is required for instructional quality; automated checks cannot establish it alone.

## Feasibility and adoption

Meta documents LoRA and QLoRA for [Glimmer](https://dev.meta.ai/docs/muse-glimmer/post-training), including a single-H100 QLoRA recipe. It also documents hosted [Spark Open training](https://dev.meta.ai/docs/muse-spark-open/post-training); the Fireworks private-adapter serving route requires a dedicated deployment. Actual account access, complete training and serving costs, and deployment fit must be established before selecting a route.

First establish a recurring error on development cases that better prompting and relevant evidence do not resolve. Then prepare reviewed demonstrations and an independent test set. Run a bounded training pilot only when the data and serving path are viable. Start with supervised adaptation; the semantic quality of a diagnostic is not a sufficiently simple automatic reward to justify an RL project here.

Adopt the specialist only if it improves the intended judgments on unseen cases while preserving source and evidence integrity and fitting the remaining latency, budget and deployment constraints. A narrower or cheaper specialist may also be useful if its quality holds up against the existing Spark path. Preserve the October 31 feature freeze and the November 4 submission deadline. The current base-model workflow remains viable if the experiment does not earn adoption.

## Claim the evidence could support

“We specialized Muse to interpret learning evidence and choose more useful diagnostic interactions, and measured its behavior against the base model on unseen cases.”

Use that claim only after the corresponding training and comparison exist. Until then, describe the existing evidence-grounded investigation and adaptation without implying a trained checkpoint or demonstrated improvement.
