## ADDED Requirements

### Requirement: `useConversationPanelItems` maps conversation DTOs to panel items via injected resolvers

`@epam/ai-dial-chat-hooks` SHALL export `useConversationPanelItems(params: { items:
ConversationListItemDto[]; deployments: DeploymentItemDto[]; isDeploymentsLoading: boolean;
toPanelConversationId: (id: string) => string;
resolveIconUrl: (deployment: DeploymentItemDto | undefined) => string | undefined; resolveIconTooltip:
(deployment: DeploymentItemDto | undefined, fallback: string) => string; resolveHref: (conversationId:
string) => string; resolveTaskBadge?: (item: ConversationListItemDto) => { label: string; isUnread:
boolean } | undefined }): ConversationItem[]`. The hook SHALL NOT import `react-i18next`, an application
Context, or an app routing module — every app-specific resolution (icon URL, localized tooltip text,
route construction, task-badge presentation) SHALL be supplied through the resolver parameters.

#### Scenario: Mapping produces one panel item per conversation
- **WHEN** `items` has 3 entries
- **THEN** the returned array has exactly 3 `ConversationItem`s, each with `id`/`title`/`source`/`href`
  derived from the corresponding entry and the injected resolvers

#### Scenario: Unresolvable deployment falls back to a decoded id
- **GIVEN** a conversation's model id does not match any entry in `deployments`
- **WHEN** the hook computes that item's icon tooltip
- **THEN** `resolveIconTooltip` is called with `deployment: undefined` and a decoded fallback string

#### Scenario: Icon loading state applies uniformly while deployments load
- **GIVEN** `isDeploymentsLoading` is `true`
- **WHEN** the hook computes every item
- **THEN** every item's `isIconLoading` is `true`

#### Scenario: Result recomputes only when inputs change
- **WHEN** the hook is called again with the same `items`/`deployments`/`isDeploymentsLoading` reference
- **THEN** the returned array reference is unchanged (memoized)

### Requirement: `getConversationSource` classifies ownership into a `FilterTab`

`@epam/ai-dial-chat-hooks` SHALL export (or re-export, if relocated alongside
`useConversationPanelItems`) a pure `getConversationSource(item: Pick<ConversationListItemDto,
'sharedWithMe' | 'publishedWithMe'>): FilterTab` returning `FilterTab.Shared` when `sharedWithMe` is
truthy, `FilterTab.Organization` when `publishedWithMe` is truthy (and `sharedWithMe` is falsy), and
`FilterTab.MyChats` otherwise.

#### Scenario: Shared takes precedence over published-with-me
- **WHEN** an item has both `sharedWithMe: true` and `publishedWithMe: true`
- **THEN** `getConversationSource` returns `FilterTab.Shared`

### Requirement: `useConversationLookupMaps` resolves panel-space ids back to context ids and raw items

`@epam/ai-dial-chat-hooks` SHALL export `useConversationLookupMaps(params: { items:
ConversationListItemDto[]; toPanelConversationId: (id: string) => string }):
{ toContextId: (panelId: string) => string | undefined; getRawItem: (panelId: string) =>
ConversationListItemDto | undefined }`, memoized over `items`, replacing the repeated
panel-id→context-id→raw-item double lookup previously inlined at each of `ConversationPanelView`'s
row-action call sites.

#### Scenario: Lookup resolves a known panel id
- **GIVEN** `items` contains a conversation whose panel-space id is `"panel-1"` and raw id is `"ctx-1"`
- **WHEN** `toContextId("panel-1")` and `getRawItem("panel-1")` are called
- **THEN** they return `"ctx-1"` and that conversation's raw DTO respectively

#### Scenario: Unknown panel id resolves to undefined
- **WHEN** `toContextId`/`getRawItem` is called with a panel id not present in `items`
- **THEN** both return `undefined`

### Requirement: `useActiveConversationSync` preserves the refetch-avoidance and mark-viewed effects

`@epam/ai-dial-chat-hooks` SHALL export `useActiveConversationSync(params: { activeConversationId:
string | undefined; items: ConversationListItemDto[]; refreshConversations: () => Promise<void>;
markConversationViewed: (id: string) => Promise<void>; conversationIdsMatch: (a: string, b: string) =>
boolean; toPanelConversationId: (id: string) => string })`. The hook SHALL run two effects: (1) if the
active conversation is not found in `items`, call `refreshConversations()`, deliberately excluding
`items`/`refreshConversations` from its own dependency array to avoid a refetch loop — this omission
SHALL be documented in the hook's JSDoc with the same rationale as the code it replaces; (2) when the
matching raw item changes, call `markConversationViewed(activeItem.id)`.

#### Scenario: Missing active conversation triggers exactly one refresh, not a loop
- **GIVEN** `activeConversationId` does not match any entry in `items`
- **WHEN** `items` changes again while `activeConversationId` stays the same
- **THEN** `refreshConversations` is not called a second time by that unrelated `items` change

#### Scenario: Selecting a conversation marks it viewed
- **WHEN** `activeConversationId` changes to a value matching an entry in `items`
- **THEN** `markConversationViewed` is called with that entry's raw id

### Requirement: `useAsyncConfirmDialog` is a generic single-slot pending/loading/error state machine

`@epam/ai-dial-chat-hooks` SHALL export `useAsyncConfirmDialog<T>(): { pending: T | null; isPending:
boolean; isRunning: boolean; error: string | null; open: (value: T) => void; close: () => void; confirm:
(run: (value: T) => Promise<void>, onError: (error: unknown) => string) => Promise<void> }`. `confirm`
SHALL be a no-op re-entry guard while `isRunning` is `true`; on failure it SHALL set `error` to
`onError(caughtError)` and leave `pending` set; on success it SHALL call `close()`.

#### Scenario: Opening sets pending and clears any previous error
- **WHEN** `open(value)` is called
- **THEN** `pending` is `value`, `isPending` is `true`, and `error` is `null`

#### Scenario: Confirm guards re-entry while running
- **GIVEN** `confirm` has been called and its `run` promise has not settled
- **WHEN** `confirm` is called again
- **THEN** the second call's `run` is not invoked

#### Scenario: Confirm failure sets the caller-resolved error and keeps the dialog open
- **WHEN** `confirm(run, onError)` is called and `run` rejects
- **THEN** `error` is `onError`'s return value and `pending` is unchanged (still set)

#### Scenario: Confirm success closes the dialog
- **WHEN** `confirm(run, onError)` is called and `run` resolves
- **THEN** `pending` becomes `null`, `isPending` becomes `false`, and `error` is `null`

### Requirement: `deriveConversationRowActionState` computes readonly/publish/revoke decision state

`@epam/ai-dial-chat-hooks` SHALL export `deriveConversationRowActionState(item: Pick<
ConversationListItemDto, 'sharedWithMe' | 'publishedWithMe' | 'isReadonly'>, publishHistory:
PublishHistoryEntry[] | undefined, recipients: RecipientsCountState): ConversationRowActionState` where
`ConversationRowActionState` is `{ isReadonly: boolean; publishedFolders: string[]; isRevokeVisible:
boolean; isPublishApplicable: boolean; isUnpublishApplicable: boolean }`. `isReadonly` SHALL be `true`
when `item.isReadonly`, `item.sharedWithMe`, or `item.publishedWithMe` is `true`. `publishedFolders` SHALL
be `publishHistory`'s folder paths deduplicated by their joined path, computed only when `isReadonly` is
`false`. `isRevokeVisible` SHALL be `true` when `recipients.status` is `Unknown`, or `Resolved` with a
count greater than `0`. `isPublishApplicable`/`isUnpublishApplicable` SHALL be mutually exclusive,
keyed on whether `publishedFolders` is empty.

#### Scenario: Readonly item skips publish-folder computation
- **WHEN** `item.sharedWithMe` is `true`
- **THEN** `isReadonly` is `true` and `publishedFolders` is `[]` regardless of `publishHistory`

#### Scenario: Published folders are deduplicated
- **GIVEN** `publishHistory` contains two entries whose folder paths join to the same string
- **WHEN** `deriveConversationRowActionState` is called
- **THEN** `publishedFolders` contains that path exactly once

#### Scenario: Publish and unpublish are mutually exclusive
- **WHEN** `publishedFolders` is non-empty
- **THEN** `isPublishApplicable` is `false` and `isUnpublishApplicable` is `true`

#### Scenario: Revoke is hidden when the recipient count resolves to zero
- **GIVEN** `recipients.status` is `Resolved` with `count: 0`
- **WHEN** `deriveConversationRowActionState` is called
- **THEN** `isRevokeVisible` is `false`

### Requirement: `useImportFilePicker` wraps the hidden file input without any i18n or context dependency

`@epam/ai-dial-chat-hooks` SHALL export `useImportFilePicker(params: { isMobile: boolean; accept?:
string; onFileSelected: (file: File) => void }): { inputRef: RefObject<HTMLInputElement | null>;
triggerImport: () => void; handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void }`.
`triggerImport` SHALL programmatically click the input; `handleFileChange` SHALL read
`event.target.files[0]`, call `onFileSelected` with it, and reset the input's `value` to `''` so
re-selecting the same file fires `onChange` again.

#### Scenario: Selecting a file calls the callback and resets the input
- **WHEN** the user selects a file through the hidden input
- **THEN** `onFileSelected` is called with that `File` and the input's value is reset to `''`

#### Scenario: Re-selecting the same file fires again
- **WHEN** the user selects the same file a second time in a row
- **THEN** `onFileSelected` is called again for that selection

### Requirement: Extracted controller code has no `apps/**` or i18n imports

Every hook and utility introduced by this capability SHALL have zero imports from `apps/**`, zero direct
`react-i18next` imports, zero React Router imports, zero application Context imports, zero feature-flag
imports, and zero translation-key imports. Each SHALL work correctly when any optional capability
(publishing, sharing, organization conversations, scheduled-task badges) it touches is absent from its
input.

#### Scenario: Architecture guard — no app or i18n imports in controller hooks
- **WHEN** `libs/chat-hooks`'s conversation-panel-controller module is linted and type-checked
- **THEN** no file in that module imports from `apps/**`, `react-i18next`, `react-router`, or an
  application Context

#### Scenario: Mapping hook works with no scheduled-task capability
- **WHEN** `resolveTaskBadge` is omitted from `useConversationPanelItems`'s params
- **THEN** every returned `ConversationItem` has `showTaskBadge`/`taskBadgeLabel`/`isUnread` all
  `undefined`, with no error thrown
