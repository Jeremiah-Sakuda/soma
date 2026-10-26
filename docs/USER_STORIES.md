# Soma personas and user stories

**Implementation handoff, October 26, 2026.** The audience is students already using AI who want a useful study session ready from their changing coursework, with interactive lessons worth exploring and revisiting. These personas are hypotheses grounded in Jeremy’s workflow and earlier secondary research; they are not completed customer interviews.

Use these stories to validate the experience and prioritize the build. The [PRD](PRD.md) owns release scope and acceptance gates; [Demo and Evaluation](DEMO_AND_EVALUATION.md) provides the measurement and demo protocol. Story acceptance is intended behavior until its implementation has been exercised.

## Signature experience

Open a ready lesson card showing its concrete trigger, enter the interactive lesson, and immediately manipulate a meaningful relationship. Inspect the actual course source and agent action behind it; optionally answer a question and see the response shape the next activity. Scheduled changes must prepare or update activities without a conversational prompt. Direct requests and revisits remain first-class uses, with no compulsory diagnostic. When a student checks independent application, link the earlier and fresh later attempts, sources, help used, actual delay, and next action. A simulated timeline cannot become measured learning evidence.

Soma is the agent’s name in the experience. Spark is the Meta model executing the relevant reasoning and browser work. Jeremy’s consumer Muse workflow supplies the origin story.

## Proposed personas

### Student already managing several AI tools

This student uses an AI assistant for explanations or practice alongside an LMS, email, notes, and a task list. They can get useful output, but still assemble the relevant context and revisit it when courses change. Their trigger is a new lecture, an unfamiliar concept, an assessment announcement, or returned work. They choose Soma if its interactive lessons are worth opening and revisiting, and keeping those lessons current reduces recurring preparation without a larger correction burden. Validate what becomes easier or more useful alongside the tools they already use.

**Interview evidence to seek:** a recent preparation session; the actual tools and files used; changes that forced rework; active preparation time; and the minimum account access they are comfortable granting. Jeremy is the initial example, not evidence that every student shares the problem.

### Student with limited study windows

This student studies around work, other courses, or personal commitments. The immediate difficulty is deciding what to do in the available time and starting quickly. They may also fit the first persona. They choose Soma if a single lesson or short session is relevant, adjustable, and easy to resume, with no penalty for exploring before assessment, asking for help, or stopping early.

**Interview evidence to seek:** the last interrupted or abandoned study session, how priorities were chosen, whether preparation consumed the available time, and what made the student return later. Avoid inferring a disability, learning style, or fixed attention span from this behavior.

### Returned work as a critical situation

A student receives feedback but cannot tell what to practice next. They need Soma to distinguish a possible conceptual gap from a transcription error, arithmetic slip, lateness deduction, or misunderstanding of the question. This is a situation both personas encounter, rather than a separate demographic segment.

## User stories and acceptance

### S1 Connect my actual semester

**Story:** As a student with several courses, I want to choose which academic sources Soma follows so that prepared practice reflects my semester and stays within the access I intended. **Priority:** P0. **PRD:** R1 and R7.

- A student can select courses, review ambiguous source mappings, and see the access scope before collection begins.

- Each source shows its last successful check and whether it is current, connecting, disconnected, or needs attention.

- A second student can onboard through the supported flow without application changes; accounts keep sources, credentials, and learning history separate.

- An unsupported provider offers a clearly labeled import alternative rather than appearing connected.

### S2 Keep lessons and practice current when my class changes

**Story:** When my professor changes an exam date or coverage, I want Soma to update the affected lesson or session and explain the change so that my preparation stays relevant. **Priority:** P0. **PRD:** R2, R3, R4, and R11.

- A source event or scheduled check starts collection without a new study prompt. A manual refresh exercises the same path.

- An applicable announcement updates the assessment and affected activities; personal extensions and unrelated deadlines remain intact. A timing-only change reprioritizes valid lessons without regenerating their teaching content. A source update with no relevant effect leaves activities unchanged.

- A topic removed from this exam leaves this exam’s session, while its course material and earlier attempts remain available.

- Conflicting or unclear sources remain visibly unresolved. Repeated reads produce no duplicate updates.

- The student can inspect the supporting passage, the previous and resulting recommendation, and why the update affected priority, lesson selection, or content.

### S3 Open request and revisit an interactive lesson

**Story:** When I encounter a concept I want to understand, I want to open a prepared lesson or request one from my coursework, manipulate it, and return to it later. When I choose to attempt a question, that response helps determine what comes next. **Priority:** P0. **PRD:** R3, R4, R5, and R11.

- The student can open a prepared lesson without a prompt or request “Show me how this works” from a course passage, problem, or concept. Both paths use the same checked lesson service. A single lesson and 10, 20, or 45 minute sessions remain available.

- Each recommendation identifies its basis: a student question, current course material, an applicable deadline, confirmed coverage, due review, or observed attempt. A suspected weakness is not required.

- Meaningful controls reveal the relationship the lesson teaches. The student can explore before answering, change the course or topic, adjust session order, pause, resume, skip, and reopen a current lesson without regeneration or a repeated diagnostic. Session length is an estimate.

- If lesson preparation is incomplete or the topic is unsupported, usable ordinary practice remains available with its source status visible. Exploration, tours, and step completion alone do not create independent-understanding evidence.

### S4 Get help while preserving evidence of my own work

**Story:** When I struggle, I want the right amount of help and another opportunity to try so that I can find out what I understand independently. **Priority:** P0. **PRD:** R5 and R10.

- Offer an initial attempt when appropriate; a student may request a hint, explanation, or worked example without being forced through an attempt.

- Save the original response, the help provided, and later revisions separately. A correct response after viewing the solution is assisted evidence.

- Feedback shows the applicable criteria and source, and a student can disagree or correct an interpretation.

- After help, offer a fresh question when the student chooses to check independent application. Repeating an exposed question is not fresh transfer evidence. A fresh response can revise the suspected gap and the next recommended lesson, support, or review, including after restart.

- Show specific results in the learning-evidence view, alongside any later fresh attempt on the same concept. Preserve the help used and actual delay, explain how the evidence informs the next action, and leave independent application unconfirmed after assisted success alone.

### S5 Turn returned feedback into the next exercise

**Story:** When returned work suggests a gap, I want Soma to investigate the cause and prepare relevant follow-up so that I know what to work on next. **Priority:** P0. **PRD:** R9.

- Show the returned response and instructor annotation behind the interpretation; ask for clarification when the material is unreadable.

- Treat a suspected misconception as a hypothesis and ask a focused diagnostic before committing to remediation.

- A correct diagnostic can lead directly to a transfer check. An arithmetic slip and a conceptual error lead to different support.

- A late penalty or incomplete submission alone does not become evidence of weak understanding.

- A corrected transcription or interpretation changes the next recommendation.

### S6 See what I can do when I return

**Story:** When I return, I want to see whether I can apply a concept without the help I needed before so that my next practice responds to demonstrated understanding. **Priority:** P0. **PRD:** R5, R6, and R10.

- Attempts, assistance history, confirmed preferences, and review dates survive refresh and a later sign-in.

- Card ratings schedule later review; they remain distinct from scored independent responses.

- Source revisions invalidate affected questions and preserve historical attempts against their original versions.

- Due reviews fit within the selected session; the student can defer them without an expanding mandatory workload.

- The paired evidence screen shows the actual date, question, response, help used, outcome, and elapsed interval for both attempts. “Solved without hints two days later” requires a fresh successful attempt and a matching recorded delay. Simulated timelines remain labeled, and unsuccessful attempts remain visible.

### S7 Correct the agent and control my practice history

**Story:** When Soma makes a wrong assumption, I want to correct it and see the effect so that I can rely on it without giving up control. **Priority:** P0. **PRD:** R3, R7, and R10.

- The student can correct a course mapping, fact, interpretation, or study preference and see the affected recommendation change.

- A one-time choice does not silently become a permanent preference; reusable preferences are explicit and editable.

- Source corrections retain their scope and evidence. A new general announcement does not silently erase an applicable personal extension.

- Disconnecting stops new collection. Workspace deletion removes imported content and practice history under the product’s deletion behavior.

- An instruction embedded in imported coursework cannot mark assignments complete or alter learning evidence. In the injected-email test, valid coverage information still updates practice while the unauthorized command has no effect.

- Practice history is private to the student; there is no automatic disclosure to an instructor or another product.

### S8 Recover when a source stops working

**Story:** When a connection expires or an update fails, I want to know what Soma last checked and how to recover so that I do not mistake old information for current information. **Priority:** P0. **PRD:** R2 and R7.

- A failed check preserves previously collected material, marks the source stale, and shows the last successful check.

- Authentication expiry produces a reconnection action; recovery collects missed changes without duplicates.

- Existing practice remains usable with a freshness warning. Soma does not claim that unchanged local data proves the external course is unchanged.

- Corrections and reconnection effort count toward the preparation-time comparison.

## Additional context

### S9 Let real commitments shape my next study session

**Story:** When a confirmed interview or personal event changes my available study window, I want Soma to explain the effect and prepare an appropriate next session so that I can act without rebuilding the context. **Priority:** P0. **PRD:** R12.

- Connect or import selected calendar context and relevant email; display the actual access mode and freshness.
- Use my declared focus windows and explicit goals. Do not assume every empty calendar gap is available or rank career above classes by default.
- Show the source, changed commitment, affected activity, and before/after recommendation together.
- Preserve a valid lesson when timing alone changes. A shorter offered session leaves remaining practice visible and does not alter exam scope or learning evidence.
- A non-overlapping event can leave the recommendation unchanged. Repeated email/calendar observations of one event cannot consume availability twice.

### S10 Correct a commitment without losing control

**Story:** When Soma mistakes a suggested time for a confirmed event or matches the wrong deadline, I want to see the evidence, correct it, and have that correction affect the next recommendation. **Priority:** P0. **PRD:** R7 and R12.

- Proposed slots remain tentative until supported or confirmed. A display name or high model confidence does not establish source authority.
- Ambiguous identity, time, timezone or source conflict stays visible rather than silently rewriting a commitment.
- Corrections survive restart and remain isolated to my account; stale sources show their last successful check.
- Soma updates its own recommendation. It does not send messages, move calendar entries, submit applications, or delegate tasks.

The scope is context and consequences. A career pipeline, résumé builder, interview coach, and calendar optimization are outside P0; see [Scope Update](SCOPE_UPDATE.md).

**Notion tasks and Granola lectures:** Read selected tasks or import notes and transcripts when they improve priorities or support practice. Preserve a transcript’s distinction from its generated summary, and keep task completion separate from evidence of learning. Direct integrations are conditional additions after the core stories work; imported material can demonstrate their value. A replacement task workspace, lecture recorder, and external task writeback are outside the hackathon core.

## First session and return journey

**First session:** choose sources and courses → review any ambiguity → open a prepared lesson or request one from coursework → manipulate and explore → optionally attempt a question or request help → inspect what follows and save the next action. Activation requires a useful learning interaction, including purposeful exploration; importing files alone does not qualify.

**Reason to return:** the student wants to revisit a lesson or explore another concept, a course change has revised upcoming activities, a relevant review is due, or the next exercise follows an earlier attempt. Measure voluntary lesson opens, direct requests, revisits, and assessed attempts separately from sessions a researcher asks the student to complete.

## Discovery and pilot validation

Observe a recent real preparation task before presenting the concept. Ask the student to show where assessment scope came from, what they uploaded or copied, what became outdated, and how they decided what to practice. Record their current AI tools and workarounds.

Then walk through S2, S3, S4, and S5 with original example material. Ask the student to explore a lesson, explain why an activity changed, identify what the agent knows versus suspects, correct one error, and choose what help they want. Record whether they want to request or revisit a lesson and their willingness to delegate specific sources; agreement that the idea sounds useful is not evidence of adoption.

Use five interviews as a proposed discovery target and seek three willing pilot students including Jeremy. Report actual participation. Recruitment and observation are next actions; no interviews, commitments, or learning results are implied by this draft.

## Decisions these stories should settle

- Do students choose the lessons, request another, or revisit one, and does recurring preparation create enough effort to justify adding Soma to their existing tools?

- Which sources are necessary for a useful first session, and what access will students delegate?

- Can students understand and correct the reasons for a recommendation?

- Does flexible assistance preserve a useful independent follow-up without making the experience frustrating?

- Does Soma save net effort after setup, verification, corrections, and reconnection are counted? Use the student’s actual workflow as the baseline and the PRD’s separate three-case StudyFetch comparison to test competitive claims.

