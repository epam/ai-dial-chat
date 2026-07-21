# Spec: conversation-share

## Purpose

Lets a user share a conversation (view-only) or a catalog entity (view or edit access) via a link that another user can open to accept an invitation and gain access to the shared resource through DIAL Core's resource-sharing API.
## Requirements
### Requirement: `ShareConversationPopoverContainer` creates a view-only share link for a conversation

`apps/chat/src/components/ShareConversationPopoverContainer/ShareConversationPopoverContainer.tsx` SHALL export a memoized `FC<Props>` where `Props` is:

```ts
interface Props {
  conversationPath: string;
  onClose: () => void;
}
```

The container itself only needs the resource path to create the link; the caller (`ConversationPanelView`) is responsible for tracking which conversation ID the open popover belongs to in its own state.

`ConversationPanelView` SHALL host the container inside a `DialPopup` (`size={PopupSize.Sm}`, `dividers={false}`, `hideClose`, `headerClassName="hidden"`), matching the centered-modal pattern already used by `RenameConversationPopup`/the delete `DialConfirmationPopup` in the same file — not the anchored `DialDropdown` pattern used by the catalog `ShareButton`, since `ConversationPanelView` has no ref to the row's "..." trigger (owned by `libs/conversation-panel`) to anchor to, and `SharePopover` has no close control of its own. `DialPopup` unconditionally renders its own header row even with no `header` prop, producing a visible empty bar above `SharePopover`'s own title/QR-toggle row; `hideClose` + `headerClassName="hidden"` collapse that native header entirely so `SharePopover`'s own header is the only one shown. Dismissal relies on `DialPopup`'s default `closeOnOutsideClick` and `SharePopover`'s own Escape handling — there is no dedicated close (X) button.

The container SHALL:
1. Call `useShareLink(conversationPath)` (unchanged, from `apps/chat/src/hooks/useShareLink/useShareLink.ts`) to resolve `{ data, isLoading, error, setAccess }`.
2. Render `<SharePopover>` from `@epam/ai-dial-share` with `url={data?.url}`, `isLoading`, `error`, `access={[ShareLinkAccess.View]}`, `canEditAccess={false}`, `onClose`, and a fully translated `labels` object (mirroring `SharePopoverContainer`'s `labels` shape).
3. NOT pass `onAccessChange` (or pass a no-op) since `canEditAccess={false}` means the access dropdown is never rendered.
4. NOT import `@epam/ai-dial-catalog` or any catalog-specific type.

#### Scenario: Opening the popover creates a view-only link

- **WHEN** `ShareConversationPopoverContainer` mounts with a valid `conversationPath`
- **THEN** `useShareLink` is called with `conversationPath` as `itemId`
- **AND** the rendered `SharePopover` receives `canEditAccess={false}`

#### Scenario: Loading state is shown while the link is being created

- **WHEN** `useShareLink` reports `isLoading: true`
- **THEN** `SharePopover` renders its loading state (no URL, no error)

#### Scenario: Error state is shown when link creation fails

- **WHEN** `useShareLink` reports a non-null `error`
- **THEN** `SharePopover` renders its error state using that error

#### Scenario: Closing the popover invokes onClose

- **WHEN** the popover's close control is activated
- **THEN** the `onClose` prop is called

### Requirement: Conversation share reuses the existing generic share-link endpoint

No new backend endpoint is introduced. `ShareConversationPopoverContainer` SHALL call the existing `getShareLink(itemId, access)` utility (`apps/chat/src/utils/share-link.ts`), which POSTs to `POST /api/v1/share` via `createShareLink` (`apps/chat/src/server-api/share.api.ts`), passing the conversation's DIAL Core resource path as `itemId` and `access: [ShareLinkAccess.View]`.

The backend `POST /api/v1/share` (`apps/chat-api/src/share/share.controller.ts`) `@ApiOperation.description` SHALL be updated to state it creates a share link "for a DIAL Core resource (catalog entity or conversation)", replacing the catalog-only wording. `CreateShareLinkDto`, response DTOs, status codes (201/400/401/429/502/503), and the `@Throttle({ limit: 20, ttl: 60000 })` rate limit are unchanged.

#### Scenario: Conversation itemId is accepted by the existing endpoint

- **WHEN** `POST /api/v1/share` is called with `{ itemId: '<owned-conversation-path>', access: ['view'] }`
- **THEN** the request is validated and proxied to DIAL Core exactly as any other `itemId`, with no conversation-specific validation branch

#### Scenario: Swagger description reflects conversation support

- **WHEN** the OpenAPI spec is generated (`npm run openapi`)
- **THEN** the `createShareLink` operation description mentions conversations as a valid shareable resource

### Requirement: Accepting a conversation share invitation redirects into the conversation, not the catalog

`ShareService.buildInvitationUrl` (`apps/chat-api/src/share/share.service.ts`) SHALL route the generated invitation URL based on the shared resource's `itemId`: when `itemId` starts with `conversations/` (the DIAL Core conversation resource-path prefix), the URL SHALL use the `/conversations/shared/:invitationId` path; otherwise it SHALL use the existing `/catalog/shared/:invitationId` path.

The frontend SHALL register `ROUTES.ConversationSharedInvitation = '/conversations/shared/:invitationId'` (`apps/chat/src/types/routes.ts`) alongside the existing `ROUTES.SharedInvitation`, both as top-level routes in `app.tsx` (not nested under `ChatLayout`).

`SharedInvitationPage` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) SHALL accept optional `getTargetRoute?: (itemId: string) => string` and `errorFallbackRoute?: string` props, defaulting to the existing catalog behavior (`${ROUTES.Catalog}?itemId=...` / `ROUTES.Catalog`) so no existing catalog-invitation behavior changes. A new `ConversationSharedInvitationPage` (`apps/chat/src/pages/ConversationSharedInvitation/`) SHALL render `SharedInvitationPage` with `getTargetRoute={getConversationRoute}` and `errorFallbackRoute={ROUTES.Root}`.

#### Scenario: Conversation share link routes to the conversation accept page

- **WHEN** `ShareService.createShareLink` is called with a conversation `itemId` (starting with `conversations/`)
- **THEN** the returned `url` uses the `/conversations/shared/:invitationId` path

#### Scenario: Catalog share link still routes to the catalog accept page

- **WHEN** `ShareService.createShareLink` is called with a catalog `itemId` (not starting with `conversations/`)
- **THEN** the returned `url` uses the existing `/catalog/shared/:invitationId` path

#### Scenario: Accepting a conversation invitation navigates into the conversation

- **WHEN** a user opens a `/conversations/shared/:invitationId` link and the invitation is accepted successfully
- **THEN** the app navigates to `getConversationRoute(itemId)`, not the catalog

#### Scenario: Accepting a conversation invitation that fails falls back to root, not the catalog

- **WHEN** accepting a conversation invitation fails
- **THEN** the app navigates to `ROUTES.Root` and shows an error notification

### Requirement: Only owned, non-readonly conversations can be shared

Sharing is offered only for conversations where `isReadonlyItem` is `false` (i.e. not `isReadonly`, `sharedWithMe`, or `publishedWithMe`). A conversation already shared with the current user (readonly) SHALL NOT expose a Share action, since only the owner's bucket path is guaranteed valid as an `itemId` for `POST /api/v1/share`.

#### Scenario: Owned conversation is shareable

- **GIVEN** a conversation with `isReadonly: false`, `sharedWithMe: false`, `publishedWithMe: false`
- **WHEN** the panel row's action menu is opened
- **THEN** a "Share" action is present

#### Scenario: Shared-with-me conversation is not shareable

- **GIVEN** a conversation with `sharedWithMe: true`
- **WHEN** the panel row's action menu is opened
- **THEN** no "Share" action is present

### Requirement: i18n — all new user-visible strings use translation keys

New user-visible strings (menu label, any conversation-share-specific popover copy) SHALL be added to `ConversationPanelI18nKeys` (or a dedicated `ShareI18nKeys` entry if reusing existing share-popover keys) in `apps/chat/src/constants/translation-keys.ts`, with English defaults added to `apps/chat/src/i18n/locales/en.json`. No hardcoded English string literals SHALL appear in the new container or the modified `ConversationPanelView.tsx`.

New keys:

| Key | English value |
|---|---|
| `conversationPanel.shareLabel` | `"Share"` |
| `share.visibilityNoteConversation` | `"This conversation and its updates will be visible to users with the link."` |

`ShareConversationPopoverContainer` SHALL pass `labels.visibilityNote` as `t(ShareI18nKeys.VisibilityNoteConversation)`, not the generic deployment-worded `ShareI18nKeys.VisibilityNote` ("This deployment and its updates will be visible..."). It SHALL NOT pass `visibilityNoteEdit`, since `canEditAccess` is always `false` for conversations and that string is only ever shown when edit access is both allowed and selected.

#### Scenario: Share menu label resolves via i18n

- **WHEN** `en.json` is loaded
- **THEN** `conversationPanel.shareLabel` resolves to `"Share"`

### Requirement: `getConversationRoute` rejects path-traversal segments

`getConversationRoute` (`apps/chat/src/constants/routes.ts`) is used both for known-good ids (row clicks, duplication results) and for a backend-returned id in the accept-invitation flow (`getTargetRoute={getConversationRoute}` in `ConversationSharedInvitationPage`), which is not guaranteed well-formed. After `normalizeConversationId`, it SHALL reject any path with an empty, `.`, or `..` segment by returning `ROUTES.Root` instead of building a `/conversations/...` route from the unsafe input — a silent, render-safe fallback rather than throwing, since `getConversationRoute` is also called synchronously during list rendering (`ConversationPanelView`'s `href` computation) where an exception would break the whole panel.

#### Scenario: Parent-directory traversal falls back to root

- **WHEN** `getConversationRoute('tenant/../../evil')` is called
- **THEN** it returns `'/'`, not a route containing `..`

#### Scenario: Current-directory segment falls back to root

- **WHEN** `getConversationRoute('tenant/./path')` is called
- **THEN** it returns `'/'`

#### Scenario: Empty segment (double slash) falls back to root

- **WHEN** `getConversationRoute('tenant//path')` is called
- **THEN** it returns `'/'`

#### Scenario: Well-formed ids are unaffected

- **WHEN** `getConversationRoute('tenant/path')` is called
- **THEN** it returns `'/conversations/tenant/path'` exactly as before

### Requirement: RTL — share popover trigger and dropdown item follow logical positioning

The new "Share" `DropdownItem` icon and menu entry SHALL use the same layout primitives as existing menu items (`pin`, `rename`, `duplicate`, `delete`) in `ConversationRow`/`DialDropdown`, which are already logical-property-based (`placement="bottom-end"`). No new physical-direction classes are introduced. The reused `SharePopover` component already follows RTL rules per its own spec/implementation in `libs/share`.

#### Scenario: Share menu item is positioned consistently with other actions in RTL

- **WHEN** `dir="rtl"` is set on the document
- **AND** the conversation row's action menu is opened
- **THEN** the "Share" item renders in the same logical position and direction as the other menu items

### Requirement: Accessibility — Share action and popover are keyboard and screen-reader accessible

The "Share" `DropdownItem` SHALL be reachable via the same keyboard navigation (arrow keys, Enter/Space, Escape) as existing row actions, since it is rendered through the same `DialDropdown`. The rendered `SharePopover` SHALL use its existing accessible labels (`accessAriaLabel`, `linkAriaLabel`, `qrCodeAriaLabel`, etc.), all supplied via i18n from `ShareConversationPopoverContainer`, matching `SharePopoverContainer`'s pattern.

#### Scenario: Share item is keyboard-activatable

- **GIVEN** focus is within the open row action dropdown
- **WHEN** the user navigates to the "Share" item with arrow keys and presses Enter
- **THEN** the share popover opens

### Requirement: Tests — `ShareConversationPopoverContainer`

Tests in `apps/chat/src/components/ShareConversationPopoverContainer/tests/ShareConversationPopoverContainer.spec.tsx` SHALL cover:
- Renders `SharePopover` with `canEditAccess={false}` for any conversation.
- Passes `conversationPath` as the `itemId` to `useShareLink`.
- Renders loading, error, and success states based on the hook's return value.
- Calls `onClose` when the popover requests close.

#### Scenario: Container renders with view-only access regardless of conversation

- **WHEN** `ShareConversationPopoverContainer` is rendered with any `conversationId`/`conversationPath`
- **THEN** `SharePopover` always receives `canEditAccess={false}`

### Requirement: Accepting an invitation peeks the shared resource before accepting it

`ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`) SHALL resolve the shared resource's `itemId` from a **peek** call to DIAL Core's `getInvitation(invitationId)` **without** the `accept` query parameter, before issuing a **separate** call with `accept=true` to perform the actual grant. The accepting call's response body SHALL NOT be relied upon for `itemId` resolution — DIAL Core returns an empty body (`Content-Length: 0`, no `error`) for the accepting call once the grant succeeds, even though its documented schema for `GET /v1/invitations/{id}` claims a full `Invitation` payload on any `200`.

Both calls SHALL forward the caller's DIAL Core access token via `Authorization: Bearer <token>`. An `error` response or thrown network/timeout error from either call SHALL map through the existing `mapDialHttpStatus`/`handleDialFetchError` machinery with a call-specific context string (`'peek invitation'` / `'accept invitation'`) for diagnosability — **except** when the accepting call returns `400` with a body indicating the caller already owns the resource (DIAL Core's own wording: a string containing `"already belong"`, e.g. `"Resource <id> already belong to you"`). DIAL Core returns this when the invited user opens their own share link, or re-opens a link they already accepted; the resource is already accessible to them, so `acceptInvitation` SHALL treat this specific case as a successful accept rather than throwing — proceeding to cache invalidation and summary resolution exactly as it does for a genuine `200`, using the `itemId` already resolved from the peek call. If the peek call succeeds but returns no `resources[0].url`, `acceptInvitation` SHALL throw `BadGatewayException('DIAL Core returned an invitation with no shared resource')` without attempting the accepting call.

#### Scenario: Peek call resolves itemId, accept call grants access

- **WHEN** `acceptInvitation(accessToken, invitationId, userSub)` is called for a valid, unexpired invitation
- **THEN** DIAL Core's `getInvitation` is called first without `accept`, and its `resources[0].url` becomes the returned `itemId`
- **AND** DIAL Core's `getInvitation` is called a second time with `accept=true`
- **AND** the accepting call's response body (or absence of one) does not affect the returned `itemId`

#### Scenario: Empty-bodied accept response no longer produces a 502

- **WHEN** the accepting call (`accept=true`) returns `200` with an empty body
- **THEN** `acceptInvitation` still resolves successfully with the `itemId` obtained from the earlier peek call

#### Scenario: Invitation with no shared resource fails at the peek step

- **WHEN** the peek call succeeds but its `resources` array is empty
- **THEN** `acceptInvitation` throws `BadGatewayException` and the accepting call is never issued

#### Scenario: Upstream error on either call maps to the correct HTTP status

- **WHEN** either the peek or the accept call returns a DIAL Core error status (e.g. 404) other than the already-owned `400` case
- **THEN** the corresponding Nest exception is thrown (e.g. `NotFoundException` for 404), tagged with which call failed in the log message

#### Scenario: Opening your own share link (or re-accepting an already-accepted one) succeeds instead of erroring

- **WHEN** the accepting call returns `400` with an error body containing `"already belong"` (case-insensitive)
- **THEN** `acceptInvitation` does not throw, logs that the resource is already owned by the user, and returns normally with `itemId` (and, when resolvable, `sharedDeployment`/`sharedToolset`) exactly as it would for a fresh accept — so the frontend still opens the item's details panel instead of showing an error notification

#### Scenario: A different 400 accept error still fails the call

- **WHEN** the accepting call returns `400` with an error body that does not indicate the resource is already owned (e.g. an expired invitation)
- **THEN** `acceptInvitation` throws `BadRequestException`, matching pre-existing behavior for other `400` responses

### Requirement: Accepting an invitation invalidates the user's deployments and toolsets list caches

After `acceptInvitation` resolves the shared `itemId` and successfully performs the accepting call, `ShareService` SHALL invalidate the accepting user's cached deployments list (`DeploymentsService.invalidateListCache(userSub)`) and cached toolsets list (`ToolsetsService.invalidateListCache(userSub)`) before returning. Both calls SHALL run concurrently (`Promise.all`). `ShareController.acceptInvitation` SHALL pass the session's `sub` (in addition to the existing access token and invitation id) so `ShareService` can key the invalidation per user.

Cache keys invalidated: `deployments:list:<userSub>` and `deployments:list:<userSub>:interface:<type>` for every non-`all` `DeploymentInterfaceType` (deployments, 30s TTL, normally invalidated only by this event or natural expiry); `toolsets:list:<userSub>` (toolsets, 30s TTL, same).

#### Scenario: Successful accept invalidates both list caches

- **WHEN** `acceptInvitation` completes successfully
- **THEN** `DeploymentsService.invalidateListCache` and `ToolsetsService.invalidateListCache` are both called with the accepting user's `sub`

#### Scenario: Cache invalidation runs before the response is returned

- **WHEN** the frontend calls `refetchDeployments()`/`refetchToolsets()` immediately after `acceptInvitation` resolves
- **THEN** the next `GET /api/v1/deployments` / `GET /api/v1/toolsets` request is a cache miss and reflects the newly shared resource

### Requirement: Frontend refetches deployment/toolset lists before navigating past an accepted invitation

`SharedInvitationPage` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) SHALL call `useDeployments()`'s `refetchDeployments()` and `refetchToolsets()` (via `Promise.all`, awaited) after a successful `acceptInvitation` and before calling `navigate(getTargetRoute(itemId), { replace: true })`. These calls remain a consistency backstop; they are no longer the mechanism the details panel depends on to find the newly-shared item (see "Accepting an invitation resolves and returns the shared item's summary" below).

`SharedInvitationPage` SHALL call `useDeployments()`'s `mergeSharedItem(item)` with the `sharedDeployment`/`sharedToolset` value from `acceptInvitation`'s response, **after** the `refetchDeployments()`/`refetchToolsets()` call above has resolved and **before** calling `navigate(...)`, whenever that field is present. This order is required, not incidental: `refetchDeployments`/`refetchToolsets` fully replace `DeploymentsContext`'s `rawDeployments`/`toolsets` arrays with whatever DIAL Core's bulk list returns, so merging before (or in parallel with) the refetch lets a stale bulk-list response — one that has not yet propagated the just-granted share — silently overwrite the merged item and remove it again. Running the merge after the refetch guarantees the backend-resolved item always wins. When neither field is present (the backend could not resolve the item, e.g. an upstream propagation gap — see the new requirement below), `SharedInvitationPage` SHALL still proceed with the existing refetch-then-navigate behavior unchanged.

`CatalogView` (`apps/chat/src/components/CatalogView/CatalogView.tsx`) SHALL treat the `itemId` search param (`CatalogQuery.ItemId`) it reads into `initialDetailsItemId` as a one-shot signal: after reading a non-empty value for a render, it SHALL clear that param from the URL via `setSearchParams` with `{ replace: true }`, so the param does not linger in the address bar once consumed.

`Catalog`'s (`libs/catalog/src/components/Catalog/Catalog.tsx`) `initialDetailsItemId`-applied guard (`appliedInitialDetailsItemIdRef`) SHALL reset to `null` whenever the incoming `initialDetailsItemId` prop is falsy, so that a later non-empty value — including a repeat of an id that was already applied earlier in the same component's lifetime — is treated as a fresh open request rather than being silently suppressed.

#### Scenario: Catalog details panel opens for the newly shared item on a fresh full-page navigation

- **WHEN** a user accepts a share invitation for an application or toolset via a full-page navigation to `/catalog/shared/:invitationId`, and `acceptInvitation`'s response includes a resolved `sharedDeployment`/`sharedToolset`
- **THEN** `SharedInvitationPage` merges that item into `DeploymentsContext` via `mergeSharedItem` before navigating to `${ROUTES.Catalog}?itemId=<id>`, so `DeploymentsContext`'s `items`/`toolsets` already include the shared resource by the time `CatalogView` mounts — independent of whether `GET /api/v1/deployments`/`GET /api/v1/toolsets` themselves reflect the grant yet — and `Catalog`'s `initialDetailsItemId` effect finds a match and opens the details panel

#### Scenario: Merge survives a refetch response that still lacks the newly-shared item

- **WHEN** `refetchDeployments()`/`refetchToolsets()` resolves with a bulk list that does not yet include the just-accepted item (DIAL Core has not propagated the grant yet), and `acceptInvitation`'s response included a resolved `sharedDeployment`/`sharedToolset`
- **THEN** `mergeSharedItem` still runs, after the refetch, and the shared item is present in `DeploymentsContext`'s `items`/`toolsets` — the stale refetch result does not silently remove it

#### Scenario: Falls back to refetch-only behavior when the backend can't resolve the item

- **WHEN** `acceptInvitation`'s response has neither `sharedDeployment` nor `sharedToolset` set
- **THEN** `SharedInvitationPage` does not call `mergeSharedItem` and proceeds exactly as before: `refetchDeployments()`/`refetchToolsets()` then `navigate(...)`

#### Scenario: itemId query param is cleared after being consumed

- **WHEN** `CatalogView` reads a non-empty `itemId` param and passes it to `Catalog` as `initialDetailsItemId`
- **THEN** `CatalogView` removes `itemId` from the URL's search params via a replace navigation, so the address bar no longer shows `?itemId=<id>` once the details panel has picked it up

#### Scenario: Details panel reopens for a deployment already viewed earlier in the same tab

- **WHEN** a user accepts a second share invitation, within the same open tab, for a deployment whose details were already opened earlier in that tab's session (e.g. the same shared link opened twice, or a repeat share of the same item)
- **THEN** the details panel opens again for that deployment — the earlier open does not permanently suppress a later one

#### Scenario: Background refetch of the same open item does not reopen the panel

- **WHEN** `initialDetailsItemId` stays set to the same id across a re-render caused only by an unrelated `items`/`toolsets` background refetch (no new navigation occurred)
- **THEN** `Catalog`'s guard still prevents a duplicate `handleOpenDetails` call for that id, matching existing behavior

### Requirement: Accepting an invitation resolves and returns the shared item's summary

`ShareService.acceptInvitation` (`apps/chat-api/src/share/share.service.ts`) SHALL, after successfully accepting the invitation and invalidating the list caches, resolve the shared `itemId`'s type and summary using the same prefix convention already used by `DeploymentsService.getDeploymentDetails` (`toolsets/` prefix → toolset; `applications/` prefix → application; otherwise ambiguous — try `getModel` → `getApplication` → `getToolset` in turn, falling through to the next on a 404).

For a `toolsets/`-prefixed id, `ShareService` SHALL call a new `ToolsetsService.resolveToolsetItem(id, accessToken): Promise<DialToolsetDto | null>` and set `AcceptInvitationResponseDto.sharedToolset` to its result. For every other id, `ShareService` SHALL call a new `DeploymentsService.resolveDeploymentItem(id, accessToken): Promise<DeploymentItemDto | null>` (extracted from, and reusing, `fetchDeploymentDetails`'s existing prefix-dispatch/ambiguous-fallback logic, mapped through the existing `mapToDeploymentItem`) and set `AcceptInvitationResponseDto.sharedDeployment` to its result.

`AcceptInvitationResponseDto` (`apps/chat-api/src/share/dto/accept-invitation-response.dto.ts`) SHALL gain two new optional fields: `sharedDeployment?: DeploymentItemDto` and `sharedToolset?: DialToolsetDto`, each documented with `@ApiPropertyOptional`. The existing required `itemId` field is unchanged.

This resolution SHALL be best-effort: if the underlying DIAL Core call(s) fail, time out, or return no match, `resolveDeploymentItem`/`resolveToolsetItem` SHALL resolve `null` rather than throwing, and `acceptInvitation` SHALL still respond 200 with `itemId` set and both `sharedDeployment`/`sharedToolset` omitted — a resolution failure here MUST NOT fail the whole accept-invitation call, since the invitation was already successfully accepted upstream.

This change requires regenerating the OpenAPI spec (`npm run openapi`, `npm run openapi:check`) and rebuilding `chat-api-client` so the new optional response fields are available to the frontend.

#### Scenario: Accepted toolset invitation returns the toolset summary

- **WHEN** `acceptInvitation` succeeds for an invitation whose `itemId` starts with `toolsets/`
- **THEN** the response includes `sharedToolset` populated from `ToolsetsService.resolveToolsetItem`, and `sharedDeployment` is omitted

#### Scenario: Accepted application/model invitation returns the deployment summary

- **WHEN** `acceptInvitation` succeeds for an invitation whose `itemId` starts with `applications/`, or is an unprefixed model/application id
- **THEN** the response includes `sharedDeployment` populated from `DeploymentsService.resolveDeploymentItem`, and `sharedToolset` is omitted

#### Scenario: Resolution failure does not fail the accept call

- **WHEN** the underlying DIAL Core call(s) used to resolve the item's summary fail or return no match
- **THEN** `acceptInvitation` still responds 200 with `itemId` set, and both `sharedDeployment` and `sharedToolset` are omitted from the response

### Requirement: DeploymentsContext exposes a synchronous merge for a freshly-shared item

`DeploymentsContext` (`apps/chat/src/context/DeploymentsContext.tsx`) SHALL expose a new `mergeSharedItem(item: DeploymentItemDto | DialToolsetDto): void` method on its context value. Calling it with a `DeploymentItemDto` SHALL upsert that item into `rawDeployments` (replacing any existing entry with the same `id`, or prepending a new entry) via the existing `setRawDeployments` setter. Calling it with a `DialToolsetDto` SHALL upsert into `toolsets` the same way via `setToolsets`. `mergeSharedItem` SHALL NOT issue any network request itself and SHALL NOT interact with `deploymentsRequestIdRef`/`toolsetsRequestIdRef` — it is a synchronous local-state write, independent of `refetchDeployments`/`refetchToolsets`.

#### Scenario: Merging a new deployment item makes it immediately visible

- **WHEN** `mergeSharedItem` is called with a `DeploymentItemDto` whose `id` is not already in `rawDeployments`
- **THEN** the item appears in `DeploymentsContext`'s `items` on the very next render, with no network request issued

#### Scenario: Merging replaces an existing entry with the same id

- **WHEN** `mergeSharedItem` is called with a `DeploymentItemDto`/`DialToolsetDto` whose `id` already exists in `rawDeployments`/`toolsets`
- **THEN** the existing entry is replaced by the merged one rather than duplicated

#### Scenario: Merge does not disturb in-flight refetch sequencing

- **WHEN** `mergeSharedItem` is called while a `refetchDeployments()`/`refetchToolsets()` call is in flight
- **THEN** the in-flight refetch's eventual result is still applied or discarded solely based on `deploymentsRequestIdRef`/`toolsetsRequestIdRef`, unaffected by the merge

