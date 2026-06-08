## ADDED Requirements

---

### Requirement: DeploymentsContext owns deployment selection for conversation selector

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide:

- `items: DeploymentItemDto[]` — full deployment list from `GET /api/v1/deployments`
- `selectedItemId: string | null` — currently selected deployment id
- `setSelectedItemId: (id: string) => void`
- `isLoading: boolean`
- `error: Error | null`

The provider SHALL:
- Fetch deployments on mount using `getDeployments()` from `server-api/deployments.api.ts` with no `interface_type` filter (all deployments).
- Use a `cancelled` flag inside `useEffect` to guard against setState-on-unmount.
- Use `useMemo` to memoize the context value.
- Default `selectedItemId` to the first item's `id` on successful load.
- If the deployments reload and the previously selected `id` is no longer present in `items`, reset `selectedItemId` to `items[0]?.id ?? null`.
- Export a `useDeployments()` hook that throws a clear error when called outside the provider.

The state management pattern SHALL follow `ThemeContext.tsx` as the reference implementation.

`CatalogContext.tsx` SHALL be deleted — `DeploymentsContext` is its replacement, not an addition.

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

- **WHEN** `selectedItemId` is `"old-dep"` and deployments reload returning items that do not include `"old-dep"`
- **THEN** `selectedItemId` is reset to `items[0]?.id ?? null`

---

### Requirement: ConversationRoute and ConversationView use DeploymentsContext

`apps/chat/src/pages/ConversationRoute/ConversationRoute.tsx` and `apps/chat/src/components/ConversationView/ConversationView.tsx` SHALL consume `useDeployments()` instead of `useCatalog()`.

The props passed to `ConversationInput` SHALL use `items` from `useDeployments()` (typed as `DeploymentItemDto[]`) for `catalogItems`, and `selectedItemId` / `setSelectedItemId` from `useDeployments()` for `selectedCatalogItemId` / `onSelectedCatalogItemChange`.

`DeploymentItemDto` satisfies the structural requirements of `CatalogItemDto` (both have `id`, `displayName`, `type`, `iconUrl`), so the `ConversationInput` component requires no prop interface changes.

`DeploymentsProvider` SHALL wrap the conversation routes. All `CatalogProvider` references SHALL be removed.

#### Scenario: ConversationRoute uses deployments items in selector

- **WHEN** `ConversationRoute` renders
- **THEN** the `catalogItems` prop of `ConversationInput` is sourced from `useDeployments().items`

#### Scenario: onSelectedCatalogItemChange updates DeploymentsContext

- **WHEN** the user selects a deployment with `id: "dep-2"` via the `DialDropdownIcon` menu
- **THEN** `useDeployments().selectedItemId === "dep-2"` in `DeploymentsContext`

#### Scenario: handleSend passes selectedItemId as catalogItemId

- **WHEN** `handleSend('Hello', [])` is called with `useDeployments().selectedItemId === 'item-1'`
- **THEN** `apiCreateConversation` is called with `('Hello', 'item-1', [])`

---

### Requirement: Catalog frontend fully removed

`apps/chat/src/context/CatalogContext.tsx`, `apps/chat/src/context/tests/CatalogContext.spec.tsx`, and `apps/chat/src/server-api/catalog.ts` SHALL be deleted.

All imports of `CatalogContext`, `useCatalog`, `CatalogProvider`, `getCatalogItems`, and `CatalogItemDto` SHALL be removed from `apps/chat/src/`.

#### Scenario: No catalog context references remain in apps/chat

- **WHEN** the codebase is scanned for `useCatalog`, `CatalogProvider`, `getCatalogItems`
- **THEN** no references are found in `apps/chat/src/`

---

### Requirement: i18n keys for deployments selector

All user-visible strings for the deployments-based model selector in `apps/chat` SHALL reuse the existing `catalog.selector.*` keys — no new keys are required because the UI behaviour is identical.

#### Scenario: Existing i18n keys are reused

- **WHEN** `ConversationRoute` renders `<ConversationInput>` with deployments data
- **THEN** `modelSelectorAriaLabel` is resolved from `t('catalog.selector.ariaLabel')` unchanged

---

### Requirement: Deployment selector loading state uses skeleton rows

When deployments are loading, the selector SHALL render `DialSkeleton`
components from `@epam/ai-dial-ui-kit`: one circular skeleton in the trigger
and exactly seven disabled selector rows. Each row SHALL contain a circular
icon skeleton and a text skeleton for the deployment name. The mobile bottom
sheet SHALL use the same seven-row presentation, and the localized loading
label SHALL remain available to assistive technology.

#### Scenario: Deployments are still loading

- **WHEN** `items` is empty and `isLoading` is `true`
- **THEN** the selector trigger shows a circular skeleton
- **AND** opening the selector shows seven disabled skeleton rows

---

### Requirement: DeploymentsContext unit tests

`apps/chat/src/context/tests/DeploymentsContext.spec.tsx` SHALL cover:

1. Provider loads items on mount and sets `isLoading: false` on completion.
2. `selectedItemId` defaults to `items[0].id` after successful load.
3. `setSelectedItemId` updates `selectedItemId`.
4. `useDeployments()` throws when called outside provider.
5. Unmount before fetch — no setState called.
6. Previously selected id not in new items → reset to `items[0]?.id ?? null`.
7. Fetch error → `error` is set, `isLoading: false`.

All `getDeployments` calls SHALL be mocked; no live network calls.

#### Scenario: Context test — items load and selectedItemId defaults

- **WHEN** `getDeployments` resolves with `[{ id: 'a', displayName: 'A', type: 'model' }]`
- **THEN** `items` is `[{ id: 'a', ... }]` and `selectedItemId` is `'a'`

#### Scenario: Context test — useDeployments throws outside provider

- **WHEN** a component calls `useDeployments()` without a `DeploymentsProvider` ancestor
- **THEN** rendering throws `Error('useDeployments must be used within a DeploymentsProvider')`
