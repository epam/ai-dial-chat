## MODIFIED Requirements

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

#### Scenario: Fetch does not run when the feature flag is disabled
- **WHEN** `SettingsPageEnabled` resolves to `false` and `useUsageData(getUserUsage, false)` is
  invoked (directly, or because the Usage tab was somehow rendered while the flag is off)
- **THEN** `GET /api/v1/user/usage` is not called, and the hook returns `isLoading: false`,
  `usage: undefined`, `usageError: undefined`

#### Scenario: Fetch resumes when the feature flag becomes enabled
- **WHEN** `useUsageData`'s `enabled` argument transitions from `false` to `true` between renders
- **THEN** the hook's effect runs and calls `getUserUsage()`, matching the behavior of
  `useUsageData(getUserUsage, true)` on initial mount
