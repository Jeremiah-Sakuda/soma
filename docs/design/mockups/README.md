# UI mockups (reference only)

Original mockups from the October 26, 2026 UI exploration, exported from a design canvas. The specification is [UI_DIRECTION.md](../../UI_DIRECTION.md); these files show its look and copy.

| File | What to take from it |
| --- | --- |
| `a-today.dc.html` | Selected direction: Today screen, ready card, session builder, lists |
| `a-lesson.dc.html` | Selected direction: lesson stage, controls, numbers table, Predict first states |
| `b-today-change-entries.dc.html` | Change entry content only (source passage, before → after); restyle in A's tokens |
| `b-lesson-why-timeline.dc.html` | "Why this is here" timeline content only; restyle in A's tokens |
| `c-evidence.dc.html` | Paired evidence layout only; restyle in A's light tokens |

These mockups predate the R12 student-hub scope, so commitments (focus window, interview, Coming up) appear only in the specification. "A" here means the Ready Card, not "A · Fieldnotes" in `design-system/soma/directions/`.

The files use the canvas's template format (`{{holes}}`, `<sc-if>`, `<sc-for>`, a `DCLogic` class) and won't render as plain HTML. Don't port that syntax. The inline circuit arithmetic exists only so the mockups respond; production values must come from the checked model module. All course content is from the labeled synthetic development semester.
