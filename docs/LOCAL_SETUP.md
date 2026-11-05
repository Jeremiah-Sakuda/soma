# Local setup

## Offline exploration

Use the exact Node 22 release in `.nvmrc`. From the repository root:

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Open `http://127.0.0.1:3000/explore`. `local-synthetic` persistence and disabled inference are the safe defaults. Prepared examples need no account or provider key. Local records live in ignored storage; they are synthetic development data, not a private-account production backend.

## Live Meta generation

Set server-only values in the ignored `.env.local`; never paste credentials into source or prompts.

| Setting | Purpose |
| --- | --- |
| `MODEL_API_KEY` | Meta Model API access |
| `META_API_BASE_URL` | Application-owned endpoint; default in the template |
| `META_MODEL_ID` | Spark model selection; template uses `muse-spark-1.3` |
| `SOMA_LIVE_INFERENCE=true` | Explicitly enable runtime calls |
| `META_ALLOCATION_USD` | Actual confirmed allocation, not assumed promotional credit |
| `META_APP_SPEND_CAP_USD` | Application-enforced cumulative spend ceiling |
| `SOMA_EXPLORATION_REVIEW_ENABLED=true` | Enable bounded Wonder image/explanation review, subject to model access and call limits |
| `SOMA_EXPLORATION_MAX_ACTIVE` | Concurrent generation leases, 1–16; default 4 |

The application preserves a 20% allocation reserve. Unknown usage retains its reservation. A configuration check does not prove billing, model access, source authorization or deployment parity. `npm run check:meta` performs a real provider probe and can incur usage; run only with your own authorization and limits. Ordinary tests do not enable paid inference.

## Managed storage and sign-in

For hosted persistence set `SOMA_PERSISTENCE=firestore` and `FIREBASE_PROJECT_ID`. Authenticate the server using Application Default Credentials, an outside-repository service-account file referenced by `GOOGLE_APPLICATION_CREDENTIALS`, or an encrypted server-only `FIREBASE_SERVICE_ACCOUNT_JSON` on hosting. Never prefix an admin credential with `NEXT_PUBLIC_`.

Configure the `NEXT_PUBLIC_FIREBASE_*` web identifiers for sign-in. These are public Firebase identifiers, not Admin credentials. Keep client Firestore access denied by the checked-in rules; server requests still enforce account/workspace ownership. `npm run check:firestore` exercises a real configured project and is opt-in.

## Optional services

- **Desktop:** run `npm ci --prefix desktop`, then `npm start --prefix desktop` on macOS. Root dependencies are also required. [Desktop instructions](DESKTOP.md).
- **Narration:** `SOMA_GEMINI_TTS=true` uses Vertex AI through server credentials and the existing spend ledger. Captions and manual stepping remain available without it. No browser-side provider key is required.
- **Speech relay:** configure `SOMA_VOICE_STREAM_URL` and server `SOMA_VOICE_CONTROL_KEY` only after deploying the isolated authenticated `services/voice-runner`. Recorded input is the fallback when streaming is unavailable.
- **Earlier course connectors:** Google OAuth, selected read-only LMS collection and browser runners are optional and do not block exploration. See [browser authentication](BROWSER_AUTHENTICATION.md), [credential deployment](CREDENTIAL_AUTOFILL_DEPLOYMENT.md) and each service README. Do not enter institutional passwords into `.env.local`.
- **Workers:** deployed durable processing requires explicit worker configuration and a private secret. Trigger.dev fields in the template are optional; their presence does not establish a deployed worker.

Use `npm ci --prefix services/browser-runner --ignore-scripts`, and the equivalent credential/voice-runner commands, when reproducing their isolated service tests. Keep deployment tokens, browser sessions and signing keys outside the repository.

## Checks

```sh
npm run format:check
npm run typecheck
npm test
node --test desktop/test/*.test.cjs
node --test services/voice-runner/test/*.test.mjs
node --test scripts/check-credential-service.test.mjs
npm run build
npm run check:browser-artifact
npm run test:e2e
```

Install Chromium for browser tests with `npx playwright install chromium`. Playwright starts a fresh synthetic-only server on port 3100; stop another server using that port first. The unit runner skips explicitly gated provider, production-account and device tests. Inspect each opt-in test’s conditions before enabling it.

`npm run check:config` checks configuration shape; it does not provision services. `node scripts/verify-release.mjs` verifies source/public asset identity against the committed manifest. Neither proves that the running hosted application matches the checkout; compare hosted `/release.json` separately.
