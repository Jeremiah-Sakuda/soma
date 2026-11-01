# The dot journal — Soma's exploration interface

October 30, 2026. Jeremy chose this direction (PM114) from the design canvas of personality directions (`design-system/soma/directions/2026-10-30-personality-directions/`, board N3). It applies to the `/explore` surface and the desktop companion that loads it. The course routes (Today, Map, Activity) keep their own look.

## The idea

Soma is a study journal for whatever is on your screen. You point it at a slide, and it opens a page: the diagram on the right, notes on the left, a question line at the bottom.

**Printed is checked; handwriting is the explanation.** This rule gives the journal style its job.

- **Printed type** is everything Soma's solver computed or the app knows for certain: costs, search states, route totals, labels, controls, the step caption.
- **Handwriting**, in one reserved teal ink, is the explanation of the current step: Muse's words in a generated run, or the example author's words in a prepared example.
- **The provenance line** at the top of the page says which. Soma never puts a checked value in handwriting or an explanation in print.

This replaces most of the badges and repeated disclaimers the old interface used to keep evidence honest. The audit in [UI_POLISH_AUDIT_2026_10_30.md](UI_POLISH_AUDIT_2026_10_30.md) counted more than a dozen of them. A student learns the distinction once, from the key at the bottom of the left page, and then sees it everywhere.

## The page

### Cover (nothing open yet)

One page:

- the headline "Point Soma at something you're studying."
- one sentence on what happens
- the source card (Share a window, Upload screenshot, preview, privacy note)
- **"Pick up where you left off"**: your saved explorations, so a returning student resumes in one click
- three examples: the original BFS example, weighted paths, and a recorded Muse run
- the question line

There is no marketing headline above the work and no duplicate actions.

### The spread

**Left page, header:**
- the provenance line, for example "Prepared original example · Checked Dijkstra computation" or "Muse Spark generated · Explanatory visual"
- the version (only when there is more than one), the save action, and a ⋯ page menu
- for generated and recorded runs, the one-line pipeline (Muse Spark composed → Soma computed → Wonder reviewed)
- the title and objective
- the earlier-version warning when it applies

**Right page, the visual:**
- **Transport:** play, replay, previous, next, and the page number ("Step 3 / 5").
- **Route tabs:** when two searches are compared (Dijkstra 3 · BFS 10), one is inspected at a time.
- **The diagram.**
- **Experiment controls:** the cost slider or "Find the tipping point", plus start, goal, connections and the state table in a disclosure.

**Left page, body:**
- **The search log.** It is printed from the checked trace, using bullet-journal signifiers:

  | Signifier | Meaning |
  | --- | --- |
  | × | settled (Dijkstra) or done (BFS) |
  | → | now: the node being expanded, highlighted in mustard |
  | • | waiting in the queue |
  | ○ | not reached (or unreached once the search ends) |

  Each row shows the node and its checked value. A value that just improved shows the old one struck through: Goal ~~10~~ 3.

- **The note.** It is the explanation written for this exact step, in handwriting. If no explanation was written for this step, the checked caption appears once, in print.
- **The key.** One line of signifiers; opening it shows the rule, "Printed values are checked by Soma. Handwriting is the explanation."
- **Version history**, when there is more than one version.
- **Optional prediction and fresh practice.** These are the student's own entries.
- **"Try asking".** Suggested questions.

**Question line:** docked at the bottom of the window at every width, so the diagram and the question share the screen. It shows one line, the recording disclosure and nothing else; its label stays available to assistive technology.

**A new source.** A screenshot or window chosen while a page is open appears on the desk above the spread, for review before Ask.

**Top bar:**
- **Source & sharing:** the current page's context, Share or Upload, and Refresh snapshot.
- **Explorations:** shown once a page is open; saved pages and examples. Choosing one closes the menu. On the cover, the cover itself is this list.
- **⋯ More:** your goals and understanding, question settings, the course workspace, the guest-save note.

"Stop sharing" stays in the top bar whenever a window is being shared.

**Page menu (⋯ on the left page):**
- source and assumptions
- how the page was prepared, with its recorded calls, cost and timing
- delete

### Say each thing once, and say less

In the old interface, the current step was narrated three to five times on screen. The journal tells it once, in the note, or in the printed caption for the inspected search alone (for example, "B is settled at cost 2. Goal drops from 10 to 3."). The playback caption, step caption and stage headings that repeated it remain only for screen readers. The repeated "First in, first out" labels, Restart search and the second "Previous" control are gone. In checked searches, the back button reads Previous step, which is what it does.

Text that the reader does not need to read is gone or folded away:
- **Question line:** its label, context hint and settings are gone.
- **Prediction box:** the intro paragraph is gone; the button and its "Optional · diagram visible" exposure label say enough.
- **Route tabs:** the "Full route · lowest cost" lines are gone; the found route stays as status text.
- **Experiment controls:** the rules sentence is gone.
- **Suggested questions:** at most two.
- **Save:** "Ready to save" is gone; the status appears only when it says something (Unsaved changes, Saved).

## Visual language

| Token | Value | Use |
| --- | --- | --- |
| Desk `--desk` | `#e3d9c6` | Page background around the journal |
| Paper `--paper` | `#f7f2e8` with a 20 px dot grid (`#cbbfa8`) | Every surface a student reads from |
| Ink `--ink` / `--ink-2` / `--muted` | `#26221d` / `#4a4339` / `#5e5649` | Printed text; muted passes 4.5:1 on paper and desk |
| Muse ink `--muse-ink`, `--accent` | `#1d6b66` | Handwritten explanation, primary actions, focus |
| Highlighter `--highlight` | `#e8b23a` | The current step: log row and node. Fill only, never text |
| Elastic band | `#2e2a24` | The right page's edge, desktop only |

**Type:**

| Use | Face |
| --- | --- |
| Headings | Young Serif |
| Text and controls | Work Sans |
| Checked values | Fragment Mono |
| Handwriting | Kalam |

All four load through `next/font/google`, only for `/explore` (see `src/app/explore/layout.tsx`).

**Buttons:**
- **Primary actions:** teal pills with a pressed edge.
- **Secondary actions:** paper pills with an ink outline.
- **Transport:** paper with an ink bottom edge.

All targets are at least 44 px.

## Diagram rules

- **One node language for both searches:** settled is filled ink, now is mustard, waiting is outlined, not reached is dashed.
- **BFS nodes are pills sized to the full name.** Names are never truncated ("Unconnected X", not "Unco…"), and connections end on the pill's edge.
- **Every cost sits on its own connection,** masking the line beneath it, or touches it. There are no leader lines. When there isn't room, the cost goes in the keyed legend rather than near another connection. `tests/domain/weighted-layout.test.ts` checks this, and fails on the previous placement.
- **The diagram scales with the page and is never squeezed** to make room for chrome. In the companion window the weighted example is 580×325 instead of 200 px tall.

## Narrow screens

Below 1100 px, the spread becomes one page in reading order: title, then the visual, then the log and notes. The visual comes before the log so the companion window shows the diagram first.

At 760 px and below (the desktop companion is 620×704):
- **Top bar:** it compacts, and Source & sharing becomes an icon.
- **Transport:** one row of icon buttons (play, replay, ask, settings, previous, next) with the page number and the experiment action. Every icon keeps its accessible name.
- **Header row:** save becomes an icon, and the objective is hidden.
- **Diagram fit:** the diagram is sized to the room actually left between its top and the docked question line. A small measurement on load and resize sets it, never below 220 px. The whole graph and the question share the screen, as PM064 requires, without shrinking the diagram to the old 200 px cap.

At 480 px and below, the save, previous and next controls stay icon buttons and the provenance line shrinks to 12 px.

## Accessibility

- **Names stay the same:** existing accessible names for actions are preserved (Try the original example, Next step, Play explanation, Save exploration, Stop sharing).
- **Native controls:** menus are native `details`/`summary` and close on Escape or an outside click. Choosing an exploration closes its menu.
- **Search log:** signifiers are hidden from assistive technology and replaced by words ("Settled:", "Now:", "Waiting:", "Not reached:").
- **Who wrote the note:** the note is introduced to screen readers with its writer ("Explanation by Muse:", or "by the example's author").
- **Reduced motion:** it keeps the existing settled-snapshot behavior, and the pressed-edge button animation is disabled.

## Implementation

- `src/components/exploration-journal.css` holds the journal theme and layout. It loads after `exploration.css` and overrides it without `!important`, scoped to `.exploration-app`.
- `src/components/exploration-journal-log.tsx` holds the search log, note and key, derived from the same checked execution the diagram draws.
- `src/components/journal-menu.tsx` is the menu disclosure.
- `src/components/exploration-workspace.tsx` contains the cover, spread, top bar and question line, and fits the diagram on narrow windows. Its request and state logic is unchanged.
- `src/lib/domain/exploration-view.ts`: the checked caption names the searches (Dijkstra, BFS) instead of "Primary" and "Comparison", and reports a cheaper route to a waiting node ("Goal drops from 10 to 3"). This is tested in `tests/domain/journal-caption.test.ts`.
- `src/lib/domain/weighted-graph-layout.ts`: costs are placed on their own edge.

### Measured change (weighted example, step 3)

| Viewport | Before | After |
| --- | --- | --- |
| 1440×900 | 416 words · 41 controls · 2,332 px page | 243 words · 31 controls · 1,467 px page; question line docked in view |
| 620×704 companion | diagram 200 px tall, about 9 px text, question dock covering the queue | diagram 491×275 above the docked question line, about 15 px node text, transport on one row |
| 375×812 phone | 3,054 px page, about 9 px text | about 2,000 px page, diagram near the top, about 10–11 px node text (see limits) |

## Verification — October 30

- **Typecheck** passed.
- **Offline suite:** 1,543 passed, 93 opt-in skipped. This includes `tests/domain/weighted-layout.test.ts`'s new own-edge test, which fails on the previous placement, and `tests/domain/journal-caption.test.ts`.
- **Browser journeys:** all 137 passed. The first full run failed 40, and each failure was sorted.
  - **Product regressions, fixed in code:**
    - BFS lost its screen-reader queue list.
    - Saved explorations were unreachable from the cover.
    - A new source was hidden in a closed menu.
    - The question line was off screen on a 1280×720 desktop.
    - The companion graph overlapped the question line.
    - The audit link opened nothing visible.
    - "Playback settings" was unreachable by keyboard.
  - **Tests that asserted the replaced layout, updated to the new interaction:**
    - the old headline
    - opening a menu, the node picker, or the second route tab before checking what it holds
    - "You changed the experiment"
    - the desktop composer position
  - No assertion was weakened to pass. Each still checks the same behavior where it now lives.
- **Visual checks** in Chromium at 1440×900, 620×704 and 375×812, with live inference off and no provider calls.

## Known limits

- **Phone diagrams.** On a 375 px phone the weighted diagram's node and cost text renders at about 10–11 px. Raising it needs the weighted layout to size cards for a larger font; a first attempt overflowed the "Unconnected X" card and was reverted. On phones the search log, directly below the diagram, lists every node and value at 16 px.
- **Transport width.** On the desktop right page, transport takes two rows with words; the companion's icon row could replace it if a single row is preferred.
- **Old stylesheet.** `exploration.css` still carries rules for the previous layout. The journal stylesheet overrides the ones that matter. Deleting the dead rules is a separate cleanup.
- **Unmerged branches.** `codex/capture-first-ui` (another capture-first restructuring) and `codex/spatial-exploration` (3D) are not on main. Both rewrite the same modules and will need to adopt this stylesheet and structure when they are integrated.
- **What was checked.** The journal was checked in Chromium at 1440, 620 and 375 px with live inference off. Live generation, its waiting states, Gemini playback and the native Electron window were not exercised.
