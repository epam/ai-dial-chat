## MODIFIED Requirements

### Requirement: useUsageData hook fetches the usage endpoint on mount

`useUsageData` (`libs/chat-hooks/src/usage/useUsageData/useUsageData.ts`) SHALL fetch the user's
usage statistics through the `getUserUsage` function it is given, exactly as before. Its
`enabled: boolean` second parameter, defaulting to `true`, is **unchanged**: when `enabled` is
`false` the effect SHALL NOT call `getUserUsage()` and `isLoading` SHALL initialize to `false`,
following the `useScheduledTasks(enabled)` pattern. The parameter stays because it is part of a
host-agnostic lib hook's contract, not because this app still needs it.

What changes is the **caller**. The Usage tab SHALL call `useUsageData(getUserUsage)` with no second
argument, relying on the `true` default. It SHALL NOT read a feature flag: the
`SettingsPageEnabled` flag is removed, so `useFeatureFlag('settingsPageEnabled')` no longer exists
and the tab cannot be reached while the page is disabled — mounting the tab is itself the signal
that the data is wanted.

`apps/chat/src/pages/SettingsPage/UsageTab/UsageTab.tsx` therefore imports no `useFeatureFlag`.

The hook SHALL return:

```ts
interface UseUsageDataResult {
  usage: UserLimitStatsResponseDto | undefined;
  isLoading: boolean;
  usageError: Error | undefined;
}
```

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

#### Scenario: Arriving at the Settings page does not fetch usage
- **WHEN** a user opens `/settings`, where `Preferences` is the default tab
- **THEN** `UsageTab` does not mount and `GET /api/v1/user/usage` is not requested

#### Scenario: The Usage tab passes no enabled argument
- **WHEN** the user activates the `Usage` row and the tab renders
- **THEN** it calls `useUsageData(getUserUsage)` with a single argument, and `GET /api/v1/user/usage`
  is requested

#### Scenario: An explicit disabled caller still suppresses the fetch
- **WHEN** any caller invokes `useUsageData(getUserUsage, false)`
- **THEN** `GET /api/v1/user/usage` is not called, and the hook returns `isLoading: false`,
  `usage: undefined`, `usageError: undefined` — the lib contract is unchanged even though this app
  no longer uses it
