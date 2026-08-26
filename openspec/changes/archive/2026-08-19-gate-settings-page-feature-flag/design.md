## Context

The Settings page and Usage tab (`settings-usage-page`, `settings-sidebar-panel`) are landing
unconditionally: the gear icon always renders in `UserMenu`, `/settings` is always routable, and
`useUsageData` always fires on mount. This mirrors exactly the situation `ScheduledTasksEnabled`
solved for the Scheduled Tasks feature — a backend-configured `FeatureKey` consumed client-side via
`useFeatureFlag`, gating a nav entry, a route, and a data-fetching hook. This design reuses that
same three-part mechanism rather than inventing a new one.

Two consumption paths exist for feature flags in `app.tsx` today: `useFeatureFlag` (backed by
`FeatureKey`/`AppConfigContext`, used by `ScheduledTasksEnabled`) and `useUiFeature`
(`OverlayFeature`, used by `FileManager`). `OverlayFeature` is an overlay-host-driven UI toggle
mechanism (`UiFeaturesContext`), not an operator/env-driven backend flag — it's the wrong
mechanism for a flag that needs `SETTINGS_PAGE_ENABLED` per-environment config, even though its
route-gating *shape* (`<Navigate to={ROUTES.Root} replace />`) is the one to copy.

## Goals / Non-Goals

**Goals:**
- Hide the Settings entry point and make `/settings` unreachable, and stop the usage-data fetch,
  whenever `SettingsPageEnabled` resolves to `false` (its default).
- Reuse the exact `FeatureKey` + `useFeatureFlag` + registry pattern already validated for
  `ScheduledTasksEnabled`, so this change adds no new gating concept to learn or maintain.
- Keep the flag configurable per environment via an env var, consistent with every other feature
  in `CONFIG_DEFINITIONS`.

**Non-Goals:**
- No change to the Settings/Usage page content, tab structure, or `settings-panel-lib`.
- No role-based restriction is required by the acceptance criteria, but the registry entry still
  gets an optional `allowedRolesEnvVar` for consistency with sibling entries (`ScheduledTasksEnabled`,
  `LiveChatInteraction`) — it can be left unset in every environment with no behavior change.
- No new backend endpoint or DTO — `features` on the client-config response already accepts
  arbitrary keys.

## Decisions

**1. Flag key and shape** — Add `SettingsPageEnabled = 'features.settingsPageEnabled'` to
`FeatureKey` (`apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`) and a matching
entry in `CONFIG_DEFINITIONS`
(`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`), copied from the
`scheduledTasksEnabled` entry:
```ts
{
  key: 'features.settingsPageEnabled',
  type: 'feature',
  valueType: 'boolean',
  visibility: 'client',
  defaultValue: false,
  critical: false,
  description:
    'Whether the Settings page is enabled, including its gear-icon entry point in the ' +
    'user menu, the /settings route, and the Usage tab data fetch. Set ' +
    'SETTINGS_PAGE_ENABLED_ROLES to restrict to specific roles.',
  owner: 'chat-team',
  envVar: 'SETTINGS_PAGE_ENABLED',
  allowedRolesEnvVar: 'SETTINGS_PAGE_ENABLED_ROLES',
}
```
Alternative considered: a `config`-type JSON list (like `FILE_MANAGER_AVAILABLE_TABS`) — rejected,
this is a plain on/off gate, not a set of sub-options.

**2. UI entry point** — In `UserMenu.tsx`, read `const isSettingsPageEnabled =
useFeatureFlag('settingsPageEnabled');` and wrap the existing `settings` menu item in the same
conditional-array-spread style already used above it in the file (`...(isSettingsPageEnabled ? [{
key: 'settings', ... }] : [])`), rather than an inline ternary on the item itself, to match the
surrounding array-building convention in that file.

**3. Route guard** — In `app.tsx`, read the flag once (`const isSettingsPageEnabled =
useFeatureFlag('settingsPageEnabled');`) alongside the existing `isFileManagerEnabled` read, and
apply the same ternary the `FileManager` route uses:
```tsx
<Route
  path={ROUTES.Settings}
  element={
    isSettingsPageEnabled ? (
      <RouteErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <SettingsPage />
        </Suspense>
      </RouteErrorBoundary>
    ) : (
      <Navigate to={ROUTES.Root} replace />
    )
  }
/>
```
Alternative considered: a page-level guard inside `SettingsPage` returning `NotFoundPage` (the
`ScheduledTasksPage` pattern) — rejected because the proposal's acceptance criteria explicitly ask
for "redirect to a safe default page", which the `app.tsx`-level `Navigate` ternary satisfies
directly, and it also prevents the lazy chunk for `SettingsPage` from ever mounting when disabled.

**4. Hook gating** — Add an `enabled = true` parameter to `useUsageData`, mirroring
`useScheduledTasks(enabled = true)`: the effect body's `fetchUsageData()` call becomes conditional
on `enabled`, and `isLoading`'s initial state becomes `useState(enabled)` so a disabled hook doesn't
report a perpetual loading state. The call site (`UsageTab`/`SettingsPage`) passes
`useFeatureFlag('settingsPageEnabled')` through. Because the route is already unreachable when the
flag is off, this is defense-in-depth (covers a future direct-render/test scenario) rather than the
only guard — but the acceptance criteria call it out explicitly as its own checkable condition, so
it's implemented as a first-class `enabled` param rather than relying solely on the route guard.

## Risks / Trade-offs

- **Flag key drift between enum and registry** → `feature-flags-service`'s existing "FeatureKey
  values match registry keys" scenario already asserts this at the spec level; adding the new key
  to both files in the same commit keeps that scenario green.
- **Two pending, unarchived changes (`settings-usage-page`, `settings-sidebar-panel`) own the files
  this change edits** → if their tasks are still in flight when this change is applied, merge the
  gating directly into their code rather than waiting; there is no ordering dependency at the spec
  level since this change's deltas only add requirements on top of the existing `settings-page-shell`
  / `usage-data-hook` capabilities.
- **`useUsageData(enabled)` guard duplicates the route guard** → acceptable; it's a two-line change
  matching an established pattern (`useScheduledTasks`), and it protects the "no requests fire"
  acceptance criterion independently of routing.

## Migration Plan

- `SETTINGS_PAGE_ENABLED` defaults unset → `defaultValue: false`, so no environment needs a config
  change to keep current (already-effectively-hidden) behavior; enabling it in an environment is an
  env-var flip with no code deploy.
- Rollback: revert the code changes, or simply leave `SETTINGS_PAGE_ENABLED` unset/`false` — no
  data migration involved.
