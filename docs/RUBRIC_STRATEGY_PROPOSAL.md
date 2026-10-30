# Soma rubric strategy proposal

**Proposal for audit, October 26, 2026. Not adopted.** The [PRD](PRD.md), [Build Plan](BUILD_PLAN.md) and [Demo and Evaluation](DEMO_AND_EVALUATION.md) remain authoritative until Jeremy adopts specific changes and they are recorded in [Decisions](DECISIONS.md). Scores here are advisory judgment, not a predicted ranking. Origin: build-log entries PM004 and PM007.

## Purpose

Raise Soma's expected Stage Two score and its final-round video ranking. The proposal adds no feature category, second quantitative family or extra Meta model. Correctness, privacy and honesty gates stay as strict as they are now. Most changes reorder existing PRD scope or move effort. Four need Jeremy's decision (section 6).

## 1. How Soma will be judged

From [the participant guide](sources/PARTICIPANT_GUIDE.txt):

- **Stage One** is pass/fail on theme fit and reasonable Meta model use. Soma should pass.
- **Stage Two** scores 0–10 on Impact (30%), Use of Meta AI Tooling (25%), Technical Depth & Execution (20%) and Demo (25%). Judges use the code, the live product and the three-minute video.
- **Stage Three** takes the top five per track. Build for Your World and Push the Frontier entries compete for the same five Indie slots. Final judges watch the videos live and rank them with the same rubric.
- The guide lists "simple 'AI for Education' Chatbots" among generic anti-projects.

## 2. Verifiable claims

Auditors check each claim and mark it confirmed, refuted or stale.

| ID | Claim | Evidence |
| --- | --- | --- |
| C1 | The runtime model is `muse-spark-1.3` through the Responses API, with `reasoning.effort: 'low'` on every call | `src/lib/server/meta-client.ts:6`, `:112` |
| C2 | Lesson preparation is capped at 4 model calls and investigations at 8 | `src/lib/server/budget.ts:11`, `:13` |
| C3 | Preparation discloses sources in 4,000-character slices | `src/lib/server/meta.ts:45`, `:143` |
| C4 | Nothing in `src/` sends images to the model or lets the model drive a browser | Absence claim; re-grep `src/`; `docs/AGENTIC_STATUS.md:7` |
| C5 | The browser connector opens owner-selected URLs and reads page text; the model does not direct navigation | `src/lib/server/connectors/browser.ts:209–218` |
| C6 | Spark proposes a discriminating experiment (baseline, one changed parameter, an observable, two competing predictions), and application code checks that the predictions are distinguishable | `src/lib/domain/diagnostics.ts:18–46`; `src/lib/server/investigator.ts:101` |
| C7 | A lesson shows "Preview, not checked" until its validation status is `checked`; the production hero lesson showed it on October 26 | `src/components/lesson-stage.tsx:27`; production observation |
| C8 | Requests above 24,000 bytes are rejected, which blocks inline base64 images | `src/lib/server/meta-client.ts:7`, `:114` |
| C9 | Reconciled live preparation cost about $0.008–0.010 per run in two development checks | `docs/IMPLEMENTATION_STATUS.md:58` |
| C10 | The PRD puts 10–15 seconds of Spark computer use in the demo; the October 26 build-plan refinement makes it conditional | `docs/PRD.md`, "Meta tooling and agent behavior"; `docs/BUILD_PLAN.md:89` |
| C11 | Reading returned-work images (R9) is existing P0 scope and is not implemented | `docs/PRD.md` R9; `docs/AGENTIC_STATUS.md:23`; C4 |
| C12 | The current schedule gives November 1–2 to evaluation and November 3 to the video | `docs/BUILD_PLAN.md:29–31` |
| C13 | The pre-event planning baseline `1a7d3a2` is dated 11:10 AM ET on October 26; the first code commit `87747d7` is dated 12:42 PM ET | `git log --reverse --date=iso` |
| C14 | The GitHub repository is private, and the rules require a public one | `docs/DECISIONS.md:80`; guide section 4 |
| C15 | At runtime `8ff0b47`, 327 default checks and 19 browser journeys passed, with CI passing at `8d24a5f` | `docs/IMPLEMENTATION_STATUS.md:98–100` (reported, not rerun for this proposal) |
| C16 | Recurring selected-source processing has been enabled every 15 minutes as a best-effort fallback. No work was due in the two verified ticks, and no live Soma OAuth read has happened yet | `docs/IMPLEMENTATION_STATUS.md:104`; source-support table in the same file |
| C17 | The first frozen-engine unseen synthetic run scored 1 of 4. A later independent v4 run passed 2 of 2 | `docs/IMPLEMENTATION_STATUS.md:74`, `:76` |
| C18 | The application development spend cap is $2, with about $0.81 recorded against it | `docs/IMPLEMENTATION_STATUS.md:98`, `:104`; `src/lib/server/budget.ts:29–35` |

## 3. Baseline assessment (judgment)

Scores assume the current documents are executed as written. The judge-simulation auditor (A2) scores independently before reading this section.

| Criterion | Weight | Current plan | With this proposal | Reasoning |
| --- | --- | --- | --- | --- |
| Impact | 30% | 6 | 7.5 | A firsthand, recurring problem with a sharp hook, but a crowded category. The first screen reads as a study app, and there is no measured result yet |
| Meta tooling | 25% | 5.5–6.5 | 8 | Tool use is sound and bounded but text-only at low reasoning effort (C1–C5). The most distinctive capability (C6) sits mid-video |
| Technical depth | 20% | 8 | 8.5 | Deployed and tested, with validated citations, deterministic physics, a budget ledger and account isolation. The risk is whether a time-limited judge can see it |
| Demo | 25% | 6 | 8 | The two-resistor visual is clean but modest. The course is synthetic, the hero lesson says "Preview, not checked" (C7), and video production gets one day (C12) |
| **Weighted** | | **~6.4** | **~8.0** | |

**Assumption to challenge:** finalists probably need about 8.5, plus at least one memorable moment. Field size and score distributions are unknown.

## 4. Proposed changes

Each change names the criterion it targets, what it builds on, what it displaces and how to tell it worked.

### S1 — A returned-work image feeds the discriminating diagnostic

**Targets:** Meta tooling, Demo. **Builds on:** R9 (existing scope) and C6.

- Accept a returned-work image, either through the Gradescope route or as a labeled upload.
- Spark reads the visible answer and annotations. It keeps the instructor's comment, the student's answer and its own inferred explanation separate, then proposes two hypotheses.
- Reuse the existing diagnostic loop:
  1. Spark proposes an experiment.
  2. The application checks that it is informative.
  3. The student predicts.
  4. Spark explicitly revises the hypotheses.
- First, verify the Meta image-input contract and resolve C8, either with an image URL reference or a separately bounded request limit for this path. Time-box: 2 hours.
- Compare `low` and `medium` reasoning effort on the development diagnostic cases. Adopt `medium` only if validated results improve within budget.
- Image and reasoning-effort experiments must fit the application spend cap (C18). Raising the cap needs Jeremy's approval.

**Displaces:** nothing new; R9 is already planned for Day 4.

**Done when:**
- One real or labeled returned image produces a cited interpretation, an informative experiment and a changed next activity through actual Spark calls.
- A late-penalty example produces no conceptual diagnosis.
- The held-out R9 cases report their true denominator.

**Risk:** illegible handwriting, or image cost. **Fallback:** a typed transcription that the student confirms, labeled as such.

### S2 — The video's trigger is real and arrives unprompted

**Targets:** Impact, Demo and the Best Agentic Use-Case bonus.

- The ready card's reason comes from a real source event, such as Jeremy's returned work or a real course message.
- A background job processes it with no conversational prompt, and the card shows the actual timestamp.
- Recurring processing already runs (C16). What remains is a real source: Jeremy's Google consent and a first live Soma OAuth read, or the returned-work route from S1.

**Displaces:** nothing; scheduled collection is an existing release gate.

**Done when:** footage shows a real source event, then the background job, then the ready card, with the source and job labels visible.

**Fallback:** a labeled synthetic event, keeping S1.

### S3 — The video runs on a real course (needs D1)

**Targets:** Impact, Demo.

The resistor family fits a synthetic course, but Jeremy has moved demonstrations to his actual classes (P023). Unless an actual class teaches a fitting concept, the real-course path shows only text practice. That looks closest to the chatbot pattern the guide warns against. Section 6, D1, sets out the options.

### S4 — One measured impact result

**Target:** Impact.

- Use the PRD's active-minutes protocol ([Demo and Evaluation](DEMO_AND_EVALUATION.md), "Actual student workflow"). Time Jeremy's existing preparation workflow and Soma on 2–3 real events.
- Start October 27, because real events arrive on their own schedule.
- Report cost per prepared lesson from the ledger, and voluntary returns.
- Label the result as one participant. Make no learning-outcome claim.

### S5 — Video-first schedule

**Target:** Demo.

- Draft the script and shot list on October 27, so the build produces what will be filmed.
- Capture real agent runs when they happen; they cannot be replayed on demand.
- Spend two production days on the video (November 2–3), get a fresh-viewer review from two or three people, and submit by noon on November 4.

### S6 — Present Soma as a verifiable agent

**Targets:** Technical depth, Meta tooling.

- Use the vocabulary of Meta's own "Agents 102: Best Practices for Verifiable Agents" session (October 28): exact-quote citations, deterministic numerical checks, immutable observations and bounded spend.
- In the README, give a 60-second judge path, the event contribution record (C13), one reliability number from the generator gate, and the cost figure (C9). Report the reliability number with its denominator and the earlier failures (C17).
- Optional, low weight: record any Muse Code use in the build, since the guide lists it among the ways to use Meta tooling.

### S7 — Optional: Spark computer use on one course page

**Targets:** Meta tooling, Demo. **Conditional:** go/no-go on October 30.

Attempt this only after S1 passes and Browserbase keys exist. Keep it read-only and limited to one selected course page, with a four-hour time-box and labeled real footage. Never present the existing scripted navigation (C5) as model computer use.

## 5. Proposed schedule

| Date | Current plan (Build Plan) | Proposed |
| --- | --- | --- |
| Oct 27 | Scaffold, auth, deployment, access experiment, family choice (largely complete on Oct 26) | Decide D1 after at most 3 hours of real-course source review. Draft script v0 and the shot list. Start S4 baseline timing. Request Google consent for S2 |
| Oct 28 | Ingestion and a changed source; checked model | S1 image contract and returned-work path. Under D1(b), build the new family model and five reference cases |
| Oct 29 | Day 3 generator gate (4 of 5) | Day 3 gate unchanged. S2 background trigger on a real source |
| Oct 30 | Complete journey, returned feedback, begin pilots | Complete journey on the chosen course. First real footage. S7 go/no-go |
| Oct 31 | Feature freeze | Feature freeze unchanged. Script v1 |
| Nov 1 | Correctness, recovery, accessibility, delayed follow-ups | Same correctness work. Generator held-out set (10 supported, 5 negative) |
| Nov 2 | Held-out evaluation, pilot report | Remaining held-out checks. Video production day 1. README and contribution record |
| Nov 3 | Video and submission draft | Video production day 2. Fresh-viewer review. Privacy sweep of the public repository |
| Nov 4 | Final checks, submit by 9 PM ET | Submit by noon ET and record the confirmation |

## 6. Decisions for Jeremy

| ID | Decision | Options | Recommendation |
| --- | --- | --- | --- |
| D1 | Which course and quantitative family carry the video | (a) Keep resistors on the labeled synthetic course. (b) Replace the single family with one that fits a concept in a real class, passing the existing numerical, source-fit and instructional gates. (c) Keep resistors for the interactive lesson and run S1 as a text diagnostic on a real course | (b) if a fitting computable relationship turns up within 3 hours of review; otherwise (a). Under (b), the new family meets the Day 3 gate one day after it exists, so revert to (a) on Oct 29 if it fails. (c) splits the video across two courses |
| D2 | Defer the research-grade evaluations | Defer the hands-on StudyFetch comparison, the interactive-versus-ordinary learning comparison and the target of two additional pilot students. Keep Jeremy's own pilot and the generator, numerical, change-reasoning, R9, R12, privacy, injection and judge-route gates | Defer them, and state in the submission that they were not run |
| D3 | R12 in the video | Keep it in the 0:35–1:20 segment (current), cut it to at most 10 seconds, or leave it to the judge route | At most 10 seconds, or judge route only |
| D4 | Schedule | Adopt section 5 | Adopt |

D2 and D3 deviate from [Demo and Evaluation](DEMO_AND_EVALUATION.md). Adopting either requires recording the change in [Decisions](DECISIONS.md).

## 7. What does not change

- One quantitative family for P0. D1(b) replaces the family; it does not add one.
- Sources stay read-only, with no external writes.
- Exact-quote citation validation, deterministic numerical checks, publication gates and the Day 3 stop rule.
- Held-out cases stay out of prompts and tuning.
- Synthetic, prepared, replayed, uploaded and simulated-time material stays labeled in both the product and the video.
- Budget caps and the 20 percent allocation reserve.
- The October 31 feature freeze and the November 4, 9 PM ET deadline.
- No private course material, credentials or learner records go into the public repository or video without Jeremy's explicit approval.

## 8. Open questions

- Does the Meta Responses API accept image input for `muse-spark-1.3` in a form the client can send, and what does a page cost?
- Does any of Jeremy's actual classes teach a computable relationship that fits a typed lesson specification?
- Will Google consent and Browserbase keys arrive in time for S2 and S7?
- Is `medium` reasoning effort worth its latency and cost on diagnostic calls?
- How large is the Indie field, and is there really a discount for education entries? This cannot be known; auditors state their assumptions.

## 9. Audit protocol

### Rules for every auditor

- Stay read-only except for your own findings file, `docs/audits/2026-10-26-<lens>.md`. Do not edit any other file (including `docs/BUILD_LOG.md` and `docs/build-log/prompts.json`), commit, push, deploy or change cloud settings. Jeremy's coordinating session records the audit in the build log. Other sessions may have uncommitted edits in this tree; leave them alone.
- Make no live model calls. Do not run `npm run check:meta` or enable gated live tests. `npm run typecheck` and `npm test` are allowed.
- Do not open `.env*`, `.local/`, `playwright/.auth/` or any private course material, and do not send repository content to outside services.
- Keep what you verified (with file:line, or the command and its output) separate from judgment.

### Findings format

Give each finding:

- an ID (for example, A1-03);
- the target (a claim, change or decision ID);
- a verdict: confirmed, refuted, partly or unverifiable for facts, and agree or disagree for judgment;
- a severity: blocker, major or minor;
- the evidence;
- a recommendation.

End with an overall verdict (adopt, adopt with changes, or reject) and the three changes you would make.

### Lenses

| Lens | Question | Scope |
| --- | --- | --- |
| A1 Evidence | Are the facts right? | Claims C1–C18 and any unsupported factual statement |
| A2 Judge simulation | How would a time-limited judge score this, before and after the proposal? | Rubric, README, live synthetic demo, storyboard; anchoring-protected |
| A3 Feasibility | Can one builder with coding agents deliver it by the freeze? | S1, S2, S7, D1(b), the section 5 schedule and external dependencies |
| A4 Integrity and rules | Does it keep the invariants, gates, labels, privacy and event rules? | AGENTS.md, PRD gates, participant guide rules, D2 and D3 |

### Ready-to-paste prompts

Run each in a separate agent session at the repository root.

**A1 Evidence**

```text
You are auditing a hackathon strategy proposal for Soma, a Next.js/TypeScript app in this repository. Read AGENTS.md, then docs/RUBRIC_STRATEGY_PROPOSAL.md, and follow its section 9 audit rules exactly. Verify every claim C1–C18 in section 2 against the current repository and git history. Mark each confirmed, refuted or stale, citing file:line or the command you ran and its output. Also flag any factual statement elsewhere in the proposal that lacks evidence. You may run npm run typecheck and npm test; do not run live-model checks. Write your findings, in the section 9 format, to docs/audits/2026-10-26-A1-evidence.md and change no other file.
```

**A2 Judge simulation**

```text
Act as a Stage Two judge for the Meta Global AI Developer Hackathon. Follow the audit rules in section 9 of docs/RUBRIC_STRATEGY_PROPOSAL.md, but do not read sections 3–6 of that file until you have recorded your first scores. Read the rubric in docs/sources/PARTICIPANT_GUIDE.txt (section 8). Then spend only the time a busy judge would: read README.md, open https://soma-woad-beta.vercel.app in a browser (use the synthetic demo only; do not create an account or sign in), and read the three-minute storyboard in docs/DEMO_AND_EVALUATION.md. Score Impact, Use of Meta AI Tooling, Technical Depth & Execution and Demo from 0–10 with a one-sentence reason each, and write down what you would still remember an hour later. Next, read the full proposal, rescore assuming it is executed as written, and say which changes move your scores and which do not. Finally, name the strongest alternative strategy within the existing product scope. Write your findings to docs/audits/2026-10-26-A2-judge.md and change no other file.
```

**A3 Feasibility**

```text
Assess whether the proposal in docs/RUBRIC_STRATEGY_PROPOSAL.md can be delivered by one builder working with coding agents between October 27 and the October 31 feature freeze, with submission on November 4. Follow its section 9 audit rules. Read AGENTS.md, docs/BUILD_PLAN.md, docs/IMPLEMENTATION_STATUS.md, docs/AGENTIC_STATUS.md and docs/PRODUCTION_READINESS.md, plus src/lib/server/meta-client.ts, meta.ts, investigator.ts and budget.ts, and src/lib/domain/diagnostics.ts, circuit.ts and lessons.ts. For S1, S2, S7 and D1(b), give: an estimate in focused hours; the external dependencies (Meta image input, Google consent, Browserbase keys); the files that would change; and the riskiest assumption. If you have web access, check Meta's official documentation for image input to muse-spark-1.3 and cite the page. If the schedule does not fit, propose specific cuts. Write your findings to docs/audits/2026-10-26-A3-feasibility.md and change no other file.
```

**A4 Integrity and rules**

```text
Check docs/RUBRIC_STRATEGY_PROPOSAL.md against the product invariants in AGENTS.md, the release gates in docs/PRD.md and docs/DEMO_AND_EVALUATION.md, and the hackathon rules in docs/sources/PARTICIPANT_GUIDE.txt (new work only, public repository, rights to code and assets, anti-projects, and a demo that shows only event-built work). Follow the proposal's section 9 audit rules. Flag any change that would:
- weaken a gate without saying so;
- blur the labels between live, prepared, synthetic, uploaded and simulated material;
- expose private course data in a public repository or video; or
- overstate what Soma does, for example by presenting scripted navigation as model computer use.
Confirm that D2 and D3 are listed as deviations. Write your findings to docs/audits/2026-10-26-A4-integrity.md and change no other file.
```

### After the audits

1. Correct or withdraw every refuted claim.
2. List where the lenses disagree, especially A2's scores against section 3.
3. Revise this proposal and cite the findings that changed it.
4. Jeremy decides D1–D4.
5. Record adopted changes in the [Build Plan](BUILD_PLAN.md), [Demo and Evaluation](DEMO_AND_EVALUATION.md) and [Decisions](DECISIONS.md), with a build-log entry.
