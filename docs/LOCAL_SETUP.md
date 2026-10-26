# Local setup and credential readiness

Preparation record: October 26, 2026. No application, provider integration, or executed product test exists yet.

## Fill the local file

Use `.env.local` in the project root. It is ignored by Git; `.env.example` contains placeholders only. Enter secrets directly in the local editor, not in chat. The application and worker will receive explicit environment loading during implementation; the existence of this file does not establish a working connection.

Start with Meta and Supabase. Trigger.dev and Browserbase can be filled next for durable jobs and the authenticated-browser experiment.

| Variable | Where to obtain it | Purpose |
| --- | --- | --- |
| `MODEL_API_KEY` | Meta developer account API keys | Server-side runtime inference |
| `META_API_BASE_URL` | Pre-filled from official quickstart | Application-owned endpoint setting |
| `META_MODEL_ID` | Pre-filled from official quickstart; account availability still needs a real check | Application-owned model selection |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project Connect dialog | Project endpoint |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase project Connect/API Keys | Browser-safe project key; access still requires authentication and row policies |
| `SUPABASE_SECRET_KEY` | Supabase project API Keys | Privileged server operations; never expose to browser code |
| `TRIGGER_SECRET_KEY` | Trigger.dev project's development environment API key | Local worker/SDK development; use the appropriate separate key for deployment |
| `TRIGGER_PROJECT_REF` | Trigger.dev project settings (`proj_…`) | Nonsecret project identifier for worker configuration |
| `BROWSERBASE_API_KEY` | Browserbase project dashboard | Browser session creation |
| `BROWSERBASE_PROJECT_ID` | Browserbase project dashboard, optional | Explicit project selection when needed |

Use project-scoped development credentials where offered. Do not put a Supabase database password into the publishable or secret-key fields. Database migrations and deployment authentication will be configured through their separate supported CLI/account flows when needed.

Meta's guide requires participant-managed billing and credit claiming. Verify the actual allocation separately; provider notifications do not replace application spending limits. No paid usage is established by preparing the file.

## Separate authentication steps

- GitHub: the installed `gh` CLI reports an invalid saved login. Run `gh auth login --hostname github.com --web` locally to reconnect it. No GitHub token is required in the app environment file.
- Vercel and Supabase CLI: use their account login flows when provisioning deployment and migrations. Tokens are not required for initial app credentials.
- Trigger.dev deployment: use its supported CLI login flow; headless deployment may use `TRIGGER_ACCESS_TOKEN` in CI secrets, not public app configuration.
- Blackboard/Gradescope: authorized interactive login or supported exports; do not put institutional passwords or session cookies here.
- Email: provider and selected course scope remain unresolved. Configure a scoped OAuth route once chosen; an email password is not requested.

## Official configuration references

- [Meta quickstart](https://dev.meta.ai/docs/quickstart)
- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Supabase Next.js authentication](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Trigger.dev API keys](https://trigger.dev/docs/apikeys)
- [Browserbase quickstart](https://docs.browserbase.com/welcome/quickstarts/playwright)

These are configuration references, not evidence that the project's accounts, credits, model access, or integrations work. Pin and exercise the actual SDK contracts during implementation.
