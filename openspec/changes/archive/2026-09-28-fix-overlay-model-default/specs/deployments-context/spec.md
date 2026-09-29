## MODIFIED Requirements

### Requirement: DeploymentsContext owns deployment selection for conversation selector

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide:

- `items: DeploymentItemDto[]` — full deployment list from `GET /api/v1/deployments`
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string | null) => void` — persists selection to user config via `setSelectedDeployment` from `useUserConfig()` (user-initiated model change); does NOT write to `localStorage`
- `restoreSelectedItemId: (id: string) => void` — sets `selectedItemId` in local state **without** calling `setSelectedDeployment`; used when restoring a conversation's last-used model so the user's own new-chat preference is preserved
- `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` — JSON Schema configuration for the currently selected deployment
- `selectedDeploymentDetails: DeploymentDetailsDto | null` — full per-entity details (model/application/toolset) for the currently selected deployment, fetched from `GET /api/v1/deployments/{deployment}/details` via `getDeploymentDetails` (`apps/chat/src/server-api/deployments.ts`)
- `isDeploymentDetailsLoading: boolean` — true while `selectedDeploymentDetails` is being fetched for the current selection
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp])` from `server-api/deployments.api.ts`, so `items` includes both chat-capable and MCP-capable models/applications.
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Determine the initial `selectedItemId` through `resolveInitialSelection`, evaluated after deployments, user config, and app config are available. The full precedence is owned by `default-agent-preference` ("resolveInitialSelection consults the preference before the operator default"); in summary:
  1. Current in-memory `selectedItemId` if it is still present in the new `items` list (handles deployment list reload).
  2. In overlay mode, the host's `modelId` (`useOptionalOverlay()?.modelId`) if a deployment with that `id` or `reference` is in `items`.
  3. The user's stored `Default agent for new chats` preference, resolved as `default-agent-preference` specifies.
  4. `useAppConfig().defaultDeploymentId` if `useFeatureFlag('defaultDeploymentPinned')` is `true`, the id is non-null, and it is present in `items`; while the flag is `false` this step is skipped.
  5. `useUserConfig().selectedDeploymentId` if non-null and present in `items`.
  6. `items[0]?.id` (first sorted deployment).
  7. `null` if `items` is empty.
- When the deployments reload and the previously selected `id` is no longer in `items`, re-apply the full precedence chain from step 2 onward.
- **NOT re-trigger the full deployments/schemas/toolsets fetch merely because `setSelectedItemId` is called.** `setSelectedItemId` optimistically updates `useUserConfig().selectedDeploymentId` before its persistence call resolves; the initial-load fetch (and the `isLoading` flag it drives) SHALL NOT react to that value changing after the initial load has already completed. If user/app config becomes known after deployments load, the provider SHALL re-sort and MAY re-evaluate an automatically resolved provisional selection without a network call. It SHALL NOT override a selection explicitly established by `setSelectedItemId` or `restoreSelectedItemId`.
- Export a `useDeployments()` hook that throws a clear error when called outside the provider.
- NOT read from or write to `localStorage` under any circumstance.
- Whenever `resolvedSelectedDeploymentId` changes (the same trigger already used for `selectedDeploymentConfiguration`), fetch `selectedDeploymentConfiguration` and `selectedDeploymentDetails` **concurrently** in a single effect via `Promise.allSettled`, so neither fetch blocks or is blocked by the other, and a failure in one does not clear a successful result from the other:
  - If `resolvedSelectedDeploymentId` is `null`, both `selectedDeploymentConfiguration` and `selectedDeploymentDetails` SHALL be set to `null` and no requests SHALL be made.
  - On success, `selectedDeploymentDetails` SHALL be set to the resolved `DeploymentDetailsDto`; on failure (rejected settlement), `selectedDeploymentDetails` SHALL be set to `null`.
  - `isDeploymentDetailsLoading` SHALL be `true` from the start of the effect (when a non-null id is present) until the details fetch settles.
  - The same single cancellable-effect `signal.isCancelled` guard used for `selectedDeploymentConfiguration` SHALL also guard `selectedDeploymentDetails`/`isDeploymentDetailsLoading` state updates, so a superseded selection change (effect cleanup fired before either fetch resolves) applies neither fetch's result.
  - A repeated selection of the same `resolvedSelectedDeploymentId` (no change to the effect's dependency) SHALL NOT issue a new details request.

The state management pattern SHALL follow `ThemeContext.tsx` as the reference implementation.

`CatalogContext.tsx` SHALL be deleted — `DeploymentsContext` is its replacement, not an addition.

**i18n impact:** None.

**RTL / UI impact:** None (context logic only).

**Memoisation:** `useMemo` on context value; `setSelectedItemId` and `restoreSelectedItemId` SHALL be wrapped in `useCallback`.

#### Scenario: DeploymentsProvider loads items on mount

- **WHEN** `DeploymentsProvider` mounts
- **THEN** it calls `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat, ListDeploymentsInterfaceTypeEnum.Mcp])`, sets `isLoading: true` during fetch, sets `items` on success, sets `error` on failure, and sets `isLoading: false` when done

#### Scenario: Initial selectedItemId follows operator default preference

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `useFeatureFlag('defaultDeploymentPinned') === true`, and `useAppConfig().defaultDeploymentId === "dep-b"`
- **THEN** `selectedItemId` is `"dep-b"`

#### Scenario: Operator default wins when both operator default and user preference are set

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `useFeatureFlag('defaultDeploymentPinned') === true`, `useAppConfig().defaultDeploymentId === "dep-b"`, and `useUserConfig().selectedDeploymentId === "dep-a"`
- **THEN** `selectedItemId` is `"dep-b"`

#### Scenario: Disabled flag preserves user preference over operator default

- **WHEN** deployments load with items `["dep-a", "dep-b"]`, `useFeatureFlag('defaultDeploymentPinned') === false`, `useAppConfig().defaultDeploymentId === "dep-b"`, and `useUserConfig().selectedDeploymentId === "dep-a"`
- **THEN** `selectedItemId` is `"dep-a"` and the list remains alphabetical

#### Scenario: Operator default absent — falls back to user-persisted preference

- **WHEN** deployments load with items `["dep-a", "dep-b"]` and `useAppConfig().defaultDeploymentId === null` and `useUserConfig().selectedDeploymentId === "dep-b"`
- **THEN** `selectedItemId` is `"dep-b"`

#### Scenario: User config and operator default absent — falls back to first sorted deployment

- **WHEN** deployments load and both `selectedDeploymentId` and `defaultDeploymentId` are `null`
- **THEN** `selectedItemId` is `items[0].id`

#### Scenario: Operator default not in catalog — falls through to user-persisted preference

- **WHEN** `useAppConfig().defaultDeploymentId === "removed-dep"` and `"removed-dep"` is not in `items`, and `useUserConfig().selectedDeploymentId === "dep-a"` which is in `items`
- **THEN** `selectedItemId` is `"dep-a"`

#### Scenario: No deployments exist — selectedItemId is null

- **WHEN** deployments load successfully with an empty list
- **THEN** `selectedItemId` is `null`

#### Scenario: useDeployments throws outside provider

- **WHEN** `useDeployments()` is called outside a `DeploymentsProvider`
- **THEN** it throws `Error('useDeployments must be used within a DeploymentsProvider')`

#### Scenario: Unmount before fetch completes — no state update

- **WHEN** `DeploymentsProvider` unmounts before `getDeployments()` resolves
- **THEN** the `cancelled` flag prevents any `setState` calls

#### Scenario: Previously selected item removed after reload

- **WHEN** `selectedItemId` is `"old-dep"` and deployments reload returning items that do not include `"old-dep"`
- **THEN** selection re-evaluates precedence: user config → operator default → first item → null

#### Scenario: setSelectedItemId calls user config persistence

- **WHEN** `setSelectedItemId("dep-b")` is called
- **THEN** `useUserConfig().setSelectedDeployment("dep-b")` is called
- **AND** `selectedItemId` updates to `"dep-b"` in local state

#### Scenario: restoreSelectedItemId does not call user config persistence

- **WHEN** `restoreSelectedItemId("dep-b")` is called
- **THEN** `selectedItemId` updates to `"dep-b"` in local state
- **AND** `useUserConfig().setSelectedDeployment` is NOT called

#### Scenario: localStorage is never read or written

- **WHEN** any interaction with DeploymentsContext occurs (mount, select, restore)
- **THEN** `localStorage.getItem` and `localStorage.setItem` are never called with `"dial:selectedDeploymentId"`

#### Scenario: Selecting a deployment does not re-trigger the initial-load fetch sequence

- **WHEN** `getDeployments`, `getApplicationSchemas`, and `listToolsets` have each already resolved once after mount, and the user then calls `setSelectedItemId` with a different, valid deployment id (which optimistically updates `useUserConfig().selectedDeploymentId`)
- **THEN** `selectedItemId` updates immediately, `isLoading` remains `false` throughout, and `getDeployments`, `getApplicationSchemas`, and `listToolsets` are each still called exactly once

#### Scenario: Selection resolves from a later-populated list without a network call

- **WHEN** the initial `getDeployments()` call resolves with an empty list (so `selectedItemId` stays `null`), `useUserConfig().selectedDeploymentId` subsequently becomes a valid id, and `rawDeployments` is later repopulated (e.g. via `refetchDeployments`) to include that id
- **THEN** `selectedItemId` updates to that id once the repopulated list is available, without the initial-load fetch sequence (`getDeployments`/`getApplicationSchemas`/`listToolsets`) running an additional, unrequested time beyond the explicit `refetchDeployments` call

#### Scenario: Selecting a deployment fetches configuration and details in parallel

- **WHEN** `resolvedSelectedDeploymentId` changes from `null` to `"dep-a"`
- **THEN** `getDeploymentConfiguration("dep-a")` and `getDeploymentDetails("dep-a")` are both called, without either call awaiting the other's completion first

#### Scenario: Deployment details fetch succeeds

- **WHEN** `resolvedSelectedDeploymentId` is `"dep-a"` and `getDeploymentDetails("dep-a")` resolves with a `DeploymentDetailsDto`
- **THEN** `selectedDeploymentDetails` is set to that DTO and `isDeploymentDetailsLoading` becomes `false`

#### Scenario: Deployment details fetch fails independently of configuration

- **WHEN** `resolvedSelectedDeploymentId` is `"dep-a"`, `getDeploymentDetails("dep-a")` rejects, and `getDeploymentConfiguration("dep-a")` resolves successfully
- **THEN** `selectedDeploymentDetails` is `null`, `isDeploymentDetailsLoading` becomes `false`, and `selectedDeploymentConfiguration` reflects the successful configuration result unaffected by the details failure

#### Scenario: No selection — details cleared without a request

- **WHEN** `resolvedSelectedDeploymentId` becomes `null`
- **THEN** `selectedDeploymentDetails` is set to `null`, `isDeploymentDetailsLoading` is `false`, and no `getDeploymentDetails` call is made

#### Scenario: Unmount before details fetch completes — no state update

- **WHEN** `DeploymentsProvider` unmounts (or `resolvedSelectedDeploymentId` changes again) before `getDeploymentDetails` resolves for the prior id
- **THEN** the effect's `signal.isCancelled` guard prevents `selectedDeploymentDetails`/`isDeploymentDetailsLoading` from being updated with the stale result

#### Scenario: Repeated selection of the same deployment does not refetch details

- **WHEN** `resolvedSelectedDeploymentId` is already `"dep-a"` and the effect re-runs for an unrelated reason without `resolvedSelectedDeploymentId` changing
- **THEN** `getDeploymentDetails` is not called again beyond the one call already made for `"dep-a"`

#### Scenario: Overlay host modelId determines the initial selection

- **WHEN** `useOptionalOverlay()?.modelId === "dep-b"`, deployments load with items `["dep-a", "dep-b"]`, `useFeatureFlag('defaultDeploymentPinned') === true`, `useAppConfig().defaultDeploymentId === "dep-a"`, and `useUserConfig().selectedDeploymentId === "dep-a"`
- **THEN** `selectedItemId` is `"dep-b"`

### Requirement: DeploymentsContext exposes on-demand restoration to the user's default deployment

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide `restoreDefaultSelection: () => void`, in addition to `setSelectedItemId` and `restoreSelectedItemId`.

Calling `restoreDefaultSelection()` SHALL re-evaluate the same precedence chain used to determine the *initial* `selectedItemId` (see "DeploymentsContext owns deployment selection for conversation selector"), but starting from `inMemoryId = null` instead of the current in-memory `selectedItemId`:

1. In overlay mode, the host's `modelId` if a deployment with that `id` or `reference` is in `items`.
2. The user's stored `Default agent for new chats` preference, resolved as `default-agent-preference` specifies.
3. `useAppConfig().defaultDeploymentId` if `useFeatureFlag('defaultDeploymentPinned')` is `true`, the id is non-null, and it is present in `items`.
4. `useUserConfig().selectedDeploymentId` if non-null and present in `items`.
5. `items[0]?.id` (first sorted deployment).
6. Leave `selectedItemId` unchanged if none of the above resolve (e.g. `items` is empty).

`restoreDefaultSelection` SHALL NOT call `setSelectedDeployment` (it does not persist anything — the resolved value is, by construction, already either the overlay host's model, the stored preference, the persisted selection, the operator default, or a fallback) and SHALL NOT trigger a deployments/schemas/toolsets refetch.

**Memoisation:** `restoreDefaultSelection` SHALL be wrapped in `useCallback` with an empty dependency array, so its identity never changes for the lifetime of the provider. It SHALL read `items`, the latest persisted preference, the stored `Default agent for new chats` preference, the overlay host's `modelId`, and the effective operator default from refs. Neither `useUserConfig().selectedDeploymentId` changing after a manual deployment selection nor `items` being rebuilt by a deployments refetch may change its identity: the new-conversation route calls it from an effect keyed on that identity, so any change re-fires default restoration and discards the user's current selection.

#### Scenario: Deployments refetch does not reset the current selection

- **WHEN** pinning is enabled, the user has explicitly selected a non-default deployment, and `refetchDeployments()` rebuilds `items`
- **THEN** `restoreDefaultSelection` retains its callback identity and `selectedItemId` still holds the explicitly selected deployment

#### Scenario: restoreDefaultSelection re-applies the operator default over a stale in-memory value when operator default is configured

- **WHEN** `useFeatureFlag('defaultDeploymentPinned') === true`, `useAppConfig().defaultDeploymentId === "opus"`, `useUserConfig().selectedDeploymentId === null`, `items` contains `"opus"` and `"whisper"`, and in-memory `selectedItemId` currently holds `"whisper"` (e.g. left over from `restoreSelectedItemId` after viewing a conversation)
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"opus"`

#### Scenario: restoreDefaultSelection uses the user-persisted preference when no operator default is configured

- **WHEN** `useAppConfig().defaultDeploymentId` is `null`, `useUserConfig().selectedDeploymentId === "dep-a"`, and `items` contains `"dep-a"`
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"dep-a"`, regardless of the current in-memory `selectedItemId`

#### Scenario: restoreDefaultSelection does not persist

- **WHEN** `restoreDefaultSelection()` resolves `selectedItemId` to `"dep-a"`
- **THEN** `setSelectedDeployment` is NOT called

#### Scenario: Manual deployment switch is not reset to the operator default

- **WHEN** pinning is enabled, the user manually selects a non-default deployment, and persistence updates `useUserConfig().selectedDeploymentId`
- **THEN** `restoreDefaultSelection` retains its callback identity and the route does NOT re-run default restoration, so the manually selected deployment remains selected

#### Scenario: restoreDefaultSelection returns to the overlay host's model

- **WHEN** `useOptionalOverlay()?.modelId === "dep-b"`, `useUserConfig().selectedDeploymentId === "dep-a"`, `items` contains both, and in-memory `selectedItemId` currently holds `"dep-a"` (left over from `restoreSelectedItemId`)
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"dep-b"`
