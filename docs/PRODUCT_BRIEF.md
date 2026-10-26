# Soma product brief

**Working name: Soma. Implementation handoff, October 26, 2026.**

**Soma is an agent that monitors your courses and keeps your next study session ready.**

It follows changes across authorized academic sources, determines what matters, and prepares interactive lessons and targeted practice. Students manipulate those lessons and attempt fresh questions; their responses shape what Soma prepares next.

**Your coursework changes every week. Your study tools should keep up.**

## The problem

Students already have powerful tools for explanations, practice questions, study plans, and interactive content. The recurring work is keeping the learning activity relevant to actual classes, changing assessment scope, returned feedback, and what the student can currently do.

Jeremy already delegates parts of that work to the consumer Muse assistant, which checks Blackboard, Gradescope, and email and uses a browser when a connector is unavailable. Notion holds tasks and Granola captures lectures. Soma extends that firsthand workflow into prepared learning experiences and persistent evidence. This observation motivates the product; broader demand remains a hypothesis.

## One cohesive experience

A new lecture makes relevant practice available. An exam update changes which activity matters next. Returned work prompts an investigation of a possible gap. The student opens a compelling lesson, changes a meaningful variable, sees the relationship, and optionally tests a prediction. That response changes the follow-up and is preserved for a later visit.

These are parts of one job: keep a useful study session ready. A feature belongs in P0 if it improves the lesson, why it is selected, or what comes next.

The flagship is a checked interactive lesson. It needs to be worth exploring even without an assessment. Automatic preparation, a direct “Show me how this works” action on course material, and reopening a saved lesson all use the same service. Do not bury the lesson beneath administration or make an answer the admission price for exploration.

## Initial audience and scope

The initial audience is college students already using AI alongside several academic tools, especially those who can show a recent preparation task that took recurring effort. A student with a short study window needs the same product to be fast to start and easy to resume. Returned work is an important situation, not a separate demographic.

Support multiple private accounts and full course loads. Five courses and ten isolated test accounts are acceptance workloads. Three real pilots are a target, not confirmed recruitment.

P0 has one verified quantitative model family and at least two meaningful variants. The proposed first family is ideal DC series/parallel resistor networks because it matches the existing course-update and returned-work examples. Other subjects receive source-grounded ordinary practice. Broader course coverage does not imply arbitrary interactive simulations.

## Why Meta

Soma applies Build for Your World to an academic workflow its builder uses firsthand. Muse Spark 1.3 is the proposed runtime reasoning layer for multimodal course material, bounded tools, browser actions, source reconciliation, lesson specifications, and adaptive follow-up.

The strongest demonstration is a real model decision with consequences: Spark follows a relevant source, resolves an applicable change, selects a checked lesson configuration, or revises a suspected gap after a contradictory answer. Soma supplies the browser, source permissions, durable memory, scheduling, and checked numerical execution.

The claim is that Meta's model enables this connected workflow. We have not established that only Meta could do it or that more models would improve it. Glimmer and Wonder are conditional later experiments. Their presence cannot substitute for a working core.

## Positioning in a crowded field

StudyFetch already documents guided activity orchestration, syllabus-based planning, adaptive progress features, and Mini Apps. Generated explanations, flashcards, graphs, and interactivity alone do not establish Soma's differentiation. See [research](RESEARCH.md).

Test three proposed advantages:

1. Less recurring effort from a real external update to a useful current activity.
2. An interactive relationship whose computation, source fit, and instructional purpose have each been checked.
3. Accurate assistance and novelty records that actually change subsequent recommendations.

Compare with the student's existing workflow, including Muse. Run a separate comparison against the strongest accessible StudyFetch workflow; record parity and shortcomings.

The event discourages simple education chatbots. Soma must demonstrate sustained work outside a conversation and a useful persistent artifact. Do not relabel education out of the product or claim that chatbots cannot compute. Keep familiar words such as lesson and practice. Lead with the agent's job and show the lesson immediately.

## Demo opening and close

Open on a ready lesson card: “Prepared after your quiz was returned,” supported by a real or clearly labeled synthetic event. Enter the lesson within five seconds and manipulate it. Then reveal why it is relevant, show actual source work, and capture a response changing the next step.

End with the earlier supported attempt beside a fresh later attempt and the next review action. Use the actual result, help, and elapsed time. A simulated interval stays labeled; a single success is not proof of improved learning.

## Human capability and evidence

Soma applies the broader Asili thesis that people should remain capable as AI takes on more work. Automate preparation while leaving room for the student to reason, inspect, disagree, and choose help. Private practice history is not automatically disclosed to instructors or other products.

Success combines useful lessons students choose to use, net preparation effort saved after corrections, and honest records of independent application. Engagement and visually impressive content are insufficient evidence of learning. The full [PRD](PRD.md) and [evaluation plan](DEMO_AND_EVALUATION.md) define how to test the product.

