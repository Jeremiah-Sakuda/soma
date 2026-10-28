# Piazza read-only connector

Status: October 28, 2026. GCP saved-session access, both explicitly selected Fall 2026 classes, structured preview extraction, normal hosted publication and independent owned readback are now verified. CS440 produced ten eligible instructor-note previews; the combined EC463–464 class produced eight, mapped to the existing EC463 Soma course. These are partial initial-feed previews, not full posts or complete class coverage. Source publication passed; the UI reported some preparation jobs could not queue, so downstream lesson generation is not established. Earlier Browserbase blockers below are historical.

## Supported boundary

The student signs in and completes MFA directly in a separate provider browser. Soma retains the managed browser context through its existing encrypted connector store; passwords are not collected in Soma forms or fixtures. Ownership, exclusive leases, session expiry and publication checks use the shared browser connector.

Configuration accepts canonical HTTPS `piazza.com/class/<id>` overviews mapped to an owned Soma course. Discovery alone never selects a class. Semester membership requires explicit term metadata; repeated navigation links are not separate courses. The observed class picker included two Fall 2026 classes and one Spring 2026 class. Their private identifiers are not documented here.

Each refresh reads one selected class, rotating through the entire saved selection without a five-course limit. Only exact application scripts inventoried from the initial class document may execute. Requests for APIs, POSTs, sockets, other origins, frames, individual posts and unselected classes are blocked. No undocumented Piazza API is called.

Extraction reads titles and snippets of class-visible instructor notes from the initial rendered feed. Positive instructor/note markers are required. Private, section/group and graded items are excluded before reading their identifiers or text. Whole-page text, authors, full post accessibility labels, grades, attachments and replies are excluded. No post is opened or marked read. Empty or changed unsupported layouts fail explicitly; a visible feed with no eligible notes is labeled as such, not interpreted as an empty course.

The resulting source is explicitly a partial preview observation. It cannot establish full coverage or the absence of an announcement. Refresh keeps the connection labeled connected rather than claiming complete feed freshness. Unchanged previews retain source versions. A class-specific structural failure stales that class and its dependent lessons while preserving other classes and original learner attempts. Authentication failure affects the provider scope. Publication rechecks connection authorization and workspace revision.

## Historical live blockers (before the GCP checks below)

A typed catalog attempt failed closed on a URL scope check. A narrow rendered-location normalizer now accepts empty history delimiters while configured/network URLs remain strict. This suspected cause has not been confirmed by another successful actual extraction.

Subsequent session allocation failed with Browserbase HTTP 402. A separate read-only provider usage check returned `browserMinutes: 60`, `proxyBytes: 0`. Further session allocation was stopped. The account owner must review the provider billing/usage allowance; no plan change or payment was made. Saved authorization remains available.

When sessions are available:

1. Run the opt-in selected-class access probe with explicit owner/class scope. It must complete the actual renderer, catalog and structured preview reader without publishing material or calling Meta.
2. Verify both current-semester class identities and map them to the existing owned Soma courses. Do not select the prior-semester class.
3. Refresh only the selected classes and independently read back the owned source records, allowed fields and partial-coverage labels. Confirm no private content, grades, replies or attachments were ingested.
4. Inspect the production connection UI and retain the same boundaries during background refresh. Full posts/replies require a separate reviewed reader and are not implied by this gate.

## Verification

Synthetic tests cover URL and request restrictions, script inventory, remaining-time bounds, semester/catalog conflicts, privacy filters, unsupported structures, stable versions, rotating selection, failed-class isolation and guarded publication. The opt-in actual-provider test is excluded from ordinary CI. The build log records exact executed counts and the unresolved live gate; synthetic success is not evidence of actual source coverage.


## P067 — Actual GCP class selection and preview publication

October 28, 2026. Jeremy selected CS440 and EC463. Saved-session catalog inspection verified three entries: the two requested Fall 2026 classes and a Spring 2026 class that remained unselected. Piazza labels EC463 as a combined EC463–464 Senior Design class; it is mapped to the existing owned EC463 course, not a new invented course. The first private discovery check incorrectly expected both code labels to match a single-course pattern and failed when only CS440 matched. A second metadata-only inspection preserved the actual combined label and verified the mapping. This was a probe assumption correction, not a relaxation of extraction/privacy rules. No posts or feed text were read by catalog discovery.

Both existing opt-in typed access probes passed against restored GCP state: CS440 in 11.01 seconds with ten eligible previews, EC463 in 9.09 seconds with eight. They verified the explicit term/catalog and supported field contract, with zero model calls or material publication in the probes. The actual renderer emitted empty history delimiters accepted by the existing rendered-location normalizer; configured/network URLs remain strict.

Saved exactly the two selected class targets through the production UI. Two successive normal refreshes exercised its one-class rotation and each committed one source version, at 2:53:14 PM and 2:53:47 PM America/New_York. Independent owned readback passed in 2.72 seconds: two current live source records, correct owned course mapping, version 1 each, explicit partial-preview labels and only previewId/title/snippet/optional postNumber row fields (ten/eight rows). No private source bodies or class identifiers were added to public documentation/fixtures.

The connection intentionally stays connected rather than claiming complete freshness. Some preparation jobs could not queue; sources remain saved, and no downstream model decision/lesson success is inferred. Full posts, replies, private/section content, graded items, attachments, complete feed coverage, expiry/deletion and real-course teaching fit remain separate gates. No application code or deployment change was needed; the prior broad CI was not rerun. Private probe scripts are removed after execution and local evidence remains ignored.
