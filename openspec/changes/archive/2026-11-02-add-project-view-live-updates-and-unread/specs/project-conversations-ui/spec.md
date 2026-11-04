## MODIFIED Requirements

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
| `labels` | `ProjectConversationListLabels`, including the new optional `unreadLabel` (default `'Unread'`) |
| `typography` | optional `ProjectConversationListTypography`, including the new `unreadRowTitleClassName` (default `'dial-body-semi-text'`) |
| `colors` | optional `ProjectConversationListColors` `{ unreadDot?: string }`, applied with `buildCssVars` as `--pcl-unread-dot` |

**Rendering:**
- a `<section>` named by its `<h2>` `labels.title` ("Chats"). While the project has no chats (not loading, no error, no items) the heading is not rendered and the section is named by `aria-label={labels.title}` instead, so only the empty state shows, as in the design;
- a `<ul>` with one `<li>` per item. Each row is a button named `labels.openLabel(title, authorName)`, containing:
  - `InitialsAvatar` (`@epam/ai-dial-chat-shared`) from `authorName`, `aria-hidden`;
  - the title in `dial-body-text`, truncated to one line with `EllipsisTooltip`, or in `typography.unreadRowTitleClassName` when `isUnread`.

  Rows have the design's hover and focus-visible background (`--bg-accent-primary-alpha` fallback).
- **Unread rows** (`isUnread: true`) mirror `ConversationRow` in `libs/conversation-panel`, which this lib does not import:
  - an `aria-hidden` dot of `7.11px` sits at the row's inline end, before the ⋮ trigger. Its colour comes from `ProjectConversationList.module.scss`, `.unreadDot { background: var(--pcl-unread-dot, var(--text-accent, #1d4ed8)); }`, and the fallback reaches 7:1 against the row background;
  - the row button carries `aria-describedby` pointing to a visually hidden `<span>` with `labels.unreadLabel`, so screen readers announce "…, Unread" after the accessible name without changing it;
  - while the row is hovered or holds focus, or its menu is open, the dot hides (`opacity-0`) so the trigger takes its place, and the hidden label still announces the state;
  - a read row renders neither the dot nor the description.
- when `onRename` or `onDelete` is supplied, a ⋮ kit `Dropdown` per row, triggered by a `GhostIconButton` named `labels.moreActionsLabel(title)`, with Rename and Delete. The arrow keys, Enter and Space come from the kit.
- **States:**
  - loading: `Spinner` with `labels.loadingLabel`;
  - error: `labels.errorLabel` and a retry `Button`;
  - empty: `PanelEmptyState` with the list illustration, `labels.emptyTitle` ("No outputs or chats yet") and `labels.emptyDescription` ("Your outputs and chats will appear here once started.").
- Error and empty text are in a `role="status"` region.
- Rows are keyed by `id`, so an item that changes title or unread state in place keeps its DOM node and any focus inside it.

`ProjectView`'s Details panel and this list are independent: the host passes the list in `mainContent`.

This is the lib's first stylesheet under this component. It ships in the lib's existing `./styles.css` export, and the README's class and colour tables gain `--pcl-unread-dot` (`.claude/rules/libs.md`, `lib-theming`).

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
- **THEN** its row button has an accessible description of "Unread", its title uses `dial-body-semi-text`, and an `aria-hidden` dot renders

#### Scenario: Read row has no indicator

- **WHEN** an item has no `isUnread`
- **THEN** no dot and no accessible description render, and the title uses `dial-body-text`

#### Scenario: A row turns unread in place

- **WHEN** a row has keyboard focus and its item changes to `isUnread: true`
- **THEN** focus stays on that row, and the dot appears once focus leaves it

### Requirement: The project view's main column holds the chat input and the Chats list

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL own the Chats list state through `useProjectConversations(projectId)` (`apps/chat/src/hooks/projects/useProjectConversations.ts`, the adapter of `libs/chat-hooks/src/project/use-project-conversations.ts`). It passes that state to `ProjectConversationsSection` (`apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`) as the new `conversations` prop, and passes the section to `ProjectView` as `mainContent`. The page owns the state so the project watch can refresh it (see the `project-view-live-updates` capability).

The section renders:

1. **The chat input, only when `project.canEdit`.**
   - It is `NewConversationComposer` with a new `ComposerLayout.Embedded` (`apps/chat/src/types/conversation-composer.ts`): no greeting, no page footer (`FooterMessage`: operator message and app version), the input in normal flow at the top of the column, with the model selector, attachments, tools, the `+` menu's Prompts and Skills entries, the `/` command menu, skill mentions (sent as the first message's `skills`, restored on a failed create) and the deployment's `isChatMessageInputDisabled`, exactly as on the new-conversation screen. Both screens take the prompt and skill wiring from one hook, `useComposerMenus` (`apps/chat/src/hooks/conversation/useComposerMenus.tsx`), so the two composers cannot drift apart.
   - The selection comes from `DeploymentsContext`, and the section calls `restoreDefaultSelection` on mount, as `ConversationRoute` does, so a model restored from a viewed chat does not leak in.
   - Its placeholder is the shared `chat.placeholder` ("How can I help you today?").
2. **`ProjectConversationList`**, fed by the `conversations` prop.
   - The hook owns `{ items, isLoading, hasError, hasMore, isLoadingMore, retry, loadMore, rename, remove, refresh, markViewed }` in local state. It follows the `useFavicon` pattern: `AbortController` cleanup, async/await.
   - While `hasMore`, the list ends with a Show more button (`buttons.showMore`). `loadMore` requests the next page with `offset` set to the rows already listed, appends it without repeating a row, and a failure keeps the rows and shows `projects.chats.error`.
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
