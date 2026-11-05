# Latency and responsiveness

Soma separates local manipulation from model generation. Cutting a connection, changing a permitted value, stepping or moving the camera recomputes/renders locally; asking for a new interpretation or explanation invokes the bounded provider pipeline.

Recent hosted first generations took 45–49 seconds, and a circuit investigation took 32 seconds. Earlier simpler requests were faster. These are measured examples from small development runs, not promised service levels. The shared turn deadline is 90 seconds; individual provider calls and repairs must fit it and the call/spend allowance.

## Waiting without losing the experience

- Keep the last valid visual and typed draft while new work prepares.
- Report only actual application phases and elapsed time; do not invent progress percentages or publish unchecked partial explanation.
- Allow cancellation, and prevent delayed cancelled/stale work from replacing the active artifact.
- Use a local cursor trail and immediate control feedback independently of inference speed.
- Prepare narration ahead only during active playback; pause interrupts preparation/playback. Captions and manual steps remain usable.
- Keep prepared examples and completed model recordings explicitly labeled. Opening a recording is not low-latency live generation.

Optimizations must preserve source accuracy, validation, review status and budget fences. Skipping a check cannot silently become a successful review. Compare actual source correctness and retained failure outcomes when evaluating latency changes. [Source evaluations](GENERAL_SCREENSHOT_VALIDATION.md) and [verification](VERIFICATION.md) distinguish development repeats from first attempts.
