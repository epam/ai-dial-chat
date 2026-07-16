## MODIFIED Requirements

### Requirement: DeploymentsContext owns deployment selection for conversation selector

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide:

- `items: DeploymentItemDto[]` — full deployment list from `GET /api/v1/deployments`
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string | null) => void` — persists selection to user config via `setSelectedDeployment` from `useUserConfig()` (user-initiated model change); does NOT write to `localStorage`
- `restoreSelectedItemId: (id: string) => void` — sets `selectedItemId` in local state **without** calling `setSelectedDeployment`; used when restoring a conversation's last-used model so the user's own new-chat preference is preserved
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments()` from `server-api/deployments.api.ts` with no `interface_type` filter (all deployments).
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Determine the initial `selectedItemId` using the following precedence (evaluated in order after both deployments and user config are available):
  1. Current in-memory `selectedItemId` if it is still present in the new `items` list (handles deployment list reload).
  2. `useUserConfig().selectedDeploymentId` if non-null and present in `items`.
  3. `useAppConfig().defaultDeploymentId` if non-null and present in `items`.
  4. `items[0]?.id` (first sorted deployment).
  5. `null` if `items` is empty.
- When the deployments reload and the previously selected `id` is no longer in `items`, re-apply the full precedence chain from step 2 onward.
- **NOT re-trigger the full deployments/schemas/toolsets fetch merely because `setSelectedItemId` is called.** `setSelectedItemId` optimistically updates `useUserConfig().selectedDeploymentId` before its persistence call resolves; the initial-load fetch (and the `isLoading` flag it drives) SHALL NOT react to that value changing after the initial load has already completed. The initial-selection precedence chain MAY still be re-evaluated without a network call if `userConfigSelectedId`/`defaultDeploymentId` become known only after the deployments list already loaded with `selectedItemId` still `null` (e.g. an initially empty list later repopulated via `refetchDeployments`).
- Export a `useDeployments()` hook that throws a clear error when called outside the provider.
- NOT read from or write to `localStorage` under any circumstance.

The state management pattern SHALL follow `ThemeContext.tsx` as the reference implementation.

`CatalogContext.tsx` SHALL be deleted — `DeploymentsContext` is its replacement, not an addition.

**i18n impact:** None.

**RTL / UI impact:** None (context logic only).

**Memoisation:** `useMemo` on context value; `setSelectedItemId` and `restoreSelectedItemId` SHALL be wrapped in `useCallback`.

#### Scenario: DeploymentsProvider loads items on mount

- **WHEN** `DeploymentsProvider` mounts
- **THEN** it calls `getDeployments()`, sets `isLoading: true` during fetch, sets `items` on success, sets `error` on failure, and sets `isLoading: false` when done

#### Scenario: Initial selectedItemId follows user config preference

- **WHEN** deployments load with items `["dep-a", "dep-b"]` and `useUserConfig().selectedDeploymentId === "dep-b"`
- **THEN** `selectedItemId` is `"dep-b"`

#### Scenario: User config preference absent — falls back to operator default

- **WHEN** deployments load with items `["dep-a", "dep-b"]` and `useUserConfig().selectedDeploymentId === null` and `useAppConfig().defaultDeploymentId === "dep-b"`
- **THEN** `selectedItemId` is `"dep-b"`

#### Scenario: User config and operator default absent — falls back to first sorted deployment

- **WHEN** deployments load and both `selectedDeploymentId` and `defaultDeploymentId` are `null`
- **THEN** `selectedItemId` is `items[0].id`

#### Scenario: User config preference points to unavailable deployment — falls through to operator default

- **WHEN** `useUserConfig().selectedDeploymentId === "removed-dep"` and `"removed-dep"` is not in `items`, and `useAppConfig().defaultDeploymentId === "dep-a"` which is in `items`
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
