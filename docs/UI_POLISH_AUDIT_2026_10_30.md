# UI polish audit — October 30, 2026

**Status:** this is an audit and a proposed direction. Nothing here is adopted until the owner decides, and nothing here has been implemented.

## What was audited

- **Build:** `codex/spatial-exploration` at `e521e7d`. This is main's latest UI (PM097) plus the 3D work.
- **Setup:**
  - It ran from an isolated, credential-free snapshot with live inference off, so there was no model spend.
  - Prepared examples, the recorded Muse run and the 3D examples were driven in a real browser.
- **Viewports:**
  - 1440×900 desktop
  - 620×704 desktop companion
  - 375×812 phone
- **Not checked:**
  - Gemini voice playback
  - live generation and its waiting states
  - the native Electron window chrome
  - any revisions the PM102/PM103 3D work makes after `e521e7d`

## Verdict

The product's core moment is strong: a diagram you can change, with the change checked. The current interface buries it.

A loaded exploration shows 375–515 words and 35–66 controls, and it spans 2.3–2.9 desktop screens. At companion width the graph gets 200 px of a 704 px window. The same step is described three to five times. Every iteration since PM040 added a feature, a label and a disclosure, and none removed anything. The UI guide shows this directly: it is a v1 guide (Today · Map · Activity) with thirteen dated amendments stacked on top.

Polishing the current layout will not fix this. It needs a subtraction-first redesign around one stage.

## Measurements

The counts cover visible words and interactive controls (buttons, links, inputs, summaries). Closed disclosure contents are excluded.

| State | Viewport | Words | Controls | Disclosures | Page height |
| --- | --- | --- | --- | --- | --- |
| Empty start | 1440×900 | 222 | 20 | 3 | 1,383 px (1.5 screens) |
| BFS example | 1440×900 | 425 | 45 | 10 | 2,589 px (2.9) |
| Weighted example | 1440×900 | 416 | 41 | 11 | 2,332 px (2.6) |
| Recorded Muse run | 1440×900 | 375 | 35 | 11 | 2,133 px (2.4) |
| 3D example | 1440×900 | 421 | 52 | 7 | 2,116 px (2.4) |
| Weighted, 3D view | 1440×900 | 515 | 66 | 11 | 2,596 px (2.9) |
| Weighted | 620×704 | 402 | 38 | 8 | 2,812 px (4.0) |
| Weighted | 375×812 | 402 | 38 | 8 | 3,054 px (3.8) |

## Findings

### 1. Page structure: five jobs on one screen

- **Left column.** It holds the composer, voice settings, "Your goals & understanding", "Source & sharing" (a source card, four example links and privacy copy) and the library ("Pick up a thread").
- **Main column.** It holds the card, the playback strip, step navigation, the diagram, step explanations, the 2D/3D toggle, a caption, experiment controls, prediction, suggested follow-ups, source and assumptions, save, provenance and delete.
- **Header and footer.** The header shows "Visual learning preview", "Jump to visual card" and "Study workspace". The footer shows the guest-expiry notice and "Your study workspace".
- **Headlines.** The empty state has three competing headlines: "Make the idea visible.", "A question can become an experiment." and "What would you like to understand?". The page H1 stays in place after content loads.
- **Duplicate actions.** The empty state repeats its entry actions: "Try the original example" twice, and "Open recorded run" alongside "Watch a recorded Muse run".

### 2. The explanation card says everything several times

- **The current step is narrated three to five times** (BFS example, step 0):
  - in the playback strip
  - in the diagram heading ("S is next in the queue.")
  - in the "Why this node next?" list
  - in the "Search step 0" caption
  - again as "Soma's explanation: …"
- **The weighted example renders "Primary: … Comparison: …" twice.**
- **There are four overlapping ways to move through steps:**
  - Play / Replay from start
  - Previous explanation / Next step / Step n of 5
  - clickable step explanations
  - Restart search
- **Provenance and mode labels stack up.** They include:
  - "Prepared original example"
  - "Checked BFS computation"
  - "Version 1"
  - "An original unweighted graph"
  - "Search in motion"
  - "Checked state" / "Replaying this step"
  - "Front of queue"
  - "New nodes join at the back"
  - "First in, first out" *and* "First in → first out"
  - "Optional · diagram visible"
  - "Ready to save"
  - a rules sentence ("Unweighted graph · visited when added to queue · stop when goal leaves queue.")
  - the recorded run's provenance strip and timestamp line
- **The experiment controls are form fields below the diagram.** These are start and goal selects, "Reverse neighbor order" and "Change a connection". The thing being changed sits far from the controls that change it.

### 3. Diagrams

- **Weighted labels are misplaced (correctness).**
  - **Desktop.** The S→C cost "2" sits beside the A→B arrow, nowhere near its own arc. A→B therefore appears to carry both "1" and "2".
  - **Companion and phone widths.** A "1" badge floats above the graph on a leader line, and "10" and "1" overlap the A→B arrow.
  - **Consequence.** A student can read the wrong costs on the exact graph meant to teach costs.
- **Truncated label.** The BFS example shows "Unconnected X" as "Unco…", which breaks the guide's no-truncation rule.
- **Two node styles.**
  - **BFS** uses small grey circles that can't fit names.
  - **Dijkstra** uses rounded cards with monospace "cost: ∞".
  - Same family, different visual language.
- **Low-contrast edges.** Edges are thin grey with small arrowheads. In BFS, C→S runs almost parallel to A→C.
- **Empty queue box.** The queue starts as a large lavender box holding a single chip.
- **Diagram size.** The diagram fills only part of its panel at desktop. At 620 px it is 200 px tall, and at 375 px node costs render at roughly 9 px.
- **What works:**
  - The mid-step states (settled fill, current outline, relaxing edge in accent) read well.
  - The priority-queue chips with costs are clear.

### 4. 3D (spatial branch at `e521e7d`)

PM102/PM103 is revising the visual quality right now. These findings are about framing, layout and controls, which that work may not cover.

- **Framing.** The model fills about a quarter of the canvas, and an empty grid floor dominates. "Separate parts" shrinks the model to about a tenth of the canvas without reframing the camera. A checked graph in 3D is a cluster of small spheres with unreadable weights.
- **Overlapping labels.** In the assembled view of the relay, "Input sensor" and "Input signal" overlap.
- **Controls.** There are 15 controls under the canvas: four camera presets, two orbit buttons, three sliders, Isolate, Reset and five part chips. Then comes "Objects, connections & spatial state".
- **Toggle placement.** The 2D/3D toggle sits *below* the visual, far from what it switches.
- **Repeated disclaimer.** The card repeats "Shapes, depth and motion illustrate the explanation. They are not recovered geometry…". The source card in the left column repeats it again.
- **3D for checked graphs.** At step 0 every height is "unknown distance". The 3D view adds controls without adding information until distances settle.

### 5. Companion (620×704) and phone

- **Space before the graph.** Badges, title, playback strip, a step row and the route selectors take about 260 px before the graph starts.
- **The composer dock covers the bottom quarter of the window.** That dock holds "Where would you like to go next?", the field, Ask Soma, "Voice & question settings" and the "Live generation is not enabled" note. It hides the queue under the graph.
- **The page is four screens tall.** The experiment controls, prediction, save and history are all below the fold.

### 6. States, errors and copy

- **Raw error text.** A dropped connection shows the browser's raw "Failed to fetch".
- **Unexplained disabled button.** With live generation off, "Find the tipping point" is visible but disabled, with no reason given.
- **Internal vocabulary in the UI:**
  - "original example"
  - "checked computation"
  - "Primary/Comparison"
  - "FIFO frontier"
  - "diagram-visible"
  - "thread"
  - "Version 1" on a first and only version
- **Over-explained privacy and mode copy.** It appears in four places on the empty state alone.

## From scratch: one stage

### Principles

1. **One stage.** The diagram is the page. Everything else is summoned, not displayed.
2. **Say each thing once.** One sentence per step, under the diagram, and nowhere else.
3. **Touch the thing you change.** Experiment controls live on the diagram: click an edge to disable it, click a cost to edit it, drag the start and goal pins. Forms are the keyboard fallback, inside a sheet.
4. **One quiet provenance mark.** For example, `Example · checked by Soma` or `Muse · checked by Soma`, which opens a detail popover. The evidence and honesty rules stay intact; they move into the popover instead of onto the page.
5. **Remove before adding.** Every feature that stays must earn a place on the stage or move into the sheet. Nothing new is added in this pass.

### Layout

**Desktop:**

```
┌──────────────────────────────────────────────────────────────────────┐
│ Soma   Fewest edges or lowest cost?          Explorations ▾   ⋯     │
├──────────────────────────────────────────────────────────────────────┤
│                                                                      │
│                        [ the diagram, large ]                        │
│                 (costs, pins and edges are directly                  │
│                  editable; queue strip attached below)               │
│                                                                      │
│   Dijkstra 3 ●  BFS 10 ○              2D | 3D            Example ⓘ   │
├──────────────────────────────────────────────────────────────────────┤
│  ◀  ▶  ●●●○○○   "C is next: it has the lowest cost so far (2)."  🔊  │
├──────────────────────────────────────────────────────────────────────┤
│  Ask about this…                                         [ Ask ]  🎙 │
└──────────────────────────────────────────────────────────────────────┘
```

**Companion (620) and phone.** The same three bands, stacked. The composer collapses to a single row and expands only on focus. The diagram gets every remaining pixel.

### Where everything goes

| Today | From scratch |
| --- | --- |
| Left column: source, examples, privacy | Empty state only. Afterwards, the source thumbnail inside the ⓘ popover |
| Left column: library | "Explorations ▾" menu |
| Left column: goals & understanding | ⋯ menu → "What Soma knows about you" |
| Playback strip + step row + step list + restart | One transport row: ◀ ▶, step dots, one sentence, voice |
| Start/goal selects, reverse, change a connection | Direct manipulation on the diagram; forms in the "Change" sheet |
| Find the tipping point + cost slider | Click a cost → inline slider with the live BFS/Dijkstra totals |
| Try a prediction card | A "Predict" toggle on the transport row; it answers on the diagram |
| Suggested follow-ups | Placeholder text and one or two chips that appear when the composer is focused |
| Source & assumptions, how prepared, table view, delete | The ⓘ popover and the ⋯ sheet |
| Save exploration, Version 1 | Autosave. Versions appear in Explorations only when there is more than one |
| Header/footer v1 links, guest notice | The ⋯ menu |

### The empty state

One line ("Point Soma at something you're studying."), three buttons (Share a window · Upload · Try an example) and the composer. No duplicate actions and no marketing headline above the work.

### Diagram rules

- **One node style for both algorithms:** a full-label pill, plus a cost line only when costs exist. Names are never truncated; the layout makes room.
- **Edge labels sit at their own edge's midpoint**, with collision avoidance against nodes, labels and other edges. There are no leader lines. When there is no room, the layout spreads out or routes around; it never displaces the label.
- **Edges get more contrast and larger arrowheads.**
- **Three state colors** — settled, current and path — explained by a one-time legend.
- **The queue is a compact strip under the diagram** that grows with its contents.
- **The diagram scales to the stage** at every width. Phone text never drops below 12 px.

### 3D rules

- **3D appears only when it adds information.** It fits authored spatial scenes, and checked graphs after distances are known. Otherwise the toggle is hidden.
- **The camera auto-frames to about 70% of the canvas**, reframing on separate, cutaway and isolate. The floor grid is faint or absent.
- **Labels show** for the parts in the current step and for any selected or hovered part. Leader lines get collision avoidance.
- **Canvas controls.** Drag to orbit. A small overlay offers a view preset menu plus Separate and Cut. Parts, isolate, reset and the text description move to the sheet.
- **Coordination.** Material and lighting quality belongs to the in-flight PM102/PM103 revision.

## Correctness fixes worth doing regardless

These hold whether or not the redesign is adopted:

1. Weighted edge labels: placement on the correct edge at all widths.
2. "Unconnected X" truncation.
3. The duplicated "First in, first out" text and the duplicated "Primary/Comparison" text.
4. A friendly network-failure message in place of "Failed to fetch".
5. A reason shown for disabled "Find the tipping point".
6. The composer dock covering the graph at 620 and 375.
7. 3D label overlap, and reframing after separation.

## Sequencing and risks

- **Freeze.** The October 31 freeze allows correctness and visual polish. The redesign removes and relocates features but adds none. It is still a large change to the exploration modules, so ship it behind the existing browser journeys and re-check keyboard-only use, reduced motion and the three widths.
- **Concurrent work touches the same modules.** PM102/PM103 (3D visuals) and PM099/PM100 (latency) are both in progress. Land or pause them first, or confine the redesign to new modules.
- **Architecture.** The workspace module holds 24 `useState`, 8 `useRef` and five staleness tokens, and the view-state rules are written in several places (see the PM074 architecture review). Rebuilding the UI on that interface is risky. Lifting the explore-turn protocol and the effective-experiment module first makes the redesign safer.
- **Guide.** If the direction is adopted, replace the stacked amendments in `UI_UX_GUIDE.md` with one current section for `/explore`, and record the decision in `DECISIONS.md`.
