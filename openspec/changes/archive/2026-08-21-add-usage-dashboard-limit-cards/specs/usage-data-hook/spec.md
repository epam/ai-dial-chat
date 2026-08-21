## MODIFIED Requirements

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
- **WHEN** the Settings page is opened, the `Usage` tab is active, and both `getUserLimits()` and
  `getUserUsage()` resolve with usable `dayCostStats`/`weekCostStats`/`monthCostStats`
- **THEN** the tab renders `UsageLimitCardGroup` with a `cards` array of three entries, in
  Today/This week/This month order

#### Scenario: Usage tab shows a loading state before data arrives
- **WHEN** the Settings page is opened and the `Usage` tab becomes active
- **THEN** the page header renders immediately and the cards region renders a loading state until
  `useUsageData`'s `isLoading` becomes `false`

---

### Requirement: useUsageData hook fetches both endpoints on mount
The system SHALL provide a `useUsageData` hook in `apps/chat/src/hooks/useUsageData.ts` that, on
mount, calls `getUserLimits()` and `getUserUsage()` (`apps/chat/src/server-api/user-limits.ts`,
wrapping `UserApi.getUserLimits` / `UserApi.getUserUsage` from `@epam/ai-dial-chat-api-client`,
which call `GET /api/v1/user/limits` and `GET /api/v1/user/usage` respectively) via
`Promise.allSettled`, using a `useEffect` with a `cancelled` flag to avoid `setState` after unmount.

The hook SHALL accept an `enabled: boolean` parameter, defaulting to `true`, following the
`useScheduledTasks(enabled)` pattern. When `enabled` is `false`, the effect SHALL NOT call
`getUserLimits()` or `getUserUsage()`, and `isLoading` SHALL initialize to `false` (not the
perpetual-loading state a disabled hook would otherwise report). The Usage tab component SHALL
call `useUsageData(useFeatureFlag('settingsPageEnabled'))` (or receive the resolved flag value as
a prop from `SettingsPage`), so the fetch only runs when `SettingsPageEnabled` is `true`.

The hook SHALL return:

```ts
interface UseUsageDataResult {
  limits: UserLimitStatsResponseDto | undefined;
  usage: UserLimitStatsResponseDto | undefined;
  isLoading: boolean;
  limitsError: Error | undefined;
  usageError: Error | undefined;
}
```

`limits` and `usage` are both typed `UserLimitStatsResponseDto` (generated model, unchanged from PR
#8365: `deployments: Record<string, DeploymentLimitsResponseDto>` plus aggregate `LimitStatsDto`
fields such as `hourRequestStats`, `dayRequestStats`, `minuteTokenStats`, `dayTokenStats`,
`weekTokenStats`, `dayCostStats`, `monthCostStats`, each `{ total: number; used: number }`).
`limitsError` and `usageError` are set independently: `limitsError` reflects only the
`getUserLimits()` promise's rejection (if any), `usageError` reflects only `getUserUsage()`'s. The
previous single shared `error: Error | undefined` field is removed.

#### Scenario: Both endpoints succeed
- **WHEN** `useUsageData` is invoked and both `GET /api/v1/user/limits` and `GET /api/v1/user/usage`
  resolve successfully
- **THEN** the hook returns `isLoading: false`, `limitsError: undefined`, `usageError: undefined`,
  and both `limits` and `usage` populated with the respective response bodies

#### Scenario: Only the limits endpoint fails
- **WHEN** `GET /api/v1/user/limits` rejects but `GET /api/v1/user/usage` resolves
- **THEN** the hook returns `isLoading: false`, `limits: undefined`, `usage` populated,
  `limitsError` set to a non-undefined `Error`, and `usageError: undefined`

#### Scenario: Only the usage endpoint fails
- **WHEN** `GET /api/v1/user/usage` rejects but `GET /api/v1/user/limits` resolves
- **THEN** the hook returns `isLoading: false`, `limits` populated, `usage: undefined`,
  `usageError` set to a non-undefined `Error`, and `limitsError: undefined`

#### Scenario: Both endpoints fail
- **WHEN** both `GET /api/v1/user/limits` and `GET /api/v1/user/usage` reject
- **THEN** the hook returns `isLoading: false`, `limits: undefined`, `usage: undefined`, and both
  `limitsError` and `usageError` set to non-undefined `Error` values

#### Scenario: Unmount before fetch resolves
- **WHEN** the component calling `useUsageData` unmounts before both `Promise.allSettled` calls
  resolve
- **THEN** the hook does not call `setState` after unmount (no React warning), via its internal
  `cancelled` flag

#### Scenario: Consumer triggers the hook only when the Usage tab is active
- **WHEN** the Settings page renders with the `Usage` tab active
- **THEN** `useUsageData` is invoked by the `Usage` tab component (not by `SettingsPage` itself),
  so the endpoints are only called while a user is actually viewing the Usage tab

#### Scenario: Fetch does not run when the feature flag is disabled
- **WHEN** `SettingsPageEnabled` resolves to `false` and `useUsageData(false)` is invoked (directly,
  or because the Usage tab was somehow rendered while the flag is off)
- **THEN** neither `GET /api/v1/user/limits` nor `GET /api/v1/user/usage` is called, and the hook
  returns `isLoading: false`, `limits: undefined`, `usage: undefined`, `limitsError: undefined`,
  `usageError: undefined`

#### Scenario: Fetch resumes when the feature flag becomes enabled
- **WHEN** `useUsageData`'s `enabled` argument transitions from `false` to `true` between renders
- **THEN** the hook's effect runs and calls `getUserLimits()` / `getUserUsage()`, matching the
  behavior of `useUsageData(true)` on initial mount

---

### Requirement: Library isolation between apps/chat and libs/usage-dashboard
The system SHALL keep `useUsageData`, the `Usage` tab component, and the app-level mapper
(`apps/chat/src/utils/map-usage-data-to-dashboard.ts`) under `apps/chat/src/`, reusing the existing `apps/chat/src/server-api/user-limits.ts` wrappers and the generated
`UserLimitStatsResponseDto` type from `@epam/ai-dial-chat-api-client` without modification. All DTO
interpretation — the unlimited-sentinel check (`total >= 2**53`), status-threshold derivation,
currency formatting, and the `limits ?? usage` per-field fallback for the shared global cost
stats — SHALL happen in the app-level mapper, not in `libs/usage-dashboard`.

The presentational rendering of the two aggregate cards SHALL live in the hand-authored
`libs/usage-dashboard` package (see the `usage-dashboard-lib` capability), which SHALL NOT import
the generated API client or any `server-api/*` wrapper, per the repository's library isolation
rule. This supersedes the previous rule that no `libs/*` package would be created for this data —
that constraint applied to the data-fetching/interpretation concern, which still lives entirely in
`apps/chat`.

#### Scenario: Static analysis passes module boundary lint
- **WHEN** `npm exec nx lint chat` and `npm exec nx lint usage-dashboard` run after this change
- **THEN** `@nx/enforce-module-boundaries` reports no violations introduced by `useUsageData`, the
  `Usage` tab component, the mapper, or `libs/usage-dashboard`

## ADDED Requirements

### Requirement: Deduplicated error notifications on fetch failure
The system SHALL show a user-visible, localized error notification via the existing
`useNotification()` / `showErrorNotification` mechanism whenever `useUsageData`'s
`limitsError`/`usageError` transition from `undefined` to a defined `Error` for a given fetch
cycle. Exactly one notification SHALL be shown per fetch cycle: a partial-failure message when
exactly one of the two errors is set (data from the successful call SHALL still be rendered), or a
single consolidated full-failure message when both are set. The notification SHALL NOT include the
raw `Error.message` or any other upstream response detail. The notification effect SHALL be keyed
on the `limitsError`/`usageError` values so it does not re-fire on renders that do not change
either error's identity.

#### Scenario: One endpoint fails
- **WHEN** `limitsError` becomes defined while `usageError` remains `undefined` (or vice versa)
- **THEN** exactly one localized partial-failure notification is shown, and the Usage tab still
  renders whichever card(s) the successful response's data supports

#### Scenario: Both endpoints fail
- **WHEN** both `limitsError` and `usageError` become defined in the same fetch cycle
- **THEN** exactly one localized, consolidated failure notification is shown (not two)

#### Scenario: No notification on success
- **WHEN** both `getUserLimits()` and `getUserUsage()` resolve successfully
- **THEN** no error notification is shown

#### Scenario: Notification does not repeat on unrelated re-renders
- **WHEN** the Usage tab re-renders for a reason unrelated to `limitsError`/`usageError` (e.g. a
  parent state update) after a notification has already been shown for the current fetch cycle
- **THEN** no additional notification is shown for the same errors

#### Scenario: Notification text excludes raw error detail
- **WHEN** either failure notification is shown
- **THEN** its message is one of the new localized `UsageI18nKeys` strings, and does not contain
  the underlying `Error.message` value
