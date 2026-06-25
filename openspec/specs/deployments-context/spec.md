# Spec: deployments-context

## Requirements

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

### Requirement: Deployment selector uses skeleton placeholders while loading

When `useDeployments().isLoading` is `true`, the deployment selector SHALL use
`DialSkeleton` from `@epam/ai-dial-ui-kit` instead of a visible loading-text
row.

The selector trigger SHALL render one circular skeleton in place of the
selected deployment icon. The opened desktop dropdown SHALL render exactly
seven disabled rows; every row SHALL contain a circular icon skeleton and a
text skeleton representing the deployment name. The mobile bottom sheet SHALL
render the same seven skeleton rows. The localized loading label SHALL remain
available to assistive technology.

#### Scenario: Desktop selector shows deployment skeletons while loading

- **WHEN** `modelSelectorLabels.loading` is defined, including a reload where `deployments` still contains previously loaded items
- **THEN** the trigger shows a circular `DialSkeleton`
- **AND** the dropdown contains exactly seven disabled skeleton rows
- **AND** every row contains one circular and one text `DialSkeleton`

#### Scenario: Mobile selector shows deployment skeletons while loading

- **WHEN** the mobile selector is opened while deployments are loading
- **THEN** the bottom sheet contains exactly seven skeleton rows
- **AND** every row contains one circular and one text `DialSkeleton`

---

### Requirement: Catalog frontend fully removed

`apps/chat/src/context/CatalogContext.tsx`, `apps/chat/src/context/tests/CatalogContext.spec.tsx`, and `apps/chat/src/server-api/catalog.ts` SHALL be deleted.

All imports of `CatalogContext`, `useCatalog`, `CatalogProvider`, `getCatalogItems`, and `CatalogItemDto` SHALL be removed from `apps/chat/src/`.

#### Scenario: No catalog context references remain in apps/chat

- **WHEN** the codebase is scanned for `useCatalog`, `CatalogProvider`, `getCatalogItems`
- **THEN** no references are found in `apps/chat/src/`

#### Scenario: restoreSelectedItemId updates selectedItemId without persisting user config

- **WHEN** `restoreSelectedItemId('dep-b')` is called
- **THEN** `selectedItemId` becomes `'dep-b'`
- **AND** `useUserConfig().setSelectedDeployment` is NOT called

---

### Requirement: DeploymentsContext unit tests

`apps/chat/src/context/tests/DeploymentsContext.spec.tsx` SHALL cover:

1. Provider loads items on mount and sets `isLoading: false` on completion.
2. `selectedItemId` defaults to `items[0].id` after successful load when no user-config or operator default applies.
3. `selectedItemId` follows user-config `selectedDeploymentId` when present in `items`.
4. `selectedItemId` falls back to operator `defaultDeploymentId` when user-config selection is absent.
5. `selectedItemId` falls back to first sorted deployment when configured ids are stale.
6. `setSelectedItemId` updates `selectedItemId` and calls `setSelectedDeployment`.
7. `restoreSelectedItemId` updates `selectedItemId` without calling `setSelectedDeployment`.
8. `useDeployments()` throws when called outside provider.
9. Unmount before fetch — no setState called.
10. Previously selected id not in new items → re-evaluate precedence from user config onward.
11. Fetch error → `error` is set, `isLoading: false`.

All `getDeployments` calls SHALL be mocked; no live network calls.

#### Scenario: Context test — items load and selectedItemId defaults

- **WHEN** `getDeployments` resolves with `[{ id: 'a', displayName: 'A', type: 'model' }]`
- **THEN** `items` is `[{ id: 'a', ... }]` and `selectedItemId` is `'a'`

#### Scenario: Context test — useDeployments throws outside provider

- **WHEN** a component calls `useDeployments()` without a `DeploymentsProvider` ancestor
- **THEN** rendering throws `Error('useDeployments must be used within a DeploymentsProvider')`

---

### Requirement: Backend maps dial:chatMessageInputDisabled to isChatMessageInputDisabled

`apps/chat-api/src/deployments/deployments.service.ts` SHALL, in `getDeploymentConfiguration`, map the raw DIAL Core JSON Schema response to a `DeploymentConfigurationDto` before returning it to the frontend. The mapping SHALL extract `raw['dial:chatMessageInputDisabled']` into a clean camelCase field `isChatMessageInputDisabled?: boolean`, following the same pattern as `ApplicationSchemasService` maps `dial:applicationTypeDisplayName` to `displayName`.

The raw `Record<string, unknown>` SHALL NOT be returned directly — a typed DTO is the contract.

#### Scenario: Backend maps the flag to isChatMessageInputDisabled

- **WHEN** DIAL Core returns a schema with `{ "dial:chatMessageInputDisabled": true }`
- **THEN** `getDeploymentConfiguration` returns `{ isChatMessageInputDisabled: true }` (field renamed, DIAL key absent)

#### Scenario: Flag absent in raw schema — field omitted from DTO

- **WHEN** DIAL Core returns a schema without `dial:chatMessageInputDisabled`
- **THEN** the DTO does not include `isChatMessageInputDisabled` (field is `undefined`)

---

### Requirement: DeploymentConfigurationDto is the typed backend response

`apps/chat-api/src/deployments/dto/deployment-configuration.dto.ts` SHALL define:

```ts
export class DeploymentConfigurationDto {
  type?: string;
  title?: string;
  properties?: Record<string, unknown>;
  additionalProperties?: boolean | Record<string, unknown>;
  isChatMessageInputDisabled?: boolean;
}
```

The controller SHALL reference this class in its `@ApiResponse` decorator.

#### Scenario: DTO shape matches mapped fields

- **WHEN** `getDeploymentConfiguration` succeeds
- **THEN** the response body contains only the mapped fields defined in `DeploymentConfigurationDto`

---

### Requirement: DeploymentConfigurationSchema exposes isChatMessageInputDisabled as a typed field

`libs/chat-shared/src/models/deployment-configuration.ts` (`DeploymentConfigurationSchema`) SHALL include:

```ts
/** When true, the application does not accept free-form text input; users interact only via form/action buttons. */
isChatMessageInputDisabled?: boolean;
```

The raw `'dial:chatMessageInputDisabled'` field SHALL be removed — the backend owns the mapping, the frontend reads only the clean name.

#### Scenario: Type-safe field access without cast

- **WHEN** app-edge code reads `selectedDeploymentConfiguration?.isChatMessageInputDisabled`
- **THEN** TypeScript infers the type as `boolean | undefined` without a type assertion

#### Scenario: Missing field defaults to undefined

- **WHEN** a `DeploymentConfigurationSchema` object is constructed without `isChatMessageInputDisabled`
- **THEN** the field is `undefined`, which is falsy, and no existing code breaks
