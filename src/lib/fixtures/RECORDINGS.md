# Recorded exploration provenance

`recorded-graph.json` and `recorded-circuit.json` are allowlisted exports of actual completed Meta runs on original synthetic Soma demonstration slides. They are editable local replays, not new inference. Their numerical results are checked again when opened.

| Recording | Actual investigation completed (UTC) | Exact source asset | SHA-256 of submitted image |
| --- | --- | --- | --- |
| Graph | 2026-11-04 03:14:33.839 | `/synthetic/recorded-lecture-14.png` | `515f4259b058a6b08465aa0f8e4d7e9b23838eb0240a99d3e945c586c894f918` |
| Circuit | 2026-11-04 03:16:39.831 | `/synthetic/recorded-lecture-9.png` | `fae05fdd937999d33d47b8129fae8b2410b827ba6352ee36c5e9274f4a7fb59f` |

Each generation receipt describes its recorded investigation only; it is not an aggregate of the initial reading and follow-up. Original timestamps, model-selected investigations, usage, costs, audit events, source interpretations and coordinates remain unchanged. Ownership IDs are rebound when a replay opens. Raw provider responses, native capture references and learner records are excluded.

Both sources retain confirmed Wonder image-reading checks from their actual initial readings. Those inherited source facts are distinct from each investigation's Wonder advisory review of the composed explanation. The graph investigation chooses D–F for “What would make the route go through E?” and computes its critical cost of 5. The circuit investigation chooses R4 while observing current in R5, gives its recorded reason, and computes the exact balance at 8 Ω. The graph's original coordinate and neighbor-order uncertainty remains in the fixture; model agreement does not establish source accuracy independently.

`recorded-circuit-presentation.json` is a separate deterministic drawing alignment computed from the exact recorded source image using `snapCircuitToDrawing`. Replay uses it only to place marks on the drawing and labels the presentation adjustment. The original source layout, circuit input, explanation, generation receipt and audit remain untouched. Its four node centres are within 0.86 pixels and its six part midpoints within 8.54 pixels of the independently measured 1600 × 900 slide positions.

`recorded-graph-presentation.json` similarly uses `snapNodesToDrawing` with the actual source pixels and recorded topology. It adjusts five node positions while retaining the original edge-label positions. In particular D and F lie within 3 pixels of the independently measured drawing centres. The graph's original source coordinates and uncertainty remain unchanged, and the display identifies the alignment as a replay presentation adjustment.

Both public exports and exact source images were manually inspected as original synthetic material. `tests/server/recorded-fixtures.test.ts` pins the reviewed export bytes, checks source hashes, and recomputes the recorded numerical interventions. Updating a recording requires reviewing the replacement actual artifact and its matching image.
