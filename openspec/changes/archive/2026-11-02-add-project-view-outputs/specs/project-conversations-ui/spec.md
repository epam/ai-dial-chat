## MODIFIED Requirements

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
