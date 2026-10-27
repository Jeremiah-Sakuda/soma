# Soma UI/UX guide

**Adopted October 27, 2026 (PM024). Read this before any UI or UX work.** This guide owns Soma's interface: who it's for, navigation, screen layouts, visual language, interaction and accessibility rules. It supersedes the visual language and navigation in [UI Direction](UI_DIRECTION.md) (Ready Card). That document's behavioral rules still apply where this guide doesn't replace them: prediction states, evidence recording, label rules and copy rules. The [PRD](PRD.md) and [Learning Graph Scope](LEARNING_GRAPH_SCOPE.md) still own scope and acceptance; a conflict is resolved in their favor and recorded in [Decisions](DECISIONS.md).

**References**

- The design canvas, private to Jeremy: https://claude.ai/artifact/5NaNL77LNFvGKhbWzFuyBk. Rows F–P. M (Playground) sets the look; N–P set the structure.
- The canvas source and rationale: [`design-system/soma/directions/2026-10-27-hypothesis-canvas/`](../design-system/soma/directions/2026-10-27-hypothesis-canvas/README.md).
- [Personas and user stories](USER_STORIES.md), the PRD's [experience requirements](PRD.md) and [Demo and Evaluation](DEMO_AND_EVALUATION.md).
- Optional: the UI/UX Pro Max skill, for targeted style, typography or accessibility searches. Treat its output as suggestions; this guide wins.

## 1. Stance

**The graph is the premise. The next action is the home.**

Most people open Soma to answer "what now?", not to browse. Every recommendation is explained by a place on the student's semester map, and the map is always one click away. But the first screen is the next useful activity, sized to the time available and playable right there.

Soma suggests; the student can always choose. Every station on the map can make a lesson, practice or review on request, through the same preparation engine as Soma's own suggestions.

## 2. Who it's for

These personas are hypotheses drawn from the PRD and user stories, not interview results. Check designs against all five.

| Persona | Context | Opens Soma to ask | Must be easy |
| --- | --- | --- | --- |
| **Jordan**, the juggler | Five courses, several AI tools; laptop morning and evening, phone glances | "What changed, and is my plan still right?" | Changes shown as consequences, why and sources, correcting Soma, requesting a lesson, Soma's activity |
| **Sam**, short windows | Works 20 hours a week; 10–20 minute gaps on a phone | "Give me one thing that fits right now." | Time chips, a one-tap start, exact resume, stopping without penalty |
| **Ana**, returned work | Quiz came back; exam on Friday | "What did I actually get wrong, and can I fix it by Friday?" | The marked work, slip or concept, the experiment, a plan to the deadline |
| **Leo**, exam week | 45–90 minute blocks | "What does the exam cover, and where is my evidence thin?" | Exam scope on the map, evidence states, a session builder |
| **Visitor**, judge or classmate | Three minutes, no account | "Show me what this does." | The lesson within 5 seconds, the map one click away, clear demo labels |

**What gets surfaced where**

- **Always on screen:** the next activity with its time chips and course or station label; source freshness; where you are this week.
- **One click:** the full map; a station's evidence and "correct this"; requesting or making something; Activity.
- **Tucked away:** source setup, privacy, account, deletion and the judge's demo scenarios (in the workspace menu).

## 3. Navigation

**Desktop:** a left sidebar containing:

1. **Today**: the next action, this week's slice of the map, and what changed.
2. **Map**: the whole semester, one line per course, with a station inspector.
3. **Activity**: what Soma checked, ran and changed, plus job status.
4. **Lines**: one entry per course, each opening that course's detail (`?view=courses`).
5. **Pinned at the bottom:** mode chip (synthetic demo or your account), source freshness, and the workspace menu.

**Phone (under 900 px):** the sidebar becomes a top bar with the same items, wrapping as needed. Today always comes first.

**Lessons aren't a navigation destination.** They open from Today, the map, a course or a request (`?view=study&lesson=…`) and always show "← Back". There are no "Study" or "Courses" top-level items; a course is a line on the map.

URL views: `today` (default), `map`, `activity`, `courses` (course detail) and `study` (a lesson). Keep existing deep links working.

## 4. Screens

### Today

From top to bottom:

1. **Context line:** the date and the time situation. Only claim free time from a declared focus window, a confirmed commitment or the student's own input.
2. **Next card:** one hero, with a station chip (course color and concept), the source-linked reason, time chips (10/20/45), a primary action and "Why this?". Hero states from UI Direction (preparing, failed, stale, tentative, caught up) still apply.
3. **This week on your map:** a compact map strip of all lines, each station clickable. It's context, never a blocker.
4. **What changed:** consequences, each linked to what they affected. Unchanged checks are counted, not listed.
5. **Also ready** and **Coming up.**

### Map

- **Lines are courses** in the course's color. **Stations are the lessons and practice prepared for that course**, in order. **Diamonds are assessments**, placed after a "Now" divider with their real dates.
- **A station's look comes from saved evidence only.** It changes shape as well as color, and always has a word label:

| Look | Word | Derived from |
| --- | --- | --- |
| Filled | On your own | A correct, unassisted attempt on a fresh item without the diagram |
| Half-filled | With help | Any assisted attempt, or recorded assistance for the activity |
| Dashed, pulsing ring | Two explanations | An open diagnostic, or a graph interpretation still plausible or unresolved |
| Hollow | Ready, not started | A lesson with no attempts |
| Hollow, amber outline | Source changed | The lesson's state is `stale` |
| Diamond | Exam or deadline | A course assessment with a date |

- **The inspector** (right side, or below on narrow screens) shows the station's course, status word, evidence labeled by who it came from (*You*, *Instructor*, *Source*, *Soma*), the reason, the cited sources, the primary action and the **Make** panel.
- Never show mastery percentages, readiness scores or streaks. Don't invent stations for material Soma hasn't seen. Cross-course links appear only as "proposed · not verified".

### Make (on every station)

Formats are offered only when the engine actually supports them:

- **Interactive lesson** opens the station's checked lesson, or requests one. Only shown where a checked model exists; otherwise the label says why.
- **Fresh question** is a new item without the diagram, now or later (`fresh-question`).
- **Ask for something new** sends a topic, prefilled from the station, through the normal lesson request path (`request-lesson`), with a real queued, preparing and ready state.

Quizzes and flashcards as separate generated formats are proposed in canvas row P but are **not yet supported by the engine**. Don't show them as working until they exist. Results follow the evidence rules (§7).

### Activity

Soma's runs, with mode labels (live model, prepared operation, synthetic scenario) and status; source checks; interpretations; the audit journal (`AiActivity`). It shows in-progress work honestly and never shows private model reasoning.

### Lesson (the playground)

The interactive circuit is the hero:

- The mechanism diagram has animated current along the branches. Faster dots mean more current, and both come from the checked model state.
- Controls are a slider plus a number input.
- The model table is always shown.
- "Predict first" stays optional.
- Reduced motion stops the dots and shows them at fixed positions.

Keep every label rule and evidence rule from UI Direction.

## 5. Visual language

Light theme only for P0. Every color is a token in `src/app/globals.css`, so a dark theme stays possible.

| Token | Value | Use |
| --- | --- | --- |
| `--bg` | `#F7F6F3` | App background (warm paper-white) |
| `--sidebar` | `#EFEDE8` | Sidebar |
| `--surface` | `#FFFFFF` | Cards |
| `--surface-muted` | `#FBFAF7` | The lesson stage and inset panels |
| `--border` / `--divider` | `#E4E1DB` / `#EFEDE8` | Hairlines |
| `--control-border` | `#D9D6CF` | Secondary controls; the bottom edge of tactile buttons |
| `--ink` / `--ink-2` / `--muted` | `#17171C` / `#45454F` / `#62626D` | Text (muted is at least 4.5:1 on surfaces) |
| `--accent` / `--accent-hover` / `--accent-soft` | `#5551F5` / `#3B37C9` / `#ECEBFF` | Primary actions, focus, selection, "two explanations" |
| `--current` | `#F59E0B` | Current dots in the circuit only (graphics, never text) |
| `--voltage` | `#B45309` | Voltage bars |
| `--success-*` / `--caution-*` | `#E3F4EA` and `#145C36` / `#FFF2D2` and `#6E4500` | Status chips (always with a word) |

- **Course colors** come from course data and only mark lines, dots and chips. Never use them for text on white unless the pairing passes 4.5:1.
- **Type:** Geist for text and Geist Mono for numbers and times, both via `next/font/google`, which self-hosts them. Page titles are 40–46 px, weight 700, letter-spacing −0.035em; card titles 24–28 px; body 15 px (16 px on phones); meta 13 px. Use tabular numbers for all readouts.
- **Shape:** cards 22 px, inner panels 14–16 px, buttons 12–14 px, chips 999 px. Hairline borders plus one soft shadow (`--shadow`); no gradient washes and no left-border accent cards.
- **Tactile buttons:** primary buttons have a solid bottom edge (`0 4px 0` in the darker shade) that collapses when pressed. Secondary buttons use a light version. Touch targets are at least 44 px; primary buttons are 48–54 px.
- **Icons:** `lucide-react`, 2 px stroke, `aria-hidden` unless they carry meaning alone. No emoji.

## 6. Motion

Motion explains something or confirms an action; it's never decoration.

- **Current dots** speed scales with the current. They're paused until shown wherever a prediction gate applies.
- **The pulse ring** marks only the station with two explanations being tested.
- **Button press:** 120 ms.
- **`prefers-reduced-motion`** stops all of these and shows the static equivalent.

## 7. Honesty and evidence in the UI

- **Label who said what:** the student's own work, instructor marks, course sources and Soma's interpretations each get a distinct label.
- **Interpretations say "suspected" or "two explanations"** and carry "Correct this".
- **Exploration, hints, viewing explanations and flashcard ratings never become independent evidence.** Only a fresh, unassisted item can mark a station "On your own".
- **Label every mode:** live inference, prepared artifacts, the synthetic demo, replays and simulated time. Selected-URL text reading is not model computer use.

Copy rules (from UI Direction): use familiar words (lesson, practice, review, course); don't say "wrong"; describe only Soma's own changes; reasons cite events.

## 8. Accessibility checklist (before calling any screen done)

- [ ] Works from 360 to 1440 px with no horizontal page scroll; the map may scroll inside its own box.
- [ ] Full keyboard path, visible focus, real `<button>`, `<a>` and `<label>` elements; station markers are buttons with descriptive `aria-label`s; toggles use `aria-pressed`.
- [ ] Text contrast is at least 4.5:1; status never relies on color alone.
- [ ] Reduced motion is respected.
- [ ] Every chart or diagram has a text or table alternative.
- [ ] Existing Playwright journeys pass; check the main lesson at the target viewport, with the keyboard only and with reduced motion (AGENTS.md).

## 9. Implementation notes

- **Stack:** Next 16, React 19, Tailwind 4 with plain CSS in `globals.css`. Don't add a component library. Read `node_modules/next/dist/docs` before using a Next API.
- **The shell lives in `soma-workspace.tsx`;** views are separate components (`today-view.tsx`, `map-view.tsx`, `lesson-stage.tsx`, `ai-activity.tsx`). Station status is a pure projection of workspace data (`src/lib/domain/semester-map.ts`) with unit tests. Components never compute physics or invent evidence.
- **Generated text:** escape it, and never use `dangerouslySetInnerHTML`.

## 10. Out of scope for P0

A dark theme; a force-directed or editable graph; mastery or readiness dashboards; streaks or gamification; a chat panel; calendar editing; a career pipeline; quiz or flashcard generation formats until the engine supports them; a mascot.
