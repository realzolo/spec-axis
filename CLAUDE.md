# Sykra — Project Guide

## General Rules

- **Documentation language**: All documentation files must be written in English.

## Detailed Documentation

Full details are split into topic files under `docs/claude/`:

| File | Contents |
|------|----------|
| [`architecture.md`](docs/claude/architecture.md) | Project overview, tech stack, org model, routing, directory structure |
| [`ui-guidelines.md`](docs/claude/ui-guidelines.md) | UI components, design tokens, dialog/navigation/settings rules, toast usage |
| [`pipeline-engine.md`](docs/claude/pipeline-engine.md) | CI/CD pipeline engine, runtime UX, logs, artifacts, sandbox, recovery |
| [`environment.md`](docs/claude/environment.md) | All env vars (Studio/Conductor/Worker), TOML config, integrations, codebase cache env |
| [`api-contracts.md`](docs/claude/api-contracts.md) | Runtime contracts, auth, analysis flow, chat APIs, codebase cache, DB migrations |

## Internationalization (i18n)

2 languages, English default: `en` | `zh`

**Server component:**
```tsx
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
const locale = await getLocale();
const dict = await getDictionary(locale);
```

**Client component:** Pass `dict` as prop from server page, type as `Dictionary` from `@/i18n`.
If a client-only page cannot receive `dict` from a server parent, use `useClientDictionary()` from `src/i18n/client.ts` instead of duplicating cookie parsing.

**Rules:**
- Both dictionary files (`src/i18n/dictionaries/en.json` and `src/i18n/dictionaries/zh.json`) must have **identical key structure** — TypeScript infers types from `en.json`
- When adding keys, update BOTH files simultaneously or the build fails
- Run `rm -rf .next` if TypeScript type cache is stale after dict changes
- `LanguageSwitcher` in Sidebar footer persists locale in cookies
- User-facing copy in dashboard/product UI must come from dictionary keys. Do not hardcode English/Chinese strings directly in feature components.
- Prefer shared client i18n helper (`src/i18n/client.ts`) for locale + dictionary access; do not implement ad-hoc `document.cookie` locale readers in feature components.

## Engineering Constraints

- **No compatibility design/code paths**: Do not add dual-field parsing (`foo ?? Foo`), legacy aliases, or fallback branches for stale response shapes.
- **No compatibility naming**: Do not introduce `legacy*`, `compat*`, `polyfill*`, or similar identifiers.
- **Single contract source**: Conductor HTTP contracts are defined in `packages/contracts/src/conductor.ts` and consumed by Studio.
- **Array response contract**: Conductor list endpoints must serialize empty collections as `[]`, not `null`, so Studio Zod array schemas always receive an array shape.
- **Conductor timestamp contract**: Conductor API datetime fields must be validated as ISO8601/RFC3339 with timezone offsets allowed (`datetime({ offset: true })`), not `Z`-only.
- **Server-enforced project scope**: Project-scoped list APIs (for example `/api/reports` and `/api/pipelines`) must validate `projectId` access and enforce filtering on the server side; never rely on client-side filtering for tenant boundaries.
- **Type safety baseline**: `apps/studio/tsconfig.json` enforces strict type checks (`allowJs: false`, `skipLibCheck: false`, `exactOptionalPropertyTypes: true`, `noUncheckedIndexedAccess: true`).
- **Schema requirement**: latest schema (`docs/db/init.sql`) and any required upgrade migrations must be applied before runtime. Missing required columns/tables are treated as errors, not tolerated with fallback logic.
- **Canonical provider IDs only**: Use a single provider identifier per integration type (current AI provider key is `openai-api`). Do not add alias keys.
- **Fail-fast on unsupported providers**: Provider switch statements must throw on unknown values; no silent fallback client selection.
- **Unified AI transport**: Studio AI integrations must use the shared fetch-based adapter path; do not add provider-specific SDK dependencies in feature/business routes.
- **Capability-driven AI params**: AI integration forms must render advanced parameters from model/baseUrl/apiStyle capability rules, and unsupported parameters must not be sent in runtime requests.
- **Git hygiene**: Runtime and build outputs must stay untracked (`apps/conductor/data/`, `apps/conductor/conductor`, `apps/worker/worker`), and local environment files should use `*.env` patterns while keeping `*.env.example` tracked.
- **Package manager bootstrap**: repository-level scripts must invoke Corepack-managed pnpm through `scripts/run-pnpm.mjs` instead of a bare global `pnpm` binary. The root `packageManager` field is pinned to the repository pnpm version, and the wrapper keeps `COREPACK_HOME` under the repo-local `.cache/corepack` directory.

## Naming & Design Rules

- Prefer domain names over technical workaround names (`pipelineRun`, `rulesetSnapshot`, `integrationConfig`).
- Use final-state naming only. Do not use transitional prefixes/suffixes like `Enhanced*`, `New*`, `Old*`, `V2*`, `Temp*`, or `*Legacy`.
- Optional fields must be modeled as truly optional fields; never assign `undefined` to an explicitly present property under `exactOptionalPropertyTypes`.
- External API payload parsing must be schema-first (`zod` contract parse before business logic).
- Do not add transitional adapter layers for old payloads or old naming; update all callers to the canonical contract in one change set.

## Quality Gates

- Studio CI baseline must be green on every change set:
  - `pnpm -C apps/studio lint` returns 0 errors and 0 warnings.
  - `pnpm -C apps/studio build` succeeds.
- Conductor backend baseline must compile:
  - `cd apps/conductor && GOMODCACHE=../../.cache/go/mod GOCACHE=../../.cache/go/build go build ./...`

## Next.js 16 Special Configuration

- **Middleware**: file is `apps/studio/middleware.ts` (Next.js middleware). It handles `/o/:orgId` rewrites and org redirects.
- `apps/studio/src/proxy.ts` is currently unused.
- **Dynamic pages**: any dashboard page that depends on auth/session or database reads must use `export const dynamic = 'force-dynamic'`
- **Dynamic route params**: in pages and route handlers, `params` is async — `const { id } = await params` (avoid sync dynamic APIs errors)
- **Self-hosted request timeouts**: long-running routes such as analyze/chat should be protected by the deployment platform or reverse proxy; do not rely on Vercel-specific timeout behavior in self-hosted environments.

## Common Commands

```bash
pnpm dev     # Console dev server (port 8109)
pnpm build   # Console production build (TypeScript check)
pnpm start   # Console production server
pnpm lint    # Console ESLint
pnpm codebase:cleanup   # Cleanup stale workspaces (uses TASK_CONDUCTOR_TOKEN; optional STUDIO_BASE_URL)
psql "$DATABASE_URL" -f docs/db/init.sql   # Initialize schema (fresh DB)
cd apps/conductor && go run .   # Conductor service (reads config.toml if present)
cd apps/worker && go run .      # Deploy worker service
```

## Dependency Build Scripts

pnpm is configured to only allow approved dependency build scripts.
The allowlist lives in `.npmrc` under `only-built-dependencies[]` (currently includes `msgpackr-extract`).
If new install warnings appear, approve the dependency and update the allowlist.

## FAQ

**TypeScript build errors?** Run `pnpm build`. Common causes: contract mismatch between Conductor and Studio, dictionary key mismatch between `en.json` and `zh.json`, or stale type cache (`rm -rf .next`).

**Dark mode?** Theme is controlled via `data-theme` on `:root` (see `apps/studio/src/app/globals.css`). Prefer token-driven styling instead of per-component theme conditionals.
