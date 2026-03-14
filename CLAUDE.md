# spec-axis — Project Guide

## General Rules

- **Response language**: Always respond in English

## Project Overview

An AI code review platform built with Next.js 16 + React 19 + TypeScript, using HeroUI v3 (beta) + Tailwind CSS v4.
Supports multi-GitHub project management, commit selection, Claude AI analysis, configurable rule sets, and quality report scoring.
The UI uses HeroUI v3 composite component APIs + lucide-react, is fully English, white theme, left-aligned Supabase Dashboard style.
The backend supports a task queue and analysis workers (by commit SHA), with incremental report updates via SSE.

## Tech Stack

| Tech | Version | Notes |
|------|---------|------|
| Next.js | 16.1.6 | App Router, Turbopack build |
| React | 19.2.3 | — |
| HeroUI | 3.0.0-beta.8 | UI component library (`@heroui/react`) |
| Tailwind CSS | v4.2.1 | `@tailwindcss/postcss`, import via `@import "@heroui/styles"` |
| framer-motion | ^12 | HeroUI animation dependency |
| tw-animate-css | ^1.4 | HeroUI styling dependency |
| Supabase | `@supabase/ssr ^0.9` | Database + auth |
| Octokit | `^5.0.5` | GitHub API |
| Anthropic SDK | `^0.78` | Claude AI analysis, supports `ANTHROPIC_BASE_URL` custom endpoint |
| sonner | ^2 | Toast notifications |
| zod | `^4.3.6` | Runtime validation |
| lucide-react | ^0.577 | Icon library |

## HeroUI v3 Key Configuration

### globals.css

```css
@import "@heroui/styles";

@layer base {
  body {
    font-family: Arial, Helvetica, sans-serif;
  }
}
```

**Do not** use the `heroui()` plugin in `tailwind.config.ts` (v3 does not use it).
**Do not** wrap with `HeroUIProvider` (v3 does not require it).

### .npmrc

```
public-hoist-pattern[]=*@heroui/*
```

Must be configured, otherwise HeroUI packages will not be hoisted correctly.

### Progress Component

HeroUI v3 beta **does not** include a Progress component. Use Tailwind:

```tsx
<div className="h-1 rounded-full bg-muted overflow-hidden">
  <div className="h-full rounded-full bg-success" style={{ width: `${value}%` }} />
</div>
```

## HeroUI v3 Component API (Verified)

### Composite Component Structure

```tsx
// Card
<Card>
  <Card.Header><Card.Title>Title</Card.Title></Card.Header>
  <Card.Content className="p-4">Content</Card.Content>
</Card>

// Modal
<Modal state={modalState}>
  <Modal.Backdrop isDismissable>
    <Modal.Container size="md">  {/* xs | sm | md | lg | full | cover */}
      <Modal.Dialog>
        <Modal.Header><Modal.Heading>Title</Modal.Heading></Modal.Header>
        <Modal.Body>Content</Modal.Body>
        <Modal.Footer>Footer</Modal.Footer>
      </Modal.Dialog>
    </Modal.Container>
  </Modal.Backdrop>
</Modal>

// Tabs (do not use <Tabs.Indicator />, causes SharedElement runtime error)
<Tabs defaultSelectedKey="tab1">
  <Tabs.ListContainer className="border-b border-border px-4">
    <Tabs.List>
      <Tabs.Tab id="tab1">Tab 1</Tabs.Tab>
    </Tabs.List>
  </Tabs.ListContainer>
  <Tabs.Panel id="tab1">Content</Tabs.Panel>
</Tabs>

// Select
<Select selectedKey={value} onSelectionChange={(key) => setValue(key as string)}>
  <Select.Trigger><Select.Value /><Select.Indicator /></Select.Trigger>
  <Select.Popover>
    <ListBox items={items}>
      {(item) => <ListBox.Item id={item.id}>{item.label}</ListBox.Item>}
    </ListBox>
  </Select.Popover>
</Select>

// Tooltip (composite component, no content prop)
<Tooltip>
  <Tooltip.Trigger><Button>Trigger</Button></Tooltip.Trigger>
  <Tooltip.Content>Tooltip text</Tooltip.Content>
</Tooltip>

// Input with prefix icon (Input has no startContent prop)
<InputGroup>
  <InputGroup.Prefix><Search className="size-4" /></InputGroup.Prefix>
  <InputGroup.Input placeholder="Search..." value={v} onChange={e => setV(e.target.value)} />
</InputGroup>

// EmptyState
<EmptyState>
  <EmptyState.Root>Content</EmptyState.Root>
</EmptyState>
```

### Known API Limitations

| Component | Limitation |
|-----------|------------|
| `Modal.Container` | `size` only accepts `xs | sm | md | lg | full | cover`, no `xl` / `2xl` |
| `Input` | No `startContent` prop, no `isDisabled`; use standard HTML `disabled` |
| `Button` | No `isLoading` prop; use `isDisabled` + conditional text |
| `Card` | Plain `div`, no `onPress`; use `onClick` |
| `Select.Value` | No `placeholder` prop; use children: `<Select.Value>Placeholder</Select.Value>` |
| `Switch` | `onChange` receives `boolean` (not event object) |
| `Tabs.Indicator` | **Forbidden**; triggers SharedElement runtime error |
| `Separator` | Divider component name (v2 uses `Divider`) |

### Button Variant Values

`primary | outline | ghost | secondary | tertiary | danger | danger-soft`

### Chip Variant Values

`primary | secondary | tertiary | soft`

### Chip Color Values

`default | primary | accent | success | warning | danger`

### Modal State Management

```tsx
const modalState = useOverlayState({
  isOpen: showModal,
  onOpenChange: (v) => { if (!v) setShowModal(false); },
});
// Open: setShowModal(true) or modalState.open()
// Close: setShowModal(false) or modalState.close()
```

## UI Design Guidelines

### Style Reference

Reference the **Supabase Dashboard** white theme:
- Content is **left-aligned**, no centered layout
- List pages use **table rows + dividers** (not card grids)
- Header is minimal: `px-6 py-4 border-b border-border bg-background`
- Empty state is left-aligned (icon + title + description + action button in a vertical stack)

### Semantic Tailwind Color Tokens

| token | Usage |
|-------|------|
| `bg-background` | Page background |
| `bg-card` | Card background |
| `bg-muted` | Secondary background, code blocks |
| `bg-muted/30` | Hover highlight |
| `border-border` | Standard border |
| `text-foreground` | Primary text |
| `text-muted-foreground` | Secondary text, labels |
| `text-primary` | Primary color |
| `text-success` | Success/green |
| `text-warning` | Warning/yellow |
| `text-danger` | Error/red |
| `text-accent` | Accent color |
| `bg-primary/10` | Light primary background |
| `bg-success/5` | Light success background |
| `border-success/20` | Light success border |

### Standard List Page Structure

```tsx
<div className="flex flex-col h-full">
  {/* Header */}
  <div className="px-6 py-4 border-b border-border bg-background shrink-0">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-semibold">Page Title</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Description</p>
      </div>
      <Button size="sm">Action</Button>
    </div>
  </div>

  {/* Toolbar (optional) */}
  <div className="px-6 py-3 border-b border-border bg-background shrink-0 flex items-center gap-3">
    {/* Filters, etc. */}
  </div>

  {/* Content */}
  <div className="flex-1 overflow-auto">
    {/* Header row */}
    <div className="flex items-center px-4 py-2 border-b border-border bg-muted/40 text-xs font-medium text-muted-foreground gap-4">
      Column titles
    </div>
    {/* Data rows: border-b border-border hover:bg-muted/30 */}
  </div>
</div>
```

### Standard Empty State Structure (Left-aligned)

```tsx
<div className="flex flex-col items-start gap-3 px-6 py-20">
  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
    <Icon className="h-5 w-5 text-muted-foreground" />
  </div>
  <div>
    <h3 className="text-sm font-medium">Title</h3>
    <p className="text-sm text-muted-foreground mt-0.5">Description</p>
  </div>
  <Button size="sm" className="gap-1.5 mt-1">Action</Button>
</div>
```

## Next.js 16 Special Configuration

### Middleware (proxy)

Next.js 16 renamed middleware to proxy:
- Filename: `src/proxy.ts` (not `src/middleware.ts`)
- Exported function name: `export async function proxy()` (not `middleware`)

### Dynamic Pages

All dashboard pages using Supabase must include:

```ts
export const dynamic = 'force-dynamic';
```

Otherwise the build will attempt static pre-rendering and fail.

### Vercel Timeout

The AI analysis API is configured for a 300s timeout in `vercel.json`:

```json
{ "functions": { "src/app/api/analyze/route": { "maxDuration": 300 } } }
```

## Directory Structure

```
src/
  app/
    (auth)/               # Login pages (no Sidebar)
      layout.tsx
      login/page.tsx
    (dashboard)/          # Protected pages with Sidebar
      layout.tsx          # Sidebar + main layout
      projects/           # Project list (ProjectsClient)
        [id]/             # Project details (CommitsClient + Tabs)
      reports/            # Report list (ReportsClient)
        [id]/             # Report details (ReportDetailClient / EnhancedReportDetailClient)
      rules/              # Rule set list (RulesClient)
        [id]/             # Rule set details (RuleSetDetailClient)
      settings/           # Connection status page
    api/
      analyze/            # POST triggers AI analysis (fire-and-forget)
      tasks/run/          # POST triggers task queue processing
      commits/            # GET GitHub commits
      projects/           # CRUD
      reports/            # GET list + detail
      rules/              # Rule set CRUD
      stream/             # SSE updates
      stats/              # Stats
      github/             # GitHub status
    layout.tsx            # Root layout, mounts Providers (includes Toaster)
    globals.css           # @import "@heroui/styles"
    providers.tsx         # Client Providers (Toaster)
  components/
    layout/Sidebar.tsx    # Sidebar navigation
    project/
      ProjectCard.tsx     # Project row (table-row style)
      AddProjectModal.tsx # Add project modal
      EditProjectModal.tsx# Edit project modal
      ProjectConfigPanel.tsx # Project config panel
    report/
      EnhancedIssueCard.tsx
      AIChat.tsx
      TrendChart.tsx
      ExportButton.tsx
      BatchOperations.tsx
      SavedFilters.tsx
    dashboard/
      DashboardStats.tsx  # KPI metrics (simple inline number style)
    common/
      VirtualScroll.tsx
  lib/
    utils.ts              # cn() utility
    supabase/
      client.ts           # Browser Supabase client
      server.ts           # Server + admin client
    offlineCache.ts
  services/
    db.ts                 # Supabase DB operations
    github.ts             # Octokit wrapper
    claude.ts             # Anthropic API (supports ANTHROPIC_BASE_URL)
    logger.ts             # Structured logging
    retry.ts              # Retry logic
    validation.ts         # Zod validation
    sse.ts                # Server-Sent Events
    performance.ts        # Performance monitoring
    audit.ts              # Audit logging
    taskQueue.ts          # Task queue
    analyzeTask.ts        # Analysis worker
    taskHandlers.ts       # Task handlers
    issues.ts             # report_issues sync
    incremental.ts        # Incremental analysis
    languages.ts          # Language detection
  middleware/
    rateLimit.ts          # Rate limiting
  proxy.ts                # Auth proxy (Next.js 16 middleware equivalent)
```

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
TASK_RUNNER_TOKEN=       # Optional, protects task execution endpoint
```

**IMPORTANT**: VCS (GitHub/GitLab) and AI (Claude/GPT-4) integrations are **no longer configured via environment variables**. They must be configured through the web UI at **Settings > Integrations**.

## User Integrations System

### Configuration Location
All VCS and AI integrations are managed at: **Settings > Integrations**

### Supported Providers
- **VCS**: GitHub, GitLab, Generic Git
- **AI**: OpenAI-compatible APIs (Anthropic Claude, OpenAI GPT-4, DeepSeek, etc.)

### First-Time Setup
New users will see an onboarding modal requiring them to configure:
1. At least one VCS integration (for repository access)
2. At least one AI integration (for code analysis)

### Integration Priority
- Project-specific integration > User default integration
- No fallback to environment variables

### Data Storage
- Non-sensitive config (baseUrl, model, etc.) stored in `user_integrations` table
- Sensitive data (tokens, API keys) stored in Supabase Vault

## Common Commands

```bash
pnpm dev     # Dev server (port 8109)
pnpm build   # Production build (TypeScript check + page generation)
pnpm start   # Start production server
pnpm lint    # Run ESLint
```

## Database Migration

- `supabase/migrations/005_fix_snapshot_severity.sql` fixes historical quality snapshot severity stats

## AI Analysis Flow

1. Frontend POST `/api/analyze` → returns `{ reportId }` immediately
2. Backend enqueues a task (fetches diff precisely by commit SHA)
3. Worker executes: fetch diff → Claude analysis → sync `report_issues` → update report status
4. Frontend prefers SSE on `/api/stream`, falls back to refresh `/api/reports/[id]` on completion

### Task Queue Execution

- Trigger endpoint: `POST /api/tasks/run?limit=1`
- Auth: prefer `x-task-token` (requires `TASK_RUNNER_TOKEN`), otherwise requires login
- `limit` max 10

## Toast Usage

```ts
import { toast } from 'sonner';
toast.success('Operation succeeded');
toast.error('Operation failed');
toast.warning('Warning message');
```

`Toaster` is mounted globally in `src/app/providers.tsx`.

## FAQ

### Q: What if I get TypeScript errors during build?
A: Run `pnpm build` and fix errors one by one. Common issues:
- Use `disabled` instead of `isDisabled` for `Input`
- Use `onClick` instead of `onPress` for `Card`
- `Modal.Container size` only supports `xs|sm|md|lg|full|cover`

### Q: How do I add an input with a prefix icon?
A: `Input` has no `startContent`. Use `InputGroup`:
```tsx
<InputGroup>
  <InputGroup.Prefix><Search className="size-4" /></InputGroup.Prefix>
  <InputGroup.Input placeholder="..." value={v} onChange={e => setV(e.target.value)} />
</InputGroup>
```

### Q: How do I implement a progress bar?
A: HeroUI v3 beta has no Progress component. Use Tailwind:
```tsx
<div className="h-1 rounded-full bg-muted overflow-hidden">
  <div className="h-full rounded-full bg-success" style={{ width: `${value}%` }} />
</div>
```

### Q: Why not use Google Fonts?
A: Next.js 16 + Turbopack has known issues, so we use a system font stack.

### Q: Is dark mode supported?
A: The current theme is light. Add the `dark` class to the `html` tag to enable dark mode; HeroUI v3 CSS variables will adapt automatically.

## Runtime Constraints and Contracts

### API Auth

- All API routes require login by default
- Task queue endpoints can be called without login via `x-task-token`

### Issue Status Enum

`report_issues.status` is standardized as: `open | fixed | ignored | false_positive | planned`

### Trend API Response

`/api/projects/[id]/trends` returns an array (frontend compatible with old `data` wrapper)
