# catalog-unshare Specification

## Purpose
TBD - created by archiving change add-catalog-unshare. Update Purpose after archive.
## Requirements
### Requirement: BFF discard-shared-catalog-item endpoint

The system SHALL expose `POST /api/v1/share/discard` on the existing `ShareController` (`apps/chat-api/src/share/`), allowing an authenticated session user to discard their own access to a catalog resource (application or toolset) **or a conversation** that is currently shared with them via DIAL Core `discardSharedResources`.

The endpoint SHALL:
- Require a valid session; respond `401 Unauthorized` when no session is present.
- Accept `DiscardSharedCatalogItemDto { itemId: string }` validated via NestJS `ValidationPipe` (whitelist, forbidNonWhitelisted, transform); `itemId` SHALL be a non-empty string, max length 2048, validated with the existing `IsValidFilePath` validator and an `@Matches` allowlist restricted to `applications/{bucket}/{path}`, `toolsets/{bucket}/{path}`, **or `conversations/{bucket}/{path}`**. Other DIAL resource types and incomplete paths SHALL be rejected before calling DIAL Core.
- Use the session `accessToken` as the Bearer credential when calling DIAL Core.
- Call SDK `discardSharedResources({ headers, body: { resources: [{ url: itemId }] } })` with no bucket/path reconstruction — `itemId` is passed through unmodified as the resource `url`, matching the existing `createShareLink` pattern (`share.service.ts`) rather than the file-manager `bucket`+`path` reconstruction pattern.
- Rely on DIAL Core to enforce that the resource is currently shared with the caller; a resource not shared with the caller SHALL surface as `403 Forbidden` via `mapDialHttpStatus`, not a silent 200.
- On success, invalidate both `DeploymentsService.invalidateListCache(userSub)` and `ToolsetsService.invalidateListCache(userSub)` before responding, mirroring the existing invalidation call in `ShareService.acceptInvitation`. **This invalidation runs unconditionally regardless of `itemId` type; conversations have no equivalent server-side list cache today, so for a conversation `itemId` this invalidation is a harmless no-op — see the `conversation-unshare-api` capability for the conversation-side consistency model (client-driven `refreshConversations()`).**
- Respond `200 OK` with `DiscardSharedCatalogItemResponseDto { success: true }` on success.
- Apply `@Throttle({ default: { limit: 10, ttl: 60000 } })`, matching the file-manager `discard-shared` endpoint's stricter-than-share-creation posture.
- Map upstream failures via the fetch-shaped `mapDialHttpStatus`/`handleDialFetchError` pair (consistent with `ShareService`'s other methods): DIAL Core 400 → 400, 401 → 401, 403 → 403, 404 → 404, 429 → 429, 5xx → 502, network/timeout → 503.
- Not cache the mutation response itself.
- Log structured success/failure messages (e.g. `Discard shared resource started`, `Discard shared resource completed: success=true`, `DIAL Core returned <status> for share.discardShared`) without the access token, invitation links, full resource path, or any other user data beyond a safe operation identifier.

Controller handler name / OpenAPI operationId: **`discardSharedCatalogItem`** → generated client method `discardSharedCatalogItem()`. The `@ApiOperation.description` SHALL read "Discards the caller's own access to a shared catalog entity (application or toolset) or conversation", replacing the catalog-only wording.

**Example request:**
```http
POST /api/v1/share/discard
Content-Type: application/json

{ "itemId": "applications/owner-bucket/my-app" }
```

**Example response (200):**
```json
{ "success": true }
```

**Generated-client impact**: new operation `discardSharedCatalogItem` added to `libs/chat-api-client`'s share API surface, request DTO `DiscardSharedCatalogItemDto { itemId: string }`, response DTO `DiscardSharedCatalogItemResponseDto { success: boolean }`. Frontend callers use the normal (non-`Raw`) generated method, wrapped by a thin `apps/chat/src/server-api/share.api.ts` function (`discardSharedCatalogItem`).

Note: the backend/generated DTOs are named `DiscardSharedCatalogItemDto`/`DiscardSharedCatalogItemResponseDto` rather than the shorter `DiscardSharedDto`/`DiscardSharedResponseDto`, because the File Manager domain already defines DTOs with those exact names for its own (unrelated) discard-shared-file endpoint — the OpenAPI generator keys generated models by class name globally, so two domains cannot reuse the same DTO class name without a collision.

#### Scenario: Successful discard

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "applications/owner-bucket/my-app" }` for an application actually shared with them
- **THEN** the endpoint calls DIAL Core `discardSharedResources` with `{ resources: [{ url: "applications/owner-bucket/my-app" }] }`, invalidates both the deployments and toolsets list caches for the caller, and responds `200 { success: true }`

#### Scenario: Discarding a resource not shared with the caller

- **WHEN** the `itemId` refers to a resource DIAL Core does not consider shared with the calling user
- **THEN** DIAL Core's error response is mapped to `403 Forbidden`; neither cache is invalidated

#### Scenario: Invalid itemId shape rejected

- **WHEN** the request body's `itemId` does not match the allowlisted resource-URL pattern (e.g. contains `../` or is empty)
- **THEN** the endpoint responds `400 Bad Request` before any DIAL Core call is made

#### Scenario: Unauthenticated request

- **WHEN** a request arrives with no valid session cookie
- **THEN** the endpoint responds `401 Unauthorized`

#### Scenario: Resource does not exist

- **WHEN** DIAL Core returns a not-found status for the given `itemId`
- **THEN** the endpoint responds `404 Not Found`

#### Scenario: Rate limit exceeded

- **WHEN** the calling session exceeds 10 requests per 60 seconds to this endpoint
- **THEN** the endpoint responds `429 Too Many Requests`

#### Scenario: DIAL Core upstream error

- **WHEN** DIAL Core returns a 5xx status
- **THEN** the endpoint responds `502 Bad Gateway`

#### Scenario: DIAL Core unreachable or timed out

- **WHEN** the call to DIAL Core times out or the connection fails
- **THEN** the endpoint responds `503 Service Unavailable`

#### Scenario: Successful discard invalidates both list caches

- **WHEN** a discard succeeds for a user whose `deployments:list:<userSub>` and `toolsets:list:<userSub>` cache entries are currently populated
- **THEN** both cache entries are invalidated before the response is sent, so the next list request for that user re-fetches from DIAL Core rather than serving the stale (still-including-the-discarded-item) cached list

#### Scenario: Conversation itemId is now accepted by the same endpoint

- **WHEN** an authenticated user calls `POST /api/v1/share/discard` with `{ itemId: "conversations/owner-bucket/my-chat" }` for a conversation actually shared with them
- **THEN** the endpoint accepts the request (no longer rejecting the `conversations/` prefix as invalid), calls DIAL Core `discardSharedResources` with that itemId, and responds `200 { success: true }` — see the `conversation-unshare-api` capability for the full conversation-specific behavior

### Requirement: `libs/catalog` exposes a mutually-exclusive Share/recipient Delete header action

`libs/catalog/src/components/Details/Header/ShareButton/ShareButton.tsx`'s `ShareButtonProps` SHALL retain the internal `onUnshare?: (item: CatalogItem) => void` callback and `unshareLabel?: string` prop alongside the existing `onShare`/`shareOverlay`/`label` props. The internal names describe the recipient-side discard operation; the user-facing action SHALL be presented as Delete. The component SHALL render:
- the existing Share action when `item.isMyApp === true` (unchanged gating, unchanged behavior), OR
- a Delete action when `item.sharedWithMe === true` and `item.isMyApp !== true`, using the Tabler direction-neutral `IconTrash` icon (no `rtl:scale-x-[-1]` mirroring needed) and calling `onUnshare?.(item)` on click, OR
- nothing, when neither condition holds (e.g. public/organization items that are neither owned nor shared).

Both Share and recipient-side Delete are additionally hidden for `CatalogEntityType.Guardrail` and `CatalogEntityType.Mcp` items, matching Share's existing type exclusion.

Share and recipient-side Delete SHALL NEVER both render for the same item — the two gating conditions are mutually exclusive by construction (`isMyApp` and `sharedWithMe` cannot both be `true` for the same item, per the `catalog-shared-with-me` capability).

`libs/catalog/src/components/Details/Header/Header.tsx`, `libs/catalog/src/components/Catalog/Catalog.tsx`, and `libs/catalog/src/models/catalog-props.ts` (`CatalogProps`)/`item-details-props.ts` (`DetailsPanelProps`) SHALL thread the new `onUnshare` callback through identically to the existing `onShare` prop.

`libs/catalog` MUST NOT import the generated API client, server-api wrappers, app contexts, i18n, routes, notifications, or `/api` paths to implement this requirement — all translated label text and the mutation itself are supplied by the app layer via props/callbacks.

#### Scenario: Owned item shows Share, not recipient-side Delete

- **WHEN** `item.isMyApp === true` (regardless of `item.sharedWithMe`, which is always `false` for owned items per the `catalog-shared-with-me` capability)
- **THEN** the header renders the Share action and does not render the recipient-side Delete action

#### Scenario: Shared-with-me item shows Delete, not Share

- **WHEN** `item.isMyApp !== true` and `item.sharedWithMe === true`
- **THEN** the header renders the Delete action and does not render the Share action

#### Scenario: Public/organization item shows neither action

- **WHEN** `item.isMyApp !== true` and `item.sharedWithMe !== true`
- **THEN** the header renders neither Share nor recipient-side Delete

#### Scenario: READ-only and WRITE-shared items both show Delete

- **WHEN** `item.sharedWithMe === true`, regardless of whether `item.isEditable` is `true` (WRITE-shared) or `false` (READ-only shared)
- **THEN** the header renders the Delete action in both cases

#### Scenario: Clicking recipient-side Delete invokes the unshare callback

- **WHEN** a user clicks the rendered Delete action for a shared-with-me item
- **THEN** `onUnshare(item)` is called with the current `CatalogItem`

### Requirement: Accessible recipient-side Delete confirmation popup

`libs/catalog/src/components/Details/DetailsPanel.tsx` SHALL present an accessible confirmation popup before invoking the app-supplied `onUnshare`, reusing the `DialConfirmationPopup` component (`@epam/ai-dial-ui-kit`) already used for the existing direct-logout confirmation in this file, following the same local-state pattern (`isUnshareConfirmOpen`/`isUnsharing` booleans plus `handleRequestUnshare`/`handleCancelUnshare`/`handleConfirmUnshare` handlers). `DetailsPanel` passes its own `handleRequestUnshare` (which only opens the popup) as the `onUnshare` prop into `Header`/`ShareButton` — the app-supplied `onUnshare` prop on `DetailsPanelProps`/`CatalogProps` is only invoked by `handleConfirmUnshare` after the user confirms.

The popup SHALL:
- Open when the recipient-side Delete action (previous requirement) is clicked, instead of invoking the app-supplied `onUnshare` immediately.
- Display a title, a description interpolating the item's display name via a `(name: string) => string` text-override function (e.g. `texts.unshareConfirmMessage`) supplied by the app layer, not string concatenation inside the lib, a confirm label, and a cancel label — all as translated strings passed in as props/text, never hardcoded inside `libs/catalog`.
- On confirm: disable further submission (`isLoading`/disabled state) for the duration of the pending call, invoke the app-supplied `onUnshare(item)` callback exactly once, and close the popup once the callback's returned promise settles (success or failure).
- On successful confirm (the awaited `onUnshare(item)` resolves without throwing): additionally call the panel's own `onClose()` to close the whole details panel, since the item has just been removed from the caller's catalog — mirroring `DeleteButton`'s existing `onDeleted` callback pattern. On a rejected `onUnshare(item)`, the panel stays open and the item remains visible; failure feedback (e.g. a notification) is the caller's responsibility.
- On cancel or close (backdrop/Escape): close the popup and make no call to `onUnshare`.
- Be reachable and fully operable via keyboard: the trigger button, the popup's confirm button, and its cancel button SHALL each be focusable and activatable with keyboard alone; the popup SHALL use accessible dialog semantics equivalent to the existing logout confirmation popup (role, focus handling) provided by `DialConfirmationPopup`.
- Be reset (closed) whenever the open item changes, added to the existing item-change reset effect that already resets the logout-confirm state.

**i18n keys** (added to `CatalogI18nKeys` in `apps/chat/src/constants/translation-keys.ts` and `apps/chat/src/i18n/locales/en.json`, under `catalog.details.unshare.*`):
- `DetailsUnshareLabel` → `catalog.details.unshare.label` → "Delete" (used as both the button label and the popup's confirm label)
- `DetailsUnshareConfirmTitle` → `catalog.details.unshare.confirmTitle` → "Delete item?"
- `DetailsUnshareConfirmMessage` → `catalog.details.unshare.confirmMessage` → `Delete "{{name}}" from your catalog? You'll need a new invitation to access it again.`
- `DetailsUnshareErrorTitle` → `catalog.details.unshare.errorTitle` → "Delete failed"
- `DetailsUnshareError` → `catalog.details.unshare.error` → `Failed to delete "{{name}}". Please try again.`
- `DetailsUnshareSuccessTitle` → `catalog.details.unshare.successTitle` → "Deleted"
- `DetailsUnshareSuccess` → `catalog.details.unshare.success` → `"{{name}}" was deleted from your catalog.`

The `catalog.details.unshare.*` key namespace and all `onUnshare`/`handleUnshare` identifiers SHALL remain unchanged because only the presentation changes; the underlying operation is still recipient-side `discardSharedResources`, not owner-side resource deletion.

The popup's Cancel label reuses the existing generic `ButtonsI18nKeys.Cancel` (`buttons.cancel`) rather than a new feature-scoped key, per the repo's i18n key-dedup convention.

**RTL / direction impact**: the confirmation popup uses only logical Tailwind/CSS properties (inherited from `DialConfirmationPopup`); the Delete trigger icon (`IconTrash`) is symmetric/direction-neutral and is NOT mirrored with `rtl:scale-x-[-1]`. The interpolated item name is inserted via i18next placeholder substitution so bidi rendering of mixed-direction names is handled by the browser's Unicode bidi algorithm, not manual string concatenation.

**Accessibility**: confirm/cancel buttons carry accessible names (via the translated labels); the popup traps focus and returns focus to the triggering element on close, per `DialConfirmationPopup`'s existing behavior (no new accessibility mechanism introduced).

**Responsive**: the popup renders correctly at both `mobile` and `desktop` breakpoints using only the project's named Tailwind breakpoints if any catalog-specific styling is needed (none is expected beyond what `DialConfirmationPopup` already provides).

#### Scenario: Opening Delete shows the confirmation popup, not an immediate call

- **WHEN** a user clicks the Delete action for a shared-with-me item named "My Shared App"
- **THEN** a confirmation popup opens with the title "Delete item?" and a description containing "My Shared App"; the app-supplied `onUnshare` has not yet been called

#### Scenario: Confirm calls onUnshare exactly once and prevents duplicate submission

- **WHEN** a user clicks the confirm button in the open popup
- **THEN** `onUnshare(item)` is called exactly once, the confirm button becomes disabled/loading for the duration of the pending call, and a second rapid click while pending does not invoke `onUnshare` again

#### Scenario: Successful confirm closes the whole details panel

- **WHEN** the awaited `onUnshare(item)` call resolves successfully
- **THEN** the confirmation popup closes and the panel's `onClose()` is called, closing the whole details panel

#### Scenario: Failed confirm keeps the details panel open

- **WHEN** the awaited `onUnshare(item)` call rejects
- **THEN** the confirmation popup closes but the panel's `onClose()` is NOT called — the details panel stays open and the item remains visible

#### Scenario: Cancel makes no API request

- **WHEN** a user clicks the cancel button, presses Escape, or clicks the backdrop while the popup is open
- **THEN** the popup closes and `onUnshare` is never called

#### Scenario: Keyboard-only interaction completes the full flow

- **WHEN** a keyboard-only user tabs to the Delete trigger, activates it with Enter/Space, tabs to the confirm button in the resulting popup, and activates it
- **THEN** the same confirm behavior occurs as with a mouse click, with no loss of keyboard focus at any step

#### Scenario: Popup state resets when the open item changes

- **WHEN** the details panel's underlying `item` changes while the Unshare confirmation popup is open
- **THEN** the popup closes as part of the existing item-change reset effect

### Requirement: Catalog view integration — mutate, refetch, clear stale selection

`apps/chat/src/components/CatalogView/CatalogView.tsx` SHALL implement a `handleUnshare` handler, passed as `onUnshare` to the catalog library, that:
- Calls the frontend API wrapper (`apps/chat/src/server-api/share.api.ts`'s `discardSharedCatalogItem(item.id)`, itself a thin delegate to the generated `@epam/chat-api-client` method).
- On success: calls `refetchToolsets()` when `item.type === CatalogEntityType.Toolset`, otherwise `refetchDeployments()` (mirroring the existing `handleDelete` branch), both sourced from `useDeployments()` and already race-safe against slower in-flight requests via `DeploymentsContext`'s existing request-id-ref guard — no new sequencing logic is introduced.
- If that post-mutation refetch rejects, the discard SHALL still be treated as successful: clear a matching selection, show the success notification, and let the details panel close. A refresh failure SHALL NOT surface the mutation error notification or make the user retry an already-completed discard.
- On success, if the discarded item's id equals the current `selectedItemId` (from `useDeployments()`), calls `setSelectedItemId(null)` so no persisted or in-memory reference to the discarded id survives; `DeploymentsContext`'s existing initial-selection fallback chain (current selection if present → user config preference → operator default → `items[0]` → `null`) naturally re-derives a valid selection on the next `items` update.
- Shows a success notification (`catalog.details.unshare.successTitle`/`catalog.details.unshare.success`) on success, and an error notification (`catalog.details.unshare.errorTitle`/`catalog.details.unshare.error`) on failure, mirroring `handleDelete`'s existing notification pattern.
- On failure: does NOT call refetch, does NOT clear selection, and re-throws so the confirmation popup's pending state resolves correctly — the item remains visible in the catalog.

Closing the details panel on a successful unshare is owned by `DetailsPanel` itself (see the "Accessible Unshare confirmation popup" requirement's `onClose()` call), not by `CatalogView` — mirroring how `DeleteButton`'s existing `onDeleted` callback already closes the panel without any explicit action from `CatalogView`.

**Cache/state impact**: no new caching layer or React Context is introduced; this handler relies entirely on the BFF's server-side cache invalidation (`catalog-unshare`'s discard-endpoint requirement) and `DeploymentsContext`'s existing refetch functions.

**Feature flag**: none. Visibility is fully determined by `CatalogItem.sharedWithMe`; no `ENABLED_FEATURES`/`ENABLED_FEATURES_ROLES` gate applies, matching the existing Share/Delete actions in this surface.

**Memoisation**: `handleUnshare` SHALL be wrapped in `useCallback` with dependencies `[refetchToolsets, refetchDeployments, selectedItemId, setSelectedItemId, showNotification, t]`, matching the existing `handleDelete` pattern.

#### Scenario: Successful unshare of a non-selected application removes it and notifies

- **WHEN** `handleUnshare` succeeds for an application item that is not the currently selected deployment
- **THEN** `refetchDeployments()` is called, the item no longer appears in `items` on the next render, and a success notification is shown

#### Scenario: Successful unshare of a non-selected toolset removes it and notifies

- **WHEN** `handleUnshare` succeeds for a toolset item
- **THEN** `refetchToolsets()` is called (not `refetchDeployments`), the item no longer appears in `toolsets` on the next render, and a success notification is shown

#### Scenario: Unsharing the currently selected deployment clears the selection

- **WHEN** `handleUnshare` succeeds for an item whose id equals the current `selectedItemId`
- **THEN** `setSelectedItemId(null)` is called, and `DeploymentsContext`'s existing fallback chain determines the next selection (or `null` if the catalog is now empty) once `items` refreshes

#### Scenario: Unsharing a non-selected item leaves the current selection untouched

- **WHEN** `handleUnshare` succeeds for an item whose id does NOT equal the current `selectedItemId`
- **THEN** `setSelectedItemId` is not called, and the existing selection is preserved through the refetch

#### Scenario: Failed unshare preserves the item and shows an error

- **WHEN** the discard API call rejects (e.g. the BFF responds 403/502/503)
- **THEN** no refetch is triggered, the item remains in the catalog list and in the currently open details panel, `setSelectedItemId` is not called, and an error notification is shown

#### Scenario: Refetch failure does not reverse a successful discard

- **WHEN** the discard API call succeeds but the following deployments/toolsets refetch rejects
- **THEN** the handler still clears a matching selection and reports success, does not show the mutation error notification, and resolves so the details panel closes without inviting a retry of the completed discard

#### Scenario: Reloading after a successful unshare does not restore the item

- **WHEN** a user reloads the page after a successful unshare
- **THEN** the subsequent `GET /api/v1/deployments`/`GET /api/v1/toolsets` requests hit the BFF's now-invalidated cache, re-fetch from DIAL Core, and do not include the discarded item
