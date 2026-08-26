## Context

`apps/chat` has no top-level Settings surface today. The only "settings-like" UI is the `UserMenu`
dropdown (`apps/chat/src/components/Navigation/UserMenu.tsx:12-18`), which owns theme/language/keyboard
shortcuts under its own `settings` i18n namespace. PR #8365 shipped two backend endpoints
(`GET /api/v1/user/limits`, `GET /api/v1/user/usage`) and already generated/wrapped them
(`UserApi` in `libs/chat-api-client`, `apps/chat/src/server-api/user-limits.ts`), but no frontend
consumer exists. This change adds the page shell and data hook only; the visual Usage UI is a
follow-up. The closest structural precedents are `DialFileManagerPage` (tab container over an enum +
config hook) and `ScheduledTasksPage`/`ScheduledTasksRouteGate` (lazy route + route-gate wrapper).

## Goals / Non-Goals

**Goals:**
- One `/settings` route reachable from a gear icon, rendering a tab container that today shows only
  a `Usage` tab.
- Adding a second Settings tab later requires only a new enum member + config entry, not a route or
  layout refactor.
- `useUsageData` fetches both endpoints on mount, in parallel, and exposes typed loading/error/data
  state ready for a future UI to consume.
- Zero behavior change to any existing endpoint, context, or component.

**Non-Goals:**
- Any visual design/content for the Usage tab (empty container only).
- Caching, polling, or refetch-on-focus behavior for usage data (single fetch on mount is sufficient
  for this slice).
- A generic "Settings framework" (feature flags per tab, permissions per tab) — only the minimal
  structure the acceptance criteria require.

## Decisions

### 1. Tab container pattern: mirror `DialFileManagerTabs`, not a new abstraction
Follow `apps/chat/src/pages/DialFileManagerPage/DialFileManagerPage.tsx:2-54`: a `SettingsTabs` string
enum (`{ Usage = 'usage' }`) plus a small `useSettingsTabConfig` hook returning
`{ id, labelKey, Component }[]`. `SettingsPage` renders the active tab's `Component` based on a route
param or local state — reusing an existing, already-reviewed pattern instead of introducing a second
tab abstraction into the codebase.
*Alternative rejected*: a generic `@epam/ai-dial-ui-kit` `Tabs` wired ad hoc per page with no shared
config shape — would duplicate what `DialFileManagerPage` already solved and diverge in shape from it.

### 2. Route shape: `/settings` with `usage` as the default/only child, not `/settings/usage` initially
`ROUTES.SETTINGS = '/settings'` renders `SettingsPage`, which internally selects the `Usage` tab (no
tab param needed while there is exactly one tab). When a second tab is added, extend to
`/settings/:tab` with a route-level default redirect to `usage`, matching how `ScheduledTasksRouteGate`
(`app.tsx:397-404`) gates a parent route before rendering children — deferred until a second tab
actually exists, per the proposal's non-goal of not over-building.
*Alternative considered*: build `/settings/:tab` routing now. Rejected as premature — no second tab
exists yet, and the tab-config hook already isolates the future change to one file.

### 3. `useUsageData` is a plain hook in `apps/chat/src/hooks/`, not a Context
The task only requires data available to "the Usage page" (single consumer), so a Context
(`apps/chat/src/context/`) would add provider wiring with no current second consumer. Follows the
`useFavicon.ts` pattern: `useEffect` + `cancelled` flag, `async/await`, JSDoc explaining why a manual
cancelled-flag is used over `AbortController` (the generated client's `getUserLimits`/`getUserUsage`
don't accept a fetch `AbortSignal` through the `Raw`-less method surface used here).
*Alternative rejected*: a `UsageContext` modeled on `ThemeContext.tsx`. Rejected per YAGNI — promote to
Context only if a second consumer (e.g. a header usage indicator) appears later.

### 4. Two independent calls via `Promise.allSettled`, not a combined DTO
`getUserLimits()` and `getUserUsage()` (`apps/chat/src/server-api/user-limits.ts:1-8`) both return
`UserLimitStatsResponseDto` but are semantically distinct (limits vs. current usage). `useUsageData`
calls both with `Promise.allSettled` so one endpoint failing doesn't blank out data the other endpoint
successfully returned, and surfaces per-call error state:
```ts
interface UseUsageDataResult {
  limits: UserLimitStatsResponseDto | undefined;
  usage: UserLimitStatsResponseDto | undefined;
  isLoading: boolean;
  error: Error | undefined; // set if either call rejects
}
```
*Alternative rejected*: `Promise.all` — one rejection would discard the other successful response,
which is worse for a future partial-data UI.

### 5. Gear icon lives in `UserMenu`, no new global header icon
No gear/settings icon exists anywhere in the app shell (confirmed by search). Adding it as a new
top-level header icon would touch the shared header layout for a single destination. Instead, add a
"Settings" item to the existing `UserMenu` dropdown (already the natural home for
language/theme/shortcuts), using `IconSettings` from `@tabler/icons-react`, navigating to
`ROUTES.SETTINGS` via `useNavigate()`.
*Alternative considered*: new persistent header icon. Left as a follow-up if product wants Settings
one click closer — out of scope for this task's acceptance criteria ("a gear icon opens Settings",
which `UserMenu` already satisfies).

### 6. No new library code; existing app-layer wrappers are reused as-is
Per `AGENTS.md` §Library isolation, `libs/*` cannot import the generated client or `server-api/*`.
`getUserLimits`/`getUserUsage` and `UserLimitStatsResponseDto` already exist at the correct layer
(`apps/chat/src/server-api/`, `libs/chat-api-client`). No new lib is created; `useUsageData` and the
`SettingsPage`/`Usage` components stay under `apps/chat/src/`. This directly satisfies the task's
"library extraction" requirement by *not* violating the isolation boundary — extraction would be a
boundary violation here, not a best practice.

## Risks / Trade-offs

- **[Risk]** Adding a tab-config hook now that has exactly one entry could look like premature
  abstraction. → **Mitigation**: it's a direct copy of an already-accepted pattern
  (`DialFileManagerPage`) rather than a new abstraction invented for this change, and the acceptance
  criteria explicitly require future-tab extensibility.
- **[Risk]** `useUsageData` fetching on every `Usage` tab mount (no cache) could double-call the
  endpoints if the user switches tabs back and forth. → **Mitigation**: both endpoints are
  `@Throttle`d server-side at 60 req/min per PR #8365 and marked `Cache-Control: private, no-store`,
  so refetch-per-mount is the correct behavior, not a bug; revisit only if product asks for
  cross-mount caching.
- **[Risk]** i18n key collision if the new page reuses the existing `settings` namespace owned by
  `UserMenu`. → **Mitigation**: use a distinct `settingsPage` (or similarly scoped) namespace, called
  out explicitly in the proposal and tasks.

## Accessibility, i18n, RTL

- **i18n**: new keys under a `settingsPage` namespace (e.g. `settingsPage.title`,
  `settingsPage.tabs.usage`) plus an `IconSettings` `aria-label` (e.g. `userMenu.settings` reusing the
  existing `settings`-adjacent key style) added to all locale files, per repo i18n rules.
- **RTL**: the tab container and page shell use logical Tailwind utilities (`ps-*`/`pe-*`,
  `text-start`) exclusively; no physical `left-*`/`right-*` classes. `IconSettings` is a symmetric gear
  icon — no `rtl:scale-x-[-1]` mirroring needed.
- **A11y**: tab list uses `role="tablist"`/`role="tab"` with `aria-selected` per tab (or the
  `@epam/ai-dial-ui-kit` `Tabs` component if it already implements this — check via
  `searchEntity('component', 'Tabs')` before hand-rolling ARIA). The empty Usage container gets an
  `aria-live="polite"` region reserved for the future loading/error text, per `.claude/rules/a11y.md`
  dynamic-content guidance, even though this task renders no visible content yet.

## Migration Plan

Purely additive: new route, new nav entry, new hook, new i18n keys. No feature flag, no data
migration. Rollback = revert the commit(s); no persisted state to clean up.

## Open Questions

- Should `useUsageData` refetch on window focus / interval, or is fetch-once-per-mount acceptable
  until the real Usage UI defines its freshness needs? (Assumed: fetch-once, per Non-Goals.)
- Does the Figma spec (node 1106-189) show the gear icon in the header/toolbar rather than inside
  `UserMenu`? The Figma reference wasn't rendered as part of this research pass — confirm against the
  design during implementation; if the gear must be a standalone header icon, Decision 5 needs
  revisiting before coding.
