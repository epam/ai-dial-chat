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

Both calls SHALL forward the caller's DIAL Core access token via `Authorization: Bearer <token>`. An `error` response or thrown network/timeout error from either call SHALL map through the existing `mapDialHttpStatus`/`handleDialFetchError` machinery with a call-specific context string (`'peek invitation'` / `'accept invitation'`) for diagnosability. If the peek call succeeds but returns no `resources[0].url`, `acceptInvitation` SHALL throw `BadGatewayException('DIAL Core returned an invitation with no shared resource')` without attempting the accepting call.

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

- **WHEN** either the peek or the accept call returns a DIAL Core error status (e.g. 404)
- **THEN** the corresponding Nest exception is thrown (e.g. `NotFoundException` for 404), tagged with which call failed in the log message

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

`SharedInvitationPage` (`apps/chat/src/pages/SharedInvitation/SharedInvitation.tsx`) SHALL call `useDeployments()`'s `refetchDeployments()` and `refetchToolsets()` (via `Promise.all`, awaited) after a successful `acceptInvitation` and before calling `navigate(getTargetRoute(itemId), { replace: true })`.

#### Scenario: Catalog details panel opens for the newly shared item

- **WHEN** a user accepts a share invitation for an application or toolset and is redirected to `${ROUTES.Catalog}?itemId=<id>`
- **THEN** `DeploymentsContext`'s `items`/`toolsets` already include the shared resource by the time `CatalogView` mounts, so `Catalog`'s `initialDetailsItemId` effect finds a match and opens the details panel

