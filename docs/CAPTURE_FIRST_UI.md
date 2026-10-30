# Capture-first Soma — October 30, 2026

The user requested a ground-up interface reset for the current visual-exploration product: minimal, centered on screen capture, with a small frameless resizable explanation window and a path into the full app. This supersedes the old course-dashboard entry and the previous always-expanded exploration workbench. Existing course routes and data remain supported.

## The experience

1. **Capture home:** one quiet screen for choosing a window or uploading a screenshot. The reviewed image and question are the primary content. Examples sit behind an optional disclosure; history and account/connections are secondary.
2. **Quick explanation:** a compact resizable surface with the visual, manual steps/playback, provenance, uncertainty and an accessible follow-up field. Source assumptions, actual audit facts and save remain inspectable. Optional practice, suggested follow-ups, extended playback settings and deletion live in the expanded app.
3. **Explore in app:** expands the same mounted exploration. It does not open a separate anonymous session, reload the page, submit another question or discard the current source pixels, draft, selection, experiment or unsaved revision. Quick view returns to the compact surface.
4. **Library:** owned saved explorations and continuity tools remain available on demand. Guest history retains its existing 24-hour lifetime and does not transfer automatically into signed-in history.

Native macOS uses an actual frameless, opaque, resizable Electron window: default 540×650, minimum 380×460. Its toolbar is draggable, while buttons are not. Capture, expand, hide and a native options menu replace the crowded toolbar. Expanding unpins and enlarges the same window/WebContents; returning restores compact bounds and pin state. A later capture preserves the user's resized compact dimensions, clamped to the target display.

The browser offers a resizable in-page quick view, not an OS overlay. Compact/Roomy presets provide a keyboard alternative to dragging. Native resize/expand remains handled by the operating-system window. Web and native surface events are restricted to the existing trusted exploration renderer; no arbitrary URL or general native invocation API was added.

## Source, session and accessibility rules

- Browser window selection now produces a local preview immediately. **Ask sends exactly that reviewed snapshot.** A subsequent frame requires explicit Refresh snapshot. No continuous upload or inference on selection.
- Native Capture still hides the panel, obtains one snapshot and delivers it to the existing upload/review path. OS screen permissions remain required; no permission was broadened.
- Stop sharing stays visible after a result opens. Hide/close pauses playback; cancelling invalidates late requests and preserves the last valid explanation and question.
- The visual scrolls separately from the compact follow-up field. Controls retain names, focus rings, minimum target sizes and reduced-motion behavior. Expand/collapse reuses the same React state and native WebContents.
- Prepared examples, recorded generation and live model output retain distinct labels. General/3D explanations do not become checked simulations through this redesign.
- New colors and flat controls are scoped to capture/exploration and the visitor entrance; legacy course-workspace rendering is retained. Existing self-hosted Geist fonts are reused. UI UX Pro Max's verified Minimalism & Swiss Style and focus-not-obscured guidance informed the design; its generic marketing-layout suggestion was not adopted.

## Review findings fixed

- Initial capture preview still had the old Ask-time recapture. Removed it to prevent sending an unseen newer frame; regression changes source pixels after preview and checks exact outgoing JPEG.
- Hiding source setup also hid Stop sharing. Added a direct sharing status/action above the result.
- Drag sizing left inline dimensions that could clip the expanded app. Presets and surface transitions now clear these inline dimensions.
- Closing a native result hid the return/library controls. Compact capture home now retains them.
- Graph layout was keyed only to monitor width. Explicit compact presentation now selects the smaller graph coordinate layout even on a wide monitor.

## Verification and release status

Implementation is on `codex/capture-first-ui` in the existing isolated demo worktree, based on spatial commit `9f2e2c9` plus the retained demo-test branch. Concurrent root checkout and its uncommitted docs were not modified.

Executed so far: TypeScript; 56 generation/service regressions; 23 desktop unit checks; real Electron fixture smoke (sandbox, keyboard expansion, same WebContents/draft, bounds/pin restore, current-mode resync, trusted-route rejection, snapshot delivery, hide/mute); 33 browser capture/exploration/progress/spatial journeys; nine landing/credential continuity cases. These use original synthetic inputs and mocked provider/account responses where indicated, with no model calls or testing-budget increase. The first landing account test was blocked by missing synthetic Firebase configuration, then all nine passed with it supplied. Final visual/native/build checks are recorded below when complete.

Local preview: http://127.0.0.1:3198/explore. Screenshots and local run evidence are ignored under `.local/capture-ui/`. This change is not a new model reliability claim. No production deployment, signed/notarized rebuild, real OS permission recertification or real-course ingestion is established by these tests.

Official native references checked: [frameless window styles](https://www.electronjs.org/docs/latest/tutorial/custom-window-styles) and [Electron security](https://www.electronjs.org/docs/latest/tutorial/security).
