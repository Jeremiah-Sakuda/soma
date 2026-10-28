# Piazza read-only connector

Status: October 27, 2026. Connector safety boundary deployed from `3efb1cf`; clean CI passed 911 tests, 37 browser journeys, production build and isolated browser-runtime import. These checks do not close the live gate. Saved-login access reached a real authenticated class shell and class picker. The new structured preview reader has synthetic coverage; its actual extraction and publication are **not yet verified**. No Piazza source material has been published by this implementation work.

## Supported boundary

The student signs in and completes MFA directly in a separate provider browser. Soma retains the managed browser context through its existing encrypted connector store; passwords are not collected in Soma forms or fixtures. Ownership, exclusive leases, session expiry and publication checks use the shared browser connector.

Configuration accepts canonical HTTPS `piazza.com/class/<id>` overviews mapped to an owned Soma course. Discovery alone never selects a class. Semester membership requires explicit term metadata; repeated navigation links are not separate courses. The observed class picker included two Fall 2026 classes and one Spring 2026 class. Their private identifiers are not documented here.

Each refresh reads one selected class, rotating through the entire saved selection without a five-course limit. Only exact application scripts inventoried from the initial class document may execute. Requests for APIs, POSTs, sockets, other origins, frames, individual posts and unselected classes are blocked. No undocumented Piazza API is called.

Extraction reads titles and snippets of class-visible instructor notes from the initial rendered feed. Positive instructor/note markers are required. Private, section/group and graded items are excluded before reading their identifiers or text. Whole-page text, authors, full post accessibility labels, grades, attachments and replies are excluded. No post is opened or marked read. Empty or changed unsupported layouts fail explicitly; a visible feed with no eligible notes is labeled as such, not interpreted as an empty course.

The resulting source is explicitly a partial preview observation. It cannot establish full coverage or the absence of an announcement. Refresh keeps the connection labeled connected rather than claiming complete feed freshness. Unchanged previews retain source versions. A class-specific structural failure stales that class and its dependent lessons while preserving other classes and original learner attempts. Authentication failure affects the provider scope. Publication rechecks connection authorization and workspace revision.

## Remaining live gate

A typed catalog attempt failed closed on a URL scope check. A narrow rendered-location normalizer now accepts empty history delimiters while configured/network URLs remain strict. This suspected cause has not been confirmed by another successful actual extraction.

Subsequent session allocation failed with Browserbase HTTP 402. A separate read-only provider usage check returned `browserMinutes: 60`, `proxyBytes: 0`. Further session allocation was stopped. The account owner must review the provider billing/usage allowance; no plan change or payment was made. Saved authorization remains available.

When sessions are available:

1. Run the opt-in selected-class access probe with explicit owner/class scope. It must complete the actual renderer, catalog and structured preview reader without publishing material or calling Meta.
2. Verify both current-semester class identities and map them to the existing owned Soma courses. Do not select the prior-semester class.
3. Refresh only the selected classes and independently read back the owned source records, allowed fields and partial-coverage labels. Confirm no private content, grades, replies or attachments were ingested.
4. Inspect the production connection UI and retain the same boundaries during background refresh. Full posts/replies require a separate reviewed reader and are not implied by this gate.

## Verification

Synthetic tests cover URL and request restrictions, script inventory, remaining-time bounds, semester/catalog conflicts, privacy filters, unsupported structures, stable versions, rotating selection, failed-class isolation and guarded publication. The opt-in actual-provider test is excluded from ordinary CI. The build log records exact executed counts and the unresolved live gate; synthetic success is not evidence of actual source coverage.
