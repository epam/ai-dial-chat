# usage-data-hook Specification

## Purpose

Defines the `Usage` tab (page header plus up to three aggregate cost-limit cards) and the
`useUsageData` hook: fetching the current user's usage from the existing BFF `GET
/api/v1/user/usage` endpoint via the existing `server-api` wrapper, exposing per-request
loading/error state, a deduplicated error notification, and the library-isolation contract that
keeps presentational card rendering in `libs/usage-dashboard` while DTO interpretation lives in
`libs/chat-hooks` (data-fetching via `useUsageData` remains as described below).

## Requirements

### Requirement: Usage tab renders the aggregate limit cards
The system SHALL provide a `Usage` tab/page component, registered as the sole entry in the
`SettingsTabs` config, that renders a page header (title and one-line description) followed by up
to three aggregate cost-limit cards — Today (`dayCostStats`), This week (`weekCostStats`), This
month (`monthCostStats`) — via the `@epam/ai-dial-usage-dashboard` library's
`UsageLimitCardGroup`'s `cards` prop, mapped from `useUsageData`'s result through the
`@epam/ai-dial-chat-hooks` mapper `mapUsageDataToDashboard` in that fixed order. The header SHALL
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
disabled hook would otherwise report). The parameter stays because it is part of a host-agnostic
lib hook's contract, not because this app still needs it.

The Usage tab SHALL NOT read a feature flag: the `SettingsPageEnabled` flag is removed, so
`useFeatureFlag('settingsPageEnabled')` no longer exists and the tab cannot be reached while the
page is disabled — mounting the tab is itself the signal that the data is wanted.
`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` therefore imports no `useFeatureFlag` and
passes a literal `true` for `enabled` (positionally required only because it also passes
`refreshToken`, below).

The hook SHALL accept a `refreshToken: number` third parameter, defaulting to `0`. Changing it SHALL
re-run the fetch effect, subject to the same `enabled` gate and the same `cancelled` flag. The hook
SHALL NOT own a timer, read a clock, parse a timestamp, or know what a reset boundary is — the
caller decides when to change the token. While a token-triggered re-fetch is in flight the hook
SHALL retain the previously resolved `usage` value rather than clearing it, so the consumer can keep
rendering the last known figures; `isLoading` SHALL reflect the in-flight request so a consumer may
choose to suppress a full-page loading state for a refresh.

The hook SHALL return:

```ts
interface UseUsageDataResult {
  usage: UserLimitStatsResponseDto | undefined;
  isLoading: boolean;
  usageError: Error | undefined;
}
```

`usage` is typed `UserLimitStatsResponseDto` (generated model:
`deployments: Record<string, DeploymentLimitsResponseDto>` plus aggregate `LimitStatsDto` fields
such as `hourRequestStats`, `dayRequestStats`, `minuteTokenStats`, `dayTokenStats`,
`weekTokenStats`, `dayCostStats`, `monthCostStats`, each
`{ total: number; used: number; resetsAt?: string }`). `usageError` reflects the `getUserUsage()`
promise's rejection, if any.

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

#### Scenario: Changing the refresh token re-fetches
- **WHEN** `refreshToken` changes from `0` to `1` while `enabled` is `true`
- **THEN** `getUserUsage()` is called again and `usage` is replaced by the new response

#### Scenario: Refresh keeps the previous data on screen
- **WHEN** a token-triggered re-fetch is in flight
- **THEN** `usage` still holds the previously resolved response until the new one resolves

#### Scenario: Refresh token is ignored while disabled
- **WHEN** `enabled` is `false` and `refreshToken` changes
- **THEN** `getUserUsage()` is not called

#### Scenario: Hook owns no timer
- **WHEN** the hook's source is inspected
- **THEN** it contains no `setTimeout`, `setInterval`, `Date.now()`, or `resetsAt` reference

#### Scenario: Consumer triggers the hook only when the Usage tab is active
- **WHEN** the Settings page renders with the `Usage` tab active
- **THEN** `useUsageData` is invoked by the `Usage` tab component (not by `SettingsPage` itself),
  so the endpoint is only called while a user is actually viewing the Usage tab

#### Scenario: Arriving at the Settings page does not fetch usage
- **WHEN** a user opens `/settings`, where `Preferences` is the default tab
- **THEN** `UsageTab` does not mount and `GET /api/v1/user/usage` is not requested

#### Scenario: The Usage tab reads no feature flag
- **WHEN** the user activates the `Usage` row and the tab renders
- **THEN** it calls `useUsageData(getUserUsage, true, refreshToken)` without consulting any feature
  flag, and `GET /api/v1/user/usage` is requested

#### Scenario: An explicit disabled caller still suppresses the fetch
- **WHEN** any caller invokes `useUsageData(getUserUsage, false)`
- **THEN** `GET /api/v1/user/usage` is not called, and the hook returns `isLoading: false`,
  `usage: undefined`, `usageError: undefined` — the lib contract is unchanged even though this app
  no longer uses it

### Requirement: Library isolation between apps/chat and libs
`useUsageData` SHALL live in `libs/chat-hooks` and SHALL NOT import `apps/chat/src/server-api/*`,
any app context, routing, auth/session/cookies, environment variables, feature flags, or
`react-i18next`. It accepts `getUserUsage: () => Promise<UserLimitStatsResponseDto>` as a parameter
so all DIAL Core wiring stays in the app. The app passes `getUserUsage` from
`apps/chat/src/server-api/user-limits.ts` and the generated `UserLimitStatsResponseDto` type from
`@epam/ai-dial-chat-api-client` without modification. This hook's contract is unchanged by the
adapter relocation described below.

All DTO interpretation — generated field selection, the unlimited-sentinel check
(`total >= 2 ** 53`), status-threshold derivation, currency and compact-number formatting, the
`DeploymentItemDtoTypeEnum.Model` filter, and the deployment join — SHALL live in the adapters
`map-usage-data-to-dashboard.ts` and `map-user-usage-to-model-limits.ts` under
`libs/chat-hooks/src/usage/`, exported from `@epam/ai-dial-chat-hooks`'s `./usage` entry point — the
narrow, explicitly justified location recorded in AGENTS.md §Library isolation. It SHALL NOT live in
`libs/usage-dashboard` or any other hand-authored library outside that recorded exception. The
`Usage` tab component imports those adapters from `@epam/ai-dial-chat-hooks` and imports
`UsageLimitCardGroup` / `ModelLimitsSection` and their normalized display types from
`@epam/ai-dial-usage-dashboard`, passing app-owned callbacks (`resolveCatalogIconUrl`,
`resolveLocalizedText`, `formatUsageResetTime`) into the adapters so host-specific URL construction,
locale resolution, and date/time formatting stay at the application edge.

`libs/usage-dashboard` SHALL NOT declare or import `@epam/ai-dial-chat-api-client` in source, barrel,
`package.json`, `tsconfig.lib.json`, or `vite.config.mts`, and SHALL NOT import any `server-api/*`
wrapper or app context/hook/feature-flag/env/routing/storage/analytics module. It renders the
normalized cards, rows, and period statuses it is given (see the `usage-dashboard-lib` capability).

#### Scenario: Static analysis passes module boundary lint
- **WHEN** `npm exec nx lint chat`, `npm exec nx lint chat-hooks`, and `npm exec nx lint usage-dashboard` run
- **THEN** `@nx/enforce-module-boundaries` reports no violations introduced by `useUsageData`, the
  `Usage` tab component, or the usage adapters, and the project-scoped
  `no-restricted-imports` rule in `libs/usage-dashboard/eslint.config.mjs` reports no restricted
  generated-client import

#### Scenario: Usage adapters live inside their recorded exception
- **WHEN** the repository is searched for the usage DTO mappers
- **THEN** they exist only under `libs/chat-hooks/src/usage/`, and no hand-authored library outside
  `libs/chat-hooks` and `libs/chat-api-client` exports a function taking
  `UserLimitStatsResponseDto`, `DeploymentLimitsResponseDto`, `LimitStatsDto`, or
  `DeploymentItemDto`

#### Scenario: useUsageData behaviour is unaffected by the relocation
- **WHEN** the Usage tab mounts, refetches on a `refreshToken` bump, and unmounts
- **THEN** the hook's fetch lifecycle, stale-request handling, `isLoading`/`usageError` outputs, and
  subscription lifetimes are the same as before the adapters moved, with no fetch added or removed

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
