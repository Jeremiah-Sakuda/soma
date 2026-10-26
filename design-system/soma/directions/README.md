# Soma proposed visual directions

**October 26, 2026. Three proposals for selection; none is selected or implemented in the product.** The existing `design-system/soma/MASTER.md` is unchanged. This folder is a standalone design preview, not a deployed app, connected workspace, or source-access claim.

Open `index.html` directly in a browser; no server, build, account, fonts download, or API key is required. Select A/B/C across the top. `Open lesson` opens an interactive circuit preview. `Inspect the change` shows the synthetic source/consequence story. Courses and Sources open that same context preview; this is intentionally not a complete navigation prototype.

| Direction | Character and layout | Main tradeoff |
| --- | --- | --- |
| A · Fieldnotes | Warm paper and forest green; Georgia editorial headings; persistent sidebar; a horizontal change brief followed by a generous lesson and adjacent commitments | Feels personal and academic; less compact than the other options |
| B · Daylight | Blue and white; compact sans-serif hierarchy; horizontal navigation; a split lesson canvas and clearly separated context column | Most familiar and easy to scan; less distinctive brand personality |
| C · Focus | Graphite and lime; large bold sans-serif titles with monospaced metadata; narrow tool rail; the lesson leads while consequences sit beside it | Strongest visual character and study focus; a darker, more technical mood may feel less welcoming to some students |

All three use the same original synthetic content: a confirmed interview at 16:20–17:00 reduces the available part of a declared 16:00–16:45 focus window to 20 minutes. The window itself is not edited. The current resistor lesson and exam scope remain unchanged; 25 minutes of practice remain pending. Email and calendar are two observations of one event, not two obligations. No external event is changed and no mastery claim is made.

## Skill application

Read the UI/UX Pro Max skill, current handoff, scope update, PRD R12, and existing master before authoring.

- `student workspace editorial calm --design-system`: relevant Minimalism & Swiss grid/whitespace guidance. The marketing page pattern and wellness font description were not applied. Fieldnotes intentionally uses locally available Georgia/system sans and the established warm palette.
- `productivity dashboard clarity blue --design-system`: blue/amber palette was relevant, but the dense BI layout was a poor fit. Retried `productivity workspace minimal --design-system`, yielding Flat Design and an approachable SaaS style. Daylight applies that clearer structure with the verified blue palette.
- `creative workspace dark minimal --design-system`: relevant minimal creative style and strong typographic hierarchy. Targeted `dark mode high contrast --domain style` returned the active Dark Mode/OLED style. Focus uses graphite rather than pure black, subdued lime, visible focus, and minimal effects.

These are intentional design adaptations, not raw generated recommendations. All visuals are original inline SVG. No third-party assets or remote fonts are loaded. Controls use semantic HTML, native modal focus and Escape behavior, and reduced-motion CSS.

## Executed validation

`node design-system/soma/directions/capture.cjs` runs the local preview in Chromium without a server.

- All three desktop layouts checked at 1440×900; the Open lesson control is entirely visible before scrolling. Its bottom is approximately 883px in A/B and 465px in C, including the comparison controls.
- All three checked at 390px and 375px widths: no horizontal overflow.
- Theme selection, lesson dialog, source dialog, and Escape-to-close exercised.
- Keyboard ArrowRight changes resistance from 3Ω to 4Ω: branch current becomes 3.00A and total current 5.00A.
- Captures run with reduced motion enabled.
- Desktop, mobile, and lesson screenshots visually inspected. This focused preview check is not a complete accessibility or scientific validation of the production product.

Screenshots for each direction:

- `fieldnotes-desktop.png`, `fieldnotes-lesson.png`, `fieldnotes-mobile.png`
- `daylight-desktop.png`, `daylight-lesson.png`, `daylight-mobile.png`
- `focus-desktop.png`, `focus-lesson.png`, `focus-mobile.png`

The demo state resets on reopening the file. It saves no learner evidence and makes no model calls. Changes in this task are limited to this directions folder.
