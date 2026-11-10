# Soma Lab for Meta VR Start

Soma Lab is a seated study desk for the moment a diagram stops making sense. Keep the source in view, change one part with your hands, see what the solver computes, and pin the comparison for the next study session. Enter in **Productivity**. Confirm the division with the organizer before submitting.

## Entry and release gates

The entry closes **November 18, 2026 at 3:00 p.m. ET**. The rules require controller-free use from start to finish, a freely accessible WebXR build through the winner announcement, and a public YouTube or Vimeo demonstration under three minutes. The video must show the project on a Meta Quest or a qualifying XR emulator. The organizer scores the entry as it stood at the deadline, so keep the submitted build fixed after cutoff. [Competition overview](https://start-developer-competition-26.devpost.com/) · [Official rules, sections 2–6](https://start-developer-competition-26.devpost.com/rules)

Two eligibility questions need written organizer guidance before the entrant attests or submits:

- **Division.** The Soma repository’s earliest dated baseline is October 26, after the September 24 competition opening. The project then shipped a desktop companion during the competition window. The New division excludes repurposed shipped titles and pre-existing codebases, while the Adapted division describes projects that existed before September 24. Ask where a new hands-first Quest experience built during the window from a desktop project also conceived and shipped during that window belongs. Share the actual dates, the reuse of solvers and fixtures, and the new Quest experience.
- **Sponsor support.** The official rules address direct Meta funding under separate agreements and separately restrict technology developed or derived with financial or preferential support from Meta. Ask whether the prior developer hackathon’s standard $150 model API credit allocation, any credits actually used, and recorded results from that program affect eligibility for this entry. Disclose the actual credits used and reused material. The XR build’s local solver does not resolve the provenance question. [Official rules, section 4](https://start-developer-competition-26.devpost.com/rules)

The entrant confirms Meta Developer Access, VR Start membership by submission, eligibility, asset rights, and the one-entry limit for the submitting individual or representative. If working on another entry, confirm who will submit each. Soma’s recorded demos use original synthetic slides, with separate alignment and retained generation receipts. Review everything appearing in the build and video, including slide text, attribution, sounds, and any visible overlays, against the asset and presentation rules. [Recording provenance](../src/lib/fixtures/RECORDINGS.md) · [Official rules](https://start-developer-competition-26.devpost.com/rules)

## Rubric and priorities

The four scored criteria have equal weight. Stage One checks competition fit and required features. The table maps our work to the official criteria and names the evidence we want to collect. A second comparison, a learner study, and a fixed number of participants are optional evidence choices. [Official rules, section 6](https://start-developer-competition-26.devpost.com/rules)

| Criterion                | Soma Lab’s case                                                                                                                                                            | Evidence to collect                                                                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Innovation & Creativity  | A seated Productivity workflow for testing a lecture diagram. Point and pinch to change the graph, see the computed consequence in place, and reopen the experiment later. | One legible graph comparison. Cut B–D and show the amber route through E at cost 9 while the original route remains dashed.                          |
| Experience Design        | The graph gives a first action on entry. Source, result and controls stay in the same view. Reset and Reopen pin support short sessions.                                   | Observe a first-time Quest user entering, making a checked change and reopening it with hands while seated. Note where they need help.               |
| Technical Implementation | Hand input, checked local solvers, bounded recipes and frame timing.                                                                                                       | Verify the exact HTTPS build on Quest. Check off-target release, tracking interruption and recovery. Measure the rubric’s 60 fps target on hardware. |
| Polish & Presentation    | One visual beat leads the demo. The bridge is a short example of another study task.                                                                                       | Use readable footage from the physical Quest. Check labels and controls within the seated view and verify both submission links anonymously.         |

**Graph comparison.** On entry, point at B–D, pinch and release. Soma changes the active route from A → C → B → D → F at cost 7 to A → C → E → F at cost 9. The dashed edges identify the earlier route. Pin the result, Reset, then Reopen pin to compute it again from saved controls and the original source revision. Existing note-only pins remain readable.

**Bridge circuit.** A resistance preset changes the live current through R5. Give this lab a short supporting beat when it adds to the story. It uses one live current arrow and keeps the same reset and reopen controls.

**Verification boundary.** Earlier solver, desktop and IWER runs remain in [Verification](../docs/VERIFICATION.md). This pass uses the production build and checks the real HTTPS assets. Physical Quest behavior and performance remain open until a device run. Use this distinction when scoring the candidate.

**Frame timing.** Add `?diagnostics=1` to the release URL, enter VR, and use each lab for 60 active seconds. Switching labs or exiting VR closes the sample. After exit, open Desk controls and expand **XR app frame timing** to copy the per-lab reports. Samples pause when the immersive session loses visibility and cap at 120 seconds. Record actual headset and build details with the results. The numbers measure app callback cadence. Use Quest instrumentation to confirm presented frame rate if callbacks and presentation differ.

### Quest acceptance procedure

1. Load the intended HTTPS release URL in Quest Browser on the actual device. Use a clean browser session for the first run. Record the commit, URL, headset model, OS/browser versions, headset refresh rate, test date, and whether recording is active. Disable or set aside controllers and use native hand tracking throughout. Keep the headset wearer seated.
2. Start at the landing page, enter immersive mode, and complete the first graph experiment without coaching. Cut B–D and restore or reset. Drag D–F above 5, then use the discrete hand controls to reach the same state. Check that letting go off-target or losing hand tracking leaves the scene usable and permits a fresh grab. Read the original and changed routes, then pin the comparison.
3. Switch to the circuit using hands. Move R4 through 4, 8, and 16 Ω and read the direction of R5 current in each state. Check reset, pinning, return to the graph, and switching without stale labels. Exit immersive mode, re-enter, and verify the expected saved comparison after a page reload. Test each step with the other hand as well.
4. Try two natural seated positions and a narrower view. Essential controls, result, and the relevant diagram region should be readable without standing, turning behind, or reaching outside the seated two-foot radius. Check a gesture miss, one deliberate pause, and one tracking interruption. Record time to the first checked change, failures, and any assist or fallback used.
5. Measure actual **app** frame timing in immersive mode on each lab with a Quest performance tool or instrumented XR frame timestamps. Log tool, run length, refresh rate, mean and low-percentile frame rate or frame intervals, and dropped/stalled frames. Run at least 60 seconds per lab including drag, switching, and pinning after warm-up. Measure again while capturing if capture affects results. The display refresh setting and desktop browser frame rate do not establish app throughput. Save raw timing and report any period below the 60 fps rubric threshold. [Performance criterion](https://start-developer-competition-26.devpost.com/rules)

### 2m video outline

Capture the submitted build on a physical Quest. Keep the first cut and both route states in the same shot. Use the additional time only where the viewer needs a result to settle or become readable.

| Time      | Picture and story                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00–0:20 | Start seated with the lecture slide and the graph. Pinch B–D and release. Hold as the route moves to E and the dashed original remains visible.                        |
| 0:20–0:55 | Explain what changed and why the old route is still useful. Soma computes the new shortest route from the edited graph. Show how to restore the edge.                  |
| 0:55–1:25 | Pin the result, reset, and reopen it. Show the saved controls recomputing the same result. Explain why someone would return to a finding before a later study session. |
| 1:25–1:45 | Switch to the bridge and choose one resistance. Let the live R5 current and arrow settle.                                                                              |
| 1:45–2:00 | End on the desk and the public URL. Give one Quest Browser launch instruction.                                                                                         |

### Release and submission handoff

- Build from the accepted commit and publish `xr/dist` as a static HTTPS artifact with a stable, versioned URL. Record the commit and artifact digest. Keep emulator injection development-only. Check that a signed-out visitor can load the slide assets and enter the exact accepted build on a Quest.
- Put the tested build, final public video, English description, controls and launch instructions in the submission packet. Include inspiration, implementation, plans, target launch date if unpublished, and the actual new capabilities if the confirmed division requires them. Open both links signed out and save the accepted artifact, test record, and final video digest.
- The user or authorized entrant representative selects the confirmed division, verifies participant details and organizer guidance, completes any attestations, and submits on Devpost. Save the Devpost receipt and freeze the served build by the deadline. [Devpost entry page](https://start-developer-competition-26.devpost.com/) · [Official rules](https://start-developer-competition-26.devpost.com/rules)
