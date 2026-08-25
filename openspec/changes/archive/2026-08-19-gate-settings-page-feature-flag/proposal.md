## Why

`settings-usage-page` and `settings-sidebar-panel` added a `/settings` route, a gear-icon entry
point in `UserMenu`, and a `useUsageData` hook that calls the new `GET /api/v1/user/limits` and
`GET /api/v1/user/usage` endpoints — all unconditionally visible/active. The Settings page isn't
ready for a general rollout yet, so it needs to be hidden by default and toggled per environment,
following the same `FeatureKey`/`useFeatureFlag` mechanism already used for `ScheduledTasksEnabled`
(`scheduled-tasks-page-ui`) and `FileManager`.

## What Changes

- Add `SettingsPageEnabled` to the backend `FeatureKey` enum
  (`apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`) and register it in
  `CONFIG_DEFINITIONS` (`apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`)
  as `type: 'feature'`, `visibility: 'client'`, `defaultValue: false`, driven by a
  `SETTINGS_PAGE_ENABLED` env var — matching the `scheduledTasksEnabled` entry's shape so it is
  configurable per environment (dev/stage/prod) with no extra DTO work (`features` is already a
  generic `Record<string, boolean>`).
- Gate the gear-icon entry point in `UserMenu` (`apps/chat/src/components/Navigation/UserMenu.tsx`)
  behind `useFeatureFlag('settingsPageEnabled')`, following the existing conditional-array-spread
  style already used for other hidden menu items in that file.
- Gate the `/settings` route in `apps/chat/src/app/app.tsx`: when the flag is disabled, direct
  navigation to `ROUTES.Settings` redirects to `ROUTES.Root` (`<Navigate replace />`), matching the
  existing `FileManager` route-gating pattern in the same file.
- Gate `useUsageData` (`apps/chat/src/hooks/useUsageData.ts`) so its fetch effect does not run, and
  no request to `/api/v1/user/limits` / `/api/v1/user/usage` is made, when the feature flag is
  disabled — following the `useScheduledTasks(enabled)` pattern.

**Not breaking**: purely additive gating around already-unreleased UI; the feature defaults to
disabled so this only formalizes the "hidden by default" state the page should already be in.
Rollback is a revert; no persisted state or data migration involved.

## Capabilities

### New Capabilities

_None._ No new spec-level capability is introduced; this change adds feature-gating behavior to
capabilities that already exist as pending (unarchived) changes.

### Modified Capabilities

- `settings-page-shell` (pending, from `settings-usage-page`/`settings-sidebar-panel`): the gear
  icon and `/settings` route must only be reachable when `SettingsPageEnabled` is on; direct
  navigation while disabled redirects to the root route instead of rendering the page.
- `usage-data-hook` (pending, from `settings-usage-page`): `useUsageData` must not invoke its fetch
  effect (no calls to the limits/usage endpoints) while `SettingsPageEnabled` is disabled.

## Impact

- **New files**: none required; this change edits existing files from the two pending Settings
  changes plus the backend feature-flag registry.
- **Modified files**: `apps/chat-api/src/app-config/feature-flags/feature-key.enum.ts`,
  `apps/chat-api/src/app-config/config-registry/config-registry.constants.ts`,
  `apps/chat/src/components/Navigation/UserMenu.tsx`, `apps/chat/src/app/app.tsx`,
  `apps/chat/src/hooks/useUsageData.ts` (and its call site(s), e.g. `UsageTab`/`SettingsPage`), plus
  their existing test files.
- **No new backend endpoints or DTO changes** — the `features` map on the client-config response
  already accepts arbitrary boolean keys.
- **Dependency note**: this change assumes `settings-usage-page` (and, if merged first,
  `settings-sidebar-panel`) land first; it edits files those changes introduce. If they are not yet
  merged, this change's tasks apply on top of that in-progress work directly.
- **i18n**: none — no new user-visible strings.
