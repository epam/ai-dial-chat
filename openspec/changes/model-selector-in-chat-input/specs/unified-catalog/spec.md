## MODIFIED Requirements

---

### Requirement: DeploymentsContext owns unified deployment selection

`apps/chat/src/context/DeploymentsContext.tsx` (replaces `CatalogContext.tsx`) SHALL provide:

- `items: DeploymentItemDto[]` — full deployment list from `GET /api/v1/deployments` (replaces `CatalogItemDto[]` from `GET /api/v1/catalog`)
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments()` from `server-api/deployments.api.ts` (replaces `getCatalogItems()` from `server-api/catalog.ts`).
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Default `selectedItemId` to the first item's `id` on successful load.
- If the deployments reload and the previously selected `id` is no longer present in `items`, reset `selectedItemId` to `items[0]?.id ?? null`.
- Export a `useDeployments()` hook (replaces `useCatalog()`) that throws a clear error when called outside the provider.

The conversation input model/application selection component in `apps/chat` SHALL consume `useDeployments()` to supply `catalogItems`, `selectedCatalogItemId`, and `onSelectedCatalogItemChange` props to `ConversationInput`. `setSelectedItemId` from `DeploymentsContext` is the handler for `onSelectedCatalogItemChange`.

`ModelsContext` and `useModels` SHALL remain unchanged. `CatalogContext.tsx` SHALL be deleted.

#### Scenario: DeploymentsProvider loads items on mount

- **WHEN** `DeploymentsProvider` mounts
- **THEN** it calls `getDeployments()`, sets `isLoading: true` during fetch, sets `items` on success, sets `error` on failure, and sets `isLoading: false` when done

#### Scenario: selectedItemId defaults to first item

- **WHEN** the deployments load successfully with one or more items
- **THEN** `selectedItemId` is set to `items[0].id`

#### Scenario: useDeployments throws outside provider

- **WHEN** `useDeployments()` is called outside a `DeploymentsProvider`
- **THEN** it throws `Error('useDeployments must be used within a DeploymentsProvider')`

#### Scenario: Unmount before fetch completes — no state update

- **WHEN** `DeploymentsProvider` unmounts before `getDeployments()` resolves
- **THEN** the `cancelled` flag prevents any `setState` calls

#### Scenario: Previously selected item removed after reload

- **WHEN** `selectedItemId` is `"old-dep"` and the deployments reload returning items that do not include `"old-dep"`
- **THEN** `selectedItemId` is reset to `items[0]?.id ?? null`

#### Scenario: Conversation model selection uses DeploymentsContext

- **WHEN** the user opens the conversation model/application/toolset selector
- **THEN** the displayed items come from `useDeployments().items`, not from `useModels().models`

#### Scenario: onSelectedCatalogItemChange updates DeploymentsContext

- **WHEN** the user selects a deployment with `id: "dep-2"` via the `DialDropdownIcon` menu
- **THEN** `useDeployments().selectedItemId === "dep-2"` in `DeploymentsContext`
