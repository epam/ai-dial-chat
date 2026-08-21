## MODIFIED Requirements

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
  error: Error | undefined;
}
```

`limits` and `usage` are both typed `UserLimitStatsResponseDto` (generated model, unchanged from PR
#8365: `deployments: Record<string, DeploymentLimitsResponseDto>` plus aggregate `LimitStatsDto`
fields such as `hourRequestStats`, `dayRequestStats`, `minuteTokenStats`, `dayTokenStats`,
`weekTokenStats`, each `{ total: number; used: number }`).

#### Scenario: Both endpoints succeed
- **WHEN** `useUsageData` is invoked and both `GET /api/v1/user/limits` and `GET /api/v1/user/usage`
  resolve successfully
- **THEN** the hook returns `isLoading: false`, `error: undefined`, and both `limits` and `usage`
  populated with the respective response bodies

#### Scenario: One endpoint fails
- **WHEN** `GET /api/v1/user/limits` resolves but `GET /api/v1/user/usage` rejects (e.g. network error
  or non-2xx response)
- **THEN** the hook returns `isLoading: false`, `limits` populated, `usage: undefined`, and `error`
  set to a non-undefined `Error` describing the failed call, so the caller can still use the
  successful half of the data

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
  returns `isLoading: false`, `limits: undefined`, `usage: undefined`, `error: undefined`

#### Scenario: Fetch resumes when the feature flag becomes enabled
- **WHEN** `useUsageData`'s `enabled` argument transitions from `false` to `true` between renders
- **THEN** the hook's effect runs and calls `getUserLimits()` / `getUserUsage()`, matching the
  behavior of `useUsageData(true)` on initial mount
