# Isolated services

These optional services are deployed independently of Next.js. Their presence does not imply they are enabled in the hosted app. Use the pinned Node 22 version and lockfiles; keep credentials in server configuration, never client bundles.

| Service | Role | Authority boundary |
| --- | --- | --- |
| `browser-runner` | Bounded hosted sign-in and selected read-only course collection | Owned expiring sessions, encrypted state, destination/egress policy |
| `credential-runner` | Explicit optional institutional credential enrollment/login | Dedicated vault/KMS identity, fixed provider policy, human MFA, authenticated callback |
| `voice-runner` | Muse transcription WebSocket relay | One-use expiring tickets, bounded PCM, server-held provider key |

Install with `npm ci --prefix services/<service> --ignore-scripts`; start with `npm start --prefix services/<service>` only after supplying the service’s required private configuration. Disabled/unsafe configurations refuse service rather than falling back to an anonymous control endpoint. The browser services additionally need the pinned Playwright Chromium runtime.

Each Dockerfile pins Node and installs its lockfile. Browser and voice Dockerfiles use their own directory as build context; the credential Dockerfile uses `services/` to include only its required shared browser/state modules. Containers use a non-root runtime user. Do not include dotenv files, source documents, tokens or local browser profiles in image uploads.

```sh
node --test services/voice-runner/test/*.test.mjs
node --test scripts/check-credential-service.test.mjs
```

Root tests cover service authentication/policy contracts; the explicitly opt-in Chromium credential suite exercises hostile synthetic pages. Actual cloud IAM, provider login, permissions and microphone quality require separate acceptance. [Browser authorization](../docs/BROWSER_AUTHENTICATION.md), [credential isolation](../docs/CREDENTIAL_AUTOFILL_DEPLOYMENT.md), [Point & ask](../docs/POINT_AND_ASK.md) and [security](../docs/SECURITY.md) describe the boundaries.
