# UI Components & Design Guidelines

## UI Components

This project does **not** use HeroUI. UI is built from:
- Local reusable components under `apps/studio/src/components/ui/*`
- Radix primitives where needed
- Tailwind CSS tokens defined in `apps/studio/src/app/globals.css`

### Component Rules

- Treat `apps/studio/src/app` as the route layer only. Keep `page/layout/loading/error/not-found/template/default/route` files there, plus route-private `_components` / `_lib` folders when a segment truly needs private implementation details.
- Do not import shared business UI or shared page implementations from one `app` route segment into another. Shared implementations must live under `src/features/*` or `src/components/*`, and route files should stay thin wrappers that compose those modules.
- Shared feature entrypoints outside `src/app` should avoid the `*Page` suffix. Prefer names like `*Screen`, `*View`, or domain-specific module names so route semantics stay owned by the App Router files.
- Prefer `components/ui/*` wrappers over direct Radix usage to keep styling and behavior consistent.
- Use `components/ui/combobox.tsx` for searchable selection controls that need project branch discovery or any similar branch-picking UX; avoid ad hoc native `<select>` controls in those flows.
- Direct `@radix-ui/*` imports are forbidden outside `src/components/ui/*` and enforced by ESLint (`no-restricted-imports`).
- Language-aware code rendering must use shared resolver `src/lib/codeLanguage.ts` (`@codemirror/language-data`), not ad-hoc direct `@codemirror/lang-*` imports in feature components.
- Do not introduce compatibility props or dual APIs (for example `foo` vs `Foo`, `onPress` vs `onClick`). Pick one naming and enforce it.
- Do not add framework-specific naming that implies legacy support (for example `legacy*`, `compat*`, `polyfill*`).
- Interactive containers (cards/rows/panels) must be keyboard accessible (`role`, `tabIndex`, `Enter/Space` handling) when not using native interactive elements.
- Primary async route segments should provide `loading.tsx` boundaries; avoid pure text placeholders as the only loading state.
- Skeleton states should not display finalized page titles/descriptions or other real loaded copy in the same region; header/title areas should skeletonize as well until data is ready.
- Destructive actions in product UI must use in-app confirmation dialogs (`components/ui/confirm-dialog.tsx`), not native `window.confirm`.
- Destructive deletion of top-level entities such as projects and pipelines should live in the relevant Settings danger zone and require typed name confirmation, not a primary/list-level action.
- In client UI, use shared date format helpers from `src/lib/dateFormat.ts` instead of direct `toLocaleString`/`toLocaleDateString` calls in feature components.

### Dialog Rules

- Dialogs follow a **single-scroll-container** rule: avoid outer `DialogContent` scrolling for complex modals; body/content panes should own scrolling to prevent nested or redundant scrollbars.
- Dialog footers should keep a compact action rhythm: use `secondary` for cancel actions, `default` or `destructive` for the primary action, and keep action spacing at `gap-3` so modal controls read as a single grouped rail.
- Dialog forms must keep `DialogFooter` as a direct child action rail of `DialogContent`; do not nest footers inside form/content wrappers that add extra padding, otherwise footer spacing becomes visually incorrect.
- Dialogs must use the shared structure `DialogHeader + DialogBody + DialogFooter`; do not place raw content blocks directly under `DialogContent` unless the dialog is intentionally custom and handles its own spacing.
- Simple confirmation dialogs should reuse shared primitives (`components/ui/confirm-dialog.tsx` or `components/ui/typed-confirm-dialog.tsx`) so spacing, copy hierarchy, and action layout stay consistent.

### Navigation Rules

- Dashboard information architecture is single-source navigation: in project scope, use sidebar navigation only (do not add an additional top tab bar such as `ProjectNav`).
- Responsive navigation contract: desktop (`lg+`) uses sidebar + topbar, while mobile (`<lg`) hides sidebar and uses bottom navigation with the same route semantics.
- Dashboard navigation shell is contextual: global routes render org-level sidebar items, and project routes (`/o/:orgId/projects/:id/*`) switch sidebar to project-scoped navigation (commits/reports/pipelines/artifacts/codebase/settings) with in-sidebar project switcher.
- Dashboard shell includes productivity navigation aids: collapsible sidebar rail (persisted in a server-readable cookie), a compact topbar scope switcher (single dropdown for team/project context on project-domain pages), global quick-jump command palette (`Cmd/Ctrl + K`) with keyboard navigation and grouped results, and mobile bottom navigation for project/global context switching on small screens.
- Dashboard shell project data is single-source: `Sidebar`, `Topbar`, and `CommandPalette` consume shared project state from `DashboardShellProvider` (no duplicated `/api/projects` fetches per component).
- Dashboard shell chrome must stay hydration-safe: do not branch on browser-only values such as `window`, `navigator`, `localStorage`, or date/locale output during the initial render of shared layout components; if persisted UI state is required, derive it via stable defaults plus `useSyncExternalStore` or an equivalent client-safe subscription pattern.
- Persistent dashboard chrome state that affects the initial render, such as sidebar collapse, should be sourced from a server-readable cookie and mirrored by the client on toggle so refreshes stay visually stable.

### Settings Primitives

- Global settings pages now share a common shell/section pattern via `SettingsPageShell` and `SettingsSection`; new org-scoped settings surfaces should compose those primitives instead of introducing custom page chrome.
- Personal account surfaces live at `/account` and use the dedicated `AccountPageShell` + `AccountNav` layout. The sidebar footer avatar menu is the canonical entry point, and org/project primary navigation must not promote account as a top-level item. Account section navigation keeps the URL hash and scroll position in sync so refresh/back behavior lands on the same section.
- Settings pages should also use `SettingsEmptyState` for no-data states so empty views stay visually consistent across integrations, organizations, security, and future settings surfaces.
- Settings pages should use `SettingsNotice` for inline helper/success/warning messaging instead of ad hoc colored text blocks so feedback stays visually and semantically consistent.
- Settings pages should use `SettingsRow` for repetitive label/control rows so toggles, inline inputs, and list rows stay compact and visually consistent.
- Settings pages and settings-oriented dialogs should use `SettingsField` for stacked `label + helper + control` groups instead of ad hoc margin utilities so form rhythm stays consistent.
- Settings-based destructive areas should use `SettingsDangerZone` instead of custom red cards so project/pipeline deletion UI stays visually and behaviorally consistent.

## UI Design Guidelines

Geist-aligned neutral theme: layered surfaces, thin borders, restrained shadows, and clear typographic hierarchy.
Project UI spec: `docs/memories/ui-spec-geist.md` (source of truth).

**Typography:** Use utility classes from `src/app/globals.css`:
`text-heading-*`, `text-label-*`, `text-copy-*`, `text-button-*`.
Avoid custom font sizes unless a new token is added.
Dashboard baseline typography is density-aware: `14px` for primary UI text (navigation/body/controls), `13px` for compact control text, and `12px` for metadata/helper labels.
Do not use `text-xs` for primary labels, tab titles, or actionable control text. Reserve it only for dense metadata chips where `12px` would materially break layout.

**Control density and states:** Keep control rhythm consistent across `Button/Input/Select/Textarea/Tabs/Dropdown` wrappers.
Buttons may use `h-9` as the standard dashboard action height, but form controls (`Input`, searchable `Combobox`, `Textarea`, modal `SelectTrigger`) should align to `h-10` so labels, helper text, and field chrome match the Vercel/Geist-style settings density. Hover/active/focus states must use the same neutral-surface progression and subtle accent focus ring.
Avoid `h-7` as a default interactive control height in dashboard/product UI.
Primary dashboard actions must render as true solid buttons with explicit token-based background and foreground colors; do not rely on undeclared semantic utility class names for critical call-to-action styling.

**Focus visibility:** Do not globally disable focus outlines/rings in dialogs or shells. If custom focus styles are required, replace defaults with an explicit, visible ring to preserve keyboard accessibility.

**Layout width rhythm:** Dashboard pages should use the shared `dashboard-container` utility from `src/app/globals.css` for consistent content width and horizontal padding. Avoid per-page hardcoded `max-w-*` wrappers for primary page shells.

**Overlay surfaces:** Menus/select popovers/dialogs should use restrained overlay shadows and 8–12px corner radii. Avoid heavy, high-contrast shadow stacks that visually overpower surrounding neutral surfaces.

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

## Toast Usage

```ts
import { toast } from 'sonner';
toast.success('...'); toast.error('...'); toast.warning('...');
```
`Toaster` mounted in `apps/studio/src/app/providers.tsx`.
