# Soma UI direction: Ready Card

**Selected by Jeremy on October 26, 2026. Design specification, not an implementation.** This document turns the selected direction into screens, states and tokens for the existing app. The [PRD](PRD.md) (including R12) and the [scope update](SCOPE_UPDATE.md) still own scope and acceptance. Where this document conflicts with them, follow them and record the conflict in [Decisions](DECISIONS.md).

## Relationship to existing work

- **Which "A" this is.** "Ready Card" was direction A on a separate design canvas (the other two there were a change-led "Brief" and a dark lesson-first "Bench"). It is **not** "A · Fieldnotes" in `design-system/soma/directions/`. Directions A–E in that folder remain unselected explorations.
- **What it replaces.** It replaces the visual language in `design-system/soma/MASTER.md` and the current `src/app/globals.css`: warm paper, forest green, Georgia headings and the persistent sidebar. Update MASTER.md to match this document when implementing.
- **What it keeps.** Behavior already built in the app stays:
  - numeric inputs beside sliders;
  - native dialogs with focus handling and Escape;
  - the skip link;
  - reduced-motion handling;
  - source and run dialogs;
  - mode labels;
  - the learning-evidence rules.
- **How to implement.** Restyle and restructure the existing components (`src/components/soma-workspace.tsx`, `src/components/circuit-diagram.tsx`). Do not start a parallel UI.
- **Mockups.** Reference mockups are in [design/mockups](design/mockups/). They predate R12, so they show course events but not commitments. Use them for look and copy only. Their template syntax (`{{holes}}`, `<sc-if>`, `<sc-for>`) and inline circuit arithmetic are not production code.

## Who this is for

The design prioritizes the PRD's two personas, who are often the same student:

- **Limited study windows.** They open Soma with 10–20 minutes free and need to be manipulating something useful within seconds. There's one obvious next action and no setup or quiz in the way. PRD target: prepared practice within 30 seconds of opening Today.
- **Already juggling several AI tools.** They trust Soma only if they can see why a lesson is here, what changed in their courses and commitments, and what Soma did about it. The reason must be concrete and traceable to a source, without making them read a log first.

Design rule: **the lesson is the hero; the agent's work is the caption.** Every surface answers "what should I do now?" first and "why?" second, with the why always one click away. Commitments matter because they change that answer. They are context for the hero, not a second dashboard.

## What comes from where

| Element | Origin | Notes |
| --- | --- | --- |
| App shell, Today, Lesson, tokens | Ready Card | Base of the product |
| Change entries with source passage and before → after | Brief direction | Today's "What changed" (expanded state) and the lesson's "Why this lesson" |
| Paired evidence view | Bench direction | Restyled in Ready Card tokens; required by the PRD's learning-evidence screen |
| Commitments list and focus-window line | R12 / scope update | Added in Ready Card style; not in the mockups |
| Dark theme, newspaper-style home, lesson-as-home, persistent sidebar | Not adopted | Do not build |

## Design tokens

Replace the variables in `src/app/globals.css` with these. P0 is light theme only; keep every color on a variable so a dark theme stays possible.

### Color

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F4F5F7` | App background |
| `--surface` | `#FFFFFF` | Cards, header |
| `--surface-muted` | `#F7F8FA` | Previews, inset panels |
| `--border` | `#E2E5EB` | Card borders, header rule |
| `--divider` | `#EEF0F3` | Row dividers, bar tracks, segmented-control track |
| `--control-border` | `#C9CED8` | Secondary and option buttons, inputs |
| `--ink` | `#15171C` | Primary text, schematic lines, selected pill |
| `--ink-2` | `#3E4452` | Secondary text |
| `--muted` | `#4A5060` | Meta text, overlines (≥4.5:1 on white) |
| `--accent` | `#2244C2` | Primary button, links, current bars, focus ring |
| `--accent-hover` | `#16308F` | Hover/pressed accent; text on accent-soft |
| `--accent-soft` | `#E8EDFC` | Active nav item, "Ready" badge |
| `--voltage` | `#B45309` | Voltage-drop bars (series variant) |
| `--success-bg` / `--success-fg` | `#E6F4EA` / `#1E5B32` | "Checked" status, matched prediction, confirmed commitment |
| `--caution-bg` / `--caution-fg` | `#FFF4DB` / `#6B4700` | Demo/simulated/replay labels, unmatched prediction, stale source, tentative commitment |

Current and voltage differ in lightness as well as hue, and every bar has a text value beside it. Status never relies on color alone; every chip carries a word. Commitment categories (Academic, Interview, Personal) are word labels with a small line icon. Do not add a palette of category colors.

### Type

Font: **Manrope** (400–800) through `next/font/google`, which self-hosts at build time, so there's no runtime request to a font CDN. Use `font-variant-numeric: tabular-nums` on every readout, time and table.

| Role | Size / line height | Weight |
| --- | --- | --- |
| Today hero title | 40 / 1.12, letter-spacing −0.025em | 800 |
| Lesson title | 32 / 1.15, −0.02em | 800 |
| Section heading | 17 / 1.4 | 700–800 |
| Body | 15 / 1.5 (16 on phones) | 400–600 |
| Lead / reason line | 16–17 / 1.5 | 400, key facts bold |
| Meta | 13–14 | 500–600 |
| Overline | 12, uppercase, +0.04–0.06em | 700 |

On phones the hero is 30px and the lesson title 26px. No serif headings.

### Shape and spacing

- Container: `max-width: 1200px`, 24px side padding (16px under 640px).
- Radii: hero and lesson cards 20px; inner panels 16px; primary buttons 12px; other buttons 10px; pills and badges 999px; status chips 6px.
- Today: 28px between sections. Card padding is 32px on the hero and 22–24px elsewhere.
- Touch targets ≥ 44px; primary buttons 48px.
- Focus: `3px solid var(--accent)`, 2px offset, via `:focus-visible` everywhere.
- No gradients, shadow stacks, left-border accent cards or emoji. Icons are `lucide-react` (already installed) at 2px stroke, `aria-hidden` unless they carry meaning alone.

## App shell

Replace the persistent sidebar with a single white header with a bottom border:

- **Left:** "Soma" wordmark (800, 20px) and primary nav: **Today**, **Courses**, **Study**. The active item is an accent-soft pill with accent-hover text and `aria-current="page"`.
- **Right:**
  - A mode chip whenever content isn't the student's own live data: "Demo semester · simulated Wed Oct 28, 9:30 AM", "Replay", "Prepared example".
  - A source freshness summary, "Sources checked 9:14 AM". It switches to caution style and wording ("Gradescope needs sign-in", "Calendar import is 2 days old") when any connection is stale or needs attention, and links to source settings.
  - An account menu button, which holds settings, sources, scenario controls for the judge route, and deletion.

The header wraps on narrow screens and is not sticky on phones. Keep the existing skip link.

## Today

From top to bottom:

### 1. Context line

The date in the student's timezone, plus the time situation only when known from a declared focus window, a confirmed event or the student's input. Examples:

- "Wednesday, October 28 · Focus window 4:00–4:45 PM · 20 minutes free before your 4:20 interview"
- "Wednesday, October 28 · 20 minutes free" (student-stated)

If calendar data is missing or stale, say so ("Calendar not checked today") instead of implying free time. Empty calendar time outside a declared focus window is never presented as study time.

### 2. Ready card (the hero)

Exactly one hero, the top item from the existing preparation/prioritization path. Layout: a text column (flex 999, min 460px) next to a preview (flex 1, min 300px); the preview stacks below on narrow screens.

- **Badges:**
  - `Ready · 20 min` (accent-soft); the duration is the session that fits.
  - Course and assessment context ("Circuit Foundations · Exam 2 is Friday").
- **Title:** the objective as a plain sentence ("Why parallel branches share voltage, not current").
- **Reason line:** one sentence built from the recorded consequence or agent action, with the triggering facts in bold. Examples:
  - "Prepared after **Quiz 3 was returned** with a note on parallel currents, and moved up because **Exam 2 moved to Friday**."
  - "Shortened to **20 minutes** because your **interview at 4:20 PM** overlaps your 4:00–4:45 focus window. The other 25 minutes of practice are still pending."

  The line must cite real records; no generic "Recommended for you".
- **Actions:**
  - Primary **Open lesson** (48px, accent).
  - Secondary **Why this lesson?** opens the "Why this lesson" content in a dialog. Opening it doesn't count as starting the lesson.
- **Reassurance line** (13px, muted): "No quiz needed to start. Explore first; predicting is optional."
- **Preview:** a static thumbnail of the lesson's initial model state. Decorative (`aria-hidden`).

Hero states:

| State | Shows |
| --- | --- |
| Ready interactive lesson | As above |
| Preparing (queued/generating/checking) | Title + "Preparing · started 9:12 AM" with the real state; primary becomes **Practice while you wait** (ordinary practice on the same objective) |
| Failed or unsupported topic | Ordinary practice as the hero, badge "Practice · 8 min", reason unchanged |
| Supporting source stale | Hero stays usable; caution line: "Blackboard last checked 2 days ago. Reconnect to confirm this is current." |
| Availability uncertain (tentative invite, missing calendar) | Hero shows the full-length session and a caution line: "An interview invitation for 4:20 PM isn't confirmed. If you accept, this shortens to 20 minutes." Soma doesn't shorten on a tentative event |
| Nothing relevant | "You're caught up." plus the next due review or a prompt to request a lesson from Courses. No filler |

### 3. Session builder

Heading "Have more time? Build a session". A pill toggle group: **10 min / 20 min / 45 min**, one selected, `aria-pressed`. Default to the option that fits the known available time.

Below the pills, a single white card lists the session contents as name · type · minutes ("Parallel branches · lesson · 9 min", "3 review cards · 4 min"), followed by **Start N-min session**. The contents come from the session planner.

An option longer than the known available time stays selectable, labeled "longer than your 20-min window". Choosing a shorter session never marks the omitted practice as done; it stays pending.

### 4. Two side-by-side cards (stack on narrow screens)

**Also ready.** Up to three rows: title (bold), course · format · relevant date (muted), and duration on the right. Each row is a link. Formats are "interactive lesson", "practice questions" and "review cards". Rows span courses so the full semester stays visible.

**What changed.** The Brief's change entry in compact form. Up to five rows, newest first, covering course and commitment changes alike. Each row has:

- An overline with source and time ("BLACKBOARD · 9:00 AM", "CALENDAR · 11:05 AM", "EMAIL · 11:02 AM").
- One sentence: a bold fact plus the consequence. Examples: "**Exam 2 moved to Fri, Oct 30, 10 AM.** Circuits lessons moved up; their content didn't change." and "**Interview confirmed 4:20–5:00 PM.** Today's session shortened to 20 minutes; 25 minutes of practice still pending."
- A disclosure button (not hover) that reveals:
  - the quoted source passage(s);
  - **Before** → **After** of the affected activity;
  - the classification in plain words: "Date-only change · lesson content reused", "Removed from exam prep, kept in the course", "Email and calendar describe the same event";
  - links **View source** and **Correct this**.

Wording must match what Soma actually changed. Say "Study session revised", never "Interview rescheduled". No-overlap events produce no row unless something changed. Unresolved conflicts or ambiguous identities get their own caution row ("Two sources disagree about Exam 2's date. Choose one"), and it stays until the student resolves it.

### 5. Coming up

A compact list for the next seven days, merging academic deadlines and confirmed or tentative commitments in time order. Each row shows:

- time (tabular), title, and a category word (Academic, Interview, Personal);
- for academic items, the course;
- a status chip only when not confirmed ("Tentative", "Conflict");
- a source link.

Keep earlier deadlines from other courses visible here so a moved exam doesn't hide them, e.g., "Scientific Writing draft · Thu 5 PM". Read-only: there are no edit, accept or reschedule actions on external events. Corrections go through **Correct this**, which records a student correction inside Soma.

On wide screens this sits beside the two cards as a third column, or below them; on phones it comes after "Also ready". It never pushes the hero below the fold.

## Lesson (Study)

Two columns: stage (flex 999, min 600px) and right rail (flex 1, min 320px). On narrow screens the rail stacks below the stage, but the **Predict first** card moves above the stage so the optional prediction comes before the reveal.

### Lesson header

- A back link to where the student came from ("← Today"), and a breadcrumb ("Circuit Foundations › Lecture 8 · Parallel resistors").
- Status chips:
  - **Prepared · checked model v1** (success) only for a published, checked version.
  - **Preview, not checked** (caution) for anything outside the release gate.
  - **Replay** for stored replays.
  - The mode chip when demo or simulated.
- Right side: **Pause & save**. Progress saves continuously; the button is an explicit exit with confirmation.

### Stage

1. **Title and one-line instruction**, e.g., "Change a resistor and watch which quantity stays equal. The bars and the numbers come from the same model."
2. **Lesson card** (white, 20px radius, 24px padding), in this order:
   - **Variant toggle:** a segmented control (Parallel / Series), shown only when the lesson spec has a second variant. Each option is a real variant.
   - **Mechanism diagram,** drawn from model state:
     - Parallel: source, two thick node rails, a resistor chip per branch, and under each branch a current bar labeled "I₁ 2 A · V 12 V".
     - Series: source, two resistor chips in a row, a shared current bar ("2 A everywhere"), and a voltage-drop bar per resistor.
     - A caption states the relationship in words.
     - `role="img"` with an `aria-label` generated from current values.
     - Bar scales come from the model's declared input ranges.
     - Restyle the existing `circuit-diagram.tsx` rather than replacing it, as long as it reads from the checked model state.
   - **Controls:** one per input, in a 3-column grid (1 column on phones). Each has a label with the live value and unit ("R₁ · 6 Ω"), a range slider, and the existing numeric input, so nothing requires dragging. Clamp to the spec's ranges.
   - **Numbers table:** caption "Same model, as numbers"; columns Part / Resistance / Voltage across / Current, plus a "Whole circuit" row. Always rendered; this is the text alternative.
3. No animation is required. If motion is added later, label it as qualitative and disable it under `prefers-reduced-motion`.

Every displayed number, bar and scored answer reads from one model state produced by the checked model module. Components never compute physics.

### Right rail: Predict first (optional)

A card headed "Predict first" with an "optional" tag. Question and options come from the lesson spec's checkpoint. Example: "In the parallel circuit, if R₂ doubles, what happens to the current through R₁?" with options It increases / It stays the same / It decreases.

| State | Shows | Transitions |
| --- | --- | --- |
| `idle` | Question, full-width option buttons (44px), link **Explore first instead** | pick → `predicted`; explore → `exploring` |
| `exploring` | "Exploring freely. Nothing is scored. You can still predict before seeing the answer." + **Make a prediction** | → `idle` |
| `predicted` | "You predicted **it decreases**. Saved before the reveal." + primary reveal button labeled from the checkpoint ("Double R₂ and see") | reveal → `revealed` |
| `revealed` | Result in words (success style if matched, caution if not); one-sentence explanation from the spec; "**Next:** a fresh question without the diagram, to check it on your own." with **Try it now** / **Later** | Try it now → fresh question; Later → schedule it |

Rules:

- The reveal applies the checkpoint's declared parameter change through the model, so the student sees it happen. If the student changes that control themselves while in `predicted`, treat it as the reveal.
- Never say "wrong" or "incorrect". Use "Not what you predicted: I₁ stayed 2 A. Your original prediction is kept as-is."
- Controls stay usable in every state.

Evidence recording (PRD R5, R10, R11):

- Each option selection is a timestamped lab interaction. The selection in force at reveal is the prediction before reveal.
- Slider moves, variant switches, opening "Why this lesson" and the reveal are interactions or support, not independent-understanding evidence.
- **Try it now** opens a fresh question (no diagram) through the existing attempt service. Only that attempt can count as independent, and only without help.

### Right rail: Why this lesson · sources

A disclosure card, collapsed by default, containing a timeline drawn from recorded consequences and source versions. Example items:

1. "OCT 26 · GRADESCOPE: Quiz 3 returned: you wrote 'equal currents… each gets 3 A.'"
2. "OCT 28 · 9:00 · BLACKBOARD: Exam 2 moved to Friday. Raised priority."
3. "9:10 · COURSE EMAIL: Exam asks you to explain equal currents or voltages, so this lesson asks for an explanation."
4. "11:05 · CALENDAR + EMAIL: Interview confirmed 4:20–5:00 PM. Session shortened to 20 minutes; 25 minutes still pending."
5. "STATUS: Suspected gap, not confirmed. Your answer here can revise it."

Under the timeline:

- Quoted supporting passages with **View source** links, reusing the existing source dialog.
- The model assumptions ("Assumes an ideal source and ideal resistors.").

Do not generate a narrative, and never show private model reasoning.

## Learning evidence view

Reached from the lesson recap and from a course's learning history. This is the Bench direction's layout in Ready Card tokens on the light background.

- **Title** states the actual outcome, generated only from supporting records (e.g., "With help on Wednesday. On your own on Friday.").
- **Two cards side by side** (stacking on phones): the earlier attempt on the left, the fresh later attempt on the right with a 2px accent border. Each card shows:
  - the outcome label as heading;
  - an exact timestamp, plus elapsed interval on the later card ("+47 h 51 m");
  - a definition list: Question (with exposure: "in the lab, diagram visible" vs "fresh, no diagram"), First response (kept as written), Help used, Revised response, Criteria met, and Lesson/model version.
- **Label rules:**
  - "Solved with a hint" only when a hint preceded a correct response.
  - "Solved without hints, N days later" only for a fresh item with no recorded help and a matching recorded delay.
  - Unknown outside conditions read "None recorded in Soma".
  - Unsuccessful later attempts are shown as they are, with the next support.
- **What Soma changed** card: how the interpretation changed, the next action with its date, and "One fresh success is specific evidence, not mastery. Both attempts stay on record." Buttons: next action (primary) and **Not now**.
- **Simulated timelines** carry a persistent caution chip in the header ("Simulated 2-day delay · demo, not measured").

## Courses (not mocked; same language)

- **Course list:** one row or card per selected course with name, next dated item, source status chip, and counts of saved lessons and practice.
- **Course page:** in this order, saved and prepared lessons to reopen (no regeneration, no diagnostic), current material (newest first, with retrieval time), returned feedback, then course facts with sources.
- **"Show me how this works":** offered on a selected passage, problem or concept. It creates a request through the same preparation path as background work. Show the real state on the request row: Queued, Preparing, Checking, Ready, or Couldn't prepare (which offers practice). Offer **Practice while you wait**; never imply instant generation.
- **Corrections:** **Correct this** on any fact, mapping or commitment opens an inline editor that records the correction and shows which recommendations changed.

## Judge route ("Try a lesson")

The same Lesson screen, opened directly on the prepared synthetic lesson with the mode chip "Demo semester · prepared example" and an isolated expiring session. A banner links to a demo Today with the full five-course semester.

The scope update's scenario controls (overlap / no overlap / tentative) live in the account menu or a clearly labeled "Demo scenarios" panel on the demo Today, never in the student's real UI. They change data, not outcomes. Label live inference distinctly from prepared output.

## Copy rules

- Product introductions use “Before you can study, you have to figure out what to study” and explain how course material, deadlines, available time, and learning progress inform prepared lessons and practice. The headline is “Your coursework changes every week. Your study tools should keep up.” Keep this in introductory copy; the Ready Card itself retains its concrete event and activity.
- Familiar words: lesson, practice, review, course, commitment. No "missions", "insights", "mastery", streaks or readiness scores.
- Reasons cite events: "Prepared after Quiz 3 was returned", not "Recommended for you".
- Describe only Soma's own changes: "Study session revised", never "Interview rescheduled". Tentative stays tentative in wording.
- Suspected weaknesses are always phrased as suspected ("Suspected, not confirmed").
- PRD-restricted labels ("Solved with a hint", "two days later", "independent") are generated from records, never hard-coded.
- All example copy here and in the mockups comes from the original synthetic semester ([development scenarios](fixtures/DEVELOPMENT_SCENARIOS.md) and the scope update's flagship example). Keep the demo label on anything derived from it.

## Responsive and accessibility requirements

- Works from 360px to 1440px with no horizontal page scroll. Multi-column areas are wrapping flex rows or grids that stack; tables may scroll inside their own box. Phones lead with the hero, then What changed, Also ready and Coming up.
- Full keyboard path: Today → Open lesson → each control → predict → reveal → Try it now → answer, with visible focus and logical order. No global key handlers.
- Semantic elements: real `<button>`, `<a>`, `<label>`, `<table>`, and `<details>` or accessible disclosures. Toggle groups use `aria-pressed` or radio semantics.
- Text contrast ≥ 4.5:1. The tokens above pass on their intended backgrounds; recheck any new pairing.
- `prefers-reduced-motion`: no non-essential motion (keep the existing rule).
- Ready lesson load target: 9 of 10 launches usable within 3 seconds on the stated reference setup (PRD).

## Implementation notes

- **Stack.** The stack is Next 16, React 19 and Tailwind 4, with CSS in `globals.css`. Don't add shadcn/ui or another component library just for this restyle. Follow the Next.js note in AGENTS.md before writing code.
- **Suggested decomposition** of `soma-workspace.tsx` as it's restyled:
  - `AppHeader` with `ModeChip` and `SourceFreshness`.
  - `ReadyCard` with its hero states.
  - `SessionBuilder`, `AlsoReady`, `ChangeEntry` (compact and expanded), `ComingUp`.
  - `LessonStage` with `VariantToggle`, `CircuitDiagram`, `ParameterControl`, `ModelTable`.
  - `PredictCard` with its state machine.
  - `WhyThisLesson`, `EvidencePair`, `NextActionCard`.
- **Generated content.** Lesson screens render from the typed lesson specification plus the checked model state. Escape all generated text; never use `dangerouslySetInnerHTML` for it.
- **Order:**
  1. Tokens and app shell (sidebar → header).
  2. Lesson stage.
  3. Today hero with its states.
  4. Predict card with evidence recording.
  5. Why this lesson.
  6. What changed and Coming up (with R12 data).
  7. Evidence view.
  8. Session builder.
  9. Courses.
- **Checks.** Update the existing Playwright journeys for the new structure. Before calling a screen done, check the main lesson at the target viewport, keyboard-only and with reduced motion (AGENTS.md).

## Out of scope for P0 UI

Dark theme; the newspaper-style home; lesson-as-home; persistent sidebar; graph or mastery dashboards; chat panel; calendar grid or editor; career pipeline views; weekly planner editor; streaks or gamification; decorative animation.
