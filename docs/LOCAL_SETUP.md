# Local setup and credential readiness

Preparation record: October 26, 2026. Application implementation is underway. The bounded Meta connectivity probe has passed; provider setup and release verification remain separate.

## Fill the local file

Use `.env.local` in the project root. It is ignored by Git; `.env.example` contains placeholders only. Enter secrets directly in the local editor, not in chat. The application and worker will receive explicit environment loading during implementation; the existence of this file does not establish a working connection.

Start with Meta and Firebase. Trigger.dev and Browserbase can be filled next for durable jobs and the authenticated-browser experiment.

| Variable | Where to obtain it | Purpose |
| --- | --- | --- |
| `MODEL_API_KEY` | Meta developer account API keys | Server-side runtime inference |
| `META_API_BASE_URL` | Pre-filled from official quickstart | Application-owned endpoint setting |
| `META_MODEL_ID` | Pre-filled from official quickstart; account availability still needs a real check | Application-owned model selection |
| `FIREBASE_PROJECT_ID` | Firebase project settings | Server-side Firestore project |
| `GOOGLE_APPLICATION_CREDENTIALS` | Absolute path to service-account JSON stored outside the repository, or use local Application Default Credentials | Server authentication; never a browser variable |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase project settings → registered web app config | Public Firebase web identifier for sign-in |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase web app config | Authentication domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase web app config | Browser-side project identifier |
| `SOMA_PERSISTENCE` | Keep `local-synthetic` until Firestore is ready; then `firestore` | Explicit storage selection |
| `SOMA_LIVE_INFERENCE` | Disabled until application budgets are configured | Separate from the explicit connectivity probe |
| `TRIGGER_SECRET_KEY` | Trigger.dev project's development environment API key | Local worker/SDK development; use the appropriate separate key for deployment |
| `TRIGGER_PROJECT_REF` | Trigger.dev project settings (`proj_…`) | Nonsecret project identifier for worker configuration |
| `BROWSERBASE_API_KEY` | Browserbase project dashboard | Browser session creation |
| `BROWSERBASE_PROJECT_ID` | Browserbase project dashboard, optional | Explicit project selection when needed |

Create a Firebase project and a Firestore database in Native mode. Keep client database access denied; the server authenticates requests and enforces workspace ownership. For local server access, use Application Default Credentials or a service-account JSON outside this repository, and put only its absolute path in `GOOGLE_APPLICATION_CREDENTIALS`. Later enable a Firebase Authentication sign-in provider for private student accounts. Do not paste the JSON private key into chat. Supabase fields left in an existing local file are unused.

Meta's guide requires participant-managed billing and credit claiming. Verify the actual allocation separately; provider notifications do not replace application spending limits. No paid usage is established by preparing the file.

## Separate authentication steps

- GitHub: authentication is verified with network access. The earlier restricted-environment check was misleading. The private repository is `Jeremiah-Sakuda/soma`; no GitHub token belongs in the app environment file.
- Vercel and Firebase CLI: use their account login flows when provisioning deployment. Tokens are not required in browser configuration.
- Trigger.dev deployment: use its supported CLI login flow; headless deployment may use `TRIGGER_ACCESS_TOKEN` in CI secrets, not public app configuration.
- Blackboard/Gradescope: authorized interactive login or supported exports; do not put institutional passwords or session cookies here.
- Email: provider and selected course scope remain unresolved. Configure a scoped OAuth route once chosen; an email password is not requested.

## Official configuration references

- [Meta quickstart](https://dev.meta.ai/docs/quickstart)
- [Firebase Admin setup](https://firebase.google.com/docs/admin/setup)
- [Firestore transactions](https://firebase.google.com/docs/firestore/manage-data/transactions)
- [Trigger.dev API keys](https://trigger.dev/docs/apikeys)
- [Browserbase quickstart](https://docs.browserbase.com/welcome/quickstarts/playwright)

These are configuration references, not evidence that the project's accounts, credits, model access, or integrations work. Pin and exercise the actual SDK contracts during implementation.

## Verified application setup (October 26)

The created Firebase project is `soma-meta-jerem-2026`. Local Firestore write/read/delete and two real Firebase Auth test-user sessions have passed. Email/password is enabled. The runtime credential is outside the repository; `.env.local` points to it. The Vercel production environment uses `FIREBASE_SERVICE_ACCOUNT_JSON` as an encrypted server secret instead of a local file path. Never prefix it with `NEXT_PUBLIC_`.

Verified commands from the repository root:

```sh
npm ci
npm run typecheck
npm test
npm run build
npm run dev
npm run test:e2e
npm run check:firestore
```

`npm run dev` serves the app on loopback port 3000. Browser tests start their own synthetic-only development server on 3100; stop another development server before running them. The live account/provider tests are opt-in and are skipped in ordinary CI. They use disposable synthetic records and actual provider credentials; run them only with the documented flags in their source.

The anonymous demo uses original synthetic course material and an expiring isolated workspace. Sign in through settings to use an empty private workspace, then import selected course text, selected email text or calendar JSON. Imports are manual, not live course collection. No institutional password is collected by Soma.

The Meta allocation is user-confirmed $150, with a $30 reserve and a more restrictive $1 development application cap. One daily preparation job per workspace, four calls per job and transactional cost reservations apply. Development circuit previews do not establish independent scientific review or real-course source fit.

Vercel project `jeremiah-sakudas-projects/soma` is linked to GitHub. Deployment uses the committed `vercel.json`; private environment files, source documents, screenshots and prompt logs are excluded from its upload by `.vercelignore`. GitHub CI runs type checking, unit tests, the production build and the browser journeys.
