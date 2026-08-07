# Spec: deployments-context

## Purpose

Owns the deployments (models/applications), toolsets, and selected-deployment state shared across the conversation selector and catalog surfaces, including refetching those lists and keeping them race-safe against stale in-flight responses.
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
`Skeleton` from `@epam/ai-dial-ui-kit` instead of a visible loading-text
row.

The selector trigger SHALL render one circular skeleton in place of the
selected deployment icon. The opened desktop dropdown SHALL render exactly
seven disabled rows; every row SHALL contain a circular icon skeleton and a
text skeleton representing the deployment name. The mobile bottom sheet SHALL
render the same seven skeleton rows. The localized loading label SHALL remain
available to assistive technology.

#### Scenario: Desktop selector shows deployment skeletons while loading

- **WHEN** `modelSelectorLabels.loading` is defined, including a reload where `deployments` still contains previously loaded items
- **THEN** the trigger shows a circular `Skeleton`
- **AND** the dropdown contains exactly seven disabled skeleton rows
- **AND** every row contains one circular and one text `Skeleton`

#### Scenario: Mobile selector shows deployment skeletons while loading

- **WHEN** the mobile selector is opened while deployments are loading
- **THEN** the bottom sheet contains exactly seven skeleton rows
- **AND** every row contains one circular and one text `Skeleton`

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

### Requirement: `refetchDeployments`/`refetchToolsets` guard against stale in-flight responses

`DeploymentsContext` SHALL expose `refetchToolsets(): Promise<void>` and `refetchDeployments(): Promise<void>` (already part of `DeploymentsContextType`) that re-fetch and replace `toolsets`/`rawDeployments` respectively. The provider SHALL maintain two monotonic per-resource request-id counters (one for deployments, one for toolsets). Every call site that can set `rawDeployments` (the initial mount-time `loadDeployments`, and `refetchDeployments`) SHALL increment the deployments counter at dispatch time and only apply its result if the counter is unchanged when the response arrives; the same pattern applies to `toolsets` (initial load's toolsets fetch and `refetchToolsets`) against the toolsets counter. A response whose captured id no longer matches the current counter SHALL be silently discarded (no state update, no error surfaced) — it does not represent an error, only a superseded request.

This prevents a race where the initial mount-time list fetch (unavoidably in flight before any resource could have been shared to the user) resolves *after* a later, deliberate `refetchDeployments()`/`refetchToolsets()` call (e.g. one triggered right after accepting a share invitation) and overwrites its fresher result with the stale pre-share snapshot.

`refetchDeployments()` SHALL call `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat], true)` so app create/delete/share/save flows that need a just-written Quick App deployment bypass the deployments endpoint's 30-second browser/server cache window.

#### Scenario: A later refetch's result is not clobbered by a slower initial load

- **WHEN** the initial mount-time deployments fetch is still in flight and `refetchDeployments()` is called and resolves first with a fresh list
- **AND** the initial fetch's response subsequently arrives
- **THEN** `items` reflects the `refetchDeployments()` result, not the initial fetch's result

#### Scenario: A later refetch's result is not clobbered by a slower initial toolsets load

- **WHEN** the initial mount-time toolsets fetch is still in flight and `refetchToolsets()` is called and resolves first with a fresh list
- **AND** the initial fetch's response subsequently arrives
- **THEN** `toolsets` reflects the `refetchToolsets()` result, not the initial fetch's result

#### Scenario: Normal sequential refetch still applies

- **WHEN** `refetchDeployments()` (or `refetchToolsets()`) is called with no other in-flight request for that resource
- **THEN** its result is applied to `items`/`toolsets` as before, unaffected by the request-id guard

#### Scenario: Explicit deployments refetch requests a fresh backend list

- **WHEN** `refetchDeployments()` is called after a Quick App save or other deployment-mutating flow
- **THEN** it calls `getDeployments([ListDeploymentsInterfaceTypeEnum.Chat], true)` so the backend receives `refresh=true`

#### Scenario: A superseded response does not trigger an error notification

- **WHEN** a stale response for a since-superseded request arrives (successfully, from the network's perspective)
- **THEN** no `showNotification` error call is made and no state changes — the response is discarded because it is stale, not because it failed

---

### Requirement: Deployments/toolsets fetch is keyed to the authenticated identity

`DeploymentsProvider` SHALL treat the currently authenticated identity (`useUser().user?.sub`) as part of the load effect's dependencies, in addition to the existing `loadDeployments` callback. When the resolved `sub` changes while `DeploymentsProvider` remains mounted, the provider SHALL re-run `loadDeployments`, resetting `rawDeployments`, `schemas`, and `toolsets` to empty and `isLoading` to `true` for the duration of the refetch, exactly as it already does on initial mount. This SHALL NOT re-run merely because `user` is updated in place with unchanged `sub` (see `spa-auth-session`'s identity revalidation requirement).

This closes a defense-in-depth gap: even if a future code path (e.g. a different provider nesting used in overlay/embedded mode) keeps a `DeploymentsProvider` instance mounted across an identity change without an intervening `RequireAuth` unmount, the deployments/toolsets snapshot — and the `isMy` ownership flags computed for the previous identity — cannot outlive that identity change.

#### Scenario: Identity changes while DeploymentsProvider stays mounted

- **WHEN** `useUser().user?.sub` changes from one authenticated value to another while a `DeploymentsProvider` instance remains mounted
- **THEN** `isLoading` becomes `true`, `rawDeployments`/`schemas`/`toolsets` are cleared, and `loadDeployments` is re-invoked, replacing `items`/`toolsets` with data fetched for the new identity

#### Scenario: In-place user update with unchanged sub does not trigger a refetch

- **WHEN** `useUser().user` is replaced with a new object whose `sub` equals the previous value (e.g. from the `spa-auth-session` focus-revalidation requirement updating other claims)
- **THEN** `DeploymentsProvider` does NOT reset or refetch `rawDeployments`/`schemas`/`toolsets`

#### Scenario: Stale catalog item cannot survive an identity change

- **WHEN** a deployment or toolset with `isMy: true` was fetched for the previous identity, and the identity subsequently changes while the provider is mounted
- **THEN** that item is absent from `items`/`toolsets` after the refetch unless the new identity's own `GET /api/v1/deployments` response includes it, preventing a stale `itemId` belonging to the old identity's bucket from being available for a `Share` action under the new session

---

### Requirement: DeploymentsContext exposes on-demand restoration to the user's default deployment

`apps/chat/src/context/DeploymentsContext.tsx` SHALL provide `restoreDefaultSelection: () => void`, in addition to `setSelectedItemId` and `restoreSelectedItemId`.

Calling `restoreDefaultSelection()` SHALL re-evaluate the same precedence chain used to determine the *initial* `selectedItemId` (see "DeploymentsContext owns deployment selection for conversation selector"), but starting from `inMemoryId = null` instead of the current in-memory `selectedItemId`:

1. `useUserConfig().selectedDeploymentId` if non-null and present in `items`.
2. `useAppConfig().defaultDeploymentId` if non-null and present in `items`.
3. `items[0]?.id` (first sorted deployment).
4. Leave `selectedItemId` unchanged if none of the above resolve (e.g. `items` is empty).

`restoreDefaultSelection` SHALL NOT call `setSelectedDeployment` (it does not persist anything — the resolved value is, by construction, already either the persisted preference, the operator default, or a fallback) and SHALL NOT trigger a deployments/schemas/toolsets refetch.

**Memoisation:** `restoreDefaultSelection` SHALL be wrapped in `useCallback`.

#### Scenario: restoreDefaultSelection re-applies the persisted user preference

- **WHEN** `useUserConfig().selectedDeploymentId === "opus"`, `items` contains `"opus"` and `"whisper"`, and in-memory `selectedItemId` currently holds `"whisper"` (e.g. left over from `restoreSelectedItemId` after viewing a conversation)
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"opus"`

#### Scenario: restoreDefaultSelection falls back to the operator default when there is no persisted preference

- **WHEN** `useUserConfig().selectedDeploymentId` is `null`, `useAppConfig().defaultDeploymentId === "dep-a"`, and `items` contains `"dep-a"`
- **THEN** calling `restoreDefaultSelection()` sets `selectedItemId` to `"dep-a"`, regardless of the current in-memory `selectedItemId`

#### Scenario: restoreDefaultSelection does not persist

- **WHEN** `restoreDefaultSelection()` resolves `selectedItemId` to `"dep-a"`
- **THEN** `setSelectedDeployment` is NOT called
