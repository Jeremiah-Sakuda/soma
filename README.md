# Soma

**Understand what is in front of you, without leaving what you are doing.**

Soma is a floating macOS visual learning companion. Capture a display, review the snapshot, and ask a question. Muse Spark interprets the visible context and composes an interactive explanation. Explore a checked search algorithm, compare fewest edges with lowest cost, ask about a selected object, and save the exact experiment.

[Try the browser experience](https://soma-woad-beta.vercel.app/explore). Prepared original examples need no account or model call. Other captures and questions use live generation when enabled. The desktop shell uses the same hosted engine.

## What is implemented

- Explicit display capture, preview, global shortcut, floating/pinned panel, hide/reopen, restricted native IPC.
- Spark image interpretation, typed visual composition, contextual revisions and solver-backed edge-cost experiments.
- Independently computed BFS and nonnegative Dijkstra, including directed/undirected, zero and fractional costs; at most 12 nodes and 24 edges.
- Targeted Muse Wonder review of weighted and answer-informed generated candidates. This is advisory, separate from deterministic checks.
- Optional prediction/check/reveal with assistance and source/version lineage; exploration is never recorded as independent mastery.
- Muse transcription for recorded questions; Gemini narration and explicit browser-voice fallback. Gemini is a supporting non-Meta service.
- Versioned, ownership-fenced persistence; cancellation, bounded repair, durable spend reservations and no publication of invalid candidates.

Other subjects use explanation-only diagrams, sequences, matrices and text. They are not verified scientific simulations. Soma takes explicit snapshots, not continuous screen recordings, and does not autonomously monitor courses in its current primary journey.

## Run locally

Use the Node version in `.nvmrc` (22.x). All dependency versions and lockfiles are pinned.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000/explore`. The defaults use local synthetic persistence with live inference disabled; the prepared graph examples work without credentials. Never commit a filled environment file.

For live generation, set `MODEL_API_KEY`, `SOMA_LIVE_INFERENCE=true`, the verified `META_ALLOCATION_USD`, and a deliberately bounded `META_APP_SPEND_CAP_USD` in `.env.local`. Keep the endpoint/model defaults. Set `SOMA_EXPLORATION_REVIEW_ENABLED=true` for targeted Wonder review. To persist beyond a local process, configure Firestore with server-only credentials. Optional narration requires the Gemini configuration documented in `.env.example`; captions and manual interaction remain available without it.

## Verify

```sh
npm ci --prefix services/browser-runner --ignore-scripts
npm ci --prefix services/credential-runner --ignore-scripts
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
npm test --prefix desktop
```

The default tests are offline and use original synthetic material. Provider/browser-integration tests that need real services are explicitly opt-in. Do not enable all live-test flags together. The retained course-workspace routes and isolated browser/credential services are legacy capabilities; they are not prerequisites for trying `/explore`.

## macOS companion

```sh
npm ci --prefix desktop
npm start --prefix desktop
```

Electron defaults to the hosted application. Capture requires macOS Screen Recording consent; microphones require separate consent. Close hides the companion; use the menu-bar icon or global shortcut to reopen it. Quit ends the process. See [desktop operating notes](docs/DESKTOP.md).

## Submission source

This repository is a reviewed source snapshot for the Meta Global AI Developer Hackathon. Original implementation began October 26, 2026 following the organizer's start authorization. [Architecture and boundaries](docs/ARCHITECTURE.md), [verification evidence](docs/VERIFICATION.md), and [third-party notices](THIRD_PARTY_NOTICES.md) distinguish runtime behavior, synthetic evidence and remaining human verification. Private source material, credentials, captures, learner records and development prompt history are excluded.
