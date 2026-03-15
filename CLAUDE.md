# spec-axis — Project Guide

## General Rules

- **Response language**: Always respond in English

## Internationalization (i18n)

5 languages, English default: `en` | `zh` | `ja` | `es` | `zh-TW`

**Server component:**
```tsx
import { getLocale } from '@/lib/locale';
import { getDictionary } from '@/i18n';
const locale = await getLocale();
const dict = await getDictionary(locale);
```

**Client component:** Pass `dict` as prop from server page, type as `Dictionary` from `@/i18n`.

**Rules:**
- All 5 dictionary files (`src/i18n/dictionaries/*.json`) must have **identical key structure** — TypeScript infers types from `en.json`
- When adding keys, update ALL 5 files simultaneously or the build fails
- Run `rm -rf .next` if TypeScript type cache is stale after dict changes
- `LanguageSwitcher` in Sidebar footer persists locale in cookies

## Project Overview

AI code review platform: Next.js 16 + React 19 + TypeScript + HeroUI v3 (beta) + Tailwind CSS v4.
Multi-GitHub project management, commit selection, Claude AI analysis, configurable rule sets, quality report scoring.
Backend: task queue + analysis workers (by commit SHA), incremental report updates via SSE.

## Organization Model & Routing

Supabase-style multi-tenant org system (Vercel-like UI). Each user has a **personal org** on signup.

**Org-scoped assets:** projects, reports, rule_sets, rules, integrations, rule learning stats.

**Roles:** `owner | admin | reviewer | member`
- `owner/admin`: manage org assets (create/update/delete projects, rules, integrations, config)
- `reviewer/member`: read-only (view projects/reports/rules)

**Active org:**
- Stored in `org_id` cookie
- Resolved via `/api/orgs/active` (GET/POST)
- Auth callback + invite accept also set the cookie

**URL routing:**
- Dashboard URLs must include org prefix: `/o/:orgId/...`
- `middleware.ts` rewrites `/o/:orgId/...` to the internal route and keeps cookie in sync
- If a user hits `/projects` (or other dashboard path) and has `org_id`, middleware redirects to `/o/:orgId/...`

**Frontend helpers:**
- `src/lib/orgPath.ts` → `withOrgPrefix`, `stripOrgPrefix`, `replaceOrgInPath`, `extractOrgFromPath`
- `src/lib/useOrgRole.ts` → `isAdmin` gating for UI actions

## Tech Stack

| Tech | Version | Notes |
|------|---------|-------|
| Next.js | 16.1.6 | App Router, Turbopack |
| React | 19.2.3 | — |
| HeroUI | 3.0.0-beta.8 | `@heroui/react` |
| Tailwind CSS | v4.2.1 | `@import "@heroui/styles"` in globals.css |
| Geist Font | 1.7.x | Geist Sans/Mono via `geist` package |
| Radix UI Primitives | ^2.1.4 | `@radix-ui/react-primitive` (Radix Select/Popper dependency) |
| CodeMirror | 6.x | Read-only codebase editor preview |
| Supabase | `@supabase/ssr ^0.9` | Database + auth |
| Octokit | `^5.0.5` | GitHub API |
| Anthropic SDK | `^0.78` | Claude AI, supports `ANTHROPIC_BASE_URL` |
| sonner | ^2 | Toast notifications |
| zod | `^4.3.6` | Runtime validation |
| lucide-react | ^0.577 | Icons |

## HeroUI v3 Configuration

- **globals.css**: `@import "@heroui/styles";` — do NOT use `heroui()` tailwind plugin
- **No** `HeroUIProvider` wrapper needed
- **.npmrc**: `public-hoist-pattern[]=*@heroui/*` (required for correct hoisting)
- **No Progress component** — use Tailwind: `<div className="h-1 rounded-full bg-muted overflow-hidden"><div className="h-full rounded-full bg-success" style={{ width: `${v}%` }} /></div>`

## HeroUI v3 Component API

```tsx
// Card
<Card><Card.Header><Card.Title /></Card.Header><Card.Content className="p-4" /></Card>

// Modal
<Modal state={modalState}>
  <Modal.Backdrop isDismissable>
    <Modal.Container size="md"> {/* xs|sm|md|lg|full|cover */}
      <Modal.Dialog>
        <Modal.Header><Modal.Heading>Title</Modal.Heading></Modal.Header>
        <Modal.Body /><Modal.Footer />
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
</Modal>

// Modal state
const modalState = useOverlayState({ isOpen: show, onOpenChange: (v) => { if (!v) setShow(false); } });

// Tabs — NEVER use <Tabs.Indicator /> (causes SharedElement runtime error)
<Tabs defaultSelectedKey="tab1">
  <Tabs.ListContainer className="border-b border-border px-4">
    <Tabs.List><Tabs.Tab id="tab1">Tab</Tabs.Tab></Tabs.List>
  </Tabs.ListContainer>
  <Tabs.Panel id="tab1">Content</Tabs.Panel>
</Tabs>

// Select
<Select selectedKey={value} onSelectionChange={(key) => setValue(key as string)}>
  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
  <Select.Popover>
    <ListBox items={items}>{(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}</ListBox>
  </Select.Popover>
</Select>

// Tooltip
<Tooltip><Tooltip.Trigger><Button /></Tooltip.Trigger><Tooltip.Content>text</Tooltip.Content></Tooltip>

// Input with icon (no startContent prop)
<InputGroup>
  <InputGroup.Prefix><Search className="size-4" /></InputGroup.Prefix>
  <InputGroup.Input placeholder="..." value={v} onChange={e => setV(e.target.value)} />
</InputGroup>
```

### API Limitations

| Component | Limitation |
|-----------|------------|
| `Modal.Container` | `size`: `xs\|sm\|md\|lg\|full\|cover` only |
| `Input` | No `startContent`, no `isDisabled` — use HTML `disabled` |
| `Button` | No `isLoading` — use `isDisabled` + conditional text |
| `Card` | No `onPress` — use `onClick` |
| `Select.Value` | No `placeholder` — use children |
| `Switch` | `onChange` receives `boolean`, not event |
| `Tabs.Indicator` | **Forbidden** — SharedElement runtime error |
| `Separator` | Replaces v2 `Divider` |

**Button variants:** `primary | outline | ghost | secondary | tertiary | danger | danger-soft`
**Chip variants:** `primary | secondary | tertiary | soft`
**Chip colors:** `default | primary | accent | success | warning | danger`

## UI Design Guidelines

Geist-aligned neutral theme: layered surfaces, thin borders, restrained shadows, and clear typographic hierarchy.
Project UI spec: `docs/memories/ui-spec-geist.md` (source of truth).

**Typography:** Use utility classes from `src/app/globals.css`:
`text-heading-*`, `text-label-*`, `text-copy-*`, `text-button-*`.
Avoid custom font sizes unless a new token is added.

**Color tokens:** `bg-background` | `bg-card` | `bg-muted` | `bg-muted/30` (hover) | `border-border` | `text-foreground` | `text-muted-foreground` | `text-primary` | `text-success` | `text-warning` | `text-danger` | `text-accent`

**List page structure:**
```tsx
<div className="flex flex-col h-full">
  <div className="px-6 py-4 border-b border-border bg-background shrink-0">...</div> {/* header */}
  <div className="px-6 py-3 border-b border-border bg-background shrink-0">...</div> {/* toolbar */}
  <div className="flex-1 overflow-auto">
    <div className="flex items-center px-4 py-2 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground gap-4">...</div>
    {/* rows: border-b border-border hover:bg-muted/30 */}
  </div>
</div>
```

**Empty state:** `<div className="flex flex-col items-start gap-3 px-6 py-20">` with icon (bg-muted rounded-lg) + title + description + Button.

## Next.js 16 Special Configuration

- **Middleware**: file is `middleware.ts` at repo root (Next.js middleware). It handles `/o/:orgId` rewrites and org redirects.
- `src/proxy.ts` is legacy and currently unused.
- **Dynamic pages**: all dashboard pages with Supabase must have `export const dynamic = 'force-dynamic'`
- **Vercel timeout**: analyze route configured for 300s in `vercel.json`

## Directory Structure

```
src/
  app/
    (auth)/login/           # Login (no Sidebar)
    (auth)/invite/[token]/  # Invite accept
    auth/callback/          # OAuth callback
    (dashboard)/            # Protected pages + Sidebar
      layout.tsx
      projects/             # ProjectsClient
        [id]/               # CommitsClient + EnhancedProjectDetail + Tabs
      reports/              # ReportsClient
        [id]/               # EnhancedReportDetailClient (primary), ReportDetailClient (legacy)
      rules/                # RulesClient
        [id]/               # RuleSetDetailClient
      settings/integrations/
    api/
      analyze/              # POST → fire-and-forget AI analysis
      tasks/run/            # POST → task queue
      commits/ projects/ reports/ rules/ stats/ github/ stream/
    layout.tsx providers.tsx globals.css
  components/
    layout/Sidebar.tsx
    project/ProjectCard, AddProjectModal, EditProjectModal, ProjectConfigPanel
    report/EnhancedIssueCard, AIChat, TrendChart, ExportButton
    dashboard/DashboardStats.tsx
    common/LanguageSwitcher.tsx
  i18n/
    index.ts                # getDictionary(), Dictionary type (inferred from en.json)
    dictionaries/           # en.json zh.json ja.json es.json zh-TW.json
  lib/locale.ts             # getLocale() — reads NEXT_LOCALE cookie
  lib/orgPath.ts            # /o/:orgId path helpers
  lib/useOrgRole.ts         # client hook for org role + admin gating
  services/db.ts github.ts claude.ts taskQueue.ts analyzeTask.ts ...
  proxy.ts                  # Legacy auth middleware (unused)
middleware.ts               # Org path rewrite + redirect (Next.js middleware)
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TASK_RUNNER_TOKEN=          # Optional, protects /api/tasks/run
```

**VCS and AI integrations** are configured via web UI at **Settings > Integrations** — NOT via env vars.
- VCS: GitHub, GitLab, Generic Git
- AI: Any OpenAI-compatible API (Claude, GPT-4, DeepSeek, etc.)
- Non-sensitive config → `user_integrations` table; secrets → Supabase Vault
- Priority: project-specific > user default (no env var fallback)

## Common Commands

```bash
pnpm dev     # Dev server (port 8109)
pnpm build   # Production build (TypeScript check)
pnpm start   # Production server
pnpm lint    # ESLint
```

## Dependency Build Scripts

pnpm is configured to only allow approved dependency build scripts.
The allowlist lives in `.npmrc` under `only-built-dependencies[]` (currently includes `msgpackr-extract`).
If new install warnings appear, approve the dependency and update the allowlist.

## AI Analysis Flow

1. `POST /api/analyze` → returns `{ reportId }` immediately, enqueues task
2. Worker: fetch diff by commit SHA → Claude analysis → sync `report_issues` → update status
3. Frontend: SSE on `/api/reports/[id]/stream`, fallback to polling every 2.5s

**Task queue:** `POST /api/tasks/run?limit=1` — auth via `x-task-token` or login; max limit 10

**GitHub webhook:** `/api/webhooks/github` supports `?project_id=...`. If a repo matches multiple projects, the endpoint returns 409 and requires `project_id`.

## Codebase Cache (Backend)

`CodebaseService` manages per-project local Git mirrors and per-job workspaces for AI analysis and pipeline tasks.
Mirrors are cache-only (not a source of truth) and are synced on demand or on a schedule; workspaces are isolated and must be cleaned after each job.
Codebase browsing uses the same mirror cache and enforces a max preview size for files.
Line-level comments for code browsing are stored in `codebase_comments` and scoped by org, project, repo, ref, and path. Optional line ranges (`line_end`) and selection text (`selection_text`) capture multi-line or partial-text comments.
Codebase tree/file endpoints accept `sync=0` to skip mirror fetch for faster browsing (manual sync still available).
Automatic mirror sync can be triggered by:
- GitHub `push` webhooks (forces mirror fetch for matching projects).
- Scheduled POST to `/api/codebase/sync` (uses `x-task-token` if `TASK_RUNNER_TOKEN` is set). Supports `limit`, `force`, `project_id`, and `org_id`.
- Project creation triggers an initial mirror sync in the background.

Local cache directories `/.codebase/` and `/.pnpm-store/` are not committed to Git.

```
CODEBASE_ROOT=
CODEBASE_MIRRORS_DIR=
CODEBASE_WORKSPACES_DIR=
CODEBASE_SYNC_INTERVAL_MS=
CODEBASE_LOCK_TIMEOUT_MS=
CODEBASE_LOCK_STALE_MS=
CODEBASE_WORKSPACE_TTL_MS=
CODEBASE_FILE_MAX_BYTES=
CODEBASE_GIT_BIN=
```

## Toast Usage

```ts
import { toast } from 'sonner';
toast.success('...'); toast.error('...'); toast.warning('...');
```
`Toaster` mounted in `src/app/providers.tsx`.

## Runtime Contracts

- All API routes require login; task endpoints accept `x-task-token`
- `report_issues.status`: `open | fixed | ignored | false_positive | planned`
- `/api/projects/[id]/trends` returns array directly (no `data` wrapper)
- Rules learning endpoints are admin-only (org-scoped)
- Public pages accessible without login: `/`, `/login`, `/auth/*`, `/invite/*`, `/terms`, `/privacy`
- Dashboard routes must be accessed via `/o/:orgId/...` (middleware rewrites internally)

## FAQ

**TypeScript build errors?** Run `pnpm build`. Common: use `disabled` not `isDisabled` on Input; `onClick` not `onPress` on Card; Modal size only `xs|sm|md|lg|full|cover`. If type errors persist after dict changes, run `rm -rf .next`.

**Dark mode?** Add `dark` class to `html` tag — HeroUI v3 CSS variables adapt automatically.
