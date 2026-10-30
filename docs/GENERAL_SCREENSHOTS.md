# General screenshot validation — October 29, 2026

Soma's upload/capture path sends actual image pixels to Muse Spark. It does not call the prepared-example action or attach its graph facts. Spark authors the source interpretation, content, labels, steps and visual composition using approved components. Reusable renderers do not imply reusable lesson content.

## Production baseline

Nine screenshots were frozen before model requests, SHA-256 `eb2c3e615ab39eb0f53a0e3b74dbfa91c7e929e967bfcc7644986bd59c43e6e0`. Each used a new session, an opaque source label and the identical generic question, with no expected facts, topic hints, source URL or earlier artifact in the request. There was one outer request per case; bounded application repair remained enabled.

| Screenshot | First production result | Source-specific observations |
| --- | --- | --- |
| MDN closures documentation | Explanation published | makeFunc, displayName and the visible Mozilla binding |
| Google's gradient-descent lesson | Explanation published | Weights/bias, loss and the visible four-step loop; partial-source uncertainty retained |
| OpenStax light-energy page | Rejected | generation_invalid; no unsupported artifact published |
| Code counter starting at 7, increment 2 | Explanation published | Correct visible sequence 7 → 9 → 11 |
| Same code layout starting at 11, increment 3 | Explanation published | Changed content 11 → 14 → 17; no carryover of the previous screenshot's values |
| Spreadsheet | Explanation published | 14 × 35 − 160 = 330, matching the displayed formula and values |
| Series circuit | Explanation published | 12 V, 4 Ω, 8 Ω, one loop; explanation-only rather than an invented search graph |
| Cache process | Explanation published | Cache hit/miss, database and stale-data tradeoff |
| Unreadable crop | Clarification published | Asked for missing legible source information |

Thus 8/9 first requests returned the intended explanation/clarification category. The biology screenshot succeeded in a separate local-service diagnostic before the contract change, so its original failure's cause was not established. A further actual-provider check accepted the tightened contract. Neither repeat replaces the first failed result or establishes a reliability rate. All created production artifacts were deleted. Successful explanations supported stepping, selection when diagram objects existed, and actual save/readback.

Original screenshot fixtures and concise first-request results are under tests/fixtures/general-screenshots. Actual public-page screenshots remain private test artifacts; their sources are [MDN](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Closures), [Google's course](https://developers.google.com/machine-learning/crash-course/linear-regression/gradient-descent) and [OpenStax](https://openstax.org/books/biology-2e/pages/8-2-the-light-dependent-reactions-of-photosynthesis). Expected facts were used for inspection, not supplied as model input. No broad educational-effectiveness claim follows.

## Improvements from this check

The provider schema now binds application-owned artifact/source IDs and versions to literal values and offers only modes backed by the current computation. A non-graph screenshot can produce explanation or clarification; it cannot accidentally select a checked graph branch. Independent publication validation remains strict and does not overwrite an invalid returned binding.

Actual generated diagrams exposed overlapping labels. Authored positions remain when cards fit; crowded cards receive stable spacing and adaptive layout. IDs, labels, connections, source facts and saved specifications stay intact. Full annotation text is placed below the diagram. Geometry tests and a Chromium check cover dense labels at desktop, companion and phone sizes, including reduced motion and a visible self-loop. The skill search did not supply an exact diagram-collision rule; this adjustment is based on observed renders and explicit geometry/browser verification.

## Boundaries

General screenshots produce visual explanations, not verified arbitrary scientific simulations. Checked manipulation remains limited to supported BFS/Dijkstra graphs. Generated prose and source interpretation remain fallible; inaccessible or ambiguous inputs may fail safely or request clarification. Uploads accept PNG/JPEG up to 4 MB before normalization to the bounded service image. Dense tiny text may require a closer capture.

Post-change production UI verification and exact release identity are recorded in the private build handoff after deployment; preparation alone does not establish deployment.
