## MODIFIED Requirements

### Requirement: `useConversationPanelItems` maps conversation DTOs to panel items via injected resolvers

`@epam/ai-dial-chat-hooks` SHALL export `useConversationPanelItems(params: { items:
ConversationListItemDto[]; deployments: DeploymentItemDto[]; isDeploymentsLoading: boolean;
toPanelConversationId: (id: string) => string;
resolveIconUrl: (deployment: DeploymentItemDto | undefined) => string | undefined; resolveIconTooltip:
(deployment: DeploymentItemDto | undefined, fallback: string) => string; resolveHref: (conversationId:
string) => string; resolveTaskPresentation?: (item: ConversationListItemDto) => { leadingIcon?: ReactNode;
isUnread: boolean } | undefined }): ConversationItem[]`. The hook SHALL NOT import `react-i18next`, an application
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
