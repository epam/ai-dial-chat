# usage-data-hook Specification

## Purpose

Defines the `Usage` tab (page header plus up to three aggregate cost-limit cards) and the
`useUsageData` hook: fetching the current user's usage from the existing BFF `GET
/api/v1/user/usage` endpoint via the existing `server-api` wrapper, exposing per-request
loading/error state, a deduplicated error notification, and the library-isolation contract that
keeps presentational card rendering in `libs/usage-dashboard` while all data-fetching and DTO
interpretation stays in `apps/chat`.

## Requirements

### Requirement: Usage tab renders the aggregate limit cards
The system SHALL provide a `Usage` tab/page component, registered as the sole entry in the
`SettingsTabs` config, that renders a page header (title and one-line description) followed by up
to three aggregate cost-limit cards — Today (`dayCostStats`), This week (`weekCostStats`), This
month (`monthCostStats`) — via the `@epam/ai-dial-usage-dashboard` library's
`UsageLimitCardGroup`'s `cards` prop, mapped from `useUsageData`'s result through the app-level
mapper `apps/chat/src/utils/map-usage-data-to-dashboard.ts` in that fixed order. The header SHALL
render unconditionally, independent of `isLoading`. Its title SHALL be an `<h2>` — `SettingsPage`
(`apps/chat/src/pages/SettingsPage/SettingsPage.tsx`) already renders the page's sole `<h1>` — with
both title and description text sourced from localized `UsageI18nKeys` entries, never hardcoded.
While `isLoading` is `true`, the cards region SHALL render a loading state (no stale/zeroed card
data). The container SHALL include an `aria-live="polite"` region (visually hidden unless
announcing) used to announce loading completion and error notifications (see "Deduplicated error
notifications on fetch failure" below).

#### Scenario: Usage tab renders the page header
- **WHEN** the Settings page is opened and the `Usage` tab is active, regardless of loading state
- **THEN** the tab renders a localized `<h2>` title and a localized one-line description above the
  cards region

#### Scenario: Usage tab renders all three cards
- **WHEN** the Settings page is opened, the `Usage` tab is active, and `getUserUsage()` resolves
  with usable `dayCostStats`/`weekCostStats`/`monthCostStats`
- **THEN** the tab renders `UsageLimitCardGroup` with a `cards` array of three entries, in
  Today/This week/This month order

#### Scenario: Usage tab shows a loading state before data arrives
- **WHEN** the Settings page is opened and the `Usage` tab becomes active
- **THEN** the page header renders immediately and the cards region renders a loading state until
  `useUsageData`'s `isLoading` becomes `false`

---

### Requirement: useUsageData hook fetches the usage endpoint on mount
The system SHALL provide a `useUsageData` hook in
`libs/chat-hooks/src/usage/useUsageData/useUsageData.ts` (exported from `@epam/ai-dial-chat-hooks`)
that, on mount, calls the caller-supplied `getUserUsage()` function using a `useEffect` with a
`cancelled` flag to avoid `setState` after unmount. The hook accepts `getUserUsage: () =>
Promise<UserLimitStatsResponseDto>` as its first parameter so the lib stays host-agnostic; the app
passes `getUserUsage` from `apps/chat/src/server-api/user-limits.ts` (which wraps
`UserApi.getUserUsage` from `@epam/ai-dial-chat-api-client`, calling `GET /api/v1/user/usage`).

**Correction (supersedes the original design):** the hook previously also called `getUserLimits()`
(`GET /api/v1/user/limits`) via `Promise.allSettled`, reasoning that only that endpoint guarantees
every accessible deployment (including zero-usage ones) and that its top-level cost fields are the
authoritative global budget. Confirmed against real production payloads, `GET /api/v1/user/usage`'s
top-level `dayCostStats`/`weekCostStats`/`monthCostStats` already carry that same real global
budget (identical field names and semantics per the `user-usage-limits-api` capability), so the
`limits` fetch added no data this page actually needs and is removed. `apps/chat/src/server-api/user-limits.ts`'s
`getUserLimits()` wrapper itself is unchanged and MAY still be unused, per its own capability's
"wrapper functions MAY be unused" allowance — this hook simply no longer calls it.

The hook SHALL accept an `enabled: boolean` second parameter, defaulting to `true`, following the
`useScheduledTasks(enabled)` pattern. When `enabled` is `false`, the effect SHALL NOT call
`getUserUsage()`, and `isLoading` SHALL initialize to `false` (not the perpetual-loading state a
disabled hook would otherwise report). The Usage tab component SHALL call
`useUsageData(getUserUsage, useFeatureFlag('settingsPageEnabled'))` (or receive the resolved flag
value as a prop from `SettingsPage`), so the fetch only runs when `SettingsPageEnabled` is `true`.

The hook SHALL return:

```ts
interface UseUsageDataResult {
  usage: UserLimitStatsResponseDto | undefined;
  isLoading: boolean;
  usageError: Error | undefined;
}
```

`usage` is typed `UserLimitStatsResponseDto` (generated model, unchanged from PR #8365:
`deployments: Record<string, DeploymentLimitsResponseDto>` plus aggregate `LimitStatsDto` fields
such as `hourRequestStats`, `dayRequestStats`, `minuteTokenStats`, `dayTokenStats`,
`weekTokenStats`, `dayCostStats`, `monthCostStats`, each `{ total: number; used: number }`).
`usageError` reflects the `getUserUsage()` promise's rejection, if any.

#### Scenario: Fetch succeeds
- **WHEN** `useUsageData` is invoked and `GET /api/v1/user/usage` resolves successfully
- **THEN** the hook returns `isLoading: false`, `usageError: undefined`, and `usage` populated with
  the response body

#### Scenario: Fetch fails
- **WHEN** `GET /api/v1/user/usage` rejects
- **THEN** the hook returns `isLoading: false`, `usage: undefined`, and `usageError` set to a
  non-undefined `Error`

#### Scenario: Unmount before fetch resolves
- **WHEN** the component calling `useUsageData` unmounts before the fetch resolves
- **THEN** the hook does not call `setState` after unmount (no React warning), via its internal
  `cancelled` flag

#### Scenario: Consumer triggers the hook only when the Usage tab is active
- **WHEN** the Settings page renders with the `Usage` tab active
- **THEN** `useUsageData` is invoked by the `Usage` tab component (not by `SettingsPage` itself),
  so the endpoint is only called while a user is actually viewing the Usage tab

#### Scenario: Fetch does not run when the feature flag is disabled
- **WHEN** `SettingsPageEnabled` resolves to `false` and `useUsageData(getUserUsage, false)` is
  invoked (directly, or because the Usage tab was somehow rendered while the flag is off)
- **THEN** `GET /api/v1/user/usage` is not called, and the hook returns `isLoading: false`,
  `usage: undefined`, `usageError: undefined`

#### Scenario: Fetch resumes when the feature flag becomes enabled
- **WHEN** `useUsageData`'s `enabled` argument transitions from `false` to `true` between renders
- **THEN** the hook's effect runs and calls `getUserUsage()`, matching the behavior of
  `useUsageData(getUserUsage, true)` on initial mount

---

### Requirement: Library isolation between apps/chat and libs
`useUsageData` SHALL live in `libs/chat-hooks` and SHALL NOT import `apps/chat/src/server-api/*`,
any app context, routing, auth/session/cookies, environment variables, feature flags, or
`react-i18next`. It accepts `getUserUsage: () => Promise<UserLimitStatsResponseDto>` as a parameter
so all DIAL Core wiring stays in the app. The app passes `getUserUsage` from
`apps/chat/src/server-api/user-limits.ts` and the generated `UserLimitStatsResponseDto` type from
`@epam/ai-dial-chat-api-client` without modification.

All DTO interpretation — the unlimited-sentinel check (`total >= 2**53`), status-threshold
derivation, and currency formatting — lives in `libs/usage-dashboard`'s transform utilities (see
the `usage-dashboard-lib` capability). The `Usage` tab component imports those utilities from
`@epam/ai-dial-usage-dashboard` and passes app-owned callbacks (`resolveCatalogIconUrl`,
`resolveLocalizedText`) to keep host-specific URL construction and locale resolution out of the lib.

The presentational rendering of the cards SHALL live in the hand-authored `libs/usage-dashboard`
package (see the `usage-dashboard-lib` capability), which SHALL NOT import any `server-api/*`
wrapper or app context/hook/feature-flag/env/routing/storage/analytics module.

#### Scenario: Static analysis passes module boundary lint
- **WHEN** `npm exec nx lint chat`, `npm exec nx lint chat-hooks`, and `npm exec nx lint usage-dashboard` run after this change
- **THEN** `@nx/enforce-module-boundaries` reports no violations introduced by `useUsageData`, the
  `Usage` tab component, or the transform utilities in `libs/usage-dashboard`

---

### Requirement: Deduplicated error notification on fetch failure
The system SHALL show a user-visible, localized error notification via the existing
`useNotification()` / `showErrorNotification` mechanism whenever `useUsageData`'s `usageError`
transitions from `undefined` to a defined `Error` for a given fetch cycle. Exactly one notification
SHALL be shown per fetch cycle. The notification SHALL NOT include the raw `Error.message` or any
other upstream response detail. The notification effect SHALL be keyed on the `usageError` value so
it does not re-fire on renders that do not change its identity.

**Correction (supersedes the original design):** with a single fetch, the previous
partial-vs-full-failure distinction (two endpoints, two possible error combinations) no longer
applies — there is exactly one failure mode. The `UsageI18nKeys.PartialLoadError` string this
distinction used is removed; only `UsageI18nKeys.FullLoadError` remains.

#### Scenario: Fetch fails
- **WHEN** `usageError` becomes defined
- **THEN** exactly one localized failure notification is shown, and the Usage tab renders its empty
  states (no stale/zeroed cards or model-limits table)

#### Scenario: No notification on success
- **WHEN** `getUserUsage()` resolves successfully
- **THEN** no error notification is shown

#### Scenario: Notification does not repeat on unrelated re-renders
- **WHEN** the Usage tab re-renders for a reason unrelated to `usageError` (e.g. a parent state
  update) after a notification has already been shown for the current fetch cycle
- **THEN** no additional notification is shown for the same error

#### Scenario: Notification text excludes raw error detail
- **WHEN** the failure notification is shown
- **THEN** its message is the localized `UsageI18nKeys.FullLoadError` string, and does not contain
  the underlying `Error.message` value
