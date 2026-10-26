# Soma demo and evaluation

**October 26, 2026. Planned checks, not executed results.** The [PRD](PRD.md) defines release acceptance. This kit turns it into a demo and evidence collection plan. The required submission video is three minutes.

## The story to prove

Soma was doing useful work before the student asked a question. A relevant course event caused an activity to be prepared or updated; the student can immediately explore it; a real answer changes what follows.

Keep the lesson visually prominent. The agent's job explains the lesson's presence. Learning evidence explains its next step. There is no need to rename lessons into unfamiliar terms or open on an architecture diagram.

## Three-minute storyboard

| Time | On screen | What must be real or labeled |
| --- | --- | --- |
| 0:00–0:05 | Ready lesson card with a concrete trigger: “Prepared after your quiz was returned” | The trigger links to an actual run and source, or a clearly identified synthetic event |
| 0:05–0:35 | Enter the lesson and change a meaningful resistor value or arrangement | Prepared/cached status visible; shared model drives the visual and numbers; exploration available without answering |
| 0:35–1:20 | Reveal why this activity matters: source event, before/after consequence, concise reason | Include 10–15 seconds of actual Spark browser work when supported; distinguish recording from live execution and fixture from Blackboard |
| 1:20–2:20 | Student predicts/explains, sees suitable help, and receives a changed follow-up | Preserve original answer and help; show an actual Spark decision and a different next question or configuration |
| 2:20–3:00 | Fresh later attempt, paired evidence, and next action | Actual help, exposure, response and elapsed time; recorded pilot labeled; simulated delay never passed off as observed |

One course and one coherent learning objective carry the video. Other courses remain visible in the working build without a lengthy tour. The direct-request path, source injection case, detailed tool trace, account tests, and full metrics belong in the judge route or supporting evidence.

Do not force a contradictory-diagnostic branch, direct request, security test, and every integration into the same three minutes. The opening manipulation and the causal source-to-follow-up connection need room to be understood.

The ideal successful ending is “Solved with a hint” beside “Solved without hints two days later.” Use it only when records support it. If the later response needs help or is wrong, show that result and the useful next action. If no real delay exists, show the actual interval or a persistent simulated label; do not hide the gap.

## Source and lesson coherence

Use the original [development scenarios](fixtures/DEVELOPMENT_SCENARIOS.md). Their revised exam includes series/parallel resistors and excludes capacitor transients. The proposed flagship family fits that scope. Date-only changes alter priority; they do not require generating new physics content. Coverage changes alter exam eligibility without deleting course history.

A returned mistake is a hypothesis to investigate, not proof of a current misconception. A correct diagnostic should allow direct fresh application. An arithmetic slip should not be recorded as a topology misunderstanding.

The fixture dates are simulated academic dates. Real pilot records use real timestamps. Start real paired attempts October 30 if ready and revisit November 1; October 31/November 2 is another possible pair.

## Judge experience

Provide a no-sign-in “Try a lesson” entry over original synthetic course material. Open an approved prepared lesson immediately. Let a judge inspect its source and reason, manipulate it, answer a question, and see a bounded live follow-up. A supported direct request and revisit should also work.

Create an isolated expiring session for each judge. Use the same preparation, attempt, and evidence services as the student application; do not build a separate scripted judging backend. Prepared public content can be shared, private responses cannot.

Distinguish:

- Live Spark inference from stored output.
- A prepared artifact from generation happening now.
- Authorized source collection from an upload.
- An actual browser recording from a fixture replay.
- Real time from simulated time.

The activity view shows actual actions and concise evidence-based reasons. It does not reveal private internal reasoning. If a service fails, show the failure and offer the labeled prepared alternative.

## Development and held-out data

The fixture document contains 18 inherited development cases and seven additional flagship cases. All are exposed to the builder and suitable for debugging.

After the relevant behavior is frozen, create separate release sets: ten source-change scenarios, ten returned-work examples, ten supported lesson requests, and five unsupported/invalid lesson cases. Use independent human review for reference labels, scientific checks, and instructional fit. Keep release inputs out of prompts, retrieval, fixture seeds, and tuning. A case used to fix behavior becomes development data and must be replaced before claiming an unseen result.

Some sample records may serve multiple reviewed purposes, but name the overlap and report denominators separately. Do not present reused scenarios as additional independent evidence.

## Release gates and required records

| Gate | Pass condition | Evidence to retain |
| --- | --- | --- |
| Source-to-artifact autonomy | With the UI closed, a scheduled applicable update produces a durable useful consequence without a conversational prompt; a follow-up read occurs when necessary | Trigger, actual source/tool events, before/after state, artifact version |
| Accounts and semester | Five-course workload and ten isolated test accounts pass; a second student can onboard without code edits | Cross-account denial, storage and job checks, actual supported scope |
| Live source support | At least two live source types update automatically, with restart and expired-auth recovery | Provider/institution support matrix, last-success times, recovery outcome; uploads identified |
| Change reasoning | At least 9/10 unseen cases resolve correctly or request genuinely necessary clarification | Human reference, applicability, citations, result, errors and clarification rate |
| Returned work | Ten unseen examples yield supported interpretations and relevant follow-up, or necessary clarification; lateness alone is never conceptual weakness | Original page/region, transcription, diagnostic, student correction, next action |
| Practice quality | At least 30 reviewed items across courses/formats/versions; all critical facts correct or visibly unresolved, no unsupported answer in the sample | Sources, answer criteria, reviewer outcomes and rejected items |
| Numerical model | At least five independently calculated cases spanning representative, boundary and limiting behavior; units and assumptions reviewed | Reference derivation, tolerance policy, implementation output, reviewer |
| Source and instructional fit | Published sample is supported; controls expose the intended relationship; fresh checks apply it in a different condition | Source excerpts, control purpose, frozen follow-up and rubric |
| Generator | At least 8/10 unseen supported requests publish checked lessons with no manual artifact edits, within configured budgets | Every request, output, checks, repairs, elapsed time, usage, failure reason |
| Negative cases | All five invalid/unsupported cases withhold unchecked labs and offer suitable ordinary practice or clarification | Missing assumptions, out-of-range inputs, unsupported objectives, bad units, stale source |
| Runtime and loading | Controls, reset/resume, representative frames, keyboard, reduced motion and text/numeric alternative work; 9/10 ready loads usable within 3 seconds on stated setup | Browser results, cold/warm labels, device/network, failures |
| Learning evidence | Original response, assistance, revisions, exposure, timestamps and versions persist; new evidence can revise interpretation and next action | Restart record, contradictory diagnostic, changed follow-up, actual interval |
| Version integrity | Meaningful source revisions invalidate affected future content; date-only changes preserve valid lessons; publication races cannot expose obsolete versions | Source/lesson IDs, supersession, history, rejected publication |
| Injection and controls | Legitimate academic facts can apply while embedded commands cannot change tasks, permissions, evidence or external records | Before/after state and actual actions; disconnect/delete/preference tests |
| Operational budget | Model, retry, image, browser and worker usage fit configured caps; 20 percent API reserve protected | Measured usage, token/spend caps, concurrency behavior, failure costs |
| Judge route | No sign-in required; ready lesson and bounded real adaptation work through shared services in isolated sessions | Clean-session run, access check, rate limits, mode labels |

Correctly requesting clarification is useful when ambiguity is real; blanket abstention does not prove the agent works. Report the proportion of requests actually completed and the reasons for deferral alongside the 9/10 score.

A passing schema, consistent gauges, or another model's approval does not establish scientific correctness. Five reference cases check the calculation model; they do not certify every generated explanation or prove educational impact.

Privacy failures, unsupported critical facts, incorrect published scientific behavior, and lost/misattributed attempts block the affected beta. Ordinary-practice fallback can keep the application usable but must not be counted as a successful lab generation.

## Three separate product evaluations

### 1. Actual student workflow

Compare Soma with each student's existing process, including consumer Muse and tools they already use. Use three comparable events: a new lecture, changed exam coverage, and returned work. Record the exact starting context and quality standard before timing.

For an ordinary practice task, use a usable five-question session with supported answers and correct scope. For a lesson task, agree on a relevant manipulable relationship and fresh application check. Compare the same required outcome across workflows rather than requiring a competitor to reproduce Soma's UI.

Record active student time from source availability until the activity passes the agreed quality check and can be used. Include finding material, exports, uploads, prompts, correction, verification, reconnection, and any manual preparation of Soma's inputs. Record initial setup, background waiting, and builder maintenance separately. A 20-minute timeout is a failure, not zero minutes of effort.

The 50 percent reduction target uses this baseline: (baseline active minutes − Soma active minutes) / baseline active minutes. Calculate only when both complete and baseline time is positive; report excluded pairs and failures separately. Show individual paired outcomes, not just an average.

### 2. StudyFetch comparison

Use the same three cases and the best accessible current StudyFetch workflow, including Guided Chatting, Calendar, Mini Apps, and relevant integrations. Record test date, tier, feature access, inputs, setup, recurring steps, output quality, corrections, and whether the student uses the result.

An inaccessible institutional connector is a limitation of the test setup, not proof that the competitor lacks it. Report parity and Soma's weaknesses. Do not replace the student's real baseline with a deliberately manual competitor workflow. See [Research](RESEARCH.md).

### 3. Interactive lesson versus ordinary practice

Use two comparable independently reviewed learning objectives, comparable time/source coverage, and fresh questions frozen before the intervention. Rotate the order across available testers. Record prior familiarity, help, skips, exposure, elapsed time, and intervening study.

Evaluate reasoning as well as numerical output. If there are too few usable observations, report usability and specific attempts without claiming a learning advantage. Three students cannot establish causal learning gains, grade improvement, or semester-long retention.

## Pilot targets and observation record

Target Jeremy returning on three separate days and two other willing students completing two sessions each. Record actual recruitment and use. Ten synthetic test accounts do not count as ten users.

Activation can be purposeful exploration, a useful worked example, or an attempt. Report assessed responses separately. Distinguish prompted tests, voluntary opens, direct requests, and revisits.

For each observation record: participant alias; date; course type; task; workflow/version/tier; available sources; setup, active, waiting and maintenance time; uploads/prompts/corrections; accepted output; critical errors; completion; spontaneous or prompted use; item and source versions; original response; revisions; help; novelty; scoring criteria; actual delay; and next action.

## Release report to produce during the build

No report is filled out yet. Before release, create a dated record containing:

1. Build revision, deployed URL, exact tested source/model support, and known limitations.
2. Each gate's denominator, pass/fail/clarification count, executed command or observation, and remaining defect.
3. Generator outputs and repair/failure costs; no cherry-picking successful artifacts.
4. Pilot counts and paired preparation results, with excluded cases and builder intervention.
5. Separate StudyFetch and learning comparisons, including access limits and inconclusive findings.
6. Demo segment labels, public-use permissions, original contributions, third-party notices, and accessible assets.

The result can support a competitive submission. It cannot establish a predicted ranking or a guaranteed prize.

