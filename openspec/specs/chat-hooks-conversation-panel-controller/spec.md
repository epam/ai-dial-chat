# chat-hooks-conversation-panel-controller Specification

## Purpose

Reusable conversation-panel controller hooks and utilities exported by `@epam/ai-dial-chat-hooks`, covering item mapping, lookup maps, active-conversation sync, async-confirm dialog state, row-action state derivation, and a file-picker helper — all without any app-specific imports (no i18n, no routing, no application Contexts).
## Requirements
### Requirement: `useConversationPanelItems` maps conversation DTOs to panel items via injected resolvers

`@epam/ai-dial-chat-hooks` SHALL export `useConversationPanelItems(params: { items:
ConversationListItemDto[]; deployments: DeploymentItemDto[]; isDeploymentsLoading: boolean;
toPanelConversationId: (id: string) => string;
resolveIconUrl: (deployment: DeploymentItemDto | undefined) => string | undefined; resolveIconTooltip:
(deployment: DeploymentItemDto | undefined, fallback: string) => string | undefined; resolveHref: (panelConversationId:
string) => string; resolveTaskPresentation?: (item: ConversationListItemDto) => { leadingIcon?: ReactNode;
isUnread: boolean } | undefined })` (`UseConversationPanelItemsParams`), returning an inferred array of
`ConversationItem`-compatible objects (`id`, `title`, `isPinned`, `iconUrl`, `iconTooltip`, `isIconLoading`,
`source`, `href`, plus `leadingIcon`/`isUnread` when task presentation applies) — the hook does not import the
panel lib's `ConversationItem` type. The hook SHALL NOT import `react-i18next`, an application
Context, an app routing module, or any UI-kit/icon component — every app-specific resolution (icon URL, localized
tooltip text, route construction, task-row presentation including the rendered icon node) SHALL be supplied through
the resolver parameters. When `resolveTaskPresentation` returns a value, the hook SHALL copy `leadingIcon` and
`isUnread` onto the resulting `ConversationItem` unchanged; when it returns `undefined` or is omitted, both fields
SHALL be absent. The hook maps exactly the `items` it is given — it does not group, collapse, or filter scheduled-task
runs (that display rule belongs to the host; see `scheduled-task-conversation-grouping`).

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

#### Scenario: Task presentation is copied onto the item
- **GIVEN** `resolveTaskPresentation` returns `{ leadingIcon: <span data-testid="task-icon" />, isUnread: true }` for one item
- **WHEN** the hook maps that item
- **THEN** the resulting `ConversationItem` has that same `leadingIcon` node and `isUnread: true`, and no `showTaskBadge`/`taskBadgeLabel` property

#### Scenario: Several runs of one task are all mapped
- **GIVEN** `items` contains three runs with the same `scheduleId`
- **WHEN** the hook maps them
- **THEN** it returns three `ConversationItem`s (collapsing is not the hook's job)

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
boolean; toPanelConversationId: (id: string) => string }): string | undefined`, returning the active
conversation's panel-space id. The hook SHALL run two effects: (1) if the
active conversation is not found in `items`, call `refreshConversations()`, deliberately excluding
`items`/`refreshConversations` from its own dependency array to avoid a refetch loop — this omission
SHALL be documented in the hook's JSDoc with the same rationale as the code it replaces; (2) once per
matching active identity (keyed on the active panel id and the matching item's raw id, so a list refresh
or rollback does not retry the write), call `markConversationViewed(activeItemId)`.

#### Scenario: Missing active conversation triggers exactly one refresh, not a loop
- **GIVEN** `activeConversationId` does not match any entry in `items`
- **WHEN** `items` changes again while `activeConversationId` stays the same
- **THEN** `refreshConversations` is not called a second time by that unrelated `items` change

#### Scenario: Selecting a conversation marks it viewed
- **WHEN** `activeConversationId` changes to a value matching an entry in `items`
- **THEN** `markConversationViewed` is called with that entry's raw id

### Requirement: `useAsyncConfirmDialog` is a generic single-slot pending/loading/error state machine

`@epam/ai-dial-chat-hooks` SHALL export `useAsyncConfirmDialog<T>(): AsyncConfirmDialogControls<T>`, i.e.
`{ pending: T | null; isPending: boolean; isRunning: boolean; error: string | null; open: (value: T,
returnFocusTo?: HTMLElement | null) => void; close: () => void; confirm: (run: (value: T) => Promise<void>,
onError: (error: unknown) => string) => Promise<void> }`. `confirm`
SHALL be a no-op while `isRunning` is `true` or `pending` is `null`; on failure it SHALL set `error` to
`onError(caughtError)` and leave `pending` set; on success it SHALL reset `pending`, `error` and `isRunning`
as `close()` does. A result that settles after `open`/`close` started a newer cycle SHALL be ignored.
When `pending` returns to `null`, the hook SHALL restore focus to `returnFocusTo`, or to the element that
held focus when `open` was called, if it is still connected.

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
PublishHistoryEntry[] | undefined, recipients: RecipientsCountEntry): ConversationRowActionState` where
`ConversationRowActionState` is `{ isReadonly: boolean; publishedFolders: string[]; isRevokeVisible:
boolean; isPublishApplicable: boolean; isUnpublishApplicable: boolean }`. `isReadonly` SHALL be `true`
when `item.isReadonly`, `item.sharedWithMe`, or `item.publishedWithMe` is `true`. `publishedFolders` SHALL
be `publishHistory`'s folder paths deduplicated by their joined path, computed only when `isReadonly` is
`false` and `publishHistory` is defined. `isRevokeVisible` SHALL be `true` when `recipients.status` is `RecipientsCountStatus.Unknown`, or `Resolved` with a
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

`@epam/ai-dial-chat-hooks` SHALL export `useImportFilePicker(params: { accept?: string;
onFileSelected: (file: File) => void }): { inputRef: RefObject<HTMLInputElement | null>;
triggerImport: () => void; handleFileChange: (event: ChangeEvent<HTMLInputElement>) => void }`.
`triggerImport` SHALL programmatically click the input; `handleFileChange` SHALL read
`event.target.files[0]`, call `onFileSelected` with it, and reset the input's `value` to `''` so
re-selecting the same file fires `onChange` again. The hook SHALL apply the host-resolved `accept`
value and remove the attribute when that value is omitted; it SHALL NOT decide breakpoint policy.

#### Scenario: Selecting a file calls the callback and resets the input
- **WHEN** the user selects a file through the hidden input
- **THEN** `onFileSelected` is called with that `File` and the input's value is reset to `''`

#### Scenario: Re-selecting the same file fires again
- **WHEN** the user selects the same file a second time in a row
- **THEN** `onFileSelected` is called again for that selection

#### Scenario: Host omits the accept policy
- **WHEN** the host passes `accept: undefined`
- **THEN** the hook removes the input's `accept` attribute without inspecting the viewport

### Requirement: Extracted controller code has no `apps/**` or i18n imports

Every hook and utility introduced by this capability SHALL have zero imports from `apps/**`, zero direct
`react-i18next` imports, zero React Router imports, zero application Context imports, zero feature-flag
imports, and zero translation-key imports. Each SHALL work correctly when any optional capability
(publishing, sharing, organization conversations, scheduled-task presentation) it touches is absent from its
input.

#### Scenario: Architecture guard — no app or i18n imports in controller hooks
- **WHEN** `libs/chat-hooks`'s conversation-panel-controller module is linted and type-checked
- **THEN** no file in that module imports from `apps/**`, `react-i18next`, `react-router`, or an
  application Context

#### Scenario: Mapping hook works with no scheduled-task capability
- **WHEN** `resolveTaskPresentation` is omitted from `useConversationPanelItems`'s params
- **THEN** every returned `ConversationItem` has `leadingIcon`/`isUnread` both `undefined`, with no error thrown

### Requirement: `useConversationPanelItems` keeps item identity for unchanged DTOs and resolves deployments in constant time

`useConversationPanelItems` (`libs/chat-hooks/src/conversation/useConversationPanelItems/useConversationPanelItems.ts`) SHALL resolve each item's deployment through lookup maps built once per `deployments` array reference:

- one map keyed on `id`;
- one map keyed on `reference`, keeping the first deployment for a duplicated reference.

The id map SHALL be consulted first and the reference map only on a miss. This reproduces `findDeploymentByIdOrReference`'s precedence and first-match semantics exactly. The per-item lookup is therefore O(1), and the whole mapping is O(N) instead of O(N × D).

The hook SHALL keep a per-DTO cache. When it recomputes because `items` changed, any DTO object that is referentially identical to one mapped in the previous computation SHALL produce the same `ConversationItem` object as before. This holds only while every other input is referentially unchanged: `deployments`, `isDeploymentsLoading`, `toPanelConversationId`, `resolveIconUrl`, `resolveIconTooltip`, `resolveHref` and `resolveTaskPresentation`. A change to any of those inputs SHALL rebuild every item. The cache SHALL hold entries only for the DTOs of the latest `items`, so it does not grow with list churn.

The mapping output per item is unchanged. So are the existing guarantees: every given item is mapped, no collapsing happens, and the returned array reference is the same when all inputs are unchanged.

The hook remains host-agnostic. Deployments, icon URLs, tooltips, hrefs and task presentation still arrive through the existing parameters, and no import of app code, i18n or network code is added. This adds no user-visible string, feature flag, cache TTL or telemetry.

#### Scenario: An unchanged DTO keeps its item across a list change

- **GIVEN** the hook has mapped `items = [a, b]` into `[A, B]`
- **WHEN** it is called with `items = [a, c]`, where `a` is the same object, and all other inputs are unchanged
- **THEN** the first returned item is the same object `A`, and the second is a new object mapped from `c`

#### Scenario: Changing a resolver rebuilds every item

- **GIVEN** the hook has mapped `items = [a]` into `[A]`
- **WHEN** it is called with the same `items` and a new `resolveHref` function
- **THEN** the returned item is a new object whose `href` comes from the new resolver

#### Scenario: Id match wins over reference match

- **GIVEN** deployment `X` with `id: "m1"` and deployment `Y` with `reference: "m1"`
- **WHEN** an item whose model id is `m1` is mapped
- **THEN** its icon and tooltip resolve from `X`

#### Scenario: Reference match is used when no id matches

- **GIVEN** a deployment with `id: "gpt-4o-2024"` and `reference: "gpt-4o"`, and no deployment with `id: "gpt-4o"`
- **WHEN** an item whose model id is `gpt-4o` is mapped
- **THEN** its icon and tooltip resolve from that deployment
