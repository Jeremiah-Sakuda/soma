# Soma student-hub scope update

**October 26, 2026. Implementation direction, not a claim of completed behavior.** This update extends the existing learning product with a small shared view of commitments. The [PRD](PRD.md) retains R1–R11 and adds R12. Continue the current implementation; do not restart or replace the learning engine.

## Product decision

**Soma keeps students ready as their classes and commitments change.**

Soma follows authorized course material, relevant email, and selected calendar context. It identifies what changed, explains the consequences for the student's next steps, and prepares a useful activity. Learning is the deepest action it can perform: interactive lessons, targeted practice, and evidence-based follow-up. Career and personal commitments initially supply context and source-linked next actions.

The continuing loop is:

**Change → affected commitments → supported next action → ready learning activity when appropriate → response → updated next step.**

A broader home screen earns its place only when context from one area changes a useful recommendation in another. Showing unrelated widgets does not pass this test.

## What changes now

| Capability | First-build boundary |
| --- | --- |
| Shared commitments | Academic deadlines plus explicit interviews, application deadlines, and selected personal busy events |
| Calendar context | Read selected events or a labeled import; use declared focus windows and actual busy intervals |
| Relevant email | Extract a supported change, time, or next action within the student's selected scope; keep source and uncertainty |
| Consequence tracking | Record which planned study activity is affected, what changed, and why; preserve unaffected lessons |
| Today | One integrated view of changes needing attention, upcoming commitments, and prepared activities; the lesson remains immediately accessible |
| Agent decisions | Reprioritize or revise Soma's own recommendations and prepared sessions; keep external records read-only |
| Learning | Retain existing checked lessons, direct request, revisit, optional assessment, attempts, assistance and review |

No full career pipeline, résumé builder, interview coach, email client, or calendar editor is added. An explicit application deadline can appear as a commitment with its source link. “Applied,” “interviewing,” “rejected,” and “offer” must not be inferred merely from the existence of an email thread, and P0 does not maintain that lifecycle.

## Patterns worth applying

### Commitments have meaning and evidence

A source-linked interview has a confirmed time; an application has a due date; exam preparation is an activity serving an assessment. Keep these distinctions rather than turning everything into an identical checklist row.

Use a small record: workspace, title, category, kind (event or deadline), optional course/assessment link, start/end or deadline, source references and versions, confirmation/conflict state, and a source link for the next action. Optional effort estimates must record whether the student supplied them or the system proposed them. A model's confidence score cannot grant authority.

Reuse existing course/assessment records through references. Do not create divergent duplicate academic deadlines. A calendar copy and an email describing the same event should converge when identity is supported; ambiguous matches remain unresolved.

### Changes produce inspectable consequences

Represent a narrow set of links: activity prepares for commitment; source supports fact; event limits a declared focus window. A changed source can affect those links and the resulting recommendation.

Store a consequence record with the triggering version, affected IDs, before/after facts, rule or supported interpretation, and result. A timing change updates priority or session fit. A scope change changes exam eligibility. Changed teaching facts can invalidate content. Unrelated commitments should not regenerate lessons.

This extends the existing evidence graph in Firestore; it does not require a graph database, graph canvas, or general constraint solver.

### Model judgment stays bounded

Spark interprets the source, resolves a supported identity, investigates missing context, proposes relevant next steps, and adapts learning. Deterministic code validates references, ownership, source applicability, time arithmetic, deduplication, publication freshness, and numerical models.

Authority depends on the connected source and its relationship to the affected event, not a convincing display name or text instruction. An interview invitation is not automatically an accepted booking. A proposed time stays tentative unless the relevant evidence or student confirmation establishes it.

For P0, internal recommendation updates may happen automatically. Sending replies, moving calendar events, submitting applications, delegating tasks, and making commitments for the student remain excluded.

### Show results and recover from changed inputs

Reuse the existing durable job and artifact state machinery. Before making a recommendation current, verify the relevant source and workspace revision. Retry boundedly or mark the result stale when context changed during preparation. Read back the saved version to confirm it exists; a model response is not proof of persistence.

The activity view can say “Study session revised” with the observed before/after result. It cannot say “Interview rescheduled” when only Soma's suggestion changed. Do not introduce a second external-action ledger or a large policy engine for a read-only product.

### Let the demonstration change

Offer a small number of controls that change underlying data: the interview overlaps the focus window, it does not overlap, or it is only tentative. The resulting recommendation must differ appropriately. The same services process real sources and isolated judge fixtures; a scenario label must not select a predetermined successful outcome.

This is useful evidence of the agent and rule boundaries, not an invitation to build a broad simulation playground.

## One coherent flagship example

Use original synthetic sources and a clearly labeled simulation clock:

- The student selected a 45-minute focus window, 16:00–16:45.
- A confirmed interview update and matching calendar event occupy 16:20–17:00. They are two observations of the same commitment, not two separate busy events.
- The exam and its current scope remain unchanged. The confirmed interview leaves 20 minutes inside the declared focus window.
- Soma records the consequence, reuses the current checked resistor lesson, and prepares a suitable 20-minute study session. Any omitted practice remains pending; less available time does not imply less material to learn.
- The student opens the lesson, manipulates the circuit, and answers an optional question. That answer shapes the next practice, preserving assistance and versions.
- If the interview instead starts at 17:00, the 45-minute recommendation can remain. If the email merely offers a slot, Soma flags uncertainty rather than treating it as booked.

Expected time arithmetic follows those stated intervals with zero additional buffer in this fixture. Real user-configured buffers must be honored. Outside the declared focus window, empty calendar time is not automatically study capacity. Do not compress an entire day into a false “everything is feasible” score.

## Keep the expansion small

One selected calendar source is the adapter ceiling. Prefer a read-only API when usable; a clearly labeled calendar import or manually confirmed event can exercise the same contract. Time-box the first additional calendar access experiment to four focused hours; report the actual mode. A manual import does not satisfy an automatic-collection claim.

Use a rolling seven-day window for these immediate availability checks while retaining the full semester's records. Clip at the actual current time, merge overlapping busy intervals, and preserve timezones. Missing or stale calendar data means uncertain availability. Unknown effort remains unknown. Do not publish a global slack, stress, readiness, or mastery score.

Do not hard-code priorities such as career over coursework. Use explicit deadlines and the student's stated goal. For unresolved tradeoffs, show the competing commitments and a concise choice; do not silently cancel or deprioritize a fixed obligation.

To pay for the addition, defer direct Notion/Granola integrations, extra source adapters, model-family expansion, graph visualizations, calendar optimization, and extra Meta-model experiments. Allow existing note imports. Keep the October 31 feature freeze and existing numerical/generation gates. If the extra adapter is not ready, use a labeled import or report the narrower support; do not sacrifice the working lesson loop.

## Implementation sequence in the existing codebase

1. Inspect the current branch and preserve in-flight changes. Extend the existing domain types and source references; avoid a parallel application or a wholesale architecture rewrite.
2. Add commitment and consequence records with workspace isolation, versioned provenance, explicit timezones, and tentative/confirmed distinction.
3. Build the deterministic availability/impact checks over labeled fixtures. Confirm the overlap and no-overlap variants before adding another live connector.
4. Feed supported next-action proposals into the existing session preparation path. Reuse valid lesson versions and preserve attempts/reviews.
5. Expose the consequence and ready activity on Today. Courses and Study remain; no Jobs destination is required.
6. Add the bounded selected-calendar read/import route and relevant nonacademic email classification. Record exact live versus imported support.
7. Exercise the new cases within the current change-evaluation set and record actual outcomes.

Current source files include src/lib/domain/types.ts, lessons.ts, learning.ts, seed.ts, and server persistence/action modules. These are orientation points, not proof that the extension is implemented. Preserve Firebase/Firestore, existing isolation work, and the tested model-access path recorded in DECISIONS.md.

## Acceptance for the extension

R12 requires all of the following:

- A confirmed nonacademic event changes a relevant study recommendation and leaves source-linked before/after evidence.
- A non-overlapping event leaves the valid study activity unchanged; duplicates do not reduce capacity twice.
- A tentative invitation does not become a confirmed commitment, and an ambiguous or unauthorized source cannot silently rewrite one.
- The student can correct a commitment or preference and see the new result persist without affecting another account.
- A shorter session keeps academic coverage and learning evidence intact; it does not claim that less study achieves the same mastery.
- Late/expired data, past intervals, timezones, overlapping busy events and publication races are handled explicitly.
- No email, calendar, application or third-party task is mutated by the extension.

Use these as mandatory regression checks and include new variants in the existing ten held-out source-change scenarios. Keep the existing generation, numerical, privacy, and learning-evidence gates. There is no second large evaluation program or new adoption claim.

## What this change does not establish

A codebase can demonstrate architectural patterns without proving their suitability for every student or institution. This scope update imports no product code, fixtures, credentials, or deployment assumptions. Implement the selected behaviors in Soma and verify them against its own account model and sources. Continue truthful contribution records and preserve required notices for any dependencies actually used.

The new hypothesis is specific: cross-domain context improves the usefulness of a ready study activity with less student correction. Test that before promising that Soma manages a student's whole life.

