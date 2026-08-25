## ADDED Requirements

### Requirement: Empty Usage tab container
The system SHALL provide a `Usage` tab/page component, registered as the sole entry in the
`SettingsTabs` config, that renders an empty container element (no visible usage data or
placeholder copy) for this change. The container SHALL include an `aria-live="polite"` region
(visually hidden) reserved for future loading/error announcements.

#### Scenario: Usage tab renders empty
- **WHEN** the Settings page is opened and the `Usage` tab is active
- **THEN** the tab renders its container element with no visible usage content

### Requirement: useUsageData hook fetches both endpoints on mount
The system SHALL provide a `useUsageData` hook in `apps/chat/src/hooks/useUsageData.ts` that, on
mount, calls `getUserLimits()` and `getUserUsage()` (`apps/chat/src/server-api/user-limits.ts`,
wrapping `UserApi.getUserLimits` / `UserApi.getUserUsage` from `@epam/ai-dial-chat-api-client`,
which call `GET /api/v1/user/limits` and `GET /api/v1/user/usage` respectively) via
`Promise.allSettled`, using a `useEffect` with a `cancelled` flag to avoid `setState` after unmount.
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

### Requirement: No new library or client duplication
`useUsageData` and the `Usage` tab component SHALL live under `apps/chat/src/` (hooks and
pages/components respectively) and SHALL reuse the existing `apps/chat/src/server-api/user-limits.ts`
wrappers and the generated `UserLimitStatsResponseDto` type from `@epam/ai-dial-chat-api-client`
without modification. No new `libs/*` package SHALL be created for this data, and no hand-authored
`libs/*` package SHALL import the generated API client or `server-api/*` wrappers, per the repository's
library isolation rule.

#### Scenario: Static analysis passes module boundary lint
- **WHEN** `npm exec nx lint chat` runs after this change
- **THEN** `@nx/enforce-module-boundaries` reports no violations introduced by `useUsageData` or the
  `Usage` tab component
