## MODIFIED Requirements

### Requirement: ProjectChatPage hosts a project conversation

`ProjectChatPage` (`apps/chat/src/pages/ProjectChatPage/ProjectChatPage.tsx`), at `ROUTES.ProjectChat`, SHALL:

- render `NotFoundPage` when `projectsEnabled` is off;
- parse the route with `parseProjectConversationRouteParams`. On `null` it renders the project not-found state with a link back to `/projects`;
- load the project with `useProject(projectId)` for its name and `canEdit`. When the opening project page passed `ProjectChatNavigationState.project` (`apps/chat/src/models/project-chat.ts`) for the same project id in router state, the page renders the chat from it at once, captured on mount because `ConversationPage` clears the router state, and the details replace it when they arrive; a details failure other than `404` then keeps the chat open. Without it, `Spinner` shows while loading;
- wrap `ConversationPage` in `ConversationDataSourceContext.Provider` with the project value, and pass it the parsed `conversationId` (the page's optional `conversationId` prop; it defaults to the `/conversations/*` splat);
- render a breadcrumb (`ProjectChatHeader`). On desktop it is portalled into the start cell of `ChatLayout`'s top bar through `ChatLayoutHeaderSlotContext` (`apps/chat/src/context/ChatLayoutHeaderSlotContext.tsx`), beside the sources toggle, with no border of its own; on mobile, where that bar is hidden, it is a bar above the conversation: a back `GhostIconButton` named `projects.chat.backToProject` (with `IconArrowNarrowLeft`, `aria-hidden`, `stroke={DIAL_KIT_ICON_STROKE}`, `rtl:scale-x-[-1]`), then the project name truncated with `EllipsisTooltip`, linking to `getProjectViewRoute(projectId)`.

**Who may write.** `canEdit` is `true` for the owner and for a recipient with edit access (see the `project-detail-api` capability). For both, the project value of `ConversationDataSourceContext` is writable: the input, regenerate, message edit and delete, and rating work as in a regular chat. The conversation is read-only only when `canEdit` is `false` (a view-only recipient or an organization project). `ProjectChatNavigationState.project.canEdit` keeps the same meaning: whether the caller may write the project's chats.

The page owns no conversation state: `ConversationPage` and `GenerationContext` own it, as for a regular chat. The generation-registry key is the stripped path `{bucket}/{projectPath}/conversations/{name}`. It begins with a bucket id and therefore does not collide with a regular bucket-relative path in practice.

#### Scenario: Read-only shared project chat

- **WHEN** a view-only recipient (`canEdit: false`) opens a conversation of a project shared with them
- **THEN** the conversation renders read-only: no input and no regenerate or edit actions, and no Duplicate action

#### Scenario: A shared editor's chat is writable

- **WHEN** a recipient with edit access (`canEdit: true`, `canManage: false`) opens a conversation the owner started
- **THEN** the input, regenerate and message edit actions render, and sending a message posts to `POST /api/v1/projects/{id}/conversations/completions`

#### Scenario: Back to project

- **WHEN** the user activates the breadcrumb's back button
- **THEN** the router is at `getProjectViewRoute(projectId)`

### Requirement: The project view's main column holds the chat input and the Chats list

`ProjectViewPage` (`apps/chat/src/pages/ProjectViewPage/ProjectViewPage.tsx`) SHALL own the Chats list state through `useProjectConversations(projectsClient, projectId)` (`libs/chat-hooks/src/project/use-project-conversations.ts`, exported from `@epam/ai-dial-chat-hooks/project`, called directly with the app's `projectsClient` from `apps/chat/src/hooks/projects/projects-client.ts`). It passes that state to `ProjectConversationsSection` (`apps/chat/src/components/ProjectConversationsSection/ProjectConversationsSection.tsx`) as the new `conversations` prop, together with an optional `outputs` node (the page's `ProjectOutputs`, see the `project-view-ui` capability), and passes the section to `ProjectView` as `mainContent`. The page owns the state so the project watch can refresh it (see the `project-view-live-updates` capability).

The section renders:

1. **The chat input, only when `project.canEdit`.**
   - It is `NewConversationComposer` with a new `ComposerLayout.Embedded` (`apps/chat/src/types/conversation-composer.ts`): no greeting, no page footer (`FooterMessage`: operator message and app version), the input in normal flow at the top of the column, with the model selector, attachments, tools, the `+` menu's Prompts and Skills entries, the `/` command menu, skill mentions (sent as the first message's `skills`, restored on a failed create) and the deployment's `isChatMessageInputDisabled`, exactly as on the new-conversation screen. Both screens take the prompt and skill wiring from one hook, `useComposerMenus` (`apps/chat/src/hooks/conversation/useComposerMenus.tsx`), so the two composers cannot drift apart.
   - The selection comes from `DeploymentsContext`, and the section calls `restoreDefaultSelection` on mount, as `ConversationRoute` does, so a model restored from a viewed chat does not leak in.
   - Its placeholder is the shared `chat.placeholder` ("How can I help you today?").
2. **The Outputs section, when `outputs` is set**, for every reader (owner or not).
   - The section passes `outputs` to `ProjectConversationsPanel`'s new `outputs?: ReactNode` slot (`libs/projects/src/models/project-conversations-panel-props.ts`, documented as "Content between `composer` and the Chats list; omitted when unset").
   - The panel renders `composer`, then `outputs`, then `ProjectConversationList`, with no wrapper of its own around `outputs`, so the host's node sits in the column's flow. The panel knows nothing about outputs beyond the slot and its `hasOutputs` flag (default `false`), which it passes to the list as `isEmptyStateShown={!hasOutputs}`.
   - `ProjectViewPage` sets `hasOutputs` while the Outputs section shows files or its error, so a project with outputs but no chats does not say "No outputs or chats yet".
3. **`ProjectConversationList`**, fed by the `conversations` prop.
   - The hook owns `{ items, isLoading, hasError, hasMore, isLoadingMore, retry, loadMore, rename, remove, refresh, markViewed }` in local state. It follows the `useFavicon` pattern: `AbortController` cleanup, async/await.
   - DIAL Core cannot page a project's conversations in display order, so the hook reads the whole list once (`listProjectConversations(projectId, signal)`, no paging) and pages it locally: `items` is the first 20 rows, as in the design (node `23:24330`), and `hasMore` is whether more rows are loaded than shown. While `hasMore`, the list ends with a See more link (`buttons.seeMore`).
   - `loadMore` shows the next 20 rows. When any of them carries `isTitlePending`, it first reads their titles with `getProjectConversationTitles(projectId, names, signal)` (`POST /api/v1/projects/:id/conversations/titles`), with `isLoadingMore` set meanwhile, so no row shows its file-name title. Without pending rows it makes no request. A failed read rejects, keeps the rows shown so far, and the host shows `projects.chats.error`.
   - Items map from `ProjectConversationItemDto` (`title`, `author` → `authorName`, `isUnread`).
   - `refresh()` re-reads the whole list silently:
     - it replaces the rows in one update and keeps the number shown, so new, renamed, deleted and newly answered chats appear without a reload;
     - it then reads the titles of the shown rows that are still pending, in batches of at most 100 names, and a failed read keeps their file-name titles;
     - it never sets `isLoading` or `hasError`, and a failure keeps the current rows;
     - a newer `refresh`, a `retry`, a project change or unmount aborts it.
   - A delete that brings a pending row into view reads its title the same way, silently.
   - `markViewed(id)` sets that item's `isUnread` to `false` immediately, fires `client.markProjectConversationViewed?.(id)` without awaiting it, and swallows its failure. Until a later read reports a newer `updatedAt` for that item, every `refresh` result keeps it read. This hides the old dot when a refresh that started before the mark lands after it.

**First message.** Submitting the input SHALL:

1. call `createProjectConversation(projectId, …)` with the same fields `ConversationRoute`'s `handleCreateConversation` sends;
2. save the prompt, temperature and response format through `saveProjectConversation`;
3. `navigate(getProjectConversationRoute(conversation.id), { state: { conversation } })`.

`ConversationPage` then starts the stream, as for a new regular chat. A `413 project-storage-full` shows `projects.chats.storageFull`; other failures show `projects.chats.createError`. In both cases the draft is kept.

**Row actions:**
- `onOpen` (every reader) calls `conversations.markViewed(id)`, then navigates to the project chat route.
- `onRename` (when `project.canEdit`) opens a kit `Popup` named `projects.chats.renameTitle`, with a labelled `Input` seeded with the title and Save and Cancel buttons (`buttons.save`, `buttons.cancel`). Save, or Enter in the input, trims the value, refuses an empty one inline (`projects.chats.renameEmpty`), and calls `renameProjectConversation`.
- `onDelete` (when `project.canEdit`) opens `DeleteConfirmationDialog` with `projects.chats.deleteConfirmTitle` (`{{title}}`) and `projects.chats.deleteConfirmDescription`, then calls `deleteProjectConversation`.

Success updates the list in place and shows a toast. Failure shows `projects.chats.renameError` or `projects.chats.deleteError`. Neither dialog can be closed while its request is pending. When a refresh removes the row a rename or delete dialog was opened for, the dialog closes and focus moves to the list.

After a delete, the project view's chat count (the delete-project message and the publish warning) drops by one without a reload. A later silent `refresh()` of the project resets the count to the BFF's `conversationCount`.

**Who may write.** `canEdit` is `true` for the owner and for a recipient with edit access. Both get the input and the row menus, and an editor may rename and delete any row, the owner's included, because Core grants `WRITE` to the whole project.

**Read-only** (`canEdit: false`: a view-only recipient or an organization project): no input, and `onRename`/`onDelete` are omitted. The list still opens chats and marks them viewed.

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

- **WHEN** a view-only shared project (`canEdit: false`) with two conversations is opened
- **THEN** the Chats list shows both without row menus, and no chat input renders

#### Scenario: A shared editor gets the input and row menus

- **WHEN** a recipient with edit access opens a shared project with two conversations, one started by the owner
- **THEN** the chat input renders, and both rows offer Rename and Delete

#### Scenario: Rename from the list

- **WHEN** the owner renames a row to `Login article`
- **THEN** `renameProjectConversation` is called with `newTitle: 'Login article'`, and the row shows the new title

#### Scenario: Live refresh adds a new chat

- **WHEN** a collaborator's tab creates chat D and the page's watch triggers `refresh()`
- **THEN** D appears at the top of the list, and no spinner renders

#### Scenario: See more pages locally

- **WHEN** the project holds 45 chats, the 25 oldest listed with `isTitlePending`, and the user activates See more
- **THEN** one titles request names the 21st to 40th chats, the list then shows 40 rows with their body titles, and the list itself is not requested again

#### Scenario: Refresh keeps the shown rows

- **WHEN** 25 rows are shown after a `loadMore` and `refresh()` runs
- **THEN** it reads the whole list once, still shows 25 rows plus any new ones, and reads the titles of the shown rows the list left pending

#### Scenario: Opening marks the chat read

- **WHEN** a reader activates an unread row
- **THEN** `markProjectConversationViewed` is called with its id, and the row is read before the route changes
