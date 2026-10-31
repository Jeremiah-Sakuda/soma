# Personality directions for the one-stage explorer (A–D)

These are four explorations made on October 30, 2026 for Jeremy's review. None has been selected or implemented. The origin is build-log entry PM109, after feedback that the current interface "lacks personality". All four apply the one-stage layout proposed in [UI_POLISH_AUDIT_2026_10_30.md](../../../../docs/UI_POLISH_AUDIT_2026_10_30.md).

The canvas is private: https://claude.ai/artifact/RSWJTD3Hvd5r1xkzYjYk2E. These `.dc.html` files are its source. They need the canvas runtime (`support.js`) and don't open as standalone pages.

## The shared moment

Every board shows the same checked state: the weighted example at step 3 of 5.

- S and A are settled. B has just been settled at cost 2.
- Through B, Goal's tentative cost drops from 10 to 3.
- C (2) and Goal (3) are waiting. Unconnected X is unreached.
- Dijkstra's route costs 3 and BFS's fewest-edges route costs 10.

Each cost label sits on its own edge. This directly fixes the misplaced S→C label the audit found.

The Instrument board's fader note says the route through B ties the route through C when the B→Goal cost is 6 (2 + 6 = 8), and loses above 6. That follows from the example's edges: S→A 1, A→B 1, B→Goal 1, S→C 2, C→Goal 6 and S→Goal 10.

## The directions

| Board | Idea | Look | Signature | Risk |
| --- | --- | --- | --- | --- |
| A · Light table (`Main.dc.html`) | Soma lifts the idea off your screen. The diagram is a clean overlay of what you captured. | Lightbox paper, crop marks, cobalt ink, highlighter yellow; Instrument Sans and IBM Plex Mono | The source slide sits beside the diagram with a "Lay it over the slide" switch; the changed edge and phrase are highlighted | The quietest of the four; its personality depends on the capture-and-overlay moment really working |
| B · Instrument (`Instrument.dc.html`) | Soma is a well-made instrument you play. | Light hardware panel, black display, signal orange; Martian Mono and Inter Tight | LCD route readouts, a step sequencer, a physical fader for the selected edge's cost, a "checked" status light | Hardware styling can read as a gimmick if the controls don't behave like real ones |
| C · Observatory (`Observatory.dc.html`) | Understanding spreads like light. | Night sky, gold for reached nodes, coral for the current step; Syne, DM Sans and DM Mono | "Light has reached 3 of 6 places", rings around the current node, a large one-sentence narration, "Wonder about something…" | It is the only dark direction; it must stay legible in a bright lecture hall and on video |
| D · Riso zine (`Zine.dc.html`) | A study zine printed about whatever is on your screen. | Newsprint paper, riso blue and fluoro pink, halftone fills; Archivo Black, Archivo and Courier Prime | A misregistered headline, taped panel, a "10 → 3!" sticker, a stamped step counter, "Plot twist:" copy | The loudest of the four; the playful voice must stay within the copy rules and not trivialize the content |

Each board has one tweak: the accent color, or the second ink on D.

## Notebook variations (N1–N3, PM110)

These were added after Jeremy asked, "What if we lean on the notebook/notepad type of styling?" The October 27 "Notebook" and "Fieldnotes" boards only borrowed the name. They were clean dashboards with no paper, rules, ink or handwriting. These three variations use real notebook material.

All three share one rule that turns notebook style into honest provenance: **printed type is what Soma's solver checked, and handwriting is Muse's explanation.** Costs, states and route totals are always typed. The one-sentence narration and short callouts are handwritten in a single reserved ink. This applies the observation and interpretation separation that the October 27 Margin-notes concept (K) proposed, and it replaces most of the current mode labels.

| Board | Notebook | Signature | Risk |
| --- | --- | --- | --- |
| N1 · Engineering pad (`Pad.dc.html`) | Green computation paper, graphite, red pencil for the change, blue-pencil handwriting (Architects Daughter) | The title block holds Subject, Source, Sheet 3 of 5 and Checked by Soma. Steps are sheets. The route totals sit in a boxed "Answer so far". | Engineering lettering can feel technical rather than warm |
| N2 · Spiral notepad (`Spiral.dc.html`) | White ruled paper, red margin, spiral binding, highlighter, violet handwriting (Caveat) and Atkinson Hyperlegible type | Saved explorations become the divider tabs on the page edge. The narration is a sticky note. The margin holds "3/5". | Skeuomorphic details such as the coil and tabs must not crowd small widths |
| N3 · Dot journal (`Journal.dc.html`) | A cream dot-grid spread, washi tape and an elastic band, Young Serif with Work Sans, teal handwriting (Kalam) | The search state is a bullet-journal log: × settled, → now, • waiting, ○ unreached. Each step is a numbered page. | A two-page spread needs its own layout at companion and phone widths |

## Not verified

Following the canvas tool's guidance, nothing was rendered, screenshotted, contrast-measured or checked by keyboard on these boards. The colors were chosen for at least 4.5:1 text contrast, but no measurement backs that. Whichever direction is selected still needs the UI guide's accessibility checklist when it is built.
