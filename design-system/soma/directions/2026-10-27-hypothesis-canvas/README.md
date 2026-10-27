# Hypothesis-first directions (F–I)

**October 27, 2026. Four unselected explorations for Jeremy's review. Not adopted or implemented.** [UI Direction](../../../../docs/UI_DIRECTION.md) (Ready Card) stays authoritative until Jeremy selects a change and it is recorded in [Decisions](../../../../docs/DECISIONS.md). Origin: build-log entry PM015.

Viewed as a private design canvas at https://claude.ai/artifact/5NaNL77LNFvGKhbWzFuyBk. These `.dc.html` files are that canvas's source and need its runtime (`support.js`); they don't open as standalone pages.

## Why a new set

Earlier explorations (Fieldnotes, Daylight, Focus, Notebook, Agenda, plus Ready Card, Brief and Bench) varied the look of a study dashboard. In all of them the first screen shows a lesson card. The two competing explanations and the experiment that separates them, which are Soma's most distinctive behavior and the demo's hero moment, only appear after drilling in. Each direction here puts that moment on the first screen and varies the visual language.

| Board | Character | Structure | Tradeoff |
| --- | --- | --- | --- |
| F · Casebook (`Main.dc.html`) | White page, Newsreader serif display, Inter body, blue A and orange B | Reads top to bottom as a case: exhibit (the quiz answer) → two explanations → experiment → what changes | Most legible "this is an investigation" story; long page, calmer on video |
| G · Bench (`Blueprint.dc.html`) | Dark navy, Space Grotesk and JetBrains Mono, cyan A and amber B | Lab bench: step rail, a live schematic with a probe on R₁, a scope trace, and predict/revision on the right | Strongest "agent at work" and video energy; technical mood may feel less welcoming |
| H · Plate (`Swiss.dc.html`) | Swiss style: white, black, red A and blue B, Inter Tight at very large sizes | Numbered plate: 01 evidence, 02/03 explanations, 04 giant live readouts and chart, then a black revision band | Most memorable at a glance and in thumbnails; least warm, sparse on context |
| I · Studio (`Studio.dc.html`) | Friendly bento: lilac ground, indigo hero tile, peach and mint "maybe" tiles, Bricolage Grotesque and Figtree | Today as a tile grid: the hero lesson with chart, the two maybes beside it, then predict, what happens next, and context tiles | Most approachable for students; playful wording ("maybe", "guess") must stay within copy rules |

All four use the same original synthetic content and the same interaction. The scenario is the scope update's flagship: Quiz 3's "each branch gets 3 A" (12 V, 6 Ω ∥ 3 Ω). Explanation A splits the correct 6 A total evenly, giving I₁ = (2 + 12/R₂)/2. Explanation B treats the battery as a fixed 6 A supply, giving I₁ = 3 A. Both match the quiz at 3 Ω. At R₂ = 12 Ω, A predicts 1.50 A, B predicts 3.00 A, and the checked model gives 2.00 A. The checked trace stays hidden until the student predicts or chooses to explore, and exploring is labeled as support. Each of the three predictions leads to a different revision and a different next activity. Those states are scripted for the mockup, not Spark output.

## Skill application

Used Jeremy's locally installed UI/UX Pro Max skill (`~/.codex/skills/ui-ux-pro-max`, search only, no `--persist`). The `--design-system` query "scientific investigation tool editorial" returned Neumorphism with Poppins and Open Sans, a poor fit for a reading- and evidence-heavy tool, so it was not applied. Targeted searches were used instead: style "editorial magazine" (Editorial Grid / Magazine → F), "blueprint technical schematic" (HUD / Sci-Fi FUI, taken without glow → G), "swiss international grid" (Minimalism & Swiss, Exaggerated Minimalism → H), and product "education learning platform" (Claymorphism + Micro-interactions, Vibrant & Block-based → I). Typography pairings were chosen by hand where the database's matches (Playfair, Varela Round) were off-tone.

Existing invariants were kept: the prediction is optional and saved before the reveal; exploration is recorded as support; no "wrong" wording; explanations are labeled suspected and correctable; there is a synthetic-mode label; there are real buttons, labels and range inputs, with ≥ 44 px targets and visible focus; and chart lines are distinguished by dash pattern as well as color.

## Not verified

Following the canvas tool's guidance, no render, screenshot, contrast measurement, keyboard or reduced-motion check was run on these boards. Treat them as review material, not accessibility evidence. Any selected direction still needs the UI Direction checks when it is implemented.

## Personality concepts (J–L)

**Added October 27, 2026 after PM017 feedback that F–I lack personality. Unselected.** F–I vary type and color on an otherwise generic dashboard. J–L each start from one idea Soma could own, which then sets the mark, a custom symbol set for Soma's own concepts, the voice and one signature motion. They are static concept sheets meant for choosing an idea, not complete screens.

| Board | Owned idea | Mark and symbols | Product consequence |
| --- | --- | --- | --- |
| J · Neuron (`Neuron.dc.html`) | A soma is a neuron's cell body: dendrite inputs meet there and it decides whether to fire | Violet cell body with dendrites and a coral axon; source = dendrite, explanations = fork, experiment = spike, ready = axon terminal | Today shows which sources came in, which were read with no change (faded) and the one activity that fired |
| K · Margin notes (`Margin.dc.html`) | Soma is a TA writing in the margins of your actual work | Handwritten wordmark; hand-drawn circle, fork, wavy "suspected" underline, check, star and quote brackets in Soma's pen | Three inks are reserved: graphite for the student, red for the instructor, violet for Soma. This turns the observation/interpretation separation rule into the visual system |
| L · Specimen (`Specimen.dc.html`) | Learning has elements; each concept gets a periodic-table tile | So, Sr, Ob, Ex, Xp, Rv and Nx tiles with numbers, colors and glyphs; stamps such as "checked model" | A lesson's history reads as a formula (Ob → Ex·A/Ex·B → Xp → Rv → Nx); dashed tiles mark unresolved steps |

Handwriting in K is limited to short Soma notes; anything that needs careful reading stays in sans. Copy keeps the existing rules: "suspected", nothing graded, no gamification. The same verification caveat as F–I applies.

## M · Playground (light and dark)

**Added October 27, 2026 after PM018 ("Still not sold on these") and Jeremy's PM019 answers. Unselected.** References: Linear, Raycast and Arc, plus Duolingo and Headspace, plus Things, Notion and Readwise. The student's first feeling should be "curious, want to touch it". No character: the work is the star. J–L were "too conceptual".

M is a real Today screen, not a concept sheet. `Playground.dc.html` has a `theme` tweak (light or dark); `PlaygroundNight.dc.html` imports it with `theme="dark"`.

- **Pro-tool polish (Linear, Raycast, Arc):** Geist and Geist Mono; an Arc-like sidebar with each course as a colored space; a ⌘K "jump or request a lesson" bar; hairline borders and quiet surfaces; a near-black dark theme.
- **Warmth and tactility (Duolingo, Headspace), no mascot:** chunky buttons that physically press down (a solid bottom shadow that collapses on press); a big dial-style slider; amber current dots that flow around the circuit, faster for more amps.
- **Calm (Things):** an "Also today" list with round course-colored checkboxes; one hero, little chrome.
- **The hook:** the R₁ branch starts switched off ("I₁ = ?, predict to switch this branch on") while R₂'s branch flows live as you drag. Guessing, or choosing "skip the guess" (recorded as help), switches it on. The point lands when R₁'s dots keep the same pace no matter how far you crank R₂.

Current dots use CSS `offset-path` animation; with reduced motion they sit still at evenly spaced positions. Not rendered or checked here. Any physics shown in production must still come from the checked model.

## N · The knowledge graph as the premise (semester map)

**Added October 27, 2026 after PM020 (functionality and layouts) and PM021 ("make the knowledge graph the central premise"). Unselected, and in conflict with current scope:** [UI Direction](../../../../docs/UI_DIRECTION.md) lists graph dashboards as out of scope, and [Learning Graph Scope](../../../../docs/LEARNING_GRAPH_SCOPE.md) says the P0 view is local and "not a new full-screen graph destination", listing a semester-wide explorable graph under Later. Adopting N needs a recorded decision.

**Functional model.** The graph is the organizing premise, drawn as a transit map rather than a force-directed web:

- **Lines** are courses; **stations** are syllabus concepts, placed by week; a **Now** line marks the current week.
- **A station's look comes from the evidence:** worked on your own (filled), with help (half-filled), two explanations being tested (dashed ring with a pulse), coming up (hollow, from the syllabus only), or an exam or deadline (diamond). There are no percentages, and color is never the only signal.
- **Interchanges** are cross-course links. They show only as dashed "proposed · not verified" links, matching the cross-course stretch goal.
- **Zoom levels replace separate destinations.** Map (semester) → line (course) → station (concept and its evidence) → playground (the experiment at an uncertain station). Today is the map's "frontier": the one to three stations to visit now, given your time.
- "Since you last looked" changes link to the station they affected. Unchanged sources are counted, not listed.

**Boards**

- `Map.dc.html` is the home, and it's interactive. Frontier chips and change cards select stations; the inspector shows status, evidence labeled by who said it, what the station builds on and leads to, and the action. The uncertain station shows maybes A and B and links to the Playground board.
- `Station.dc.html` is the concept page. It shows the direct neighbors only, never the whole web; what Soma thinks now (versioned) with "that's not what happened"; and an oldest-first evidence timeline labeled You, Instructor, Source or Soma, including pending future entries.
- `MobileMap.dc.html` (390 × 844) shows the frontier card, a course switcher and one vertical line with "You are here".

**Data honesty.** For courses without learner evidence, stations come only from syllabus and course sources ("coming up" or plain stations); learner states appear only where saved observations support them. Not rendered or checked.

## O · Personas, usage and navigation

**Added October 27, 2026 after PM022 ("take a step back and think about the user first"). A proposal, not adopted.** The personas extend the PRD and [user stories](../../../../docs/USER_STORIES.md) (the juggler, the student with short windows, and returned work as a situation), plus an exam-week planner and a no-account visitor (a judge or classmate). They are hypotheses, not interview results.

**Conclusion: the graph is the premise; the next action is the home.** Four of the five personas open Soma to answer "what now?". The map explains every recommendation and is one tap away, and Today shows this week's slice of it. This also respects the PRD's "defer graph or mastery dashboards".

- **Always on screen:** the next activity with time chips and its station chip, a count of what changed, and where you are this week on the map.
- **One tap:** the full map and exam scope, station evidence and correction, Ask (⌘K), and Activity.
- **Tucked away:** sources and connections, privacy, account and export.

**Navigation**

- **Desktop sidebar:** Today · Map · Activity, then course lines (each opens the map filtered to that line), with Sources and a freshness indicator pinned at the bottom. ⌘K handles asking and jumping.
- **Phone tabs:** Today · Map · ＋Ask · Activity.
- **No Courses or Study tabs.** A course is a line on the map, and lessons open from wherever you are.

**Layout principles:** one primary action per screen, sized to your time; the graph explains but never blocks; the station chip is one object everywhere; time is an input, not a calendar; honest by default.

**Wireframes** (low fidelity, annotated):

| Board | Persona | What it shows |
| --- | --- | --- |
| `WireJordan` | The juggler, on a laptop | A five-week map window, a Next card that plays in place, time chips, changes as consequences, in-progress work and source freshness |
| `WireAna` | Returned work | Her page in three inks; the mistake sorted first (slip, misread, idea to check, late penalty with no practice); a plan ending at Friday; "that's not what happened" |
| `WireLeo` | Exam week | Exam scope as a cited map filter; stations ordered by evidence with no scores; a 45-minute session builder; removed topics stay on their line but leave the bracket |
| `WireSam` | Short windows, on a phone | Time chips first; resume before anything new; only what fits ("waiting", never "missed"); a thumb-zone primary button; the map as a single strip |

## P · Study your way: Make from any card

**Added October 27, 2026 after PM023 (choose your own studying, in the spirit of NotebookLM's generated quizzes and flashcards, on each card). A proposal, not adopted.** It extends existing PRD scope rather than adding a new one: direct requests ("Show me how this works"), ordinary practice and spaced review cards all go through the same preparation engine as Soma's suggestions.

- **Every station card has a Make panel.** It works the same on the map, Today and phone, and through ⌘K ("10 flashcards on Kirchhoff"). Formats: interactive lesson, practice quiz, flashcards, worked example, explain it plainly, exam-style set.
- **Suggestions and choices sit side by side.** Soma's pick is labeled "Soma suggests this" within the same grid, never forced.
- **Availability is honest.** An interactive lesson is offered only where a checked model exists; otherwise the tile says why. An exam-style set needs a known exam scope.
- **Cover:** just this station, plus its direct neighbors (to catch gaps underneath), or the exam scope. **How it counts:** closed book, or hints allowed (recorded as help).
- **Grounded generation.** It uses only the station's listed sources, cites a source on every question or card, and passes through "Preparing" and then "Checking answers against the sources". Sets are saved to the station.
- **Results honor the evidence rules.** A correct closed-book answer to a fresh item can mark the station "on your own"; hints mean "with help"; flashcard ratings only schedule review (matching the AGENTS.md rule that self-ratings never become independent evidence). A repeated miss can prompt Soma to suggest a discriminating experiment, so both paths feed the same map.

Boards: `Make.dc.html` (interactive: pick a station, format, scope and mode, then Make goes through scripted states to a cited preview), `SetViews.dc.html` (the quiz and flashcard views plus where results go) and `MakePhone.dc.html` (a bottom sheet from a station).

**Positioning risk:** user-generated quizzes and flashcards on their own resemble NotebookLM and the guide's "simple AI for Education" anti-pattern. They should support Soma's distinctive loop (sources, the map, evidence, experiments), not lead the demo.
