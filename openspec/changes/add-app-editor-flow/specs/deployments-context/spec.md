## MODIFIED Requirements

### Requirement: DeploymentsContext owns deployment selection for conversation selector

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide:

- `items: DeploymentItemDto[]` — deployment list from `GET /api/v1/deployments`, with schema `iconUrl` merged in for application-type deployments that have no icon of their own (see icon fallback below)
- `schemas: ApplicationSchemaSummaryDto[]` — full list from `GET /api/v1/application-schemas`; empty array while loading or on fetch failure
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string | null) => void` — persists selection to user config via `setSelectedDeployment` from `useUserConfig()` (user-initiated model change); does NOT write to `localStorage`
- `restoreSelectedItemId: (id: string) => void` — sets `selectedItemId` in local state **without** calling `setSelectedDeployment`; used when restoring a conversation's last-used model so the user's own new-chat preference is preserved
- `selectedDeploymentConfiguration: DeploymentConfigurationSchema | null` — JSON Schema config for the currently selected deployment; loaded via `getDeploymentConfiguration(selectedItemId)` whenever `selectedItemId` changes; `null` when no deployment is selected or the fetch fails
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat])` from `server-api/deployments.api.ts` filtered to `Chat` interface type only.
- Fetch application schemas on mount using `getApplicationSchemas()` from `server-api/application-schemas.ts` in parallel with `getDeployments()` via `Promise.allSettled`. A schemas fetch failure SHALL be logged as a warning but SHALL NOT set `error` or block deployment loading.
- **Schema icon fallback**: after both fetches resolve, `items` SHALL be derived via `useMemo` — for each deployment where `type === 'application'`, `iconUrl` is absent, and `applicationTypeSchemaId` matches a schema entry, the schema's `iconUrl` is merged in. Deployments without a matching schema or that already have an icon are returned unchanged.
- Use a cancellation flag (`{ isCancelled: boolean }`) inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Determine the initial `selectedItemId` using the following precedence (evaluated in order after both deployments and user config are available):
  1. Current in-memory `selectedItemId` if it is still present in the new `items` list (handles deployment list reload).
  2. `useUserConfig().selectedDeploymentId` if non-null and present in `items`.
  3. `useAppConfig().defaultDeploymentId` if non-null and present in `items`.
  4. `items[0]?.id` (first sorted deployment).
  5. `null` if `items` is empty.
- When the deployments reload and the previously selected `id` is no longer in `items`, re-apply the full precedence chain from step 2 onward.
- Export a `useDeployments()` hook that throws a clear error when called outside the provider.
- NOT read from or write to `localStorage` under any circumstance.

The state management pattern SHALL follow `ThemeContext.tsx` as the reference implementation.

`CatalogContext.tsx` SHALL be deleted — `DeploymentsContext` is its replacement, not an addition.

**i18n impact:** None.

**RTL / UI impact:** None (context logic only).

**Memoisation:** `useMemo` on context value; `setSelectedItemId` and `restoreSelectedItemId` SHALL be wrapped in `useCallback`.

#### Scenario: DeploymentsProvider loads items and schemas on mount

- **WHEN** `DeploymentsProvider` mounts
- **THEN** it calls `getDeployments([Chat])` and `getApplicationSchemas()` in parallel
- **AND** sets `isLoading: true` during fetch
- **AND** sets `items` and `schemas` on success
- **AND** sets `error` on deployment fetch failure
- **AND** sets `isLoading: false` when done

#### Scenario: Schemas fetch failure does not block deployment loading

- **WHEN** `getApplicationSchemas()` rejects
- **AND** `getDeployments()` resolves with items
- **THEN** `items` is populated, `schemas` is `[]`, and `error` is null

#### Scenario: schemas exposed in context value

- **WHEN** `getApplicationSchemas()` resolves with `[{ id: "https://...quickapps2", displayName: "Quick App 2.0", editorUrl: "https://editor.example.com" }]`
- **THEN** `useDeployments().schemas` contains that entry

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

#### Scenario: selectedDeploymentConfiguration loads when selectedItemId changes

- **WHEN** `selectedItemId` is set to `"dep-a"`
- **THEN** `getDeploymentConfiguration("dep-a")` is called
- **AND** `selectedDeploymentConfiguration` is set to the returned schema on success
- **AND** `selectedDeploymentConfiguration` is set to `null` on failure

#### Scenario: Schema icon merged into application deployment missing an icon

- **WHEN** `items` contains `{ type: "application", iconUrl: undefined, applicationTypeSchemaId: "https://...quickapps2" }`
- **AND** `schemas` contains `{ id: "https://...quickapps2", iconUrl: "https://example.com/icon.svg" }`
- **THEN** the deployment in `items` is returned with `iconUrl: "https://example.com/icon.svg"`

#### Scenario: localStorage is never read or written

- **WHEN** any interaction with DeploymentsContext occurs (mount, select, restore)
- **THEN** `localStorage.getItem` and `localStorage.setItem` are never called with `"dial:selectedDeploymentId"`
