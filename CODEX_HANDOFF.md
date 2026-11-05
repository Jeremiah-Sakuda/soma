# Soma developer handoff

The current product is **selected visible context → generated visual → checked manipulation → contextual follow-up → saved revision**. Start at `/explore`; course setup must not block it. Read [product requirements](docs/PRD.md), [architecture](docs/ARCHITECTURE.md) and the [implementation map](docs/SOMA_V2_IMPLEMENTATION.md) before changing behavior. Read [UI guidance](docs/UI_UX_GUIDE.md) before interface work.

## Release

[Companion 0.5.0](https://github.com/Jeremiah-Sakuda/soma/releases/tag/v0.5.0) is published as Latest, signed and Apple-notarized. It includes graph, circuit and illustrative-model lifts. Its immutable source tag and archive checksum are in [verification](docs/VERIFICATION.md). Main may contain subsequent documentation, formatting or dependency maintenance; do not silently relabel the existing installer.

## Boundaries to preserve

- Spark interprets and proposes. Deterministic models compute graph/circuit results; strict validators control publication. Wonder’s source/prose reviews are fallible and their actual status must stay inspectable.
- An explanatory follow-up preserves current scientific controls and source lineage. Never let model text restore a disabled connection, change a goal or overwrite an experiment implicitly.
- Private screenshot pixels are transient. Saved revisions retain interpreted data and control state. Allowlisted original public demo images are a separate recording exception.
- Preserve ownership, cancellation, version fencing, budget reservations, unknown-usage retention and the previous usable artifact on failure.
- Exploration, assisted work and completion do not establish independent understanding. Keep original attempts, help and timestamps separate from interpretations.
- The built-in engine is illustrative, not a thermodynamic solver. Unsupported subjects receive explanation or clarification rather than a fabricated checked model.
- Preserve earlier course routes/data and their read-only source collection. Explicit computer actions use a separate consent boundary.

## Development

Follow [local setup](docs/LOCAL_SETUP.md). Use the pinned Node version and dependencies. Tests that contact providers are opt-in; never infer authorization from configured credentials. Run formatting, type checks, relevant unit/service and browser checks, the production build and artifact trace. Regenerate the runtime manifest after runtime changes:

```sh
node scripts/verify-release.mjs --write --release-id=soma-your-change
node scripts/verify-release.mjs
```

The manifest includes source and public assets. It identifies a checkout; compare it with hosted `/release.json` separately before claiming deployment parity. Do not edit raw recorded model output to improve a demo: keep presentation alignment separate and labeled.

The canonical repository is `Jeremiah-Sakuda/soma`. Work from current `origin/main`; never restore pre-rewrite history. If a normal push is refused, stop and report it. Local build records, prompt archives, planning drafts and captures are ignored and must remain unpublished. See [AGENTS.md](AGENTS.md) for working instructions.
