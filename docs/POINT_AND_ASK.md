# Point & ask

In [companion 0.5.0](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0), enable **Point & ask**, hold **Control–Option–Space**, point or circle while speaking, then release. The local trail is immediate; the generated visual prepares asynchronously. Typed questions, uploads and ordinary snapshots remain available.

## Explicit context

The held interaction is bounded to 30 seconds. Soma captures the display under the gesture on release and combines it with the transcript and normalized selection. A closed gesture supplies a bounding region; a point supplies a small region. Crossing displays cancels. Escape, Hide, disabling the mode or starting a new hold cancels stale work. Wait for the Listening state before speaking.

This is not continuous video monitoring. The screenshot is current at release; if the page moves during the gesture, the earlier circle is not semantically tracked. Raw pointer trajectories are not sent or persisted. Focus guides interpretation of “this”; it is neither a source fact nor evidence of learning. The complete selected capture can contain private content, so use material you intend to send to the configured model.

## Grounded source references

Steps can reference up to six model-located source regions. **See on source** uses the transient captured image. Native pointing/drawing requires a fresh matching screen, owned capture identity and unexpired context; changed content offers recapture. It does not move or click the real cursor. Model locations remain fallible.

A subsequent capture can compare against a preceding in-memory image whose hash matches the owned prior source. Earlier versions remain immutable. Both images can be inspected during the session, but private pixels are not saved and are unavailable after reload.

Spark can request one bounded closer crop of the same frozen image. The application decodes/crops validated inline pixels, never hidden content, a new screen or an arbitrary external URL. Coordinates remain relative to the complete current image. The shared call, time and spend limits still apply.

## Speech and generation

Muse Voice Transcribe handles optional questions. An isolated WebSocket relay supports partial transcription when configured; it uses one-use expiring tickets and keeps provider credentials server-side. Cloud streaming is not assumed merely because the code exists. Recorded-question transcription remains the fallback when streaming is unavailable. Optional narration is separately attributed to Gemini TTS.

The exploration engine preserves checked graph/circuit computation, source/version ownership, current controls and actual review status. Other subjects remain explanatory. The old valid visual and draft survive failed/cancelled replacement work. Progress describes observed phases; unchecked partial model content is not published.

## Verification boundary

Synthetic native tests cover geometry, helper/recorder coordination, stale-source rejection and rendering. Two actual-provider focus requests on one original code image produced the selected left and right sequences correctly (7→9→11 versus 11→14→17), with review and exact focus save/reopen. A harness title-selector failure occurred after generation and was corrected for rendering; it was not a model failure or another fresh provider success. This two-case check is not a general accuracy rate.

Physical shortcuts, microphone quality, operating-system consent, fullscreen/multi-display operation and a clean-Mac install remain distinct checks. [Desktop setup](DESKTOP.md) and [verification](VERIFICATION.md).
