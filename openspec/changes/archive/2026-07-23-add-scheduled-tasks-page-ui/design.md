## Context

The target Scheduled Tasks page is a catalog-style layout: header with title "Scheduled tasks", a one-line subtitle, and a primary "New task" button (top-right). Below it, a toolbar row with a search input ("Search scheduled tasks...") and a right-aligned sort control ("First to run" with a dropdown: First to run / Last to run / Newest / Name A-Z). Below the toolbar, tasks are grouped into named sections ("Shared", "My tasks") each with a count badge, rendering a card grid (title, "N NEW" badge, description, schedule pill, location breadcrumb, per-card overflow menu with Run now / Edit / Delete).

Iteration 1 ships UI chrome only — no backend contract exists yet for scheduled tasks data, so the content region always renders the shared `PanelEmptyState` instead of the section/card grid. The toolbar (search + sort) is rendered but inert: no items exist to filter or sort. This lets navigation, i18n, RTL, and responsive behavior ship and be validated independently of the eventual list/CRUD API.

Constraints: library isolation (`AGENTS.md` §Library isolation) requires the presentational chrome to live in a host-agnostic lib; the app wires flags, i18n, and routing. No existing `NAVIGATION_CONFIG` entry is feature-flag-gated today, so gating logic must be introduced, not just reused.

## Goals / Non-Goals

**Goals:**
- Ship a catalog-aligned page shell at `/scheduled-tasks`, gated end-to-end (nav + direct URL) behind `features.scheduledTasksEnabled`, defaulting off.
- Establish `libs/scheduled-tasks` as a reusable, host-agnostic presentational lib mirroring the Catalog lib's separation of concerns (root component owns toolbar/search/sort UI state; app owns data and callbacks).
- Full i18n + RTL + AAA a11y coverage for every string and interactive control shipped in this iteration.

**Non-Goals:**
- Any scheduled-task data model, REST/BFF endpoint, or `@epam/chat-api-client` usage.
- Rendering task cards, list rows, the "Shared"/"My tasks" grouping, pagination, or virtualization — the content area always shows the empty state in this iteration regardless of search/sort control values.
- Wiring the "New task" button to a real create flow, or the per-card overflow menu (Run now/Edit/Delete) — deferred to follow-up changes; cards are not rendered in this iteration.
- Backend `@RequireFeature` guards — no endpoints are added.

## Decisions

**Route path — `/scheduled-tasks` (new top-level route).**
Matches the File Manager precedent (`ROUTES.FileManager = '/files'`): a flat, standalone path, not nested under `/catalog`. Alternative considered: nesting under an existing route — rejected, the Scheduled Tasks surface is a full-page standalone view with its own nav entry, not a tab of another page.

**Flag-off behavior — redirect to `NotFound`, not Home.**
Direct navigation to `/scheduled-tasks` while `scheduledTasksEnabled` is `false` renders the app's `NotFound` route content (no redirect loop; the URL stays but content is the not-found view — consistent with how disabled/unreleased routes should not leak existence). Alternative: redirect to `/` — rejected per proposal's explicit preference to avoid leaking unreleased features by making the URL behave identically to a genuinely unknown path.

**Nav gating — extend `NavigationItem` with an optional `featureFlag` key; filter in `Navigation.tsx`.**
```ts
interface NavigationItem {
  path: string;
  matchPaths?: string[];
  icon: FC<{ size?: number; stroke?: number }>;
  labelKey: NavigationI18nKeys;
  featureFlag?: string; // short useFeatureFlag key, e.g. 'scheduledTasksEnabled'
}
```
`Navigation.tsx` filters `NAVIGATION_CONFIG` before mapping: an item with no `featureFlag` always renders (backward compatible); an item with `featureFlag` renders only when `useFeatureFlag(item.featureFlag)` is `true`. Alternative considered: a separate `GATED_NAVIGATION_CONFIG` array merged at render time — rejected as unnecessary duplication; a single optional field keeps one source of truth and needs no migration for the three existing ungated entries.

**Lib boundary — `libs/scheduled-tasks` exports one root component, `ScheduledTasks`.**
Props (all data/behavior injected, no host knowledge inside the lib):
```ts
interface ScheduledTasksTexts {
  title: string;
  subtitle: string;
  createButtonLabel: string;
  searchPlaceholder: string;
  sortLabel: string;
  sortOptions: { key: string; label: string }[];
  emptyStateLabel: string;
}
interface ScheduledTasksProps {
  texts: ScheduledTasksTexts;
  onCreateClick: () => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  sortKey: string;
  onSortChange: (key: string) => void;
  isLoading?: boolean; // default false; iteration 1 never sets true (no fetch)
}
```
The component always renders header + toolbar, then `PanelEmptyState` (from `@epam/ai-dial-chat-shared`) in the content region — it takes no `items` prop yet, since there is nothing to branch on. Adding an `items`/render-cards path is deferred to the follow-up change that introduces the data contract, to avoid speculative API shape in a UI-only slice. Alternative considered: accepting `items: never[]` now to "future-proof" the prop surface — rejected per repo guidance against building for hypothetical future requirements.

**App adapter — `ScheduledTasksPage` owns i18n, flag redirect, and local UI state (search/sort selection); no `ScheduledTasksView` wrapper.**
Unlike Catalog (which needs a `CatalogView` wrapper because `CatalogView` also maps large DTO graphs), this lib takes only strings and two pieces of local state — the page component wires `useTranslation` + local `useState` for `searchQuery`/`sortKey` directly and passes them down. Reduces indirection for a UI-only shell; a wrapper can be introduced later if the page component grows once data wiring lands.

**Feature flag key and roles — `features.scheduledTasksEnabled`, optional `SCHEDULED_TASKS_ENABLED_ROLES`.**
Mirrors `features.liveChatInteraction`: `type: 'feature'`, `valueType: 'boolean'`, `visibility: 'client'`, `defaultValue: false`, `envVar: 'SCHEDULED_TASKS_ENABLED'`, `allowedRolesEnvVar: 'SCHEDULED_TASKS_ENABLED_ROLES'`. Consumed via `useFeatureFlag('scheduledTasksEnabled')` (short key, matching existing call-site convention which strips the `features.` prefix).

## Risks / Trade-offs

- [Risk] Shipping toolbar controls (search/sort) that do nothing yet could read as broken to an early/internal audience testing behind the flag. → Mitigation: flag defaults off, restricted to specific roles via `SCHEDULED_TASKS_ENABLED_ROLES` for staged internal validation; empty state copy should be reviewed with product to set expectations (e.g. "No scheduled tasks yet").
- [Risk] Introducing the first `featureFlag`-gated `NavigationItem` sets a pattern other teams may copy inconsistently. → Mitigation: keep the field optional and the filter logic centralized in one place (`Navigation.tsx`), documented via this design so future flag-gated nav items follow the same shape.
- [Risk] `NotFound`-on-disabled-flag means a bookmarked link stops resolving once the flag state changes in either direction, with no explicit user messaging about *why*. → Mitigation: acceptable for an unreleased-feature gate (matches how a route that doesn't exist yet behaves); revisit only if product asks for a "coming soon" message instead.

## Migration Plan

- Additive only: new lib, new route, new nav entry (hidden by default), new flag (default `false`), new i18n keys. No existing route, component, or endpoint is modified beyond `Navigation.tsx`'s filter logic and `NAVIGATION_CONFIG`'s type.
- Rollback: revert the single commit/PR — removes the route, nav entry, lib package, and registry/enum entries. No data migration, no persisted state to clean up.
- Rollout: ship with flag `false` in all environments; enable per-role via `SCHEDULED_TASKS_ENABLED_ROLES` for internal validation before wider default-on consideration (a future, separate decision).

## Open Questions

- Final empty-state copy and icon (product/design to confirm) — placeholder English copy will ship in `en.json` and can be updated without a code change.
- Whether the "New task" click should show a toast/notification ("Coming soon") or be a true no-op — defaulting to a true no-op per proposal; can be revisited if product wants interim feedback.
