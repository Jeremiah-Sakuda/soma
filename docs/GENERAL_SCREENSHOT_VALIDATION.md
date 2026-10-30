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

## PM065 final deployed evidence

Production: dpl_2wmd1xkmEy42t9tHNNrJ2vdMQyAj, https://soma-24on3pfhl-jeremiah-sakudas-projects.vercel.app, aliased to https://soma-woad-beta.vercel.app/explore. Public source b41c16f7a56193854d3cafce368b0a939fd5f374 at https://github.com/Jeremiah-Sakuda/soma-hackathon. The 197-file source fingerprint 6e0e89a5ffc9c3c626f0106915f8469112d50a3c43df3f689a22e681b5b674b6 is exposed by /release.json.

Three additional fresh screenshots, created after the changes, passed actual production generation: a counter starting at 23 with increment 5 and outputs 28/33; a water-cycle explanation; and a concrete code/response mismatch (results versus rows) producing an undefined.map error. The counter used the real upload-and-Ask UI with an opaque filename and the generic question. Captured request activity showed one screenshot-generation action, actual image pixels and zero prepared-example actions. Its generated visual displayed the new values, accepted a selected-object follow-up, and survived UI save/reload/reopen. The follow-up used one bounded repair. Water cycle and debugging each used one bounded repair. All artifacts were deleted afterward.

The first direct API attempts for the latter two cases ran before the test harness had completed guest initialization and received session_expired. Corrected that harness wait; those pre-inference rejections are retained separately and are not model-generation outcomes. The first nine-case production baseline remains unchanged. A known synthetic BFS regression image also passed the new checked-mode contract on production; this is a regression check, not another fresh-generalization case.

Inspected the actual generated text against visible source facts, plus settled renders. Re-rendered stored outputs without model calls to compare diagram layout. Geometry and browser checks cover card overlap, text bounds and self-loop headroom. Relevant browser slice passed 35 existing journeys; the added dense-layout case initially used a helper expecting the BFS example title, then passed after fixing the test helper. The final public CI workflow 40988357305 completed successfully, including the complete unit/service suite, build, isolated browser trace, credential-browser adversarial checks and 102 browser journeys. Final source is clean in the public checkout; unrelated private root changes remain untouched.

Shared test ledger after all PM065 work: $6.480941 of the approved $15 total, with all previous spending/reservations preserved. No training/GPU job, new runtime model or arbitrary generated code. This evidence supports cross-domain screenshot-driven explanations; it does not guarantee every screenshot, verify arbitrary scientific models, or establish educational effectiveness.


## PM078 — Fresh public sources across eight subjects

Eight public-page captures were frozen before provider calls, with separate reference facts kept out of model prompts. Screens were captured in isolated unauthenticated browsers, not pulled from personal accounts. Initial capture-harness errors (footer/wrong section) were corrected before model testing and retained separately. This is a small development evaluation, not a learning study, random sample or production reliability rate.

The first new-feature batch was **0/8 published**: strict interpretation rejected a provider absent-value sentinel. Safe type diagnostics confirmed graph/change arrived as literal `"null"`; the existing graph normalization was extended only to the exact change sentinel, then strict validation remained. No wrong first-batch visuals were published.

On the unchanged repaired set, **7/8 published**, and all seven rendered at 620/375 pixels, saved and reopened with exact source metadata. These are repeated development cases, not first-request results:

| Subject / source | Repaired broad request | Observed behavior / limit |
| --- | --- | --- |
| [Programming — Python tutorial](https://docs.python.org/3/tutorial/controlflow.html#for-statements) | Published | Preserved sequence order and the three printed lengths |
| [Calculus — Lamar University](https://tutorial.math.lamar.edu/Classes/CalcI/ChainRule.aspx) | Published | Explained the missing inner-derivative factor; cropped statement noted |
| [Biology — OpenStax](https://openstax.org/books/biology-2e/pages/6-5-enzymes) | Published after review/repair | Distinguished activation energy from delta-G; review made an overly strong energy-layout inference, prompting a general layout-versus-measurement clarification |
| [Chemistry — OpenStax](https://openstax.org/books/chemistry-2e/pages/12-2-factors-affecting-reaction-rates) | Published | Explained the source's temperature/rate relationship and qualified its approximate rule |
| [Economics — OpenStax](https://openstax.org/books/principles-economics-3e/pages/3-1-demand-supply-and-equilibrium-in-markets-for-goods-and-services) | Published | Distinguished equilibrium, surplus and shortage using source values |
| [Statistics — NIST](https://www.itl.nist.gov/div898/handbook/eda/section3/eda3661.htm) | Published | Distinguished density from accumulated probability; unseen CDF plot identified |
| [History — National Archives](https://www.archives.gov/milestone-documents/emancipation-proclamation) | Published | Preserved scope limits; did not claim to transcribe the handwritten scan |
| [Physics — OpenStax](https://openstax.org/books/university-physics-volume-2/pages/10-3-kirchhoffs-rules) | Rejected after bounded review/repair | The broad junction-plus-loop request remains a failure; it is not counted as a pass |

Every published case was **explanation-only**, not a verified non-graph simulation. Source localization is model interpretation. Manual visual inspection additionally found a branch connector crossing a card; obstacle-aware routing and path-following animation fix that rendering defect without changing model facts.

### Actual interaction checks

- A real browser upload of the Python source, a clearly labeled local DOM edit (`cat 3` → `horse 5`, with other outputs unchanged), and an unchanged-image control all published. Spark identified only the consequential changes, preserved the original version, then returned an empty content-change list for the unchanged image. No publisher site was edited. Model-reviewed HTTP waits were about 16.8–20.9 seconds in these three runs.
- A first explicit NIST closer-look interaction failed, retained as a failure. A diagnostic produced an explanation without using the crop. Making the explicit prefix require region selection then yielded a real model-selected crop, interpretation, composition and Wonder approval, followed by a source-preserving follow-up. This demonstrates requested cropping; it does not establish that the model autonomously requests crops whenever needed.
- A separate focused junction question and source-preserving follow-up published. This is a narrower recovery, not a pass for the original broader physics request.
- Real Wonder review rejected three deliberately seeded contradictions (program length, enzyme thermodynamics and CDF shape). It also made additional unsolicited suggestions; this three-case challenge is not a critic precision/recall benchmark. No seeded variant was published.
- Real Meta streaming ASR returned partials and the final original synthesized question through the local relay. Cloud provisioning remains blocked pending approval; ordinary recorded input remains available.

All attempts share the existing $15 lifetime cap. Final spend and release verification are recorded after checks complete; no ledger reset, training result, student outcome or new checked family is claimed. Raw source screenshots, generated responses and test speech remain private test artifacts, not public fixtures.


### PM078 final local verification

The complete offline suite passed 1,412 tests (89 opt-in skips), all 126 browser journeys passed, and desktop/relay suites passed 14/3 tests. Typecheck, production build and isolated production browser import passed (1,224 traced files, two links, zero private configuration mappings). A final phone-label correction replaced long labels over tiny source regions with numbered markers; all seven affected source/pointing journeys and the rebuilt production bundle passed afterward. Keyboard, reduced motion, cancellation and stale-reference behavior remain covered.

Eight retained actual outputs (the seven broad successes plus the separate focused physics recovery) were replayed at 620 and 375 pixels: no horizontal overflow or page exceptions; headings were brought into view and model-region controls worked. These rendering replays do not add eight new generation successes. Actual Electron windows/preload/IPC/source highlighting also passed using controlled public pixels, synthetic microphone/helper boundaries and a retained real model response. Physical shortcut/OS capture permissions and audible hardware quality were not tested.

The signed local Mac companion is 0.3.0. It has not been notarized: the local `soma-notary` profile is still missing. The published notarized 0.1.0 download is preserved. Real streaming ASR was tested locally; cloud activation remains pending authorization for its service account, secret storage and scoped grants. Unconfigured deployments retain the recorded-question path. No new cloud relay resources were created.

Final last-read shared allowance is $8.440255 of $15, including prior tests and conservative/unknown reservations. No ledger reset, GPU training or extra model family. Detailed attempts and raw captures remain private; the source links and failure denominators above remain the public evidence.


### PM078 published verification — October 30

Runtime source: [be62bdca061251851346ec6d9468901bd5e47df5](https://github.com/Jeremiah-Sakuda/soma-hackathon/commit/be62bdca061251851346ec6d9468901bd5e47df5). [Clean CI 41089794472](https://github.com/Jeremiah-Sakuda/soma-hackathon/actions/runs/41089794472) passed unit/type/build/trace, 14 desktop tests, three relay tests, 28 isolated adversarial browser cases and all 126 browser journeys. The complete local unit result is 1,412 passes/89 opt-in skips; CI also passed that suite.

Production https://soma-woad-beta.vercel.app/explore is deployment `dpl_6qeBzywPSDaKKChCA1UC1hUgCYvW`. The exact committed/public/production runtime manifest matches: `soma-pm078-2026-10-30`, 228 files, SHA-256 `0d0cf1d45b7ca39077e9ded9f4c039b4936a7bcb64bc05a1f95a0f778f978f7c`. Hosted guest creation, prepared weighted experiment, exact save/reopen, companion/phone rendering, explicit reopen after reload and microphone policy passed without inference; own test records were removed. The first smoke harness expected a false capability field instead of its intentionally absent disabled form; the second omitted the explicit saved-card reopen action after reload. Both harness failures are retained; the stage-aware corrected run passed with zero page exceptions.

No relay provisioned: streaming capability is absent in production, so recorded input remains the normal path. Local signed 0.3.0 passed normal macOS deep/strict signature verification in both original and copied bundles (all file bytes matched); a restricted-environment verification gave an inconsistent invalid-signature result, retained separately. Notarization/physical native capture and audible-device checks remain outstanding. Total measured shared testing ledger is $8.440255/$15.


## PM080 — Generation reliability and truthful waiting (October 30)

The released design uses strict JSON scene configuration, with exact source/artifact/model bindings and the existing independent publication checks. Composition does not re-offer the completed source-inspection tool. New non-graph authoring uses only explanation-compatible panels; saved scenes remain compatible. Invalid optional location bounds are omitted without clamping. A malformed source interpretation may be re-read once from the same frozen pixels. A review with no usable typed result may receive one bounded format repair of the same unchanged candidate, preserving its prior response. Material criticism still requires author repair and re-review; unknown-billing transport failures are not retried. Original six-call, 90-second and $0.35 per-turn bounds remain.

Meta supports automatic tool choice only ([official tool-calling documentation](https://dev.meta.ai/docs/tool-calling)). Scene configuration now uses [structured output](https://dev.meta.ai/docs/structured-output); the critic accepts an actual review function result or explicitly requested JSON data, independently validating the verdict/findings. No function call is fabricated for a text response. Legacy provider callers retain their default behavior. Critic approval remains advisory; it is not verification of arbitrary subject matter.

The generation HTTP response optionally streams only actual application phases, then the complete validated artifact or a bounded error. No partial model explanation is published. The current diagram and draft remain available. Cancel now prevents the button's default form action, fixing a reproduced automatic-resubmission bug. Interrupted responses show a recovery message without exposing protocol/schema details.

### Ten-source development repeat

The eight PM078 captures were reused, with two additional official pages frozen before evaluation: [Python list comprehensions](https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions) and [NASA orbital laws](https://science.nasa.gov/solar-system/orbits-and-keplers-laws/). Reference facts stayed out of model requests. A private harness initially called native fetch's numeric status as a method after requests started; those interrupted attempts and conservative charges are retained. The new pages therefore count as development repeats, not clean held-out or first-request successes.

The final broad batch published **8/10**; each successful artifact rendered at 620/375 pixels and saved/reopened with exact metadata. Physics failed its interpretation contract; astronomy failed its review contract. Both subsequently published under the bounded-repair candidate (30.080s and 19.945s), with real checks/save/reopen. These two repeats do not replace the initial failures or make the original batch 10/10. Their source/review format-repair guards were not needed in those particular repeats; physics did need ordinary author repair after a material critic finding. The guards themselves were verified with deliberately malformed outputs in service tests.

| Source | Broad batch | HTTP wait |
| --- | --- | --- |
| programming | Published | 21.236s |
| calculus | Published | 22.108s |
| biology | Published | 18.991s |
| chemistry | Published | 20.802s |
| economics | Published | 20.514s |
| statistics | Published | 18.890s |
| history | Published | 21.938s |
| physics | generation_invalid | 6.536s |
| list-comprehension | Published | 19.479s |
| astronomy | review_unavailable | 22.975s |

Published broad cases had a 20.658s median HTTP wait. First phase feedback ranged from 0.354–1.530s, median 0.513s, measured from the generation request rather than from the start of a native speech gesture. Among the seven matched previously successful cases, the prior/current medians were 22.588s/20.802s in one repeat. These are uncontrolled development observations, not a speed guarantee or a statistical reliability rate. Generation, review repair, speech transcription and narration can add noticeable waiting.

### Checked computation and critic limits

A fresh original P/Q/R weighted screenshot passed real Dijkstra extraction/composition/review: P→Q→R costs 5 versus direct P→R cost 9. Actual cost investigation and an authorized direct-cost change to 1 passed subsequent real generation, exact original preservation and save/reopen (21.148s, 11.293s and 25.984s). An earlier private harness tried changing a control before the generated scene exposed it; the API rejected that request. The corrected harness first used the actual investigation action, which exposes weight editing. No prepared artifact substituted for live generation.

Wonder caught an actual queued-versus-settled narration error, then approved the repaired candidate. A later review demanded original source cost 9 while the user was exploring a hypothetical cost 1; the application kept the authorized current input and the repaired explanation clarified it before approval. Source facts and hypothetical changes remain distinct.

Critic experiments exposed false negatives: one constrained-output configuration missed a known contradiction, and a nested conditional review schema approved all three seeded errors. Those review configurations were rejected and are not released. The final short fact-focused tool-or-JSON critic rejected all three known contradictions in a subsequent check. Repeating this small development set does not establish critic precision/recall or universal factual correctness. All rejected/failed runs remain in private evidence. General subjects are explanation-only; only supported graph calculations receive checked-computation assurance.

### Executed verification

Final local typecheck/build/isolated browser trace passed; complete offline suite 1,428 passes/89 opt-in skips; all 129 browser journeys, 14 desktop and three relay tests passed. Source re-reading, incomplete/invalid review recovery, immutable candidates, terminal error/cancel handling, original state, ownership and hard bounds are covered. Final clean CI and production identity are appended after confirmation. Raw public-page screenshots, model responses and speech remain private test artifacts. No student outcome, arbitrary simulation, always-on video or training result is claimed.
