# Optional computer actions (PM086)

Soma can propose and, after local approval, perform one bounded action in a selected macOS app. This is separate from visual explanations and read-only course collection. The existing signed 0.3.0 download does not contain this change until a new native build is signed, notarized and published.

## Use

1. Start the new native build and open Soma once to establish its authenticated or guest session.
2. Focus the app you want to change and press **Command–Shift–A**. Grant macOS Accessibility permission if requested, then try again. Soma opens a separate local control window. The selected app must expose standard Accessibility controls.
3. Review the app name and expandable control list. Enter a specific task, without secrets, then choose **Ask Muse to propose one action**.
4. Review the proposed effect, exact control and replacement text. Explicitly approve and execute this action. For a button that submits, sends, deletes or purchases, that approval must cover that effect. Filling a field does not authorize a subsequent press.
5. Review the app result. Every additional action needs another proposal and approval. **Escape** stops pending work. It cannot undo an action the operating system has already accepted.

A task lasts two minutes and allows at most five separately approved actions. Changed controls, positions, existing field values or target-window identity invalidate an earlier proposal. There is no background automation or general code execution. Selecting a different app requires a new task. Starting capture/Point & ask ends computer-control authority; starting computer control disables Point & ask to keep the Escape handler exclusive.

## Intelligence and boundaries

The existing Spark Responses tool path proposes one strict `click`, `type`, `clarify` or `done` result, with a short description of the effect. The application returns actual model/call/cost facts. A local Actions this task list shows approved changes and native outcomes; this transient action history is discarded on stop and is not durable learner evidence. The model sees the explicit goal, app name, bounded sanitized Accessibility labels and up to five previous approved actions with actual native outcomes. It can propose a next step instead of repeating completed work. A `done` response is explicitly a model assessment requiring user verification. It does not receive a screenshot, existing field values, window title, password fields or a stream of computer activity. The label list is visible before sending. Labels are untrusted input, not instructions.

A new same-origin `/api/explore/computer` endpoint resolves existing ownership, acquires the existing shared admission slot, reserves the existing $0.35 exploration allowance, bounds the request to one 25-second call, and settles actual usage. Unknown sent usage retains its reservation. Deletion/cancellation is rechecked after inference and settlement. No remote proposal executes an action.

The local privileged broker accepts IPC only from the exact bundled control page and its main frame. Hosted Soma content has no execution bridge. The broker stores the plan and selected process; the renderer cannot replace them at execution time. Execution reacquires the selected app and compares a fresh native observation before invoking a one-shot helper.

The Swift helper uses macOS Accessibility, not shell scripts or arbitrary coordinates. It resolves standard enabled buttons, checkboxes, radio buttons and single-line text fields. Password/payment/authentication-looking controls, scripting/command controls and terminal/script-editor applications are excluded. Duplicate controls with the same role and label are rejected because the user could not distinguish the target in the approval preview. It bounds traversal, messaging and process time. A local fingerprint includes window identity, control labels, geometry and hashed current values; none of those values leave the helper. For clicking, the pointer moves to the resolved control and AXPress is invoked. Typing replaces the exact editable field value through AXValue and reads it back locally. No Enter, Tab, arbitrary key chords, terminal commands, drag gestures or multi-action batches are supported.

After typing, a matching local readback confirms the field value. After pressing, successful AXPress and refreshed controls confirm only that the control accepted the action. They do **not** prove that a network request or submission completed. The UI says so. Unsupported/canvas-only applications require manual operation. Goal input is not a credential vault; enter secrets directly in the provider app.

## Verification and limits

**Executed:** 13 focused server/route tests, 7 computer-policy/session tests, TypeScript typecheck, Swift typecheck and native compilation passed. A headless Chromium check verified the trusted local approval form, checkbox gating and absence of horizontal overflow at 600px; its original synthetic screenshot was visually reviewed. No provider or real OS actions were used.

Offline tests cover strict target/type/text checks, secret/control exclusions, ownership expiry, unknown-usage reservation retention, cancellation after inference, deletion during settlement, remote IPC rejection, renderer plan substitution, stale observations, and Escape suppression of late proposals. The Swift helper has been typechecked and compiled. No real user app was clicked or typed into during development, and no paid model call was used for this feature.

Remaining human verification: Accessibility permission on a clean Mac; a benign original form in a selected app; exact field replacement and readback; Escape and focus interruption; an original synthetic model-driven proposal; a new signed/notarized distribution. General desktop task completion, unattended operation and arbitrary-application support are not established.
