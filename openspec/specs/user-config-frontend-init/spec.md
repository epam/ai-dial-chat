## Requirement: UserConfigContext loads user configuration once per authenticated identity

`UserConfigProvider` (`apps/chat/src/context/UserConfigContext.tsx`) SHALL call `getUserConfig()` from `apps/chat/src/server-api/user-config.api.ts` exactly once for each authenticated identity: once on mount, and again whenever the authenticated identity (`useUser().user?.sub`) changes while the provider remains mounted. It must not trigger a second request on re-renders, or on child component mount/unmount cycles, that do not correspond to a `sub` change.

When the resolved `sub` changes while `UserConfigProvider` stays mounted, the provider SHALL reset `pinnedConversationIds`, `installedToolsetIds`, `installedDeploymentIds`, and `selectedDeploymentId` to their empty/`null` defaults, set `status` back to `Loading`, and re-issue `getUserConfig()` — mirroring what already happens on a fresh mount. This SHALL NOT re-run merely because `user` is updated in place with an unchanged `sub` (see `spa-auth-session`'s identity revalidation requirement).

`UserConfigProvider` is placed inside `RequireAuth` in `apps/chat/src/main.tsx`, wrapping `AppConfigProvider` and `ConversationsProvider`. It therefore only mounts after the user is authenticated, and continues to fully reset via that unmount/remount path on explicit logout or a `401`. The identity-keyed effect above additionally covers the case where the identity changes without an intervening unmount — i.e. `spa-auth-session`'s "adopt the new profile in place" behavior on a focus/visibility identity mismatch.

**State exposed by `UserConfigContextType`:**

```typescript
interface UserConfigContextType {
  pinnedConversationIds: string[];
  installedToolsetIds: string[];
  installedDeploymentIds: string[];
  selectedDeploymentId: string | null;
  status: UserConfigStatus;
  setPinnedConversation: (id: string, isPinned: boolean) => Promise<void>;
  setInstalledToolset: (id: string, isInstalled: boolean) => Promise<void>;
  setInstalledDeployment: (id: string, isInstalled: boolean) => Promise<void>;
  setSelectedDeployment: (id: string | null) => Promise<void>;
}
```

`UserConfigStatus` enum values: `Idle`, `Loading`, `Ready`, `Error` (defined in `apps/chat/src/types/user-config-status.ts`).

#### Scenario: Status transitions from Loading to Ready on successful fetch

- **WHEN** `UserConfigProvider` mounts and `getUserConfig()` resolves with a valid v2 config
- **THEN** `status` transitions from `Loading` to `Ready`
- **AND** `pinnedConversationIds`, `installedToolsetIds`, `installedDeploymentIds` are populated from the response

#### Scenario: Status stays Loading while the fetch is in flight

- **WHEN** `UserConfigProvider` mounts and `getUserConfig()` has not yet resolved
- **THEN** `status` is `Loading`

#### Scenario: Single fetch — no duplicate requests on re-render

- **WHEN** `UserConfigProvider` re-renders (e.g. due to parent state change) after the initial fetch completes, with the authenticated identity unchanged
- **THEN** `getUserConfig()` is NOT called a second time

#### Scenario: Identity changes while UserConfigProvider stays mounted

- **WHEN** `useUser().user?.sub` changes from one authenticated value to another while a `UserConfigProvider` instance remains mounted
- **THEN** `status` becomes `Loading`, `pinnedConversationIds`/`installedToolsetIds`/`installedDeploymentIds`/`selectedDeploymentId` are reset to their defaults, and `getUserConfig()` is re-invoked, replacing the exposed state with the new identity's config once it resolves

#### Scenario: In-place user update with unchanged sub does not trigger a refetch

- **WHEN** `useUser().user` is replaced with a new object whose `sub` equals the previous value (e.g. from `spa-auth-session`'s focus-revalidation requirement updating other claims)
- **THEN** `UserConfigProvider` does NOT reset or re-fetch its state

---

## Requirement: App shows the existing loading spinner while user config is loading

`UserConfigProvider` SHALL render `<Spinner />` while `status === UserConfigStatus.Loading`. It SHALL render its `children` (wrapped in the context provider) only once `status` is `Ready` or `Error`.

Neither `AppConfigProvider`, `ConversationsProvider`, nor `App` renders until `UserConfigProvider` has exited the `Loading` state.

#### Scenario: Spinner is shown during load

- **WHEN** `UserConfigProvider` mounts and `getUserConfig()` is pending
- **THEN** `<Spinner />` is rendered in place of `children`

#### Scenario: Children render after load completes successfully

- **WHEN** `getUserConfig()` resolves successfully
- **THEN** `children` are rendered with `status === Ready`
- **AND** `<Spinner />` is no longer rendered

#### Scenario: Children render after load fails

- **WHEN** `getUserConfig()` rejects
- **THEN** `children` are rendered with `status === Error`
- **AND** `<Spinner />` is no longer rendered

---

## Requirement: Empty and partially populated responses are normalized to empty arrays

`UserConfigProvider` SHALL normalize missing, `null`, or absent array fields in the API response to empty arrays. A partially populated response must not cause `undefined` to appear in `pinnedConversationIds`, `installedToolsetIds`, or `installedDeploymentIds`.

#### Scenario: All three sections present and populated

- **WHEN** `getUserConfig()` resolves with
  ```json
  {
    "version": 2,
    "conversations": { "pinnedIds": ["conv-1"] },
    "toolsets": { "installed": ["ts-a"] },
    "deployments": { "installed": ["dep-1"] }
  }
  ```
- **THEN** `pinnedConversationIds` is `["conv-1"]`, `installedToolsetIds` is `["ts-a"]`, `installedDeploymentIds` is `["dep-1"]`

#### Scenario: All sections empty

- **WHEN** `getUserConfig()` resolves with `{ "version": 2, "conversations": { "pinnedIds": [] }, "toolsets": { "installed": [] }, "deployments": { "installed": [] } }`
- **THEN** `pinnedConversationIds` is `[]`, `installedToolsetIds` is `[]`, `installedDeploymentIds` is `[]`

#### Scenario: Partially populated — conversations section missing

- **WHEN** `getUserConfig()` resolves without a `conversations` field (null or absent)
- **THEN** `pinnedConversationIds` is `[]`

#### Scenario: Partially populated — toolsets section missing

- **WHEN** `getUserConfig()` resolves without a `toolsets` field (null or absent)
- **THEN** `installedToolsetIds` is `[]`

#### Scenario: Partially populated — deployments section missing

- **WHEN** `getUserConfig()` resolves without a `deployments` field (null or absent)
- **THEN** `installedDeploymentIds` is `[]`

---

## Requirement: On request failure, app falls back to empty arrays and shows an error notification

`UserConfigProvider` SHALL catch any rejection from `getUserConfig()`. On failure it SHALL:
1. Set `status` to `UserConfigStatus.Error`
2. Set all three arrays to `[]`
3. Log the error via `console.error`
4. Call `showNotification({ variant: 'error', message: t(UserConfigI18nKeys.LoadError) })` via `useNotification()`

The application MUST remain usable after a config load failure (empty-array fallback).

#### Scenario: Error notification is shown and app remains usable

- **WHEN** `getUserConfig()` rejects with a network error
- **THEN** `status` is `UserConfigStatus.Error`
- **AND** `pinnedConversationIds`, `installedToolsetIds`, `installedDeploymentIds` are all `[]`
- **AND** an error notification with the `userConfig.loadError` message is shown
- **AND** the `children` of `UserConfigProvider` render (the application is not blocked)

#### Scenario: Console error is logged on failure

- **WHEN** `getUserConfig()` rejects
- **THEN** `console.error` is called with a message identifying the user-config load failure

---

## Requirement: setPinnedConversation keeps UserConfigContext state synchronized with backend

`UserConfigContext.setPinnedConversation(id, isPinned)` SHALL:
1. Optimistically update `pinnedConversationIds` (add `id` if `isPinned = true`, deduplicated; remove `id` if `isPinned = false`)
2. Call `apiPinConversation(id, isPinned)` from `apps/chat/src/server-api/user-config.api.ts`
3. On failure: restore the prior `pinnedConversationIds` snapshot and rethrow the error so callers can revert their own state

`ConversationsContext.pinConversation` SHALL call `useUserConfig().setPinnedConversation` instead of calling `apiPinConversation` directly, so the conversation list `isPinned` flag and `pinnedConversationIds` remain consistent.

#### Scenario: Successful pin updates pinnedConversationIds

- **WHEN** `setPinnedConversation('conv-1', true)` is called and `apiPinConversation` resolves
- **THEN** `pinnedConversationIds` contains `'conv-1'`

#### Scenario: Successful unpin removes from pinnedConversationIds

- **WHEN** `setPinnedConversation('conv-1', false)` is called and `apiPinConversation` resolves
- **THEN** `pinnedConversationIds` does not contain `'conv-1'`

#### Scenario: Pinning an already-pinned id is idempotent

- **WHEN** `setPinnedConversation('conv-1', true)` is called when `'conv-1'` is already in `pinnedConversationIds`
- **THEN** `pinnedConversationIds` contains `'conv-1'` exactly once

#### Scenario: Failed pin reverts optimistic update and rethrows

- **WHEN** `setPinnedConversation('conv-1', true)` is called and `apiPinConversation` rejects
- **THEN** `pinnedConversationIds` is restored to its pre-call value
- **AND** the error is rethrown so `ConversationsContext.pinConversation` can revert its optimistic `isPinned` update

---

## Requirement: setInstalledToolset keeps UserConfigContext state synchronized with backend

`UserConfigContext.setInstalledToolset(id, isInstalled)` SHALL:
1. Optimistically update `installedToolsetIds` (add `id` if `isInstalled = true`, deduplicated; remove `id` if `isInstalled = false`)
2. Call `updateInstalledToolset(id, isInstalled)` from `apps/chat/src/server-api/user-config.api.ts`
3. On failure: restore the prior `installedToolsetIds` snapshot and rethrow the error

#### Scenario: Successful install updates installedToolsetIds

- **WHEN** `setInstalledToolset('ts-a', true)` is called and `updateInstalledToolset` resolves
- **THEN** `installedToolsetIds` contains `'ts-a'`

#### Scenario: Successful uninstall removes from installedToolsetIds

- **WHEN** `setInstalledToolset('ts-a', false)` is called and `updateInstalledToolset` resolves
- **THEN** `installedToolsetIds` does not contain `'ts-a'`

#### Scenario: Failed install reverts optimistic update and rethrows

- **WHEN** `setInstalledToolset('ts-a', true)` is called and `updateInstalledToolset` rejects
- **THEN** `installedToolsetIds` is restored to its pre-call value
- **AND** the error is rethrown

---

## Requirement: setInstalledDeployment keeps UserConfigContext state synchronized with backend

`UserConfigContext.setInstalledDeployment(id, isInstalled)` SHALL:
1. Optimistically update `installedDeploymentIds` (add `id` if `isInstalled = true`, deduplicated; remove `id` if `isInstalled = false`)
2. Call `updateInstalledDeployment(id, isInstalled)` from `apps/chat/src/server-api/user-config.api.ts`
3. On failure: restore the prior `installedDeploymentIds` snapshot and rethrow the error

#### Scenario: Successful install updates installedDeploymentIds

- **WHEN** `setInstalledDeployment('dep-1', true)` is called and `updateInstalledDeployment` resolves
- **THEN** `installedDeploymentIds` contains `'dep-1'`

#### Scenario: Failed install reverts optimistic update and rethrows

- **WHEN** `setInstalledDeployment('dep-1', true)` is called and `updateInstalledDeployment` rejects
- **THEN** `installedDeploymentIds` is restored to its pre-call value
- **AND** the error is rethrown

---

## Non-functional requirements

### i18n

| Key | Default (en) |
|-----|-------------|
| `userConfig.loadError` | `"Failed to load your settings. Some personalization may be unavailable."` |

New enum in `apps/chat/src/constants/translation-keys.ts`:
```typescript
export enum UserConfigI18nKeys {
  LoadError = 'userConfig.loadError',
}
```

### RTL / direction

No new directional UI surfaces are introduced. `<Spinner />` is direction-agnostic. No RTL-specific work required.

### Feature flag

Not gated behind `ENABLED_FEATURES` / `ENABLED_FEATURES_ROLES`. User-config initialization runs for all authenticated users.

### Accessibility

No new interactive UI. `<Spinner />` from `@epam/ai-dial-ui-kit` already handles `role="status"` internally. No additional ARIA attributes required.

### Memoisation

The `UserConfigContextType` value object MUST be wrapped in `useMemo` on all fields, following the `ThemeContext` pattern, to prevent all consumers re-rendering on every `UserConfigProvider` render.

`setPinnedConversation`, `setInstalledToolset`, and `setInstalledDeployment` MUST be defined with `useCallback`.

### Observability / telemetry

No analytics events are introduced. Load failures are logged via `console.error` and surfaced to the user via the notification system.

### Cache

No additional cache. `getUserConfig()` issues one `GET /api/v1/user-config` call per `UserConfigProvider` mount (one per authenticated session). The backend service issues one DIAL Core read per controller call; this is pre-existing behaviour unchanged by this spec.
