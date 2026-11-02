# project-conversations-ui Specification

## Purpose

The app and lib side of project chats: `ConversationPage` reading through `ConversationDataSourceContext`, `ProjectChatPage` hosting a project conversation, the host-agnostic list, panel and header in `libs/projects`, the project view's chat input and Chats list, and their i18n, responsive, RTL and accessibility requirements.

## Requirements

### Requirement: ConversationPage reads its data through ConversationDataSourceContext

`apps/chat/src/context/ConversationDataSourceContext.tsx` SHALL follow the `ThemeContext` pattern (`createContext<T | undefined>`, a memoised value, a guard hook). It provides a `ConversationDataSource` to `ConversationPage` (`apps/chat/src/pages/Conversation/Conversation.tsx`):

| Member | Type | Purpose |
| --- | --- | --- |
| `transport` | `ConversationStreamTransport` | stream, stop, attach and get for `useConversationStream` |
| `getConversation` | `(id, signal?) => Promise<ConversationResponseDto>` | load and custom-viewer reload |
| `saveConversation` | `(path, body) => Promise<ConversationResponseDto>` | model change, status messages |
| `handlersApi` | `Pick<ConversationsApi, 'saveConversation' \| 'deleteConversation'>` | `useConversationHandlers` |
| `watchTitle` | `(id, previousName, onUpdated) => () => void` | the title update after the first reply |
| `getConversationRoute` | `(id) => string` | navigation after duplicate or custom-viewer create |
| `getExitRoute` | `() => string` | where a deleted or missing conversation navigates |
| `isReadOnly` | `(id) => boolean` | read-only mode |
| `listSync` | `{ updateTitle, bumpActivity, remove, refresh } \| null` | sidebar list side effects |
| `canDuplicate` | `boolean` | the read-only Duplicate action |
| `notFoundMessageKey` | optional `ProjectsI18nKeys` | the toast when the conversation cannot be loaded; the page's own message when unset |

**Default value.** `regularConversationDataSource` (`apps/chat/src/utils/regular-conversation-data-source.ts`) wraps exactly today's calls:

- `conversationStreamTransport`;
- `server-api/conversations.api.ts`;
- `ConversationsContext`'s watch and list functions;
- `getConversationRoute`, `ROUTES.Root`;
- the bucket-based read-only rule.

The provider supplies it at `AppRoot` level, so `/conversations/*` and `/` behave exactly as before. `useConversationDataSource` returns the nearest provided value, or the regular one when no provider overrides it (it needs `ConversationsContext`, so it fails outside `ConversationsProvider`), which keeps a bare `<ConversationPage />` working as before.

**Project value.** `createProjectConversationDataSource({ projectId, canEdit })` (`apps/chat/src/utils/project-conversation-data-source.ts`) uses:

- `createChatStreamApi({ completionsBasePath: '/api/v1/projects/{encodeURIComponent(projectId)}/conversations' })`, plus `getProjectConversation` for the transport;
- `server-api/project-conversations.api.ts` for get, save and delete;
- `watchTitle`: re-reads the conversation after the first reply completes, up to 5 times with the backoff `refreshConversations` uses, and reports a changed `name`;
- `getConversationRoute = getProjectConversationRoute`;
- `getExitRoute = () => getProjectViewRoute(projectId)`;
- `isReadOnly = () => !canEdit`;
- `listSync: null`;
- `canDuplicate: false`.

`transport.watchConversation` resolves without opening a subscription.

The direct server-api calls, the `/conversations` routing and the read-only rule in `ConversationPage` SHALL move behind the data source. The component then has no import of `server-api/conversations.api`. The data-source objects are module constants or `useMemo` keyed by `projectId` and `canEdit`, so the page's effects do not re-run on every render.

#### Scenario: Regular chat is unchanged

- **WHEN** the existing `ConversationPage` tests run against the default provider
- **THEN** they pass without changes, and the same server-api calls are made

#### Scenario: Project chat streams through the project base path

- **WHEN** a message is sent in `projects/a1b2c3/q4/conversations/x`
- **THEN** the request goes to `POST /api/v1/projects/projects%2Fa1b2c3%2Fq4/conversations/completions` with `path: 'a1b2c3/q4/conversations/x'`

#### Scenario: Missing project conversation exits to the project

- **WHEN** loading a project conversation fails with `404`
- **THEN** a `projects.chat.notFound` error toast is shown, the router is at the project's view route, and no sidebar list function is called

### Requirement: ProjectChatPage hosts a project conversation

`ProjectChatPage` (`apps/chat/src/pages/ProjectChatPage/ProjectChatPage.tsx`), at `ROUTES.ProjectChat`, SHALL:

- render `NotFoundPage` when `projectsEnabled` is off;
- parse the route with `parseProjectConversationRouteParams`. On `null` it renders the project not-found state with a link back to `/projects`;
- load the project with `useProject(projectId)` for its name and `canEdit`. When the opening project page passed `ProjectChatNavigationState.project` (`apps/chat/src/models/project-chat.ts`) for the same project id in router state, the page renders the chat from it at once, captured on mount because `ConversationPage` clears the router state, and the details replace it when they arrive; a details failure other than `404` then keeps the chat open. Without it, `Spinner` shows while loading;
- wrap `ConversationPage` in `ConversationDataSourceContext.Provider` with the project value, and pass it the parsed `conversationId` (the page's optional `conversationId` prop; it defaults to the `/conversations/*` splat);
- render a breadcrumb (`ProjectChatHeader`). On desktop it is portalled into the start cell of `ChatLayout`'s top bar through `ChatLayoutHeaderSlotContext` (`apps/chat/src/context/ChatLayoutHeaderSlotContext.tsx`), beside the sources toggle, with no border of its own; on mobile, where that bar is hidden, it is a bar above the conversation: a back `GhostIconButton` named `projects.chat.backToProject` (with `IconArrowNarrowLeft`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`), then the project name truncated with `EllipsisTooltip`, linking to `getProjectViewRoute(projectId)`.

The page owns no conversation state: `ConversationPage` and `GenerationContext` own it, as for a regular chat. The generation-registry key is the stripped path `{bucket}/{projectPath}/conversations/{name}`. It begins with a bucket id and therefore does not collide with a regular bucket-relative path in practice.

#### Scenario: Read-only shared project chat

- **WHEN** a user opens a conversation of a project shared with them
- **THEN** the conversation renders read-only: no input and no regenerate or edit actions, and no Duplicate action

#### Scenario: Back to project

- **WHEN** the user activates the breadcrumb's back button
- **THEN** the router is at `getProjectViewRoute(projectId)`

### Requirement: ProjectConversationList is a host-agnostic list in libs/projects

`libs/projects` SHALL export `ProjectConversationList` (`libs/projects/src/components/ProjectConversationList/ProjectConversationList.tsx`) and its `ProjectConversationListProps`, `ProjectConversationListItem`, `ProjectConversationListLabels` and `ProjectConversationListColors` types. It imports no REST path, flag, i18n, router or app context.

| Prop | Type |
| --- | --- |
| `items` | `ProjectConversationListItem[]`, where an item is `{ id: string; title: string; authorName?: string; isUnread?: boolean }` |
| `isLoading` | optional `boolean` |
| `hasError` | optional `boolean` |
| `onRetry` | `() => void` |
| `onOpen` | `(id: string) => void` |
| `onRename` | optional `(id: string) => void`; the menu item is hidden when omitted |
| `onDelete` | optional `(id: string) => void`; the menu item is hidden when omitted |
| `labels` | `ProjectConversationListLabels`, including the optional `unreadLabel` (default `'Unread'`) and `loadMoreLabel` (default `'See more'`) |
| `typography` | optional `ProjectConversationListTypography`, including `unreadRowTitleClassName` (default `'dial-body-semi-text'`) |
| `colors` | optional `ProjectConversationListColors` `{ readDot?: string; unreadDot?: string }`, applied with `buildCssVars` as `--pcl-read-dot` and `--pcl-unread-dot` |

**Rendering:**
- a `<section>` named by its `<h2>` `labels.title` ("Chats"). While the project has no chats (not loading, no error, no items) the heading is not rendered and the section is named by `aria-label={labels.title}` instead, so only the empty state shows, as in the design;
- the section has `12px` top padding and `8px` between the heading, the rows and the See more link, as in the design (Figma *DIAL Chat 2.0 — Projects*, frame "Chat - View project - Unpinned", node `1:2407`);
- a `<ul>` with one `<li>` per item, `8px` apart. Each row is a button named `labels.openLabel(title, authorName)`, with `12px` padding, a `12px` radius and `12px` between its parts, containing:
  - the **status point**, an `aria-hidden` `16px` slot holding a `7.11px` circle: an outline when the chat is read (`.readDot { border: 1.5px solid var(--pcl-read-dot, var(--stroke-secondary, #d1dbea)); }`) and a fill when it is unread (`.unreadDot { background: var(--pcl-unread-dot, var(--text-accent, #1d4ed8)); }`), both in `ProjectConversationList.module.scss`. It replaces the author avatar of the earlier design; the author stays in the accessible name;
  - the title in `dial-body-text` (16/24), truncated to one line with `EllipsisTooltip`, or in `typography.unreadRowTitleClassName` when `isUnread`.

  Rows have the design's hover and focus-visible background (`--bg-accent-primary-alpha` fallback).
- **Unread rows** (`isUnread: true`) follow the indicator rows of `ConversationRow` in `libs/conversation-panel`, which this lib does not import: the filled point and the semibold title. The row button carries `aria-describedby` pointing to a visually hidden `<span>` with `labels.unreadLabel`, so screen readers announce "…, Unread" after the accessible name without changing it. A read row has the outline point and no description. The point is always visible.
- when `onRename` or `onDelete` is supplied, a ⋮ kit `Dropdown` per row, triggered by a `GhostIconButton` named `labels.moreActionsLabel(title)`, with Rename and Delete. The arrow keys, Enter and Space come from the kit. The design shows rows without a trigger, so on `desktop` the trigger is transparent (`desktop:opacity-0`) until the row is hovered or holds focus, and it stays visible while its menu is open. It stays in the tab order, so focusing it reveals it. On `mobile`, which has no hover, it is always visible.
- with `hasMore` and `onLoadMore`, a kit `LinkButton` (`labels.loadMoreLabel`, default `'See more'`) at the inline start follows the rows, disabled while `isLoadingMore`.
- **States:**
  - loading: `Spinner` with `labels.loadingLabel`;
  - error: `labels.errorLabel` and a retry `Button`;
  - empty: `PanelEmptyState` with the list illustration, `labels.emptyTitle` ("No outputs or chats yet") and `labels.emptyDescription` ("Your outputs and chats will appear here once started.").
- Error and empty text are in a `role="status"` region.
- Rows are keyed by `id`, so an item that changes title or unread state in place keeps its DOM node and any focus inside it.

`ProjectView`'s Details panel and this list are independent: the host passes the list in `mainContent`.

The component's stylesheet ships in the lib's existing `./styles.css` export, and the README's colour table lists `--pcl-read-dot` and `--pcl-unread-dot` (`.claude/rules/libs.md`, `lib-theming`).

#### Scenario: Read row shows an outline point

- **WHEN** an item is read
- **THEN** its row starts with an outline status point, no avatar renders, and the title follows it

#### Scenario: Row menu appears on hover on desktop

- **WHEN** the owner's list renders on `desktop` and no row is hovered or focused
- **THEN** every ⋮ trigger is transparent, and hovering or focusing a row shows its trigger

#### Scenario: Read-only list has no row menu

- **WHEN** `ProjectConversationList` renders without `onRename` and `onDelete`
- **THEN** no ⋮ trigger renders, and rows still open on click

#### Scenario: Empty state

- **WHEN** `items` is empty and neither `isLoading` nor `hasError` is set
- **THEN** "No outputs or chats yet" and its description render

#### Scenario: Keyboard opens a row

- **WHEN** a row has focus and the user presses Enter
- **THEN** `onOpen(id)` is called

#### Scenario: Unread row is announced

- **WHEN** an item has `isUnread: true` and `labels.unreadLabel` is "Unread"
- **THEN** its row button has an accessible description of "Unread", its title uses `dial-body-semi-text`, and its status point is filled

#### Scenario: Read row has no indicator

- **WHEN** an item has no `isUnread`
- **THEN** its status point is an outline, no accessible description renders, and the title uses `dial-body-text`

#### Scenario: A row turns unread in place

- **WHEN** a row has keyboard focus and its item changes to `isUnread: true`
- **THEN** focus stays on that row, and its status point fills at once

### Requirement: The project view's main column holds the chat input and the Chats list

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL own the Chats list state through `useProjectConversations(projectId)` (`apps/chat/src/hooks/projects/useProjectConversations.ts`, the adapter of `libs/chat-hooks/src/project/use-project-conversations.ts`). It passes that state to `ProjectConversationsSection` (`apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`) as the new `conversations` prop, together with an optional `outputs` node (the page's `ProjectOutputs`, see the `project-view-ui` capability), and passes the section to `ProjectView` as `mainContent`. The page owns the state so the project watch can refresh it (see the `project-view-live-updates` capability).

The section renders:

1. **The chat input, only when `project.canEdit`.**
   - It is `NewConversationComposer` with a new `ComposerLayout.Embedded` (`apps/chat/src/types/conversation-composer.ts`): no greeting, no page footer (`FooterMessage`: operator message and app version), the input in normal flow at the top of the column, with the model selector, attachments, tools, the `+` menu's Prompts and Skills entries, the `/` command menu, skill mentions (sent as the first message's `skills`, restored on a failed create) and the deployment's `isChatMessageInputDisabled`, exactly as on the new-conversation screen. Both screens take the prompt and skill wiring from one hook, `useComposerMenus` (`apps/chat/src/hooks/conversation/useComposerMenus.tsx`), so the two composers cannot drift apart.
   - The selection comes from `DeploymentsContext`, and the section calls `restoreDefaultSelection` on mount, as `ConversationRoute` does, so a model restored from a viewed chat does not leak in.
   - Its placeholder is the shared `chat.placeholder` ("How can I help you today?").
2. **The Outputs section, when `outputs` is set**, for every reader (owner or not).
   - The section passes `outputs` to `ProjectConversationsPanel`'s new `outputs?: ReactNode` slot (`libs/projects/src/models/project-conversations-panel-props.ts`, documented as "Content between `composer` and the Chats list; omitted when unset").
   - The panel renders `composer`, then `outputs`, then `ProjectConversationList`, with no wrapper of its own around `outputs`, so the host's node sits in the column's flow. The panel knows nothing about outputs beyond the slot.
3. **`ProjectConversationList`**, fed by the `conversations` prop.
   - The hook owns `{ items, isLoading, hasError, hasMore, isLoadingMore, retry, loadMore, rename, remove, refresh, markViewed }` in local state. It follows the `useFavicon` pattern: `AbortController` cleanup, async/await.
   - While `hasMore`, the list ends with a See more link (`buttons.seeMore`). `loadMore` requests the next page with `offset` set to the rows already listed, appends it without repeating a row, and a failure keeps the rows and shows `projects.chats.error`.
   - Items map from `ProjectConversationItemDto` (`title`, `author` → `authorName`, `isUnread`).
   - `refresh()` re-reads the rows already shown, silently:
     - it reads from `offset: 0` in pages of at most 100 rows (`limit = min(100, rows still to cover)`) until it has covered `max(items.length, 50)` rows or a page answers `hasMore: false`;
     - it then replaces `items` and `hasMore` in one update, so new, renamed, deleted and newly answered chats appear without a reload;
     - it never sets `isLoading` or `hasError`, and a failure keeps the current rows;
     - a newer `refresh`, a `retry`, a project change or unmount aborts it;
     - a `loadMore` that settles after a refresh started is dropped, so pages never interleave.
   - `markViewed(id)` sets that item's `isUnread` to `false` immediately, fires `client.markProjectConversationViewed?.(id)` without awaiting it, and swallows its failure. Until a later read reports a newer `updatedAt` for that item, every `refresh` result keeps it read. This hides the old dot when a refresh that started before the mark lands after it.

**First message.** Submitting the input SHALL:

1. call `createProjectConversation(projectId, …)` with the same fields `ConversationRoute`'s `handleCreateConversation` sends;
2. save the prompt, temperature and response format through `saveProjectConversation`;
3. `navigate(getProjectConversationRoute(conversation.id), { state: { conversation } })`.

`ConversationPage` then starts the stream, as for a new regular chat. A `413 project-storage-full` shows `projects.chats.storageFull`; other failures show `projects.chats.createError`. In both cases the draft is kept.

**Row actions:**
- `onOpen` (every reader) calls `conversations.markViewed(id)`, then navigates to the project chat route.
- `onRename` (owner only) opens a kit `Popup` named `projects.chats.renameTitle`, with a labelled `Input` seeded with the title and Save and Cancel buttons (`buttons.save`, `buttons.cancel`). Save, or Enter in the input, trims the value, refuses an empty one inline (`projects.chats.renameEmpty`), and calls `renameProjectConversation`.
- `onDelete` (owner only) opens `DeleteConfirmationDialog` with `projects.chats.deleteConfirmTitle` (`{{title}}`) and `projects.chats.deleteConfirmDescription`, then calls `deleteProjectConversation`.

Success updates the list in place and shows a toast. Failure shows `projects.chats.renameError` or `projects.chats.deleteError`. Neither dialog can be closed while its request is pending. When a refresh removes the row a rename or delete dialog was opened for, the dialog closes and focus moves to the list.

After a delete, the project view's chat count (the delete-project message and the publish warning) drops by one without a reload. A later silent `refresh()` of the project resets the count to the BFF's `conversationCount`.

**Read-only** (`canEdit: false`): no input, and `onRename`/`onDelete` are omitted. The list still opens chats and marks them viewed.

The section labels pass `unreadLabel: t(ConversationPanelI18nKeys.UnreadIndicatorLabel)`, which reuses `conversationPanel.unreadIndicatorLabel`, through `useProjectConversationsPanelLabels`.

Handlers are memoised with `useCallback`, and the mapped items with `useMemo`.

#### Scenario: Outputs sit between the input and the Chats list

- **WHEN** the owner opens a project with one output and two chats
- **THEN** in document order the chat input comes first, then the Outputs heading and card, then the Chats heading and its rows

#### Scenario: The panel renders no outputs slot when unset

- **WHEN** `ProjectConversationsPanel` renders with a `composer` and no `outputs`
- **THEN** the Chats list directly follows the composer, and the rendered markup is unchanged from before

#### Scenario: First message opens the new chat

- **WHEN** the owner types a message and sends it on the project page
- **THEN** `createProjectConversation` is called, and the router is at `/projects/chat/{bucket}/{projectPath}/conversations/{name}`, where the reply streams

#### Scenario: Shared project shows chats without the input

- **WHEN** a shared project with two conversations is opened
- **THEN** the Chats list shows both without row menus, and no chat input renders

#### Scenario: Rename from the list

- **WHEN** the owner renames a row to `Login article`
- **THEN** `renameProjectConversation` is called with `newTitle: 'Login article'`, and the row shows the new title

#### Scenario: Live refresh adds a new chat

- **WHEN** a collaborator's tab creates chat D and the page's watch triggers `refresh()`
- **THEN** D appears at the top of the list, and no spinner renders

#### Scenario: Refresh keeps loaded pages

- **WHEN** 120 rows are listed after two `loadMore` calls and `refresh()` runs
- **THEN** it reads `offset 0, limit 100` and `offset 100, limit 20`, and the list still shows up to 120 rows plus any new ones

#### Scenario: Opening marks the chat read

- **WHEN** a reader activates an unread row
- **THEN** `markProjectConversationViewed` is called with its id, and the row is read before the route changes

### Requirement: Project conversation strings flow through react-i18next

New strings SHALL be added to `apps/chat/src/i18n/locales/en.json` and to `ProjectsI18nKeys` (`apps/chat/src/constants/translation-keys.ts`), resolved in `useProjectConversationListLabels` (`apps/chat/src/hooks/projects/useProjectConversationListLabels.ts`), which memoises on `t`:

- `projects.view.mainContent` ("Project chats");
- `projects.chats.title` ("Chats");
- `projects.chats.empty` ("No outputs or chats yet");
- `projects.chats.emptyDescription` ("Your outputs and chats will appear here once started.");
- `projects.chats.loading`, `projects.chats.error`;
- `projects.chats.openLabel` ("{{title}}, by {{author}}") and `projects.chats.openLabelNoAuthor` ("{{title}}");
- `projects.chats.moreActions` ("More actions for {{title}}");
- `projects.chats.renameTitle`, `projects.chats.renameInputLabel`, `projects.chats.renameEmpty`, `projects.chats.renameSuccess`, `projects.chats.renameError`;
- `projects.chats.deleteConfirmTitle`, `projects.chats.deleteConfirmDescription`, `projects.chats.deleteSuccess`, `projects.chats.deleteError`;
- `projects.chats.createError`, `projects.chats.storageFull`;
- `projects.chat.backToProject` ("Back to {{name}}");
- `projects.chat.notFound`;
- `projects.publish.chatsWarning_one` / `_other`;
- `projects.actions.deleteConfirmWithChatsDescription_one` / `_other`.

The Rename, Delete, Save, Cancel and Retry labels reuse `buttons.rename`, `buttons.delete`, `buttons.save`, `buttons.cancel` and `buttons.retry`. The See more link takes the new generic key `buttons.seeMore` ("See more", `ButtonsI18nKeys.SeeMore`), because the design's wording differs from `buttons.showMore`. The lib never imports i18n.

#### Scenario: Labels come from the projects namespace

- **WHEN** `ProjectConversationsSection` renders an empty project
- **THEN** the empty state shows the `projects.chats.empty` and `projects.chats.emptyDescription` translations

### Requirement: Project chats are mobile-first, RTL-safe and meet WCAG 2.1 AAA

The project chat surfaces (`ProjectConversationsSection`, `ProjectConversationList`, `ProjectChatPage`) SHALL meet the following:

- **Mobile.** The main column stacks above the Details panel. List rows are full width, and titles truncate, so there is no horizontal scroll. The input keeps the composer's mobile behaviour.
- **RTL.** Only logical properties are used (`ms-*`, `ps-*`, `text-start`, `border-s`). The breadcrumb back arrow mirrors with `rtl:scale-x-[-1]`. The ⋮ icon is symmetric and is not mirrored.
- **a11y.**
  - The Chats section is named by its heading.
  - Rows are buttons with accessible names that include the author.
  - The status point is `aria-hidden`; the unread state reaches screen readers through the row's description.
  - The ⋮ trigger hidden on `desktop` is only transparent, so keyboard users still reach it, and it shows as soon as it holds focus.
  - Every Tabler icon uses `stroke={DIAL_KIT_ICON_STROKE}`.
  - The row menu is keyboard-operable.
  - The rename and delete dialogs are labelled, focus moves into them and returns to the row's ⋮ trigger on close. After a delete, whose row is gone, focus moves to the row now in its place, the one before it, or the list.
  - The embedded composer is not a landmark of its own: it carries no `Welcome screen` region inside the Chats column.
  - Loading, error and create/rename/delete outcomes are announced through a `role="status"` region or toasts.
  - Text fallbacks resolve to at least 7:1 contrast.
- **Flag.** Everything here is behind `FeatureKey.ProjectsEnabled` (`PROJECTS_ENABLED`). No `ENABLED_FEATURES` role key applies.
- **Observability.** There are no new analytics events. The existing toasts (`notifyOperationSuccess` / `showErrorNotification`) report outcomes, and the BFF logs (see the `project-conversations-api` capability) carry counts only.

#### Scenario: No horizontal scroll on mobile

- **WHEN** the project view with a 200-character chat title renders at 360px width
- **THEN** the document has no horizontal scroll, and the title is truncated with its full text in a tooltip

#### Scenario: Focus after a delete

- **WHEN** the owner deletes the first of two rows
- **THEN** focus moves to the row that is now first

#### Scenario: Delete dialog returns focus

- **WHEN** the user cancels the delete dialog opened from a row's ⋮ menu
- **THEN** focus returns to that row's ⋮ trigger
